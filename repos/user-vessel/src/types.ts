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

export interface ApiKey {
  id: string
  org_id: string
  user_id: string
  key_hash: string  // Argon2 hash, never expose raw key after creation
  scopes: string[]
  is_active: boolean
  created_at: string
  last_used_at?: string
  expires_at?: string
  max_connections?: number  // Connection slot limit for this API key
}

export interface ActiveConnection {
  id: string
  api_key_id: string
  instance_id: string
  instance_type: 'minibob' | 'ide' | 'cli' | 'other'
  org_id: string
  user_id: string
  connected_at: string
  last_heartbeat_at: string
  disconnected_at?: string
  client_metadata?: Record<string, unknown>
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

export interface CreateApiKeyResponse {
  key: ApiKey  // Full API key record
  secret: string  // Raw key, only returned once on creation
}

export interface ClaimConnectionRequest {
  api_key: string
  instance_id: string
  instance_type: 'minibob' | 'ide' | 'cli' | 'other'
  client_metadata?: Record<string, unknown>
}

export interface ClaimConnectionResponse {
  connection_id: string
  api_key_id: string
  instance_id: string
  connected_at: string
  heartbeat_interval_ms: number
}

export interface ReleaseConnectionRequest {
  instance_id: string
}

export interface HeartbeatRequest {
  instance_id: string
  client_metadata?: Record<string, unknown>
}

export interface HeartbeatResponse {
  connection_id: string
  last_heartbeat_at: string
  expires_in_ms: number
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
