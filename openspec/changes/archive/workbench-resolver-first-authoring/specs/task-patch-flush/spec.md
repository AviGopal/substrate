## ADDED Requirements

### Requirement: Task-level mutations are flushed to the API via PATCH
When any task field is changed in `ActivityCard` (resolver, config, prompt, description), the system SHALL include the full `tasks` array in the next PATCH request to `/v2/activities/templates/{templateId}`. The PATCH SHALL fire on the existing 500ms debounce already used by `handleTaskChange`. The PATCH body SHALL merge `tasks` with any other fields being patched (e.g., `output_shapes`).

#### Scenario: PATCH includes tasks after resolver change
- **WHEN** the resolver on a task is changed from `llm` to `bash`
- **THEN** within 500ms a PATCH is sent to `/v2/activities/templates/{id}` with `{ tasks: [...updatedTasks] }`

#### Scenario: PATCH includes tasks after prompt change
- **WHEN** the prompt template on an llm task is edited
- **THEN** within 500ms a PATCH is sent containing the updated tasks array

#### Scenario: PATCH includes tasks after config change
- **WHEN** a bash task's command field is updated in `ConfigEditor`
- **THEN** within 500ms a PATCH is sent containing the updated tasks array with the new config

#### Scenario: PATCH failure is non-fatal and logged
- **WHEN** the PATCH request fails with a network error
- **THEN** the error is logged with `console.warn` and the local state is unchanged (no rollback, no toast)

### Requirement: ActivityCard shows a dirty indicator while task changes are pending flush
While any task mutation has been made but not yet flushed to the API, the `ActivityCard` footer SHALL display the existing "saving…" indicator (yellow pulse dot). The indicator SHALL disappear after the PATCH request completes (success or failure).

#### Scenario: Dirty indicator appears on task mutation
- **WHEN** a task resolver or config is changed
- **THEN** the footer shows the yellow pulse dot with "saving…" text

#### Scenario: Dirty indicator disappears after flush
- **WHEN** the PATCH request completes (success or error)
- **THEN** the footer no longer shows the "saving…" indicator

### Requirement: PATCH for output_shapes and tasks may be merged into a single request
When `output_shapes` and task changes are both pending at flush time, the system SHOULD send a single PATCH with both `{ output_shapes, tasks }` rather than two separate requests. Separate requests are acceptable but not preferred.

#### Scenario: Single PATCH when both shapes and tasks changed
- **WHEN** output_shapes and a task resolver are both changed within the same 500ms debounce window
- **THEN** a single PATCH is sent containing both `output_shapes` and `tasks`
