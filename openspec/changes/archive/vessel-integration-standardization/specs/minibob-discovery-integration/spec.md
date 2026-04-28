# Specification: MiniBob Discovery-Vessel Integration

## Overview

This specification defines how MiniBob integrates with the discovery-vessel service for dynamic vessel capability registration, heartbeat management, and resolver discovery. MiniBob registers itself as a resolver for local impulse shapes and queries discovery for external resolvers.

---

## ADDED Requirements

### Requirement: Discovery client configuration

MiniBob SHALL support configurable discovery-vessel endpoints through the standard configuration hierarchy.

#### Scenario: Discovery endpoint from environment variable
- **WHEN** `DISCOVERY_VESSEL_ENDPOINT` environment variable is set
- **THEN** MiniBob uses that endpoint for discovery operations

#### Scenario: Discovery endpoint from config file
- **WHEN** config contains `discovery.endpoint`
- **THEN** MiniBob uses that endpoint (if env var not set)

#### Scenario: Default discovery endpoint
- **WHEN** no discovery endpoint is configured
- **THEN** MiniBob defaults to `https://discovery.metabob.com`

#### Scenario: Discovery unavailable at startup
- **WHEN** discovery-vessel is unreachable during MiniBob startup
- **THEN** MiniBob logs a warning and continues with cached/local-only resolution

---

### Requirement: Registration on startup

MiniBob SHALL register with discovery-vessel during bootstrap, advertising the impulse shapes it can resolve locally.

#### Scenario: Successful registration with local shapes
- **WHEN** MiniBob starts with valid configuration and discovery-vessel is reachable
- **THEN** MiniBob sends `POST /register` with payload containing:
  - `vesselId`: Unique instance identifier (format: `minibob-{hostname}-{pid}`)
  - `vesselName`: "minibob"
  - `version`: MiniBob version from package.json
  - `endpoint`: MiniBob's HTTP endpoint
  - `shapes`: `["file", "memo", "directoryTree", "gitDiff", "gitLog", "bash"]`
  - `protocol`: "http"
  - `metadata`: Domain-specific context (see metadata requirement)

#### Scenario: Registration response stored
- **WHEN** discovery-vessel returns `201 Created` with `{ vesselId, expiresAt }`
- **THEN** MiniBob stores the registration state for heartbeat scheduling

#### Scenario: Registration failure is non-fatal
- **WHEN** registration fails with network error or non-2xx response
- **THEN** MiniBob logs a warning, continues startup, and retries on heartbeat interval

---

### Requirement: Metadata is domain-specific and extensible

MiniBob SHALL include domain-specific metadata in registration, but the schema is not prescribed.

#### Scenario: Metadata reflects operational context
- **WHEN** MiniBob registers
- **THEN** registration metadata MAY include any fields meaningful to the deployment
- **EXAMPLE** (software development): `{ "workdir": "/repo", "language": "typescript" }`
- **EXAMPLE** (data processing): `{ "pipeline": "etl", "batchSize": 1000 }`
- **EXAMPLE** (infrastructure): `{ "cluster": "prod-us-west", "nodePool": "high-mem" }`

#### Scenario: Startup mode as metadata (not enum)
- **WHEN** MiniBob starts in different modes (REPL, daemon, single-goal)
- **THEN** it MAY include this as a metadata field
- **NOTE** The field name and values are not prescribed; they are domain-specific
- **EXAMPLE**: `{ "mode": "interactive" }` or `{ "mode": "background" }` or no mode field at all

#### Scenario: Environment metadata
- **WHEN** MiniBob detects its runtime environment
- **THEN** it MAY include environment hints in metadata
- **EXAMPLE**: `{ "environment": "k8s-cluster", "podId": "..." }` or `{ "environment": "local" }`

---

### Requirement: Heartbeat manager

MiniBob SHALL send periodic heartbeats to maintain its registration with discovery-vessel.

#### Scenario: Heartbeat interval from discovery-vessel response
- **WHEN** MiniBob receives registration/heartbeat response with `nextHeartbeatMs`
- **THEN** MiniBob schedules heartbeats at that interval (typically 120000ms / 2 minutes)

#### Scenario: Heartbeat request format
- **WHEN** heartbeat interval elapses
- **THEN** MiniBob sends `POST /heartbeat` with:
  - `vesselId`: The registered vessel ID
  - `metrics`: Optional domain-specific metrics

#### Scenario: Metrics are domain-specific
- **WHEN** MiniBob sends heartbeat metrics
- **THEN** the metrics schema is not prescribed
- **EXAMPLE**: `{ "executionsCompleted": 150, "errorRate": 0.02 }` or `{ "requestsHandled": 500 }` or no metrics

#### Scenario: Heartbeat success resets failure state
- **WHEN** heartbeat returns 200 OK
- **THEN** MiniBob clears any failure state

#### Scenario: Heartbeat failure triggers re-registration
- **WHEN** heartbeat returns 404 Not Found
- **THEN** MiniBob attempts re-registration

#### Scenario: Multiple consecutive failures
- **WHEN** 3 consecutive heartbeats fail
- **THEN** MiniBob attempts re-registration on the next interval

---

### Requirement: Graceful shutdown with deregistration

MiniBob SHALL deregister from discovery-vessel when shutting down gracefully.

#### Scenario: SIGTERM triggers deregistration
- **WHEN** MiniBob receives SIGTERM signal
- **THEN** MiniBob sends `DELETE /vessels/{vesselId}` before exiting

#### Scenario: SIGINT triggers deregistration
- **WHEN** MiniBob receives SIGINT signal (Ctrl+C)
- **THEN** MiniBob sends `DELETE /vessels/{vesselId}` before exiting

#### Scenario: Deregistration timeout
- **WHEN** deregistration request takes longer than 5 seconds
- **THEN** MiniBob proceeds with shutdown (best effort deregistration)

---

### Requirement: Query discovery for external resolvers

MiniBob SHALL query discovery-vessel to find resolvers for impulse shapes it cannot handle locally.

#### Scenario: Discovery query for unknown shape
- **WHEN** MiniBob needs to resolve an impulse with non-local shape
- **THEN** MiniBob sends `POST /resolve` with `{ pointer: { type: "vesselCapability", shape: "<shape>" } }`

#### Scenario: Discovery cache populated
- **WHEN** discovery returns capable vessels
- **THEN** MiniBob caches the vessel-to-shape mapping for 5 minutes

#### Scenario: Discovery returns no vessels
- **WHEN** no vessel can resolve the requested shape
- **THEN** MiniBob falls back to MCP backend resolution (legacy path)

---

### Requirement: Fallback behavior when discovery unavailable

MiniBob SHALL gracefully degrade when discovery-vessel is unavailable.

#### Scenario: Cached endpoints used when discovery offline
- **WHEN** discovery-vessel is unreachable and MiniBob has cached vessel endpoints
- **THEN** MiniBob uses cached endpoints for resolution

#### Scenario: MCP fallback when discovery and cache unavailable
- **WHEN** discovery-vessel is unreachable and no cached endpoints exist
- **THEN** MiniBob falls back to direct MCP backend resolution

#### Scenario: Local shapes always work
- **WHEN** discovery-vessel is unreachable
- **THEN** MiniBob can still resolve local shapes (file, memo, directoryTree, gitDiff, gitLog, bash)

---

## Implementation Notes

### Configuration Schema Addition

```typescript
// In config interfaces
discovery?: {
  endpoint?: string       // Discovery vessel URL
  heartbeatMs?: number    // Override heartbeat interval
  cacheTtlMs?: number     // Override cache TTL
  enabled?: boolean       // Enable/disable discovery
}
```

### Critical Files

- `src/vessel-discovery.ts` - Extend with registration, heartbeat, deregistration
- `src/config.ts` - Add discovery configuration schema
- `index.ts` - Integrate discovery into bootstrap, add shutdown handlers
