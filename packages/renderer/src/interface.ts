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
// produce v2 PNGs from v1 card JSON. See packages/renderer/src/cardconjurer/node.ts for the
// current input shape.
//
// `options.skipCache: true` is a hard requirement: `generate-goldens` and `test:golden` MUST
// bypass the on-disk render cache, otherwise a code change in the renderer would silently
// return the previously-cached PNG and pass every diff. See docs §11 Phase 1a. The bare
// factories in the registry (src/index.ts) never cache — caching is an opt-in decorator
// (`withCache`, see ./cache.ts) that a consumer (e.g. apps/web's render API) wraps around a
// renderer. The golden harness always uses the bare factory, so `skipCache` is a no-op there
// by construction; `withCache` is what gives the flag real bypass-read-and-write semantics.

/** Per-phase timings, extensible per-renderer / per-decorator. */
export type RenderTimings = {
  cacheHit?: boolean;
  readMs?: number;
  writeMs?: number;
  buildMs?: number;
  compositeAndEncodeMs?: number;
  totalMs?: number;
  [key: string]: number | boolean | undefined;
};

export type RenderResult = {
  /** PNG bytes. */
  png: Buffer;
  width?: number;
  height?: number;
  /** Per-phase timings if the renderer exposes them. */
  timings?: RenderTimings;
};

export type RenderOptions = {
  /** Force fresh render; harness always sets true. */
  skipCache?: boolean;
  /** Additional per-renderer options are permitted; they participate in cache-key derivation. */
  [key: string]: unknown;
};

/**
 * The Render input is intentionally `unknown` at the interface layer: different renderers
 * accept different shapes (the CardConjurer node renderer accepts either a v1 Card JSON or a
 * built Renderable). Renderer implementations narrow it at their boundary.
 */
export type RenderInput = unknown;

export type Renderer = {
  /** Filesystem-safe: `[a-z0-9-]+`. */
  name: string;
  /**
   * Renderer-declared invalidation token. Decorators (e.g. `withCache` in ./cache.ts) fold
   * this into their cache keys so that a change to the renderer's own code (driver logic, CC
   * pin bump, etc.) automatically invalidates every previously-cached render on next access —
   * no manual cache-clearing step required. Recommended shape: an 8-char sha1 of the
   * renderer's own source files (see ./cardconjurer/version.ts for the CC bridge's
   * implementation). Optional: renderers that never sit behind a cache (or the harness,
   * which always passes `skipCache: true`) can omit it.
   */
  version?: string;
  render(renderable: RenderInput, options?: RenderOptions): Promise<RenderResult>;
};
