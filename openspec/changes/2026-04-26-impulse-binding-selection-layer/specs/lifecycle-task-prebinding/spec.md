## ADDED Requirements

### Requirement: ActivityExecutor emits lifecycle:task:preBinding before canExecuteTask
`ActivityExecutor` SHALL emit a `lifecycle:task:preBinding` impulse via `emitLifecycleImpulse` before invoking `canExecuteTask` for any task that declares a non-empty `inputShapes` array. The emit SHALL be `await`ed so subscriber outputs are merged into the impulse pool before the gate runs. Tasks with no `inputShapes` SHALL NOT trigger the emit.

#### Scenario: Task with inputShapes triggers emission
- **WHEN** a task with `inputShapes: ["goal", "errorLog"]` enters execution
- **THEN** the executor emits `lifecycle:task:preBinding` exactly once before `canExecuteTask` is called for that task

#### Scenario: Task without inputShapes skips emission
- **WHEN** a task has no `inputShapes` field or an empty array
- **THEN** the executor does NOT emit `lifecycle:task:preBinding`

### Requirement: Emission payload includes binding context
The `lifecycle:task:preBinding` payload SHALL include `taskId: string`, `templateId: string`, `inputShapes: string[]`, `currentImpulseIds: string[]`, `missingShapes: string[]`, `variables: Record<string, unknown>`, `executionId: string`, `parentGoalText: string | undefined`, and `parentDepth: number`. `executionId` is the id of the currently-executing activity (the emitter), NOT a parent-of-emitter id; subscriber meta-activities use it to correlate their nested execution with the parent trace via `parent_execution_id`/`composition_chain`. `missingShapes` SHALL be computed as `inputShapes` minus the set of shapes present in the current impulse pool. `parentGoalText` SHALL be sourced from the executing activity's goal context (the value passed via `ExecuteOptions.goalContext`, falling back to `reason`); when neither is available the field SHALL be `undefined`. Subscribers SHALL tolerate `undefined` explicitly (e.g. by falling back to a documented framing string). `parentDepth` SHALL be the count of ancestor activities in the executor's composition chain (i.e. the length of the executor's `activityCallStack`, which is root-first and excludes the currently-executing activity itself); the value SHALL default to `0` for root executions with no ancestors. Subscribers (e.g. `slot-binding`'s `escalate_unbindable` task forwarding to `create-shape-provider-goal`) use `parentDepth` to enforce a recursion-safety guard (default `max_recursion_depth: 3`).

#### Scenario: Payload reports missing shapes
- **WHEN** a task declares `inputShapes: ["goal", "errorLog"]` and the pool contains an impulse with shape `goal` but none with shape `errorLog`
- **THEN** the emitted payload includes `missingShapes: ["errorLog"]`

#### Scenario: Payload reports empty missingShapes when all shapes are satisfied
- **WHEN** the impulse pool already contains all declared `inputShapes`
- **THEN** the payload includes `missingShapes: []` and emission still occurs

#### Scenario: Payload carries parentGoalText when executor has goal context
- **WHEN** the executor was invoked via `execute({ template, variables, goalContext: "fix the failing tests" })` and a task with non-empty `inputShapes` enters execution
- **THEN** the emitted payload includes `parentGoalText: "fix the failing tests"` so subscribers (e.g. `slot-binding`'s `escalate_unbindable` task) can forward it to a recursively-dispatched activity

#### Scenario: Payload reports parentGoalText as undefined when executor lacks goal context
- **WHEN** the executor was invoked without `goalContext` or `reason` (e.g. a direct `execute({ template, variables })` call) and a task with non-empty `inputShapes` enters execution
- **THEN** the emitted payload's `parentGoalText` is `undefined`; subscriber templates that interpolate `{{lifecycle.parentGoalText}}` will see the placeholder left unchanged (the dotted-path interpolator preserves placeholders for missing segments per `repos/minibob/src/activity.ts` interpolate semantics), and downstream LLM tasks SHALL fall back to a documented framing such as `<no parent goal text available>` when their input matches the literal placeholder or is otherwise empty

#### Scenario: Payload reports parentDepth as 0 for root executions
- **WHEN** the executor is invoked at the top level with no ancestor activities (i.e. `activityCallStack` is empty or undefined) and a task with non-empty `inputShapes` enters execution
- **THEN** the emitted payload includes `parentDepth: 0` so subscribers (e.g. `slot-binding`'s `escalate_unbindable` task) forward `parent_depth: 0` to the recursively-dispatched activity, allowing the recursion-safety guard's depth comparison to start at the floor

#### Scenario: Payload reports parentDepth equal to ancestor count for nested executions
- **WHEN** the executor is invoked as a nested dispatch from a parent activity that was itself dispatched from a root activity (i.e. `activityCallStack: [rootTemplateId, parentTemplateId]`, length 2) and a task with non-empty `inputShapes` enters execution
- **THEN** the emitted payload includes `parentDepth: 2`, and a subscriber that forwards `parent_depth: "{{lifecycle.parentDepth}}"` to a recursively-dispatched `create-shape-provider-goal` enables that activity's recursion-safety guard (default `max_recursion_depth: 3`) to fire correctly when the chain would exceed the threshold (the dispatched activity treats its own depth as `parent_depth + 1` for the guard check)

### Requirement: Subscriber outputs are merged into the parent impulse pool
Output impulses produced by activities subscribed to `lifecycle:task:preBinding` SHALL be merged into the parent task's impulse pool before `canExecuteTask` is invoked. Merge behaviour SHALL match the existing `lifecycle:activity:preExecution` merge path: dedupe by impulse id, append to the shared array.

#### Scenario: Subscriber emits supplemental impulse before gate
- **WHEN** a subscriber to `lifecycle:task:preBinding` returns an impulse with the missing shape
- **THEN** that impulse is present in the pool when `canExecuteTask` runs and the gate passes

#### Scenario: Existing LLM-fallback path is preserved
- **WHEN** subscribers fail to enrich the pool and `canExecuteTask` returns `canExecute: false`
- **THEN** the executor's existing LLM-fallback branch (currently at `repos/minibob/src/activity.ts:4408`) runs unchanged

### Requirement: Emission is non-breaking for activities without subscribers
When no activity is subscribed to `lifecycle:task:preBinding`, emission SHALL be a no-op beyond the impulse-store write. The executor SHALL NOT block, error, or change task semantics in this case.

#### Scenario: No subscriber registered
- **WHEN** `lifecycle:task:preBinding` is emitted and no template's `subscription.shape` matches
- **THEN** the executor proceeds to `canExecuteTask` with the unchanged impulse pool
