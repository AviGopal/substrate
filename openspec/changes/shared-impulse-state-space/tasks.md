# Shared Impulse State Space - Task List

## Milestone Overview

| Milestone | Commit Message | Testable State |
|-----------|---------------|----------------|
| M1 | `feat(impulse): add shared ImpulseStore with events` | Unit tests pass for store operations |
| M2 | `feat(impulse): add shape registry and constants` | Shape lookups work, types enforce contracts |
| M3 | `feat(minibob): wire executor callbacks to impulse emission` | Activity execution emits impulses (logged) |
| M4 | `feat(tui): subscribe to ImpulseStore for rendering` | TUI renders impulses from store |
| M5 | `feat(tui): add streaming impulse support` | LLM streaming shows real-time in TUI |
| M6 | `feat(tui): wire embedded-minibob to shared store` | Full integration: input → activity → display |

---

## Milestone 1: Shared ImpulseStore

**Goal**: Create the core shared state container with event emission.

### Tasks

- [ ] **M1.1** Create `repos/minibob-impulse/` package structure
  - `package.json` with `@minibob/impulse` name
  - `tsconfig.json` extending root config
  - `src/index.ts` with exports

- [ ] **M1.2** Extract types from `minibob/src/types.ts`
  - Move `Impulse`, `ImpulsePointer`, `ImpulseMetadata` to `src/types/impulse.ts`
  - Add `ImpulseDisplayHints` from TUI types
  - Export unified type definitions

- [ ] **M1.3** Create `TypedEventEmitter` in `src/events/emitter.ts`
  - Move from `minibob-tui/src/lib/events.ts`
  - Add proper TypeScript generics
  - Export for consumers

- [ ] **M1.4** Implement `ImpulseStore` in `src/store/index.ts`
  - `create()`, `update()`, `delete()` with event emission
  - `get()`, `getByShape()`, `getByPriority()`, `list()` queries
  - `load()` with resolver dispatch (stub for now)
  - `unload()` for memory management

- [ ] **M1.5** Add unit tests for ImpulseStore
  - CRUD operations
  - Event emission verification
  - Query filtering

**Commit**: `feat(impulse): add shared ImpulseStore with events`

**Testable**: `bun test repos/minibob-impulse/` passes

---

## Milestone 2: Shape Registry

**Goal**: Centralize shape definitions and metadata.

### Tasks

- [ ] **M2.1** Create shape constants in `src/types/shapes.ts`
  ```typescript
  export const SHAPES = {
    USER_INTENT: 'user_intent',
    ACTIVITY: 'activity',
    TASK_UPDATE: 'task_update',
    TOOL_CALL: 'tool_call',
    STREAM_CHUNK: 'stream_chunk',
    // ... etc
  } as const
  ```

- [ ] **M2.2** Add shape metadata registry
  - `ShapeMetadata` interface with description, resolver type, component type
  - `SHAPE_REGISTRY` constant with all shapes
  - `getShapeMetadata(shape)` function

- [ ] **M2.3** Add shape routing helpers
  - `isRoutableShape(shape)` - shapes that trigger activities
  - `getDefaultPriority(shape)` - priority by shape type
  - `getComponentType(shape)` - for TUI routing

- [ ] **M2.4** Update TUI `factory.ts` to use shape registry
  - Import from `@minibob/impulse`
  - Replace hardcoded switch with registry lookup
  - Keep fallback to BlockComponent

- [ ] **M2.5** Add tests for shape registry
  - All shapes have metadata
  - Component routing works
  - Priority defaults are correct

**Commit**: `feat(impulse): add shape registry and constants`

**Testable**: Shape lookups return correct metadata

---

## Milestone 3: MiniBob Executor Integration

**Goal**: Wire activity executor to emit impulses at lifecycle points.

### Tasks

- [ ] **M3.1** Add `ImpulseStore` to `ActivityExecutor` config
  - Optional dependency (backward compatible)
  - Pass through from `EmbeddedMiniBob`

- [ ] **M3.2** Emit `activity` impulse on start
  ```typescript
  onActivityStarted: (execId, templateId, name) => {
    impulseStore?.create({
      pointer: { type: 'memo', content: { name, status: 'running' } },
      metadata: { shape: SHAPES.ACTIVITY, display: { priority: 800 } }
    })
  }
  ```

- [ ] **M3.3** Emit `task_update` impulses
  - On task start: `{ taskId, description, status: 'running' }`
  - On task complete: update with `{ status: 'complete', result }`

- [ ] **M3.4** Emit `tool_call` impulses
  - Before tool execution: `{ tool, args }`
  - After tool execution: update with `{ result, success }`

- [ ] **M3.5** Update `activity:completed` / `activity:failed` to update impulse
  - Update activity impulse status
  - Don't create new impulse

- [ ] **M3.6** Add integration test
  - Execute activity with mock ImpulseStore
  - Verify impulses created at correct lifecycle points

**Commit**: `feat(minibob): wire executor callbacks to impulse emission`

**Testable**: Activity execution logs impulse creation

---

## Milestone 4: TUI ImpulseStore Subscription

**Goal**: TUI renders from ImpulseStore instead of direct events.

### Tasks

- [ ] **M4.1** Create `ImpulseStoreSubscriber` in TUI
  ```typescript
  class ImpulseStoreSubscriber {
    constructor(store: ImpulseStore, regionManager: RegionManager) {
      store.on('impulse:created', this.handleCreated)
      store.on('impulse:updated', this.handleUpdated)
      store.on('impulse:deleted', this.handleDeleted)
    }
  }
  ```

- [ ] **M4.2** Map impulse events to region operations
  - `created` → `regionManager.add()`
  - `updated` → `regionManager.update()`
  - `deleted` → `regionManager.remove()`

- [ ] **M4.3** Use shape registry for component type
  - Get component type from `getComponentType(impulse.metadata.shape)`
  - Use display hints for layout

- [ ] **M4.4** Wire subscriber into TUI `App`
  - Create ImpulseStore instance
  - Create subscriber with store and regionManager
  - Initialize on startup

- [ ] **M4.5** Add visual test
  - Manually create impulses via store
  - Verify they render correctly

**Commit**: `feat(tui): subscribe to ImpulseStore for rendering`

**Testable**: Creating impulse in store shows in TUI

---

## Milestone 5: Streaming Support

**Goal**: LLM streaming creates real-time updating impulses.

### Tasks

- [ ] **M5.1** Add `streaming` flag to impulse metadata
  ```typescript
  metadata: {
    shape: 'stream_chunk',
    streaming: true,  // Content is still arriving
    parent?: string   // Parent activity/task impulse
  }
  ```

- [ ] **M5.2** Implement streaming in ActivityExecutor
  - Create impulse on first chunk
  - Update impulse on subsequent chunks (append content)
  - Set `streaming: false` on final chunk

- [ ] **M5.3** Update `StreamComponent` to handle streaming state
  - Show cursor/indicator while `streaming: true`
  - Hide indicator when `streaming: false`

- [ ] **M5.4** Optimize update frequency
  - Batch chunks (every 50ms or 10 chunks)
  - Debounce TUI re-renders

- [ ] **M5.5** Add streaming test
  - Simulate LLM stream
  - Verify impulse updates
  - Verify TUI shows progressive content

**Commit**: `feat(tui): add streaming impulse support`

**Testable**: LLM output streams in real-time

---

## Milestone 6: Full Integration

**Goal**: Complete integration of embedded MiniBob with TUI via shared store.

### Tasks

- [ ] **M6.1** Update `EmbeddedMiniBob` to use shared ImpulseStore
  - Accept store in config
  - Pass to ActivityExecutor
  - Remove direct event emission (use store events)

- [ ] **M6.2** Wire user input to ImpulseStore
  - TUI creates `user_intent` impulse on submit
  - MiniBob subscribes to `user_intent` shape
  - Goal processing starts from impulse

- [ ] **M6.3** Remove duplicate event handling
  - Remove `activity:started`, etc. handlers from App
  - All rendering flows through ImpulseStore

- [ ] **M6.4** Add hierarchical impulse rendering
  - Activity impulse shows nested tasks
  - Task impulse shows nested tool calls
  - Use `metadata.parent` for relationships

- [ ] **M6.5** End-to-end test
  - Start TUI with embedded MiniBob
  - Type goal and submit
  - Verify activity renders with tasks
  - Verify tool calls show
  - Verify completion state

- [ ] **M6.6** Performance validation
  - TUI remains responsive during execution
  - No render blocking
  - Scroll works during streaming

**Commit**: `feat(tui): wire embedded-minibob to shared store`

**Testable**: Full flow works: input → activity → display

---

## Task Dependencies

```
M1.1 → M1.2 → M1.3 → M1.4 → M1.5
                              ↓
M2.1 → M2.2 → M2.3 → M2.4 → M2.5
                              ↓
                    M3.1 → M3.2 → M3.3 → M3.4 → M3.5 → M3.6
                                                        ↓
                                          M4.1 → M4.2 → M4.3 → M4.4 → M4.5
                                                                        ↓
                                                          M5.1 → M5.2 → M5.3 → M5.4 → M5.5
                                                                                        ↓
                                                                          M6.1 → M6.2 → M6.3 → M6.4 → M6.5 → M6.6
```

## Files Changed by Milestone

| Milestone | Files Created | Files Modified |
|-----------|--------------|----------------|
| M1 | `repos/minibob-impulse/*` | - |
| M2 | `repos/minibob-impulse/src/types/shapes.ts` | `repos/minibob-tui/src/components/factory.ts` |
| M3 | - | `repos/minibob/src/activity.ts`, `repos/minibob-tui/src/lib/embedded-minibob.ts` |
| M4 | `repos/minibob-tui/src/lib/impulse-subscriber.ts` | `repos/minibob-tui/src/index.ts` |
| M5 | - | `repos/minibob/src/activity.ts`, `repos/minibob-tui/src/components/StreamComponent.ts` |
| M6 | - | `repos/minibob-tui/src/lib/embedded-minibob.ts`, `repos/minibob-tui/src/index.ts` |

## Success Criteria

After M6 completion:

1. **TUI displays rich activity state** - Not just "Hello / Completed" boxes
2. **Real-time updates** - Streaming content, tool calls visible as they happen
3. **Shared state** - One ImpulseStore, multiple consumers
4. **No duplicate code** - Types, events, shapes from shared package
5. **Testable at each milestone** - Working state after each commit
