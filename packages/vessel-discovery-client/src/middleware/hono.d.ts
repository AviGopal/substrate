/**
 * Hono middleware for vessel health endpoint
 */
import type { Context } from "hono";
import type { VesselClient } from "../vessel-client.js";
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
export declare function createHonoHealthMiddleware(client: VesselClient): (c: Context) => Response & import("hono").TypedResponse<{
    status: "ok" | "degraded" | "unhealthy";
    vessel: string;
    version: string;
    uptime: number;
    heartbeat: {
        lastSuccess: string | null;
        consecutiveFailures: number;
        isRunning: boolean;
    };
    shapes: string[];
}, 200 | 503, "json">;
//# sourceMappingURL=hono.d.ts.map