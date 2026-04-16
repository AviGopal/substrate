-- =============================================================================
-- Authentication and Authorization Schema
-- =============================================================================
-- Activity-API owns: minibob_instance table
-- Identity-vessel owns: organizations, users, api_keys tables
-- =============================================================================

-- =============================================================================
-- Table: minibob_instance (Activity-specific) - DEPRECATED
-- =============================================================================
-- DEPRECATED: Use API key authentication instead
-- Migration 052 makes this table read-only and removes minibob_record ACCESS
--
-- MiniBob instances now authenticate using standard API keys:
--   Authorization: ApiKey <key>
-- Identity service validates and returns org_id, user_id, key_id, scopes
-- =============================================================================

-- OVERWRITE ensures PERMISSIONS are always applied (critical for $auth.org_id access)
DEFINE TABLE OVERWRITE minibob_instance SCHEMAFULL
  PERMISSIONS
    -- MiniBob can read its own record (needed for org_id access)
    FOR select WHERE id = $auth
    -- Only root can create/update/delete (managed via init-data)
    FOR create, update, delete NONE;

DEFINE FIELD IF NOT EXISTS instance_id ON minibob_instance TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS org_id ON minibob_instance TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID (string reference)";

DEFINE FIELD IF NOT EXISTS project_id ON minibob_instance TYPE option<string>;

DEFINE FIELD IF NOT EXISTS api_key_hash ON minibob_instance TYPE string
  ASSERT $value != NONE
  COMMENT "Argon2 hash of the API key";

DEFINE FIELD IF NOT EXISTS vessel_id ON minibob_instance TYPE string
  ASSERT $value != NONE
  COMMENT "Vessel identifier (e.g., minibob-cli-local, minibob-k8s-prod)";

DEFINE FIELD IF NOT EXISTS is_active ON minibob_instance TYPE bool
  VALUE $value OR true;

DEFINE FIELD IF NOT EXISTS created_at ON minibob_instance TYPE datetime
  VALUE $value OR time::now();

DEFINE FIELD IF NOT EXISTS last_active_at ON minibob_instance TYPE datetime
  VALUE $value OR time::now();

-- Unique constraint on instance_id
DEFINE INDEX IF NOT EXISTS idx_minibob_instance_id
  ON minibob_instance FIELDS instance_id UNIQUE;

-- =============================================================================
-- ACCESS METHOD: minibob_record - DEPRECATED (removed in migration 052)
-- =============================================================================
-- DEPRECATED: MiniBob instances now use standard API key authentication
--
-- Old flow (removed):
--   POST /v2/auth/minibob/signin { instance_id, api_key }
--   Returns JWT via minibob_record ACCESS
--
-- New flow (use this):
--   Authorization: ApiKey <key>
--   Validated via identity service
--   Returns org_id, user_id, key_id, scopes
-- =============================================================================

-- REMOVED: Migration 052 removes this ACCESS method
-- Uncomment for rollback if needed:
--
-- DEFINE ACCESS IF NOT EXISTS minibob_record ON DATABASE TYPE RECORD
--   SIGNIN (
--     SELECT * FROM minibob_instance
--     WHERE instance_id = $instance_id
--     AND crypto::argon2::compare(api_key_hash, $api_key)
--   )
--   DURATION FOR TOKEN 24h
--   DURATION FOR SESSION 7d;
