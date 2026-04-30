-- user-vessel Phase A — Accounts + Projects (federation foundation)
--
-- This migration introduces the account model that supersedes organizations
-- as the primary tenancy unit, plus the project model used for intra-account
-- resource grouping. Federation links, cross-account project access, and
-- email invitations are DEFERRED to Phase B+ (see openspec change
-- `user-vessel-accounts-federation-model`).
--
-- Tables:
--   accounts         — top-level tenancy unit (replaces organizations)
--   account_members  — join: user ↔ account with expanded role enum
--   projects         — intra-account resource grouping
--   project_members  — join: user ↔ project (intra-account ONLY for Phase A)
--
-- Multi-tenancy invariants:
--   - account_id stored as record-reference-as-string ("accounts:<id>")
--   - never typed as record<accounts> — breaks SurrealDB 3.0 PERMISSIONS
--   - PERMISSIONS use $token.account_id (with $token.org_id fallback during
--     identity-vessel JWT migration window)
--
-- Migration: existing organizations rows mirrored into accounts (1:1) and
-- organization_members → account_members. Idempotent (uses CREATE … RETURN
-- NONE wrapped in IF NOT EXISTS via SELECT-then-CREATE).

-- =============================================================================
-- accounts
-- =============================================================================
--
-- An account is a named tenancy container. In Phase A every account is an
-- "organization" type (1:1 mapping with the legacy organizations table).
-- Future work may add "personal" or "enterprise" account types without a
-- schema change.

DEFINE TABLE accounts SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      $token.account_id = string::concat("accounts:", meta::id(id))
      OR $token.account_id = type::string(id)
      OR $token.org_id = string::concat("accounts:", meta::id(id))
      OR $token.org_id = type::string(id)
    FOR create WHERE $token.role IN ["owner", "admin"] OR $token = NONE
    FOR update WHERE
      ($token.account_id = string::concat("accounts:", meta::id(id))
        OR $token.account_id = type::string(id)
        OR $token.org_id = string::concat("accounts:", meta::id(id))
        OR $token.org_id = type::string(id))
      AND $token.role IN ["owner", "admin"]
    FOR delete WHERE
      ($token.account_id = string::concat("accounts:", meta::id(id))
        OR $token.account_id = type::string(id)
        OR $token.org_id = string::concat("accounts:", meta::id(id))
        OR $token.org_id = type::string(id))
      AND $token.role = "owner";

DEFINE FIELD name ON accounts TYPE string
  ASSERT $value != NONE AND string::len($value) >= 1 AND string::len($value) <= 255;

DEFINE FIELD tier ON accounts TYPE string
  DEFAULT "free"
  ASSERT $value IN ["free", "starter", "pro", "enterprise"];

DEFINE FIELD seat_limit ON accounts TYPE int
  DEFAULT 1
  ASSERT $value >= -1;  -- -1 = unlimited

DEFINE FIELD created_by ON accounts TYPE option<string>
  ASSERT $value = NONE OR string::starts_with($value, "users:");

DEFINE FIELD created_at ON accounts TYPE datetime
  DEFAULT time::now() READONLY;

DEFINE FIELD updated_at ON accounts TYPE datetime
  VALUE time::now();

DEFINE INDEX idx_accounts_tier ON accounts FIELDS tier;

-- =============================================================================
-- account_members
-- =============================================================================
--
-- Replaces organization_members. Role enum expanded to support GitHub-style
-- hierarchy (owner > admin > member > viewer). Future Phase B may extend with
-- "maintain" / "developer" / "triage" — not yet in scope.

DEFINE TABLE account_members SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      account_id = $token.account_id OR account_id = $token.org_id
    FOR create WHERE
      (account_id = $token.account_id OR account_id = $token.org_id)
      AND $token.role IN ["owner", "admin"]
    FOR update WHERE
      (account_id = $token.account_id OR account_id = $token.org_id)
      AND $token.role IN ["owner", "admin"]
    FOR delete WHERE
      (account_id = $token.account_id OR account_id = $token.org_id)
      AND $token.role IN ["owner", "admin"];

DEFINE FIELD account_id ON account_members TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "accounts:");

DEFINE FIELD user_id ON account_members TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "users:");

DEFINE FIELD role ON account_members TYPE string
  DEFAULT "member"
  ASSERT $value IN ["owner", "admin", "member", "viewer"];

DEFINE FIELD joined_at ON account_members TYPE datetime
  DEFAULT time::now() READONLY;

DEFINE INDEX idx_am_account_user ON account_members FIELDS account_id, user_id UNIQUE;
DEFINE INDEX idx_am_user ON account_members FIELDS user_id;

-- =============================================================================
-- projects
-- =============================================================================
--
-- Intra-account grouping for activities, traces, vessels. Visibility flag
-- declares default access scope; Phase A enforces "private" and "account"
-- only. "public" is reserved for Phase B (when cross-account discovery
-- lands).

DEFINE TABLE projects SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      account_id = $token.account_id OR account_id = $token.org_id
    FOR create WHERE
      account_id = $token.account_id OR account_id = $token.org_id
    FOR update WHERE
      (account_id = $token.account_id OR account_id = $token.org_id)
      AND $token.role IN ["owner", "admin"]
    FOR delete WHERE
      (account_id = $token.account_id OR account_id = $token.org_id)
      AND $token.role IN ["owner", "admin"];

DEFINE FIELD account_id ON projects TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "accounts:");

DEFINE FIELD name ON projects TYPE string
  ASSERT $value != NONE AND string::len($value) >= 1 AND string::len($value) <= 255;

DEFINE FIELD description ON projects TYPE option<string>;

DEFINE FIELD visibility ON projects TYPE string
  DEFAULT "private"
  ASSERT $value IN ["private", "account", "public"];

DEFINE FIELD created_by ON projects TYPE option<string>
  ASSERT $value = NONE OR string::starts_with($value, "users:");

DEFINE FIELD created_at ON projects TYPE datetime
  DEFAULT time::now() READONLY;

DEFINE FIELD updated_at ON projects TYPE datetime
  VALUE time::now();

DEFINE INDEX idx_projects_account ON projects FIELDS account_id;
DEFINE INDEX idx_projects_account_name ON projects FIELDS account_id, name UNIQUE;

-- =============================================================================
-- project_members  (intra-account ONLY in Phase A)
-- =============================================================================
--
-- Per-user override of project access within an account. Cross-account
-- federation membership is DEFERRED to Phase B. The PERMISSIONS clause
-- enforces this: rows are visible only to callers whose account_id matches
-- the project's owning account_id (resolved via subquery).

DEFINE TABLE project_members SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      project_id IN (
        SELECT VALUE type::string(id) FROM projects
        WHERE account_id = $token.account_id OR account_id = $token.org_id
      )
    FOR create WHERE
      project_id IN (
        SELECT VALUE type::string(id) FROM projects
        WHERE account_id = $token.account_id OR account_id = $token.org_id
      )
      AND $token.role IN ["owner", "admin", "member"]
    FOR update WHERE
      project_id IN (
        SELECT VALUE type::string(id) FROM projects
        WHERE account_id = $token.account_id OR account_id = $token.org_id
      )
      AND $token.role IN ["owner", "admin"]
    FOR delete WHERE
      project_id IN (
        SELECT VALUE type::string(id) FROM projects
        WHERE account_id = $token.account_id OR account_id = $token.org_id
      )
      AND $token.role IN ["owner", "admin"];

DEFINE FIELD project_id ON project_members TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "projects:");

DEFINE FIELD user_id ON project_members TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "users:");

DEFINE FIELD role ON project_members TYPE string
  DEFAULT "developer"
  ASSERT $value IN ["owner", "maintain", "developer", "triage", "viewer"];

DEFINE FIELD added_at ON project_members TYPE datetime
  DEFAULT time::now() READONLY;

DEFINE INDEX idx_pm_project_user ON project_members FIELDS project_id, user_id UNIQUE;
DEFINE INDEX idx_pm_user ON project_members FIELDS user_id;

-- =============================================================================
-- Migration: organizations → accounts (idempotent 1:1 copy)
-- =============================================================================
--
-- Each existing organization gets mirrored as an account with the same id
-- suffix. Existing organization_members rows mirror into account_members.
-- We use SELECT-then-CREATE rather than INSERT IGNORE because SurrealDB
-- doesn't expose a true upsert that preserves the original id; running this
-- migration twice is safe because the second pass finds the existing row
-- and skips creation.
--
-- After this migration runs, both tables coexist. The route layer reads
-- from accounts; organizations remains for back-compat queries until the
-- legacy /v2/organizations routes are removed.

-- For each organization, ensure an accounts:<same-id> row exists.
LET $orgs = (SELECT id, name, tier, seat_limit, created_at FROM organizations);
FOR $o IN $orgs {
  LET $acct_id = string::concat("accounts:", meta::id($o.id));
  LET $existing = (SELECT id FROM type::thing($acct_id));
  IF array::len($existing) = 0 {
    CREATE type::thing($acct_id) SET
      name = $o.name,
      tier = $o.tier,
      seat_limit = $o.seat_limit,
      created_at = $o.created_at;
  };
};

-- For each organization_member, ensure an account_members row exists.
LET $oms = (SELECT id, org_id, user_id, role, joined_at FROM organization_members);
FOR $m IN $oms {
  LET $acct_id = string::replace($m.org_id, "organizations:", "accounts:");
  LET $existing = (
    SELECT id FROM account_members
    WHERE account_id = $acct_id AND user_id = $m.user_id
  );
  IF array::len($existing) = 0 {
    CREATE account_members SET
      account_id = $acct_id,
      user_id = $m.user_id,
      role = $m.role,
      joined_at = $m.joined_at;
  };
};
