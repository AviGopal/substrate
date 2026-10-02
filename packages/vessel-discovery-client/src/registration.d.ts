/**
 * Registration helper function
 */
import type { DiscoveryConfig } from "./types.js";
import { VesselClient } from "./vessel-client.js";
/**
 * Register a vessel with the discovery service
 *
 * This is a convenience function that:
 * 1. Creates a VesselClient
 * 2. Attempts initial registration
 * 3. Starts heartbeat loop
 * 4. Registers signal handlers for graceful shutdown
 *
 * @param config Discovery configuration
 * @returns VesselClient instance
 *
 * @example
 * ```typescript
 * const client = await register({
 *   vesselId: "my-vessel-1",
 *   vesselName: "My Vessel",
 *   endpoint: "http://my-vessel:8080",
 *   shapes: ["my-shape"],
 *   discoveryEndpoint: "http://discovery:8080",
 * })
 * ```
 */
export declare function register(config: DiscoveryConfig): Promise<VesselClient>;
//# sourceMappingURL=registration.d.ts.map