# Proposal: Stratified Goal-Generator Harness

## Why

Both deployed harnesses sample a **fixed** prompt distribution. The Phase 18 harness
(`validation/scripts/reuse-harness.ts:1`) and its Phase 19 successor
(`openspec/changes/2026-05-06-recommendation-validation-v2/proposal.md:39`) score the system
against the same 20 entries in `validation/activity-reuse-benchmark-v2.json`. The success
criterion in `2026-04-26-impulse-activity-loop/proposal.md:31` ("reuse rate trends upward and
improvise-share trends downward") is therefore measured only over the regions of
goal-space those 20 prompts happen to cover. We cannot make the stronger claim the
foundation requires — that **for an arbitrary goal**, the loop builds out enough topology
to resolve it — because every reported metric averages over a benchmark the system has
seen weekly since 2026-05-13 (see the file list under `validation/results/`).

This change introduces a goal **generator** stratified by what makes goals hard, plus the
five reporting dimensions that turn universality from rhetoric into a number: coverage
across difficulty bands, reuse efficiency weighted by cost, optimality-gap tracking,
per-prompt refinement-event detection, decision-record completeness, and false-positive
resistance via multi-witness disagreement. It is **additive to Phase 19**: the two-metric
split (`search_mrr` / `recommend_mrr`), the quadrant diagnostic, and the behavioral health
block (`improvise_health`, `executability`, `resolver_coverage`, `reuse_trajectory` —
defined in `2026-05-06-recommendation-validation-v2/design.md:382`) continue to run on
the curated v2 benchmark. The new harness runs alongside it on **generated** prompts and
emits a separate report stream.

## What Changes

- **Stratified generator** (`validation/scripts/goal-generator.ts`). Produces a goal set
  deterministically from a seed, stratified along four axes: shape-signature novelty
  (`(input_shape_set, output_shape_set)` tuples never co-occurred in any
  `executionTraceWithSignatures` row); decomposition depth required (1, 2, or 3 levels
  of `create-shape-provider-goal`); topology-gap band (Scenarios A/B/C/D from the
  Phase 22 design, `2026-04-26-impulse-activity-loop/design.md:1184`); adversarial
  perturbation (mutate a passing prompt to require a slightly different shape signature).
  No LLM call at generation time except for the adversarial-perturbation mode, which is
  seeded.
- **Coverage matrix reporting**. Rows = difficulty bands (cross-product of the four
  stratification axes, collapsed to a ~24-cell grid). Columns = `success_rate`,
  `cost_p50`, `reuse_efficiency`, `improvise_share`, `decision_record_completeness`,
  `witness_disagreement`. Universality is "no row drops below a per-cell floor."
- **Reuse efficiency metric**. Cost-weighted ratio
  `Σ(cost of tasks dispatched against a pre-existing template) / Σ(total trace cost)`
  per goal, aggregated by band. Replaces the binary "is this trace improvise?" signal
  that `reuse_trajectory.reuse_rate` (`2026-05-06-recommendation-validation-v2/design.md:572`)
  computes today.
- **Optimality-gap tracking**. For each goal-class (defined by stratification cell),
  cache the **shortest known successful path** (lowest cost-weighted task chain that
  satisfied the goal verifier). Report `actual_cost / shortest_known_cost` per run.
  Closing the gap = refinement.
- **Refinement-event detection**. Per goal-class, detect three concrete signature
  shifts between consecutive runs that carry positive outcome deltas: (1) chain-length
  decrease (compression); (2) tier descent — task previously resolved by `resolver_tier
  = "llm"` now resolved by `"pattern"` or `"deterministic"`; (3) Thompson CI narrowing
  below a threshold (the `ci_width_delta` field already in the snapshot, see
  `activity-reuse-validation-harness/spec.md:46`). Emit one event per shift.
- **Decision-record completeness**. Per task, the percentage with a fully structured
  decision record: candidates considered (top-N from recommend response), retrieval-rank
  breakdown (FTS rank, dense rank, RRF rank), Thompson sample value, selected variant,
  rationale tier (which sub-resolver answered). This is the introspectability metric.
  Today the live trace only carries `selection_metadata.alpha` / `.beta` / `.sample`
  on the *winning* variant (`reuse-harness.ts:37`); the new field requires the loser
  list to be persisted as well.
- **Multi-witness disagreement rate**. A differential-solve mode that, for a sampled
  subset of goals, forces two runs using different Thompson-elected variants and reports
  normalized-output disagreement. Plus oracle-corpus regression on the labeled prompts
  already captured in `goal_verification_labels` (migration 101, see `CLAUDE.md`
  "Schema and storage"). Plus an automated-validator consensus check against the
  `validator-dispatch` outputs already in the trace stream. Three-way disagreement is
  the false-positive signal.
- **Held-out suite rotation**. A separate 5–10 prompt generator-produced set is run
  for the first time **each week**, then frozen into the regular pool. Detects benchmark
  contamination — if reported metrics on prior weeks' suites diverge upward from the
  fresh suite, the system has been overfitting to its benchmark history.

## Success Criteria

The harness is producing useful signal when:

1. **Universality coverage** — no stratification cell with sample size ≥ 3 reports
   `success_rate` < 0.30 over two consecutive runs without an open `failure_mode`-tagged
   action item. Cells below the floor are the work queue.
2. **Reuse efficiency** trends upward and exceeds **0.50** within 6 weeks of deploy
   (vs. the un-cost-weighted `reuse_rate ≥ 0.65` target in
   `2026-05-06-recommendation-validation-v2/proposal.md:96` — efficiency is stricter
   because expensive improvise paths penalize the ratio more than cheap reused paths).
3. **Optimality gap** for any goal-class that has reached `n ≥ 5` successful runs is
   ≤ **1.5×** the shortest known path, and the gap narrows over time
   (`Δ(actual/shortest) < 0` between consecutive runs for ≥ 60% of cells with n ≥ 5).
4. **Refinement-event density** of ≥ 1 event per 50 traces over a 2-week trailing
   window. Zero events for two weeks means the loop has stopped learning.
5. **Decision-record completeness** ≥ 0.80 across sampled tasks within 4 weeks
   (today: ~0.0 — only the winner is recorded). Stable at 0 means introspection is
   blocked and the metric is unactionable.
6. **Witness-disagreement rate** ≤ **0.10** between Thompson-elected variants;
   ≤ **0.05** against the oracle corpus; ≤ **0.05** against validator-dispatch.
   Disagreement > 0.10 is a false-positive alarm.

## Capabilities

### New Capabilities

- `stratified-goal-generator` — deterministic seeded generator over four stratification
  axes, with an LLM-backed adversarial-perturbation mode whose seed is recorded in the
  report. Spec: `specs/stratified-goal-generator/spec.md`.
- `coverage-matrix-reporting` — per-cell metric table with per-cell floors and a
  universality verdict, emitted as `coverage_matrix` in the report JSON.
- `reuse-efficiency-metric` — cost-weighted task-level reuse ratio computed from
  `composition_chain` + per-task `resolver_tier` + `cost_usd`, fields already on the
  trace (`reuse-harness.ts:79`).
- `optimality-gap-tracking` — per goal-class shortest-known-path cache under
  `validation/state/shortest-paths.json`, eviction by 90-day staleness.
- `refinement-event-detection` — three signature-shift detectors emitting events into
  `validation/results/<date>-refinement-events.json`.
- `decision-record-schema` — new persistence requirement: the **loser** list from each
  Thompson selection is recorded alongside the winner. Wires `selection_metadata` on
  all candidates, not just the chosen one. Spec section in
  `specs/multi-witness-verification/spec.md`.
- `differential-solve-witness` — protocol for forcing a second run with a different
  Thompson-elected variant and comparing outputs. Spec:
  `specs/multi-witness-verification/spec.md`.
- `held-out-prompt-rotation` — generator emits a small first-time suite per week,
  segregated from the rolling pool, with a contamination-detection comparison.

## Impact

- **No production code changes** beyond persisting the **loser** list in
  `selection_metadata` (one field addition in the activity-api recommend handler;
  required for decision-record completeness ≥ 0.80).
- New scripts under `validation/scripts/`; new artefacts under `validation/state/` and
  `validation/results/`. The Phase 19 weekly CI (`run-weekly-harness.sh`,
  `2026-05-06-recommendation-validation-v2/design.md:286`) is extended to dispatch the
  new generator harness in a second job; existing job runs unchanged.
- Cost: ~$10 per run (50–100 generated prompts, ~$0.10 each, plus differential-solve
  doubling on ~10% of samples). Twice the current Phase 19 budget but bounded.

## Dependencies

- **`recommendation-validation-v2`** (`openspec/changes/2026-05-06-recommendation-validation-v2/`)
  — V2.4 behavioral health metrics. The new harness reads the same trace shape and
  shares helper functions.
- **Phase 22 — Autonomous Vessel Forge** (`2026-04-26-impulse-activity-loop/design.md:1178`)
  — required for Scenario D coverage (missing-vessel forge required) to drop below the
  per-cell floor. Until 22.7.1–22.7.9 land, Scenario D cells will report
  `success_rate = 0`; the harness MUST flag this as `gated_on_phase_22` rather than as
  a regression. Cells A/B/C are testable on current canary.
- **State-space-signature work** (`openspec/changes/2026-04-29-state-space-aware-recommendations/`,
  Phase 11 of the umbrella) — refinement-event detection sensitivity depends on the
  `impulse_state_space` / `blocking_shapes` signature that Phase 21 adds to the
  workbench (`2026-04-26-impulse-activity-loop/tasks.md:78` — the Phase 21 closure
  note). Without it, "compression" events are detectable but "tier descent" events
  can be confounded with state-space changes.
- **Migration 101** (`goal_verification_labels`) — required for the oracle-corpus arm
  of `differential-solve-witness`. Already deployed.
