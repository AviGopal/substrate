# Implementation Ready: Debuggable Architecture

**Date**: 2026-02-10  
**Status**: ✅ Ready to implement

---

## 🎯 What We've Created

A comprehensive plan for a **debuggable, distributed development system** with:

1. **Simplified Architecture** - Shared backend + on-demand agent containers
2. **Maximum Debuggability** - Direct log access, shell access, session inspection
3. **Minimal Complexity** - `network_mode: host` eliminates networking issues
4. **Research-Friendly** - Easy to inspect Metabob ↔ OpenCode bridge

---

## 📚 Documentation Suite

### Core Planning Documents

| Document | Purpose | Read When |
|----------|---------|-----------|
| **STATUS_INDEX.md** | Master navigation | Start here |
| **DEBUGGABLE_ARCHITECTURE_PLAN.md** | Detailed architecture & implementation | Before implementing |
| **ENVIRONMENT_STATUS.md** | Current repository status | Understanding what exists |
| **DOCKER_COMPOSE_PROFILE_PLAN.md** | Original profile plan (superseded) | Reference only |

### Quick Reference

| Document | Purpose |
|----------|---------|
| **ARCHITECTURE_VISUAL.md** | Port maps, diagrams |
| **CURRENT_WORK_SUMMARY.md** | Executive summary |

---

## 🏗️ Architecture Summary

### Design Philosophy

**"Debuggability over isolation"**

- All services use `network_mode: host` for simplicity
- Shared `.metabob/` directory for unified component tracking
- Single backend (localhost:8080) for all agents and host
- Direct container access (logs, shell, file inspection)

### Components

```
Shared Backend (Always Running)
├── Redis (localhost:6379)
├── SurrealDB (localhost:8000)
└── Metabob RPC API (localhost:8080)

DevBob Agents (On-Demand)
├── devbob-opencode (ACP: 3004) → repos/metabob-opencode
├── devbob-rpc-api (ACP: 3001) → repos/metabob-rpc-api
├── devbob-cli (ACP: 3003) → repos/metabob-cli
├── devbob-dashboard (ACP: 3002) → repos/metabob-dashboard
└── devbob-orchestrator (ACP: 3005) → metabob-devbob

Host Machine
└── opencode CLI → configs/opencode.host.json → localhost:8080
```

### Key Benefits

1. **Shared Learning**: All agents connect to same SurrealDB → unified learning
2. **Simple Networking**: Everything on localhost (host) or host.docker.internal (containers)
3. **Easy Debugging**: `docker logs -f`, `docker exec -it`, direct API queries
4. **Research Ready**: Inspect component tracking ↔ impulse bridge at every layer

---

## 🚀 What You Need to Implement

### Phase 1: Backend (30 min)

**File**: `docker-compose.yaml`

Create with `backend` profile:
- redis (network_mode: host, port 6379)
- surreal (network_mode: host, port 8000)
- metabob-rpc-api (network_mode: host, port 8080)

**Test**:
```bash
./devbob backend start
curl http://localhost:8080/health
```

### Phase 2: Agent Containers (45 min)

**File**: `docker-compose.yaml` (add to existing)

Add agent services with individual profiles:
- devbob-opencode (profile: devbob-opencode, ACP: 3004)
- devbob-rpc-api (profile: devbob-rpc-api, ACP: 3001)
- devbob-cli (profile: devbob-cli, ACP: 3003)
- devbob-dashboard (profile: devbob-dashboard, ACP: 3002)
- devbob-orchestrator (profile: devbob-orchestrator, ACP: 3005)

Each agent:
- Uses `network_mode: host`
- Mounts `./` to `/workspace`
- Mounts `./.metabob` to `/workspace/.metabob` (shared)
- Uses `configs/opencode.devbob.json`

**Test**:
```bash
./devbob agent start devbob-opencode
docker logs -f devbob-opencode
```

### Phase 3: Configuration Files (15 min)

**Files to create/update**:

1. `configs/opencode.base.json` - Shared settings (model, mcp, session memory)
2. `configs/opencode.devbob.json` - Container override (host.docker.internal:8080)
3. `configs/opencode.host.json` - Host override (localhost:8080)
4. `configs/.env.devbob.example` - Environment variable template

**Test**:
```bash
# In container
docker exec devbob-opencode cat $OPENCODE_CONFIG | grep base_url
# Should show: host.docker.internal:8080

# On host
cat configs/opencode.host.json | grep base_url
# Should show: localhost:8080
```

### Phase 4: DevBob Script (30 min)

**File**: `devbob` (replace existing)

Use the new script created in `devbob.new`:
```bash
cp devbob devbob.backup
cp devbob.new devbob
chmod +x devbob
```

**Commands**:
- `./devbob start` - Backend + devbob-opencode
- `./devbob backend start` - Backend only
- `./devbob agent start <name>` - Specific agent
- `./devbob debug logs <container>` - Debugging
- `./devbob debug session <agent>` - Session inspection

**Test**:
```bash
./devbob help
./devbob backend start
./devbob agent start devbob-opencode
./devbob debug health
```

---

## ✅ Implementation Checklist

### Preparation
- [ ] Review `DEBUGGABLE_ARCHITECTURE_PLAN.md` (full details)
- [ ] Backup current files (`docker-compose.devbob.yaml`, `devbob`)
- [ ] Understand architecture (shared backend, host network)

### Phase 1: Backend (30 min)
- [ ] Create `docker-compose.yaml` with backend profile
- [ ] Use `network_mode: host` for all backend services
- [ ] Test: `./devbob backend start`
- [ ] Verify: `curl http://localhost:8080/health`
- [ ] Verify: `curl http://localhost:8000/health`
- [ ] Verify: `redis-cli ping`

### Phase 2: Agent Containers (45 min)
- [ ] Add agent services to `docker-compose.yaml`
- [ ] Use `network_mode: host` for all agents
- [ ] Mount `./` to `/workspace` for each agent
- [ ] Mount `./.metabob` as shared directory
- [ ] Test: `./devbob agent start devbob-opencode`
- [ ] Verify: `curl http://localhost:3004/config`
- [ ] Verify: `docker logs devbob-opencode`

### Phase 3: Configuration (15 min)
- [ ] Create `configs/opencode.base.json`
- [ ] Update `configs/opencode.devbob.json` (host.docker.internal)
- [ ] Verify `configs/opencode.host.json` (localhost)
- [ ] Create `configs/.env.devbob.example`
- [ ] Test config loading in container
- [ ] Test config loading on host

### Phase 4: DevBob Script (30 min)
- [ ] Backup current `devbob` script
- [ ] Install new `devbob` from `devbob.new`
- [ ] Make executable: `chmod +x devbob`
- [ ] Test: `./devbob help`
- [ ] Test: `./devbob backend start`
- [ ] Test: `./devbob agent start devbob-opencode`
- [ ] Test: `./devbob debug health`

### Phase 5: End-to-End Test (30 min)
- [ ] Start backend: `./devbob backend start`
- [ ] Start agent: `./devbob agent start devbob-opencode`
- [ ] Watch logs: `./devbob debug logs devbob-opencode`
- [ ] Query sessions: `./devbob debug session devbob-opencode`
- [ ] Shell access: `./devbob agent shell devbob-opencode`
- [ ] Inspect `.metabob/` shared state
- [ ] Test activity execution
- [ ] Stop services: `./devbob stop`

---

## 🧪 Debugging Workflows (After Implementation)

### Research Workflow: Component Tracking ↔ Impulse Bridge

**Goal**: Understand how component tracking data flows to impulse system

**Steps**:
```bash
# 1. Start environment
./devbob backend start
./devbob agent start devbob-opencode

# 2. Watch logs (Terminal 1)
./devbob debug logs devbob-opencode

# 3. Monitor sessions (Terminal 2)
watch -n 1 './devbob debug session devbob-opencode | jq ".[-1]"'

# 4. Send task via ACP (Terminal 3)
curl -X POST http://localhost:3004/task \
  -H "Content-Type: application/json" \
  -d '{"description": "Fix authentication bug", "context": []}'

# 5. After execution, inspect data flow
./devbob debug components           # What components were tracked?
./devbob debug impulses              # What impulses were created?
cat .metabob/metadata                # Raw component data
```

### Debug Session: Activity Execution

**Goal**: Understand activity execution flow

**Steps**:
```bash
# 1. Start with backend
./devbob backend start

# 2. Start agent in foreground (see all output)
docker run --rm -it --network host \
  -v $(pwd):/workspace \
  -e AGENT_NAME=devbob-opencode \
  -e OPENCODE_CONFIG=/workspace/configs/opencode.devbob.json \
  devbob:latest /bin/bash

# 3. Inside container, run activity manually
cd /workspace/repos/metabob-opencode
opencode activity --template add-feature-complete \
  --var feature_name="test feature" \
  --var feature_description="test description"

# 4. Inspect results
cat .opencode/activities/last_execution.json | jq
cat .opencode/impulses.json | jq
```

### Debug Session: Metabob Integration

**Goal**: Verify Metabob tools work correctly

**Steps**:
```bash
# 1. Start environment
./devbob start

# 2. Shell into agent
./devbob agent shell devbob-opencode

# 3. Test Metabob CLI directly
metabob-cli mcp --transport stdio

# 4. Test search_codebase_issues
curl -X POST http://localhost:8080/search \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication", "limit": 10}' | jq

# 5. Check component tracking
curl http://localhost:8080/components?project=devbob-distributed | jq
```

---

## 📊 Success Metrics

### Phase 1 Complete (Backend)
- ✅ Backend starts successfully
- ✅ All health checks pass
- ✅ API responds on localhost:8080
- ✅ SurrealDB accessible on localhost:8000
- ✅ Redis accessible on localhost:6379

### Phase 2 Complete (Agents)
- ✅ Agent containers start successfully
- ✅ ACP ports accessible (3001-3005)
- ✅ Logs stream with `docker logs -f`
- ✅ Shell access works with `docker exec -it`
- ✅ `.metabob/` shared directory accessible

### Phase 3 Complete (Configuration)
- ✅ Containers use `host.docker.internal:8080`
- ✅ Host uses `localhost:8080`
- ✅ Configs load correctly
- ✅ Environment variables work

### Phase 4 Complete (DevBob Script)
- ✅ All commands work
- ✅ Help text is clear
- ✅ Error messages are helpful
- ✅ Workflow is intuitive

### Phase 5 Complete (End-to-End)
- ✅ Activity execution works
- ✅ Component tracking works
- ✅ Impulse system works
- ✅ Sessions stored in SurrealDB
- ✅ Debugging workflows functional

---

## 🎓 Research Goals (Post-Implementation)

### Primary Research Question
**How do we automatically bridge component tracking → impulse loading?**

**Current State**: Manual bridge (human decides what to load)

**Goal**: Automatic bridge with learning

**Research Steps**:
1. Instrument the bridge (log every step)
2. Collect execution data (50-100 runs)
3. Analyze patterns (which impulses → success)
4. Build recommendation model
5. Test model (does it improve outcomes?)

### Data Collection Points

**File**: `.metabob/metadata`
- What: Component tracking data
- When: After file changes detected
- How: Metabob file watcher

**File**: `.opencode/impulses.json`
- What: Loaded context for LLM
- When: Before activity execution
- How: OpenCode impulse system

**Database**: SurrealDB `activity_executions`
- What: Activity execution results
- When: After activity completes
- How: Activity recording system

**Analysis**: Compare success rates by impulse selection strategy

---

## 🚦 Ready to Proceed?

**Prerequisites**:
- ✅ Documentation complete
- ✅ Architecture designed
- ✅ Implementation plan clear
- ✅ Testing strategy defined
- ✅ Debugging workflows documented

**Estimated Time**: ~2.5 hours for full implementation

**Recommended Approach**: Implement Phase 1, test, then proceed incrementally

---

## 📞 Quick Reference

### Start Commands
```bash
./devbob start                    # Backend + devbob-opencode
./devbob backend start            # Backend only
./devbob agent start <name>       # Specific agent
```

### Debug Commands
```bash
./devbob debug logs <container>   # Stream logs
./devbob debug session <agent>    # Query sessions
./devbob debug components         # Component tracking
./devbob debug impulses <agent>   # Impulse state
./devbob debug health             # System health
```

### Container Access
```bash
docker logs -f <container>        # Stream logs
docker exec -it <container> bash  # Open shell
```

### API Queries
```bash
curl http://localhost:8080/health                         # Backend health
curl http://localhost:8080/sessions?agent=devbob-opencode # Sessions
curl http://localhost:8080/components?project=...         # Components
curl http://localhost:3004/config                         # Agent config (ACP)
```

---

**Status**: ✅ Ready for implementation  
**Next Step**: Begin Phase 1 (Backend Setup)  
**Expected Duration**: 2.5 hours total  
**Risk Level**: Low (simple architecture, easy to debug)
