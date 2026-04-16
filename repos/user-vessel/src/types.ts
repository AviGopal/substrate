/**
 * Type definitions for user-vessel
 * User, Organization, Project, API Key types with RBAC support
 */

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
  jwt: {
    secret: string
    expiresIn: string  // e.g., "15m"
  }
  activityApi: {
    endpoint: string
  }
  identityVessel?: {
    endpoint: string
  }
  discovery?: {
    enabled: boolean
    endpoint: string
    vesselId: string
    heartbeatIntervalMs: number
    shapes: string[]
  }
}

// =============================================================================
// DOMAIN TYPES
// =============================================================================

export interface Organization {
  id: string
  org_id: string
  name: string
  subscription_tier: 'free' | 'starter' | 'pro' | 'enterprise'
  seat_limit: number
  seat_usage: number
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  org_id: string
  email: string
  name: string
  password_hash?: string  // Only populated internally, never returned to clients
  role: 'admin' | 'member'
  created_at: string
  last_login?: string
}

export interface Project {
  id: string
  org_id: string
  name: string
  repo_url?: string
  created_at: string
  metadata?: Record<string, unknown>
}

export interface ProjectMember {
  id: string
  org_id: string
  project_id: string
  user_id: string
  role: 'owner' | 'maintainer' | 'developer' | 'viewer'
  added_at: string
}

export interface LlmBudget {
  tokens_per_month: number
  tokens_used: number
  reset_at: string  // ISO datetime string for next reset
  overage_enabled: boolean
}

export interface ApiKey {
  id: string
  org_id: string
  user_id: string
  key_id: string  // Identity-vessel key identifier (replaces key_hash)
  scopes: string[]
  is_active: boolean
  created_at: string
  last_used_at?: string
  expires_at?: string
  tier: 'starter' | 'pro' | 'enterprise'  // Billing tier (inherited from org)
  max_connections: number  // Connection slot limit for this API key
  llm_budget: LlmBudget  // Token budget for LLM usage
  rotation_required?: boolean  // For legacy key migration
}

// =============================================================================
// AUTH TYPES
// =============================================================================

export interface JWTPayload {
  iss: string
  sub: string  // user ID
  org_id: string
  project_ids: string[]
  role: 'admin' | 'member'
  user_id: string
  exp: number
  iat: number
}

export interface AuthContext {
  id: string  // user ID
  org_id: string
  role: 'admin' | 'member'
  project_ids: string[]
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

export interface LoginRequest {
  email: string
  password: string
  org_id?: string  // Optional, can be derived from email domain or required
}

export interface LoginResponse {
  token: string
  user: Omit<User, 'password_hash'>
  org: Organization
}

export interface SignupRequest {
  email: string
  password: string
  name: string
  org_name?: string  // If creating new org
  org_id?: string  // If joining existing org
}

export interface CreateUserRequest {
  email: string
  password: string
  name: string
  role?: 'admin' | 'member'
}

export interface CreateOrganizationRequest {
  name: string
  subscription_tier?: 'free' | 'starter' | 'pro' | 'enterprise'
}

export interface CreateProjectRequest {
  name: string
  repo_url?: string
  metadata?: Record<string, unknown>
}

export interface CreateApiKeyRequest {
  name?: string
  scopes?: string[]
  expires_in_days?: number
}

/**
 * API key display format for dashboard responses
 * Contains a subset of ApiKey fields plus additional display fields
 */
export interface ApiKeyDisplayResponse {
  id: string
  user_id: string
  user_email: string
  prefix: string
  name?: string
  created_at: string
  last_used_at?: string
  usage_count: number
  status: 'active' | 'revoked' | 'rotation_required'
  tier: 'starter' | 'pro' | 'enterprise'
  max_connections: number
  llm_budget: LlmBudget | null
}

export interface CreateApiKeyResponse {
  key: ApiKeyDisplayResponse  // Transformed API key for dashboard display
  secret: string  // Raw key, only returned once on creation
}

// =============================================================================
// VESSEL MANIFEST
// =============================================================================

export interface VesselManifest {
  id: string
  name: string
  version: string
  capabilities: string[]
  impulseTypes: string[]
  activities: string[]
}
