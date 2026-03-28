/**
 * Vessel Module
 *
 * Core vessel system for microplastic.
 */

// Types
export type {
  VesselProvider,
  VesselManifest,
  VesselContext,
  VesselConfig,
  VesselHealth,
  VesselHealthCheck,
  VesselCapability,
  CapabilityCategory,
  VesselEvents,
  VesselEventEmitter,
  VesselLogger,
  LogLevel,
  ResolverResult,
  ActivityExecution,
  GoalContext,
  ImpulseStore,
  ImpulseStoreEvent,
} from "./types.ts";

// Errors
export {
  VesselError,
  VesselInitError,
  ResolverError,
  VesselNotFoundError,
  VesselAlreadyRegisteredError,
  NoResolverError,
  HealthCheckError,
} from "./errors.ts";

// Events
export { VesselEventEmitterImpl } from "./events.ts";

// Logger
export { createVesselLogger } from "./logger.ts";

// Registry
export { VesselRegistry } from "./registry.ts";
export type { VesselRegistryConfig } from "./registry.ts";

// Vessel implementations
export { MCPVessel } from "./mcp.ts";
