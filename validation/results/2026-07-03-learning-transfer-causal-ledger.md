# Learning-transfer detector — causal ledger (2026-07-03)

Question: do the four `learning_transfer_report` metrics *predict* the outcomes we care
about (reached-rate, cost, speed), or are they dials that don't move reality?

Method: unit of analysis = `goal_execution_paths` row (n=797, all with non-empty
`path_activities`). Each path was attributed per-metric by joining its activities to
`successor_features` (ψ cells), genuine `activity_composition_graph` edges, and
`variant_performance_metrics` (posterior depth). Buckets compared on pooled reached
rate (Σ successful / Σ total, two-proportion z), unweighted mean `success_rate`, and
median `avg_duration_ms` (bootstrap 95% CI on the median difference). Robustness cuts:
excluding satisfier-only paths, length-1 paths only (removes path-length confound), and
cross-stratification (SF within edge-negative, edge within SF-positive).

Baseline detector state at measurement: SF coverage 329/2345 = 14.0%, genuine-edge
density 0.079 vs uninformed fraction 0.070 (λ₁ ≳ ρ_grow by 0.01), stalled chains 0/145,
crystallized/uninformed fraction 6.95%.

## Ledger

| Metric | Reached-rate | Cost | Speed | Verdict |
|---|---|---|---|---|
| **SF coverage** | **Positive, robust.** +6.6pp pooled (12.3% vs 5.7%, z=4.4); len-1 only +7.6pp (z=5.0, unweighted 15.2% vs 5.6%); survives within edge-negative stratum (+4.0pp, z=3.0, unweighted 14.5% vs 5.8%) | unmeasurable | No credible signal (SF paths *slower* in median, but lo-bucket median 374 ms is fast-fail traffic — duration confounded by task substance) | **Optimize** (for reliability, not speed) |
| **Genuine-edge density (λ₁ side)** | **Strongest association.** +26.4pp pooled (34.1% vs 7.6%, z=18.7); len-1 +34.8pp (z=20.9); holds within SF-positive (+28.1pp) | unmeasurable | Positive: edge paths faster (median 4.9 s vs 16.0 s non-satisfier; −3.3 to −11.5 s CI len-1) | **Optimize, with a circularity caveat** — genuine edges are *minted from* successful shape-flow, so part of the association is past success causing the metric, not the metric causing future success. §2 A/B is the discriminating test. |
| **Stalled-credit count** | Degenerate: 0 stalled / 145 chains — zero variance, nothing to stratify | unmeasurable | — | **Untestable today.** Keep as a tripwire (alarm-on-nonzero), not an optimization target. |
| **Crystallized/uninformed fraction** | **No positive relationship.** Per-path proxy (posterior depth of path cells, median split): deep cells reach *less* pooled (10.4% vs 16.1% len-1, z=−3.9) and the unweighted comparison flips sign (Simpson's-paradox pattern) — no consistent direction | unmeasurable | Deep paths much slower (median 19.3 s vs 0.1 s len-1) — confounded by workhorse templates carrying hard goals | **Do not optimize on outcome grounds.** Population-level hygiene/bookkeeping dial for the λ₁ ≳ ρ_grow inequality only. |
| **Cost (outcome axis)** | — | **Cost telemetry is dead substrate-wide**: `cost_usd` = 0 and `tokens_* `= 0 on all 210,955 traces; 1/797 goal paths has nonzero `avg_cost_usd`. No metric can be validated against cost until cost propagates from llm-resolver-vessel into traces. | — | **Separate gap** (filed conclusion, not a detector-metric verdict). |

Useful internal control: raw execution count (depth) predicts *worse* reached-rate while
SF predicts better — so the SF signal is not merely "this template runs a lot" (ψ rows are
written on ingestion, which could otherwise make SF a popularity proxy).

All associations are correlational; §2 below is the causal test for the surviving metric.

## §2 — before/after A/B on SF coverage

The detector's gap `learning-transfer-sf-coverage-low` (filed 2026-07-03T10:40Z,
`substrate_detected`, performance_inefficiency) is the fix vehicle. ψ is only written on
live trace ingestion (`execution-traces.ts` → `updateSuccessorFeatures`), so historical
informed cells (~1,850) never acquire vectors — hence 14%. Fix authored by the loop
(feature_compose): a startup backfill job computing ψ for informed cells lacking a
`successor_features` row from their recent successful traces.

BEFORE snapshot (2026-07-03T12:05Z):
- sf_coverage 0.1403 (329/2345); edge density 0.0789; uninformed 0.0695; stalled 0
- 24 h outcome window: 11,960 traces, exit-success 82.0%, mean duration 8,269 ms;
  goal paths touched in 48 h: pooled reached 133/2079 = 6.4%

### How the fix landed (8 compose rounds + 2 operator repairs)

Goal-host dispatches (both `reached:false`, oracle-labelled `not_reached`):
- `0521c120…` — feature_compose decompose "plan had no ops" (prose-heavy goal). β-penalised.
- `4c30ae53…` — goal-target inference read the op spec as `source_code`/`fileWriteResult`
  (named file didn't exist yet → edit-intent route didn't engage); generic file chain ran,
  reach-gate correctly called the hollow.

Direct `feature_compose` resolves on development-vessel (gap threaded, `land:true`):
- R1: applied + typecheck PASS, semantic gate refused — dynamic `import().then(({fn})=>fn())`
  read as zero callers (analyzer false-negative class). Rolled back.
- R2 (static import + direct call): **LANDED** `a0bf985` — job + wiring.
- R3 (startup ordering): call ran at import time before DB connect
  (`ConnectionUnavailableError`); surgical delay **LANDED** `36be0b2`.
- R4/R5 (query correctness): backfilled 0/2182 — two real bugs found by direct probing:
  trace `variant_id` carries `activity:` prefix vs bare `variant_performance_metrics.activity_id`
  (**LANDED** `edb5375`), and SurrealDB 3.x "Missing order idiom" — ORDER BY field must be in
  the SELECT list; the parse error was silently eaten by the per-cell catch (**LANDED** `d1400b6`).
- R6–R8 (performance restructure): all rolled back UNFAVORABLE on semantic-gate
  static-analysis false-negatives (`new Set(rows.map(...))` read as never-populated; full-file
  rewrite via edits emitted as empty diff). R7's rollback of a create_file op **deleted the
  existing file** (restored by operator from git — rollback treats overwrite as create).

Operator completions (documented, committed):
- One-shot backfill executed the **landed estimator** (`updateSuccessorFeatures`) out-of-band
  with a bulk-fetch driver: 104 cells backfilled, 0 errors (18 exact-id + 85 bracket-normalized
  + 1 from the landed job's own run).
- Pre-filter patch (skip cells with no surviving traces) operator-landed as `2504304` after the
  three gate refusals — without it the startup job did ~3.5 h of 6 s/cell full scans per restart,
  never completing inside the dev-loop's restart cadence.

### Instrument-regression incident

At 13:30 a substrate cutover overwrote the **implemented** `learning_transfer_report` resolver
with its 590-byte skeleton on every disk copy — the implementation had only ever existed in the
runtime, never committed. Detector silently regressed to `scanned:false`. Restored from the
operator session transcript, typechecked, committed + pushed (`96c2aaa`). Lesson (also in
concept-db, `concept_RMOtLH0qtDpP`): runtime-vs-git drift is one cutover from data loss.

AFTER snapshot (2026-07-03T14:04Z):
- **sf_coverage 0.1808 (424/2345) — up from 0.1403.** Metric moved in-window, mechanism proven.
- edge density 0.0789, uninformed 0.0695, stalled 0 — unchanged, as expected (untouched).
- **Measured ceiling**: only ~104 uncovered cells had ANY surviving signed trace — the
  2026-07-02 trace-retention sweep destroyed the evidence for ~2,000 informed cells. The gap's
  50% floor is unreachable from stored traces; written back onto the gap record so the loop
  stops burning on it. Further coverage growth must come from live re-execution (the ingestion
  path already writes ψ per trace).

### Outcome delta — honest status

The coverage delta (+4.05 pp, 95 new ψ rows) landed at 13:50–14:00Z. ψ affects selection via the
`SF_BLEND` readout in recommend (`⟨ψ(s,a), R⟩` steering when `completion_shapes` present), so the
outcome effect accrues only as goal traffic touches the 104 newly-covered cells. A same-hour
reached-rate comparison would be noise dressed as proof. What §1 licenses as the expected
direction: SF-covered paths reach at +6–8 pp (z ≈ 4–5) — the follow-up measurement is to re-run
the §1 stratification plus the 24 h outcome window after ≥48 h of natural traffic and check the
newly-covered cells' reached-rate against their own pre-backfill baseline (6.4% pooled window).
If that shows no movement, SF coverage's §1 correlation should be downgraded to
selection-artifact (templates that already reach get ψ vectors), not causation.
