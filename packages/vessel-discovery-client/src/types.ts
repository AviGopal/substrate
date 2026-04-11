/**
 * Type definitions for @metabob/vessel-discovery-client
 */

/**
 * Logger interface compatible with console and structured loggers
 */
export interface Logger {
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
  debug(message: string, ...args: unknown[]): void
}

/**
 * Configuration for vessel discovery and registration
 */
export interface DiscoveryConfig {
  // === Required Fields ===

  /** Unique vessel identifier */
  vesselId: string

  /** Human-readable vessel name */
  vesselName: string

  /** Vessel's reachable endpoint URL */
  endpoint: string

  /** Impulse shapes this vessel can resolve */
  shapes: string[]

  /** Discovery service endpoint */
  discoveryEndpoint: string

  // === Optional Fields ===

  /** Vessel version (default: "0.0.0") */
  version?: string

  /** Registration TTL in seconds (default: 300) */
  ttl?: number

  /** Heartbeat interval in milliseconds (default: 120000) */
  heartbeatIntervalMs?: number

  /** Communication protocol (default: "http") */
  protocol?: "http" | "grpc" | "ws" | "unix"

  /** Organization ID for multi-tenant isolation */
  orgId?: string

  /** Authentication token */
  authToken?: string

  /** Auth type (default: "Bearer") */
  authType?: "Bearer" | "ApiKey"

  /**
   * Arbitrary metadata - domain-specific, not prescribed.
   * Vessels define what metadata is meaningful for their context.
   */
  metadata?: Record<string, unknown>

  /** Maximum consecutive failures before stopping heartbeat (default: 3) */
  maxConsecutiveFailures?: number

  /** Initial retry delay in ms (default: 1000) */
  initialRetryDelayMs?: number

  /** Maximum retry delay in ms (default: 30000) */
  maxRetryDelayMs?: number

  /** Enable metrics emission (default: true) */
  enableMetrics?: boolean

  /** Custom metrics emitter */
  metricsEmitter?: MetricsEmitter

  /** Logger instance */
  logger?: Logger
}

/**
 * Vessel registration record
 */
export interface VesselRegistration {
  vesselId: string
  vesselName: string
  version: string
  endpoint: string
  shapes: string[]
  protocol?: "http" | "grpc" | "ws" | "unix"
  orgId?: string
  metadata?: Record<string, unknown>
  status?: "healthy" | "degraded" | "unhealthy" | "unknown"
  registeredAt: number
  lastHeartbeat: number
  expiresAt?: number
}

/**
 * Heartbeat response from discovery service
 */
export interface HeartbeatResponse {
  success: boolean
  nextHeartbeatMs: number
}

/**
 * Vessel health status
 */
export interface HealthStatus {
  status: "ok" | "degraded" | "unhealthy"
  vessel: string
  version: string
  uptime: number
  heartbeat: {
    lastSuccess: string | null
    consecutiveFailures: number
    isRunning: boolean
  }
  shapes: string[]
}

/**
 * Vessel capability information
 */
export interface VesselCapability {
  vesselId: string
  vesselName: string
  endpoint: string
  protocol?: string
  confidence: number
  lastSeen: string
  metadata?: Record<string, unknown>
}

/**
 * Discovery query result
 */
export interface DiscoveryResult {
  found: boolean
  shape: string
  vessels: VesselCapability[]
  cached: boolean
}

/**
 * Discovery query options
 */
export interface DiscoveryOptions {
  shape: string
  discoveryEndpoint: string
  authToken?: string
  authType?: "Bearer" | "ApiKey"
  cacheTtlMs?: number
  logger?: Logger
}

/**
 * Metrics emitter interface
 */
export interface MetricsEmitter {
  emit(metric: string, value?: number, tags?: Record<string, string>): void
}

/**
 * Heartbeat metrics payload (optional)
 */
export interface HeartbeatMetrics {
  executionsCompleted?: number
  errorRate?: number
  avgLatencyMs?: number
  [key: string]: unknown
}

/**
 * Registration request payload
 */
export interface RegisterRequest {
  vesselId: string
  vesselName: string
  version: string
  endpoint: string
  shapes: string[]
  protocol?: string
  orgId?: string
  metadata?: Record<string, unknown>
}

/**
 * Registration response
 */
export interface RegisterResponse {
  success: boolean
  vesselId: string
  expiresAt: number
}

/**
 * Heartbeat request payload
 */
export interface HeartbeatRequest {
  vesselId: string
  metrics?: HeartbeatMetrics
}
