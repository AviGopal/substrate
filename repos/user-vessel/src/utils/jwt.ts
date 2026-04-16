/**
 * JWT token generation and validation utilities
 *
 * ALL JWT operations are delegated to identity-vessel,
 * which is the single source of truth for authentication.
 *
 * This module provides convenience wrappers that call identity-vessel.
 */

import type { AuthContext, UserVesselConfig } from "../types"
import { createIdentityVesselClient } from "../services/identity-vessel"

/**
 * Generate JWT token for user via identity-vessel
 */
export async function generateToken(
  userId: string,
  orgId: string,
  role: 'admin' | 'member' | 'viewer',
  projectIds: string[],
  config: UserVesselConfig,
  expiresIn: string = "15m"
): Promise<string> {
  // Ensure identity-vessel endpoint is configured
  if (!config.identityVessel?.endpoint) {
    throw new Error("Identity vessel endpoint not configured")
  }

  // Parse expiresIn to seconds
  const expiresInSeconds = parseExpiry(expiresIn)

  // Delegate to identity-vessel
  const identityClient = createIdentityVesselClient(config)
  const result = await identityClient.generateJWT({
    user_id: userId,
    org_id: orgId,
    role,
    project_ids: projectIds,
    expires_in_seconds: expiresInSeconds,
  })

  return result.token
}

/**
 * Create JWT token from auth context via identity-vessel
 */
export async function createToken(
  auth: AuthContext,
  config: UserVesselConfig,
  expiresIn: string = "15m"
): Promise<string> {
  return generateToken(
    auth.id,
    auth.org_id,
    auth.role as 'admin' | 'member' | 'viewer',
    auth.project_ids,
    config,
    expiresIn
  )
}

/**
 * Verify and decode JWT token via identity-vessel
 */
export async function verifyToken(
  token: string,
  config: UserVesselConfig
): Promise<{
  valid: boolean
  user_id?: string
  org_id?: string
  role?: string
  project_ids?: string[]
  exp?: number
  iat?: number
  error?: string
} | null> {
  try {
    // Ensure identity-vessel endpoint is configured
    if (!config.identityVessel?.endpoint) {
      return null
    }

    const identityClient = createIdentityVesselClient(config)
    const result = await identityClient.verifyJWT({ token })

    if (!result.valid) {
      return null
    }

    return result
  } catch {
    return null
  }
}

/**
 * Extract auth context from JWT verification result
 */
export function extractAuthContext(result: {
  user_id?: string
  org_id?: string
  role?: string
  project_ids?: string[]
}): AuthContext {
  return {
    id: result.user_id || "",
    org_id: result.org_id || "",
    role: (result.role as "admin" | "member") || "member",
    project_ids: result.project_ids || [],
  }
}

/**
 * Parse expiry duration string (e.g., "15m", "1h", "7d") to seconds
 */
function parseExpiry(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/)
  if (!match) {
    throw new Error(`Invalid expiry format: ${duration}`)
  }

  const value = parseInt(match[1])
  const unit = match[2]

  switch (unit) {
    case "s":
      return value
    case "m":
      return value * 60
    case "h":
      return value * 60 * 60
    case "d":
      return value * 60 * 60 * 24
    default:
      throw new Error(`Invalid expiry unit: ${unit}`)
  }
}
