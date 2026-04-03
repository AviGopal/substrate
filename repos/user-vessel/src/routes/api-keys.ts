/**
 * API key management routes
 * Delegates key generation and validation to identity-vessel
 */

import { Hono } from "hono"
import type {
  UserVesselConfig,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ApiKeyDisplayResponse,
  Organization,
  LlmBudget,
} from "../types"
import { requireAuth, getAuth } from "../middleware/auth"
import { createIdentityVesselClient } from "../services/identity-vessel"
import { getAuthenticatedDb } from "../db/surreal"
import { getFirstRecord, getAllRecords } from "../db/surreal"

// =============================================================================
// TIER LIMITS CONFIGURATION
// =============================================================================

type BillingTier = 'starter' | 'pro' | 'enterprise'

interface TierLimits {
  connections: number
  tokens: number
}

const TIER_LIMITS: Record<BillingTier, TierLimits> = {
  starter: { connections: 1, tokens: 100_000 },
  pro: { connections: 3, tokens: 500_000 },
  enterprise: { connections: 10, tokens: 2_000_000 },
}

/**
 * Get connection limit for a given tier
 */
function getTierConnections(tier: string): number {
  const billingTier = normalizeTier(tier)
  return TIER_LIMITS[billingTier].connections
}

/**
 * Get token budget for a given tier
 */
function getTierTokens(tier: string): number {
  const billingTier = normalizeTier(tier)
  return TIER_LIMITS[billingTier].tokens
}

/**
 * Normalize subscription tier to billing tier
 * Maps 'free' -> 'starter' since free tier uses starter limits
 */
function normalizeTier(tier: string): BillingTier {
  if (tier === 'free' || tier === 'starter') {
    return 'starter'
  }
  if (tier === 'pro') {
    return 'pro'
  }
  if (tier === 'enterprise') {
    return 'enterprise'
  }
  // Default to starter for unknown tiers
  return 'starter'
}

/**
 * Calculate the reset date for the next month
 */
function getNextMonthReset(): string {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return nextMonth.toISOString()
}

/**
 * Create LLM budget object based on organization tier
 */
function createLlmBudget(tier: string): LlmBudget {
  const billingTier = normalizeTier(tier)
  return {
    tokens_per_month: getTierTokens(tier),
    tokens_used: 0,
    reset_at: getNextMonthReset(),
    overage_enabled: billingTier === 'enterprise',
  }
}

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
      const db = await getAuthenticatedDb(config, auth)

      // Regular users see only their own keys, admins see all keys in org
      let query: string
      let params: Record<string, any>

      if (auth.role === "admin") {
        query = `SELECT
                   api_keys.id,
                   api_keys.org_id,
                   api_keys.user_id,
                   api_keys.key_id,
                   api_keys.scopes,
                   api_keys.is_active,
                   api_keys.rotation_required,
                   api_keys.created_at,
                   api_keys.last_used_at,
                   api_keys.expires_at,
                   api_keys.tier,
                   api_keys.max_connections,
                   api_keys.llm_budget,
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
                   api_keys.key_id,
                   api_keys.scopes,
                   api_keys.is_active,
                   api_keys.rotation_required,
                   api_keys.created_at,
                   api_keys.last_used_at,
                   api_keys.expires_at,
                   api_keys.tier,
                   api_keys.max_connections,
                   api_keys.llm_budget,
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
        status: key.rotation_required ? "rotation_required" : (key.is_active ? "active" : "revoked"),
        tier: key.tier || "starter",
        max_connections: key.max_connections || 1,
        llm_budget: key.llm_budget || null,
      }))

      return c.json({ data: transformedKeys })
    } catch (error) {
      console.error("List API keys error:", error)
      return c.json({ error: "Failed to list API keys" }, 500)
    }
  })

  /**
   * POST /v2/api-keys
   * Generate new API key via identity-vessel
   */
  app.post("/", async (c) => {
    try {
      const auth = getAuth(c)
      const body = await c.req.json<CreateApiKeyRequest>()
      const { name, scopes = [], expires_in_days } = body

      // Delegate key generation to identity-vessel
      const identityClient = createIdentityVesselClient(config)
      const keyResult = await identityClient.generateKey({
        org_id: auth.org_id,
        user_id: auth.id,
        name,
        scopes,
        expires_in_days,
      })

      const db = await getAuthenticatedDb(config, auth)

      // Fetch organization to get subscription tier for billing fields
      const orgResult = await db.query(
        `SELECT subscription_tier FROM organizations WHERE org_id = $orgId LIMIT 1`,
        { orgId: auth.org_id }
      )
      const org = getFirstRecord<Pick<Organization, 'subscription_tier'>>(orgResult)
      const orgTier = org?.subscription_tier || 'starter'

      // Calculate billing fields from org tier
      const billingTier = normalizeTier(orgTier)
      const maxConnections = getTierConnections(orgTier)
      const llmBudget = createLlmBudget(orgTier)

      // Store key metadata in database (NOT the raw key!)
      const createResult = await db.query(
        `CREATE api_keys SET
          id = $keyId,
          org_id = $orgId,
          user_id = $userId,
          key_id = $keyId,
          scopes = $scopes,
          is_active = true,
          rotation_required = false,
          created_at = time::now(),
          expires_at = $expiresAt,
          tier = $tier,
          max_connections = $maxConnections,
          llm_budget = $llmBudget`,
        {
          keyId: keyResult.key_id,
          orgId: auth.org_id,
          userId: auth.id,
          scopes,
          expiresAt: keyResult.expires_at || null,
          tier: billingTier,
          maxConnections,
          llmBudget,
        }
      )

      const apiKeyRecord = getFirstRecord<ApiKey>(createResult)
      if (!apiKeyRecord) {
        return c.json({ error: "Failed to create API key record" }, 500)
      }

      // Get user email for response
      const userResult = await db.query(
        `SELECT email FROM users WHERE id = $userId LIMIT 1`,
        { userId: auth.id }
      )
      const user = getFirstRecord<{ email: string }>(userResult)

      // Transform to match dashboard expected format
      const transformedKey: ApiKeyDisplayResponse = {
        id: apiKeyRecord.id,
        user_id: apiKeyRecord.user_id,
        user_email: user?.email || "",
        prefix: keyResult.prefix,
        name,
        created_at: apiKeyRecord.created_at,
        last_used_at: apiKeyRecord.last_used_at,
        usage_count: 0,
        status: "active",
        tier: apiKeyRecord.tier,
        max_connections: apiKeyRecord.max_connections,
        llm_budget: apiKeyRecord.llm_budget,
      }

      // Return response with raw key (only time it's exposed)
      const response: CreateApiKeyResponse = {
        key: transformedKey,
        secret: keyResult.key,  // Raw API key from identity-vessel (base64 encoded)
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

      const db = await getAuthenticatedDb(config, auth)

      // Check ownership (users can only delete their own keys, admins can delete any)
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

      // Mark as inactive in database
      const updateQuery = `UPDATE ${keyId} SET is_active = false`
      const result = await db.query(updateQuery)
      const updated = getFirstRecord(result)

      if (!updated) {
        return c.json({ error: "Failed to update API key" }, 500)
      }

      // NOTE: We don't call identity-vessel.revokeKey() because
      // identity-vessel doesn't store keys - it only validates HMAC signatures.
      // Marking as inactive in our database is sufficient.

      return c.json({ message: "API key revoked successfully" })
    } catch (error) {
      console.error("Revoke API key error:", error)
      return c.json({ error: "Failed to revoke API key" }, 500)
    }
  })

  return app
}
