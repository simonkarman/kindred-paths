# Phase 1d — Static Read-Only Export

Status: **In progress** on branch `v2-phase1d-static-export` (off `v2`).

This document is the executable plan for Phase 1d. It slots into
`docs/v2-architecture.md` §11 between Phase 1c (overview page) and Phase 2 (compact
live editor). Once complete, its normative content is folded into a new §13 of the
main architecture document and this file becomes a historical execution log.

---

## 1. Goal

Produce, on demand, a fully static HTML/CSS/JS/PNG site — deployable to GitHub Pages
from any collection repo — that mirrors the current v2 read-only app for a
filterable subset of cards. Establish now the code conventions that will keep the
export working as editor/AI features land in later phases.

## 2. Motivation

- The v2 app is already a great read-only viewer; publishing it as a static
  reference for a finished set (e.g. the SHX "cube") is a natural next step.
- Doing this **before** the editor/AI phases means every subsequent feature is
  written against a design contract that keeps the static build viable. Retrofitting
  the contract after Phase 4 would be significantly more invasive.
- A running GitHub Pages deploy is a permanent smoke test: any change that breaks
  the static build is caught immediately.

## 3. Non-goals

- No dynamic hosting (no auth, no `CollectionSource`/`RenderCache` interfaces).
  Those remain deferred per §10 of the main architecture doc.
- No new UI features (no rulings, no set overview pages, no glossary). Just the
  current read-only surface, published statically.
- No changes to the domain model, renderer, or search DSL.

---

## 4. Design contract (the "not-a-mess" rules)

Three rules that all future features must respect:

1. **One capability flag.** `NEXT_PUBLIC_KP_STATIC=true` at build time in the static
   export build; unset in the dynamic build. Everything keys off this one flag.
2. **UI split via `<DynamicOnly>`.** Any interactive feature (editor panel, AI
   chat, save buttons, image regenerate, etc.) is wrapped in a `<DynamicOnly>`
   server component that returns `null` when the flag is set. Result: dead-code-
   eliminated from the static bundle.
3. **Data via server components, not client fetches.** Client components never
   call `/api/*` in static mode. Instead, server components read data at build
   time and pass it as props. Images (which can't be inlined) are the sole
   exception and are dispatched through a small `assetPath()` helper.

Consequence: as new features land, the pattern is always the same — wrap new UI
in `<DynamicOnly>`, put new APIs in `app/api/**` (which Next static export
naturally excludes). No feature is at risk of breaking the export.

---

## 5. Architecture

### 5.1 One Next.js configuration, two modes

`next.config.ts` inspects `NEXT_PUBLIC_KP_STATIC` at load time. When true it layers
on `output: 'export'`, `images: { unoptimized: true }`, `trailingSlash: true`,
`basePath`/`assetPrefix` from `KP_BASE_PATH`, and injects the two `NEXT_PUBLIC_*`
env vars the client code keys off. When unset (the dynamic dev/build) the config
is behaviorally unchanged from Phase 1c. Next.js has no supported way to point
`next build` at an alternate config file, so gating via env is the cleanest
integration.

### 5.2 Data flow in static mode

- **Search page**: `page.tsx` becomes a server component that calls
  `getVisibleCards()`, applies `filterCardsBasedOnSearch(cards, exportQuery)`
  in static mode, and passes `initialCards` as a prop to the client
  `<CardGrid>`. In dynamic mode it passes the whole visible collection
  unfiltered. `<CardGrid>` drops its mount-time `fetch('/api/cards')` and just
  starts from the prop.
- **Card detail page**: unchanged (already a server component). Adds
  `generateStaticParams()` that (in static mode) returns cids for cards
  matching the export query.
- **Images**: `<CardImage>` dispatches on `NEXT_PUBLIC_KP_STATIC`:
  - Dynamic: `/api/render/<cid>/<face>?variant=…` (current)
  - Static: `assetPath('/renders/<cid>-<face>.<ext>')`

No `generated/data/*.json` file is written. No runtime data fetches. The card list
is embedded in the search page's HTML in both modes.

### 5.3 Generated directory layout

Everything the export produces lives under `apps/web/generated/`, which is
`.gitignore`d and wiped at the start of every export run.

```
apps/web/generated/
├── README.md              ← auto-written, explains "regenerate; do not commit"
├── renders/               ← PNG + thumb.webp per (cid, face)
│   ├── <cid>-<face>.png
│   └── <cid>-<face>.thumb.webp
└── site/                  ← final static output (moved from Next's `out/`)
    ├── index.html
    ├── search/index.html
    ├── card/<cid>/index.html
    ├── _next/…
    └── renders/           ← copied from ../renders at Next build time
```

Transient staging directories also `.gitignore`d: `apps/web/out/`,
`apps/web/public/renders/`.

### 5.4 Export command

```
pnpm --filter web export:static -- \
  [--query "<search DSL>"] \
  [--base-path /<subpath>] \
  [--out apps/web/generated/site]
```

Default query is empty = export the entire visible collection.
Default base-path is empty = site works when served from the root of a domain.

Steps performed by `apps/web/scripts/export-static.mjs`:

1. Parse CLI args.
2. Wipe `apps/web/generated/` entirely (fresh start every run).
3. Load visible cards, apply query filter, emit target cid list.
4. For each card × face, ensure a render + thumbnail exist in the shared
   `.cache/renders/` (uses existing renderer + cache machinery unchanged;
   respects the existing render concurrency semaphore). Copy the PNG and
   thumbnail into `apps/web/generated/renders/<cid>-<face>.{png,thumb.webp}`.
5. Copy `apps/web/generated/renders/` → `apps/web/public/renders/` (transient
   staging so Next's build picks them up as public assets).
6. Run `next build` with env vars `NEXT_PUBLIC_KP_STATIC=true`,
   `NEXT_PUBLIC_KP_BASE_PATH=<base>`, `KP_BASE_PATH=<base>`,
   `KP_STATIC_EXPORT_QUERY=<query>` — next.config.ts flips into static-export
   mode when it sees the flag.
7. Move `apps/web/out/` → `apps/web/generated/site/`.
8. Delete `apps/web/public/renders/` transient staging.
9. Write `apps/web/generated/README.md`.

---

## 6. Prerequisite: CardConjurer relocation

Today CC is cloned by v1's `server/card-conjurer.sh` into `server/.cardconjurer/`
(Docker-flavored). For CI without Docker, we complete the relocation the main
architecture doc §10 already commits to: `packages/renderer/external/cardconjurer/`,
pinned SHA, git-ignored, shallow-cloneable.

### 6.1 Pin

- `packages/renderer/src/cardconjurer/pin.ts` exports
  `CARDCONJURER_PIN = { sha: '25800ee3687aab91d20080253047c3067d002e4a', display: '25800ee3 (Update Duskmourn set symbols to remove whitespace)' }`.
- SHA matches the current `server/.cardconjurer` HEAD as of this branch.

### 6.2 Setup script

`packages/renderer/scripts/setup.mjs` (replaces the `.sh` placeholder). Node,
cross-platform, idempotent. Behavior:

- Target dir: `packages/renderer/external/cardconjurer/`.
- If dir exists and HEAD SHA == pinned SHA → no-op.
- If dir exists but different SHA → fetch pinned SHA shallowly (`git fetch --depth 1 origin <sha>`), `git checkout FETCH_HEAD`.
- If dir does not exist → `git init` + `git remote add origin https://github.com/joshbirnholz/cardconjurer.git` + `git fetch --depth 1 origin <sha>` + `git checkout FETCH_HEAD`. This is the shallow-clone-of-a-specific-commit dance that avoids downloading the entire multi-GB CC history.
- After checkout: ensure `local_art` symlink → `../../../../collection/art` and `img/setSymbols/official/custom` symlink → `../../../../../../collection/symbols` (mirroring v1's two Docker `-v` mounts). Skip if already present.
- Print pinned SHA + display string on completion.

Wired to root `package.json` as `pnpm setup:cardconjurer`.

### 6.3 Config update

`apps/web/next.config.ts`: `KP_CARDCONJURER_PATH` default becomes
`packages/renderer/external/cardconjurer`. The old v1 `server/.cardconjurer/` path
is no longer referenced anywhere in v2 code — this keeps v2 code free of v1
paths. On a machine that only has the v1 clone, running
`pnpm setup:cardconjurer` once produces the v2 clone (or the user can set
`KP_CARDCONJURER_PATH` explicitly to reuse an existing clone).

### 6.4 Root .gitignore

Add `packages/renderer/external/`.

---

## 7. Files touched / added

### New

| File | Purpose |
|---|---|
| `packages/renderer/src/cardconjurer/pin.ts` | Export `CARDCONJURER_PIN` |
| `packages/renderer/scripts/setup.mjs` | Shallow clone + pin + symlinks |
| `apps/web/scripts/export-static.mjs` | Export orchestrator |
| `apps/web/src/components/dynamic-only.tsx` | Server component gate for future interactive UI |
| `apps/web/src/lib/asset-path.ts` | `assetPath()` helper for image URLs |
| `docs/v2-phase1d-static-export.md` | This document |

### Edited

| File | Change |
|---|---|
| `apps/web/next.config.ts` | Update `KP_CARDCONJURER_PATH` default + add static-export overlays gated on `NEXT_PUBLIC_KP_STATIC` |
| `apps/web/src/components/card-image.tsx` | Dispatch image URL on `NEXT_PUBLIC_KP_STATIC` |
| `apps/web/src/app/(main)/search/page.tsx` | Server-component refactor; passes `initialCards` prop |
| `apps/web/src/app/(main)/search/card-grid.tsx` | Accept `initialCards` prop; drop mount-time fetch |
| `apps/web/src/app/(main)/card/[cid]/page.tsx` | Add `generateStaticParams()` (only active in static mode) |
| `apps/web/package.json` | Add `export:static` script |
| `apps/web/.gitignore` | Add `/generated/`, `/out/`, `/public/renders/` |
| `package.json` (root) | Add `setup:cardconjurer` script |
| `.gitignore` (root) | Add `packages/renderer/external/` |
| `docs/v2-architecture.md` | New §13, updated §10 Hosting row, new Phase 1d in §11, §4/§5 clarifications |

### Committed into `collection/` (separate repo)

| File | Purpose |
|---|---|
| `.github/workflows/publish.yml` | Manually-dispatched GitHub Pages workflow |

---

## 8. GitHub Action for collection repos

Committed into the collection repo working copy at `collection/.github/workflows/publish.yml`.

- Trigger: `workflow_dispatch` only (no auto-run on push), with inputs `query`
  (default empty) and `base_path` (default `/<repo-name>`).
- Steps:
  1. Checkout collection → `./collection`.
  2. Checkout `simonkarman/kindred-paths` at ref `v2` → `./kindred-paths`.
  3. Setup pnpm + Node 20 with lockfile cache.
  4. Restore GitHub Actions cache for CardConjurer clone, keyed on pinned SHA
     (extracted from `pin.ts` in a small script step).
  5. Restore GitHub Actions cache for render cache (`.cache/renders`), keyed on
     card JSON hash + art hash + kindred-paths git SHA; restore-keys for partial
     hits so an incremental change re-renders only affected cards.
  6. `pnpm install --frozen-lockfile` in kindred-paths.
  7. `pnpm setup:cardconjurer` (no-op on cache hit).
  8. `pnpm --filter web export:static -- --query "${{ inputs.query }}" --base-path "${{ inputs.base_path }}"`.
  9. Save caches, upload `kindred-paths/apps/web/generated/site` as Pages
     artifact, deploy.

### Rendering cost

For ~800 cards at ~2s each, uncached first run is ~27 minutes. Well under GitHub
Actions' 6-hour job timeout. Public repos have effectively unlimited minutes. The
render cache is content-hash keyed and safe to persist; steady-state runs
touching only a few cards are 1–5 minutes.

---

## 9. Acceptance criteria

1. `pnpm --filter web dev` behaves identically to today from the user's
   perspective (dynamic mode unchanged).
2. `pnpm setup:cardconjurer` on a clean machine (no Docker, no v1 server ever
   booted) produces a working CC clone at the pinned SHA.
3. The Node renderer produces byte-identical output to the golden set from that
   clean-machine clone (validated via existing `pnpm test:golden`).
4. `pnpm --filter web export:static` (no args) → fully working static site of
   the entire visible collection at `apps/web/generated/site/`.
5. `pnpm --filter web export:static -- --query "set:shx"` → filtered subset only.
6. `pnpm --filter web export:static -- --base-path /foo` → site correctly
   serves from `/foo/` sub-path.
7. `apps/web/generated/` wiped fresh at start of every run — no leftovers.
8. `npx serve apps/web/generated/site` serves a fully functional read-only site.
9. `collection/.github/workflows/publish.yml` manually dispatched deploys
   successfully to GitHub Pages.

---

## 10. Execution order

1. **Prerequisite:** `pin.ts` + `setup.mjs` + `next.config.ts` fallback + root
   `.gitignore`. Validate with a render against goldens.
2. **Static plumbing:** `<DynamicOnly>` + `assetPath` + `card-image.tsx`
   dispatch + `search/page.tsx` server refactor + `card-grid.tsx` prop refactor +
   `generateStaticParams` on card page. Verify dynamic app behavior unchanged.
3. **Export script (unfiltered):** `next.config.static.ts` + `export-static.mjs` +
   `package.json` script + `apps/web/.gitignore`. Verify local serve.
4. **Query support:** `--query` flag + `KP_STATIC_EXPORT_QUERY` env + server-
   component filter + `generateStaticParams` filter. Test with `set:shx`.
5. **Base-path support:** `--base-path` flag → Next `basePath`/`assetPrefix` +
   `NEXT_PUBLIC_KP_BASE_PATH`. Test with `/foo`.
6. **GitHub Action:** write `collection/.github/workflows/publish.yml`, commit
   into collection working copy, smoke-test one manual dispatch.
7. **Docs:** apply §13, §10 Hosting row, Phase 1d in §11, §4/§5 clarifications
   to `docs/v2-architecture.md`.
