## Context

MiniBob's goal execution has grown organically, accumulating patterns that diverge from the foundation idioms in `IMPULSE_ACTIVITY_FOUNDATION.md`. The system currently:

1. **Calls LLM before checking if work is needed** - Validation runs post-execution, wasting tokens when files already exist or patterns already match
2. **Treats errors as strings** - Retry error context is concatenated into prompts rather than treated as impulses with metadata
3. **Only learns from success** - Tool argument patterns recorded only when tasks succeed, missing valuable failure data
4. **Generates incomplete templates** - Schema extraction exists but isn't wired into template generation
5. **Loses impulse lineage in composition** - Parent-child activity relationships tracked but not the impulses that flow between them
6. **Provides all tools to all tasks** - No per-task tool filtering, increasing context size unnecessarily

These gaps prevent the learning loop from reaching its potential and violate core principles.

## Goals / Non-Goals

**Goals:**
- Align execution flow with "LLMs Are Tools, Not Controllers" - use deterministic checks first
- Align error handling with "Impulses Are Universal Data" - errors become proper impulses
- Align learning with "Record Everything" and "Learn From Traces" - capture failures too
- Enable composition pattern learning via impulse flow tracking
- Reduce token usage through pre-validation and tool filtering

**Non-Goals:**
- Changing the activity/impulse data model fundamentals
- Modifying Thompson Sampling algorithm (just providing better data)
- Implementing new resolvers (using existing infrastructure)
- Breaking backward compatibility with existing templates

## Decisions

### D1: Pre-Validation as Separate Phase

**Decision:** Add `checkPreValidationRules()` before LLM call in `executeWithLLM()`, returning early if all pre-checkable rules pass.

**Rationale:**
- Validation rules for `requiredFiles` and `forbiddenPatterns` can be checked against current filesystem state
- ~30-40% of tasks have pre-checkable validations
- Aligns with #8: "If a step can be done deterministically without LLM reasoning, it should be"

**Alternatives Considered:**
- Run full validation resolver first → Rejected: validation resolver expects task output
- Cache validation results → Rejected: state can change between checks

### D2: Error Impulses with Shape "previous_attempt_error"

**Decision:** Create impulses for retry errors with `shape: "previous_attempt_error"` and add to task impulse list for relevance filtering.

**Rationale:**
- Foundation: "Everything is an impulse"
- Error impulses become subject to relevance filtering
- System learns: "error context loaded → recovery success rate X%"
- Enables progressive context through impulse accumulation

**Pattern:**
```typescript
createImpulse({
  id: `error:${taskId}:${activityId}:${attempt}`,
  pointer: { type: 'memo', content: errorMessage },
  metadata: { shape: 'previous_attempt_error', attemptNumber: attempt },
  budget: Math.min(errorLength / 4, 2000),
  priority: 'high'
})
```

### D3: Failure Pattern Recording with Type Discrimination

**Decision:** Record tool argument patterns on failure with `failureType` enum: `validation | execution | tool_failure | timeout`.

**Rationale:**
- Foundation line 379: "Failure: Increment β, record failure pattern"
- Different failure types need different learning responses
- Validation failures: arguments were valid, but output wrong
- Execution failures: something crashed
- Tool failures: specific tool didn't work with these arguments

**Schema Addition:**
```typescript
{
  execution_succeeded: boolean,
  failure_type?: 'validation' | 'execution' | 'tool_failure' | 'timeout',
  failure_reason?: string
}
```

### D4: Schema Extraction in Template Generation

**Decision:** Add three helper functions to `template-generator.ts` that extract schemas from `ActivityExecution` and call them in `assembleTemplateFromExecution()`.

**Rationale:**
- Functions exist in `template-extractor.ts` but work with `ImprovisationTrace`
- Need equivalent functions for `ActivityExecution` structure
- Backend already accepts `input_schema` and `output_schema` fields
- Minimal change (~40 lines) with high impact on matching quality

**Functions:**
- `extractInputSchemaFromExecution(execution)` → `ActivityInputSchema`
- `extractOutputSchemaFromExecution(execution)` → `ActivityOutputSchema`
- `calculateSchemaConfidenceFromExecution(execution)` → `number`

### D5: Composition Impulse Flow Table

**Decision:** Create new `composition_impulse_flow` table and enhance `activity_composition_graph` with impulse shape arrays.

**Rationale:**
- Current graph only knows parent→child with success rate
- Cannot answer: "Why do some X→Y succeed while others fail?"
- Impulse flow enables: "When X loads [trace, error_log], succeeds 82%"
- Foundation: "Traces reveal composition patterns"

**Schema:**
```sql
-- Enhanced composition_graph
input_impulse_shapes: [string]
output_impulse_shapes: [string]

-- New table for detailed tracking
composition_impulse_flow {
  edge_id: record
  impulse_id: string
  direction: 'input' | 'output'
  shape: string
  execution_succeeded: bool
}
```

### D6: Resolver Requirements on ActivityTask

**Decision:** Add optional `resolverRequirements` field to `ActivityTask` with `requiredTools` and `excludeTools` arrays. Filter tools in `executeWithLLM()`.

**Rationale:**
- Currently all tools provided to every LLM call
- Extra tokens in context for unused tools
- Foundation #8: restrict LLM to where needed
- Ribosome can infer requirements from execution traces

**Type:**
```typescript
interface ActivityTask {
  resolverRequirements?: {
    requiredTools?: string[]
    excludeTools?: string[]
    preferredResolver?: string
  }
}
```

## Risks / Trade-offs

### R1: Pre-Validation False Positives
**Risk:** Pre-validation passes but task actually needs LLM reasoning to produce correct output.
**Mitigation:** Only skip LLM when ALL checkable rules pass AND task has no prompt content beyond variable substitution. Conservative approach.

### R2: Error Impulse Accumulation
**Risk:** Multiple retry attempts create many error impulses, bloating context.
**Mitigation:** Error impulses have low budget (2000 tokens max). Relevance filtering will naturally prune unhelpful errors over time.

### R3: Failure Pattern Noise
**Risk:** Recording failures might create noisy patterns (environmental failures vs. genuine bad arguments).
**Mitigation:** Discriminate by `failure_type`. Environmental failures (timeout, network) can be filtered in queries.

### R4: Composition Table Growth
**Risk:** `composition_impulse_flow` table grows large with detailed per-impulse tracking.
**Mitigation:** Partition by execution_id prefix. Implement retention policy (90 days). Aggregate to summary views for queries.

### R5: Tool Filtering Breaking Tasks
**Risk:** Tasks that need tools not in `requiredTools` will fail.
**Mitigation:** `excludeTools` is a blocklist, not allowlist. By default all tools available unless explicitly excluded. Ribosome inference uses observed tools only.

### R6: Schema Extraction Confidence
**Risk:** Extracted schemas may be incomplete or inaccurate.
**Mitigation:** Track `schemaConfidence` score. Low-confidence schemas marked for review. Don't use schemas in matching until confidence > 0.7.
