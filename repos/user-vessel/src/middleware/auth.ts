/**
 * Authentication middleware for user-vessel
 *
 * Validates JWT tokens and API keys, populates request context with auth info
 */

import type { Context, Next } from "hono"
import type { AuthContext, UserVesselConfig } from "../types"
import { authenticate } from "../services/auth"

/**
 * Middleware to require authentication
 *
 * Supports two authentication methods:
 * - Bearer <jwt> - JWT session token
 * - ApiKey <key> - API key from identity-vessel
 */
export function requireAuth(config: UserVesselConfig) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization")

    if (!authHeader) {
      return c.json({ error: "Unauthorized - No authorization header" }, 401)
    }

    // Delegate to authentication service
    const result = await authenticate(authHeader, config)

    if (!result.success || !result.auth) {
      return c.json({ error: result.error || "Unauthorized" }, 401)
    }

    // Store auth context in request
    c.set("auth", result.auth)

    await next()
  }
}

/**
 * Get auth context from request
 */
export function getAuth(c: Context): AuthContext {
  const auth = c.get("auth") as AuthContext
  if (!auth) {
    throw new Error("Auth context not available - did you use requireAuth middleware?")
  }
  return auth
}

/**
 * Get JWT token from request (if authenticated via JWT)
 */
export function getToken(c: Context): string | undefined {
  const authHeader = c.req.header("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return undefined
  }
  return authHeader.substring(7)
}

/**
 * Check if authenticated user has admin role
 */
export function requireAdmin() {
  return async (c: Context, next: Next) => {
    const auth = getAuth(c)

    if (auth.role !== "admin") {
      return c.json({ error: "Forbidden - Admin access required" }, 403)
    }

    await next()
  }
}

/**
 * Check if authenticated user has access to specific project
 */
export function requireProjectAccess(projectIdParam: string = "id") {
  return async (c: Context, next: Next) => {
    const auth = getAuth(c)
    const projectId = c.req.param(projectIdParam)

    // Admin has access to all projects in their org
    if (auth.role === "admin") {
      await next()
      return
    }

    // Regular members need explicit project access
    if (!auth.project_ids.includes(projectId)) {
      return c.json({ error: "Forbidden - No access to this project" }, 403)
    }

    await next()
  }
}
