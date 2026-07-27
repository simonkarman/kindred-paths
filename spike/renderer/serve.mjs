// Zero-dependency static server for the Phase 0 renderer spike.
// Serves the CardConjurer clone + the harness page + collection art, all SAME-ORIGIN,
// which is what makes iframe-driving and cardCanvas.toDataURL() extraction possible.
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname, normalize, basename } from 'node:path';
import { createReadStream, existsSync, statSync, readFileSync, readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const CC_ROOT = join(REPO, 'server/.cardconjurer');
const ART_ROOT = join(REPO, 'collection/art');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

function send(res, status, headers, stream) {
  res.writeHead(status, headers);
  if (stream) stream.pipe(res);
  else res.end();
}

function serveFile(res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    console.log('[serve] 404', filePath);
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404');
    return;
  }
  const type = TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
  const stream = createReadStream(filePath);
  stream.on('error', () => { try { res.end(); } catch (e) {} });
  send(res, 200, { 'content-type': type, 'access-control-allow-origin': '*' }, stream);
}

// Guard against path traversal: resolved path must stay under root.
function safeJoin(root, urlPath) {
  const p = normalize(join(root, decodeURIComponent(urlPath)));
  return p.startsWith(root) ? p : null;
}

// --- dashboard API: results md, image list, and a live CC-in-Node server render ---
let nodeRendererPromise = null; // lazy warm renderer
const nodeCache = new Map();    // content-hash cache (in-memory)
const RESULT_FILES = { perf: 'perf-results.md', patch: 'patch-results.md', scale: 'scale-results.md', ccNode: 'cc-node-results.md' };

function readJson(res, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
  res.end(body);
}

async function handleApi(req, res, urlPath, query) {
  if (urlPath === '/api/results') {
    const out = {};
    for (const [k, f] of Object.entries(RESULT_FILES)) { const p = join(HERE, f); out[k] = existsSync(p) ? readFileSync(p, 'utf8') : null; }
    return readJson(res, out);
  }
  if (urlPath === '/api/images') {
    const files = readdirSync(HERE).filter((f) => /\.(png|jpe?g)$/i.test(f))
      .map((f) => ({ name: f, size: statSync(join(HERE, f)).size })).sort((a, b) => a.name.localeCompare(b.name));
    return readJson(res, { files });
  }
  if (urlPath === '/api/render-node') {
    const spec = { mana: query.get('mana') || '', title: query.get('title') || '', type: query.get('type') || '', rules: query.get('rules') || '', pt: query.get('pt') || '' };
    const key = JSON.stringify(spec);
    if (nodeCache.has(key)) {
      const c = nodeCache.get(key);
      res.writeHead(200, { 'content-type': 'image/png', 'access-control-allow-origin': '*', 'x-timing': JSON.stringify({ ...c.timing, cached: true }) });
      return res.end(c.png);
    }
    try {
      if (!nodeRendererPromise) nodeRendererPromise = import('./cc-node-renderer.mjs').then((m) => m.createNodeRenderer());
      const renderer = await nodeRendererPromise;
      const r = await renderer.render(spec);
      const timing = { buildMs: r.buildMs, compositeMs: r.compositeMs, encodeMs: r.encodeMs, cached: false };
      nodeCache.set(key, { png: r.png, timing });
      res.writeHead(200, { 'content-type': 'image/png', 'access-control-allow-origin': '*', 'x-timing': JSON.stringify(timing) });
      return res.end(r.png);
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
      return res.end('render error: ' + e.message);
    }
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('no such api');
}

export function createRequestHandler() {
  return async (req, res) => {
    res.on('error', () => {});
    try {
      const u = new URL(req.url || '/', 'http://localhost');
      const urlPath = u.pathname;

      // Dashboard APIs
      if (urlPath.startsWith('/api/')) return await handleApi(req, res, urlPath, u.searchParams);

      // Spike assets (generated PNGs, result markdown) live in this dir.
      if (urlPath.startsWith('/spike/')) {
        const p = safeJoin(HERE, urlPath.slice('/spike'.length));
        return p ? serveFile(res, p) : res.end('bad path');
      }

      // Spike HTML pages (dashboard.html, harness.html, …) live in this dir, same-origin as CC.
      if (urlPath.endsWith('.html')) {
        const p = join(HERE, basename(urlPath));
        if (existsSync(p)) return serveFile(res, p);
      }

      // Same-origin art (required: cross-origin art taints the canvas -> toDataURL throws).
      // Art lives flat in collection/art, so resolve by basename regardless of how CC
      // prefixes the URL (it may resolve /local_art relative to /creator/).
      if (urlPath.startsWith('/local_art/') || urlPath.endsWith('/local_art')) {
        const name = urlPath.split('/').filter(Boolean).pop();
        const p = name ? safeJoin(ART_ROOT, name) : null;
        return p ? serveFile(res, p) : res.end('bad path');
      }

      // Root -> CardConjurer index.html (which htmx-loads the creator).
      if (urlPath === '/') return serveFile(res, join(CC_ROOT, 'index.html'));

      // Everything else -> the CardConjurer clone.
      const p = safeJoin(CC_ROOT, urlPath);
      if (!p) return res.end('bad path');
      return serveFile(res, p);
    } catch (e) {
      console.log('[serve] handler error', e.message);
      try { res.end(); } catch (_) {}
    }
  };
}

export function startServer(port = 4199) {
  return new Promise((res) => {
    const server = http.createServer(createRequestHandler());
    server.listen(port, '127.0.0.1', () => {
      console.log(`[serve] spike server on http://127.0.0.1:${port}  (CC_ROOT=${CC_ROOT})`);
      res(server);
    });
  });
}

// Allow running standalone: `node serve.mjs` then open http://127.0.0.1:4199/harness.html
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  startServer(Number(process.env.PORT) || 4199);
}
