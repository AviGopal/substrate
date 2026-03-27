# minibob-tui Vessel Completion - Implementation Tasks

> **Goal**: Enable bidirectional flow so activities can observe and control the TUI
> **Strategy**: Colocate related functionality for coherent commit milestones

---

## Phase 6: Tool Infrastructure

**Milestone:** Working tool schemas that can be tested in isolation

**Commit:** `feat(minibob-tui): add TUI tool schema definitions`

### Tasks

#### 6.1: Directory Structure
- [x] Create `src/lib/tools/` directory
- [x] Create `test/tools/` directory

#### 6.2: Zod Schemas
- [x] Create `src/lib/tools/schemas.ts`
- [x] Define `tui_observe` schema (query: regions|input|scroll|all, regionId?)
- [x] Define `tui_render` schema (format: text|ansi, region?)
- [x] Define `tui_inject` schema (type: key|keys|command, value)
- [x] Define `tui_wait_for` schema (condition, regionId?, text?, timeout)
- [x] Define `tui_snapshot` schema (includeRender)
- [x] Export `TUITools` const with all schemas

#### 6.3: TypeScript Types
- [x] Create `src/lib/tools/types.ts`
- [x] Export `TUIToolName` union type
- [x] Export input/output types inferred from Zod schemas

#### 6.4: JSON Schema Export
- [x] Create `src/lib/tools/definitions.ts`
- [x] Add `zod-to-json-schema` dependency
- [x] Implement `getTUIToolDefinitions()` returning `ToolDefinition[]`

#### 6.5: Barrel Export
- [x] Create `src/lib/tools/index.ts`
- [x] Export all schemas, types, definitions

#### 6.6: Schema Tests
- [x] Create `test/tools/schemas.test.ts`
- [x] Test valid/invalid inputs for each tool schema
- [x] Test JSON schema conversion

**Verification:** `bun test test/tools/schemas.test.ts`

---

## Phase 7: Control Socket Tools (Observable TUI)

**Milestone:** External processes can query TUI state

**Commit:** `feat(minibob-tui): implement tui_observe and tui_snapshot tools`

### Tasks

#### 7.1: Handler Infrastructure
- [x] Create `src/lib/tools/handlers.ts`
- [x] Define `TUIToolContext` interface (state, control, renderCapture)
- [x] Create `TUIToolHandlers` class
- [x] Implement `handleTool(name, input)` dispatcher with try/catch

#### 7.2: tui_observe Implementation
- [x] Implement `tuiObserve(input)` handler
- [x] Support `query: "regions"` - return region list
- [x] Support `query: "input"` - return input state
- [x] Support `query: "scroll"` - return scroll position
- [x] Support `query: "all"` - return complete state
- [x] Support `regionId` filter parameter

#### 7.3: tui_snapshot Implementation
- [x] Implement `tuiSnapshot(input)` handler
- [x] Get full TUIState.getSnapshot()
- [x] Add WebSocket connection status
- [x] Support `includeRender` option (stub for now)

#### 7.4: Tests
- [x] Create `test/tools/observe.test.ts`
- [x] Create `test/tools/snapshot.test.ts`
- [x] Test all query types and edge cases

**Verification:** `bun test test/tools/observe.test.ts test/tools/snapshot.test.ts`

---

## Phase 8: Action Tools (Controllable TUI)

**Milestone:** External processes can inject input and wait for conditions

**Commit:** `feat(minibob-tui): implement tui_inject and tui_wait_for tools`

### Tasks

#### 8.1: tui_inject Implementation
- [x] Implement `tuiInject(input)` handler
- [x] Support `type: "key"` - single keypress
- [x] Support `type: "keys"` - type string character by character
- [x] Support `type: "command"` - named commands
- [x] Implement `handleCommand(command)` helper (submit, cancel, scroll_*)
- [x] Return resulting input state after injection

#### 8.2: tui_wait_for Implementation
- [x] Implement `tuiWaitFor(input)` handler
- [x] Support `condition: "region_appears"` with polling
- [x] Support `condition: "region_completes"`
- [x] Support `condition: "input_inactive"`
- [x] Implement polling loop with 50ms interval
- [x] Respect timeout parameter (default 5000ms)
- [x] Return `met`, `timedOut`, `waitTime`

#### 8.3: Tests
- [x] Create `test/tools/inject.test.ts`
- [x] Create `test/tools/wait-for.test.ts`
- [x] Test key injection, commands, timeouts

**Verification:** `bun test test/tools/inject.test.ts test/tools/wait-for.test.ts`

---

## Phase 9: Render Capture (Visual Verification)

**Milestone:** Can capture terminal output as text or ANSI

**Commit:** `feat(minibob-tui): implement tui_render tool with text/ANSI capture`

### Tasks

#### 9.1: Capture Infrastructure
- [x] Create `src/lib/tools/render-capture.ts`
- [x] Define `CaptureOptions` interface (format, regionId?)
- [x] Define `CaptureResult` interface (content, width, height, timestamp)
- [x] Create `RenderCapture` class with TUIState dependency

#### 9.2: Text Capture Implementation
- [x] Implement `captureSync(options)` method
- [x] Get terminal dimensions from process.stdout
- [x] Get and filter regions by regionId
- [x] Sort regions by priority (descending)
- [x] Render each region using createComponent()
- [x] Implement `stripAnsi(text)` helper for text format

#### 9.3: ANSI Capture Implementation
- [x] Support `format: "ansi"` - preserve ANSI codes
- [x] Support `format: "text"` - strip ANSI codes
- [x] Test with colored components

#### 9.4: tui_render Handler
- [x] Implement `tuiRender(input)` handler in handlers.ts
- [x] Wire to RenderCapture instance

#### 9.5: Tests
- [x] Create `test/tools/render-capture.test.ts`
- [x] Create `test/tools/render.test.ts`
- [x] Test text/ANSI formats, regional capture

**Verification:** `bun test test/tools/render-capture.test.ts test/tools/render.test.ts`

---

## Phase 10: EmbeddedMiniBob Integration (Activity Tools Working)

**Milestone:** Activities executing in EmbeddedMiniBob can call TUI tools

**Commit:** `feat(minibob-tui): integrate TUI tools with EmbeddedMiniBob`

### Tasks

#### 10.1: Tool Provider Implementation
- [x] Create `src/lib/tools/provider.ts`
- [x] Create `TUIToolProvider` class implementing `ToolProvider`
- [x] Implement `getTools()` returning tool definitions
- [x] Implement `executeTool(name, input)` delegating to handlers
- [x] Add tool name prefix check (`tui_*`)

#### 10.2: EmbeddedMiniBob Modification
- [x] Update `src/lib/embedded-minibob.ts`
- [x] Add `registerToolProvider(provider)` method
- [x] Merge TUI tools with built-in tools in `getTools()`
- [x] Route `tui_*` tool calls to TUI provider

#### 10.3: App Wiring
- [x] Update `src/index.ts` App constructor
- [x] Create RenderCapture instance
- [x] Create TUIToolContext object
- [x] Create TUIToolProvider instance
- [x] Register provider with EmbeddedMiniBob
- [x] Add `getToolProvider()` accessor for testing

#### 10.4: Tests
- [x] Create `test/tools/provider.test.ts`
- [x] Create `test/embedded-minibob-tools.test.ts`
- [x] Test tool listing, routing, execution

**Verification:** `bun test test/tools/provider.test.ts test/embedded-minibob-tools.test.ts`

---

## Phase 11: Impulse Bridge (Bidirectional Flow)

**Milestone:** TUI impulses route to activity recommendations, tool calls tracked

**Commit:** `feat(minibob-tui): add impulse-to-activity routing bridge`

### Tasks

#### 11.1: Bridge Infrastructure
- [x] Create `src/lib/impulse-bridge.ts`
- [x] Define `ImpulseBridgeEvents` interface (tool:called, tool:result, impulse:routed)
- [x] Create `ImpulseBridge` class extending TypedEventEmitter
- [x] Implement `setupBridge()` for event wiring

#### 11.2: Impulse Routing
- [x] Implement `routeImpulseToActivities(impulse)` method
- [x] Define routable impulse types: `["user_intent", "error", "activity_request"]`
- [x] Call `minibob.recommendActivity([impulse])`
- [x] Emit `impulse:routed` event

#### 11.3: Tool Event Tracking
- [x] Listen for tool call events from EmbeddedMiniBob
- [x] Emit `tool:called` and `tool:result` events

#### 11.4: Bridge App Integration
- [x] Update `src/index.ts` to create ImpulseBridge
- [x] Wire bridge to state, provider, minibob
- [x] Add `getImpulseBridge()` accessor

#### 11.5: Tests
- [x] Create `test/impulse-bridge.test.ts`
- [x] Test impulse routing, tool tracking, event emission

**Verification:** `bun test test/impulse-bridge.test.ts`

---

## Phase 12: Self-Verification (Self-Development Loop)

**Milestone:** MiniBob can create TUI features and verify them autonomously

**Commit:** `feat(minibob-tui): add self-verification activity template and tests`

### Tasks

#### 12.1: Activity Template Creation
- [x] Create `.minibob/templates/tui/verify-component.json`
- [x] Task 1: Add component for new shape (tools: read, write, edit)
- [x] Task 2: Inject test impulse (tools: tui_inject)
- [x] Task 3: Wait for region to appear (tools: tui_wait_for)
- [x] Task 4: Capture rendered output (tools: tui_render)
- [x] Task 5: Verify content matches expectations

#### 12.2: Integration Test
- [x] Create `test/self-development.test.ts`
- [x] Test: MiniBob adds a simple component
- [x] Test: MiniBob uses TUI tools to verify component renders
- [x] Test: End-to-end from goal to verified implementation

#### 12.3: Documentation Updates
- [x] Update `CLAUDE.md` with TUI tools reference
- [x] Document usage in activities
- [x] Add self-verification patterns

#### 12.4: Vessel Metadata Update
- [x] Update `.minibob/vessel.json` with TUI tools capabilities

#### 12.5: Final Verification
- [x] Run full test suite: `bun test`
- [x] Test in embedded mode (self-development)
- [x] Test via control socket (automation)

**Verification:** `bun test test/self-development.test.ts && bun test`

---

## Summary

| Phase | Commit Message | Focus |
|-------|----------------|-------|
| 6 | `feat(minibob-tui): add TUI tool schema definitions` | Schema and types |
| 7 | `feat(minibob-tui): implement tui_observe and tui_snapshot tools` | Observable TUI |
| 8 | `feat(minibob-tui): implement tui_inject and tui_wait_for tools` | Controllable TUI |
| 9 | `feat(minibob-tui): implement tui_render tool with text/ANSI capture` | Visual verification |
| 10 | `feat(minibob-tui): integrate TUI tools with EmbeddedMiniBob` | Activity tools |
| 11 | `feat(minibob-tui): add impulse-to-activity routing bridge` | Bidirectional flow |
| 12 | `feat(minibob-tui): add self-verification activity template and tests` | Self-development |

**Total:** 7 commits across 7 phases

**Dependencies:**
```
Phase 6 → Phase 7 (schemas needed for handlers)
Phase 7 → Phase 8 (handler infrastructure exists)
Phase 9 → Phase 7 (render capture used by render handler)
Phase 10 → Phases 7-9 (all handlers must be complete)
Phase 11 → Phase 10 (provider needed for bridge)
Phase 12 → Phase 11 (bridge enables self-verification)
```

**Critical Path:** 6 → 7 → 8 → 9 → 10 → 11 → 12

**Success Metrics:**
- All tests pass
- Activity template executes successfully
- Tool calls appear in execution traces
- Documentation is complete
- Self-development loop closes (MiniBob verifies its own work)
