# Impulse-Driven TUI Specification

> **Status**: Active Development
> **Purpose**: Define minibob-tui as an impulse renderer - a window into the process-of-becoming
> **Critical Path**: Interactability - the ability to test and interact with outputs

---

## 1. Core Concept

minibob-tui is an **impulse renderer** - a vessel that receives impulses from MiniBob and renders them as visual regions in the terminal. It is not a traditional UI.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   The TUI is EMPTY by default.                                  │
│                                                                 │
│   Impulses arrive → Regions appear                              │
│   Impulses update → Regions update                              │
│   Impulses complete → Regions collapse/vanish                   │
│                                                                 │
│   The becoming decides what you see.                            │
│   You observe. Occasionally, you inject intent.                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. System Architecture

### 2.1 Component Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                          ┌─────────────────────┐                            │
│                          │    USER (human)     │                            │
│                          └──────────┬──────────┘                            │
│                                     │ keyboard                              │
│                                     ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      minibob-tui VESSEL                               │  │
│  │                                                                       │  │
│  │  RESOLVERS:              STATE:                    COMPONENTS:        │  │
│  │  ┌─────────────┐        ┌──────────────┐         ┌──────────────┐    │  │
│  │  │ terminal    │        │ regions: Map │         │ ImpulseRegion│    │  │
│  │  │ input       │        │ inputImpulse │         │ InputBox     │    │  │
│  │  │ websocket   │        │ connection   │         │ StreamBox    │    │  │
│  │  │ http        │        └──────────────┘         │ CodeBlock    │    │  │
│  │  │ control     │◄──────── Test Harness           └──────────────┘    │  │
│  │  └─────────────┘                                                      │  │
│  │                                                                       │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│              WebSocket (stream)  │  HTTP (intent)                           │
│                                  ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      MiniBob VESSEL                                   │  │
│  │                                                                       │  │
│  │  ENDPOINTS:              STATE:                    EXECUTION:         │  │
│  │  ┌─────────────┐        ┌──────────────┐         ┌──────────────┐    │  │
│  │  │ GET /ws     │◄───────│ impulseStore │◄────────│ ActivityExec │    │  │
│  │  │ POST /goal  │        │ activeExecs  │         │ GoalProcessor│    │  │
│  │  │ POST /run   │        │ wsClients    │         │ ToolRunner   │    │  │
│  │  └─────────────┘        └──────────────┘         └──────────────┘    │  │
│  │                                                                       │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│                    MCP (traces, templates)                                  │
│                                  ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                 metabob-activity-api BACKEND                          │  │
│  │                                                                       │  │
│  │  Thompson Sampling │ Trace Storage │ Pattern Learning │ Impulse Store │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**TUI → MiniBob (Intent Submission)**
```
User types → Input impulse materializes → User presses Enter
    → POST /v1/impulses/:id/submit { content: "user text" }
    → MiniBob creates tool_result for running activity
    → Activity continues with user input
```

**MiniBob → TUI (Impulse Streaming)**
```
Activity executes → Creates/updates impulses → ImpulseStore changes
    → WebSocket broadcast { type: "impulse:created|updated|deleted", impulse }
    → TUI receives event → Creates/updates/removes region
    → OpenTUI re-renders
```

---

## 3. Interface Contracts

### 3.1 WebSocket Events (MiniBob → TUI)

**Required Endpoint**: `GET /ws` (MISSING - needs implementation in MiniBob)

```typescript
type MiniBobEvent =
  // Impulse lifecycle
  | { type: "impulse:created"; impulse: Impulse }
  | { type: "impulse:updated"; impulseId: string; content: unknown }
  | { type: "impulse:completed"; impulseId: string }
  | { type: "impulse:deleted"; impulseId: string }

  // Activity lifecycle
  | { type: "activity:started"; execution: ActivityExecution }
  | { type: "activity:task-started"; executionId: string; taskId: string }
  | { type: "activity:task-completed"; executionId: string; taskId: string; result: TaskResult }
  | { type: "activity:completed"; execution: ActivityExecution }
  | { type: "activity:failed"; execution: ActivityExecution; error: string }

  // Metrics
  | { type: "metrics:updated"; metrics: DashboardMetrics }
```

### 3.2 HTTP Endpoints (TUI → MiniBob)

**Existing in MiniBob**:
- `POST /goal` - Submit development goal
- `POST /run` - Run activity template
- `GET /health` - Health check
- `GET /templates` - List templates

**Required (MISSING in MiniBob)**:
```
GET  /v1/impulses              - List active impulses
GET  /v1/impulses/:id          - Get impulse details
GET  /v1/impulses/:id/content  - Get resolved content
POST /v1/impulses/input        - Create input impulse
POST /v1/impulses/:id/submit   - Submit user input
POST /v1/impulses/:id/cancel   - Cancel pending input
GET  /v1/metrics               - Dashboard metrics
GET  /v1/activities            - List running activities
```

### 3.3 Impulse Display Metadata

```typescript
interface ImpulseDisplayHints {
  preferred: 'block' | 'stream' | 'inline' | 'expandable'
  priority: number      // Higher = closer to top
  ephemeral?: boolean   // Disappears after completion
  growable?: boolean    // Can expand to fill space
}

// Priority ranges
// 1000+   : User input (always visible)
// 900-999 : System requests (confirmations)
// 500-899 : Active/streaming outputs
// 100-499 : Completed outputs
// 0-99    : Collapsed/archived
```

---

## 4. Database Schema Mapping

### 4.1 What TUI Displays → Where It Comes From

| TUI Display | Source Table | Key Fields | Fetch Strategy |
|-------------|--------------|------------|----------------|
| Active impulses | `impulse_data` | impulse_data.*, priority | WebSocket stream |
| Activity status | `activity_executions` | status, duration_ms, cost | WebSocket stream |
| Execution details | `execution_traces` | execution_trace.* | On-demand HTTP |
| Success metrics | `variant_performance_metrics` | success_rate, avg_cost | Periodic poll |
| Task breakdown | `execution_traces.execution_trace.tasks` | task.*, toolCalls | On-demand HTTP |

### 4.2 Impulse Shape → Component Mapping

| Impulse Shape | Component | Data Source |
|---------------|-----------|-------------|
| `user_intent` | InputComponent | Local (TUI creates) |
| `user_confirmation` | ConfirmComponent | MiniBob request |
| `log_stream` | StreamComponent | WebSocket updates |
| `code_generation` | CodeComponent | Task output |
| `task_list` | TaskListComponent | Activity template |
| `diff` | DiffComponent | Tool output |
| `error` | ErrorComponent | Execution failure |
| `execution_trace` | TraceComponent | `execution_traces` table |

---

## 5. Existing Components to Reuse

### 5.1 From MiniBob (`repos/minibob/`)

| Component | File | Reuse Strategy |
|-----------|------|----------------|
| ImpulseStore | `src/impulse.ts` | Import for local resolution |
| Types | `src/types.ts` | Import directly |
| MCP Client | `src/mcp.ts` | Import for backend calls |
| ActivityExecutor | `src/activity.ts` | Reference for types |

### 5.2 From Activity Dashboard (`repos/activity-dashboard/`)

| Component | File | Reuse Strategy |
|-----------|------|----------------|
| API Client pattern | `src/lib/api-client.ts` | Adapt for MiniBob |
| WebSocket hook | `src/hooks/useWebSocket.ts` | Adapt for terminal |
| Types | `src/lib/types.ts` | Import common types |

### 5.3 From minibob-tui (Already Created)

| Component | File | Status |
|-----------|------|--------|
| MiniBobClient | `src/lib/client.ts` | Scaffolded, needs endpoint updates |
| Types | `src/types.ts` | Complete |

---

## 6. Critical Path: Interactability

### 6.1 The Problem

We need to test TUI outputs without manual visual inspection. The TUI renders to terminal which is inherently visual. **We must be able to interact with the TUI programmatically to verify it works.**

### 6.2 Solution: External Control Interface

Add a **control socket** that allows external processes (including Claude Code and MiniBob) to:
1. Query current state (what regions exist, their content)
2. Inject events (simulate keystrokes, impulses)
3. Subscribe to state changes

```typescript
// Control interface (runs alongside TUI)
interface TUIControlInterface {
  // Query state
  getRegions(): Region[]
  getRegion(id: string): Region | null
  getInputState(): { active: boolean; value: string }
  getSnapshot(): TUISnapshot  // Full state dump

  // Inject events
  injectKey(key: string): void
  injectKeys(keys: string[]): void  // Type a string
  injectImpulse(impulse: Impulse): void

  // Control
  submit(): void   // Press Enter on active input
  cancel(): void   // Press Escape

  // Subscribe
  onStateChange(callback: (state: TUIState) => void): () => void
}
```

**Implementation**: Unix socket at `/tmp/minibob-tui-{pid}.sock` or TCP port (configurable).

### 6.3 Test Harness

```typescript
// test/harness.ts
import { TUITestClient } from '../src/lib/control-client'

const tui = await TUITestClient.connect()

// Simulate user typing a goal
await tui.injectKeys('fix the auth bug')
await tui.submit()

// Wait for regions to appear
await tui.waitFor(state => state.regions.length > 0)

// Verify activity started
const regions = await tui.getRegions()
const activityRegion = regions.find(r => r.impulse.metadata?.shape === 'activity')
expect(activityRegion).toBeDefined()
expect(activityRegion.state).toBe('streaming')

// Verify input was removed (ephemeral)
const inputRegion = regions.find(r => r.impulse.metadata?.shape === 'user_intent')
expect(inputRegion).toBeUndefined()
```

### 6.4 MiniBob Integration for Testing

MiniBob can use the control interface to:
1. Verify TUI renders correctly after changes
2. Run integration tests as activities
3. Screenshot/snapshot comparisons

```typescript
// Activity template for testing TUI
{
  "name": "test-tui-rendering",
  "tasks": [
    {
      "id": "inject-impulse",
      "description": "Inject a test impulse via control socket",
      "tools": ["bash"],
      "prompt": "Send a test impulse to the TUI control socket..."
    },
    {
      "id": "verify-region",
      "description": "Query TUI state and verify region exists",
      "tools": ["bash"],
      "prompt": "Query the TUI control socket for regions..."
    }
  ]
}
```

---

## 7. MiniBob Integration for Development

### 7.1 Calling MiniBob from Claude Code

MiniBob can be invoked three ways:

**CLI (one-shot)**:
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob
bun run index.ts goal "Add WebSocket endpoint to MiniBob"
```

**HTTP (async)**:
```bash
curl -X POST http://localhost:8080/goal \
  -H "Content-Type: application/json" \
  -d '{"goal": "Add WebSocket endpoint"}'
```

**SDK (embedded)**:
```typescript
import { GoalProcessor } from "@metabob/minibob"
const result = await goalProcessor.executeGoal("Add WebSocket endpoint")
```

### 7.2 Self-Development Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Claude Code                                                    │
│       │                                                         │
│       │ 1. POST /goal "Implement feature X"                     │
│       ▼                                                         │
│  MiniBob executes                                               │
│       │                                                         │
│       │ 2. Returns: { taskResults, metrics, trace }             │
│       ▼                                                         │
│  Claude Code                                                    │
│       │                                                         │
│       │ 3. Verify via control socket: TUI renders correctly     │
│       │                                                         │
│       │ 4. If success: commit                                   │
│       │    If failure: adjust and retry                         │
│       ▼                                                         │
│  Next task                                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Task Breakdown with Commit Milestones

### Phase 1: Foundation (Testable: Control Interface)

**Milestone 1.1**: Control socket for external interaction
- [ ] Add Unix socket server to TUI (`src/lib/control.ts`)
- [ ] Implement `getRegions()`, `getInputState()`, `getSnapshot()` queries
- [ ] Implement `injectKey()`, `injectKeys()`, `injectImpulse()` commands
- [ ] Write test client (`src/lib/control-client.ts`)
- [ ] Write basic test harness (`test/harness.ts`)
- **Commit**: `feat(minibob-tui): add control interface for testing`
- **Testable**: Can query TUI state from external process

**Milestone 1.2**: Basic impulse rendering
- [ ] Implement RegionManager (`src/lib/regions.ts`)
- [ ] Implement priority-based layout algorithm (`src/lib/layout.ts`)
- [ ] Create generic BlockComponent (`src/components/BlockComponent.ts`)
- [ ] Wire control interface to region state
- **Commit**: `feat(minibob-tui): implement impulse region manager`
- **Testable**: Inject impulse via control socket, verify region appears

### Phase 2: Input System (Testable: User Intent Flow)

**Milestone 2.1**: Input impulse materialization
- [ ] Detect keypress at root level
- [ ] Create input impulse on first printable key
- [ ] Render InputComponent at top (priority 1000)
- [ ] Handle Enter (submit) and Escape (cancel)
- [ ] Update control interface with input state
- **Commit**: `feat(minibob-tui): implement input impulse system`
- **Testable**: Inject keys via control socket, verify input appears/submits

**Milestone 2.2**: Intent submission to MiniBob
- [ ] Connect to MiniBob HTTP endpoint (`POST /goal`)
- [ ] Submit input content on Enter
- [ ] Remove input impulse after submission
- [ ] Handle connection errors gracefully
- **Commit**: `feat(minibob-tui): connect input to MiniBob`
- **Testable**: Type goal, submit, verify MiniBob receives it (check MiniBob logs)

### Phase 3: WebSocket Streaming (Testable: Live Updates)

**Milestone 3.1**: MiniBob WebSocket endpoint (IN MINIBOB REPO)
- [ ] Add `GET /ws` WebSocket endpoint to MiniBob
- [ ] Broadcast impulse events from ImpulseStore on change
- [ ] Broadcast activity execution events (started, task-completed, completed, failed)
- [ ] Handle multiple WebSocket clients
- **Commit**: `feat(minibob): add WebSocket endpoint for TUI streaming`
- **Testable**: Connect WebSocket client, start activity, verify events stream

**Milestone 3.2**: TUI WebSocket client
- [ ] Implement WebSocket connection with auto-reconnect (`src/lib/websocket.ts`)
- [ ] Handle `impulse:created`, `impulse:updated`, `impulse:deleted` events
- [ ] Create/update/remove regions from events
- [ ] Update control interface to reflect WebSocket state
- **Commit**: `feat(minibob-tui): implement WebSocket client`
- **Testable**: Start activity via MiniBob, verify regions appear in TUI via control socket

### Phase 4: Rich Components (Testable: Visual Fidelity)

**Milestone 4.1**: Shape-specific components
- [ ] StreamComponent for `log_stream` shape (`src/components/StreamComponent.ts`)
- [ ] CodeComponent for `code_generation` shape (`src/components/CodeComponent.ts`)
- [ ] ErrorComponent for `error` shape (`src/components/ErrorComponent.ts`)
- [ ] TaskListComponent for `task_list` shape (`src/components/TaskListComponent.ts`)
- [ ] Component factory (`src/components/factory.ts`)
- **Commit**: `feat(minibob-tui): add shape-specific components`
- **Testable**: Inject impulses with different shapes, verify correct component via control socket

**Milestone 4.2**: Scrolling and overflow
- [ ] Implement ScrollBox wrapper for region overflow
- [ ] Handle region resize on content growth
- [ ] Implement j/k scrolling keybindings
- [ ] Add scroll position to control interface
- **Commit**: `feat(minibob-tui): implement scrolling`
- **Testable**: Inject many impulses, verify scroll state via control socket

### Phase 5: Full Loop (Testable: End-to-End)

**Milestone 5.1**: Complete flow
- [ ] User types goal → Input materializes
- [ ] Submit → MiniBob executes
- [ ] Execution → Impulses stream to TUI
- [ ] Completion → Regions collapse
- [ ] Write end-to-end test
- **Commit**: `feat(minibob-tui): complete impulse loop`
- **Testable**: Full end-to-end test via control socket

**Milestone 5.2**: MiniBob self-development integration
- [ ] Document how to call MiniBob for TUI development
- [ ] Create activity templates for common TUI tasks
- [ ] Test: MiniBob can implement a TUI feature and verify via control socket
- **Commit**: `docs(minibob-tui): add self-development guide`
- **Testable**: MiniBob implements feature, control socket verifies

---

## 9. Common Patterns to Colocate

### 9.1 Event Handling Pattern (`src/lib/events.ts`)

All event sources (WebSocket, control socket, keyboard) use same pattern:
```typescript
type EventHandler<T> = (event: T) => void

class EventEmitter<T> {
  private handlers = new Set<EventHandler<T>>()

  on(handler: EventHandler<T>): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  emit(event: T): void {
    for (const handler of this.handlers) {
      handler(event)
    }
  }
}
```

### 9.2 Region Management Pattern (`src/lib/regions.ts`)

All region operations go through single manager:
```typescript
class RegionManager {
  private regions = new Map<string, Region>()
  private onChange = new EventEmitter<RegionChangeEvent>()

  add(impulse: Impulse): Region
  update(impulseId: string, content: unknown): void
  complete(impulseId: string): void
  remove(impulseId: string): void

  getAll(): Region[]
  get(id: string): Region | null
  getLayout(): LayoutNode[]  // Sorted by priority

  subscribe(handler: (event: RegionChangeEvent) => void): () => void
}
```

### 9.3 Component Factory Pattern (`src/components/factory.ts`)

All impulse→component mapping centralized:
```typescript
const SHAPE_COMPONENTS: Record<string, ComponentFactory> = {
  user_intent: InputComponent,
  user_confirmation: ConfirmComponent,
  log_stream: StreamComponent,
  code_generation: CodeComponent,
  task_list: TaskListComponent,
  diff: DiffComponent,
  error: ErrorComponent,
}

const DISPLAY_COMPONENTS: Record<string, ComponentFactory> = {
  stream: StreamComponent,
  inline: InlineComponent,
  expandable: ExpandableComponent,
  block: BlockComponent,
}

function createComponent(impulse: Impulse): Renderable {
  const shape = impulse.metadata?.shape
  if (shape && SHAPE_COMPONENTS[shape]) {
    return SHAPE_COMPONENTS[shape](impulse)
  }

  const display = impulse.metadata?.display?.preferred ?? 'block'
  return DISPLAY_COMPONENTS[display](impulse)
}
```

---

## 10. File Structure

```
repos/minibob-tui/
├── bin/
│   └── cli.ts                    # CLI entry point
├── src/
│   ├── index.ts                  # Main app, OpenTUI setup
│   ├── types.ts                  # Type definitions
│   ├── lib/
│   │   ├── client.ts             # MiniBob HTTP client
│   │   ├── websocket.ts          # WebSocket connection
│   │   ├── regions.ts            # Region manager
│   │   ├── events.ts             # Event emitter pattern
│   │   ├── control.ts            # Control socket server
│   │   ├── control-client.ts     # Control socket client (for tests)
│   │   └── layout.ts             # Priority-based layout
│   └── components/
│       ├── index.ts              # Component exports
│       ├── factory.ts            # Impulse → component mapping
│       ├── InputComponent.ts     # User input
│       ├── BlockComponent.ts     # Generic block
│       ├── StreamComponent.ts    # Streaming content
│       ├── CodeComponent.ts      # Code display
│       ├── ErrorComponent.ts     # Error display
│       └── TaskListComponent.ts  # Task list
├── test/
│   ├── harness.ts                # Test harness using control socket
│   ├── regions.test.ts           # Region manager tests
│   ├── control.test.ts           # Control interface tests
│   └── integration.test.ts       # End-to-end tests
├── CLAUDE.md                     # Development guidelines
├── README.md                     # User documentation
└── package.json
```

---

## 11. Success Criteria

1. **Interactability**: Can query and inject via control socket
2. **Impulse Rendering**: Impulses appear as regions with correct components
3. **Input Flow**: User can type, submit intent, see results
4. **Streaming**: Activity execution streams to TUI in real-time
5. **Testability**: All features verifiable via control socket without visual inspection
6. **Self-Development**: MiniBob can be used to develop TUI features and verify them

---

## 12. Alignment with Foundation

This spec aligns with `IMPULSE_ACTIVITY_FOUNDATION.md`:

| Principle | How TUI Implements |
|-----------|-------------------|
| Impulses are universal data | All UI content is impulses |
| Metadata first, content later | Display hints in metadata |
| Resolvers live where data lives | Terminal resolver in TUI vessel |
| Record everything | User interactions become traced impulses |
| LLMs are tools, not controllers | No LLM in TUI - pure rendering |

The TUI is a vessel. Impulses are its interface to the becoming. The becoming decides what appears.

---

## 13. References

- [Impulse Activity Foundation](./IMPULSE_ACTIVITY_FOUNDATION.md)
- [MiniBob CLAUDE.md](../../repos/minibob/CLAUDE.md)
- [OpenTUI Documentation](https://opentui.com/docs/getting-started/)
