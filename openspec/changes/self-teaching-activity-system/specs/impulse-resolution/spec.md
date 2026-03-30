## ADDED Requirements

### Requirement: Resolve instrumentation-point impulses
The system SHALL resolve impulses referencing code instrumentation points.

#### Scenario: Load instrumentation point metadata
- **WHEN** impulse type is "instrumentation-point" with module and function reference
- **THEN** resolver returns metadata including source location, capture strategy, trace point ID

#### Scenario: Validate instrumentation target exists
- **WHEN** resolving instrumentation-point impulse
- **THEN** resolver verifies target module and function exist, returns error if missing

#### Scenario: Resolve instrumentation point in dependency
- **WHEN** instrumentation-point references third-party module
- **THEN** resolver locates module in node_modules and returns resolution metadata

### Requirement: Resolve trace-snapshot impulses
The system SHALL resolve impulses referencing captured execution trace data.

#### Scenario: Load trace snapshot by ID
- **WHEN** impulse type is "trace-snapshot" with trace point ID and execution ID
- **THEN** resolver queries backend for captured state at that trace point

#### Scenario: Load trace snapshot with filters
- **WHEN** trace-snapshot impulse specifies state filters (specific variables)
- **THEN** resolver returns only requested subset of captured state

#### Scenario: Handle missing trace data
- **WHEN** trace-snapshot references non-existent execution or trace point
- **THEN** resolver returns error with diagnostic information

### Requirement: Resolve execution-expectation impulses
The system SHALL resolve impulses containing expectation definitions for validation.

#### Scenario: Load expectation definition
- **WHEN** impulse type is "execution-expectation" with expectation ID
- **THEN** resolver returns expectation with trace point ID, expected state, validation strategy

#### Scenario: Load expectations for activity
- **WHEN** querying expectations by activity ID
- **THEN** resolver returns all expectation impulses associated with activity

#### Scenario: Validate expectation references
- **WHEN** resolving execution-expectation impulse
- **THEN** resolver verifies referenced trace point exists in activity's instrumentation spec

### Requirement: Resolve validation-result impulses
The system SHALL resolve impulses containing validation outcomes.

#### Scenario: Load validation result by ID
- **WHEN** impulse type is "validation-result" with result ID
- **THEN** resolver returns outcome, confidence, expected vs actual comparison

#### Scenario: Load validation results for execution
- **WHEN** querying validation results by execution ID
- **THEN** resolver returns all validation outcomes for that execution's trace

#### Scenario: Query validation patterns
- **WHEN** requesting validation results with filters (success/failure, expectation ID)
- **THEN** resolver returns matching results with aggregated metrics

### Requirement: New impulse types stored in backend
All new impulse types SHALL be stored and managed by metabob-activity-api.

#### Scenario: Store instrumentation-point impulse
- **WHEN** activity creates instrumentation-point impulse
- **THEN** backend persists with activity association and indexes for lookup

#### Scenario: Store trace-snapshot impulse
- **WHEN** execution captures trace, backend stores trace-snapshot impulses
- **THEN** each snapshot linked to execution ID, trace point ID, timestamp

#### Scenario: Store execution-expectation impulse
- **WHEN** activity defines expectations
- **THEN** backend persists with versioning and tracks expectation evolution

#### Scenario: Store validation-result impulse
- **WHEN** validation completes
- **THEN** backend persists results and updates aggregated metrics

### Requirement: Impulse resolution is backward compatible
Existing impulse types SHALL continue to resolve through existing mechanisms.

#### Scenario: Local impulses still resolve in MiniBob
- **WHEN** impulse type is "memo" or "file"
- **THEN** MiniBob resolves without backend call

#### Scenario: Backend impulses delegate to activity-api
- **WHEN** impulse type requires backend (activity traces, metrics)
- **THEN** MiniBob delegates to backend MCP server as before

#### Scenario: Unknown impulse types handled gracefully
- **WHEN** MiniBob encounters unknown impulse type
- **THEN** system attempts backend resolution first, returns clear error if unsupported
