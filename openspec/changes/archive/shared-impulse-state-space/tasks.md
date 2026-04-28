# Shared Impulse State Space - Task List (Revised)

## Milestone Overview

Since much infrastructure already exists, focus on **wiring** rather than **creating**:

| Milestone | Commit Message | Testable State |
|-----------|---------------|----------------|
| M1 | `feat(minibob): add activity executor impulse callbacks` | Executor emits impulse events (logged) |
| M2 | `feat(minibob): implement websocket broadcast` | Remote clients receive impulse events |
| M3 | `feat(tui): wire websocket events to regions` | TUI renders impulses from WebSocket |
| M4 | `feat(tui): wire embedded-minibob to regions` | Embedded mode renders activity progress |
| M5 | `feat(impulse): add shape constants module` | Shared shapes, type-safe routing |
| M6 | `feat(tui): add streaming impulse support` | LLM streaming shows real-time |

---

## Milestone 1: Activity Executor Impulse Callbacks

**Goal**: Add lifecycle callbacks to ActivityExecutor that emit impulse events.

**Existing**: `minibob/src/activity.ts` has execution logic but no intermediate event emission.

### Tasks

- [ ] **M1.1** Add callback interface to ActivityExecutor config
  ```typescript
  interface ExecutorCallbacks {
    onActivityStarted?: (execId: string, templateId: string, name: string) => void
    onTaskStarted?: (execId: string, taskId: string, description: string) => void
    onToolCalled?: (execId: string, taskId: string, tool: string, args: unknown) => void
    onToolResult?: (execId: string, taskId: string, tool: string, result: ToolResult) => void
    onTaskCompleted?: (execId: string, taskId: string, status: string, output?: string) => void
    onActivityCompleted?: (execution: ActivityExecution) => void
    onActivityFailed?: (execId: string, error: string) => void
  }
  ```

- [ ] **M1.2** Call callbacks at lifecycle points in `executeActivity()`
  - Before first task: `onActivityStarted`
  - Before each task: `onTaskStarted`
  - Before/after tool calls: `onToolCalled`, `onToolResult`
  - After each task: `onTaskCompleted`
  - On success: `onActivityCompleted`
  - On failure: `onActivityFailed`

- [ ] **M1.3** Add integration test
  - Execute activity with mock callbacks
  - Verify all callbacks fired in correct order

**Commit**: `feat(minibob): add activity executor impulse callbacks`

**Testable**: Activity execution logs all lifecycle events

---

## Milestone 2: WebSocket Broadcast Implementation

**Goal**: Implement the broadcast functions declared in `websocket.ts`.

**Existing**: `minibob/src/websocket.ts` has types and function signatures but incomplete implementation.

### Tasks

- [ ] **M2.1** Implement WebSocketManager client tracking
  - `clients: Set<WebSocket>` for active connections
  - `addClient()`, `removeClient()` methods
  - Auto-cleanup on disconnect

- [ ] **M2.2** Implement broadcast functions
  ```typescript
  broadcastImpulseCreated(impulse: Impulse): void
  broadcastImpulseUpdated(id: string, content: unknown): void
  broadcastImpulseDeleted(id: string): void
  broadcastActivityStarted(execId: string, templateId: string, name?: string): void
  broadcastActivityTaskCompleted(execId: string, taskId: string, ...): void
  broadcastActivityCompleted(execution: ActivityExecution): void
  broadcastActivityFailed(execId: string, error: string): void
  ```

- [ ] **M2.3** Wire executor callbacks to broadcast
  - In `index.ts` or goal processor
  - Pass callbacks that call broadcast functions

- [ ] **M2.4** Add message queue for late joiners
  - 100-message buffer (already designed)
  - Replay on new connection

- [ ] **M2.5** Test with WebSocket client
  - Connect to MiniBob WebSocket
  - Submit goal via HTTP
  - Verify events received

**Commit**: `feat(minibob): implement websocket broadcast`

**Testable**: WebSocket client receives activity lifecycle events

---

## Milestone 3: TUI WebSocket → Regions

**Goal**: Wire TUI's WebSocketManager to create/update regions from events.

**Existing**:
- `minibob-tui/src/lib/websocket.ts` - Connection management works
- `minibob-tui/src/lib/regions.ts` - RegionManager fully implemented
- Gap: No wiring between them

### Tasks

- [ ] **M3.1** Create WebSocket event → Region mapper
  ```typescript
  function mapEventToRegion(event: MiniBobWSEvent): Partial<Region> | null
  ```

- [ ] **M3.2** Subscribe to WebSocketManager events in App
  ```typescript
  wsManager.on('event', (event) => {
    switch (event.type) {
      case 'impulse:created':
        regionManager.add(mapImpulseToRegion(event.impulse))
        break
      case 'impulse:updated':
        regionManager.update(event.impulseId, { content: event.content })
        break
      // ... other cases
    }
  })
  ```

- [ ] **M3.3** Map activity events to impulses
  - `activity:started` → create impulse with shape `activity`
  - `activity:task-completed` → update activity impulse
  - `activity:completed` → complete activity region

- [ ] **M3.4** Test remote mode
  - Start MiniBob server
  - Start TUI in remote mode
  - Submit goal
  - Verify regions appear

**Commit**: `feat(tui): wire websocket events to regions`

**Testable**: TUI in remote mode renders activity from server

---

## Milestone 4: TUI Embedded MiniBob → Regions

**Goal**: Wire EmbeddedMiniBob events to RegionManager.

**Existing**:
- `minibob-tui/src/lib/embedded-minibob.ts` - 70% complete, events defined but not wired
- `minibob-tui/src/lib/impulse-bridge.ts` - Bridge exists, partial routing

### Tasks

- [ ] **M4.1** Wire executor callbacks in EmbeddedMiniBob
  - Pass callbacks from MiniBob config
  - Emit EmbeddedMiniBobEvents from callbacks

- [ ] **M4.2** Subscribe to EmbeddedMiniBob events in App
  ```typescript
  embeddedMiniBob.on('activity:started', ({ activityId, name }) => {
    regionManager.add({
      impulseId: activityId,
      componentType: 'ActivityComponent',
      impulse: { metadata: { shape: 'activity' }, content: { name, status: 'running' } }
    })
  })
  ```

- [ ] **M4.3** Handle task-level events
  - `activity:task-started` → add nested task region
  - `activity:task-completed` → update task region status

- [ ] **M4.4** Handle goal events
  - `goal:started` → show "Processing goal..."
  - `goal:completed` → show completion message
  - `goal:failed` → show error region

- [ ] **M4.5** Test embedded mode
  - Start TUI with `--embedded`
  - Submit goal via input
  - Verify activity/task regions render

**Commit**: `feat(tui): wire embedded-minibob to regions`

**Testable**: Embedded mode shows activity progress

---

## Milestone 5: Shape Constants Module

**Goal**: Extract shape constants to shared module for type safety.

**Existing**: Shapes scattered across:
- `minibob-tui/src/components/factory.ts` (hardcoded switch)
- `minibob-tui/src/lib/impulse-bridge.ts` (ROUTABLE_SHAPES)
- Various type definitions

### Tasks

- [ ] **M5.1** Create shape constants file
  ```typescript
  // minibob/src/shared/shapes.ts
  export const SHAPES = {
    USER_INTENT: 'user_intent',
    ACTIVITY: 'activity',
    TASK_UPDATE: 'task_update',
    TOOL_CALL: 'tool_call',
    STREAM_CHUNK: 'stream_chunk',
    CODE_GENERATION: 'code_generation',
    DIFF: 'diff',
    ERROR: 'error',
    STATE_TRANSITION: 'state_transition',
    LOG_STREAM: 'log_stream',
  } as const

  export type Shape = typeof SHAPES[keyof typeof SHAPES]
  ```

- [ ] **M5.2** Add shape metadata registry
  ```typescript
  export const SHAPE_REGISTRY: Record<Shape, ShapeMetadata> = {
    [SHAPES.USER_INTENT]: {
      component: 'InputComponent',
      priority: 1000,
      routable: true,
    },
    // ...
  }
  ```

- [ ] **M5.3** Update TUI factory to use registry
  - Import from shared shapes
  - Replace switch with registry lookup

- [ ] **M5.4** Update impulse-bridge to use constants
  - Replace ROUTABLE_SHAPES array
  - Use registry for routing decisions

- [ ] **M5.5** Export from minibob package
  - Add to package exports
  - TUI imports from minibob

**Commit**: `feat(impulse): add shape constants module`

**Testable**: Shape lookups work, TypeScript enforces valid shapes

---

## Milestone 6: Streaming Impulse Support

**Goal**: Support real-time LLM streaming in TUI.

**Existing**:
- `StreamComponent` exists in TUI
- No streaming flag or chunk handling

### Tasks

- [ ] **M6.1** Add streaming metadata to impulse
  ```typescript
  metadata: {
    shape: 'stream_chunk',
    streaming: true,    // Content still arriving
    parent?: string,    // Parent activity/task impulse
  }
  ```

- [ ] **M6.2** Add LLM stream callbacks to executor
  - `onStreamStart(execId, taskId)` → create stream impulse
  - `onStreamChunk(impulseId, chunk)` → update content
  - `onStreamEnd(impulseId)` → set streaming: false

- [ ] **M6.3** Wire streaming to broadcasts
  - Create impulse on first chunk
  - Update impulse on subsequent chunks
  - Complete impulse on final chunk

- [ ] **M6.4** Update StreamComponent for streaming state
  - Show cursor/indicator while `streaming: true`
  - Hide indicator when complete

- [ ] **M6.5** Optimize update frequency
  - Batch chunks (every 50ms)
  - Debounce TUI re-renders

- [ ] **M6.6** Test streaming
  - Execute activity with LLM
  - Verify content appears progressively
  - Verify completion state

**Commit**: `feat(tui): add streaming impulse support`

**Testable**: LLM output streams in real-time

---

## Task Dependencies

```
M1 (executor callbacks) → M2 (websocket broadcast) → M3 (tui websocket wiring)
          ↓                                                    ↓
          └─────────────────→ M4 (embedded wiring) ←───────────┘
                                      ↓
                              M5 (shape constants)
                                      ↓
                              M6 (streaming)
```

M1 and M2 can proceed in parallel initially, then converge.

## Files Changed by Milestone

| Milestone | Files Modified |
|-----------|----------------|
| M1 | `repos/minibob/src/activity.ts` |
| M2 | `repos/minibob/src/websocket.ts`, `repos/minibob/src/index.ts` |
| M3 | `repos/minibob-tui/src/index.ts`, `repos/minibob-tui/src/lib/websocket.ts` |
| M4 | `repos/minibob-tui/src/lib/embedded-minibob.ts`, `repos/minibob-tui/src/index.ts` |
| M5 | `repos/minibob/src/shared/shapes.ts` (new), `repos/minibob-tui/src/components/factory.ts` |
| M6 | `repos/minibob/src/activity.ts`, `repos/minibob-tui/src/components/StreamComponent.ts` |

## Success Criteria

After M6 completion:

1. **Rich activity display** - Tasks, tool calls visible in TUI
2. **Real-time streaming** - LLM output appears progressively
3. **Both modes work** - Remote (WebSocket) and Embedded
4. **Type-safe shapes** - Shared constants, no string literals
5. **Testable at each milestone** - Working state after each commit
