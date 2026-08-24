# Phase 0.7 — hidden-render, scaling, cross-talk

## Hidden-render correctness
Same card rendered visible vs hidden; % pixels differing from the visible render.

| hide mode | ready | blank | % vs visible |
|---|---|---|---|
| visible | true | false | 0% |
| offscreen | true | false | 0.118% |
| visibility | true | false | 0.118% |
| display | true | false | 0.118% |

## Scaling + cross-talk
K hidden instances, a distinct card rendered in each, then diffed vs a solo ground-truth.

| K | median ms/render | max ms | blanks | max cross-talk % | JS heap Δ (MB) |
|---|---|---|---|---|---|
| 1 | 2016 | 2016 | 0 | 0.639% | -39.6 |
| 2 | 1992 | 1992 | 0 | 0.639% | 4.6 |
| 4 | 1992 | 2030 | 0 | 0.639% | 5 |
| 8 | 2037 | 2182 | 0 | 0.619% | 70.3 |
| 16 | 2172 | 2700 | 0 | 0.643% | 140.7 |

**Hidden:** off-screen / visibility render correctly (<1% vs visible) → safe hiding technique. display:none noted separately.
**Scaling:** see max cross-talk (should stay low) + heap growth for pool-size N.

## Interpretation

- **Hiding: all three modes render identically to visible** (0.118%), including **`display:none`**
  (headless). Canvas draws to a backing store independent of on-screen layout, and we drive via
  direct `autoFrame()`/`drawText()` (not rAF/timers), so hidden instances render fine. Recommended
  default: **off-screen positioning** (safest across headed browsers, where `display:none` can
  throttle timers); `display:none` is a viable fallback.
- **Scaling to 16 hidden instances: 0 blanks, ~8% render-time growth** (2016→2172ms median) and
  **cross-talk stays <0.7%** — i.e. each instance renders *its own* card correctly despite shared
  same-origin `localStorage`. The feared cross-talk did **not** materialize (a wrong-card render
  would show tens of %). JS heap grows ~140MB at K=16 (native canvas memory is extra and uncounted,
  but there were no failures at 16).
- **Pool sizing:** 16 warm instances are comfortable on this machine. The "1 live + small LRU pool
  + cached static images" model is well within budget; a pool of ~6–8 is safe with headroom. (The
  ~2s here is the *full clean render* via DOM driving incl. a 650ms sleep + settle — not the ~1ms
  interactive patch from Phase 0.5/0.6.)

