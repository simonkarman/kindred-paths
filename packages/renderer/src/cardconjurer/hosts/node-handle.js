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
// The driver (packages/renderer/src/cardconjurer/driver.js) receives `ctx` from the build
// callback and never sees the sandbox lifecycle. Same driver, two hosts (Node + Browser),
// same rendered pixels.

import { createCanvas, GlobalFonts, Image as NapiImage, Path2D, ImageData, DOMMatrix } from '@napi-rs/canvas';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/renderer/src/cardconjurer/hosts/ → repo root is 5 levels up
const REPO = resolve(HERE, '../../../../..');
const CC = process.env.KP_CARDCONJURER_PATH || join(REPO, 'server/.cardconjurer');
const ART = join(REPO, 'collection/art');
const CanvasRenderingContext2D = createCanvas(1, 1).getContext('2d').constructor;

// ---- process-global font registration -----------------------------------------------------
//
// @napi-rs/canvas's GlobalFonts registry is process-global. Registering the same font twice
// is a no-op; registering thousands of times is wasteful. Guard behind a boolean so multiple
// fresh sandboxes share one registration pass. This is the ONLY per-process state we keep.

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;
  const fontsDir = join(CC, 'fonts');
  if (!existsSync(fontsDir)) return;
  const map = {
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
// context ({sandbox, card, document, loadFrameScript}) plus the drawFrames-storm-fix
// primitives (getPendingDecodes, resetDecodes, setTrackDecodes) that buildAndComposite
// wraps around the user's build callback.
//
// Called by buildAndComposite once per render. The sandbox and everything hanging off it
// is dropped when buildAndComposite returns, allowing GC to reclaim it.
async function bootFreshSandbox() {
  const noop = () => {};

  // ---- image path resolution (art + CC assets) -------------------------------------------

  function resolveSrc(src) {
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
    const p = join(CC, path.replace(/^\//, ''));
    return existsSync(p) ? { path: p } : null;
  }

  // Tracks in-flight image decode promises during buildAndComposite's build phase — the
  // suppress-composite-storm fix from Phase 0.8. See spike/renderer/cc-node-results.md
  // and docs/v2-architecture.md §4 "Two more bugs found and fixed".
  let pendingDecodes = [];
  let trackDecodes = false;

  class DomImage extends NapiImage {
    constructor() { super(); this.onload = null; this.onerror = null; }
    set src(v) {
      this._src = v;
      const r = resolveSrc(v);
      if (!r) { queueMicrotask(() => this.onerror && this.onerror(new Error('unmapped'))); return; }
      try {
        super.src = r.buf || readFileSync(r.path);
        // @napi-rs/canvas decodes asynchronously; onload MUST fire only after decode() resolves,
        // otherwise the mask/frame is painted from a not-yet-decoded image and comes out blank.
        const p = this.decode()
          .then(() => { if (this.onload) this.onload(); })
          .catch((e) => { if (this.onerror) this.onerror(e); });
        if (trackDecodes) pendingDecodes.push(p);
      } catch (e) { queueMicrotask(() => this.onerror && this.onerror(e)); }
    }
    get src() { return this._src; }
    addEventListener(t, cb) { if (t === 'load') this.onload = cb; if (t === 'error') this.onerror = cb; }
    removeEventListener() {}
  }

  // ---- generic DOM shim (unchanged from Phase 0.8) -----------------------------------------

  function makeStub() {
    // A stub DOM element that swallows most mutations and returns stubs for common lookups.
    // Key design points for CC compat:
    //   - `firstChild` / `lastChild` return a fresh stub so `.click()` chains don't throw
    //     when CC does things like `document.querySelector('#text-options').firstChild.click()`
    //     (creator-23.js:1204). The stub's click() is a no-op unless onclick is set.
    //   - `children[0]` etc. via Proxy fallback returns undefined; CC uses this only in a
    //     handful of places where the resulting throw is caught (or the code path guards).
    //   - `prepend` / `append` are no-ops; `appendChild` returns the child unchanged so
    //     `elt.appendChild(x); x.foo = ...` patterns work.
    const el = {
      style: {}, dataset: {}, value: '', checked: false, innerHTML: '', textContent: '',
      className: '', id: '', children: [], childNodes: [], files: [],
      get firstChild() { return makeStub(); },
      get lastChild() { return makeStub(); },
      classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
      focus: noop, blur: noop,
      click() { if (typeof this.onclick === 'function') return this.onclick(); },
      appendChild: (c) => c, removeChild: (c) => c, insertBefore: (c) => c, prepend: noop, append: noop, remove: noop,
      cloneNode() { return makeStub(); },
      setAttribute: noop, getAttribute: () => null, hasAttribute: () => false, removeAttribute: noop,
      querySelector: () => makeStub(), querySelectorAll: () => [], closest: () => null,
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
      getContext: () => null, offsetWidth: 0, offsetHeight: 0, options: [], selectedIndex: 0,
      disabled: false, scrollIntoView: noop,
    };
    return new Proxy(el, {
      get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && /^on/.test(k)) return null; return undefined; },
      set(t, k, v) { t[k] = v; return true; },
    });
  }
  function makeCanvas(w = 10, h = 10) {
    const c = createCanvas(w, h);
    c.style = {}; c.classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
    c.addEventListener = noop; c.setAttribute = noop; c.getAttribute = () => null;
    c.appendChild = (x) => x; c.remove = noop; c.querySelector = () => makeStub();
    c.getBoundingClientRect = () => ({ width: w, height: h });
    return c;
  }
  const namedCanvases = {};
  const canvasFor = (id) => namedCanvases[id] || (namedCanvases[id] = makeCanvas());
  const stubCache = new Map();
  const cachedStub = (k) => { if (!stubCache.has(k)) stubCache.set(k, makeStub()); return stubCache.get(k); };

  let ccScriptRunner = null;
  const headEl = {
    appendChild: (c) => { if (c && c.__script && ccScriptRunner) ccScriptRunner(c); return c; },
    insertBefore: (c) => c, removeChild: (c) => c, style: {},
    classList: { add: noop, remove: noop, contains: () => false },
  };
  const makeScriptEl = () => ({
    __script: true, onload: null, onerror: null, _src: '',
    setAttribute(k, v) { if (k === 'src') this._src = v; },
    getAttribute(k) { return k === 'src' ? this._src : null; },
    set src(v) { this._src = v; }, get src() { return this._src; },
    addEventListener(t, cb) { if (t === 'load') this.onload = cb; if (t === 'error') this.onerror = cb; },
  });

  const documentShim = {
    body: makeStub(), head: headEl, documentElement: makeStub(),
    createElement: (t) => {
      const s = String(t).toLowerCase();
      return s === 'canvas' ? makeCanvas() : s === 'script' ? makeScriptEl() : makeStub();
    },
    createElementNS: () => makeStub(), createTextNode: (t) => ({ textContent: t }),
    getElementById: (id) => (/canvas/i.test(id) ? canvasFor(id) : cachedStub('#' + id)),
    querySelector: (sel) => (/#previewCanvas|canvas/i.test(sel) ? canvasFor(sel) : cachedStub(sel)),
    querySelectorAll: (sel) => (sel && /head/i.test(sel) ? [headEl] : []),
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), check: () => true, add: noop },
    cookie: '', title: '', location: { href: 'http://localhost/', search: '', pathname: '/' },
  };
  const storage = new Map();
  const localStorageShim = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k), clear: () => storage.clear(),
    key: (i) => [...storage.keys()][i], get length() { return storage.size; },
  };

  const sandbox = {};
  Object.assign(sandbox, {
    console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, Promise,
    Math, JSON, Date, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, URL, URLSearchParams, TextEncoder, TextDecoder,
    structuredClone, CanvasRenderingContext2D, Path2D, ImageData, DOMMatrix,
    document: documentShim, localStorage: localStorageShim, Image: DomImage,
    navigator: { userAgent: 'node', language: 'en' },
    location: documentShim.location,
    requestAnimationFrame: (cb) => setTimeout(() => cb(performance.now()), 0),
    cancelAnimationFrame: clearTimeout,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop }),
    performance, atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    createCanvas,
  });
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  ccScriptRunner = (script) => {
    const src = script._src || '';
    if (/^https?:/i.test(src)) { queueMicrotask(() => script.onload && script.onload()); return; }
    try {
      vm.runInContext(readFileSync(join(CC, src.replace(/^\//, '')), 'utf8'), sandbox, { filename: src });
      queueMicrotask(() => script.onload && script.onload());
    } catch (e) { queueMicrotask(() => script.onerror && script.onerror(e)); }
  };

  const load = (rel) => vm.runInContext(readFileSync(join(CC, 'js', rel), 'utf8'), sandbox, { filename: rel });
  load('main-1.js'); load('autoFrame.js'); load('creator-23.js');

  // Bootstrap: load the default M15 frame pack so card.text.{mana,title,type,rules,pt,...}
  // exist. CC's own bootstrap does this via a UI event; we drive it directly.
  const card = sandbox.card;
  if (!card.text) {
    try {
      sandbox.document.querySelector('#selectFramePack').value = 'M15Regular-1';
      ccScriptRunner({ _src: '/js/frames/packM15Regular-1.js', onload: null, onerror: null });
      const btn = sandbox.document.querySelector('#loadFrameVersion');
      if (typeof btn.onclick === 'function') await btn.onclick();
    } catch { /* frame init failed; render will fail more visibly below */ }
    await new Promise((r) => setTimeout(r, 150));
  }

  function loadFrameScript(src) {
    ccScriptRunner({ _src: src, onload: null, onerror: null });
  }

  return {
    sandbox,
    card: sandbox.card,
    document: sandbox.document,
    loadFrameScript,
    // Storm-fix primitives — used by buildAndComposite to bracket the build phase:
    getPendingDecodes: () => pendingDecodes,
    resetDecodes: () => { pendingDecodes = []; },
    setTrackDecodes: (v) => { trackDecodes = v; },
  };
}

/**
 * Create a Node CCHandle. The handle exposes a single method — `buildAndComposite(build)` —
 * which boots a fresh CC sandbox on each call. The returned handle can be reused across
 * many renders in one process; each render is independent.
 *
 * @returns {Promise<{ buildAndComposite: (build: (ctx: { sandbox: any, card: any, document: any, loadFrameScript: (src: string) => void }) => Promise<any>) => Promise<Buffer> }>}
 */
export async function createNodeHandle() {
  registerFonts();
  // CC's dynamic frame-pack loader appends <script> tags whose "load" fires an onload — some
  // upstream CDN scripts reject; ignore process-wide rather than in every sandbox.
  process.on('unhandledRejection', () => {});

  /**
   * Boot a fresh sandbox, run the build against it, do one guaranteed-complete composite,
   * return the PNG buffer, drop the sandbox. Every call is independent — no state carries
   * over between renders. Matches v1's per-render Playwright page model.
   *
   * @param {(ctx: { sandbox: any, card: any, document: any, loadFrameScript: (src: string) => void }) => Promise<any>} build
   * @returns {Promise<Buffer>}  the composed card PNG
   */
  async function buildAndComposite(build) {
    const ctx = await bootFreshSandbox();
    const { sandbox } = ctx;

    // Suppress CC's per-image-load composite storm (Phase 0.8 fix): CC wires
    // image.onload = drawFrames on every frame/mask image (~26-39 loads per render, each
    // triggering a full composite). We suppress drawFrames + drawCard during build, track
    // every image decode, wait for them all, then do exactly one composite.
    const realDrawFrames = sandbox.drawFrames;
    const realDrawCard = sandbox.drawCard;
    sandbox.drawFrames = () => {}; sandbox.drawCard = () => {};
    ctx.resetDecodes(); ctx.setTrackDecodes(true);

    try {
      await build(ctx);
      await Promise.all(ctx.getPendingDecodes());
    } finally {
      ctx.setTrackDecodes(false);
      sandbox.drawFrames = realDrawFrames;
      sandbox.drawCard = realDrawCard;
    }

    sandbox.drawFrames(); // one guaranteed-complete composite (also calls drawCard() internally)
    return sandbox.cardCanvas.toBuffer('image/png');
  }

  return { buildAndComposite };
}
