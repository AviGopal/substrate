## MODIFIED Requirements

### Requirement: Execution ID connection panel
The trajectory editor SHALL provide a "Live Execution" panel containing: an executionId text input field, a "Connect" button, and a connection status badge (idle / connecting / live / completed / failed). This panel SHALL be rendered inside the right-side live execution Sheet (see `live-execution-split-view` capability), NOT in the left sidebar scroll area. The executionId MAY also be supplied via `?executionId=` URL query param, in which case the panel SHALL auto-connect on page load.

#### Scenario: Manual connect by executionId
- **WHEN** the user enters an executionId and clicks Connect
- **THEN** the panel shows "connecting" badge and subscribes to the activity-api WebSocket for that execution

#### Scenario: Auto-connect from URL param
- **WHEN** the page loads with `?executionId=exec_xxx` in the URL
- **THEN** the panel auto-connects without user interaction and shows "live" badge

#### Scenario: Connection failure
- **WHEN** the WebSocket cannot authenticate or the executionId is not found
- **THEN** the panel shows a "failed" badge with the error reason

#### Scenario: Panel is inside the right-side Sheet
- **WHEN** a live execution is connected
- **THEN** `LiveExecutionPanel` renders inside the Sheet opened from the right — it does NOT appear in the left sidebar

### Requirement: Live card animation and task progress
While a live execution is connected, activity cards in the trajectory grid SHALL animate to show execution progress. The active activity card SHALL pulse. Completed task count SHALL update on the card in real time as `task.completed` events arrive. A failed task SHALL immediately show the failure overlay on the card.

#### Scenario: Active card pulses during execution
- **WHEN** an activity starts executing (execution_started or task.started event)
- **THEN** the corresponding activity card shows a pulsing animation and "running" status

#### Scenario: Task completion updates card progress
- **WHEN** a task.completed event arrives for a running activity
- **THEN** the card's completed task count increments and shows duration/cost from the event

#### Scenario: Execution completion stops animation
- **WHEN** execution_completed event arrives
- **THEN** all card animations stop, the final status badge (success/failure) is shown, and the panel switches to "completed" status

### Requirement: Disconnect and reconnect
The live execution panel SHALL support explicit disconnect (button) and automatic reconnect with catchup on transient network failures. On reconnect, missed events SHALL be replayed via the WS catchup protocol.

#### Scenario: Explicit disconnect
- **WHEN** the user clicks Disconnect
- **THEN** the WebSocket is closed, the Sheet closes, and execution state is cleared

#### Scenario: Automatic reconnect with event catchup
- **WHEN** the WebSocket drops due to a transient network error
- **THEN** the panel reconnects with exponential back-off and replays missed events via the `lastSeenSequence` catchup header

## ADDED Requirements

### Requirement: Per-task impulse resolution timeline in LiveExecutionPanel
While a live execution is connected, `LiveExecutionPanel` SHALL display a per-task resolution timeline sourced from `taskResolutions` in trajectoryStore. For each task that has received at least one `impulse.resolved` event, the panel SHALL render an inline sub-list showing each resolution event as: shape badge (color-coded by tier), resolver name, and latency if present.

#### Scenario: Task resolution events appear inline under the task row
- **WHEN** task "task_1" has two resolution events (one `deterministic`, one `llm`)
- **THEN** two sub-rows appear under the task's row in the panel: one green badge for deterministic, one blue badge for llm

#### Scenario: Tasks with zero resolutions show no sub-rows
- **WHEN** a task has started but no `impulse.resolved` events have arrived for it
- **THEN** the task row shows no resolution sub-rows

#### Scenario: Resolution events appear in arrival order
- **WHEN** three `impulse.resolved` events arrive for the same taskId at t=100ms, t=200ms, t=300ms
- **THEN** the sub-rows are rendered in that order (oldest first, newest at bottom)
