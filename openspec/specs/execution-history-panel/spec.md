# execution-history-panel Specification

## Purpose
TBD - created by archiving change workbench-vessel-live-execution. Update Purpose after archive.
## Requirements
### Requirement: ExecutionHistoryPanel onLoadTrace sets active execution in trajectory store
When the user clicks the "load" button on a trace row in `ExecutionHistoryPanel`, the panel SHALL call `onLoadTrace(trace)`. The parent (`TrajectoryEditorPage`) SHALL handle this by calling `setActiveExecutionId(trace.executionId)` on `trajectoryStore`, causing `LiveExecutionPanel` to attempt a WS connection to that executionId.

#### Scenario: Clicking load on a trace row connects LiveExecutionPanel to that execution
- **WHEN** the user clicks the "load" button on a trace row with `executionId: "exec_abc"`
- **THEN** `trajectoryStore.activeExecutionId` is set to `"exec_abc"` and `LiveExecutionPanel` begins connecting to that execution's WS stream

#### Scenario: Loading a past trace does not replace the current grid columns
- **WHEN** the user clicks "load" on a historical trace while the trajectory grid has activities in columns 1–3
- **THEN** the grid columns are unchanged; only `activeExecutionId` changes

#### Scenario: The execution history panel is rendered in the left sidebar
- **WHEN** the trajectory editor page is mounted
- **THEN** `ExecutionHistoryPanel` appears in the left sidebar scroll area below `GoalSubmissionPanel`, visible regardless of whether a live execution is active

### Requirement: ExecutionHistoryPanel fetches and displays recent execution traces
`ExecutionHistoryPanel` SHALL use `useExecutionHistory(20)` to fetch the 20 most recent execution traces from `GET /v2/activities/execution-traces`. Each trace SHALL be shown as a row with: success/failure icon, activity name (truncated), duration, cost, and time-ago. The list SHALL refresh every 60 seconds.

#### Scenario: Recent traces are listed on expand
- **WHEN** the user clicks the execution history panel header to expand it
- **THEN** up to 20 trace rows appear, sorted newest-first, each showing activity name, duration, cost, and time-ago

#### Scenario: Loading state shown while fetching
- **WHEN** the component is expanded and the query is in flight
- **THEN** a spinner and "loading..." text appear instead of trace rows

#### Scenario: Empty state shown when no traces exist
- **WHEN** the query returns an empty array
- **THEN** the panel shows "No executions yet — run a goal to get started"

#### Scenario: Error state shown when fetch fails
- **WHEN** the `GET /v2/activities/execution-traces` request returns an error
- **THEN** the panel shows "Could not load traces" without throwing

