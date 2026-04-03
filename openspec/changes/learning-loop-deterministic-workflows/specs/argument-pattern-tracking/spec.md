## ADDED Requirements

### Requirement: Store tool argument patterns in backend
The system SHALL store tool argument patterns in a `tool_argument_pattern` table with success metrics for learning.

#### Scenario: Record new pattern on first occurrence
- **WHEN** a tool argument pattern is recorded for the first time
- **THEN** system creates record with `times_used: 1`, `times_succeeded: 0 or 1` based on execution outcome

#### Scenario: Update existing pattern on repeated occurrence
- **WHEN** a tool argument pattern with matching `argument_hash` already exists
- **THEN** system increments `times_used` and conditionally increments `times_succeeded`

#### Scenario: Track execution duration
- **WHEN** recording a pattern occurrence
- **THEN** system updates `avg_execution_ms` as rolling average

### Requirement: Pattern schema with RBAC isolation
The `tool_argument_pattern` table SHALL include org_id for multi-tenant isolation and follow existing RBAC patterns.

#### Scenario: Patterns isolated by organization
- **WHEN** querying patterns for activity recommendations
- **THEN** only patterns from the authenticated user's org_id are returned

#### Scenario: Pattern record includes required fields
- **WHEN** creating a pattern record
- **THEN** record includes: activity_id, tool_name, argument_shape, argument_hash, arguments (object), times_used, times_succeeded, avg_execution_ms, last_used_at, org_id

### Requirement: Record patterns via MCP client
MiniBob SHALL record tool argument patterns to backend via MCP client after successful task execution.

#### Scenario: Pattern recorded after successful tool call
- **WHEN** LLM task completes successfully with tool calls
- **THEN** system calls `mcp.recordToolArgumentPattern()` for each tool call

#### Scenario: Pattern includes execution context
- **WHEN** recording a pattern
- **THEN** payload includes activity_id, tool_name, argument_shape, argument_hash, arguments, execution_succeeded, execution_ms

#### Scenario: Backend unavailable gracefully handled
- **WHEN** backend is unavailable during pattern recording
- **THEN** pattern is cached locally for later sync (existing trace-cache pattern)

### Requirement: Query argument pattern recommendations
The system SHALL provide an API to query high-confidence argument patterns for pre-loading.

#### Scenario: GET recommendations returns proven patterns
- **WHEN** client calls `GET /v2/activities/tool-argument-recommendations?activity_id=X`
- **THEN** response includes patterns with success_rate >= 0.8 and times_used >= 3

#### Scenario: Recommendations ordered by success rate
- **WHEN** multiple patterns match criteria
- **THEN** results are ordered by success_rate DESC, times_used DESC

#### Scenario: Recommendations include argument data
- **WHEN** recommendations are returned
- **THEN** each includes: argument_shape, argument_hash, arguments, success_rate, times_used

### Requirement: Recommendation view in database
The system SHALL define a computed view `v_argument_recommendations` for efficient pattern queries.

#### Scenario: View filters by success threshold
- **WHEN** querying the view
- **THEN** only patterns with (times_succeeded / times_used) >= 0.8 are included

#### Scenario: View filters by minimum usage
- **WHEN** querying the view
- **THEN** only patterns with times_used >= 3 are included
