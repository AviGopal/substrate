# Specification: Identity-Vessel Discovery Integration

## Overview

This specification defines how the identity-vessel integrates with the discovery-vessel service. Identity-vessel has a unique bootstrap challenge: it provides authentication services that discovery-vessel may depend on, creating a circular dependency that requires special handling.

---

## ADDED Requirements

### Requirement: Bootstrap window for circular dependency resolution

Identity-vessel SHALL handle the bootstrap circular dependency with discovery-vessel.

#### Scenario: Deferred registration during bootstrap
- **WHEN** identity-vessel starts
- **THEN** it SHALL wait until its own health endpoint returns 200 OK
- **AND** then attempt registration with discovery-vessel

#### Scenario: Discovery-vessel auth validation during bootstrap
- **WHEN** discovery-vessel receives registration from identity-vessel during its own bootstrap
- **AND** identity-vessel is not yet reachable for auth validation
- **THEN** discovery-vessel SHALL accept the registration with a 30-second validation window
- **AND** re-validate after the window expires

#### Scenario: Bootstrap window expiration
- **WHEN** the 30-second bootstrap window expires
- **AND** identity-vessel is still not reachable
- **THEN** discovery-vessel SHALL mark the registration as `status: "unhealthy"`

---

### Requirement: Registration with discovery-vessel

Identity-vessel SHALL register itself as a resolver for authentication impulse shapes.

#### Scenario: Successful registration
- **WHEN** identity-vessel starts and `DISCOVERY_VESSEL_URL` is configured
- **THEN** identity-vessel sends `POST /register` with:
  - `vesselId`: Unique instance identifier (format: `identity-vessel-{instance}`)
  - `vesselName`: "identity-vessel"
  - `version`: from package.json
  - `endpoint`: `IDENTITY_VESSEL_EXTERNAL_URL`
  - `shapes`: `["authToken", "authValidation", "apiKeyValidation", "userIdentity", "orgMembership"]`
  - `protocol`: "http"
  - `metadata`: Domain-specific context (see metadata requirement)

#### Scenario: Registration failure is non-fatal
- **WHEN** registration fails
- **THEN** identity-vessel logs a warning, continues operation, and retries on heartbeat interval
- **NOTE** Identity-vessel MUST remain operational even without discovery registration

---

### Requirement: Metadata is domain-specific and extensible

Identity-vessel SHALL include domain-specific metadata in registration, but the schema is not prescribed.

#### Scenario: Metadata reflects operational context
- **WHEN** identity-vessel registers
- **THEN** registration metadata MAY include any fields meaningful to the deployment
- **EXAMPLE** (auth domain): `{ "authMethods": ["jwt", "apiKey"], "tokenTtlSeconds": 900 }`
- **EXAMPLE** (multi-tenant context): `{ "tenantIsolation": "strict", "maxOrgsPerUser": 10 }`
- **EXAMPLE** (infrastructure context): `{ "region": "us-west-2", "replicaSet": "primary" }`

#### Scenario: Security-sensitive metadata exclusion
- **WHEN** identity-vessel registers
- **THEN** it SHALL NOT include secrets, keys, or sensitive configuration in metadata
- **EXAMPLE** (DO NOT): `{ "jwtSecret": "...", "adminPassword": "..." }`

---

### Requirement: Heartbeat manager

Identity-vessel SHALL send periodic heartbeats to maintain its registration.

#### Scenario: Heartbeat at configured interval
- **WHEN** heartbeat interval elapses (default: 120000ms / 2 minutes)
- **THEN** identity-vessel sends `POST /heartbeat` with:
  - `vesselId`: The registered vessel ID
  - `metrics`: Optional domain-specific metrics

#### Scenario: Metrics are domain-specific
- **WHEN** identity-vessel sends heartbeat metrics
- **THEN** the metrics schema is not prescribed
- **EXAMPLE**: `{ "tokensIssued": 1500, "authFailures": 12 }` or `{ "activeSessionCount": 342 }` or no metrics

#### Scenario: Heartbeat failure handling
- **WHEN** heartbeat fails
- **THEN** identity-vessel SHALL continue operating normally
- **AND** retry registration on next heartbeat interval
- **NOTE** Identity-vessel operation does NOT depend on discovery registration

---

### Requirement: Graceful shutdown with deregistration

Identity-vessel SHALL deregister from discovery-vessel when shutting down gracefully.

#### Scenario: SIGTERM triggers deregistration
- **WHEN** identity-vessel receives SIGTERM signal
- **THEN** identity-vessel sends `DELETE /vessels/{vesselId}` before exiting

#### Scenario: SIGINT triggers deregistration
- **WHEN** identity-vessel receives SIGINT signal
- **THEN** same behavior as SIGTERM

#### Scenario: Deregistration timeout
- **WHEN** deregistration request takes longer than 5 seconds
- **THEN** identity-vessel proceeds with shutdown (best effort deregistration)

---

### Requirement: Health endpoint includes discovery status

#### Scenario: Health check includes discovery state
- **WHEN** `GET /health` is called
- **THEN** response SHALL include `checks.discovery_vessel` with connectivity status
- **AND** overall status SHALL NOT be affected by discovery connectivity
- **NOTE** Identity-vessel health is independent of discovery registration

---

### Requirement: Fallback behavior

Identity-vessel SHALL operate normally even when discovery-vessel is unavailable.

#### Scenario: Operation without discovery
- **WHEN** discovery-vessel is unreachable
- **THEN** identity-vessel SHALL continue providing all authentication services
- **AND** log warnings about discovery unavailability

#### Scenario: Other vessels discovering identity-vessel
- **WHEN** discovery-vessel is unavailable
- **AND** other vessels need authentication services
- **THEN** they SHALL use hardcoded fallback URL (`IDENTITY_VESSEL_FALLBACK_URL`)
- **OR** cached discovery results

---

## Implementation Notes

### Configuration Schema Addition

```typescript
// In config interfaces
discovery?: {
  endpoint?: string       // Discovery vessel URL
  heartbeatMs?: number    // Override heartbeat interval (default: 120000)
  enabled?: boolean       // Enable/disable discovery (default: true)
  bootstrapDelayMs?: number  // Delay before first registration attempt (default: 5000)
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCOVERY_VESSEL_URL` | (none) | Discovery-vessel endpoint |
| `IDENTITY_VESSEL_EXTERNAL_URL` | (none) | Identity-vessel external URL |
| `IDENTITY_VESSEL_FALLBACK_URL` | (none) | Hardcoded fallback for clients |

### Critical Files

- `src/discovery-client.ts` - Registration, heartbeat, deregistration logic
- `src/config.ts` - Add discovery configuration schema
- `src/index.ts` - Integrate discovery into bootstrap (with delay), add shutdown handlers

### Bootstrap Sequence

```
1. Identity-vessel starts
2. Identity-vessel initializes all services
3. Identity-vessel health endpoint returns 200 OK
4. Wait bootstrapDelayMs (default: 5000ms)
5. Attempt registration with discovery-vessel
6. If registration fails, continue operation and retry on heartbeat interval
```

---

## Usage with Shared Client

```typescript
import { register, createHealthMiddleware } from "@metabob/vessel-discovery-client"

// Delay registration until after health is ready
await waitForHealthy()
await sleep(config.discovery.bootstrapDelayMs)

const client = await register({
  vesselId: `identity-vessel-${process.env.INSTANCE_ID}`,
  vesselName: "identity-vessel",
  endpoint: process.env.IDENTITY_VESSEL_EXTERNAL_URL,
  shapes: ["authToken", "authValidation", "apiKeyValidation"],
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_URL,
  // Metadata is domain-specific, not prescribed
  metadata: {
    // whatever is meaningful for your deployment
  }
})

// Health middleware - discovery status doesn't affect overall health
app.get("/health", (c) => {
  const discoveryStatus = client.getHealthStatus()
  return c.json({
    status: "ok",  // Always based on core services, not discovery
    checks: {
      discovery_vessel: discoveryStatus,
      // ... other checks
    }
  })
})
```
