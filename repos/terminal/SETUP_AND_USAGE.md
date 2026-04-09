#Complete Setup and Usage Guide

## Overview: The Complete System

```
┌──────────────────────────────────────────────────────────────┐
│                    HUMAN INTERFACES                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ CLI Tool     │  │ Web Dashboard│  │ Activity Hook     │  │
│  │ (Interactive)│  │ (Visualize)  │  │ (Automatic)       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
└─────────┼──────────────────┼───────────────────┼─────────────┘
          │                  │                   │
          ▼                  ▼                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    TERMINAL VESSEL                            │
│  ┌──────────────────┐  ┌────────────────────────────────┐   │
│  │ HTTP Server      │  │ MCP Server (stdio)             │   │
│  │ (Port 9137)      │  │ - terminal_spawn               │   │
│  │ - /health        │  │ - terminal_send_input          │   │
│  │ - /v2/impulses/  │  │ - terminal_connect             │   │
│  │   resolve        │  │ - terminal_checkpoint          │   │
│  └──────────────────┘  └────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ State Space (In-Memory)                               │   │
│  │ - PTY processes                                       │   │
│  │ - Terminal buffers                                    │   │
│  │ - Checkpoints                                         │   │
│  │ - Viewer connections                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                   ACTIVITIES & BACKEND                        │
│  - Load terminal state as impulses                           │
│  - Execute with terminal context                             │
│  - Learn from execution traces                               │
└──────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start Terminal Vessel

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/terminal

# Start terminal vessel on port 9137
bun run src/index.ts --port 9137

# Output:
# 🌐 HTTP server listening on port 9137
#    Health: http://localhost:9137/health
#    Resolve: http://localhost:9137/v2/impulses/resolve
```

### 2. Test with CLI

```bash
# Make CLI executable
chmod +x cli/terminal-cli.ts

# Spawn a terminal
./cli/terminal-cli.ts spawn shell

# Output:
# 📦 Spawning terminal with preset: shell
# ✅ Terminal spawned successfully
#    Terminal ID: term-abc123
#    Impulse ID: terminal-term-abc123
#    PID: 12345
```

### 3. Interact with Terminal

```bash
# Send a command
./cli/terminal-cli.ts send term-abc123 "echo 'Hello from terminal vessel'"

# View terminal state
./cli/terminal-cli.ts state term-abc123

# List all terminals
./cli/terminal-cli.ts list

# Enter interactive mode
./cli/terminal-cli.ts interactive term-abc123
```

### 4. Inspect State Space

```bash
chmod +x cli/state-space-inspector.ts

# One-time snapshot
./cli/state-space-inspector.ts

# Watch mode (updates every 5s)
./cli/state-space-inspector.ts watch
```

## Usage Scenarios

### Scenario 1: Human Interface for Development

**Use case:** Developer wants to run commands and see output

```bash
# 1. Spawn development shell
./cli/terminal-cli.ts spawn shell

# Returns: term-dev-001

# 2. Enter interactive mode
./cli/terminal-cli.ts interactive term-dev-001

# Now you can type commands:
$ cd repos/minibob
$ bun test
$ npm run build

# 3. View full state at any time
./cli/terminal-cli.ts state term-dev-001
```

**What you get:**
- Full terminal buffer
- Command history
- Exit codes
- Cursor position
- Interactive REPL

### Scenario 2: Hook into Activity Executions

**Use case:** Automatically attach terminals to activities for monitoring

```bash
# Set up environment
export METABOB_API_KEY=your-api-key
export ACTIVITY_API_ENDPOINT=https://activity.metabob.com
export TERMINAL_VESSEL_ENDPOINT=http://localhost:9137

# Start activity hook (monitors and auto-attaches terminals)
chmod +x cli/activity-terminal-hook.ts
./cli/activity-terminal-hook.ts

# Output:
# 🔗 Starting activity-terminal-hook...
#    Activity API: https://activity.metabob.com
#    Terminal Vessel: http://localhost:9137
# ✅ Hook active - monitoring for activity executions
```

**What happens:**
1. Hook polls for new activity executions
2. If activity needs terminal (debug, test, build categories)
3. Automatically spawns terminal session
4. Attaches terminal impulse to execution
5. Activity can load terminal state
6. Hook monitors for side-effects (file changes, git ops, errors)
7. Reports side-effects to activity API

### Scenario 3: Activity Uses Terminal Impulse

**Create activity that uses terminal:**

```json
{
  "id": "debug-test-failure",
  "input_impulses": [
    {
      "id": "test_terminal",
      "pointer": {
        "type": "terminalState",
        "terminalId": "{{terminalId}}"
      },
      "metadata": { "shape": "terminalState" },
      "budget": 10000
    }
  ],
  "tasks": [
    {
      "id": "analyze-error",
      "prompt": "Terminal output:\n{{impulses.test_terminal.content.state.buffer}}\n\nWhat failed?"
    }
  ]
}
```

**Execute:**

```bash
# 1. Register activity
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d @activities/debug-test-failure.json

# 2. Spawn terminal and run test
./cli/terminal-cli.ts spawn shell
# Returns: term-test-001

./cli/terminal-cli.ts send term-test-001 "npm test"

# 3. Execute activity with terminal impulse
minibob --single "execute activity: debug-test-failure with terminalId: term-test-001"
```

**Activity receives:**
- Full terminal buffer
- Exit code (1 = failed)
- Command history
- Can analyze error, extract file:line

### Scenario 4: Discover State Space

**Use case:** "What terminals exist? What can I display?"

```bash
./cli/state-space-inspector.ts

# Output:
# ╔═══════════════════════════════════════════════════════════╗
# ║           STATE SPACE SNAPSHOT                            ║
# ╚═══════════════════════════════════════════════════════════╝
#
# ┌─ TERMINALS (2) ──────────────────
#    1. ● term-dev-001
#       PID: 12345 | Viewers: 1 | Persistent: Yes
#       Impulse: terminal-term-dev-001
#
#    2. ○ term-test-002
#       PID: 12346 | Viewers: 0 | Persistent: No
#       Impulse: terminal-term-test-002
#
# ┌─ IMPULSES (2) ───────────────────
#    terminalState (2)
#       ✓ terminal-term-dev-001 📌
#          Budget: 10000 tokens | Size: 5.2 KB
#
# ┌─ AVAILABLE SHAPES (3) ───────────
#    terminalState
#       Resolver: terminal-vessel
#       Endpoint: http://localhost:9137
#       Count: 2
```

**This tells you:**
- Which terminals are running
- Which impulses exist
- What shapes are available
- How to reference them

## Handling Side-Effects

### Side-Effect Detection

The activity hook automatically detects:

**1. File system changes:**
```bash
# Detected commands: git add, git commit, rm, mv, cp, mkdir, touch
./cli/terminal-cli.ts send term-001 "git add ."
# Hook reports: { type: 'filesystem_change', command: 'git add .' }
```

**2. Git operations:**
```bash
./cli/terminal-cli.ts send term-001 "git commit -m 'fix'"
# Hook reports: { type: 'git_operation', command: 'git commit ...' }
```

**3. Network operations:**
```bash
./cli/terminal-cli.ts send term-001 "npm install react"
# Hook reports: { type: 'network_operation', command: 'npm install react' }
```

**4. Command failures:**
```bash
./cli/terminal-cli.ts send term-001 "npm test"
# If exitCode != 0:
# Hook reports: { type: 'command_failure', exitCode: 1 }
```

### Side-Effect Handling

**Option 1: Automatic (via hook)**
```bash
# Hook running in background
./cli/activity-terminal-hook.ts

# Side-effects automatically reported to activity API
# Available at: GET /v2/activities/side-effects?execution_id=<id>
```

**Option 2: Manual (via activity)**
```json
{
  "tasks": [
    {
      "id": "check-side-effects",
      "prompt": "After running command, check:\n1. git status → any file changes?\n2. Exit code → did it succeed?\n3. Buffer output → any errors?"
    }
  ]
}
```

**Option 3: Validation (in activity)**
```json
{
  "tasks": [
    {
      "id": "run-command",
      "tools": ["mcp"],
      "prompt": "Call terminal_send_input: 'npm test'"
    },
    {
      "id": "validate-no-side-effects",
      "validation": {
        "forbiddenSideEffects": ["filesystem_change", "git_operation"]
      },
      "prompt": "Check terminal state - verify no unexpected changes"
    }
  ]
}
```

## Knowing What to Show

### Discovery Process

```
1. Query terminal vessel for active terminals
   GET /v2/terminals/list

2. For each terminal, resolve impulse
   POST /v2/impulses/resolve
   { "pointer": { "type": "terminalState", "terminalId": "term-123" } }

3. Check activity executions for terminal usage
   GET /v2/activities/execution-traces?limit=20
   Filter: executions with terminalState impulses

4. Build state space map
   - Terminals → Impulses → Executions → Renderers
```

### Display Decision Tree

```typescript
function whatToShow(impulse: Impulse) {
  // 1. Detect shape
  const shape = impulse.metadata.shape;

  // 2. Route to renderer
  switch (shape) {
    case 'terminalState':
      return 'TerminalRenderer'; // xterm.js

    case 'file':
      return 'FileRenderer'; // syntax highlighting

    case 'test_result':
      return 'TestRenderer'; // pass/fail summary

    case 'error':
      return 'ErrorRenderer'; // stack trace

    default:
      return 'JSONRenderer'; // fallback
  }
}
```

### What Each Renderer Shows

**TerminalRenderer:**
- xterm.js terminal emulator
- ANSI buffer rendering
- Cursor position
- Exit code badge
- Last command
- Interactive input (optional)

**FileRenderer:**
- Syntax highlighting
- Line numbers
- Search/filter
- Diff view (if git_diff shape)

**TestRenderer:**
- Pass/fail summary
- Failed test details
- Duration stats
- Coverage (if available)

**ErrorRenderer:**
- Error message
- Stack trace with file:line links
- Suggested fixes (if available)

## Complete Examples

### Example 1: Debug Workflow

```bash
# 1. Start vessel
bun run src/index.ts --port 9137 &

# 2. Start activity hook (auto-attach terminals)
./cli/activity-terminal-hook.ts &

# 3. Execute debug activity
minibob --single "debug the failing test in repos/minibob"

# What happens:
# - Hook detects debug activity starting
# - Spawns terminal session automatically
# - Attaches terminal impulse to execution
# - Activity loads terminal state
# - Activity runs test in terminal
# - Activity analyzes terminal buffer
# - Activity reports findings

# 4. View terminal state
./cli/terminal-cli.ts state <terminal-id>

# 5. View in dashboard
# Navigate to: https://dashboard.metabob.com/executions/<id>
# See: TerminalRenderer showing live terminal
```

### Example 2: Interactive Development

```bash
# 1. Spawn persistent development shell
./cli/terminal-cli.ts spawn shell --persistent

# Returns: term-dev-001

# 2. Enter interactive mode
./cli/terminal-cli.ts interactive term-dev-001

# Now work normally:
$ cd repos/minibob
$ bun test
$ git add .
$ git commit -m "fix tests"

# 3. Terminal state captured as impulse
# Available to activities as: terminal-term-dev-001

# 4. Activity can analyze your work
minibob --single "summarize what I did in terminal: term-dev-001"

# Activity sees:
# - All commands you ran
# - All output
# - File changes (via git commands)
# - Test results
```

### Example 3: State Space Monitoring

```bash
# Watch state space in real-time
./cli/state-space-inspector.ts watch

# In another terminal, do work:
./cli/terminal-cli.ts spawn shell
./cli/terminal-cli.ts spawn shell
./cli/terminal-cli.ts send term-001 "npm test"

# Watch screen updates showing:
# - New terminals appearing
# - Impulses being created
# - Memory usage changing
# - Activity executions starting/completing
```

## Troubleshooting

**Terminal vessel won't start:**
```bash
# Check if port 9137 is in use
lsof -i :9137

# Try different port
bun run src/index.ts --port 9138
```

**Can't connect to terminal:**
```bash
# List active terminals
./cli/terminal-cli.ts list

# Check health
curl http://localhost:9137/health
```

**Activity can't load terminal impulse:**
```bash
# Verify impulse exists
curl -X POST http://localhost:9137/v2/impulses/resolve \
  -H 'Content-Type: application/json' \
  -d '{"pointer": {"type": "terminalState", "terminalId": "term-123"}}'

# Check if terminal is still running
./cli/terminal-cli.ts state term-123
```

**Hook not detecting activities:**
```bash
# Check API key
echo $METABOB_API_KEY

# Check connectivity
curl https://activity.metabob.com/health

# Check hook logs
./cli/activity-terminal-hook.ts
# Should show: "✅ Hook active - monitoring for activity executions"
```

## Next Steps

1. **Set up react-renderer:**
   ```bash
   cd repos/react-renderer
   bun install
   ```

2. **Integrate with dashboard:**
   ```typescript
   import { ImpulseRouter } from '@metabob/react-renderer';
   <ImpulseRouter impulse={terminalImpulse} interactive={true} />
   ```

3. **Create more activities:**
   - Debug workflows
   - Test runners
   - Build monitors
   - Deployment watchers

4. **Add WebSocket support:**
   - Live terminal updates
   - Multi-viewer synchronization
   - Real-time collaboration
