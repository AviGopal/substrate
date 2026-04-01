/**
 * Authentication routes for user-vessel
 *
 * Handles login, signup, logout, and token refresh
 */

import { Hono } from "hono"
import type {
  UserVesselConfig,
  LoginRequest,
  LoginResponse,
  SignupRequest,
  User,
  Organization,
} from "../types"
import { requireAuth, getAuth, getToken } from "../middleware/auth"
import { generateToken } from "../utils/jwt"
import { hashPassword, validatePassword } from "../utils/crypto"
import { getRootDb, getFirstRecord, getAllRecords } from "../db/surreal"

export function authRoutes(config: UserVesselConfig) {
  const app = new Hono()

  /**
   * POST /v2/auth/login
   * Email/password authentication
   */
  app.post("/login", async (c) => {
    try {
      const body = await c.req.json<LoginRequest>()
      const { email, password, org_id } = body

      if (!email || !password) {
        return c.json({ error: "Email and password required" }, 400)
      }

      // Get database connection
      const db = await getRootDb(config)

      // Find user by email (and org_id if provided)
      const userQuery = org_id
        ? `SELECT * FROM users WHERE email = $email AND org_id = $org_id LIMIT 1`
        : `SELECT * FROM users WHERE email = $email LIMIT 1`

      const userResult = await db.query(userQuery, { email, org_id })
      console.log("Login: userResult =", JSON.stringify(userResult, null, 2))
      const user = getFirstRecord<User & { password_hash: string }>(userResult)
      console.log("Login: user =", user ? "Found" : "Not found")

      if (!user || !user.password_hash) {
        console.log("Login: User or password_hash not found")
        return c.json({ error: "Invalid credentials" }, 401)
      }

      // Verify password using Bun's password verification
      console.log("Login: Verifying password for user", user.email)
      const isValid = await Bun.password.verify(password, user.password_hash)
      console.log("Login: Password verification result:", isValid)
      if (!isValid) {
        console.log("Login: Password verification failed")
        return c.json({ error: "Invalid credentials" }, 401)
      }

      // Get user's projects (optional - table may not exist yet)
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
        console.log("Note: project_members table not found, using empty project list")
      }

      // Get organization
      const orgResult = await db.query(
        `SELECT * FROM organizations WHERE id = $orgId LIMIT 1`,
        { orgId: user.org_id }
      )
      const org = getFirstRecord<Organization>(orgResult)

      if (!org) {
        return c.json({ error: "Organization not found" }, 500)
      }

      // Update last login
      await db.query(
        `UPDATE $userId SET last_login = time::now()`,
        { userId: user.id }
      )

      // Generate JWT token
      const token = await generateToken(
        user.id,
        user.org_id,
        user.role,
        projectIds,
        config.jwt.secret,
        config.jwt.expiresIn
      )

      // Return response without password_hash
      const { password_hash, ...userWithoutPassword } = user

      const response: LoginResponse = {
        token,
        user: userWithoutPassword,
        org,
      }

      return c.json(response)
    } catch (error) {
      console.error("Login error:", error)
      return c.json({ error: "Login failed" }, 500)
    }
  })

  /**
   * POST /v2/auth/signup
   * Create new user account
   */
  app.post("/signup", async (c) => {
    try {
      const body = await c.req.json<SignupRequest>()
      const { email, password, name, org_name, org_id } = body

      if (!email || !password || !name) {
        return c.json({ error: "Email, password, and name required" }, 400)
      }

      // Validate password strength
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        return c.json({ error: passwordValidation.errors.join(", ") }, 400)
      }

      // Hash password
      const password_hash = await hashPassword(password)

      const db = await getRootDb(config)

      // Check if email already exists
      const existingResult = await db.query(
        `SELECT id FROM users WHERE email = $email LIMIT 1`,
        { email }
      )
      const existing = getFirstRecord(existingResult)
      if (existing) {
        return c.json({ error: "Email already registered" }, 409)
      }

      let targetOrgId = org_id

      // If no org_id provided, create new organization
      if (!targetOrgId && org_name) {
        const createOrgResult = await db.query(
          `CREATE organizations SET
            org_id = string::lowercase(string::replace($orgName, ' ', '_')),
            name = $orgName,
            subscription_tier = 'free',
            seat_limit = 1,
            seat_usage = 0`,
          { orgName: org_name }
        )
        const newOrg = getFirstRecord<Organization>(createOrgResult)
        if (!newOrg) {
          return c.json({ error: "Failed to create organization" }, 500)
        }
        targetOrgId = newOrg.id
      }

      if (!targetOrgId) {
        return c.json({ error: "org_id or org_name required" }, 400)
      }

      // Create user (first user in org becomes admin)
      const userCountResult = await db.query(
        `SELECT count() AS count FROM users WHERE org_id = $orgId GROUP ALL`,
        { orgId: targetOrgId }
      )
      const userCount = getFirstRecord<{ count: number }>(userCountResult)
      const role = userCount && userCount.count > 0 ? "member" : "admin"

      const createUserResult = await db.query(
        `CREATE users SET
          org_id = $orgId,
          email = $email,
          name = $name,
          password_hash = $passwordHash,
          role = $role,
          created_at = time::now()`,
        {
          orgId: targetOrgId,
          email,
          name,
          passwordHash: password_hash,
          role,
        }
      )

      const user = getFirstRecord<User>(createUserResult)
      if (!user) {
        return c.json({ error: "Failed to create user" }, 500)
      }

      // Get organization
      const orgResult = await db.query(
        `SELECT * FROM organizations WHERE id = $orgId LIMIT 1`,
        { orgId: targetOrgId }
      )
      const org = getFirstRecord<Organization>(orgResult)

      if (!org) {
        return c.json({ error: "Organization not found" }, 500)
      }

      // Generate JWT token
      const token = await generateToken(
        user.id,
        user.org_id,
        user.role,
        [],  // No projects yet for new user
        config.jwt.secret,
        config.jwt.expiresIn
      )

      const response: LoginResponse = {
        token,
        user,
        org,
      }

      return c.json(response, 201)
    } catch (error) {
      console.error("Signup error:", error)
      return c.json({ error: "Signup failed" }, 500)
    }
  })

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
