# composition-chain-credit-propagation Specification

## Purpose

When a multi-step composed execution succeeds (e.g., `goal-processing-activity-driven → activity-recommendation → improvise → ...`), today only the leaf activity receives credit on its Thompson posterior. Ancestors that selected and dispatched the successful child receive nothing. This means the policy never learns that a particular orchestrator activity reliably leads to good outcomes — only the workhorses at the leaves accumulate signal.

This spec adds Monte Carlo return propagation: on every execution outcome, ancestors named in `composition_chain` receive γ-discounted fractional credit. This makes the composition graph a true policy representation — every edge accumulates evidence about whether traversing it leads to success.

## Requirements

### Requirement: Propagation along composition_chain

On every execution outcome (success or failure), `propagateCreditAlongChain` SHALL iterate the execution's `composition_chain` from leaf-to-root, applying γ-discounted updates to each ancestor's α (success) or β (failure).

`composition_chain` is a denormalized array on the execution record, root-first. Iteration depth SHALL be capped at `CREDIT_PROPAGATION_MAX_DEPTH` (default 4) to prevent unbounded propagation in deep nested executions.

#### Scenario: 4-deep success chain

- **WHEN** execution `D` succeeds with `composition_chain = [A, B, C]` (so ancestors at depths 1, 2, 3 are C, B, A respectively; `D` is the leaf)
- **THEN** the leaf `D` receives α += 1 (full credit per failure-mode-stratified-updates rules)
- **AND** ancestor `C` (depth 1) receives α += 0.5
- **AND** ancestor `B` (depth 2) receives α += 0.25
- **AND** ancestor `A` (depth 3) receives α += 0.125

#### Scenario: depth cap enforced

- **WHEN** an execution succeeds with a `composition_chain` of length 6 (depths 1–6)
- **THEN** propagation stops at depth 4
- **AND** ancestors at depths 5 and 6 receive no credit

### Requirement: Configurable decay factor

The decay factor γ SHALL be configurable via `CREDIT_PROPAGATION_GAMMA` environment variable, defaulting to `0.5`. Each depth level receives `γ^depth` of the leaf's credit.

#### Scenario: Decay factor from env

- **WHEN** `CREDIT_PROPAGATION_GAMMA=0.7` is set
- **AND** a 3-deep success chain executes
- **THEN** depth-1 ancestor receives α += 0.7
- **AND** depth-2 ancestor receives α += 0.49
- **AND** depth-3 ancestor receives α += 0.343

### Requirement: Cascading failures skip propagation past the upstream cause

When `failure_mode.type === 'cascading'`, propagation SHALL skip ancestors that are descendants of the upstream cause identified by `failure_mode.context.upstream_task_id`. The upstream cause's own ancestors propagate normally as failures; activities between the cause and the leaf do not.

#### Scenario: Cascading from middle of chain

- **WHEN** execution chain is `A → B → C → D` and `D` fails with `failure_mode = { type: 'cascading', context: { upstream_task_id: 'task_for_B' } }`
- **THEN** `D` receives no posterior update (cascading does not penalize the victim per failure-mode-stratified-updates)
- **AND** `C` receives no posterior update (also a victim of upstream cause)
- **AND** `B` receives β += 1 (the upstream cause; full failure credit)
- **AND** `A` receives β += 0.5 (B's parent; γ-discounted failure credit)

### Requirement: Atomic increment under concurrency

All ancestor updates SHALL use SurrealDB's atomic `+=` operator. Concurrent leaf executions sharing an ancestor SHALL not lose increments.

#### Scenario: Two concurrent leaves share an ancestor

- **WHEN** two child executions both succeed with the same parent `P` in their `composition_chain`
- **AND** they complete concurrently
- **THEN** `P.alpha` is incremented by `0.5 + 0.5 = 1.0` total
- **AND** neither increment is silently dropped

### Requirement: Propagation summary observable

The function SHALL return a `PropagationSummary` listing each ancestor updated with the depth, decay factor applied, and total delta. This summary SHALL be merged into the `UpdateSummary` from failure-mode-stratified-updates.

#### Scenario: Propagation summary merged with leaf update

- **WHEN** a 3-deep success chain executes
- **THEN** the returned summary has 4 modifications: 1 leaf (α += 1) plus 3 ancestor propagations (α += 0.5, 0.25, 0.125)
- **AND** total propagated credit equals `1 + sum(γ^d for d in 1..depth)` ≤ 2.0 for γ=0.5

### Requirement: Compatible with context-bucketed Thompson

When `context-bucketed-thompson-sampling` is active and a context bucket is computable for the ancestor, propagation SHALL update the bucketed posterior in addition to the global posterior. When no bucket is computable (legacy ancestors, missing context), propagation updates only the global posterior.

#### Scenario: Bucketed update on ancestor

- **WHEN** an ancestor activity has both global Thompson scores and a `context_thompson_scores` row for a bucket matching the ancestor's recommendation context
- **THEN** propagation updates BOTH the global and the bucketed posterior with the same delta
- **AND** the update is logged with both targets in the summary
