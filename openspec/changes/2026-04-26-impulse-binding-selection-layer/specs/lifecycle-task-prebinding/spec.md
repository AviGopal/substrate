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
The `lifecycle:task:preBinding` payload SHALL include `taskId: string`, `templateId: string`, `inputShapes: string[]`, `currentImpulseIds: string[]`, `missingShapes: string[]`, `variables: Record<string, unknown>`, and `executionId: string`. `executionId` is the id of the currently-executing activity (the emitter), NOT a parent-of-emitter id; subscriber meta-activities use it to correlate their nested execution with the parent trace via `parent_execution_id`/`composition_chain`. `missingShapes` SHALL be computed as `inputShapes` minus the set of shapes present in the current impulse pool.

#### Scenario: Payload reports missing shapes
- **WHEN** a task declares `inputShapes: ["goal", "errorLog"]` and the pool contains an impulse with shape `goal` but none with shape `errorLog`
- **THEN** the emitted payload includes `missingShapes: ["errorLog"]`

#### Scenario: Payload reports empty missingShapes when all shapes are satisfied
- **WHEN** the impulse pool already contains all declared `inputShapes`
- **THEN** the payload includes `missingShapes: []` and emission still occurs

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
