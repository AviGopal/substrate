/**
 * Express middleware for vessel health endpoint
 */
import type { Request, Response } from "express";
import type { VesselClient } from "../vessel-client.js";
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
export declare function createExpressHealthMiddleware(client: VesselClient): (_req: Request, res: Response) => void;
//# sourceMappingURL=express.d.ts.map