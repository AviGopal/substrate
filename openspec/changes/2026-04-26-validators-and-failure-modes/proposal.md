## Why

The first two sibling specs this week define how a task's input slot is bound (`impulse-binding-selection-layer`) and how the system escalates when no producer exists (`shape-provider-goal-creation`). Neither defines how the system *knows* whether a binding decision, an escalation, a task, or an activity actually succeeded. Today the answer is binary success/failure and one inline validation block in the executor.

Three concrete consequences:

1. **The smoking-gun pure-vessel violation.** `ActivityExecutor` runs validation inline at `repos/minibob/src/activity.ts:5454-5529`: it consumes the verdict, returns `status: "failed"` early on failure, and writes learning signals (tool argument patterns, impulse relevance) — none of which is activity-driven. Adding a new validation strategy or a new failure-pattern recorder requires editing executor source. Three more hardcoded `recordImpulseRelevance` call sites at `:5471, :5574, :5719` repeat the pattern.

2. **No `validation_result` persistence.** `ValidationResolver` already emits a `validation_result` shape at `repos/minibob/src/resolvers/validation-resolver.ts:128`, but no DB schema or table records it. `pattern-validator` emits the bespoke shape `pattern_validation_result` at `pattern-validator.ts:155`; `pre-validation-resolver` emits `pre_validation_result` at `pre-validation-resolver.ts:156`. Three resolvers, three shape names, zero unification, zero persistence.

3. **Failure collapses to a string.** The trace at `repos/metabob-activity-api/src/routes/execution-traces.ts:170` carries `error_message`, `error_type`, and `failed_task_id`. Thompson updates at `:1306` and `:1579` are uniform regardless of whether the failure was a verifier negative, a budget exhaustion, a safety breach, an upstream cascade, or a user abort. There is no enforcement code for budget exhaustion, no depth check on `composition_chain` for safety breaches, and `HumanResolver`'s `aborted` flag is not propagated as a structured failure.

This change closes the loop. It adds the validator-activity convention, the unified `validation_result` shape, the `failure_mode` taxonomy, a meta-activity that dispatches validators via lifecycle subscription, the executor migration that removes the inline validation block, and the workbench surfaces that render runtime validator output and structured failure modes.

## What Changes

- **Validator-activity convention** — define what makes an activity a validator: `output_shapes: ["validation_result"]` plus an `input_shapes` declaration, with a `["*"]` wildcard convention for shape-agnostic validators (LLM semantic check). Specialized validators are always preferred over wildcards when a shape match exists.
- **Unified `validation_result` shape** — single canonical body (`passed`, `confidence`, `validator_id`, optional `failure_mode`, `evidence[]`, `messages[]`) emitted by all validator activities. Migrate the three existing emission sites (`validation-resolver.ts:128`, `pattern-validator.ts:155`, `pre-validation-resolver.ts:156`) to the unified shape. Persist via the impulse store; back the trace's per-task `validation_results` field with denormalized `validation_result` impulse pointers rather than ad-hoc fields.
- **`failure_mode` taxonomy** — structured object recorded on traces: `{ type, reason, context }` where `type` is one of `verifier_negative | budget_exhausted | safety_breach | cascading | user_abort` and `context` is mode-specific structured data. New optional field on `activity_execution_traces`; null for legacy rows; no backfill.
- **Validator-dispatch meta-activity** — new embedded template subscribing to `lifecycle:task:completed` (already emitted at `activity.ts:2386`). Looks up validators for the produced shapes via `discover-by-shapes` and dispatches them. Reuses the `producer_selection` resolver from sibling spec `impulse-binding-selection-layer` to choose among multiple validator candidates. Invocation model is **hybrid**: auto-dispatch when at least one validator matches a produced shape; opt-out via `skip_validation: true` on the task. Execution is **synchronous**: the parent task's completion event is held until validators finish.
- **`discover-by-shapes` output-shape filter** — extend the existing route at `repos/metabob-activity-api/src/routes/activities.ts:3332-3465` so backward mode accepts an `output_shapes` filter alongside `required_shapes`. This is the "if the existing backward mode doesn't support output-shape filtering, the spec adds it" case the brief flagged. The filter is what the validator-dispatch meta-activity uses to find activities whose output is `validation_result` and whose input matches the produced shape. This patch piggybacks on sibling spec 1's `discover-by-shapes-mode-extension` rather than introducing a new mode.
- **Inline validation migration** — remove the validation block at `repos/minibob/src/activity.ts:5454-5529`. Tasks may declare `validation_spec` impulses as inputs; those flow into the validator-dispatch meta-activity through the lifecycle event payload. The three hardcoded `recordImpulseRelevance` call sites at `:5471, :5574, :5719` move into a `learning_signal_writer` resolver dispatched from the meta-activity, so the executor stops calling backend learning APIs directly.
- **Multi-scope success signals** — formalize four scopes (task, activity, goal, downstream) with explicit definitions of what producing each scope's success signal means. Validators emit at task scope; activity-scope and goal-scope are computed downstream from the trace. Downstream-scope is a learning-query result, not an at-execution-time emission. The Thompson-update path at `execution-traces.ts:1306, 1579` stays uniform; metadata is recorded so future learners can stratify.
- **Backend trace-ingestion update** — add optional `failure_mode?: FailureMode` field to `StoreExecutionTraceRequestSchema` (`repos/metabob-activity-api/src/models/schemas.ts:831`) and to the `activity_execution_traces` table via a new SurrealDB migration. Existing rows: `null`. No backfill.
- **Workbench validation surface** — extend `ValidationErrorDisplay.tsx` (today only handles authoring-time shape errors) to render runtime validator output. Add a per-task validation indicator (pass/fail/confidence) to `ImpulseStatePanel.tsx`. Surface `failure_mode` in `ExecutionHistoryPanel.tsx` so post-execution analysis stratifies by failure type.

## Capabilities

### New Capabilities

- `validator-activity-convention`: defines what it takes for an activity to be a validator (output shape, input declaration, wildcard semantics) so any activity emitting `validation_result` is dispatchable as one.
- `validation-result-shape`: single canonical shape with persistence contract; replaces three ad-hoc shapes already in flight.
- `failure-mode-taxonomy`: structured `failure_mode` object recorded on the trace; one field, five enumerated types, mode-specific context.
- `validator-dispatch-meta-activity`: lifecycle-driven template that finds and dispatches validators for produced shapes; hybrid invocation, sync execution, opt-out via task config.
- `inline-validation-migration`: deletion of the inline executor validation block and the three hardcoded learning-signal sites; replacement of both with activity-driven equivalents.
- `multi-scope-success-signals`: definition of task / activity / goal / downstream scopes and how learning queries read each scope's signal from the trace.
- `workbench-validation-surface`: extensions to `ValidationErrorDisplay`, `ImpulseStatePanel`, and `ExecutionHistoryPanel` for runtime validator output and structured failure modes.

### Modified Capabilities

- `discover-by-shapes-mode-extension` (sibling spec `impulse-binding-selection-layer`): extends the route's backward mode to accept an `output_shapes` filter. The validator-dispatch meta-activity is the first consumer.
- `selection-resolvers` (sibling spec `impulse-binding-selection-layer`): the `producer_selection` resolver is reused to choose among validator candidates. No interface change; one more call-site.

## Impact

- `repos/minibob/src/activity.ts` — delete inline validation block at `:5454-5529`; delete three `recordImpulseRelevance` call sites at `:5471, :5574, :5719`; the existing `lifecycle:task:completed` emit at `:2386` is unchanged but now carries the meta-activity. Net deletion: roughly 80 lines.
- `repos/minibob/src/resolvers/validation-resolver.ts:117-138`, `pattern-validator.ts:140-160`, `pre-validation-resolver.ts:140-160` — shape names converge on `validation_result`; bodies migrated to the unified contract.
- `repos/minibob/src/resolvers/learning-signal-writer-resolver.ts` (new) — wraps the three migrated `recordImpulseRelevance` paths plus the `recordToolArgumentPattern` block currently at `:5482-5527`.
- `repos/minibob/src/embedded-templates/validator-dispatch.json` (new) and registration in `repos/minibob/src/embedded-templates/index.ts`.
- `repos/metabob-activity-api/src/routes/activities.ts:3332-3465` — extend backward mode with `output_shapes` filter param.
- `repos/metabob-activity-api/src/models/schemas.ts` — add `failure_mode?: FailureMode` to `StoreExecutionTraceRequestSchema` and a `FailureModeSchema` zod definition.
- `repos/metabob-activity-api/sql/migrations/<next>-failure-mode-taxonomy.surql` (new) — adds `failure_mode` field to `activity_execution_traces`.
- `repos/workbench/src/components/trajectory/ValidationErrorDisplay.tsx`, `ImpulseStatePanel.tsx`, `ExecutionHistoryPanel.tsx` — extend with runtime validator output, per-task indicators, and failure-mode rendering.
- New unit tests for the meta-activity, the migrated resolvers, the route filter, the trace schema, and the workbench surfaces.

## Dependencies

- Sibling spec `impulse-binding-selection-layer` (in flight, same date) — this spec reuses its `producer_selection` resolver and its `discover-by-shapes` mode extension. The output-shape filter on backward mode is added by *this* spec to the same route, since the binding spec only added `candidates_with_scores`. If the binding spec lands first the filter is a delta on its extension; if this spec lands first the filter is the initial extension and the binding spec's `candidates_with_scores` mode is layered on top. Either order works — the changes are additive.
- Sibling spec `shape-provider-goal-creation` (in flight, same date) — its depth/cycle/budget guards map to the `safety_breach` and `budget_exhausted` `failure_mode` types defined here. Its "auto-flag-not-fail" behavior corresponds to setting `failure_mode` and continuing rather than hard-failing. This spec defines the failure_mode object; the sibling spec sets it in the cases it owns.
