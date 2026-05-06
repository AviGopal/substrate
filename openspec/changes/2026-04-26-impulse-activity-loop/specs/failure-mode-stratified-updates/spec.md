# failure-mode-stratified-updates Specification

## Purpose

Today, every execution failure increments the activity's Thompson β by 1, regardless of failure cause. This conflates structurally different failure modes: an activity that produced wrong outputs is treated identically to an activity that ran out of budget, was killed by safety guards, was the victim of an upstream cascade, or was interrupted by a human. The result is noisy posteriors that converge slowly and mislearn.

The `failure_mode` taxonomy already exists on `execution_traces` (per `2026-04-26-validators-and-failure-modes/specs/failure-mode-taxonomy/spec.md`). This spec wires it into the posterior-update path, replacing the binary β increment with a structured update keyed on `failure_mode.type`.

## Requirements

### Requirement: Single entry point for posterior updates

A single function `applyOutcomeToPosteriors(trace)` in `src/lib/posterior-update.ts` SHALL be the sole entry point for Thompson posterior updates from execution outcomes. All four current fetch-modify-write sites (execution-traces.ts:1938, activities.ts:3599, activities.ts:3639, goal-paths.ts:402) SHALL be replaced with calls to this function.

#### Scenario: Posterior update happens exactly once per execution outcome

- **WHEN** an execution completes (success or failure)
- **THEN** `applyOutcomeToPosteriors` is called exactly once with the full trace record
- **AND** the function returns a structured `UpdateSummary` enumerating which posteriors were modified and by what amount

### Requirement: Per-failure-mode update rules

`applyOutcomeToPosteriors` SHALL apply the following rules:

| Outcome | Activity α | Activity β | Side effects |
|---|---|---|---|
| `success` (no failure_mode) | += 1 | — | — |
| `verifier_negative` | — | += 1 | `impulse_relevance_metrics.times_failed += 1` for each `input_impulse_id` |
| `budget_exhausted` | — | += 0.5 | `cost_per_success` running average updated |
| `safety_breach` (cycle, depth) | — | += 1 | `compositionSuccess.safety_failed = true` for the violating edge |
| `cascading` | — | += 0 | full β += 1 propagated to `failure_mode.context.upstream_task_id`'s ancestor (handled by composition-chain-credit-propagation) |
| `user_abort` | — | — | none (human override is not negative reward) |

#### Scenario: verifier_negative writes to impulse_relevance_metrics

- **WHEN** a trace completes with `failure_mode.type === 'verifier_negative'` and `input_impulse_ids = ['shape_a', 'shape_b']`
- **THEN** the activity's β is incremented by 1
- **AND** two rows in `impulse_relevance_metrics` (one per input shape) have `times_failed` incremented by 1

#### Scenario: budget_exhausted applies smaller penalty

- **WHEN** a trace completes with `failure_mode.type === 'budget_exhausted'`
- **THEN** the activity's β is incremented by 0.5 (not 1)
- **AND** the activity's `cost_per_success` running average is recomputed including this failed execution's cost

#### Scenario: cascading does not penalize this activity

- **WHEN** a trace completes with `failure_mode.type === 'cascading'`
- **THEN** the activity's α and β are unchanged
- **AND** the upstream activity identified by `failure_mode.context.upstream_task_id` receives the failure penalty via the composition-chain-credit-propagation path

#### Scenario: user_abort changes nothing

- **WHEN** a trace completes with `failure_mode.type === 'user_abort'`
- **THEN** no posterior is modified
- **AND** the trace is still stored normally

### Requirement: Null failure_mode defaults to verifier_negative with logging

When `failure_mode` is `null` on a failed execution (legacy traces or unclassified failure paths), the update path SHALL apply `verifier_negative` semantics and emit a structured warning.

#### Scenario: Null failure_mode logged and handled

- **WHEN** a trace completes with `success === false` and `failure_mode === null`
- **THEN** `verifier_negative` rules apply (β += 1, impulse_relevance_metrics updated)
- **AND** a warning is logged with `level: warn`, `event: 'posterior_update.null_failure_mode_default'`, `executionId`, `activityId`

### Requirement: Atomic updates under concurrency

All α/β increments SHALL use SurrealDB's atomic `+=` operator (per surrealdb-rl-layer P1). Concurrent calls to `applyOutcomeToPosteriors` against the same activity SHALL not lose updates.

#### Scenario: Concurrent increments preserve total

- **WHEN** two `applyOutcomeToPosteriors` calls execute concurrently against the same activity, each applying success
- **THEN** the activity's final α value reflects both increments (initial + 2)
- **AND** neither call's update is silently dropped

### Requirement: Update summary observable for debugging

The function SHALL return an `UpdateSummary` object enumerating each posterior modified, the delta applied, and the reason. This summary SHALL be logged at `debug` level for every call.

#### Scenario: UpdateSummary records all modifications

- **WHEN** a `verifier_negative` failure with 3 input impulse ids is processed
- **THEN** the returned `UpdateSummary.modifications` has 4 entries: 1 for the activity β increment, 3 for the impulse_relevance_metrics updates
- **AND** each entry records `(target, field, delta, reason)`
