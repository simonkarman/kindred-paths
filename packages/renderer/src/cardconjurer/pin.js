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

export const CARDCONJURER_PIN = null;
