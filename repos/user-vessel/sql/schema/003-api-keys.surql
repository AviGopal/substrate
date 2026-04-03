-- API Keys table with RBAC PERMISSIONS enforcement
-- Multi-tenant API key management with connection slot tracking
--
-- NOTE: This is the unified schema for user-vessel. It supersedes
-- the identity-vessel api_keys definition by adding connection management
-- fields (max_connections, rotation_required) while maintaining compatibility.
--
-- Key storage model:
-- - key_id: Unique identifier embedded in HMAC-based key
-- - Identity-vessel generates keys and validates HMAC signatures
-- - User-vessel stores metadata and enforces connection limits
-- - Raw keys are NEVER stored - only key_id for lookup

DEFINE TABLE api_keys SCHEMAFULL
  PERMISSIONS
    -- SELECT: users see their own keys, admins see all keys in org
    FOR select WHERE $auth = NONE OR (
      org_id = $auth.org_id AND (
        user_id = $auth.id OR
        $auth.role IN ['admin', 'owner']
      )
    )
    -- CREATE: authenticated users in org can create their own keys
    FOR create WHERE $auth = NONE OR (
      org_id = $auth.org_id AND
      user_id = $auth.id
    )
    -- UPDATE: owner of key or admin can update
    FOR update WHERE $auth = NONE OR (
      org_id = $auth.org_id AND (
        user_id = $auth.id OR
        $auth.role IN ['admin', 'owner']
      )
    )
    -- DELETE: admin only (regular users should revoke via is_active = false)
    FOR delete WHERE $auth = NONE OR (
      org_id = $auth.org_id AND
      $auth.role IN ['admin', 'owner']
    );

-- =============================================================================
-- CORE FIELDS
-- =============================================================================

-- Unique key identifier (embedded in HMAC key, used for lookup during validation)
DEFINE FIELD key_id ON api_keys TYPE string
  ASSERT $value != NONE AND string::len($value) >= 8
  COMMENT "Unique key identifier embedded in HMAC-based API key";

-- Organization ID for multi-tenancy isolation
DEFINE FIELD org_id ON api_keys TYPE string
  ASSERT $value != NONE
  COMMENT "Organization ID for multi-tenant isolation";

-- Owner of this API key (record link to users table)
DEFINE FIELD user_id ON api_keys TYPE record<users>
  ASSERT $value != NONE
  COMMENT "User who owns this API key";

-- User-friendly name for the key
DEFINE FIELD name ON api_keys TYPE option<string>
  ASSERT $value = NONE OR string::len($value) <= 255
  COMMENT "User-provided name for identifying the key";

-- =============================================================================
-- PERMISSION SCOPES
-- =============================================================================

-- Scopes define what the key can access
DEFINE FIELD scopes ON api_keys TYPE array<string>
  VALUE $value OR ['read', 'write']
  COMMENT "Permission scopes: read, write, admin, etc.";

-- =============================================================================
-- STATUS FIELDS
-- =============================================================================

-- Whether the key is currently active (soft delete)
DEFINE FIELD is_active ON api_keys TYPE bool
  VALUE $value OR true
  COMMENT "Active keys can be used; inactive keys are revoked";

-- Flag for keys that need rotation (e.g., leaked, old format)
DEFINE FIELD rotation_required ON api_keys TYPE bool
  VALUE $value OR false
  COMMENT "Key should be rotated due to security concerns";

-- =============================================================================
-- CONNECTION MANAGEMENT
-- =============================================================================

-- Maximum concurrent connections allowed for this key
DEFINE FIELD max_connections ON api_keys TYPE int
  ASSERT $value >= 1 AND $value <= 100
  VALUE $value OR 1
  COMMENT "Maximum concurrent connection slots for this API key";

-- =============================================================================
-- TIMESTAMPS
-- =============================================================================

-- When the key was created (immutable)
DEFINE FIELD created_at ON api_keys TYPE datetime
  VALUE $before OR time::now()
  COMMENT "Timestamp when key was created";

-- When the key was last used for authentication
DEFINE FIELD last_used_at ON api_keys TYPE option<datetime>
  VALUE $value
  COMMENT "Timestamp of last successful authentication";

-- Optional expiration date
DEFINE FIELD expires_at ON api_keys TYPE option<datetime>
  VALUE $value
  COMMENT "Key expiration timestamp (null = never expires)";

-- =============================================================================
-- INDICES
-- =============================================================================

-- Primary lookup: find key by key_id during authentication
DEFINE INDEX idx_api_keys_key_id ON api_keys FIELDS key_id UNIQUE;

-- Multi-tenant lookup: list keys by organization
DEFINE INDEX idx_api_keys_org_id ON api_keys FIELDS org_id;

-- User-specific lookup: list keys owned by a user
DEFINE INDEX idx_api_keys_user_id ON api_keys FIELDS user_id;

-- Combined org + user lookup for permission checks
DEFINE INDEX idx_api_keys_org_user ON api_keys FIELDS org_id, user_id;

-- Active key lookup: filter by status efficiently
DEFINE INDEX idx_api_keys_active ON api_keys FIELDS is_active, org_id;

-- Expiration queries: find expired keys for cleanup
DEFINE INDEX idx_api_keys_expires ON api_keys FIELDS expires_at;
