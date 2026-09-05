# stratified-goal-generator Specification

## Purpose

A reproducible, seeded generator that emits goals stratified along four axes — shape-
signature novelty, decomposition depth, topology-gap band (Scenarios A/B/C/D), and
adversarial perturbation — so the harness can measure universality (every cell above a
floor) rather than averaging over a fixed benchmark. The generator is the foundation
for the coverage-matrix, optimality-gap, and contamination-check reporting added by
this change.

## Requirements

### Requirement: Seeded reproducibility

The generator SHALL emit byte-identical output given the same `--seed` and the same
shape-registry snapshot hash. The shape-registry snapshot hash SHALL be recorded in
every emitted goal so a later reader can verify reproducibility.

#### Scenario: Same seed, same registry → same output

- **WHEN** the generator runs twice with the same `--seed` and the same canary state
- **THEN** the two output files are byte-identical
- **AND** the `shape_registry_snapshot_hash` field on every goal matches between runs

#### Scenario: Different registry → different output, flagged

- **WHEN** the generator runs with the same `--seed` but a different
  `shape_registry_snapshot_hash` than a referenced baseline
- **THEN** the harness refuses to compare reports without `--allow-snapshot-drift`
- **AND** the report records both hashes

### Requirement: Stratification axes

The generator SHALL accept stratification-mix flags `--novelty-mix`, `--depth-mix`,
`--scenario-mix`, `--adversarial-fraction`. The emitted goal set SHALL match the
requested mix within ±10% per stratum or within 1 goal, whichever is larger.

#### Scenario: Mix honored

- **WHEN** the generator runs with `--count 50 --novelty-mix 0.4,0.4,0.2`
- **THEN** the output contains 20±5 `seen`, 20±5 `rare`, and 10±5 `novel` goals
- **AND** each goal's `cell_id` reflects its assigned stratum

### Requirement: Cell taxonomy

Each emitted goal SHALL carry a `cell_id` of the form `<novelty>|depth<n>|<scenario>`
where novelty ∈ {`seen`, `rare`, `novel`}, n ∈ {0, 1, 2+}, scenario ∈ {`A`, `B`,
`C∪D`}. The grid SHALL collapse to 24 cells; future grid expansion is a versioned
change.

#### Scenario: cell_id always parseable

- **WHEN** any emitted goal is loaded by the harness
- **THEN** `cell_id` parses into the three components without error
- **AND** the components match the goal's `shape_signature` and depth analysis

### Requirement: No LLM in the deterministic path

The non-adversarial generator path SHALL NOT call any LLM. Goal text SHALL come from
parameterised templates filled with chosen shape names. This guarantees zero LLM
non-determinism in the bulk of the generated set.

#### Scenario: Default run uses zero LLM calls

- **WHEN** the generator runs with `--adversarial-fraction 0`
- **THEN** no entry in the LLM API audit log is recorded for the run
- **AND** the report's `llm_calls_at_generation` field is `0`

### Requirement: Adversarial-perturbation mode is seeded

The adversarial path SHALL call an LLM with temperature 0, a fixed prompt template,
and a deterministic input drawn from a prior passing report. The LLM model id and the
prompt-template hash SHALL be recorded per affected goal.

#### Scenario: Adversarial outputs reproducible

- **WHEN** the generator runs twice with the same `--seed`, the same prior-report
  reference, and the same LLM model id
- **THEN** every adversarial-mutated goal is byte-identical between runs
- **AND** `llm_model_id` and `prompt_template_hash` are recorded per goal

### Requirement: Held-out suite generation

The generator SHALL accept `--held-out` and emit a 5–10 prompt suite using a weekly
seed `(YYYY_WW_held_out_v1)`. The held-out output SHALL be written to a distinct file
so it is not co-mingled with the rolling-pool suite.

#### Scenario: Two adjacent weeks produce disjoint suites

- **WHEN** the generator runs with `--held-out` in week W and again in week W+1
- **THEN** the two suites share no goals
- **AND** each suite's seed reflects its ISO week number

### Requirement: Output schema

Every emitted goal SHALL contain the fields: `id`, `cell_id`, `shape_signature`
(`{input: string[], output: string[]}`), `goal_text`, `expected_output_shapes`,
`seed_impulse_pool`, `adversarial` (boolean), `oracle_label_id` (string|null),
`generator_seed` (number), `shape_registry_snapshot_hash` (string), and — when
`adversarial: true` — `llm_model_id` and `prompt_template_hash`.

#### Scenario: Field set is complete

- **WHEN** any emitted goal is JSON-parsed
- **THEN** all required fields are present with non-null values (except
  `oracle_label_id` which MAY be null)
- **AND** schema validation against the typed Zod definition passes

### Requirement: Phase-22 gating of Scenario D

Until the autonomous-vessel-forge phase (`2026-04-26-impulse-activity-loop/design.md`
§Phase 22) is deployed and validated, Scenario D goals SHALL be tagged
`gated_on_phase_22: true`. The harness MUST treat these cells separately from
`universality_pass` evaluation.

#### Scenario: Scenario D before forge

- **WHEN** the generator runs against a canary where the autonomous-vessel-forge has
  not been validated (Phase 22.7.x tasks are not all complete)
- **THEN** every Scenario D goal carries `gated_on_phase_22: true`
- **AND** the resulting cells appear in `summary.cells_gated_on_phase_22` rather than
  in `summary.cells_below_floor`
