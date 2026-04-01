-- ============================================================================
-- User Vessel Schema Extensions
-- ============================================================================
--
-- This migration extends the existing core schema with user-vessel specific
-- fields and ACCESS methods for password-based authentication.
--
-- IMPORTANT: This assumes core schema (organizations, users, projects, api_keys)
-- already exists from metabob-proto. We're only adding:
-- 1. password_hash field to users table
-- 2. user_password ACCESS method for email/password authentication
--
-- ============================================================================

-- ============================================================================
-- EXTEND USERS TABLE
-- ============================================================================

-- Add password_hash field for password-based authentication
DEFINE FIELD IF NOT EXISTS password_hash ON users TYPE string
  VALUE $value;

DEFINE FIELD IF NOT EXISTS last_password_change ON users TYPE option<datetime>
  VALUE $value;

-- ============================================================================
-- ACCESS METHOD: user_password
-- ============================================================================
--
-- Email/password authentication for dashboard users
-- Clients provide: email, password, org_id (optional)
--
-- This ACCESS method validates credentials and returns the user record
-- with computed fields for RBAC (role, project_ids)

DEFINE ACCESS IF NOT EXISTS user_password ON DATABASE TYPE RECORD
  -- SIGNIN query validates email/password and returns user with RBAC context
  SIGNIN (
    SELECT
      id,
      org_id,
      email,
      name,
      role,
      -- Include project_ids from project_members for project-scoped access
      (SELECT project_id FROM project_members WHERE user_id = $parent.id).project_id AS project_ids,
      created_at,
      last_login
    FROM users
    WHERE email = $email
      AND org_id = $org_id
      -- Verify password using argon2 hash comparison
      AND crypto::argon2::compare(password_hash, $password)
  )
  -- AUTHENTICATE clause ensures $auth is populated correctly
  AUTHENTICATE {
    -- Validate the user record exists and has required fields
    IF !$auth.id OR !$auth.org_id {
      THROW "Invalid credentials";
    };

    -- Update last_login timestamp
    UPDATE $auth.id SET last_login = time::now();

    -- Return the record to confirm authentication
    RETURN $auth;
  }
  -- Duration settings for web dashboard
  DURATION FOR TOKEN 15m, FOR SESSION 12h;

-- ============================================================================
-- INDICES
-- ============================================================================

-- Optimize email lookups for authentication
DEFINE INDEX IF NOT EXISTS idx_user_email_org ON users FIELDS email, org_id;

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- After applying this migration:
-- 1. Existing users won't have password_hash - needs to be set via password reset
-- 2. New users can be created with password via user-vessel API
-- 3. AUTH context ($auth) will include:
--    - id: User record ID
--    - org_id: Organization ID
--    - role: admin | member
--    - project_ids: Array of accessible project IDs
-- 4. PERMISSIONS clauses in core schema will enforce RBAC automatically
--
