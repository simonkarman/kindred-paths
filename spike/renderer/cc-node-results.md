# Phase 0.8 — CardConjurer-in-Node (no browser): PASS

**Verdict: feasible AND fast.** CardConjurer renders a full, correct card in a **pure Node
process** — no browser, no Docker — by running its *real* code against `@napi-rs/canvas` + a
minimal DOM shim. See `out-node-fixed-green.png` / `out-node-fixed-red.png`.

## Update: the "~8.4s full render" finding was a bug, not an intrinsic cost — now fixed (~1s)

An earlier version of this spike measured full renders at **~8.4s** and — critically — the
frame was **missing from every server-side render** (and occasionally from browser renders too).
Investigating *why* found a single root cause behind both symptoms, fixed it, and the corrected
numbers are dramatically better. See `cc-node-renderer.mjs` (`render()`), `dashboard.html`
(`fullRender()`), and `harness.html` (`renderCard()`) for the fix applied to both hosts.

### Root cause: a `drawFrames` storm

CardConjurer wires **`image.onload = drawFrames` on every frame *and* every mask image**
(`creator-23.js:921-932`), and `drawFrames()` ends by calling `drawCard()` (`creator-23.js:555`).
So the **entire** mask-composite + card-composite re-runs **once per image that loads** — for a
normal M15 creature, instrumenting a real render showed **26-39 `drawFrames` calls per render**,
each doing a manual `getImageData`/`putImageData` pixel blend over the full 2010×2814 canvas
(`creator-23.js:514-533`, the `preserveAlpha` mask path).

- **Why Node (~8.4s) was slower than the browser (~1.8s) for the *same* redundant work:**
  ~39 passes × ~218ms/pass in `@napi-rs/canvas` vs ~39 × ~46ms/pass in Chromium — Node isn't
  doing different work, just the same redundant work on a ~4-5× slower canvas.
- **Why the frame was sometimes/always missing:** those ~39 `drawFrames→drawCard` passes fire
  **asynchronously** as images load. Capturing the canvas via a fixed `sleep()`/pixel-poll is a
  race against the *last* pass — Node's shorter fixed wait lost the race **every** time (frame
  always missing server-side); the browser's longer wait usually won but **sometimes** didn't.

### The fix (validated on both hosts)

1. **Suppress `drawFrames`/`drawCard` to no-ops during the whole build** (`autoFrame()` +
   `drawText()`), so none of the ~26-39 redundant composites run.
2. **Wait for CardConjurer's own completion signal**, not a guessed sleep:
   - **Node:** `@napi-rs/canvas`'s `Image.src` decodes **asynchronously** (width/height are not
     valid immediately after assignment) — an earlier attempt fired `onload` synchronously and
     raced ahead of the real decode, producing blank/partial frames. The fix tracks each image's
     real `decode()` promise and `await Promise.all(...)` before compositing.
   - **Browser:** use CardConjurer's own `ImageLoadTracker`/`FontLoadTracker` (`waitForAll()`) —
     the exact primitive its bulk-export feature already uses for reliable output
     (`creator-23.js:3251-3273`).
3. **Restore the real functions and do exactly ONE composite** (`drawFrames()`, which calls
   `drawCard()` internally). Same visual result, ~15-25× less work, and — because it only runs
   after everything is verifiably ready — **no more race**.

### Corrected performance

| | Node (`@napi-rs/canvas`) | Browser (Chromium) |
|---|---|---|
| **Before fix** (full render, racy) | ~8.4s, **frame always missing** | ~1.8s, frame **sometimes** missing |
| **After fix** (full render, reliable) | **~1.0s** (build+decode ~80ms, composite ~290ms, PNG encode ~650ms) | **~0.5-0.9s** (reload navigation + choreography now dominate, not compositing) |
| Frame present | **Always** (verified across 5 renders × 2 colors) | **Always** (verified 5/5 across color changes) |

PNG encode (~650ms) is now the single largest Node cost — tunable via compression level or JPEG
for thumbnails, and irrelevant to the interactive path (browser preview blits the canvas
directly, no encode needed).

### What this changes vs. the earlier (wrong) conclusion

The earlier version of this doc said full-render latency made the warm-headless-browser backend
look better than CC-in-Node. **That conclusion was an artifact of the bug, not a real tradeoff.**
Fixed, CC-in-Node is **~1s** — competitive with the browser and with headless — while keeping its
real advantage (no browser process/dependency at all). Both remain **cached** (content-hash), so
repeat renders of the same card are instant regardless of backend. Phase 1 should still benchmark
both on the golden corpus (fidelity, not just speed, matters for the final choice), but the
speed argument for headless-over-CC-in-Node no longer holds.

## What runs

- CardConjurer's actual scripts execute **unmodified** in a Node `vm` sandbox: `main-1.js`,
  `autoFrame.js`, `creator-23.js` (~208KB), and the dynamically-loaded frame pack
  `packM15Regular-1.js`. **155 frame/mask/symbol images** load from the filesystem, 0 failures.
- `card`, `cardCanvas`, `drawText`, `drawCard`, `autoFrame`, `autoFrameUnified`, `buildAutoFrames`,
  `loadTextOptions` all initialize. `autoFrame()` picks the correct frame from the mana cost;
  `loadFrameVersion` seeds `card.text` (mana/title/type/rules/pt).

## The shim (`cc-node-renderer.mjs`)

Generic browser surface, **not** CardConjurer-specific logic:
- `@napi-rs/canvas` for `createCanvas`/`Image`/`Path2D`/`ImageData`/`DOMMatrix` and the 2D context
  (CC extends `CanvasRenderingContext2D.prototype`, so we expose it).
- A `document`/`window`/`localStorage` shim: canvases from `createElement('canvas')`, cached stub
  elements for everything else, a working `<head>`/`click()`, and interception of CC's runtime
  `loadScript()` to run **local** frame scripts in-sandbox (external CDN scripts skipped).
- CC fonts registered from the clone's `fonts/` dir; a custom `Image` subclass maps
  `/img/…`, `/local_art/…`, `data:` → filesystem/buffer, and fires `onload` only after the
  image's real `decode()` promise resolves (see fix above — this is the correctness-critical part).

Because the shim is generic, a CC `git pull` that changes frames/`autoFrame` should keep working
as long as it stays within this DOM surface — high **reuse of CC's own code** (the update-burden
metric we care about).

## Caveats / follow-ups

- **Fidelity vs Chromium** (Skia fonts/AA) is unmeasured here — Phase 1a goldens will quantify it.
  Since the *canonical* renderer generates the goldens, it's self-consistent; the browser preview
  and Node canonical are both CC, so they should be close.
- Only the **default M15 creature path** with **no art** was driven. Art is trivial to add
  (`card.artSource`, same `Image`/decode path); planeswalker/transform/token/multi-color-pips
  need their frame packs loaded the same way (Phase 1b) — the suppress/wait-for-decode/composite-
  once technique generalizes to those, but hasn't been exercised against them yet.
- One non-fatal `reading 'click'` inside the frame-init `onclick` chain (a shim gap, pre-existing,
  silently caught); `card.text` still initializes and the render is correct.
- **This same fix (suppress + real-completion-signal + single composite) should be treated as a
  required technique for the Phase 1b render module**, not an optimization to rediscover later —
  the naive "drive it like a user and sleep a bit" approach is both ~15-25× slower and racy on
  correctness.

## Run it

```bash
node --input-type=module -e "
import { createNodeRenderer } from './spike/renderer/cc-node-renderer.mjs';
const r = await createNodeRenderer();
const out = await r.render({ mana:'{2}{G}', title:'Test', type:'Creature — Elf Ranger', rules:'Vigilance', pt:'3/3' });
console.log(out.totalMs, 'ms total; build', out.buildMs, 'composite', out.compositeMs, 'encode', out.encodeMs);
"
```
Or via the dashboard's "Server render (Node)" button (`node spike/renderer/serve.mjs`, open
`/dashboard.html`). Requires `@napi-rs/canvas` (in `spike/renderer/package.json`) and the CC
clone at `server/.cardconjurer`.
