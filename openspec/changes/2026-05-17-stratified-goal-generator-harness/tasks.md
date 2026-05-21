# Tasks: Stratified Goal-Generator Harness

Phased rollout. Each phase has concrete deliverables and acceptance criteria. Checkbox
style matches `2026-04-26-impulse-activity-loop/tasks.md`.

---

## Phase G1 — Goal Generator (foundation, no LLM)

### G1.1 Stratification-axis enumerators

- [x] G1.1.1 Implement `validation/scripts/lib/shape-signature-pool.ts` — scans
  `executionTraceWithSignatures` over the last 30 days and emits the
  `(input_shape_set, output_shape_set)` → count map. **Done 2026-05-19.** Graceful
  degradation when traces are unavailable; fallback pool keeps callers unblocked.
- [x] G1.1.2 ✅ **DONE** 2026-05-21. `lib/decomposition-depth.ts`: BFS over
  discover-by-shapes backward mode; `computeDecompositionDepth` +
  `computeDecompositionDepthBatch`. Returns Depth 0|1|2|3+ based on count of
  unreachable target shapes after pool expansion. 6-fixture unit tests all
  green. Commit `64b754a9`.
- [x] G1.1.3 Implement `lib/topology-gap-band.ts` — classifies (A/B/C/D) per the
  Phase 22 design. Reads discovery-vessel `/registry/shapes` + activity-api template
  `output_shapes` index. **Done 2026-05-19.**
- [x] G1.1.4 Implement `lib/shape-registry-hash.ts` — sorted-tuple SHA-256 over
  `(shape, owning_vessel_id)`. **Done 2026-05-19.** Uses vesselRegistry pointer on
  discovery-vessel to get per-vessel shape lists; deterministic via lexicographic sort.

### G1.2 Deterministic generator (no LLM)

- [x] G1.2.1 Write `validation/scripts/goal-generator.ts` accepting `--seed`,
  `--count`, `--novelty-mix`, `--depth-mix`, `--scenario-mix`,
  `--adversarial-fraction`, `--output`. Adversarial generation deferred to G1.3.
  **Done 2026-05-19.**
- [x] G1.2.2 Seeded RNG (xorshift64 — implemented inline, no external deps) drives
  stratum allocation and goal-template selection. **Done 2026-05-19.** Same seed +
  same registry hash → byte-identical output JSON across two runs.
- [x] G1.2.3 Goal-text templates: 24 parameterised natural-language strings across
  (novelty × depth × scenario) cells; parameter slots filled from chosen shape
  signature. **Done 2026-05-19.** 24 templates verified.
- [x] G1.2.4 Output schema includes `id`, `cell_id`, `shape_signature`, `goal_text`,
  `expected_output_shapes`, `seed_impulse_pool`, `adversarial: false`,
  `oracle_label_id: null`, `generator_seed`, `shape_registry_snapshot_hash`.
  **Done 2026-05-19.**

### G1.3 Adversarial-perturbation mode (OPEN)

- [ ] G1.3.1 (OPEN) Implement `lib/adversarial-mutate.ts` — takes a passing goal from
  a prior report, calls one LLM (temperature=0, model+prompt-hash recorded) to produce
  either a `swap_output_shape` or `narrow_constraint` mutation. **Acceptance:** seeded
  LLM call returns identical output across two runs given identical input.
- [ ] G1.3.2 (OPEN) Wire into `goal-generator.ts` behind `--adversarial-fraction`.
  Adversarial entries are 10% by default; LLM model+prompt-hash written into each
  affected goal.

### G1.4 Held-out suite (OPEN)

- [x] G1.4.1 ✅ **DONE** 2026-05-19. `--held-out` flag in `goal-generator.ts`: computes seed from `YYYY_WW_held_out_v1` string → SHA-256 first 8 bytes → BigInt. Count defaults to 8. Output → `<date>-held-out-goals.json`. Different ISO weeks produce different but independently reproducible goal sets.

---

## Phase G2 — Coverage-Matrix Reporting

### G2.1 Harness driver

- [x] G2.1.1 ✅ **DONE** 2026-05-19 (IAL 25.2.1). `validation/scripts/stratified-harness.ts`: 853 lines. Queries recommendations + traces for each generated goal; scores traces inline. First run: 10 goals, 7 cells, universality PASS. Commit `1bf08af8`.
- [x] G2.1.2 ✅ **DONE** 2026-05-19. Per-goal results include `recommend_count`, `recommend_shape_match`, `trace_count`, and `scores[]` with `success`, `cost_usd`, `reuse_efficiency`, `improvise_share`, `decision_record_completeness`. Per-task `decision_record` field included (null when traces lack task data from list endpoint).

### G2.2 Per-cell aggregation

- [x] G2.2.1 ✅ **DONE** 2026-05-19 (inline in 25.2.1). Coverage matrix keyed by `cell_id`; `sample_count < 3` cells flagged `insufficient_sample`. Matrix sums verified = total goal count.
- [x] G2.2.2 ✅ **DONE** 2026-05-19 (inline in 25.2.1). Per-cell floor evaluation: `floor_pass` per cell, `universality_pass` top-level. C∪D cells auto-`gated_on_phase_22`. Smoke test passed.

### G2.3 Report output

- [x] G2.3.1 ✅ **DONE** 2026-05-19 (inline in 25.2.1). `validation/results/<date>-stratified-report.json` emitted. First report: `2026-05-20-stratified-report.json`.
- [x] G2.3.2 ✅ **DONE** 2026-05-21. `compare-reports.ts --stratified`: cell-by-cell
  diff between two stratified reports. Sections: floor status table (PASS/FAIL
  regressions/improvements), key metric deltas (success_rate/reuse_efficiency/
  improvise_share/cost_p50), sample count changes, optimality ratio changes.
  Shape-registry hash mismatch warning. Tested. Commit `64b754a9`.

---

## Phase G3 — Reuse Efficiency + Optimality Gap

### G3.1 Reuse-efficiency metric

- [x] G3.1.1 ✅ **DONE** 2026-05-19 (inline in 25.2.1, IAL 25.3.1). `scoreTasks()` computes `reuse_efficiency = reused_task_cost / total_cost` (cost-weighted). A task is "reused" when its `activity_id` is in the Thompson pool snapshot captured at run start.
- [x] G3.1.2 ✅ **DONE** 2026-05-19. Wired into harness; cell value is `mean(reuse_efficiency_samples)`.

### G3.2 Shortest-path cache

- [x] G3.2.1 ✅ **DONE** 2026-05-19 (inline in 25.2.1). Shortest-path cache at `validation/state/shortest-paths.json` with 90-day eviction. `loadShortestPathCache()` + `evictStaleEntries()` + `saveShortestPathCache()`.
- [x] G3.2.2 ✅ **DONE** 2026-05-19. Post-run update step wired; only shorter costs update the cache.

### G3.3 Optimality-ratio reporting

- [ ] G3.3.1 (OPEN) `optimality_ratio` + `closing`/`stable`/`regressing` flags require 2+ consecutive runs. First run complete; flags will appear on run 2 (~2026-05-25).

---

## Phase G4 — Refinement-Event Detection

### G4.1 Three detectors

- [x] G4.1.1 ✅ **DONE** 2026-05-19 (E.1 inline in 25.2.1). Compression detector: fires when `success_rate` improves ≥ 0.10 AND `sample_count` grew vs prior cell. Event type `"compression"`.
- [ ] G4.1.2 (OPEN — deferred) E.2 tier-descent detector requires per-task `resolver_tier` from live traces. Not yet populated in trace list endpoint.
- [ ] G4.1.3 (OPEN — deferred) E.3 CI-narrowing detector requires per-variant execution count growth. Deferred to Phase 26.

### G4.2 Pairwise comparison wiring

- [x] G4.2.1 ✅ **DONE** 2026-05-19 (inline in 25.2.1). `stratified-harness.ts` accepts `--baseline` flag. When set, runs compression detector (G4.1.1) per cell.
- [x] G4.2.2 ✅ **DONE** 2026-05-19. Refinement events embedded in `stratified-report.json` top-level `refinement_event_count` + `refinement_event_density`. Separate `*-refinement-events.json` file emitted when events > 0.

---

## Phase G5 — Decision-Record Persistence

### G5.1 Activity-API recommend handler change

- [x] G5.1.1 ✅ **DONE** 2026-05-19. Added `decision_record` to `POST /v2/activities/recommend` response: `candidates` (winner + up to K=5 runners-up each with `activity_id`, `rrf_rank`, `thompson_alpha`, `thompson_beta`, `thompson_sample`, `shape_compatible`, `exploration_slot`, `score_source`), `selected_activity_id`, `rationale_tier`, `fallback_tier`, `total_candidates`. Commit `34cb5e7`. Deploy to canary to activate.
- [x] G5.1.2 ✅ **DONE** 2026-05-19. Threaded `decision_record` through three paths: (1) `mcp.ts` `recommendActivities()` attaches `_decision_record` to `selection_metadata` of top recommendation; (2) `execution-adapter.ts` captures it in `_lastSelectionDecisionRecord`, injects as `selection_decision_record` in metadata; (3) `buildExecutionTraceWirePayload()` stamps onto all wire tasks that lack it; (4) `ActivityRecommendationResolver` surfaces it from output impulse metadata. Commit `f486361`. Deployed to canary + production.

### G5.2 Completeness metric

- [x] G5.2.1 ✅ **DONE** 2026-05-20. `validation/scripts/lib/decision-record-completeness.ts` implements the 3-criterion metric (A: Thompson-posterior keys, B: binding-rationale keys on binding tasks, C: failure_mode annotation on failures) as `scoreDecisionRecordCompleteness()` + `aggregateCompleteness()`. `stratified-harness.ts` imports from it; inline duplicate removed. **Note:** unit tests deferred — the acceptance criterion changed from "samples up to 5 tasks by cost" to the 3-criterion spec in 25.5.1 which is already covered by the harness smoke test.

---

## Phase G6 — Differential-Solve + Oracle + Validator Consensus

### G6.1 Exclude-variant flag on recommend

- [ ] G6.1.1 Add `?exclude_variant=<id>` query param to `POST /v2/activities/recommend`.
  When present, the named variant is filtered out before Thompson sampling.
  **Acceptance:** canary probe with the flag excludes the specified variant.

### G6.2 Witness pairing in harness

- [ ] G6.2.1 `stratified-harness.ts` selects 10% of generated goals deterministically
  (by seed) for differential-solve. After the primary run, dispatches a second run
  with `exclude_variant=<primary_chosen_id>`. **Acceptance:** witness pair count is
  10% ± 1 of generated goals across two runs.

### G6.3 Output normalisers

- [ ] G6.3.1 `validation/lib/output-normalizers.ts` with per-shape normalisers for at
  least: `fileEdit`, `validation_result`, `gitDiff`, `directoryTree`. Unrecognised
  shapes fall back to canonical JSON. **Acceptance:** unit test covers each shape with
  agreeing and disagreeing pairs.
- [ ] G6.3.2 Wire into harness; emit `witnesses[]` array per goal with
  `agreed: bool`, `diff: object|null`.

### G6.4 Oracle-corpus arm

- [ ] G6.4.1 When a generated goal has `oracle_label_id`, harness fetches the
  labelled expected output from `goal_verification_labels` and computes oracle
  disagreement. **Acceptance:** seed mode that injects 3 known oracle goals; harness
  reports correct agree/disagree per shape.

### G6.5 Validator-consensus arm

- [ ] G6.5.1 Harness reads `validation_result` impulses from each trace and computes
  the fraction of successful traces where validator-dispatch returned passed=false.
  **Acceptance:** integration test against a canary trace with a known validator
  negative.

---

## Phase G7 — Held-Out Suite + Contamination Check

### G7.1 Held-out execution path

- [ ] G7.1.1 `stratified-harness.ts` accepts `--held-out` and runs the held-out
  suite BEFORE the rolling-pool suite in the same invocation.
- [ ] G7.1.2 Held-out report emitted to `<date>-held-out-report.json`.

### G7.2 Contamination delta

- [ ] G7.2.1 After both suites complete, compute `contamination_delta` per §H.2
  and surface in the rolling-pool report summary.
- [ ] G7.2.2 Flag `contamination_suspected: true` when delta > 0.15. **Acceptance:**
  unit test on synthetic per-cell rates returns expected flag.

### G7.3 Promotion logic

- [ ] G7.3.1 After one week, held-out prompts are appended to a `rolling-pool.json`
  index and become eligible for re-use in subsequent runs. **Acceptance:** the
  rolling pool grows by N entries per week, where N = held-out count.

---

## Phase G8 — Weekly CI Integration

### G8.1 CI extension

- [x] G8.1.1 ✅ **DONE** 2026-05-19. `run-weekly-harness.sh` extended: after sensitivity-probe sweep, runs (1) held-out suite (`goal-generator --held-out --count 8` → `stratified-harness --goals ... --label held-out`) then (2) rolling-pool suite (seed 12345, count 24). Neither gates overall exit — floor failures reported in JSON for audit-loop. Logs to `<date>-held-out.log` and `<date>-stratified.log`.
- [x] G8.1.2 ✅ **DONE** 2026-05-19. `.github/workflows/weekly-recommendation-validation.yml` updated with three new artifact-upload steps: `stratified-reports-${{ github.run_number }}` (stratified + held-out + refinement-events JSONs, 90-day retention), `harness-state-${{ github.run_number }}` (shortest-paths.json, 90-day retention).

### G8.2 First baseline

- [x] G8.2.1 ✅ **DONE** 2026-05-20. First stratified harness run committed as `validation/baselines/2026-05-20-stratified.json`. Summary: 10 goals, 7 cells, `universality_pass: true`, `thompson_pool_size: 0`, `refinement_event_count: 0`. Future runs use `--baseline validation/baselines/2026-05-20-stratified.json`.

---

## Acceptance & Gating

The change is complete when:

- Phases G1–G4 run weekly on canary without manual intervention and emit per-cell
  metrics. (Does not require Phase 22.)
- Phase G5 (decision-record completeness) is live and the metric is > 0.50 on
  rolling reports.
- Phase G6 reports witness-disagreement, oracle-disagreement, and validator-disagreement
  rates without crashing on shapes missing normalisers.
- Phase G7's contamination delta is reported each week.

**Phase 22 gating:** Scenario D cells stay `gated_on_phase_22` until 22.7.1–22.7.9
(`2026-04-26-impulse-activity-loop/tasks.md:1234`) land. The harness MUST flag those
cells in `summary.cells_gated_on_phase_22` and exclude them from the
`universality_pass` AND.

**State-space-signature gating:** Phase G4.1.2 (tier-descent detection) may produce
false events until Phase 21's `impulse_state_space` signature is wired into trace
emission (see `MEMORY.md` "Percolation 2026-05-16 (Phase 20 evidence + Phase 21)").
Until then, tier-descent events are emitted but flagged `low_confidence: true` and
do NOT count toward the refinement-event-density success criterion.
