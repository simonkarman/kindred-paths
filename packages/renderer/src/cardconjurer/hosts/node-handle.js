// Node host adapter for CardConjurer — returns a CCHandle backed by a `vm` sandbox that runs
// CC's real code (main-1.js + autoFrame.js + creator-23.js + dynamically-loaded frame packs)
// on @napi-rs/canvas + a minimal DOM shim. Proven in Phase 0.8; see docs/v2-architecture.md §4.
//
// The CCHandle contract (see docs/v2-architecture.md §4 "Two hosts, one driver"):
//   {
//     sandbox: any,                     // sandbox with CC's globals (card, drawText, drawCard, ...)
//     card: any,                        // shortcut for sandbox.card
//     document: any,                    // shortcut for sandbox.document
//     loadFrameScript(src): void,       // execute a CC-relative script (e.g. '/js/frames/packM15Regular-1.js')
//     buildAndComposite(build): Promise // await `build`, then wait for real image decodes,
//                                       //   then do exactly ONE guaranteed-complete composite.
//                                       //   Suppresses CC's per-image-load composite storm
//                                       //   (see Phase 0.8 "drawFrames-storm race" fix).
//   }
//
// The browser host (Phase 1b-int) will provide the same shape backed by a real iframe/window.
// The driver (packages/renderer/src/cardconjurer/driver.js) is written to this contract and
// works identically in both hosts — one driver, two hosts, same rendered pixels.

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

/**
 * Boot a warm CardConjurer sandbox and return a CCHandle. First-render latency; subsequent
 * renders reuse the same sandbox. Idempotent within a process.
 *
 * @returns {Promise<{ sandbox: any, card: any, document: any, loadFrameScript: (src: string) => void, buildAndComposite: (build: () => Promise<any>) => Promise<void> }>}
 */
export async function createNodeHandle() {
  registerFonts();
  process.on('unhandledRejection', () => {}); // CC's external CDN script loads reject; ignore

  const noop = () => {};

  // ---- image path resolution (art + CC assets) ---------------------------------------------

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
    const el = {
      style: {}, dataset: {}, value: '', checked: false, innerHTML: '', textContent: '',
      className: '', id: '', children: [], childNodes: [], files: [],
      classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
      focus: noop, blur: noop,
      click() { if (typeof this.onclick === 'function') return this.onclick(); },
      appendChild: (c) => c, removeChild: (c) => c, insertBefore: (c) => c, remove: noop,
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

  // ---- The CCHandle ------------------------------------------------------------------------

  function loadFrameScript(src) {
    ccScriptRunner({ _src: src, onload: null, onerror: null });
  }

  /**
   * Execute `build` (the driver's field-setup + autoFrame + drawText sequence) with CC's
   * per-image-load composite storm suppressed. Track every real image decode, wait for them
   * all, then do exactly ONE guaranteed-complete composite. See Phase 0.8 findings.
   */
  async function buildAndComposite(build) {
    const realDrawFrames = sandbox.drawFrames;
    const realDrawCard = sandbox.drawCard;
    sandbox.drawFrames = () => {}; sandbox.drawCard = () => {};
    pendingDecodes = []; trackDecodes = true;

    try {
      await build();
      await Promise.all(pendingDecodes); // real decode completion, not a guessed sleep
    } finally {
      trackDecodes = false;
      sandbox.drawFrames = realDrawFrames;
      sandbox.drawCard = realDrawCard;
    }

    sandbox.drawFrames(); // one guaranteed-complete composite (also calls drawCard() internally)
  }

  return {
    sandbox,
    card: sandbox.card,
    document: sandbox.document,
    loadFrameScript,
    buildAndComposite,
  };
}
