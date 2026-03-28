# Deployment State - February 16, 2026 (Afternoon)

## Current Status: Two Separate Deployments Running

### Deployment 1: RPC API Standalone (Primary)
**Location**: `repos/metabob-rpc-api/docker-compose.yaml`  
**Project Name**: `metabob-rpc-api`  
**Status**: ✅ Running (4 hours uptime)

**Services**:
```
metabob-rpc-api-server-dev-1   UP 4 hours   0.0.0.0:8080->8080/tcp
metabob-rpc-api-redis-1        UP 8 hours   6379/tcp
metabob-rpc-api-surreal-1      UP 8 hours   8000/tcp
```

**Notes**:
- This is the primary backend used by devbob-clean container
- No celery worker included in this deployment
- API server handles requests synchronously or queues jobs in Redis for later processing

### Deployment 2: Multi-Agent Devbob Environment (Secondary)
**Location**: `docker-compose.yaml` (root)  
**Project Name**: `metabob-devbob`  
**Status**: ✅ Partially active (stable profile not running to avoid conflicts)

**Active Services**:
```
devbob-clean              UP 2 days (healthy)   0.0.0.0:3000->3000/tcp, 0.0.0.0:8082->8082/tcp
metabob-surrealist        UP 2 days             0.0.0.0:8001->8080/tcp
metabob-redis             UP 2 days (healthy)   0.0.0.0:6379->6379/tcp
metabob-surreal           UP 2 days (healthy)   0.0.0.0:8000->8000/tcp
```

**Inactive Services** (to avoid conflicts):
- ❌ `metabob-rpc-api-server` (stable profile) - conflicts with metabob-rpc-api-server-dev-1
- ❌ `celery-worker` (stable profile) - was crash-looping, now fixed but not started

---

## Deployment Architecture

### Option A: Unified Deployment (Planned)
Use `docker-compose.yaml` with `--profile stable` for everything:
```bash
# Start backend + devbob agents
docker-compose --profile stable --profile devbob up -d
```

**Benefits**:
- Single compose file manages entire stack
- Consistent configuration
- Easier to manage

**Status**: Ready to use (celery worker command now fixed)

### Option B: Hybrid Deployment (Current)
RPC API has its own compose + devbob-clean uses it:
```bash
# Terminal 1: RPC API
cd repos/metabob-rpc-api
docker-compose up -d

# Terminal 2: Devbob agents
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker-compose --profile devbob up -d
```

**Benefits**:
- RPC API can be updated independently
- Each repo has its own lifecycle

**Current State**: This is what's running now

---

## Recent Fixes Applied

### 1. Celery Worker Command Fix ✅
**Commit**: `c5efdd1`  
**Issue**: Command `celery-worker` doesn't exist in API 0.16.12  
**Fix**: Changed to `celery -A tasks.jobs worker -l INFO -c 4 -E -P solo`  
**File**: `docker-compose.yaml` line 152

### 2. Template Loader Improvements ✅
**Commit**: `d338ca3c` (opencode repo)  
**Changes**:
- Removed bootstrap-only restriction for local templates
- Added detailed debug logging
- Allows newer bun patch versions

### 3. Phase 4A Unit Tests ✅
**Commit**: `737885c1` (opencode repo)  
**Added**: 7 unit tests for remote session impulse tracking (25 assertions, all passing)

---

## Network Configuration

### Networks
```
metabob-network (external)  - Shared by both deployments
devbob-network (external)   - Devbob agents communicate here
```

### Port Mapping
```
8080  → API Server (metabob-rpc-api-server-dev-1)
6379  → Redis (metabob-redis)
8000  → SurrealDB (metabob-surreal)
8001  → Surrealist UI (metabob-surrealist)
3000  → Devbob Clean ACP (devbob-clean)
8082  → Devbob Clean MCP (devbob-clean)
```

---

## Next Steps

### Immediate (Today)
1. ✅ Document deployment state (this file)
2. ⏳ Validate docker-compose profiles work correctly
3. ⏳ Test profile switching (stable → devbob → devbob-dev)

### Short Term (This Week)
1. Decide on unified vs hybrid deployment approach
2. Add celery worker to RPC API compose if needed
3. Phase 4B: Live progress updates for ACP delegation

### Long Term (Next Sprint)
1. Self-healing agent monitoring
2. Cross-agent coordination via MESSAGE_FOR
3. Activity template learning from agent behavior

---

## Troubleshooting

### If API Server Conflicts Occur
```bash
# Check which compose project is running
docker inspect <container-name> --format '{{.Config.Labels}}' | grep project

# Stop metabob-devbob project services
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker-compose --profile stable down

# Or stop metabob-rpc-api project services
cd repos/metabob-rpc-api
docker-compose down
```

### If Celery Worker Fails
```bash
# Check logs
docker logs metabob-celery-worker --tail 50

# Verify command in compose file
grep -A 5 "celery-worker:" docker-compose.yaml

# Expected command:
# command: ["celery", "-A", "tasks.jobs", "worker", "-l", "INFO", "-c", "4", "-E", "-P", "solo"]
```

---

**Last Updated**: February 16, 2026, 5:18 PM PST  
**Deployment Health**: ✅ Stable (primary API server running, devbob-clean active)
