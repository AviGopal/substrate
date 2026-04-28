# Shared Impulse State Space Design

## Foundation realignment note (2026-04-27)

This change predates the corrected foundation framing (see `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`) but its core architectural pattern — vessels read/write a shared impulse space rather than calling each other — is fully compatible. The four-primitive minimum set (Impulse, Pointer, Resolver, Vessel) names exactly what this change calls the "shared trace field": impulses with pointers, accessed by resolvers living in vessels.

Several aspects of this change appear to overlap with later wave 2026-04-26+ specs (lifecycle callbacks → `lifecycle:task:*` events; WebSocket broadcast → activity-api WS broadcaster; per-task impulse arrays). Status of this change should be reviewed for retirement-or-merge against the impulse-activity-loop wave; the substrate it builds is largely landed under different names.

The "stigmergy" framing is descriptive and aligns with the foundation's i↔t↔o motions. No structural change required if this spec is kept; flag for human review on whether to retire as superseded.

---

## Overview

This spec defines how vessels (MiniBob, TUI, and future vessels) share state through a unified impulse mechanism. The core insight: **vessels don't call each other—they modify a shared trace field (stigmergy)**.

## Core Architecture

```
        Shared Impulse Space (Trace Field)
              ↑ write       ↑ write
              │             │
          MiniBob          TUI
         (executor)      (renderer)
              │             │
              ↓ read        ↓ read
         [file, bash]    [visual components]
```

### Key Principles (from IMPULSE_ACTIVITY_FOUNDATION.md)

1. **Impulses are universal data** - Everything is an impulse with metadata describing its shape
2. **Stigmergy** - Vessels modify shared environment (trace field); coordination emerges from accumulated modifications
3. **Metadata first, content later** - Reasoners see shape/summary to decide; resolvers load content to execute
4. **Resolvers live where data lives** - Vessels resolve what they have access to; backend resolves historical data
5. **Append-only traces** - Traces are source of truth; patterns derived, not stored separately

## Interface Boundaries

### 1. ImpulseStore (Shared)

The central state container that both vessels reference:

```typescript
interface ImpulseStore extends TypedEventEmitter<ImpulseStoreEvents> {
  // Mutations
  create(impulse: Omit<Impulse, 'id' | 'createdAt'>): Impulse
  update(id: string, patch: Partial<Impulse>): Impulse
  delete(id: string): void

  // Queries
  get(id: string): Impulse | undefined
  getByShape(shape: string): Impulse[]
  getByPriority(): Impulse[]  // Sorted descending
  list(): Impulse[]

  // Lifecycle
  load(id: string): Promise<Impulse>  // Resolve pointer, populate content
  unload(id: string): void            // Free content, keep metadata
}

interface ImpulseStoreEvents {
  'impulse:created': { impulse: Impulse }
  'impulse:updated': { impulse: Impulse; previous: Impulse }
  'impulse:deleted': { impulseId: string }
  'impulse:loaded': { impulseId: string; tokenCount: number }
  'impulse:unloaded': { impulseId: string }
}
```

### 2. MiniBob → ImpulseStore (Emission)

MiniBob emits impulses at lifecycle points:

| Lifecycle Point | Impulse Shape | Priority | Content |
|-----------------|---------------|----------|---------|
| Activity start | `activity` | 800 | `{ name, status: 'running', tasks: [...] }` |
| Task start | `task_update` | 700 | `{ taskId, description, status: 'running' }` |
| Tool called | `tool_call` | 600 | `{ tool, args }` |
| Tool result | `tool_call` | 600 | `{ tool, args, result, success }` |
| LLM streaming | `stream_chunk` | 750 | Appending content |
| State change | `state_transition` | 500 | `{ before, after }` |
| Task complete | `task_update` | 700 | `{ taskId, status: 'complete', result }` |
| Activity complete | `activity` | 800 | `{ name, status: 'complete' }` |
| Error | `error` | 900 | `{ message, type, context }` |

### 3. TUI ← ImpulseStore (Consumption)

TUI subscribes to impulse events and renders by shape:

```typescript
impulseStore.on('impulse:created', (event) => {
  const componentType = getComponentType(event.impulse)
  regionManager.add({
    impulseId: event.impulse.id,
    impulse: event.impulse,
    componentType,
    state: event.impulse.loaded ? 'streaming' : 'loading',
    layout: event.impulse.metadata?.display || { priority: 500 }
  })
})

impulseStore.on('impulse:updated', (event) => {
  regionManager.update(event.impulse.id, event.impulse)
})
```

### 4. Shape → Component Routing

| Shape | Component | Rendering |
|-------|-----------|-----------|
| `user_intent` | InputComponent | Text input box at top |
| `activity` | ActivityComponent | Expandable with task list |
| `task_update` | TaskItemComponent | Nested under activity |
| `tool_call` | ToolCallComponent | Badge with args/result |
| `stream_chunk` | StreamComponent | Appending text |
| `code_generation` | CodeComponent | Syntax highlighted |
| `diff` | DiffComponent | Unified diff format |
| `error` | ErrorComponent | Red box with message |
| `state_transition` | DiffComponent | Before/after |
| *(default)* | BlockComponent | Generic box |

## Data Flow

### Flow 1: User Input → Goal Execution

```
User types "add login"
    ↓
TUI creates impulse: { shape: 'user_intent', content: 'add login', priority: 1000 }
    ↓
ImpulseStore.create() → emits 'impulse:created'
    ↓
TUI renders InputComponent (subscribed to own impulses)
    ↓
User presses Enter
    ↓
TUI updates impulse: { status: 'submitted' }
    ↓
MiniBob (subscribed to 'user_intent' shape) receives event
    ↓
GoalProcessor.executeGoal('add login')
    ↓
MiniBob creates impulse: { shape: 'activity', content: { name: 'debug-error', status: 'running' } }
    ↓
ImpulseStore.create() → emits 'impulse:created'
    ↓
TUI renders ActivityComponent
```

### Flow 2: Activity Execution → Display Updates

```
ActivityExecutor.executeTask(task)
    ↓
MiniBob creates impulse: { shape: 'task_update', content: { taskId, status: 'running' } }
    ↓
LLM generates response with tool calls
    ↓
For each tool call:
    MiniBob creates impulse: { shape: 'tool_call', content: { tool, args } }
    Execute tool
    MiniBob updates impulse: { content: { tool, args, result, success } }
    ↓
TUI renders ToolCallComponent (shows tool badge, then result)
    ↓
Task validation
    ↓
MiniBob updates task impulse: { status: 'complete', result }
    ↓
TUI updates TaskItemComponent (shows checkmark)
```

### Flow 3: LLM Streaming → Real-time Display

```
LLM.stream(prompt)
    ↓
First chunk arrives
    ↓
MiniBob creates impulse: { shape: 'stream_chunk', content: chunk, metadata: { streaming: true } }
    ↓
ImpulseStore.create() → TUI renders StreamComponent
    ↓
More chunks arrive
    ↓
MiniBob updates impulse: { content: existingContent + chunk }
    ↓
ImpulseStore.update() → TUI appends to StreamComponent
    ↓
Final chunk
    ↓
MiniBob updates impulse: { metadata: { streaming: false } }
    ↓
ImpulseStore.update() → TUI marks StreamComponent complete
```

## Database Schema Integration

### New Paradigm Core Tables (Mar 2026)

The backend uses a unified 4-table architecture (from `020-paradigm-core-tables.surql`):

**`impulse` table** - All data with pointers and metadata:
```sql
DEFINE TABLE impulse SCHEMAFULL;
DEFINE FIELD id ON impulse TYPE string;
DEFINE FIELD pointer ON impulse TYPE object;           -- Resolver routing
DEFINE FIELD shape ON impulse TYPE string;             -- Semantic type
DEFINE FIELD summary ON impulse TYPE string;           -- Human/LLM readable
DEFINE FIELD token_estimate ON impulse TYPE int;       -- Estimated load cost
DEFINE FIELD content ON impulse TYPE option<string>;   -- Null = not loaded
DEFINE FIELD org_id ON impulse TYPE record<organizations>;
DEFINE FIELD vessel_id ON impulse TYPE string;         -- Which vessel created
DEFINE FIELD created_at ON impulse TYPE datetime;
DEFINE FIELD expires_at ON impulse TYPE option<datetime>;
```

**`execution` table** - Traces linking inputs to outputs:
```sql
DEFINE TABLE execution SCHEMAFULL;
DEFINE FIELD id ON execution TYPE string;
DEFINE FIELD activity_id ON execution TYPE string;
DEFINE FIELD input_impulses ON execution TYPE array<string>;   -- Consumed
DEFINE FIELD output_impulses ON execution TYPE array<string>;  -- Produced
DEFINE FIELD success ON execution TYPE bool;
DEFINE FIELD duration_ms ON execution TYPE float;
DEFINE FIELD cost_usd ON execution TYPE float;
DEFINE FIELD trace ON execution FLEXIBLE TYPE object;          -- Full trace
DEFINE FIELD org_id ON execution TYPE record<organizations>;
DEFINE FIELD vessel_id ON execution TYPE string;
```

**`vessel` table** - Execution environments with resolver capabilities:
```sql
DEFINE TABLE vessel SCHEMAFULL;
DEFINE FIELD id ON vessel TYPE string;
DEFINE FIELD name ON vessel TYPE string;
DEFINE FIELD resolves ON vessel TYPE array<string>;    -- Which impulse types
DEFINE FIELD is_active ON vessel TYPE bool;
DEFINE FIELD org_id ON vessel TYPE record<organizations>;
```

### Computed Views (replacing stored aggregations)

- `v_activity_score` - Thompson Sampling params per activity
- `v_tool_usage` - Aggregated tool usage patterns
- `v_vessel_activity` - Vessel execution health metrics

### Field Sourcing

| Field | Created By | Stored In | Consumed By |
|-------|------------|-----------|-------------|
| `impulse_id` | MiniBob/TUI | ImpulseStore + Backend | All |
| `pointer` | MiniBob/TUI | ImpulseStore + Backend | Resolvers |
| `content` | Resolver | ImpulseStore (memory only) | TUI renderer |
| `metadata.shape` | MiniBob/TUI | ImpulseStore + Backend | Component factory |
| `metadata.display` | MiniBob/TUI | ImpulseStore | TUI layout |
| `loaded` | ImpulseStore | ImpulseStore | Memory agent |
| `tokenCount` | Resolver | ImpulseStore | Budget enforcement |

### Execution Trace Integration

When activities complete, execution traces include impulse references:

```typescript
interface ExecutionTrace {
  execution_id: string
  activity_id: string
  impulses_used: string[]           // Input impulse IDs
  output_impulses: ImpulseRef[]     // Created impulses
  // ... other fields
}
```

> **Security hardening dependency** (see `openspec/changes/2026-04-26-security-hardening-findings/`):
> - **H1 (two-sided traces)**: Cross-vessel trace events broadcast over WebSocket WILL carry counterparty-signature fields once H1 lands. Downstream consumers of `ExecutionTrace` (TUI regions, ImpulseBridge routing, dashboard subscribers) should treat the signature presence as advisory until that point — i.e., render and route on traces regardless of signature, but record whether `verified_cross_sign` was present so post-hardening analysis can distinguish pre-/post-H1 events.

## Existing Components Status (Updated Mar 2026)

### Working Well (Build On These)

| Component | File | Status |
|-----------|------|--------|
| ImpulseStore | `minibob/src/impulse.ts` | ✅ Full lifecycle, 5-level resolver dispatch |
| RegionManager | `minibob-tui/src/lib/regions.ts` | ✅ Lifecycle, routing, layout |
| ComponentFactory | `minibob-tui/src/components/factory.ts` | ✅ Shape mapping (9 components) |
| TUIState | `minibob-tui/src/lib/state.ts` | ✅ Input, regions, snapshots |
| ResolverRegistry | `minibob-tui/src/lib/resolver-registry.ts` | ✅ NEW - Priority-based, cached |
| ImpulseResolver | `minibob-tui/src/lib/impulse-resolver.ts` | ✅ NEW - Base class + interface |
| ImpulseProvider | `minibob-tui/src/lib/impulse-provider.ts` | ✅ NEW - TUI state as impulses |
| TUI Tools | `minibob-tui/src/lib/tools/*` | ✅ NEW - 6 tools fully implemented |

### Needs Enhancement (Partial Implementation)

| Component | File | Completeness | Gap |
|-----------|------|--------------|-----|
| EmbeddedMiniBob | `minibob-tui/src/lib/embedded-minibob.ts` | 70% | Executor callbacks not wired to events |
| ImpulseBridge | `minibob-tui/src/lib/impulse-bridge.ts` | 60% | Only routes user_intent, no activity routing |
| WebSocket (TUI) | `minibob-tui/src/lib/websocket.ts` | 60% | Connection works, event dispatch to regions missing |
| WebSocket (MiniBob) | `minibob/src/websocket.ts` | 40% | Types defined, broadcast implementation incomplete |
| TUI Resolvers | `minibob-tui/src/lib/resolvers.ts` | 50% | Only TUI input/dialog, no backend types |

### Critical Gaps (Blocking Full Integration)

| Gap | Impact | Required Work |
|-----|--------|---------------|
| ActivityExecutor → Impulse callbacks | No real-time activity progress in TUI | Add callbacks in `activity.ts` |
| MiniBob WebSocket broadcasting | TUI can't receive remote impulse events | Implement broadcast functions |
| TUI WebSocket → region updates | WebSocket events don't create regions | Wire event → regionManager.add() |
| Shape registry constants | Shapes scattered, no single source of truth | Extract to shared module |

## Code Organization

### Strategy: Build on Existing Infrastructure

Most infrastructure already exists. Focus on **wiring** rather than **creating**:

**Already Exists (reuse):**
- `minibob/src/impulse.ts` - ImpulseStore with create/load/unload/delete
- `minibob-tui/src/lib/resolver-registry.ts` - Priority-based resolver registry
- `minibob-tui/src/lib/events.ts` - TypedEventEmitter
- `minibob-tui/src/lib/regions.ts` - RegionManager with state lifecycle

**Needs Extraction (shared module):**
```
repos/minibob/src/shared/
├── shapes.ts        # Shape constants (extract from factory.ts)
├── events.ts        # Event type contracts (consolidate)
└── index.ts         # Re-exports
```

### Required Wiring

**MiniBob** (`repos/minibob/`):
- Add lifecycle callbacks to `ActivityExecutor` in `activity.ts`
- Implement broadcast functions in `websocket.ts`
- Emit impulse events at task/tool/stream lifecycle points

**TUI** (`repos/minibob-tui/`):
- Wire WebSocketManager events → RegionManager
- Wire EmbeddedMiniBob events → RegionManager
- Use shape constants from shared module

### Type Consolidation

Currently 3-4 separate Impulse definitions:
- `minibob/src/types.ts` - Comprehensive (source of truth)
- `minibob-tui/src/types.ts` - Simplified with display hints
- Others with slight variations

**Solution:** TUI imports from MiniBob types, adds display-specific extensions:
```typescript
import { Impulse as BaseImpulse } from '@minibob/types'

interface TUIImpulse extends BaseImpulse {
  metadata: BaseImpulse['metadata'] & {
    display?: ImpulseDisplayHints
  }
}
```

## Error Handling

### Impulse Resolution Errors

```typescript
impulseStore.on('impulse:loaded', ({ impulseId, error }) => {
  if (error) {
    // Create error impulse for display
    impulseStore.create({
      pointer: { type: 'memo', content: error.message },
      metadata: {
        shape: 'error',
        parent: impulseId,
        display: { priority: 900 }
      }
    })
  }
})
```

### Activity Execution Errors

```typescript
executor.on('error', (error, context) => {
  impulseStore.create({
    pointer: { type: 'memo', content: error.stack },
    metadata: {
      shape: 'error',
      display: { priority: 900 },
      context: {
        activityId: context.activityId,
        taskId: context.taskId
      }
    }
  })
})
```

## Testing Strategy

### Unit Tests

1. **ImpulseStore**: Create, update, delete, queries, event emission
2. **Shape routing**: Each shape maps to correct component
3. **Lifecycle**: State transitions are valid

### Integration Tests

1. **User input → activity**: Full flow from typing to activity start
2. **Activity → display**: Task/tool events render correctly
3. **Streaming**: Chunks append correctly
4. **Error handling**: Errors create visible impulses

### E2E Tests

1. **TUI renders MiniBob output**: Start TUI, submit goal, verify regions
2. **Live updates**: Verify real-time rendering during execution
