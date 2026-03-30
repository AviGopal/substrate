## ADDED Requirements

### Requirement: View seat allocation summary
The system SHALL display current seat usage and available seats based on subscription tier.

#### Scenario: Admin views seat summary
- **WHEN** admin calls GET /v1/organizations/:id/seats
- **THEN** system returns seat_limit, seat_usage, allocations list, upgrade_available flag

#### Scenario: Free tier at capacity
- **WHEN** free tier org (seat_limit = 1) has seat_usage = 1
- **THEN** GET /v1/organizations/:id/seats returns can_add_members = false

### Requirement: Allocate seat to API key
The system SHALL allow admins to allocate connection slots from organization quota to specific API keys.

#### Scenario: Admin allocates slots to API key
- **WHEN** admin calls POST /v1/organizations/:id/seats/allocate with api_key_id and slot_count
- **THEN** system creates seat_allocation record, updates API key max_connections

#### Scenario: Allocation exceeds available seats
- **WHEN** admin attempts allocation but total allocated slots > org seat_limit
- **THEN** system returns 409 Conflict with message "Insufficient seat quota"

#### Scenario: Reallocation from one key to another
- **WHEN** admin deallocates slots from key A and allocates to key B
- **THEN** system maintains total allocated slots <= seat_limit

### Requirement: Deallocate seat from API key
The system SHALL allow admins to reclaim connection slots from API keys.

#### Scenario: Admin deallocates slots
- **WHEN** admin calls DELETE /v1/organizations/:id/seats/:apiKeyId
- **THEN** system removes seat_allocation record, resets API key max_connections to tier default

#### Scenario: Deallocation with active connections
- **WHEN** admin deallocates slots from key with current_connections > new max_connections
- **THEN** system warns but allows deallocation, active connections remain until they disconnect

### Requirement: Enforce connection limits per API key
The system SHALL prevent new connections when API key reaches max_connections.

#### Scenario: Connection within limit
- **WHEN** MiniBob connects with API key and current_connections < max_connections
- **THEN** system allows connection and increments current_connections

#### Scenario: Connection at limit
- **WHEN** MiniBob attempts connection with API key at max_connections
- **THEN** system returns 429 Too Many Requests with message "Connection limit reached"

### Requirement: Track active connections per API key
The system SHALL maintain real-time count of active connections for each API key.

#### Scenario: Connection established
- **WHEN** MiniBob authenticates and opens connection
- **THEN** system creates connection record in activity-api and increments current_connections

#### Scenario: Connection closed
- **WHEN** MiniBob disconnects gracefully
- **THEN** system removes connection record and decrements current_connections

#### Scenario: Connection timeout cleanup
- **WHEN** connection heartbeat stops for > 30 seconds
- **THEN** system marks connection as stale and decrements current_connections

### Requirement: Seat allocation audit trail
The system SHALL record all seat allocation changes with admin who made the change.

#### Scenario: Allocation recorded
- **WHEN** admin allocates seats to API key
- **THEN** system records allocated_by = $auth.user_id and allocated_at timestamp

#### Scenario: Audit log queryable
- **WHEN** admin calls GET /v1/organizations/:id/seats/history
- **THEN** system returns chronological list of allocation changes with admin attribution
