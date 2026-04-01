/**
 * Authentication middleware for user-vessel
 *
 * Validates JWT tokens and populates request context with auth info
 */

import type { Context, Next } from "hono"
import type { AuthContext, UserVesselConfig } from "../types"
import { verifyToken, extractAuthContext } from "../utils/jwt"

/**
 * Middleware to require authentication
 *
 * Checks Authorization header for Bearer token and validates it
 */
export function requireAuth(config: UserVesselConfig) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized - No token provided" }, 401)
    }

    const token = authHeader.substring(7) // Remove "Bearer " prefix

    // Verify JWT token
    const payload = await verifyToken(token, config.jwt.secret)
    if (!payload) {
      return c.json({ error: "Unauthorized - Invalid or expired token" }, 401)
    }

    // Extract auth context and store in request
    const authContext = extractAuthContext(payload)
    c.set("auth", authContext)
    c.set("token", token)

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
 * Get JWT token from request
 */
export function getToken(c: Context): string {
  const token = c.get("token") as string
  if (!token) {
    throw new Error("Token not available - did you use requireAuth middleware?")
  }
  return token
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
