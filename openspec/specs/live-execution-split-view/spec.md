# live-execution-split-view Specification

## Purpose
TBD - created by archiving change workbench-vessel-live-execution. Update Purpose after archive.
## Requirements
### Requirement: LiveExecutionPanel displayed in right-side Sheet when execution is active
In `TrajectoryEditorPage`, when a live execution becomes connected (`executionId !== null && wsConnectionState === 'connected'`), a right-side `Sheet` (shadcn Sheet component) SHALL automatically open and contain the `LiveExecutionPanel`. The Sheet SHALL remain open until the execution is disconnected or the user explicitly closes it. The Sheet SHALL NOT replace the left sidebar — vessel selection and goal submission SHALL remain in the left sidebar at all times.

#### Scenario: Sheet auto-opens on execution start
- **WHEN** `GoalSubmissionPanel` calls `onExecutionStarted(executionId)` and the WS connection reaches "connected" state
- **THEN** the right-side Sheet becomes visible with `LiveExecutionPanel` inside

#### Scenario: Sheet auto-closes on disconnect
- **WHEN** the user clicks "disconnect" in `LiveExecutionPanel` or `setActiveExecutionId(null)` is called
- **THEN** the Sheet closes and the trajectory grid returns to full width

#### Scenario: Left sidebar remains visible while Sheet is open
- **WHEN** the live execution Sheet is open
- **THEN** the left sidebar with `VesselSelectorPanel`, `GoalSubmissionPanel`, and `ActivityPalette` is still visible and interactive

#### Scenario: Sheet can be manually closed without disconnecting
- **WHEN** the user clicks the Sheet's close control (X button or outside-click) while an execution is running
- **THEN** the Sheet closes but the execution stays connected (execution state not cleared), and the header badge still shows "Live Execution"

### Requirement: LiveExecutionPanel removed from left sidebar
`LiveExecutionPanel` SHALL NOT appear in the left sidebar `ScrollArea` when the split-view Sheet is active. The sidebar area previously occupied by `LiveExecutionPanel` SHALL be reclaimed (no empty placeholder).

#### Scenario: Left sidebar has no LiveExecutionPanel slot
- **WHEN** there is no active execution
- **THEN** the left sidebar shows VesselSelectorPanel, GoalSubmissionPanel, ExecutionHistoryPanel, GoalInputBox, and ActivityPalette — no LiveExecutionPanel component

#### Scenario: LiveExecutionPanel appears only in the Sheet
- **WHEN** a live execution is active and the Sheet is open
- **THEN** `LiveExecutionPanel` renders exclusively inside the Sheet, not in both locations

### Requirement: Sheet width and scroll behavior
The live execution Sheet SHALL have a minimum width of 320px and a maximum width of 480px and SHALL scroll internally when the task-resolution timeline overflows.

#### Scenario: Sheet scrolls independently of the trajectory grid
- **WHEN** the task resolution timeline is taller than the viewport
- **THEN** the Sheet's scroll area allows the user to scroll the timeline without affecting the main grid

