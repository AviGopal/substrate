## ADDED Requirements

### Requirement: InlineExecutionBar renders above the trajectory grid during active execution
`TrajectoryEditorPage` SHALL render an `InlineExecutionBar` component in a fixed row above the trajectory grid when `executionId !== null`. The bar SHALL be hidden when `executionId` is null. The bar is NOT rendered inside a Sheet or the left sidebar.

#### Scenario: Bar appears when execution starts
- **WHEN** `GoalSubmissionPanel` calls `onExecutionStarted(executionId)` and `executionId` is set
- **THEN** the `InlineExecutionBar` becomes visible above the trajectory grid

#### Scenario: Bar is absent when no execution is active
- **WHEN** `executionId` is null (no active or recently completed execution)
- **THEN** no `InlineExecutionBar` is rendered

### Requirement: InlineExecutionBar shows execution ID, connection badge, and disconnect button
The `InlineExecutionBar` SHALL display: (1) the current `executionId` in monospace truncated text, (2) a connection-state badge matching the state from `wsConnectionState` ("connecting" / "live" / "done" / "failed"), and (3) a "disconnect" button that clears the active execution when clicked.

#### Scenario: Live state shows animated badge
- **WHEN** `wsConnectionState === 'connected'`
- **THEN** the bar shows a pulsing "live" badge (blue, Radio icon)

#### Scenario: Connecting state shows spinner badge
- **WHEN** `wsConnectionState === 'connecting'`
- **THEN** the bar shows a spinning "connecting" badge

#### Scenario: Disconnect button clears execution state
- **WHEN** the user clicks the disconnect button in the bar
- **THEN** `setActiveExecutionId(null)` is called, `activeWsUrl` is cleared, and the bar disappears

### Requirement: InlineExecutionBar shows no-events notice after 30 seconds of silence
The `InlineExecutionBar` SHALL start a 30-second timer when `wsConnectionState === 'connected'` and `taskResolutions.size === 0`. If no resolution events arrive within that window, the bar SHALL render a short notice: "No task events received — execution may have completed silently or the vessel is unreachable." The timer SHALL be cancelled if any resolution events arrive or if the execution disconnects.

#### Scenario: Notice appears after 30s of silence
- **WHEN** the execution is live and no `impulse.resolved` events arrive for 30 consecutive seconds
- **THEN** the notice text is rendered inside the bar

#### Scenario: Notice is suppressed when events arrive before 30s
- **WHEN** at least one `impulse.resolved` event arrives within 30 seconds of connection
- **THEN** no notice is shown (timer is cancelled)

#### Scenario: Notice disappears on disconnect
- **WHEN** the user disconnects before or after the notice appears
- **THEN** the bar and notice are removed
