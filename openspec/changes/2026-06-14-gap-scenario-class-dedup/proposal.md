# Gap→scenario bridge: dedup by gap class to un-dilute the drafter

## Why

The autonomous authoring loop runs but no longer produces new capability — the
drafter no-ops every cycle. Diagnosis (2026-06-14, live): the drafter's scenario
dir held **7879 files across only 259 distinct gap classes**. Detectors re-emit
the same gap CLASS (e.g. `arch-pattern-catalogue-bloat`) with a fresh timestamp
every window, and `gap_to_scenario_bridge` deduped only by EXACT sanitized
gap-id — so every timestamped variant became a new scenario file.

`drafter-trigger-tick` shuffles and picks one scenario per tick; the drafter
rate-limits already-drafted classes. With 7879 near-duplicate files over 259
classes, a genuinely NEW gap class had only ~1/7879 odds of being picked per
tick — so new capability was authored ~30× slower than it should be, drowned in
duplicate-class noise. This is the rate-limiter on autonomous capability growth,
not the loop's correctness.

## What changes

- **`gap_to_scenario_bridge`** (`src/resolvers/gap-to-scenario-bridge.ts`): adds
  `classKey()` (cut a sanitized gap-id at its first timestamp / `exec_` marker)
  and a class-level dedup pass. Before writing a scenario, if a scenario of that
  gap CLASS already exists (on disk or written this run), skip it. Additive and
  safe — it can only skip MORE, never breaks existing scenario reads. New
  `skipped_class_duplicate` counter surfaced in `bridgeResult`.
- **One-shot prune** (operational): collapsed the existing 7879 scenarios to one
  newest-per-class → 259 files.

## Done when

- [x] `lint` green (120/120 shape-dispatch). Per-resolver test added (collapses
      timestamped + exec-id duplicates of a class to one scenario; keeps a
      distinct class). Full suite no regression (35 pre-existing fails unchanged).
- [x] Deployed: dev-vessel synced/restarted. Live bridge now reports
      `created:0, skipped_class_duplicate:2673` over 2694 gaps — no re-bloat.
- [x] Drafter scenario dir 7879 → 259; a new gap class now surfaces ~30× faster
      in the drafter's random pick.

## Effect on autonomy

This does not change the loop's correctness (it was already autonomous —
promoting variants on its own). It removes the dilution that made autonomous
authoring of GENUINELY NEW gap classes ~30× slower than the substrate's
detection rate. Convergence on known classes is unaffected; novelty throughput
improves.

## Follow-on

`capability_gap_audit` currently returns 0 — the substrate is converged on its
known gap classes. Further capability growth needs new gap classes, which come
from new work / new vessels / adversarial probes (the operator's post-lift role
per IAL §27.S.5), now no longer bottlenecked by scenario bloat.
