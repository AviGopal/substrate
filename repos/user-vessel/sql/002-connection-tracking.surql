-- ============================================================================
-- Connection Tracking Schema
-- ============================================================================
--
-- Tracks active connections for API keys with slot enforcement.
-- Supports connection limits at both api_key and organization levels.
--
-- ============================================================================

-- ============================================================================
-- TABLE: active_connections
-- ============================================================================

DEFINE TABLE IF NOT EXISTS active_connections SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE org_id = $auth.org_id AND user_id = $auth.id
    FOR update WHERE org_id = $auth.org_id AND user_id = $auth.id
    FOR delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;

-- Primary fields
DEFINE FIELD IF NOT EXISTS api_key_id ON active_connections TYPE record<api_keys>
  VALUE $value
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS instance_id ON active_connections TYPE string
  VALUE $value
  ASSERT $value != NONE AND string::len($value) > 0;

DEFINE FIELD IF NOT EXISTS instance_type ON active_connections TYPE string
  VALUE $value
  ASSERT $value IN ['minibob', 'ide', 'cli', 'other'];

-- Denormalized fields for efficient querying
DEFINE FIELD IF NOT EXISTS org_id ON active_connections TYPE string
  VALUE $value
  ASSERT $value != NONE AND string::len($value) > 0;

DEFINE FIELD IF NOT EXISTS user_id ON active_connections TYPE record<users>
  VALUE $value
  ASSERT $value != NONE;

-- Timestamps
DEFINE FIELD IF NOT EXISTS connected_at ON active_connections TYPE datetime
  VALUE $value OR time::now()
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS last_heartbeat_at ON active_connections TYPE datetime
  VALUE $value OR time::now()
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS disconnected_at ON active_connections TYPE option<datetime>
  VALUE $value;

-- Client metadata (optional, for debugging/monitoring)
DEFINE FIELD IF NOT EXISTS client_metadata ON active_connections TYPE option<object>
  VALUE $value;

-- ============================================================================
-- INDICES
-- ============================================================================

-- Optimize lookups by api_key_id for slot enforcement
DEFINE INDEX IF NOT EXISTS idx_connection_api_key ON active_connections FIELDS api_key_id;

-- Optimize lookups by org_id for organization-wide connection counts
DEFINE INDEX IF NOT EXISTS idx_connection_org ON active_connections FIELDS org_id;

-- Optimize lookups by instance_id for connection release
DEFINE INDEX IF NOT EXISTS idx_connection_instance ON active_connections FIELDS instance_id;

-- Composite index for active connection queries (disconnected_at IS NONE)
DEFINE INDEX IF NOT EXISTS idx_connection_active ON active_connections FIELDS disconnected_at, api_key_id;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- Note: Permissions are defined inline with the DEFINE TABLE statement above

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- Connection lifecycle:
-- 1. Claim: Create active_connections record with connected_at
-- 2. Heartbeat: Update last_heartbeat_at periodically
-- 3. Release: Set disconnected_at to mark as inactive
--
-- Slot enforcement:
-- - Count active connections WHERE api_key_id = X AND disconnected_at IS NONE
-- - Compare against api_keys.max_connections limit
-- - Also check org-level limits if configured
--
-- Cleanup strategy:
-- - Connections with no heartbeat for >5min can be considered stale
-- - Background job can auto-disconnect stale connections
-- - Old disconnected connections can be archived/deleted
--
