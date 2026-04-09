# Terminal Vessel + React Renderer: Complete Guide

## Quick Answer to Your Questions

### 1. How do we interact with terminal via activities?

**Activities call MCP tools** exposed by the terminal vessel:

```json
{
  "tasks": [
    {
      "id": "spawn-terminal",
      "tools": ["mcp"],
      "prompt": "Call MCP tool: terminal_spawn with preset: 'shell'"
    },
    {
      "id": "send-command",
      "tools": ["mcp"],
      "prompt": "Call MCP tool: terminal_send_input with terminalId: {{terminalId}}, input: 'npm test\\n'"
    }
  ]
}
```

Or **activities load terminal state as impulse**:

```json
{
  "input_impulses": [
    {
      "id": "dev_terminal",
      "pointer": {
        "type": "terminalState",
        "terminalId": "term-abc123"
      }
    }
  ],
  "tasks": [
    {
      "prompt": "Analyze: {{impulses.dev_terminal.content.state.buffer}}"
    }
  ]
}
```

### 2. How is it supposed to work?

**Three-tier architecture:**

```
┌─────────────────────────────────────────────────────┐
│ 1. Activity (MiniBob)                                │
│    - Needs terminal impulse                          │
│    - Queries backend: "Who resolves terminalState?"  │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│ 2. Backend (Activity API)                           │
│    - Returns: "terminal-vessel-1 at localhost:9137" │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│ 3. Terminal Vessel                                  │
│    - Resolves from in-memory PTY state              │
│    - Returns impulse content                        │
└─────────────────────────────────────────────────────┘
```

### 3. How do we display impulses?

**Three ways:**

**Option 1: Text (in activities)**
```typescript
Terminal Buffer:
{{impulses.dev_terminal.content.state.buffer}}
```

**Option 2: React (in dashboard)**
```tsx
import { TerminalRenderer } from '@metabob/react-renderer';

<TerminalRenderer
  impulse={terminalImpulse}
  interactive={true}
  onInput={(data) => sendToVessel(data)}
/>
```

**Option 3: Live (WebSocket)**
```tsx
// Future: real-time updates via WebSocket
useTerminalConnection(terminalId)
```

### 4. How does it interact with repos/react-renderer?

**react-renderer provides React components** for each impulse shape:

```
Activity Dashboard
  ↓ Fetches execution with impulses
  ↓
ImpulseRouter (from react-renderer)
  ├─ Detects shape: "terminalState"
  └─ Renders: <TerminalRenderer />
      ├─ Uses xterm.js
      ├─ Shows terminal buffer
      ├─ Handles interactive input
      └─ Displays exit code, history, etc.
```

## Complete Flow Example

### Scenario: Debug failing test

**1. User runs tests in terminal vessel:**

```bash
# Terminal vessel running on port 9137
bun run repos/terminal/src/index.ts --port 9137

# In another terminal, spawn a development session
curl -X POST http://localhost:9137/v2/terminals/spawn \
  -d '{"preset": "shell", "persistent": true, "persistenceKey": "dev-1"}'

# Returns: {"terminalId": "term-abc123", "impulseId": "terminal-term-abc123"}

# Run tests
curl -X POST http://localhost:9137/v2/terminals/send-input \
  -d '{"terminalId": "term-abc123", "input": "npm test\n"}'

# Test fails!
```

**2. Activity analyzes failure:**

```bash
# Execute debug activity with terminal impulse
minibob --single "execute activity: example-debug-with-terminal with terminalId: term-abc123"
```

**Activity loads terminal impulse:**
```json
{
  "input_impulses": [
    {
      "id": "dev_terminal",
      "pointer": {
        "type": "terminalState",
        "terminalId": "term-abc123"
      }
    }
  ]
}
```

**MiniBob resolves impulse:**
1. Queries backend: "Who resolves terminalState?"
2. Backend: "terminal-vessel-1 at http://localhost:9137"
3. MiniBob calls vessel: `POST /v2/impulses/resolve`
4. Vessel returns PTY state

**Activity receives loaded impulse:**
```typescript
{
  id: "terminal-term-abc123",
  shape: "terminalState",
  content: {
    state: {
      buffer: "$ npm test\n✗ Test failed: TypeError at file.ts:123",
      cursor: { row: 5, col: 0 },
      shellHistory: ["npm test"],
      exitCode: 1,
      running: false
    }
  }
}
```

**Activity analyzes:**
- Task 1: Parse buffer → find error
- Task 2: Extract file:line → "file.ts:123"
- Task 3: Suggest fix → "Check null pointer"

**3. Dashboard displays execution:**

```tsx
// repos/activity-dashboard/src/pages/ExecutionPage.tsx
import { ImpulseRouter } from '@metabob/react-renderer';

function ExecutionPage({ executionId }) {
  const execution = useExecution(executionId);

  return (
    <div>
      <h2>Execution: {executionId}</h2>

      {/* Terminal impulse rendered with xterm.js */}
      {execution.input_impulses.map(impulse =>
        <ImpulseRouter key={impulse.id} impulse={impulse} />
      )}

      {/* User sees:
        - Live terminal with buffer
        - Highlighted error
        - Exit code (1)
        - Shell history
      */}
    </div>
  );
}
```

## Directory Structure

```
repos/
├── terminal/                          # Terminal Vessel
│   ├── src/
│   │   ├── index.ts                  # HTTP + MCP server
│   │   ├── terminal/
│   │   │   ├── frame-manager.ts      # PTY lifecycle
│   │   │   ├── checkpoint-manager.ts  # Rollback/replay
│   │   │   └── replay-engine.ts       # Time-travel
│   │   └── state-space/
│   │       ├── impulse-store.ts       # In-memory state
│   │       └── connection-pool.ts     # Multi-viewer
│   ├── activities/
│   │   ├── observe-test-run.json      # Test observation
│   │   └── example-debug-with-terminal.json  # Debug example
│   └── HOW_IT_WORKS.md                # This guide
│
├── react-renderer/                    # NEW! Impulse renderers
│   ├── package.json
│   ├── src/
│   │   ├── index.ts                   # Exports
│   │   ├── components/
│   │   │   └── ImpulseRouter.tsx      # Shape-based routing
│   │   └── renderers/
│   │       └── TerminalRenderer.tsx   # xterm.js integration
│   └── README.md
│
└── activity-dashboard/                # Dashboard (uses renderer)
    └── src/
        └── components/
            └── ExecutionViewer.tsx    # Uses ImpulseRouter
```

## Key Files Created

**Terminal Vessel:**
- `repos/terminal/HOW_IT_WORKS.md` - Complete integration guide
- `repos/terminal/activities/example-debug-with-terminal.json` - Example activity
- `repos/terminal/OBSERVATION_LOOP.md` - Learning loop documentation
- `repos/terminal/OBSERVATION_LOOP_SUMMARY.md` - Architecture overview
- `repos/terminal/QUICKSTART_OBSERVATION.md` - Quick examples

**React Renderer (NEW):**
- `repos/react-renderer/package.json` - Dependencies
- `repos/react-renderer/src/renderers/TerminalRenderer.tsx` - xterm.js renderer
- `repos/react-renderer/src/components/ImpulseRouter.tsx` - Shape-based routing
- `repos/react-renderer/src/index.ts` - Main exports
- `repos/react-renderer/README.md` - Usage documentation

## Next Steps

### 1. Test Terminal Vessel

```bash
cd repos/terminal
bun install
bun run src/index.ts --port 9137
```

### 2. Install React Renderer

```bash
cd repos/react-renderer
bun install
```

### 3. Create Example Activity

```bash
# Register the example activity
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d @repos/terminal/activities/example-debug-with-terminal.json

# Spawn a terminal
curl -X POST http://localhost:9137/v2/terminals/spawn \
  -d '{"preset": "shell"}'

# Execute activity with terminal impulse
minibob --single "execute activity: example-debug-with-terminal with terminalId: <id>"
```

### 4. Integrate with Dashboard

```typescript
// In activity-dashboard
import { ImpulseRouter } from '@metabob/react-renderer';

// Use in ExecutionViewer
<ImpulseRouter impulse={impulse} interactive={true} />
```

## Architecture Principles Followed

✅ **Resolvers live where data lives**
- Terminal vessel resolves `terminalState` from local PTY

✅ **Backend delegates, doesn't own**
- Backend knows which vessel resolves which shape
- Doesn't resolve terminal state itself

✅ **Impulses are universal data**
- Terminal state is an impulse like any other
- Activities can load and reason about it

✅ **Separation of concerns**
- Terminal vessel: PTY management
- Backend: Discovery and persistence
- React renderer: Display only

✅ **No LLM for observation**
- Terminal state captured deterministically
- PTY buffer is raw data, not reasoning

## Summary

**The terminal vessel:**
1. Runs as HTTP server (vessel discovery) + MCP server (tool calls)
2. Manages PTY processes in memory
3. Exposes terminal state as `terminalState` impulses
4. Resolves impulses via HTTP endpoint

**Activities interact by:**
1. Calling MCP tools (spawn, send_input, etc.)
2. Loading terminal impulses as context
3. Analyzing terminal buffer with LLM or deterministically

**React renderer displays by:**
1. Detecting impulse shape (`terminalState`)
2. Routing to `TerminalRenderer`
3. Using xterm.js to render buffer
4. Optionally allowing interactive input

**Everything connects via impulses** - the universal data abstraction.
