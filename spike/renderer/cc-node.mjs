// Phase 0.8 Milestone 1 — run CardConjurer's REAL code (autoFrame.js + creator-23.js) in a
// pure Node process via @napi-rs/canvas + a minimal DOM shim (no browser). Reports how far it
// gets and, on success, renders a card and saves it for pixel-comparison with the browser.
import { createCanvas, GlobalFonts, Image as NapiImage, Path2D, ImageData, DOMMatrix } from '@napi-rs/canvas';
const CanvasRenderingContext2D = createCanvas(1, 1).getContext('2d').constructor;
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const CC = join(REPO, 'server/.cardconjurer');
const ART = join(REPO, 'collection/art');

// ---- font registration (map CC css family -> font file) ------------------------------------
const fontsDir = join(CC, 'fonts');
const fontFiles = {
  belerenb: 'beleren-b.ttf', belerenbsc: 'beleren-bsc.ttf',
  mplantin: 'mplantin.ttf', mplantini: 'mplantin-i.ttf',
  matrix: 'matrix.ttf', matrixb: 'matrix-b.ttf', matrixbsc: 'Matrix Bold Small Caps.ttf',
  gothammedium: 'gotham-medium.ttf', gothambold: 'gothambold.otf',
  goudymedieval: 'goudy-medieval.ttf', mightymouth: 'MightyMouth.otf',
};
let fontsOk = 0;
for (const [fam, file] of Object.entries(fontFiles)) {
  const p = join(fontsDir, file);
  if (existsSync(p)) { try { GlobalFonts.registerFromPath(p, fam); fontsOk++; } catch (e) {} }
}
// Register the Magic mana symbol font if present (used for {T},{W}, etc. in text).
for (const f of readdirSync(fontsDir)) {
  if (/mana|magic|fomalhaut|keyrune|mplantin/i.test(f)) {
    try { GlobalFonts.registerFromPath(join(fontsDir, f)); } catch (e) {}
  }
}
console.log(`[cc-node] fonts registered: ${fontsOk}/${Object.keys(fontFiles).length}`);

// ---- image path resolution + shim ----------------------------------------------------------
let unmapped = new Set();
function resolveSrc(src) {
  if (!src) return null;
  if (src.startsWith('data:')) return { buf: Buffer.from(src.split(',')[1] || '', 'base64') };
  let path = src;
  try { if (src.startsWith('http')) path = new URL(src).pathname; } catch (e) {}
  path = path.split('?')[0];
  if (path.startsWith('/local_art/')) { const p = join(ART, basename(path)); return existsSync(p) ? { path: p } : null; }
  if (path.startsWith('/')) { const p = join(CC, path); return existsSync(p) ? { path: p } : null; }
  const p = join(CC, path);
  return existsSync(p) ? { path: p } : null;
}
let imgLoads = 0, imgFails = 0;
class DomImage extends NapiImage {
  constructor() { super(); this.onload = null; this.onerror = null; }
  set src(v) {
    this._src = v;
    const r = resolveSrc(v);
    if (!r) { imgFails++; unmapped.add((v || '').slice(0, 60)); queueMicrotask(() => this.onerror && this.onerror(new Error('unmapped ' + v))); return; }
    try {
      const buf = r.buf || readFileSync(r.path);
      super.src = buf; // native decode
      imgLoads++;
      queueMicrotask(() => this.onload && this.onload());
    } catch (e) { imgFails++; queueMicrotask(() => this.onerror && this.onerror(e)); }
  }
  get src() { return this._src; }
  addEventListener(t, cb) { if (t === 'load') this.onload = cb; if (t === 'error') this.onerror = cb; }
  removeEventListener() {}
}

// ---- minimal DOM shim ----------------------------------------------------------------------
const noop = () => {};
function makeStub(tag = 'div') {
  const el = {
    tagName: (tag || 'div').toUpperCase(), nodeType: 1, style: {}, dataset: {}, value: '', checked: false,
    innerHTML: '', textContent: '', className: '', id: '', children: [], childNodes: [], files: [],
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop, focus: noop, blur: noop,
    click() { if (typeof this.onclick === 'function') return this.onclick(); },
    appendChild: (c) => c, removeChild: (c) => c, insertBefore: (c) => c, remove: noop, cloneNode: () => makeStub(tag),
    setAttribute: noop, getAttribute: () => null, hasAttribute: () => false, removeAttribute: noop,
    querySelector: () => makeStub(), querySelectorAll: () => [], closest: () => null,
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
    getContext: () => null, offsetWidth: 0, offsetHeight: 0, clientWidth: 0, clientHeight: 0,
    options: [], selectedIndex: 0, checked: false, disabled: false, scrollIntoView: noop,
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
  c.appendChild = (x) => x; c.remove = noop; c.querySelector = () => makeStub(); c.getBoundingClientRect = () => ({ width: w, height: h });
  return c;
}
// canvases referenced by id in creator-23.js top-level init
const namedCanvases = {};
function canvasFor(id) { return namedCanvases[id] || (namedCanvases[id] = makeCanvas()); }
// cache non-canvas stubs by selector so props (e.g. onclick) persist across querySelector calls
const stubCache = new Map();
function cachedStub(key) { if (!stubCache.has(key)) stubCache.set(key, makeStub()); return stubCache.get(key); }

// CC's runtime loadScript() appends <script src> to <head>; intercept to run local frame
// scripts in-sandbox (and skip external CDN scripts).
let ccScriptRunner = null;
let scriptsRun = 0;
const headEl = {
  appendChild: (child) => { if (child && child.__script && ccScriptRunner) ccScriptRunner(child); return child; },
  insertBefore: (c) => c, removeChild: (c) => c, style: {},
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
};
function makeScriptEl() {
  return {
    __script: true, onload: null, onerror: null, _src: '', type: '', style: {},
    setAttribute(k, v) { if (k === 'src') this._src = v; else this[k] = v; },
    getAttribute(k) { return k === 'src' ? this._src : (this[k] ?? null); },
    set src(v) { this._src = v; }, get src() { return this._src; },
    addEventListener(t, cb) { if (t === 'load') this.onload = cb; if (t === 'error') this.onerror = cb; },
  };
}

const documentShim = {
  body: makeStub('body'), head: headEl, documentElement: makeStub('html'),
  createElement: (tag) => {
    const t = String(tag).toLowerCase();
    if (t === 'canvas') return makeCanvas();
    if (t === 'script') return makeScriptEl();
    return makeStub(tag);
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
  getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k), clear: () => storage.clear(), key: (i) => [...storage.keys()][i], get length() { return storage.size; },
};

// ---- build sandbox + load CC scripts -------------------------------------------------------
const sandbox = {};
Object.assign(sandbox, {
  console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, Promise, Math, JSON, Date,
  parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, fetch: undefined,
  URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone,
  CanvasRenderingContext2D, Path2D, ImageData, DOMMatrix,
  document: documentShim, localStorage: localStorageShim, Image: DomImage,
  navigator: { userAgent: 'node', language: 'en' }, location: documentShim.location,
  requestAnimationFrame: (cb) => setTimeout(() => cb(performance.now()), 0), cancelAnimationFrame: clearTimeout,
  getComputedStyle: () => ({ getPropertyValue: () => '' }), matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop }),
  performance, atob: (s) => Buffer.from(s, 'base64').toString('binary'), btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  createCanvas,
});
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

process.on('unhandledRejection', () => {}); // CC's external CDN script loads reject; ignore

// run local frame scripts CC requests at runtime, in the same sandbox
ccScriptRunner = (script) => {
  const src = script._src || '';
  if (/^https?:/i.test(src)) { queueMicrotask(() => script.onload && script.onload()); return; }
  try {
    const p = join(CC, src.replace(/^\//, ''));
    vm.runInContext(readFileSync(p, 'utf8'), sandbox, { filename: src });
    scriptsRun++;
    queueMicrotask(() => script.onload && script.onload());
  } catch (e) { queueMicrotask(() => script.onerror && script.onerror(e)); }
};

function loadScript(rel) {
  const code = readFileSync(join(CC, 'js', rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
}

const stage = { load_main: false, load_autoFrame: false, load_creator: false, has_globals: false, autoFrame: false, drawText: false, render: false };
let firstError = null;
try {
  loadScript('main-1.js'); stage.load_main = true;
  loadScript('autoFrame.js'); stage.load_autoFrame = true;
  loadScript('creator-23.js'); stage.load_creator = true;
  stage.has_globals = !!(sandbox.card && sandbox.cardCanvas && typeof sandbox.drawText === 'function' && typeof sandbox.drawCard === 'function' && typeof sandbox.autoFrame === 'function');
} catch (e) { firstError = e; }

console.log('[cc-node] load stages:', JSON.stringify(stage));
if (firstError) {
  console.log('[cc-node] FIRST ERROR during load: ' + firstError.message);
  console.log('  ' + (firstError.stack || '').split('\n').slice(0, 6).join('\n  '));
}
if (unmapped.size) console.log('[cc-node] unmapped image srcs (sample):', [...unmapped].slice(0, 8));

// ---- if globals are up, try to drive + render ----------------------------------------------
if (stage.has_globals) {
  try {
    const card = sandbox.card;
    // initialize card.text by loading the default M15 pack + firing its #loadFrameVersion
    if (!card.text) {
      try {
        sandbox.document.querySelector('#selectFramePack').value = 'M15Regular-1';
        ccScriptRunner({ _src: '/js/frames/packM15Regular-1.js', onload: null, onerror: null });
        const btn = sandbox.document.querySelector('#loadFrameVersion');
        if (typeof btn.onclick === 'function') await btn.onclick();
      } catch (e) { console.log('[cc-node] frame init error:', e.message); }
      await new Promise((r) => setTimeout(r, 300));
      console.log('[cc-node] card.text after frame init:', card.text ? Object.keys(card.text).join(',') : 'undefined');
    }
    // set text fields directly (as the interactive/perf spikes do)
    const setT = (k, v) => { if (card.text && card.text[k]) card.text[k].text = v; };
    setT('mana', '{2}{G}'); setT('title', 'Node Ranger'); setT('type', 'Creature — Elf Ranger');
    setT('rules', 'Vigilance\nWhen Node Ranger enters the battlefield, draw a card.'); setT('pt', '3/3');
    try { sandbox.document.querySelector('#autoFrame').value = 'M15RegularNew'; } catch (e) {}
    try { sandbox.autoFrame(); stage.autoFrame = true; } catch (e) { firstError = firstError || e; console.log('[cc-node] autoFrame() error:', e.message); }
    await new Promise((r) => setTimeout(r, 1500)); // let async frame images load
    try { await sandbox.drawText(); stage.drawText = true; } catch (e) { firstError = firstError || e; console.log('[cc-node] drawText() error:', e.message); }
    try { sandbox.drawCard(); } catch (e) { console.log('[cc-node] drawCard() error:', e.message); }
    const buf = sandbox.cardCanvas.toBuffer('image/png');
    writeFileSync(join(HERE, 'out-cc-node.png'), buf);
    stage.render = buf.length > 5000;
    console.log(`[cc-node] rendered out-cc-node.png (${buf.length} bytes); imgLoads=${imgLoads} imgFails=${imgFails} scriptsRun=${scriptsRun}`);

    // warm re-render timing (change rules text -> drawText -> drawCard), median of N
    if (stage.render) {
      const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
      const draw = [], encode = [];
      for (let i = 0; i < 9; i++) {
        card.text.rules.text = 'Vigilance\nDraw a card. (' + i + ')';
        let t = performance.now(); await sandbox.drawText(); sandbox.drawCard(); draw.push(performance.now() - t);
        t = performance.now(); sandbox.cardCanvas.toBuffer('image/png'); encode.push(performance.now() - t);
      }
      console.log(`[cc-node] warm re-render: drawText+drawCard ~${med(draw).toFixed(1)}ms, PNG encode ~${med(encode).toFixed(1)}ms`);
    }
  } catch (e) { console.log('[cc-node] drive/render error:', e.message); }
}

console.log('[cc-node] RESULT:', JSON.stringify(stage));
console.log(stage.render ? '[cc-node] M1 PASS-ish: CC code produced a PNG in Node (inspect out-cc-node.png)'
  : '[cc-node] M1 not yet rendering — see stages/errors above');
