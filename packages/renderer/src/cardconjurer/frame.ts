// CardConjurer frame-stacking helpers — the direct-drive equivalent of v1's
// `addFrameImage` Playwright helper (server/src/card-conjurer.ts:177-198) and the
// frame-pack loading it depends on. Host-agnostic; both the Node and (future) browser hosts
// call these unchanged.
//
// v1's `addFrameImage(image, {framePack, mask, placement})` is a sequence of Playwright DOM
// operations:
//   1. If framePack != current: `page.selectOption('#selectFramePack', framePack)`
//      This triggers CC's dropdown onchange, which loads the pack script and calls
//      `loadFramePack()` to populate `availableFrames`.
//   2. `page.click('div.frame-option:has(img[src=".../<image>Thumb.png"])')` → sets
//      `selectedFrameIndex` to the clicked option (creator-23.js:frameOptionClicked).
//   3. If mask: `page.click('div.mask-option:has-text("<mask>")')` → sets
//      `selectedMaskIndex` (creator-23.js:maskOptionClicked, index 1-based; 0 = No Mask).
//   4. `page.click('#addToFull' or '#addToRightHalf')` → calls `addFrame([])` or
//      `addFrame([{src:'/img/frames/maskRightHalf.png', name:'Right Half'}])` respectively
//      (see button onclick attrs in creator/index.html:155-156).
//
// Our direct-drive version bypasses all four clicks:
//   1. `loadFramePack(ctx, name)` — loads the pack script into the sandbox, then invokes CC's
//      `loadFramePack()` global to build `availableFrames` and (if the pack has one) fires
//      `#loadFrameVersion.onclick` to install the pack's `card.text` template.
//   2. Find the frame in `sandbox.availableFrames` by matching `src.includes(<image>.png)`.
//   3. Set `sandbox.selectedFrameIndex = <found index>` and `sandbox.selectedMaskIndex =
//      <mask index + 1, or 0 for no mask>`.
//   4. `await sandbox.addFrame(<additionalMasks>)` — CC's own addFrame does the rest.
//
// What we depend on in CardConjurer (CC-update contract, kept intentionally narrow):
//   - Global function `addFrame(additionalMasks?, loadingFrame?)`
//   - Global function `loadFramePack()`
//   - Globals `availableFrames` (array), `selectedFrameIndex`, `selectedMaskIndex` (ints)
//   - Frame pack script files at `/js/frames/pack<Name>.js` and their `#loadFrameVersion.onclick`
//     handler pattern (the pack registers a handler that resets and installs the text template)
//   - The frame `.src` string format `/img/frames/<image>.png`
//
// All of these appear in CC's own HTML `onclick`/`onchange` attributes and its card-JSON
// save/load path (creator-23.js:4569). They are effectively contract with CC's plugin authors
// and stay stable across CC updates that add new frames or packs.

/**
 * Context passed by the host to the driver + these helpers. `sandbox`, `card`, and `document`
 * are all CardConjurer globals living inside a vm context (Node host) or an iframe's `window`
 * (browser host). We intentionally type them as `any`: the CC surface we drive is dozens of
 * loosely-typed globals installed at boot (creator-23.js's ~5000 lines register hundreds of
 * top-level functions/vars), and re-declaring them all here would provide no real safety.
 */
export type CCContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sandbox: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  card: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any;
  loadFrameScript: (src: string) => void;
};

export type LoadFramePackOptions = {
  /**
   * Default true; set false for packs that don't provide a #loadFrameVersion handler
   * (some CC packs are additive only, e.g. M15CIPips or the M15LegendCrowns overlays).
   */
  fireLoadFrameVersion?: boolean;
};

/**
 * Load a CardConjurer frame pack into the sandbox. If the pack has an `#loadFrameVersion.onclick`
 * handler (the "install this pack's text/geometry template" one), fire it. If not (some packs
 * only add to availableFrames without replacing text), just load the script.
 *
 * v1 equivalent: card-conjurer.ts:187-190 (`page.selectOption('#selectFramePack', framePack)`
 * + implicit CC pack-loading via dropdown onchange). We drive the pack load directly.
 */
export async function loadFramePack(
  ctx: CCContext,
  packName: string,
  opts: LoadFramePackOptions = {},
): Promise<void> {
  const { document, loadFrameScript } = ctx;
  const { fireLoadFrameVersion = true } = opts;

  document.querySelector('#selectFramePack').value = packName;
  loadFrameScript(`/js/frames/pack${packName}.js`);
  if (fireLoadFrameVersion) {
    const btn = document.querySelector('#loadFrameVersion');
    if (typeof btn.onclick === 'function') {
      await btn.onclick();
    }
    // Some packs load additional images in loadFrameVersion; give the microtask queue a
    // moment. buildAndComposite awaits pending decodes after driveRender returns, so this
    // is belt-and-braces, not correctness-critical.
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}

export type AddFrameImageOptions = {
  framePack?: string;
  mask?: string;
  placement?: 'addToFull' | 'addToRightHalf';
};

/**
 * Add a frame image on top of the card. Matches v1's `addFrameImage(image, {framePack, mask,
 * placement})` behavior 1:1.
 *
 * `image` is a frame image path without the `/img/frames/` prefix and `.png` suffix,
 * e.g. 'm15/regular/lw', 'textless/2022/sw', 'm15/basics/w'.
 */
export async function addFrameImage(
  ctx: CCContext,
  image: string,
  opts: AddFrameImageOptions = {},
): Promise<void> {
  const { sandbox } = ctx;
  const { framePack, mask, placement = 'addToFull' } = opts;

  if (framePack) {
    // Load the requested pack if it's not the current one. We track "current" via the
    // sandbox document's #selectFramePack value — same source of truth CC uses for its own
    // dropdown display.
    const currentPack = ctx.document.querySelector('#selectFramePack').value;
    if (currentPack !== framePack) {
      // fireLoadFrameVersion: false because addFrameImage is used to STACK frames on top of
      // an already-configured card (v1 uses it after the initial pack is loaded). Loading
      // the pack for the sole purpose of accessing its availableFrames should NOT reset the
      // card via resetCardIrregularities (which is what most pack #loadFrameVersion handlers
      // do). If a caller wants to install a NEW text/geometry template, they should call
      // loadFramePack() explicitly instead of relying on the framePack arg.
      await loadFramePack(ctx, framePack, { fireLoadFrameVersion: false });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const available: Array<{ src?: string; masks?: Array<{ name: string }> }> = sandbox.availableFrames as any;
  if (!Array.isArray(available) || available.length === 0) {
    throw new Error(`addFrameImage: sandbox.availableFrames is empty (frame pack not loaded?). image=${image}`);
  }

  // Find the frame whose src ends with /<image>.png (or .svg — v1's CI-pip frame images
  // are SVG-sourced, e.g. /img/frames/m15/ciPips/w.svg; every other frame pack we've hit so
  // far happens to be PNG-only). v1 matches by THUMBNAIL path in the DOM click selector
  // (`img[src="/img/frames/<image>Thumb.png"]`), which works uniformly regardless of the
  // real asset's extension because creator-23.js:583-587 always names thumbnails
  // `...Thumb.png` even for SVG sources. We match by full src instead — same identity, but
  // must check both possible extensions on the real (non-thumbnail) src ourselves.
  const targetSrcSuffixes = [`/${image}.png`, `/${image}.svg`];
  const frameIndex = available.findIndex((f) => f.src && targetSrcSuffixes.some((suffix) => (f.src as string).endsWith(suffix)));
  if (frameIndex < 0) {
    const sample = available.slice(0, 5).map((f) => f.src).join(', ');
    throw new Error(
      `addFrameImage: no frame in availableFrames ends with "${targetSrcSuffixes.join('" or "')}". ` +
      `Sample srcs: ${sample}. Did you load the right framePack?`,
    );
  }

  // Resolve mask name → 1-based index (0 = "No Mask"; see creator-23.js:645-646).
  let maskIndex = 0;
  if (mask) {
    const masks = available[frameIndex].masks ?? [];
    const mi = masks.findIndex((m) => m.name === mask);
    if (mi < 0) {
      const names = masks.map((m) => m.name).join(', ');
      throw new Error(`addFrameImage: mask "${mask}" not found in frame masks [${names}]`);
    }
    maskIndex = mi + 1;
  }

  // Drive CC's addFrame:
  //   selectedFrameIndex → which entry in availableFrames
  //   selectedMaskIndex  → 0 for "No Mask", or 1..N for masks[N-1]
  //   additionalMasks    → 'addToRightHalf' adds a Right Half mask (matches CC's button
  //                        onclick attr in creator/index.html:156)
  sandbox.selectedFrameIndex = frameIndex;
  sandbox.selectedMaskIndex = maskIndex;
  const additionalMasks = placement === 'addToRightHalf'
    ? [{ src: '/img/frames/maskRightHalf.png', name: 'Right Half' }]
    : [];
  await sandbox.addFrame(additionalMasks);
}
