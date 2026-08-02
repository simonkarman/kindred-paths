// CardConjurer Node bridge — @kindred-paths/renderer/cardconjurer/node.
//
// Wraps CardConjurer's real code (main-1.js + autoFrame.js + creator-23.js + the dynamically-
// loaded frame pack) unmodified in a Node vm sandbox via @napi-rs/canvas + a minimal generic
// DOM shim + registered fonts + filesystem image loading. This is the proven Phase 0.8 path
// (see spike/renderer/cc-node-renderer.mjs, spike/renderer/cc-node-results.md, and docs
// §4 "CardConjurer server-side execution"): no browser, no Docker, ~1.0s full render, frame
// always present via suppress-drawFrames + await-real-decodes + single guaranteed composite.
//
// Phase 1a scope: this is the **spike-quality** renderer wired behind the Renderer interface —
// enough to make `generate-goldens` runnable end-to-end. It accepts a v1 Card JSON (as
// produced by `collection/cards/*.json`) and drives the DEFAULT autoFrame path only:
//
//   • mana / title / type / rules / pt extracted from face[faceIndex]
//   • borderless if tags.borderless === true
//
// It does NOT yet cover v1's specialised branches (transform, MDFC, adventure, planeswalker,
// tokens, basic-land icons, set symbols, art loading, collector info, etc.) — that's the
// faithful port in Phase 1b. Golden diffs against v1 will therefore be huge for most cards
// until Phase 1b. That's the intended state: the harness exists, and Phase 1b's success
// criterion is `pnpm test:golden` going green.
//
// CardConjurer clone: we consume server/.cardconjurer for now (bootstrapped by the v1
// server/card-conjurer.sh). Moving the clone under packages/renderer/external/cardconjurer/
// is Phase 1b (§10). Same for collection/art.

import { createCanvas, GlobalFonts, Image as NapiImage, Path2D, ImageData, DOMMatrix } from '@napi-rs/canvas';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

import { cardToRenderable } from './renderable.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/renderer/src/cardconjurer/ → repo root is 4 levels up
const REPO = resolve(HERE, '../../../..');
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

// One warm CC sandbox per renderer instance. Boot happens on first render().
async function bootSandbox() {
  registerFonts();
  process.on('unhandledRejection', () => {}); // CC loads external CDN scripts that reject; ignore

  const noop = () => {};
  function resolveSrc(src) {
    if (!src) return null;
    if (src.startsWith('data:')) return { buf: Buffer.from(src.split(',')[1] || '', 'base64') };
    let path = src;
    try { if (src.startsWith('http')) path = new URL(src).pathname; } catch { /* not a URL */ }
    path = path.split('?')[0];
    if (path.startsWith('/local_art/')) {
      const p = join(ART, basename(path));
      return existsSync(p) ? { path: p } : null;
    }
    const p = join(CC, path.replace(/^\//, ''));
    return existsSync(p) ? { path: p } : null;
  }

  // Tracks in-flight image decode promises during a render's build phase (see render() below).
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
        // See docs §4 "Two more bugs found and fixed" + the fix comment in cc-node-renderer.mjs.
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

  // initialize card.text by loading the default M15 pack + firing its #loadFrameVersion.
  // CC's own bootstrap does this via a UI event; we drive it directly.
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

  return { sandbox, getPendingDecodes: () => pendingDecodes, resetDecodes: () => { pendingDecodes = []; }, setTrackDecodes: (v) => { trackDecodes = v; } };
}

// ---- The Renderer ---------------------------------------------------------------------------

/**
 * Factory for the CardConjurer Node renderer. Returns an object matching the Renderer
 * interface (see ../interface.js). Boots CC-in-Node lazily on first render.
 *
 * @returns {Promise<import('../interface.js').Renderer>}
 */
export async function createCardconjurerNodeRenderer() {
  let boot = null; // Promise<{ sandbox, ... }> — created on first render, reused thereafter

  async function render(input, _options = {}) {
    if (!boot) boot = bootSandbox();
    const { sandbox, getPendingDecodes, resetDecodes, setTrackDecodes } = await boot;

    // Accept either a v1 Card JSON (from the golden harness — has .faces) or an already-built
    // Renderable (has .typeLine at the top level). This is transitional: once Phase 1b Wave 2's
    // driver.js lands, only Renderable is accepted and mapping moves into the harness.
    const renderable = input && input.faces
      ? cardToRenderable(input, input.__faceIndex || 0)
      : input;
    const card = sandbox.card;
    const setT = (k, v) => { if (card.text && card.text[k]) card.text[k].text = v ?? ''; };

    const t0 = performance.now();

    // CardConjurer wires `image.onload = drawFrames` on EVERY frame/mask image, and
    // drawFrames() ends by calling drawCard(). A single render triggers ~26-39 image loads,
    // so naively that's ~26-39 full composites per render (the slow path measured at ~8s in
    // Node in Phase 0.8). Also: because those composites land ASYNCHRONOUSLY, capturing the
    // canvas via a fixed sleep is a race — the frame was always missing server-side. The fix
    // (required, not optional): suppress both, track every real decode, wait for them all,
    // then do exactly ONE guaranteed-complete composite. See docs §4 + spike/renderer/
    // cc-node-results.md.
    const realDrawFrames = sandbox.drawFrames;
    const realDrawCard = sandbox.drawCard;
    sandbox.drawFrames = () => {}; sandbox.drawCard = () => {};
    resetDecodes(); setTrackDecodes(true);

    // Wave 1 driver: only the default autoFrame path. Reads Renderable fields directly. The
    // faithful port (all frame branches — transform/adventure/planeswalker/tokens/mdfc — plus
    // Edit Bounds, planeswalker geometry, set symbol, collector info, art loading) lands in
    // Wave 2+ via driver.js.
    setT('mana', renderable.manaCost);
    setT('title', renderable.name);
    setT('type', renderable.typeLine);
    setT('rules', renderable.rules);
    setT('pt', renderable.pt ? `${renderable.pt.power}/${renderable.pt.toughness}` : '');
    try {
      sandbox.document.querySelector('#autoFrame').value = renderable.tags.borderless ? 'Borderless' : 'M15RegularNew';
    } catch { /* ignore */ }

    const b0 = performance.now();
    try { sandbox.autoFrame(); } catch { /* frame errors don't block; drawText/composite will still run */ }
    await sandbox.drawText();
    await Promise.all(getPendingDecodes()); // real decode completion, not a guessed sleep
    setTrackDecodes(false);
    const buildMs = performance.now() - b0;

    const c0 = performance.now();
    sandbox.drawFrames = realDrawFrames; sandbox.drawCard = realDrawCard;
    sandbox.drawFrames(); // one guaranteed-complete composite (also calls drawCard() internally)
    const compositeMs = performance.now() - c0;

    const e0 = performance.now();
    const png = sandbox.cardCanvas.toBuffer('image/png');
    const encodeMs = performance.now() - e0;

    return {
      png,
      width: sandbox.cardCanvas.width,
      height: sandbox.cardCanvas.height,
      timings: {
        buildMs: +buildMs.toFixed(1),
        compositeMs: +compositeMs.toFixed(1),
        encodeMs: +encodeMs.toFixed(1),
        totalMs: +(performance.now() - t0).toFixed(1),
      },
    };
  }

  return { name: 'cardconjurer', render };
}
