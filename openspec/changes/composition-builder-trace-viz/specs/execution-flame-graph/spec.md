## ADDED Requirements

### Requirement: System displays cost breakdown as flame graph

The system SHALL visualize execution cost and duration as a hierarchical flame graph where width represents value and depth represents nesting.

#### Scenario: Rendering activity-level flame graph
- **WHEN** user selects "Cost" metric for execution with 3 tasks
- **THEN** system displays root bar spanning full width with 3 child bars sized proportionally to their cost

#### Scenario: Drilling down to tool calls
- **WHEN** user clicks a task bar in the flame graph
- **THEN** system expands the bar to show individual tool calls as nested bars

#### Scenario: Switching to duration metric
- **WHEN** user selects "Duration" metric
- **THEN** system re-renders flame graph with bar widths representing duration instead of cost

### Requirement: Flame graph highlights expensive operations

The system SHALL use color intensity to highlight operations consuming disproportionate resources relative to their siblings.

#### Scenario: Highlighting high-cost LLM calls
- **WHEN** one tool call costs $0.50 while siblings cost $0.01
- **THEN** system displays that bar in darker/more saturated color

#### Scenario: Showing resolver tier distribution
- **WHEN** flame graph displays
- **THEN** system uses distinct colors for deterministic (green), pattern (yellow), and LLM (blue) resolvers

### Requirement: User can export flame graph

The system SHALL allow users to export the flame graph as PNG or SVG for inclusion in reports.

#### Scenario: Export as PNG
- **WHEN** user clicks "Export" and selects PNG format
- **THEN** system downloads a PNG image of the current flame graph view

#### Scenario: Export as SVG
- **WHEN** user clicks "Export" and selects SVG format
- **THEN** system downloads an SVG file preserving all interactive hover states

### Requirement: Flame graph shows temporal information

The system SHALL display timestamps showing when resources were consumed, not just total consumption.

#### Scenario: Showing execution timeline
- **WHEN** user hovers over a flame graph bar
- **THEN** system displays tooltip with start time, end time, and duration

#### Scenario: Flame chart mode
- **WHEN** user enables "Time-aware" mode
- **THEN** system displays horizontal time ruler and positions bars according to when they executed
