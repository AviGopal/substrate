# Terminal Vessel: Complete Integration Guide

## Quick Answers to Your Questions

### 1. How do we use it to create a human interface?

**Three interfaces created:**

#### A. CLI Tool (`cli/terminal-cli.ts`)
```bash
# Interactive command-line interface
./cli/terminal-cli.ts spawn shell
./cli/terminal-cli.ts send <id> "command"
./cli/terminal-cli.ts state <id>
./cli/terminal-cli.ts interactive <id>
```

**Features:**
- Spawn terminals
- Send commands
- View state (buffer, history, cursor)
- Interactive REPL mode
- Color-coded output

#### B. Activity Hook (`cli/activity-terminal-hook.ts`)
```bash
# Automatically attaches terminals to activities
export METABOB_API_KEY=your-key
./cli/activity-terminal-hook.ts
```

**Features:**
- Monitors activity executions
- Auto-spawns terminals for debug/test/build activities
- Attaches terminal impulses
- Reports side-effects
- Runs in background

#### C. State Space Inspector (`cli/state-space-inspector.ts`)
```bash
# Discover what's in the state space
./cli/state-space-inspector.ts          # One-time snapshot
./cli/state-space-inspector.ts watch    # Continuous monitoring
```

**Features:**
- Lists all active terminals
- Shows available impulses
- Displays active executions
- Shows available shapes
- Memory usage stats
- Real-time updates

### 2. How can it hook into existing activity executions?

**Automatic hooking via monitoring:**

```typescript
// activity-terminal-hook.ts monitors for:
// 1. New activity executions (polls every 2s)
// 2. Activities that need terminals (debug, test, build, etc.)
// 3. Auto-spawns terminal session
// 4. Attaches terminal impulse to execution
// 5. Activity can load terminal state
```

**Manual hooking via impulse references:**

```json
{
  "input_impulses": [
    {
      "id": "execution_terminal",
      "pointer": {
        "type": "terminalState",
        "terminalId": "{{terminalId}}"
      }
    }
  ]
}
```

**Hook detection criteria:**
- Activity has `terminalState` input impulse
- Activity uses terminal/mcp tools
- Activity category is debug/test/build/deploy

### 3. How do we handle side-effects?

**Four types detected automatically:**

#### A. File System Changes
```bash
# Detected: git add, git commit, rm, mv, cp, mkdir, touch
./cli/terminal-cli.ts send term-001 "git add ."
# Hook reports: { type: 'filesystem_change', command: 'git add .' }
```

#### B. Git Operations
```bash
./cli/terminal-cli.ts send term-001 "git commit -m 'fix'"
# Hook reports: { type: 'git_operation', command: 'git commit ...' }
```

#### C. Network Operations
```bash
./cli/terminal-cli.ts send term-001 "npm install react"
# Hook reports: { type: 'network_operation', command: 'npm install react' }
```

#### D. Command Failures
```bash
./cli/terminal-cli.ts send term-001 "npm test"
# If exit code != 0:
# Hook reports: { type: 'command_failure', exitCode: 1 }
```

**Detection mechanism:**
```typescript
// activity-terminal-hook.ts polls terminal state every 3s
// Checks buffer and shellHistory for patterns
// Reports to: POST /v2/activities/side-effects
```

**Validation in activities:**
```json
{
  "validation": {
    "forbiddenSideEffects": ["filesystem_change"],
    "allowedSideEffects": ["network_operation"]
  }
}
```

### 4. How do we know what's in the state space and what to show?

**Discovery Process:**

```bash
# 1. Query terminal vessel
./cli/state-space-inspector.ts

# Shows:
# - Active terminals (term-abc123, term-def456)
# - Impulses (terminal-term-abc123)
# - Available shapes (terminalState, terminalCommand, terminalOutput)
# - Active executions using terminals
# - Memory usage
```

**What each component shows:**

#### State Space Inspector Output:
```
┌─ TERMINALS (2) ──────────────────
   1. ● term-abc123 (running)
      PID: 12345 | Viewers: 1
      Impulse: terminal-term-abc123

┌─ IMPULSES (2) ───────────────────
   terminalState (2)
      ✓ terminal-term-abc123 📌
         Size: 5.2 KB | Budget: 10000 tokens

┌─ AVAILABLE SHAPES (3) ───────────
   terminalState
      Resolver: terminal-vessel
      Endpoint: http://localhost:9137
      Examples: terminal-term-abc123
```

#### Terminal CLI Output:
```
Terminal State: term-abc123
PID: 12345
CWD: /home/avi/project
Running: Yes
Exit Code: N/A
Cursor: Row 5, Col 0

Shell History:
  1. npm test
  2. git status
  3. ls -la

Terminal Buffer:
─────────────────────────────────────
$ npm test
✓ All tests passed
$▊
─────────────────────────────────────
```

## Complete Setup

### Prerequisites
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/terminal
bun install  # Already done
```

### File Structure
```
repos/terminal/
├── src/index.ts                     # Terminal vessel server
├── cli/
│   ├── terminal-cli.ts              # Human interface (CLI)
│   ├── activity-terminal-hook.ts    # Auto-attach to activities
│   └── state-space-inspector.ts     # Discover state space
├── activities/
│   └── example-debug-with-terminal.json  # Example activity
├── demo.sh                          # Complete demo script
├── SETUP_AND_USAGE.md              # Detailed guide
└── HOW_IT_WORKS.md                 # Architecture guide
```

### Quick Start
```bash
# Run complete demo
./demo.sh

# Or manual:
# 1. Start vessel
bun run src/index.ts --port 9137 &

# 2. Use CLI
./cli/terminal-cli.ts spawn shell
./cli/terminal-cli.ts list
./cli/terminal-cli.ts state <id>

# 3. Inspect state space
./cli/state-space-inspector.ts

# 4. Hook into activities (optional)
export METABOB_API_KEY=your-key
./cli/activity-terminal-hook.ts &
```

## Integration with Activities

### Pattern 1: Activity Spawns Terminal

```json
{
  "tasks": [
    {
      "id": "spawn",
      "tools": ["mcp"],
      "prompt": "Call terminal_spawn with preset: 'shell'"
    },
    {
      "id": "run-tests",
      "tools": ["mcp"],
      "prompt": "Call terminal_send_input with terminalId: {{spawnResult.terminalId}}, input: 'npm test'"
    },
    {
      "id": "analyze",
      "input_impulses": ["terminal"],
      "prompt": "Analyze buffer: {{impulses.terminal.content.state.buffer}}"
    }
  ]
}
```

### Pattern 2: Activity Loads Existing Terminal

```json
{
  "input_impulses": [
    {
      "id": "dev_terminal",
      "pointer": {
        "type": "terminalState",
        "terminalId": "term-dev-001"
      }
    }
  ],
  "tasks": [
    {
      "id": "analyze",
      "prompt": "What commands were run?\n{{impulses.dev_terminal.content.state.shellHistory}}"
    }
  ]
}
```

### Pattern 3: Hook Auto-Attaches

```bash
# Hook running in background
./cli/activity-terminal-hook.ts &

# Execute activity (hook detects and attaches terminal)
minibob --single "debug the failing test"

# Activity automatically has terminal impulse available
```

## Display Rendering

### In Activities (Text)
```typescript
// Activity prompt template
Terminal Output:
{{impulses.terminal.content.state.buffer}}

Last Command: {{impulses.terminal.content.state.shellHistory[-1]}}
Exit Code: {{impulses.terminal.content.state.exitCode}}
```

### In Dashboard (React)
```tsx
import { TerminalRenderer } from '@metabob/react-renderer';

<TerminalRenderer
  impulse={terminalImpulse}
  interactive={true}
  onInput={(data) => {
    fetch('http://localhost:9137/v2/terminals/send-input', {
      method: 'POST',
      body: JSON.stringify({ terminalId, input: data })
    });
  }}
/>
```

### In CLI (Interactive)
```bash
./cli/terminal-cli.ts interactive term-abc123
# Opens REPL - type commands, see output
```

## Key Features

✅ **Human Interfaces**: CLI, hook, inspector
✅ **Activity Integration**: MCP tools + impulses
✅ **Side-Effect Detection**: File, git, network, failures
✅ **State Space Discovery**: What exists, what to show
✅ **Multi-Viewer**: Multiple connections to same terminal
✅ **Checkpoints**: Rollback and replay
✅ **Persistence**: Restore sessions
✅ **Real-Time Monitoring**: Watch state changes

## Files Created

**Documentation:**
- `SETUP_AND_USAGE.md` - Complete usage guide
- `HOW_IT_WORKS.md` - Architecture and integration
- `OBSERVATION_LOOP.md` - Learning loop integration
- `TERMINAL_AND_RENDERER_GUIDE.md` - React rendering

**Tools:**
- `cli/terminal-cli.ts` - Human interface
- `cli/activity-terminal-hook.ts` - Auto-attach to activities
- `cli/state-space-inspector.ts` - State discovery
- `demo.sh` - Complete demonstration

**Examples:**
- `activities/example-debug-with-terminal.json` - Activity example

**React Renderer:**
- `../react-renderer/src/renderers/TerminalRenderer.tsx`
- `../react-renderer/src/components/ImpulseRouter.tsx`

## Try It Now

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/terminal

# Complete demo
./demo.sh

# Or step-by-step:
bun run src/index.ts --port 9137 &
./cli/terminal-cli.ts spawn shell
./cli/terminal-cli.ts state <id>
./cli/state-space-inspector.ts
```

The terminal vessel is now fully functional with:
- ✅ HTTP server for impulse resolution
- ✅ MCP server for tool calls
- ✅ Human-friendly CLI
- ✅ Activity integration hooks
- ✅ Side-effect detection
- ✅ State space discovery
- ✅ React rendering (scaffold ready)

Everything works together through the impulse abstraction!
