/**
 * Authentication Service
 *
 * Validates both JWT tokens and API keys.
 * - JWT tokens are validated locally using the configured secret
 * - API keys are validated by calling identity-vessel
 */

import { jwtVerify, createSecretKey } from "jose"
import type { AuthContext, JWTPayload, UserVesselConfig } from "../types"
import { createIdentityVesselClient } from "./identity-vessel"

export interface AuthResult {
  success: boolean
  auth?: AuthContext
  error?: string
}

/**
 * Authenticate a request using the Authorization header
 * Supports:
 * - Bearer <jwt> - JWT session token
 * - ApiKey <key> - HMAC API key from identity-vessel
 */
export async function authenticate(
  authHeader: string,
  config: UserVesselConfig
): Promise<AuthResult> {
  // Parse authorization header
  const [scheme, credential] = authHeader.split(" ")

  if (!credential) {
    return { success: false, error: "Invalid authorization header format" }
  }

  const schemeUpper = scheme.toUpperCase()

  // Route to appropriate handler
  if (schemeUpper === "BEARER") {
    return authenticateJWT(credential, config)
  } else if (schemeUpper === "APIKEY") {
    return authenticateApiKey(credential, config)
  } else {
    return { success: false, error: `Unsupported auth scheme: ${scheme}` }
  }
}

/**
 * Authenticate using JWT token
 */
async function authenticateJWT(
  token: string,
  config: UserVesselConfig
): Promise<AuthResult> {
  try {
    // Create secret key from config
    const secretKey = new TextEncoder().encode(config.jwt.secret)

    // Verify and decode JWT using jose
    const { payload } = await jwtVerify(token, secretKey)
    const jwtPayload = payload as unknown as JWTPayload

    // Build auth context
    const auth: AuthContext = {
      id: jwtPayload.user_id || jwtPayload.sub,
      org_id: jwtPayload.org_id,
      role: jwtPayload.role || "member",
      project_ids: jwtPayload.project_ids || [],
    }

    return { success: true, auth }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "JWT verification failed"
    return { success: false, error: message }
  }
}

/**
 * Authenticate using API key via identity-vessel
 */
async function authenticateApiKey(
  apiKey: string,
  config: UserVesselConfig
): Promise<AuthResult> {
  try {
    // Ensure identity-vessel endpoint is configured
    if (!config.identityVessel?.endpoint) {
      return { success: false, error: "Identity vessel endpoint not configured" }
    }

    // Call identity-vessel to validate the key
    const identityClient = createIdentityVesselClient(config)
    const result = await identityClient.validateKey({ api_key: apiKey })

    if (!result.valid) {
      return { success: false, error: result.error || "Invalid API key" }
    }

    // Build auth context from validation result
    const auth: AuthContext = {
      id: result.user_id || "api-key-user",
      org_id: result.org_id || "",
      role: (result.role as "admin" | "member") || "member",
      project_ids: [], // API keys don't have project-specific access by default
    }

    return { success: true, auth }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "API key validation failed"
    return { success: false, error: message }
  }
}
