# live-execution-no-events-fallback Specification

## Purpose
TBD - created by archiving change workbench-vessel-live-execution. Update Purpose after archive.
## Requirements
### Requirement: No-events fallback notice after 30-second timeout
`LiveExecutionPanel` SHALL display a "completed without events" fallback notice when the WebSocket connection status is `"connected"` (`isLiveConnected === true`) and `taskResolutions.size === 0` for more than 30 consecutive seconds. The notice SHALL be dismissed automatically if any task resolution event arrives before the timer expires or after the notice is shown. The notice SHALL be cleared when the execution is disconnected.

#### Scenario: Fallback notice appears after 30s with no events
- **WHEN** `isLiveConnected` becomes `true` and no `task.started`, `task.completed`, or `impulse.resolved` events arrive within 30 seconds
- **THEN** `LiveExecutionPanel` shows a notice reading "No task events received — the execution may have completed silently or the vessel is unreachable"

#### Scenario: Fallback notice is not shown if events arrive within 30s
- **WHEN** `isLiveConnected` becomes `true` and a `task.completed` event arrives at t=5s
- **THEN** the 30-second timer is cancelled and no fallback notice is shown

#### Scenario: Fallback notice is dismissed when a late event arrives
- **WHEN** the fallback notice is already visible and a `task.completed` event then arrives
- **THEN** the notice is replaced by the task resolution timeline row for that task

#### Scenario: Fallback notice is cleared on disconnect
- **WHEN** the fallback notice is visible and the user clicks Disconnect
- **THEN** the notice disappears along with the rest of the execution state

#### Scenario: Fallback notice does not appear while events are actively arriving
- **WHEN** `taskResolutions.size >= 1` at any point during the 30-second window
- **THEN** the timer is reset and the notice never appears

