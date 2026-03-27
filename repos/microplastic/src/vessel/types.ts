/**
 * Vessel Core Types
 *
 * Type definitions for the VesselProvider interface and related types.
 */

import type { Impulse, ImpulsePointer, ActivityTemplate } from "@metabob/minibob";

// =============================================================================
// VESSEL IDENTITY
// =============================================================================

/**
 * Vessel manifest - static metadata about a vessel
 */
export interface VesselManifest {
  /** Unique identifier (e.g., "@metabob/minibob") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** One-line description */
  description: string;
}

// =============================================================================
// VESSEL HEALTH
// =============================================================================

/**
 * Health check result for a single check
 */
export interface VesselHealthCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message?: string;
  duration?: number;
}

/**
 * Overall vessel health status
 */
export interface VesselHealth {
  status: "healthy" | "degraded" | "unhealthy";
  checks: VesselHealthCheck[];
  timestamp: number;
}

// =============================================================================
// VESSEL CAPABILITIES
// =============================================================================

/**
 * Capability category
 */
export type CapabilityCategory = "resolver" | "activity" | "tool" | "ui" | "integration";

/**
 * Vessel capability declaration
 */
export interface VesselCapability {
  /** Capability identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this capability provides */
  description: string;
  /** Category for grouping */
  category: CapabilityCategory;
  /** Pointer types this capability can resolve (if resolver) */
  resolves?: string[];
  /** Tools this capability provides (if tool) */
  tools?: string[];
}

// =============================================================================
// RESOLVER TYPES
// =============================================================================

/**
 * Result of resolving an impulse
 */
export interface ResolverResult {
  /** Resolved content */
  content: string;
  /** Optional metadata about the resolution */
  metadata?: {
    /** Source of the content */
    source?: string;
    /** When content was resolved */
    resolvedAt?: number;
    /** Content type */
    contentType?: string;
    /** Whether content was truncated */
    truncated?: boolean;
    /** Additional metadata */
    [key: string]: unknown;
  };
}

// =============================================================================
// VESSEL CONFIGURATION
// =============================================================================

/**
 * Configuration for a vessel instance
 */
export interface VesselConfig {
  /** Whether development mode is enabled */
  developmentMode: boolean;
  /** Working directory for file operations */
  workingDirectory: string;
  /** Environment variables available to the vessel */
  environment: Record<string, string>;
  /** Vessel-specific configuration options */
  options: Record<string, unknown>;
}

// =============================================================================
// VESSEL EVENTS
// =============================================================================

/**
 * Activity execution info for events
 */
export interface ActivityExecution {
  id: string;
  templateId: string;
  startedAt: number;
  status: "running" | "completed" | "failed";
}

/**
 * Goal context for events
 */
export interface GoalContext {
  goal: string;
  workingDirectory: string;
  impulseIds: string[];
}

/**
 * Vessel event types
 */
export interface VesselEvents {
  "activity:start": ActivityExecution;
  "activity:complete": ActivityExecution;
  "activity:fail": { execution: ActivityExecution; error: Error };
  "impulse:create": Impulse;
  "impulse:resolve": { impulse: Impulse; result: ResolverResult };
  "goal:submit": { goal: string; context: GoalContext };
  "goal:complete": { goal: string; success: boolean };
}

/**
 * Vessel event emitter interface
 */
export interface VesselEventEmitter {
  on<K extends keyof VesselEvents>(event: K, handler: (data: VesselEvents[K]) => void): void;
  off<K extends keyof VesselEvents>(event: K, handler: (data: VesselEvents[K]) => void): void;
  emit<K extends keyof VesselEvents>(event: K, data: VesselEvents[K]): void;
}

// =============================================================================
// VESSEL LOGGER
// =============================================================================

/**
 * Log levels
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Vessel-scoped logger
 */
export interface VesselLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// =============================================================================
// VESSEL CONTEXT
// =============================================================================

// Forward declaration - actual ImpulseStore is in impulse/store.ts
export interface ImpulseStore {
  create(impulse: Omit<Impulse, "loaded" | "createdAt">): Impulse;
  get(id: string): Impulse | undefined;
  load(id: string): Promise<Impulse>;
  update(id: string, updates: Partial<Impulse>): Impulse | undefined;
  delete(id: string): boolean;
  list(): Impulse[];
  subscribe(listener: (event: ImpulseStoreEvent) => void): () => void;
}

/**
 * Impulse store event types
 */
export interface ImpulseStoreEvent {
  type: "create" | "update" | "delete" | "load";
  impulse: Impulse;
}

/**
 * Context provided to vessels on initialization
 */
export interface VesselContext {
  /** Shared impulse store - all vessels read/write here */
  impulseStore: ImpulseStore;
  /** Configuration for this vessel */
  config: VesselConfig;
  /** Reference to other vessels (for rare direct communication) */
  vessels: Map<string, VesselProvider>;
  /** Event emitter for lifecycle events */
  events: VesselEventEmitter;
  /** Logger scoped to this vessel */
  logger: VesselLogger;
}

// =============================================================================
// VESSEL PROVIDER INTERFACE
// =============================================================================

/**
 * VesselProvider - The contract for composable vessels
 *
 * A vessel is a bundle of capabilities that can:
 * - Resolve certain impulse pointer types
 * - Provide activity templates
 * - Participate in the execution lifecycle
 */
export interface VesselProvider {
  // =========================================================================
  // IDENTITY
  // =========================================================================

  /** Unique identifier for this vessel instance */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Semantic version */
  readonly version: string;

  /** One-line description */
  readonly description: string;

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  /**
   * Initialize the vessel with shared context
   * Called once when microplastic starts
   *
   * @param context - Shared context including impulse store and config
   * @throws VesselInitError if initialization fails (non-recoverable)
   */
  initialize(context: VesselContext): Promise<void>;

  /**
   * Gracefully shutdown the vessel
   * Called when microplastic exits
   * Should cleanup resources, flush buffers, close connections
   */
  shutdown(): Promise<void>;

  /**
   * Health check - is the vessel operational?
   * Called periodically and on-demand
   */
  healthCheck(): Promise<VesselHealth>;

  // =========================================================================
  // CAPABILITIES
  // =========================================================================

  /**
   * Declare what this vessel can do
   * Used for discovery and routing
   */
  getCapabilities(): VesselCapability[];

  /**
   * Check if this vessel can resolve a specific pointer type
   * Used for resolver routing
   *
   * @param pointer - The impulse pointer to check
   * @returns true if this vessel can resolve this pointer type
   */
  canResolve(pointer: ImpulsePointer): boolean;

  /**
   * Resolve an impulse - load content from pointer
   * Only called if canResolve returned true
   *
   * @param impulse - The impulse to resolve
   * @returns Resolved content (string or structured with metadata)
   * @throws ResolverError if resolution fails
   */
  resolve(impulse: Impulse): Promise<ResolverResult>;

  // =========================================================================
  // ACTIVITIES
  // =========================================================================

  /**
   * Get activity templates provided by this vessel
   * Templates are merged into the global registry
   */
  getActivityTemplates(): ActivityTemplate[];

  /**
   * Get bootstrap templates that cannot be overridden
   * These are registered before user templates
   */
  getBootstrapTemplates?(): ActivityTemplate[];
}
