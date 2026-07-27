// Reusable, warm CardConjurer-in-Node renderer (Phase 0.8 → a real server-render prototype).
// createNodeRenderer() loads CardConjurer once into a Node vm sandbox (via @napi-rs/canvas + a
// minimal DOM shim) and returns { render(spec) } that renders a card to a PNG buffer on demand.
import { createCanvas, GlobalFonts, Image as NapiImage, Path2D, ImageData, DOMMatrix } from '@napi-rs/canvas';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const CC = join(REPO, 'server/.cardconjurer');
const ART = join(REPO, 'collection/art');
const CanvasRenderingContext2D = createCanvas(1, 1).getContext('2d').constructor;

let registered = false;
function registerFonts() {
  if (registered) return; registered = true;
  const fontsDir = join(CC, 'fonts');
  const map = { belerenb: 'beleren-b.ttf', belerenbsc: 'beleren-bsc.ttf', mplantin: 'mplantin.ttf', mplantini: 'mplantin-i.ttf', matrix: 'matrix.ttf', matrixb: 'matrix-b.ttf', gothammedium: 'gotham-medium.ttf', gothambold: 'gothambold.otf', goudymedieval: 'goudy-medieval.ttf', mightymouth: 'MightyMouth.otf' };
  for (const [fam, file] of Object.entries(map)) { const p = join(fontsDir, file); if (existsSync(p)) { try { GlobalFonts.registerFromPath(p, fam); } catch (e) {} } }
  for (const f of readdirSync(fontsDir)) { if (/mana|magic|fomalhaut|keyrune|mplantin/i.test(f)) { try { GlobalFonts.registerFromPath(join(fontsDir, f)); } catch (e) {} } }
}

export async function createNodeRenderer() {
  registerFonts();
  process.on('unhandledRejection', () => {});

  const noop = () => {};
  function resolveSrc(src) {
    if (!src) return null;
    if (src.startsWith('data:')) return { buf: Buffer.from(src.split(',')[1] || '', 'base64') };
    let path = src; try { if (src.startsWith('http')) path = new URL(src).pathname; } catch (e) {}
    path = path.split('?')[0];
    if (path.startsWith('/local_art/')) { const p = join(ART, basename(path)); return existsSync(p) ? { path: p } : null; }
    const p = join(CC, path.replace(/^\//, '')); return existsSync(p) ? { path: p } : null;
  }
  class DomImage extends NapiImage {
    constructor() { super(); this.onload = null; this.onerror = null; }
    set src(v) {
      this._src = v;
      const r = resolveSrc(v);
      if (!r) { queueMicrotask(() => this.onerror && this.onerror(new Error('unmapped'))); return; }
      try {
        super.src = r.buf || readFileSync(r.path);
        // IMPORTANT: @napi-rs/canvas decodes asynchronously — `width`/`height` are not valid
        // immediately after `src` is set. Firing onload synchronously (or via a bare
        // queueMicrotask) races ahead of the real decode and produces blank/partial frames.
        // decode() resolves once the image is actually usable; that's when onload must fire.
        const p = this.decode().then(() => { if (this.onload) this.onload(); }).catch((e) => { if (this.onerror) this.onerror(e); });
        if (trackDecodes) pendingDecodes.push(p);
      } catch (e) { queueMicrotask(() => this.onerror && this.onerror(e)); }
    }
    get src() { return this._src; }
    addEventListener(t, cb) { if (t === 'load') this.onload = cb; if (t === 'error') this.onerror = cb; }
    removeEventListener() {}
  }
  // Tracks in-flight image decode promises during a render's build phase (see render() below).
  let pendingDecodes = [];
  let trackDecodes = false;
  function makeStub() {
    const el = { style: {}, dataset: {}, value: '', checked: false, innerHTML: '', textContent: '', className: '', id: '', children: [], childNodes: [], files: [], classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, addEventListener: noop, removeEventListener: noop, dispatchEvent: noop, focus: noop, blur: noop, click() { if (typeof this.onclick === 'function') return this.onclick(); }, appendChild: (c) => c, removeChild: (c) => c, insertBefore: (c) => c, remove: noop, cloneNode() { return makeStub(); }, setAttribute: noop, getAttribute: () => null, hasAttribute: () => false, removeAttribute: noop, querySelector: () => makeStub(), querySelectorAll: () => [], closest: () => null, getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }), getContext: () => null, offsetWidth: 0, offsetHeight: 0, options: [], selectedIndex: 0, disabled: false, scrollIntoView: noop };
    return new Proxy(el, { get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && /^on/.test(k)) return null; return undefined; }, set(t, k, v) { t[k] = v; return true; } });
  }
  function makeCanvas(w = 10, h = 10) { const c = createCanvas(w, h); c.style = {}; c.classList = { add: noop, remove: noop, toggle: noop, contains: () => false }; c.addEventListener = noop; c.setAttribute = noop; c.getAttribute = () => null; c.appendChild = (x) => x; c.remove = noop; c.querySelector = () => makeStub(); c.getBoundingClientRect = () => ({ width: w, height: h }); return c; }
  const namedCanvases = {}; const canvasFor = (id) => namedCanvases[id] || (namedCanvases[id] = makeCanvas());
  const stubCache = new Map(); const cachedStub = (k) => { if (!stubCache.has(k)) stubCache.set(k, makeStub()); return stubCache.get(k); };

  let ccScriptRunner = null;
  const headEl = { appendChild: (c) => { if (c && c.__script && ccScriptRunner) ccScriptRunner(c); return c; }, insertBefore: (c) => c, removeChild: (c) => c, style: {}, classList: { add: noop, remove: noop, contains: () => false } };
  const makeScriptEl = () => ({ __script: true, onload: null, onerror: null, _src: '', setAttribute(k, v) { if (k === 'src') this._src = v; }, getAttribute(k) { return k === 'src' ? this._src : null; }, set src(v) { this._src = v; }, get src() { return this._src; }, addEventListener(t, cb) { if (t === 'load') this.onload = cb; if (t === 'error') this.onerror = cb; } });

  const documentShim = {
    body: makeStub(), head: headEl, documentElement: makeStub(),
    createElement: (t) => { const s = String(t).toLowerCase(); return s === 'canvas' ? makeCanvas() : s === 'script' ? makeScriptEl() : makeStub(); },
    createElementNS: () => makeStub(), createTextNode: (t) => ({ textContent: t }),
    getElementById: (id) => (/canvas/i.test(id) ? canvasFor(id) : cachedStub('#' + id)),
    querySelector: (sel) => (/#previewCanvas|canvas/i.test(sel) ? canvasFor(sel) : cachedStub(sel)),
    querySelectorAll: (sel) => (sel && /head/i.test(sel) ? [headEl] : []),
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), check: () => true, add: noop },
    cookie: '', title: '', location: { href: 'http://localhost/', search: '', pathname: '/' },
  };
  const storage = new Map();
  const localStorageShim = { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k), clear: () => storage.clear(), key: (i) => [...storage.keys()][i], get length() { return storage.size; } };

  const sandbox = {};
  Object.assign(sandbox, { console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, Promise, Math, JSON, Date, parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone, CanvasRenderingContext2D, Path2D, ImageData, DOMMatrix, document: documentShim, localStorage: localStorageShim, Image: DomImage, navigator: { userAgent: 'node', language: 'en' }, location: documentShim.location, requestAnimationFrame: (cb) => setTimeout(() => cb(performance.now()), 0), cancelAnimationFrame: clearTimeout, getComputedStyle: () => ({ getPropertyValue: () => '' }), matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop }), performance, atob: (s) => Buffer.from(s, 'base64').toString('binary'), btoa: (s) => Buffer.from(s, 'binary').toString('base64'), createCanvas });
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  ccScriptRunner = (script) => { const src = script._src || ''; if (/^https?:/i.test(src)) { queueMicrotask(() => script.onload && script.onload()); return; } try { vm.runInContext(readFileSync(join(CC, src.replace(/^\//, '')), 'utf8'), sandbox, { filename: src }); queueMicrotask(() => script.onload && script.onload()); } catch (e) { queueMicrotask(() => script.onerror && script.onerror(e)); } };
  const load = (rel) => vm.runInContext(readFileSync(join(CC, 'js', rel), 'utf8'), sandbox, { filename: rel });
  load('main-1.js'); load('autoFrame.js'); load('creator-23.js');

  // initialize card.text via the default M15 pack
  const card = sandbox.card;
  if (!card.text) {
    try { sandbox.document.querySelector('#selectFramePack').value = 'M15Regular-1'; ccScriptRunner({ _src: '/js/frames/packM15Regular-1.js', onload: null, onerror: null }); const btn = sandbox.document.querySelector('#loadFrameVersion'); if (typeof btn.onclick === 'function') await btn.onclick(); } catch (e) {}
    await new Promise((r) => setTimeout(r, 150));
  }

  async function render(spec = {}) {
    const t0 = performance.now();
    const setT = (k, v) => { if (card.text && card.text[k]) card.text[k].text = v ?? ''; };

    // CardConjurer wires `image.onload = drawFrames` on EVERY frame/mask image (creator-23.js
    // ~921-932), and drawFrames() ends by calling drawCard(). A single render triggers ~26-39
    // of these image loads, so naively that's ~26-39 full mask-composites per render (the
    // slow path we measured at ~8s in Node / ~1.8s in a browser). We suppress both functions
    // during the build phase, track every real image decode, wait for all of them, then do
    // exactly ONE composite ourselves — same visual result, ~15-25x less work.
    const realDrawFrames = sandbox.drawFrames, realDrawCard = sandbox.drawCard;
    sandbox.drawFrames = noop; sandbox.drawCard = noop;
    pendingDecodes = []; trackDecodes = true;

    setT('mana', spec.mana); setT('title', spec.title); setT('type', spec.type); setT('rules', spec.rules); setT('pt', spec.pt);
    try { sandbox.document.querySelector('#autoFrame').value = spec.borderless ? 'Borderless' : 'M15RegularNew'; } catch (e) {}
    const b0 = performance.now();
    try { sandbox.autoFrame(); } catch (e) {}
    await sandbox.drawText();
    await Promise.all(pendingDecodes); // real decode completion, not a guessed sleep
    trackDecodes = false;
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
      buildMs: +buildMs.toFixed(1),       // text set + autoFrame + drawText + image decodes
      compositeMs: +compositeMs.toFixed(1), // the single mask/frame/card composite
      encodeMs: +encodeMs.toFixed(1),
      totalMs: +(performance.now() - t0).toFixed(1),
      width: sandbox.cardCanvas.width,
      height: sandbox.cardCanvas.height,
    };
  }

  return { render, sandbox };
}
