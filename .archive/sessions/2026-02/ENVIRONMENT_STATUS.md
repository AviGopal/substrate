# Environment Status Report

**Generated**: 2026-02-10  
**Purpose**: Track current work state and plan docker-compose profile-based environment

---

## 📊 Current Status Summary

### Main Repository (metabob-devbob)
- **Branch**: `master`
- **Status**: Clean working directory with staged documentation cleanup
- **Key Changes**:
  - ✅ Documentation cleanup (148 obsolete files removed)
  - ✅ Archive structure created (.archive/planning-docs, session-logs, summaries, test-reports)
  - 🔄 Modified: `.metabob/metadata`, configs, COMPLETE_FLOW_MAP.md
  - ⚠️ Many untracked files (test scripts, diagnostic tools, status docs)

### Sub-repositories Status

#### 1. repos/metabob-cli
- **Branch**: `feature/cli-dashboard-integration`
- **Modified Files**:
  - `README.md`
  - `src/metabob_cli/mcp/server.py`
- **New Files**:
  - `FILEWATCHER_IMPROVEMENTS.md`
  - `tests/unit/test_file_watcher_improvements.py`
- **In-Flight Work**: File watcher improvements for better MCP integration

#### 2. repos/metabob-opencode
- **Branch**: `fix/mcp-activity-integration`
- **Major Changes**: Activity system and memory management improvements
- **Modified Files** (32 files):
  - Core session management: `session/*.ts` (13 files)
  - Tool implementations: `tool/*.ts` (7 files)
  - Config and schemas: `config/*.ts`
  - MCP integration: `mcp/index.ts`
  - Storage and utilities
- **New Files**: Activity system tests, documentation, validation scripts
- **In-Flight Work**: 
  - ✅ MCP integration fully working
  - ⚠️ Schema validation fix needed for activity execution
  - Memory leak fixes applied
  - Activity recommendation system

#### 3. repos/metabob-rpc-api
- **Branch**: `refactor-code-similarity`
- **Modified Files**:
  - `admin/commands/` (orgs.py, projects.py)
  - `server/app.py`
  - `server/routes/` (auth, health, activity_recommendations)
  - `server/actions/` (activity_variants, auth, auth_db)
  - Configuration: `.metabob/config.json`, `.opencode/opencode.json`
  - Dependencies: `pyproject.toml`, `uv.lock`
  - Database: SurrealDB files updated
- **New Files**:
  - `server/routes/v2_session.py` (new v2 session endpoint)
  - `tests/routes/test_v2_*.py` (v2 API tests)
  - `check-backend-version.sh`
- **In-Flight Work**: V2 API implementation, code similarity refactor

---

## 🎯 Current State Analysis

### What's Working ✅
1. **MCP Communication**: Fully functional (26 tools from metabob-cli)
2. **Activity Discovery**: Working (27 activities discovered)
3. **Backend Services**: Architecture defined in docker-compose.devbob.yaml
4. **Container Images**: Devbob container structure defined
5. **Network Architecture**: Two networks (devbob-network, metabob-network)

### What Needs Work ⚠️
1. **Schema Validation**: Activity execution blocked by missing schema fields
2. **Environment Separation**: Need profile-based docker-compose for:
   - Development (local testing)
   - DevBob containers (isolated agent testing)
   - Host machine (separate metabob-opencode config)
3. **Configuration Management**: Multiple config files need consolidation
4. **In-Flight Changes**: Three repos with uncommitted work

---

## 🐳 Docker Compose Analysis

### Current Setup (configs/docker-compose.devbob.yaml)

**Services**:
1. **Backend Stack**:
   - `redis` → port 6379
   - `surreal` → port 8000
   - `surrealist` → port 8001 (UI)
   - `db-init` → one-time initialization
   - `metabob-rpc-api-server` → port 8080
   - `metabob-rpc-api-worker` → Celery worker

2. **DevBob Agents** (5 containers):
   - `devbob-rpc-api` → ACP:3001, MCP:8081, Dashboard:3010/3020
   - `devbob-dashboard` → ACP:3002, MCP:8082, Dashboard:3011/3021
   - `devbob-cli` → ACP:3003, MCP:8083, Dashboard:3012/3022
   - `devbob-opencode` → ACP:3004, MCP:8084, Dashboard:3013/3023
   - `devbob` → ACP:3005, MCP:8085, Dashboard:3014/3024

**Networks**:
- `devbob-network` (bridge)
- `metabob-network` (bridge)

**Volumes**:
- Backend: redis_data, surreal_data, api_logs, worker_logs
- Shared: devbob_config, devbob_auth
- Per-agent: workspaces for each codebase

### Issues with Current Setup

1. **No Profile Separation**: All services start together
2. **Configuration Conflict**: 
   - Devbob agents use `configs/opencode.devbob.json` (api_url: host.docker.internal:8080)
   - Host uses `configs/opencode.host.json` (api_url: localhost:8080)
   - metabob-opencode repo has its own config pointing to localhost:8080
3. **Port Conflicts**: Running all agents simultaneously uses 25+ ports
4. **Resource Usage**: All 5 agents + backend = high memory usage

---

## 🎨 Proposed Architecture: Profile-Based Setup

### Profile Structure

```yaml
profiles:
  # Core backend services (always needed)
  backend:
    - redis
    - surreal
    - surrealist
    - db-init
    - metabob-rpc-api-server
    - metabob-rpc-api-worker

  # Individual devbob containers for testing
  devbob-rpc-api:
    - devbob-rpc-api
  
  devbob-dashboard:
    - devbob-dashboard
  
  devbob-cli:
    - devbob-cli
  
  devbob-opencode:
    - devbob-opencode
  
  devbob-orchestrator:
    - devbob

  # Convenience profiles
  all-agents:
    - all devbob containers
  
  testing:
    - backend + devbob-opencode (for integration testing)
```

### Configuration Separation

**1. configs/opencode.devbob.json** (for containers)
```json
{
  "metabob": {
    "base_url": "http://host.docker.internal:8080",  // or metabob-rpc-api-server:8080
    "api_key": "${METABOB_API_KEY}"
  }
}
```

**2. configs/opencode.host.json** (for host machine)
```json
{
  "metabob": {
    "base_url": "http://localhost:8080",
    "api_key": "${METABOB_API_KEY}"
  }
}
```

**3. repos/metabob-opencode/.opencode/opencode.json** (development)
```json
{
  "metabob": {
    "base_url": "http://localhost:8080",
    "api_key": "${METABOB_API_KEY}"
  }
}
```

### Usage Examples

```bash
# Start backend only
docker compose --profile backend up -d

# Start backend + opencode agent for testing
docker compose --profile backend --profile devbob-opencode up -d

# Start everything (development)
docker compose --profile backend --profile all-agents up -d

# Start specific agent combo
docker compose --profile backend --profile devbob-rpc-api --profile devbob-cli up -d

# Backend + orchestrator only
docker compose --profile backend --profile devbob-orchestrator up -d
```

---

## 📋 Recommendations

### Immediate Actions

1. **Create Profile-Based docker-compose.yaml**
   - Split existing docker-compose.devbob.yaml into profiles
   - Keep backward compatibility (default profile = backend)
   - Add convenience profiles (testing, development, minimal)

2. **Consolidate Configuration**
   - Create `.env` template with all required variables
   - Document which config file is for which use case
   - Update devbob-entrypoint.sh to select correct config

3. **Commit Strategy**
   - **metabob-cli**: File watcher improvements (ready to commit)
   - **metabob-opencode**: Activity system fixes (staged changes, commit when schema fix complete)
   - **metabob-rpc-api**: V2 API and code similarity work (review before commit)

4. **Testing Setup**
   - Start: `docker compose --profile backend --profile devbob-opencode up -d`
   - Test: Activity execution with schema validation fix
   - Verify: MCP integration end-to-end

### Configuration File Guidance

| File | Purpose | Used By | Metabob URL |
|------|---------|---------|-------------|
| `configs/opencode.devbob.json` | DevBob containers | Containers in docker-compose | `http://host.docker.internal:8080` |
| `configs/opencode.host.json` | Host machine CLI | Host opencode commands | `http://localhost:8080` |
| `repos/metabob-opencode/.opencode/opencode.json` | OpenCode development | Working on opencode repo | `http://localhost:8080` |
| `repos/metabob-rpc-api/.opencode/opencode.json` | RPC API development | Working on rpc-api repo | `http://localhost:8080` |
| `repos/metabob-cli/.opencode/opencode.json` | CLI development | Working on cli repo | `http://localhost:8080` |

---

## 🔧 Next Steps

### Phase 1: Docker Compose Refactor (1-2 hours)
- [ ] Create new `docker-compose.yaml` with profiles
- [ ] Test profile combinations
- [ ] Update devbob script to use profiles
- [ ] Document profile usage

### Phase 2: Configuration Cleanup (30 min)
- [ ] Create `.env.example` with all variables
- [ ] Document config file purposes
- [ ] Add config selection logic to entrypoint

### Phase 3: Commit In-Flight Work (1 hour)
- [ ] Review and commit metabob-cli changes
- [ ] Fix schema validation in metabob-opencode
- [ ] Review and stage metabob-rpc-api changes
- [ ] Test integration end-to-end

### Phase 4: Documentation (30 min)
- [ ] Update README with profile usage
- [ ] Add architecture diagram
- [ ] Document troubleshooting steps

---

## 📝 Notes

### Port Allocation
```
Backend:
  8000  - SurrealDB
  8001  - Surrealist UI
  8080  - RPC API Server
  6379  - Redis

DevBob Agents:
  3001-3005  - ACP ports
  8081-8085  - MCP ports
  8091-8095  - HTTP bridges
  3010-3014  - Dashboard UI
  3020-3024  - Dashboard API
```

### Memory Considerations
- Current setup: ~6GB (all services)
- Backend only: ~2GB
- Backend + 1 agent: ~3GB
- Profile approach reduces memory footprint significantly

### Known Issues
1. Schema validation blocks activity execution (fix in progress)
2. Auto-inject disabled in devbob container due to MCP IPC issues
3. Three repos have uncommitted changes requiring review

---

**Status**: Ready for docker-compose refactor with profiles ✅
