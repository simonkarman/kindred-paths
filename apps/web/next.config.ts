import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// Computed here (not lazily inside application code) because it must be set BEFORE
// `@kindred-paths/renderer` is ever imported: that package computes its OWN repo-root-
// relative fallback paths (packages/renderer/src/cardconjurer/hosts/node-handle.js,
// set-metadata.js) as module-top-level `const`s, evaluated at first `import`, not at first
// function call — so setting these from inside a route handler or even inside
// apps/web/src/core/config.ts would already be too late for that package's own fallback
// logic. next.config.ts is evaluated by the `next` CLI itself before any application/route
// code loads, in a plain (non-webpack-bundled) Node context, so `import.meta.url` here is
// always the real file location — reliable regardless of how webpack's `resolve.symlinks`
// setting below (needed for a different reason) affects OTHER modules' apparent paths.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
process.env.KP_COLLECTION_PATH ??= join(REPO_ROOT, 'collection');
process.env.KP_CACHE_DIR ??= join(REPO_ROOT, '.cache');
// KP_CARDCONJURER_PATH (Phase 1d): the v2 pinned clone lives at
// packages/renderer/external/cardconjurer/, created by `pnpm setup:cardconjurer`.
// If you get a "CardConjurer not found" error at render time, run that command first.
// Explicit env var wins.
process.env.KP_CARDCONJURER_PATH ??= join(REPO_ROOT, 'packages/renderer/external/cardconjurer');
// The render pipeline (core/render/render-card-face.ts) offloads its heavy SVG rasterization
// (sharp) and PNG encode (@napi-rs/canvas) work onto libuv's threadpool, whose default size
// is only 4 OS threads — raising the render concurrency semaphore (KP_RENDER_CONCURRENCY)
// without also raising this would just queue more work behind the same 4 threads, not add
// real parallelism. Must be set before any native module (sharp/@napi-rs/canvas) is first
// imported, same as the KP_* paths above.
process.env.UV_THREADPOOLSIZE ??= '8';

// Static export mode (Phase 1d): set by scripts/export-static.mjs. See
// docs/v2-phase1d-static-export.md. When true we layer `output: 'export'` +
// friends and inject NEXT_PUBLIC_KP_STATIC / NEXT_PUBLIC_KP_BASE_PATH so the
// DynamicOnly gate and assetPath helper see them at build time.
const IS_STATIC_EXPORT = process.env.NEXT_PUBLIC_KP_STATIC === 'true';
// KP_BASE_PATH is the sub-path for hosting under (e.g. `/my-repo` for GitHub
// Pages). Empty = domain root. Only meaningful in static-export mode.
const RAW_BASE_PATH = (process.env.KP_BASE_PATH ?? '').replace(/\/+$/, '');
const BASE_PATH = RAW_BASE_PATH
  ? (RAW_BASE_PATH.startsWith('/') ? RAW_BASE_PATH : `/${RAW_BASE_PATH}`)
  : '';

const nextConfig: NextConfig = {
  // The renderer pipeline (CardConjurer-in-Node) pulls in native node addons
  // (@napi-rs/canvas) and sharp — these must run as real node modules, not get
  // bundled by webpack.
  serverExternalPackages: ['@napi-rs/canvas', '@napi-rs/canvas-darwin-arm64', 'sharp', '@kindred-paths/renderer'],
  // @kindred-paths/shared is a CJS workspace package (built to dist/, "type": "commonjs").
  // Without this, importing it from a Client Component fails under webpack's Fast Refresh
  // transform with a "Cannot use 'import.meta' outside a module" parse error — Next only
  // applies its own module transforms (CJS interop, HMR wrapping) to packages explicitly
  // listed here; this is the standard, documented fix for a workspace CJS package consumed
  // by client code (see https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages).
  transpilePackages: ['@kindred-paths/shared'],
  webpack: (config) => {
    // transpilePackages (and serverExternalPackages) match against the RESOLVED path via a
    // regex requiring a literal `node_modules` segment. pnpm workspace packages are
    // *symlinked* into node_modules (apps/web/node_modules/@kindred-paths/shared ->
    // ../../../packages/shared); webpack's default `resolve.symlinks: true` follows that
    // link to the real path (packages/shared/dist/index.js), which has NO `node_modules`
    // segment at all — so transpilePackages' matching regex silently never matches, and the
    // untranspiled CJS `dist/index.js` (with its `import.meta.webpackHot` marker for
    // require-hoisting) gets bundled as-is, breaking client components that import it.
    // Disabling symlink resolution keeps the apparent path as the node_modules symlink
    // location, matching transpilePackages' regex correctly.
    config.resolve.symlinks = false;
    return config;
  },

  // Static-export-only overlays (Phase 1d).
  ...(IS_STATIC_EXPORT ? {
    output: 'export' as const,
    // Under `output: 'export'` Next won't run its Image Optimization loader (needs a
    // server). Disabling explicitly keeps future next/image uses from silently breaking.
    images: { unoptimized: true },
    // Every URL ends in `/` so a static host serving `card/<cid>/index.html` responds to
    // both `/card/<cid>` and `/card/<cid>/`. GitHub Pages needs this.
    trailingSlash: true,
    // Sub-path deployment (e.g. https://user.github.io/<repo>/).
    ...(BASE_PATH ? { basePath: BASE_PATH, assetPrefix: BASE_PATH } : {}),
    // Client-visible env vars for <DynamicOnly> and assetPath().
    env: {
      NEXT_PUBLIC_KP_STATIC: 'true',
      NEXT_PUBLIC_KP_BASE_PATH: BASE_PATH,
    },
  } : {}),
};

export default nextConfig;
