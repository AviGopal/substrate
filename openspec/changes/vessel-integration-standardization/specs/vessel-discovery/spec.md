# Specification: Vessel Discovery

## Architectural Overview

The discovery-vessel is a **standalone vessel** that resolves discovery-related impulse types. Following the Impulse-Activity Foundation principle that **resolvers live where data lives**, the discovery-vessel holds the registry of vessel capabilities and therefore resolves discovery impulses.

Discovery is not special infrastructure - it is **just another vessel** that happens to resolve discovery impulses. Any vessel can implement these resolvers; this one provides the canonical implementation.

### Foundation Alignment

| Principle | How Discovery-Vessel Implements It |
|-----------|--------------------------------------|
| Impulses are data | Discovery queries are impulse pointers (`vesselCapability`, `vesselEndpoint`, etc.) |
| Resolvers live where data lives | Registry data lives in discovery-vessel, so resolvers live here |
| Vessels are composable | Discovery-vessel is just a vessel, can be replaced or replicated |
| No special cases | Uses the same impulse resolution pattern as everything else |

### Relationship with Activity-API

Activity-API continues to own:
- **Shape registry** (`/v2/shapes/*`) - Central shape definitions with versioning
- **Execution trace storage** - All traces including discovery operations
- **Thompson Sampling** - Learning from execution patterns
- **Health scoring** - Computing vessel health scores from metrics

Discovery-vessel owns:
- **Vessel registry** - In-memory registry of vessel capabilities
- **Heartbeat management** - TTL-based registration lifecycle
- **Capability queries** - Finding vessels by shape

---

## ADDED Requirements

### Requirement: Discovery-vessel provides vessel discovery endpoints

Discovery-vessel SHALL provide HTTP endpoints for vessel registration, discovery, and health tracking.

#### Scenario: Discovery-vessel provides endpoints
- **WHEN** discovery-vessel starts
- **THEN** it SHALL expose HTTP endpoints: `POST /register`, `POST /heartbeat`, `DELETE /vessels/:vesselId`, `POST /resolve`, `GET /health`
- **AND** it SHALL advertise support for shapes: `vesselCapability`, `vesselEndpoint`, `vesselHealth`, `vesselRegistry`

#### Scenario: Discovery can be discovered through itself
- **WHEN** a vessel queries for which vessel can resolve `vesselCapability`
- **THEN** the discovery-vessel SHALL return itself as a capable resolver (self-registration)

### Requirement: VesselRegistration format for capability advertisement

Vessels SHALL register their capabilities using a VesselRegistration format.

#### Scenario: Complete capability registration
- **WHEN** a vessel registers with the discovery-vessel
- **THEN** it SHALL provide a registration object containing:
  - `vesselId` (required): Unique identifier for the vessel
  - `vesselName` (optional, defaults to vesselId): Human-readable name
  - `version` (optional, defaults to "unknown"): Semantic version
  - `endpoint` (required): HTTP URL where the vessel can be reached
  - `shapes` (required): Array of impulse shapes this vessel can resolve
  - `protocol` (optional): Communication protocol ("http", "grpc", "ws", "unix")
  - `orgId` (optional): Organizational scope for multi-tenancy
  - `metadata` (optional): Arbitrary key-value pairs for domain-specific context

#### Scenario: Metadata is extensible and domain-agnostic
- **WHEN** a vessel includes custom metadata fields
- **THEN** the discovery-vessel SHALL preserve and return these fields without validation
- **AND** clients MAY use metadata for custom routing logic
- **EXAMPLE** (software development domain): `{ "role": "development", "language": "typescript" }`
- **EXAMPLE** (infrastructure domain): `{ "region": "us-west-2", "tier": "premium" }`
- **EXAMPLE** (data processing domain): `{ "pipeline": "etl", "maxConcurrency": 10 }`

#### Scenario: Minimal required fields for registration
- **WHEN** a vessel registers with only required fields
- **THEN** the registration SHALL succeed with `vesselId`, `endpoint`, and `shapes` fields populated

#### Scenario: Invalid registration rejected
- **WHEN** a vessel attempts to register with missing required fields
- **THEN** the discovery SHALL return 400 Bad Request with error in standard format:
  ```json
  {
    "loaded": false,
    "error": {
      "code": "INVALID_REGISTRATION",
      "message": "Missing required fields for vessel registration",
      "details": {
        "missing_fields": ["vesselId", "endpoint"],
        "provided_fields": ["shapes"]
      }
    }
  }
  ```

### Requirement: Vessel registration endpoint (POST /register)

The discovery-vessel SHALL provide a `POST /register` endpoint.

#### Scenario: New vessel registration
- **WHEN** a vessel sends `POST /register` with valid registration payload
- **THEN** the discovery-vessel SHALL create a new registration record, set `status` to "healthy", set `lastHeartbeat` to current timestamp, set `expiresAt` to current time + 5 minutes, and return 201 Created

#### Scenario: Registration indexes by shape
- **WHEN** a vessel registers with `shapes: ["file", "memo", "gitDiff"]`
- **THEN** the discovery-vessel SHALL index this vessel under each shape
- **AND** subsequent `vesselCapability` queries for any of these shapes SHALL include this vessel

#### Scenario: Re-registration updates capabilities
- **WHEN** a vessel with existing `vesselId` sends a new registration
- **THEN** the discovery-vessel SHALL update the registration
- **AND** reset the TTL expiration timestamp
- **AND** preserve the original `registeredAt` timestamp

### Requirement: Heartbeat protocol (POST /heartbeat)

Vessels SHALL send periodic heartbeats to maintain their registration.

#### Scenario: Vessel sends heartbeat
- **WHEN** a vessel sends `POST /heartbeat` with `{ vesselId: "my-vessel" }`
- **THEN** the discovery-vessel SHALL update `lastHeartbeat`, reset `expiresAt` to current time + 5 minutes, set `status` to "healthy", and return 200 OK with `{ success: true, nextHeartbeatMs: 120000 }`

#### Scenario: Heartbeat with metrics
- **WHEN** a vessel sends heartbeat with optional metrics
- **THEN** the discovery-vessel SHALL store these metrics in the vessel's metadata for health queries
- **NOTE** Metrics are domain-agnostic; vessels define what metrics are meaningful for their context

#### Scenario: Heartbeat from unregistered vessel
- **WHEN** `POST /heartbeat` is sent with a `vesselId` that does not exist
- **THEN** the discovery-vessel SHALL return 404 Not Found

### Requirement: TTL-based expiration

Vessel registrations SHALL expire if no heartbeat is received within the TTL window.

#### Scenario: Default TTL is 5 minutes
- **WHEN** a vessel registers or sends a heartbeat
- **THEN** its `expiresAt` SHALL be set to current timestamp + 300000ms (5 minutes)

#### Scenario: Expired vessels excluded from queries
- **WHEN** a vessel's `expiresAt` timestamp is in the past
- **THEN** the discovery-vessel SHALL exclude it from all capability, endpoint, and registry queries

#### Scenario: Periodic pruning of expired registrations
- **WHEN** the discovery-vessel runs its cleanup job (every 60 seconds)
- **THEN** it SHALL remove all registrations where current time > `expiresAt`

### Requirement: Graceful deregistration (DELETE /vessels/:vesselId)

Vessels SHALL be able to gracefully deregister when shutting down.

#### Scenario: Vessel deregistration
- **WHEN** a vessel sends `DELETE /vessels/:vesselId`
- **THEN** the discovery-vessel SHALL remove the vessel from the registry and return 200 OK

#### Scenario: Deregistration timeout
- **WHEN** deregistration request takes longer than 5 seconds
- **THEN** vessels SHALL proceed with shutdown (best effort deregistration)
- **NOTE** Default timeout is 5000ms; configurable via `deregistrationTimeoutMs`

#### Scenario: Shutdown signal handlers
- **WHEN** a vessel receives SIGTERM or SIGINT signal
- **THEN** it SHALL attempt deregistration before exiting
- **AND** respect the deregistration timeout

### Requirement: Heartbeat failure handling

Vessels SHALL handle heartbeat failures with re-registration.

#### Scenario: Heartbeat returns 404
- **WHEN** heartbeat returns 404 Not Found
- **THEN** vessel SHALL attempt re-registration immediately

#### Scenario: Consecutive heartbeat failures
- **WHEN** 3 consecutive heartbeats fail (network error or non-2xx response)
- **THEN** vessel SHALL stop heartbeat timer
- **AND** attempt re-registration
- **NOTE** Default threshold is 3; configurable via `maxConsecutiveFailures`

#### Scenario: Exponential backoff on failure
- **WHEN** heartbeat or registration fails
- **THEN** vessel SHALL retry with exponential backoff
- **AND** backoff formula: `min(initialDelay * 2^failures, maxDelay)`
- **NOTE** Default: initialDelay=1000ms, maxDelay=30000ms

### Requirement: Shape definition lookup integration

Discovery endpoints SHALL query Activity-API shape registry for shape metadata to validate compatibility.

#### Scenario: Discovery returns shape compatibility information
- **WHEN** client queries `GET /v2/vessels/discover?shape=error_log`
- **THEN** discovery SHALL look up `error_log` definition in Activity-API `/v2/shapes/error_log`
- **AND** SHALL return only vessels advertising compatible version
- **AND** response SHALL include shape version compatibility matrix
- **AND** client can validate vessel supports required shape version

#### Scenario: Shape not registered in registry
- **WHEN** client queries for shape not in registry
- **THEN** discovery SHALL return 404 Not Found
- **AND** error message SHALL suggest registering shape via `/v2/shapes/register`

#### Scenario: Vessel advertises incompatible shape version
- **WHEN** vessel registers with `error_log@2.0.0` but registry only has `error_log@1.x.x`
- **THEN** discovery SHALL include vessel in results with version mismatch warning
- **AND** client SHALL filter based on version compatibility requirements
- **AND** trace SHALL record version mismatch for analytics

### Requirement: Discovery impulse resolution (POST /resolve) - DEPRECATED

**NOTE**: This requirement is deprecated. Discovery is implemented as standard HTTP REST endpoints, not as impulse resolution. Vessels query discovery via `GET /v2/vessels/discover`, not via impulse pointers.

The discovery-vessel SHALL resolve discovery impulse pointers.

#### Scenario: Resolve vesselCapability impulse
- **WHEN** `POST /resolve` is called with pointer `{ type: "vesselCapability", shape: "k8s_resource" }`
- **THEN** the discovery-vessel SHALL return all registered vessels with that shape in their `shapes` array

#### Scenario: Resolve with metadata filters
- **WHEN** `POST /resolve` is called with pointer including metadata constraints
- **THEN** clients MAY filter the returned vessels based on metadata
- **NOTE** Filtering by metadata is client-side; discovery returns all matching vessels

#### Scenario: Resolve vesselEndpoint impulse
- **WHEN** `POST /resolve` is called with pointer `{ type: "vesselEndpoint", vesselId: "minibob-pod-1" }`
- **THEN** the discovery-vessel SHALL return the endpoint for the specified vessel

#### Scenario: Resolve vesselHealth impulse (cached status)
- **WHEN** `POST /resolve` is called with pointer `{ type: "vesselHealth", vesselId: "...", checkEndpoint: false }`
- **THEN** the discovery-vessel SHALL return cached health status without active probing

#### Scenario: Resolve vesselHealth impulse (active probe)
- **WHEN** `POST /resolve` is called with `checkEndpoint: true`
- **THEN** the discovery-vessel SHALL send a GET request to the vessel's `/health` endpoint

#### Scenario: Resolve vesselRegistry impulse
- **WHEN** `POST /resolve` is called with pointer `{ type: "vesselRegistry" }`
- **THEN** the discovery-vessel SHALL return all registered vessels

### Requirement: Health check endpoint (GET /health)

The discovery-vessel SHALL provide a health check endpoint.

#### Scenario: Health check returns status
- **WHEN** `GET /health` is called
- **THEN** the discovery-vessel SHALL return `{ status: "ok", vessel: "discovery", version: "...", registeredVessels: N, uptime: N }`

### Requirement: Shape introspection endpoints

#### Scenario: List resolvable shapes (GET /shapes)
- **WHEN** `GET /shapes` is called
- **THEN** the discovery-vessel SHALL return the impulse shapes it can resolve: `["vesselCapability", "vesselEndpoint", "vesselHealth", "vesselRegistry"]`

#### Scenario: List registry shapes (GET /registry/shapes)
- **WHEN** `GET /registry/shapes` is called
- **THEN** the discovery-vessel SHALL return all unique shapes registered across all vessels

### Requirement: In-memory registry with shape indexing

The discovery-vessel SHALL maintain an in-memory registry with efficient shape-based lookup.

#### Scenario: Shape index enables efficient lookup
- **WHEN** a `vesselCapability` query arrives for a shape
- **THEN** the discovery-vessel SHALL use its shape index to find matching vessels

#### Scenario: Registry is ephemeral
- **WHEN** the discovery-vessel restarts
- **THEN** the registry SHALL be empty
- **AND** vessels must re-register on their next heartbeat or startup

### Requirement: Simple health model

The discovery-vessel SHALL use a simple health model based on heartbeat status.

#### Scenario: Health status values
- **WHEN** computing a vessel's health
- **THEN** the discovery-vessel SHALL assign one of: "healthy", "degraded", "unhealthy", "unknown"

#### Scenario: Healthy status from recent heartbeat
- **WHEN** a vessel has sent a heartbeat within the last 2 minutes
- **THEN** its status SHALL be "healthy"

---

## Standard Configuration Parameters

All vessels integrating with discovery-vessel SHALL use these default parameters unless explicitly overridden:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `heartbeatIntervalMs` | 120000 (2 min) | Interval between heartbeats |
| `ttlMs` | 300000 (5 min) | Registration TTL before expiration |
| `deregistrationTimeoutMs` | 5000 (5 sec) | Max wait for deregistration on shutdown |
| `maxConsecutiveFailures` | 3 | Failures before attempting re-registration |
| `initialRetryDelayMs` | 1000 (1 sec) | Initial retry delay for exponential backoff |
| `maxRetryDelayMs` | 30000 (30 sec) | Maximum retry delay |
| `cleanupIntervalMs` | 60000 (1 min) | Interval for pruning expired registrations |

These parameters ensure consistent behavior across all vessel integrations and are referenced by the `@metabob/vessel-discovery-client` package.

---

## Design Decisions

### No persistent storage required
The discovery-vessel operates with in-memory storage only. Registrations are ephemeral.

### No authentication required for cluster-internal use
The discovery-vessel operates on a trust model within the cluster. Network policies restrict access. For cross-cluster communication, API key authentication is required.

### Metadata is opaque
The discovery-vessel stores and returns metadata without interpretation. Domain-specific routing logic belongs in clients, not in discovery.

---

## Integration Pattern

```typescript
// Register with discovery-vessel
await fetch(`${DISCOVERY_ENDPOINT}/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    vesselId: `${VESSEL_NAME}-${INSTANCE_ID}`,
    vesselName: VESSEL_NAME,
    version: VESSEL_VERSION,
    endpoint: `http://${POD_IP}:8080`,
    shapes: ["my-shape-1", "my-shape-2"],
    metadata: {
      // Domain-specific, not prescribed
      environment: "production",
      customField: "customValue"
    }
  })
})

// Heartbeat every 2 minutes
setInterval(async () => {
  await fetch(`${DISCOVERY_ENDPOINT}/heartbeat`, {
    method: "POST",
    body: JSON.stringify({
      vesselId: VESSEL_ID,
      metrics: { /* domain-specific */ }
    })
  })
}, 120_000)

// Graceful shutdown
process.on("SIGTERM", async () => {
  await fetch(`${DISCOVERY_ENDPOINT}/vessels/${VESSEL_ID}`, { method: "DELETE" })
  process.exit(0)
})
```
