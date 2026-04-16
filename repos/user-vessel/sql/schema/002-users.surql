-- Users table with RBAC PERMISSIONS enforcement
-- Users are scoped to organizations and can have different roles

DEFINE TABLE users SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE $auth = NONE OR ($auth.role = 'admin' AND org_id = $auth.org_id)
    FOR update WHERE org_id = $auth.org_id AND ($auth.role = 'admin' OR id = $auth.id)
    FOR delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;

-- Primary fields
DEFINE FIELD org_id ON users TYPE string
  ASSERT $value != NONE;

DEFINE FIELD email ON users TYPE string
  ASSERT $value != NONE AND string::len($value) >= 3 AND string::len($value) <= 255;

DEFINE FIELD name ON users TYPE string
  ASSERT $value != NONE AND string::len($value) >= 1 AND string::len($value) <= 255;

DEFINE FIELD password_hash ON users TYPE string
  ASSERT $value != NONE;

DEFINE FIELD role ON users TYPE string
  ASSERT $value IN ['admin', 'member']
  VALUE $value OR 'member';

-- Metadata
DEFINE FIELD created_at ON users TYPE datetime
  VALUE $before OR time::now();

DEFINE FIELD last_login ON users TYPE option<datetime>
  VALUE $value OR NONE;

-- Indices for performance
DEFINE INDEX idx_email ON users FIELDS email UNIQUE;
DEFINE INDEX idx_org_id_email ON users FIELDS org_id, email UNIQUE;
DEFINE INDEX idx_org_id ON users FIELDS org_id;
