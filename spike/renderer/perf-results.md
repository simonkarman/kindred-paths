# Phase 0.5 — performance decomposition

Warm CardConjurer boot (once): **208ms**. Median of 15 iterations, headless Chromium, direct draw calls (no debounce, no reload). Canvas 2010x2814.

```
operation (median)                  vanilla       denseRules    
----------------------------------------------------------------
drawCard() composite                0.0ms         0.0ms         
drawText() relayout+draw            0.2ms         1.3ms         
text edit -> canvas (interactive)   0.7ms         1.1ms         
frame change (autoFrame settle)     1038.1ms      972.1ms       
toDataURL png encode                168.6ms       138.7ms       
toDataURL jpeg encode               23.0ms        24.7ms        
createImageBitmap (preview blit)    0.0ms         0.0ms         
```

## Interpretation

**The interactive editing ceiling is ~1ms.** When we bypass CardConjurer's 500ms debounce and
call `drawText()` directly, a text edit re-renders in ~1ms — even for a dense, multi-ability
card. `drawCard()` compositing is effectively free (<0.1ms). So the ~2–4s in the original Phase
0 spike was **100% removable scaffolding** (per-render reload + arbitrary sleeps + CC's 500ms
debounce + a 500ms settle window + PNG encode), not CardConjurer's drawing. The concern that a
mature version would hit the same wall as v1 is answered for the interactive path: **no.**

**Two real costs to design around:**

1. **Frame-affecting changes ≈ 1s** (`autoFrame` + frame-image settle). This is the one genuinely
   expensive path — but it only happens on color/type/layout changes, not on typing. Part of the
   1s is the measurement's 250ms stability window; the rest is `autoFrame`'s async frame-image
   handling. Phase 1c optimizes this (pre-warmed frame pool / double-buffer, or manual frame
   selection like v1 instead of autoFrame). Even unoptimized, 1s beats v1's 3–7s for *everything*.
2. **PNG encode ≈ 150ms** — keep it **off** the interactive path. On-screen preview should blit
   the canvas via `createImageBitmap`/`drawImage` (~0ms); PNG `toDataURL` is only for saves/exports
   (or JPEG at ~23ms where lossy is fine).

**Warm boot ≈ 200ms** (one-time) — hidden behind pre-warm / double-buffer.

**Bonus: the warm model also fixes the font race.** Because fonts load once at boot and we redraw
after `document.fonts.ready`, `out-perf-denseRules.png` renders in the correct Beleren/Plantin
fonts with proper inline mana symbols — unlike the serif-fallback in the first Phase 0 demo.

### Optimization map (for Phase 1c)
| Cost | When | Strategy |
|---|---|---|
| ~1ms text redraw | every keystroke (debounced ~100–200ms) | direct `drawText()`, blit canvas |
| ~0ms preview blit | every redraw | `createImageBitmap`/`drawImage`, not PNG |
| ~1s frame change | color/type/layout change | pre-warm frame pool / double-buffer / manual frames |
| ~150ms PNG encode | save / export / print only | off interactive path; JPEG (~23ms) when acceptable |
| ~200ms warm boot | app start / new editor | pre-warm a hidden clean iframe |

### Scope caveat
Measured on the default `autoFrame` path (creature, incl. multicolor + dense rules). Draw cost
for planeswalker/transform/MDFC/token layouts is deferred to Phase 1b (needs the full driver),
but `drawCard` compositing is layout-independent, so the interactive redraw cost should stay in
the same ~1ms range; frame *setup* for those layouts is the variable to watch.

