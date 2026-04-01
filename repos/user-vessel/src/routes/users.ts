/**
 * User management routes
 */

import { Hono } from "hono"
import type { UserVesselConfig, User, CreateUserRequest } from "../types"
import { requireAuth, getAuth, requireAdmin } from "../middleware/auth"
import { hashPassword, validatePassword } from "../utils/crypto"
import { getRootDb, getFirstRecord, getAllRecords } from "../db/surreal"

export function userRoutes(config: UserVesselConfig) {
  const app = new Hono()

  // All routes require authentication
  app.use("/*", requireAuth(config))

  /**
   * GET /v2/users
   * List users in organization (filtered by $auth.org_id via PERMISSIONS)
   */
  app.get("/", async (c) => {
    try {
      const auth = getAuth(c)
      const db = await getRootDb(config)

      const result = await db.query(
        `SELECT id, org_id, email, name, role, created_at, last_login
         FROM users
         WHERE org_id = $orgId
         ORDER BY created_at DESC`,
        { orgId: auth.org_id }
      )

      const users = getAllRecords<User>(result)
      return c.json({ users })
    } catch (error) {
      console.error("List users error:", error)
      return c.json({ error: "Failed to list users" }, 500)
    }
  })

  /**
   * GET /v2/users/:id
   * Get user details
   */
  app.get("/:id", async (c) => {
    try {
      const auth = getAuth(c)
      const userId = c.req.param("id")
      const db = await getRootDb(config)

      const result = await db.query(
        `SELECT id, org_id, email, name, role, created_at, last_login
         FROM users
         WHERE id = $userId AND org_id = $orgId
         LIMIT 1`,
        { userId, orgId: auth.org_id }
      )

      const user = getFirstRecord<User>(result)
      if (!user) {
        return c.json({ error: "User not found" }, 404)
      }

      return c.json(user)
    } catch (error) {
      console.error("Get user error:", error)
      return c.json({ error: "Failed to get user" }, 500)
    }
  })

  /**
   * POST /v2/users
   * Create new user (admin only)
   */
  app.post("/", requireAdmin(), async (c) => {
    try {
      const auth = getAuth(c)
      const body = await c.req.json<CreateUserRequest>()
      const { email, password, name, role = "member" } = body

      if (!email || !password || !name) {
        return c.json({ error: "Email, password, and name required" }, 400)
      }

      // Validate password
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        return c.json({ error: passwordValidation.errors.join(", ") }, 400)
      }

      // Hash password
      const password_hash = await hashPassword(password)

      const db = await getRootDb(config)

      // Check if email already exists in org
      const existingResult = await db.query(
        `SELECT id FROM users WHERE email = $email AND org_id = $orgId LIMIT 1`,
        { email, orgId: auth.org_id }
      )
      const existing = getFirstRecord(existingResult)
      if (existing) {
        return c.json({ error: "Email already exists in organization" }, 409)
      }

      // Create user
      const createResult = await db.query(
        `CREATE users SET
          org_id = $orgId,
          email = $email,
          name = $name,
          password_hash = $passwordHash,
          role = $role,
          created_at = time::now()`,
        {
          orgId: auth.org_id,
          email,
          name,
          passwordHash: password_hash,
          role,
        }
      )

      const user = getFirstRecord<User>(createResult)
      if (!user) {
        return c.json({ error: "Failed to create user" }, 500)
      }

      return c.json(user, 201)
    } catch (error) {
      console.error("Create user error:", error)
      return c.json({ error: "Failed to create user" }, 500)
    }
  })

  /**
   * PATCH /v2/users/:id
   * Update user (admin only, or user updating themselves)
   */
  app.patch("/:id", async (c) => {
    try {
      const auth = getAuth(c)
      const userId = c.req.param("id")
      const body = await c.req.json<Partial<User>>()

      // Only admin can update other users
      if (userId !== auth.id && auth.role !== "admin") {
        return c.json({ error: "Forbidden" }, 403)
      }

      // Build update fields
      const allowedFields = ["name", "role"]
      const updates: Record<string, any> = {}

      for (const field of allowedFields) {
        if (body[field as keyof User] !== undefined) {
          // Only admin can change role
          if (field === "role" && auth.role !== "admin") {
            continue
          }
          updates[field] = body[field as keyof User]
        }
      }

      if (Object.keys(updates).length === 0) {
        return c.json({ error: "No valid fields to update" }, 400)
      }

      const db = await getRootDb(config)

      // Build SET clause
      const setClause = Object.keys(updates)
        .map((key) => `${key} = $${key}`)
        .join(", ")

      const result = await db.query(
        `UPDATE $userId SET ${setClause} WHERE org_id = $orgId RETURN AFTER`,
        { userId, orgId: auth.org_id, ...updates }
      )

      const user = getFirstRecord<User>(result)
      if (!user) {
        return c.json({ error: "User not found" }, 404)
      }

      return c.json(user)
    } catch (error) {
      console.error("Update user error:", error)
      return c.json({ error: "Failed to update user" }, 500)
    }
  })

  /**
   * DELETE /v2/users/:id
   * Delete user (admin only)
   */
  app.delete("/:id", requireAdmin(), async (c) => {
    try {
      const auth = getAuth(c)
      const userId = c.req.param("id")

      // Prevent deleting yourself
      if (userId === auth.id) {
        return c.json({ error: "Cannot delete your own account" }, 400)
      }

      const db = await getRootDb(config)

      await db.query(
        `DELETE $userId WHERE org_id = $orgId`,
        { userId, orgId: auth.org_id }
      )

      return c.json({ message: "User deleted successfully" })
    } catch (error) {
      console.error("Delete user error:", error)
      return c.json({ error: "Failed to delete user" }, 500)
    }
  })

  return app
}
