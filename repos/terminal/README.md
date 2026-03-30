# Terminal Vessel

General-purpose stateful terminal vessel with multi-viewer synchronization and time-travel debugging.

## Overview

The terminal vessel provides persistent, stateful terminal sessions as first-class impulses in the metabob-devbob system. It enables:

- **Stateful Sessions**: Terminal state persists and can be restored
- **Multi-Viewer Sync**: Multiple instances view same terminal in real-time
- **Time-Travel**: Rollback to checkpoints and replay commands
- **Application Presets**: Optimized configs for Claude, MiniBob, shells, etc.
- **Impulse Integration**: Terminal state as input to activities

## Installation

```bash
cd repos/terminal
bun install
```

## Usage

### Server Configuration

The terminal vessel supports flexible network configuration:

#### Auto-Select Port (Default)

The server automatically finds an available port:

```bash
bun run start
# 🌐 HTTP server listening on port 9137 (auto-selected)
```

#### Explicit Port

Specify a port via command-line or environment:

```bash
# Via command-line argument
bun run src/index.ts --port 3000

# Via environment variable
PORT=3000 bun run start
```

#### Unix Socket

Use a Unix socket instead of TCP:

```bash
bun run src/index.ts --socket /tmp/terminal-vessel.sock
# 🔌 Server listening on Unix socket: /tmp/terminal-vessel.sock
```

This is useful for:
- Local-only connections (no network exposure)
- Permission-based access control
- Lower latency than TCP
- IPC between processes on same machine

#### Server Modes

Set via `MODE` environment variable:

```bash
# HTTP only (vessel discovery)
MODE=http bun run start

# stdio only (MCP server)
MODE=stdio bun run start

# Both modes (default)
MODE=both bun run start
```

### As MCP Server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "bun",
      "args": ["repos/terminal/src/index.ts"],
      "env": {
        "INSTANCE_ID": "terminal-vessel-1",
        "MODE": "stdio"
      }
    }
  }
}
```

For TCP with explicit port:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "bun",
      "args": ["repos/terminal/src/index.ts", "--port", "9090"],
      "env": {
        "INSTANCE_ID": "terminal-vessel-1",
        "MODE": "both"
      }
    }
  }
}
```

For Unix socket:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "bun",
      "args": ["repos/terminal/src/index.ts", "--socket", "/tmp/terminal-vessel.sock"],
      "env": {
        "INSTANCE_ID": "terminal-vessel-1",
        "MODE": "both"
      }
    }
  }
}
```

### Spawn Terminal

```typescript
// Spawn Claude Code session
const { terminalId, impulseId } = await mcpClient.call('terminal_spawn', {
  preset: 'claude',
  persistent: true,
  persistenceKey: 'my-claude-session'
});

// Spawn development shell
const { terminalId } = await mcpClient.call('terminal_spawn', {
  preset: 'shell',
  cwd: '/home/avi/project',
  env: { ANTHROPIC_API_KEY: 'sk-...' }
});

// Spawn custom command
const { terminalId } = await mcpClient.call('terminal_spawn', {
  command: 'python',
  args: ['-i'],
  preset: 'repl'
});
```

### Send Input

```typescript
// Send command
await mcpClient.call('terminal_send_input', {
  terminalId,
  input: 'ls -la\n'
});

// Send with checkpoint
await mcpClient.call('terminal_send_input', {
  terminalId,
  input: 'rm -rf build/\n',
  createCheckpoint: true  // Checkpoint before risky command
});
```

### Multi-Viewer

```typescript
// Developer 1: Spawn terminal
const { terminalId } = await mcpClient.call('terminal_spawn', {
  preset: 'shell'
});

// Developer 2: Connect to watch
await mcpClient.call('terminal_connect', {
  terminalId,
  connectionId: 'dev2',
  viewOnly: true  // Read-only
});

// Both see same terminal state in real-time
```

### Checkpoint & Replay

```typescript
// Create checkpoint
const { checkpointId } = await mcpClient.call('terminal_checkpoint', {
  terminalId,
  label: 'before-deployment'
});

// ... do work ...

// If something goes wrong, rollback and replay
await mcpClient.call('terminal_replay', {
  terminalId,
  checkpointId,
  speed: 1  // Real-time replay
});
```

### List Terminals

```typescript
const { terminals } = await mcpClient.call('terminal_list', {
  filter: 'running'
});

terminals.forEach(t => {
  console.log(`${t.terminalId}: ${t.viewerCount} viewers`);
});
```

## Application Presets

### `claude`
- Command: `claude`
- Interactive: Yes
- Checkpoints: On-prompt (50 max)
- Use case: Claude Code sessions

### `minibob`
- Command: `bun repos/minibob/index.ts`
- Interactive: Yes
- Checkpoints: On-command (100 max)
- Use case: MiniBob autonomous agent

### `shell`
- Shell: `/bin/bash`
- Interactive: Yes
- Checkpoints: Manual (20 max)
- Use case: Development shells

### `vim`
- Command: `vim`
- Interactive: Yes
- Checkpoints: Timed every 1 min (10 max)
- Use case: Text editor sessions

### `repl`
- Interactive: Yes
- Checkpoints: On-prompt (30 max)
- Use case: Python, Node, Bun REPLs

### `server`
- Interactive: No
- Persistent: Yes
- Checkpoints: Timed every 5 min (12 max)
- Use case: Long-running servers

## Architecture

```
Terminal Vessel
├── Frame Manager      # PTY lifecycle
├── Checkpoint Manager # Rollback/replay
├── Connection Pool    # Multi-viewer sync
├── Impulse Store      # State management
└── Replay Engine      # Time-travel
```

## Impulse Shapes

### `terminalState` (Sticky)

Primary impulse containing terminal session state:

```typescript
{
  id: "terminal-<terminalId>",
  shape: "terminalState",
  sticky: true,
  pointer: {
    terminalId: string,
    persistenceKey?: string
  },
  content: {
    state: {
      buffer: string,
      cursor: { row, col },
      running: boolean,
      exitCode: number | null,
      shellHistory: string[],
      // ...
    },
    checkpoints: Checkpoint[],
    connections: Connection[]
  }
}
```

## Development

```bash
# Run server
bun run start

# Development mode
bun run dev

# Run tests
bun test

# Type check
bun run typecheck
```

## Examples

See `examples/` directory for:
- Claude Code sessions
- Development shell workflows
- Server monitoring
- Collaborative debugging

## Integration with Activities

Terminal state can be used as activity input:

```typescript
{
  "id": "debug-from-terminal",
  "tasks": [
    {
      "id": "analyze-error",
      "prompt": {
        "template": `
Terminal Output:
{{impulses.devTerminal.content.state.buffer}}

Last Command: {{impulses.devTerminal.content.state.shellHistory[-1]}}
Exit Code: {{impulses.devTerminal.content.state.exitCode}}

What went wrong?
        `
      },
      "impulseRefs": ["devTerminal"]
    }
  ]
}
```

## License

MIT
