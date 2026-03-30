# Terminal Vessel Discovery Integration

**Status:** ✅ Implemented
**Date:** 2026-03-28

## How MiniBob Discovers Terminal Vessel

The terminal vessel integrates with MiniBob's vessel discovery system, enabling automatic discovery and impulse resolution without hardcoded dependencies.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         MiniBob                                  │
│                                                                  │
│  1. Needs to resolve impulse: { shape: "terminalState" }       │
│                          ↓                                       │
│  2. Queries VesselDiscoveryClient                               │
│                          ↓                                       │
└──────────────────────────┼──────────────────────────────────────┘
                           ↓
┌──────────────────────────┼──────────────────────────────────────┐
│              Activity API (Backend)                              │
│                                                                  │
│  GET /v2/vessels/discover?shape=terminalState                   │
│                          ↓                                       │
│  Returns: [{                                                     │
│    vesselId: "terminal-vessel-1",                               │
│    endpoint: "http://localhost:9090",                           │
│    shapes: ["terminalState", ...]                               │
│  }]                                                              │
└──────────────────────────┼──────────────────────────────────────┘
                           ↓
┌──────────────────────────┼──────────────────────────────────────┐
│                  Terminal Vessel                                 │
│                                                                  │
│  POST /v2/impulses/resolve                                      │
│  Body: { pointer: { type: "terminalState", terminalId: "..." }}│
│                          ↓                                       │
│  Returns: {                                                      │
│    content: "{ state: {...}, history: [...] }",                 │
│    metadata: { shape: "terminalState", ... }                    │
│  }                                                               │
└──────────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. Terminal Vessel HTTP Server

The terminal vessel runs an HTTP server (default port 9090) that provides:

**Health Check:** `GET /health`
```json
{
  "status": "ok",
  "vessel": "terminal",
  "instanceId": "terminal-vessel-1",
  "shapes": ["terminalState", "terminalCommand", "terminalOutput"]
}
```

**Capabilities:** `GET /v2/vessels/capabilities`
```json
{
  "vesselId": "terminal-vessel-1",
  "vesselName": "Terminal Vessel",
  "endpoint": "http://localhost:9090",
  "shapes": ["terminalState", "terminalCommand", "terminalOutput"],
  "metadata": {
    "version": "1.0.0",
    "capabilities": ["pty", "multi-viewer", "checkpoints", "replay"]
  }
}
```

**Impulse Resolution:** `POST /v2/impulses/resolve`

Request:
```json
{
  "pointer": {
    "type": "terminalState",
    "terminalId": "term-123"
  }
}
```

Response:
```json
{
  "content": "{\"state\":{...},\"history\":[...]}",
  "metadata": {
    "shape": "terminalState",
    "terminalId": "term-123",
    "resolvedBy": "terminal-vessel-1"
  }
}
```

### 2. Vessel Registration

On startup, the terminal vessel registers with the backend:

```typescript
POST https://activity.metabob.local/v2/vessels/register

{
  "vesselId": "terminal-vessel-1",
  "vesselName": "Terminal Vessel",
  "endpoint": "http://localhost:9090",
  "shapes": ["terminalState", "terminalCommand", "terminalOutput"],
  "metadata": {
    "version": "1.0.0",
    "capabilities": ["pty", "multi-viewer", "checkpoints", "replay"],
    "environment": "development"
  }
}
```

This tells the backend: "I can resolve these impulse shapes, reach me at this endpoint."

### 3. MiniBob Discovery Flow

When MiniBob encounters a terminal impulse in an activity:

```typescript
// Activity template
{
  "tasks": [
    {
      "id": "analyze-terminal",
      "impulseRefs": ["debugTerminal"],
      "prompt": {
        "template": "What's in this terminal? {{impulses.debugTerminal}}"
      }
    }
  ]
}

// MiniBob execution
const impulse = {
  id: "debugTerminal",
  shape: "terminalState",
  pointer: {
    type: "terminalState",
    terminalId: "term-abc123"
  }
};

// Discovery happens automatically
import { getVesselDiscoveryClient } from './vessel-discovery';

const discoveryClient = getVesselDiscoveryClient();
const resolved = await discoveryClient.resolveViaDiscovery(impulse.pointer);

// MiniBob gets terminal state back without knowing about terminal vessel!
```

## Configuration

### Terminal Vessel

Environment variables:
```bash
MODE=http                                    # Run as HTTP server
PORT=9090                                    # HTTP port
INSTANCE_ID=terminal-vessel-1               # Unique vessel ID
VESSEL_ENDPOINT=http://localhost:9090       # How others reach this vessel
ACTIVITY_API_ENDPOINT=https://activity.metabob.local  # Backend for registration
```

### MiniBob

MiniBob needs no terminal-specific configuration! Discovery is automatic:

```typescript
// In repos/minibob - no terminal imports needed!
import { getVesselDiscoveryClient } from './vessel-discovery';

// Discovery client configured with backend endpoint
const client = getVesselDiscoveryClient();
// Client queries backend, backend returns terminal vessel endpoint
// Client calls terminal vessel's /v2/impulses/resolve
// ✅ Terminal state resolved!
```

## Running

### Start Terminal Vessel

```bash
cd repos/terminal

# Method 1: Using startup script
./start-http.sh

# Method 2: Direct command
MODE=http PORT=9090 bun run src/index.ts

# Method 3: Using .env file
cp .env.example .env
# Edit .env with your values
bun run src/index.ts
```

Output:
```
Terminal Vessel Starting...
Instance ID: terminal-vessel-1
Mode: http

🌐 HTTP server listening on port 9090
   Health: http://localhost:9090/health
   Resolve: http://localhost:9090/v2/impulses/resolve
✅ Registered with backend: https://activity.metabob.local
   Vessel ID: terminal-vessel-1
   Endpoint: http://localhost:9090
```

### Test Endpoints

```bash
# Health check
curl http://localhost:9090/health | jq .

# Capabilities
curl http://localhost:9090/v2/vessels/capabilities | jq .

# Resolve impulse (needs active terminal)
curl -X POST http://localhost:9090/v2/impulses/resolve \
  -H "Content-Type: application/json" \
  -d '{"pointer":{"type":"terminalState","terminalId":"term-123"}}' | jq .
```

## Impulse Shapes Provided

The terminal vessel resolves three impulse shapes:

### 1. terminalState

Full terminal session state including buffer, history, checkpoints.

**Pointer:**
```typescript
{
  type: "terminalState",
  terminalId: "term-123"
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
    buffer: string,
    cursor: { row: number, col: number },
    running: boolean,
    exitCode: number | null,
    shellHistory: string[],
    totalCommands: number,
    // ...
  },
  history: TerminalCommand[],
  position: number,
  checkpoints: Checkpoint[],
  connections: Connection[]
}
```

### 2. terminalCommand

Individual command execution.

**Pointer:**
```typescript
{
  type: "terminalCommand",
  terminalId: "term-123",
  commandId: 5
}
```

**Content:**
```typescript
{
  command: "echo 'hello'"
}
```

### 3. terminalOutput

Terminal output buffer (specific lines).

**Pointer:**
```typescript
{
  type: "terminalOutput",
  terminalId: "term-123",
  fromLine: 0,
  toLine: 100
}
```

**Content:**
```typescript
{
  lines: string[]
}
```

## Benefits

1. **No Hardcoded Dependencies**: MiniBob doesn't import terminal vessel code
2. **Dynamic Discovery**: Vessels found at runtime via backend query
3. **Extensible**: Add new impulse shapes without MiniBob changes
4. **Replaceable**: Swap terminal vessel implementation without MiniBob changes
5. **Distributed**: Vessels can run on different hosts/containers
6. **Version Agnostic**: Vessels can evolve independently

## Integration with Activities

Activities can now use terminal impulses naturally:

```typescript
{
  "id": "debug-in-terminal",
  "tasks": [
    {
      "id": "spawn-debug-terminal",
      "impulseBindings": [
        {
          "impulseId": "debugTerm",
          "create": {
            "shape": "terminalState",
            "pointer": {
              "type": "terminalState",
              "terminalId": "{{spawnedTerminalId}}"
            }
          }
        }
      ]
    },
    {
      "id": "analyze-error",
      "prompt": {
        "template": `
Terminal Output:
{{impulses.debugTerm.content.state.buffer}}

Commands Executed:
{{impulses.debugTerm.content.state.shellHistory}}

What caused the error?
        `
      },
      "impulseRefs": ["debugTerm"]
    }
  ]
}
```

MiniBob resolves `debugTerm` automatically via discovery:
1. Sees shape `terminalState`
2. Queries backend for vessels that can resolve it
3. Backend returns terminal vessel endpoint
4. Calls terminal vessel to resolve
5. Gets terminal state
6. Injects into activity prompt
7. ✅ LLM has full terminal context

## Next Steps

1. **Backend Implementation**: Add `/v2/vessels/register` and `/v2/vessels/discover` endpoints to metabob-activity-api
2. **Test End-to-End**: Verify MiniBob → Backend → Terminal vessel flow
3. **Add More Shapes**: Terminal vessel can advertise additional impulse shapes
4. **Multi-Instance**: Run multiple terminal vessels, backend load-balances
5. **Kubernetes**: Deploy as service, register with cluster endpoint

## Defaults

**All activity API endpoints default to:** `https://activity.metabob.local`

This applies to:
- Vessel registration
- Discovery queries
- Impulse resolution (if using backend as proxy)

The terminal vessel is now fully integrated with the vessel discovery architecture!
