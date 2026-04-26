## Context

MiniBob and metabob-activity-api are pure vessels: their runtime behaviour is driven by activities, not by source. The validation path violates that constraint in three places, and the trace's failure model is too coarse to teach anything beyond binary success.

Inside `ActivityExecutor`, when a task completes its prompt loop, the executor does this directly (`repos/minibob/src/activity.ts:5454-5529`):

1. Reads `task.validation` (a structured spec on the task config).
2. Calls `this.runValidation(task.validation, result.content, variables, taskResults)` synchronously.
3. Stores the verdict in `validationResults` for the trace.
4. If the verdict is negative, calls `this.recordImpulseRelevance(...)` (with `executionSucceeded: false`), iterates `this.toolCallRecords` to call `mcp.recordToolArgumentPattern(...)` for each, and returns `{ status: "failed", ... }` early.

Three more sites repeat the inline learning-signal write pattern: `recordImpulseRelevance` is called at `:5471` (validation-failed), `:5574` (success), and `:5719` (execution-error). The signal-write logic (which impulses count, what flags to set, how to attribute to the resolver tier) lives in `recordImpulseRelevance` at `:5867-5920` and `recordErrorImpulseRelevance` at `:5922-5970`.

Validators already exist as resolvers, mostly template-dispatchable, but each emits a different shape:

- `validation-resolver.ts:128` — emits shape `validation_result` (the canonical name we'll keep).
- `pattern-validator.ts:155` — emits shape `pattern_validation_result` (rename target).
- `pre-validation-resolver.ts:156` — emits shape `pre_validation_result` (rename target).
- `goal-verification-resolver.ts:1-1539` — emits goal-scope verdicts but never under the `validation_result` shape; it's wrapped into the `goal` shape body today.
- `failure-penalty-resolver.ts`, `goal-satisfaction-checker-resolver.ts` — adjacent, emit other shapes; out of scope for unification but referenced by the meta-activity.

Persistence: `validation_result` is created as a memo-pointer impulse with `metadata.shape = "validation_result"`, but `repos/metabob-activity-api/src/models/schemas.ts` has no schema for it and no DB table records the structured body. The trace's per-task `validationResults` field at `activity.ts:5713` is denormalized, ad-hoc, and not queryable.

Trace failure: `StoreExecutionTraceRequestSchema` at `schemas.ts:831` accepts `status: "success" | "failure" | "partial"` plus an `error_message`/`error_type`/`failed_task_id` triple at `execution-traces.ts:170`. Thompson updates at `execution-traces.ts:1306, 1579` apply uniform α/β deltas regardless of failure cause. There is no enforcement code for budget exhaustion, no depth check on `composition_chain`, and `HumanResolver`'s `aborted` flag at `human-resolver.ts:88` is not propagated past the resolver boundary.

The lifecycle infrastructure to fix this already exists. `lifecycle:task:completed` is emitted at `activity.ts:2386` for the parallel-group path (and at the matching site for the sequential-loop path). Subscribers fire as nested executions ranked by Thompson + relevance, exactly like primary selection. We add no new lifecycle event; we add one meta-activity, one shape contract, one taxonomy field, and we delete the inline executor logic.

## Goals / Non-Goals

**Goals**

- Validation becomes activity-driven: any activity with `output_shapes: ["validation_result"]` is a validator, and validators are dispatched via lifecycle subscription on `lifecycle:task:completed`.
- The `validation_result` shape is unified across the three existing emission sites and persisted via the impulse store so workbench and learning queries can read it.
- The trace records a structured `failure_mode` so future learners can stratify; the existing Thompson-update path stays uniform until a separate spec teaches it to read the field.
- The executor stops calling validation, learning-signal-write, and tool-pattern-record code directly. The inline block at `:5454-5529` and the three `recordImpulseRelevance` call sites are removed.
- The workbench renders runtime validator output and `failure_mode` taxonomy values in the existing trajectory and history surfaces.

**Non-Goals**

- No mode-aware Thompson rules engine. Recording `failure_mode` does not change the α/β math at `execution-traces.ts:1306, 1579` in this spec. A future spec can teach learners to stratify; the metadata is here when it does.
- No backfill of `failure_mode` for legacy traces. Null means "pre-taxonomy" and is acceptable.
- No new lifecycle event. Validator dispatch reuses the existing `lifecycle:task:completed` emission.
- No async validators in this spec. Sync execution holds the parent task's completion until validators finish. Async deferred as out-of-scope.
- No goal-verification rewrite. `goal-verification-resolver` continues to emit goal-scope verdicts; we only require it to emit those *as* `validation_result` impulses (per the shape unification) so the same surfaces render them.
- No changes to `compositionSuccess` write triggers. The trigger contract is out-of-scope; see Decision D8.

## Decisions

### D1: Validator-activity convention — output_shapes + wildcard input

**Decision**: A validator is any activity whose declared `output_shapes` contains `"validation_result"`. Specialized validators declare the shapes they validate in `input_shapes` (e.g. `["json", "structured_data", "validation_spec"]`). A wildcard validator declares `input_shapes: ["*"]` and matches any produced shape; specialized validators are always preferred when at least one match exists.

**Why**: The convention lives in data, not source. `discover-by-shapes` already filters by `output_shapes` at the route's forward path; we extend backward mode (the path the meta-activity uses) with the same filter. Wildcard semantics give us an LLM semantic-validator escape hatch without forcing it on every shape.

**Alternatives considered**:

- *Validator interface in source.* Rejected — would require a TypeScript type that activity JSON couldn't satisfy without adapter shims; pure-vessel violation.
- *Separate `validators` table.* Rejected — duplicates `activity_template`'s storage and prevents validators from being authored, edited, and version-tracked in the workbench like any other activity.
- *Mark validators with a boolean field on the template.* Rejected — implicit declaration through `output_shapes` is already how the rest of the system identifies "an activity that produces shape X."

### D2: Single `validation_result` shape, no split by passed/failed

**Decision** (architectural call 4): Validators emit a single `validation_result` shape with a `passed: boolean` field, not two shapes (`validation_passed` / `validation_failed`).

**Body contract**:

```typescript
{
  shape: "validation_result",
  passed: boolean,
  confidence: number,           // 0..1
  validator_id: string,         // activity id of the validator that emitted this
  failure_mode?: FailureMode,   // present only when passed=false
  evidence: Array<{
    check_id: string,
    passed: boolean,
    details?: string,
    location?: string
  }>,
  messages: Array<{ severity: "info" | "warning" | "error", text: string }>
}
```

**Why split was rejected**: Two shapes double the consumer surface area: every workbench panel, every learning query, every persistence path would need to handle both. The `passed` field is the discriminator that's already in the existing `ValidationResolver` output (`validation-resolver.ts:35`). Consumers who only care about failures filter `passed === false`; the cost is one boolean check, not a shape table.

**Confidence semantics**: Pattern validators report `confidence: 1.0` (deterministic). LLM semantic validators report the model's self-reported confidence or, when absent, a fixed `0.7` prior. The field is present so downstream learners can weight evidence; it is not a gate.

### D3: `failure_mode` is a structured object, not a string enum

**Decision** (architectural call 2): `failure_mode` is `{ type, reason, context }`, where `type` is the enum and `context` is mode-specific structured data.

```typescript
type FailureMode =
  | { type: "verifier_negative"; reason: string; context: { validator_id: string; failed_evidence: Evidence[] } }
  | { type: "budget_exhausted"; reason: string; context: { budget_type: "cost" | "duration"; consumed: number; allowed: number } }
  | { type: "safety_breach"; reason: string; context: { breach_type: "depth" | "cycle"; limit: number; ancestor_chain: string[] } }
  | { type: "cascading"; reason: string; context: { upstream_task_id: string; upstream_failure_mode?: FailureMode } }
  | { type: "user_abort"; reason: string; context: { abort_source: "human_resolver" | "ctrl_c" | "workbench_button" } }
```

**Why structured over flat enum**: A flat string `"verifier_negative"` records *that* something happened but loses *what* — which validator, which budget, which ancestor. Reading the trace later for analysis means re-deriving structure from `error_message` text. Structured fields make stratified learning queries trivial without text parsing. The cost is one nested object per failed trace, which the existing trace shape (impulses, state snapshots) dwarfs.

**Why not flat optional fields**: A flat shape (`failure_mode: string`, `validator_id?: string`, `budget_type?: string`, `consumed?: number`, ...) makes invalid combinations representable (a `verifier_negative` with `consumed: 5`). The discriminated union prevents that.

### D4: Per-failure-mode Thompson updates are out-of-scope

**Decision** (architectural call 3): The Thompson-update path at `execution-traces.ts:1306, 1579` stays uniform. `failure_mode` is metadata for stratified queries; no rules engine maps mode → α/β delta in this spec.

**Why**: The brief explicitly leans this way. Recording metadata is cheap and forward-compatible; building a rules engine before we have data on which modes correlate with which α/β shifts would over-fit. A future spec can add the rules engine; this spec ensures the field is there to read.

### D5: Validator dispatch via `lifecycle:task:completed`, hybrid invocation, sync execution

**Decision** (architectural calls 1 and 6):

- **Invocation model**: hybrid. The meta-activity auto-dispatches when at least one validator is registered for a produced shape. Templates opt out via `skip_validation: true` on a task. No opt-in flag — the default is "if a validator exists for your output shape, it runs."
- **Execution model**: sync. The parent task's completion event is held (in the meta-activity's nested-execution stack frame) until all dispatched validators emit their `validation_result` impulses. The downstream `task.completed` lifecycle subscribers see the validation results in the impulse pool.

**Why hybrid**: Auto-dispatch by default keeps validation pervasive — the system learns from every output. The opt-out is for cases where validation would be tautological (a validator's own output) or where the task is itself a validator. Forcing template authors to opt-in to validation defeats the point of a learning loop.

**Why sync**: Async deferral would let downstream tasks run on unverified outputs and surface validator results minutes later in a separate trace, which fragments the learning signal and complicates the workbench timeline. Sync costs latency but keeps the task → validator → next-task chain intact. Validator authors are responsible for keeping validators fast (deterministic ones run in <100ms; LLM semantic validators set their own budget).

**Wildcard precedence**: When dispatching, the meta-activity queries `discover-by-shapes` with `output_shapes: ["validation_result"]` and the produced shape as `required_shapes` filtered by the meta-activity's logic on `input_shapes`. Specialized matches (`input_shapes` contains the produced shape literally) are always preferred over wildcard matches (`input_shapes: ["*"]`). When multiple specialized validators match, `producer_selection` (sibling spec) chooses via Thompson Sampling on `compositionSuccess`.

### D6: Multi-scope emission — task-scope only at execution time

**Decision** (architectural call 5): Validators emit `validation_result` impulses at task scope only. Activity-scope and goal-scope success signals are computed downstream from the trace's per-task validation results plus the existing `goal_verification` output.

**Why**: Emitting at every scope at execution time means three writes per task (task-validator, activity-rollup-validator, goal-rollup-validator), all of which need policies for "when does activity-scope evaluate" (after every task? after the last task? after a group?). The aggregation logic belongs in learning queries on the trace, not in a real-time emission cascade. The trace has all the per-task validation results plus the per-task `success` and the `goal_verification` output; activity-scope and goal-scope rollups are SQL on those rows.

**Downstream scope** is, per the brief, a learning-query result — not an at-execution-time emission. Computing "did downstream tasks run successfully on this task's output" requires the *next* trace, which doesn't exist when the current task completes. Downstream-scope is a stratified read on the existing `composition_chain` field; no new emission.

### D7: failure_mode propagation timing — inline at task completion

**Decision** (architectural call 7): `failure_mode` is set at the same point the task transitions to `failed`, by the same code path that decides the failure happened. Specifically:

- `verifier_negative` — set by the validator-dispatch meta-activity when a `validation_result` arrives with `passed: false`. The meta-activity writes the failure_mode onto the task's `taskResult.metadata.failure_mode` before propagating completion.
- `budget_exhausted` — set by the **same activity** that enforces the budget. This spec does not enforce budgets (the brief flags that no enforcement code exists today); when an enforcement activity is added in a future spec, it sets `failure_mode` directly. The taxonomy field is here when that spec lands.
- `safety_breach` — set by the sibling spec `shape-provider-goal-creation` when its depth/cycle guards trip. This spec defines the failure_mode object the sibling writes into.
- `cascading` — set by the executor when a task fails because an upstream task failed. The executor reads the upstream task's `failure_mode` and constructs `{ type: "cascading", context: { upstream_task_id, upstream_failure_mode } }`. This is the one piece of executor logic this spec adds; it is small (~10 lines) and orthogonal to the validation block being deleted.
- `user_abort` — set by `HumanResolver` when its `aborted` flag is set. The resolver writes `failure_mode` onto the resolver result; the executor propagates without modification. Today the `aborted` flag is at `human-resolver.ts:88`; this spec wires it into the `failure_mode` field.

**Why inline-at-source over post-task analyzer**: A post-task analyzer would have to re-derive *why* the task failed from `error_message` text — exactly the lossy path the structured taxonomy is designed to avoid. Setting at source preserves the discriminator with zero re-derivation. A backend-inference path (the third option) would do the same lossy text parse on the activity-api side.

**Why not entirely activity-driven**: Cascading failure-mode propagation is the one piece of structural information only the executor has — it's the entity that knows which task ran first and which one ran second on its outputs. Pushing this into a meta-activity would require the meta-activity to read trace state mid-execution, which is an order of complexity beyond what's bought back. The 10-line executor change is the smaller hit.

### D8: compositionSuccess write triggers — out-of-scope

**Decision** (architectural call 8): Defining when `compositionSuccess` is written (today the writes happen scattershot from various paths) is out-of-scope for this spec. The trigger contract belongs in a follow-up spec that can survey all the existing write call sites and unify them. This spec does not add new writes; it only reads `compositionSuccess` indirectly via the `producer_selection` resolver inherited from sibling spec 1.

**Why deferred**: Touching `compositionSuccess` writes in this spec would couple validator dispatch to a separate refactor. The validator-dispatch meta-activity does not depend on a unified write trigger — `producer_selection` reads what's already there.

### D9: Migrate `recordImpulseRelevance` and `recordToolArgumentPattern` to a single resolver

**Decision**: The three call sites (`activity.ts:5471, :5574, :5719`) plus the tool-argument-pattern loop at `:5482-5527` move into a new `learning_signal_writer` resolver. The validator-dispatch meta-activity invokes it as a final task in the chain.

**Why one resolver, not two**: The two writes are always co-located (they record different facets of the same task's outcome). One resolver with a `signals: ["impulse_relevance", "tool_argument_pattern"]` config supports both without duplicating the MCP-client wiring.

**Why not just leave them in the executor**: The brief explicitly flags these as hardcoded learning-signal sites. The pure-vessel cleanup is the value here; the call sites all do MCP writes in non-blocking fire-and-forget mode (`recordImpulseRelevance` swallows errors at `:5913-5918`), so moving them out of the executor's hot path costs nothing and gains template-author control.

## Risks / Trade-offs

- **Risk**: Synchronous validator execution adds latency to every task that produces a known shape. **Mitigation**: deterministic validators are <100ms; LLM semantic validators are gated behind a `confidence_threshold` config so they can short-circuit on high-confidence pattern-validator passes. Templates that are latency-sensitive opt out via `skip_validation: true`.
- **Risk**: The unified `validation_result` shape forces the three existing emitters into one contract; semantic drift between them (pattern checks vs schema checks vs LLM judgment) collapses into one body. **Mitigation**: the `validator_id` field tags the emitter; learning queries can filter by validator before aggregating, so "pattern validator says pass" and "LLM says pass" don't mix unless the query says they should.
- **Risk**: `failure_mode` set inline at task completion means the executor still touches structured failure data, which feels like a pure-vessel violation. **Mitigation**: the executor only sets `cascading` (which only the executor has the info to set); all other modes are set by the activities/resolvers that detect them. The structured field is metadata, not control flow — the executor doesn't branch on `failure_mode`, it just stamps the trace.
- **Risk**: Removing the inline validation early-exit at `:5529` means a task with `validation: { ... }` no longer hard-fails; the verdict arrives via the meta-activity. Existing templates may rely on the early exit for cleanup or rollback. **Mitigation**: tasks that need explicit failure on validation negative declare `skip_validation: false` (default) and add a downstream task that consumes the `validation_result` shape and short-circuits via `condition`. The existing templates will need a one-line audit; the change-log is small.
- **Trade-off**: Wildcard validators (`input_shapes: ["*"]`) match everything, so cost can spike if a wildcard LLM validator is registered. **Mitigation**: `producer_selection` ranks by `compositionSuccess`; a wildcard with a low success rate is starved out by Thompson Sampling. Workbench can also surface wildcard registrations as a high-impact change.
- **Trade-off**: The brief asked for the `learning_signal_writer` resolver to be the migration target for the three `recordImpulseRelevance` sites. That resolver is one more piece of surface area, but it's the cleanest place to record per-task learning signals as activity-driven writes; without it the migration is incomplete and the executor still has hardcoded backend calls.

## Backend dependencies

- `POST /v2/activities/discover-by-shapes` — backward mode extended with `output_shapes` filter (this spec). Used by the meta-activity to find validators.
- `POST /v2/impulses/resolve` with `pointer.type = "compositionSuccess"` (`repos/metabob-activity-api/src/routes/impulses.ts:1488-1540`) — read by `producer_selection` (inherited from sibling spec 1).
- `POST /v2/impulses/resolve` with `pointer.type = "impulseRelevance_write"` and `pointer.type = "toolArgumentPattern_write"` — written by the new `learning_signal_writer` resolver.
- `POST /v2/activities/execution-traces` — `failure_mode?` field added to the request body schema; new SurrealDB migration adds the corresponding column on `activity_execution_traces`.

No new endpoints. One schema migration. One route filter.

## Files Changed

| File | Change |
|---|---|
| `repos/minibob/src/activity.ts:5454-5529` | Delete inline validation block; remove early `return { status: "failed", ... }` path |
| `repos/minibob/src/activity.ts:5471, :5574, :5719` | Delete the three `recordImpulseRelevance` call sites |
| `repos/minibob/src/activity.ts:5482-5527` | Delete the inline `recordToolArgumentPattern` loop (moves into `learning_signal_writer`) |
| `repos/minibob/src/activity.ts` (cascading propagation) | Add ~10 lines to read upstream `failure_mode` from prior `taskResults` and stamp `cascading` on the current task's metadata when an upstream-failure abort triggers |
| `repos/minibob/src/resolvers/validation-resolver.ts:117-138` | Migrate emit body to unified `validation_result` shape; populate `failure_mode` on negative |
| `repos/minibob/src/resolvers/pattern-validator.ts:140-160` | Rename emitted shape from `pattern_validation_result` to `validation_result`; populate body per unified contract |
| `repos/minibob/src/resolvers/pre-validation-resolver.ts:140-160` | Rename emitted shape from `pre_validation_result` to `validation_result`; populate body per unified contract |
| `repos/minibob/src/resolvers/goal-verification-resolver.ts` | Add `validation_result` co-emission alongside existing goal-scope output (the goal-shape emission stays for goal-verification consumers; the validation_result emission is new for the unified surface) |
| `repos/minibob/src/resolvers/human-resolver.ts:88` | Wire `aborted` flag to `failure_mode: { type: "user_abort", ... }` on the resolver result |
| `repos/minibob/src/resolvers/learning-signal-writer-resolver.ts` (new) | Wraps `recordImpulseRelevance` and `recordToolArgumentPattern` MCP calls; called from the meta-activity |
| `repos/minibob/src/embedded-templates/validator-dispatch.json` (new) | Subscribes to `lifecycle:task:completed`; dispatches validators; calls `learning_signal_writer` |
| `repos/minibob/src/embedded-templates/index.ts` | Register `validator-dispatch` |
| `repos/metabob-activity-api/src/routes/activities.ts:3332-3465` | Extend backward mode with `output_shapes` array param; filter activities whose `output_shapes` contain at least one declared shape |
| `repos/metabob-activity-api/src/models/schemas.ts:809-844` | Add `FailureModeSchema` zod definition; add `failure_mode: FailureModeSchema.optional()` to `StoreExecutionTraceRequestSchema` |
| `repos/metabob-activity-api/sql/migrations/<next>-failure-mode-taxonomy.surql` (new) | Add `failure_mode` field to `activity_execution_traces` (option<object>) |
| `repos/workbench/src/components/trajectory/ValidationErrorDisplay.tsx` | Extend types to render runtime validator output (passed/confidence/evidence/messages) alongside existing authoring-time shape errors |
| `repos/workbench/src/components/trajectory/ImpulseStatePanel.tsx` | Add per-task validation indicator (pass/fail/confidence) sourced from `validation_result` impulses |
| `repos/workbench/src/components/trajectory/ExecutionHistoryPanel.tsx` | Render `failure_mode.type` and `failure_mode.context` in the per-trace row |

## Cross-references to siblings

- **Sibling spec `impulse-binding-selection-layer`**: the slot-binding meta-activity it defines records its own success/failure via the `validation_result` shape this spec defines. The slot-binding template's `select_or_produce` task emits a `validation_result` when binding succeeds or fails; `failure_mode: { type: "verifier_negative", context: { validator_id: "slot-binding", ... } }` when no candidate could be selected. Reference; do not duplicate. The `producer_selection` resolver from that spec is reused here for validator selection (filter on `output_shapes: ["validation_result"]`).
- **Sibling spec `shape-provider-goal-creation`**: the depth/cycle/budget guards there map to `safety_breach` (depth, cycle) and `budget_exhausted` (budget) in this spec's taxonomy. The "auto-flag-not-fail" behavior in that spec — setting `human_in_the_loop_required: true` instead of hard-failing — corresponds to setting `failure_mode` and continuing rather than aborting the parent. The sibling spec's emitted goal-shaped impulses are not validated by the validator-dispatch meta-activity (goals don't carry a shape that validators consume); they're escalated via the workbench surface from spec 1.

## Out of scope

- Mode-aware Thompson updates (deferred; metadata-only at first per architectural call 3).
- Async validator execution (deferred; sync per architectural call 6).
- Activity-scope and goal-scope `validation_result` emission at execution time (computed downstream per architectural call 5).
- Backfill of `failure_mode` on legacy traces (null is fine).
- Budget enforcement code (no enforcement exists today; the spec defines the failure_mode for when it lands).
- Depth/cycle enforcement in the executor (the sibling spec `shape-provider-goal-creation` owns these guards for goal creation; this spec only defines the failure_mode types).
- `compositionSuccess` write trigger contract (out per architectural call 8).
- The fourth synthesis spec (canonical-composition + LLM-skill-pattern + tools-as-impulses + lifecycle-bootstrap) is explicitly **DEFERRED**. The brief flags it; this spec does not absorb any of that work.

## Open Questions

- **Default `confidence` for LLM semantic validators absent self-reported confidence**: 0.7 prior is a guess. Once traces accumulate we can replace with a learned prior per validator. Lean: ship 0.7, note in spec.
- **Should the meta-activity's `learning_signal_writer` task run on validator failure as well as task failure?** Today the executor calls `recordImpulseRelevance` on both validation-failed and execution-error paths. Migrating all three sites means the meta-activity's writer task runs on three branches: success, validation-fail, execution-error. Lean: yes — the meta-activity reads the validation_result and the task outcome and dispatches the writer with the correct success flag.
- **Validator templates as variants vs separate activities**: should the canonical pattern validator and the wildcard LLM validator be variants of one parent template, or separate activities? Variants give us Thompson Sampling between them; separate activities give clearer authoring boundaries. Lean: separate activities for now (the wildcard's `input_shapes` is structurally different); revisit once we have a third validator.

## Validation findings

Findings specific to this sibling spec's scope. Cross-cutting findings (lifecycle payload gaps, `vessel_resolve_call`, foreach gap) live in the umbrella `impulse-activity-loop` spec.

#### F-28: `select_validator_per_shape` is an LLM format adapter, not a deterministic reshape
**Observation:** Sibling spec §7 calls for partitioning validator candidates per produced shape (specialized vs wildcard) and dispatching the right validator per shape. The shipped `validator-dispatch.json` task 2 collapses to a mechanical LLM format adapter that converts `producer_selection_result` → `variant_selection_result` so the downstream `activity` resolver can pick up `selected.activity_id` via `extractSelectedActivityId`.
**Impact:** Specialized/wildcard partitioning becomes a post-hoc preference baked into `producer_selection`'s ordering rather than a hard filter; multi-validator parallel dispatch is deferred (one validator picked per task entry).
**Proposed fix:** Replace the LLM call with a deterministic `impulse_reshape` resolver (or a `variant_selection_from_producer_selection` resolver). When foreach lands (umbrella F-4), expand task 3 into per-validator parallel dispatch.
**Origin:** iter 7 / Subagent I (`metadata.openQuestions[3]`, `metadata.limitations[0]`).
**Affected files:** `repos/minibob/src/embedded-templates/validator-dispatch.json`.

#### F-29: `failure_mode` propagation via impulse, no mid-execution trace-metadata-write endpoint
**Observation:** Sibling spec D7 mandates `verifier_negative` failure_mode is set by the validator-dispatch meta-activity onto the parent task's `taskResult.metadata.failure_mode`. No activity-api endpoint exists today for writing trace metadata mid-execution. The shipped `validator-dispatch.json` task 4 (`propagate_failure_mode`) emits a `failure_mode_propagation` impulse instead and relies on the lifecycle subscriber merge path to surface it in the parent execution's impulse pool.
**Impact:** Failure-mode field is propagated as an impulse rather than stamped on the trace metadata. Phase 5 (umbrella) will lift the inline path and either land an endpoint or formalise the impulse-based propagation as authoritative.
**Proposed fix:** Either add a mid-execution trace-metadata-write endpoint, OR formalise the impulse-based propagation as the authoritative path and have the trace store consume `failure_mode_propagation` impulses on execution close.
**Origin:** iter 7 / Subagent I (`metadata.openQuestions[4]`, task 4 description).
**Affected files:** `repos/minibob/src/embedded-templates/validator-dispatch.json`, `repos/metabob-activity-api/src/routes/execution-traces.ts`.

#### F-30: `learning_signal_write` task hardcodes `executionSucceeded: false` with empty data arrays
**Observation:** Task 5 of `validator-dispatch.json` invokes the `learning_signal_writer` resolver with `executionSucceeded: false` and empty `allImpulseIds/loadedImpulseIds/toolCallRecords` arrays as a structurally-valid no-op. The lifecycle:task:completed payload doesn't include those fields (umbrella F-7); the resolver tolerates empty arrays and writes no rows.
**Impact:** No learning-signal rows are written from the meta-activity path until either the lifecycle payload is extended OR the resolver is taught to fetch the per-task arrays by parent execution id. Phase 5 (umbrella) is the migration target; until then the executor's three inline `recordImpulseRelevance` call sites are still the actual write path.
**Proposed fix:** Extend the lifecycle:task:completed payload (umbrella F-7), OR teach `learning_signal_writer` to fetch per-task tracking arrays from the parent execution by id.
**Origin:** iter 7 / Subagent I (`metadata.openQuestions[5]`, `metadata.limitations[1]`, `[2]`).
**Affected files:** `repos/minibob/src/embedded-templates/validator-dispatch.json`, `repos/minibob/src/resolvers/learning-signal-writer-resolver.ts`, `repos/minibob/src/activity.ts:2406, :2855`.

#### F-31: `failure_mode_taxonomy` migration ran without a live-DB rehearsal of the backfill
**Observation:** Iter 4 / Subagent C noted the `endpoint_output_shapes` backfill SQL was constructed by analogy and "not run against a live DB." A parallel concern applies to migration 091 (`failure_mode` field): the additive `option<object>` field is low risk, but no rehearsal evidence is recorded in the iteration log.
**Impact:** Low — additive nullable field; if rejected by SurrealDB the deploy fails fast and is reverted.
**Proposed fix:** Record a brief rehearsal note (e.g. `INFO FOR TABLE activity_execution_traces` after migration on a non-canary SurrealDB) on next iteration touching the migration.
**Origin:** iter 3 / Subagent B, iter 4 / Subagent C (extrapolated).
**Affected files:** `repos/metabob-activity-api/sql/migrations/091-failure-mode-taxonomy.surql`.
