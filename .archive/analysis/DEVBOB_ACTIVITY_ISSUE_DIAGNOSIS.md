# DevBob Container Activity Execution Issue - Root Cause Analysis

## 🔴 Problem Statement

Activity execution fails in the devbob-opencode container despite the V2 activity system working correctly in standalone tests.

## 🔍 Root Cause Analysis

### Issue #1: Wrong Backend URL in Container Config ❌

**Location**: `/workspace/.opencode/opencode.json` (inside container)

**Problem**:
```json
{
  "mcp": {
    "metabob": {
      "environment": {
        "METABOB_API_URL": "http://host.docker.internal:8080"  // ❌ WRONG
      }
    }
  },
  "metabob": {
    "base_url": "http://host.docker.internal:8080"  // ❌ WRONG
  }
}
```

**Why This is Wrong**:
- `host.docker.internal` is used for containers to reach the **host machine**
- But in docker-compose, backend runs as `api-server-dev` **container**
- Containers should use container-to-container networking
- Correct URL: `http://api-server-dev:8080`

**Evidence**:
```bash
# This works (container to container):
$ docker exec devbob-opencode curl http://api-server-dev:8080/
{"status":"ok","timestamp":"2026-02-11T09:41:17.537451","version":"0.16.0"}

# Backend is on same network:
$ docker ps --filter "name=api-server-dev"
api-server-dev   Up 15 minutes (healthy)   0.0.0.0:8080->8080/tcp
```

### Issue #2: Config File Not Mounted Correctly ⚠️

**Docker Compose Config** (`docker-compose.yaml:526`):
```yaml
environment:
  OPENCODE_CONFIG: /workspace/configs/opencode.devbob.json  # Points here
volumes:
  - devbob_opencode_workspace:/workspace  # But configs/ doesn't exist in volume
```

**Actual State**:
```bash
$ docker exec devbob-opencode ls -la /workspace/configs/
ls: cannot access '/workspace/configs/': No such file or directory

$ docker exec devbob-opencode cat /workspace/.opencode/opencode.json
# Config exists here instead (auto-generated)
```

**What's Happening**:
1. `OPENCODE_CONFIG` env var points to non-existent path
2. OpenCode falls back to default location: `/workspace/.opencode/opencode.json`
3. This auto-generated config has wrong URLs

### Issue #3: Config Template Has Wrong URLs 📝

**Host Config** (`configs/opencode.devbob.json`):
```json
{
  "mcp": {
    "metabob": {
      "environment": {
        "METABOB_API_URL": "http://host.docker.internal:8080"  // ❌
      }
    }
  },
  "metabob": {
    "base_url": "http://host.docker.internal:8080"  // ❌
  }
}
```

This template was designed for host machine usage, not container-to-container.

## 🔧 Solutions

### Solution 1: Fix Config URLs (Quick Fix) ✅

Update the container's actual config:

```bash
docker exec devbob-opencode sh -c 'cat > /workspace/.opencode/opencode.json << EOF
{
  "share": "disabled",
  "model": "anthropic/claude-sonnet-4-5",
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_URL": "http://api-server-dev:8080"
      },
      "enabled": true,
      "timeout": 10000
    }
  },
  "metabob": {
    "cli_path": "metabob-cli",
    "base_url": "http://api-server-dev:8080",
    "project_id": "exp-repo-dev",
    "max_issues": 5,
    "min_severity": "MEDIUM"
  },
  "sessionMemory": {
    "enabled": true,
    "budgets": {
      "perImpulse": 2000,
      "total": 10000
    }
  }
}
EOF'
```

Then restart OpenCode in the container:
```bash
docker restart devbob-opencode
```

### Solution 2: Create Proper Container Config Template (Permanent Fix) ✅

Create: `configs/opencode.container.json`

```json
{
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
        "METABOB_API_URL": "http://api-server-dev:8080"
      },
      "enabled": true,
      "timeout": 15000
    }
  },
  "metabob": {
    "cli_path": "metabob-cli",
    "base_url": "http://api-server-dev:8080",
    "state_directory": ".metabob",
    "project_id": "exp-repo-dev",
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
    "maxImpulsesPerTurn": 5,
    "memoryManagement": {
      "maxCacheTokens": 10000,
      "maxHistoryMessages": 100,
      "autoCompact": true,
      "compactThreshold": 2048,
      "activityStateCleanup": true,
      "cleanupIntervalMinutes": 5,
      "impulseMaxIdleMinutes": 10,
      "sessionMaxIdleMinutes": 60,
      "maxImpulseCache": 1000,
      "maxSessionsTracked": 100,
      "memoryThresholdMB": 1024,
      "forceGcThresholdMB": 2048
    }
  },
  "$schema": "https://opencode.ai/config.json"
}
```

### Solution 3: Mount Config Properly (Infrastructure Fix) ✅

Update `docker-compose.yaml` devbob-opencode service:

```yaml
devbob-opencode:
  volumes:
    - devbob_opencode_workspace:/workspace
    - ./configs/opencode.container.json:/workspace/.opencode/opencode.json:ro
    # OR
    - devbob_config:/config
```

## 🧪 Verification Steps

### 1. Test Backend Connectivity
```bash
docker exec devbob-opencode curl http://api-server-dev:8080/
# Expected: {"status":"ok",...}
```

### 2. Test MCP Connection
```bash
docker exec devbob-opencode sh -c 'curl http://localhost:3004/config | jq ".mcp.metabob"'
# Expected: Shows metabob MCP config with api-server-dev URL
```

### 3. Test Activity Search
```bash
docker exec devbob-opencode sh -c '
echo "{\"method\":\"tools/call\",\"params\":{\"name\":\"metabob_search_activities\",\"arguments\":{\"query\":\"bug fix\",\"limit\":5}},\"id\":1}" | metabob-cli mcp --transport stdio
'
# Expected: Returns activity templates
```

### 4. Test Full Activity Execution
Access container ACP and try an activity:
```bash
# From host:
curl -X POST http://localhost:3004/sessions \
  -H "Content-Type: application/json" \
  -d '{"agent":"activity","model":"anthropic/claude-sonnet-4-5"}'

# Then send activity command through ACP
```

## 📊 Current vs Fixed State

### Current State ❌
```
devbob-opencode container
  └─ /workspace/.opencode/opencode.json
      └─ METABOB_API_URL: http://host.docker.internal:8080
          └─ Tries to reach host machine
              └─ ❌ Backend is in api-server-dev container, not on host
```

### Fixed State ✅
```
devbob-opencode container
  └─ /workspace/.opencode/opencode.json
      └─ METABOB_API_URL: http://api-server-dev:8080
          └─ Uses docker network
              └─ ✅ Reaches api-server-dev container directly
```

## 🎯 Why Standalone Test Works

The standalone test (`test_v2_with_session.py`) works because:
1. Runs on **host machine**
2. Uses `http://localhost:8080`
3. Backend is exposed to host on port 8080
4. No container networking issues

## 📝 Key Insights

1. **Container-to-Container** networking requires service names, not `host.docker.internal`
2. **`host.docker.internal`** is for container → host, not container → container
3. **Config inheritance** matters - auto-generated configs copy wrong templates
4. **MCP environment variables** must match the actual network topology

## 🚀 Recommended Action

**Immediate**: Apply Solution 1 (quick fix) to unblock activity execution
**Permanent**: Apply Solutions 2 & 3 to fix root cause

## 📖 Related Documentation

- **V2_ACTIVITY_SYSTEM_STATUS.md** - System architecture (validates V2 is correct)
- **TEST_E2E_ACTIVITY_FLOW.md** - Testing guide (confirms test works)
- **docker-compose.yaml** - Container configuration
- **configs/opencode.devbob.json** - Current (wrong) config template

## ✅ Success Criteria

After fix, these should work:
- ✅ MCP metabob tools return results
- ✅ Activity search finds templates
- ✅ Activity execution completes
- ✅ Metrics reported to backend
- ✅ No "Unable to connect" errors
