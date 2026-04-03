/**
 * JWT token generation and validation utilities
 */

import type { JWTPayload, AuthContext } from "../types"

/**
 * Generate JWT token for user
 */
export async function generateToken(
  userId: string,
  orgId: string,
  role: 'admin' | 'member',
  projectIds: string[],
  secret: string,
  expiresIn: string = "15m"
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // Parse expiresIn (supports "15m", "1h", "7d" format)
  const expirySeconds = parseExpiry(expiresIn)

  const payload: JWTPayload = {
    iss: "https://metabob.com",
    sub: userId,
    org_id: orgId,
    project_ids: projectIds,
    role,
    user_id: userId,
    exp: now + expirySeconds,
    iat: now,
  }

  // Use Bun's built-in JWT signing
  const jwt = await signJWT(payload, secret)
  return jwt
}

/**
 * Create JWT token from auth context
 */
export async function createToken(
  auth: AuthContext,
  secret: string,
  expiresIn: string = "15m"
): Promise<string> {
  return generateToken(
    auth.id,
    auth.org_id,
    auth.role,
    auth.project_ids,
    secret,
    expiresIn
  )
}

/**
 * Verify and decode JWT token
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const payload = await verifyJWT(token, secret)

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      return null
    }

    return payload as JWTPayload
  } catch {
    return null
  }
}

/**
 * Extract auth context from JWT payload
 */
export function extractAuthContext(payload: JWTPayload): AuthContext {
  return {
    id: payload.user_id,
    org_id: payload.org_id,
    role: payload.role,
    project_ids: payload.project_ids,
  }
}

// =============================================================================
// JWT SIGNING/VERIFICATION (Bun-compatible)
// =============================================================================

/**
 * Sign JWT using HMAC SHA-256
 */
async function signJWT(payload: JWTPayload, secret: string): Promise<string> {
  // Encode header
  const header = {
    alg: "HS256",
    typ: "JWT",
  }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))

  // Encode payload
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))

  // Create signature
  const message = `${encodedHeader}.${encodedPayload}`
  const signature = await hmacSHA256(message, secret)
  const encodedSignature = base64UrlEncode(signature)

  return `${message}.${encodedSignature}`
}

/**
 * Verify JWT signature and decode payload
 */
async function verifyJWT(token: string, secret: string): Promise<any> {
  const parts = token.split(".")
  if (parts.length !== 3) {
    throw new Error("Invalid token format")
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts

  // Verify signature
  const message = `${encodedHeader}.${encodedPayload}`
  const expectedSignature = await hmacSHA256(message, secret)
  const expectedEncoded = base64UrlEncode(expectedSignature)

  if (encodedSignature !== expectedEncoded) {
    throw new Error("Invalid signature")
  }

  // Decode payload
  const payload = JSON.parse(base64UrlDecode(encodedPayload))
  return payload
}

/**
 * HMAC SHA-256 signature
 */
async function hmacSHA256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  )

  return arrayBufferToBase64(signature)
}

/**
 * Base64 URL-safe encoding
 */
function base64UrlEncode(data: string): string {
  const base64 = btoa(data)
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

/**
 * Base64 URL-safe decoding
 */
function base64UrlDecode(encoded: string): string {
  // Add padding
  let padded = encoded
  while (padded.length % 4 !== 0) {
    padded += "="
  }

  // Replace URL-safe chars
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/")
  return atob(base64)
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
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
