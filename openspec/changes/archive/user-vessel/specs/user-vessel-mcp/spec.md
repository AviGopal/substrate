## ADDED Requirements

### Requirement: MCP tool for user context retrieval
The system SHALL expose MCP tool for vessels to query authenticated user context.

#### Scenario: MiniBob queries user context
- **WHEN** MiniBob calls MCP tool user_get_context with JWT token
- **THEN** system returns { user_id, org_id, role, org_name, seat_limit, seat_usage }

#### Scenario: Invalid token in context query
- **WHEN** vessel calls user_get_context with invalid JWT
- **THEN** system returns error "Invalid authentication token"

### Requirement: MCP tool for quota checking
The system SHALL expose MCP tool for vessels to check if connection is allowed before establishing.

#### Scenario: Quota check with available slots
- **WHEN** MiniBob calls user_check_quota with api_key_id
- **THEN** system returns { allowed: true, current_connections, max_connections, remaining }

#### Scenario: Quota check at limit
- **WHEN** MiniBob calls user_check_quota for API key at max_connections
- **THEN** system returns { allowed: false, reason: "Connection limit reached" }

#### Scenario: Quota check for revoked key
- **WHEN** vessel calls user_check_quota for revoked API key
- **THEN** system returns { allowed: false, reason: "API key revoked" }

### Requirement: MCP tool for connection recording
The system SHALL expose MCP tool for vessels to record active connections with heartbeat.

#### Scenario: Connection recorded
- **WHEN** MiniBob calls user_record_connection with { api_key_id, connection_id, metadata }
- **THEN** system creates connection record in activity-api and increments current_connections

#### Scenario: Heartbeat updated
- **WHEN** MiniBob calls user_update_heartbeat with connection_id
- **THEN** system updates last_heartbeat timestamp to prevent timeout cleanup

#### Scenario: Connection closed
- **WHEN** MiniBob calls user_close_connection with connection_id
- **THEN** system removes connection record and decrements current_connections

### Requirement: MCP tool for member list retrieval
The system SHALL expose MCP tool for vessels to query organization members.

#### Scenario: Vessel queries member list
- **WHEN** vessel calls user_get_members with org_id
- **THEN** system returns array of members with { user_id, email, role, status }

#### Scenario: Unauthorized org access
- **WHEN** vessel calls user_get_members for org_id not matching authenticated context
- **THEN** system returns empty array (RBAC filter applies)

### Requirement: MCP tool for API key creation
The system SHALL expose MCP tool for vessels to programmatically create API keys.

#### Scenario: Vessel creates API key for user
- **WHEN** vessel calls user_create_api_key with { user_id, tier, name }
- **THEN** system creates API key and returns { key_id, secret, prefix }

#### Scenario: Key creation recorded as trace
- **WHEN** vessel creates API key via MCP
- **THEN** system records operation in execution trace for learning

### Requirement: MCP operation tracing
The system SHALL record all MCP tool invocations as execution traces for learning.

#### Scenario: MCP call traced
- **WHEN** vessel calls any user-vessel MCP tool
- **THEN** system creates execution trace with { tool_name, input, output, duration, success }

#### Scenario: Failed MCP call traced
- **WHEN** MCP tool invocation fails with error
- **THEN** system records trace with failure status and error message for debugging

### Requirement: MCP tool discovery
The system SHALL expose tools metadata for MCP client discovery.

#### Scenario: Client lists available tools
- **WHEN** MCP client calls listTools
- **THEN** system returns all user-vessel MCP tool definitions with schemas
