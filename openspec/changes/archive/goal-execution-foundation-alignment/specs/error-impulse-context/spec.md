## ADDED Requirements

### Requirement: Error context as impulse

The system SHALL create impulses for retry error context instead of concatenating error strings into the prompt. Error impulses SHALL have shape `previous_attempt_error`.

#### Scenario: Create error impulse on retry
- **WHEN** a task fails and retry is attempted
- **THEN** the system SHALL create an impulse with:
  - `id`: `error:{taskId}:{activityId}:{timestamp}`
  - `pointer.type`: `memo`
  - `pointer.content`: the error message
  - `metadata.shape`: `previous_attempt_error`
  - `metadata.attemptNumber`: the current retry attempt number
  - `priority`: `high`
  - `budget`: `min(errorLength / 4, 2000)`

#### Scenario: Add error impulse to task impulses
- **WHEN** an error impulse is created for a retry attempt
- **THEN** the system SHALL add the error impulse ID to the task's impulse list
- **AND** the error impulse SHALL be subject to relevance filtering like any other impulse

#### Scenario: Remove string concatenation
- **WHEN** a task is retried after failure
- **THEN** the system SHALL NOT concatenate error strings directly into the prompt
- **AND** error context SHALL only be provided via the error impulse

### Requirement: Error impulse relevance tracking

The system SHALL track error impulse relevance to learn which error contexts help recovery.

#### Scenario: Record error impulse relevance on success
- **WHEN** a retry attempt succeeds after loading an error impulse
- **THEN** the system SHALL record impulse relevance with `executionSucceeded: true`
- **AND** the error impulse ID SHALL be included in `loadedImpulseIds`

#### Scenario: Record error impulse relevance on failure
- **WHEN** a retry attempt fails after loading an error impulse
- **THEN** the system SHALL record impulse relevance with `executionSucceeded: false`

#### Scenario: Learn error context effectiveness
- **WHEN** sufficient error impulse relevance data is collected
- **THEN** the system SHALL be able to compute `P(recovery | error_context_loaded)`
- **AND** future retries MAY skip error context if `P(recovery | not_loaded) >= P(recovery | loaded)`

### Requirement: Error impulse metadata

Error impulses SHALL include metadata sufficient for failure analysis and pattern matching.

#### Scenario: Include failure categorization
- **WHEN** an error impulse is created
- **THEN** the metadata SHALL include:
  - `failureType`: `validation | execution | tool_failure | timeout`
  - `validationError`: specific validation rule that failed (if applicable)
  - `toolCallFailed`: name of tool that failed (if applicable)

#### Scenario: Include preceding context
- **WHEN** an error impulse is created for attempt N > 1
- **THEN** the metadata MAY include `precedingAttempts` with summary of previous errors
