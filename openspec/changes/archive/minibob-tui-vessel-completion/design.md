# minibob-tui Vessel Completion - Technical Design

## Overview

This design enables **bidirectional flow** between activities and the TUI by exposing TUI capabilities as tools that EmbeddedMiniBob can call during activity execution. The implementation follows the **bridge pattern**: non-invasive observation layered on existing infrastructure.

## Interface Boundaries

### External Interfaces

```typescript
// 1. Control Socket (Unix socket)
interface ControlSocketProtocol {
  endpoint: string  // /tmp/minibob-tui-{pid}.sock
  protocol: "JSON"
  commands: {
    observe: { query: "regions" | "input" | "scroll" | "all" }
    inject: { type: "key" | "keys" | "command", value: string }
    snapshot: { includeRender: boolean }
  }
}

// 2. WebSocket to MiniBob Server
interface WebSocketProtocol {
  endpoint: string  // ws://{host}:{port}/ws
  messages: {
    impulse: ImpulseMessage
    activity_started: ActivityStartedMessage
    activity_completed: ActivityCompletedMessage
  }
}

// 3. HTTP Client to MiniBob Server
interface HTTPClientProtocol {
  baseURL: string  // http://{host}:{port}
  endpoints: {
    POST: "/goal"
    GET: "/activities"
    POST: "/activities/{id}/execute"
  }
}

// 4. Terminal I/O
interface TerminalProtocol {
  input: NodeJS.ReadStream  // process.stdin
  output: NodeJS.WriteStream  // process.stdout
  signals: NodeJS.Signals  // SIGINT, SIGTERM, SIGWINCH
}

// 5. Embedded MiniBob (Direct module imports)
interface EmbeddedProtocol {
  import: "minibob/activity-executor"
  import: "minibob/impulse-resolver"
  import: "minibob/goal-processor"
}
```

### Internal Boundaries

```typescript
// 1. TUIState (Central state management)
interface TUIStateProvider {
  getSnapshot(): TUISnapshot
  injectKey(key: string): void
  submit(): void
  cancel(): void
  scrollUp(): void
  scrollDown(): void
  on(event: string, handler: Function): void
}

// 2. RegionManager (Impulse region lifecycle)
interface RegionManagerInterface {
  createRegion(impulse: Impulse): Region
  updateRegion(id: string, updates: Partial<Region>): void
  removeRegion(id: string): void
  getRegion(id: string): Region | undefined
  getAllRegions(): Region[]
}

// 3. TypedEventEmitter (Type-safe pub-sub)
interface EventEmitterInterface<Events> {
  on<K extends keyof Events>(event: K, handler: (data: Events[K]) => void): () => void
  emit<K extends keyof Events>(event: K, data: Events[K]): void
}

// 4. Component Factory (Shape → component mapping)
interface ComponentFactoryInterface {
  registerComponent(shape: string, factory: ComponentFactory): void
  createComponent(region: Region): Component
  getSupportedShapes(): string[]
}

// 5. Resolver Infrastructure
interface ResolverInterface {
  readonly type: string
  readonly priority: number
  canResolve(pointer: ImpulsePointer): boolean
  resolve(pointer: ImpulsePointer): Promise<ResolvedContent>
}

// 6. ImpulseProvider (TUI state as impulses)
interface ImpulseProviderInterface {
  createImpulse(data: ImpulseData): Impulse
  updateImpulse(id: string, updates: Partial<Impulse>): void
  getImpulse(id: string): Impulse | undefined
  on(event: string, handler: Function): void
}
```

## Data Flow Diagrams

### Remote Mode (Production)

```
┌─────────────────────────────────────────────────────────┐
│                   User TUI Process                      │
│                                                         │
│  Terminal I/O ──► TUIState ──► Render Loop ──► stdout  │
│       ▲               │                                 │
│       │               ▼                                 │
│   User Input     RegionManager ──► Components          │
│                       ▲                                 │
└───────────────────────│─────────────────────────────────┘
                        │ WebSocket
                        │ (impulse messages)
┌───────────────────────▼─────────────────────────────────┐
│              MiniBob Server Process                     │
│                                                         │
│  Goal Processor ──► Activity Engine ──► Impulse Creator │
│                          │                              │
│                          ▼                              │
│                  Backend API Client                     │
│                          │                              │
└──────────────────────────│──────────────────────────────┘
                           │ HTTP
                           ▼
┌──────────────────────────────────────────────────────────┐
│            metabob-activity-api (Backend)                │
│                                                          │
│  SurrealDB ◄─► Activity Registry ◄─► Thompson Sampling  │
│                 Execution Traces                         │
│                 Impulse Metadata                         │
└──────────────────────────────────────────────────────────┘
```

**Flow:**
1. User types goal → TUIState.injectKey()
2. Submit → inputSubmitted event → MiniBob Server /goal
3. MiniBob recommends activity → Executes
4. Creates impulse → WebSocket to TUI
5. TUI renders impulse as region

**Tools: UNAVAILABLE** - Activities run in separate process

### Embedded Mode (Self-Development)

```
┌─────────────────────────────────────────────────────────────┐
│            Single Process (minibob-tui)                     │
│                                                             │
│  Terminal I/O ──► TUIState ◄─── TUI Tool Provider          │
│       ▲               │              │                      │
│       │               ▼              │                      │
│   User Input     RegionManager       │                      │
│                       │              │                      │
│                       ▼              │                      │
│                  Render Loop         │                      │
│                                      │                      │
│                                      ▼                      │
│               ┌──────────────────────────────────┐          │
│               │     EmbeddedMiniBob              │          │
│               │                                  │          │
│               │  Activity Executor               │          │
│               │       │                          │          │
│               │       ▼                          │          │
│               │  Tool Router ──► TUI Tools       │          │
│               │       │       (observe, inject,  │          │
│               │       │        wait, render)     │          │
│               │       ▼                          │          │
│               │  Built-in Tools                  │          │
│               │  (read, write, bash, git)        │          │
│               └──────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Flow:**
1. Boredom mode triggers activity
2. Activity executes in EmbeddedMiniBob
3. Task calls tui_observe → reads TUIState.getSnapshot()
4. Task calls tui_inject → TUIState.injectKey()
5. Task calls tui_render → RenderCapture.capture()
6. Verification succeeds → Activity completes

**Tools: AVAILABLE** - Same process, direct state access

### Test Mode (Automation)

```
┌──────────────────────┐              ┌───────────────────────┐
│   Test Process       │              │   TUI Process         │
│                      │              │                       │
│  Integration Test    │              │  TUIState             │
│       │              │              │      ▲                │
│       ▼              │              │      │                │
│  Control Socket      │──Unix Socket─┼──►ControlServer      │
│  Client              │              │      │                │
│       │              │              │      ▼                │
│       │              │              │  Tool Handlers        │
│       │              │              │  (same code as        │
│       │              │              │   EmbeddedMiniBob)    │
│       ▼              │              │                       │
│  Assert expectations │              │  Render Loop          │
│                      │              │                       │
└──────────────────────┘              └───────────────────────┘
```

**Flow:**
1. Test script opens Unix socket
2. Sends JSON command: `{"method": "observe", "params": {...}}`
3. ControlServer routes to TUIToolHandlers
4. Returns JSON response
5. Test asserts on response

**Tools: VIA SOCKET** - External process control

## Colocated Patterns

### Pattern 1: Tool Infrastructure (Phase 6)

**Files colocated:**
```
src/lib/tools/
├── schemas.ts        # Zod schemas for all 5 tools
├── types.ts          # TypeScript types inferred from schemas
├── definitions.ts    # JSON schema conversion for activity engine
└── index.ts          # Barrel export
```

**Why colocated:** All tool metadata lives together. Can be tested without implementations.

### Pattern 2: Control Socket Tools (Phase 7)

**Files colocated:**
```
src/lib/tools/
└── handlers.ts       # TUIToolHandlers class
                      # - tuiObserve()
                      # - tuiSnapshot()
```

**Why colocated:** Both tools are read-only queries of TUIState. No side effects.

### Pattern 3: Action Tools (Phase 8)

**Files colocated:**
```
src/lib/tools/
└── handlers.ts       # Extended with:
                      # - tuiInject()
                      # - tuiWaitFor()
                      # - handleCommand()
```

**Why colocated:** Both tools mutate TUIState. Depend on each other (wait_for checks effects of inject).

### Pattern 4: Render Capture (Phase 9)

**Files colocated:**
```
src/lib/tools/
├── render-capture.ts  # RenderCapture class
└── handlers.ts        # Extended with:
                       # - tuiRender()
```

**Why colocated:** Render capture is independent subsystem. Can be tested without activity context.

### Pattern 5: EmbeddedMiniBob Integration (Phase 10)

**Files colocated:**
```
src/lib/tools/
├── provider.ts           # TUIToolProvider class
└── handlers.ts           # (already complete from Phases 7-9)

src/lib/
└── embedded-minibob.ts   # Modified to accept TUIToolProvider
```

**Why colocated:** Tool provider bridges handlers and activity engine. Minimal code, high integration value.

### Pattern 6: Impulse Bridge (Phase 11)

**Files colocated:**
```
src/lib/
├── impulse-bridge.ts     # ImpulseBridge class
└── index.ts              # Wire bridge in App constructor
```

**Why colocated:** Bridge is event routing layer. Small surface area, high conceptual value.

### Pattern 7: Self-Verification (Phase 12)

**Files colocated:**
```
.minibob/templates/tui/
└── verify-component.json    # Activity template using TUI tools

test/
└── self-development.test.ts # Integration test
```

**Why colocated:** Templates and tests prove the system works end-to-end.

## RBAC Integration Points

### Auth Modes by Interface

**Local (No Auth):**
- TUI Tools (tui_observe, tui_inject, tui_wait_for, tui_render, tui_snapshot)
- Terminal I/O
- Control Socket (Unix socket permissions only)
- Render Capture
- EmbeddedMiniBob (same process)

**Remote (JWT Required):**
- WebSocket to MiniBob Server
- HTTP API calls
- Backend impulse resolution

### Auth Context Passing

```typescript
// EmbeddedMiniBob configuration
interface EmbeddedMiniBobConfig {
  // Optional: Only needed for remote impulse resolution
  authToken?: string

  // Optional: Only needed for backend API calls
  backendEndpoint?: string
}

// TUI Tool Provider configuration
interface TUIToolContext {
  // No auth required - all local
  state: TUIState
  control: ControlServer
  renderCapture: RenderCapture
}
```

**Key insight:** TUI tools work without any authentication because they only access local state. If an activity needs to resolve backend impulses (activity traces, metrics), that happens through the standard MiniBob impulse resolution mechanism, which already handles auth.

### Multi-Tenant Isolation

TUI tools have **no multi-tenant concerns** because they're local to a single process. Each TUI process belongs to one user/session. No data crosses tenant boundaries.

Backend calls (if needed) inherit auth from the execution context:
```typescript
// In EmbeddedMiniBob
async resolveRemoteImpulse(pointer: ImpulsePointer): Promise<ResolvedContent> {
  // Uses this.config.authToken if provided
  // Falls back to unauthenticated local mode
  return this.mcpClient.resolve(pointer)
}
```

## Schema Field Sourcing

### TUI Tool Schemas (Local Data)

**tui_observe output:**
```typescript
{
  regions: Region[]           // From TUIState.getSnapshot().regions
  input: InputState          // From TUIState.getSnapshot().input
  scrollPosition: number     // From TUIState.getSnapshot().scrollPosition
}
```

**tui_render output:**
```typescript
{
  content: string            // Generated by RenderCapture from components
  width: number              // From process.stdout.columns
  height: number             // From process.stdout.rows
  timestamp: number          // Date.now()
}
```

**tui_inject output:**
```typescript
{
  success: boolean           // Try/catch around TUIState mutations
  resultingState: {
    inputActive: boolean     // From TUIState.getSnapshot().input.active
    inputValue: string       // From TUIState.getSnapshot().input.value
  }
}
```

**tui_wait_for output:**
```typescript
{
  met: boolean               // Polling result
  timedOut: boolean          // Date.now() - startTime > timeout
  waitTime: number           // Date.now() - startTime
}
```

**tui_snapshot output:**
```typescript
{
  regions: Region[]          // From TUIState.getSnapshot().regions
  input: InputState          // From TUIState.getSnapshot().input
  scrollPosition: number     // From TUIState.getSnapshot().scrollPosition
  connected: boolean         // From WebSocketClient?.connected
  websocketStatus: string    // From WebSocketClient?.readyState
  timestamp: number          // Date.now()
  render: string?            // Optional: RenderCapture.captureSync()
}
```

### Backend Schemas (Remote Data - Not Used by TUI Tools)

These are referenced here for completeness, but **TUI tools don't access these schemas**:

**activity_registry table:**
- `id`, `name`, `category`, `tasks`, `success_rate`, `avg_cost_usd`, `org_id`
- Used by: Thompson Sampling, activity recommendations
- NOT used by TUI tools

**activity_execution_traces table:**
- `id`, `activity_id`, `input_impulses`, `output_impulses`, `tool_calls`, `state_snapshots`, `org_id`
- Used by: Learning loop, ribosome pattern
- NOT used by TUI tools

**impulse_data table:**
- `id`, `pointer`, `metadata`, `shape`, `loaded`, `content`, `org_id`
- Used by: Impulse resolution, relevance tracking
- NOT used by TUI tools

## Tool Implementation Code Examples

### Tool Schema Definition (Zod)

```typescript
// src/lib/tools/schemas.ts
import { z } from "zod";

export const TUITools = {
  tui_observe: {
    name: "tui_observe",
    description: "Query current TUI state including regions, input, and scroll position",
    inputSchema: z.object({
      query: z.enum(["regions", "input", "scroll", "all"]).default("all"),
      regionId: z.string().optional().describe("Filter to specific region"),
    }),
  },

  tui_render: {
    name: "tui_render",
    description: "Capture the current rendered terminal output",
    inputSchema: z.object({
      format: z.enum(["text", "ansi"]).default("text"),
      region: z.string().optional().describe("Capture specific region only"),
    }),
  },

  tui_inject: {
    name: "tui_inject",
    description: "Inject keypresses or commands into the TUI",
    inputSchema: z.object({
      type: z.enum(["key", "keys", "command"]),
      value: z.string().describe("Key name, string to type, or command name"),
    }),
  },

  tui_wait_for: {
    name: "tui_wait_for",
    description: "Wait for a condition to be met in the TUI",
    inputSchema: z.object({
      condition: z.enum(["region_appears", "region_completes", "input_inactive", "text_appears"]),
      regionId: z.string().optional(),
      text: z.string().optional(),
      timeout: z.number().default(5000).describe("Timeout in milliseconds"),
    }),
  },

  tui_snapshot: {
    name: "tui_snapshot",
    description: "Get a full TUI state snapshot for debugging",
    inputSchema: z.object({
      includeRender: z.boolean().default(false),
    }),
  },
} as const;
```

### Tool Handler Implementation

```typescript
// src/lib/tools/handlers.ts
import type { TUIState } from "../state.ts";
import type { RenderCapture } from "./render-capture.ts";
import type { ToolResult } from "minibob";

export interface TUIToolContext {
  state: TUIState;
  renderCapture: RenderCapture;
}

export class TUIToolHandlers {
  constructor(private ctx: TUIToolContext) {}

  async handleTool(name: string, input: unknown): Promise<ToolResult> {
    try {
      switch (name) {
        case "tui_observe":
          return this.tuiObserve(input);
        case "tui_render":
          return await this.tuiRender(input);
        case "tui_inject":
          return this.tuiInject(input);
        case "tui_wait_for":
          return await this.tuiWaitFor(input);
        case "tui_snapshot":
          return this.tuiSnapshot(input);
        default:
          return { error: `Unknown TUI tool: ${name}` };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Tool execution failed" };
    }
  }

  private tuiObserve(input: any): ToolResult {
    const snapshot = this.ctx.state.getSnapshot();
    const result: Record<string, any> = {};

    if (input.query === "all" || input.query === "regions") {
      let regions = snapshot.regions;
      if (input.regionId) {
        regions = regions.filter((r) => r.impulseId === input.regionId);
      }
      result.regions = regions.map((r) => ({
        impulseId: r.impulseId,
        state: r.state,
        componentType: r.componentType,
        priority: r.priority,
      }));
    }

    if (input.query === "all" || input.query === "input") {
      result.input = snapshot.input;
    }

    if (input.query === "all" || input.query === "scroll") {
      result.scrollPosition = snapshot.scrollPosition;
    }

    return { content: result };
  }

  private tuiInject(input: any): ToolResult {
    switch (input.type) {
      case "key":
        this.ctx.state.injectKey(input.value);
        break;
      case "keys":
        for (const char of input.value) {
          this.ctx.state.injectKey(char);
        }
        break;
      case "command":
        this.handleCommand(input.value);
        break;
    }

    const snapshot = this.ctx.state.getSnapshot();
    return {
      content: {
        success: true,
        resultingState: {
          inputActive: snapshot.input.active,
          inputValue: snapshot.input.value,
        },
      },
    };
  }

  private handleCommand(command: string): void {
    switch (command) {
      case "submit": this.ctx.state.submit(); break;
      case "cancel": this.ctx.state.cancel(); break;
      case "scroll_down": this.ctx.state.scrollDown(); break;
      case "scroll_up": this.ctx.state.scrollUp(); break;
      case "scroll_top": this.ctx.state.scrollToTop(); break;
      case "scroll_bottom": this.ctx.state.scrollToBottom(); break;
      default: throw new Error(`Unknown command: ${command}`);
    }
  }

  private async tuiWaitFor(input: any): Promise<ToolResult> {
    const startTime = Date.now();
    const timeout = input.timeout ?? 5000;

    const checkCondition = (): boolean => {
      const snapshot = this.ctx.state.getSnapshot();
      switch (input.condition) {
        case "region_appears":
          return snapshot.regions.some((r) => r.impulseId === input.regionId);
        case "region_completes":
          return snapshot.regions.some(
            (r) => r.impulseId === input.regionId && r.state === "complete"
          );
        case "input_inactive":
          return !snapshot.input.active;
        default:
          return false;
      }
    };

    while (Date.now() - startTime < timeout) {
      if (checkCondition()) {
        return {
          content: { met: true, timedOut: false, waitTime: Date.now() - startTime },
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return {
      content: { met: false, timedOut: true, waitTime: timeout },
    };
  }

  private async tuiRender(input: any): Promise<ToolResult> {
    const capture = await this.ctx.renderCapture.capture({
      format: input.format ?? "text",
      regionId: input.region,
    });
    return {
      content: {
        content: capture.content,
        width: capture.width,
        height: capture.height,
        timestamp: capture.timestamp,
      },
    };
  }

  private tuiSnapshot(input: any): ToolResult {
    const snapshot = this.ctx.state.getSnapshot();
    const result: Record<string, any> = { ...snapshot };

    if (input.includeRender) {
      result.render = this.ctx.renderCapture.captureSync({ format: "text" }).content;
    }

    return { content: result };
  }
}
```

### Tool Provider

```typescript
// src/lib/tools/provider.ts
import type { ToolProvider, ToolDefinition, ToolResult } from "minibob";
import { TUIToolHandlers, type TUIToolContext } from "./handlers.ts";
import { getTUIToolDefinitions } from "./definitions.ts";

export class TUIToolProvider implements ToolProvider {
  readonly name = "tui";
  private handlers: TUIToolHandlers;

  constructor(ctx: TUIToolContext) {
    this.handlers = new TUIToolHandlers(ctx);
  }

  getTools(): ToolDefinition[] {
    return getTUIToolDefinitions();
  }

  async executeTool(name: string, input: unknown): Promise<ToolResult> {
    if (!name.startsWith("tui_")) {
      return { error: `Not a TUI tool: ${name}` };
    }
    return this.handlers.handleTool(name, input);
  }
}
```

### Impulse Bridge

```typescript
// src/lib/impulse-bridge.ts
import type { TUIState } from "./state.ts";
import type { TUIImpulseProvider } from "./impulse-provider.ts";
import type { EmbeddedMiniBob } from "./embedded-minibob.ts";
import { TypedEventEmitter } from "./events.ts";

export interface ImpulseBridgeEvents {
  "tool:called": { tool: string; input: unknown };
  "tool:result": { tool: string; result: unknown };
  "impulse:routed": { impulseId: string; activityId?: string };
}

export class ImpulseBridge extends TypedEventEmitter<ImpulseBridgeEvents> {
  private routableTypes = ["user_intent", "error", "activity_request"];

  constructor(
    private state: TUIState,
    private provider: TUIImpulseProvider,
    private minibob: EmbeddedMiniBob
  ) {
    super();
    this.setupBridge();
  }

  private setupBridge(): void {
    this.provider.on("impulse:created", (impulse) => {
      this.routeImpulseToActivities(impulse);
    });
  }

  private async routeImpulseToActivities(impulse: any): Promise<void> {
    if (this.routableTypes.includes(impulse.metadata?.shape)) {
      const activity = await this.minibob.recommendActivity([impulse]);
      this.emit("impulse:routed", {
        impulseId: impulse.id,
        activityId: activity?.id
      });
    }
  }
}
```

## Testing Strategy

### Unit Tests (Phase-specific)
- Schema validation (Phase 6)
- Handler logic (Phases 7-8)
- Render capture (Phase 9)
- Tool provider (Phase 10)
- Event routing (Phase 11)

### Integration Tests (Phase 12)
- End-to-end self-development loop
- Activity creates component → verifies render → validates output
- Control socket automation
- Multiple tools in sequence

### Test Helpers
```typescript
// test/helpers.ts
export function createMockTUIState(): MockTUIState {
  return {
    regions: [],
    input: { active: false, value: "", cursorPosition: 0 },
    scrollPosition: 0,
    connected: true,
    websocketStatus: "OPEN",

    addRegion(region: Partial<Region>) { /* ... */ },
    getSnapshot() { /* ... */ },
    injectKey(key: string) { /* ... */ },
  }
}

export function waitFor(condition: () => boolean, timeout = 5000): Promise<void> {
  // Polling helper for async tests
}
```

## Performance Considerations

- **Text format:** Strip ANSI codes (regex), ~1ms for typical TUI
- **ANSI format:** No processing, ~0.1ms
- **Wait loop:** Poll interval 50ms (balance between responsiveness and CPU)
- **Tool call overhead:** Local tools <1ms, control socket ~5ms

## Security Considerations

- Unix socket created with mode 0600 (owner-only)
- Input injection only through TUIState.injectKey() (validated)
- No shell command execution from TUI tools
- Render capture only captures what's already rendered
