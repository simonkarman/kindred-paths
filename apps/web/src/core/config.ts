// Pure node config helpers — no next/* imports (see docs/v2-architecture.md §10).
//
// Env vars, per the v2 architecture doc (§10):
//   KP_COLLECTION_PATH     default ./collection (repo root)
//   KP_CACHE_DIR            default ./.cache (repo root)
//   KP_CARDCONJURER_PATH   default server/.cardconjurer (repo root) — the pinned CC clone
//
// `apps/web/next.config.ts` sets all three on `process.env` unconditionally (computed from
// its own reliable file location) BEFORE any application code — including
// `@kindred-paths/renderer`, which reads these same env vars for its own fallback path
// computation — ever imports/runs. See that file's comment for why the timing matters. The
// getters below just re-resolve the (by then always-set) env vars to absolute paths for our
// own use; they're not the primary mechanism that makes the renderer package pick up the
// right paths.

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// apps/web/src/core/config.ts -> repo root is 4 levels up
const REPO_ROOT = resolve(HERE, '../../../..');

export function getCollectionPath(): string {
  return process.env.KP_COLLECTION_PATH
    ? resolve(process.env.KP_COLLECTION_PATH)
    : join(REPO_ROOT, 'collection');
}

export function getCardsDir(): string {
  return join(getCollectionPath(), 'cards');
}

export function getCacheDir(): string {
  return process.env.KP_CACHE_DIR
    ? resolve(process.env.KP_CACHE_DIR)
    : join(REPO_ROOT, '.cache');
}
