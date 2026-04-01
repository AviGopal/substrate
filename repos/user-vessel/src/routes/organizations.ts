/**
 * Organization management routes
 */

import { Hono } from "hono"
import type { UserVesselConfig, Organization, CreateOrganizationRequest } from "../types"
import { requireAuth, getAuth, requireAdmin } from "../middleware/auth"
import { getRootDb, getFirstRecord } from "../db/surreal"

export function organizationRoutes(config: UserVesselConfig) {
  const app = new Hono()

  // All routes require authentication
  app.use("/*", requireAuth(config))

  /**
   * GET /v2/organizations/:id
   * Get organization details
   */
  app.get("/:id", async (c) => {
    try {
      const auth = getAuth(c)
      const orgId = c.req.param("id")

      // Can only view own organization
      if (orgId !== auth.org_id) {
        return c.json({ error: "Forbidden" }, 403)
      }

      const db = await getRootDb(config)

      const result = await db.query(
        `SELECT * FROM organizations WHERE id = $orgId LIMIT 1`,
        { orgId }
      )

      const org = getFirstRecord<Organization>(result)
      if (!org) {
        return c.json({ error: "Organization not found" }, 404)
      }

      return c.json(org)
    } catch (error) {
      console.error("Get organization error:", error)
      return c.json({ error: "Failed to get organization" }, 500)
    }
  })

  /**
   * POST /v2/organizations
   * Create new organization (root access only - typically done via signup)
   */
  app.post("/", async (c) => {
    try {
      const body = await c.req.json<CreateOrganizationRequest>()
      const { name, subscription_tier = "free" } = body

      if (!name) {
        return c.json({ error: "Organization name required" }, 400)
      }

      const db = await getRootDb(config)

      // Generate org_id from name
      const orgIdSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_")

      // Check if org_id already exists
      const existingResult = await db.query(
        `SELECT id FROM organizations WHERE org_id = $orgId LIMIT 1`,
        { orgId: orgIdSlug }
      )
      const existing = getFirstRecord(existingResult)
      if (existing) {
        return c.json({ error: "Organization with this name already exists" }, 409)
      }

      // Create organization
      const createResult = await db.query(
        `CREATE organizations SET
          org_id = $orgId,
          name = $name,
          subscription_tier = $subscriptionTier,
          created_at = time::now()`,
        {
          orgId: orgIdSlug,
          name,
          subscriptionTier: subscription_tier,
        }
      )

      const org = getFirstRecord<Organization>(createResult)
      if (!org) {
        return c.json({ error: "Failed to create organization" }, 500)
      }

      return c.json(org, 201)
    } catch (error) {
      console.error("Create organization error:", error)
      return c.json({ error: "Failed to create organization" }, 500)
    }
  })

  /**
   * PATCH /v2/organizations/:id
   * Update organization (admin only)
   */
  app.patch("/:id", requireAdmin(), async (c) => {
    try {
      const auth = getAuth(c)
      const orgId = c.req.param("id")

      // Can only update own organization
      if (orgId !== auth.org_id) {
        return c.json({ error: "Forbidden" }, 403)
      }

      const body = await c.req.json<Partial<Organization>>()

      // Build update fields
      const allowedFields = ["name", "subscription_tier"]
      const updates: Record<string, any> = {}

      for (const field of allowedFields) {
        if (body[field as keyof Organization] !== undefined) {
          updates[field] = body[field as keyof Organization]
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
        `UPDATE $orgId SET ${setClause}, updated_at = time::now() RETURN AFTER`,
        { orgId, ...updates }
      )

      const org = getFirstRecord<Organization>(result)
      if (!org) {
        return c.json({ error: "Organization not found" }, 404)
      }

      return c.json(org)
    } catch (error) {
      console.error("Update organization error:", error)
      return c.json({ error: "Failed to update organization" }, 500)
    }
  })

  return app
}
