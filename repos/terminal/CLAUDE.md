# Terminal Vessel - Claude Code Guide

This file provides guidance to Claude Code when working with the terminal vessel.

## Overview

The terminal vessel provides **stateful terminal sessions as impulses** that activities can consume. It runs as both an HTTP server (for discovery) and MCP server (for tool calls).

**Key Principle:** Resolvers live where data lives. The terminal vessel resolves `terminalState`, `terminalCommand`, and `terminalOutput` impulses from in-memory PTY state.

## Architecture Alignment

### Composition Learning

The terminal vessel participates in composition learning by:

1. **Deterministic State Capture**: PTY buffer, cursor position, exit codes are captured without LLM involvement
2. **Universal Data Access**: Terminal state is exposed as standard impulses, consumable by any activity
3. **Resolver Universality**: Terminal vessel advertises shapes it can resolve via discovery-vessel integration
4. **State-Space Driven**: Activities select terminal impulses based on state requirements, not probabilistic scoring

### No Thompson Sampling

This vessel does NOT use Thompson Sampling or probabilistic activity selection. Instead:
- Activities request terminal state deterministically
- Vessel resolves from local PTY state
- Backend records compositions (which activities used which terminal impulses)
- Learning happens through composition patterns, not success/failure scoring

## Standard Configuration

**See:** `/home/avi/documents/work/exp-repo/metabob-devbob/docs/STANDARD_CONFIGURATION.md`

### Required Environment Variables

```bash
# Discovery Integration
export DISCOVERY_ENABLED=true
export DISCOVERY_VESSEL_ENDPOINT=http://discovery-vessel:8080
export VESSEL_ENDPOINT=http://terminal-vessel:8080
export VESSEL_SHAPES=terminalState,terminalCommand,terminalOutput

# Vessel Identity
export VESSEL_ID=terminal-vessel-${HOSTNAME}
export VESSEL_NAME="Terminal Vessel"
export VESSEL_VERSION="1.0.0"

# Server Configuration
export PORT=8080
export NODE_ENV=production
export LOG_LEVEL=info
```

### Production Endpoints

- **Activity API:** `https://activity.metabob.com` (NOT `.local`)
- **Discovery Vessel:** `http://discovery-vessel.activity-system.svc.cluster.local:8080`
- **Terminal Vessel:** `http://terminal-vessel.activity-system.svc.cluster.local:8080`

## Impulse Shapes Resolved

### terminalState (Sticky)

Full terminal session state including buffer, history, checkpoints.

**Pointer:**
```typescript
{
  type: "terminalState",
  terminalId: "term-abc123"
}
```

**Content:**
```typescript
{
  state: {
    terminalId: string,
    pid: number,
    shell: string,
    cwd: string,
    buffer: string,              // ANSI terminal buffer
    cursor: { row: number, col: number },
    running: boolean,
    exitCode: number | null,
    shellHistory: string[],
    totalCommands: number
  },
  history: TerminalCommand[],
  position: number,
  checkpoints: Checkpoint[],
  connections: Connection[]
}
```

### terminalCommand

Individual command execution.

**Pointer:**
```typescript
{
  type: "terminalCommand",
  terminalId: "term-abc123",
  commandId: 5
}
```

### terminalOutput

Terminal output buffer (specific line range).

**Pointer:**
```typescript
{
  type: "terminalOutput",
  terminalId: "term-abc123",
  fromLine: 0,
  toLine: 100
}
```

## MCP Tools

The terminal vessel exposes these tools via MCP (stdio mode):

1. `terminal_spawn` - Spawn terminal with preset configuration
2. `terminal_send_input` - Send input to terminal
3. `terminal_connect` - Multi-viewer connection
4. `terminal_disconnect` - Disconnect viewer
5. `terminal_checkpoint` - Create checkpoint for rollback
6. `terminal_replay` - Rollback to checkpoint and replay
7. `terminal_list` - List active terminals

## HTTP Endpoints

Discovery and impulse resolution via HTTP:

- `GET /health` - Health check with discovery status
- `GET /v2/vessels/capabilities` - Shape advertisement
- `POST /v2/impulses/resolve` - Resolve impulse pointer to content

## Activity Integration Patterns

### Pattern 1: Use Existing Terminal

Activity loads terminal state as input impulse:

```json
{
  "id": "debug-from-terminal",
  "input_impulses": [
    {
      "id": "dev_terminal",
      "pointer": {
        "type": "terminalState",
        "terminalId": "{{terminalId}}"
      },
      "budget": 10000,
      "priority": "critical"
    }
  ],
  "tasks": [
    {
      "id": "analyze-error",
      "prompt": {
        "template": "Terminal Buffer:\n{{impulses.dev_terminal.content.state.buffer}}\n\nWhat went wrong?"
      }
    }
  ]
}
```

### Pattern 2: Spawn Terminal from Activity

Activity spawns terminal and uses it:

```json
{
  "id": "test-with-terminal",
  "tasks": [
    {
      "id": "spawn-terminal",
      "tools": ["mcp"],
      "prompt": {
        "template": "Call MCP tool: terminal_spawn with preset: 'shell'"
      },
      "output_impulses": [
        {
          "id": "test_terminal",
          "shape": "terminalState"
        }
      ]
    },
    {
      "id": "run-tests",
      "tools": ["mcp"],
      "prompt": {
        "template": "Call MCP tool: terminal_send_input with terminalId: {{test_terminal.terminalId}}, input: 'bun test\\n'"
      }
    },
    {
      "id": "analyze-results",
      "input_impulses": ["test_terminal"],
      "prompt": {
        "template": "Test output:\n{{test_terminal.content.state.buffer}}"
      }
    }
  ]
}
```

### Pattern 3: Checkpoint and Rollback

Activity creates checkpoint before risky operation:

```json
{
  "tasks": [
    {
      "id": "create-checkpoint",
      "tools": ["mcp"],
      "prompt": {
        "template": "Call MCP tool: terminal_checkpoint with terminalId: {{terminalId}}, label: 'before-deployment'"
      }
    },
    {
      "id": "deploy",
      "tools": ["mcp"],
      "prompt": {
        "template": "Call MCP tool: terminal_send_input with terminalId: {{terminalId}}, input: './deploy.sh\\n'"
      }
    },
    {
      "id": "check-success",
      "validation": {
        "requiredPatterns": ["Deployment successful"],
        "onFailure": "rollback"
      }
    },
    {
      "id": "rollback",
      "tools": ["mcp"],
      "prompt": {
        "template": "Call MCP tool: terminal_replay with terminalId: {{terminalId}}, checkpointId: {{checkpointId}}"
      }
    }
  ]
}
```

## Development Guidelines

### When Modifying Terminal Vessel

1. **Maintain Deterministic Resolution**: Terminal state capture must be predictable and measurable
2. **No LLM in Resolution**: Resolvers should not invoke LLMs to resolve impulses
3. **Follow Standard Config**: Use environment variables from STANDARD_CONFIGURATION.md
4. **Register Shapes**: Update discovery registration when adding new impulse shapes
5. **Health Checks**: Include discovery status in `/health` endpoint

### Testing

```bash
# Unit tests
cd repos/terminal
bun test

# Type checking
bun run typecheck

# Start vessel
bun run src/index.ts --port 8080

# Test health
curl http://localhost:8080/health

# Test capabilities
curl http://localhost:8080/v2/vessels/capabilities

# Test impulse resolution
curl -X POST http://localhost:8080/v2/impulses/resolve \
  -H 'Content-Type: application/json' \
  -d '{"pointer": {"type": "terminalState", "terminalId": "term-123"}}'
```

### Deployment

The terminal vessel deploys via Helm with standard configuration:

```yaml
# environments/production.values.yaml
vessels:
  terminal:
    image:
      repository: metabobapp/terminal-vessel
      tag: latest
    shapes:
      - terminalState
      - terminalCommand
      - terminalOutput
    discovery:
      enabled: true
    env:
      - name: DISCOVERY_ENABLED
        value: "true"
      - name: DISCOVERY_VESSEL_ENDPOINT
        value: "http://discovery-vessel:8080"
      - name: VESSEL_SHAPES
        value: "terminalState,terminalCommand,terminalOutput"
```

## Key Implementation Files

- `src/index.ts` - HTTP + MCP server entry point
- `src/terminal/frame-manager.ts` - PTY lifecycle management
- `src/terminal/checkpoint-manager.ts` - Rollback/replay functionality
- `src/state-space/impulse-store.ts` - In-memory impulse management
- `src/state-space/connection-pool.ts` - Multi-viewer synchronization
- `src/types.ts` - TypeScript type definitions

## References

- **Foundation:** `/home/avi/documents/work/exp-repo/metabob-devbob/docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
- **Standard Config:** `/home/avi/documents/work/exp-repo/metabob-devbob/docs/STANDARD_CONFIGURATION.md`
- **Technical Spec:** `SPEC.md`
- **User Guide:** `README.md`
- **Discovery:** `VESSEL_DISCOVERY.md`

## Common Operations

### Add New Impulse Shape

1. Define shape in `src/types.ts`
2. Implement resolution logic
3. Update `VESSEL_SHAPES` environment variable
4. Update discovery registration in `src/index.ts`
5. Document shape in this file and SPEC.md

### Modify PTY Behavior

1. Update `src/terminal/frame-manager.ts`
2. Ensure deterministic state capture
3. Update tests
4. Document changes in SPEC.md

### Change Checkpoint Strategy

1. Update `src/terminal/checkpoint-manager.ts`
2. Consider preset-specific strategies
3. Test rollback/replay
4. Update SPEC.md preset documentation

## Troubleshooting

**Vessel not registering with discovery:**
- Check `DISCOVERY_ENABLED=true`
- Verify `DISCOVERY_VESSEL_ENDPOINT` is reachable
- Check `/health` endpoint for discovery status

**Impulse resolution fails:**
- Verify terminal exists: `terminal_list` tool
- Check terminal is running: state.running === true
- Ensure terminalId matches

**MCP tools not available:**
- Verify MCP server started in stdio mode
- Check MCP client configuration
- Test with `terminal_list` first
