/**
 * Phase 1 type definitions for user-vessel.
 *
 * Auth (passwords, JWT, MFA) is owned by identity-vessel. This vessel only carries
 * the auth context that identity-vessel returns from /v1/auth/resolve.
 */

// =============================================================================
// CONFIG
// =============================================================================

export interface UserVesselConfig {
  port: number
  host: string
  surrealdb: {
    url: string
    namespace: string
    database: string
    username: string
    password: string
  }
  identityVessel: {
    endpoint: string
    apiKey?: string  // optional internal-call API key
  }
  discovery: {
    enabled: boolean
    endpoint: string
    vesselId: string
    heartbeatIntervalMs: number
    shapes: string[]
  }
}

// =============================================================================
// AUTH (returned by identity-vessel /v1/auth/resolve)
// =============================================================================

export type Role = "owner" | "admin" | "member" | "viewer"

/**
 * Project-level role hierarchy (Phase A).
 *
 * Used for intra-account project_members. Cross-account federation roles are
 * DEFERRED to Phase B (see openspec change `user-vessel-accounts-federation-model`).
 */
export type ProjectRole = "owner" | "maintain" | "developer" | "triage" | "viewer"

export interface AuthContext {
  /** Full record-reference-as-string, e.g. "users:abc123". */
  user_id: string
  /**
   * Full record-reference-as-string, e.g. "organizations:metabob".
   *
   * Phase A: still emitted for back-compat. Phase B (after identity-vessel
   * JWT migration `identity-vessel-account-id-upgrade`) it will be derived
   * from `account_id`.
   */
  org_id: string
  /**
   * Full record-reference-as-string, e.g. "accounts:metabob".
   *
   * Phase A: optional — populated when identity-vessel emits the claim.
   * Routes that need account scoping prefer this field; if absent, they
   * fall back to mapping `org_id` ("organizations:<x>" → "accounts:<x>").
   */
  account_id?: string
  role: Role
  /** Original Authorization header value, used to forward to other vessels. */
  authHeader: string
}

// =============================================================================
// DOMAIN
// =============================================================================

export interface Organization {
  id: string  // "organizations:slug"
  name: string
  tier: "free" | "starter" | "pro" | "enterprise"
  seat_limit: number
  created_at: string
  updated_at?: string
}

export interface User {
  id: string  // "users:abc"
  email: string
  name: string
  default_org_id?: string
  created_at: string
}

export interface OrganizationMember {
  id: string  // "organization_members:..."
  org_id: string
  user_id: string
  role: Role
  joined_at: string
}

export interface ApiKey {
  id: string  // "api_key:..."
  key_prefix: string
  key_hash: string
  name?: string
  org_id: string
  user_id: string
  tier: "starter" | "pro" | "enterprise"
  quota_limit: number
  connection_limit: number
  revoked_at?: string | null
  created_at: string
  /**
   * Scopes granted to this key. Defaults to ["read","write"] for legacy rows
   * via the schema option-default. Admin-scoped keys carry "admin" here so
   * identity-vessel's `lookupKeyScopes()` can return it through to
   * `resolveAPIKey()`.
   */
  scopes?: string[]
  /**
   * HMAC-embedded identifier (e.g. "key_avi_canary_admin01"). Optional so
   * legacy rows without it remain valid; populated on new rows for
   * identity-vessel HMAC lookup. UNIQUE index enforces 1:1 mapping.
   */
  key_id?: string
}

export interface ApiKeyView extends Omit<ApiKey, "key_hash"> {
  // Key hash is never returned over the wire.
}

// =============================================================================
// PHASE A: Accounts + Projects (federation foundation)
// =============================================================================
//
// Federation links, cross-account project access, and email invitations are
// DEFERRED to Phase B. See openspec change user-vessel-accounts-federation-model.

export interface Account {
  id: string  // "accounts:slug"
  name: string
  tier: "free" | "starter" | "pro" | "enterprise"
  seat_limit: number
  created_by?: string
  created_at: string
  updated_at?: string
}

export interface AccountMember {
  id: string  // "account_members:..."
  account_id: string  // "accounts:<id>"
  user_id: string  // "users:<id>"
  role: Role
  joined_at: string
}

export type ProjectVisibility = "private" | "account" | "public"

export interface Project {
  id: string  // "projects:..."
  account_id: string  // "accounts:<id>"
  name: string
  description?: string
  visibility: ProjectVisibility
  created_by?: string
  created_at: string
  updated_at?: string
}

export interface ProjectMember {
  id: string  // "project_members:..."
  project_id: string  // "projects:<id>"
  user_id: string  // "users:<id>"
  role: ProjectRole
  added_at: string
  /**
   * Phase B: set when the membership was created via an accepted federation
   * link (cross-account access). NULL/undefined for intra-account members.
   * Used by the revoke flow to cascade-delete cross-account memberships
   * when the link is torn down.
   */
  via_federation_link?: string  // "federation_links:<id>"
}

// =============================================================================
// PHASE B: Federation links + Invitations
// =============================================================================

export type FederationStatus = "pending" | "accepted" | "declined" | "revoked"

export interface FederationLink {
  id: string  // "federation_links:..."
  from_account_id: string  // "accounts:<id>"
  to_account_id: string  // "accounts:<id>"
  project_id: string  // "projects:<id>"
  from_role_offered: ProjectRole
  status: FederationStatus
  created_by: string  // "users:<id>"
  created_at: string
  accepted_at?: string
  declined_at?: string
  revoked_at?: string
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked"

export interface Invitation {
  id: string  // "invitations:..."
  email: string
  account_id: string  // "accounts:<id>"
  role: Role
  token: string
  status: InvitationStatus
  expires_at: string
  created_by: string
  created_at: string
  accepted_at?: string
  accepted_by_user_id?: string
}

// =============================================================================
// MCP TOOLS (Phase 1 surface)
// =============================================================================

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface McpToolCallRequest {
  name: string
  arguments: Record<string, unknown>
}

export interface McpToolCallResult {
  ok: boolean
  result?: unknown
  error?: string
}
