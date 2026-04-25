## ADDED Requirements

### Requirement: System displays execution timeline as Gantt chart

The system SHALL visualize execution traces as a horizontal timeline showing task durations as bars color-coded by status.

#### Scenario: Rendering task timeline
- **WHEN** user views an execution with 5 completed tasks
- **THEN** system displays 5 horizontal bars positioned according to start time and width according to duration

#### Scenario: Color-coding by status
- **WHEN** execution contains successful, failed, and in-progress tasks
- **THEN** system colors successful tasks green, failed tasks red, and in-progress tasks blue with animation

#### Scenario: Showing time ruler
- **WHEN** timeline displays
- **THEN** system shows a time ruler with tick marks at regular intervals labeled with timestamps

### Requirement: User can view nested tool calls in timeline

The system SHALL display tool calls as nested bars within their parent task bars, showing the granular execution flow.

#### Scenario: Expanding task to show tool calls
- **WHEN** user clicks a task bar in the timeline
- **THEN** system expands the bar vertically to show individual tool calls as sub-bars with duration

#### Scenario: Hiding tool call details
- **WHEN** user clicks an expanded task bar
- **THEN** system collapses the bar to show only the task summary

### Requirement: Timeline shows impulse resolutions

The system SHALL indicate impulse resolution periods on the timeline with distinct visual markers showing resolver tier.

#### Scenario: Showing deterministic resolutions
- **WHEN** task resolves impulses using deterministic resolvers
- **THEN** system displays green markers on the timeline labeled with latency

#### Scenario: Showing LLM resolutions
- **WHEN** task resolves impulses using LLM resolvers
- **THEN** system displays blue markers on the timeline labeled with latency and cost

### Requirement: User can interact with timeline elements

The system SHALL allow users to hover and click timeline elements to view detailed information in a tooltip or side panel.

#### Scenario: Hovering over task bar
- **WHEN** user hovers over a task bar
- **THEN** system displays tooltip showing task description, duration, cost, and status

#### Scenario: Clicking task for details
- **WHEN** user clicks a task bar
- **THEN** system opens a detail panel showing full task execution with tool calls and validation results

### Requirement: Timeline scales to execution duration

The system SHALL automatically scale the timeline to fit the total execution duration, with minimum and maximum zoom levels.

#### Scenario: Short execution (< 10 seconds)
- **WHEN** execution duration is 5 seconds
- **THEN** system scales timeline to show millisecond precision

#### Scenario: Long execution (> 5 minutes)
- **WHEN** execution duration is 10 minutes
- **THEN** system scales timeline to show second precision and enables horizontal scrolling
