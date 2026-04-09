# React-Renderer Vessel Architecture

## Overview

React-renderer is a **UI rendering vessel** that resolves UI-related impulses and renders them as React components. It operates as a "navigation system for the impulse state space" - displaying portions of the shared impulse state to users.

## Core Principles

1. **UI State IS Impulse State** - No separate UI state; components render impulses directly
2. **Activities Control Updates** - All UI updates happen via activities, not direct mutations
3. **Viewport = Budget Allocation** - Screen space is token budget; viewport management is impulse prioritization
4. **Learning from Interactions** - Thompson Sampling optimizes which UI patterns lead to success
5. **Delegation, Not Ownership** - Resolves pointers to data owned by other vessels

## Impulse Types Resolved

| Type | Description | Resolution |
|------|-------------|------------|
| `ui_component` | React component with props | Local (primitive composition) |
| `ui_state` | Application state path | Local (state store) |
| `ui_event` | User interaction event | Triggers activity |
| `terminal_snapshot` | Terminal output | Delegates to terminal vessel |
| `viewport_state` | Current viewport config | Local (viewport manager) |

## File Structure

```
repos/react-renderer/
├── package.json
├── vessel.json                    # Vessel manifest
├── src/
│   ├── index.ts                   # Bun HTTP/WebSocket server
│   ├── resolvers/
│   │   ├── index.ts               # Resolver registry
│   │   ├── ui-component.ts        # Primitive composition resolver
│   │   ├── ui-state.ts            # State path resolver
│   │   └── delegating.ts          # Delegation to other vessels
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
│   ├── websocket/
│   │   ├── handler.ts             # WebSocket message handling
│   │   ├── broadcaster.ts         # Impulse broadcast
│   │   └── protocol.ts            # Message type definitions
│   ├── activities/
│   │   ├── executor.ts            # Activity execution engine
│   │   └── templates/
│   │       ├── render-impulse-collection.json
│   │       ├── update-from-execution-trace.json
│   │       └── handle-user-interaction.json
│   └── learning/
│       ├── metrics.ts             # UI interaction metrics
│       └── thompson.ts            # Thompson Sampling for UI variants
├── templates/                     # Activity templates (JSON)
├── sql/
│   └── schemas/
│       └── 001-ui-state.surql     # UI component templates table
└── helm/
    └── charts/react-renderer/     # Kubernetes deployment
```

## WebSocket Protocol

### Client → Server Messages

| Type | Description | Payload |
|------|-------------|---------|
| `query` | User query text | `{ id, text, context? }` |
| `action` | Button/component action | `{ componentId, action, payload }` |
| `viewport` | Viewport dimensions | `{ width, height }` |
| `ping` | Connection health | `{}` |

### Server → Client Messages

| Type | Description | Payload |
|------|-------------|---------|
| `connected` | Connection established | `{ sessionId, capabilities }` |
| `thinking` | Processing indicator | `{ queryId, message }` |
| `impulse_create` | New impulse | `{ impulse }` |
| `impulse_update` | Impulse changed | `{ id, patch }` |
| `impulse_delete` | Impulse removed | `{ id }` |
| `state_sync` | Full state sync | `{ impulses: [...] }` |
| `activity_complete` | Activity finished | `{ queryId, success }` |

## Primitive System

### Unbounded Rendering

MiniBob composes primitives to create any visualization:

```typescript
interface Primitive {
  type: 'container' | 'text' | 'data-table' | 'chart' |
        'graph' | 'input' | 'button' | 'badge' |
        'progress' | 'code' | 'image' | 'custom'
  // Type-specific props
  [key: string]: unknown
}

// Container example
{
  type: 'container',
  layout: 'vertical' | 'horizontal' | 'grid',
  gap: number,
  children: Primitive[]
}

// Chart example
{
  type: 'chart',
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area',
  data: { name: string, value: number }[],
  xKey: string,
  yKey: string
}
```

### Position Modes

```typescript
type PositionMode =
  | { type: 'flow' }           // Normal document flow
  | { type: 'below-input' }    // Below query input
  | { type: 'center' }         // Centered modal
  | { type: 'absolute', x: number, y: number }
```

## Integration Architecture

### MiniBob → React-Renderer Flow

```
MiniBob executes activity
    ↓ creates ui_component impulse
    ↓ broadcasts via WebSocket
React-renderer receives
    ↓ stores in impulse state
    ↓ triggers re-render
PrimitiveRenderer composes
    ↓ renders primitive tree
Browser displays
```

### User Interaction → Activity Flow

```
User clicks button
    ↓ creates ui_event impulse
    ↓ sends via WebSocket
React-renderer receives
    ↓ triggers handle-user-interaction activity
    ↓ activity determines target activity
MiniBob executes
    ↓ creates new ui_component impulses
    ↓ cycle continues
```

## Activities

### render-impulse-collection
Resolves UI impulses and renders them as components.

### update-from-execution-trace
Updates UI when activity execution progresses.

### handle-user-interaction
Converts user events into activity execution.

### update-viewport
Adjusts visible impulses based on user focus.

## Learning Metrics

| Metric | Description |
|--------|-------------|
| `time_to_action` | Time until user takes action |
| `interaction_success` | Did action achieve goal? |
| `impulse_utilization` | % of impulses user viewed |
| `navigation_efficiency` | Clicks to reach goal |

## Deployment

- **Namespace**: `activity-system`
- **Service**: `react-renderer.activity-system.svc.cluster.local:3000`
- **External**: `ui.metabob.local`
- **Dependencies**: surrealdb, metabob-activity-api

## Key Decisions

1. **Separate from internal-dashboard**: React-renderer is generic UI rendering; internal-dashboard is specific observability use case
2. **WebSocket for real-time**: Stigmergy pattern - broadcast changes, clients react independently
3. **No embedded MiniBob**: React-renderer receives impulses, doesn't execute queries
4. **Primitive-based**: Finite set of composable primitives, unbounded compositions
5. **Activity-driven updates**: All state changes via activities, enabling trace recording

## Next Steps

1. [x] Architecture design (this document)
2. [ ] Scaffold vessel structure
3. [ ] Implement primitive renderer
4. [ ] Implement WebSocket handler
5. [ ] Implement ui_component resolver
6. [ ] Create activity templates
7. [ ] Deploy to Kubernetes
8. [ ] Wire to internal-dashboard
