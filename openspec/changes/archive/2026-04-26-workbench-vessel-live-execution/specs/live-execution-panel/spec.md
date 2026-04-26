## MODIFIED Requirements

### Requirement: Execution ID connection panel
The trajectory editor SHALL provide a "Live Execution" panel containing: an executionId text input field, a "Connect" button, and a connection status badge (idle / connecting / live / completed / failed). This panel SHALL be rendered inside the right-side live execution Sheet (see `live-execution-split-view` capability), NOT in the left sidebar scroll area. The executionId MAY also be supplied via `?executionId=` URL query param, in which case the panel SHALL auto-connect on page load. When `activeExecutionId` changes in `trajectoryStore` (e.g., from execution history "load" action), the panel SHALL reflect the new executionId in the input field and auto-connect.

#### Scenario: Manual connect by executionId
- **WHEN** the user enters an executionId and clicks Connect
- **THEN** the panel shows "connecting" badge and subscribes to the activity-api WebSocket for that execution

#### Scenario: Auto-connect from URL param
- **WHEN** the page loads with `?executionId=exec_xxx` in the URL
- **THEN** the panel auto-connects without user interaction and shows "live" badge

#### Scenario: Auto-connect when store activeExecutionId is set externally
- **WHEN** `trajectoryStore.activeExecutionId` is set (e.g., via execution history load)
- **THEN** the panel populates the executionId input with the new value and auto-connects

#### Scenario: Connection failure
- **WHEN** the WebSocket cannot authenticate or the executionId is not found
- **THEN** the panel shows a "failed" badge with the error reason

#### Scenario: Panel is inside the right-side Sheet
- **WHEN** a live execution is connected
- **THEN** `LiveExecutionPanel` renders inside the Sheet opened from the right — it does NOT appear in the left sidebar

## ADDED Requirements

### Requirement: No-events fallback when execution produces no task events within 30 seconds
See `live-execution-no-events-fallback` capability spec for full requirement and scenarios.

The `LiveExecutionPanel` SHALL integrate the no-events fallback timer and notice as defined in that capability. The notice SHALL render in place of (or above) the empty resolution timeline area.

#### Scenario: Fallback notice appears in panel after 30s silence
- **WHEN** `isLiveConnected` is `true` and `taskResolutions.size === 0` for 30 consecutive seconds
- **THEN** the panel body shows the "No task events received" notice instead of an empty timeline
