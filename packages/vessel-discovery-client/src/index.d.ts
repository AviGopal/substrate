/**
 * @avigopal/vessel-discovery-client
 *
 * Shared TypeScript package for standardized vessel registration and discovery
 */
export { VesselClient } from "./vessel-client.js";
export { register } from "./registration.js";
export { DiscoveryRegistrationLoop } from "./registration-loop.js";
export type { DiscoveryRegistrationLoopConfig } from "./registration-loop.js";
export { discoverByShape, discoverVessels, clearDiscoveryCache } from "./discovery.js";
export type { DiscoveryConfig, VesselRegistration, HeartbeatResponse, HealthStatus, VesselCapability, DiscoveryResult, DiscoveryOptions, Logger, MetricsEmitter, HeartbeatMetrics, RegisterRequest, RegisterResponse, HeartbeatRequest, ResolveRequestFormat, ResolveAuthScheme, AuthTokenSource, AuthDelegationMode, } from "./types.js";
export { DEFAULT_AUTH_TOKEN_SOURCE, DEFAULT_AUTH_DELEGATION_MODE, } from "./types.js";
export { VesselMetrics, Metrics, DefaultMetricsEmitter } from "./metrics.js";
export { BackoffManager } from "./utils/backoff.js";
export { HttpClient } from "./utils/http.js";
export { reachableFrom, LOOPBACK_HOSTS } from "./reachable-from.js";
//# sourceMappingURL=index.d.ts.map