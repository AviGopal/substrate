# Docker Compose Profile Implementation Plan

**Goal**: Create a flexible docker-compose setup with profiles for different use cases while maintaining configuration separation between host and container environments.

---

## 🎯 Design Goals

1. **Profile-Based Deployment**: Start only what you need
2. **Configuration Separation**: Clear distinction between host and container configs
3. **Backward Compatibility**: Existing devbob script continues to work
4. **Resource Efficiency**: Reduce memory footprint by running only needed services
5. **Development Friendly**: Easy to spin up test environments

---

## 📐 Architecture

### File Structure
```
configs/
├── docker-compose.yaml              # New: Profile-based main file
├── docker-compose.backend.yaml      # Backend services (redis, surreal, rpc-api)
├── docker-compose.agents.yaml       # DevBob agent containers
├── docker-compose.override.yaml     # Local dev overrides (optional)
├── .env.devbob                      # Existing: Environment variables
├── .env.devbob.local                # Existing: Local overrides
├── opencode.devbob.json             # For containers (host.docker.internal:8080)
├── opencode.host.json               # For host machine (localhost:8080)
└── devbob-entrypoint.sh             # Container entrypoint
```

### Profile Definitions

#### Core Profiles
1. **backend** - Essential services
   - redis
   - surreal
   - surrealist
   - db-init
   - metabob-rpc-api-server
   - metabob-rpc-api-worker

2. **devbob-rpc-api** - RPC API agent
3. **devbob-dashboard** - Dashboard agent
4. **devbob-cli** - CLI agent
5. **devbob-opencode** - OpenCode agent
6. **devbob-orchestrator** - DevBob orchestration agent

#### Convenience Profiles
7. **all-agents** - All 5 devbob containers
8. **testing** - backend + devbob-opencode (minimal test setup)
9. **development** - backend + all-agents (full dev environment)

---

## 🔧 Implementation Steps

### Step 1: Create Main docker-compose.yaml with Profiles

**Location**: `configs/docker-compose.yaml`

```yaml
# Main docker-compose with profile support
version: '3.8'

services:
  # Backend services with 'backend' profile
  redis:
    profiles: ["backend", "testing", "development"]
    # ... (same as current)
  
  surreal:
    profiles: ["backend", "testing", "development"]
    # ... (same as current)
  
  metabob-rpc-api-server:
    profiles: ["backend", "testing", "development"]
    # ... (same as current)
  
  # DevBob agents with individual profiles
  devbob-opencode:
    profiles: ["devbob-opencode", "all-agents", "testing", "development"]
    environment:
      # Use container-specific config
      OPENCODE_CONFIG: /workspace/configs/opencode.devbob.json
    # ... (same as current)
  
  devbob-rpc-api:
    profiles: ["devbob-rpc-api", "all-agents", "development"]
    environment:
      OPENCODE_CONFIG: /workspace/configs/opencode.devbob.json
    # ...
```

**Key Changes**:
- Add `profiles: [...]` to each service
- Default profile (no --profile flag) = backend only
- Convenience profiles include multiple services

### Step 2: Separate Backend Services (Optional)

**Location**: `configs/docker-compose.backend.yaml`

Extract backend services into separate file for clarity:
```yaml
version: '3.8'

services:
  redis:
    # ... redis config
  
  surreal:
    # ... surreal config
  
  metabob-rpc-api-server:
    # ... server config
```

**Usage**: 
```bash
docker compose -f docker-compose.backend.yaml -f docker-compose.agents.yaml up
```

### Step 3: Update Configuration Selection

**Location**: `configs/devbob-entrypoint.sh`

Add logic to select correct OpenCode config:

```bash
# Determine which config to use
if [ "$RUNNING_IN_CONTAINER" = "true" ]; then
  # Container environment - use devbob config (host.docker.internal)
  export OPENCODE_CONFIG="${OPENCODE_CONFIG:-/workspace/configs/opencode.devbob.json}"
  echo "📦 Container mode: Using $OPENCODE_CONFIG"
else
  # Host environment - use host config (localhost)
  export OPENCODE_CONFIG="${OPENCODE_CONFIG:-/workspace/configs/opencode.host.json}"
  echo "🖥️  Host mode: Using $OPENCODE_CONFIG"
fi

# Pass config to opencode
exec opencode acp --config "$OPENCODE_CONFIG" "$@"
```

### Step 4: Create Environment Variable Template

**Location**: `configs/.env.devbob.example`

```bash
# =============================================================================
# DevBob Environment Configuration
# =============================================================================
# Copy to .env.devbob.local and customize for your environment

# -----------------------------------------------------------------------------
# LLM Provider API Keys (REQUIRED)
# -----------------------------------------------------------------------------
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx

# -----------------------------------------------------------------------------
# Metabob Backend Configuration
# -----------------------------------------------------------------------------
METABOB_API_KEY=mb_xxx
METABOB_PROJECT_ID=devbob-multi-agent

# Backend service ports (default values shown)
API_PORT=8080
REDIS_PORT=6379
SURREAL_PORT=8000
SURREALIST_PORT=8001

# Backend resources
API_WORKERS=4
CELERY_CONCURRENCY=4

# -----------------------------------------------------------------------------
# SurrealDB Configuration
# -----------------------------------------------------------------------------
SURREAL_USER=root
SURREAL_PASS=root
SURREAL_NAMESPACE=metabob
SURREAL_DATABASE=devbob
SURREAL_LOG_LEVEL=info

# -----------------------------------------------------------------------------
# Git Repository URLs (optional - can mount locally)
# -----------------------------------------------------------------------------
DEVBOB_RPC_API_REPO=git@github.com:metabobproject/metabob-rpc-api.git
DEVBOB_CLI_REPO=git@github.com:metabobproject/metabob-cli.git
DEVBOB_OPENCODE_REPO=git@github.com:metabobproject/metabob-opencode.git
DEVBOB_WEB_REPO=git@github.com:metabobproject/web.git

# Git branches
DEVBOB_RPC_API_BRANCH=main
DEVBOB_CLI_BRANCH=main
DEVBOB_OPENCODE_BRANCH=feat/activity-execution-fixes
DEVBOB_WEB_BRANCH=main

# Git checkout behavior
DEVBOB_CHECKOUT_MODE=shallow  # shallow | full | skip
DEVBOB_REPO_DEPTH=1
DEVBOB_AUTO_PUSH=false
DEVBOB_PUSH_ON_EXIT=true

# -----------------------------------------------------------------------------
# SSH Configuration
# -----------------------------------------------------------------------------
# Mount your SSH keys for git operations
SSH_KEY_DIR=~/.ssh

# -----------------------------------------------------------------------------
# Logging and Debugging
# -----------------------------------------------------------------------------
LOG_LEVEL=INFO  # DEBUG | INFO | WARNING | ERROR

# -----------------------------------------------------------------------------
# Resource Limits
# -----------------------------------------------------------------------------
# Analysis limits for metabob backend
MAX_DOWNSTREAM_EFFECTS=50
MAX_SIMILAR_CHUNKS=20
MAX_TRANSITIVE_DEPTH=2

# -----------------------------------------------------------------------------
# Metabob CLI Dashboard
# -----------------------------------------------------------------------------
METABOB_ENABLE_DASHBOARD=true

# -----------------------------------------------------------------------------
# Startup Behavior
# -----------------------------------------------------------------------------
WAIT_FOR_BACKEND=true  # Wait for backend health before starting agents
```

### Step 5: Update devbob Script

**Location**: `devbob` (root)

Add profile support:

```bash
#!/bin/bash
# DevBob orchestration script with profile support

set -e

COMPOSE_FILE="configs/docker-compose.yaml"
ENV_FILE="configs/.env.devbob"
LOCAL_ENV_FILE="configs/.env.devbob.local"

# Load environment
if [ -f "$LOCAL_ENV_FILE" ]; then
  export $(cat "$LOCAL_ENV_FILE" | grep -v '^#' | xargs)
fi

# Profile shortcuts
PROFILES_BACKEND="--profile backend"
PROFILES_TESTING="--profile backend --profile devbob-opencode"
PROFILES_DEV="--profile development"
PROFILES_ALL="--profile backend --profile all-agents"

case "${1}" in
  start)
    shift
    if [ "$1" = "backend" ]; then
      docker compose -f "$COMPOSE_FILE" $PROFILES_BACKEND up -d
    elif [ "$1" = "testing" ]; then
      docker compose -f "$COMPOSE_FILE" $PROFILES_TESTING up -d
    elif [ "$1" = "development" ] || [ "$1" = "dev" ]; then
      docker compose -f "$COMPOSE_FILE" $PROFILES_DEV up -d
    elif [ "$1" = "all" ]; then
      docker compose -f "$COMPOSE_FILE" $PROFILES_ALL up -d
    elif [ -z "$1" ]; then
      # Default: backend + orchestrator
      docker compose -f "$COMPOSE_FILE" --profile backend --profile devbob-orchestrator up -d
    else
      # Start specific services/profiles
      docker compose -f "$COMPOSE_FILE" up -d "$@"
    fi
    ;;
  
  stop)
    docker compose -f "$COMPOSE_FILE" down
    ;;
  
  restart)
    shift
    ./devbob stop
    ./devbob start "$@"
    ;;
  
  logs)
    shift
    docker compose -f "$COMPOSE_FILE" logs -f "$@"
    ;;
  
  status)
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  
  profile)
    # Run with custom profile
    shift
    PROFILE="$1"
    shift
    docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" up -d "$@"
    ;;
  
  *)
    echo "DevBob Orchestration Script"
    echo ""
    echo "Usage:"
    echo "  ./devbob start [option]       - Start services"
    echo "  ./devbob stop                 - Stop all services"
    echo "  ./devbob restart [option]     - Restart services"
    echo "  ./devbob logs [service]       - View logs"
    echo "  ./devbob status               - Show service status"
    echo "  ./devbob profile <name> ...   - Use custom profile"
    echo ""
    echo "Start options:"
    echo "  (no option)                   - Backend + orchestrator (default)"
    echo "  backend                       - Backend services only"
    echo "  testing                       - Backend + devbob-opencode"
    echo "  development | dev             - Full development environment"
    echo "  all                           - Backend + all agents"
    echo "  <service> [service...]        - Specific services"
    echo ""
    echo "Profile examples:"
    echo "  ./devbob profile backend"
    echo "  ./devbob profile devbob-opencode"
    echo "  ./devbob profile all-agents"
    echo ""
    echo "Direct docker compose:"
    echo "  docker compose -f configs/docker-compose.yaml --profile backend up -d"
    ;;
esac
```

---

## 📝 Configuration Files Detailed Design

### configs/opencode.devbob.json (Containers)
```json
{
  "$schema": "https://opencode.ai/config.json",
  "share": "disabled",
  "model": "anthropic/claude-sonnet-4-5",
  
  "metabob": {
    "enabled": true,
    "cli_path": "metabob-cli",
    "base_url": "http://host.docker.internal:8080",
    "api_key": "${METABOB_API_KEY}",
    "project_id": "devbob-multi-agent",
    "max_issues": 5,
    "min_severity": "MEDIUM"
  },
  
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
        "METABOB_API_URL": "http://host.docker.internal:8080",
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
  }
}
```

### configs/opencode.host.json (Host Machine)
```json
{
  "$schema": "https://opencode.ai/config.json",
  "share": "disabled",
  "model": "anthropic/claude-sonnet-4-5",
  
  "metabob": {
    "enabled": true,
    "cli_path": "metabob-cli",
    "base_url": "http://localhost:8080",
    "api_key": "${METABOB_API_KEY}",
    "project_id": "exp-repo-dev",
    "max_issues": 5,
    "min_severity": "MEDIUM"
  },
  
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
        "METABOB_API_URL": "http://localhost:8080",
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
  }
}
```

**Key Differences**:
- `base_url`: `host.docker.internal:8080` vs `localhost:8080`
- `project_id`: `devbob-multi-agent` vs `exp-repo-dev`
- Environment variables passed to MCP match base_url

---

## 🧪 Testing Strategy

### Test 1: Backend Only
```bash
./devbob start backend

# Verify services
curl http://localhost:8080/health
curl http://localhost:8000/health  # SurrealDB
redis-cli ping

# Expected: 6 containers running
docker compose -f configs/docker-compose.yaml ps
```

### Test 2: Testing Profile (Backend + OpenCode Agent)
```bash
./devbob start testing

# Verify backend + agent
curl http://localhost:8080/health
curl http://localhost:3004/config  # devbob-opencode ACP

# Expected: 7 containers running
```

### Test 3: Development Profile (Everything)
```bash
./devbob start development

# Verify all services
for port in 8080 3001 3002 3003 3004 3005; do
  curl -sf http://localhost:$port/config || curl -sf http://localhost:$port/health
done

# Expected: 11 containers running
```

### Test 4: Host Configuration
```bash
# On host machine (outside containers)
export OPENCODE_CONFIG=configs/opencode.host.json
opencode acp --config "$OPENCODE_CONFIG"

# Should connect to localhost:8080
# Verify in logs: "Metabob API: http://localhost:8080"
```

### Test 5: Container Configuration
```bash
# Inside devbob-opencode container
docker exec -it devbob-opencode bash
echo $OPENCODE_CONFIG
# Expected: /workspace/configs/opencode.devbob.json

cat $OPENCODE_CONFIG | grep base_url
# Expected: "http://host.docker.internal:8080"
```

---

## 📦 Migration Path

### Phase 1: Create New Files (Non-Breaking)
1. Create `configs/docker-compose.yaml` with profiles
2. Create `configs/.env.devbob.example`
3. Keep existing `configs/docker-compose.devbob.yaml` as backup

### Phase 2: Test Profiles
1. Test each profile independently
2. Verify configuration selection works
3. Test host vs container config separation

### Phase 3: Update Scripts
1. Update `devbob` script with profile support
2. Update documentation
3. Add migration guide

### Phase 4: Deprecate Old Files
1. Move `docker-compose.devbob.yaml` to `.archive/`
2. Update all references
3. Remove deprecated files after confirmation

---

## ✅ Success Criteria

- [ ] Profile-based deployment works (backend, testing, development)
- [ ] Configuration automatically selects host vs container settings
- [ ] Backward compatibility maintained (existing commands work)
- [ ] Memory footprint reduced for minimal setups
- [ ] Documentation updated with examples
- [ ] All tests pass for each profile

---

## 🚀 Quick Start After Implementation

```bash
# Backend only (minimal)
./devbob start backend

# Integration testing
./devbob start testing

# Full development
./devbob start development

# Custom (backend + specific agent)
docker compose -f configs/docker-compose.yaml \
  --profile backend \
  --profile devbob-rpc-api \
  up -d
```

---

**Next Step**: Begin implementation of Step 1 (Create main docker-compose.yaml)
