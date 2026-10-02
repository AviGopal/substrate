/**
 * Middleware exports
 */
export { createHonoHealthMiddleware } from "./hono.js";
export { createExpressHealthMiddleware } from "./express.js";
/**
 * Generic health middleware creator
 * Attempts to detect framework and return appropriate middleware
 */
import type { VesselClient } from "../vessel-client.js";
export declare function createHealthMiddleware(client: VesselClient): (reqOrContext: any, res?: any) => any;
//# sourceMappingURL=index.d.ts.map