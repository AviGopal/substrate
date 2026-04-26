# Failure Mode Taxonomy

## Overview

The failure mode taxonomy is a structured classification system for execution failures introduced in migration 091 (2026-04-26). It categorizes failures into distinct types with variant-specific metadata, enabling targeted learning and improvement.

**Related OpenSpec**: [2026-04-26-validators-and-failure-modes](../../openspec/changes/2026-04-26-validators-and-failure-modes)

## Motivation

Previously, execution trace failures were binary (success/failure) without stratification. This makes it difficult to:
- Identify which failure types are most costly
- Learn specific recovery strategies per failure type
- Route failures to appropriate remediation activities
- Detect systemic issues (e.g., frequent validator rejections vs budget exhaustion)

The failure mode taxonomy enables **typed failure learning** — activities can be optimized differently depending on why they failed.

## Data Model

Stored on `activity_execution_traces.failure_mode` (optional object field, null for legacy traces):

```typescript
failure_mode: {
  type: "verifier_negative" | "budget_exhausted" | "safety_breach" | "cascading" | "user_abort"
  reason: string  // Human-readable description
  // Variant-specific fields below
} | null
```

**Key characteristics:**
- **Null for legacy traces** — no backfill required; schema evolution is non-breaking
- **Optional per execution** — set only when execution fails
- **Discriminated union** — TypeScript `FailureModeSchema` uses zod discriminatedUnion for type safety
- **Metadata-only** — Thompson Sampling updates remain uniform (all failures increment β equally; stratification happens in learning layer)

## Failure Types

### 1. `verifier_negative` — Validator Rejection

A validator or check explicitly rejected the output.

**Schema:**
```typescript
{
  type: "verifier_negative"
  reason: string
  validator_id: string
  failed_evidence: [{
    check_id: string
    details: string | null
    location: string | null
  }]
}
```

**Examples:**
- SQL schema constraint validation failed
- API response schema doesn't match expected shape
- Code linting/type-check failures
- Custom assertion in activity validation block

**Learning Application:**
- Identify which validators are most frequently triggered
- Extract patterns (e.g., "validator X fails 60% of the time for template Y")
- Create fine-tuned variants that pre-check validator constraints
- Adjust task prompts based on failed_evidence patterns

### 2. `budget_exhausted` — Resource Limit Exceeded

Execution consumed more resources (cost or duration) than allowed.

**Schema:**
```typescript
{
  type: "budget_exhausted"
  reason: string
  budget_type: "cost" | "duration"
  consumed: number    // Actual usage (USD or ms)
  allowed: number     // Budget limit
}
```

**Examples:**
- LLM token usage exceeded cost budget
- Task execution exceeded duration timeout
- Cumulative tool call costs exceeded per-activity limit

**Learning Application:**
- Identify tasks/activities that consistently overspend
- Adjust budgets based on consumption patterns
- Create lower-cost variants (shorter context, simpler LLM model)
- Parallelize or decompose tasks to reduce duration

### 3. `safety_breach` — Depth or Cycle Safety Guard Triggered

Execution violated a safety constraint (recursion depth, infinite loop detection).

**Schema:**
```typescript
{
  type: "safety_breach"
  reason: string
  breach_type: "depth" | "cycle"
  limit: number | null  // Only set for depth; cycles don't have a numeric limit
  ancestor_chain: string[]  // Task IDs from root to breach point
}
```

**Examples:**
- Activity composition exceeded max depth (e.g., >50 nested tasks)
- Cycle detected in task graph (or speculative state space)
- Recursive template invocation hit depth limit

**Learning Application:**
- Detect overly deep compositions
- Identify activities that spawn recursive execution
- Adjust composition complexity or decompose into separate activities
- Use ancestor_chain to suggest refactoring points

### 4. `cascading` — Upstream Task Failure

Execution failed because an earlier task in the same execution failed.

**Schema:**
```typescript
{
  type: "cascading"
  reason: string
  upstream_task_id: string
  upstream_failure_mode: FailureMode | null  // Recursively contains upstream failure if known
}
```

**Examples:**
- Task A failed (verifier_negative), causing Task B to be skipped or fail
- An impulse resolution failed, causing dependent tasks to fail
- A prerequisite check failed, causing the main task to abort

**Learning Application:**
- Distinguish "directly caused" from "cascading" failures
- Improve upstream task reliability to reduce cascading damage
- Implement fallback/retry strategies for high-impact upstream tasks
- Extract weak-link identification (which upstream tasks cause most cascade failures?)

**Recursive Nature:**
The `upstream_failure_mode` can contain another `failure_mode`, forming a chain. This enables deep-cause analysis:
```
Task C failed (cascading: Task B)
  ← Task B failed (cascading: Task A)
    ← Task A failed (verifier_negative)
```

### 5. `user_abort` — User-Initiated Cancellation

User explicitly cancelled the execution.

**Schema:**
```typescript
{
  type: "user_abort"
  reason: string
  abort_source: string  // e.g., "workbench_cancel_button", "cli_ctrl_c", "activity_timeout_escalation"
}
```

**Examples:**
- User clicked "Cancel" in workbench UI
- User pressed Ctrl+C during MiniBob execution
- Activity exceeded a high-level timeout that escalated to abort

**Learning Application:**
- Track which activities/templates are frequently aborted (may indicate poor UX or slow performance)
- Use abort timing to identify performance bottlenecks
- Distinguish user-initiated aborts (not a template failure) from system failures

## Integration with Thompson Sampling

**Key principle**: Failure mode taxonomy is **metadata-only**. Thompson Sampling updates are uniform:
- All failures (regardless of type) increment β uniformly
- All successes increment α uniformly
- **No variant-level discrimination** based on failure type

**Rationale:**
- Failure type information is too sparse early in template lifecycle to warrant type-specific learning
- Uniform β allows robust comparative learning across template families
- Type-specific optimizations happen at the **activity redesign** layer, not the Thompson layer

**Actual Learning Application:**
Downstream analysis identifies:
1. Which failure types dominate for template X
2. Patterns in failed_evidence (for verifier_negative)
3. Cost vs duration overruns (for budget_exhausted)
4. Deep causality chains (for cascading)

Then triggers **activity redesign activities** (e.g., "simplify the validation logic for this template" or "reduce LLM context for low-ROI templates").

## Implementation Notes

### Type Safety

The `FailureModeSchema` in `activity-api/src/models/schemas.ts` uses zod's `discriminatedUnion` for compile-time type safety. However, due to zod limitations with recursive types, `upstream_failure_mode` in cascading failures has type `any` at the TypeScript-inference layer. **Runtime validation still works correctly.**

Callers needing precise typing can cast after validation:
```typescript
const rawFailure = FailureModeSchema.parse(data)
const typedFailure = rawFailure as FailureMode  // TypeScript cast
```

### Backward Compatibility

- Existing execution traces have `failure_mode: null` (no migration required)
- Queries checking for failure type must handle null: `WHERE failure_mode IS NOT NONE AND failure_mode.type = 'verifier_negative'`
- New traces will set failure_mode on failures; it remains null for successes

### Storage & Indexing

- Stored in SurrealDB as `option<object>` (flexible, no schema constraint at DB level)
- No index on failure_mode itself (cardinality too low for practical use)
- Indexed queries use `activity_execution_traces.success` to filter, then inspect failure_mode in application layer

## Learning Layer (Future)

Post-trace-collection analysis (e.g., in MiniBob's learning loop or a dedicated analysis vessel):

1. **Failure clustering**: Group failures by type, extract common patterns
2. **Activity redesign**: Trigger activities to address dominant failure modes
3. **Validator effectiveness**: Measure signal-to-noise ratio of each validator
4. **Cost trends**: Monitor budget_exhausted frequency over time
5. **Cascade analysis**: Identify high-impact upstream tasks

See related OpenSpec for detailed learning phase design.

## See Also

- `docs/architecture/RESOLVER_TRACKING.md` — Resolver-level failure attribution
- `docs/guides/EXTERNAL_VALIDATION_INTEGRATION.md` — Validator execution details
- `repos/metabob-activity-api/src/models/schemas.ts` — FailureModeSchema definition
- OpenSpec: `2026-04-26-validators-and-failure-modes` — Detailed change proposal
