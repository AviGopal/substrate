# Specification: Analysis-API Discovery-Vessel Integration

## Overview

This specification defines how Analysis-API integrates with the discovery-vessel service. Analysis-API registers itself as a resolver for code analysis impulse shapes and can be discovered by other vessels for direct impulse resolution.

---

## ADDED Requirements

### Requirement: Registration on startup

Analysis-API SHALL register with discovery-vessel during bootstrap.

#### Scenario: Successful registration
- **WHEN** Analysis-API starts and `DISCOVERY_VESSEL_URL` is configured
- **THEN** Analysis-API sends `POST /register` with:
  - `vesselId`: Unique instance identifier (format: `analysis-api-{instance}`)
  - `vesselName`: "analysis-api"
  - `version`: from package.json
  - `endpoint`: `ANALYSIS_API_EXTERNAL_URL`
  - `shapes`: `["problem_detection", "error_log", "source_code", "code_quality", "security_scan"]`
  - `protocol`: "http"
  - `metadata`: Domain-specific context (see metadata requirement)

#### Scenario: Registration failure is non-fatal
- **WHEN** registration fails with network error or non-2xx response
- **THEN** Analysis-API logs a warning, continues startup, and retries on heartbeat interval

---

### Requirement: Metadata is domain-specific and extensible

Analysis-API SHALL include domain-specific metadata in registration, but the schema is not prescribed.

#### Scenario: Metadata reflects operational context
- **WHEN** Analysis-API registers
- **THEN** registration metadata MAY include any fields meaningful to the deployment
- **EXAMPLE** (code analysis domain): `{ "languages": ["typescript", "python"], "maxFileSize": 1048576 }`
- **EXAMPLE** (security domain): `{ "scanners": ["sast", "secrets"], "compliance": ["soc2"] }`
- **EXAMPLE** (infrastructure context): `{ "region": "us-east-1", "gpuEnabled": true }`

#### Scenario: Capabilities as metadata
- **WHEN** Analysis-API has specific capabilities enabled
- **THEN** it MAY include capability hints in metadata
- **NOTE** The field names and values are not prescribed; they are domain-specific
- **EXAMPLE**: `{ "features": ["incremental", "caching"] }` or `{ "tier": "premium" }` or no capability fields

---

### Requirement: Heartbeat manager

Analysis-API SHALL send periodic heartbeats to maintain its registration.

#### Scenario: Heartbeat at configured interval
- **WHEN** heartbeat interval elapses (default: 120000ms / 2 minutes)
- **THEN** Analysis-API sends `POST /heartbeat` with:
  - `vesselId`: The registered vessel ID
  - `metrics`: Optional domain-specific metrics

#### Scenario: Metrics are domain-specific
- **WHEN** Analysis-API sends heartbeat metrics
- **THEN** the metrics schema is not prescribed
- **EXAMPLE**: `{ "analysesCompleted": 150, "queueDepth": 3 }` or `{ "cacheHitRate": 0.85 }` or no metrics

#### Scenario: Heartbeat failure triggers re-registration
- **WHEN** heartbeat returns 404 Not Found
- **THEN** Analysis-API attempts re-registration

#### Scenario: Multiple consecutive failures
- **WHEN** 3 consecutive heartbeats fail
- **THEN** Analysis-API attempts re-registration on the next interval

---

### Requirement: Graceful shutdown with deregistration

Analysis-API SHALL deregister from discovery-vessel when shutting down gracefully.

#### Scenario: SIGTERM triggers deregistration
- **WHEN** Analysis-API receives SIGTERM signal
- **THEN** Analysis-API sends `DELETE /vessels/{vesselId}` before exiting

#### Scenario: SIGINT triggers deregistration
- **WHEN** Analysis-API receives SIGINT signal
- **THEN** same behavior as SIGTERM

#### Scenario: Deregistration timeout
- **WHEN** deregistration request takes longer than 5 seconds
- **THEN** Analysis-API proceeds with shutdown (best effort deregistration)

---

### Requirement: Direct impulse resolution endpoint

Analysis-API SHALL expose a direct impulse resolution endpoint for vessel-to-vessel communication.

#### Scenario: Resolve impulse directly
- **WHEN** `POST /v2/impulses/resolve` is called with a supported shape
- **THEN** Analysis-API resolves the impulse and returns the result

#### Scenario: Unsupported shape rejection
- **WHEN** `POST /v2/impulses/resolve` is called with an unsupported shape
- **THEN** Analysis-API returns 400 Bad Request with available shapes

---

### Requirement: Health endpoint includes discovery status

#### Scenario: Health check includes discovery state
- **WHEN** `GET /health` is called
- **THEN** response SHALL include `checks.discovery_vessel` with connectivity status

---

## Implementation Notes

### Configuration Schema Addition

```typescript
// In config interfaces
discovery?: {
  endpoint?: string       // Discovery vessel URL
  heartbeatMs?: number    // Override heartbeat interval (default: 120000)
  enabled?: boolean       // Enable/disable discovery (default: true)
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCOVERY_VESSEL_URL` | (none) | Discovery-vessel endpoint |
| `ANALYSIS_API_EXTERNAL_URL` | (none) | Analysis-API external URL |

### Critical Files

- `src/discovery-client.ts` - Registration, heartbeat, deregistration logic
- `src/config.ts` - Add discovery configuration schema
- `src/index.ts` - Integrate discovery into bootstrap, add shutdown handlers
- `src/routes/impulses.ts` - Direct resolution endpoint

---

## Usage with Shared Client

```typescript
import { register, createHealthMiddleware } from "@metabob/vessel-discovery-client"

const client = await register({
  vesselId: `analysis-api-${process.env.INSTANCE_ID}`,
  vesselName: "analysis-api",
  endpoint: process.env.ANALYSIS_API_EXTERNAL_URL,
  shapes: ["problem_detection", "error_log", "source_code"],
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_URL,
  // Metadata is domain-specific, not prescribed
  metadata: {
    // whatever is meaningful for your deployment
  }
})

app.get("/health", createHealthMiddleware(client))
```
