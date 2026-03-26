-- Core multi-tenant tables: organizations, users, api_keys, minibob_instance
-- These tables form the foundation of the multi-tenant RBAC system

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================

DEFINE TABLE IF NOT EXISTS organizations SCHEMAFULL
  PERMISSIONS
    -- Users can only view their own organization
    FOR select WHERE id = $auth.org_id
    -- Only admins can create/update organizations (checked in application layer)
    FOR create, update WHERE $auth.role = 'admin'
    FOR delete NONE;

DEFINE FIELD IF NOT EXISTS name ON organizations TYPE string
  ASSERT $value != NONE AND string::len($value) > 0
  VALUE $value;

DEFINE FIELD IF NOT EXISTS stripe_customer_id ON organizations TYPE option<string>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS seat_limit ON organizations TYPE int
  ASSERT $value >= 1
  VALUE $value
  DEFAULT 5;

DEFINE FIELD IF NOT EXISTS seat_usage ON organizations TYPE int
  ASSERT $value >= 0 AND $value <= seat_limit
  VALUE $value
  DEFAULT 0;

DEFINE FIELD IF NOT EXISTS created_at ON organizations TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

DEFINE FIELD IF NOT EXISTS updated_at ON organizations TYPE datetime
  VALUE time::now();

DEFINE INDEX IF NOT EXISTS idx_org_name ON organizations FIELDS name;

-- ============================================================================
-- USERS TABLE
-- ============================================================================

DEFINE TABLE IF NOT EXISTS users SCHEMAFULL
  PERMISSIONS
    -- Users can view other users in their organization
    FOR select WHERE org_id = $auth.org_id
    -- Admins can create/update/delete users in their organization
    FOR create, update WHERE $auth.role = 'admin' AND org_id = $auth.org_id
    FOR delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;

DEFINE FIELD IF NOT EXISTS org_id ON users TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS email ON users TYPE string
  ASSERT $value != NONE AND string::is_email($value)
  VALUE $value;

DEFINE FIELD IF NOT EXISTS name ON users TYPE string
  ASSERT $value != NONE AND string::len($value) > 0
  VALUE $value;

DEFINE FIELD IF NOT EXISTS password_hash ON users TYPE string
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS role ON users TYPE string
  ASSERT $value IN ['admin', 'member']
  VALUE $value
  DEFAULT 'member';

DEFINE FIELD IF NOT EXISTS created_at ON users TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

DEFINE FIELD IF NOT EXISTS last_login_at ON users TYPE option<datetime>
  VALUE $value;

DEFINE INDEX IF NOT EXISTS idx_user_email ON users FIELDS email UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_user_org ON users FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_user_org_role ON users FIELDS org_id, role;

-- ============================================================================
-- API_KEYS TABLE
-- ============================================================================

DEFINE TABLE IF NOT EXISTS api_keys SCHEMAFULL
  PERMISSIONS
    -- Users can view their own API keys
    FOR select WHERE org_id = $auth.org_id AND (user_id = $auth.id OR $auth.role = 'admin')
    -- Users can create API keys for themselves, admins for anyone in org
    FOR create WHERE org_id = $auth.org_id AND (user_id = $auth.id OR $auth.role = 'admin')
    -- Only key owner or admin can update/delete
    FOR update, delete WHERE org_id = $auth.org_id AND (user_id = $auth.id OR $auth.role = 'admin');

DEFINE FIELD IF NOT EXISTS org_id ON api_keys TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS user_id ON api_keys TYPE record<users>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS key_hash ON api_keys TYPE string
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS scopes ON api_keys TYPE array<string>
  VALUE $value
  DEFAULT [];

DEFINE FIELD IF NOT EXISTS created_at ON api_keys TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

DEFINE FIELD IF NOT EXISTS last_used_at ON api_keys TYPE option<datetime>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS expires_at ON api_keys TYPE option<datetime>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS is_active ON api_keys TYPE bool
  VALUE $value
  DEFAULT true;

DEFINE INDEX IF NOT EXISTS idx_api_key_org ON api_keys FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_api_key_user ON api_keys FIELDS user_id;
DEFINE INDEX IF NOT EXISTS idx_api_key_hash ON api_keys FIELDS key_hash UNIQUE;

-- ============================================================================
-- MINIBOB_INSTANCE TABLE
-- ============================================================================

DEFINE TABLE IF NOT EXISTS minibob_instance SCHEMAFULL
  PERMISSIONS
    -- Instances can view their own record
    FOR select WHERE id = $auth.id OR (org_id = $auth.org_id AND $auth.role = 'admin')
    -- Admins can create/update/delete instances in their organization
    FOR create, update WHERE $auth.role = 'admin' AND org_id = $auth.org_id
    FOR delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;

DEFINE FIELD IF NOT EXISTS instance_id ON minibob_instance TYPE string
  ASSERT $value != NONE AND string::len($value) > 0
  VALUE $value;

DEFINE FIELD IF NOT EXISTS org_id ON minibob_instance TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS project_id ON minibob_instance TYPE record<projects>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS api_key_hash ON minibob_instance TYPE string
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS vessel_id ON minibob_instance TYPE option<string>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS is_active ON minibob_instance TYPE bool
  VALUE $value
  DEFAULT true;

DEFINE FIELD IF NOT EXISTS created_at ON minibob_instance TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

DEFINE FIELD IF NOT EXISTS last_active_at ON minibob_instance TYPE option<datetime>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS expires_at ON minibob_instance TYPE option<datetime>
  VALUE $value;

DEFINE INDEX IF NOT EXISTS idx_minibob_instance_id ON minibob_instance FIELDS instance_id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_minibob_org ON minibob_instance FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_minibob_project ON minibob_instance FIELDS project_id;
DEFINE INDEX IF NOT EXISTS idx_minibob_org_project ON minibob_instance FIELDS org_id, project_id;
