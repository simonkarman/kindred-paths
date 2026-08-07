// assetPath — prefix a runtime asset URL with the configured base path (if any).
//
// Static export builds published under a GitHub Pages sub-path (e.g. https://user.github.io/<repo>/)
// need every non-Next-managed asset URL prefixed with `/<repo>`. Next handles this automatically
// for its own asset pipeline (via `basePath`/`assetPrefix` in next.config.static.ts), but any
// direct URLs we hand-craft in components — including the `/renders/<cid>-<face>.<ext>` paths
// used by <CardImage> in static mode — must be prefixed by us.
//
// `NEXT_PUBLIC_KP_BASE_PATH` is injected at build time by next.config.static.ts. In the
// dynamic build it's unset, so this helper is a no-op.
//
// Isomorphic — safe to import from server and client components alike.

const BASE_PATH = process.env.NEXT_PUBLIC_KP_BASE_PATH ?? '';

export function assetPath(path: string): string {
  if (!BASE_PATH) return path;
  if (!path.startsWith('/')) return `${BASE_PATH}/${path}`;
  return `${BASE_PATH}${path}`;
}

/** True in the static-export build, false in the dynamic build. Duplicated from dynamic-only.tsx to keep this file dependency-free. */
export const IS_STATIC_EXPORT = process.env.NEXT_PUBLIC_KP_STATIC === 'true';
