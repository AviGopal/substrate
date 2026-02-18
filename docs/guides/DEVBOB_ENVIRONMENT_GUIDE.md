# DevBob Docker Environment - Complete Guide

## Overview

The DevBob environment is a **clean, containerized development setup** running OpenCode with Metabob integration. It provides isolated environments for testing activities, multi-agent coordination, and codebase management.

## Architecture

### Three Deployment Profiles

The environment uses Docker Compose profiles to support different use cases:

#### 1. **Profile: `stable`** - Backend Services Only
```yaml
services:
  - redis:6379             # Task queue and cache
  - surreal:8000           # SurrealDB database
  - surrealist:8001        # DB UI
  - metabob-rpc-api-server:8080  # Metabob backend API
  - celery-worker          # Background analysis worker
```

**Use for**: Production-like backend with stable images

**Start with**:
```bash
docker-compose --profile stable up -d
```

#### 2. **Profile: `devbob`** - Single Clean Container
```yaml
services:
  - devbob-clean:3000      # Clean OpenCode agent (empty workspace)
```

**Use for**: 
- Testing activities in isolated environment
- Empty workspace, no local code
- Pristine environment for validation

**Start with**:
```bash
docker-compose --profile stable --profile devbob up -d
```

#### 3. **Profile: `devbob-dev`** - Development Containers
```yaml
services:
  - devbob-rpc-api:3001    # Agent managing RPC API codebase
  - devbob-cli:3002        # Agent managing CLI codebase  
  - devbob-opencode:3003   # Agent managing OpenCode codebase
  - devbob-dashboard:3004  # Agent managing Dashboard codebase
```

**Use for**:
- Agents managing and adapting their codebases
- Each agent works on its mounted repo
- Multi-agent coordination

**Start with**:
```bash
docker-compose --profile stable --profile devbob-dev up -d
```

## Current Status

```bash
$ docker ps --filter "name=devbob"
NAMES          STATUS                PORTS
devbob-clean   Up 2 days (healthy)   0.0.0.0:3000->3000/tcp (ACP)
                                     0.0.0.0:8082->8082/tcp (MCP)
```

**Running**: `devbob-clean` container is healthy and operational

## Is It Clean?

**YES** - The `devbob-clean` container is a pristine environment:

### Clean Environment Characteristics

1. **Empty Workspace**: No code cloned by default
   ```dockerfile
   # Volume is empty at startup
   - devbob_clean_workspace:/workspace
   ```

2. **No Repo Mounting**: No local directories mounted
   ```yaml
   REPO_URL: ""               # No git clone
   REPO_CHECKOUT_MODE: skip   # Skip checkout
   ```

3. **Fresh State**: Each container start is clean
   ```bash
   # State is in the volume, can be reset with:
   docker-compose --profile devbob down -v  # Remove volumes
   docker-compose --profile devbob up -d    # Fresh start
   ```

4. **Isolated Config**: Container has its own configuration
   ```bash
   /workspace/.opencode/opencode.json  # Container-specific
   /workspace/.metabob/config.json     # Container-specific
   ```

### What's Pre-installed (Base Image)

The container **does** include:
- OpenCode (from `/opt/repos/metabob-opencode`)
- metabob-cli (from `/opt/repos/metabob-cli`)
- Node.js, Bun, Python 3
- Git, curl, basic tools

But the **workspace** (`/workspace`) is clean.

## How to Interact via ACP

### ACP (Agent Client Protocol) Overview

DevBob containers run OpenCode in **ACP mode**, which exposes a JSON-RPC server that allows:
- Delegating tasks to the container
- Creating and managing sessions
- Streaming responses
- Sharing context (impulses)

### Connection Methods

#### Method 1: Using `acp_delegate` Tool (From Host OpenCode)

This is the **primary method** for interacting with DevBob containers:

```typescript
// From your host OpenCode session
acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Test activity execution",
  prompt: `Execute a simple activity to test the clean environment.
  
  Use the add-feature-complete template to add a basic feature.`,
  timeout: 300  // 5 min idle timeout (resets on activity)
})
```

**How it works**:
1. Tool discovers the `devbob-clean` container
2. Spawns `opencode acp-client` subprocess to connect
3. Sends prompt to container via ACP protocol
4. Streams back responses in real-time
5. Returns final result with session ID

**Key Features**:
- **Activity-based timeout**: Only times out if agent is idle (not making progress)
- **Impulse sharing**: Can share context from parent session
- **Session tracking**: Returns session ID for follow-up
- **Real-time streaming**: See progress as it happens

#### Method 2: Direct Connection (Advanced)

For direct protocol access:

```bash
# Connect to container's ACP server
opencode acp-client --target docker://devbob-clean

# Or via network (if port exposed)
opencode acp-client --target http://localhost:3000
```

#### Method 3: HTTP API (Experimental)

The container exposes HTTP endpoints (when configured):

```bash
# Check configuration
curl http://localhost:3000/config

# Health check
curl http://localhost:3000/health

# Session management
curl -X POST http://localhost:3000/session/new \
  -H "Content-Type: application/json" \
  -d '{"cwd": "/workspace"}'
```

## Exposing Session Details to This Agent

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Host Agent (This Session)                                     │
│ - Has access to host filesystem                               │
│ - Can use acp_delegate tool                                  │
│ - Running in: /home/avi/documents/work/exp-repo/metabob-devbob│
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ acp_delegate (JSON-RPC)
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ devbob-clean Container                                        │
│ - Isolated workspace: /workspace                             │
│ - ACP server on port 3000                                    │
│ - Session state in: /workspace/.opencode/                    │
│ - Activity state in: .activity/                              │
└─────────────────────────────────────────────────────────────┘
```

### Methods to Access Container Session Details

#### Method 1: Query via ACP (Recommended)

Use the `acp_delegate` tool to ask the container about its state:

```typescript
acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Get session details",
  prompt: `Report the current session state:
  - Session ID
  - Active activities
  - Recent tool calls
  - Memory impulses loaded
  
  Use inspect_llm_request tool to show current context.`,
  timeout: 60
})
```

#### Method 2: Docker Exec (Direct Access)

Access the container directly to read state files:

```bash
# Check OpenCode state
docker exec devbob-clean cat /workspace/.opencode/opencode.json

# List activity sessions
docker exec devbob-clean ls -la /workspace/.activity/

# Read specific activity state
docker exec devbob-clean cat /workspace/.activity/[activity-id]/state.json

# Check session memory
docker exec devbob-clean cat /workspace/.opencode/sessions/[session-id]/impulses.json
```

#### Method 3: Volume Inspection

The container uses a Docker volume that can be inspected:

```bash
# Find volume location
docker volume inspect devbob_clean_workspace

# Access volume data (requires root or docker group)
sudo ls -la /var/lib/docker/volumes/devbob_clean_workspace/_data/
```

#### Method 4: Shared State via ACP Protocol Extensions

**Future enhancement**: Implement ACP protocol extensions to expose:
- Real-time session state
- Activity progress tracking
- Memory impulse inventory
- Tool execution history

### Example: Full Session Introspection

```typescript
// Delegate a task that reports back full state
const result = await acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Full session introspection",
  prompt: `Provide a comprehensive report of the current OpenCode session:

1. **Session Metadata**:
   - Session ID
   - Created at
   - Model configuration
   - Mode (activity/general)

2. **Memory State**:
   - Number of loaded impulses
   - Token budget used/remaining
   - Top 5 impulses by priority

3. **Activity State** (if in activity):
   - Template ID
   - Current task (N of M)
   - Variables
   - Progress percentage

4. **Recent Tool Calls** (last 10):
   - Tool name
   - Parameters (summary)
   - Success/failure

5. **File System State**:
   - Files in /workspace
   - Git status (if repo)
   - .opencode/ contents

6. **Configuration**:
   - MCP servers enabled
   - Metabob integration status
   - Session memory settings

Use the following tools:
- inspect_llm_request (to show current context)
- list (to show filesystem)
- bash (to check git status)
- read (to read config files)

Format as markdown with clear sections.`,
  timeout: 120
})

console.log(result.response)  // Full introspection report
```

## Container Configuration

### Environment Variables

The `devbob-clean` container is configured via environment variables in `docker-compose.yaml`:

```yaml
environment:
  CODEBASE_NAME: clean-test
  HOSTNAME: devbob-clean
  
  # No git clone - empty workspace
  REPO_URL: ""
  REPO_CHECKOUT_MODE: skip
  
  # OpenCode ACP Configuration
  ACP_PORT: "3000"
  ACP_HOSTNAME: "0.0.0.0"
  
  # Metabob backend connection
  METABOB_API_URL: http://api-server-dev:8080
  METABOB_PROJECT_ID: devbob-test
  METABOB_API_KEY: ${METABOB_API_KEY}
  
  # LLM Provider
  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
  
  LOG_LEVEL: INFO
  WAIT_FOR_BACKEND: "true"
```

### OpenCode Configuration (Inside Container)

Located at `/workspace/.opencode/opencode.json`:

```json
{
  "share": "disabled",
  "model": "anthropic/claude-sonnet-4-5",
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["/opt/metabob-cli/.venv/bin/python", "-m", "metabob_cli.mcp.server"],
      "enabled": true,
      "environment": {
        "METABOB_CONFIG": "/workspace/.metabob/config.json"
      }
    }
  },
  "metabob": {
    "api_key": "${METABOB_API_KEY}",
    "base_url": "http://api-server-dev:8080",
    "state_directory": ".metabob",
    "max_issues": 5,
    "min_severity": "MEDIUM",
    "cache_timeout": 300,
    "context_budget_tokens": 10000,
    "subagent_token_budget": 5000
  },
  "sessionMemory": {
    "enabled": true,
    "budgets": {
      "perImpulse": 2000,
      "total": 10000
    },
    "maxImpulsesPerTurn": 5
  }
}
```

### Metabob CLI Configuration (Inside Container)

Located at `/workspace/.metabob/config.json`:

```json
{
  "base_url": "http://api-server-dev:8080",
  "api_key": "",
  "project_id": "devbob-test"
}
```

## Network Architecture

### Docker Networks

```
┌──────────────────────────────────────────────────────────────┐
│ metabob-network (external)                                    │
│ - Backend services (redis, surreal, api-server)              │
│ - Shared by all containers                                   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ devbob-network (external)                                     │
│ - Agent containers (devbob-clean, devbob-*)                  │
│ - Inter-agent communication                                  │
└──────────────────────────────────────────────────────────────┘
```

Both networks are **external** and must be created before starting:

```bash
docker network create metabob-network
docker network create devbob-network
```

### Port Mapping

| Service | Internal Port | External Port | Protocol |
|---------|---------------|---------------|----------|
| devbob-clean | 3000 | 3000 | ACP (JSON-RPC) |
| devbob-clean | 8082 | 8082 | MCP (stdio over HTTP) |
| api-server-dev | 8080 | 8080 | HTTP (Metabob API) |
| redis | 6379 | 6379 | Redis |
| surreal | 8000 | 8000 | WebSocket |
| surrealist | 8080 | 8001 | HTTP (UI) |

## Activity-Based Timeout

The `acp_delegate` tool implements an **activity-based timeout** rather than a hard timeout:

### How It Works

```typescript
// OLD (Hard Timeout): 
// Task times out after 300s regardless of progress
timeout: 300s → kill after 300s

// NEW (Activity-Based):
// Task times out only if IDLE for 300s
timeout: 300s → kill only if no activity for 300s
```

### What Counts as "Activity"

The timeout resets whenever the container agent:
- Sends a message chunk (streaming response)
- Makes a tool call
- Requests permission
- Sends any `sessionUpdate` event

### Example Timeline

```
0:00 - Start task (timeout = 300s)
0:05 - Agent makes tool call → timer resets
1:30 - Agent sends message → timer resets
3:00 - Agent makes another tool call → timer resets
10:00 - Agent completes → SUCCESS (took 10 min, but never idle for 5 min)

vs.

0:00 - Start task (timeout = 300s)
0:05 - Agent starts processing
0:30 - Agent gets stuck (no more activity)
5:30 - TIMEOUT (idle for 300s)
```

### Benefits

- ✅ Long-running activities work (as long as they show progress)
- ✅ Stuck agents are detected (idle timeout)
- ✅ Better error messages (shows both idle time and total time)
- ✅ More flexible than hard timeout

## Usage Examples

### Example 1: Execute Activity in Clean Environment

```typescript
// Test activity execution in pristine environment
acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Test add-feature-complete activity",
  prompt: `Execute the add-feature-complete activity:

Variables:
- feature_name: "user authentication"
- feature_description: "Add basic JWT authentication"
- files_to_modify: ["src/auth.ts", "src/middleware.ts"]

Report back:
- Activity success/failure
- Files created/modified
- Tests added
- Commits made`,
  timeout: 600  // 10 min idle timeout for complex activity
})
```

### Example 2: Share Context via Impulses

```typescript
// Create impulse with design document
impulse_create({
  id: "auth-design",
  pointer: { 
    type: "memo", 
    content: `Authentication Design:
- JWT tokens with 1h expiration
- Refresh tokens with 7d expiration
- Redis for token storage
- bcrypt for password hashing`
  },
  budget: 2000
})

// Share with container
acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Implement auth per design",
  prompt: "Implement the authentication system according to the shared design document.",
  shareImpulses: ["auth-design"],  // Share context
  timeout: 600
})
```

### Example 3: Multi-Step Workflow

```typescript
// Step 1: Implement feature
const step1 = await acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Implement payment feature",
  prompt: "Add Stripe payment integration",
  timeout: 600
})

// Step 2: Test in same session
const step2 = await acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Test payment feature",
  prompt: `Test the payment feature you just implemented.
  
  Session ID: ${step1.sessionId}  // Continue in same session
  
  Run all tests and report results.`,
  timeout: 300
})
```

### Example 4: Debugging Container State

```typescript
// Get full diagnostic report
acp_delegate({
  target: "docker://devbob-clean",
  taskDescription: "Container diagnostic",
  prompt: `Provide a full diagnostic report:

1. Check OpenCode version: grep version package.json
2. Check Metabob CLI status: metabob-cli --version
3. List workspace contents: ls -la /workspace
4. Show OpenCode config: cat .opencode/opencode.json
5. Check Metabob connectivity: metabob-cli projects list
6. Show recent activity sessions: ls -la .activity/
7. Memory state: du -sh .opencode/sessions/

Format as markdown with clear sections.`,
  timeout: 120
})
```

## Troubleshooting

### Container Not Responding

```bash
# Check container status
docker ps -a --filter "name=devbob-clean"

# Check logs
docker logs devbob-clean --tail 100

# Restart container
docker-compose --profile devbob restart devbob-clean

# Full restart (clears state)
docker-compose --profile devbob down
docker-compose --profile devbob up -d
```

### ACP Connection Failed

```bash
# Verify ACP port is accessible
curl http://localhost:3000/config

# Check if OpenCode is running in container
docker exec devbob-clean ps aux | grep opencode

# Check OpenCode logs in container
docker exec devbob-clean cat /workspace/.opencode/opencode.log
```

### Backend Connection Issues

```bash
# Check backend is running
docker ps --filter "name=api-server-dev"
curl http://localhost:8080/health

# Check container can reach backend
docker exec devbob-clean curl http://api-server-dev:8080/health

# Verify network connectivity
docker network inspect metabob-network | jq '.[].Containers'
```

### Clean Environment Not Clean

```bash
# Remove all state and restart
docker-compose --profile devbob down -v  # -v removes volumes
docker-compose --profile devbob up -d

# Verify clean state
docker exec devbob-clean ls -la /workspace
# Should only show: .metabob/ .opencode/
```

## Best Practices

### 1. Use Clean Environment for Validation

The `devbob-clean` container is ideal for:
- ✅ Testing activity templates
- ✅ Validating tool implementations
- ✅ Reproducing bugs in isolation
- ✅ Performance benchmarking

### 2. Leverage Activity-Based Timeout

Set timeouts based on **expected idle time**, not total time:

```typescript
// Short tasks (1 min idle tolerance)
timeout: 60

// Normal tasks (5 min idle tolerance - default)
timeout: 300

// Complex activities (10 min idle tolerance)
timeout: 600
```

### 3. Share Context Efficiently

Use impulses to share context without inflating prompts:

```typescript
// ❌ BAD: Huge prompt
acp_delegate({
  prompt: `Here's the entire API design doc (10k tokens)...`
})

// ✅ GOOD: Shared impulse
impulse_create({ id: "api-design", pointer: {...}, budget: 5000 })
acp_delegate({
  prompt: "Implement API per shared design",
  shareImpulses: ["api-design"]
})
```

### 4. Monitor Container Health

The container has health checks:

```bash
# Health check command in container
curl -sf http://localhost:3000/config

# Monitor from host
watch -n 5 'docker ps --filter "name=devbob-clean" --format "{{.Status}}"'
```

### 5. Preserve Sessions for Follow-up

Save session IDs for multi-turn interactions:

```typescript
const result = await acp_delegate({...})
const sessionId = result.sessionId

// Later, reference the same session
acp_delegate({
  prompt: `Continue from session ${sessionId}...`
})
```

## Summary

| Aspect | Status |
|--------|--------|
| **Environment** | ✅ Clean (empty workspace) |
| **Container** | ✅ Running and healthy |
| **ACP Server** | ✅ Port 3000 accessible |
| **MCP Integration** | ✅ Metabob CLI configured |
| **Backend Connection** | ✅ Connected to api-server-dev |
| **Isolation** | ✅ Container-specific config |
| **Timeout** | ✅ Activity-based (permissive) |
| **Session Access** | ✅ Via acp_delegate or docker exec |

## Next Steps

To interact with the container from this agent:

1. **Simple test**:
   ```typescript
   acp_delegate({
     target: "docker://devbob-clean",
     taskDescription: "Hello world test",
     prompt: "List files in /workspace and report what you find."
   })
   ```

2. **Session introspection**:
   ```typescript
   acp_delegate({
     target: "docker://devbob-clean",
     taskDescription: "Report session state",
     prompt: "Use inspect_llm_request to show current context and configuration."
   })
   ```

3. **Activity execution**:
   ```typescript
   acp_delegate({
     target: "docker://devbob-clean",
     taskDescription: "Execute test activity",
     prompt: "Run a simple activity template and report results."
   })
   ```

The environment is ready for use! 🚀
