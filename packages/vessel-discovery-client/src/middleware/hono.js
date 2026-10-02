/**
 * Hono middleware for vessel health endpoint
 */
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
export function createHonoHealthMiddleware(client) {
    return (c) => {
        const health = client.getHealthStatus();
        const statusCode = health.status === "ok" ? 200 : 503;
        return c.json(health, statusCode);
    };
}
//# sourceMappingURL=hono.js.map