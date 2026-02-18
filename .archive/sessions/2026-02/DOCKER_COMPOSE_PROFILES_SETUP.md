# Docker Compose Profiles Setup

**Date**: February 13, 2026  
**Status**: Ready for implementation

---

## Overview

Three-profile docker-compose architecture for clean separation of environments:

1. **stable**: Production-like backend services
2. **devbob**: Single clean container for activity testing
3. **devbob-dev**: Multiple containers, each managing a codebase

---

## Architecture

### Profile 1: stable (Backend Services)

**Purpose**: Stable backend for all environments

**Services**:
- `redis`: Task queue and cache
- `surreal`: SurrealDB database
- `surrealist`: Database UI
- `metabob-rpc-api-server`: FastAPI backend

**Usage**:
```bash
docker-compose --profile stable up -d
```

**Access**:
- API: http://localhost:8080
- Surrealist: http://localhost:8001
- Redis: localhost:6379
- SurrealDB: http://localhost:8000

---

### Profile 2: devbob (Clean Testing)

**Purpose**: Test activities in isolated environment

**Services**:
- `devbob-clean`: Single container with empty workspace

**Features**:
- ✅ No local code mounted
- ✅ Clean /workspace directory
- ✅ Connects to stable backend
- ✅ Perfect for testing activity templates
- ✅ Validates self-contained activities

**Usage**:
```bash
# Start backend + clean devbob
docker-compose --profile stable --profile devbob up -d

# Submit activity via ACP
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "activityId": "INFRASTRUCTURE-bda5eef0",
    "variables": {
      "template_name": "test",
      "template_category": "test"
    }
  }'
```

**Access**:
- ACP Server: http://localhost:3000
- MCP Server: http://localhost:8082

---

### Profile 3: devbob-dev (Codebase Management)

**Purpose**: Agents manage and adapt codebases

**Services**:
- `devbob-rpc-api`: Manages repos/metabob-rpc-api
- `devbob-cli`: Manages repos/metabob-cli
- `devbob-opencode`: Manages repos/metabob-opencode
- `devbob-dashboard`: Manages repos/metabob-dashboard

**Features**:
- ✅ Local repos mounted as volumes
- ✅ Each agent works on its codebase
- ✅ Agents can modify code
- ✅ Git operations inside containers
- ✅ Coordinated development via MESSAGE_FOR

**Usage**:
```bash
# Start backend + all dev containers
docker-compose --profile stable --profile devbob-dev up -d

# Access specific agent
curl http://localhost:3001/config  # devbob-rpc-api
curl http://localhost:3002/config  # devbob-cli
curl http://localhost:3003/config  # devbob-opencode
curl http://localhost:3004/config  # devbob-dashboard
```

**Agent Responsibilities**:

| Container | Codebase | Role | Port |
|-----------|----------|------|------|
| devbob-rpc-api | metabob-rpc-api | Backend code + service | 3001 |
| devbob-cli | metabob-cli | CLI tool | 3002 |
| devbob-opencode | metabob-opencode | OpenCode agent | 3003 |
| devbob-dashboard | metabob-dashboard | Dashboard UI | 3004 |

---

## Workflow Examples

### Test Activity in Clean Environment

```bash
# 1. Start stable backend
docker-compose --profile stable up -d

# 2. Start clean devbob
docker-compose --profile devbob up -d

# 3. Check devbob is ready
curl http://localhost:3000/config

# 4. Submit activity
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d @test-activity.json

# 5. Check logs
docker logs devbob-clean -f

# 6. Verify in backend
curl http://localhost:8080/v2/activities/templates | \
  jq '.templates[] | select(.variant_name | contains("test"))'
```

**Success Criteria**:
- ✅ Activity executes without local file dependencies
- ✅ Template persists to backend
- ✅ No errors about missing files
- ✅ All steps complete

---

### Development Workflow (devbob-dev)

```bash
# 1. Start everything
docker-compose --profile stable --profile devbob-dev up -d

# 2. Agent makes changes to code
# Example: devbob-rpc-api adds new endpoint

# 3. Send task via ACP
curl -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Add GET /v2/health endpoint",
    "reason": "Improve health checks"
  }'

# 4. Agent modifies repos/metabob-rpc-api/server/routes/...

# 5. Agent commits changes
# (inside container via git)

# 6. Changes visible on host
cd repos/metabob-rpc-api
git log -1  # See agent's commit
```

**Benefits**:
- Agents work on real codebases
- Changes immediately visible
- Git history tracked
- Coordination via annotations

---

## Building Images

### Build devbob base image

```bash
docker build -t devbob:latest \
  --target devbob-base \
  -f docker/Dockerfile.devbob .
```

### Build backend image

```bash
cd repos/metabob-rpc-api
docker build -t metabobapp/metabob-rpc-api:0.16.12 \
  -f docker/Dockerfile.server .
```

---

## Configuration

### Environment Variables

Create `.env` file:

```bash
# API Keys
ANTHROPIC_API_KEY=sk-ant-...
METABOB_API_KEY=your-key

# API Version
API_VERSION=0.16.12
DEVBOB_VERSION=latest

# Backend Config
API_WORKERS=4
LOG_LEVEL=INFO

# Database
SURREAL_USER=root
SURREAL_PASS=root
SURREAL_NAMESPACE=metabob
SURREAL_DATABASE=metabob

# Ports
API_PORT=8080
REDIS_PORT=6379
SURREAL_PORT=8000
SURREALIST_PORT=8001
```

---

## Validation Tests

### Test 1: Backend Health

```bash
curl http://localhost:8080/health
# Expected: {"status":"ok",...}
```

### Test 2: Clean Devbob Starts

```bash
docker logs devbob-clean
# Expected: "OpenCode in ACP mode", "Port: 3000"
```

### Test 3: Activity Execution

```bash
# Submit test activity
curl -X POST http://localhost:3000/execute \
  -d '{"activityId": "test-template"}'

# Check success
docker logs devbob-clean | grep "SUCCESS"
```

### Test 4: Dev Container Mounts

```bash
# Check mount
docker exec devbob-rpc-api ls /workspace
# Expected: server/, docker/, pyproject.toml, ...

# Check git
docker exec devbob-rpc-api git status
# Expected: "On branch ..."
```

---

## Migration from Old Setup

### Old vs New

**Old**:
- Containers started ad-hoc
- No profile separation
- Mixed stable and dev configs
- Hard to test in clean environment

**New**:
- Profile-based deployment
- Clean separation
- Easy to test activities
- Agents manage codebases

### Migration Steps

1. **Stop old containers**:
   ```bash
   docker-compose down
   ```

2. **Backup volumes** (optional):
   ```bash
   docker volume ls | grep metabob
   # Backup if needed
   ```

3. **Replace docker-compose.yaml**:
   ```bash
   mv docker-compose.yaml docker-compose.yaml.old
   mv docker-compose.new.yaml docker-compose.yaml
   ```

4. **Build new images**:
   ```bash
   docker build -t devbob:latest -f docker/Dockerfile.devbob .
   ```

5. **Start with stable profile**:
   ```bash
   docker-compose --profile stable up -d
   ```

6. **Test clean devbob**:
   ```bash
   docker-compose --profile devbob up -d
   curl http://localhost:3000/config
   ```

7. **Start dev containers** (when ready):
   ```bash
   docker-compose --profile devbob-dev up -d
   ```

---

## Troubleshooting

### devbob-clean won't start

**Check**: Backend health
```bash
curl http://localhost:8080/health
```

**Fix**: Wait for backend
```bash
docker logs api-server-stable
```

### Can't connect to MCP

**Check**: metabob-cli installed
```bash
docker exec devbob-clean /opt/metabob-cli/bin/python -m metabob_cli.mcp.server --help
```

**Fix**: Rebuild image
```bash
docker-compose --profile devbob build
```

### Activity fails with file not found

**Issue**: Activity depends on local files

**Fix**: Embed files as impulses or fix activity template

### Git operations fail in dev containers

**Check**: SSH keys mounted
```bash
docker exec devbob-rpc-api ls /root/.ssh
```

**Fix**: Mount SSH keys
```bash
export SSH_KEY_DIR=~/.ssh
docker-compose --profile devbob-dev up -d
```

---

## Next Steps

1. ✅ Build devbob image
2. ✅ Test stable profile
3. ✅ Test devbob clean environment
4. ✅ Submit activity to clean devbob
5. ✅ Verify template persists
6. 🔄 Test devbob-dev profile
7. 🔄 Coordinate agents

---

**Status**: Configuration ready, pending build and test!
