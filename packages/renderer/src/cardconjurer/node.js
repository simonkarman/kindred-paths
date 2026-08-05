// @kindred-paths/renderer/cardconjurer/node — the Node-hosted CardConjurer renderer.
//
// Composes:
//   - hosts/node-handle.js  — boots a fresh CC sandbox per render on @napi-rs/canvas + a DOM shim
//   - driver.js             — host-agnostic build sequence (mana/title/type/rules/PT/etc.)
//   - renderable.js         — Card → Renderable mapping
//
// The Renderer interface (see ../interface.js) is a stable factory + render(input, options).
//
// **Per-render isolation** (Wave 2.1): every render boots a fresh CC sandbox — matches v1's
// per-page Playwright model, so no state leaks between renders (no P/T on instants, no
// stale rules on lands, etc.). Costs ~330ms per boot on top of ~1s render time. See
// hosts/node-handle.js for the rationale and cost analysis. The warm path exists in the
// browser host (Phase 1b-int) where it's safe for text-only editor edits.

import { createNodeHandle } from './hosts/node-handle.js';
import { driveRender } from './driver.js';
import { cardToRenderable } from './renderable.js';
import { computeCardconjurerVersion } from './version.js';

/**
 * Factory for the CardConjurer Node renderer. Returns an object matching the Renderer
 * interface. The handle is constructed once (lazy on first render); each render boots its
 * own CC sandbox inside `buildAndComposite`.
 *
 * @returns {Promise<import('../interface.js').Renderer>}
 */
export async function createCardconjurerNodeRenderer() {
  let handle = null;  // Promise<CCHandle> — created on first render, reused thereafter
  const version = computeCardconjurerVersion();  // computed once; see ./version.js

  async function render(input, _options = {}) {
    if (!handle) handle = createNodeHandle();
    const h = await handle;

    // Accept either a v1 Card JSON (from the golden harness — has .faces) or an already-
    // built Renderable (has .typeLine at the top level). The harness passes cards; future
    // callers (apps/web /api/render in Phase 1c) will build Renderable up front.
    const renderable = input && input.faces
      ? cardToRenderable(input, input.__faceIndex || 0)
      : input;

    const t0 = performance.now();
    let buildMs = 0;

    // buildAndComposite boots a fresh sandbox, invokes the callback with the fresh CC
    // context, awaits image decodes, does one composite, returns the PNG buffer, and drops
    // the sandbox. Zero state leaks between calls.
    const png = await h.buildAndComposite(async (ctx) => {
      const b0 = performance.now();
      await driveRender(renderable, ctx);
      buildMs = performance.now() - b0;
    });

    // buildMs = driver work (text fields, autoFrame call, drawText, image decodes)
    // composite+encode is everything else inside buildAndComposite up to the returned PNG
    const totalMs = performance.now() - t0;
    const compositeAndEncodeMs = totalMs - buildMs;

    return {
      png,
      // Canvas dimensions are stable (2010×2814 for standard cards; see creator-23.js).
      // We could report them by holding a reference to the sandbox inside buildAndComposite,
      // but that's the sandbox lifecycle we're trying to keep private — hardcoding the
      // standard dimensions is fine for the render result (harness doesn't use these).
      width: 2010,
      height: 2814,
      timings: {
        buildMs: +buildMs.toFixed(1),
        compositeAndEncodeMs: +compositeAndEncodeMs.toFixed(1),
        totalMs: +totalMs.toFixed(1),
      },
    };
  }

  return { name: 'cardconjurer', version, render };
}
