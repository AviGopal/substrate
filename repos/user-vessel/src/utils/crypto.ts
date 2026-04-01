/**
 * Cryptographic utilities for password hashing and API key generation
 */

import { customAlphabet } from "nanoid"

// =============================================================================
// PASSWORD HASHING
// =============================================================================

/**
 * Hash password using Argon2
 */
export async function hashPassword(password: string): Promise<string> {
  // Use Bun's built-in Bun.password.hash (argon2id)
  return await Bun.password.hash(password, {
    algorithm: "argon2id",
    memoryCost: 65536,  // 64 MB
    timeCost: 3,
  })
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await Bun.password.verify(password, hash)
}

// =============================================================================
// API KEY GENERATION
// =============================================================================

/**
 * Generate API key with format: mb_<env>_<random>
 *
 * Example: mb_live_3kTp9vQ2hNx8rBm5wDc4
 */
export function generateApiKey(env: "live" | "test" = "live"): string {
  // Use alphanumeric alphabet (no ambiguous chars)
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz"
  const nanoid = customAlphabet(alphabet, 24)

  return `mb_${env}_${nanoid()}`
}

/**
 * Hash API key for storage (Argon2)
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  return await Bun.password.hash(apiKey, {
    algorithm: "argon2id",
    memoryCost: 65536,
    timeCost: 3,
  })
}

/**
 * Verify API key against hash
 */
export async function verifyApiKey(
  apiKey: string,
  hash: string
): Promise<boolean> {
  return await Bun.password.verify(apiKey, hash)
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate password meets security requirements
 */
export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters")
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
