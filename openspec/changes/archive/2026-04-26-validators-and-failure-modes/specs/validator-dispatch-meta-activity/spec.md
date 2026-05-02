## ADDED Requirements

### Requirement: validator-dispatch meta-activity subscribes to lifecycle:task:completed
A new embedded activity template `validator-dispatch` SHALL be registered in `repos/minibob/src/embedded-templates/index.ts` with `subscription: { shape: "lifecycle:task:completed" }`. The template SHALL be loaded at MiniBob startup so the lifecycle-subscription pipeline picks it up.

#### Scenario: Template loads at startup
- **WHEN** MiniBob starts and `embedded-templates/index.ts` runs
- **THEN** `validator-dispatch.json` is registered as an activity template with `subscription.shape === "lifecycle:task:completed"`

#### Scenario: Lifecycle event triggers nested execution
- **WHEN** the executor emits `lifecycle:task:completed` for any task
- **THEN** the validator-dispatch meta-activity runs as a nested execution, exactly as other lifecycle subscribers do

### Requirement: Meta-activity discovers validators via discover-by-shapes
The first task of the meta-activity SHALL call `POST /v2/activities/discover-by-shapes` with `mode: "backward"`, `required_shapes: <produced_shapes_from_lifecycle_payload>`, and `output_shapes: ["validation_result"]`. The route's response SHALL be filtered by the meta-activity to keep only specialized validators (whose `input_shapes` literally contains a produced shape) plus wildcard validators (`input_shapes: ["*"]`).

#### Scenario: Discovery call includes output_shapes filter
- **WHEN** the meta-activity dispatches its discover task for a task that produced shape `bash_output`
- **THEN** the outbound POST body includes `mode: "backward"`, `required_shapes: ["bash_output"]`, and `output_shapes: ["validation_result"]`

#### Scenario: No validators registered returns empty candidates
- **WHEN** `discover-by-shapes` returns an empty activities array
- **THEN** the meta-activity proceeds to the `learning_signal_writer` task without dispatching any validators; no `validation_result` impulses are produced

### Requirement: Hybrid invocation — auto-dispatch with skip_validation opt-out
The meta-activity SHALL auto-dispatch validators when at least one is registered for a produced shape. The parent task MAY opt out by setting `skip_validation: true` on its task config; the lifecycle payload SHALL forward this flag. When `skip_validation: true`, the meta-activity SHALL short-circuit at the discover step without invoking `discover-by-shapes` or any downstream tasks.

#### Scenario: Default auto-dispatch
- **WHEN** a task with no `skip_validation` field completes and produces a shape with at least one registered specialized validator
- **THEN** the meta-activity dispatches the validator

#### Scenario: skip_validation: true short-circuits
- **WHEN** a task config sets `skip_validation: true` and the task completes
- **THEN** the meta-activity exits at its discover task without invoking the route or dispatching validators; no `validation_result` impulses are produced

#### Scenario: skip_validation: false (explicit) is the same as omitting the flag
- **WHEN** a task config sets `skip_validation: false`
- **THEN** the meta-activity behaves identically to the default (auto-dispatch when validators exist)

### Requirement: Synchronous execution holds task completion until validators finish
Validator dispatch SHALL be synchronous: the meta-activity's nested execution SHALL complete before the parent task's `lifecycle:task:completed` event is considered fully propagated. Downstream subscribers to `lifecycle:task:completed` SHALL see the dispatched validators' `validation_result` impulses in the impulse pool.

#### Scenario: Validator runs before downstream task starts
- **WHEN** task A completes producing shape `bash_output`, a validator is registered, and task B (depending on A) is the next sequential task
- **THEN** the validator's `validation_result` impulse is in the pool when task B's gate (`canExecuteTask`) is evaluated

#### Scenario: No async deferral
- **WHEN** the meta-activity is dispatched
- **THEN** it does NOT return before its nested validator executions complete; the parent execution's call stack waits

### Requirement: Specialized validators preferred over wildcards via producer_selection
When multiple validators match a produced shape, the meta-activity SHALL invoke the `producer_selection` resolver from sibling spec `impulse-binding-selection-layer` over the candidate set, scoped to the specialized matches. Wildcard validators SHALL be considered only when the specialized list is empty.

#### Scenario: Two specialized validators routed through producer_selection
- **WHEN** for shape `bash_output`, two specialized validators are registered, and a wildcard validator is also registered
- **THEN** the meta-activity invokes `producer_selection` with the two specialized candidates; the wildcard is not considered

#### Scenario: Only wildcard validators registered
- **WHEN** for shape `unusual_shape`, no specialized validators are registered but a wildcard validator is
- **THEN** the meta-activity dispatches the wildcard validator without invoking `producer_selection` (single-candidate case)

### Requirement: Meta-activity propagates failure_mode on negative validation
When a dispatched validator emits a `validation_result` impulse with `passed: false`, the meta-activity SHALL stamp `failure_mode: { type: "verifier_negative", reason: <validator's first error message or default>, context: { validator_id, failed_evidence: <evidence rows where passed=false> } }` onto the parent task's metadata before the lifecycle subscriber merge completes.

#### Scenario: Negative validation stamps verifier_negative
- **WHEN** the validator emits `validation_result` with `passed: false`, `validator_id: "schema-validator"`, and one failed evidence row
- **THEN** the parent task's metadata carries `failure_mode: { type: "verifier_negative", context: { validator_id: "schema-validator", failed_evidence: [<the failed row>] } }`

#### Scenario: Multiple validators, one fails
- **WHEN** two validators run for a single produced shape and one passes, one fails
- **THEN** the parent task's metadata carries the `failure_mode` from the failed validator; the passed `validation_result` is preserved in the impulse pool but does not override

#### Scenario: All validators pass — no failure_mode stamped
- **WHEN** all dispatched validators emit `validation_result` with `passed: true`
- **THEN** no `failure_mode` is stamped on the parent task's metadata

### Requirement: Meta-activity invokes learning_signal_writer as a final task
The meta-activity's final task SHALL invoke the `learning_signal_writer` resolver with the task outcome (success / validation-fail / execution-error) and the task's impulse and tool-call records. This task SHALL run on every branch (success, validation-fail, execution-error) so the three migrated `recordImpulseRelevance` call sites are all replaced.

#### Scenario: Writer runs on successful task
- **WHEN** the parent task's `lifecycle:task:completed` carries `status: "completed"` and validators pass (or none are registered)
- **THEN** the meta-activity invokes `learning_signal_writer` with `executionSucceeded: true`

#### Scenario: Writer runs on validator-failed task
- **WHEN** a validator emits `passed: false`
- **THEN** the meta-activity invokes `learning_signal_writer` with `executionSucceeded: false`

#### Scenario: Writer runs on execution-error task
- **WHEN** the parent task's `lifecycle:task:completed` carries `status: "failed"` due to an executor exception
- **THEN** the meta-activity invokes `learning_signal_writer` with `executionSucceeded: false`
