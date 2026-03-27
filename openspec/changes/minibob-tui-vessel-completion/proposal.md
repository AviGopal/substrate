# minibob-tui Vessel Completion - Proposal

## Problem Statement

The current minibob-tui implementation has a **one-way flow**:

```
MiniBob Server → WebSocket → TUI (renders impulses)
```

Activities can create impulses that appear in the TUI, but they **cannot**:
1. Query what is currently rendered (no observability)
2. Verify their output appears correctly (no validation)
3. Wait for user interaction completion (no synchronization)
4. Inject test inputs programmatically (no automation)
5. Capture the rendered output for verification (no visual inspection)

This prevents the **self-development loop** from closing. MiniBob cannot verify its own TUI changes without human visual inspection.

## The Bridge Ethos

minibob-tui follows the **metabob-mcp bridge pattern**: Non-invasive observation that augments existing workflows without replacing them. Just as metabob-mcp exposes code analysis through familiar tools (get_priority_issues, search_codebase) while recording traces for learning, minibob-tui exposes TUI state through tool calls that activities can use naturally.

**Bridge Principles Applied:**
1. **Non-invasive observation**: TUI tools don't alter rendering - they observe and interact with existing state
2. **Gradual value demonstration**: Tools work immediately (tui_observe) before requiring behavior change (tui_wait_for)
3. **Respect existing workflows**: Control socket and EmbeddedMiniBob remain unchanged - tools layer on top
4. **Build trust through transparency**: Every tool call → execution trace → learning loop

**The Pattern:**
```
Traditional workflow: Human visual inspection → Manual testing → Commit
Bridge workflow: Activity tool call → Automated verification → Execution trace → Learning
```

The TUI becomes **observable and controllable** while remaining the same visual interface users depend on.

## The Bidirectional Flow Gap

Current state:
- **Remote Mode** (WebSocket): MiniBob sends impulses → TUI renders them (one-way)
- **Embedded Mode** (Direct integration): Activities execute → TUI renders regions (one-way)
- **Control Socket** (Unix socket): External testing infrastructure can query state (local-only)

**The gap**: Activities executing in EmbeddedMiniBob have no mechanism to observe or control the TUI they're modifying. This creates a blind spot in autonomous development.

What's missing:
1. **Observability**: Activities can't see what they created
2. **Controllability**: Activities can't test interactions
3. **Verification**: Activities can't validate success without human inspection
4. **Traceability**: Tool usage isn't captured for learning

## Solution: TUI Tools as Activity-Level Resolvers

Add 5 tools that expose TUI capabilities through the activity interface:

| Tool | Purpose | Resolver Type |
|------|---------|---------------|
| `tui_observe` | Query current regions, input state, scroll position | Local (TUIState) |
| `tui_render` | Capture rendered terminal output as text/ANSI | Local (RenderCapture) |
| `tui_inject` | Send keypresses or commands to the TUI | Local (TUIState) |
| `tui_wait_for` | Wait for specific conditions (region appears, user responds) | Local (Event loop) |
| `tui_snapshot` | Get full state dump for debugging | Local (TUIState) |

**Key insight**: These are **local resolvers** - they resolve state that exists in the TUI process itself. No backend required. No authentication needed. They're analogous to the `file` and `memo` impulse types in MiniBob.

## Architecture: Three Execution Modes

### 1. Remote Mode (Production)
```
User TUI Process                    MiniBob Server Process
┌──────────────┐                   ┌────────────────────┐
│  TUIState    │◄──WebSocket───────│  Activity Engine   │
│  Render Loop │                   │  (remote)          │
└──────────────┘                   └────────────────────┘
```
**Tools unavailable** - TUI and activities in different processes.

### 2. Embedded Mode (Self-Development)
```
Single Process (minibob-tui)
┌───────────────────────────────────────────────┐
│  TUIState ◄─── TUI Tool Provider              │
│     ▲              │                           │
│     │              ▼                           │
│  Render Loop   EmbeddedMiniBob                │
│                (activities with TUI tools)    │
└───────────────────────────────────────────────┘
```
**Tools available** - Same process, direct state access.

### 3. Test Mode (Automation)
```
Test Process                    TUI Process
┌──────────────┐               ┌──────────────┐
│  Test Script │───Unix Socket─→│ ControlServer│
│              │                │      │        │
│              │                │      ▼        │
│              │                │  TUIState    │
└──────────────┘               └──────────────┘
```
**Tools via socket** - External control for integration testing.

## What's Local vs Remote

**Local (No Auth Required):**
- Terminal I/O (stdin/stdout)
- TUIState queries (regions, input, scroll)
- Control Socket (Unix socket on filesystem)
- Render capture (process.stdout)
- EmbeddedMiniBob (same process imports)

**Remote (Auth Required):**
- WebSocket to MiniBob server (ws://{endpoint}/ws)
- HTTP API calls (POST /goal, GET /activities)
- Backend impulse resolution (activity traces, metrics)
- Database queries (SurrealDB)

**TUI tools are entirely local** - they work in embedded mode without any network calls or authentication. This makes self-development possible: the TUI can improve itself without external services.

## Bidirectional Flow After Completion

```
MiniBob ──impulses──► TUI (render regions)
MiniBob ◄──tools───── TUI (observe, inject, wait, capture)
```

Activities can now:
1. **Create a feature**: Modify TUIState, add components, update resolvers
2. **Render verification impulse**: Create impulse with expected shape
3. **Query the TUI**: Use `tui_observe` to check if region appeared
4. **Inject test input**: Use `tui_inject` to trigger user interactions
5. **Wait for completion**: Use `tui_wait_for` until region completes
6. **Capture output**: Use `tui_render` to get final rendered state
7. **Validate**: Compare captured output to expected patterns

**Result**: Closed self-development loop where MiniBob verifies its own work.

## Success Criteria

1. **Tool Definition**: All 5 TUI tools defined with Zod schemas and JSON schema export
2. **Tool Handlers**: Each tool has working implementation using TUIState/RenderCapture
3. **Tool Provider**: TUIToolProvider integrated with EmbeddedMiniBob
4. **Render Capture**: Can capture terminal output in both text and ANSI formats
5. **Impulse Bridge**: Routes TUI impulses to activity recommendations
6. **Self-Verification**: Activity template that creates and verifies a TUI component
7. **Integration Tests**: Automated tests demonstrating the full loop

## Dependencies

**Existing Infrastructure (Phase 1-5 complete):**
- TUIState (state.ts) - central state management with getSnapshot()
- ControlServer (control.ts) - Unix socket JSON protocol
- EmbeddedMiniBob (embedded-minibob.ts) - activity execution context
- RegionManager (regions.ts) - impulse region lifecycle
- TypedEventEmitter (events.ts) - type-safe event system

**New Infrastructure (This spec):**
- TUI Tool Provider - exposes TUI capabilities as activity tools
- RenderCapture - captures terminal output for verification
- ImpulseBridge - routes TUI impulses to activities

## Implementation Strategy

Group related functionality that can be colocated and committed together:
1. **Tool Infrastructure** (Phase 6): Schemas, types, definitions - testable in isolation
2. **Control Socket Tools** (Phase 7): tui_observe, tui_snapshot - builds on ControlServer
3. **Action Tools** (Phase 8): tui_inject, tui_wait_for - enables automation
4. **Render Capture** (Phase 9): tui_render with text/ANSI - independent subsystem
5. **EmbeddedMiniBob Integration** (Phase 10): Wire tools into activity context
6. **Impulse Bridge** (Phase 11): Route TUI impulses to activities
7. **Self-Verification** (Phase 12): Activity templates using TUI tools

Each phase produces a working commit milestone that can be tested independently.
