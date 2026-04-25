# trace-history-view Specification

## Purpose
TBD - created by archiving change trajectory-execution-integration. Update Purpose after archive.
## Requirements
### Requirement: Execution history panel lists recent traces
The trajectory editor SHALL display a collapsible "Execution History" panel in the left sidebar showing the N most recent execution traces fetched from activity-api (via `executionTraceList` impulse or `GET /v2/activities/execution-traces`). Each entry SHALL show: activity name, success/failure indicator, duration, cost, and timestamp.

#### Scenario: Panel loads recent traces on open
- **WHEN** the user opens the Execution History panel
- **THEN** the panel fetches and displays up to 20 recent execution traces ordered by most recent first

#### Scenario: Empty state when no traces exist
- **WHEN** no execution traces are available from the backend
- **THEN** the panel shows "No executions yet" with a prompt to run a goal

### Requirement: Load trace onto trajectory grid
The system SHALL allow the user to select a trace from the history panel and load it onto the trajectory grid. Activities from the trace SHALL be mapped to columns in execution order (column 0 = first executed activity). If an activity in the trace matches a template already in the grid by `activity_id`, the existing card SHALL be highlighted as matched; otherwise a new column SHALL be appended.

#### Scenario: Load trace onto empty grid
- **WHEN** the user selects a trace on an empty trajectory grid
- **THEN** columns are populated in execution order with one card per executed activity

#### Scenario: Load trace onto existing trajectory — matched activities
- **WHEN** the user selects a trace whose activities match the current trajectory
- **THEN** matched cards are highlighted and unmatched trace activities appear as ghost columns

#### Scenario: Confirm before replacing existing trajectory
- **WHEN** the user selects a trace and the trajectory grid already has activities
- **THEN** a modal offers "Replace" or "Append" before proceeding

### Requirement: Per-task result overlay on activity cards
Each activity card in the trajectory SHALL show a result overlay when a trace is loaded. The overlay SHALL include: task-level success/failure badge, duration (ms), cost (USD), and resolver-tier badge (deterministic / pattern / llm) derived from the trace's `tasks[].resolver_tier` field.

#### Scenario: Successful task overlay
- **WHEN** a trace is loaded and a task succeeded
- **THEN** the card shows a green success badge, duration, cost, and resolver-tier badge

#### Scenario: Failed task overlay
- **WHEN** a trace is loaded and a task failed
- **THEN** the card shows a red failure badge with the error message truncated to 80 chars

#### Scenario: Ghost column for unmatched trace activity
- **WHEN** a trace activity has no matching template in the current trajectory
- **THEN** it appears as a read-only ghost column with a "from trace" badge and greyed styling

