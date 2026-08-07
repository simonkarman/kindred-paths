# Kindred Paths v2 — Architecture & Refactor Plan

Status: **settled; spiking on the `v2` branch.** This document is the source of truth for the
v2 refactor — decisions, target architecture, and phased roadmap. Phase 0 (mechanism) and
Phase 0.5 (performance) are done and passed (see `spike/renderer/`). The renderer architecture
is settled (pluggable; canonical server-side render + on-disk cache; interactive browser mode
as an editing accelerator). Next spikes: 0.8 (CardConjurer-in-Node), 0.6 (interactive patch),
0.7 (hidden/scaling/cross-talk).

---

## 1. Motivation & goals

Kindred Paths has grown well over ~2 years. The domain core is strong; the pain is almost
entirely in the **presentation and rendering layers**, plus features that are no longer used.

### Primary pains
- **Rendering is slow and heavy.** Each render drives a Dockerized CardConjurer via
  Playwright: two full page loads, ~28 serialized `networkidle` waits, and ~5.15s of
  hardcoded `sleep()` calls per render (`server/src/card-conjurer.ts`). Result: 3–7s per
  edit, which makes the whole app feel sluggish. (The on-disk PNG cache — ~49 GB in
  `server/.cache/renders` — is *fine* and stays; the pain is the Docker+Playwright pipeline
  that produces the renders, not the cache.)
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
- **Near-instant editing feedback** — a warm in-browser CardConjurer gives ~1ms live text
  re-renders while editing; canonical images come from a fast server renderer.
- **AI on every relevant surface** — ask for a change and it happens; generate cards and
  cycles; bulk edits.
- **Wide, power-user UI** (no forced max container width); multi-editor; navigate while
  editing.
- **Simpler surface** — remove legacy features; one match language (search DSL).
- **Keep the good core** — the domain model and the on-disk JSON format are preserved.
- **Keep the on-disk PNG cache** — canonical renders persist to `.cache` (content-hash keyed,
  + thumbnails) and are served as static files for the UI, other programs, and external tools.
- **Renderer independence** — the renderer is pluggable behind an interface; CardConjurer is
  the current implementation, a non-proprietary renderer can be added later.
- **Benefit from CardConjurer updates** — a `git pull` of CC can be adopted (pinned + validated
  by the golden-image suite); code changes on our side at update time are acceptable.
- **Effects/overlays** on cards, cleanly separated from the base CardConjurer render.

### Non-goals (explicit)
- Not rewriting the domain model (`shared`).
- Not vendoring MTG frame assets/art into the repo — CardConjurer stays an external,
  downloadable renderer (legal cleanliness + upstream updates).
- Not rebuilding a general AI coding agent in-app (see the boundary principle).
- Not requiring *zero-touch* CardConjurer updates — pinning + a validated update process
  (with occasional code changes) is fine.

---

## 2. Principles

1. **Keep the domain core.** `shared` (Card/CardFace/Layout, search DSL, mechanics, colors)
   is the crown jewel and is preserved/evolved, not rewritten.
2. **The on-disk JSON is the source of truth.** `collection/` (one JSON per card, `cid` in
   the filename, git-synced) stays exactly as-is. Multiple processes (web app, CLI, harness)
   read/write it.
3. **CardConjurer stays external and pinned.** We never vendor its assets. It's pinned to a
   known-good commit; adopting a newer CC is a deliberate step validated by the golden-image
   suite (§4), and may involve code changes on our side — that's acceptable.
4. **One match language.** The search DSL is the single way to express "which cards match."
   The blueprint criteria DSL is removed.
5. **Whole-card exchange with AI.** AI always returns complete cards, never diffs/patches.
   The editor's safety net is **full-state snapshot undo/redo**, not patch objects.
6. **Boundary principle (what to build vs. not).** In-app AI owns only what is coupled to
   **live app state and rendering**, and **set-scoped** content: cards, the set, and set
   notes. Everything that is "just files / code / repo" belongs to the **external harness**
   (OpenCode / Claude Desktop / Claude Code), which does it natively and better. We do not
   rebuild the harness; switching between the app and the harness is the intended workflow.
7. **Pluggable renderer.** Rendering sits behind a `Renderer` interface. CardConjurer is the
   current implementation; a non-proprietary renderer can replace it later without touching
   the cache, API, or UI.
8. **Canonical render = server-side; interactive = accelerator.** The authoritative image is
   produced by the server renderer and persisted to the on-disk content-hash cache. The
   in-browser CardConjurer is an **editing-preview accelerator** (instant feedback while
   typing), never the stored artifact. On save, only the card JSON is persisted; the canonical
   PNG is rendered by the server (lazily, on request).

---

## 3. Keep / Replace / Trim

| Keep (evolve) | Replace | Trim entirely |
|---|---|---|
| `shared` domain model (Card/CardFace/Layout) | Render *pipeline*: Docker+Playwright driving → pluggable server renderer (CC-in-Node or headless) + interactive browser accelerator | Table tab, Text tab, Statistics tab |
| Search DSL (`filter-definitions`, `filter-query-handler`, `card-filterer`) | Card editor → compact, live, multi-instance, snapshot undo/redo, dockable AI panel | Strategy (client + server + MCP + shared aggregator/bucket/color-weights) |
| `collection/` JSON format | Set page blueprint DSL → search-query cells | Inspire-me page (→ in-app assistant / harness) |
| On-disk PNG cache (`.cache`, content-hash + thumbnails) | Render orchestration/cache → renderer-agnostic render API | Collection git UI (→ git CLI / harness) |
| Card CRUD logic → moves into `apps/web/src/core/` | Image-gen UX → set-themed, model-switch, overlay-capable | Blueprint criteria DSL (`shared/src/set/criteria/**`, `blueprint-validator.ts`) |
| CardConjurer (external clone, pinned) | Backend → Next.js route handlers + `src/core/` ops | Collector-number surfacing (editor + set overview) |
| Mechanics, colors, sorter, art-prompt-creator, token-extracter, hash | Old MCP → SDK + `kp` CLI + thin MCP wrapper + OpenCode skill | v1 `mcp/` package (design-doc + research tools); **Docker**; the Playwright+Docker driving pipeline |
| | Design docs → integrated set notes (md linked to set) | |

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

### The v2 rendering model (two layers, one pluggable interface)
Rendering sits behind a `Renderer` interface (`render(renderable, faceIndex) → PNG`) with two
cooperating layers:

- **Canonical (server) rendering** — the authoritative image. A server render API produces the
  PNG via the active `Renderer` backend and persists it to the on-disk **content-hash cache**
  (+ a thumbnail). This is what the overview grid, print/export, other programs, and external
  tools consume. **Save persists JSON only**; the canonical PNG is rendered lazily on request.
- **Interactive (browser) accelerator** — a warm CardConjurer running *in the user's browser*
  for ~1ms live feedback while editing. It is **never** the stored artifact.

Both layers use CardConjurer today; the pluggable interface lets a non-proprietary renderer
replace it later without touching the cache, API, or UI. The rest of §4 covers the CardConjurer
driving mechanism (shared by both layers), the interactive editing model, the server render +
cache, how CardConjurer runs server-side, and the CC update workflow.

### The Renderer interface + registry
Each renderer exposes a stable **`name`** (filesystem-safe: `[a-z0-9-]+`) alongside its render
function. `packages/renderer/src/index.ts` holds a central `renderers` registry mapping name →
implementation; today it has one entry (`cardconjurer`). Adding a future renderer means
implementing the interface and adding one line to the registry — the golden test harness (§11
Phase 1a) discovers renderers from this registry and iterates over all of them, so no test-
harness changes are needed.

Goldens are stored per-renderer under `collection/goldens/<renderer-name>/<cid>.png` (see §10),
so a second registered renderer automatically gets its own goldens subtree the first time
`pnpm generate-goldens` runs.

### The CardConjurer driving mechanism
CardConjurer is just JavaScript drawing to a `<canvas>`. Instead of screenshotting it through a
Dockerized headless browser, we run it same-origin and read its canvas directly:

1. **Serve the CardConjurer clone same-origin** with the web app (Next rewrite / static
   route, or a tiny static server). It stays an external **pinned** `git clone` —
   **never vendored, never committed** (already `.gitignore`d). This preserves legal
   cleanliness and controlled updatability.
2. **Map the two local mounts** CardConjurer expects (previously Docker read-only volumes)
   to same-origin routes:
   - `collection/art` → `/local_art/…`
   - `collection/symbols` → the custom set-symbol path
     (`/img/setSymbols/official/custom/…`).
3. **Load CardConjurer in a hidden iframe** and drive it from the parent frame by
   manipulating its `contentDocument` / calling its globals. Port the driving logic from
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

### Interactive editing: the RenderSession pool
The interactive layer keeps CardConjurer **warm** so edits feel instant, and formalizes when a
cheap patch suffices vs. when a full re-render is needed.

- **Patch vs. full render (frame signature).** A text-only edit (name, rules, type subtypes,
  P/T value, mana value with unchanged colors, flavor) mutates `card.text.*` and calls
  `drawText()` directly — ~1ms, no reload. A **frame-affecting** change (color set, card types,
  P/T presence, supertype/crown, layout, isToken, borderless, vehicle, planeswalker
  tall↔regular, land colors from rules, set symbol) changes the "frame signature" and needs a
  **full render** (reload to a clean page). Phase 0.6 validates this boundary empirically.
- **The pool.** A fixed-size **LRU pool** of hidden warm sessions keeps the *last few edited
  cards* live. Acquire on edit: **hit** → resume ~1ms patching; **miss** → evict the oldest slot
  and full-render into it. Pool size **N is derived from the scaling test** (Phase 0.7). The pool
  is a **render cache; the editor's in-memory card state (with snapshot undo/redo) is the source
  of truth**, so eviction is always safe.
- **Double-buffer** frame-affecting changes: render the new-signature card in a spare instance,
  then swap in — no flicker.
- **Hiding.** Instances hide via **off-screen positioning** (kept laid out), which keeps canvas
  drawing + extraction functional; `cardCanvas` is a fixed 2010×2814 regardless of the iframe's
  on-screen size. (Phase 0.7 confirms off-screen vs `visibility:hidden` vs `display:none`.)
- **Cross-talk risk.** Same-origin instances share `localStorage`, where CC stores some settings.
  Phase 0.7 checks N-different-card independence; mitigation is to set those settings explicitly
  per render (we drive via direct `card.*` + explicit frame ops, sidestepping most of them).
- **Save** never uses a patched approximation: it persists JSON, and the **server** produces the
  canonical render (below).

### Canonical rendering: server render API + on-disk cache
- **Render API** `GET /render/:cid/:face` (query for scale/quality). Key by a **content hash of
  card props + art bytes** (not `cid`, since cards change). On a hit, serve the static file; on a
  miss, render via the active `Renderer`, write `.cache/renders/<hash>.png` **and a thumbnail**,
  then return.
- **Content-hash filenames** (v1 style): immutable, dedupe, browser-cache-safe. Stale versions
  accumulate — acceptable (the ~49 GB is fine); an optional GC ("keep only current-card hashes")
  can be a maintenance command later.
- **Served as static files** so the UI grid, print/export, other programs, and the `kp` CLI can
  consume images by URL or straight off disk.
- **Copyable into static-export bundles** — the same on-disk bytes the dynamic render API serves
  are exactly what the Phase 1d static export copies (as `<cid>-<face>.png` +
  `<cid>-<face>.thumb.webp`) into `apps/web/generated/site/renders/`. See §13.
- **Populated by the server**, not by browser uploads — the interactive layer stays purely an
  editing accelerator.

### CardConjurer server-side execution (Phase 0.8 decides)
The server `Renderer` runs CardConjurer without a user browser.

1. **CC-in-Node — PROVEN, feasible AND fast (Phase 0.8, `spike/renderer/cc-node-*`).**
   CardConjurer's *draw path is almost entirely DOM-free* (verified: `drawFrames()`/`drawText()`
   touch no DOM; `drawCard()` reads 2 checkboxes; `writeText()` reads 3 elements — the app's 318
   `document.` refs live in UI/event code). The spike runs CC's **real** code (`main-1.js` +
   `autoFrame.js` + `creator-23.js` + the dynamically-loaded frame pack) unmodified in a Node `vm`
   sandbox via **`@napi-rs/canvas`** (Skia) + a generic DOM shim + registered fonts + filesystem
   image loading — a **correct card, no browser, no Docker** (155 frame images loaded, 0 failures).
   Because the shim is generic (not CC-logic), a CC pull's new frames keep working → high reuse of
   CC's own code.
   **A real bug was found and fixed here, not just measured:** CardConjurer wires
   `image.onload = drawFrames` on every frame/mask image and `drawFrames()` calls `drawCard()`,
   so a naive drive triggers **~26-39 redundant full composites per render** — ~8.4s in Node
   (~1.8s in a browser, same redundancy, faster canvas) — and, because those composites land
   *asynchronously*, capturing the canvas via a fixed sleep is a **race**: the frame was **always
   missing** server-side and **sometimes** missing in the browser. The fix: suppress
   `drawFrames`/`drawCard` during the build, wait for the **real** completion signal (each image's
   `decode()` promise in Node; CardConjurer's own `ImageLoadTracker`/`FontLoadTracker` — the same
   primitive its bulk-export uses — in the browser), then do exactly **one** guaranteed-complete
   composite. Result: **~1.0s full render in Node** (build+decode ~80ms, composite ~290ms, PNG
   encode ~650ms), **~0.5-0.9s in the browser**, and the frame is now **always present** (verified
   across repeated renders in both hosts). This technique — suppress, await real completion, single
   composite — is required for the Phase 1b render module, not an optimization to defer.
2. **Warm headless browser (fallback).** Runs the *same* driving code (incl. the fix above) in a
   warm headless browser (Playwright, no Docker, CC served statically). Comparable speed to
   CC-in-Node now that the redundant-composite bug is fixed; the speed argument for preferring it
   over CC-in-Node no longer holds. Phase 1 should still compare fidelity on the golden corpus.

Either way Docker is gone, and the mechanism sits behind the `Renderer` interface.

### Two more bugs found and fixed in the browser accelerator (dashboard/harness)
Building an interactive dashboard to demo the renderer (`spike/renderer/dashboard.html`,
`harness.html`) surfaced two further defects in the **browser interactive preview path**
(Node/server rendering was already correct):

1. **Pixelated preview.** The live-preview `<canvas>` blitted CardConjurer's full 2010×2814
   `cardCanvas` down into a 340px backing store, which the browser then upscaled back up for
   retina display — lossy twice over. Fix: blit at the card's **native resolution** into the
   backing store and let CSS (`width:340px`) handle the display-size downscale, which stays crisp
   at any `devicePixelRatio`. Now matches the server render's crispness; patch cost unaffected
   (~1-3ms `drawImage`).
2. **Intermittent font "tofu" (missing-glyph boxes).** CardConjurer draws text synchronously via
   `writeText()` and has **no font-load-then-redraw mechanism of its own** — it only *registers*
   fonts for later tracking (`FontLoadTracker.track`). Since a full render reloads the iframe (a
   fresh page, fresh `@font-face` loads), `drawText()` can run before a font is ready, baking in
   permanent tofu that no later composite fixes. Node is immune (`GlobalFonts.registerFromPath`
   is synchronous). Fix: after waiting for `ImageLoadTracker`/`FontLoadTracker`/
   `document.fonts.ready`, **redraw text once more** before the single composite (still just one
   extra `drawText()` call, still suppressed compositing until the end). Verified with
   deliberately glyph-heavy titles (`k`/`w`/`x`/`y`/`z`) across repeated full renders — zero tofu.

Both are applied in `dashboard.html` and `harness.html`, and covered by regression checks in
`dashboard-verify.mjs` (a native-resolution assertion and a glyph-heavy-title determinism check
across independent full renders).

### CardConjurer update workflow
CC is **pinned** to a commit (today `card-conjurer.sh` floats via `git reset --hard && git pull`
— change to a pin). Any renderer-affecting change — a CC pin bump, a fix in our CC driver, a
font swap — goes through the same executable flow:

1. Make the change (bump `packages/renderer/src/cardconjurer/pin.ts`, or edit driver code).
2. `pnpm generate-goldens` — regenerates `collection/goldens/<renderer>/` for every registered
   renderer (wipes each renderer dir first, then rewrites PNGs for every `tag:golden` card).
3. `cd collection && git diff -- goldens/` — visually review each pixel change.
4. If diffs are intended improvements (e.g. new/updated CC frames rendering as expected), commit
   both the code change and the new PNGs together in a linked PR. If diffs are regressions, fix
   the code, re-run `generate-goldens`, re-check.
5. During iteration on a single card, use the surgical flag: `pnpm generate-goldens --card <cid>`
   overwrites only that one PNG; `pnpm test:golden --card <cid>` diffs only that one card.

The golden suite (Phase 1a) is the compatibility gate: it validates v1↔v2 parity *and* CC version
bumps *and* driver changes. See §11 Phase 1a for the full command semantics.

### What this removes / keeps
- **Removes:** Docker, the Playwright+Docker *driving* pipeline (`server/src/card-conjurer.ts`
  as-is), the boot-time coupling to a running CC container, `.cache/previews`, and the 3–7s
  per-edit latency.
- **Keeps (reworked):** a server render path — now pluggable and browser-free (CC-in-Node) or
  warm-headless — and the on-disk PNG cache `.cache/renders` (content-hash + thumbnails),
  served as static files.

### Print / PDF
Composed from the cached canonical renders (the render API fills any misses on demand), so
print sheets use the same authoritative images as the rest of the app.

---

## 5. Backend fold-in

The backend folds into the Next.js app (`apps/web`) as route handlers under `src/app/api/`,
calling pure node ops under `src/core/` (see §6 and §10):

- **Card CRUD, search, verify** → `src/core/ops/` (see §6), called from route handlers.
- **Render API** → `GET /api/render/:cid/:face` behind the `@kindred-paths/renderer` interface:
  content-hash cache lookup → render on miss (CC-in-Node or headless) → persist PNG + thumbnail
  to `KP_CACHE_DIR` → serve. Cache dir is also served as static files. (This is v1's `render.ts`
  reworked: renderer-agnostic, no Docker, no boot-time coupling.)
  - The cache itself is **not** inside any specific renderer — it's a decorator,
    `withCache(renderer, { cacheDir, version? })` in `packages/renderer/src/cache.js`, that
    wraps *any* `Renderer` (see `interface.js`) and returns one with the same shape. `apps/web`
    composes it once per registry factory: `withCache(await createCardconjurerNodeRenderer(),
    { cacheDir: process.env.KP_CACHE_DIR ?? './.cache' })`. The golden harness
    (`generate-goldens`/`test:golden`) never wraps a renderer this way — it always uses the bare
    registry factory, so `skipCache` is moot there by construction.
  - Cache key = sha256 of `{ rendererName, rendererVersion, input, options }` (`skipCache`
    excluded — it's a behavior switch, not part of render identity). `rendererVersion` is the
    renderer's own declared `Renderer.version` (an 8-char sha1 of its source files, e.g.
    `cardconjurer/version.js`, which also covers `pin.js` — so a CC pin bump auto-invalidates
    every cached render, no manual cache-clearing step). `options.skipCache: true` is a full
    bypass (no read, no write), for the "just changed the renderer, want an uncached look"
    workflow.
  - Files land at `<cacheDir>/renders/<hash>.png` + `<hash>.thumb.webp` (488×684 WebP q80,
    via `sharp`, sized for the overview grid, Phase 1c).
  - Not yet handled: pruning stale entries left behind by an old renderer version (leaked, not
    overwritten) — a follow-up `kp cache prune` command.

- **Art generation (Leonardo)** → a route handler calling `src/core/ai/`. It's a plain API call
  (async poll is acceptable off the interactive hot path); the image-gen UX is reworked to be
  set-themed, model-switchable, and overlay-capable.
- **Collection git sync** → the UI is dropped; use the git CLI / harness.
- **Removed from the server:** `routes/strategies.ts`, the Docker/Playwright *driving* coupling
  in `card-conjurer.ts`; `card-service.ts` / `set-service.ts` logic migrates into
  `apps/web/src/core/ops/`.

The separate Express process, Docker, and the CardConjurer bootstrap-as-container go away; the
CardConjurer clone lives under `packages/renderer/external/cardconjurer/` and is served
statically by `apps/web`.

---

## 6. Cards: two front doors on one core

Both the in-app UI and the external harness manipulate cards, over a **single shared
implementation** so there is no drift.

```
shared (isomorphic):     domain model + search DSL                    [browser + node]
apps/web:                Next.js UI + /api/* routes + src/core/ ops   [node only]
                         - whole-card create / update / delete / search / verify / assist
                         - set-notes read / write
sdk (HTTP client):       typed functions over apps/web /api/*         [any node process]
   ├── CLI (kp …)                → uses sdk → OpenCode via a skill    (replaces old MCP)
   └── MCP wrapper (packages/mcp) → uses sdk → Claude Desktop et al.  (kept, thin)
browser:                 CardConjurer iframe render + overlay;
                         editor = full-card state + snapshot undo/redo;
                         AI returns whole cards that replace editor state
```

- **`shared`** stays isomorphic (also runs in the browser for the live editor). No FS deps.
- **`apps/web/src/core/`** is Node-only (filesystem ops over `collection/`, plus AI handlers).
  Consumed **only** by `apps/web`'s route handlers — never imported by CLI or MCP directly.
- **`sdk`** is the only way anything outside `apps/web` reaches core ops. CLI and MCP are HTTP
  clients; local dev requires `pnpm dev` (or a remote `KP_SERVER_URL`).
- **In-app editing** operates on **in-memory card state**; persistence goes through
  `POST /api/cards/:cid` (which calls into `src/core/ops/`).

### The `kp` CLI
Mirrors the retained card operations via the SDK. The CLI doesn't render itself, but **images
are available via the server render API and the on-disk content-hash cache** — a `kp image <cid>`
returns the cached PNG path/bytes (the server renders on a miss). Default output is JSON to
stdout (easy for AI to parse), with `--format table` for humans; input via JSON stdin or `--file`.

| Command | Purpose |
|---|---|
| `kp init` | first-run wizard: clone existing / start fresh / point elsewhere |
| `kp search <query>` | filter the collection via the search DSL |
| `kp get <cid…>` | fetch full card JSON |
| `kp create` | create card(s) from JSON (stdin/`--file`) |
| `kp update <cid>` | update a card (full JSON; partial flags as a shell ergonomic) |
| `kp delete <cid…>` | soft-delete (`tags.deleted = true`) |
| `kp verify` | validate + human-readable explanation |
| `kp image <cid>` | return cached PNG path/bytes (renders on miss via `/api/render`) |
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
- **Mass edits:** handled by the **chat**, not a patch engine — the AI uses core ops over whole
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

### Target layout (locked)

pnpm workspaces, `packages/` for libraries, `apps/` for deployables, all packages scoped
`@kindred-paths/*`.

```
kindred-paths/
├── pnpm-workspace.yaml
├── package.json                        workspace scripts (dev, build, test, lint)
├── .opencode/skills/kp.md              OpenCode skill (replaces MCP as OC's front door)
├── docs/
├── scripts/                            dev helpers
├── spike/                              kept until Phase 1c, then deleted
│
├── packages/                           libraries (@kindred-paths/*)
│   ├── shared/                         isomorphic: card model, DSL, hashing, colors,
│   │                                   typography, layouts (browser + node safe; no fs, no fetch)
│   ├── renderer/                       pluggable Renderer interface + impls
│   │   ├── src/interface.ts            Renderer contract (Node + Browser variants)
│   │   ├── src/cardconjurer/{node,browser,pin.ts}
│   │   ├── external/cardconjurer/      cloned by script, gitignored, pinned SHA
│   │   └── scripts/setup.sh
│   ├── sdk/                            hand-written HTTP client over apps/web /api/*
│   ├── cli/                            `kp` bin — HTTP-only via sdk
│   └── mcp/                            MCP server — HTTP-only via sdk
│
└── apps/
    └── web/                            Next.js 15 — the whole backend
        ├── src/app/                    UI pages
        ├── src/app/api/                HTTP surface (the ONLY http boundary)
        ├── src/core/                   node ops (see convention below)
        │   ├── collection/  cache/  ai/  init/  ops/
        └── src/lib/                    web-only glue (config, etc.)

# External, env-configurable, gitignored if inside the repo:
KP_COLLECTION_PATH    default ./collection    (git repo, plain dir, or empty)
KP_CACHE_DIR          default ./.cache        (content-hashed PNGs)
KP_CARDCONJURER_PATH  default packages/renderer/external/cardconjurer
KP_SERVER_URL         default http://localhost:3000    (used by sdk)

# New subdirectory inside the existing collection (no new env var needed):
collection/goldens/<renderer-name>/<cid>.png   golden PNGs, one per card per registered renderer
```

**Count: 5 packages + 1 app.**

### Architecture in one sentence

> **`apps/web` is the whole backend**; `packages/{shared, renderer, sdk, cli, mcp}` are the
> libraries around it, with `sdk` being the sole way anything talks to it over HTTP.

### Locked decisions

| Decision | Choice |
|---|---|
| Package manager | pnpm workspaces (no Turborepo yet — add later if CI slow) |
| Package granularity | 5 packages + 1 app |
| Renderer | Interface + one impl (CardConjurer); pluggable for future impls |
| CardConjurer location | `packages/renderer/external/cardconjurer/`, pinned SHA, gitignored |
| Core code home | `apps/web/src/core/` — folded into web (one consumer today) |
| CLI → server | HTTP-only via SDK. Requires running server (local `pnpm dev` or remote `KP_SERVER_URL`) |
| MCP fate | Kept as thin wrapper — `packages/mcp/` uses the same SDK as CLI |
| SDK style | Hand-written, ~10 typed functions, imports `shared` for types |
| Package naming | `@kindred-paths/*` scope; CLI bin = `kp` |
| Convention | `packages/` for libraries, `apps/` for deployables |
| Collection dir | External, addressed by `KP_COLLECTION_PATH`; works with git repo OR plain dir OR empty/nonexistent; first-run wizard offers clone-existing / start-fresh / point-elsewhere |
| Goldens location | `collection/goldens/<renderer-name>/<cid>.png` — inside the existing collection repo. No separate goldens repo, no new env var. Cards are marked `tags: { golden: true }`. Git handles diff/history/audit. See §11 Phase 1a for command semantics |
| Dev orchestration | `pnpm dev` starts `apps/web`; CLI + MCP hit `http://localhost:3000` |
| Hosting | Static export supported for read-only publishing (Phase 1d) via `pnpm --filter web export:static` + GitHub Pages. Dynamic hosting still deferred — no `CollectionSource`/`RenderCache` interfaces upfront, no auth scaffolding. Add when actually hosting dynamically |
| Spike code | Keep under `spike/` until Phase 1c completes, then delete |

### Critical convention

Files under `apps/web/src/core/` are **pure node modules** — no `next/*` imports, no
`Request`/`Response` types, no route-handler concerns. Only `app/api/*/route.ts` may translate
between HTTP and core ops. This preserves core's testability (import directly into vitest with no
Next.js in the loop) without the ceremony of a separate package. If the convention drifts, core
becomes untestable without Next — enforce by lint rule or code review.

### Strangler cutover

- **Keep** the existing `collection/` external repo mechanic and the `shared` v1 module as the
  source of truth during migration; new `packages/shared/` is populated by porting from v1
  `shared/` (not by rewriting from scratch).
- **v1 dirs stay put** (`client/`, `server/`, `mcp/`, `shared/`) at repo root during migration.
- **Cut over feature-by-feature.** v1 pages keep working until v2 covers them. Delete v1
  `client/`, `server/`, Docker, the old `mcp/`, and the trimmed `shared/` modules once v2 is
  trusted and you no longer fall back to v1.
- **Data compatibility:** the card JSON format is unchanged; sets gain notes;
  `collection/strategies/` and `collection/design/` are retired (design → set notes).
- **Deferred hosting**: designed to be addable later without restructuring, but no interfaces or
  auth code lands until hosting is actually built.

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
- **Phase 0.6 — Interactive-patch feasibility.** Prove text patches (name/rules/auto-fit) into a
  warm session match a clean render, and that color/type changes diverge (must full-render). Two
  same-origin iframes, in-browser `getImageData` diff (<0.1%). → `spike/renderer/patch-*`.
  **DONE — PASSED**: single + sequential text patches are pixel-identical (0%) to clean renders;
  color change diverges 42.8%, type change shows the lingering P/T box → both must full-render
  (frame-signature rule confirmed). Determinism control 0.118%.
- **Phase 0.7 — Hidden + scaling + cross-talk.** Hidden-render correctness (off-screen vs
  `visibility:hidden` vs `display:none`), scale to 16 instances (time + memory → pool size N),
  and N-different-card independence (localStorage cross-talk). → results table.
  **DONE — PASSED**: all three hiding modes render identically to visible (0.118%); 16 hidden
  instances render with 0 blanks, <0.7% cross-talk, ~8% render-time growth, ~140MB heap → pool of
  ~6–8 is comfortable. See `spike/renderer/scale-results.md`.
- **Phase 0.8 — CardConjurer-in-Node.** `@napi-rs/canvas` + minimal DOM shim, **running CC's real
  `autoFrame.js`**; M1 go/no-go (one card, pixel-diff vs the browser render), M2 (default-path
  cards, timing + fidelity + % of CC code unmodified). Decides the server renderer = CC-in-Node
  vs warm headless. → findings. **DONE — renders a correct card in pure Node, no browser/Docker.**
  Found and fixed a real bug (a `drawFrames`-storm race causing ~26-39 redundant composites per
  render and a **missing frame on every server render**); corrected: **~1.0s full render, frame
  always present** (fix also applied and verified in the browser accelerator). Both hosts are now
  comparably fast; the fix (suppress + await real completion + single composite) is required for
  Phase 1b. See `spike/renderer/cc-node-results.md`.
- **Phase 0.9 — Initial golden capture from v1.** Curate ~80 cards (advisory selection script by
  coverage rules; human final pick), tag them `tags: { golden: true }` in `collection/cards/`,
  then run a throwaway `spike/goldens/initial-capture.mjs` that POSTs each to v1's render
  endpoint and writes PNGs to `collection/goldens/cardconjurer/<cid>.png`. Deliverable:
  populated `collection/goldens/cardconjurer/` committed to the collection repo. Prerequisite:
  v1 is functional (it is today). This is the only phase that needs v1 alive; all subsequent
  golden regeneration runs use v2's renderer.
- **Phase 1a — Golden diff harness (test-first).** Ship `pnpm generate-goldens` and
  `pnpm test:golden` in the v2 workspace. Both **discover renderers from the
  `packages/renderer/src/index.ts` registry** and iterate over all of them (today just
  `cardconjurer`; future renderers auto-included). Both accept `--renderer <name>` and
  `--card <cid>` (repeatable or comma-separated) scope flags:
    - `generate-goldens` (full scope) wipes each affected renderer dir, then rewrites PNGs for
      every `tag:golden` card. `generate-goldens --card <cid>` is surgical: overwrites only the
      specified files, no wipe.
    - `test:golden` (full scope) does a membership check (missing/orphan PNGs) then pixel-diffs
      via pixelmatch with a tolerance. `test:golden --card <cid>` skips membership and only
      diffs the specified card(s); fails with an actionable message if no PNG exists.
    - **Both commands always force a fresh render**, bypassing the on-disk render cache
      (`KP_CACHE_DIR`). Otherwise a golden regen after a renderer code change would silently
      return the cached PNG from the previous build and pass every diff. In v1 terms this is
      `GET /render/:cid/:faceIndex?force=true`; in v2 the renderer interface exposes an
      equivalent `render(card, { skipCache: true })` option.
    - **Browsing the golden set:** `http://localhost:4100/?q=tag%3Agolden` opens the v1
      overview filtered to golden cards. The v2 overview page (Phase 1c) must accept the same
      URL query so this bookmark keeps working.
  Emits an HTML report grouped by renderer. Zero v1 dependency at runtime. Also scaffolds the
  minimal v2 workspace (`pnpm-workspace.yaml`, `packages/shared/` port, `packages/renderer/`
  with interface + registry + cardconjurer node bridge, empty `apps/web/` skeleton). Gates
  both the server renderer and the interactive accelerator, and every CC version bump. See §4
  CardConjurer update workflow for the executable regen/diff/PR flow.
- **Phase 1b — Renderer(s) to parity.** Behind the `Renderer` interface: the **server renderer**
  (CC-in-Node or headless, per 0.8) with the **content-hash cache + thumbnails** (landed early,
  as `withCache` in `packages/renderer/src/cache.js` — see §5 for the design), and the
  **interactive browser accelerator**. Port v1's `card-conjurer.ts` sequence faithfully (fonts
  wait + forced redraw, last-character commit, Edit Bounds, planeswalker geometry, all layouts),
  driven to parity against the goldens. Reuse the `Renderable` contract; map `Card` → `Renderable`
  via `shared`.
- **Phase 1c — Optimize under green tests + overview.** Warm-instance/direct-draw, the
  **RenderSession pool** (LRU + double-buffer, size N from 0.7), tight settle, direct-canvas
  preview vs PNG encode — only where the golden diff stays green. Plus the wide card overview
  (search box, instant renders from the cache, sort).
- **Phase 1d — Static read-only export (published to GitHub Pages).** Ship
  `pnpm --filter web export:static -- [--query <search-DSL>] [--base-path /<subpath>]`
  that produces a fully static, deployable snapshot of the read-only app at
  `apps/web/generated/site/`. Also relocate the CardConjurer clone from v1's
  `server/.cardconjurer/` to the pinned `packages/renderer/external/cardconjurer/`
  (created by `pnpm setup:cardconjurer` — shallow blobless clone of the pinned SHA,
  Docker-free) and validate byte-identical goldens against it. Establish the design
  contract every subsequent phase must follow: `NEXT_PUBLIC_KP_STATIC` flag,
  `<DynamicOnly>` gate for interactive UI, server-component-baked data (no client
  fetches in static mode), and `assetPath()` for image URLs. Ship a
  `workflow_dispatch`-triggered GitHub Action template committed to each collection
  repo that runs `setup:cardconjurer` + `export:static` and deploys to Pages, with
  Actions cache for both the CC clone and the render cache. See **§13** and
  `docs/v2-phase1d-static-export.md`.
- **Phase 2 — Compact live editor.** Instant preview, no full-page-nav on save, multi-instance,
  snapshot undo/redo, overlay hook.
- **Phase 3 — SDK + `kp` CLI + MCP wrapper + OpenCode skill.** Solidify `apps/web/src/core/`
  ops behind route handlers, ship the hand-written `@kindred-paths/sdk` over them, then build
  `@kindred-paths/cli` (`kp` bin) and the thin `@kindred-paths/mcp` wrapper on the SDK. Ship
  the OpenCode skill; retire the old `mcp/` package.
- **Phase 4 — In-editor AI assistant.** Dockable panel, whole-card auto-apply, option
  suggestions, self-correction.
- **Phase 5 — Backend fold-in + trim legacy.** Move remaining v1 CRUD/AI into `apps/web`
  (`src/app/api/` + `src/core/`); delete Docker, the Playwright+Docker *driving* pipeline, and
  v1 `server/` (keep the reworked render API + cache dir); remove strategy everywhere; remove
  dead tabs/pages/git-UI/collector surfacing; delete v1 `client/`, v1 `mcp/`, v1 `shared/`.
- **Phase 6 — Set page on search queries + integrated set notes.** Migrate
  `collection/design/`.
- **Phase 7 — Broaden the assistant.** Overview/chat mass edits with confirm, NL→search-DSL,
  cycle/card creation.

---

## 12. Risks & open questions

- **Draw-settle detection (was the key risk) — RESOLVED, refined.** Proven in the Phase 0 spike
  via pixel-stability polling; a full card renders end-to-end from a same-origin iframe with
  untainted same-origin art. **Refinement (Phase 0.8):** pixel-polling/fixed-sleep alone was found
  to race against CardConjurer's async `drawFrames`-per-image-load pattern, occasionally capturing
  a frame-less canvas. The robust signal is CardConjurer's **own** completion primitive
  (`ImageLoadTracker`/`FontLoadTracker` in the browser; each image's `decode()` promise in Node),
  combined with suppressing intermediate composites and doing one guaranteed-complete pass. See
  §4 and `spike/renderer/cc-node-results.md`. Fallback (warm Playwright page) not needed.
- **Renderer maturity & parity (the real risk).** The mature v1 renderer has **no** JSON→PNG
  tests; the spike is a proof of mechanism with known gaps (minimal `autoFrame`-only driver
  missing v1's hard-won steps for other layouts). The font-fallback and missing-frame bugs found
  during spiking were root-caused and fixed (§4), not merely worked around. Mitigation: **golden-
  image regression harness with v1 as the oracle** (Phase 1a), CardConjurer **pinned** to a fixed
  commit, a faithful verbatim port (Phase 1b), and parity acceptance before any cutover. This is
  the gate to trusting v2.
- **Render performance ceiling — MEASURED (Phase 0.5).** On a warm instance with direct draw
  calls, an interactive text edit is ~1ms and warm boot ~200ms; the real costs are frame-affecting
  changes (~1s) and PNG encode (~150ms, off the interactive path). Most of the original 2–4s was
  CC's 500ms debounce + scaffolding, all removed by the warm/direct-draw model (§4). Residual: CC's
  intrinsic draw cost drifts up as upstream adds features; mitigated by pinning + the two-layer model.
- **CC-in-Node feasibility (Phase 0.8) — RESOLVED.** Runs CardConjurer's draw path
  (+ `autoFrame.js`) unmodified in a Node shim; found and fixed a redundant-composite race
  (see §4) bringing full renders to ~1.0s. Fallback (warm headless browser) remains available but
  is no longer needed for speed reasons.
- **Browser preview fidelity (pixelation + font tofu) — RESOLVED.** The interactive dashboard
  demo surfaced a downscaled preview backing store (pixelated on retina displays) and an
  intermittent font-load race producing missing-glyph boxes. Both fixed (native-resolution blit;
  redraw-after-fonts-ready) and covered by regression checks. See §4 and
  `spike/renderer/dashboard-verify.mjs`.
- **Renderer fidelity (Skia vs Chromium).** A Node canvas (`@napi-rs/canvas`, Skia) may not be
  pixel-identical to the browser CC (fonts/AA). Mitigation: goldens are generated by the *canonical*
  renderer (self-consistent); the interactive browser preview and server canonical are both CC, so
  they should stay close; the golden tolerance absorbs sub-perceptual diffs.
- **`localStorage` cross-talk in the pool (Phase 0.7) — MEASURED, low risk.** 16 same-origin warm
  instances each rendered their own distinct card with <0.7% cross-talk (no wrong-card bleed). We
  still set frame-affecting settings explicitly per render as a belt-and-braces measure.
- **Pool sizing / memory (Phase 0.7) — MEASURED.** 16 hidden instances: 0 blanks, ~8% render-time
  growth, ~140MB JS heap (native canvas extra). A pool of ~6–8 is comfortable; the model is a small
  LRU pool + cached static images for everything else. Hiding via off-screen positioning (all of
  off-screen / `visibility:hidden` / `display:none` render correctly; off-screen is the safe default).
- **CardConjurer update coupling.** Adopting a newer CC may need code changes (accepted, not
  zero-touch). Mitigation: pin CC; the golden-image suite is the compatibility gate (bless intended
  changes, fix regressions). The CC-in-Node path maximizes reuse of CC's own code to minimize this.
- **Overlay compositing performance** on large sets. Mitigation: offscreen canvas; cache
  rendered PNGs client-side keyed by a content hash (reuse the existing `hash`).
- **v2 app location** — new `web/` workspace (recommended) vs. evolving `client/` in place.
  Confirm before Phase 1 (Phase 0 is isolated and does not depend on this).
- **In-app Anthropic usage** — model choice, streaming, and cost. Implementation detail for
  Phase 4.
- **Image-gen UX** — set-themed prompts and model switching are part of the Phase 5+ rework;
  the current `!`-prefix setting convention is replaced by explicit controls.

---

## 13. Static export & read-only publishing (Phase 1d)

The v2 app is publishable as a **fully static site** — HTML + PNGs + JS bundles, no Node
runtime, deployable to GitHub Pages or any static host. This is the "reference cube"
publishing story for finished sets. Full detail lives in **`docs/v2-phase1d-static-export.md`**;
this section is the normative summary.

### 13.1 Command

```
pnpm --filter web export:static -- [--query "<search-DSL>"] [--base-path /<subpath>]
```

- `--query` filters cards using the same search DSL the header/overview use. Empty = every
  visible card.
- `--base-path` sub-path for hosting (e.g. `/shx-cube` for GitHub Pages under
  `https://user.github.io/shx-cube/`). Empty = domain root.
- Output: `apps/web/generated/site/` (wiped clean on every run). Renders live under
  `apps/web/generated/renders/` and are copied into `site/renders/` during the build.
- Preview locally: `python3 -m http.server` (or `npx serve`) inside `generated/site/`.

### 13.2 The design contract (must be respected by every subsequent phase)

Three rules — retrofitting them after Phase 4 would be significantly more invasive:

1. **One capability flag.** `NEXT_PUBLIC_KP_STATIC=true` at build time in the static
   export build; unset in the dynamic build. Set by `next.config.ts` when the export
   script sets the env var.
2. **UI split via `<DynamicOnly>`.** Every interactive feature (editor panel, AI chat,
   save buttons, image regenerate, etc.) is wrapped in `<DynamicOnly>` (server component,
   `apps/web/src/components/dynamic-only.tsx`) so it returns `null` and is dead-code-
   eliminated in the static bundle. **All new features must adopt this.**
3. **Data via server components + baked HTML, images via `assetPath()`.** Client
   components never call `/api/*` in static mode. Server components read data at
   build time and pass it as props (e.g. `search/page.tsx` embeds the full card list
   into the search HTML in both modes). Images are the sole exception (cannot be
   inlined); `<CardImage>` and `<CardTile>` dispatch on `NEXT_PUBLIC_KP_STATIC` between
   `/api/render/...` and `assetPath('/renders/<cid>-<face>.<ext>')`.

Consequence: new APIs go under `app/api/**` (Next.js's `output: 'export'` naturally
skips them at build time — the export script also moves the folder aside as a
belt-and-braces measure). New UI wraps in `<DynamicOnly>`. No feature ever "silently
breaks" the export.

### 13.3 CardConjurer relocation (prerequisite completed in Phase 1d)

- Clone target: `packages/renderer/external/cardconjurer/` (gitignored).
- Pinned SHA: `packages/renderer/src/cardconjurer/pin.js` exports
  `CARDCONJURER_PIN = { sha, display, repo }`.
- Bootstrap: `pnpm setup:cardconjurer` (root script) → runs
  `packages/renderer/scripts/setup.mjs`. Cross-platform Node, idempotent, uses a
  **blobless partial clone** (`--filter=blob:none --depth 1`) to avoid downloading
  CC's multi-GB history.
- Env: `KP_CARDCONJURER_PATH` (default resolved by `apps/web/next.config.ts` to the
  clone above). No fallback to v1's `server/.cardconjurer/` — v2 code no longer
  references v1 paths.

### 13.4 GitHub Pages workflow

Each collection repo publishes its own static site by committing a
`workflow_dispatch`-triggered workflow at `.github/workflows/publish.yml`.

- Inputs: `query`, `base_path` (default `/<repo-name>`).
- Two GitHub Actions caches keep re-runs fast:
  - **CardConjurer clone** keyed on pinned SHA (~cache hit → skip setup entirely).
  - **Render cache** (`.cache/renders/`) keyed on card JSON + art hash + renderer
    version, with restore-keys for partial hits.
- First run: ~25–30 min (all cards fresh render). Steady state: 1–5 min per push (only
  cards whose content hash changed re-render).

Template lives at `collection/.github/workflows/publish.yml` in the SHX collection —
copy into each collection repo. Pinned to `simonkarman/kindred-paths@v2`.

### 13.5 What lives where

| File | Role |
|---|---|
| `apps/web/scripts/export-static.mjs` | Orchestrator: wipe, load cards, render, stage, `next build`, move, cleanup |
| `apps/web/next.config.ts` | Layered static-mode config gated on `NEXT_PUBLIC_KP_STATIC` |
| `apps/web/src/components/dynamic-only.tsx` | The `<DynamicOnly>` gate |
| `apps/web/src/lib/asset-path.ts` | `assetPath()` helper for image URLs + base-path prefix |
| `apps/web/generated/` | All export output (wiped/regenerated per run; `.gitignore`d) |
| `packages/renderer/scripts/setup.mjs` | CardConjurer clone bootstrap |
| `packages/renderer/src/cardconjurer/pin.js` | Pinned CC SHA |
| `collection/.github/workflows/publish.yml` | Template Pages workflow for a collection repo |

