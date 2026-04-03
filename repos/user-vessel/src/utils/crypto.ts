/**
 * Cryptographic utilities for password hashing
 */

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
