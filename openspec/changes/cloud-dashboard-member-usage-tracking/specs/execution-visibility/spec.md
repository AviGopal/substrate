## ADDED Requirements

### Requirement: Display execution trace list
The system SHALL display a paginated list of activity execution traces with key metadata.

#### Scenario: View recent executions
- **WHEN** user navigates to Executions page
- **THEN** system displays most recent 50 executions ordered by start time descending

#### Scenario: Execution list shows metadata
- **WHEN** user views execution list
- **THEN** each row displays: template_name, status (running/completed/failed), start_time, duration, member_name, cost

#### Scenario: Pagination through executions
- **WHEN** user clicks "Load More" at bottom of list
- **THEN** system fetches next 50 executions and appends to list

### Requirement: Filter executions
The system SHALL allow filtering execution traces by status, category, member, and date range.

#### Scenario: Filter by status
- **WHEN** user selects "Failed" from status dropdown
- **THEN** system displays only executions with status=failed

#### Scenario: Filter by multiple criteria
- **WHEN** user selects status=completed AND category=bugfix AND member=john@example.com
- **THEN** system displays executions matching all criteria

#### Scenario: Clear all filters
- **WHEN** user clicks "Clear Filters" button
- **THEN** system resets to default view showing all recent executions

### Requirement: View execution details
The system SHALL display detailed information for a selected execution trace.

#### Scenario: Expand execution trace
- **WHEN** user clicks on execution row
- **THEN** system expands row to show: goal_description, template_id, task_results, input_state, output_state, error_message (if failed)

#### Scenario: View task-level results
- **WHEN** user views expanded execution
- **THEN** system displays each task with: task_id, description, status, tool_calls, duration, tokens_used

#### Scenario: View tool call details
- **WHEN** user expands task result
- **THEN** system displays tool calls with: tool_name, arguments (formatted), output, success/failure

### Requirement: Show goal-seeking behavior
The system SHALL display the goal and Thompson Sampling decision that led to activity selection.

#### Scenario: Display goal description
- **WHEN** user views execution details
- **THEN** system shows goal_description field explaining what the execution was trying to achieve

#### Scenario: Display Thompson Sampling selection
- **WHEN** execution was selected via Thompson Sampling
- **THEN** system shows: templates_considered, selection_probability, expected_reward, exploration_factor

#### Scenario: Display goal path
- **WHEN** execution is part of multi-step goal path
- **THEN** system shows: current_step, total_steps, previous_executions, next_planned_activity

### Requirement: Show success and failure patterns
The system SHALL highlight patterns in successful and failed executions.

#### Scenario: Display success rate by template
- **WHEN** user views Executions page
- **THEN** system shows summary card with success rate for each template (e.g., "fix-bug-template: 85% success, 20 executions")

#### Scenario: Group failures by error type
- **WHEN** user filters to status=failed
- **THEN** system groups failures by error_message pattern and shows count

#### Scenario: Identify improving templates
- **WHEN** template has improving trend (success rate increasing over time)
- **THEN** system displays green up arrow indicator next to template name

### Requirement: Search executions
The system SHALL allow full-text search across execution traces.

#### Scenario: Search by goal description
- **WHEN** user enters "fix authentication bug" in search box
- **THEN** system displays executions with matching goal_description

#### Scenario: Search by template name
- **WHEN** user enters template name in search
- **THEN** system displays all executions using that template

#### Scenario: Search by error message
- **WHEN** user searches for error text like "ENOENT"
- **THEN** system displays failed executions with matching error messages

### Requirement: Link to activity dashboard
The system SHALL provide links to the internal activity dashboard for deeper analysis.

#### Scenario: Link to template performance
- **WHEN** user clicks template name in execution list
- **THEN** system opens activity dashboard filtered to that template's performance metrics

#### Scenario: Link to composition graph
- **WHEN** user clicks "View Composition Graph" for execution
- **THEN** system opens activity dashboard composition graph showing template relationships
