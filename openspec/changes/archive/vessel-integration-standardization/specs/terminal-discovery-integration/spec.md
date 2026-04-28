# Specification: Terminal Vessel Discovery Integration

## Overview

This specification defines how the terminal vessel integrates with the discovery-vessel service. Terminal vessel provides stateful PTY management with multi-viewer sync, checkpoints, and replay capabilities. It already has registration infrastructure that needs to be migrated from activity-api to discovery-vessel.

---

## Current State

Terminal vessel already implements:
- Registration with activity-api at `/v2/vessels/register`
- Health endpoint at `GET /health`
- Capabilities endpoint at `GET /v2/vessels/capabilities`
- Impulse resolution at `POST /v2/impulses/resolve`

This spec defines migration to discovery-vessel while maintaining backward compatibility.

---

## ADDED Requirements

### Requirement: Registration with discovery-vessel

Terminal vessel SHALL register with discovery-vessel instead of activity-api.

#### Scenario: Successful registration
- **WHEN** terminal vessel starts and `DISCOVERY_VESSEL_URL` is configured
- **THEN** terminal vessel sends `POST /register` with:
  - `vesselId`: Unique instance identifier (format: `terminal-{hostname}-{pid}`)
  - `vesselName`: "terminal-vessel"
  - `version`: from package.json
  - `endpoint`: External HTTP endpoint
  - `shapes`: `["terminalState", "terminalCommand", "terminalOutput"]`
  - `protocol`: "http"
  - `metadata`: Domain-specific context (see metadata requirement)

#### Scenario: Backward compatibility during migration
- **WHEN** `DISCOVERY_VESSEL_URL` is not configured
- **AND** `ACTIVITY_API_ENDPOINT` is configured
- **THEN** terminal vessel SHALL continue registering with activity-api (legacy path)

#### Scenario: Registration failure is non-fatal
- **WHEN** registration fails
- **THEN** terminal vessel logs a warning and continues operation
- **AND** retries on heartbeat interval

---

### Requirement: Metadata is domain-specific and extensible

Terminal vessel SHALL include domain-specific metadata in registration, but the schema is not prescribed.

#### Scenario: Metadata reflects operational context
- **WHEN** terminal vessel registers
- **THEN** registration metadata MAY include any fields meaningful to the deployment
- **EXAMPLE** (terminal context): `{ "shell": "/bin/zsh", "maxSessions": 10 }`
- **EXAMPLE** (infrastructure): `{ "nodeId": "worker-3", "region": "us-west-2" }`
- **EXAMPLE** (capability hints): `{ "checkpoints": true, "replay": true, "multiViewer": true }`

#### Scenario: Mode as optional metadata
- **WHEN** terminal vessel starts in different modes (HTTP, MCP, dual)
- **THEN** it MAY include mode hints in metadata
- **EXAMPLE**: `{ "modes": ["http", "mcp"] }` or `{ "transport": "http" }`

---

### Requirement: Heartbeat manager

Terminal vessel SHALL send periodic heartbeats to maintain its registration.

#### Scenario: Heartbeat at configured interval
- **WHEN** heartbeat interval elapses (default: 120000ms / 2 minutes)
- **THEN** terminal vessel sends `POST /heartbeat` with:
  - `vesselId`: The registered vessel ID
  - `metrics`: Optional domain-specific metrics

#### Scenario: Metrics are domain-specific
- **WHEN** terminal vessel sends heartbeat metrics
- **THEN** the metrics schema is not prescribed
- **EXAMPLE**: `{ "activeSessions": 3, "totalCommands": 1500 }` or `{ "checkpointCount": 12 }` or no metrics

#### Scenario: Heartbeat failure triggers re-registration
- **WHEN** heartbeat returns 404 Not Found
- **THEN** terminal vessel attempts re-registration

---

### Requirement: Graceful shutdown with deregistration

Terminal vessel SHALL deregister from discovery-vessel when shutting down gracefully.

#### Scenario: SIGTERM triggers deregistration
- **WHEN** terminal vessel receives SIGTERM signal
- **THEN** terminal vessel sends `DELETE /vessels/{vesselId}` before exiting
- **AND** closes all active PTY sessions

#### Scenario: SIGINT triggers deregistration
- **WHEN** terminal vessel receives SIGINT signal
- **THEN** same behavior as SIGTERM

#### Scenario: Deregistration timeout
- **WHEN** deregistration request takes longer than 5 seconds
- **THEN** terminal vessel proceeds with shutdown (best effort deregistration)

---

### Requirement: Health endpoint includes discovery status

#### Scenario: Health check includes discovery state
- **WHEN** `GET /health` is called
- **THEN** response SHALL include `checks.discovery_vessel` with connectivity status

---

## Impulse Shapes

Terminal vessel resolves three impulse shapes:

### terminalState
Complete terminal session state including frame, history, checkpoints.

```typescript
{
  type: "terminalState",
  terminalId: string,
  persistenceKey?: string  // For state restoration
}
```

### terminalCommand
Individual command execution with output and timing.

```typescript
{
  type: "terminalCommand",
  terminalId: string,
  commandId: string
}
```

### terminalOutput
Terminal output buffer/lines with optional ANSI parsing.

```typescript
{
  type: "terminalOutput",
  terminalId: string,
  fromLine: number,
  toLine: number
}
```

---

## Implementation Notes

### Configuration Schema Addition

```typescript
discovery?: {
  endpoint?: string       // Discovery vessel URL (preferred)
  heartbeatMs?: number    // Override heartbeat interval (default: 120000)
  enabled?: boolean       // Enable/disable discovery (default: true)
}

// Legacy fallback
activityApi?: {
  endpoint?: string       // Activity-api URL (deprecated for registration)
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCOVERY_VESSEL_URL` | (none) | Discovery-vessel endpoint (preferred) |
| `ACTIVITY_API_ENDPOINT` | (none) | Activity-api endpoint (legacy fallback) |
| `TERMINAL_VESSEL_EXTERNAL_URL` | (none) | Terminal vessel external URL |

### Migration Path

1. Add `DISCOVERY_VESSEL_URL` support alongside existing registration
2. Prefer discovery-vessel when both are configured
3. Log deprecation warning when using activity-api registration
4. Remove activity-api registration in future version

---

## Usage with Shared Client

```typescript
import { register, createHealthMiddleware } from "@metabob/vessel-discovery-client"

const client = await register({
  vesselId: `terminal-${hostname()}-${process.pid}`,
  vesselName: "terminal-vessel",
  endpoint: process.env.TERMINAL_VESSEL_EXTERNAL_URL,
  shapes: ["terminalState", "terminalCommand", "terminalOutput"],
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_URL,
  // Metadata is domain-specific, not prescribed
  metadata: {
    modes: ["http", "mcp"],
    // whatever is meaningful for your deployment
  }
})

app.get("/health", createHealthMiddleware(client))
```
