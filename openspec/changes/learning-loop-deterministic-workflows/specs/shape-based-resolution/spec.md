## ADDED Requirements

### Requirement: Resolve impulses by shape contract
The system SHALL resolve impulses by matching required shapes against available impulse shapes, without requiring specific impulse IDs.

#### Scenario: Find impulses matching required shape
- **WHEN** task requires shape `file_read_args` and impulse store contains impulses with that shape
- **THEN** `resolveImpulsesByShape()` returns map of shape → matching impulses

#### Scenario: Multiple impulses match same shape
- **WHEN** multiple impulses have shape `bash_args`
- **THEN** all matching impulses are returned for the shape key

#### Scenario: No impulses match shape
- **WHEN** task requires shape `git_args` but no impulses have that shape
- **THEN** shape key maps to empty array

### Requirement: Check task executability based on shapes
The system SHALL determine if a task can execute based on shape availability.

#### Scenario: Task executable when all shapes available
- **WHEN** task has `inputShapes: ["file_read_args"]` and impulse with that shape exists
- **THEN** `canExecuteTask()` returns `{canExecute: true, missing: []}`

#### Scenario: Task not executable when shapes missing
- **WHEN** task has `inputShapes: ["git_args", "bash_args"]` and only `bash_args` impulse exists
- **THEN** `canExecuteTask()` returns `{canExecute: false, missing: ["git_args"]}`

#### Scenario: Task without inputShapes always executable
- **WHEN** task has no `inputShapes` field
- **THEN** `canExecuteTask()` returns `{canExecute: true, missing: []}`

### Requirement: Fallback to LLM when shapes missing
The executor SHALL fall back to LLM-based execution when required shapes are unavailable.

#### Scenario: Resolver task falls back to LLM
- **WHEN** task has `resolver: "file"` and `inputShapes: ["file_read_args"]` but no matching impulse exists
- **THEN** executor logs warning and calls `executeWithLLM()` instead of `executeWithResolver()`

#### Scenario: Successful shape resolution proceeds to resolver
- **WHEN** task has `resolver: "bash"` and `inputShapes: ["bash_args"]` and matching impulse exists
- **THEN** executor proceeds with `executeWithResolver()` using resolved impulses

### Requirement: ActivityTask supports shape declarations
The `ActivityTask` type SHALL include optional `inputShapes` and `outputShapes` fields for shape-based routing.

#### Scenario: Task declares required input shapes
- **WHEN** task definition includes `inputShapes: ["file_read_args", "bash_args"]`
- **THEN** executor checks shape availability before routing

#### Scenario: Task declares output shapes
- **WHEN** task definition includes `outputShapes: ["stdout", "file_content"]`
- **THEN** executor creates output impulses with declared shapes after successful execution

#### Scenario: Backward compatible with tasks without shapes
- **WHEN** task has no `inputShapes` or `outputShapes` fields
- **THEN** executor behaves as before (ID-based or prompt-based execution)
