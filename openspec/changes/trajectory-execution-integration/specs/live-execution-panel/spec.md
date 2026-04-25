## ADDED Requirements

### Requirement: Execution ID connection panel
The trajectory editor SHALL provide a collapsible "Live Execution" panel in the left sidebar with: an executionId text input field, a "Connect" button, and a connection status badge (idle / connecting / live / completed / failed). The executionId MAY also be supplied via `?executionId=` URL query param, in which case the panel SHALL auto-connect on page load.

#### Scenario: Manual connect by executionId
- **WHEN** the user enters an executionId and clicks Connect
- **THEN** the panel shows "connecting" badge and subscribes to the activity-api WebSocket for that execution

#### Scenario: Auto-connect from URL param
- **WHEN** the page loads with ?executionId=exec_xxx in the URL
- **THEN** the panel auto-connects without user interaction and shows "live" badge

#### Scenario: Connection failure
- **WHEN** the WebSocket cannot authenticate or the executionId is not found
- **THEN** the panel shows a "failed" badge with the error reason

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
- **THEN** the WebSocket closes, the status badge shows "idle", and overlays remain (showing the last known state)

#### Scenario: Auto-reconnect on network drop
- **WHEN** the WebSocket connection drops unexpectedly
- **THEN** the panel attempts reconnect with exponential backoff and replays missed events via catchup protocol
