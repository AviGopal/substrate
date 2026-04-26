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

  /** HTTP path for impulse resolution on this vessel (default: "/v2/impulses/resolve") */
  resolve_endpoint?: string

  /** Request body format for the resolve endpoint (default: "pointer") */
  resolve_request_format?: ResolveRequestFormat

  /** Auth scheme this vessel expects on resolve calls (default: "none") */
  auth_scheme?: ResolveAuthScheme

  /** Max response time this vessel declares for resolve calls, in ms */
  resolve_timeout_ms?: number

  /** Which credential kind callers should attach when invoking this
   *  vessel's resolve endpoint (default: "caller_identity"). */
  auth_token_source?: AuthTokenSource

  /** How callers obtain the user-bound token they send (default: "forward").
   *  Meaningful only when `auth_token_source === "user_identity"`. */
  auth_delegation_mode?: AuthDelegationMode

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
 * Vessel registration record.
 *
 * The four `resolve_*` fields mirror the contract on `VesselCapability`
 * — what a vessel advertises at registration flows through to what
 * discovery returns in resolve queries. Added 2026-04-24.
 *
 * `auth_token_source` and `auth_delegation_mode` extend that contract
 * with a fifth + sixth field that declare *whose* credential to attach,
 * not just *how* to format it. See
 * `docs/specs/auth-token-source-field.md`. Added 2026-04-23.
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

  /** HTTP path appended to `endpoint` when resolving impulses.
   *  Default when absent: `"/v2/impulses/resolve"`. */
  resolve_endpoint?: string

  /** Shape of the POST body when resolving impulses.
   *  Default when absent: `"pointer"`. */
  resolve_request_format?: ResolveRequestFormat

  /** Authorization header format for calls to this vessel's resolve
   *  endpoint. Default when absent: `"none"`. */
  auth_scheme?: ResolveAuthScheme

  /** Vessel-declared max-time-to-respond on the resolve endpoint, in
   *  milliseconds. No default — clients apply their own policy. */
  resolve_timeout_ms?: number

  /** Which credential kind the caller should attach. Default when absent:
   *  `"caller_identity"` (preserves pre-2026-04-23 behavior). */
  auth_token_source?: AuthTokenSource

  /** How the caller obtains the user-bound token to send. Default when
   *  absent: `"forward"`. Meaningful only when
   *  `auth_token_source === "user_identity"`. */
  auth_delegation_mode?: AuthDelegationMode
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
 * Request body shape expected by a vessel's impulse-resolve endpoint.
 *
 *   "pointer"  — POST body is `{ pointer: { type, ...pointerFields } }`
 *                (the canonical impulse-resolve contract used by
 *                metabob-activity-api and concept-db)
 *   "mcp-tool" — POST body is `{ tool: "${pointer.type}_resolve",
 *                               arguments: pointer }`
 *                (the MCP tool-call shape; used by some vessels that
 *                expose resolution through their MCP tool registry)
 */
export type ResolveRequestFormat = "pointer" | "mcp-tool"

/**
 * Authentication scheme to use when calling a discovered vessel's
 * resolve endpoint. Distinct from the `authType` used to authenticate
 * the discovery query itself — that's a different hop.
 */
export type ResolveAuthScheme = "none" | "ApiKey" | "Bearer"

/**
 * Which credential the caller should attach when invoking a vessel's
 * resolve endpoint. Pairs with `ResolveAuthScheme`, which says *how* to
 * format the Authorization header; this says *whose* token to format.
 *
 * Default when absent: `"caller_identity"` — the caller attaches its own
 * service identity, preserving pre-2026-04-23 behavior.
 *
 *   "caller_identity"  caller's own service token (e.g. METABOB_API_KEY)
 *   "user_identity"    a user JWT the caller is acting on behalf of;
 *                      requires runtime-context plumbing on the caller
 *   "service_identity" alias for caller_identity, future-reserved
 *   "no_token"         vessel explicitly wants no Authorization header,
 *                      even if `auth_scheme` would normally attach one
 *
 * See `docs/specs/auth-token-source-field.md`.
 */
export type AuthTokenSource =
  | "caller_identity"
  | "user_identity"
  | "service_identity"
  | "no_token"

export const DEFAULT_AUTH_TOKEN_SOURCE: AuthTokenSource = "caller_identity"

/**
 * For vessels that advertise `auth_token_source: "user_identity"`,
 * declares how the caller obtains the token to send.
 *
 * Default when absent: `"forward"` — the user JWT the caller already
 * holds in its runtime context is passed through unchanged.
 *
 *   "forward" caller forwards the user JWT it already holds. Requires
 *             a shared trust domain (same issuer, compatible audience).
 *   "mint"    caller asks identity-vessel to mint a target-bound,
 *             short-TTL, single-use delegated token. Used at trust-
 *             domain boundaries or when narrower audience / replay
 *             protection is required.
 *   "none"    vessel does not accept delegation.
 *
 * See `docs/specs/auth-token-source-field.md`.
 */
export type AuthDelegationMode = "forward" | "mint" | "none"

export const DEFAULT_AUTH_DELEGATION_MODE: AuthDelegationMode = "forward"

/**
 * Vessel capability information.
 *
 * The four `resolve_*` fields are the vessel's self-describing resolve
 * contract, added 2026-04-24 so clients can call any vessel generically
 * without per-vessel hardcoded routing. Vessels advertise these at
 * registration; discovery returns them here; clients honor them. All
 * are optional for backward compatibility — clients should apply the
 * documented defaults when a field is absent.
 *
 * `auth_token_source` and `auth_delegation_mode` (added 2026-04-23 per
 * `docs/specs/auth-token-source-field.md`) extend the contract: the
 * vessel declares *whose* credential to attach (caller's service key,
 * a user JWT, etc.), and how the caller obtains it (forward what it
 * already holds, mint a delegated token).
 */
export interface VesselCapability {
  vesselId: string
  vesselName: string
  endpoint: string
  protocol?: string
  confidence: number
  lastSeen: string
  metadata?: Record<string, unknown>

  /** HTTP path appended to `endpoint` when resolving impulses.
   *  Default when absent: `"/v2/impulses/resolve"`. */
  resolve_endpoint?: string

  /** Shape of the POST body when resolving impulses.
   *  Default when absent: `"pointer"`. */
  resolve_request_format?: ResolveRequestFormat

  /** Authorization header format for calls to this vessel's resolve
   *  endpoint. Default when absent: `"none"` (no Authorization header). */
  auth_scheme?: ResolveAuthScheme

  /** Vessel-declared max-time-to-respond on the resolve endpoint, in
   *  milliseconds. No default — clients apply their own policy (typically
   *  5000ms) when absent. */
  resolve_timeout_ms?: number

  /** Which credential kind the caller should attach. Default when absent:
   *  `"caller_identity"` (caller's own service token). */
  auth_token_source?: AuthTokenSource

  /** How the caller obtains the user-bound token to send. Default when
   *  absent: `"forward"`. Meaningful only when
   *  `auth_token_source === "user_identity"`. */
  auth_delegation_mode?: AuthDelegationMode
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
  resolve_endpoint?: string
  resolve_request_format?: ResolveRequestFormat
  auth_scheme?: ResolveAuthScheme
  resolve_timeout_ms?: number
  /** Which credential kind callers should attach. Default: "caller_identity". */
  auth_token_source?: AuthTokenSource
  /** Delegation mode for user-identity tokens. Default: "forward". */
  auth_delegation_mode?: AuthDelegationMode
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
