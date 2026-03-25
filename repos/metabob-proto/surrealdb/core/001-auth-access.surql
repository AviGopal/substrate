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

-- RECORD Authentication for User API Keys (IDE integrations, CLI tools)
-- Clients only need: endpoint URL + api_key (format: mb_<type>_<random>)
DEFINE ACCESS OVERWRITE apikey_record ON DATABASE TYPE RECORD
  -- SIGNIN query validates API key and returns user info with computed fields
  SIGNIN (
    SELECT
      id,
      org_id,
      user_id,
      scopes,
      -- Include user role for RBAC
      (SELECT role FROM users WHERE id = $parent.user_id)[0].role AS role,
      -- Include project_ids from project_members table for project-scoped access
      (SELECT project_id FROM project_members WHERE user_id = $parent.user_id).project_id AS project_ids
    FROM api_keys
    WHERE is_active = true
      AND (expires_at IS NONE OR expires_at > time::now())
      -- Verify API key using argon2 hash comparison
      AND crypto::argon2::compare(key_hash, $api_key)
  )
  -- AUTHENTICATE clause ensures $auth is populated correctly
  AUTHENTICATE {
    -- Validate the API key record exists and has required fields
    IF !$auth.id OR !$auth.org_id {
      THROW "Invalid API key";
    };
    -- Return the record to confirm authentication
    RETURN $auth;
  }
  -- Duration settings - shorter tokens for security, refresh via API key
  DURATION FOR TOKEN 15m, FOR SESSION 1h;

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
-- MiniBob instances authenticate with instance_id and api_key
-- API keys authenticate with just the api_key (mb_live_xxx or mb_test_xxx)
-- The SIGNIN query validates credentials and returns the record
-- The AUTHENTICATE clause ensures $auth is populated for PERMISSIONS clauses
-- Clients only need the endpoint URL and credentials - auth is self-managed
