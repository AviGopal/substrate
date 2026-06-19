/**
 * Hono middleware for vessel health endpoint
 */

import type { Context } from "hono"
import type { VesselClient } from "../vessel-client.js"

/**
 * Create Hono middleware for health endpoint
 *
 * @example
 * ```typescript
 * import { Hono } from "hono"
 * import { createHonoHealthMiddleware } from "@avigopal/vessel-discovery-client/middleware"
 *
 * const app = new Hono()
 * app.get("/health", createHonoHealthMiddleware(client))
 * ```
 */
export function createHonoHealthMiddleware(client: VesselClient) {
  return (c: Context) => {
    const health = client.getHealthStatus()

    const statusCode = health.status === "ok" ? 200 : 503

    return c.json(health, statusCode)
  }
}
