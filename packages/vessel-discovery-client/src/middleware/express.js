/**
 * Express middleware for vessel health endpoint
 */
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
export function createExpressHealthMiddleware(client) {
    return (_req, res) => {
        const health = client.getHealthStatus();
        const statusCode = health.status === "ok" ? 200 : 503;
        res.status(statusCode).json(health);
    };
}
//# sourceMappingURL=express.js.map