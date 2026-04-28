# Specification: React-Renderer Vessel Discovery Integration

## Overview

This specification defines how the react-renderer vessel integrates with the discovery-vessel service. React-renderer is a UI rendering vessel that resolves ui_component impulses to rendered React primitives, supporting 12 primitive types with real-time WebSocket updates.

---

## ADDED Requirements

### Requirement: Registration with discovery-vessel

React-renderer SHALL register with discovery-vessel on startup.

#### Scenario: Successful registration
- **WHEN** react-renderer starts and `DISCOVERY_VESSEL_URL` is configured
- **THEN** react-renderer sends `POST /register` with:
  - `vesselId`: Unique instance identifier (format: `react-renderer-{instance}`)
  - `vesselName`: "react-renderer"
  - `version`: from package.json
  - `endpoint`: External HTTP endpoint
  - `shapes`: `["ui_component", "ui_state", "viewport_state"]`
  - `protocol`: "http"
  - `metadata`: Domain-specific context (see metadata requirement)

#### Scenario: Registration failure is non-fatal
- **WHEN** registration fails
- **THEN** react-renderer logs a warning and continues operation
- **AND** retries on heartbeat interval

---

### Requirement: Metadata is domain-specific and extensible

React-renderer SHALL include domain-specific metadata in registration, but the schema is not prescribed.

#### Scenario: Metadata reflects operational context
- **WHEN** react-renderer registers
- **THEN** registration metadata MAY include any fields meaningful to the deployment
- **EXAMPLE** (rendering context): `{ "primitives": ["container", "text", "chart", "graph"], "animations": true }`
- **EXAMPLE** (transport): `{ "protocols": ["http", "websocket"], "wsPath": "/ws" }`
- **EXAMPLE** (capacity): `{ "maxComponents": 1000, "maxDepth": 20 }`

#### Scenario: Primitive capabilities as metadata
- **WHEN** react-renderer has specific primitives enabled
- **THEN** it MAY advertise them in metadata
- **EXAMPLE**: `{ "primitiveTypes": ["container", "text", "data-table", "chart", "graph", "input", "button", "badge", "progress", "code", "image", "custom"] }`

---

### Requirement: Heartbeat manager

React-renderer SHALL send periodic heartbeats to maintain its registration.

#### Scenario: Heartbeat at configured interval
- **WHEN** heartbeat interval elapses (default: 120000ms / 2 minutes)
- **THEN** react-renderer sends `POST /heartbeat` with:
  - `vesselId`: The registered vessel ID
  - `metrics`: Optional domain-specific metrics

#### Scenario: Metrics are domain-specific
- **WHEN** react-renderer sends heartbeat metrics
- **THEN** the metrics schema is not prescribed
- **EXAMPLE**: `{ "activeComponents": 45, "wsConnections": 3 }` or `{ "rendersPerSecond": 12.5 }` or no metrics

#### Scenario: Heartbeat failure triggers re-registration
- **WHEN** heartbeat returns 404 Not Found
- **THEN** react-renderer attempts re-registration

---

### Requirement: Graceful shutdown with deregistration

React-renderer SHALL deregister from discovery-vessel when shutting down gracefully.

#### Scenario: SIGTERM triggers deregistration
- **WHEN** react-renderer receives SIGTERM signal
- **THEN** react-renderer sends `DELETE /vessels/{vesselId}` before exiting
- **AND** closes all WebSocket connections gracefully

#### Scenario: SIGINT triggers deregistration
- **WHEN** react-renderer receives SIGINT signal
- **THEN** same behavior as SIGTERM

#### Scenario: Deregistration timeout
- **WHEN** deregistration request takes longer than 5 seconds
- **THEN** react-renderer proceeds with shutdown (best effort deregistration)

---

### Requirement: Health endpoint includes discovery status

#### Scenario: Health check includes discovery state
- **WHEN** `GET /health` is called
- **THEN** response SHALL include `checks.discovery_vessel` with connectivity status

---

## Impulse Shapes

React-renderer resolves three impulse shapes:

### ui_component (Primary)
Resolves primitive compositions as React components.

```typescript
{
  type: "ui_component",
  componentId: string,
  primitiveType: "container" | "text" | "data-table" | "chart" | "graph" |
                 "input" | "button" | "badge" | "progress" | "code" | "image" | "custom",
  position?: { mode: "below-input" | "flow" | "absolute", ... },
  animation?: { type: "fade" | "slide" | "scale" | "none", ... }
}
```

### ui_state
Resolves UI application state paths.

```typescript
{
  type: "ui_state",
  statePath: string,
  scope?: string
}
```

### viewport_state
Resolves current viewport configuration.

```typescript
{
  type: "viewport_state",
  viewportId?: string
}
```

---

## Primitive Types

React-renderer supports 12 primitive types:

| Primitive | Description |
|-----------|-------------|
| `container` | Layouts: vertical, horizontal, grid, absolute |
| `text` | Variants: heading, subheading, body, caption, code |
| `data-table` | Tables with columns, pagination, click handlers |
| `chart` | Types: bar, line, pie, scatter, area, gauge, sparkline |
| `graph` | Network graphs with force/hierarchical/circular layouts |
| `input` | Types: text, number, date, select, checkbox, radio |
| `button` | Variants: primary, secondary, destructive, ghost |
| `badge` | Variants: success, warning, error, info, neutral |
| `progress` | Types: bar, circle, gauge |
| `code` | Syntax-highlighted with line numbers |
| `image` | With src, alt, dimensions |
| `custom` | Custom components with arbitrary props |

---

## Implementation Notes

### Configuration Schema Addition

```typescript
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
| `REACT_RENDERER_EXTERNAL_URL` | (none) | React-renderer external URL |
| `REACT_RENDERER_WS_PATH` | `/ws` | WebSocket endpoint path |

### Critical Files

- `src/discovery-client.ts` - Registration, heartbeat, deregistration logic
- `src/index.ts` - Integrate discovery into bootstrap, add shutdown handlers
- `vessel.json` - Update with discovery configuration

---

## Usage with Shared Client

```typescript
import { register, createHealthMiddleware } from "@metabob/vessel-discovery-client"

const client = await register({
  vesselId: `react-renderer-${process.env.INSTANCE_ID}`,
  vesselName: "react-renderer",
  endpoint: process.env.REACT_RENDERER_EXTERNAL_URL,
  shapes: ["ui_component", "ui_state", "viewport_state"],
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_URL,
  // Metadata is domain-specific, not prescribed
  metadata: {
    protocols: ["http", "websocket"],
    primitiveTypes: [
      "container", "text", "data-table", "chart", "graph",
      "input", "button", "badge", "progress", "code", "image", "custom"
    ]
  }
})

app.get("/health", createHealthMiddleware(client))
```
