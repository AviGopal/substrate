# multi-witness-verification Specification

## Purpose

The single-witness metric (does this trace succeed?) cannot detect false positives:
the verifier may accept a trace whose output is wrong by some other accepted standard.
Multi-witness verification compares three independent witnesses — a second Thompson-
elected variant (differential-solve), a labelled oracle output (oracle corpus), and
the validator-dispatch consensus — and reports disagreement rates that bound the
false-positive surface.

This spec also defines the **decision-record** persistence requirement that the
harness depends on for introspectability: every recommend call must record all
considered candidates and their selection signals, not only the winner.

## Requirements

### Requirement: Decision record on every recommendation

`POST /v2/activities/recommend` SHALL return a `decision_record` field per
recommendation set containing the full candidate list (winner + top-K losers, K=5)
with the fields: `activity_id`, `fts_rank`, `dense_rank`, `rrf_score`,
`thompson_alpha`, `thompson_beta`, `thompson_sample`, `shape_compatible`. The record
SHALL also include `selected_activity_id`, `rationale_tier`
(one of `thompson_sample`, `shape_constraint`, `fallback_improvise`), and
`fallback_tier` (matching the existing recommend-response field).

MiniBob SHALL persist `decision_record` into the per-task entry of the execution
trace so it is fetchable via `GET /v2/activities/execution-traces/:id`.

#### Scenario: Recommend returns full record

- **WHEN** a recommend call returns ≥ 3 candidates
- **THEN** `decision_record.candidates.length >= 3`
- **AND** each candidate has all six required signal fields populated

#### Scenario: Recommend returns < 3 candidates

- **WHEN** the recommend pool has only 1 or 2 candidates
- **THEN** `decision_record.candidates` contains exactly those N candidates
- **AND** the harness records the trace as "complete given recommend cardinality"

### Requirement: Decision-record completeness metric

The harness SHALL compute `decision_record_completeness` per cell as
`complete_tasks / sampled_tasks` where: sampled_tasks are up to 5 tasks per trace
ordered by descending `cost_usd`; a task is complete iff its `decision_record` exists,
contains the required field set, and `rationale_tier` is non-null (or the recommend
pool was smaller than 3).

#### Scenario: Sampling biases toward expensive tasks

- **WHEN** a trace has 10 tasks, 3 of them LLM-tier and 7 deterministic
- **THEN** all 3 LLM-tier tasks are sampled before any deterministic task is
- **AND** the cell metric reflects LLM-task introspectability rather than
  deterministic-task introspectability

### Requirement: Differential-solve protocol

For 10% of generated goals (sampled deterministically by seed), the harness SHALL
re-dispatch the goal with `?exclude_variant=<primary_chosen_id>` on the recommend
endpoint, capture the second trace, and pair it with the first.

`POST /v2/activities/recommend` SHALL accept `exclude_variant` and filter the named
activity out of the candidate set before Thompson sampling.

#### Scenario: Second run uses a different variant

- **WHEN** the primary run elects `activity:A` and the harness re-dispatches with
  `exclude_variant=activity:A`
- **THEN** the second run elects some `activity:B != activity:A` if any other
  shape-compatible variant exists
- **AND** the second trace's `tasks[].activity_id` reflects the change

### Requirement: Output-set normalisation per shape

The harness SHALL register a normaliser per shape used in differential-solve
comparisons. Required normalisers: `fileEdit` (compare file-content hashes after diff
application), `validation_result` (compare `passed` and `failure_mode.type`),
`gitDiff` (compare patches at the file-set level after canonical reformat),
`directoryTree` (compare sorted file lists). Shapes without a registered normaliser
SHALL fall back to canonical-JSON string equality and be flagged
`normalizer: "fallback"`.

#### Scenario: Two semantically-identical fileEdits agree

- **WHEN** witness A produces a `fileEdit` adding a trailing newline and witness B
  produces a `fileEdit` adding the same trailing newline via different patch syntax
- **THEN** after applying each diff to the source, the resulting file hashes match
- **AND** the witness pair is marked `agreed: true`

#### Scenario: Unrecognised shape falls back

- **WHEN** a goal produces a shape with no registered normaliser
- **THEN** the harness compares canonical-JSON strings
- **AND** the witness pair carries `normalizer: "fallback"` in the report

### Requirement: Oracle-corpus arm

For goals carrying `oracle_label_id`, the harness SHALL fetch the labelled expected
output from `goal_verification_labels` (migration 101) and compute disagreement
against the produced trace using the per-shape normalisers.

#### Scenario: Oracle disagreement reported separately

- **WHEN** a goal with `oracle_label_id` produces an output that disagrees with the
  oracle on at least one shape
- **THEN** the report's `oracle_disagreement_rate` reflects that goal
- **AND** the goal entry records which shape disagreed and the normaliser used

### Requirement: Validator-consensus arm

The harness SHALL read `validation_result` impulses from each trace and compute
`validator_disagreement_rate` as the fraction of successful traces where
validator-dispatch returned `passed: false` for any task.

#### Scenario: Validator dissent on a "successful" trace

- **WHEN** a trace reports `success: true` overall but contains at least one
  `validation_result` impulse with `passed: false`
- **THEN** the trace counts toward `validator_disagreement_rate`
- **AND** the goal entry records the failing `validation_result.failure_mode.type`

### Requirement: Disagreement-rate aggregation

The harness SHALL report three disagreement rates at the top level:
`witness_disagreement_rate` (differential-solve), `oracle_disagreement_rate`,
`validator_disagreement_rate`. Each rate SHALL also be broken down per cell when
the cell's sample size for that arm is ≥ 3.

#### Scenario: Aggregate over arms

- **WHEN** all three arms have data
- **THEN** the report shows all three rates
- **AND** the highest of the three is flagged as the false-positive risk indicator
  in the summary section

### Requirement: Witness-rate floors

The harness SHALL flag a cell as `floor_pass: false` when
`witness_disagreement_rate > 0.15` for that cell with sample ≥ 3. The top-level
universality verdict aggregates this floor with the other per-cell floors.

#### Scenario: High-disagreement cell breaks universality_pass

- **WHEN** any cell with sample ≥ 3 reports `witness_disagreement_rate > 0.15`
- **THEN** `summary.universality_pass = false`
- **AND** the cell appears in `summary.cells_below_floor` with the disagreement metric
  identified as the failing dimension
