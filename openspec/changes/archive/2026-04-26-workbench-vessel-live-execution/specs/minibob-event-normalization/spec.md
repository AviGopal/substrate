## ADDED Requirements

### Requirement: normalizeMiniBobEvent translates MiniBob envelope to activity-api flat format
`useTrajectoryExecution` SHALL export (internally) a `normalizeMiniBobEvent(raw: unknown): TrajectoryExecutionEvent | null` function that translates MiniBob's namespaced event envelope `{ type: "activity:<event>", timestamp, data: {...} }` to the activity-api flat event format consumed by `isTrajectoryEvent`. The normalization SHALL cover at minimum: `activity:started` → `task.started`, `activity:task-completed` → `task.completed`, `impulse:completed` → `impulse.resolved`. Unknown MiniBob event types SHALL return `null`.

#### Scenario: activity:task-completed is normalized to task.completed
- **WHEN** a MiniBob WS message arrives as `{ type: "activity:task-completed", data: { executionId: "exec_1", taskId: "t_1", status: "completed" } }`
- **THEN** `normalizeMiniBobEvent` returns `{ type: "task.completed", activityId: "exec_1", taskId: "t_1", success: true, output_impulse_ids: [] }`

#### Scenario: activity:task-completed with status "failed" maps success to false
- **WHEN** a MiniBob WS message arrives as `{ type: "activity:task-completed", data: { executionId: "exec_1", taskId: "t_2", status: "failed" } }`
- **THEN** `normalizeMiniBobEvent` returns `{ type: "task.completed", activityId: "exec_1", taskId: "t_2", success: false, output_impulse_ids: [] }`

#### Scenario: activity:started is normalized to task.started
- **WHEN** a MiniBob WS message arrives as `{ type: "activity:started", data: { executionId: "exec_1", templateId: "tmpl_A" } }`
- **THEN** `normalizeMiniBobEvent` returns `{ type: "task.started", activityId: "tmpl_A", taskId: "exec_1", taskIndex: 0 }`

#### Scenario: Unknown MiniBob event type returns null
- **WHEN** a WS message arrives as `{ type: "activity:unknown-event", data: {} }`
- **THEN** `normalizeMiniBobEvent` returns `null` and no store update is triggered

#### Scenario: Activity-api flat events pass through unmodified
- **WHEN** a WS message arrives already in flat format `{ type: "task.completed", activityId: "a", taskId: "t", success: true }`
- **THEN** the event is processed directly by `isTrajectoryEvent` without normalization and the task resolution state is updated

### Requirement: Synthetic impulse-resolved entry injected for normalized MiniBob task-completed events
When `useTrajectoryExecution` processes a normalized `task.completed` event sourced from a MiniBob `activity:task-completed` message, it SHALL also inject a synthetic `impulse.resolved` entry into `taskResolutions` with `tier: "deterministic"`, `resolver: "minibob"`, and `shape: "task_result"` so that `LiveExecutionPanel`'s resolution timeline shows at least one row per MiniBob task.

#### Scenario: Resolution timeline shows minibob row after task completes
- **WHEN** a MiniBob `activity:task-completed` event is processed for `taskId: "t_1"`
- **THEN** `taskResolutions.get("t_1")` contains at least one entry with `resolver: "minibob"` and `tier: "deterministic"`

#### Scenario: Tasks with zero real impulse events still show synthetic row
- **WHEN** a MiniBob task completes and no `impulse:completed` events were received for that task
- **THEN** the resolution sub-list for that task in `LiveExecutionPanel` shows exactly one row (the synthetic minibob row)

### Requirement: MiniBob broadcast functions called in goalExecution handler
The MiniBob `goalExecution` HTTP handler SHALL call `broadcastActivityStarted(executionId, ...)` before invoking `processGoal`, and SHALL call `broadcastActivityTaskCompleted(executionId, ...)` in the resolved `.then()` branch (success) and in the catch branch (failure). These functions SHALL NOT be imported-only dead code.

#### Scenario: WS clients receive activity:started when goal submission begins
- **WHEN** a client calls `POST /execute-goal` on MiniBob
- **THEN** connected WS clients receive a broadcast event before goal processing begins

#### Scenario: WS clients receive task completion after goal finishes
- **WHEN** `processGoal` resolves successfully
- **THEN** connected WS clients receive a `task.completed`-equivalent broadcast with `status: "completed"`

#### Scenario: WS clients receive failure broadcast when goal throws
- **WHEN** `processGoal` rejects
- **THEN** connected WS clients receive a `task.completed`-equivalent broadcast with `status: "failed"` and the error message
