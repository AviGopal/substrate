# Specification: @metabob/vessel-discovery-client Package

## Overview

A shared TypeScript package providing common vessel discovery and registration functionality for all vessels in the ecosystem. This package extracts patterns currently duplicated across vessels into a single, well-tested library.

---

## Package API

### Module Exports

```typescript
export {
  // Registration
  register,
  VesselClient,

  // Types
  DiscoveryConfig,
  VesselRegistration,
  HeartbeatResponse,
  HealthStatus,
  VesselCapability,
  DiscoveryResult,

  // Health middleware
  createHealthMiddleware,

  // Discovery
  discoverVessels,
  discoverByShape,

  // Metrics
  DiscoveryMetrics,
  MetricsEmitter,
}
```

---

## Configuration

### DiscoveryConfig Interface

```typescript
interface DiscoveryConfig {
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
```

---

## ADDED Requirements

### Requirement: Registration helper

The package SHALL provide a `register()` function that handles vessel registration.

#### Scenario: Basic registration
- **WHEN** `register(config)` is called with valid configuration
- **THEN** the package SHALL send `POST /register` to discovery endpoint
- **AND** start heartbeat timer
- **AND** register signal handlers for graceful shutdown
- **AND** return a VesselClient instance

#### Scenario: Metadata is passed through without validation
- **WHEN** `register()` is called with `metadata` field
- **THEN** the package SHALL include metadata in registration without interpretation
- **NOTE** The package does not validate or prescribe metadata schema

#### Scenario: Registration failure is non-fatal
- **WHEN** initial registration fails
- **THEN** the package SHALL log warning and continue
- **AND** retry on heartbeat intervals

---

### Requirement: Heartbeat manager with exponential backoff

The package SHALL manage heartbeats with automatic retry logic.

#### Scenario: Heartbeat at configured interval
- **WHEN** heartbeat interval elapses
- **THEN** the package SHALL send `POST /heartbeat`

#### Scenario: Heartbeat with optional metrics
- **WHEN** heartbeat is sent
- **THEN** the package SHALL include metrics if provided
- **NOTE** Metrics schema is domain-specific, not prescribed by the package

#### Scenario: Heartbeat failure with backoff
- **WHEN** heartbeat fails
- **THEN** the package SHALL retry with exponential backoff
- **AND** backoff formula: `min(initialDelay * 2^failures, maxDelay)`

#### Scenario: Max failures triggers re-registration
- **WHEN** `maxConsecutiveFailures` consecutive heartbeats fail
- **THEN** the package SHALL stop heartbeat and attempt re-registration

---

### Requirement: Graceful shutdown handler

The package SHALL register signal handlers for graceful shutdown.

#### Scenario: SIGTERM triggers deregistration
- **WHEN** SIGTERM is received
- **THEN** the package SHALL stop heartbeat timer
- **AND** send `DELETE /vessels/:vesselId`
- **AND** allow process to exit

#### Scenario: SIGINT triggers deregistration
- **WHEN** SIGINT is received
- **THEN** same behavior as SIGTERM

#### Scenario: Manual shutdown
- **WHEN** `client.shutdown()` is called
- **THEN** the package SHALL perform graceful shutdown

---

### Requirement: Health endpoint middleware

The package SHALL provide middleware for standard health endpoints.

#### Scenario: Health middleware returns status
- **WHEN** health endpoint is called
- **THEN** middleware SHALL return:
```json
{
  "status": "ok|degraded|unhealthy",
  "vessel": "<vesselId>",
  "version": "<version>",
  "uptime": <seconds>,
  "heartbeat": {
    "lastSuccess": "<timestamp>",
    "consecutiveFailures": <count>,
    "isRunning": <boolean>
  },
  "shapes": ["<shape1>", "<shape2>"]
}
```

---

### Requirement: Discovery client

The package SHALL provide functions to query discovery-vessel.

#### Scenario: Discover by shape
- **WHEN** `discoverByShape({ shape, discoveryEndpoint })` is called
- **THEN** the package SHALL query discovery-vessel
- **AND** cache result for configured TTL
- **AND** return capable vessels

#### Scenario: Discovery with caching
- **WHEN** same shape is queried within cache TTL
- **THEN** the package SHALL return cached result

#### Scenario: Discovery fallback on failure
- **WHEN** discovery-vessel is unreachable
- **THEN** the package SHALL return cached result if available
- **OR** return error if no cache

---

### Requirement: Metrics emission

The package SHALL emit metrics for monitoring.

#### Scenario: Standard metrics emitted
- **WHEN** registration/heartbeat/discovery events occur
- **THEN** the package SHALL emit metrics:
  - `vessel.registration.success`
  - `vessel.registration.failure`
  - `vessel.heartbeat.success`
  - `vessel.heartbeat.failure`
  - `vessel.heartbeat.latency_ms`
  - `vessel.shutdown.clean`
  - `vessel.discovery.success`
  - `vessel.discovery.cache_hit`

#### Scenario: Custom metrics emitter
- **WHEN** `metricsEmitter` is provided in config
- **THEN** the package SHALL use that emitter instead of default

---

## Type Definitions

```typescript
interface VesselRegistration {
  vesselId: string
  vesselName: string
  version: string
  endpoint: string
  shapes: string[]
  protocol?: "http" | "grpc" | "ws" | "unix"
  orgId?: string
  metadata?: Record<string, unknown>  // Domain-specific, opaque
  status?: "healthy" | "degraded" | "unhealthy" | "unknown"
  registeredAt: number
  lastHeartbeat: number
  expiresAt?: number
}

interface HeartbeatResponse {
  success: boolean
  nextHeartbeatMs: number
}

interface VesselCapability {
  vesselId: string
  vesselName: string
  endpoint: string
  protocol?: string
  confidence: number
  lastSeen: string
  metadata?: Record<string, unknown>  // Preserved from registration
}

interface DiscoveryResult {
  found: boolean
  shape: string
  vessels: VesselCapability[]
  cached: boolean
}

class VesselClient {
  readonly config: DiscoveryConfig
  get isRunning(): boolean
  get lastHeartbeat(): Date | null
  get consecutiveFailures(): number

  register(): Promise<boolean>
  heartbeat(): Promise<boolean>
  getHealthStatus(): HealthStatus
  shutdown(): Promise<void>
}
```

---

## Package Structure

```
packages/vessel-discovery-client/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Main exports
│   ├── client.ts          # VesselClient class
│   ├── config.ts          # Configuration validation
│   ├── discovery.ts       # Discovery functions
│   ├── health.ts          # Health middleware
│   ├── metrics.ts         # Metrics emitter
│   ├── types.ts           # Type definitions
│   └── utils/
│       ├── backoff.ts     # Exponential backoff
│       └── http.ts        # HTTP client wrapper
└── tests/
```

---

## Usage Example

```typescript
import { register, createHealthMiddleware } from "@metabob/vessel-discovery-client"

const client = await register({
  vesselId: "my-vessel-1",
  vesselName: "My Vessel",
  endpoint: "http://my-vessel:8080",
  shapes: ["my-shape"],
  discoveryEndpoint: "http://discovery:8080",
  // Metadata is domain-specific, not prescribed
  metadata: {
    customField: "customValue",
    // whatever is meaningful for your domain
  }
})

// Standard health endpoint
app.get("/health", createHealthMiddleware(client))
```
