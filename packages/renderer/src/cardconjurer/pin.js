// CardConjurer pinned commit — see docs/v2-architecture.md §4 ("CardConjurer update workflow").
//
// Bumping this SHA is the entry point to a CC upgrade: after changing it, run
//   pnpm renderer:setup            # reclones CC at the new SHA into external/cardconjurer/
//   pnpm generate-goldens          # regenerate every renderer's goldens
//   cd collection && git diff -- goldens/    # visually review pixel changes
// Commit code + PNG changes together in a linked PR (blesses intended changes; fails on regressions).
//
// Phase 1a: `null` means "use whatever is currently in packages/renderer/external/cardconjurer/",
// which today is bootstrapped by the v1 script `server/card-conjurer.sh` (unpinned `git pull`).
// The pin lands with the setup.sh rewrite; see scripts/setup.sh.
//
// This file's contents feed the CC bridge's cache-invalidation token (see ./version.js and
// ../cache.js's `withCache`): bumping CARDCONJURER_PIN changes that hash, which changes every
// downstream cache key, so a CC upgrade automatically invalidates every previously-cached
// render — no manual cache-clearing step needed alongside the `pnpm renderer:setup` /
// `pnpm generate-goldens` workflow above.

export const CARDCONJURER_PIN = null;
