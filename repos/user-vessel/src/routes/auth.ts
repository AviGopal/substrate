/**
 * Authentication routes for user-vessel
 *
 * Handles JWT validation and user info retrieval.
 * Password authentication is handled by identity-vessel.
 */

import { Hono } from "hono"
import type {
  UserVesselConfig,
  User,
  Organization,
} from "../types"
import { requireAuth, getAuth } from "../middleware/auth"
import { getRootDb, getFirstRecord, getAllRecords } from "../db/surreal"

export function authRoutes(config: UserVesselConfig) {
  const app = new Hono()

  /**
   * GET /v2/auth/me
   * Get current authenticated user
   */
  app.get("/me", requireAuth(config), async (c) => {
    try {
      const auth = getAuth(c)
      const db = await getRootDb(config)

      // Get user details
      const userResult = await db.query(
        `SELECT id, org_id, email, name, role, created_at, last_login
         FROM users WHERE id = $userId LIMIT 1`,
        { userId: auth.id }
      )
      const user = getFirstRecord<User>(userResult)

      if (!user) {
        return c.json({ error: "User not found" }, 404)
      }

      // Get organization
      const orgResult = await db.query(
        `SELECT * FROM organizations WHERE id = $orgId LIMIT 1`,
        { orgId: user.org_id }
      )
      const org = getFirstRecord<Organization>(orgResult)

      // Get projects (optional - table may not exist yet)
      let projectIds: string[] = []
      try {
        const projectsResult = await db.query(
          `SELECT project_id FROM project_members WHERE user_id = $userId`,
          { userId: user.id }
        )
        const projects = getAllRecords<{ project_id: string }>(projectsResult)
        projectIds = projects.map((p) => p.project_id)
      } catch (error) {
        // Table doesn't exist yet - that's OK
      }

      return c.json({
        user,
        org,
        project_ids: projectIds,
      })
    } catch (error) {
      console.error("Get me error:", error)
      return c.json({ error: "Failed to get user info" }, 500)
    }
  })

  /**
   * POST /v2/auth/logout
   * Logout current user (client-side token invalidation)
   */
  app.post("/logout", requireAuth(config), async (c) => {
    // In JWT-based auth, logout is primarily client-side (delete token)
    // We could maintain a token blacklist here if needed
    return c.json({ message: "Logged out successfully" })
  })

  return app
}
