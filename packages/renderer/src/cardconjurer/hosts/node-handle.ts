// Node host adapter for CardConjurer — boots a **fresh** CC sandbox per render on
// @napi-rs/canvas + a minimal DOM shim, runs CC's real code (main-1.js + autoFrame.js +
// creator-23.js + dynamically-loaded frame packs), and returns the composed PNG.
//
// **Per-render isolation** (Wave 2.1 change from the previous warm design):
//
// Every call to `buildAndComposite(build)` constructs a new vm sandbox, runs the CC bootstrap
// (default M15 frame pack + loadFrameVersion), invokes the build callback against that fresh
// sandbox, does exactly one composite, and drops the sandbox. This mirrors v1's per-render
// Playwright `context.newPage()` model — every render starts from CC's initial state, no cross-
// render leaks (P/T text from a previous creature, rules text from a previous card with rules,
// stale art, stale frame stack — all impossible by construction).
//
// The measured cost of a fresh boot on this machine (warm caches, node v22): ~330ms median.
// Font registration (~20 fonts via `GlobalFonts.registerFromPath`) is a `@napi-rs/canvas`
// process-global and runs exactly once, amortized across all sandboxes.
//
// **Why not warm?** Warm was tried in Wave 2 and produced two silent state-leak classes: P/T
// text carrying from creatures to instants (Golden Four), and rules text carrying from
// spells to basic lands (Golden Plains). Both bugs came from CC's `drawText()` iterating
// every entry in `card.text` unconditionally — anything left over from render N-1 gets
// re-drawn in render N. Fixing this via snapshot/restore was possible but fragile: a new
// mutable CC global (or one we forgot to snapshot) would silently leak again. Fresh sandbox
// per render trades ~330ms for guaranteed correctness and order-independence. See
// docs/v2-architecture.md §4 and Wave 2.1 commit.
//
// **The warm path still exists** for the interactive editor (Phase 1b-int, browser host).
// There it's safe: only text-only edits (name/rules/type) stay warm, and those overwrite
// the same-named field that's already there — no cross-card-shape leaks are possible. The
// browser host adapter provides its own warm CCHandle backed by an iframe; this Node host
// deliberately does NOT.
//
// The CCHandle contract (see docs/v2-architecture.md §4 "Two hosts, one driver"):
//   {
//     buildAndComposite(build): Promise<Buffer>
//         — boots a fresh sandbox, calls `build(ctx)` where ctx = { sandbox, card, document,
//           loadFrameScript }, awaits all image decodes, does one guaranteed-complete
//           composite, returns the PNG buffer, drops the sandbox.
//   }
//
// The driver (packages/renderer/src/cardconjurer/driver.ts) receives `ctx` from the build
// callback and never sees the sandbox lifecycle. Same driver, two hosts (Node + Browser),
// same rendered pixels.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createCanvas, GlobalFonts, Image as NapiImage, Path2D, ImageData, DOMMatrix } from '@napi-rs/canvas';
import sharp from 'sharp';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

import type { CCContext } from '../frame.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/renderer/dist/cardconjurer/hosts/ → repo root is 5 levels up (matches src/ layout).
const REPO = resolve(HERE, '../../../../..');
const CC = process.env.KP_CARDCONJURER_PATH || join(REPO, 'packages/renderer/external/cardconjurer');
const COLLECTION = process.env.KP_COLLECTION_PATH || join(REPO, 'collection');
const ART = join(COLLECTION, 'art');
const SYMBOLS = join(COLLECTION, 'symbols');
const CanvasRenderingContext2D = createCanvas(1, 1).getContext('2d').constructor;

// ---- process-global SVG raster cache -------------------------------------------------------
//
// Keyed by absolute on-disk path (see rasterizeSvg below). CardConjurer's inline mana/tap/
// colorless symbols and any custom set symbols are the same bytes on every render — once one
// process-lifetime sharp/librsvg rasterization pass has happened for a given path, every
// subsequent sandbox (i.e. every subsequent render, since each render boots a fresh sandbox)
// reuses the decoded PNG bytes instead of re-rasterizing. This is the ONLY thing besides fonts
// (see below) that persists across renders in this file — safe because it's purely a content-
// addressed cache of static asset bytes, not card-specific state.
const svgRasterCache = new Map<string, Promise<Buffer>>();

// ---- process-global font registration -----------------------------------------------------
//
// @napi-rs/canvas's GlobalFonts registry is process-global. Registering the same font twice
// is a no-op; registering thousands of times is wasteful. Guard behind a boolean so multiple
// fresh sandboxes share one registration pass. This is the ONLY other per-process state we keep.

let fontsRegistered = false;
function registerFonts(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  const fontsDir = join(CC, 'fonts');
  if (!existsSync(fontsDir)) return;
  const map: Record<string, string> = {
    belerenb: 'beleren-b.ttf', belerenbsc: 'beleren-bsc.ttf',
    mplantin: 'mplantin.ttf', mplantini: 'mplantin-i.ttf',
    matrix: 'matrix.ttf', matrixb: 'matrix-b.ttf',
    gothammedium: 'gotham-medium.ttf', gothambold: 'gothambold.otf',
    goudymedieval: 'goudy-medieval.ttf', mightymouth: 'MightyMouth.otf',
  };
  for (const [fam, file] of Object.entries(map)) {
    const p = join(fontsDir, file);
    if (existsSync(p)) { try { GlobalFonts.registerFromPath(p, fam); } catch { /* ignore */ } }
  }
  for (const f of readdirSync(fontsDir)) {
    if (/mana|magic|fomalhaut|keyrune|mplantin/i.test(f)) {
      try { GlobalFonts.registerFromPath(join(fontsDir, f)); } catch { /* ignore */ }
    }
  }
}

// ---- per-render sandbox boot -------------------------------------------------------------
//
// Constructs a fresh vm sandbox, DOM shim, and image-decoding infrastructure, then runs
// CC's core scripts + default M15 frame pack bootstrap. Returns an object exposing the CC
// context ({sandbox, card, document, loadFrameScript}) plus `getPendingDecodes`, the
// drawFrames-storm-fix primitive that buildAndComposite awaits once, covering every image
// decode kicked off since this sandbox was created (boot AND build phase alike).
//
// Called by buildAndComposite once per render. The sandbox and everything hanging off it
// is dropped when buildAndComposite returns, allowing GC to reclaim it.

type BootedSandbox = CCContext & { getPendingDecodes: () => Promise<unknown>[] };

async function bootFreshSandbox(): Promise<BootedSandbox> {
  const noop = (): void => { /* no-op */ };

  // ---- image path resolution (art + CC assets) -------------------------------------------

  type ResolvedSrc = { path: string } | { buf: Buffer };

  function resolveSrc(src: string | null | undefined): ResolvedSrc | null {
    if (!src) return null;
    if (src.startsWith('data:')) return { buf: Buffer.from(src.split(',')[1] || '', 'base64') };
    let path = src;
    try { if (src.startsWith('http')) path = new URL(src).pathname; } catch { /* not a URL */ }
    path = path.split('?')[0];
    if (path.startsWith('/local_art/')) {
      // Preserve the full sub-path under /local_art/ (Card.faces[i].art can be
      // 'suggestions/foo.png', not just 'foo.png'). Falls back to basename lookup for
      // legacy paths that were flat.
      const sub = path.slice('/local_art/'.length);
      const full = join(ART, sub);
      if (existsSync(full)) return { path: full };
      const flat = join(ART, basename(path));
      return existsSync(flat) ? { path: flat } : null;
    }
    if (path.startsWith('/img/setSymbols/official/custom/')) {
      // Mirrors v1's Docker mount (server/card-conjurer.sh):
      //   -v "collection/symbols:/usr/share/nginx/html/img/setSymbols/official/custom:ro"
      // CC's fetchSetSymbol() requests this path for any set whose symbol isn't a built-in
      // official set (see set-metadata.ts: symbol = `custom/<shortName>` when a custom SVG
      // exists on disk). Without this mapping the request silently 404s and CC falls back
      // to a blank symbol — the set symbol was simply missing from every render.
      const sub = path.slice('/img/setSymbols/official/custom/'.length);
      const p = join(SYMBOLS, sub);
      return existsSync(p) ? { path: p } : null;
    }
    const p = join(CC, path.replace(/^\//, ''));
    return existsSync(p) ? { path: p } : null;
  }

  // ---- SVG rasterization ---------------------------------------------------------------
  //
  // @napi-rs/canvas bundles `resvg` for SVG decoding, and it has a genuine rendering bug
  // (not just a reuse quirk): for paths that combine a fill AND a stroke with certain
  // self-intersecting arc-flag combinations (confirmed with collection/symbols/*.svg's
  // `A rx ry 0 1 0 ...` large-arc/negative-sweep arcs), resvg renders ONLY the stroke and
  // drops the fill entirely (every fill pixel comes back fully transparent, verified via
  // raw pixel sampling — 0 white pixels, only black-stroke and transparent). A real browser
  // (verified with Playwright/Chromium — the same engine v1 used to capture goldens) renders
  // the identical SVG correctly, with the white fill visible. This is a resvg limitation, not
  // something fixable by changing our SVG markup (future custom set symbols could hit the
  // same shape class), so we route SVG decoding through `sharp` (bundles `librsvg`, a much
  // more spec-compliant SVG renderer) instead of `@napi-rs/canvas`'s built-in decoder, and
  // feed the rasterized PNG bytes into the `@napi-rs/canvas` Image afterward. Verified
  // pixel-for-pixel visual match against the Playwright reference render.
  //
  // (@napi-rs/canvas's `Image` ALSO has a separate, unrelated reuse bug: an instance whose
  // `.src` was already assigned once cannot decode SVG bytes correctly again, even ignoring
  // the fill bug above — width/height get stuck and pixels come back blank. This doesn't
  // matter for us anymore since `sharp` produces plain PNG bytes, and PNG-into-a-reused-
  // instance is reliable. Worth knowing if resvg's fill bug ever gets fixed upstream and
  // someone's tempted to revert to the built-in decoder.)
  function looksLikeSvg(buf: Buffer): boolean {
    const head = buf.subarray(0, 256).toString('utf8').trimStart().toLowerCase();
    return head.startsWith('<?xml') || head.startsWith('<svg');
  }
  // rasterizeSvg is memoized per absolute path in a PROCESS-GLOBAL cache (svgRasterCache,
  // defined at module scope below, outside bootFreshSandbox) — CardConjurer's inline mana/
  // tap/colorless symbols (~150 static SVGs under collection/symbols and CC's own /img/
  // manaSymbols/) are identical bytes on every single render, so re-rasterizing them via
  // sharp/librsvg on every fresh sandbox boot is pure waste once the process has already
  // done it once. Only cacheable when we have a stable on-disk path (`cacheKey`); data: URI
  // buffers (no stable identity) always rasterize fresh.
  async function rasterizeSvg(buf: Buffer, cacheKey?: string): Promise<Buffer> {
    if (cacheKey) {
      const cached = svgRasterCache.get(cacheKey);
      if (cached) return cached;
      const promise = sharp(buf).png().toBuffer();
      svgRasterCache.set(cacheKey, promise);
      return promise;
    }
    return sharp(buf).png().toBuffer();
  }

  // Tracks in-flight image decode promises for the ENTIRE lifetime of this sandbox — from
  // the moment creator-23.js first runs through the end of the driver's build phase.
  // CardConjurer's `loadManaSymbols()` (creator-23.js:423-435) fires ~150 `new Image()`
  // decodes for every inline mana/tap/colorless symbol synchronously while creator-23.js is
  // loaded (line ~367 below) — well before this file used to flip a `trackDecodes` flag on
  // (previously only set true inside buildAndComposite's build phase, i.e. after boot had
  // already finished). Those boot-time decodes were therefore never tracked or awaited at
  // all; they were "covered" only by a fixed 150ms sleep later in this function, which is a
  // probabilistic buffer, not a real completion signal — exactly why symbols (mana cost,
  // {t}, {c}, etc.) intermittently failed to draw under real concurrency (many renders at
  // once, e.g. the web overview grid): `drawImage()` silently no-ops on an undecoded image
  // (Canvas spec), so a symbol that hadn't finished its sharp/librsvg rasterization by the
  // time `writeText()` ran simply never appeared, non-deterministically. Tracking
  // unconditionally from the very first line of this function and awaiting the full list
  // once (see buildAndComposite) replaces that race with a real guarantee, and removes the
  // need for the old 150ms sleep entirely.
  const pendingDecodes: Promise<unknown>[] = [];

  // We extend `NapiImage` for the runtime behavior (canvas can call `drawImage` on it),
  // but override several properties (`src`, `onload`, `onerror`, `decode`) in ways that
  // don't precisely match `@napi-rs/canvas`'s TS declarations for those members. Cast the
  // base to `any` so TS doesn't try to validate the overrides against the strict native
  // shapes — the JS runtime handles late binding correctly regardless.
  class DomImage extends (NapiImage as unknown as new () => any) {
    onload: ((this: DomImage) => void) | null = null;
    onerror: ((this: DomImage, err: Error) => void) | null = null;
    private _pendingDecode: Promise<unknown> | null = null;
    private _src = '';
    constructor() { super(); }
    set src(v: string) {
      this._src = v;
      const r = resolveSrc(v);
      if (!r) {
        this._pendingDecode = null;
        queueMicrotask(() => this.onerror && this.onerror.call(this, new Error('unmapped')));
        return;
      }
      const rawBuf = 'buf' in r ? r.buf : readFileSync(r.path);
      // See the "SVG rasterization" block above resolveSrc for why SVG buffers are
      // pre-rasterized (via sharp/librsvg) before ever reaching `this` — resvg (bundled by
      // @napi-rs/canvas) renders some SVG fills incorrectly.
      //
      // IMPORTANT: @napi-rs/canvas's native Image binding fires `.onload`/`.onerror`
      // AUTOMATICALLY and asynchronously once `super.src = ...` finishes decoding — it does
      // NOT need us to call `.decode()` and invoke onload ourselves. Verified empirically:
      // assigning `.onload` then `.src` on a bare `Image` fires onload with no explicit
      // `.decode()` call anywhere. We still call `.decode()` here, but ONLY to get a promise
      // we can push into `pendingDecodes` (so buildAndComposite's `Promise.all` knows when
      // this load is done) — we must NOT also invoke `this.onload()` from that promise, or
      // onload fires twice (once native, once ours). A previous version of this code did
      // exactly that; it was harmless when both firings observed identical state, but once
      // this method started doing async work before `super.src =` (the SVG rasterization
      // path), the two firings could observe DIFFERENT state (e.g. a later `.src` reassignment
      // on the same reused instance racing with an earlier decode's stale onload firing),
      // corrupting art/set-symbol placement. Letting native onload be the ONLY trigger fixes
      // this at the root.
      //
      // `this._pendingDecode` (returned by our overridden `decode()` below, see that method's
      // doc comment for the bug this fixes) is the SAME promise pushed into `pendingDecodes` —
      // both trackers must observe the real completion of `super.src = finalBuf`, not just
      // "some decode() call resolved".
      // Capture references to the native base-class members before entering the async
      // IIFE — inside `async () => {`, `super.*` is not accessible (TS2855), and we need to
      // reach the *native* `src` setter/decode() (not our own overrides) to fire the actual
      // decode. Grab them via property descriptors from the base prototype.
      const baseProto = Object.getPrototypeOf(Object.getPrototypeOf(this));
      const nativeSrcSetter = Object.getOwnPropertyDescriptor(baseProto, 'src')?.set;
      const self = this;
      const p = (async () => {
        const finalBuf = looksLikeSvg(rawBuf) ? await rasterizeSvg(rawBuf, 'path' in r ? r.path : undefined) : rawBuf;
        // Call the NATIVE setter directly with the (possibly-rasterized) buffer bytes so
        // native onload/onerror fire on their own once decode completes.
        if (nativeSrcSetter) nativeSrcSetter.call(self, finalBuf as unknown as string);
        // Native decode() — tracked for pendingDecodes/_pendingDecode only; do NOT call
        // onload from this. Base class's own `decode` lives on the prototype.
        await (baseProto.decode as () => Promise<void>).call(self);
      })().catch((e: Error) => { if (self.onerror) self.onerror.call(self, e); });
      this._pendingDecode = p;
      pendingDecodes.push(p);
    }
    // Overridden so that ANY caller of `.decode()` — not just buildAndComposite's internal
    // `pendingDecodes` bookkeeping — actually waits for our async SVG-rasterization pipeline
    // (see `set src` above) to finish assigning real pixel bytes via `super.src =`, not just
    // for whatever the *native* binding considers "decoded" at the moment `.decode()` is
    // called. Without this override, calling `.decode()` on a freshly-`.src`-assigned SVG
    // image from OUTSIDE this class (e.g. a driver.ts that awaits several images before
    // reading `.complete`/`.width`/`.height`) can resolve IMMEDIATELY and spuriously — the
    // native side has nothing in flight yet because `super.src` hasn't actually been set
    // (rasterizeSvg is still pending, since it awaits real sharp/libvips work, not just a
    // microtask). The caller then sees `.complete === true` with `.width === 0, .height === 0`
    // and proceeds as if the image were ready. Discovered via CardConjurer's planeswalker
    // ability-box highlight mask (`planeswalkerTextMask`, an SVG `destination-in` mask):
    // `drawImage(mask, ...)` with a zero-size source silently no-ops per the Canvas spec, so
    // the mask never actually clipped anything, leaving the highlight bands' -0.1-card-height
    // top overflow (an intentional overdraw margin meant to be invisible, normally hidden by
    // this exact mask) visible bleeding into the art above the type line.
    decode(): Promise<void> {
      const baseProto = Object.getPrototypeOf(Object.getPrototypeOf(this));
      return (this._pendingDecode as Promise<void>) || (baseProto.decode as () => Promise<void>).call(this);
    }
    get src(): string { return this._src; }
    addEventListener(t: string, cb: any): void { if (t === 'load') this.onload = cb; if (t === 'error') this.onerror = cb; }
    removeEventListener(): void { /* no-op */ }
  }

  // ---- generic DOM shim (unchanged from Phase 0.8) -----------------------------------------

  function makeStub(): any {
    // A stub DOM element that swallows most mutations and returns stubs for common lookups.
    // Key design points for CC compat:
    //   - `firstChild` / `lastChild` return a fresh stub so `.click()` chains don't throw
    //     when CC does things like `document.querySelector('#text-options').firstChild.click()`
    //     (creator-23.js:1204). The stub's click() is a no-op unless onclick is set.
    //   - `children[N]` (any index) also returns a fresh stub rather than `undefined` — CC's
    //     own bundled `loadFramePack()` (creator-23.js:569) unconditionally does
    //     `document.querySelector('#frame-picker').children[0].click()` as pure UI-picker
    //     bookkeeping we don't care about (our driver selects frames directly via
    //     addFrameImage/loadFramePack in frame.ts, never through this UI). Left as plain
    //     `children: []`, `.children[0]` is `undefined` and `.click()` on it throws
    //     synchronously inside the vm-executed pack script; ccScriptRunner's catch turns that
    //     into `script.onerror()` → CC's own `loadScript()` promise `reject()` (no argument) —
    //     and since `loadFramePack()`/`loadScript()` are called fire-and-forget at CC's
    //     top level (never awaited by anything that could `.catch()` them), that surfaces as
    //     a genuine `unhandledRejection` (reason `undefined`) on every single render. Same
    //     fix philosophy as `closest()` below: widen the stub so the incidental `.click()`
    //     never throws in the first place.
    //   - `prepend` / `append` are no-ops; `appendChild` returns the child unchanged so
    //     `elt.appendChild(x); x.foo = ...` patterns work.
    const el: any = {
      style: {}, dataset: {}, value: '', checked: false, innerHTML: '', textContent: '',
      className: '', id: '', childNodes: [], files: [],
      get children(): any { return makeChildrenStub(); },
      get firstChild(): any { return makeStub(); },
      get lastChild(): any { return makeStub(); },
      classList: { add: noop, remove: noop, toggle: noop, contains: (): boolean => false },
      addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
      focus: noop, blur: noop,
      // Pass a synthetic event with `target` set to the element itself — mirrors a real
      // DOM click event closely enough for CC's onclick handlers that read `event.target`
      // (e.g. main-1.js's `notify()` schedules `setTimeout(() => close.click(), seconds *
      // 1000)` for its auto-dismiss timer; `closeNotification(event)` then does
      // `event.target.closest('.notification').classList.add(...)`). Without a target, that
      // crashes on `undefined.closest`. This auto-dismiss timer is real: packM15CIPips.js
      // (loaded by Wave 5's transform-back branch) calls `notify(msg, 15)`, and the 15s
      // Node-level timer outlives the sandbox that scheduled it (each render boots a FRESH
      // sandbox, but setTimeout is a real Node event-loop timer, not sandboxed) — it can fire
      // in the MIDDLE of a later card's render within the same test process. Harmless no-op
      // either way (it only ever toggles a notification-banner DOM node we never render), so
      // making it not-throw is the only requirement.
      click(this: any): any { if (typeof this.onclick === 'function') return this.onclick({ target: this }); },
      appendChild: (c: any) => c,
      removeChild: (c: any) => c,
      insertBefore: (c: any) => c,
      prepend: noop, append: noop, remove: noop,
      cloneNode(): any { return makeStub(); },
      setAttribute: noop, getAttribute: (): null => null, hasAttribute: (): boolean => false, removeAttribute: noop,
      // closest() returns a fresh swallow-everything stub rather than null: real DOM
      // `.closest()` only returns null when no ancestor matches, but several CC handlers
      // (closeNotification above, frameOptionClicked, dropEnter/dropLeave, etc.) call
      // `.classList`/other methods on the result unconditionally. None of those OTHER call
      // sites are ever exercised by our driver (we call CC's internal functions directly
      // instead of simulating real clicks/drags), so widening this from null is safe for us
      // and prevents exactly this class of crash for any future incidental `.click()` call.
      querySelector: (): any => makeStub(),
      querySelectorAll: (): any[] => [],
      closest: (): any => makeStub(),
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
      getContext: (): null => null, offsetWidth: 0, offsetHeight: 0, options: [], selectedIndex: 0,
      disabled: false, scrollIntoView: noop,
    };
    return new Proxy(el, {
      get(t: any, k: any): any { if (k in t) return t[k]; if (typeof k === 'string' && /^on/.test(k)) return null; return undefined; },
      set(t: any, k: any, v: any): boolean { t[k] = v; return true; },
    });
  }
  // Array-like stub for `.children`: reports `.length === 0` (so any real "are there children"
  // check still sees an empty element) but returns a fresh `makeStub()` for ANY numeric index
  // — so `el.children[0].click()` (or `[5]`, `[99]`, ...) never throws, matching the
  // `firstChild`/`lastChild`/`closest()` philosophy above.
  function makeChildrenStub(): any {
    const arr: any[] = [];
    return new Proxy(arr, {
      get(t: any, k: any): any {
        if (typeof k === 'string' && /^\d+$/.test(k)) return makeStub();
        return t[k];
      },
    });
  }
  function makeCanvas(w = 10, h = 10): any {
    const c: any = createCanvas(w, h);
    c.style = {}; c.classList = { add: noop, remove: noop, toggle: noop, contains: (): boolean => false };
    c.addEventListener = noop; c.setAttribute = noop; c.getAttribute = (): null => null;
    c.appendChild = (x: any): any => x; c.remove = noop; c.querySelector = (): any => makeStub();
    c.getBoundingClientRect = () => ({ width: w, height: h });
    return c;
  }
  const namedCanvases: Record<string, any> = {};
  const canvasFor = (id: string): any => namedCanvases[id] || (namedCanvases[id] = makeCanvas());
  const stubCache = new Map<string, any>();
  const cachedStub = (k: string): any => { if (!stubCache.has(k)) stubCache.set(k, makeStub()); return stubCache.get(k); };

  let ccScriptRunner: ((script: any) => void) | null = null;
  const headEl: any = {
    appendChild: (c: any): any => { if (c && c.__script && ccScriptRunner) ccScriptRunner(c); return c; },
    insertBefore: (c: any): any => c, removeChild: (c: any): any => c, style: {},
    classList: { add: noop, remove: noop, contains: (): boolean => false },
  };
  const makeScriptEl = (): any => ({
    __script: true, onload: null, onerror: null, _src: '',
    setAttribute(this: any, k: string, v: any): void { if (k === 'src') this._src = v; },
    getAttribute(this: any, k: string): any { return k === 'src' ? this._src : null; },
    set src(v: string) { (this as any)._src = v; },
    get src(): string { return (this as any)._src; },
    addEventListener(this: any, t: string, cb: any): void { if (t === 'load') this.onload = cb; if (t === 'error') this.onerror = cb; },
  });

  const documentShim: any = {
    body: makeStub(), head: headEl, documentElement: makeStub(),
    createElement: (t: string): any => {
      const s = String(t).toLowerCase();
      return s === 'canvas' ? makeCanvas() : s === 'script' ? makeScriptEl() : makeStub();
    },
    createElementNS: (): any => makeStub(), createTextNode: (t: string): any => ({ textContent: t }),
    getElementById: (id: string): any => (/canvas/i.test(id) ? canvasFor(id) : cachedStub('#' + id)),
    querySelector: (sel: string): any => (/#previewCanvas|canvas/i.test(sel) ? canvasFor(sel) : cachedStub(sel)),
    querySelectorAll: (sel: string): any[] => (sel && /head/i.test(sel) ? [headEl] : []),
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    fonts: { ready: Promise.resolve(), load: (): Promise<void> => Promise.resolve(), check: (): boolean => true, add: noop },
    cookie: '', title: '', location: { href: 'http://localhost/', search: '', pathname: '/' },
  };
  const storage = new Map<string, string>();
  const localStorageShim = {
    getItem: (k: string): string | null => (storage.has(k) ? storage.get(k) ?? null : null),
    setItem: (k: string, v: unknown): Map<string, string> => storage.set(k, String(v)),
    removeItem: (k: string): boolean => storage.delete(k),
    clear: (): void => storage.clear(),
    key: (i: number): string | undefined => [...storage.keys()][i],
    get length(): number { return storage.size; },
  };

  const sandbox: any = {};
  Object.assign(sandbox, {
    console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, Promise,
    Math, JSON, Date, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, URL, URLSearchParams, TextEncoder, TextDecoder,
    structuredClone, CanvasRenderingContext2D, Path2D, ImageData, DOMMatrix,
    document: documentShim, localStorage: localStorageShim, Image: DomImage,
    navigator: { userAgent: 'node', language: 'en' },
    location: documentShim.location,
    requestAnimationFrame: (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 0),
    cancelAnimationFrame: clearTimeout,
    getComputedStyle: () => ({ getPropertyValue: (): string => '' }),
    matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop }),
    performance,
    atob: (s: string): string => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s: string): string => Buffer.from(s, 'binary').toString('base64'),
    createCanvas,
  });
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  ccScriptRunner = (script: any): void => {
    const src: string = script._src || '';
    if (/^https?:/i.test(src)) { queueMicrotask(() => script.onload && script.onload()); return; }
    try {
      vm.runInContext(readFileSync(join(CC, src.replace(/^\//, '')), 'utf8'), sandbox, { filename: src });
      queueMicrotask(() => script.onload && script.onload());
    } catch (e) { queueMicrotask(() => script.onerror && script.onerror(e)); }
  };

  const load = (rel: string): void => {
    vm.runInContext(readFileSync(join(CC, 'js', rel), 'utf8'), sandbox, { filename: rel });
  };

  // Pre-seed #selectFramePack's value BEFORE creator-23.js ever runs. creator-23.js's own
  // top-level bootstrap (its tail `loadScript('/js/frames/groupStandard-3.js')` synchronously
  // triggers that file's `loadFramePacks([...])`, which reads
  // `#selectFramePack.value` and requests `/js/frames/pack<value>.js`) executes long before
  // this function's own explicit `#selectFramePack.value = 'M15Regular-1'` line below — our
  // stub's default `value` is `''`, so without this, CC ends up requesting the nonexistent
  // `/js/frames/pack.js`. That throws inside the vm-executed script; ccScriptRunner's catch
  // turns it into `script.onerror()` → CC's own `loadScript()` `reject()` (no argument) — and
  // since `loadFramePacks()`/`loadScript()` are invoked fire-and-forget at CC's top level
  // (nothing anywhere awaits or `.catch()`es them), that surfaces as a genuine
  // `unhandledRejection` on every single render. Harmless functionally either way (our driver
  // never depends on this UI-picker bookkeeping — frame images are always loaded explicitly
  // via frame.ts's addFrameImage/loadFramePack), but avoidable noise.
  documentShim.querySelector('#selectFramePack').value = 'M15Regular-1';
  load('main-1.js'); load('autoFrame.js'); load('creator-23.js');

  // Bootstrap: load the default M15 frame pack so card.text.{mana,title,type,rules,pt,...}
  // exist. CC's own bootstrap does this via a UI event; we drive it directly.
  const card = sandbox.card;
  if (!card.text) {
    try {
      sandbox.document.querySelector('#selectFramePack').value = 'M15Regular-1';
      if (ccScriptRunner) ccScriptRunner({ _src: '/js/frames/packM15Regular-1.js', onload: null, onerror: null });
      const btn = sandbox.document.querySelector('#loadFrameVersion');
      // `await btn.onclick()` here is now the ONLY wait this bootstrap needs: any image
      // decodes the handler kicks off synchronously (autoFitArt/resetSetSymbol/
      // resetWatermark assigning blank-placeholder `.src`s) are tracked into pendingDecodes
      // (tracking is unconditionally on from the top of this function) and get awaited,
      // together with every other boot + build decode, by buildAndComposite below. The
      // previous fixed `await new Promise(r => setTimeout(r, 150))` here was never actually
      // about this handler — it was an accidental, unreliable buffer for the completely
      // unrelated (and completely untracked) mana-symbol decodes from `loadManaSymbols()`
      // above; removed now that those are tracked+awaited for real.
      if (typeof btn.onclick === 'function') await btn.onclick();
    } catch { /* frame init failed; render will fail more visibly below */ }
  }

  function loadFrameScript(src: string): void {
    if (ccScriptRunner) ccScriptRunner({ _src: src, onload: null, onerror: null });
  }

  return {
    sandbox,
    card: sandbox.card,
    document: sandbox.document,
    loadFrameScript,
    // Every image decode since this sandbox was created (boot-time mana/tap/colorless
    // symbols + everything driveRender's build phase touches) — buildAndComposite awaits
    // this whole list exactly once, right before its single guaranteed-complete composite.
    getPendingDecodes: (): Promise<unknown>[] => pendingDecodes,
  };
}

export type NodeCCHandle = {
  buildAndComposite(build: (ctx: CCContext) => Promise<unknown>): Promise<Buffer>;
};

/**
 * Create a Node CCHandle. The handle exposes a single method — `buildAndComposite(build)` —
 * which boots a fresh CC sandbox on each call. The returned handle can be reused across
 * many renders in one process; each render is independent.
 */
export async function createNodeHandle(): Promise<NodeCCHandle> {
  registerFonts();
  // CC's dynamic frame-pack loader appends <script> tags whose "load" fires an onload — some
  // upstream CDN scripts reject; ignore process-wide rather than in every sandbox.
  process.on('unhandledRejection', () => { /* swallow */ });

  /**
   * Boot a fresh sandbox, run the build against it, do one guaranteed-complete composite,
   * return the PNG buffer, drop the sandbox. Every call is independent — no state carries
   * over between renders. Matches v1's per-render Playwright page model.
   */
  async function buildAndComposite(build: (ctx: CCContext) => Promise<unknown>): Promise<Buffer> {
    const ctx = await bootFreshSandbox();
    const { sandbox } = ctx;

    // Await boot-time symbol decodes (mana/tap/colorless — fired synchronously by creator-
    // 23.js's loadManaSymbols() calls inside bootFreshSandbox, above) BEFORE calling into
    // `build`. This is load-bearing, not just belt-and-braces: `build` is `driveRender`,
    // whose LAST line is `await sandbox.drawText()` — the ONE place these symbol images
    // ever get drawn (`lineContext.drawImage(symbol.image, ...)`, creator-23.js:2096).
    // `drawImage` silently no-ops on an undecoded image (Canvas spec) and drawText() is
    // never called again afterwards, so awaiting these decodes any LATER than this point
    // (e.g. only after `build(ctx)` resolves, as this code used to) is already too late —
    // by then drawText() already ran and permanently skipped whatever wasn't decoded yet.
    await Promise.all(ctx.getPendingDecodes());

    // Suppress CC's per-image-load composite storm (Phase 0.8 fix): CC wires
    // image.onload = drawFrames on every frame/mask image (~26-39 loads per render, each
    // triggering a full composite). We suppress drawFrames + drawCard during build, track
    // every image decode, wait for them all, then do exactly one composite.
    const realDrawFrames = sandbox.drawFrames;
    const realDrawCard = sandbox.drawCard;
    sandbox.drawFrames = (): void => { /* suppressed during build */ };
    sandbox.drawCard = (): void => { /* suppressed during build */ };

    try {
      await build(ctx);
      // Await everything ELSE this render kicked off since the boot-decode await above —
      // frame images, art, set symbol, planeswalker assets, masks — before the single
      // composite. (Re-awaiting the already-resolved boot symbols here too is harmless;
      // `getPendingDecodes()` returns the same growing array, and an already-settled
      // promise resolves instantly.)
      await Promise.all(ctx.getPendingDecodes());
    } finally {
      sandbox.drawFrames = realDrawFrames;
      sandbox.drawCard = realDrawCard;
    }

    sandbox.drawFrames(); // one guaranteed-complete composite (also calls drawCard() internally)
    return sandbox.cardCanvas.toBuffer('image/png');
  }

  return { buildAndComposite };
}
