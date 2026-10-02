/**
 * Express middleware for vessel health endpoint
 */

import type { Request, Response } from "express"
import type { VesselClient } from "../vessel-client.js"

/**
 * Create Express middleware for health endpoint
 *
 * @example
 * ```typescript
 * import express from "express"
 * import { createExpressHealthMiddleware } from "@avigopal/vessel-discovery-client/middleware"
 *
 * const app = express()
 * app.get("/health", createExpressHealthMiddleware(client))
 * ```
 */
export function createExpressHealthMiddleware(client: VesselClient) {
  return (_req: Request, res: Response) => {
    const health = client.getHealthStatus()

    const statusCode = health.status === "ok" ? 200 : 503

    res.status(statusCode).json(health)
  }
}
