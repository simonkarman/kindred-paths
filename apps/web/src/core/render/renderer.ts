// Server render pipeline singleton — pure node module.
//
// Composes the CardConjurer-in-Node renderer with the withCache decorator exactly once
// per process (per docs/v2-architecture.md §5): the underlying renderer boots a Node
// canvas host lazily on first render() call, so we must reuse the same Renderer instance
// across requests rather than constructing a fresh one per request.
//
// @kindred-paths/renderer is plain JS, but JSDoc-typed — TypeScript picks up its
// `Renderer`/`RenderResult` shapes via inference (allowJs), so we lean on that instead
// of redeclaring types here.

import { createCardconjurerNodeRenderer } from '@kindred-paths/renderer/cardconjurer/node';
import { withCache } from '@kindred-paths/renderer/cache';
import { getCacheDir } from '../config';

export type Renderer = Awaited<ReturnType<typeof createCardconjurerNodeRenderer>>;

// Cached on globalThis (not just a module-level variable) so Next.js dev's fast-refresh
// module reloading doesn't accidentally spin up a second renderer instance.
const globalForRenderer = globalThis as unknown as { __kpRendererPromise?: Promise<Renderer> };

export function getRenderer(): Promise<Renderer> {
  if (!globalForRenderer.__kpRendererPromise) {
    globalForRenderer.__kpRendererPromise = createCardconjurerNodeRenderer().then((renderer) =>
      withCache(renderer, { cacheDir: getCacheDir() }));
  }
  return globalForRenderer.__kpRendererPromise;
}
