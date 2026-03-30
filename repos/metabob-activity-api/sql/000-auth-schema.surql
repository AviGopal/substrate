-- =============================================================================
-- Authentication and Authorization Schema
-- =============================================================================
-- Defines organizations, users, minibob_instance tables and ACCESS methods
-- =============================================================================

-- =============================================================================
-- Table: organizations
-- =============================================================================

DEFINE TABLE IF NOT EXISTS organizations SCHEMAFULL;

DEFINE FIELD IF NOT EXISTS name ON organizations TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS created_at ON organizations TYPE datetime
  VALUE $value OR time::now();

DEFINE FIELD IF NOT EXISTS updated_at ON organizations TYPE datetime
  VALUE $value OR time::now();

-- =============================================================================
-- Table: users
-- =============================================================================

DEFINE TABLE IF NOT EXISTS users SCHEMAFULL;

DEFINE FIELD IF NOT EXISTS email ON users TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS name ON users TYPE option<string>;

DEFINE FIELD IF NOT EXISTS org_id ON users TYPE record<organizations>
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS created_at ON users TYPE datetime
  VALUE $value OR time::now();

DEFINE FIELD IF NOT EXISTS updated_at ON users TYPE datetime
  VALUE $value OR time::now();

-- =============================================================================
-- Table: minibob_instance
-- =============================================================================

DEFINE TABLE IF NOT EXISTS minibob_instance SCHEMAFULL;

DEFINE FIELD IF NOT EXISTS instance_id ON minibob_instance TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS org_id ON minibob_instance TYPE record<organizations>
  ASSERT $value != NONE;

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
-- ACCESS METHOD: minibob_record
-- =============================================================================
-- Authenticates MiniBob instances using instance_id and API key
-- Returns JWT token with org_id in $auth for RBAC enforcement
-- =============================================================================

DEFINE ACCESS IF NOT EXISTS minibob_record ON DATABASE TYPE RECORD
  SIGNIN (
    SELECT * FROM minibob_instance
    WHERE instance_id = $instance_id
    AND crypto::argon2::compare(api_key_hash, $api_key)
  )
  DURATION FOR TOKEN 24h
  DURATION FOR SESSION 7d;
