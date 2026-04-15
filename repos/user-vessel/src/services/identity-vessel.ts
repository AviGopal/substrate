/**
 * Identity Vessel Client
 *
 * HTTP client for communicating with identity-vessel for authentication operations.
 * identity-vessel is the single source of truth for:
 * - JWT token generation and verification (hono/jwt, HS256)
 * - Password hashing and verification (Argon2id via Bun)
 * - API key generation (HMAC-based)
 * - API key validation
 * - API key revocation
 */

import type { UserVesselConfig } from "../types"

export interface GenerateKeyRequest {
  org_id: string
  user_id: string
  name?: string
  scopes?: string[]
  expires_in_days?: number
}

export interface GenerateKeyResponse {
  key: string        // Base64-encoded HMAC key (only shown once!)
  key_id: string     // Unique key identifier
  prefix: string     // mb_live or mb_test
  expires_at?: string
  metadata: {
    org_id: string
    user_id: string
    key_id: string
    prefix: string
    name?: string
    scopes?: string[]
    created_at: string
    expires_at?: string
  }
}

export interface ValidateKeyRequest {
  api_key: string
}

export interface ValidateKeyResponse {
  valid: boolean
  org_id?: string
  user_id?: string
  key_id?: string
  scopes?: string[]
  role?: string
  error?: string
}

export interface RevokeKeyRequest {
  key_id?: string
  api_key?: string
}

export interface RevokeKeyResponse {
  revoked: boolean
  key_id: string
}

// =============================================================================
// JWT Operations
// =============================================================================

export interface GenerateJWTRequest {
  user_id: string
  org_id: string
  role: 'admin' | 'member' | 'viewer'
  project_ids?: string[]
  expires_in_seconds?: number
}

export interface GenerateJWTResponse {
  token: string
  expires_at: string
  issued_at: string
}

export interface VerifyJWTRequest {
  token: string
}

export interface VerifyJWTResponse {
  valid: boolean
  user_id?: string
  org_id?: string
  role?: string
  project_ids?: string[]
  exp?: number
  iat?: number
  error?: string
}

// =============================================================================
// Password Operations
// =============================================================================

export interface HashPasswordRequest {
  password: string
}

export interface HashPasswordResponse {
  hash: string
}

export interface VerifyPasswordRequest {
  password: string
  hash: string
}

export interface VerifyPasswordResponse {
  valid: boolean
}

export interface ValidatePasswordRequest {
  password: string
}

export interface ValidatePasswordResponse {
  valid: boolean
  errors: string[]
  score: number
}

// =============================================================================
// Client Interface
// =============================================================================

export interface IdentityVesselClient {
  // API Key operations
  generateKey(request: GenerateKeyRequest): Promise<GenerateKeyResponse>
  validateKey(request: ValidateKeyRequest): Promise<ValidateKeyResponse>
  revokeKey(request: RevokeKeyRequest): Promise<RevokeKeyResponse>

  // JWT operations
  generateJWT(request: GenerateJWTRequest): Promise<GenerateJWTResponse>
  verifyJWT(request: VerifyJWTRequest): Promise<VerifyJWTResponse>

  // Password operations
  hashPassword(request: HashPasswordRequest): Promise<HashPasswordResponse>
  verifyPassword(request: VerifyPasswordRequest): Promise<VerifyPasswordResponse>
  validatePassword(request: ValidatePasswordRequest): Promise<ValidatePasswordResponse>
}

/**
 * Create a client for identity-vessel API
 */
export function createIdentityVesselClient(config: UserVesselConfig): IdentityVesselClient {
  const baseUrl = config.identityVessel.endpoint

  async function fetchJson<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const result = await response.json() as { success: boolean; data?: T; error?: { message: string } }

    if (!result.success) {
      throw new Error(result.error?.message || "Identity vessel request failed")
    }

    return result.data as T
  }

  return {
    // API Key operations
    async generateKey(request: GenerateKeyRequest): Promise<GenerateKeyResponse> {
      return fetchJson<GenerateKeyResponse>("/v1/keys/generate", request)
    },

    async validateKey(request: ValidateKeyRequest): Promise<ValidateKeyResponse> {
      return fetchJson<ValidateKeyResponse>("/v1/keys/validate", request)
    },

    async revokeKey(request: RevokeKeyRequest): Promise<RevokeKeyResponse> {
      return fetchJson<RevokeKeyResponse>("/v1/keys/revoke", request)
    },

    // JWT operations
    async generateJWT(request: GenerateJWTRequest): Promise<GenerateJWTResponse> {
      return fetchJson<GenerateJWTResponse>("/v1/jwt/generate", request)
    },

    async verifyJWT(request: VerifyJWTRequest): Promise<VerifyJWTResponse> {
      return fetchJson<VerifyJWTResponse>("/v1/jwt/verify", request)
    },

    // Password operations
    async hashPassword(request: HashPasswordRequest): Promise<HashPasswordResponse> {
      return fetchJson<HashPasswordResponse>("/v1/auth/password/hash", request)
    },

    async verifyPassword(request: VerifyPasswordRequest): Promise<VerifyPasswordResponse> {
      return fetchJson<VerifyPasswordResponse>("/v1/auth/password/verify", request)
    },

    async validatePassword(request: ValidatePasswordRequest): Promise<ValidatePasswordResponse> {
      return fetchJson<ValidatePasswordResponse>("/v1/auth/password/validate", request)
    },
  }
}
