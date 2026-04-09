# How Terminal Vessel Works: Complete Guide

## Overview

The terminal vessel provides **stateful terminal sessions as impulses** that activities can use. It runs in two modes:

1. **HTTP mode**: Vessel discovery and impulse resolution
2. **MCP stdio mode**: Direct tool calls from MCP clients

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Activity                             │
│  "Debug failed test using terminal"                      │
│                                                           │
│  Input Impulses:                                         │
│  - test_output (shape: test_result)                     │
│  - dev_terminal (shape: terminalState) ← FROM VESSEL    │
│                                                           │
│  Tasks:                                                  │
│  1. Analyze terminal buffer                             │
│  2. Find error pattern                                  │
│  3. Send fix command to terminal                        │
└─────────────────┬────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│              Impulse Resolution                          │
│                                                           │
│  MiniBob:                                                │
│  "I need impulse: dev_terminal (terminalState)"          │
│                                                           │
│  ↓ Query backend for vessel                             │
│                                                           │
│  Backend:                                                │
│  "terminalState is resolved by terminal-vessel-1"       │
│  "Endpoint: http://localhost:9137"                      │
│                                                           │
│  ↓ Call vessel HTTP endpoint                            │
│                                                           │
│  Terminal Vessel:                                        │
│  POST /v2/impulses/resolve                              │
│  {                                                       │
│    "pointer": {                                         │
│      "type": "terminalState",                           │
│      "terminalId": "term-abc123"                        │
│    }                                                    │
│  }                                                      │
│                                                          │
│  ↓ Resolve from in-memory PTY state                     │
│                                                          │
│  Returns:                                               │
│  {                                                      │
│    "content": {                                         │
│      "state": {                                        │
│        "buffer": "$ npm test\n✗ Test failed...",      │
│        "cursor": { "row": 5, "col": 0 },              │
│        "shellHistory": ["npm test"],                  │
│        "exitCode": 1                                  │
│      },                                               │
│      "checkpoints": [...],                           │
│      "connections": [...]                            │
│    }                                                  │
│  }                                                    │
└──────────────────────────────────────────────────────────┘
```

## How to Interact via Activities

### Example 1: Use Existing Terminal Session

**Activity: Debug from terminal output**

```json
{
  "id": "debug-from-terminal",
  "name": "Debug Failed Test from Terminal",
  "category": "debugging",

  "input_impulses": [
    {
      "id": "dev_terminal",
      "pointer": {
        "type": "terminalState",
        "terminalId": "{{terminalId}}"
      },
      "metadata": { "shape": "terminalState" },
      "budget": 10000,
      "priority": "critical"
    }
  ],

  "tasks": [
    {
      "id": "analyze-error",
      "description": "Analyze terminal buffer for error",
      "prompt": {
        "template": "Terminal Buffer:\n{{impulses.dev_terminal.content.state.buffer}}\n\nLast Command: {{impulses.dev_terminal.content.state.shellHistory[-1]}}\nExit Code: {{impulses.dev_terminal.content.state.exitCode}}\n\nWhat went wrong? Provide analysis.",
        "variables": []
      }
    },
    {
      "id": "find-error-location",
      "description": "Extract file and line number from error",
      "prompt": {
        "template": "Parse the error output and extract:\n1. File path\n2. Line number\n3. Error type\n\nFrom: {{impulses.dev_terminal.content.state.buffer}}",
        "variables": []
      }
    }
  ]
}
```

**How to execute:**

```bash
# 1. Spawn a terminal session via MCP
curl -X POST http://localhost:9137/v2/terminals/spawn \
  -d '{"preset": "shell", "persistent": true, "persistenceKey": "dev-session-1"}'

# Returns: {"terminalId": "term-abc123", "impulseId": "terminal-term-abc123"}

# 2. Run tests in that terminal
curl -X POST http://localhost:9137/v2/terminals/send-input \
  -d '{"terminalId": "term-abc123", "input": "npm test\n"}'

# 3. Execute activity using terminal impulse
minibob --single "execute activity: debug-from-terminal with terminalId: term-abc123"
```

### Example 2: Spawn Terminal from Activity

**Activity: Run tests in isolated terminal**

```json
{
  "id": "test-with-terminal",
  "name": "Run Tests in Isolated Terminal",
  "category": "testing",

  "tasks": [
    {
      "id": "spawn-terminal",
      "description": "Spawn a test terminal",
      "prompt": {
        "template": "Call MCP tool: terminal_spawn with preset: 'shell', cwd: '{{cwd}}', persistent: false",
        "variables": [
          {
            "name": "cwd",
            "source": "context",
            "default": "repos/terminal"
          }
        ]
      },
      "tools": ["mcp"],
      "output_impulses": [
        {
          "id": "test_terminal",
          "shape": "terminalState"
        }
      ]
    },
    {
      "id": "run-tests",
      "description": "Execute tests",
      "prompt": {
        "template": "Call MCP tool: terminal_send_input with terminalId: {{test_terminal.terminalId}}, input: 'bun test\\n', createCheckpoint: true",
        "variables": []
      },
      "tools": ["mcp"]
    },
    {
      "id": "analyze-results",
      "description": "Analyze test output",
      "prompt": {
        "template": "Terminal output:\n{{test_terminal.content.state.buffer}}\n\nAnalyze test results and report failures.",
        "variables": []
      },
      "input_impulses": ["test_terminal"]
    },
    {
      "id": "cleanup",
      "description": "Disconnect from terminal",
      "prompt": {
        "template": "Call MCP tool: terminal_disconnect with terminalId: {{test_terminal.terminalId}}, connectionId: 'activity-{{execution_id}}'",
        "variables": []
      },
      "tools": ["mcp"]
    }
  ]
}
```

### Example 3: Multi-Viewer Debugging

**Activity: Collaborative debugging session**

```json
{
  "id": "collaborative-debug",
  "name": "Multi-User Debug Session",

  "input_impulses": [
    {
      "id": "debug_terminal",
      "pointer": {
        "type": "terminalState",
        "terminalId": "{{terminalId}}"
      },
      "metadata": { "shape": "terminalState" },
      "budget": 10000,
      "priority": "high"
    }
  ],

  "tasks": [
    {
      "id": "connect-viewer",
      "description": "Connect as viewer to debug terminal",
      "prompt": {
        "template": "Call MCP tool: terminal_connect with terminalId: {{terminalId}}, connectionId: '{{connectionId}}', viewOnly: true",
        "variables": [
          {
            "name": "connectionId",
            "source": "context",
            "default": "viewer-{{timestamp}}"
          }
        ]
      },
      "tools": ["mcp"]
    },
    {
      "id": "monitor-commands",
      "description": "Watch commands being executed",
      "prompt": {
        "template": "Terminal state:\n{{debug_terminal.content.state.buffer}}\n\nLast 5 commands:\n{{debug_terminal.content.state.shellHistory[-5:]}}\n\nMonitor for suspicious activity.",
        "variables": []
      }
    }
  ]
}
```

## How It's Supposed to Work

### 1. Vessel Registration (Startup)

```
Terminal Vessel starts → HTTP server on port 9137
                      → Registers with backend

POST https://activity.metabob.com/v2/vessels/register
{
  "vesselId": "terminal-vessel-1",
  "endpoint": "http://localhost:9137",
  "shapes": ["terminalState", "terminalCommand", "terminalOutput"]
}

Backend stores:
- Vessel capabilities
- Endpoint mapping
- Shape ownership
```

### 2. Impulse Resolution (Activity Execution)

```
Activity needs impulse with shape: terminalState
↓
MiniBob queries backend: "Who resolves terminalState?"
↓
Backend responds: "terminal-vessel-1 at http://localhost:9137"
↓
MiniBob calls: POST http://localhost:9137/v2/impulses/resolve
{
  "pointer": {
    "type": "terminalState",
    "terminalId": "term-abc123"
  }
}
↓
Terminal Vessel resolves from in-memory PTY state
↓
Returns impulse content to MiniBob
↓
Activity receives loaded impulse in context
```

### 3. Terminal Lifecycle

```
1. SPAWN
   ├─ MCP tool: terminal_spawn(preset: 'shell')
   ├─ Frame manager creates PTY process
   ├─ Impulse store creates terminalState impulse
   └─ Returns: {terminalId, impulseId, pid}

2. USE
   ├─ MCP tool: terminal_send_input(terminalId, 'ls -la\n')
   ├─ Input written to PTY
   ├─ Output captured in buffer
   └─ Impulse updated with new state

3. CHECKPOINT (optional)
   ├─ MCP tool: terminal_checkpoint(terminalId, 'before-risky-operation')
   ├─ Deep clone of current state
   └─ Returns: {checkpointId, timestamp}

4. ROLLBACK (if needed)
   ├─ MCP tool: terminal_replay(terminalId, checkpointId)
   ├─ Restore state to checkpoint
   └─ Replay commands after checkpoint

5. CLEANUP
   ├─ MCP tool: terminal_disconnect(terminalId, connectionId)
   ├─ If no viewers and not persistent: mark for GC
   └─ After 60s: kill PTY, remove impulse
```

## How to Display Impulses

### Option 1: Text Rendering (Current)

Activities can format terminal buffer as text:

```typescript
// In activity prompt template
Terminal Output:
─────────────────────────────────────
{{impulses.dev_terminal.content.state.buffer}}
─────────────────────────────────────

Cursor: Row {{impulses.dev_terminal.content.state.cursor.row}},
        Col {{impulses.dev_terminal.content.state.cursor.col}}

Last Command: {{impulses.dev_terminal.content.state.shellHistory[-1]}}
Exit Code: {{impulses.dev_terminal.content.state.exitCode}}
```

### Option 2: React Renderer (Planned)

**Create `repos/react-renderer` for rich terminal display**

```typescript
// repos/react-renderer/src/components/TerminalImpulseRenderer.tsx
import React from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

interface TerminalImpulseProps {
  impulse: {
    id: string;
    shape: 'terminalState';
    content: {
      state: {
        buffer: string;
        cursor: { row: number; col: number };
        shellHistory: string[];
        exitCode: number | null;
      };
    };
  };
  interactive?: boolean;
  onInput?: (input: string) => void;
}

export function TerminalImpulseRenderer({
  impulse,
  interactive = false,
  onInput
}: TerminalImpulseProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create xterm.js instance
    const terminal = new Terminal({
      rows: 24,
      cols: 80,
      cursorBlink: interactive,
      allowProposedApi: true
    });

    terminal.open(terminalRef.current);
    xtermRef.current = terminal;

    // Render buffer content
    terminal.write(impulse.content.state.buffer);

    // Set cursor position
    terminal.write(`\x1b[${impulse.content.state.cursor.row};${impulse.content.state.cursor.col}H`);

    // Handle input if interactive
    if (interactive && onInput) {
      terminal.onData((data) => {
        onInput(data);
      });
    }

    return () => {
      terminal.dispose();
    };
  }, [impulse.content.state.buffer, interactive]);

  return (
    <div className="terminal-impulse">
      <div className="terminal-header">
        <span className="terminal-id">{impulse.id}</span>
        {impulse.content.state.exitCode !== null && (
          <span className={`exit-code ${impulse.content.state.exitCode === 0 ? 'success' : 'error'}`}>
            Exit: {impulse.content.state.exitCode}
          </span>
        )}
      </div>
      <div ref={terminalRef} className="terminal-content" />
      <div className="terminal-footer">
        <div className="shell-history">
          Last command: <code>{impulse.content.state.shellHistory.slice(-1)[0]}</code>
        </div>
      </div>
    </div>
  );
}
```

### Option 3: Live Dashboard Display

**Activity Dashboard Integration:**

```typescript
// repos/activity-dashboard/src/components/ImpulseViewer.tsx
import { TerminalImpulseRenderer } from '@metabob/react-renderer';

function ImpulseViewer({ impulse }) {
  if (impulse.metadata.shape === 'terminalState') {
    return (
      <TerminalImpulseRenderer
        impulse={impulse}
        interactive={true}
        onInput={async (data) => {
          // Send input back to terminal vessel
          await fetch(`http://localhost:9137/v2/terminals/send-input`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              terminalId: impulse.pointer.terminalId,
              input: data
            })
          });
        }}
      />
    );
  }

  // Other impulse shapes...
  return <pre>{JSON.stringify(impulse.content, null, 2)}</pre>;
}
```

## How It Interacts with repos/react-renderer

### Architecture

```
┌────────────────────────────────────────────────────────┐
│              Activity Dashboard                         │
│  (React 19 + Bun)                                      │
│                                                         │
│  ┌──────────────────────────────────────────────────┐ │
│  │  ExecutionViewer                                  │ │
│  │  ├─ Shows activity execution                      │ │
│  │  ├─ Lists impulses used                          │ │
│  │  └─ Renders each impulse                         │ │
│  │                                                    │ │
│  │     ┌─────────────────────────────────┐          │ │
│  │     │  ImpulseRenderer                 │          │ │
│  │     │  ├─ Detects impulse shape        │          │ │
│  │     │  └─ Routes to shape renderer     │          │ │
│  │     │                                   │          │ │
│  │     │     ┌──────────────────────┐     │          │ │
│  │     │     │  react-renderer      │     │          │ │
│  │     │     │  ├─ TerminalRenderer │     │          │ │
│  │     │     │  ├─ FileRenderer     │     │          │ │
│  │     │     │  ├─ TestRenderer     │     │          │ │
│  │     │     │  └─ ErrorRenderer    │     │          │ │
│  │     │     └──────────────────────┘     │          │ │
│  │     └─────────────────────────────────┘          │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
          │
          ├─── WebSocket → Terminal Vessel (live updates)
          │
          └─── HTTP → Activity API (fetch impulses)
```

### react-renderer Structure

```
repos/react-renderer/
├── package.json
├── src/
│   ├── index.ts                      # Main export
│   ├── types.ts                      # Impulse shape types
│   │
│   ├── renderers/
│   │   ├── TerminalRenderer.tsx     # terminalState impulses
│   │   ├── FileRenderer.tsx         # file impulses
│   │   ├── TestResultRenderer.tsx   # test_result impulses
│   │   ├── ErrorRenderer.tsx        # error impulses
│   │   ├── GitDiffRenderer.tsx      # git_diff impulses
│   │   └── index.ts                 # Export all renderers
│   │
│   ├── components/
│   │   ├── ImpulseRouter.tsx        # Routes to correct renderer
│   │   ├── ImpulsePlaceholder.tsx   # Loading state
│   │   └── ImpulseError.tsx         # Error state
│   │
│   └── hooks/
│       ├── useTerminalConnection.ts  # WebSocket for live updates
│       ├── useImpulseResolution.ts   # Fetch impulse content
│       └── useTerminalInput.ts       # Send input to terminal
│
└── examples/
    └── terminal-viewer.tsx           # Standalone example
```

### Usage in Dashboard

```typescript
// repos/activity-dashboard/src/components/ExecutionViewer.tsx
import { ImpulseRouter } from '@metabob/react-renderer';

export function ExecutionViewer({ execution }: { execution: Execution }) {
  return (
    <div className="execution-viewer">
      <h2>Execution: {execution.execution_id}</h2>

      <div className="impulses-section">
        <h3>Input Impulses</h3>
        {execution.input_impulses.map((impulse) => (
          <div key={impulse.id} className="impulse-card">
            <h4>{impulse.id} ({impulse.metadata.shape})</h4>

            {/* Automatically routes to correct renderer */}
            <ImpulseRouter
              impulse={impulse}
              interactive={true}
              onUpdate={(updatedImpulse) => {
                // Handle impulse updates (e.g., terminal state changed)
                console.log('Impulse updated:', updatedImpulse);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Live Terminal Updates

```typescript
// repos/react-renderer/src/hooks/useTerminalConnection.ts
import { useEffect, useState } from 'react';

export function useTerminalConnection(terminalId: string) {
  const [buffer, setBuffer] = useState('');
  const [cursor, setCursor] = useState({ row: 0, col: 0 });

  useEffect(() => {
    // Connect to terminal vessel WebSocket (future feature)
    const ws = new WebSocket(`ws://localhost:9137/v2/terminals/${terminalId}/stream`);

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);

      if (update.type === 'buffer_update') {
        setBuffer((prev) => prev + update.data);
      }

      if (update.type === 'cursor_move') {
        setCursor(update.cursor);
      }
    };

    return () => ws.close();
  }, [terminalId]);

  return { buffer, cursor };
}
```

## Complete Example: Debug Workflow

```typescript
// 1. Activity spawns terminal
const activity = {
  id: "debug-test-failure",
  tasks: [
    {
      id: "spawn-debug-terminal",
      tools: ["mcp"],
      prompt: "Call terminal_spawn with preset: 'shell', persistent: true"
    },
    {
      id: "run-failing-test",
      tools: ["mcp"],
      prompt: "Call terminal_send_input: 'npm test -- failing-test.js\\n'"
    },
    {
      id: "analyze-output",
      input_impulses: ["debug_terminal"],
      prompt: "Analyze: {{debug_terminal.content.state.buffer}}"
    }
  ]
};

// 2. MiniBob executes activity
// 3. Terminal spawned, test runs
// 4. Terminal state captured as impulse
// 5. Activity analyzes buffer

// 6. Dashboard displays live
<TerminalRenderer
  impulse={{
    id: "terminal-term-abc123",
    shape: "terminalState",
    content: {
      state: {
        buffer: "$ npm test -- failing-test.js\n✗ Test failed: ...",
        cursor: { row: 5, col: 0 },
        shellHistory: ["npm test -- failing-test.js"],
        exitCode: 1
      }
    }
  }}
  interactive={true}
  onInput={(data) => {
    // User can type in dashboard terminal
    // Input sent back to vessel
  }}
/>

// 7. User sees live terminal in browser
// 8. Can interact if needed
// 9. Activity continues with analysis
```

## Next Steps

1. **Test Terminal Vessel**
   ```bash
   cd repos/terminal
   bun run src/index.ts --port 9137
   ```

2. **Create react-renderer**
   ```bash
   mkdir repos/react-renderer
   cd repos/react-renderer
   bun init
   # Implement renderers for each impulse shape
   ```

3. **Integrate with Dashboard**
   ```typescript
   import { ImpulseRouter } from '@metabob/react-renderer';
   // Use in ExecutionViewer
   ```

4. **Create Terminal Activities**
   - Debug workflows
   - Interactive development
   - Server monitoring
   - Collaborative sessions
