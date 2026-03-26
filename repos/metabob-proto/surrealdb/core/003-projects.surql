-- Projects table and project membership relation
-- Projects are code repositories or workspaces within an organization

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

DEFINE TABLE IF NOT EXISTS projects SCHEMAFULL
  PERMISSIONS
    -- Users can view projects in their organization where they are members
    FOR select WHERE org_id = $auth.org_id AND (
      $auth.role = 'admin' OR
      id IN $auth.project_ids
    )
    -- Admins can create/update/delete projects in their organization
    FOR create, update WHERE $auth.role = 'admin' AND org_id = $auth.org_id
    FOR delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;

DEFINE FIELD IF NOT EXISTS org_id ON projects TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS name ON projects TYPE string
  ASSERT $value != NONE AND string::len($value) > 0
  VALUE $value;

DEFINE FIELD IF NOT EXISTS repo_url ON projects TYPE option<string>
  VALUE $value;

DEFINE FIELD IF NOT EXISTS created_at ON projects TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

DEFINE FIELD IF NOT EXISTS metadata ON projects TYPE option<object>
  VALUE $value;

DEFINE INDEX IF NOT EXISTS idx_project_org ON projects FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_project_org_name ON projects FIELDS org_id, name;

-- ============================================================================
-- PROJECT_MEMBERS TABLE (relation)
-- ============================================================================

DEFINE TABLE IF NOT EXISTS project_members SCHEMAFULL
  PERMISSIONS
    -- Users can view project members for their projects
    FOR select WHERE project_id IN $auth.project_ids AND org_id = $auth.org_id
    -- Admins can add/remove project members in their organization
    FOR create, update, delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;

DEFINE FIELD IF NOT EXISTS org_id ON project_members TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS project_id ON project_members TYPE record<projects>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS user_id ON project_members TYPE record<users>
  ASSERT $value != NONE
  VALUE $value;

DEFINE FIELD IF NOT EXISTS role ON project_members TYPE string
  ASSERT $value IN ['owner', 'maintainer', 'developer', 'viewer']
  VALUE $value
  DEFAULT 'developer';

DEFINE FIELD IF NOT EXISTS added_at ON project_members TYPE datetime
  VALUE $value OR time::now()
  DEFAULT time::now();

DEFINE INDEX IF NOT EXISTS idx_project_member_unique ON project_members FIELDS project_id, user_id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_project_member_org ON project_members FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_project_member_user ON project_members FIELDS user_id;
DEFINE INDEX IF NOT EXISTS idx_project_member_project ON project_members FIELDS project_id;
