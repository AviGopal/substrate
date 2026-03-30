# Terminal Vessel Specification

**Version:** 1.0.0
**Status:** Implementation
**Last Updated:** 2026-03-28

## Overview

General-purpose stateful terminal vessel that provides:
- Persistent terminal sessions via PTY
- Multi-viewer synchronization (multiple instances see same state)
- Rollback/replay capabilities via checkpoints
- Terminal state as first-class impulses
- Application presets for common tools (Claude, MiniBob, shells, REPLs)

## Core Principles

1. **Lightweight**: No direct database dependencies, delegates persistence to backend
2. **Local Resolution**: Resolves `terminalState` impulses from in-memory PTY state
3. **Backend Storage**: Uses metabob-activity-api MCP for persistence
4. **Stateful Sync**: Multiple viewers see identical terminal state in real-time
5. **Time-Travel**: Checkpoints enable rollback and replay at configurable speed

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Terminal Vessel                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Frame        │  │ State        │  │ Checkpoint   │      │
│  │ Manager      │→ │ Coordinator  │→ │ Manager      │      │
│  │ (PTY)        │  │ (Multi-View) │  │ (Rollback)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                  ↓                  ↓             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Impulse Store (In-Memory)                   │  │
│  │   Map<terminalId, TerminalStateImpulse>              │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              MCP Server (stdio)                       │  │
│  │   Tools: spawn, send_input, connect, checkpoint, etc │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓ MCP
┌─────────────────────────────────────────────────────────────┐
│              metabob-activity-api (Backend)                  │
│   - Persistent impulse storage (SurrealDB)                  │
│   - Multi-tenant isolation                                  │
│   - Query capabilities                                      │
└─────────────────────────────────────────────────────────────┘
```

## Impulse Shapes

### terminalState (Sticky)

Primary impulse representing terminal session state.

```typescript
{
  id: "terminal-<terminalId>",
  shape: "terminalState",
  sticky: true,                    // Won't be GC'd until explicit disconnect
  connectionId: string,            // Original spawner
  instanceId: string,              // Vessel instance ID
  pointer: {
    terminalId: string,
    persistenceKey?: string        // For restoration
  },
  content: {
    state: {
      terminalId: string,
      pid: number,
      shell: string,
      cwd: string,
      buffer: string,              // ANSI terminal buffer
      cursor: { row: number, col: number },
      scrollback: string[],
      running: boolean,
      exitCode: number | null,
      environmentVars: Record<string, string>,
      shellHistory: string[],
      createdAt: number,
      lastActivity: number,
      totalCommands: number
    },
    history: TerminalCommand[],    // All commands executed
    position: number,               // Current command index
    checkpoints: Checkpoint[],      // Rollback points
    connections: Connection[]       // Active viewers
  }
}
```

### terminalCommand

Represents a command execution.

```typescript
{
  id: "cmd-<timestamp>",
  shape: "terminalCommand",
  pointer: {
    terminalId: string,
    command: string
  },
  content: {
    command: string,
    timestamp: number,
    exitCode?: number,
    duration?: number,
    output?: string
  }
}
```

### terminalOutput

Represents terminal output buffer.

```typescript
{
  id: "output-<terminalId>-<timestamp>",
  shape: "terminalOutput",
  pointer: {
    terminalId: string,
    fromLine: number,
    toLine: number
  },
  content: {
    lines: string[],
    ansiParsed: boolean
  }
}
```

## MCP Tools

### terminal_spawn

Spawn a new terminal session.

**Input:**
```typescript
{
  command?: string,           // e.g., 'claude', 'vim', 'python'
  args?: string[],
  shell?: string,             // default: /bin/bash
  cwd?: string,
  env?: Record<string, string>,
  interactive?: boolean,
  captureAll?: boolean,       // Capture full output
  persistent?: boolean,
  persistenceKey?: string,
  preset?: 'claude' | 'minibob' | 'shell' | 'vim' | 'repl' | 'server'
}
```

**Output:**
```typescript
{
  terminalId: string,
  impulseId: string,
  pid: number
}
```

**Behavior:**
1. Apply preset configuration if specified
2. Spawn PTY process with node-pty
3. If command specified, send to PTY after spawn
4. Create `terminalState` impulse in memory
5. If persistent, save impulse to backend via MCP
6. Return terminal identifiers

### terminal_send_input

Send input to terminal.

**Input:**
```typescript
{
  terminalId: string,
  input: string,
  createCheckpoint?: boolean
}
```

**Output:**
```typescript
{
  success: boolean,
  checkpointId?: string
}
```

**Behavior:**
1. If createCheckpoint, snapshot current state
2. Write input to PTY
3. Record command in history
4. Update impulse state
5. Broadcast to connected viewers

### terminal_connect

Connect as viewer to terminal (read-only or interactive).

**Input:**
```typescript
{
  terminalId: string,
  connectionId: string,
  viewOnly?: boolean
}
```

**Output:**
```typescript
{
  connected: boolean,
  state: TerminalFrameState,
  viewerCount: number
}
```

**Behavior:**
1. Add connection to connection pool
2. Get current terminal state
3. Return state to viewer
4. Subscribe viewer to state updates

### terminal_disconnect

Disconnect viewer from terminal.

**Input:**
```typescript
{
  terminalId: string,
  connectionId: string
}
```

**Output:**
```typescript
{
  disconnected: boolean,
  remainingViewers: number
}
```

**Behavior:**
1. Remove connection from pool
2. If no viewers left and not persistent, mark for cleanup
3. Return remaining viewer count

### terminal_checkpoint

Create checkpoint for rollback.

**Input:**
```typescript
{
  terminalId: string,
  label?: string,
  broadcast?: boolean
}
```

**Output:**
```typescript
{
  checkpointId: string,
  timestamp: number,
  position: number
}
```

**Behavior:**
1. Deep clone current terminal state
2. Create checkpoint with metadata
3. Add to checkpoint list (limit to maxCheckpoints)
4. If broadcast, share with other terminals
5. Return checkpoint identifier

### terminal_replay

Rollback to checkpoint and replay commands.

**Input:**
```typescript
{
  terminalId: string,
  checkpointId: string,
  speed?: number              // Replay speed multiplier (default: 10)
}
```

**Output:**
```typescript
{
  success: boolean,
  replayedCommands: number,
  finalPosition: number
}
```

**Behavior:**
1. Get checkpoint state
2. Restore PTY to checkpoint state (reset terminal, replay buffer)
3. Get commands after checkpoint
4. Replay commands at specified speed
5. Verify final state alignment
6. Return replay results

### terminal_restore

Restore persistent terminal session.

**Input:**
```typescript
{
  persistenceKey: string
}
```

**Output:**
```typescript
{
  terminalId: string,
  impulseId: string,
  restored: boolean
}
```

**Behavior:**
1. Query backend for impulse via MCP
2. Extract terminal state from impulse
3. Spawn new PTY with restored configuration
4. Replay buffer and history to restore state
5. Return new terminal identifiers

### terminal_list

List active terminal sessions.

**Input:**
```typescript
{
  filter?: 'all' | 'running' | 'exited' | 'persistent'
}
```

**Output:**
```typescript
{
  terminals: Array<{
    terminalId: string,
    pid: number,
    running: boolean,
    viewerCount: number,
    persistent: boolean,
    createdAt: number,
    lastActivity: number
  }>
}
```

## Application Presets

### claude
```typescript
{
  command: 'claude',
  interactive: true,
  captureAll: true,
  checkpoint: {
    frequency: 'on-prompt',
    maxCheckpoints: 50
  },
  env: { TERM: 'xterm-256color' }
}
```

### minibob
```typescript
{
  command: 'bun',
  args: ['repos/minibob/index.ts', '--mode=terminal'],
  interactive: true,
  checkpoint: {
    frequency: 'on-command',
    maxCheckpoints: 100
  }
}
```

### shell
```typescript
{
  shell: '/bin/bash',
  interactive: true,
  checkpoint: {
    frequency: 'manual',
    maxCheckpoints: 20
  }
}
```

### vim
```typescript
{
  command: 'vim',
  interactive: true,
  captureAll: true,
  checkpoint: {
    frequency: 'timed',
    interval: 60000,
    maxCheckpoints: 10
  }
}
```

### repl
```typescript
{
  interactive: true,
  captureAll: true,
  checkpoint: {
    frequency: 'on-prompt',
    maxCheckpoints: 30
  }
}
```

### server
```typescript
{
  interactive: false,
  captureAll: true,
  checkpoint: {
    frequency: 'timed',
    interval: 300000,
    maxCheckpoints: 12
  },
  persistent: true
}
```

## Multi-Viewer Synchronization

### State Broadcast Pattern

When terminal state changes:
1. Frame manager emits `stateChange` event
2. State coordinator receives event
3. State coordinator broadcasts to all connections
4. Each viewer receives update via subscription

### Connection States

- **connecting**: Initial connection, awaiting state
- **connected**: Active, receiving updates
- **syncing**: Catching up after reconnect
- **disconnected**: No longer receiving updates

### Misalignment Detection

If viewer state diverges from canonical state:
1. Compare cursor position, buffer hash, command position
2. If mismatch detected, trigger catchup
3. Rollback viewer to common checkpoint
4. Replay at high speed to current position

## Checkpoint Strategy

### Automatic Checkpoints

- **on-prompt**: Before user input (interactive shells)
- **on-command**: After each command completion
- **timed**: Every N milliseconds
- **manual**: Explicit checkpoint calls only

### Checkpoint Limits

- Each terminal maintains `maxCheckpoints` (configurable)
- When limit reached, oldest checkpoint discarded (FIFO)
- Persistent terminals: checkpoints saved to backend

### Checkpoint Storage

```typescript
interface Checkpoint {
  id: string,
  terminalId: string,
  position: number,           // Command index
  state: TerminalFrameState,  // Deep clone
  timestamp: number,
  label?: string,
  broadcast?: boolean         // Shared with other terminals
}
```

## Persistence

### Saving Sessions

When `persistent: true`:
1. Create impulse with persistenceKey
2. Call `metabob_activity_api_save_impulse` via MCP
3. Backend stores in SurrealDB with org_id isolation

### Restoring Sessions

1. Call `metabob_activity_api_resolve_impulse` with persistenceKey
2. Backend queries SurrealDB for impulse
3. Terminal vessel receives impulse
4. Spawn new PTY with restored state
5. Replay buffer and history

### TTL (Time-To-Live)

- Persistent sessions have configurable TTL (default: 24 hours)
- Backend worker cleans up expired sessions
- Can be extended via heartbeat mechanism

## Performance Considerations

### Memory Management

- Active terminals: ~1-5 MB per terminal (buffer + history)
- Checkpoints: ~1-5 MB per checkpoint
- Connection overhead: ~10 KB per viewer
- Recommended limit: 100 concurrent terminals per vessel

### Buffer Limits

- Terminal buffer: 1000 lines (older lines → scrollback)
- Scrollback: 10,000 lines max (FIFO)
- Command history: 1,000 commands per terminal

### Broadcast Throttling

- State updates batched every 100ms
- Large output (>1MB) triggers chunked broadcast
- Viewers can configure update frequency

## Security Considerations

### Input Validation

- Sanitize command input before PTY write
- Prevent shell injection via command arguments
- Validate environment variables

### Access Control

- Connection requires valid connectionId
- Backend enforces org_id isolation for persistent sessions
- View-only mode prevents input sending

### Resource Limits

- Max terminals per org: Configurable (default: 50)
- Max viewers per terminal: 10
- Rate limiting on spawn/input operations

## Error Handling

### PTY Errors

- Process exit: Record exit code, mark terminal as stopped
- Spawn failure: Return error, cleanup resources
- Write failure: Retry once, then fail gracefully

### Backend Errors

- Persistence failure: Log error, continue in-memory only
- Restore failure: Return error, suggest manual recreation
- Connection timeout: Retry with exponential backoff

### Viewer Errors

- Disconnect: Remove from pool, notify remaining viewers
- Sync failure: Trigger catchup or full reconnect
- Timeout: Mark connection as stale, cleanup after grace period

## Testing Strategy

### Unit Tests

- Frame manager: spawn, input, state
- Checkpoint manager: create, rollback, limits
- State coordinator: broadcast, sync
- Connection pool: add, remove, list

### Integration Tests

- Multi-viewer synchronization
- Persistence and restoration
- Rollback and replay
- Application presets

### End-to-End Tests

- Claude session workflow
- Development shell with checkpoints
- Server monitoring with multiple viewers
- Collaborative debugging scenario

## Deployment

### As MCP Server

```json
{
  "mcpServers": {
    "terminal": {
      "command": "bun",
      "args": ["repos/terminal/src/index.ts"],
      "env": {
        "INSTANCE_ID": "terminal-vessel-1",
        "BACKEND_MCP_SERVER": "metabob-activity-api"
      }
    }
  }
}
```

### Environment Variables

- `INSTANCE_ID`: Unique vessel instance identifier
- `BACKEND_MCP_SERVER`: MCP server name for backend
- `MAX_TERMINALS`: Maximum concurrent terminals (default: 100)
- `CHECKPOINT_STRATEGY`: Default checkpoint strategy
- `LOG_LEVEL`: Logging verbosity

## Future Enhancements

1. **Binary protocol support**: For vim/emacs rendering
2. **Recording/playback**: Full session recording in asciinema format
3. **Collaborative input**: Multiple users can send input
4. **Terminal sharing**: Share terminal URL for external access
5. **Graphics support**: Sixel/iTerm2 image protocol
6. **SSH integration**: Spawn terminals on remote hosts
7. **Container exec**: Spawn terminals inside containers

## References

- [node-pty documentation](https://github.com/microsoft/node-pty)
- [MCP specification](https://modelcontextprotocol.io)
- [IMPULSE_ACTIVITY_FOUNDATION.md](../docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
