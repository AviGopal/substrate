# Debuggable Distributed Development System Architecture

**Date**: 2026-02-10  
**Purpose**: Design a simple, debuggable multi-agent system with shared backend for development system research

---

## 🎯 Core Requirements

### Primary Goals
1. **Shared Backend**: All devbob containers + host machine → single metabob-rpc-api instance
2. **Debuggability**: Direct container inspection (logs, sessions, agent state)
3. **Simplicity**: Minimal configuration, unlikely to introduce errors
4. **Research Focus**: Bridge Metabob component tracking ↔ OpenCode impulse/activity systems

### Research Use Case
- **Domain**: Distributed development system (code as first application)
- **Learning Goal**: Programmatic code interfacing with reliable, consistent outcomes
- **Key Integration**: Component tracking (Metabob) + Impulse system (OpenCode) + Activity templates

---

## 🏗️ Simplified Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Host Machine (Linux)                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │           Shared Backend (Always Running)              │    │
│  │                                                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │    │
│  │  │  Redis   │  │ SurrealDB│  │ Metabob RPC API  │    │    │
│  │  │  :6379   │  │  :8000   │  │     :8080        │    │    │
│  │  └──────────┘  └──────────┘  └──────────────────┘    │    │
│  │                                                         │    │
│  │  All agents and host connect to: localhost:8080       │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         DevBob Agent Containers (On-Demand)            │    │
│  │                                                         │    │
│  │  Each container:                                       │    │
│  │  • Mounts own repo workspace                           │    │
│  │  • Shares configs/opencode.devbob.json                 │    │
│  │  • Connects to host backend (host.docker.internal)     │    │
│  │  • Exposes ACP port for direct interaction             │    │
│  │  • Logs accessible via docker logs                     │    │
│  │  • Sessions stored in shared SurrealDB                 │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Host Development CLI                       │    │
│  │                                                         │    │
│  │  • Uses configs/opencode.host.json                     │    │
│  │  • Connects to localhost:8080                          │    │
│  │  • Same backend, different config                      │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Design Decisions

### 1. Single Backend, Multiple Clients
**Why**: Simplifies debugging - one database, one API, shared learning data

**How**: 
- Backend runs on host network (no Docker bridge complexity)
- All containers connect via `host.docker.internal:8080`
- Host connects via `localhost:8080`

### 2. One Container Per Repo
**Why**: Isolation for debugging, clear ownership

**Containers**:
- `devbob-rpc-api` → repos/metabob-rpc-api
- `devbob-cli` → repos/metabob-cli
- `devbob-opencode` → repos/metabob-opencode
- `devbob-dashboard` → repos/metabob-dashboard
- `devbob-orchestrator` → coordination across repos (metabob-devbob)

### 3. Direct Container Access (No Nested Docker)
**Why**: Easier log inspection, session debugging

**Access Methods**:
```bash
# Logs (real-time streaming)
docker logs -f devbob-opencode

# Shell access (inspect state)
docker exec -it devbob-opencode bash

# Direct ACP queries (agent state)
curl http://localhost:3004/session/current

# Session data (from shared DB)
curl http://localhost:8080/sessions?agent=devbob-opencode
```

### 4. Shared Configuration with Environment Override
**Why**: DRY principle, single source of truth

**Structure**:
```
configs/
├── opencode.base.json          # Shared settings (model, mcp, etc)
├── opencode.devbob.json        # Container-specific (extends base)
└── opencode.host.json          # Host-specific (extends base)
```

---

## 📁 Simplified File Structure

```
metabob-devbob/
├── docker-compose.yaml         # Single file, profile-based
├── devbob                      # CLI wrapper script
│
├── configs/
│   ├── .env.devbob             # Environment variables
│   ├── opencode.base.json      # Shared config
│   ├── opencode.devbob.json    # Container config (host.docker.internal)
│   └── opencode.host.json      # Host config (localhost)
│
├── repos/                      # Mounted to containers
│   ├── metabob-cli/
│   ├── metabob-opencode/
│   ├── metabob-rpc-api/
│   └── metabob-dashboard/
│
└── .metabob/                   # Shared Metabob state
    ├── metadata                # Component tracking data
    └── sessions/               # Agent session records
```

---

## 🔧 Docker Compose Implementation

### Profile Strategy (Simplified)

```yaml
# docker-compose.yaml
version: '3.8'

services:
  # ============================================================
  # Backend Services (Profile: backend)
  # ============================================================
  redis:
    image: redis:7-alpine
    profiles: ["backend"]
    network_mode: host  # <-- KEY: Use host network
    volumes:
      - redis_data:/data
    restart: unless-stopped

  surreal:
    image: surrealdb/surrealdb:latest
    profiles: ["backend"]
    network_mode: host  # <-- KEY: Use host network
    command: start --bind 0.0.0.0:8000 file:/data/surreal.db
    environment:
      - SURREAL_USER=${SURREAL_USER:-root}
      - SURREAL_PASS=${SURREAL_PASS:-root}
    volumes:
      - surreal_data:/data
    restart: unless-stopped

  metabob-rpc-api:
    build:
      context: ./repos/metabob-rpc-api
      dockerfile: Dockerfile
    profiles: ["backend"]
    network_mode: host  # <-- KEY: Use host network
    environment:
      - REDIS_URL=redis://localhost:6379
      - SURREAL_URL=http://localhost:8000
      - API_PORT=8080
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./repos/metabob-rpc-api:/app
      - api_logs:/app/logs
    depends_on:
      - redis
      - surreal
    restart: unless-stopped

  # ============================================================
  # DevBob Agent Containers (Individual Profiles)
  # ============================================================
  devbob-opencode:
    image: devbob:latest
    profiles: ["devbob-opencode", "all-agents"]
    network_mode: host  # <-- KEY: Use host network for simplicity
    environment:
      - AGENT_NAME=devbob-opencode
      - ACP_PORT=3004
      - OPENCODE_CONFIG=/workspace/configs/opencode.devbob.json
      - METABOB_API_URL=http://host.docker.internal:8080
      - METABOB_API_KEY=${METABOB_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      # Mount entire devbob workspace
      - ./:/workspace
      # Repo-specific workspace
      - ./repos/metabob-opencode:/workspace/repos/metabob-opencode
      # Shared Metabob state
      - ./.metabob:/workspace/.metabob
    working_dir: /workspace/repos/metabob-opencode
    command: ["/workspace/configs/devbob-entrypoint.sh"]
    stdin_open: true
    tty: true
    restart: unless-stopped

  devbob-rpc-api:
    image: devbob:latest
    profiles: ["devbob-rpc-api", "all-agents"]
    network_mode: host
    environment:
      - AGENT_NAME=devbob-rpc-api
      - ACP_PORT=3001
      - OPENCODE_CONFIG=/workspace/configs/opencode.devbob.json
      - METABOB_API_URL=http://host.docker.internal:8080
      - METABOB_API_KEY=${METABOB_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./:/workspace
      - ./repos/metabob-rpc-api:/workspace/repos/metabob-rpc-api
      - ./.metabob:/workspace/.metabob
    working_dir: /workspace/repos/metabob-rpc-api
    command: ["/workspace/configs/devbob-entrypoint.sh"]
    stdin_open: true
    tty: true
    restart: unless-stopped

  devbob-cli:
    image: devbob:latest
    profiles: ["devbob-cli", "all-agents"]
    network_mode: host
    environment:
      - AGENT_NAME=devbob-cli
      - ACP_PORT=3003
      - OPENCODE_CONFIG=/workspace/configs/opencode.devbob.json
      - METABOB_API_URL=http://host.docker.internal:8080
      - METABOB_API_KEY=${METABOB_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./:/workspace
      - ./repos/metabob-cli:/workspace/repos/metabob-cli
      - ./.metabob:/workspace/.metabob
    working_dir: /workspace/repos/metabob-cli
    command: ["/workspace/configs/devbob-entrypoint.sh"]
    stdin_open: true
    tty: true
    restart: unless-stopped

  devbob-dashboard:
    image: devbob:latest
    profiles: ["devbob-dashboard", "all-agents"]
    network_mode: host
    environment:
      - AGENT_NAME=devbob-dashboard
      - ACP_PORT=3002
      - OPENCODE_CONFIG=/workspace/configs/opencode.devbob.json
      - METABOB_API_URL=http://host.docker.internal:8080
      - METABOB_API_KEY=${METABOB_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./:/workspace
      - ./repos/metabob-dashboard:/workspace/repos/metabob-dashboard
      - ./.metabob:/workspace/.metabob
    working_dir: /workspace/repos/metabob-dashboard
    command: ["/workspace/configs/devbob-entrypoint.sh"]
    stdin_open: true
    tty: true
    restart: unless-stopped

  devbob-orchestrator:
    image: devbob:latest
    profiles: ["devbob-orchestrator"]
    network_mode: host
    environment:
      - AGENT_NAME=devbob-orchestrator
      - ACP_PORT=3005
      - OPENCODE_CONFIG=/workspace/configs/opencode.devbob.json
      - METABOB_API_URL=http://host.docker.internal:8080
      - METABOB_API_KEY=${METABOB_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./:/workspace
      - ./.metabob:/workspace/.metabob
    working_dir: /workspace
    command: ["/workspace/configs/devbob-entrypoint.sh"]
    stdin_open: true
    tty: true
    restart: unless-stopped

volumes:
  redis_data:
  surreal_data:
  api_logs:
```

### Key Architectural Decisions

**1. `network_mode: host` for All Services**
- **Why**: Eliminates network complexity, direct localhost access
- **Trade-off**: Less isolation, but we need debuggability > isolation
- **Result**: All services on `localhost`, containers use `host.docker.internal`

**2. Mount Entire `./` to `/workspace`**
- **Why**: Containers can access all configs, scripts, and repos
- **Benefit**: Debugging is easier (inspect any file from inside container)
- **Result**: Single source of truth for all configurations

**3. Shared `.metabob/` Directory**
- **Why**: Component tracking data shared across all agents
- **Benefit**: Metabob learns from all agent interactions
- **Result**: Distributed learning system with shared knowledge base

---

## 📝 Configuration Files (Simplified)

### configs/opencode.base.json (Shared Settings)
```json
{
  "$schema": "https://opencode.ai/config.json",
  "share": "disabled",
  "model": "anthropic/claude-sonnet-4-5",
  
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "${ANTHROPIC_API_KEY}"
      }
    }
  },
  
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_KEY": "${METABOB_API_KEY}"
      },
      "enabled": true
    }
  },
  
  "sessionMemory": {
    "enabled": true,
    "budgets": {
      "perImpulse": 2000,
      "total": 10000
    }
  },
  
  "metabob": {
    "enabled": true,
    "cli_path": "metabob-cli",
    "project_id": "devbob-distributed",
    "max_issues": 5,
    "min_severity": "MEDIUM"
  }
}
```

### configs/opencode.devbob.json (Container Override)
```json
{
  "extends": "./opencode.base.json",
  
  "metabob": {
    "base_url": "http://host.docker.internal:8080",
    "api_key": "${METABOB_API_KEY}"
  },
  
  "mcp": {
    "metabob": {
      "environment": {
        "METABOB_API_URL": "http://host.docker.internal:8080",
        "METABOB_API_KEY": "${METABOB_API_KEY}"
      }
    }
  }
}
```

### configs/opencode.host.json (Host Override)
```json
{
  "extends": "./opencode.base.json",
  
  "metabob": {
    "base_url": "http://localhost:8080",
    "api_key": "${METABOB_API_KEY}"
  },
  
  "mcp": {
    "metabob": {
      "environment": {
        "METABOB_API_URL": "http://localhost:8080",
        "METABOB_API_KEY": "${METABOB_API_KEY}"
      }
    }
  }
}
```

---

## 🔍 Debugging Workflows

### 1. Inspect Agent Logs
```bash
# Real-time logs from devbob-opencode
docker logs -f devbob-opencode

# Last 100 lines
docker logs --tail 100 devbob-opencode

# Logs with timestamps
docker logs -f --timestamps devbob-opencode

# Save logs to file for analysis
docker logs devbob-opencode > opencode-agent-debug.log 2>&1
```

### 2. Inspect Agent Sessions
```bash
# Shell into container
docker exec -it devbob-opencode bash

# Inside container, check OpenCode state
cd /workspace/repos/metabob-opencode
cat .opencode/session.json

# Check impulse state
ls -la .opencode/impulses/

# Check activity execution logs
cat .opencode/activities/last_execution.json
```

### 3. Query Shared Backend State
```bash
# All sessions from all agents
curl http://localhost:8080/sessions | jq

# Sessions for specific agent
curl http://localhost:8080/sessions?agent=devbob-opencode | jq

# Component tracking data (Metabob)
curl http://localhost:8080/components?project=devbob-distributed | jq

# Activity execution history
curl http://localhost:8080/activities/executions | jq
```

### 4. Inspect Metabob Component Tracking
```bash
# Component metadata (shared across all agents)
cat .metabob/metadata

# Component flags (set by any agent)
cat .metabob/component-flags.json | jq

# Session-specific component context
cat .metabob/sessions/devbob-opencode-latest.json | jq
```

### 5. Bridge Debugging (Metabob ↔ OpenCode)
```bash
# Compare component tracking to impulse system

# 1. What components did Metabob track?
curl http://localhost:8080/components?session=abc123 | jq '.components[].name'

# 2. What impulses did OpenCode create?
docker exec devbob-opencode cat /workspace/repos/metabob-opencode/.opencode/impulses.json | jq '.impulses[].id'

# 3. Are they aligned?
# (Manual inspection or script to compare)

# 4. Check activity execution with component context
docker exec devbob-opencode cat /workspace/repos/metabob-opencode/.opencode/activities/last_execution.json | jq '.contextUsed'
```

### 6. Interactive Debugging Session
```bash
# Start backend
./devbob start backend

# Start one agent in foreground (interactive)
docker run --rm -it \
  --network host \
  -v $(pwd):/workspace \
  -e AGENT_NAME=devbob-opencode \
  -e OPENCODE_CONFIG=/workspace/configs/opencode.devbob.json \
  -e METABOB_API_URL=http://host.docker.internal:8080 \
  devbob:latest \
  /bin/bash

# Inside container, run commands manually
opencode acp --config $OPENCODE_CONFIG
```

---

## 🚀 Usage Examples

### Starting Services

```bash
# Backend only (for development)
./devbob start backend

# Backend + specific agent
./devbob start backend
docker compose --profile devbob-opencode up -d

# Backend + multiple agents
./devbob start backend
docker compose --profile devbob-opencode --profile devbob-cli up -d

# Everything
./devbob start backend
docker compose --profile all-agents up -d
```

### Research Workflow Example

**Scenario**: Test activity execution with component tracking

```bash
# 1. Start shared backend
./devbob start backend

# 2. Start devbob-opencode agent
docker compose --profile devbob-opencode up -d

# 3. Watch logs in real-time
docker logs -f devbob-opencode &

# 4. Send task via ACP
curl -X POST http://localhost:3004/task \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Fix authentication bug",
    "context": ["bug-report.md"]
  }'

# 5. Monitor execution
# Terminal 1: Agent logs (already watching)
# Terminal 2: Backend API logs
docker logs -f metabob-rpc-api

# Terminal 3: Query session state
watch -n 1 'curl -s http://localhost:8080/sessions?agent=devbob-opencode | jq ".[-1]"'

# 6. After completion, analyze results
# Check what components were tracked
curl http://localhost:8080/components?session=$SESSION_ID | jq

# Check what impulses were created
docker exec devbob-opencode cat /workspace/repos/metabob-opencode/.opencode/impulses.json | jq

# Check activity execution trace
docker exec devbob-opencode cat /workspace/repos/metabob-opencode/.opencode/activities/executions/$ACTIVITY_ID.json | jq
```

---

## 🎯 Benefits of This Architecture

### 1. Simplified Networking
- **No bridge networks**: Everything on `localhost` (host) or `host.docker.internal` (containers)
- **No port mapping confusion**: Direct access to all services
- **Easier debugging**: Standard networking tools work (curl, telnet, etc.)

### 2. Shared Learning State
- **Single SurrealDB**: All sessions, activities, metrics in one place
- **Shared `.metabob/`**: Component tracking unified across agents
- **Cross-agent learning**: Insights from one agent benefit all

### 3. Maximum Debuggability
- **Direct log access**: `docker logs -f <container>`
- **Shell access**: `docker exec -it <container> bash`
- **Session inspection**: All data in one database
- **Real-time monitoring**: Standard tools (curl, jq, watch)

### 4. Research-Friendly
- **Iterate quickly**: Change one agent without affecting others
- **Compare approaches**: Run multiple agents with different configs
- **Analyze patterns**: All data centralized for analysis
- **Bridge systems**: Easy to inspect Metabob ↔ OpenCode integration

### 5. Unlikely to Break
- **Minimal abstraction**: Direct, simple configuration
- **No complex dependencies**: Each agent independent
- **Shared backend is stateless**: Restart backend without losing agent state (in DB)
- **Explicit configuration**: No magic, everything visible

---

## 📊 Port Allocation (Simplified)

### Backend (Always Running)
- `6379` - Redis
- `8000` - SurrealDB
- `8080` - Metabob RPC API

### DevBob Agents (On-Demand)
- `3001` - devbob-rpc-api (ACP)
- `3002` - devbob-dashboard (ACP)
- `3003` - devbob-cli (ACP)
- `3004` - devbob-opencode (ACP)
- `3005` - devbob-orchestrator (ACP)

**That's it!** Only 8 ports total (vs 25+ in original design).

---

## ✅ Implementation Checklist

### Phase 1: Backend Setup (30 min)
- [ ] Create `docker-compose.yaml` with backend profile
- [ ] Use `network_mode: host` for all backend services
- [ ] Test: `./devbob start backend` → services on localhost
- [ ] Verify: `curl http://localhost:8080/health`

### Phase 2: Configuration (15 min)
- [ ] Create `configs/opencode.base.json` (shared)
- [ ] Create `configs/opencode.devbob.json` (container override)
- [ ] Verify `configs/opencode.host.json` (host override)
- [ ] Test: Config loading in container vs host

### Phase 3: DevBob Containers (45 min)
- [ ] Add agent services to `docker-compose.yaml`
- [ ] Use `network_mode: host` for all agents
- [ ] Mount entire `./` to `/workspace`
- [ ] Share `.metabob/` directory
- [ ] Test: `docker compose --profile devbob-opencode up -d`

### Phase 4: Debugging Workflow (30 min)
- [ ] Test: `docker logs -f devbob-opencode`
- [ ] Test: `docker exec -it devbob-opencode bash`
- [ ] Test: Query sessions via API
- [ ] Test: Inspect `.metabob/` shared state
- [ ] Document debugging commands

### Phase 5: Research Workflow (1 hour)
- [ ] Run end-to-end activity execution
- [ ] Capture logs from all layers
- [ ] Verify component tracking ↔ impulse bridge
- [ ] Analyze session data
- [ ] Document findings

---

## 🎓 Key Insights for Research

### Metabob Component Tracking ↔ OpenCode Impulse System Bridge

**Research Question**: How do we programmatically route data between component tracking (what code exists) and impulses (what context to load)?

**Current State**:
- Metabob tracks components (functions, classes, files)
- OpenCode tracks impulses (loaded context for LLM)
- Bridge is manual (human decides what to load)

**Goal**:
- Automatic bridging: Component changes → Relevant impulses loaded
- Learning system: Track which impulses lead to successful outcomes
- Feedback loop: Activity success → Strengthen component-impulse connections

**Debug Points**:
1. **Component Detection**: What did Metabob detect? (`.metabob/metadata`)
2. **Impulse Creation**: What context was loaded? (`.opencode/impulses.json`)
3. **Activity Execution**: What was used? (activity trace logs)
4. **Outcome**: Did it succeed? (stored in SurrealDB)
5. **Learning**: Update weights (Thompson sampling in RPC API)

**Data Flow to Inspect**:
```
Metabob Detects Component Change
  ↓
  .metabob/metadata updated
  ↓
OpenCode Activity Triggered
  ↓
  Impulse system loads context (based on ???)
  ↓
  .opencode/impulses.json created
  ↓
Activity Executes
  ↓
  Logs: activity_trace.json
  ↓
Outcome Recorded
  ↓
  SurrealDB: activity_executions table
  ↓
Learning Update
  ↓
  SurrealDB: component_impulse_weights table (NEW?)
```

**Next Research Steps**:
1. Instrument the bridge (logging at every step)
2. Collect execution data (50-100 activity runs)
3. Analyze patterns (which impulses → success)
4. Build model (component → impulse recommendations)
5. Test model (does it improve outcomes?)

---

**Status**: Ready to implement simplified, debuggable architecture  
**Next Action**: Implement Phase 1 (Backend Setup)
