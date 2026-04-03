-- Authentication access definitions for multi-tenant SurrealDB 3.0
-- Implements JWT (external users) and RECORD (MiniBob instances) authentication
--
-- IMPORTANT: The AUTHENTICATE clause is required for SurrealDB 3.x to properly
-- populate the $auth context. Without it, $auth fields may not be accessible
-- after token verification.

-- JWT Authentication for external users (dashboard, API clients, IDE extensions)
DEFINE ACCESS IF NOT EXISTS jwt_external ON DATABASE TYPE JWT
  ALGORITHM HS256
  -- Secret key for JWT signature verification
  -- In production, use RS256 with JWKS URL
  -- For development/testing, using HS256 with a key
  KEY 'metabob-jwt-secret-key-change-in-production'
  -- Duration settings (comma-separated for SurrealDB 3.0)
  DURATION FOR TOKEN 15m, FOR SESSION 12h;

-- RECORD Authentication for MiniBob autonomous instances
-- Clients only need: endpoint URL + instance_id + api_key
DEFINE ACCESS OVERWRITE minibob_record ON DATABASE TYPE RECORD
  -- SIGNIN query validates instance credentials and returns the record
  SIGNIN (
    SELECT * FROM minibob_instance
    WHERE instance_id = $instance_id
      AND is_active = true
      AND (expires_at IS NONE OR expires_at > time::now())
      -- Verify API key hash using argon2
      AND crypto::argon2::compare(api_key_hash, $api_key)
  )
  -- AUTHENTICATE clause ensures $auth is populated on signin AND token verification
  -- This is critical for SurrealDB 3.x - without it, $auth.org_id etc. won't work
  AUTHENTICATE {
    -- $auth contains the record returned by SIGNIN (or looked up from token ID)
    -- Validate the instance is still active (may have been deactivated since token issued)
    IF !$auth.is_active {
      THROW "This MiniBob instance has been deactivated";
    };
    -- Return the record to confirm authentication and populate $auth
    RETURN $auth;
  }
  -- Duration settings - longer for autonomous operation
  DURATION FOR TOKEN 24h, FOR SESSION 7d;

-- =============================================================================
-- LEGACY: apikey_record ACCESS (REMOVED 2026-04-03)
-- =============================================================================
-- This SurrealDB RECORD access method has been removed in favor of HMAC-based
-- API key validation via identity-vessel. The identity-vessel pattern is:
-- 1. Faster (~2ms vs ~50ms for Argon2 hash comparison)
-- 2. Stateless (no database lookup required for validation)
-- 3. Centralized (identity-vessel is the single source of truth for auth)
--
-- API key format: mb_{env}_{org}_{keyId}_{hmacSignature}
-- Validation: identity-vessel validates format and HMAC signature
-- Revocation: Redis-based revocation cache (O(1) lookup)
--
-- Clients should use:
-- - Authorization: Bearer <jwt> for JWT tokens
-- - Authorization: ApiKey <key> for API keys (validated via identity-vessel)
-- =============================================================================

-- Note on JWT claims structure (for jwt_external):
-- {
--   "iss": "https://metabob.com",
--   "sub": "user:alice",
--   "org_id": "organization:acme",
--   "project_ids": ["project:backend", "project:frontend"],
--   "role": "admin" | "member",
--   "user_id": "user:alice",
--   "exp": <timestamp>,
--   "iat": <timestamp>
-- }

-- Note on RECORD authentication:
-- MiniBob instances authenticate with instance_id and api_key via minibob_record
-- The SIGNIN query validates credentials and returns the record
-- The AUTHENTICATE clause ensures $auth is populated for PERMISSIONS clauses
-- Clients only need the endpoint URL and credentials - auth is self-managed
--
-- API key authentication for users is handled by identity-vessel (HMAC-based)
-- NOT via SurrealDB RECORD access - see comment above for apikey_record removal
