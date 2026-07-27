# Kindred Paths v2 — Architecture & Refactor Plan

Status: **agreed, not yet implemented**. This document is the source of truth for the v2
refactor. It captures the decisions made during planning, the target architecture, and a
phased roadmap. Implementation starts with a Phase 0 spike that de-risks the renderer.

---

## 1. Motivation & goals

Kindred Paths has grown well over ~2 years. The domain core is strong; the pain is almost
entirely in the **presentation and rendering layers**, plus features that are no longer used.

### Primary pains
- **Rendering is slow and heavy.** Each render drives a Dockerized CardConjurer via
  Playwright: two full page loads, ~28 serialized `networkidle` waits, and ~5.15s of
  hardcoded `sleep()` calls per render (`server/src/card-conjurer.ts`). Result: 3–7s per
  edit, which makes the whole app feel sluggish. The file cache has grown to **~49 GB**
  (`server/.cache/renders`) with no eviction (hand-pruned into `old/`, `old2/`, `old3/`).
- **The web UI carries legacy.** Duplicated page pairs, a 1,034-line set editor, a
  650-line card editor with a fragile 165-line auto-adjust reducer, `alert()/prompt()`
  UX, latency papered over with hardcoded timeouts.
- **Two overlapping "which cards match" languages:** the search DSL and the blueprint
  criteria DSL.
- **Design docs feel out of place** — a loose notepad of markdown files wrapped in bespoke
  MCP tooling.
- **Unused features** add weight: strategy, statistics, table/text tabs, inspire-me,
  collection git UI, collector-number surfacing.

### Goals for v2
- **Near-instant rendering** and a live editing feel; inline rendering in AI surfaces.
- **AI on every relevant surface** — ask for a change and it happens; generate cards and
  cycles; bulk edits.
- **Wide, power-user UI** (no forced max container width); multi-editor; navigate while
  editing.
- **Simpler surface** — remove legacy features; one match language (search DSL).
- **Keep the good core** — the domain model and the on-disk JSON format are preserved.
- **Effects/overlays** on cards, cleanly separated from the base CardConjurer render.

### Non-goals (explicit)
- Not rewriting the domain model (`shared`).
- Not vendoring MTG frame assets/art into the repo — CardConjurer stays an external,
  downloadable renderer (legal cleanliness + upstream updates).
- Not rebuilding a general AI coding agent in-app (see the boundary principle).

---

## 2. Principles

1. **Keep the domain core.** `shared` (Card/CardFace/Layout, search DSL, mechanics, colors)
   is the crown jewel and is preserved/evolved, not rewritten.
2. **The on-disk JSON is the source of truth.** `collection/` (one JSON per card, `cid` in
   the filename, git-synced) stays exactly as-is. Multiple processes (web app, CLI, harness)
   read/write it.
3. **CardConjurer stays external.** We only change *how we talk to it* — never vendor its
   assets, always able to `git pull` upstream updates.
4. **One match language.** The search DSL is the single way to express "which cards match."
   The blueprint criteria DSL is removed.
5. **Whole-card exchange with AI.** AI always returns complete cards, never diffs/patches.
   The editor's safety net is **full-state snapshot undo/redo**, not patch objects.
6. **Boundary principle (what to build vs. not).** In-app AI owns only what is coupled to
   **live app state and rendering**, and **set-scoped** content: cards, the set, and set
   notes. Everything that is "just files / code / repo" belongs to the **external harness**
   (OpenCode / Claude Desktop / Claude Code), which does it natively and better. We do not
   rebuild the harness; switching between the app and the harness is the intended workflow.
7. **Browser-only rendering.** Rendering happens in the browser. There is no headless
   browser anywhere. PDF/print is produced in-browser.

---

## 3. Keep / Replace / Trim

| Keep (evolve) | Replace | Trim entirely |
|---|---|---|
| `shared` domain model (Card/CardFace/Layout) | Render pipeline (Docker+Playwright+CardConjurer server) → same-origin iframe + canvas read + overlay | Table tab, Text tab, Statistics tab |
| Search DSL (`filter-definitions`, `filter-query-handler`, `card-filterer`) | Card editor → compact, live, multi-instance, snapshot undo/redo, dockable AI panel | Strategy (client + server + MCP + shared aggregator/bucket/color-weights) |
| `collection/` JSON format | Set page blueprint DSL → search-query cells | Inspire-me page (→ in-app assistant / harness) |
| Card CRUD logic → moves into `core` | Image-gen UX → set-themed, model-switch, overlay-capable | Collection git UI (→ git CLI / harness) |
| CardConjurer (external clone) | Backend → Next.js server actions | Blueprint criteria DSL (`shared/src/set/criteria/**`, `blueprint-validator.ts`) |
| Mechanics, colors, sorter, art-prompt-creator, token-extracter, hash | MCP → `kp` CLI + OpenCode skill | Collector-number surfacing (editor + set overview) |
| | Design docs → integrated set notes (md linked to set) | MCP package (incl. design-doc + research tools); Docker; Playwright; `render-service`; `.cache` |

### Dependency caveats
- **Strategy removal touches four packages.** Remove: client `strategies-*.tsx` +
  `/api/strategy`; server `routes/strategies.ts`; MCP `tool/strategies.ts`,
  `tool/research.ts`, `service/strategy-service.ts`, `service/research-service.ts`; shared
  `serializable-strategies.ts`, `strategy-aggregator.ts`, `bucket-configs.ts`,
  `color-weights.ts` (aggregator-only). Prune `shared/src/index.ts` exports. Retire
  `collection/strategies/`.
- **`statistics.ts` is separate from strategy** and is also imported by the visual tab and
  the card generator. It is not deleted by removing the Statistics tab; untangle its
  consumers first (or drop with inspire-me + the trimmed visual-tab stats usage).
- **Removing the MCP package** must be paired with the CLI + skill being available, so the
  external harness keeps card access.

---

## 4. Renderer architecture (the crux)

### Why v1 is slow (structural, not tunable)
Per render, `server/src/card-conjurer.ts` creates a fresh browser context, navigates +
reloads (two full page loads), imperatively clicks through the CardConjurer UI, fills text
fields character-by-character on the last key, and waits via ~28 `networkidle` calls and
~5.15s of fixed `sleep()`s before scraping the result `<img>`. The `render-service.ts`
file/in-flight cache is what makes the app usable at all.

### v2: drive CardConjurer in the browser, read its canvas
CardConjurer is itself just JavaScript drawing to a `<canvas>`. v2 stops screenshotting it
through a headless browser and instead runs it **in the user's browser**:

1. **Serve the CardConjurer clone same-origin** with the web app (Next rewrite / static
   route, or a tiny static server). It stays an external `git clone` we `pull` to update —
   **never vendored, never committed** (already `.gitignore`d). This preserves legal
   cleanliness and upstream updatability.
2. **Map the two local mounts** CardConjurer expects (previously Docker read-only volumes)
   to same-origin routes:
   - `collection/art` → `/local_art/…`
   - `collection/symbols` → the custom set-symbol path
     (`/img/setSymbols/official/custom/…`).
3. **Load CardConjurer in a hidden iframe** and drive it from the parent frame by
   manipulating its `contentDocument`. Port the existing DOM-driving logic from
   `card-conjurer.ts` (Playwright) into an in-browser controller — same selectors and
   sequence, no network round-trips, no navigation/reloads, no fixed sleeps.
4. **Read the result directly off the `<canvas>`** via `toDataURL()` / `getImageData()`
   instead of clicking `#downloadAlt` and scraping an `<img>`.
5. **Overlay/effects layer.** Composite the extracted canvas onto our own canvas to add
   overlay effects, cleanly separated from CardConjurer.

### The key risk: draw-settle detection — PROVEN (Phase 0 spike, see `spike/renderer/`)
CardConjurer's internal redraw is asynchronous (it loads frame + art images). v1 brute-forces
this with sleeps. v2 detects "done" via **pixel-stability polling** of `cardCanvas`
(output unchanged for a short window) — version-robust, no internal hooks needed.

The Phase 0 spike **validated the whole approach end-to-end**: CardConjurer served as static
files same-origin (no Docker), creator initialized in an iframe in ~170–350ms, driven from the
parent frame, and a full correct card extracted via
`iframe.contentWindow.cardCanvas.toDataURL('image/png')` at 2010×2814. Same-origin art
composited **without tainting the canvas** (`toDataURL()` did not throw). Cold headless total
was ~3.2s including browser cold-start and a conservative 500ms stability window — production
(one warm reused iframe, tuned settle, text-only edits) will be far faster, targeting
sub-second interactive re-renders. Fallback if ever needed: a single warm Playwright page via
`page.evaluate`.

### Phase 0 findings (code-level, from `creator-23.js`)
Investigating CardConjurer's source confirms the mechanism at the code level:

- **Output canvas.** `cardCanvas` is the full-resolution render; `previewCanvas` is only the
  scaled on-screen copy. `drawCard()` (creator-23.js:3038) composites every layer
  (frame/planeswalker/text/bottom-info/…) onto `cardCanvas`.
- **Extraction is a one-liner.** `downloadCard()` (creator-23.js:3163) produces the PNG via
  `cardCanvas.toDataURL('image/png')` (line 3174). Served same-origin, the parent reads
  `iframe.contentWindow.cardCanvas.toDataURL('image/png')` directly — **no `#downloadAlt`,
  no new tab, no `<img>` scraping** (v1 `card-conjurer.ts:705–712` can be dropped).
- **Driving contract is already known.** All inputs are plain DOM: `#autoFrame`,
  `#selectFrameGroup`/`#selectFramePack`, `div.frame-option`, `#text-editor`, the
  `#creator-menu-*` panels — exactly the selectors in v1 `card-conjurer.ts`. Same-origin also
  exposes the globals (`card`, `drawCard`, `drawText`) if we want to call them directly.
- **Settle detection → pixel-stability polling (recommended).** The redraw loop is
  flag/`onload`-driven (`redrawFrames`/`drawTextBetweenFrames`, and an autoFrame 500ms
  debounce), which is version-fragile to hook. The robust, upstream-agnostic signal is to
  poll `cardCanvas.toDataURL()` and treat it as settled when the output is unchanged across a
  few animation frames (plus no images still loading).
- **Hard constraint: art must be same-origin (or CORS).** `toDataURL()` throws a
  `SecurityError` on a canvas tainted by a cross-origin image. Serving `collection/art`
  same-origin is therefore a **correctness requirement**, not just convenience.
- **Reset per render = reload the iframe.** CardConjurer expects a clean page: autoFrame stacks
  frames and does not fully reset when a new card is loaded. So each render (or at least each
  frame-affecting change) reloads the iframe to a clean creator (clearing `localStorage` first
  for deterministic settings). Proven by rendering two very different cards back-to-back with
  zero residue (a green creature then a clean red instant — no leftover frame or P/T box). v1
  did the same via a fresh Playwright page per render; we pay far less (no browser process, no
  navigation waits). Production hides the ~200–400ms reboot with an **iframe pool /
  double-buffer** and only reloads on frame-affecting changes (pure text edits apply live).

Conclusion: the in-browser approach is viable at the code level, and the Phase 0 spike proved
it end-to-end (load → drive → settle → non-blank PNG, with same-origin art and a clean reset
between cards).

### Performance model & the speed ceiling
The Phase 0 spike rendered in ~2.3–4s, which looks slow — but that time is dominated by
**removable** cost, not CardConjurer's intrinsic drawing:

- **CardConjurer debounces its own redraw by 500ms.** Every edit runs `textEdited()`
  (`creator-23.js:1226`) → `drawTextBuffer()` = `setTimeout(drawText, 500)` and
  `autoFrameBuffer()` = `setTimeout(autoFrame, 500)`. Any approach that drives CC through its
  normal inputs (Playwright **or** our iframe) inherits this 500ms-per-edit delay. This is the
  single biggest cost and the main reason v1 is slow.
- The rest of the spike's time is a per-render iframe reload, arbitrary `sleep()`s copied from
  v1's style, and a conservative 500ms pixel-stability settle window.

Because we own the page **same-origin**, the production model removes essentially all of it:
- **Warm, persistent instance** — boot CC once; no per-render reload for text edits.
- **Call `drawText()` / `drawCard()` directly** (they're globals on the same-origin window),
  bypassing the 500ms debounce entirely. Playwright cannot do this cheaply — it still
  round-trips.
- **Fonts load once at boot**, so the per-render font race disappears and the settle window
  shrinks to ~one frame after our own `drawText()` resolves.
- **On-screen preview can blit CC's canvas directly** (`drawImage` / `createImageBitmap`);
  PNG `toDataURL()` encoding is only needed for saves/exports.
- **Only frame-affecting changes reload**; pure text edits redraw in place.

What remains is CC's intrinsic `drawText()` + `drawCard()` cost — the same cost v1 pays but
never approaches under its overhead. **Phase 0.5 measured this** (`spike/renderer/perf-results.md`):
on a warm instance with direct draw calls, an interactive **text edit re-renders in ~1ms** (even
dense multi-ability cards), `drawCard` compositing is <0.1ms, and warm boot is ~200ms. The two
real costs are **frame-affecting changes (~1s, `autoFrame` + frame-image settle)** and **PNG
encode (~150ms)** — the latter kept off the interactive path by blitting the canvas
(`createImageBitmap`, ~0ms) and only encoding on save/export. So the ~2–4s in the Phase 0 demo
was entirely removable scaffolding, and the interactive ceiling is ~1ms.
Residual risk we can't engineer away: CC's intrinsic draw/boot cost drifts upward as upstream
adds features; mitigated by pinning CC to a known-good commit (also required for stable
goldens) and the warm/direct-draw model above.

### Maturity gap (honest)
The spike is a **proof of mechanism, not a mature renderer.** It uses a minimal `autoFrame`-only
driver and skips v1's hard-won steps (the last-character re-type that commits redraws, Edit
Bounds tweaks, planeswalker geometry, notification handling, multicolor pips, per-layout frame
stacking) — and it exhibited a real font-fallback bug. v1 has **no** JSON→PNG regression tests;
its correctness lives in two years of manual inspection. Reaching trustworthy parity therefore
requires a golden-image regression harness with v1 as the oracle (see §11, Phase 1a) before the
faithful port — not just "it renders."

### What this removes
Docker, Playwright, `server/src/card-conjurer.ts`, `server/src/services/render-service.ts`,
`.cache/renders` (~49 GB) and `.cache/previews`, the server's boot-time coupling to the
renderer, and the 3–7s latency.

### Print / PDF
Produced in-browser: render N cards to canvases and export. No server, no headless.

---

## 5. Backend fold-in

With rendering out of the server, the backend shrinks to card CRUD + AI proxy + (optional)
collection sync. That folds into the Next.js app:

- **Card CRUD, search, verify** → `core` ops (see §6), called from Next server actions.
- **Art generation (Leonardo)** → a Next server action. It's a plain API call (async
  poll is acceptable off the interactive hot path); the image-gen UX is reworked to be
  set-themed, model-switchable, and overlay-capable.
- **Collection git sync** → the UI is dropped; use the git CLI / harness.
- **Removed from the server:** `routes/render.ts`, `routes/strategies.ts`, the
  card-conjurer coupling; `card-service.ts` / `set-service.ts` logic migrates into `core`.

The separate Express process, Docker, and the CardConjurer bootstrap script go away.

---

## 6. Cards: two front doors on one core

Both the in-app UI and the external harness manipulate cards, over a **single shared
implementation** so there is no drift.

```
shared (isomorphic): domain model + search DSL                     [browser + node]
core   (node):       collection FS ops + AI handlers               [node only]
                     - whole-card create / update / delete / search / verify / assist
                     - set-notes read / write
   ├── CLI (kp …)            → OpenCode / Claude via a skill        (replaces MCP)
   └── Next server actions   → dockable AI assistant + UI
browser:             CardConjurer iframe render + overlay;
                     editor = full-card state + snapshot undo/redo;
                     AI returns whole cards that replace editor state
```

- **`shared`** stays isomorphic (also runs in the browser for the live editor). No FS deps.
- **`core`** is Node-only (filesystem ops over `collection/`, plus AI tool handlers). Built
  once, consumed by the CLI and the Next server actions.
- **In-app editing** operates on **in-memory card state**; persistence goes through `core`
  on save.

### The `kp` CLI
Mirrors the retained card operations; `render` is dropped (browser-only). Default output is
JSON to stdout (easy for AI to parse), with `--format table` for humans; input via JSON
stdin or `--file`.

| Command | Purpose |
|---|---|
| `kp search <query>` | filter the collection via the search DSL |
| `kp get <cid…>` | fetch full card JSON |
| `kp create` | create card(s) from JSON (stdin/`--file`) |
| `kp update <cid>` | update a card (full JSON; partial flags as a shell ergonomic) |
| `kp delete <cid…>` | soft-delete (`tags.deleted = true`) |
| `kp verify` | validate + human-readable explanation |
| `kp collector-number next --set X [--count N]` | first free collector number(s) |

An **OpenCode skill** (markdown under `.opencode/`) documents `kp` and instructs the AI to
call it via bash — replacing the `mcp` entry in `opencode.json`. Bonus: it also lets the
dev agent manipulate cards during development.

---

## 7. AI integration (in-app)

A **dockable, context-aware assistant panel** (also the chat surface) whose context follows
the active surface. Fits wide screens and multi-editor.

- **Context per surface:** editor → current card + face + validation errors; set → set +
  selected cell query; overview → current query + result set.
- **Editor (headline surface):** the AI returns a **whole card**; the editor **auto-applies**
  it by replacing state (pushing a new snapshot) → instant client-side re-render. Undo is the
  safety net. "Give me 3/5 ability options" returns **full-card candidates**, each shown as a
  live preview; picking one becomes the next snapshot.
- **Undo/redo:** a stack of **full card snapshots**; a pointer moves on undo/redo. Rapid
  typing is coalesced so undo steps stay sensible. No patch objects.
- **Self-correction:** after applying, `new Card(...)` validates; on failure the error is fed
  back and a corrected whole card is requested (the loop the current
  `ai-sample-generator.ts` already uses).
- **Mass edits:** handled by the **chat**, not a patch engine — the AI uses `core` over whole
  cards, shows the result, and asks to confirm.
- **Semantic search:** translate natural language → a search-DSL query (reuses the existing
  DSL). True embeddings are a later upgrade.

Everything file/code/repo-shaped stays with the external harness (boundary principle, §2).

---

## 8. Set notes (replacing design docs)

Design docs are not deleted — they become **first-class, set-scoped content**, integrated
into the set page rather than a loose notepad wrapped in MCP tooling.

- **UX:** an integrated **Notes** panel on the set page — a place to leave notes and talk
  about a set, not tied to any card. Start at **set level**; extensible to per-archetype/cell
  later.
- **Storage:** **markdown files linked to the set**, co-located with the set (e.g.
  `collection/sets/<set>/notes.md` or a `notes/` folder). Migrated from
  `collection/design/<SET>/*.md`.
- **Editing:** in-app on the set page **and** natively by the external harness (both touch the
  same files — no MCP indirection). The set-context AI can read/write them (whole-content).
- **Removed:** the MCP/CLI design-doc tools (`design-documents.ts`, `file-service.ts`).

---

## 9. Set page: search queries instead of blueprints

- Keep the **matrix/grid presentation** (archetypes × cycles). Each cell/row is defined by a
  **search DSL query**; matching cards auto-populate.
- **Delete** `shared/src/set/criteria/**` and `blueprint-validator.ts`; simplify the set
  model (`Set`/`Matrix`) accordingly (and rename the `Set` class to avoid shadowing the JS
  built-in).
- **No drag canvas yet** — kept as a possible future enhancement, not part of this refactor.

---

## 10. Migration strategy (strangler)

Anchor on the preserved core rather than two parallel worlds.

- **Keep** `shared` + `collection` as the shared foundation for both v1 and v2.
- **Introduce new workspaces:** `core` (node ops), `cli` (`kp`), and the v2 web app.
  Recommended layout (confirm before Phase 1):

  ```
  shared/   (keep, evolve)      core/   (new)      cli/   (new, kp)
  web/      (new, v2 Next app)  client/ server/ mcp/  (v1, retired over time)
  collection/  cardconjurer/ (external clone, served same-origin)
  ```

- **Cut over feature-by-feature.** v1 pages keep working until v2 covers them. Delete v1
  `client`/`server`, Docker, the MCP package, and the trimmed `shared` modules once v2 is
  trusted and you no longer fall back to v1.
- **Data compatibility:** the card JSON format is unchanged; sets gain notes;
  `collection/strategies/` and `collection/design/` are retired (design → set notes).

---

## 11. Roadmap

- **Phase 0 — Renderer spike (load-bearing).** Serve CardConjurer same-origin, drive it from
  a parent frame, feed one card, detect draw-settle, pull a clean PNG off the canvas. Success
  unlocks everything downstream. Fallback: one warm Playwright page.
  **DONE — PASSED** (see `spike/renderer/`, `spike/renderer/out-a.png` / `out-b.png`).
- **Phase 0.5 — Performance-decomposition spike.** Measure the true render ceiling on a **warm**
  instance with **direct `drawText()`/`drawCard()` calls** (bypassing CC's 500ms debounce, no
  reload, no sleeps): warm boot, `drawCard` alone, `drawText` alone, a text-only edit→canvas,
  a frame-affecting change, and `toDataURL` encode — across card complexities (vanilla creature,
  dense rules, planeswalker, transform/MDFC, token). Output: a decomposed timing table + an
  optimization map. Not a go/no-go gate (we're committed to the in-browser renderer regardless);
  it targets optimization and sets expectations.
- **Phase 1a — Golden-image regression harness (test-first).** Curated corpus first (~50–80
  cards spanning every layout/color/quirk), then a full 850-card sweep before cutover. **v1 as
  the oracle** (`POST /preview`), **CardConjurer pinned** to a fixed commit, perceptual/pixel
  diff (pixelmatch/odiff) with tolerance + a visual diff report. Acceptance bar: v2 reproduces
  v1 within tolerance (bug-for-bug parity) plus a human-approved subset.
- **Phase 1b — Faithful in-browser render module.** Port v1's `card-conjurer.ts` sequence
  verbatim (fonts wait + forced redraw, last-character commit trick, Edit Bounds, planeswalker
  geometry, all layouts), driven to parity against the goldens. Reuse the existing `Renderable`
  contract; map `Card` → `Renderable` via `shared`.
- **Phase 1c — Optimize under green tests + overview.** Warm-instance/direct-draw, iframe
  pool/double-buffer, tight settle, direct-canvas preview vs PNG encode — only where the golden
  diff stays green. Plus the wide card overview (search box, instant renders, sort).
- **Phase 2 — Compact live editor.** Instant preview, no full-page-nav on save, multi-instance,
  snapshot undo/redo, overlay hook.
- **Phase 3 — `core` + `kp` CLI + OpenCode skill.** Build the shared ops layer; ship the CLI
  and skill; retire MCP as the external interface.
- **Phase 4 — In-editor AI assistant.** Dockable panel, whole-card auto-apply, option
  suggestions, self-correction.
- **Phase 5 — Backend fold-in + trim legacy.** Move CRUD/AI into Next; delete
  Docker/Playwright/render-service/cache; remove strategy everywhere; remove dead
  tabs/pages/git-UI/collector surfacing; remove the MCP package.
- **Phase 6 — Set page on search queries + integrated set notes.** Migrate
  `collection/design/`.
- **Phase 7 — Broaden the assistant.** Overview/chat mass edits with confirm, NL→search-DSL,
  cycle/card creation.

---

## 12. Risks & open questions

- **Draw-settle detection (was the key risk) — RESOLVED.** Proven in the Phase 0 spike via
  pixel-stability polling; a full card renders end-to-end from a same-origin iframe with
  untainted same-origin art. See §4 and `spike/renderer/`. Fallback (warm Playwright page)
  not needed.
- **Renderer maturity & parity (the real risk).** The mature v1 renderer has **no** JSON→PNG
  tests; the spike is a proof of mechanism with known gaps (font-fallback bug, minimal
  `autoFrame`-only driver missing v1's hard-won steps). Mitigation: **golden-image regression
  harness with v1 as the oracle** (Phase 1a), CardConjurer **pinned** to a fixed commit, a
  faithful verbatim port (Phase 1b), and parity acceptance before any cutover. This is the
  gate to trusting v2.
- **Render performance ceiling.** Most of the spike's latency is CC's 500ms redraw debounce +
  our scaffolding, all removable via the warm-instance/direct-draw model (§4). Residual: CC's
  intrinsic draw cost drifts up as upstream adds features. Mitigation: Phase 0.5 measures the
  decomposed ceiling; pin CC; warm/direct-draw; worst case trim frame packs. Decision: we are
  committed to the in-browser renderer regardless of the measured numbers.
- **CardConjurer selector drift.** Upstream UI changes can break the DOM-driving. Mitigation:
  isolate all CardConjurer interaction behind a thin adapter (our `Renderable` → CC DOM),
  pin CC to a known-good commit, and run the golden-image suite after each deliberate `git pull`.
- **Overlay compositing performance** on large sets. Mitigation: offscreen canvas; cache
  rendered PNGs client-side keyed by a content hash (reuse the existing `hash`).
- **v2 app location** — new `web/` workspace (recommended) vs. evolving `client/` in place.
  Confirm before Phase 1 (Phase 0 is isolated and does not depend on this).
- **In-app Anthropic usage** — model choice, streaming, and cost. Implementation detail for
  Phase 4.
- **Image-gen UX** — set-themed prompts and model switching are part of the Phase 5+ rework;
  the current `!`-prefix setting convention is replaced by explicit controls.
