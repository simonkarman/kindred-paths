// Zero-dependency static server for the Phase 0 renderer spike.
// Serves the CardConjurer clone + the harness page + collection art, all SAME-ORIGIN,
// which is what makes iframe-driving and cardCanvas.toDataURL() extraction possible.
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname, normalize } from 'node:path';
import { createReadStream, existsSync, statSync } from 'node:fs';

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

export function createRequestHandler() {
  return (req, res) => {
    res.on('error', () => {});
    try {
      const urlPath = (req.url || '/').split('?')[0];

      // The harness page (parent frame) lives at /harness.html, same-origin as CC.
      if (urlPath === '/harness.html') return serveFile(res, join(HERE, 'harness.html'));

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
