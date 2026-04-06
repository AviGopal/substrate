## ADDED Requirements

### Requirement: Record tool argument patterns on failure

The system SHALL record tool argument patterns when tasks fail, not only when they succeed. This enables learning from what doesn't work.

#### Scenario: Record patterns on validation failure
- **WHEN** a task completes but validation fails
- **THEN** the system SHALL call `recordToolArgumentPattern` for each tool call with:
  - `executionSucceeded: false`
  - `failureType: 'validation'`
  - `failureReason`: the validation error message

#### Scenario: Record patterns on execution failure
- **WHEN** a task fails due to LLM or tool execution error
- **THEN** the system SHALL call `recordToolArgumentPattern` for each tool call with:
  - `executionSucceeded: false`
  - `failureType: 'execution'`
  - `failureReason`: the exception message

#### Scenario: Record patterns on timeout
- **WHEN** a task fails due to timeout
- **THEN** the system SHALL call `recordToolArgumentPattern` for each completed tool call with:
  - `executionSucceeded: false`
  - `failureType: 'timeout'`
  - `failureReason`: `'Task exceeded timeout'`

#### Scenario: Track individual tool success within failed task
- **WHEN** a task fails but some tool calls succeeded
- **THEN** the pattern record SHALL include `toolSucceeded: true` for successful tool calls
- **AND** `toolSucceeded: false` for the failed tool call

### Requirement: Failure type discrimination in MCP client

The MCP client SHALL support failure type metadata in `recordToolArgumentPattern` requests.

#### Scenario: Extended pattern record fields
- **WHEN** recording a tool argument pattern
- **THEN** the MCP client SHALL accept:
  - `failureType?: 'validation' | 'execution' | 'tool_failure' | 'timeout'`
  - `failureReason?: string`
  - `toolSucceeded?: boolean`
  - `validationError?: string` (specific validation rule)

#### Scenario: Backward compatible API
- **WHEN** recording a successful pattern
- **THEN** the system SHALL continue to work with existing fields only
- **AND** failure-specific fields SHALL be optional

### Requirement: Failure pattern storage in backend

The backend SHALL store failure pattern data for learning queries.

#### Scenario: Store failure type in database
- **WHEN** the backend receives a pattern record with `executionSucceeded: false`
- **THEN** the backend SHALL store `failure_type` and `failure_reason` columns

#### Scenario: Aggregate failure statistics
- **WHEN** querying tool argument recommendations
- **THEN** the backend SHALL compute separate success and failure counts
- **AND** recommendations SHALL prefer patterns with high success rate AND low failure rate

#### Scenario: Filter queries by failure type
- **WHEN** analyzing failure patterns
- **THEN** the backend SHALL support filtering by `failure_type`
- **AND** SHALL support queries like "patterns that fail validation but not execution"
