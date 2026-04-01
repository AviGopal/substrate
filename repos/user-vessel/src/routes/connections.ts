/**
 * Connection tracking routes
 *
 * Manages active connections with slot enforcement
 */

import { Hono } from "hono"
import type {
  UserVesselConfig,
  ActiveConnection,
  ApiKey,
  ClaimConnectionRequest,
  ClaimConnectionResponse,
  ReleaseConnectionRequest,
  HeartbeatRequest,
  HeartbeatResponse,
} from "../types"
import { getRootDb, getFirstRecord, getAllRecords } from "../db/surreal"
import { hashApiKey } from "../utils/crypto"

// Connection slot limits
const DEFAULT_MAX_CONNECTIONS = 3
const HEARTBEAT_INTERVAL_MS = 30000  // 30 seconds
const CONNECTION_TIMEOUT_MS = 300000  // 5 minutes

export function connectionRoutes(config: UserVesselConfig) {
  const app = new Hono()

  /**
   * POST /v2/connections/claim
   * Claim a connection slot using an API key
   */
  app.post("/claim", async (c) => {
    try {
      const body = await c.req.json<ClaimConnectionRequest>()
      const { api_key, instance_id, instance_type, client_metadata } = body

      // Validate required fields
      if (!api_key || !instance_id || !instance_type) {
        return c.json({
          error: "Missing required fields: api_key, instance_id, instance_type"
        }, 400)
      }

      const db = await getRootDb(config)

      // Hash API key and verify it exists
      const keyHash = await hashApiKey(api_key)
      const keyResult = await db.query(
        `SELECT id, org_id, user_id, is_active, max_connections, expires_at
         FROM api_keys
         WHERE key_hash = $keyHash`,
        { keyHash }
      )

      const apiKeyRecord = getFirstRecord<ApiKey>(keyResult)
      if (!apiKeyRecord) {
        return c.json({ error: "Invalid API key" }, 401)
      }

      // Verify API key is active
      if (!apiKeyRecord.is_active) {
        return c.json({ error: "API key is inactive" }, 403)
      }

      // Verify API key hasn't expired
      if (apiKeyRecord.expires_at) {
        const expiryDate = new Date(apiKeyRecord.expires_at)
        if (expiryDate < new Date()) {
          return c.json({ error: "API key has expired" }, 403)
        }
      }

      // Check for existing active connection with this instance_id
      const existingResult = await db.query(
        `SELECT id FROM active_connections
         WHERE instance_id = $instanceId
           AND disconnected_at IS NONE`,
        { instanceId: instance_id }
      )

      const existingConnection = getFirstRecord(existingResult)
      if (existingConnection) {
        return c.json({
          error: "Instance already has an active connection",
          connection_id: existingConnection.id
        }, 409)
      }

      // Count active connections for this API key
      const countResult = await db.query(
        `SELECT count() AS count FROM active_connections
         WHERE api_key_id = $apiKeyId
           AND disconnected_at IS NONE
         GROUP ALL`,
        { apiKeyId: apiKeyRecord.id }
      )

      const countRecord = getFirstRecord<{ count: number }>(countResult)
      const activeCount = countRecord?.count || 0

      // Enforce connection slot limit
      const maxConnections = apiKeyRecord.max_connections || DEFAULT_MAX_CONNECTIONS
      if (activeCount >= maxConnections) {
        return c.json({
          error: "Connection slot limit reached",
          max_connections: maxConnections,
          active_connections: activeCount
        }, 429)
      }

      // Create connection record
      const createResult = await db.query(
        `CREATE active_connections SET
          api_key_id = $apiKeyId,
          instance_id = $instanceId,
          instance_type = $instanceType,
          org_id = $orgId,
          user_id = $userId,
          connected_at = time::now(),
          last_heartbeat_at = time::now(),
          client_metadata = $clientMetadata`,
        {
          apiKeyId: apiKeyRecord.id,
          instanceId: instance_id,
          instanceType: instance_type,
          orgId: apiKeyRecord.org_id,
          userId: apiKeyRecord.user_id,
          clientMetadata: client_metadata || null,
        }
      )

      const connection = getFirstRecord<ActiveConnection>(createResult)
      if (!connection) {
        return c.json({ error: "Failed to create connection" }, 500)
      }

      // Update api_key last_used_at
      await db.query(
        `UPDATE $apiKeyId SET last_used_at = time::now()`,
        { apiKeyId: apiKeyRecord.id }
      )

      const response: ClaimConnectionResponse = {
        connection_id: connection.id,
        api_key_id: apiKeyRecord.id,
        instance_id: connection.instance_id,
        connected_at: connection.connected_at,
        heartbeat_interval_ms: HEARTBEAT_INTERVAL_MS,
      }

      return c.json(response, 201)
    } catch (error) {
      console.error("Claim connection error:", error)
      return c.json({ error: "Failed to claim connection" }, 500)
    }
  })

  /**
   * POST /v2/connections/release
   * Release a connection slot by marking as disconnected
   */
  app.post("/release", async (c) => {
    try {
      const body = await c.req.json<ReleaseConnectionRequest>()
      const { instance_id } = body

      if (!instance_id) {
        return c.json({ error: "Missing required field: instance_id" }, 400)
      }

      const db = await getRootDb(config)

      // Find and disconnect the connection
      const updateResult = await db.query(
        `UPDATE active_connections
         SET disconnected_at = time::now()
         WHERE instance_id = $instanceId
           AND disconnected_at IS NONE
         RETURN AFTER`,
        { instanceId: instance_id }
      )

      const connection = getFirstRecord<ActiveConnection>(updateResult)
      if (!connection) {
        return c.json({
          error: "No active connection found for instance"
        }, 404)
      }

      return c.json({
        message: "Connection released successfully",
        connection_id: connection.id,
        disconnected_at: connection.disconnected_at,
      })
    } catch (error) {
      console.error("Release connection error:", error)
      return c.json({ error: "Failed to release connection" }, 500)
    }
  })

  /**
   * POST /v2/connections/heartbeat
   * Update heartbeat timestamp to keep connection alive
   */
  app.post("/heartbeat", async (c) => {
    try {
      const body = await c.req.json<HeartbeatRequest>()
      const { instance_id, client_metadata } = body

      if (!instance_id) {
        return c.json({ error: "Missing required field: instance_id" }, 400)
      }

      const db = await getRootDb(config)

      // Update heartbeat timestamp
      const updateQuery = client_metadata
        ? `UPDATE active_connections
           SET last_heartbeat_at = time::now(),
               client_metadata = $clientMetadata
           WHERE instance_id = $instanceId
             AND disconnected_at IS NONE
           RETURN AFTER`
        : `UPDATE active_connections
           SET last_heartbeat_at = time::now()
           WHERE instance_id = $instanceId
             AND disconnected_at IS NONE
           RETURN AFTER`

      const updateResult = await db.query(updateQuery, {
        instanceId: instance_id,
        clientMetadata: client_metadata || null,
      })

      const connection = getFirstRecord<ActiveConnection>(updateResult)
      if (!connection) {
        return c.json({
          error: "No active connection found for instance",
          action: "reconnect"
        }, 404)
      }

      const response: HeartbeatResponse = {
        connection_id: connection.id,
        last_heartbeat_at: connection.last_heartbeat_at,
        expires_in_ms: CONNECTION_TIMEOUT_MS,
      }

      return c.json(response)
    } catch (error) {
      console.error("Heartbeat error:", error)
      return c.json({ error: "Failed to update heartbeat" }, 500)
    }
  })

  /**
   * GET /v2/connections
   * List active connections (admin: all in org, user: own connections)
   */
  app.get("/", async (c) => {
    try {
      // Extract auth from header (optional for this endpoint)
      const authHeader = c.req.header("Authorization")
      let orgId: string | null = null
      let userId: string | null = null
      let isAdmin = false

      if (authHeader && authHeader.startsWith("Bearer ")) {
        // TODO: Decode JWT to get auth context
        // For now, we'll return all connections (requires auth implementation)
      }

      const db = await getRootDb(config)

      // Build query based on auth context
      let query: string
      let params: Record<string, any> = {}

      if (orgId && isAdmin) {
        // Admin sees all org connections
        query = `SELECT * FROM active_connections
                 WHERE org_id = $orgId
                   AND disconnected_at IS NONE
                 ORDER BY connected_at DESC`
        params = { orgId }
      } else if (orgId && userId) {
        // Regular user sees own connections
        query = `SELECT * FROM active_connections
                 WHERE org_id = $orgId
                   AND user_id = $userId
                   AND disconnected_at IS NONE
                 ORDER BY connected_at DESC`
        params = { orgId, userId }
      } else {
        // No auth - return all active connections (dev mode)
        query = `SELECT * FROM active_connections
                 WHERE disconnected_at IS NONE
                 ORDER BY connected_at DESC`
      }

      const result = await db.query(query, params)
      const connections = getAllRecords<ActiveConnection>(result)

      return c.json({
        connections,
        total: connections.length,
      })
    } catch (error) {
      console.error("List connections error:", error)
      return c.json({ error: "Failed to list connections" }, 500)
    }
  })

  return app
}
