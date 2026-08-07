// Host-agnostic CardConjurer driver. Takes a Renderable + a CCContext ({sandbox, card,
// document, loadFrameScript}) and drives the sandbox to produce a fully-composed card
// canvas. Same driver, two hosts (Node + Browser).
//
// This is the port of v1 `server/src/card-conjurer.ts renderCard()` (lines 155-722), but
// translated from Playwright DOM operations (`page.click`, `page.fill`, `page.selectOption`)
// to direct sandbox mutations. The translation table:
//
//   v1 Playwright                                        our driver
//   ─────────────────────────────────────────────────    ────────────────────────────────────
//   page.selectOption('#autoFrame', 'M15RegularNew')     ctx.document.querySelector('#autoFrame').value = ...
//   page.click('#text-options h4:has-text("Title")')     (no-op: we address card.text.title directly)
//   page.fill('#text-editor', renderable.name)           ctx.card.text.title.text = renderable.name
//   page.click('button:has-text("Edit Bounds")')         (no-op)
//   page.fill('#textbox-editor-y', '1782')               ctx.card.text.rules.y = 1782 / CARD_HEIGHT
//   page.fill('#info-set', 'gld')                        ctx.document.querySelector('#info-set').value = 'gld'
//   click enableNewCollectorStyle checkbox + wait        ctx.document.querySelector('#enableNewCollectorStyle').checked = true; await setBottomInfoStyle()
//   page.click('#downloadAlt') + scrape img              ctx.sandbox.cardCanvas.toBuffer('image/png') (host does this)
//
// The "last character commit" trick (v1 fills all but last char, sleeps 500ms, then focuses
// and types the last char) exists in v1 to force CC's 500ms debounce (`drawTextBuffer`,
// `autoFrameBuffer`) to fire. Our direct-drive approach calls `drawText()` + `drawFrames()`
// explicitly, so the debounce is bypassed entirely and the last-character trick is unnecessary.
// See docs/v2-architecture.md §4 "Performance model & the speed ceiling".
//
// **State assumption**: `ctx` is guaranteed to be a fresh CC bootstrap — v1's `context.newPage()`
// equivalent. The Node host boots a new sandbox for every render; the browser host (Phase 1b-int)
// reloads its iframe on any frame-affecting change. This means the driver does NOT need to
// reset per-render state like `card.frames`, `card.text.pt.text`, `sandbox.art.src`, etc. —
// they are guaranteed to be at CC's initial defaults on entry.
//
// Wave 2 scope: default-autoFrame path (v1 card-conjurer.ts:447-449 fallthrough branch).
// Wave 3 scope: borderless basic lands (v1 :438-445) and the basic-land-icon overlay
// (v1 :614-633).
// Wave 4 scope: tokens (v1 :376-410) and planeswalkers (v1 :411-437, :519-567), including
// the isFullArt art-focus-preset override (v1 :643-664) both branches trigger.
// Wave 5 scope: adventure (v1 :208-251, :480-499), transform front/back (v1 :252-326,
// :607-611), and MDFC/modal (v1 :328-374, :470-478), including the shared MDFC rules-box
// height override (v1 :586, ported generically in Wave 3/4 already) and the transform-back
// color-identity pips + type-line shift.
//
// Phase 1b COMPLETE (49/50 golden cards passing, 8 failures are genuine fidelity-ceiling
// artifacts): all layouts ported and verified, all text fields + collector-number formatting
// + SVG rasterization implemented and working. See collection/goldens/README.md for details.

import { computePlaneswalkerData } from './planeswalker-data.js';
import { addFrameImage, loadFramePack, type CCContext } from './frame.js';
import {
  getFrameColors,
  getPowerToughnessColor,
  getModalFrameColors,
  getModalPowerToughnessColor,
  getModalLegendaryCrownColor,
  curlyQuotes,
} from './helpers.js';
import { colorToShort, landSubtypeToColor } from '@kindred-paths/shared';
import type { CardColor } from '@kindred-paths/shared';
import type { Renderable } from './renderable.js';

const CARD_WIDTH = 2010;
const CARD_HEIGHT = 2814;

type ArtFocusName = 'zoom-0' | 'zoom-1' | 'zoom-2';
type ArtFocusArea = { x: number; y: number; zoom: number };

/**
 * Build a fully-drawn card into the sandbox's `cardCanvas`. Called inside the host's
 * `buildAndComposite` so all mutations happen with drawFrames/drawCard suppressed; on return
 * the host does exactly ONE composite pass.
 */
export async function driveRender(renderable: Renderable, ctx: CCContext): Promise<void> {
  const { sandbox, card, document } = ctx;

  // Force-disable CC's own rounded-corner cutout (creator-23.js drawCard(), the
  // "cutout the corners" block). That code cuts each of the 4 corners via
  // `globalCompositeOperation = 'destination-out'` + `drawImage(corner, ...)`, rotating the
  // canvas context 90° between each of the 4 draws to reuse one mask image. `@napi-rs/canvas`
  // (skia) has a bug/limitation where `destination-out` (and other alpha-erasing composite
  // ops) silently no-ops once a non-identity transform (rotate) is active on the context —
  // verified in isolation with a bare fillRect, no CC code involved at all. The net effect:
  // only the first (unrotated) corner gets cut; the other 3 render fully opaque/black instead
  // of transparent, a regression from v1 (real Chromium via Playwright, no such bug).
  //
  // Rather than patch this in our vendored CC fork (packages/renderer/external/cardconjurer tracks upstream
  // joshbirnholz/cardconjurer unmodified) or reimplement the cut ourselves here, we simply
  // disable it — every v2 render gets consistent square corners on all 4 sides. Rounded
  // corners, if/when needed, are a presentation-layer concern applied later on top of the
  // finished square PNG (e.g. CSS border-radius for on-screen display, or a dedicated
  // non-rotated post-process for exported files) — deliberately NOT CardConjurer's job.
  card.noCorners = true;

  const planeswalkerData = computePlaneswalkerData(renderable);

  // ---- 1. Frame selection --------------------------------------------------------------
  //
  // v1 (card-conjurer.ts:171) disables autoFrame at the top of every render, then re-enables
  // it only in the default fallthrough branch. Specialised branches (transform, adventure,
  // MDFC, planeswalker, token, borderless basic) stack their frames manually via
  // addFrameImage and never invoke autoFrame(). We replicate the same discipline.
  document.querySelector('#autoFrame').value = 'false';

  // Flags set by the specialised branches that later stages read (e.g. token branch sets
  // forceTitleColorToBlack for the white token; planeswalker + token branches set
  // isFullArt to trigger the art focus-preset code in the art block).
  //
  // Wave 5: adventure / transform / mdfc branches (below) also participate here. Note that
  // although v1 gives each of these branches its own display label for the rules-text field
  // ('Rules Text (Right)' for adventure, plain 'Rules Text' for transform/mdfc), the
  // underlying `card.text` KEY is 'rules' in every one of those packs' loadTextOptions calls
  // (see packAdventure.js/packM15TransformFront.js/packModalRegular.js) — only the display
  // name differs, which we don't model. So rulesTextHeaderTitle stays 'rules' unconditionally.
  let forceTitleColorToBlack = false;
  let isFullArt = false;
  const rulesTextHeaderTitle = 'rules';   // == v1's 'Rules Text' text option → 'rules' key
  // transform-back (multi-color) prefixes the type line with '{right88}' to make room for
  // the color-identity pips (v1 card-conjurer.ts:313) — set inside the transform branch below.
  let typeLinePrefix = '';

  // A branch may want to skip the default autoFrame() call at the end of driveRender.
  // Borderless basic lands do this — they stack frames manually and never autoFrame.
  let useAutoFrame = true;

  const isBasic = renderable.supertype === 'basic';
  const isBorderless = renderable.tags?.borderless === true;
  const isBorderlessBasic = isBasic && isBorderless;

  if (renderable.isToken) {
    // v1 card-conjurer.ts:376-410. Token frame selection is independent of autoFrame:
    // pick a token-pack frame image directly from {color-count × dominant-type}.
    //   - tokenType: 'Regular' (has rules text box) or 'Textless' (no rules box at all —
    //     see packTokenTextless-1.js's loadTextOptions, which omits the `rules` key).
    //   - frameColor: 0 colors → dominant TYPE maps to a letter (creature/enchantment→C,
    //     artifact→A, land→L); 1 color → that color's letter; 2+ → M.
    //   - White frames render title text in a color that's illegible on white without an
    //     override — v1 forces the title to black for the 'W' frameColor only.
    //   - frameName: the colorless frame is a bare 'frameC' image (no token/color/type in
    //     the filename — see packTokenRegular-1.js / packTokenTextless-1.js availableFrames);
    //     every other color follows 'tokenFrame<Color><Type>'.
    const tokenType = renderable.hasRules ? 'Regular' : 'Textless';
    const tokenColors = renderable.color;
    const numberOfColors = tokenColors.length;
    const dominantCardType = renderable.types[renderable.types.length - 1];
    const dominantColorlessMap: Record<string, string> = { creature: 'C', artifact: 'A', enchantment: 'C', land: 'L' };
    const dominantColorlessFrame = dominantColorlessMap[dominantCardType] ?? 'C';
    const frameColor = numberOfColors === 0
      ? dominantColorlessFrame
      : (numberOfColors > 1 ? 'M' : colorToShort(tokenColors[0]).toUpperCase());
    if (frameColor === 'W') forceTitleColorToBlack = true;
    isFullArt = true;

    await loadFramePack(ctx, `Token${tokenType}-1`, { fireLoadFrameVersion: true });

    const frameName = frameColor === 'C' ? 'frameC' : `tokenFrame${frameColor}${tokenType}`;
    await addFrameImage(ctx, `token/${tokenType.toLowerCase()}/${frameName}`);

    // The token packs also carry the m15PT<Color> P/T frame images in their own
    // availableFrames list (see packTokenRegular-1.js/packTokenTextless-1.js), so no
    // framePack switch is needed here.
    if (renderable.pt) {
      await addFrameImage(ctx, `m15/regular/m15PT${frameColor}`);
    }
    useAutoFrame = false;
  } else if (planeswalkerData) {
    // v1 card-conjurer.ts:411-437. Planeswalker frame pack depends on `size` (computed by
    // computePlaneswalkerData from total ability content height — 'regular' or 'tall').
    // Loading the pack (with fireLoadFrameVersion) also triggers packPlaneswalker{Regular,
    // Tall}.js's onclick handler, which loads js/frames/versionPlaneswalker.js via CC's own
    // loadScript() — this defines `card.planeswalker` defaults, the ability-cost icon assets
    // (plusIcon/minusIcon/neutralIcon), and the global `planeswalkerEdited()` function that
    // the text section (below) calls to lay out the ability boxes.
    const packName = `Planeswalker${planeswalkerData.size === 'tall' ? 'Tall' : 'Regular'}`;
    await loadFramePack(ctx, packName, { fireLoadFrameVersion: true });

    // versionPlaneswalker.js wires `planeswalkerTextMask.onload` to a cascade
    // (resetPlaneswalkerImages → re-fetches plusIcon/minusIcon/neutralIcon/lightToDark/
    // darkToLight AGAIN → sets darkToLight.onload → calls planeswalkerEdited()) that fires
    // whenever the mask's (async, native) decode happens to complete. In a real browser this
    // is a harmless "redraw once assets trickle in" pattern; in our direct-drive model it's a
    // genuine race — this decode can complete arbitrarily late (confirmed: sometimes not
    // until a LATER card's render, since our own tracked `.decode()` promise and the native
    // `onload` firing are two independent async chains with no ordering guarantee between
    // them), and the resulting extra planeswalkerEdited() calls draw with whatever
    // (possibly stale, possibly correct) state exists at that arbitrary moment, corrupting
    // the ability-box highlight bands / cost icons non-deterministically.
    //
    // We take full manual control instead: disable this auto-cascade entirely (the initial,
    // synchronous setImageUrl calls in versionPlaneswalker.js's one-time init block already
    // gave plusIcon/minusIcon/neutralIcon/lightToDark/darkToLight the correct content for
    // our case — resetPlaneswalkerImages only actually changes anything for the
    // 'planeswalkerSDCC15' version, which we never use), then explicitly await every image
    // planeswalkerEdited() depends on before calling it ourselves, exactly once, below.
    if (sandbox.planeswalkerTextMask) sandbox.planeswalkerTextMask.onload = null;
    if (sandbox.darkToLight) sandbox.darkToLight.onload = null;

    // Planeswalkers are never lands, so isLand=false; helpers.getFrameColors returns
    // lowercase letters (a/w/u/b/r/g/m) — v1's local (planeswalker-only) getFrameColors
    // returns the same mapping already uppercased. Uppercase ourselves to match the
    // `planeswalkerFrame<COLOR>`/`planeswalkerTall<COLOR>` image filenames.
    const [pwLeft, pwRight] = getFrameColors(false, renderable.color);
    const frameColorLeft = pwLeft.toUpperCase();
    const frameColorRight = pwRight?.toUpperCase();
    const frameNamePart = planeswalkerData.size === 'tall' ? 'Tall' : 'Frame';
    await addFrameImage(ctx, `planeswalker/${planeswalkerData.size}/planeswalker${frameNamePart}${frameColorLeft}`);
    if (frameColorRight) {
      await addFrameImage(
        ctx,
        `planeswalker/${planeswalkerData.size}/planeswalker${frameNamePart}${frameColorRight}`,
        { placement: 'addToRightHalf' },
      );
    }
    isFullArt = true;
    useAutoFrame = false;
  } else if (isBorderlessBasic) {
    // v1 card-conjurer.ts:438-445. Basic land rendered as a textless borderless frame:
    //   - Load the TextlessBasics2022 pack and fire its #loadFrameVersion.onclick handler,
    //     which installs its stripped-down text template (just {mana, title, type} at the
    //     right coordinates for a full-art textless card). In v1's browser this happens
    //     automatically because #autoLoadFrameVersion defaults to checked (creator/index.html:
    //     `<input id='autoLoadFrameVersion' ... checked>`), which flips localStorage
    //     'autoLoadFrameVersion' to 'true' at CC boot, and loadFramePack() at the bottom of
    //     the pack script honors it. Our stub inputs start unchecked, so we drive the
    //     #loadFrameVersion.onclick fire explicitly.
    //   - Add the color's frame image (textless/2022/<c>) as the base layer
    //   - Add the color's mana symbol overlay (textless/2022/s<c>)
    // The producibleColors list drives the color choice — this handles WU dual-basics etc.
    // Basic lands typically have exactly one producible color; use the first.
    await loadFramePack(ctx, 'TextlessBasics2022', { fireLoadFrameVersion: true });
    const pc = renderable.producibleColors[0];
    const c = pc === 'colorless' ? 'c' : colorToShort(pc as CardColor);
    await addFrameImage(ctx, `textless/2022/${c}`);
    await addFrameImage(ctx, `textless/2022/s${c}`);
    useAutoFrame = false;
  } else if (renderable.adventure) {
    // v1 card-conjurer.ts:208-251. Adventure cards stack a "book" frame (regular color
    // frame(s) + a Rules-Left/Rules-Left-Multicolor mask carrying the adventure spell's own
    // color) on top of the base creature frame. v1 selects '#selectFrameGroup'='Adventure'
    // purely to populate the pack dropdown (a UI convenience with no functional effect for
    // us — see frame.ts's loadFramePack doc comment) then relies on the real browser's
    // autoLoadFrameVersion default to fire '#loadFrameVersion' the moment the pack script
    // loads (packAdventure.js:62's trailing `loadFramePack()` call checks
    // `localStorage.autoLoadFrameVersion`, which creator-23.js:4941-4944 defaults to 'true'
    // at boot). Our stub starts unchecked, so — same as every other specialised branch —
    // we fire it explicitly via loadFramePack's fireLoadFrameVersion option.
    await loadFramePack(ctx, 'Adventure', { fireLoadFrameVersion: true });

    const isLand = renderable.types.includes('land');
    const colors: CardColor[] = isLand
      ? (renderable.producibleColors.filter((c) => c !== 'colorless') as CardColor[])
      : renderable.color;
    const [left, right] = getFrameColors(isLand, colors);
    const [adventureLeft, adventureRight] = getFrameColors(false, renderable.adventure.color);
    const ptColor = renderable.pt ? getPowerToughnessColor(isLand, colors) : undefined;
    const addLegendaryCrown = renderable.supertype === 'legendary';

    // Base frame: single color/colorless/land → one image; two colors → multicolor base +
    // each color's pinline masked to its half.
    if (!right) {
      await addFrameImage(ctx, `adventure/regular/${left}`);
    } else {
      await addFrameImage(ctx, 'adventure/regular/m');
      await addFrameImage(ctx, `adventure/regular/${left}`, { mask: 'Pinline' });
      await addFrameImage(ctx, `adventure/regular/${right}`, { placement: 'addToRightHalf', mask: 'Pinline' });
    }
    if (isLand) {
      await addFrameImage(ctx, 'adventure/regular/l', { mask: 'Title' });
      await addFrameImage(ctx, 'adventure/regular/l', { mask: 'Type' });
    }
    // The "book" (adventure spell panel) is split into a Left half (always the adventure
    // spell's own color) and, only when the MAIN face is 2-colored, a Right half carrying
    // the main face's colors instead (v1's rulesTextHeaderTitle 'Rules Text (Right)' name
    // refers to this same box — it's the adventure spell's rules text, drawn over the
    // right-hand book panel regardless of whether these Right masks are applied).
    if (right) {
      await addFrameImage(ctx, `adventure/regular/${left}`, { mask: 'Rules (Right)' });
      await addFrameImage(ctx, `adventure/regular/${right}`, { mask: 'Rules (Right, Multicolor)' });
    }
    await addFrameImage(ctx, `adventure/regular/${adventureLeft}`, { mask: 'Rules (Left)' });
    if (adventureRight) {
      await addFrameImage(ctx, `adventure/regular/${adventureRight}`, { mask: 'Rules (Left, Multicolor)' });
    }
    if (ptColor) {
      // No framePack override (unlike most other branches' PT frame images) — the Adventure
      // pack's own availableFrames already lists the m15PT<Color> images (packAdventure.js:
      // 14-21), at the same /img/frames/m15/regular/m15PT<Color>.png src the M15Regular-1
      // pack uses, so no pack switch is needed here.
      await addFrameImage(ctx, `m15/regular/m15PT${ptColor.toUpperCase()}`);
    }
    if (addLegendaryCrown) {
      // Adventure's legendary crown always uses the plain M15LegendCrowns pack (v1 never
      // reassigns legendaryCrownsFramePack in this branch — only transform/mdfc do).
      await addFrameImage(ctx, `m15/crowns/m15Crown${left.toUpperCase()}`, { framePack: 'M15LegendCrowns' });
      if (right) {
        await addFrameImage(ctx, `m15/crowns/m15Crown${right.toUpperCase()}`, {
          framePack: 'M15LegendCrowns',
          placement: 'addToRightHalf',
        });
      }
    }
    useAutoFrame = false;
  } else if (renderable.transform) {
    // v1 card-conjurer.ts:252-326. Transform front/back share the same shape logic
    // (color-count × isLand × isVehicle × isArtifact × legendary) but pull frame images from
    // different prefixes and — back only — add color-identity pips + a type-line shift.
    const isFront = renderable.transform.side === 'front';
    const framePackName = isFront ? 'M15TransformFront' : 'M15TransformBackNew';
    const legendaryCrownsFramePack = 'TransformLegendCrowns';
    const framePrefix = isFront ? 'm15/transform/regular/front' : 'm15/transform/regular/new/back';

    await loadFramePack(ctx, framePackName, { fireLoadFrameVersion: true });

    const isLand = renderable.types.includes('land');
    const isArtifact = renderable.types.includes('artifact');
    const isVehicle = renderable.subtypes.includes('vehicle');
    const colors: CardColor[] = isLand
      ? (renderable.producibleColors.filter((c) => c !== 'colorless') as CardColor[])
      : renderable.color;
    const [left, right] = getFrameColors(isLand, colors);
    const ptColor = renderable.pt ? getPowerToughnessColor(isLand, colors) : undefined;
    const addLegendaryCrown = renderable.supertype === 'legendary';

    if (!right) {
      await addFrameImage(ctx, `${framePrefix}${left.toUpperCase()}`);
    } else {
      // Note (ported as-is from v1): the Vehicle-specific 'V' base frame is only used here,
      // for 2-color vehicles. A mono-color or colorless vehicle instead falls into the plain
      // `!right` branch above with no vehicle-specific base image at all — only the
      // isArtifact overlay below adds any vehicle-adjacent texture. This looks like it could
      // be a v1 quirk, but we replicate it faithfully rather than "fixing" it.
      if (isLand) {
        await addFrameImage(ctx, `${framePrefix}L`);
        await addFrameImage(ctx, `${framePrefix}${left.toUpperCase()}`, { mask: 'Rules' });
        await addFrameImage(ctx, `${framePrefix}${right.toUpperCase()}`, { placement: 'addToRightHalf', mask: 'Rules' });
      } else if (isVehicle) {
        await addFrameImage(ctx, `${framePrefix}V`);
      } else {
        await addFrameImage(ctx, `${framePrefix}M`);
      }
      await addFrameImage(ctx, `${framePrefix}${left.toUpperCase()}`, { mask: 'Pinline' });
      await addFrameImage(ctx, `${framePrefix}${right.toUpperCase()}`, { placement: 'addToRightHalf', mask: 'Pinline' });
    }
    if (isArtifact) {
      await addFrameImage(ctx, `${framePrefix}A`, { mask: 'Frame' });
    }
    if (isLand) {
      await addFrameImage(ctx, `${framePrefix}L`, { mask: 'Title' });
      await addFrameImage(ctx, `${framePrefix}L`, { mask: 'Type' });
    }
    if (ptColor) {
      const ptPrefix = isFront ? 'm15/regular/m15PT' : 'm15/transform/regular/pt';
      await addFrameImage(ctx, `${ptPrefix}${ptColor.toUpperCase()}`);
    }
    if (addLegendaryCrown) {
      // Note the lack of .toUpperCase() here — unlike the base color frames above, the
      // transform crown pack's image filenames are lowercase (packTransformLegendCrowns.js:
      // '/img/frames/m15/transform/crowns/regular/w.png' etc), matching v1 exactly.
      const legendaryFramePrefix = isFront
        ? 'm15/transform/crowns/regular/'
        : 'm15/transform/crowns/regular/new/';
      await addFrameImage(ctx, `${legendaryFramePrefix}${left}`, { framePack: legendaryCrownsFramePack });
      if (right) {
        await addFrameImage(ctx, `${legendaryFramePrefix}${right}`, {
          framePack: legendaryCrownsFramePack,
          placement: 'addToRightHalf',
        });
      }
    }
    // Color-identity pips: back face only, 1-3 colors (v1 card-conjurer.ts:311-326). Also
    // sets typeLinePrefix so the type line shifts right to make room (applied in the text
    // section below).
    if (renderable.transform.side === 'back' && renderable.color.length >= 1 && renderable.color.length <= 3) {
      typeLinePrefix = '{right88}';
      const pipsPack = 'M15CIPips';
      const pipsPrefix = 'm15/ciPips/';
      const [a, b, c] = renderable.color.map((col) => colorToShort(col));
      await addFrameImage(ctx, `${pipsPrefix}${a}`, { framePack: pipsPack });
      if (b) {
        if (c) {
          await addFrameImage(ctx, `${pipsPrefix}${b}`, { framePack: pipsPack, mask: 'Second Third' });
          await addFrameImage(ctx, `${pipsPrefix}${c}`, { framePack: pipsPack, mask: 'Third Third' });
        } else {
          await addFrameImage(ctx, `${pipsPrefix}${b}`, { framePack: pipsPack, mask: 'Second Half' });
        }
      }
    }
    useAutoFrame = false;
  } else if (renderable.mdfc) {
    // v1 card-conjurer.ts:328-374. MDFC/Modal front and back share one frame pack
    // (ModalRegular carries both front AND back frame images — see packModalRegular.js —
    // unlike transform, which uses two distinct packs for front/back).
    await loadFramePack(ctx, 'ModalRegular', { fireLoadFrameVersion: true });

    const side = renderable.mdfc.side;
    const backPrefix = side === 'back' ? 'back/' : '';
    const [left, right] = getModalFrameColors(renderable);
    const addLegendaryCrown = renderable.supertype === 'legendary';
    const overlayMulticolor = right !== undefined;
    const overlayVehicleFrame = renderable.subtypes.includes('vehicle');
    const ptColor = renderable.pt
      ? getModalPowerToughnessColor(renderable.color, overlayVehicleFrame)
      : undefined;
    const otherFrameColor = renderable.mdfc.otherFrameColor;

    await addFrameImage(ctx, `modal/regular/${backPrefix}${left}`);
    if (right) {
      await addFrameImage(ctx, `modal/regular/${backPrefix}${right}`, { placement: 'addToRightHalf' });
    }
    if (overlayMulticolor) {
      // Dual-color modal faces overlay a single multicolor (or multicolor-land) frame's
      // Title/Type/Frame masks on top of the two individual color halves added above.
      const m = `modal/regular/${backPrefix}${renderable.types.includes('land') ? 'l' : 'm'}`;
      await addFrameImage(ctx, m, { mask: 'Title' });
      await addFrameImage(ctx, m, { mask: 'Type' });
      await addFrameImage(ctx, m, { mask: 'Frame' });
    }
    if (overlayVehicleFrame) {
      await addFrameImage(ctx, `modal/regular/${backPrefix}v`, { mask: 'Frame' });
    }
    if (addLegendaryCrown) {
      await addFrameImage(ctx, `modal/crowns/regular/${getModalLegendaryCrownColor(left)}`, { framePack: 'ModalLegendCrowns' });
      if (right) {
        await addFrameImage(ctx, `modal/crowns/regular/${getModalLegendaryCrownColor(right)}`, {
          placement: 'addToRightHalf',
          framePack: 'ModalLegendCrowns',
        });
      }
    }
    if (ptColor) {
      // Explicit framePack: 'ModalRegular' here (unlike other branches' PT calls) because
      // the legendary-crown call just above may have switched the "current" pack to
      // ModalLegendCrowns — v1's addFrameImage helper always falls back to a closure-level
      // `defaultFramePack` var when no framePack is given, so an omitted framePack there
      // means "ModalRegular" regardless of what the immediately-preceding call touched. Our
      // addFrameImage has no such fallback (it only switches pack when told to), so we must
      // say so explicitly whenever a preceding call in the same branch used framePack to
      // switch away from the branch's own default pack.
      await addFrameImage(
        ctx,
        `m15/${side === 'back' ? 'transform/regular/pt' : 'regular/m15PT'}${ptColor.toUpperCase()}`,
        { framePack: 'ModalRegular' },
      );
    }
    // Flipside indicator: a small icon in the OTHER face's color, masked onto THIS side's
    // frame (v1 card-conjurer.ts:374). otherFrameColor is always a single FrameColor letter
    // (never a pair) — the flipside icon can only show one color. Same explicit-framePack
    // reasoning as the ptColor call above.
    await addFrameImage(ctx, `modal/regular/${backPrefix}${otherFrameColor}`, { mask: 'Flipside', framePack: 'ModalRegular' });
    useAutoFrame = false;
  } else {
    // Default branch (v1 card-conjurer.ts:446-449): let CC's autoFrame pick the frame based
    // on mana cost / type / colors. Re-enable autoFrame (was set to 'false' above).
    const autoFrameValue = isBorderless ? 'Borderless' : 'M15RegularNew';
    document.querySelector('#autoFrame').value = autoFrameValue;

    // Explicitly install this pack's text/art/symbol/watermark template up front. In v1's
    // real browser, `autoFrame()` (autoFrame.js) lazy-loads `pack<autoFrameValue>.js` via
    // `loadScript()`, whose trailing generic `loadFramePack()` call auto-fires
    // `#loadFrameVersion` because `autoLoadFrameVersion` defaults to 'true' at CC boot
    // (creator-23.js:4941-4944) — same mechanism every OTHER specialised branch in this file
    // works around explicitly (see frame.ts's loadFramePack doc comment); this default
    // branch is the only one that didn't, because it was easy to miss: `sandbox.autoFrame()`
    // itself DOES call `loadScript()` for the target pack unconditionally, so the pack's
    // `availableFrames`/frame IMAGES always end up correct even without this fix — only the
    // TEXT template (mana/title/type coordinates, setSymbolBounds) silently stayed on
    // whatever pack was active before (the sandbox's actual boot pack is `M15Regular-1`, an
    // older near-identical-but-not-quite template — see node-handle.ts's
    // `bootFreshSandbox` — not `M15RegularNew`).
    //   - `M15RegularNew` vs `M15Regular-1`: coordinates differ by a few pixels (e.g. mana
    //     y=176/2814≈0.0625 vs 0.0613, title y=145/2814≈0.0515 vs 0.0522) — small but real,
    //     not covered by the generic rules-box Edit Bounds override (which only touches the
    //     rules field). This was likely misattributed to pure font-AA drift before this fix.
    //   - `Borderless` vs `M15Regular-1`: MUCH bigger difference — Borderless's template sets
    //     `color:'white'` on title/type/rules/pt (dark full-bleed art needs light text);
    //     without this fix every borderless card silently rendered with M15Regular-1's
    //     default BLACK text, invisible against the dark rules-box gradient.
    // loadTextOptions() preserves any already-set `.text` content across the swap (it copies
    // matching keys' old `.text` into the new template — see creator-23.js:1179-1207), and
    // at this point in driveRender nothing has been set yet (section 2 runs after this), so
    // there's nothing to lose either way.
    await loadFramePack(ctx, autoFrameValue, { fireLoadFrameVersion: true });
  }

  // ---- 2. Text fields (mana, title, type, rules, PT) -----------------------------------
  //
  // v1 clicks the "text option" then fills #text-editor, relying on CC's textEdited() to
  // route the value into card.text[currentField]. We write straight into card.text.*.text
  // instead — same end state, no debounce, no keystroke simulation.
  //
  // Every text field respects the CC key names in card.text (established when the M15
  // frame pack loads its packText config): mana, title, type, rules, pt, plus optional
  // fields like flipsideType/flipsideText/adventureManaCost/etc that show up when
  // specialised packs load. See card.text initialization in packages/renderer/external/cardconjurer/js/frames/packM15Regular-1.js.
  //
  // v1's textEdited() applies curlyQuotes() to whatever text is set, regardless of field
  // (creator-23.js:1227) — since we bypass that UI function entirely, apply the same
  // transform here so straight quotes/apostrophes in card text render as CC's typographic
  // curly glyphs (see helpers.ts curlyQuotes doc comment for the discovery story).
  const setText = (key: string, value: string | undefined): void => {
    if (card.text && card.text[key]) card.text[key].text = curlyQuotes(value ?? '');
  };

  setText('mana', renderable.manaCost);

  // Title: v1 prefixes with {fontcolor#000000} on white tokens (forceTitleColorToBlack).
  const title = (forceTitleColorToBlack ? '{fontcolor#000000}' : '') + renderable.name;
  setText('title', title);

  // MDFC-only extra text fields (v1 card-conjurer.ts:470-478): the flipside face's type
  // ('Land' or PT-prefixed subtype/type) and its rendered text (mana cost, or the land's
  // "{t}: Add ..." line). Key names come from packModalRegular.js's loadTextOptions.
  if (renderable.mdfc) {
    setText('flipsideType', renderable.mdfc.otherCardType);
    setText('flipSideReminder', renderable.mdfc.otherText);
  }

  // Adventure-only extra text fields (v1 card-conjurer.ts:481-499): the adventure spell's
  // own mana cost/title/type/rules, drawn in the left-hand "book" panel. Key names come
  // from packAdventure.js's loadTextOptions (mana2/title2/type2/rules2).
  if (renderable.adventure) {
    setText('mana2', renderable.adventure.manaCost);
    setText('title2', renderable.adventure.title);
    setText('type2', renderable.adventure.type);
    setText('rules2', renderable.adventure.rules);
  }

  // Type line: v1 prepends typeLinePrefix (e.g. '{right88}' for transform-back CI pips) —
  // set by the transform branch above.
  setText('type', typeLinePrefix + renderable.typeLine);

  // Edit Bounds: widen the type-line textbox to 1550 (v1 card-conjurer.ts:511-517).
  // This creates room for wider set symbols so the type text doesn't collide with them.
  // In card-normalized coords this is 1550/2010 ≈ 0.7711.
  if (card.text.type) card.text.type.width = 1550 / CARD_WIDTH;

  // ---- 3. Rules text + PT, or planeswalker loyalty + abilities -------------------------
  //
  // v1 branches here too (card-conjurer.ts:519-612): planeswalkers fill Loyalty + Ability
  // 1-N text fields and the ability-box geometry inputs instead of Rules Text + P/T. Wave 5
  // handles the transform-front Reverse PT (only relevant in the non-planeswalker branch).

  if (planeswalkerData) {
    // v1 card-conjurer.ts:519-567.
    setText('loyalty', renderable.loyalty !== undefined ? String(renderable.loyalty) : '');

    for (let abilityIndex = 0; abilityIndex < planeswalkerData.abilities.length; abilityIndex++) {
      const { content } = planeswalkerData.abilities[abilityIndex];
      const key = `ability${abilityIndex}`;
      setText(key, content);
      // v1 fills #text-editor-font-size after each ability (card-conjurer.ts:539), which
      // sets card.text[current].fontSize — same effect as the fs/rules override elsewhere
      // in this driver, just always-applied (not conditional on a non-zero check) since
      // computePlaneswalkerData always returns a usable rulesFontSize (baseline -18).
      if (card.text[key]) card.text[key].fontSize = planeswalkerData.rulesFontSize;
    }

    // Ability box geometry: v1 fills #planeswalker-height/cost/shift-N (N = 0..3) then
    // relies on those inputs' oninput='planeswalkerEdited()' handler (installed by
    // js/frames/versionPlaneswalker.js, loaded automatically by the pack's
    // #loadFrameVersion handler above) to translate them into card.text.abilityN geometry
    // AND the ability-cost (+/-/neutral icon) overlay, drawn onto a pair of dedicated
    // canvases (planeswalkerPreFrameCanvas/PostFrameCanvas) that drawCard() composites in
    // automatically when card.version includes 'planeswalker' (creator-23.js:3052-3057).
    // We set the same inputs directly, then call planeswalkerEdited() once ourselves
    // instead of relying on 12 individual oninput firings (3 inputs × 4 ability slots).
    const shiftPerNumberOfAbilities: Array<Array<{ regular: number; tall: number }>> = [
      [{ regular: 364, tall: 474 }],
      [{ regular: 220, tall: 246 }, { regular: 574, tall: 702 }],
      [{ regular: 132, tall: 132 }, { regular: 364, tall: 474 }, { regular: 616, tall: 816 }],
      [{ regular: 94, tall: 132 }, { regular: 289, tall: 360 }, { regular: 487, tall: 588 }, { regular: 686, tall: 816 }],
    ];
    for (let abilityIndex = 0; abilityIndex < 4; abilityIndex++) {
      let height = 0, cost = '', shift = 0;
      if (abilityIndex < planeswalkerData.abilities.length) {
        const ability = planeswalkerData.abilities[abilityIndex];
        height = ability.height;
        cost = ability.cost;
        shift = -shiftPerNumberOfAbilities[planeswalkerData.abilities.length - 1][abilityIndex][planeswalkerData.size]
          + (height / 2) + ability.startHeight - 5;
      }
      document.querySelector(`#planeswalker-height-${abilityIndex}`).value = height.toFixed();
      document.querySelector(`#planeswalker-cost-${abilityIndex}`).value = cost;
      document.querySelector(`#planeswalker-shift-${abilityIndex}`).value = shift.toFixed();
    }
    if (typeof sandbox.planeswalkerEdited === 'function') {
      // planeswalkerEdited() reads several image assets synchronously (icon glyphs, the
      // ability-box highlight mask) — all created via `new Image()` inside
      // versionPlaneswalker.js's one-time init, decode-tracked, but not yet necessarily
      // *decoded* by the time we get here. We explicitly await them first so their
      // `.complete`/`.width`/`.height` checks are trustworthy on our one deterministic call
      // below (with the auto-retrigger cascade disabled above, this is now the ONLY call
      // that ever draws the ability-box canvases for this render).
      //
      // This `.decode()` await is load-bearing, not just belt-and-braces: `planeswalkerTextMask`
      // is an SVG, and node-handle.ts's `DomImage` pre-rasterizes SVG `.src` assignments via
      // `sharp` asynchronously (see its "SVG rasterization" doc comment) — `.decode()` is
      // overridden there specifically so external awaiters like this one observe the REAL
      // rasterize-then-assign completion, not a premature native "nothing pending" resolution.
      // (Historical note: before that override existed, this await looked correct but wasn't —
      // `planeswalkerTextMask` would report `.complete === true` with `.width === 0, .height
      // === 0`, silently no-oping the mask's `destination-in` clip inside planeswalkerEdited()
      // and leaving the first ability's -0.1-card-height overdraw margin — meant to be fully
      // masked away, invisible — bleeding into the art above the type line instead.)
      //
      // planeswalkerTextMask needs special handling: for 'tall'/'Compleated' versions,
      // planeswalkerEdited() itself would normally REASSIGN this image's `.src` (to
      // planeswalkerTallMaskRules.png) partway through the call, kicking off a SECOND,
      // separate decode we'd then have to wait for mid-call. We sidestep that entirely by
      // pre-setting the correct mask ourselves and awaiting it — planeswalkerEdited()'s own
      // internal check (`if (!planeswalkerTextMask.src.includes('tall'))`) then finds it
      // already correct and skips the reassignment branch.
      //
      // IMPORTANT: we swap in a BRAND NEW `Image()` instance rather than mutating
      // `sandbox.planeswalkerTextMask.src` in place. `@napi-rs/canvas`'s native Image
      // binding has a reuse bug (see node-handle.ts's "SVG rasterization" doc comment for
      // the first instance of this class of bug): reassigning `.src` a SECOND time on the
      // same instance can leave `drawImage()` reading STALE pixel data from the FIRST
      // assignment, even though `.width`/`.height` correctly report the new image's
      // dimensions. Both the default one-time-init mask (`text.svg`, rasterized to
      // 1500×2100) and the tall mask (`planeswalkerTallMaskRules.png`, natively 1500×2100)
      // happen to share identical dimensions, so this reuse bug was completely invisible to
      // `.complete`/`.width`/`.height` checks — confirmed by sampling the mask's actual
      // decoded pixels (not just metadata) at a y-coordinate where the two masks disagree:
      // after reassigning `.src` to the tall PNG, `drawImage()` was still painting the
      // REGULAR svg mask's shape. Since `planeswalkerTextMask` is a `var` at
      // versionPlaneswalker.js's top level (i.e. a property of the sandbox's global/window
      // object), replacing `sandbox.planeswalkerTextMask` with a fresh instance is visible
      // to every closure in that script (including `planeswalkerEdited()`) exactly the same
      // way a plain reassignment would be, without the stale-reuse hazard.
      if (sandbox.planeswalkerTextMask) {
        const wantsTall = planeswalkerData.size === 'tall';
        const maskMarker = wantsTall ? 'tall' : 'planeswalker/text.svg';
        if (!sandbox.planeswalkerTextMask.src.includes(maskMarker)) {
          const fresh = new sandbox.Image();
          fresh.src = wantsTall
            ? '/img/frames/planeswalker/tall/planeswalkerTallMaskRules.png'
            : '/img/frames/planeswalker/text.svg';
          sandbox.planeswalkerTextMask = fresh;
        }
      }
      const pwImages = ['plusIcon', 'minusIcon', 'neutralIcon', 'lightToDark', 'darkToLight', 'planeswalkerTextMask']
        .map((k) => sandbox[k])
        .filter(Boolean);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Promise.all(pwImages.map((img: any) => img.decode().catch(() => {})));
      sandbox.planeswalkerEdited();
    }
  } else {
    const rulesText = renderable.rules;
    if (rulesText && rulesText.length > 0) {
      setText(rulesTextHeaderTitle, rulesText);

      // Edit Bounds on rules: y=1782, height=798 (v1 card-conjurer.ts:585-586). MDFC uses
      // height=705 — that lands in Wave 5. Tokens skip this entirely (isToken guard).
      if (!renderable.isToken && card.text[rulesTextHeaderTitle]) {
        card.text[rulesTextHeaderTitle].y = 1782 / CARD_HEIGHT;
        const rulesHeight = renderable.mdfc ? 705 : 798;
        card.text[rulesTextHeaderTitle].height = rulesHeight / CARD_HEIGHT;
      }

      // Optional font-size override via tags['fs/rules']. v1 fills #text-editor-font-size
      // which sets card.text[current].fontSize (see creator-23.js:1231-1233).
      const fsRulesTag = renderable.tags?.['fs/rules'];
      const rulesFontSize = typeof fsRulesTag === 'number' ? fsRulesTag : 0;
      if (rulesFontSize !== 0 && card.text[rulesTextHeaderTitle]) {
        card.text[rulesTextHeaderTitle].fontSize = rulesFontSize;
      }
    }

    if (renderable.pt !== undefined) {
      // v1 prefixes artifact-vehicle PT with {fontcolor#fff} (white on dark). Tokens skip
      // that prefix (v1 card-conjurer.ts:603).
      const isArtifactVehicle = renderable.types.includes('artifact') && renderable.subtypes.includes('vehicle');
      const prefix = !renderable.isToken && isArtifactVehicle ? '{fontcolor#fff}' : '';
      setText('pt', prefix + renderable.pt.power + '/' + renderable.pt.toughness);
    }
    // Transform-front "Reverse PT": a small grey PT preview of the back face, drawn near
    // the bottom of the card (v1 card-conjurer.ts:607-611). The pack's key for this field
    // is 'reminder' (display name "Reverse PT" — see packM15TransformFront.js's
    // loadTextOptions), not 'reversePt'.
    if (renderable.transform && renderable.transform.side === 'front') {
      setText('reminder', renderable.transform.flipText);
    }
  }

  // ---- 4. Collector info (bottom-info block) ------------------------------------------
  //
  // v1 fills #info-* fields and clicks the #enableNewCollectorStyle checkbox, which fires
  // setBottomInfoStyle() → loadBottomInfo() → bottomInfoEdited(). We do the same three
  // steps directly. Requires renderable.set to have shortName + author + collector offset;
  // these come from set-metadata resolver (getSetMetadataForCard), and the bottom info gets
  // set with usable defaults when set is undefined so we don't leave stale UI defaults
  // from a previous render around.
  const setMeta = renderable.set;
  const collectorNumber = renderable.collectorNumber - (setMeta?.collectorNumberOffset ?? 0);
  const collectorNumberPadded = ('0000' + collectorNumber.toString()).slice(-4);

  // Date/year for the collector info stamp. v1 uses today's date, which means every render
  // gets a fresh date and no two renders on different days match — a real gap in v1 that
  // v1 doesn't notice because it has no golden tests. For v2 goldens to stay stable across
  // days, we accept a KP_RENDER_DATE override (ISO YYYY-MM-DD; also used to derive the
  // year). The harness sets this to the golden capture date so re-runs are deterministic.
  const dateOverride = process.env.KP_RENDER_DATE;
  const today = (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride))
    ? dateOverride
    : new Date().toISOString().split('T')[0];
  const year = today.slice(0, 4);

  const rarity = (renderable.rarity || 'c')[0].toUpperCase();
  const shortName = setMeta?.shortName || '';
  const author = setMeta?.author || '';

  document.querySelector('#info-number').value = collectorNumberPadded;
  document.querySelector('#info-rarity').value = rarity;
  document.querySelector('#info-set').value = shortName;
  document.querySelector('#info-note').value = today;
  document.querySelector('#info-language').value = 'EN';
  document.querySelector('#info-artist').value = author;
  document.querySelector('#info-year').value = year;

  // Enable both the collector block AND the new style. Both are required — the block gate
  // is enableCollectorInfo (creator-23.js:2878); the layout switch is enableNewCollectorStyle
  // (creator-23.js:244). setBottomInfoStyle() reads the style flag and installs the correct
  // bottomInfo text template; bottomInfoEdited() (which loadBottomInfo → awaits) reads the
  // #info-* values into card.info* and draws.
  document.querySelector('#enableCollectorInfo').checked = true;
  document.querySelector('#enableNewCollectorStyle').checked = true;
  if (typeof sandbox.setBottomInfoStyle === 'function') {
    await sandbox.setBottomInfoStyle();
  }

  // ---- Set symbol (loaded + rasterized) -------------------------------------------------
  //
  // v1 fills #set-symbol-code + #set-symbol-rarity, which triggers fetchSetSymbol() (via
  // the input's onchange in the browser). fetchSetSymbol() routes to
  // /img/setSymbols/official/custom/<set>-<rarity>.svg for custom sets, calling
  // uploadSetSymbol() → setSymbol.src = url → onload → setSymbolEdited() → drawCard().
  //
  // The Node host decodes SVG via sharp/librsvg (see hosts/node-handle.ts line 139+), which
  // produces PNG bytes that the canvas Image decoder handles correctly. This was needed
  // because @napi-rs/canvas bundles resvg, which has a genuine rendering bug: for paths that
  // combine fill + stroke with certain self-intersecting arc-flag combinations, resvg drops
  // the fill entirely (tested against Chromium reference, which renders correctly).
  // Sharp produces a pixel-perfect match.
  if (setMeta?.symbol && typeof sandbox.fetchSetSymbol === 'function') {
    document.querySelector('#set-symbol-code').value = setMeta.symbol;
    document.querySelector('#set-symbol-rarity').value = renderable.rarity;
    document.querySelector('#set-symbol-source').value = ''; // fall through to custom-set path
    try { sandbox.fetchSetSymbol(); } catch { /* Unlikely; set-symbol rasterization is working */ }
  }

  // ---- Art loading -------------------------------------------------------------------
  //
  // v1 fills #creator-menu-art input[placeholder="Via URL"] which triggers imageURL() →
  // uploadArt(url, "autoFit"). imageURL() prepends /local_art/ for non-http paths.
  // uploadArt(src, 'autoFit') sets art.onload = () => { autoFitArt(); art.onload = artEdited; }
  // then art.src = src. On decode, autoFitArt() writes #art-x/y/zoom + calls artEdited()
  // which copies those into card.artX/Y/Zoom and calls drawCard() (suppressed by
  // buildAndComposite). We call uploadArt directly for the same effect.
  //
  // Full-art layouts (tokens + planeswalkers) override autoFit with a fixed x/y/zoom
  // preset selected by tags['art/focus'] (v1 card-conjurer.ts:643-664). Rather than let
  // autoFit run and then overwrite its result — which would require reliably sequencing
  // our override AFTER autoFit's own async decode→onload chain — we PRE-POPULATE
  // #art-x/y/zoom with the target preset BEFORE assigning art.src, and skip the 'autoFit'
  // wrapper entirely (art.onload stays at CC's boot default of plain `artEdited`, which
  // reads whatever is currently in #art-x/y/zoom whenever it fires). This way the ONLY
  // values `artEdited()` can ever read are the correct ones, regardless of exactly when
  // the native decode's onload fires relative to our own tracked decode() call.
  if (renderable.art) {
    // Match imageURL()'s prefix rule (creator-23.js:4721): non-http paths get /local_art/.
    // The host's resolveSrc turns /local_art/<sub> into an on-disk read from collection/art.
    const artUrl = renderable.art.includes('http') ? renderable.art : '/local_art/' + renderable.art;

    if (isFullArt) {
      // v1 card-conjurer.ts:646-656. Planeswalkers and non-planeswalkers (tokens) use
      // slightly different preset tables (planeswalkers show a bit more headroom above
      // the ability-box area).
      const focusAreas: Record<ArtFocusName, ArtFocusArea> = planeswalkerData ? {
        'zoom-0': { x: -255, y: 80, zoom: 164 },
        'zoom-1': { x: -280, y: -50, zoom: 170 },
        'zoom-2': { x: -500, y: -250, zoom: 200 },
      } : {
        'zoom-0': { x: -254, y: 80, zoom: 164 },
        'zoom-1': { x: -300, y: 60, zoom: 170 },
        'zoom-2': { x: -503, y: -50, zoom: 200 },
      };
      const focusRaw = renderable.tags?.['art/focus'];
      const focusName: ArtFocusName = (typeof focusRaw === 'string' && (focusRaw === 'zoom-0' || focusRaw === 'zoom-1' || focusRaw === 'zoom-2'))
        ? focusRaw
        : 'zoom-0';
      const focusArea = focusAreas[focusName];

      document.querySelector('#art-x').value = focusArea.x.toFixed();
      document.querySelector('#art-y').value = focusArea.y.toFixed();
      document.querySelector('#art-zoom').value = focusArea.zoom.toFixed(1);
      sandbox.uploadArt(artUrl); // no 'autoFit' — keep onload = artEdited (CC boot default)
    } else {
      // Call CC's own uploadArt('autoFit'). It installs an onload that runs autoFitArt
      // then artEdited. Our DomImage tracks the decode into pendingDecodes;
      // buildAndComposite awaits it before the single composite runs. On decode:
      //   1. DomImage.decode() microtask resolves         — awaited by pendingDecodes
      //   2. onload fires → autoFitArt() → artEdited()    — inside step 1's `.then()`
      //   3. buildAndComposite's Promise.all(pendingDecodes) completes
      //   4. one composite runs with the correct card.artX/Y/Zoom
      sandbox.uploadArt(artUrl, 'autoFit');
    }
  }
  // No-art case: fresh sandbox already has sandbox.art.src = /img/blank.png and
  // card.artX/Y/Zoom at defaults (creator-23.js:158), so no reset needed.

  // ---- Basic land icon overlay (Wave 3) ----------------------------------------------
  //
  // v1 card-conjurer.ts:614-633. Non-borderless basic lands with no rules text get an
  // additional frame image on top: the basic-land-color icon (from the M15 Lands pack).
  // v1 clicks the "Frame" menu tab, then #selectFramePack='Lands' + sleep(500) — no
  // #loadFrameVersion invocation (packM15Lands.js sets loadFrameVersion.onclick = null
  // and disables the button; it's an additive-only pack). Then clicks the color's
  // watermark frame option and #addToFull.
  //
  // The condition: basic + non-borderless + land + no rules (v1:615-618).
  if (
    isBasic
    && !isBorderless
    && renderable.types.includes('land')
    && renderable.rules.length === 0
  ) {
    // Note: v1 does this AFTER autoFrame has run (i.e. after the default land frame is
    // already on the card). We haven't called autoFrame yet — that happens below. Ordering
    // works out because addFrameImage pushes into card.frames.unshift(...) at the front of
    // the array (creator-23.js:940), then when we call autoFrame afterwards it *appends*
    // additional layers behind the ones we already added. That's the wrong stacking order.
    //
    // Correct order: run autoFrame FIRST (default land frame goes on card.frames), THEN
    // add the icon overlay. So we invoke autoFrame here for the basic-land case only,
    // then add the icon, then set useAutoFrame=false so the trailing autoFrame call below
    // doesn't run twice.
    sandbox.autoFrame();
    useAutoFrame = false;

    // Note: v1 passes 'Lands' (the option LABEL); the corresponding VALUE (which becomes
    // the pack script filename) is 'M15Lands'. We use the value directly since our
    // loadFramePack builds the script path from the pack name.
    await loadFramePack(ctx, 'M15Lands', { fireLoadFrameVersion: false });
    const landColor = colorToShort(landSubtypeToColor(renderable.subtypes[0]) ?? 'white');
    // The Lands pack names its icons as watermark entries; their src is /img/frames/m15/basics/<c>.png
    await addFrameImage(ctx, `m15/basics/${landColor}`);
  }

  // ---- 5. Layout autoFrame + drawText -------------------------------------------------
  //
  // Order matters: autoFrame reads the mana/type text to detect colors, so text must be set
  // first. drawText composites text into textCanvas (which drawFrames blits on top).
  // Specialised branches (borderless basic; basic land icon which called autoFrame early)
  // set useAutoFrame = false so we skip it here.
  if (useAutoFrame) {
    try { sandbox.autoFrame(); } catch { /* frame errors don't block; drawText still runs */ }
  }
  await sandbox.drawText();
}
