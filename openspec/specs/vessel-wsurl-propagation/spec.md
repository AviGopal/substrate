# vessel-wsurl-propagation Specification

## Purpose
TBD - created by archiving change workbench-vessel-live-execution. Update Purpose after archive.
## Requirements
### Requirement: submitTrajectory returns vessel-provided wsUrl alongside executionId
`useTrajectoryExecution.submitTrajectory` SHALL return `Promise<{ executionId: string; wsUrl?: string }>`. When the vessel response content contains a `wsUrl: <url>` field, `wsUrl` SHALL be populated with that URL. When absent, `wsUrl` SHALL be `undefined`.

#### Scenario: Vessel response with wsUrl populates return value
- **WHEN** the vessel resolution response content is `"executionId: abc123 wsUrl: ws://vessel:8083/exec/abc123"`
- **THEN** `submitTrajectory` resolves to `{ executionId: "abc123", wsUrl: "ws://vessel:8083/exec/abc123" }`

#### Scenario: Vessel response without wsUrl returns undefined wsUrl
- **WHEN** the vessel resolution response content is `"executionId: abc123"`
- **THEN** `submitTrajectory` resolves to `{ executionId: "abc123", wsUrl: undefined }`

#### Scenario: Activity-api fallback path also returns the shape
- **WHEN** no vessel is selected and the activity-api fallback is used
- **THEN** `submitTrajectory` resolves to `{ executionId: <id>, wsUrl: undefined }` (activity-api does not provide wsUrl)

### Requirement: GoalSubmissionPanel forwards wsUrl from submitTrajectory to onExecutionStarted
When `handleRunTrajectory` calls `submitTrajectory`, the returned `wsUrl` SHALL be passed as the second argument to `onExecutionStarted`. This ensures the TrajectoryEditorPage wires `activeWsUrl` to the vessel-provided stream for live monitoring.

#### Scenario: wsUrl propagated to onExecutionStarted
- **WHEN** `submitTrajectory` resolves with `{ executionId: "e1", wsUrl: "ws://v:8083/s" }`
- **THEN** `onExecutionStarted` is called with `("e1", "ws://v:8083/s")`

#### Scenario: Undefined wsUrl propagated as-is
- **WHEN** `submitTrajectory` resolves with `{ executionId: "e2", wsUrl: undefined }`
- **THEN** `onExecutionStarted` is called with `("e2", undefined)`

