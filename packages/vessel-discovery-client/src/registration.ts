/**
 * Registration helper function
 */

import type { DiscoveryConfig } from "./types.js"
import { VesselClient } from "./vessel-client.js"

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
export async function register(config: DiscoveryConfig): Promise<VesselClient> {
  const client = new VesselClient(config)

  // Attempt initial registration (non-blocking)
  const registered = await client.register()
  if (!registered) {
    client.config.logger?.warn(
      "[Registration] Initial registration failed, will retry on heartbeat"
    )
  }

  // Start heartbeat loop
  client.startHeartbeat()

  // Register shutdown handlers
  client.registerShutdownHandlers()

  return client
}
