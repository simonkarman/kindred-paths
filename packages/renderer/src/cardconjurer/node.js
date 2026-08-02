// @kindred-paths/renderer/cardconjurer/node — the Node-hosted CardConjurer renderer.
//
// Composes:
//   - hosts/node-handle.js  — boots a warm CC sandbox on @napi-rs/canvas + a DOM shim
//   - driver.js             — host-agnostic build sequence (mana/title/type/rules/PT/etc.)
//   - renderable.js         — Card → Renderable mapping
//
// The Renderer interface (see ../interface.js) is a stable factory + render(input, options).
// Boot is lazy on first render; subsequent renders reuse the same sandbox — ~1s cold, sub-
// second warm (Phase 0.8 measurements).

import { createNodeHandle } from './hosts/node-handle.js';
import { driveRender } from './driver.js';
import { cardToRenderable } from './renderable.js';

/**
 * Factory for the CardConjurer Node renderer. Returns an object matching the Renderer
 * interface. Boots CC-in-Node lazily on first render.
 *
 * @returns {Promise<import('../interface.js').Renderer>}
 */
export async function createCardconjurerNodeRenderer() {
  let boot = null;  // Promise<CCHandle> — created on first render, reused thereafter

  async function render(input, _options = {}) {
    if (!boot) boot = createNodeHandle();
    const h = await boot;

    // Accept either a v1 Card JSON (from the golden harness — has .faces) or an already-
    // built Renderable (has .typeLine at the top level). The harness passes cards; future
    // callers (apps/web /api/render in Phase 1c) will build Renderable up front.
    const renderable = input && input.faces
      ? cardToRenderable(input, input.__faceIndex || 0)
      : input;

    const t0 = performance.now();
    let buildMs = 0;
    let compositeMs = 0;

    await h.buildAndComposite(async () => {
      const b0 = performance.now();
      await driveRender(renderable, h);
      buildMs = performance.now() - b0;
    });
    compositeMs = performance.now() - t0 - buildMs;

    const e0 = performance.now();
    const png = h.sandbox.cardCanvas.toBuffer('image/png');
    const encodeMs = performance.now() - e0;

    return {
      png,
      width: h.sandbox.cardCanvas.width,
      height: h.sandbox.cardCanvas.height,
      timings: {
        buildMs: +buildMs.toFixed(1),
        compositeMs: +compositeMs.toFixed(1),
        encodeMs: +encodeMs.toFixed(1),
        totalMs: +(performance.now() - t0).toFixed(1),
      },
    };
  }

  return { name: 'cardconjurer', render };
}
