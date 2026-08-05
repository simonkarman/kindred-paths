// Content-hash render cache — a decorator that wraps any Renderer (see ./interface.js) with
// an on-disk PNG + thumbnail cache. See docs/v2-architecture.md §5 ("Render API": content-hash
// cache lookup → render on miss → persist PNG + thumbnail) and §11 Phase 1b.
//
// Deliberately *not* inside any specific renderer (e.g. cardconjurer/node.js): caching is a
// cross-cutting concern that should work identically for every renderer the registry ever
// gains (CC-in-Node today, a future warm-browser accelerator, etc.), and the golden harness
// (scripts/generate-goldens.mjs, scripts/test-goldens.mjs) must be able to use a renderer with
// *no* cache in front of it at all — which it does, by simply never calling `withCache`.
//
// Cache key: sha256 of { rendererName, rendererVersion, input, options } (skipCache excluded —
// it controls cache *behavior*, not cache *identity*, so toggling it must not change the key).
// `rendererVersion` is the renderer's own declared invalidation token (`Renderer.version`, see
// ./interface.js) — when a renderer's code changes, its version changes, so every existing
// cache entry naturally becomes a miss on next access. No manual cache-clearing step, and no
// stale hits after a renderer change. (Old files under the previous version's hash *do* stick
// around on disk — pruning them is a follow-up, e.g. a `kp cache prune` command.)
//
// `options.skipCache: true` is a full bypass: no read, no write. This is what the golden
// harness relies on conceptually (though in practice the harness never wraps a renderer in
// `withCache` at all — it always uses the bare registry factory). Any other consumer that does
// wrap a renderer (e.g. apps/web's render API, Phase 1c) gets the same bypass semantics for
// free, which matters for the "I changed the renderer, let me eyeball a re-render without
// caching this throwaway attempt" workflow.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/** @type {{ width: number, height: number, quality: number }} */
const DEFAULT_THUMBNAIL = { width: 488, height: 684, quality: 80 };

/** Deterministic JSON stringify — sorts object keys recursively so key order never affects the hash. */
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Computes the cache key for a given render request. Exported for tests / debugging; not part
 * of the public withCache surface consumers are expected to call directly.
 * @param {{ rendererName: string, rendererVersion: string, input: any, options: object }} args
 * @returns {string} hex sha256
 */
export function computeCacheKey({ rendererName, rendererVersion, input, options }) {
  // Exclude skipCache: it's a behavior switch, not part of render identity.
  const { skipCache, ...rest } = options ?? {};
  const payload = stableStringify({ rendererName, rendererVersion, input, options: rest });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Wraps a Renderer with a content-hash on-disk cache. Returns a new Renderer with the same
 * `name`; `render()` looks up `<cacheDir>/renders/<hash>.png` before delegating to `inner`, and
 * persists the PNG + a downscaled WebP thumbnail after a miss.
 *
 * @param {import('./interface.js').Renderer} inner
 * @param {Object} opts
 * @param {string} opts.cacheDir                 root cache dir (renders live under `<cacheDir>/renders/`)
 * @param {string} [opts.version]                overrides `inner.version` as the invalidation token.
 *   Required if `inner.version` is not set — throws otherwise, since an unversioned cache can
 *   never distinguish "renderer changed" from "renderer unchanged", which is the whole point.
 * @param {{ width?: number, height?: number, quality?: number }} [opts.thumbnail]
 *   thumbnail dimensions + WebP quality. Defaults to 488×684 @ q80 (matches v1's overview scale).
 * @returns {import('./interface.js').Renderer}
 */
/**
 * Computes the on-disk paths for a given render request's cache entry, without touching the
 * filesystem. Exported so consumers that need to serve a cached variant directly (e.g.
 * apps/web's render API serving `.thumb.webp` for the overview grid, Phase 1c) can check
 * existence / read the file themselves, using the exact same key derivation `withCache` uses
 * internally — avoiding a second, potentially-drifting definition of "where does this render
 * live on disk".
 *
 * @param {{ cacheDir: string, rendererName: string, rendererVersion: string, input: any, options?: object }} args
 * @returns {{ key: string, pngPath: string, thumbPath: string }}
 */
export function renderCachePaths({ cacheDir, rendererName, rendererVersion, input, options = {} }) {
  const rendersDir = join(cacheDir, 'renders');
  const key = computeCacheKey({ rendererName, rendererVersion, input, options });
  return {
    key,
    pngPath: join(rendersDir, `${key}.png`),
    thumbPath: join(rendersDir, `${key}.thumb.webp`),
  };
}

/**
 * Wraps a Renderer with a content-hash on-disk cache. Returns a new Renderer with the same
 * `name`; `render()` looks up `<cacheDir>/renders/<hash>.png` before delegating to `inner`, and
 * persists the PNG + a downscaled WebP thumbnail after a miss.
 *
 * @param {import('./interface.js').Renderer} inner
 * @param {Object} opts
 * @param {string} opts.cacheDir                 root cache dir (renders live under `<cacheDir>/renders/`)
 * @param {string} [opts.version]                overrides `inner.version` as the invalidation token.
 *   Required if `inner.version` is not set — throws otherwise, since an unversioned cache can
 *   never distinguish "renderer changed" from "renderer unchanged", which is the whole point.
 * @param {{ width?: number, height?: number, quality?: number }} [opts.thumbnail]
 *   thumbnail dimensions + WebP quality. Defaults to 488×684 @ q80 (matches v1's overview scale).
 * @returns {import('./interface.js').Renderer}
 */
export function withCache(inner, { cacheDir, version, thumbnail = DEFAULT_THUMBNAIL } = {}) {
  if (!cacheDir) throw new Error('withCache requires a cacheDir');
  const rendererVersion = version ?? inner.version;
  if (!rendererVersion) {
    throw new Error(
      `withCache requires a version: pass { version } explicitly, or the wrapped renderer ` +
      `must declare Renderer.version. Got renderer "${inner.name}" with no version on either side.`
    );
  }

  const rendersDir = join(cacheDir, 'renders');

  async function render(input, options = {}) {
    const { pngPath, thumbPath } = renderCachePaths({
      cacheDir, rendererName: inner.name, rendererVersion, input, options,
    });

    if (!options.skipCache && existsSync(pngPath)) {
      const t0 = performance.now();
      const png = await readFile(pngPath);
      return {
        png,
        timings: { cacheHit: true, readMs: +(performance.now() - t0).toFixed(1) },
      };
    }

    const result = await inner.render(input, options);

    if (!options.skipCache) {
      const t0 = performance.now();
      await mkdir(rendersDir, { recursive: true });
      await Promise.all([
        writeFile(pngPath, result.png),
        writeThumbnail(result.png, thumbPath, thumbnail),
      ]);
      const writeMs = +(performance.now() - t0).toFixed(1);
      return { ...result, timings: { ...result.timings, cacheHit: false, writeMs } };
    }

    return { ...result, timings: { ...result.timings, cacheHit: false } };
  }

  return { name: inner.name, version: rendererVersion, render };
}

/** Renders `pngBuffer` down to a WebP thumbnail at `path`, per `{ width, height, quality }`. */
async function writeThumbnail(pngBuffer, path, { width, height, quality }) {
  const thumb = await sharp(pngBuffer)
    .resize(width, height, { fit: 'cover' })
    .webp({ quality })
    .toBuffer();
  await writeFile(path, thumb);
}
