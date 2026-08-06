// Card-face rendering, composed for the /api/render route — pure node module (no next/*).
//
// Serves two variants:
//   - 'png'   the full 2010×2814 canonical render (content-hash cached via withCache).
//   - 'thumb' the 488×684 WebP thumbnail withCache writes alongside every PNG — this is
//     what the overview grid uses, so 900+ cards load small images instead of full-size
//     ones. On a cache hit we skip the render pipeline entirely and stream the thumb file
//     straight off disk.
//
// Concurrency: a small semaphore bounds how many renders run at once. This is NOT needed
// for correctness anymore (the CardConjurer-in-Node symbol-decode race is fixed — see
// packages/renderer/src/cardconjurer/hosts/node-handle.js), only as a latency/memory
// safeguard: each cache-miss render boots a fresh CardConjurer sandbox (~1.3s, tens of MB),
// and a cold overview grid can trigger a burst of many simultaneous misses. The limit is
// configurable via KP_RENDER_CONCURRENCY (default 8) so it can be tuned to the deployment
// machine's core count — see next.config.ts, which sizes UV_THREADPOOLSIZE to match (the
// heavy SVG/PNG encode work inside a render is largely libuv-threadpool-bound, so raising
// this without also raising UV_THREADPOOLSIZE would not add real parallelism).

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { renderCachePaths } from '@kindred-paths/renderer/cache';
import { getCardByCid } from '../collection/cards';
import { getCacheDir } from '../config';
import { getRenderer } from './renderer';
import { createSemaphore } from './semaphore';

const RENDER_CONCURRENCY = Number(process.env.KP_RENDER_CONCURRENCY) || 8;
const renderSemaphore = createSemaphore(RENDER_CONCURRENCY);

export type RenderVariant = 'png' | 'thumb';

export type RenderCardFaceResult =
  | { status: 'card-not-found' }
  | { status: 'face-not-found' }
  | { status: 'ok'; buffer: Buffer; contentType: string };

export async function renderCardFace(
  cid: string,
  faceIndex: number,
  { variant = 'png', skipCache = false }: { variant?: RenderVariant; skipCache?: boolean } = {},
): Promise<RenderCardFaceResult> {
  const card = await getCardByCid(cid);
  if (!card) return { status: 'card-not-found' };
  if (!card.faces[faceIndex]) return { status: 'face-not-found' };

  const renderer = await getRenderer();
  const input = { ...card, __faceIndex: faceIndex };
  // withCache() always resolves `version` (it throws at construction time otherwise — see
  // packages/renderer/src/cache.js) — the JSDoc-inferred type just reflects the general
  // Renderer interface, where `version` is optional.
  const rendererVersion = renderer.version as string;
  const cachePaths = () => renderCachePaths({
    cacheDir: getCacheDir(),
    rendererName: renderer.name,
    rendererVersion,
    input,
    options: {},
  });

  // Thumbnail fast path: withCache always writes the PNG + thumbnail together, so an
  // existing thumb file on disk means this exact render already happened — skip the
  // render pipeline (and the semaphore) entirely and stream the small file straight back.
  if (variant === 'thumb' && !skipCache) {
    const { thumbPath } = cachePaths();
    if (existsSync(thumbPath)) {
      return { status: 'ok', buffer: await readFile(thumbPath), contentType: 'image/webp' };
    }
  }

  const result = await renderSemaphore.run(() => renderer.render(input, { skipCache }));

  if (variant === 'thumb') {
    // withCache just wrote (or, for a `skipCache` forced re-render, may NOT have written —
    // skipCache bypasses both read and write) the thumbnail. Read whichever bytes exist;
    // skipCache callers get png-derived freshness for the full image, but thumbs are a
    // grid-display concern only, so falling back to the just-rendered PNG path is unneeded
    // complexity here — skipCache + thumb is not a combination the UI uses today.
    const { thumbPath } = cachePaths();
    if (existsSync(thumbPath)) {
      return { status: 'ok', buffer: await readFile(thumbPath), contentType: 'image/webp' };
    }
  }

  return { status: 'ok', buffer: result.png, contentType: 'image/png' };
}
