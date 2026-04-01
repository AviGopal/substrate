/**
 * Project management routes
 */

import { Hono } from "hono"
import type { UserVesselConfig, Project, CreateProjectRequest } from "../types"
import { requireAuth, getAuth, requireAdmin } from "../middleware/auth"
import { getRootDb, getFirstRecord, getAllRecords } from "../db/surreal"

export function projectRoutes(config: UserVesselConfig) {
  const app = new Hono()

  // All routes require authentication
  app.use("/*", requireAuth(config))

  /**
   * GET /v2/projects
   * List projects user has access to
   */
  app.get("/", async (c) => {
    try {
      const auth = getAuth(c)
      const db = await getRootDb(config)

      let query: string
      if (auth.role === "admin") {
        // Admins see all projects in org
        query = `SELECT * FROM projects WHERE org_id = $orgId ORDER BY created_at DESC`
      } else {
        // Members see only their projects
        query = `SELECT * FROM projects WHERE org_id = $orgId AND id IN $projectIds ORDER BY created_at DESC`
      }

      const result = await db.query(query, {
        orgId: auth.org_id,
        projectIds: auth.project_ids,
      })

      const projects = getAllRecords<Project>(result)
      return c.json({ projects })
    } catch (error) {
      console.error("List projects error:", error)
      return c.json({ error: "Failed to list projects" }, 500)
    }
  })

  /**
   * GET /v2/projects/:id
   * Get project details
   */
  app.get("/:id", async (c) => {
    try {
      const auth = getAuth(c)
      const projectId = c.req.param("id")
      const db = await getRootDb(config)

      // Check access
      if (auth.role !== "admin" && !auth.project_ids.includes(projectId)) {
        return c.json({ error: "Forbidden" }, 403)
      }

      const result = await db.query(
        `SELECT * FROM projects WHERE id = $projectId AND org_id = $orgId LIMIT 1`,
        { projectId, orgId: auth.org_id }
      )

      const project = getFirstRecord<Project>(result)
      if (!project) {
        return c.json({ error: "Project not found" }, 404)
      }

      return c.json(project)
    } catch (error) {
      console.error("Get project error:", error)
      return c.json({ error: "Failed to get project" }, 500)
    }
  })

  /**
   * POST /v2/projects
   * Create new project (admin only)
   */
  app.post("/", requireAdmin(), async (c) => {
    try {
      const auth = getAuth(c)
      const body = await c.req.json<CreateProjectRequest>()
      const { name, repo_url, metadata } = body

      if (!name) {
        return c.json({ error: "Project name required" }, 400)
      }

      const db = await getRootDb(config)

      // Create project
      const createResult = await db.query(
        `CREATE projects SET
          org_id = $orgId,
          name = $name,
          repo_url = $repoUrl,
          metadata = $metadata,
          created_at = time::now()`,
        {
          orgId: auth.org_id,
          name,
          repoUrl: repo_url || null,
          metadata: metadata || null,
        }
      )

      const project = getFirstRecord<Project>(createResult)
      if (!project) {
        return c.json({ error: "Failed to create project" }, 500)
      }

      return c.json(project, 201)
    } catch (error) {
      console.error("Create project error:", error)
      return c.json({ error: "Failed to create project" }, 500)
    }
  })

  /**
   * PATCH /v2/projects/:id
   * Update project (admin only)
   */
  app.patch("/:id", requireAdmin(), async (c) => {
    try {
      const auth = getAuth(c)
      const projectId = c.req.param("id")
      const body = await c.req.json<Partial<Project>>()

      // Build update fields
      const allowedFields = ["name", "repo_url", "metadata"]
      const updates: Record<string, any> = {}

      for (const field of allowedFields) {
        if (body[field as keyof Project] !== undefined) {
          updates[field] = body[field as keyof Project]
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
        `UPDATE $projectId SET ${setClause} WHERE org_id = $orgId RETURN AFTER`,
        { projectId, orgId: auth.org_id, ...updates }
      )

      const project = getFirstRecord<Project>(result)
      if (!project) {
        return c.json({ error: "Project not found" }, 404)
      }

      return c.json(project)
    } catch (error) {
      console.error("Update project error:", error)
      return c.json({ error: "Failed to update project" }, 500)
    }
  })

  /**
   * DELETE /v2/projects/:id
   * Delete project (admin only)
   */
  app.delete("/:id", requireAdmin(), async (c) => {
    try {
      const auth = getAuth(c)
      const projectId = c.req.param("id")

      const db = await getRootDb(config)

      // Delete project and its members (cascade)
      await db.query(
        `DELETE $projectId WHERE org_id = $orgId;
         DELETE project_members WHERE project_id = $projectId;`,
        { projectId, orgId: auth.org_id }
      )

      return c.json({ message: "Project deleted successfully" })
    } catch (error) {
      console.error("Delete project error:", error)
      return c.json({ error: "Failed to delete project" }, 500)
    }
  })

  return app
}
