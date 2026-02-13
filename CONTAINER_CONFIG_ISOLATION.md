# Container Configuration Isolation Strategy

**Date**: February 13, 2026  
**Purpose**: Ensure each devbob container has isolated config while sharing stable backend

---

## Problem Statement

### Requirements
1. **Isolation**: Each container needs its own OpenCode config
2. **Shared Backend**: All containers use the same backend API
3. **No Host Interference**: Container configs don't affect host machine
4. **MCP Configured**: Each container must have MCP server properly configured

### Previous Issues
- OpenCode auto-generated configs without MCP section
- Configs mixed with host machine settings
- MCP tools not available to agents
- Templates couldn't persist to backend

---

## Solution: Container-First Configuration

### Principle
**Always create container-specific configuration on startup** - don't rely on auto-generated configs.

### Configuration Hierarchy

```
Container Filesystem:
/workspace/
  .metabob/
    config.json     ← Container-specific (ALWAYS recreated)
    state           ← Container-specific (ALWAYS recreated)
    logs/           ← Container-specific
  .opencode/
    opencode.json   ← Container-specific (ALWAYS recreated)
    
Host Filesystem:
/home/user/project/
  .metabob/
    config.json     ← Host-specific (NEVER touched by container)
    state           ← Host-specific
  .opencode/
    opencode.json   ← Host-specific (NEVER touched by container)
```

---

## Implementation

### 1. Metabob-CLI Configuration

**File**: `/workspace/.metabob/config.json`

**Always Created** on container start:
```json
{
  "base_url": "http://api-server-dev:8080",
  "api_key": "${METABOB_API_KEY}",
  "project_id": "devbob-${CODEBASE_NAME}"
}
```

**Key Points**:
- ✅ Container-isolated (in /workspace)
- ✅ Shared backend URL (api-server-dev:8080)
- ✅ Unique project_id per container
- ✅ Recreated on every container start

### 2. Metabob-CLI State

**File**: `/workspace/.metabob/state`

**Always Created** with empty structure:
```json
{
  "session_metadata": {
    "session_id": "",
    "session_token": "",
    "created_at": "",
    "expires_at": "",
    "last_refreshed": ""
  }
}
```

**Why**:
- Each container gets its own session
- No shared state between containers
- Clean slate on restart

### 3. OpenCode Configuration

**File**: `/workspace/.opencode/opencode.json`

**Always Created** with MCP configured:
```json
{
  "share": "disabled",
  "model": "anthropic/claude-sonnet-4-5",
  "mcp": {
    "metabob": {
      "command": "/opt/metabob-cli/.venv/bin/python",
      "args": ["-m", "metabob_cli.mcp.server"],
      "env": {
        "METABOB_CONFIG": "/workspace/.metabob/config.json"
      }
    }
  },
  "metabob": {
    "base_url": "http://api-server-dev:8080",
    "api_key": "${METABOB_API_KEY}",
    ...
  }
}
```

**Critical Features**:
- ✅ `mcp.metabob` section (connects to MCP server)
- ✅ `share: "disabled"` (no cross-container sharing)
- ✅ Container-local metabob config reference
- ✅ Shared backend URL

---

## Container Profiles

### devbob-clean
**Purpose**: Isolated testing environment

**Configuration**:
- Empty workspace (no code)
- Container-isolated configs
- Shared backend: `api-server-dev:8080`
- Project ID: `devbob-test`

**Isolation Benefits**:
- Tests don't affect host
- Clean environment every start
- No filesystem dependencies

### devbob-dev Containers

Each development container (rpc-api, cli, opencode, dashboard):

**Configuration**:
- Mounted codebase (repos/*)
- Container-isolated configs
- Shared backend: `api-server-dev:8080`
- Unique project IDs: `rpc-api-dev`, `cli-dev`, etc.

**Isolation Benefits**:
- Each agent has separate session
- No config conflicts
- Coordinated via shared backend
- Independent git operations

---

## Backend Sharing Strategy

### Single Shared Backend

All containers connect to: `http://api-server-dev:8080`

**Shared Resources**:
- ✅ Activity templates (all containers see same templates)
- ✅ SurrealDB data (shared database)
- ✅ Redis cache (shared cache)
- ✅ Execution records (coordinated tracking)

**Isolated Resources**:
- ❌ OpenCode configs (per-container)
- ❌ Session tokens (per-container)
- ❌ Workspace files (per-container)
- ❌ Git state (per-container)

### Why This Works

**Backend is stateless for configs**:
- Backend stores templates, executions, data
- Backend doesn't care about container configs
- Each container authenticates independently
- Shared data enables coordination

**Example Flow**:
1. devbob-clean creates template → persists to shared backend
2. devbob-rpc-api sees template → can use it
3. Both use same API server
4. No config conflicts

---

## Entrypoint Script Changes

### Before
```bash
if [ ! -f "/workspace/.opencode/opencode.json" ]; then
    # Create config
fi
```

**Problem**: OpenCode auto-generates config first, condition never met.

### After
```bash
# ALWAYS create config (no condition)
cat > /workspace/.opencode/opencode.json <<EOF
{...}
EOF
```

**Solution**: Overwrite any auto-generated config with correct one.

---

## Testing Validation

### Test 1: Container Isolation
```bash
# Start devbob-clean
docker run devbob-clean

# Check config is container-specific
docker exec devbob-clean cat /workspace/.opencode/opencode.json
# Should have MCP configured

# Check host config unchanged
cat .opencode/opencode.json
# Should be different (or not exist)
```

### Test 2: Backend Sharing
```bash
# From devbob-clean: Create template
curl -X POST http://api-server-dev:8080/v2/activities/templates \
  -d '{...}'

# From host: Verify template exists
curl http://localhost:8080/v2/activities/templates | grep "template-name"
# Should find it
```

### Test 3: MCP Tools Available
```bash
# In container, check tools
docker exec devbob-clean sh -c "
  curl http://localhost:8001/tools | jq '.tools | length'
"
# Should return > 0 (tools available)
```

---

## Migration Guide

### From Old Setup

**Old** (host configs mixed with container):
- Container might use host's .opencode/
- Configs auto-generated without MCP
- State files shared/conflicting

**New** (strict isolation):
- Container ALWAYS creates own configs
- MCP always configured
- Each container has unique state

### Migration Steps

1. **Stop all containers**
```bash
docker stop devbob-clean
```

2. **Clear container workspaces** (optional - for clean start)
```bash
docker volume rm devbob_clean_workspace
```

3. **Update entrypoint script** (already done)

4. **Rebuild devbob image**
```bash
docker build -t devbob:latest -f docker/Dockerfile.devbob .
```

5. **Start with new config**
```bash
docker run devbob-clean
# Config created automatically with MCP
```

6. **Verify**
```bash
docker exec devbob-clean cat /workspace/.opencode/opencode.json | grep mcp
# Should see mcp section
```

---

## Benefits

### For Development
- ✅ Clean testing environments
- ✅ No config conflicts
- ✅ Easy debugging (container logs)
- ✅ Reproducible builds

### For Multi-Agent
- ✅ Each agent has own session
- ✅ Coordinated via shared backend
- ✅ No state corruption
- ✅ Independent operation

### For Production
- ✅ Container-first design
- ✅ Scalable (add more containers)
- ✅ Isolated failures
- ✅ Shared data layer

---

## Troubleshooting

### Issue: MCP tools not available

**Check**:
```bash
docker exec devbob-clean cat /workspace/.opencode/opencode.json | grep mcp
```

**Expected**: `"mcp": { "metabob": {...} }`

**Fix**: Restart container to recreate config

### Issue: Container uses host config

**Check**:
```bash
# In container
docker exec devbob-clean pwd
# Should be /workspace (not /host/path)
```

**Fix**: Ensure workspace is container volume, not host mount

### Issue: Configs not recreated

**Check** entrypoint logs:
```bash
docker logs devbob-clean | grep "Created container-isolated"
```

**Expected**: See config creation messages

**Fix**: Verify entrypoint script is executable and correct

---

## Summary

**Configuration Strategy**:
- Container-first (always create on start)
- Isolated configs (per-container)
- Shared backend (single API server)
- MCP enabled (tools available)

**Key Files**:
- docker/devbob-entrypoint.sh (creates configs)
- docker/Dockerfile.devbob (base image)
- docker-compose.yaml (orchestration)

**Result**:
- ✅ Clean isolation
- ✅ Shared data
- ✅ No conflicts
- ✅ MCP working

---

**Status**: Configuration isolation strategy implemented and documented!
