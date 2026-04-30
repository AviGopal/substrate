-- user-vessel Phase B — Federation links + Invitations + cross-account project access
--
-- Builds on Phase A (`002-accounts-and-projects.surql`). Adds:
--   federation_links — account A invites account B to a project
--   invitations      — emailed invitation to join an account
--   project_members.via_federation_link — audit field for cross-account membership
--
-- DEFERRED (NOT in this migration):
--   - Email delivery of invitations (Phase C; token returned in API response only)
--   - audit_log table + audit middleware
--   - Self-service leave / transfer-ownership
--   - public-visibility project enforcement
--
-- Multi-tenancy invariants (see CLAUDE.md):
--   - account_id stored as record-reference-as-string ("accounts:<id>")
--   - never typed as record<accounts> — breaks SurrealDB 3.0 PERMISSIONS
--   - PERMISSIONS use $token.account_id (with $token.org_id fallback during
--     identity-vessel JWT migration window)
--
-- Idempotent migration — same SELECT-then-CREATE pattern as 002. DEFINE
-- statements without OVERWRITE are no-ops on re-run.

-- =============================================================================
-- federation_links
-- =============================================================================
--
-- A federation_link is an offer from account A (`from_account_id`) to share
-- one of its projects (`project_id`) with account B (`to_account_id`). When
-- accepted, members of `to_account_id` gain the offered project role on
-- `project_id` via `project_members` rows tagged with `via_federation_link`.
--
-- A link's lifecycle:
--   pending   — created by from-account admin; awaiting to-account decision
--   accepted  — to-account admin accepted; project_members rows created
--   declined  — to-account admin declined; no project_members created
--   revoked   — either side revoked; project_members rows cascade-deleted
--
-- Both parties (from and to) can read the link; only their own admins can
-- act on it.

DEFINE TABLE federation_links SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      from_account_id = $token.account_id
      OR to_account_id = $token.account_id
      OR from_account_id = $token.org_id
      OR to_account_id = $token.org_id
    FOR create WHERE
      (from_account_id = $token.account_id OR from_account_id = $token.org_id)
      AND $token.role IN ["owner", "admin"]
    FOR update WHERE
      (from_account_id = $token.account_id
        OR to_account_id = $token.account_id
        OR from_account_id = $token.org_id
        OR to_account_id = $token.org_id)
      AND $token.role IN ["owner", "admin"]
    FOR delete WHERE
      (from_account_id = $token.account_id
        OR to_account_id = $token.account_id
        OR from_account_id = $token.org_id
        OR to_account_id = $token.org_id)
      AND $token.role IN ["owner", "admin"];

DEFINE FIELD from_account_id ON federation_links TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "accounts:");

DEFINE FIELD to_account_id ON federation_links TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "accounts:");

DEFINE FIELD project_id ON federation_links TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "projects:");

DEFINE FIELD from_role_offered ON federation_links TYPE string
  DEFAULT "developer"
  ASSERT $value IN ["owner", "maintain", "developer", "triage", "viewer"];

DEFINE FIELD status ON federation_links TYPE string
  DEFAULT "pending"
  ASSERT $value IN ["pending", "accepted", "declined", "revoked"];

DEFINE FIELD created_by ON federation_links TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "users:");

DEFINE FIELD created_at ON federation_links TYPE datetime
  DEFAULT time::now() READONLY;

DEFINE FIELD accepted_at ON federation_links TYPE option<datetime>;

DEFINE FIELD revoked_at ON federation_links TYPE option<datetime>;

DEFINE FIELD declined_at ON federation_links TYPE option<datetime>;

DEFINE INDEX idx_fl_from ON federation_links FIELDS from_account_id, status;
DEFINE INDEX idx_fl_to ON federation_links FIELDS to_account_id, status;
DEFINE INDEX idx_fl_project ON federation_links FIELDS project_id;

-- =============================================================================
-- invitations
-- =============================================================================
--
-- An invitation invites an email address to join an account at a given role.
-- Tokens are single-use and expire after 7 days by default. Acceptance creates
-- an `account_members` row.
--
-- Phase B: token returned in the create-invitation response so callers can
-- email it themselves. Server-side email delivery is DEFERRED to Phase C.

DEFINE TABLE invitations SCHEMAFULL
  PERMISSIONS
    -- Visible to admins of the inviting account; also queryable by token.
    -- Token-based acceptance bypasses PERMISSIONS by querying with root creds
    -- in the route layer (the token IS the bearer credential).
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

DEFINE FIELD email ON invitations TYPE string
  ASSERT $value != NONE AND string::len($value) >= 3 AND string::contains($value, "@");

DEFINE FIELD account_id ON invitations TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "accounts:");

DEFINE FIELD role ON invitations TYPE string
  DEFAULT "member"
  ASSERT $value IN ["owner", "admin", "member", "viewer"];

DEFINE FIELD token ON invitations TYPE string
  ASSERT $value != NONE AND string::len($value) >= 32;

DEFINE FIELD status ON invitations TYPE string
  DEFAULT "pending"
  ASSERT $value IN ["pending", "accepted", "expired", "revoked"];

DEFINE FIELD expires_at ON invitations TYPE datetime;

DEFINE FIELD created_by ON invitations TYPE string
  ASSERT $value != NONE AND string::starts_with($value, "users:");

DEFINE FIELD created_at ON invitations TYPE datetime
  DEFAULT time::now() READONLY;

DEFINE FIELD accepted_at ON invitations TYPE option<datetime>;

DEFINE FIELD accepted_by_user_id ON invitations TYPE option<string>
  ASSERT $value = NONE OR string::starts_with($value, "users:");

DEFINE INDEX idx_inv_account_status ON invitations FIELDS account_id, status;
DEFINE INDEX idx_inv_token ON invitations FIELDS token UNIQUE;
DEFINE INDEX idx_inv_email_status ON invitations FIELDS email, status;

-- =============================================================================
-- project_members extension — via_federation_link
-- =============================================================================
--
-- Phase A's project_members table is intra-account only (target user must be
-- an account_member of the project's owning account). Phase B extends it to
-- accept cross-account members granted via an accepted federation_link.
--
-- The new `via_federation_link` field is OPTIONAL:
--   - intra-account membership (Phase A) → field is NONE
--   - cross-account membership (Phase B) → field references federation_links
--
-- Cascade-delete on revoke is implemented in the route layer (revoke endpoint)
-- because SurrealDB 3.0 doesn't expose ON DELETE CASCADE on optional FK fields.
--
-- DEFINE FIELD without OVERWRITE is a no-op on re-run; backfill of legacy
-- rows is implicit (option<string> defaults to NONE).

DEFINE FIELD via_federation_link ON project_members TYPE option<string>
  ASSERT $value = NONE OR string::starts_with($value, "federation_links:");

DEFINE INDEX idx_pm_via_fed ON project_members FIELDS via_federation_link;
