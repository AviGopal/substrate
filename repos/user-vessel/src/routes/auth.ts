/**
 * Authentication routes for user-vessel
 *
 * Handles JWT validation, user info retrieval, signup, and login.
 */

import { Hono } from "hono"
import type {
  UserVesselConfig,
  User,
  Organization,
  SignupRequest,
  LoginRequest,
  LoginResponse,
} from "../types"
import { requireAuth, getAuth } from "../middleware/auth"
import { getRootDb, getFirstRecord, getLastRecord, getAllRecords } from "../db/surreal"
import { hashPassword, validatePassword, verifyPassword } from "../utils/crypto"
import { generateToken } from "../utils/jwt"

export function authRoutes(config: UserVesselConfig) {
  const app = new Hono()

  /**
   * POST /v2/auth/signup
   * Create new user and organization atomically
   */
  app.post("/signup", async (c) => {
    try {
      const body = await c.req.json<SignupRequest>()
      const { email, password, name, org_name } = body

      // Validate required fields
      if (!email || !password || !name || !org_name) {
        return c.json({
          error: "Email, password, name, and org_name are required"
        }, 400)
      }

      // Validate password
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        return c.json({
          error: passwordValidation.errors.join(", ")
        }, 400)
      }

      // Hash password
      const password_hash = await hashPassword(password)

      const db = await getRootDb(config)

      // Check if email already exists
      const existingUserResult = await db.query(
        `SELECT id FROM users WHERE email = $email LIMIT 1`,
        { email }
      )
      const existingUser = getFirstRecord(existingUserResult)
      if (existingUser) {
        return c.json({ error: "Email already exists" }, 409)
      }

      // Generate org_id slug from org_name
      const orgIdSlug = org_name.toLowerCase().replace(/[^a-z0-9]+/g, "_")

      // Atomic transaction: Create organization and user
      // If either fails, both roll back
      const transactionResult = await db.query(
        `
        BEGIN TRANSACTION;

        -- Create organization
        LET $org = CREATE organizations SET
          org_id = $orgId,
          name = $orgName,
          subscription_tier = 'free',
          seat_usage = 1,
          created_at = time::now();

        -- Check if org creation succeeded
        IF !$org THEN
          THROW "Failed to create organization";
        END;

        -- Create user as admin
        LET $user = CREATE users SET
          org_id = $orgId,
          email = $email,
          name = $userName,
          password_hash = $passwordHash,
          role = 'admin',
          created_at = time::now(),
          last_login = time::now();

        -- Check if user creation succeeded
        IF !$user THEN
          THROW "Failed to create user";
        END;

        COMMIT TRANSACTION;

        -- Return both records
        RETURN {
          org: $org,
          user: $user
        };
        `,
        {
          orgId: orgIdSlug,
          orgName: org_name,
          email,
          userName: name,
          passwordHash: password_hash,
        }
      )

      // DEBUG: Log transaction result structure
      console.log("=== SIGNUP TRANSACTION DEBUG ===")
      console.log("Transaction result length:", transactionResult?.length || 0)
      console.log("Transaction result type:", typeof transactionResult)
      console.log("Transaction result:", JSON.stringify(transactionResult, null, 2))

      // Log each result item
      if (Array.isArray(transactionResult)) {
        transactionResult.forEach((item, index) => {
          console.log(`Result[${index}]:`, {
            type: typeof item,
            isArray: Array.isArray(item),
            status: item?.status,
            hasResult: item && 'result' in item,
            resultType: typeof item?.result,
            resultIsArray: Array.isArray(item?.result),
            keys: Object.keys(item || {})
          })
        })
      }

      // Extract org and user from transaction result
      // Use getLastRecord because transactions return multiple results (one per statement)
      // and only the last RETURN statement contains the actual data
      const result = getLastRecord<{ org: Organization[], user: User[] }>(transactionResult)

      // DEBUG: Log what getLastRecord returned
      console.log("After getLastRecord:")
      console.log("  result:", result)
      console.log("  result type:", typeof result)
      console.log("  has org:", result && 'org' in result)
      console.log("  has user:", result && 'user' in result)
      console.log("  org value:", result?.org)
      console.log("  user value:", result?.user)
      console.log("=== END DEBUG ===")

      if (!result || !result.org || !result.user) {
        console.error("SIGNUP FAILED: Transaction did not return valid result")
        console.error("  result:", result)
        return c.json({
          error: "Signup failed - transaction did not complete"
        }, 500)
      }

      const org = Array.isArray(result.org) ? result.org[0] : result.org
      const user = Array.isArray(result.user) ? result.user[0] : result.user

      if (!org || !user) {
        return c.json({
          error: "Signup failed - missing org or user"
        }, 500)
      }

      // Generate JWT token
      const token = await generateToken(
        user.id,
        org.org_id,
        user.role,
        [], // No project IDs yet
        config.jwt.secret,
        config.jwt.expiresIn
      )

      // Remove password_hash from response
      const { password_hash: _, ...userWithoutPassword } = user

      const response: LoginResponse = {
        token,
        user: userWithoutPassword,
        org,
      }

      return c.json(response, 201)
    } catch (error) {
      console.error("Signup error:", error)
      return c.json({
        error: error instanceof Error ? error.message : "Signup failed"
      }, 500)
    }
  })

  /**
   * POST /v2/auth/login
   * Authenticate user and return JWT token
   */
  app.post("/login", async (c) => {
    try {
      const body = await c.req.json<LoginRequest>()
      const { email, password } = body

      // Validate required fields
      if (!email || !password) {
        return c.json({ error: "Email and password are required" }, 400)
      }

      const db = await getRootDb(config)

      // Look up user by email
      const userResult = await db.query(
        `SELECT id, org_id, email, name, password_hash, role, created_at, last_login
         FROM users
         WHERE email = $email
         LIMIT 1`,
        { email }
      )

      const user = getFirstRecord<User>(userResult)
      if (!user) {
        // Don't reveal whether email exists (security best practice)
        return c.json({ error: "Invalid email or password" }, 401)
      }

      // Verify password
      const passwordMatch = await verifyPassword(password, user.password_hash || "")
      if (!passwordMatch) {
        return c.json({ error: "Invalid email or password" }, 401)
      }

      // Update last_login timestamp
      await db.query(
        `UPDATE $userId SET last_login = time::now()`,
        { userId: user.id }
      )

      // Get organization
      const orgResult = await db.query(
        `SELECT * FROM organizations WHERE org_id = $orgId LIMIT 1`,
        { orgId: user.org_id }
      )
      const org = getFirstRecord<Organization>(orgResult)

      if (!org) {
        return c.json({ error: "Organization not found" }, 500)
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
      }

      // Generate JWT token
      const token = await generateToken(
        user.id,
        user.org_id,
        user.role,
        projectIds,
        config.jwt.secret,
        config.jwt.expiresIn
      )

      // Remove password_hash from response
      const { password_hash: _, ...userWithoutPassword } = user

      const response: LoginResponse = {
        token,
        user: userWithoutPassword,
        org,
      }

      return c.json(response)
    } catch (error) {
      console.error("Login error:", error)
      return c.json({
        error: error instanceof Error ? error.message : "Login failed"
      }, 500)
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
