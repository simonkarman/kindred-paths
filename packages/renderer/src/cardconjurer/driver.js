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
// Wave 2 scope: default-autoFrame path only (v1 card-conjurer.ts:447-449 fallthrough branch).
// The specialised branches (transform / adventure / MDFC / planeswalker / token / borderless
// basic land / basic land icon) come in Waves 3-5. Deferred to Wave 6: SVG set-symbol
// rasterization, high-collector-number formatting.

import { computePlaneswalkerData } from './planeswalker-data.js';

const CARD_WIDTH = 2010;
const CARD_HEIGHT = 2814;

/**
 * Build a fully-drawn card into the sandbox's `cardCanvas`. Called inside the host's
 * `buildAndComposite` so all mutations happen with drawFrames/drawCard suppressed; on return
 * the host does exactly ONE composite pass.
 *
 * @param {any} renderable  see packages/renderer/src/cardconjurer/renderable.js
 * @param {{ sandbox: any, card: any, document: any, loadFrameScript: (src: string) => void }} ctx
 */
export async function driveRender(renderable, ctx) {
  const { sandbox, card, document } = ctx;

  const planeswalkerData = computePlaneswalkerData(renderable);

  // ---- 1. Frame selection --------------------------------------------------------------
  //
  // Wave 2 only handles the default-autoFrame branch. Everything below is a stub: cards
  // that need transform/adventure/MDFC/planeswalker/token/borderless-basic-land frames
  // will render as regular autoFrame cards until Waves 3-5 land them.
  //
  // TODO Wave 5: renderable.adventure branch
  // TODO Wave 5: renderable.transform branch
  // TODO Wave 5: renderable.mdfc branch
  // TODO Wave 4: renderable.isToken branch (sets `forceTitleColorToBlack`, `isFullArt`)
  // TODO Wave 4: planeswalkerData branch (sets `isFullArt`)
  // TODO Wave 3: renderable.supertype === 'basic' && borderless → TextlessBasics2022
  const forceTitleColorToBlack = false;
  const isFullArt = false;
  const rulesTextHeaderTitle = 'rules';   // == v1's 'Rules Text' text option → 'rules' key
  const typeLinePrefix = '';

  const autoFrameValue = renderable.tags?.borderless ? 'Borderless' : 'M15RegularNew';
  try { document.querySelector('#autoFrame').value = autoFrameValue; } catch { /* ignore */ }

  // ---- 2. Text fields (mana, title, type, rules, PT) -----------------------------------
  //
  // v1 clicks the "text option" then fills #text-editor, relying on CC's textEdited() to
  // route the value into card.text[currentField]. We write straight into card.text.*.text
  // instead — same end state, no debounce, no keystroke simulation.
  //
  // Every text field respects the CC key names in card.text (established when the M15
  // frame pack loads its packText config): mana, title, type, rules, pt, plus optional
  // fields like flipsideType/flipsideText/adventureManaCost/etc that show up when
  // specialised packs load. See card.text initialization in server/.cardconjurer/js/frames/packM15Regular-1.js.
  const setText = (key, value) => {
    if (card.text && card.text[key]) card.text[key].text = value ?? '';
  };

  setText('mana', renderable.manaCost);

  // Title: v1 prefixes with {fontcolor#000000} on white tokens (forceTitleColorToBlack).
  // Wave 4 will set that flag from the token branch.
  const title = (forceTitleColorToBlack ? '{fontcolor#000000}' : '') + renderable.name;
  setText('title', title);

  // Type line: v1 prepends typeLinePrefix (e.g. '{right88}' for transform-back CI pips) —
  // Wave 5's job.
  setText('type', typeLinePrefix + renderable.typeLine);

  // Edit Bounds: widen the type-line textbox to 1550 (v1 card-conjurer.ts:511-517).
  // This creates room for wider set symbols so the type text doesn't collide with them.
  // In card-normalized coords this is 1550/2010 ≈ 0.7711.
  if (card.text.type) card.text.type.width = 1550 / CARD_WIDTH;

  // ---- 3. Rules text + PT (default branch, non-planeswalker) --------------------------
  //
  // Wave 4 splits out the planeswalker branch (uses ability-N text fields + planeswalker-
  // height/cost/shift geometry). Wave 5 handles the transform-front Reverse PT.

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
    const rulesFontSize = typeof renderable.tags?.['fs/rules'] === 'number' ? renderable.tags['fs/rules'] : 0;
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

  // TODO Wave 5: transform-front → set text.reversePt to renderable.transform.flipText

  // ---- 4. Collector info (bottom-info block) ------------------------------------------
  //
  // v1 fills #info-* fields and clicks the #enableNewCollectorStyle checkbox, which fires
  // setBottomInfoStyle() → loadBottomInfo() → bottomInfoEdited(). We do the same three
  // steps directly. Requires renderable.set to have shortName + author + collector offset;
  // when set is undefined (current state until Wave 6 wires the set-metadata resolver),
  // the bottom info still gets set with usable defaults so we don't leave stale UI defaults
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

  // ---- Set symbol (Wave 2: request; Wave 6: rasterize) --------------------------------
  //
  // v1 fills #set-symbol-code + #set-symbol-rarity, which triggers fetchSetSymbol() (via
  // the input's onchange in the browser). fetchSetSymbol() routes to
  // /img/setSymbols/official/custom/<set>-<rarity>.svg for custom sets, calling
  // uploadSetSymbol() → setSymbol.src = url → onload → setSymbolEdited() → drawCard().
  //
  // Requesting the symbol here means CC's code tries to load it. The Node host currently
  // can't decode SVG (Wave 6 will add resvg rasterization), so on set-symbol errors CC
  // silently falls back to a blank symbol — same as before. The important thing is that
  // v1's collector info block reads shortName from the same source, so we get consistent
  // "GLD" text either way.
  if (setMeta?.symbol && typeof sandbox.fetchSetSymbol === 'function') {
    document.querySelector('#set-symbol-code').value = setMeta.symbol;
    document.querySelector('#set-symbol-rarity').value = renderable.rarity;
    document.querySelector('#set-symbol-source').value = ''; // fall through to custom-set path
    try { sandbox.fetchSetSymbol(); } catch { /* Node host: SVG decode fails; symbol stays blank until Wave 6 */ }
  }

  // ---- Art loading -------------------------------------------------------------------
  //
  // v1 sets #creator-menu-art input[placeholder="Via URL"] which triggers imageURL() →
  // (prepends '/local_art/' when the URL lacks 'http') → uploadArt() → art.src = url →
  // onload → autoFitArt() → artEdited() → drawCard(). We inline this: set the art
  // Image src directly, wait for decode, then apply autoFit + copy into card.artX/Y/Zoom.
  //
  // For full-art layouts (tokens + planeswalkers — Wave 4), v1 overrides autoFit with a
  // preset from tags['art/focus']. That branch lives here for symmetry; it's a no-op
  // until Wave 4 sets isFullArt = true.
  //
  // v1 fills #creator-menu-art input[placeholder="Via URL"] which triggers imageURL() →
  // uploadArt(url, "autoFit"). imageURL() prepends /local_art/ for non-http paths.
  // uploadArt(src, 'autoFit') sets art.onload = () => { autoFitArt(); art.onload = artEdited; }
  // then art.src = src. On decode, autoFitArt() writes #art-x/y/zoom + calls artEdited()
  // which copies those into card.artX/Y/Zoom and calls drawCard() (suppressed by
  // buildAndComposite). We call uploadArt directly for the same effect.

  if (renderable.art) {
    // Match imageURL()'s prefix rule (creator-23.js:4721): non-http paths get /local_art/.
    // The host's resolveSrc turns /local_art/<sub> into an on-disk read from collection/art.
    const artUrl = renderable.art.includes('http') ? renderable.art : '/local_art/' + renderable.art;

    // Call CC's own uploadArt('autoFit'). It installs an onload that runs autoFitArt then
    // artEdited. Our DomImage tracks the decode into pendingDecodes; buildAndComposite
    // awaits it before the single composite runs. On decode:
    //   1. DomImage.decode() microtask resolves         — awaited by pendingDecodes
    //   2. onload fires → autoFitArt() → artEdited()    — inside step 1's `.then()`
    //   3. buildAndComposite's Promise.all(pendingDecodes) completes
    //   4. one composite runs with the correct card.artX/Y/Zoom
    sandbox.uploadArt(artUrl, 'autoFit');
  }
  // No-art case: fresh sandbox already has sandbox.art.src = /img/blank.png and
  // card.artX/Y/Zoom at defaults (creator-23.js:158), so no reset needed.

  // TODO Wave 3: basic land icon (supertype=basic + non-borderless + land + no rules → land icon)

  // ---- 5. Layout autoFrame + drawText -------------------------------------------------
  //
  // Order matters: autoFrame reads the mana/type text to detect colors, so text must be set
  // first. drawText composites text into textCanvas (which drawFrames blits on top).
  try { sandbox.autoFrame(); } catch { /* frame errors don't block; drawText still runs */ }
  await sandbox.drawText();
}
