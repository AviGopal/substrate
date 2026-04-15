# React-Renderer Vessel

> **Type**: UI Rendering Vessel
> **Purpose**: Deterministic resolution of ui_component impulses to rendered React primitives
> **Protocol**: HTTP + WebSocket

---

## Overview

React-renderer is a **deterministic UI resolver** that transforms `ui_component` impulses into rendered React primitives. It operates as a "navigation system for the impulse state space" - displaying portions of the shared impulse state to users.

### Core Principles

1. **Deterministic Resolution** - Primitives are composed via rules, not LLM generation
2. **Impulse-Driven Rendering** - UI state IS impulse state; components render impulses directly
3. **Viewport = Budget Allocation** - Screen space is token budget; viewport management is impulse prioritization
4. **Composition Learning** - Thompson Sampling optimizes which UI patterns lead to successful outcomes
5. **Delegation, Not Ownership** - Resolves pointers to data owned by other vessels

### What This Vessel Does NOT Do

- ❌ Generate UI via LLM (primitives are deterministically composed)
- ❌ Execute activities (receives impulses from other vessels)
- ❌ Own data (delegates to vessels where data lives)
- ❌ Maintain separate UI state (renders impulse state directly)

---

## Impulse Types Resolved

React-renderer resolves three impulse shapes locally:

### 1. ui_component (Primary)

**Purpose**: Render primitive compositions as React components

**Pointer Schema**:
```typescript
{
  type: "ui_component",
  componentId: string,
  primitiveType: "container" | "text" | "data-table" | "chart" | "graph" |
                 "input" | "button" | "badge" | "progress" | "code" | "image" | "custom",
  props: Record<string, unknown>,
  position?: {
    mode: "below-input" | "flow" | "center" | "absolute",
    x?: number,
    y?: number
  },
  animation?: {
    type: "fade" | "slide" | "scale" | "none",
    duration?: number
  },
  children?: UiComponentPointer[]
}
```

**Resolution**: Primitive renderer composes primitives into React elements

**Example**:
```typescript
{
  type: "ui_component",
  componentId: "chart-001",
  primitiveType: "chart",
  props: {
    chartType: "line",
    data: [{ time: "10:00", value: 42 }, { time: "10:01", value: 45 }],
    xKey: "time",
    yKey: "value"
  }
}
```

---

### 2. ui_state

**Purpose**: Resolve UI application state paths

**Pointer Schema**:
```typescript
{
  type: "ui_state",
  statePath: string,     // Dot-notation path (e.g., "viewport.width")
  scope?: string         // Optional scope for isolation
}
```

**Resolution**: State store lookup

**Example**:
```typescript
{
  type: "ui_state",
  statePath: "viewport.width",
  scope: "main-dashboard"
}
// Resolves to: 1920
```

---

### 3. viewport_state

**Purpose**: Resolve current viewport configuration

**Pointer Schema**:
```typescript
{
  type: "viewport_state",
  viewportId?: string    // Optional specific viewport
}
```

**Resolution**: Viewport manager state

**Example**:
```typescript
{
  type: "viewport_state"
}
// Resolves to:
{
  width: 1920,
  height: 1080,
  activeImpulses: ["impulse-001", "impulse-002"],
  budgetUsed: 2400,
  budgetRemaining: 47600
}
```

---

## Primitive System

React-renderer supports **12 primitive types** that compose into unbounded visualizations:

| Primitive | Description | Key Props |
|-----------|-------------|-----------|
| `container` | Layouts (vertical, horizontal, grid, absolute) | `layout`, `gap`, `children` |
| `text` | Text variants (heading, body, caption, code) | `variant`, `content`, `color` |
| `data-table` | Tables with pagination and click handlers | `columns`, `data`, `onRowClick` |
| `chart` | Charts (bar, line, pie, scatter, area, gauge, sparkline) | `chartType`, `data`, `xKey`, `yKey` |
| `graph` | Network graphs (force, hierarchical, circular layouts) | `nodes`, `links`, `layout` |
| `input` | Form inputs (text, number, date, select, checkbox, radio) | `type`, `value`, `onChange` |
| `button` | Buttons (primary, secondary, destructive, ghost) | `variant`, `onClick`, `label` |
| `badge` | Status badges (success, warning, error, info, neutral) | `variant`, `label` |
| `progress` | Progress indicators (bar, circle, gauge) | `type`, `value`, `max` |
| `code` | Syntax-highlighted code with line numbers | `language`, `code`, `showLineNumbers` |
| `image` | Images with alt text and dimensions | `src`, `alt`, `width`, `height` |
| `custom` | Custom components with arbitrary props | `componentName`, `props` |

### Composition Example

```typescript
// Complex dashboard composition
{
  type: "ui_component",
  primitiveType: "container",
  props: {
    layout: "grid",
    columns: 2,
    gap: 16,
    children: [
      {
        primitiveType: "chart",
        props: {
          chartType: "line",
          data: metricsData,
          xKey: "time",
          yKey: "value"
        }
      },
      {
        primitiveType: "data-table",
        props: {
          columns: ["Name", "Status", "Duration"],
          data: executionData
        }
      }
    ]
  }
}
```

---

## Activities

React-renderer provides three activities for UI rendering:

### 1. render-impulse-collection

**Purpose**: Render a collection of impulses as UI components

**Input Shapes**:
- `required`: `["ui_component"]`
- `optional`: `["viewport_state"]`

**Output Shapes**:
- `produces`: `["rendered_ui"]`

**Execution**: Deterministic (no LLM)
- Validates primitive composition
- Applies viewport constraints
- Broadcasts WebSocket update

**Template**: `templates/render-impulse-collection.json`

---

### 2. update-from-execution-trace

**Purpose**: Update UI when activity execution progresses

**Input Shapes**:
- `required`: `["activity_execution_trace"]`
- `optional`: `["ui_component"]`

**Output Shapes**:
- `produces`: `["ui_component"]` (progress indicators, status badges)

**Execution**: Deterministic (no LLM)
- Extracts progress from trace
- Generates progress primitives
- Updates existing UI components

**Template**: `templates/update-from-execution-trace.json`

---

### 3. handle-user-interaction

**Purpose**: Convert user events into activity execution

**Input Shapes**:
- `required`: `["ui_event"]`
- `optional`: `["ui_state"]`

**Output Shapes**:
- `produces`: `["activity_goal"]` (triggers activity in other vessels)

**Execution**: Hybrid (LLM for intent, deterministic for routing)
- Deterministic: Button clicks with explicit actions
- LLM: Natural language queries from input field

**Template**: `templates/handle-user-interaction.json`

---

## WebSocket Protocol

### Client → Server Messages

| Type | Description | Payload |
|------|-------------|---------|
| `query` | User query text | `{ id: string, text: string, context?: object }` |
| `action` | Button/component action | `{ componentId: string, action: string, payload?: object }` |
| `viewport` | Viewport dimensions | `{ width: number, height: number }` |
| `ping` | Connection health check | `{}` |

### Server → Client Messages

| Type | Description | Payload |
|------|-------------|---------|
| `connected` | Connection established | `{ sessionId: string, capabilities: string[] }` |
| `thinking` | Processing indicator | `{ queryId: string, message: string }` |
| `impulse_create` | New impulse created | `{ impulse: Impulse }` |
| `impulse_update` | Impulse changed | `{ id: string, patch: object }` |
| `impulse_delete` | Impulse removed | `{ id: string }` |
| `state_sync` | Full state synchronization | `{ impulses: Impulse[] }` |
| `activity_complete` | Activity finished | `{ queryId: string, success: boolean }` |

---

## Configuration

### Environment Variables

Following [STANDARD_CONFIGURATION.md](../../docs/STANDARD_CONFIGURATION.md):

#### Core Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `PORT` | number | No | `3000` | HTTP server port |
| `HOST` | string | No | `0.0.0.0` | Bind address |
| `NODE_ENV` | string | No | `development` | Environment |
| `LOG_LEVEL` | string | No | `info` | Logging level |

#### Discovery Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DISCOVERY_ENABLED` | boolean | No | `false` | Enable discovery integration |
| `DISCOVERY_VESSEL_ENDPOINT` | string | Conditional | - | Discovery service URL (required if enabled) |
| `VESSEL_ENDPOINT` | string | Conditional | `http://{host}:{port}` | This vessel's endpoint (required if discovery enabled) |
| `VESSEL_SHAPES` | string | Conditional | `ui_component,ui_state,viewport_state` | Comma-separated shapes |
| `DISCOVERY_HEARTBEAT_INTERVAL_MS` | number | No | `120000` | Heartbeat interval (2 minutes) |

**Example**:
```bash
export DISCOVERY_ENABLED=true
export DISCOVERY_VESSEL_ENDPOINT=http://discovery-vessel.activity-system.svc.cluster.local:8080
export VESSEL_ENDPOINT=http://react-renderer.activity-system.svc.cluster.local:3000
export VESSEL_SHAPES=ui_component,ui_state,viewport_state
```

#### WebSocket Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `WS_PATH` | string | No | `/ws` | WebSocket endpoint path |
| `WS_MAX_CONNECTIONS` | number | No | `1000` | Max concurrent connections |

### Configuration Files

**Project Configuration** (`.metabob/config.json` in project root):
```json
{
  "discovery": {
    "enabled": true,
    "endpoint": "http://discovery-vessel.activity-system.svc.cluster.local:8080",
    "shapes": ["ui_component", "ui_state", "viewport_state"]
  },
  "websocket": {
    "path": "/ws",
    "maxConnections": 1000
  }
}
```

**Configuration Priority**:
1. Environment variables (highest)
2. Project config (`.metabob/config.json`)
3. Defaults (hardcoded)

---

## Discovery Integration

React-renderer integrates with discovery-vessel using the standard client pattern:

### Registration

On startup, if `DISCOVERY_ENABLED=true`:

```typescript
import { VesselClient } from '@metabob/vessel-discovery-client'

const discoveryClient = new VesselClient({
  vesselId: `react-renderer-${process.env.HOSTNAME}`,
  vesselName: 'react-renderer',
  version: '0.1.0',
  endpoint: process.env.VESSEL_ENDPOINT,
  shapes: ['ui_component', 'ui_state', 'viewport_state'],
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_ENDPOINT,
  heartbeatIntervalMs: parseInt(process.env.DISCOVERY_HEARTBEAT_INTERVAL_MS || '120000'),
  metadata: {
    protocols: ['http', 'websocket'],
    primitiveTypes: [
      'container', 'text', 'data-table', 'chart', 'graph',
      'input', 'button', 'badge', 'progress', 'code', 'image', 'custom'
    ],
    wsPath: process.env.WS_PATH || '/ws'
  }
})

await discoveryClient.start()
```

### Heartbeat

Automatic heartbeat every 2 minutes (configurable):
- Sends `POST /heartbeat` to discovery-vessel
- Includes optional metrics:
  ```typescript
  {
    activeComponents: number,
    wsConnections: number,
    rendersPerSecond: number
  }
  ```
- On 404 response: Attempts re-registration

### Graceful Shutdown

On SIGTERM/SIGINT:
```typescript
process.on('SIGTERM', async () => {
  // 1. Stop accepting new WebSocket connections
  wsServer.close()

  // 2. Deregister from discovery-vessel
  if (discoveryClient) {
    await discoveryClient.stop()  // Sends DELETE /vessels/{vesselId}
  }

  // 3. Close HTTP server
  server.close()

  // 4. Exit
  process.exit(0)
})
```

**Deregistration Timeout**: 5 seconds (best effort)

### Health Endpoint

`GET /health` includes discovery status:

```json
{
  "status": "ok",
  "vessel": "react-renderer",
  "version": "0.1.0",
  "uptime": 3600,
  "impulseCount": 45,
  "resolvers": ["ui_component", "ui_state", "viewport_state"],
  "checks": {
    "discovery": {
      "status": "healthy",
      "registered": true,
      "lastHeartbeat": "2026-04-14T12:00:00.000Z",
      "nextHeartbeat": "2026-04-14T12:02:00.000Z"
    }
  }
}
```

---

## Composition Learning

React-renderer records UI composition patterns for learning:

### What Is Recorded

1. **Primitive Compositions**: Which primitives were composed together
2. **User Interactions**: Which compositions led to user actions
3. **Outcome Success**: Did the interaction achieve the user's goal?

### Metrics Tracked

| Metric | Description | Usage |
|--------|-------------|-------|
| `time_to_action` | Time until user takes action | Measures UI discoverability |
| `interaction_success` | Did action achieve goal? | Thompson Sampling feedback |
| `impulse_utilization` | % of impulses user viewed | Viewport optimization |
| `navigation_efficiency` | Clicks to reach goal | Measures UI effectiveness |

### Thompson Sampling for UI Variants

When multiple composition patterns exist for the same goal:

```
Composition A: container → chart → button (success rate: 85%)
Composition B: container → table → chart (success rate: 72%)
Composition C: grid → chart → table → button (success rate: 91%)

Thompson Sampling selects: Composition C (highest success rate)
```

**Learning Loop**:
1. Activity creates `ui_component` impulse
2. React-renderer renders composition
3. User interacts (or doesn't)
4. Outcome recorded: success/failure
5. Thompson Sampling updates probabilities
6. Future recommendations favor successful patterns

---

## Development

### Local Setup

```bash
cd repos/react-renderer

# Install dependencies
bun install

# Type check
bun run typecheck

# Run tests
bun test

# Start development server (hot reload)
bun run dev

# Production server
bun run start
```

### File Structure

```
repos/react-renderer/
├── package.json
├── vessel.json                    # Vessel manifest
├── CLAUDE.md                      # This file
├── ARCHITECTURE.md                # Detailed architecture
├── src/
│   ├── index.ts                   # HTTP/WebSocket server entry point
│   ├── types.ts                   # TypeScript type definitions
│   ├── resolvers/
│   │   ├── index.ts               # Resolver registry
│   │   ├── ui-component.ts        # Primitive composition resolver
│   │   └── ui-state.ts            # State path resolver
│   ├── primitives/
│   │   ├── index.ts               # Primitive registry
│   │   ├── container.tsx          # Layout primitive
│   │   ├── text.tsx               # Text/markdown primitive
│   │   ├── data-table.tsx         # Table primitive
│   │   ├── chart.tsx              # Chart primitive (recharts)
│   │   ├── graph.tsx              # Network graph primitive
│   │   ├── input.tsx              # Form input primitive
│   │   ├── button.tsx             # Button primitive
│   │   ├── badge.tsx              # Status badge primitive
│   │   ├── progress.tsx           # Progress indicator
│   │   ├── code.tsx               # Syntax-highlighted code
│   │   └── image.tsx              # Image primitive
│   ├── components/
│   │   ├── ImpulseRenderer.tsx    # Main impulse layout renderer
│   │   ├── PrimitiveRenderer.tsx  # Recursive primitive renderer
│   │   └── ViewportManager.tsx    # Viewport/budget management
│   ├── state/
│   │   ├── impulse-store.ts       # Impulse state management
│   │   ├── viewport.ts            # Viewport state
│   │   └── subscriptions.ts       # Pub/sub for updates
│   └── websocket/
│       ├── handler.ts             # WebSocket message handling
│       ├── broadcaster.ts         # Impulse broadcast
│       └── protocol.ts            # Message type definitions
├── templates/                     # Activity templates (JSON)
│   ├── render-impulse-collection.json
│   ├── update-from-execution-trace.json
│   └── handle-user-interaction.json
└── helm/
    └── charts/react-renderer/     # Kubernetes deployment
```

### Testing

```bash
# Unit tests
bun test

# Type checking
bun run typecheck

# Test WebSocket protocol
bun test websocket/protocol.test.ts

# Test primitive rendering
bun test primitives/container.test.tsx
```

### Deployment

**Namespace**: `activity-system`

**Service**: `react-renderer.activity-system.svc.cluster.local:3000`

**External**: `ui.metabob.local`

**Dependencies**:
- discovery-vessel (for registration)
- metabob-activity-api (for activity execution traces)

**Helm Values** (`environments/production.values.yaml`):
```yaml
vessels:
  reactRenderer:
    enabled: true
    image:
      repository: metabobapp/react-renderer
      tag: latest
    replicas: 2
    shapes:
      - ui_component
      - ui_state
      - viewport_state
    discovery:
      enabled: true
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "512Mi"
        cpu: "500m"
    env:
      - name: DISCOVERY_ENABLED
        value: "true"
      - name: DISCOVERY_VESSEL_ENDPOINT
        value: "http://discovery-vessel:8080"
      - name: VESSEL_ENDPOINT
        value: "http://react-renderer:3000"
      - name: VESSEL_SHAPES
        value: "ui_component,ui_state,viewport_state"
```

---

## Key Architectural Decisions

### 1. Separate from internal-dashboard

React-renderer is a **generic UI rendering vessel**. Internal-dashboard is a **specific observability application** that uses react-renderer.

**Rationale**: Separation of concerns enables reuse across different UIs.

---

### 2. WebSocket for Real-Time Updates

Stigmergy pattern: Broadcast impulse changes, clients react independently.

**Rationale**: Decouples UI from backend state changes, enables multi-client support.

---

### 3. No Embedded MiniBob

React-renderer **receives impulses**, it doesn't **execute queries**.

**Rationale**: Clear separation between rendering (this vessel) and execution (minibob).

---

### 4. Primitive-Based Composition

Finite set of composable primitives (12 types), unbounded compositions.

**Rationale**: Deterministic rendering with predictable behavior, no LLM required.

---

### 5. Activity-Driven Updates

All state changes happen via activities, not direct mutations.

**Rationale**: Enables trace recording, composition learning, and reproducibility.

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed technical architecture
- [STANDARD_CONFIGURATION.md](../../docs/STANDARD_CONFIGURATION.md) - Standard vessel configuration
- [Discovery Integration Spec](../../openspec/changes/vessel-integration-standardization/specs/react-renderer-discovery-integration/spec.md) - Discovery integration specification
- [IMPULSE_ACTIVITY_FOUNDATION.md](../../docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) - Foundational model
- [@metabob/vessel-discovery-client](../deployment/vessels/user-vessel/packages/vessel-discovery-client/README.md) - Discovery client package
