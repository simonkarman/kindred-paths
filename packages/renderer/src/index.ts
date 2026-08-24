// Central registry of renderer implementations.
//
// The golden test harness (scripts/generate-goldens.mjs, scripts/test-goldens.mjs) discovers
// renderers by iterating this map. Adding a future renderer:
//   1. Implement the Renderer interface (see ./interface.ts).
//   2. Add one line here: `<name>: factory`.
//   3. Run `pnpm generate-goldens` — a new `collection/goldens/renderers/<name>/` subtree
//      appears automatically. No harness changes needed.
//
// Each entry is a *factory* (async function returning a Renderer) so a renderer's expensive
// setup (booting CC-in-Node, warming a headless browser, etc.) happens lazily and only once
// per harness run, and only if the renderer is actually selected via --renderer.

import type { Renderer } from './interface.js';
import { createCardconjurerNodeRenderer } from './cardconjurer/node.js';

export { withCache, computeCacheKey, renderCachePaths } from './cache.js';
export type { Renderer, RenderResult, RenderOptions, RenderInput, RenderTimings } from './interface.js';

/**
 * Map of renderer name → async factory returning a Renderer.
 * Names are filesystem-safe ([a-z0-9-]+) and become the goldens subdirectory name.
 */
export const renderers: Record<string, () => Promise<Renderer>> = {
  cardconjurer: createCardconjurerNodeRenderer,
};
