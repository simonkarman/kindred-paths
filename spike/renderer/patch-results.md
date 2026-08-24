# Phase 0.6 — interactive-patch feasibility

Patch (mutate `card.text` + direct `drawText()`, no autoFrame) vs a clean full render, compared by in-browser `getImageData` diff (match if <0.1% pixels differ).

| scenario | expected | % pixels diff | verdict | ok |
|---|---|---|---|---|
| control-clean-vs-clean | match | 0.118% | match | ✓ |
| name | match | 0% | match | ✓ |
| rules-short | match | 0% | match | ✓ |
| rules-long-autofit | match | 0% | match | ✓ |
| color-change | diverge | 42.819% | diverge | ✓ |
| type-change | diverge | 0.983% | diverge | ✓ |
| sequential-stability | match | 0% | match | ✓ |

**Result: PASS** — text patches (name/rules/auto-fit) match clean renders; color/type changes diverge (must full-render); a long-lived patched session stays stable.
