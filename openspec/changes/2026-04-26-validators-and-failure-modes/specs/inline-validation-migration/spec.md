## ADDED Requirements

### Requirement: Inline validation block at activity.ts:5454-5529 is removed
The inline `if (task.validation) { ... }` block in `ActivityExecutor` at `repos/minibob/src/activity.ts:5454-5529` SHALL be deleted. The block's body — the `runValidation` call, the `validationResults` capture, the `recordImpulseRelevance` call, the `recordToolArgumentPattern` loop, and the early `return { status: "failed", ... }` path — SHALL be replaced by activity-driven equivalents (the validator-dispatch meta-activity and the `learning_signal_writer` resolver).

#### Scenario: Executor source no longer references task.validation inline
- **WHEN** the migration is complete
- **THEN** `repos/minibob/src/activity.ts` contains no `if (task.validation)` block in the task-completion path; `task.validation` is forwarded to the lifecycle event payload (so the meta-activity can read it) but the executor does not consume it directly

#### Scenario: No early return on validation failure from the executor
- **WHEN** a task whose output fails validation completes
- **THEN** the executor does NOT return `{ status: "failed", ... }` due to validation; the verdict arrives via the meta-activity's stamped `failure_mode` and the trace's `validation_result` impulses

### Requirement: Three hardcoded recordImpulseRelevance call sites are removed
The three call sites at `repos/minibob/src/activity.ts:5471, :5574, :5719` SHALL be deleted. The `learning_signal_writer` resolver SHALL produce equivalent `mcp.recordImpulseRelevance` calls when invoked from the validator-dispatch meta-activity. The private methods `recordImpulseRelevance` (`activity.ts:5867-5920`) and `recordErrorImpulseRelevance` (`activity.ts:5922-5970`) MAY remain on `ActivityExecutor` if other call sites still use them, or be removed if they become unreferenced.

#### Scenario: No call to recordImpulseRelevance in the task-completion paths
- **WHEN** a task completes (success, validation-fail, or execution-error)
- **THEN** the executor's task-completion branches do NOT call `this.recordImpulseRelevance(...)`; the equivalent MCP write happens inside `learning_signal_writer` invoked by the meta-activity

#### Scenario: Equivalence — same MCP call sequence
- **WHEN** a task completes with `executionSucceeded: true`, `templateId`, and a non-empty `taskImpulseIds` set
- **THEN** the `mcp.recordImpulseRelevance` calls produced by `learning_signal_writer` match (per-impulse) the calls the inline path would have produced, given the same inputs

### Requirement: Inline tool-argument-pattern loop is removed
The `recordToolArgumentPattern` loop at `repos/minibob/src/activity.ts:5482-5527` (the validation-failed branch) SHALL be deleted, along with its matching success and execution-error counterparts. The `learning_signal_writer` resolver SHALL produce equivalent `mcp.recordToolArgumentPattern` calls when its config includes `signals: ["tool_argument_pattern"]`.

#### Scenario: No inline mcp.recordToolArgumentPattern in task-completion paths
- **WHEN** a task completes
- **THEN** the executor does NOT call `mcp.recordToolArgumentPattern` from any inline path

#### Scenario: Same per-tool call sequence via learning_signal_writer
- **WHEN** a task completes with N `toolCallRecords`
- **THEN** the resolver invokes `mcp.recordToolArgumentPattern` exactly N times with the same `inferArgumentShape` and `generateStableArgumentId` derivation as the deleted inline loop

### Requirement: Cascading failure_mode is the only structured-failure logic added to the executor
The executor SHALL gain at most one structured-failure code path: the cascading-skip branch sets `failure_mode: { type: "cascading", context: { upstream_task_id, upstream_failure_mode } }` on the skipped task's metadata. No other `failure_mode` types SHALL be set by executor source — they are set by the activities, resolvers, or meta-activities that detect them.

#### Scenario: Cascading is the only failure_mode set by the executor
- **WHEN** the migration is complete
- **THEN** a search of `repos/minibob/src/activity.ts` for `failure_mode` shows only the cascading-stamp site (and its tests); `verifier_negative`, `budget_exhausted`, `safety_breach`, and `user_abort` are set elsewhere

#### Scenario: Cascading branch reads upstream failure_mode
- **WHEN** task B is skipped because upstream task A failed and A's metadata carries `failure_mode.type === "verifier_negative"`
- **THEN** task B's `failure_mode.context.upstream_failure_mode` carries A's full failure_mode object

### Requirement: task.validation continues to be a valid template field
The migration SHALL preserve `task.validation` as a valid field on activity templates. Templates that declare `task.validation` SHALL still produce validation behaviour — but the behaviour SHALL flow through the validator-dispatch meta-activity rather than the deleted inline path. The `validation` resolver SHALL remain registered and SHALL be the canonical validator for `task.validation`-style spec inputs.

#### Scenario: Existing template with task.validation still validates
- **WHEN** a template declares `task.validation: { requiredFiles: [...], requiredPatterns: [...] }` and runs after migration
- **THEN** the spec is forwarded to the lifecycle payload; the validator-dispatch meta-activity dispatches the `validation` resolver; a `validation_result` impulse is emitted; if `passed: false`, the parent task's `failure_mode` is stamped `verifier_negative`

#### Scenario: Templates relying on early-exit semantics need a one-line audit
- **WHEN** a template previously relied on the inline `return { status: "failed" }` to halt downstream tasks on validation failure
- **THEN** the template author adds a downstream `condition` task that consumes the `validation_result` impulse and short-circuits when `passed === false`; the migration documentation flags this as the one required template adjustment
