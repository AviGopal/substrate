/**
 * @avigopal/vessel-discovery-client
 *
 * Shared TypeScript package for standardized vessel registration and discovery
 */

// Core exports
export { VesselClient } from "./vessel-client.js"
export { register } from "./registration.js"

// Discovery
export { discoverByShape, discoverVessels, clearDiscoveryCache } from "./discovery.js"

// Types
export type {
  DiscoveryConfig,
  VesselRegistration,
  HeartbeatResponse,
  HealthStatus,
  VesselCapability,
  DiscoveryResult,
  DiscoveryOptions,
  Logger,
  MetricsEmitter,
  HeartbeatMetrics,
  RegisterRequest,
  RegisterResponse,
  HeartbeatRequest,
  ResolveRequestFormat,
  ResolveAuthScheme,
  AuthTokenSource,
  AuthDelegationMode,
} from "./types.js"

export {
  DEFAULT_AUTH_TOKEN_SOURCE,
  DEFAULT_AUTH_DELEGATION_MODE,
} from "./types.js"

// Metrics
export { VesselMetrics, Metrics, DefaultMetricsEmitter } from "./metrics.js"

// Utilities (for advanced usage)
export { BackoffManager } from "./utils/backoff.js"
export { HttpClient } from "./utils/http.js"
