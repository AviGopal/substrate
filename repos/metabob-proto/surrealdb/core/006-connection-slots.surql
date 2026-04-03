-- =============================================================================
-- Connection Slots: Active Session Management
-- =============================================================================
-- Connections track active MCP sessions that occupy connection slots.
-- Each connection is tied to an API key and counts against its slot limit.
-- RBAC: Users can only access connections in their organization.
-- =============================================================================

-- =============================================================================
-- Table: connection
-- =============================================================================
-- Represents an active session occupying a connection slot.
-- State machine: active → grace → disconnected
-- Session tokens enable reconnection within grace period.
-- =============================================================================

DEFINE TABLE IF NOT EXISTS connection SCHEMAFULL
  PERMISSIONS
    -- SELECT: Users can see connections in their organization
    FOR select WHERE org_id = $auth.org_id

    -- CREATE: Any authenticated user/instance can create connections
    FOR create WHERE $auth.org_id != NONE

    -- UPDATE: Users can update their own connections or admins can update any
    FOR update WHERE
      org_id = $auth.org_id
      AND (created_by = $auth.id OR $auth.role = 'admin')

    -- DELETE: Only admins can delete connection records
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';

-- Relationship to API key (billing entity)
DEFINE FIELD IF NOT EXISTS api_key_id ON connection TYPE record<api_keys>
  ASSERT $value != NONE
  COMMENT "API key that this connection slot belongs to";

-- Multi-tenancy (REQUIRED for RBAC)
DEFINE FIELD IF NOT EXISTS org_id ON connection TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id
  COMMENT "Organization ID (required for all connections)";

-- Optional project scope
DEFINE FIELD IF NOT EXISTS project_id ON connection TYPE option<record<projects>>
  VALUE $value OR $auth.project_id
  COMMENT "Project ID (optional, inherited from auth context)";

-- Who created this connection
DEFINE FIELD IF NOT EXISTS created_by ON connection TYPE option<record<users> | record<minibob_instance>>
  VALUE $value OR $auth.id
  COMMENT "User or MiniBob instance who created this connection";

-- Optional human-readable name for this connection
DEFINE FIELD IF NOT EXISTS instance_name ON connection TYPE option<string>
  COMMENT "Human-readable identifier for this connection (e.g., 'dev-laptop', 'ci-runner-1')";

-- Session token for reconnection within grace period
DEFINE FIELD IF NOT EXISTS session_token ON connection TYPE string
  ASSERT $value != NONE
  COMMENT "Unique session token for reconnection (cryptographically random)";

-- Connection state machine
DEFINE FIELD IF NOT EXISTS status ON connection TYPE string
  ASSERT $value IN ['active', 'grace', 'disconnected']
  VALUE $value OR 'active'
  DEFAULT 'active'
  COMMENT "Connection status: active (healthy), grace (missed heartbeat), disconnected (expired)";

-- Timestamps
DEFINE FIELD IF NOT EXISTS connected_at ON connection TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now()
  COMMENT "When the connection was established";

DEFINE FIELD IF NOT EXISTS last_heartbeat ON connection TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now()
  COMMENT "Last successful heartbeat timestamp";

DEFINE FIELD IF NOT EXISTS grace_until ON connection TYPE option<datetime>
  COMMENT "When grace period expires (only set when status='grace')";

DEFINE FIELD IF NOT EXISTS disconnected_at ON connection TYPE option<datetime>
  COMMENT "When connection was marked as disconnected";

-- Execution tracking (for grace period calculation)
DEFINE FIELD IF NOT EXISTS current_execution ON connection TYPE option<record<execution>>
  COMMENT "Reference to in-flight execution (for grace period calculation)";

DEFINE FIELD IF NOT EXISTS execution_started_at ON connection TYPE option<datetime>
  COMMENT "When current execution started";

DEFINE FIELD IF NOT EXISTS estimated_duration_ms ON connection TYPE option<int>
  COMMENT "Estimated execution duration in ms (from activity or heartbeat)";

-- JWT tracking
DEFINE FIELD IF NOT EXISTS jwt_token ON connection TYPE option<string>
  COMMENT "Current JWT token for this connection (hashed for security)";

DEFINE FIELD IF NOT EXISTS jwt_expires_at ON connection TYPE option<datetime>
  COMMENT "When the current JWT expires";

-- Metadata
DEFINE FIELD IF NOT EXISTS metadata ON connection TYPE option<object> FLEXIBLE
  COMMENT "Extensible metadata (client info, version, etc.)";

DEFINE FIELD IF NOT EXISTS created_at ON connection TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now()
  COMMENT "Record creation timestamp";

DEFINE FIELD IF NOT EXISTS updated_at ON connection TYPE datetime
  VALUE time::now()
  COMMENT "Last update timestamp";

-- =============================================================================
-- Indexes
-- =============================================================================

-- Unique session token for reconnection lookup
DEFINE INDEX IF NOT EXISTS idx_connection_session
  ON connection FIELDS session_token UNIQUE;

-- API key lookup for slot counting
DEFINE INDEX IF NOT EXISTS idx_connection_api_key
  ON connection FIELDS api_key_id;

-- Status filtering for heartbeat worker
DEFINE INDEX IF NOT EXISTS idx_connection_status
  ON connection FIELDS status;

-- Multi-tenant indexes (CRITICAL for RBAC performance)
DEFINE INDEX IF NOT EXISTS idx_connection_org
  ON connection FIELDS org_id;

DEFINE INDEX IF NOT EXISTS idx_connection_project
  ON connection FIELDS project_id;

-- Composite indexes for common queries
DEFINE INDEX IF NOT EXISTS idx_connection_api_key_status
  ON connection FIELDS api_key_id, status;

DEFINE INDEX IF NOT EXISTS idx_connection_org_status
  ON connection FIELDS org_id, status;

-- Grace period expiry lookup
DEFINE INDEX IF NOT EXISTS idx_connection_grace_until
  ON connection FIELDS grace_until;

-- Last heartbeat for staleness detection
DEFINE INDEX IF NOT EXISTS idx_connection_last_heartbeat
  ON connection FIELDS last_heartbeat;
