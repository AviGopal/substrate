# Tasks: Stratified Goal-Generator Harness

Phased rollout. Each phase has concrete deliverables and acceptance criteria. Checkbox
style matches `2026-04-26-impulse-activity-loop/tasks.md`.

---

## Phase G1 — Goal Generator (foundation, no LLM)

### G1.1 Stratification-axis enumerators

- [ ] G1.1.1 Implement `validation/scripts/lib/shape-signature-pool.ts` — scans
  `executionTraceWithSignatures` over the last 30 days and emits the
  `(input_shape_set, output_shape_set)` → count map. **Acceptance:** running against
  canary returns ≥ 100 distinct signatures with counts.
- [ ] G1.1.2 Implement `lib/decomposition-depth.ts` — given target `output_shapes` and
  `seed_impulse_pool`, returns shortest depth ∈ {0, 1, 2, 3+} via BFS over the
  `discover-by-shapes` backward mode (capability already exists, see `CLAUDE.md`
  "Selection-layer support"). **Acceptance:** unit test with hand-crafted shape
  graph returns expected depths for 6 fixtures.
- [ ] G1.1.3 Implement `lib/topology-gap-band.ts` — classifies (A/B/C/D) per the
  Phase 22 design. Reads discovery-vessel `/registry/shapes` + activity-api template
  `output_shapes` index. **Acceptance:** four hand-picked shapes correctly classified.
- [ ] G1.1.4 Implement `lib/shape-registry-hash.ts` — sorted-tuple SHA-256 over
  `(shape, owning_vessel_id)`. **Acceptance:** deterministic across two consecutive
  calls; changes when a vessel registers a new shape.

### G1.2 Deterministic generator (no LLM)

- [ ] G1.2.1 Write `validation/scripts/goal-generator.ts` accepting `--seed`,
  `--count`, `--novelty-mix`, `--depth-mix`, `--scenario-mix`,
  `--adversarial-fraction`, `--output`. Adversarial generation deferred to G1.3.
- [ ] G1.2.2 Seeded RNG (xorshift64 or `seedrandom` lib) drives stratum allocation
  and goal-template selection. **Acceptance:** same seed + same registry hash → byte-
  identical output JSON across two runs.
- [ ] G1.2.3 Goal-text templates: one short, parameterised natural-language string
  per (novelty × depth × scenario) cell, with parameter slots filled from the chosen
  shape signature. **Acceptance:** 24 templates exist; spot-check 6 reads as
  natural English.
- [ ] G1.2.4 Output schema includes `id`, `cell_id`, `shape_signature`, `goal_text`,
  `expected_output_shapes`, `seed_impulse_pool`, `adversarial: false`,
  `oracle_label_id: null`, `generator_seed`, `shape_registry_snapshot_hash`.

### G1.3 Adversarial-perturbation mode

- [ ] G1.3.1 Implement `lib/adversarial-mutate.ts` — takes a passing goal from a prior
  report, calls one LLM (temperature=0, model+prompt-hash recorded) to produce either
  a `swap_output_shape` or `narrow_constraint` mutation. **Acceptance:** seeded LLM
  call returns identical output across two runs given identical input.
- [ ] G1.3.2 Wire into `goal-generator.ts` behind `--adversarial-fraction`. Adversarial
  entries are 10% by default; LLM model+prompt-hash written into each affected goal.

### G1.4 Held-out suite

- [ ] G1.4.1 `--held-out` flag emits a 5–10 prompt suite using a weekly seed
  `(YYYY_WW_held_out_v1)`. **Acceptance:** running on Mondays 2026-W21 vs 2026-W22
  produces non-overlapping prompts.

---

## Phase G2 — Coverage-Matrix Reporting

### G2.1 Harness driver

- [ ] G2.1.1 Write `validation/scripts/stratified-harness.ts`. Reads a generated
  goal file, dispatches each goal to MiniBob CLI (`minibob --single`) with the
  `seed_impulse_pool` injected, captures the resulting trace via
  `GET /v2/activities/execution-traces/:id`. **Acceptance:** runs 5 goals end-to-end
  against canary.
- [ ] G2.1.2 Per-goal results assembled into `goals[]` array with full
  `composition_chain`, per-task fields, `decision_record` (when present), and witness
  pairs (when present).

### G2.2 Per-cell aggregation

- [ ] G2.2.1 Implement coverage-matrix computation per §B of `design.md`. Cells with
  sample_count < 3 are present but flagged `insufficient_sample`. **Acceptance:**
  matrix sums to total goal count.
- [ ] G2.2.2 Per-cell floor evaluation; emit `floor_pass` and top-level
  `universality_pass`. **Acceptance:** unit test with synthetic cell data covering
  pass, fail, and `gated_on_phase_22` cases.

### G2.3 Report output

- [ ] G2.3.1 Emit `validation/results/<date>-stratified-report.json` per the schema
  in §I. Include all summary fields and full `coverage_matrix`.
- [ ] G2.3.2 Extend `compare-reports.ts` (existing tool, see `validation/scripts/`)
  with a `--stratified` flag that diffs two stratified reports cell-by-cell.
  **Acceptance:** prints per-cell delta table; flags new cells, dropped cells, and
  floor-status flips.

---

## Phase G3 — Reuse Efficiency + Optimality Gap

### G3.1 Reuse-efficiency metric

- [ ] G3.1.1 Implement `lib/reuse-efficiency.ts` per §C. Reads
  `composition_chain`, `tasks[].activity_id`, `tasks[].cost_usd`, and the Thompson
  snapshot. **Acceptance:** unit test with synthetic chains returns expected ratios
  for 5 fixtures including the worked example in `design.md` §J.
- [ ] G3.1.2 Wire into `stratified-harness.ts`; cell value is mean over goals in cell.

### G3.2 Shortest-path cache

- [ ] G3.2.1 Implement `lib/shortest-paths.ts` with read/write under
  `validation/state/shortest-paths.json`, eviction (90 days + observation_count < 3).
  **Acceptance:** unit test covers fresh-cell, replace-shorter, no-replace-longer,
  evict-stale.
- [ ] G3.2.2 Wire into `stratified-harness.ts` post-run update step.

### G3.3 Optimality-ratio reporting

- [ ] G3.3.1 Compute `optimality_ratio` per cell, flag `closing`/`stable`/`regressing`
  vs. baseline report. **Acceptance:** end-to-end on two consecutive runs against
  canary produces non-trivial flags.

---

## Phase G4 — Refinement-Event Detection

### G4.1 Three detectors

- [ ] G4.1.1 Compression detector (§E.1). **Acceptance:** unit test fires on
  synthetic prior+current pair with chain reduction; does NOT fire when
  success_rate drops.
- [ ] G4.1.2 Tier-descent detector (§E.2). **Acceptance:** unit test fires when ≥ 30%
  of tasks at a chain position descended a tier; does NOT fire below threshold.
- [ ] G4.1.3 CI-narrowing detector (§E.3). **Acceptance:** unit test fires when
  ci_width drops ≥ 0.05 AND total_executions grew ≥ 5.

### G4.2 Pairwise comparison wiring

- [ ] G4.2.1 `stratified-harness.ts` accepts `--baseline-report <path>`. When set,
  runs all three detectors per cell, emits events.
- [ ] G4.2.2 Events written to `validation/results/<date>-refinement-events.json`.
  Top-level report records `refinement_event_count` and
  `refinement_event_density`.

---

## Phase G5 — Decision-Record Persistence

### G5.1 Activity-API recommend handler change

- [ ] G5.1.1 Modify `POST /v2/activities/recommend` to return a `decision_record`
  field per recommendation set with loser entries populated per §F.1. Top-K losers
  (K=5) kept on large responses. **Acceptance:** integration test against canary
  confirms `decision_record.candidates.length >= 3` on a query that returns ≥ 3
  candidates.
- [ ] G5.1.2 Persist `decision_record` into the execution trace `tasks[]` at task
  dispatch time (MiniBob side). **Acceptance:** trace fetched via
  `GET /v2/activities/execution-traces/:id` contains the field.

### G5.2 Completeness metric

- [ ] G5.2.1 Implement `lib/decision-record-completeness.ts` per §F.2. Samples up to
  5 tasks per trace by descending `cost_usd`. **Acceptance:** unit tests on synthetic
  traces with 0, partial, and full records.

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

- [ ] G8.1.1 Extend `run-weekly-harness.sh` (existing, see
  `validation/scripts/run-weekly-harness.sh`) to invoke
  `stratified-harness.ts` as a second job after the Phase 19 harness completes.
  **Acceptance:** both reports emitted in the same run; non-zero exit on stratified
  harness floor-fail mirrors the existing Phase 19 regression gate.
- [ ] G8.1.2 Update `.github/workflows/weekly-recommendation-validation.yml`
  (referenced in `2026-05-06-recommendation-validation-v2/design.md:339`) to upload
  the stratified report alongside the existing report.

### G8.2 First baseline

- [ ] G8.2.1 Run the stratified harness once on the date this phase completes; commit
  the report as `validation/baselines/<date>-stratified.json`. **Acceptance:** future
  runs use this file as `--baseline-report`.

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
