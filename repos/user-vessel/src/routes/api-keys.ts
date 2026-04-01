/**
 * API key management routes
 */

import { Hono } from "hono"
import type {
  UserVesselConfig,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
} from "../types"
import { requireAuth, getAuth } from "../middleware/auth"
import { generateApiKey, hashApiKey } from "../utils/crypto"
import { getRootDb, getFirstRecord, getAllRecords } from "../db/surreal"

export function apiKeyRoutes(config: UserVesselConfig) {
  const app = new Hono()

  // All routes require authentication
  app.use("/*", requireAuth(config))

  /**
   * GET /v2/api-keys
   * List API keys for current user
   */
  app.get("/", async (c) => {
    try {
      const auth = getAuth(c)
      const db = await getRootDb(config)

      // Regular users see only their own keys, admins see all keys in org
      let query: string
      let params: Record<string, any>

      if (auth.role === "admin") {
        query = `SELECT
                   api_keys.id,
                   api_keys.org_id,
                   api_keys.user_id,
                   api_keys.scopes,
                   api_keys.is_active,
                   api_keys.created_at,
                   api_keys.last_used_at,
                   api_keys.expires_at,
                   api_keys.max_connections,
                   users.email AS user_email
                 FROM api_keys
                 INNER JOIN users ON api_keys.user_id = users.id
                 WHERE api_keys.org_id = $orgId
                 ORDER BY api_keys.created_at DESC`
        params = { orgId: auth.org_id }
      } else {
        query = `SELECT
                   api_keys.id,
                   api_keys.org_id,
                   api_keys.user_id,
                   api_keys.scopes,
                   api_keys.is_active,
                   api_keys.created_at,
                   api_keys.last_used_at,
                   api_keys.expires_at,
                   api_keys.max_connections,
                   users.email AS user_email
                 FROM api_keys
                 INNER JOIN users ON api_keys.user_id = users.id
                 WHERE api_keys.org_id = $orgId AND api_keys.user_id = $userId
                 ORDER BY api_keys.created_at DESC`
        params = { orgId: auth.org_id, userId: auth.id }
      }

      const result = await db.query(query, params)
      const apiKeys = getAllRecords<any>(result)

      // Transform to match dashboard expected format
      const transformedKeys = apiKeys.map((key: any) => ({
        id: key.id,
        user_id: key.user_id,
        user_email: key.user_email,
        prefix: "mb_live_",  // Default prefix for display
        name: key.name,
        created_at: key.created_at,
        last_used_at: key.last_used_at,
        usage_count: 0,  // TODO: Track usage count
        status: key.is_active ? "active" : "revoked",
        tier: "starter",  // TODO: Add tier to schema
        max_connections: key.max_connections || 1,
        // llm_budget not yet implemented
      }))

      return c.json({ data: transformedKeys })
    } catch (error) {
      console.error("List API keys error:", error)
      return c.json({ error: "Failed to list API keys" }, 500)
    }
  })

  /**
   * POST /v2/api-keys
   * Generate new API key
   */
  app.post("/", async (c) => {
    try {
      const auth = getAuth(c)
      const body = await c.req.json<CreateApiKeyRequest>()
      const { name, scopes = [], expires_in_days } = body

      // Generate API key
      const apiKey = generateApiKey("live")
      const keyHash = await hashApiKey(apiKey)

      // Calculate expiry
      let expiresAt: string | null = null
      if (expires_in_days) {
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + expires_in_days)
        expiresAt = expiryDate.toISOString()
      }

      const db = await getRootDb(config)

      // Create API key record
      const createResult = await db.query(
        `CREATE api_keys SET
          org_id = $orgId,
          user_id = $userId,
          key_hash = $keyHash,
          scopes = $scopes,
          is_active = true,
          created_at = time::now(),
          expires_at = $expiresAt`,
        {
          orgId: auth.org_id,
          userId: auth.id,
          keyHash,
          scopes,
          expiresAt,
        }
      )

      const apiKeyRecord = getFirstRecord<ApiKey>(createResult)
      if (!apiKeyRecord) {
        return c.json({ error: "Failed to create API key" }, 500)
      }

      // Get user email for response
      const userResult = await db.query(
        `SELECT email FROM users WHERE id = $userId LIMIT 1`,
        { userId: auth.id }
      )
      const user = getFirstRecord<{ email: string }>(userResult)

      // Transform to match dashboard expected format
      const transformedKey = {
        id: apiKeyRecord.id,
        user_id: apiKeyRecord.user_id,
        user_email: user?.email || "",
        prefix: "mb_live_",
        name,
        created_at: apiKeyRecord.created_at,
        last_used_at: apiKeyRecord.last_used_at,
        usage_count: 0,
        status: "active" as const,
        tier: "starter" as const,
        max_connections: apiKeyRecord.max_connections || 1,
      }

      // Return response with raw key (only time it's exposed)
      // Dashboard expects: { data: { key: ApiKey, secret: string } }
      const response: CreateApiKeyResponse = {
        key: transformedKey,  // Transformed key record
        secret: apiKey,  // Raw API key value (only shown once)
      }

      return c.json({ data: response }, 201)
    } catch (error) {
      console.error("Create API key error:", error)
      return c.json({ error: "Failed to create API key" }, 500)
    }
  })

  /**
   * DELETE /v2/api-keys/:id
   * Revoke API key (mark as inactive)
   */
  app.delete("/:id", async (c) => {
    try {
      const auth = getAuth(c)
      let keyId = c.req.param("id")

      // Ensure keyId has table prefix
      if (!keyId.includes(":")) {
        keyId = `api_keys:${keyId}`
      }

      const db = await getRootDb(config)

      // Check ownership (users can only delete their own keys, admins can delete any)
      // Use SELECT to verify ownership, then UPDATE
      let verifyQuery: string
      let params: Record<string, any>

      if (auth.role === "admin") {
        verifyQuery = `SELECT * FROM ${keyId} WHERE org_id = $orgId LIMIT 1`
        params = { orgId: auth.org_id }
      } else {
        verifyQuery = `SELECT * FROM ${keyId} WHERE org_id = $orgId AND user_id = $userId LIMIT 1`
        params = { orgId: auth.org_id, userId: auth.id }
      }

      // Verify the key exists and user has permission
      const verifyResult = await db.query(verifyQuery, params)
      const existingKey = getFirstRecord(verifyResult)

      if (!existingKey) {
        return c.json({ error: "API key not found or no permission" }, 404)
      }

      // Now update it
      const updateQuery = `UPDATE ${keyId} SET is_active = false`
      const result = await db.query(updateQuery)
      const updated = getFirstRecord(result)

      if (!updated) {
        return c.json({ error: "Failed to update API key" }, 500)
      }

      return c.json({ message: "API key revoked successfully" })
    } catch (error) {
      console.error("Revoke API key error:", error)
      return c.json({ error: "Failed to revoke API key" }, 500)
    }
  })

  return app
}
