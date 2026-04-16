## ADDED Requirements

### Requirement: Execution traces list page
The system SHALL provide a page listing all execution traces for the organization.

#### Scenario: View recent executions
- **WHEN** user navigates to Activity Traces page
- **THEN** system displays list of execution traces sorted by start time descending (newest first)
- **THEN** system fetches from GET /v2/activities/execution-traces with org_id filter
- **THEN** system shows 50 traces per page with pagination

#### Scenario: Empty trace list
- **WHEN** organization has no execution traces yet
- **THEN** system shows "No executions yet" message
- **THEN** system displays helpful prompt to run MiniBob

### Requirement: Execution trace list item display
The system SHALL display key information for each trace in the list.

#### Scenario: Successful execution display
- **WHEN** viewing trace with status="completed" and result.success=true
- **THEN** system shows green checkmark icon
- **THEN** system displays goal description (truncated to 80 chars)
- **THEN** system shows activity/template name used
- **THEN** system shows duration in seconds and cost in USD
- **THEN** system shows timestamp as relative time ("2 hours ago")

#### Scenario: Failed execution display
- **WHEN** viewing trace with status="failed" or result.success=false
- **THEN** system shows red X icon
- **THEN** system displays goal description
- **THEN** system shows error message preview (first 100 chars)
- **THEN** system highlights trace row with red border or background

#### Scenario: Running execution display
- **WHEN** viewing trace with status="running"
- **THEN** system shows animated spinner icon
- **THEN** system displays goal description
- **THEN** system shows elapsed time since start
- **THEN** system highlights trace row to indicate in-progress

### Requirement: Filter executions by status
The system SHALL allow filtering traces by execution status.

#### Scenario: Filter by status
- **WHEN** user selects "Failed" from status filter dropdown
- **THEN** system requests GET /v2/activities/execution-traces?status=failed
- **THEN** system displays only failed executions
- **THEN** system updates count to show "Showing 12 failed executions"

#### Scenario: Clear filter
- **WHEN** user clicks "Clear Filters" button
- **THEN** system resets all filters
- **THEN** system displays all executions

### Requirement: Filter executions by member
The system SHALL allow filtering traces by which member triggered them.

#### Scenario: Filter by member
- **WHEN** user selects member from "Triggered By" dropdown
- **THEN** system filters traces where user_id matches selected member
- **THEN** system displays only executions triggered by that member

#### Scenario: Member dropdown populated
- **WHEN** user opens "Triggered By" dropdown
- **THEN** system shows list of all organization members
- **THEN** system shows execution count next to each member name

### Requirement: Filter executions by API key
The system SHALL allow filtering traces by which API key was used.

#### Scenario: Filter by API key
- **WHEN** user selects API key from filter dropdown
- **THEN** system filters traces where api_key_id matches selected key
- **THEN** system displays only executions using that key
- **THEN** system shows key prefix (mb_live_••••) in filter

### Requirement: Filter executions by date range
The system SHALL allow filtering traces by date range.

#### Scenario: Filter by preset range
- **WHEN** user selects "Last 7 days" from date filter
- **THEN** system filters traces where start_time >= 7 days ago
- **THEN** system updates list to show only matching traces

#### Scenario: Filter by custom range
- **WHEN** user selects "Custom" and enters start/end dates
- **THEN** system filters traces within specified date range
- **THEN** system validates end date is after start date

### Requirement: View execution trace detail
The system SHALL provide a detailed view of individual execution traces.

#### Scenario: Click trace to view details
- **WHEN** user clicks on a trace in the list
- **THEN** system expands trace row or navigates to detail page
- **THEN** system displays full execution details

### Requirement: Execution detail displays goal and context
The system SHALL show the goal description and input context for each execution.

#### Scenario: View goal description
- **WHEN** viewing execution detail
- **THEN** system displays full goal description (untruncated)
- **THEN** system shows activity template name and category
- **THEN** system shows which member triggered the execution

#### Scenario: View input impulses
- **WHEN** execution used input impulses for context
- **THEN** system displays list of impulse pointers (type, path/identifier)
- **THEN** system shows which impulses were loaded vs skipped

### Requirement: Execution detail displays task progression
The system SHALL show step-by-step task execution with results.

#### Scenario: View task list
- **WHEN** viewing execution detail
- **THEN** system displays all tasks from activity template in order
- **THEN** system shows task description and status (pending/running/completed/failed)
- **THEN** system shows which task is currently executing (if running)

#### Scenario: View task results
- **WHEN** task has completed
- **THEN** system shows task result (success/failure)
- **THEN** system displays tool calls made during task
- **THEN** system shows output from each tool call

#### Scenario: Failed task detail
- **WHEN** task failed with error
- **THEN** system displays error message
- **THEN** system shows which tool call failed
- **THEN** system highlights failed task in red

### Requirement: Execution detail displays tool calls
The system SHALL show all tool invocations made during execution.

#### Scenario: View tool call list
- **WHEN** viewing execution detail
- **THEN** system displays list of all tool calls in chronological order
- **THEN** system shows tool name (bash, read, write, edit, llm_generate)
- **THEN** system shows tool parameters and return values

#### Scenario: View tool call output
- **WHEN** user expands tool call
- **THEN** system shows full input parameters (formatted JSON)
- **THEN** system shows full output/result (formatted)
- **THEN** system shows execution time for that tool call

### Requirement: Execution detail displays state changes
The system SHALL show before/after state of the codebase.

#### Scenario: View files modified
- **WHEN** viewing execution detail
- **THEN** system displays list of files created, modified, or deleted
- **THEN** system shows file paths and change type (create/update/delete)

#### Scenario: View state transition summary
- **WHEN** execution modified codebase
- **THEN** system shows count of files created/modified/deleted
- **THEN** system shows working directory path
- **THEN** system displays file hashes before/after (if available)

### Requirement: Execution detail displays cost and duration
The system SHALL show execution metrics and resource usage.

#### Scenario: View execution metrics
- **WHEN** viewing execution detail
- **THEN** system displays total duration in seconds
- **THEN** system displays total cost in USD (from LLM API usage)
- **THEN** system displays token usage (input tokens, output tokens, total)

#### Scenario: View LLM model used
- **WHEN** execution used LLM for generation
- **THEN** system shows which model was used (claude-sonnet-4, opus-4.5, etc.)
- **THEN** system shows per-model token counts if multiple models used

### Requirement: Search executions by goal text
The system SHALL allow searching traces by goal description content.

#### Scenario: Search by keyword
- **WHEN** user types "fix authentication bug" in search box
- **THEN** system filters traces where goal description contains search terms
- **THEN** system highlights matching keywords in results

#### Scenario: No search results
- **WHEN** search query matches no traces
- **THEN** system shows "No executions found matching 'query'" message
- **THEN** system offers to clear search
