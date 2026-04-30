-- user-vessel Phase 1 schema
--
-- Tables:
--   organizations         — top-level tenancy unit
--   users                 — user records (mirror of identity-vessel users; auth lives there)
--   organization_members  — join table: user ↔ org with role
--
-- Note: the `api_key` table is OWNED BY identity-vessel as of 2026-04-28.
-- user-vessel only contributes the `scopes` and `key_id` fields (see
-- migration 004) and assigns scopes to already-issued keys (see api-keys.ts).
--
-- Multi-tenancy: every multi-tenant table has a string-form `org_id` that holds the
-- record-reference-as-string (e.g. "organizations:metabob"), matching the activity-api
-- pattern. Fields are NOT typed as `record<organizations>` because mixed string
-- and record-link comparisons fail under SurrealDB 3.0 PERMISSIONS clauses.
--
-- RBAC: PERMISSIONS clauses use `$token.org_id` for API-key auth (where `$auth` is
-- unavailable); JWT-authenticated callers get the same field via identity-vessel's
-- token shape. See docs/RBAC_GUIDE.md §`$auth` vs `$token`.

-- =============================================================================
-- organizations
-- =============================================================================

DEFINE TABLE organizations SCHEMAFULL
  PERMISSIONS
    FOR select WHERE $token.org_id = string::concat("organizations:", meta::id(id)) OR $token.org_id = type::string(id)
    FOR create WHERE $token.role IN ["owner", "admin"] OR $token = NONE
    FOR update WHERE ($token.org_id = string::concat("organizations:", meta::id(id)) OR $token.org_id = type::string(id)) AND $token.role IN ["owner", "admin"]
    FOR delete WHERE ($token.org_id = string::concat("organizations:", meta::id(id)) OR $token.org_id = type::string(id)) AND $token.role = "owner";

DEFINE FIELD name ON organizations TYPE string
  ASSERT $value != NONE AND string::len($value) >= 1 AND string::len($value) <= 255;

DEFINE FIELD tier ON organizations TYPE string
  DEFAULT "free"
  ASSERT $value IN ["free", "starter", "pro", "enterprise"];

DEFINE FIELD seat_limit ON organizations TYPE int
  DEFAULT 1
  ASSERT $value >= -1;  -- -1 = unlimited

DEFINE FIELD created_at ON organizations TYPE datetime
  DEFAULT time::now() READONLY;

DEFINE FIELD updated_at ON organizations TYPE datetime
  VALUE time::now();

DEFINE INDEX idx_org_tier ON organizations FIELDS tier;

-- =============================================================================
-- users
-- =============================================================================
--
-- A thin user record. Authentication (password, MFA, OAuth) lives in identity-vessel.
-- This row exists so user-vessel can attach memberships and API keys to a stable id.

DEFINE TABLE users SCHEMAFULL
  PERMISSIONS
    -- A user can read their own record; org members can read other users in same org
    -- via the organization_members join (the route layer composes this).
    FOR select WHERE $token.user_id = type::string(id) OR $token.org_id = default_org_id
    FOR create WHERE $token != NONE
    FOR update WHERE $token.user_id = type::string(id)
    FOR delete WHERE $token.role = "owner";

DEFINE FIELD email ON users TYPE string
  ASSERT $value != NONE AND string::is::email($value);

DEFINE FIELD name ON users TYPE string
  ASSERT $value != NONE AND string::len($value) >= 1 AND string::len($value) <= 255;

DEFINE FIELD default_org_id ON users TYPE option<string>;

DEFINE FIELD created_at ON users TYPE datetime
  DEFAULT time::now() READONLY;

DEFINE INDEX idx_users_email ON users FIELDS email UNIQUE;

-- =============================================================================
-- organization_members
-- =============================================================================
--
-- Join table. `org_id` and `user_id` stored as record-reference-as-string per
-- the canonical pattern. PERMISSIONS scope to caller's org via $token.org_id.

DEFINE TABLE organization_members SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $token.org_id
    FOR create WHERE org_id = $token.org_id AND $token.role IN ["owner", "admin"]
    FOR update WHERE org_id = $token.org_id AND $token.role IN ["owner", "admin"]
    FOR delete WHERE org_id = $token.org_id AND $token.role IN ["owner", "admin"];

DEFINE FIELD org_id ON organization_members TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "organizations:");

DEFINE FIELD user_id ON organization_members TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "users:");

DEFINE FIELD role ON organization_members TYPE string
  DEFAULT "member"
  ASSERT $value IN ["owner", "admin", "member", "viewer"];

DEFINE FIELD joined_at ON organization_members TYPE datetime
  DEFAULT time::now() READONLY;

DEFINE INDEX idx_om_org_user ON organization_members FIELDS org_id, user_id UNIQUE;
DEFINE INDEX idx_om_user ON organization_members FIELDS user_id;

-- ============================================================================
-- api_key table — OWNED BY IDENTITY-VESSEL (per 2026-04-28 realignment)
-- ============================================================================
--
-- The api_key schema is defined by identity-vessel
-- (repos/identity-vessel/sql/migrations/00X-api-keys.surql).
-- user-vessel only contributes the `scopes` and `key_id` fields via
-- migration 004.
--
-- Identity-vessel issues keys (POST /v1/keys/issue); user-vessel assigns
-- scopes (POST /v2/api-keys/:keyId/scopes — see src/routes/api-keys.ts).
-- ============================================================================
