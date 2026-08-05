// The Renderer interface — see docs/v2-architecture.md §4 ("The Renderer interface + registry").
//
// A renderer is anything that takes a `Renderable` (v1's term — the resolved, render-ready view
// of a Card at a given face index) plus render options and returns a PNG. The interface is
// deliberately narrow:
//
//   {
//     name: string,                 // filesystem-safe id: [a-z0-9-]+
//     render(renderable, options) → Promise<{ png: Buffer, meta?: {...timings} }>,
//   }
//
// Phase 1a only needs `render()` for the golden harness. The full Renderable contract (from
// v1's shared) lands with the port in Phase 1b. Until then, the cardconjurer node bridge
// accepts a minimal "spec" (mana/title/type/rules/pt/borderless) — enough for the harness to
// produce v2 PNGs from v1 card JSON. See packages/renderer/src/cardconjurer/node.js for the
// current input shape.
//
// `options.skipCache: true` is a hard requirement: `generate-goldens` and `test:golden` MUST
// bypass the on-disk render cache, otherwise a code change in the renderer would silently
// return the previously-cached PNG and pass every diff. See docs §11 Phase 1a. The bare
// factories in the registry (src/index.js) never cache — caching is an opt-in decorator
// (`withCache`, see ./cache.js) that a consumer (e.g. apps/web's render API) wraps around a
// renderer. The golden harness always uses the bare factory, so `skipCache` is a no-op there
// by construction; `withCache` is what gives the flag real bypass-read-and-write semantics.

/**
 * @typedef {Object} RenderResult
 * @property {Buffer} png    PNG bytes
 * @property {number} [width]
 * @property {number} [height]
 * @property {Object} [timings]  per-phase timings if the renderer exposes them
 */

/**
 * @typedef {Object} RenderOptions
 * @property {boolean} [skipCache]   force fresh render; harness always sets true
 */

/**
 * @typedef {Object} Renderer
 * @property {string} name                                          filesystem-safe: [a-z0-9-]+
 * @property {string} [version]      renderer-declared invalidation token. Decorators (e.g.
 *   `withCache` in ./cache.js) fold this into their cache keys so that a change to the
 *   renderer's own code (driver logic, CC pin bump, etc.) automatically invalidates every
 *   previously-cached render on next access — no manual cache-clearing step required.
 *   Recommended shape: an 8-char sha1 of the renderer's own source files (see
 *   ./cardconjurer/version.js for the CC bridge's implementation). Optional: renderers that
 *   never sit behind a cache (or the harness, which always passes `skipCache: true`) can omit it.
 * @property {(renderable: any, options?: RenderOptions) => Promise<RenderResult>} render
 */

export {};
