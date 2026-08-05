// @kindred-paths/shared — isomorphic domain (browser + node safe; no fs, no fetch).
//
// Wave 1a of Phase 1b ported the minimum set of modules needed by the renderer's
// Card → Renderable mapping. Wave 1c (apps/web overview page) added the search DSL
// (filter-query-handler, filter-definitions, card-filterer), ported verbatim from v1
// `shared/`. Everything else in v1 shared (strategy, bucket, blueprint criteria, set
// matrix, statistics, etc.) is deliberately NOT ported yet:
//   - strategy/bucket/color-weights are removed entirely in Phase 5 (§3 Keep/Replace/Trim).
//   - blueprint criteria + set matrix change shape in Phase 6 (§9 set page rework).
//   - statistics waits until a consumer needs it.
//
// Adding a module here is a deliberate act — port it from v1 verbatim, then let the
// exports below re-export it. Do NOT rewrite; the v1 semantics are the contract during
// migration (§10 strangler cutover).
export * from './card';
export * from './card-face';
export * from './card-filterer';
export * from './card-id';
export * from './colors';
export * from './filter-definitions';
export * from './filter-query-handler';
export * from './hash';
export * from './layout';
export * from './mechanics';
export * from './serialized-card';
export * from './serialized-card-face';
export * from './token-extracter';
export * from './typography';
