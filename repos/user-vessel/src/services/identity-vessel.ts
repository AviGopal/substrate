/**
 * Identity Vessel Client
 *
 * HTTP client for communicating with identity-vessel for API key operations.
 * identity-vessel is the single source of truth for:
 * - API key generation (HMAC-based)
 * - API key validation
 * - API key revocation
 */

import type { UserVesselConfig } from "../config"

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

export interface IdentityVesselClient {
  generateKey(request: GenerateKeyRequest): Promise<GenerateKeyResponse>
  validateKey(request: ValidateKeyRequest): Promise<ValidateKeyResponse>
  revokeKey(request: RevokeKeyRequest): Promise<RevokeKeyResponse>
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
    async generateKey(request: GenerateKeyRequest): Promise<GenerateKeyResponse> {
      return fetchJson<GenerateKeyResponse>("/v1/keys/generate", request)
    },

    async validateKey(request: ValidateKeyRequest): Promise<ValidateKeyResponse> {
      return fetchJson<ValidateKeyResponse>("/v1/keys/validate", request)
    },

    async revokeKey(request: RevokeKeyRequest): Promise<RevokeKeyResponse> {
      return fetchJson<RevokeKeyResponse>("/v1/keys/revoke", request)
    },
  }
}
