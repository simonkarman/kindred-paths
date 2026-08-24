// CardConjurer pinned commit — see docs/v2-architecture.md §4 ("CardConjurer update workflow").
//
// Bumping this SHA is the entry point to a CC upgrade: after changing it, run
//   pnpm setup:cardconjurer        # fetches CC at the new SHA into external/cardconjurer/
//   pnpm generate-goldens          # regenerate every renderer's goldens
//   cd collection && git diff -- goldens/    # visually review pixel changes
// Commit code + PNG changes together in a linked PR (blesses intended changes; fails on regressions).
//
// The pin's SHA was set at the start of Phase 1d (see docs/v2-phase1d-static-export.md).
// Bumping is a deliberate action, gated by the golden-image suite.
//
// This file's contents feed the CC bridge's cache-invalidation token (see ./version.ts and
// ../cache.ts's `withCache`): bumping CARDCONJURER_PIN changes that hash, which changes every
// downstream cache key, so a CC upgrade automatically invalidates every previously-cached
// render — no manual cache-clearing step needed alongside the `pnpm setup:cardconjurer` /
// `pnpm generate-goldens` workflow above.

export type CardconjurerPin = {
  sha: string;
  display: string;
  repo: string;
};

export const CARDCONJURER_PIN: CardconjurerPin = {
  sha: '25800ee3687aab91d20080253047c3067d002e4a',
  display: '25800ee3 (Update Duskmourn set symbols to remove whitespace)',
  repo: 'https://github.com/joshbirnholz/cardconjurer.git',
};
