# Shared Impulse State Space Design

## Overview

This spec defines how vessels (MiniBob, TUI, and future vessels) share state through a unified impulse mechanism. The core insight: **vessels don't call each other—they emit impulses into a shared space**.

## Core Architecture

```
        Shared Impulse Space (ImpulseStore)
              ↑ emit        ↑ emit
              │             │
          MiniBob          TUI
         (executor)      (renderer)
              │             │
              ↓ resolve     ↓ resolve
         [file, bash]    [visual components]
```

### Key Principles

1. **Impulses are universal data** - Everything is an impulse with metadata describing its shape
2. **Shape determines handling** - Vessels resolve/render impulses they understand, ignore others
3. **Event-driven synchronization** - Store emits events; consumers react asynchronously
4. **Non-blocking execution** - TUI render loop and MiniBob execution are independent

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

### Impulse Persistence (Backend)

The backend (`metabob-activity-api`) stores impulses in `impulse_data` table:

```sql
DEFINE TABLE impulse_data SCHEMAFULL;
DEFINE FIELD impulse_id ON impulse_data TYPE string;
DEFINE FIELD pointer ON impulse_data TYPE object;
DEFINE FIELD budget ON impulse_data TYPE int;
DEFINE FIELD priority ON impulse_data TYPE string;
DEFINE FIELD loaded ON impulse_data TYPE bool;
DEFINE FIELD metadata ON impulse_data FLEXIBLE TYPE object;
DEFINE FIELD org_id ON impulse_data TYPE record<organizations>;
DEFINE FIELD created_at ON impulse_data TYPE datetime DEFAULT time::now();
```

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

## Existing Components Status

### Working Well (No Changes Needed)

| Component | File | Status |
|-----------|------|--------|
| RegionManager | `minibob-tui/src/lib/regions.ts` | ✅ Lifecycle, routing, layout |
| ComponentFactory | `minibob-tui/src/components/factory.ts` | ✅ Shape mapping |
| TUIState | `minibob-tui/src/lib/state.ts` | ✅ Input, regions, snapshots |
| WebSocket | `minibob/src/websocket.ts` | ✅ Broadcasting |

### Needs Enhancement

| Component | File | Gap | Fix |
|-----------|------|-----|-----|
| EmbeddedMiniBob | `minibob-tui/src/lib/embedded-minibob.ts` | Events not wired | Wire executor callbacks |
| ActivityExecutor | `minibob/src/activity.ts` | No intermediate events | Add tool/stream events |
| TUI Tools | `minibob-tui/src/lib/tools/handlers.ts` | Impulse creation disconnected | Wire to ImpulseStore |

### Needs Creation

| Component | Purpose |
|-----------|---------|
| `ImpulseStore` | Shared state container with events |
| `ImpulseStoreEvents` | Unified event contracts |
| Shape registry | Constants and metadata for all shapes |

## Code Organization

### Shared Package: `@minibob/impulse`

Extract ~500 lines into shared package:

```
repos/minibob-impulse/
├── src/
│   ├── types/
│   │   ├── impulse.ts      # Impulse, ImpulsePointer, ImpulseMetadata
│   │   ├── shapes.ts       # Shape constants and registry
│   │   └── events.ts       # ImpulseStoreEvents
│   ├── store/
│   │   ├── index.ts        # ImpulseStore implementation
│   │   └── lifecycle.ts    # State machine
│   ├── resolvers/
│   │   ├── base.ts         # ImpulseResolver interface
│   │   ├── registry.ts     # ResolverRegistry
│   │   └── builtin/        # memo, file, mcp resolvers
│   └── events/
│       └── emitter.ts      # TypedEventEmitter
├── package.json
└── tsconfig.json
```

### Consumer Updates

**MiniBob** (`repos/minibob/`):
- Import types from `@minibob/impulse`
- Replace local impulse store with shared
- Wire executor callbacks to emit impulses

**TUI** (`repos/minibob-tui/`):
- Remove duplicate types
- Use shared ImpulseStore
- Subscribe to impulse events for rendering

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
