// DynamicOnly — server component gate for UI that only makes sense in the dynamic
// (Node-hosted) build of the app, not in the static export.
//
// Wrap any interactive feature (editor panel, AI chat, save buttons, image regenerate,
// etc.) in <DynamicOnly> so it evaluates to `null` in the static-export build. This is
// a *server* component so `children` never even reach the client bundle in static mode —
// they're stripped at build time.
//
// Contract (see docs/v2-phase1d-static-export.md §4): every future feature that talks to
// /api/* or depends on server-side state MUST be wrapped in <DynamicOnly> (or be reached
// only from a route that itself is DynamicOnly). Anything else risks silently breaking
// the static export.
//
// The `NEXT_PUBLIC_KP_STATIC` env var is set to 'true' by next.config.static.ts. In the
// dynamic build it's unset, and children render as normal.

import type { ReactNode } from 'react';

export function DynamicOnly({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_KP_STATIC === 'true') return null;
  return <>{children}</>;
}

/** True in the static-export build, false in the dynamic build. */
export const IS_STATIC_EXPORT = process.env.NEXT_PUBLIC_KP_STATIC === 'true';
