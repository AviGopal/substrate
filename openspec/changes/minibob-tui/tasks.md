# minibob-tui Implementation Tasks

> **Goal**: Build an impulse-driven TUI that renders the process-of-becoming
> **Critical Path**: Control interface enables testability without visual inspection

---

## Phase 1: Foundation (Testable: Control Interface)

### Milestone 1.1: Control Socket for External Interaction

- [x] Create `src/lib/events.ts` - Event emitter pattern for all event sources
- [x] Create `src/lib/control.ts` - Unix socket server for external interaction
- [x] Implement `getRegions()` query in control interface
- [x] Implement `getInputState()` query in control interface
- [x] Implement `getSnapshot()` query for full state dump
- [x] Implement `injectKey(key)` command in control interface
- [x] Implement `injectKeys(keys[])` command to type strings
- [x] Implement `injectImpulse(impulse)` command
- [x] Create `src/lib/control-client.ts` - Client for connecting to control socket
- [x] Create `test/harness.ts` - Test harness using control client
- [x] Create `test/control.test.ts` - Tests for control interface
- [x] **COMMIT**: `feat(minibob-tui): add control interface for testing`

### Milestone 1.2: Basic Impulse Rendering

- [x] Create `src/lib/regions.ts` - RegionManager class
- [x] Implement `add(impulse)` method in RegionManager
- [x] Implement `update(impulseId, content)` method in RegionManager
- [x] Implement `complete(impulseId)` method in RegionManager
- [x] Implement `remove(impulseId)` method in RegionManager
- [x] Implement `getAll()` and `get(id)` methods
- [x] Create `src/lib/layout.ts` - Priority-based layout algorithm
- [x] Implement `getLayout()` method returning sorted regions
- [x] Create `src/components/BlockComponent.ts` - Generic block component
- [x] Wire RegionManager to control interface
- [x] Update `src/index.ts` to use RegionManager
- [x] Create `test/regions.test.ts` - Tests for region management
- [x] **COMMIT**: `feat(minibob-tui): implement impulse region manager`

---

## Phase 2: Input System (Testable: User Intent Flow)

### Milestone 2.1: Input Impulse Materialization

- [x] Update `src/index.ts` to listen for keypresses at root level
- [x] Implement input impulse creation on first printable key
- [x] Create `src/components/InputComponent.ts` - User input component
- [x] Render InputComponent with priority 1000 (always top)
- [x] Handle Enter key to trigger submit
- [x] Handle Escape key to trigger cancel
- [x] Remove input impulse after submit/cancel
- [x] Add `submit()` and `cancel()` to control interface
- [x] Update control interface to expose input state
- [x] Create `test/input.test.ts` - Tests for input system
- [x] **COMMIT**: `feat(minibob-tui): implement input impulse system`

### Milestone 2.2: Intent Submission to MiniBob

- [x] Update `src/lib/client.ts` - Add goal submission method
- [x] Connect to MiniBob HTTP endpoint on submit
- [x] Call `POST /goal` with user input content
- [x] Handle connection errors gracefully (show error region)
- [x] Remove input impulse after successful submission
- [x] Add MiniBob connection status to control interface
- [x] **COMMIT**: `feat(minibob-tui): connect input to MiniBob`

---

## Phase 3: WebSocket Streaming (Testable: Live Updates)

### Milestone 3.1: MiniBob WebSocket Endpoint (IN MINIBOB REPO)

- [x] Add WebSocket support to MiniBob's Bun.serve configuration
- [x] Create `src/websocket.ts` in MiniBob for WebSocket handler
- [x] Implement client connection tracking (Set of WebSocket clients)
- [x] Add broadcast function to send events to all clients
- [x] Hook ImpulseStore changes to broadcast `impulse:created`
- [x] Hook ImpulseStore changes to broadcast `impulse:updated`
- [x] Hook ImpulseStore changes to broadcast `impulse:deleted`
- [x] Hook ActivityExecutor to broadcast `activity:started`
- [x] Hook ActivityExecutor to broadcast `activity:task-completed`
- [x] Hook ActivityExecutor to broadcast `activity:completed`
- [x] Hook ActivityExecutor to broadcast `activity:failed`
- [x] Test WebSocket with simple client script
- [ ] **COMMIT**: `feat(minibob): add WebSocket endpoint for TUI streaming`

### Milestone 3.2: TUI WebSocket Client

- [x] Create `src/lib/websocket.ts` - WebSocket connection manager
- [x] Implement auto-reconnect with exponential backoff
- [x] Handle `impulse:created` events - create regions
- [x] Handle `impulse:updated` events - update region content
- [x] Handle `impulse:deleted` events - remove regions
- [x] Handle `impulse:completed` events - mark regions complete
- [x] Handle activity lifecycle events (started, completed, failed)
- [x] Add WebSocket connection status to control interface
- [x] Create `test/websocket.test.ts` - Tests for WebSocket handling
- [x] **COMMIT**: `feat(minibob-tui): implement WebSocket client`

---

## Phase 4: Rich Components (Testable: Visual Fidelity)

### Milestone 4.1: Shape-Specific Components

- [x] Create `src/components/factory.ts` - Component factory with shape mapping
- [x] Create `src/components/StreamComponent.ts` - For `log_stream` shape
- [x] Create `src/components/CodeComponent.ts` - For `code_generation` shape
- [x] Create `src/components/ErrorComponent.ts` - For `error` shape
- [x] Create `src/components/TaskListComponent.ts` - For `task_list` shape
- [x] Create `src/components/DiffComponent.ts` - For `diff` shape
- [x] Create `src/components/ConfirmComponent.ts` - For `user_confirmation` shape
- [x] Update RegionManager to use component factory
- [x] Add component type info to control interface snapshots
- [x] Create `test/components.test.ts` - Tests for component factory
- [x] **COMMIT**: `feat(minibob-tui): add shape-specific components`

### Milestone 4.2: Scrolling and Overflow

- [x] Implement scrollDown/scrollUp/scrollToTop/scrollToBottom methods in TUIState
- [x] Handle region resize on content growth (stream components)
- [x] Implement `j` key for scroll down
- [x] Implement `k` key for scroll up
- [x] Implement `G` key for scroll to bottom
- [x] Implement `g` key for scroll to top
- [x] Add scroll position to control interface
- [x] Create `test/scroll.test.ts` - Tests for scrolling
- [x] **COMMIT**: `feat(minibob-tui): implement scrolling`

---

## Phase 5: Full Loop (Testable: End-to-End)

### Milestone 5.1: Complete Flow

- [ ] Verify: User types goal → Input materializes
- [ ] Verify: Submit → MiniBob receives goal
- [ ] Verify: MiniBob executes → Impulses stream to TUI
- [ ] Verify: Regions appear with correct components
- [ ] Verify: Completion → Regions collapse appropriately
- [ ] Create `test/integration.test.ts` - Full end-to-end test
- [ ] Test with multiple concurrent activities
- [ ] Test error handling (MiniBob unavailable, WebSocket disconnect)
- [ ] **COMMIT**: `feat(minibob-tui): complete impulse loop`

### Milestone 5.2: MiniBob Self-Development Integration

- [x] Document how to call MiniBob from Claude Code for TUI development
- [x] Create activity template `templates/tui/add-component.json`
- [x] Create activity template `templates/tui/test-rendering.json`
- [x] Create activity template `templates/tui/add-resolver.json`
- [x] Create activity template `templates/tui/debug-issue.json`
- [ ] Test: MiniBob implements a TUI feature
- [ ] Test: Control socket verifies the implementation
- [x] Create .minibob/vessel.json with TUI capabilities
- [ ] **COMMIT**: `docs(minibob-tui): add self-development guide`

---

## Summary

| Phase | Tasks | Commits |
|-------|-------|---------|
| 1. Foundation | 24 | 2 |
| 2. Input System | 17 | 2 |
| 3. WebSocket | 21 | 2 |
| 4. Rich Components | 19 | 2 |
| 5. Full Loop | 14 | 2 |
| **Total** | **95** | **10** |

**First Priority**: Phase 1, Milestone 1.1 - Control interface enables testing everything else.
