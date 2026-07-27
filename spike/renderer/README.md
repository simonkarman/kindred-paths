# Phase 0 spike — in-browser CardConjurer renderer

Proves the v2 renderer approach from `docs/v2-architecture.md` §4: drive CardConjurer in a
**same-origin iframe** and read the finished card straight off its canvas — **no Docker, no
Playwright in production, no `#downloadAlt`, no 49GB render cache.**

## Result: PASS

Full, correct cards render end-to-end, and reloading the iframe fully resets state between
cards (see `out-a.png` = green creature with art + P/T, `out-b.png` = clean red instant with
**no** leftover green frame or P/T box):

- CardConjurer served as **static files, same-origin** (no Docker/nginx).
- Creator initialized inside the iframe in **~170–350ms**; `cardCanvas` is the full
  **2010×2814** output.
- Driven from the **parent frame** (autoFrame + title/type/rules/PT + art) using the same
  selectors as the v1 Playwright driver.
- Extracted via `iframe.contentWindow.cardCanvas.toDataURL('image/png')`.
- Settle detected by **pixel-stability polling** (output unchanged for a short window).
- **Same-origin art composites without tainting the canvas** — `toDataURL()` does not throw
  (art via a cross-origin URL would). Output grows ~3.5MB → 6.5MB once art loads, confirming it.
- **Reset-per-render works:** each render clears the iframe's `localStorage` and reloads to a
  clean page, so autoFrame/frame-stack residue never bleeds between cards (validated by
  rendering two very different cards in a row and asserting the outputs are both real and
  differ).
- Cold headless timings: green+art card ~4s, red textless instant ~2.3s — both include browser
  cold-start and a deliberately conservative 500ms stability window. These are *not* the
  production numbers.

## The interactive demo

`harness.html` has a **text field**: paste/edit a *renderable* card JSON and click **Render**
(or Cmd/Ctrl+Enter). Each render reloads the iframe for a clean CardConjurer, then drives it
from the JSON and shows the extracted PNG. Sample JSON shape:

```json
{
  "name": "Spike Test Ranger",
  "manaCost": "{2}{G}",
  "typeLine": "Creature — Elf Ranger",
  "rules": "Vigilance\nWhen Spike Test Ranger enters the battlefield, draw a card.",
  "pt": "3/3",
  "art": "/local_art/<a-file-in-collection-art>.png"
}
```

(These are already-rendered fields. The faithful `SerializedCard` → renderable mapping — mana
cost objects, reminder text, mechanics, all layouts — comes in Phase 1 via the `shared`
package.)

## Files

- `serve.mjs` — zero-dependency static server. Serves the CardConjurer clone
  (`server/.cardconjurer`) at `/`, the harness at `/harness.html`, and `collection/art` at
  `/local_art/*` (by basename), all same-origin. Runnable standalone.
- `harness.html` — the parent page. Textarea + Render button; `window.renderCard(renderable)`
  and `window.renderFromInput()` do: clear localStorage → reload iframe → wait-for-creator →
  drive → settle → return PNG data URL. `?noauto` skips the on-load auto-render (for scripting).
- `render.mjs` — Playwright validation. Starts the server, drives the demo UI headless with
  two different cards, writes `out-a.png` / `out-b.png`, and asserts both are real renders that
  differ (proving the reload reset).

## Run it

```bash
# Headless validation (writes out-a.png and out-b.png):
node spike/renderer/render.mjs

# Or explore interactively in a real browser:
node spike/renderer/serve.mjs   # then open http://127.0.0.1:4199/harness.html
```

Requires the CardConjurer clone at `server/.cardconjurer` (created by `server/card-conjurer.sh`)
and Playwright installed in `server/` (used only for spike validation, not production).

## Notes / follow-ups for Phase 1

- **Production won't full-reload per keystroke.** Frame-affecting changes
  (color/type/layout/token/borderless/set-symbol) reload for a clean page; pure text edits
  (name/rules/PT/art) apply live on the current page. Hide the ~200–400ms boot with an
  **iframe pool / double-buffer** (pre-warm the next clean iframe). Also tune the settle window
  (500ms here is conservative). Target: sub-second interactive re-renders.
- `localStorage` holds a few persisted CardConjurer *settings* (set-symbol locks, collector
  defaults, autoFrame); the demo clears it before each reload for determinism.
- A non-fatal `Cannot read properties of undefined (reading 'type')` is logged during driving;
  the card still renders every field correctly. Resolve when porting the full driver.
- The full multi-layout driver (adventure/transform/MDFC/token/planeswalker) is Phase 1 —
  this spike only exercises the default `autoFrame` path, which alone proves the mechanism.
