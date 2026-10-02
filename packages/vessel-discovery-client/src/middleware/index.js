/**
 * Middleware exports
 */
export { createHonoHealthMiddleware } from "./hono.js";
export { createExpressHealthMiddleware } from "./express.js";
export function createHealthMiddleware(client) {
    // Return a function that can work with both Hono and Express
    return (reqOrContext, res) => {
        const health = client.getHealthStatus();
        const statusCode = health.status === "ok" ? 200 : 503;
        // Hono context
        if (reqOrContext && typeof reqOrContext.json === "function") {
            return reqOrContext.json(health, statusCode);
        }
        // Express response
        if (res && typeof res.status === "function") {
            return res.status(statusCode).json(health);
        }
        throw new Error("Unsupported framework - use createHonoHealthMiddleware or createExpressHealthMiddleware");
    };
}
//# sourceMappingURL=index.js.map