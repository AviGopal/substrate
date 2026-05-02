## ADDED Requirements

### Requirement: System streams execution progress in real-time

The system SHALL connect to the WebSocket endpoint and display task-by-task progress as the execution runs, without requiring page refresh.

#### Scenario: Showing execution start
- **WHEN** activity execution begins
- **THEN** system displays "Starting..." status and initializes progress bar at 0%

#### Scenario: Updating on task completion
- **WHEN** backend emits `task.completed` WebSocket event
- **THEN** system increments progress bar by (1 / total_tasks) × 100% and updates current task display

#### Scenario: Showing final completion
- **WHEN** backend emits `activity.completed` WebSocket event
- **THEN** system sets progress to 100%, displays final status (success/failure), and shows metrics summary

### Requirement: Monitor displays current task being executed

The system SHALL show which task is currently executing with a visual indicator and description.

#### Scenario: Highlighting current task
- **WHEN** backend emits `task.started` for Task 3 of 5
- **THEN** system highlights Task 3 in the task list and shows "Currently executing: Task 3 - Analyzing code"

#### Scenario: Showing task queue
- **WHEN** execution is in progress
- **THEN** system displays pending tasks in gray, current task in blue with spinner, completed tasks in green/red

### Requirement: User can view live log stream

The system SHALL display tool call outputs and intermediate results as they arrive via WebSocket, creating a live log view.

#### Scenario: Streaming tool call output
- **WHEN** backend emits `tool.call` event with bash output
- **THEN** system appends the output to the log view with timestamp

#### Scenario: Auto-scrolling logs
- **WHEN** new log entries arrive
- **THEN** system auto-scrolls to bottom unless user has manually scrolled up

#### Scenario: Filtering log levels
- **WHEN** user selects "Errors only" filter
- **THEN** system hides info/debug logs and shows only error events

### Requirement: Monitor handles connection interruptions gracefully

The system SHALL detect WebSocket disconnections and attempt reconnection with exponential backoff.

#### Scenario: Automatic reconnection
- **WHEN** WebSocket connection drops during execution
- **THEN** system displays "Reconnecting..." message and attempts to reconnect every 1s, 2s, 4s, 8s

#### Scenario: Catching up after reconnection
- **WHEN** WebSocket reconnects after temporary disconnection
- **THEN** system requests missed events by sequence number and updates UI to current state

### Requirement: Monitor shows resource consumption metrics

The system SHALL display live cost and duration accumulation as the execution progresses.

#### Scenario: Live cost counter
- **WHEN** execution is running
- **THEN** system displays running total of cost that updates after each task completes

#### Scenario: Duration timer
- **WHEN** execution starts
- **THEN** system displays elapsed time in MM:SS format that updates every second
