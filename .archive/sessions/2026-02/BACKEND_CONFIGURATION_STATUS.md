# Backend Configuration Status & Assessment

**Date**: February 11, 2026 (Updated)  
**Purpose**: Verify shared backend configuration between host and DevBob containers

---

## Executive Summary

✅ **Backend is running and accessible** (api-server-dev, v0.16.0, healthy)  
✅ **metabob-cli installed in host and containers** (v1.8.0)  
⚠️ **Critical configuration issues preventing feature sharing**  
🔴 **Missing project_id in container config**  
🔴 **Project ID mismatch between host and containers**

**Status**: Backend operational, but configs need alignment for full feature access

---

## Current Architecture

### Backend Services (Running)

All backend services are healthy and accessible on localhost:

| Service | Container | Port | Status | Health Check |
|---------|-----------|------|--------|--------------|
| **Metabob RPC API** | `api-server-dev` | 8080 | ✅ Running | Healthy |
| **Redis** | `metabob-redis` | 6379 | ✅ Running | Healthy |
| **SurrealDB** | `metabob-surreal` | 8000 | ✅ Running | Healthy |

**Backend Root**: `http://localhost:8080/`  
**API Documentation**: `http://localhost:8080/docs`  
**Health Endpoint**: `http://localhost:8080/` → `{"status":"ok","version":"0.16.0"}`

---

## Configuration Analysis

### 1. Host Machine (Current Environment)

**Location**: `~/.opencode/opencode.json`

```json
{
  "metabob": {
    "enabled": true,
    "cli_path": "metabob-cli",
    "base_url": "http://localhost:8080",
    "api_key": "",
    "project_id": "exp-repo-dev",
    "auto_inject": true,
    "headless": true,
    "max_issues": 5,
    "min_severity": "MEDIUM",
    "use_impulse_system": true
  },
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_URL": "${METABOB_API_URL:-http://localhost:8080}",
        "METABOB_API_KEY": "${METABOB_API_KEY:-}"
      },
      "enabled": true
    }
  }
}
```

**Status**: ✅ Correctly configured
- Base URL points to localhost:8080 ✓
- MCP server configured to use metabob-cli ✓
- Project ID set to `exp-repo-dev` ✓

### 2. metabob-cli Configuration (Host)

**Location**: `repos/metabob-cli/.metabob/config.json`

```json
{
  "base_url": "http://localhost:8080",
  "api_key": "",
  "state_directory": ".metabob",
  "watch_files": true,
  "batch_size": 5
}
```

**Status**: ✅ Correctly configured
- Base URL points to localhost:8080 ✓
- API key empty (may need to be set) ⚠️

### 3. DevBob Container Configuration

**Location**: `configs/opencode.devbob.json`

```json
{
  "metabob": {
    "cli_path": "metabob-cli",
    "api_key": "mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs",
    "base_url": "http://host.docker.internal:8080",
    "state_directory": ".metabob",
    "max_issues": 5,
    "min_severity": "MEDIUM"
    // ⚠️ MISSING: "project_id" field!
  },
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {},  // ⚠️ Empty - should pass METABOB_API_URL and METABOB_API_KEY
      "enabled": true
    }
  }
}
```

**Status**: ⚠️ **Needs updates**
- Base URL uses `host.docker.internal:8080` to reach host backend ✓
- API key is set ✓
- MCP server configured ✓
- ❌ **Missing `project_id` field** - containers won't know which project to use!
- ⚠️ **MCP environment empty** - may not pass backend URL to MCP server

### 4. Docker Compose Backend Configuration

**File**: `configs/docker-compose.devbob.yaml`

**Backend Services**:
- Redis: Port 6379, with persistence and LRU eviction policy
- SurrealDB: Port 8000, in-memory database
- Metabob RPC API: Port 8080, connected to redis and surreal
- Celery Worker: Connected to redis for task processing

**Network Configuration**:
- `metabob-network`: Internal network for backend services
- `devbob`: Network for agent containers
- `host.docker.internal`: Enables containers to reach host services

**Agent Configuration** (from docker-compose):
```yaml
devbob-rpc-api:
  environment:
    METABOB_API_URL: http://api-server-dev:8080
    METABOB_PROJECT_ID: devbob-multi-agent
```

---

## Issue Analysis

### ⚠️ Issue 1: metabob-cli Cannot Access Repository State

**Error**: 
```
Error: API request failed: 404 Client Error: Not Found for url: http://localhost:8000/repository/state
```

**Root Cause**: metabob-cli is trying to access `http://localhost:8000` (SurrealDB directly) instead of going through the API server at port 8080.

**Why This Happens**: The `/repository/state` endpoint should be accessed via the Metabob RPC API, not SurrealDB directly.

**Impact**: 
- ❌ Cannot retrieve project information
- ❌ Repository state tracking unavailable
- ⚠️ Some features may not work properly

**Solution Required**: Verify that all metabob-cli commands route through the API server (port 8080) rather than directly to the database (port 8000).

### ⚠️ Issue 2: API Key Inconsistency

**Observation**:
- Host machine metabob-cli: `api_key: ""` (empty)
- DevBob containers: `api_key: "mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs"`

**Potential Impact**:
- Host machine may not authenticate properly
- Feature access may be limited without API key

**Recommendation**: Determine if API key is required and ensure consistency.

### 🔴 Issue 3: Project ID Mismatch (CRITICAL)

**Observation**:
- Host OpenCode config: `project_id: "exp-repo-dev"` ✅
- Host metabob-cli: No `project_id` field ⚠️
- DevBob containers env: `METABOB_PROJECT_ID: "devbob-multi-agent"` ⚠️
- DevBob OpenCode config: **No `project_id` field at all!** ❌
- Container workspace metabob-cli: No `project_id` field ⚠️

**Actual Impact**:
- ❌ **Host and containers WILL track separate projects**
- ❌ **Activity templates registered from host won't be visible in containers**
- ❌ **Analysis results won't be shared between environments**
- ❌ **Containers have NO project_id in OpenCode config** (metabob tools may fail)

**Root Cause**: Missing `project_id` field in `configs/opencode.devbob.json` and inconsistent env var

**CRITICAL**: This must be fixed before using metabob features across host/containers

---

## Backend API Endpoints

Based on the running backend, here are the key endpoints:

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /` | Health check | ✅ Working |
| `GET /docs` | API documentation | ✅ Working |
| `GET /openapi.json` | OpenAPI spec | ✅ Available |
| `/repository/state` | Repository state | ❌ 404 (needs investigation) |

---

## Feature Access Checklist

To ensure all features requiring backend connectivity work properly:

### Core Features
- [ ] **Code Analysis**: Submit files for analysis via metabob-cli
- [ ] **Project Tracking**: Track repository state and metrics
- [ ] **Activity Templates**: Register and execute activity templates
- [ ] **MCP Server**: Access Metabob tools via OpenCode MCP integration
- [ ] **Dashboard**: View analysis results in local dashboard

### Testing Steps

#### 1. Test Backend Connectivity
```bash
# From host machine
curl http://localhost:8080/
# Expected: {"status":"ok","version":"0.16.0"}

# From inside DevBob container (when running)
curl http://host.docker.internal:8080/
# Expected: Same response
```

#### 2. Test metabob-cli Basic Functionality
```bash
cd repos/metabob-cli

# Check version
metabob-cli version

# Test project info (currently failing)
metabob-cli project-info

# Test analysis submission
metabob-cli analyze src/
```

#### 3. Test MCP Integration (from OpenCode)
```bash
# This should work automatically in OpenCode session
# Check session memory for Metabob context
```

#### 4. Test Activity Template Registration
```bash
# Check if activity templates can be registered
metabob-cli register-template path/to/template.yaml
```

---

## Recommended Actions

### 🔴 Priority 1: Add project_id to configs/opencode.devbob.json (CRITICAL)

**Problem**: Container OpenCode config has no `project_id` field

**Impact**: Metabob tools in containers won't know which project to access

**Solution**:
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Edit configs/opencode.devbob.json and add project_id to metabob section
jq '.metabob.project_id = "exp-repo-dev"' configs/opencode.devbob.json > configs/opencode.devbob.json.tmp
mv configs/opencode.devbob.json.tmp configs/opencode.devbob.json
```

### 🔴 Priority 2: Standardize Project ID Everywhere

**Recommended**: Use `exp-repo-dev` everywhere (matches existing host config)

**Update Locations**:
1. ✅ `~/.opencode/opencode.json` → `metabob.project_id` (already set to `exp-repo-dev`)
2. ❌ `configs/opencode.devbob.json` → **ADD `project_id: "exp-repo-dev"`**
3. ⚠️ `docker-compose.yaml` → Change `METABOB_PROJECT_ID` from `devbob-multi-agent` to `exp-repo-dev`

**Fix Script**:
```bash
# Update docker-compose.yaml
sed -i 's/METABOB_PROJECT_ID: devbob-multi-agent/METABOB_PROJECT_ID: exp-repo-dev/g' docker-compose.yaml

# Restart containers to pick up new env
docker-compose restart devbob-opencode devbob-rpc-api devbob-cli devbob-dashboard devbob
```

### 🟡 Priority 3: Fix MCP Environment Variables in Container Config

**Problem**: `configs/opencode.devbob.json` has empty MCP environment

**Current**:
```json
"mcp": {
  "metabob": {
    "environment": {}  // Empty!
  }
}
```

**Should Be**:
```json
"mcp": {
  "metabob": {
    "environment": {
      "METABOB_API_URL": "http://host.docker.internal:8080",
      "METABOB_API_KEY": "mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs"
    }
  }
}
```

**Fix**:
```bash
# Edit configs/opencode.devbob.json
jq '.mcp.metabob.environment = {
  "METABOB_API_URL": "http://host.docker.internal:8080",
  "METABOB_API_KEY": .metabob.api_key
}' configs/opencode.devbob.json > configs/opencode.devbob.json.tmp
mv configs/opencode.devbob.json.tmp configs/opencode.devbob.json
```

### 🟢 Priority 4: Clarify API Key Requirements

**Questions to Answer**:
1. Is API key required for local development?
2. Should host machine use same key as containers?
3. How to generate/manage API keys?

**Action**: 
- Test if features work without API key on host
- If needed, copy key from DevBob config to host config

### 🟢 Priority 5: Verify URL Pattern Consistency

**Current URL Patterns Detected:**

| Location | Configuration File | URL Pattern | Status |
|----------|-------------------|-------------|---------|
| Host OpenCode | `~/.opencode/opencode.json` | `http://localhost:8080` | ✅ |
| Host metabob-cli | `repos/metabob-cli/.metabob/config.json` | `http://localhost:8080` | ✅ |
| Container OpenCode | `configs/opencode.devbob.json` | `http://host.docker.internal:8080` | ✅ |
| Container Env | `METABOB_API_URL` | `http://api-server-dev:8080` | ⚠️ |
| Container metabob-cli | `/workspace/.metabob/config.json` | `http://api-server-dev:8080` | ⚠️ |

**Issue**: Containers use THREE different URL patterns:
1. `host.docker.internal:8080` (OpenCode config) - reaches host machine
2. `api-server-dev:8080` (env var + metabob-cli) - reaches container via Docker network

**Analysis**: 
- `api-server-dev:8080` works and is **faster** (no host bridge)
- `host.docker.internal:8080` works but adds latency
- Both work, but **inconsistency is confusing**

**Recommendation**: Keep current setup (both work). If consolidating:
- Option A: Use `api-server-dev:8080` everywhere (better performance, container-native)
- Option B: Use `host.docker.internal:8080` everywhere (more explicit about host access)

**Verdict**: ✅ Not critical - both URLs work. Focus on project_id first.

---

## Configuration Summary Table

| Component | Config File | Backend URL | API Key | Project ID | Status |
|-----------|-------------|-------------|---------|------------|--------|
| **Host OpenCode** | `~/.opencode/opencode.json` | `http://localhost:8080` | Empty | `exp-repo-dev` | ✅ Good |
| **Host metabob-cli** | `repos/metabob-cli/.metabob/config.json` | `http://localhost:8080` | Empty | N/A | ⚠️ Needs key? |
| **DevBob Containers** | `configs/opencode.devbob.json` | `http://host.docker.internal:8080` | Set | N/A | ✅ Good |
| **Docker Env** | `configs/.env.devbob` | `http://metabob-api-dev:8080` | Empty | `devbob-multi-agent` | ⚠️ ID mismatch |

---

## Next Steps

1. **Investigate API Endpoint Structure**
   ```bash
   curl http://localhost:8080/docs | grep -i repository
   docker logs api-server-dev 2>&1 | grep -i "repository\|endpoint" | tail -50
   ```

2. **Test Full Workflow**
   ```bash
   cd repos/metabob-cli
   metabob-cli analyze --help
   metabob-cli analyze src/metabob_cli/ --batch-size 5
   ```

3. **Create Symlink**
   ```bash
   cd /home/avi/documents/work/exp-repo/metabob-devbob
   ln -s configs/docker-compose.devbob.yaml docker-compose.yaml
   ```

4. **Standardize Configuration**
   - Update project IDs to match
   - Set API keys if needed
   - Document expected configuration

5. **Test DevBob Container Connectivity**
   ```bash
   ./devbob agent start devbob-opencode
   ./devbob debug shell devbob-opencode
   # Inside container:
   curl http://host.docker.internal:8080/
   metabob-cli config
   ```

---

---

## Quick Fix Script

Run this to apply all critical fixes at once:

```bash
#!/bin/bash
# Quick fix for backend configuration consistency
# Run from: /home/avi/documents/work/exp-repo/metabob-devbob

set -e
PROJECT_ID="exp-repo-dev"

echo "🔧 Fixing backend configuration..."

# 1. Add project_id to container OpenCode config
echo "✓ Adding project_id to configs/opencode.devbob.json"
jq ".metabob.project_id = \"$PROJECT_ID\"" configs/opencode.devbob.json > configs/opencode.devbob.json.tmp
mv configs/opencode.devbob.json.tmp configs/opencode.devbob.json

# 2. Add MCP environment variables
echo "✓ Adding MCP environment variables"
API_KEY=$(jq -r '.metabob.api_key' configs/opencode.devbob.json)
jq ".mcp.metabob.environment = {
  \"METABOB_API_URL\": \"http://host.docker.internal:8080\",
  \"METABOB_API_KEY\": \"$API_KEY\"
}" configs/opencode.devbob.json > configs/opencode.devbob.json.tmp
mv configs/opencode.devbob.json.tmp configs/opencode.devbob.json

# 3. Update docker-compose.yaml project_id
echo "✓ Updating docker-compose.yaml METABOB_PROJECT_ID"
sed -i "s/METABOB_PROJECT_ID: devbob-multi-agent/METABOB_PROJECT_ID: $PROJECT_ID/g" docker-compose.yaml
sed -i "s/METABOB_PROJECT_ID: \${METABOB_PROJECT_ID:-devbob-multi-agent}/METABOB_PROJECT_ID: \${METABOB_PROJECT_ID:-$PROJECT_ID}/g" docker-compose.yaml

# 4. Restart containers (if running)
echo "✓ Restarting containers..."
if docker ps | grep -q devbob-opencode; then
    docker-compose restart devbob-opencode devbob-rpc-api devbob-cli devbob-dashboard devbob 2>/dev/null || true
    echo "✓ Containers restarted"
else
    echo "ℹ️  Containers not running - changes will apply on next start"
fi

echo ""
echo "✅ Configuration fixed!"
echo ""
echo "Next steps:"
echo "  1. Run: ./TEST_SHARED_BACKEND.sh"
echo "  2. Test host: metabob-cli project-info"
echo "  3. Test container: docker exec devbob-opencode metabob-cli project-info"
echo "  4. Verify both show: project_id = $PROJECT_ID"
```

**Save as**: `fix-backend-config.sh`
**Run with**: `bash fix-backend-config.sh`

---

## Detailed Testing Plan

After applying fixes:

### Test 1: Backend Connectivity
```bash
# Host
curl http://localhost:8080/
# Expected: {"status":"ok","version":"0.16.0"}

# Container (if running)
docker exec devbob-opencode curl -s http://host.docker.internal:8080/
# Expected: same response
```

### Test 2: Project ID Consistency
```bash
# Host OpenCode config
jq '.metabob.project_id' ~/.opencode/opencode.json
# Expected: "exp-repo-dev"

# Container OpenCode config
jq '.metabob.project_id' configs/opencode.devbob.json
# Expected: "exp-repo-dev"

# Container environment
docker exec devbob-opencode env | grep METABOB_PROJECT_ID
# Expected: METABOB_PROJECT_ID=exp-repo-dev
```

### Test 3: metabob-cli Functionality
```bash
# Host (if metabob-cli supports project-info)
cd repos/metabob-cli
metabob-cli version
# Expected: version 1.8.0

# Container
docker exec devbob-opencode metabob-cli version
# Expected: version 1.8.0
```

### Test 4: MCP Integration
```bash
# From OpenCode session on host
# Tools should include:
# - metabob_search_activities
# - metabob_search_codebase_issues  
# - metabob_get_priority_issues
# - etc.
```

### Test 5: Activity Template Sharing
```bash
# Register activity from host
# (if you have a template file)
# metabob-cli register-template path/to/template.yaml

# Search from container
# docker exec devbob-opencode metabob-cli ...
# Should see the same activities
```

---

## Conclusion

**Overall Assessment**: ✅ **Backend is running** | ⚠️ **Configs need alignment**

**Key Findings**:
- ✅ Backend services are healthy and running (v0.16.0)
- ✅ metabob-cli v1.8.0 installed in host and containers
- ✅ Host machine can access backend at localhost:8080
- ✅ Containers can access backend via host.docker.internal:8080
- ✅ MCP integration is configured (command + enabled)

**Critical Issues**:
- ❌ **Missing `project_id` in configs/opencode.devbob.json**
- ⚠️ **Project ID mismatch** (host: exp-repo-dev, containers: devbob-multi-agent)
- ⚠️ **Empty MCP environment** in container config
- ⚠️ **Inconsistent URL patterns** (not critical but confusing)

**Impact**:
- Host and containers will access **different projects** on the backend
- Activity templates won't be shared
- Analysis results won't be shared
- MCP server may not receive backend URL properly

**Recommended Immediate Action**: 
Run the quick fix script above to add `project_id` and MCP environment to the container config, then restart containers.

**Estimated Time to Fix**: 2 minutes
