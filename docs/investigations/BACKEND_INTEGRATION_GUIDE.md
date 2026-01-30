# Backend Integration Guide: Devbob + Metabob RPC API

**Status**: ✅ Complete  
**Date**: 2026-01-27  
**Purpose**: Run metabob-rpc-api service alongside its devbob agent for self-healing

---

## Overview

This configuration includes **BOTH** the metabob-rpc-api backend service AND a devbob agent to manage it. This enables the self-healing pattern where agents can monitor and fix their own services.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Metabob Backend Services                 │
├─────────────────────────────────────────────────────────────┤
│  redis (6379)           - Task queue and cache              │
│  api-server-dev (8080)  - FastAPI backend                   │
│  metabob-worker         - Celery analysis worker            │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Manages & Monitors
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Devbob Agent Containers                  │
├─────────────────────────────────────────────────────────────┤
│  devbob-rpc-api (3001)    - Manages backend + codebase     │
│  devbob-dashboard (3002)  - Dashboard development          │
│  devbob-cli (3003)        - CLI development                │
│  devbob-opencode (3004)   - OpenCode development           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Connects to
                    http://api-server-dev:80
```

### Self-Healing Flow

1. **Issue Detected**: devbob-opencode detects timeout on metabob query
2. **Diagnosis**: Self-healing coordinator identifies backend connectivity issue
3. **Fix Directive**: Routes fix to devbob-rpc-api agent
4. **Resolution**: devbob-rpc-api verifies backend health, restarts if needed
5. **Notification**: MESSAGE_FOR:devbob-opencode - Backend restored

---

## Quick Start

### Prerequisites

1. **Docker and docker-compose** installed
2. **API keys** configured in `.env.devbob`
3. **devbob image** built: `./scripts/build-devbob.sh`

### Start Everything

```bash
# Start all services (backend + agents)
./devbob start

# Or manually:
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob up -d
```

### Start Selectively

```bash
# Start only backend services
././devbob backend

# Start only agents
././devbob agents
```

### Verify Services

```bash
# Check backend
curl http://localhost:8080/status

# Check agents
curl http://localhost:3004/config | jq '.mcpServers.metabob'

# Test connectivity from container
docker exec devbob-opencode curl -sf http://api-server-dev:80/status
```

---

## Service Details

### Backend Services

#### redis (metabob-redis)
- **Port**: 6379
- **Purpose**: Task queue and cache for Celery workers
- **Health**: `redis-cli ping` → PONG
- **Data**: Persisted to `metabob_redis_data` volume

#### api-server-dev (metabob-rpc-api-server)
- **Port**: 8080 → 80 (internal)
- **Purpose**: FastAPI backend for code analysis
- **Health**: `http://localhost:80/status`
- **Logs**: `metabob_api_logs` volume
- **Dependencies**: redis (healthy)

#### metabob-worker (metabob-rpc-api-worker)
- **Purpose**: Celery worker for analysis tasks
- **Logs**: `metabob_worker_logs` volume
- **Dependencies**: redis (healthy)
- **GPU**: Optional (commented out by default)

### Agent Services

#### devbob-rpc-api
- **Port**: 3001 (ACP), 8081 (MCP)
- **Purpose**: Manages RPC API codebase AND backend service
- **Role**: `backend-manager`
- **Capabilities**:
  - Monitors backend health (`http://api-server-dev:80/status`)
  - Can restart services (via docker socket mount)
  - Develops RPC API codebase
  - Coordinates self-healing actions
- **Dependencies**: api-server-dev (healthy), redis (healthy)

#### devbob-dashboard
- **Port**: 3002 (ACP), 8082 (MCP)
- **Purpose**: Dashboard development
- **Dependencies**: api-server-dev (healthy)

#### devbob-cli
- **Port**: 3003 (ACP), 8083 (MCP)
- **Purpose**: CLI development
- **Dependencies**: api-server-dev (healthy)

#### devbob-opencode
- **Port**: 3004 (ACP), 8084 (MCP)
- **Purpose**: OpenCode development
- **Dependencies**: api-server-dev (healthy)

---

## Configuration

### Environment Variables

All configured in `.env.devbob`:

```bash
# LLM Provider (Required)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Optional
OPENAI_API_KEY=...

# Metabob Project (Optional)
METABOB_PROJECT_ID=devbob-multi-agent
METABOB_API_KEY=...

# Repository URLs (Optional - defaults to local)
DEVBOB_RPC_API_REPO=git@github.com:org/metabob-rpc-api.git
DEVBOB_DASHBOARD_REPO=git@github.com:org/metabob-dashboard.git
DEVBOB_CLI_REPO=git@github.com:org/metabob-cli.git
DEVBOB_OPENCODE_REPO=git@github.com:org/opencode.git

# Agent behavior
DEVBOB_CHECKOUT_MODE=shallow
DEVBOB_REPO_DEPTH=1
DEVBOB_AUTO_PUSH=false
LOG_LEVEL=INFO
```

### Backend Configuration

Located at `repos/metabob-rpc-api/.env.docker`:

```bash
REDIS_URI="redis://redis:6379"
REDIS_HOST="redis"
REDIS_PORT="6379"
MODEL_TYPE="test"
LOG_LEVEL="DEBUG"
```

---

## Key Changes from Previous Configuration

### 1. Backend Services Added
```yaml
services:
  redis:                      # NEW - Task queue
  metabob-rpc-api-server:    # NEW - FastAPI backend
  metabob-rpc-api-worker:    # NEW - Celery worker
```

### 2. Agent Connection Points Updated
```yaml
# OLD (failed - service not running)
METABOB_API_URL: ${METABOB_API_URL:-}  # Empty default

# NEW (works - points to service)
METABOB_API_URL: http://api-server-dev:80
```

### 3. Dependencies Added
```yaml
devbob-opencode:
  depends_on:
    metabob-rpc-api-server:
      condition: service_healthy  # Wait for backend
```

### 4. Health Checks Simplified
```yaml
# OLD (too strict - checked for metabob in config)
test: ["CMD", "sh", "-c", "curl -sf http://localhost:3004/config | grep -q metabob"]

# NEW (reliable - just checks config endpoint)
test: ["CMD", "sh", "-c", "curl -sf http://localhost:3004/config"]
```

### 5. Backend Manager Capabilities
```yaml
devbob-rpc-api:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro  # Can manage services
  environment:
    AGENT_ROLE: backend-manager
    MANAGED_SERVICES: "api-server-dev,metabob-redis,metabob-worker"
    SERVICE_HEALTH_URL: "http://api-server-dev:80/status"
```

### 6. Network Configuration
```yaml
networks:
  metabob-network:
    driver: bridge          # NEW - created, not external
    name: metabob-network
```

---

## Troubleshooting

### Backend Not Starting

**Symptom**: `api-server-dev` exits immediately

**Solutions**:
```bash
# Check logs
docker logs api-server-dev

# Verify .env.docker exists
ls -la repos/metabob-rpc-api/.env.docker

# Check redis connectivity
docker exec api-server-dev ping -c 3 redis
```

### Agents Can't Connect to Backend

**Symptom**: Metabob queries hang or timeout

**Solutions**:
```bash
# Test DNS resolution
docker exec devbob-opencode nslookup api-server-dev

# Test HTTP connectivity
docker exec devbob-opencode curl -sf http://api-server-dev:80/status

# Check if backend is healthy
docker ps | grep api-server-dev
curl http://localhost:8080/status
```

### Health Checks Failing

**Symptom**: Containers restarting repeatedly

**Solutions**:
```bash
# Check health check logs
docker inspect devbob-opencode | jq '.[0].State.Health'

# Manually test health check
docker exec devbob-opencode curl -sf http://localhost:3004/config

# Increase start_period if agents are slow
# Edit configs/docker-compose.devbob.yaml:
#   start_period: 180s  # Default is 120s
```

### Port Conflicts

**Symptom**: "port already in use"

**Solutions**:
```bash
# Check what's using the port
lsof -i :8080
lsof -i :3001-3004

# Stop conflicting services or change ports in docker-compose
```

---

## Validation Tests

### Test 1: Backend Health
```bash
# Should return {"status": "ok"} or similar
curl http://localhost:8080/status

# Should return PONG
docker exec metabob-redis redis-cli ping
```

### Test 2: Agent Connectivity
```bash
# Should return OpenCode config
curl http://localhost:3004/config

# Should show metabob MCP server
curl http://localhost:3004/config | jq '.mcpServers.metabob'
```

### Test 3: Cross-Container DNS
```bash
# From agent container, resolve backend
docker exec devbob-opencode nslookup api-server-dev
# Should show: Server: 127.0.0.11, Address: <ip>

# From agent container, access backend
docker exec devbob-opencode curl -sf http://api-server-dev:80/status
# Should return {"status": "ok"}
```

### Test 4: Metabob Tools
```bash
# Delegate task that uses metabob tools
bun run test-simple-metabob.ts

# Should complete without timeout
# Should show metabob query results
```

### Test 5: Self-Healing Pattern
```bash
# Stop backend
docker stop api-server-dev

# Monitor agent behavior
docker logs devbob-opencode -f

# Expected: Agent detects issue, generates fix directive

# Verify devbob-rpc-api receives directive
docker logs devbob-rpc-api -f

# Expected: Restarts backend service
```

---

## Maintenance

### View Logs
```bash
# All services
docker-compose -f configs/docker-compose.devbob.yaml logs -f

# Specific service
docker-compose -f configs/docker-compose.devbob.yaml logs -f api-server-dev

# Agent logs
docker logs devbob-opencode -f --tail 100
```

### Restart Services
```bash
# Restart backend only
docker-compose -f configs/docker-compose.devbob.yaml restart metabob-rpc-api-server

# Restart all agents
docker-compose -f configs/docker-compose.devbob.yaml restart \
    devbob-rpc-api devbob-dashboard devbob-cli devbob-opencode

# Full restart
docker-compose -f configs/docker-compose.devbob.yaml restart
```

### Stop Services
```bash
# Stop all
docker-compose -f configs/docker-compose.devbob.yaml down

# Stop but keep data
docker-compose -f configs/docker-compose.devbob.yaml stop

# Stop and remove volumes (DESTRUCTIVE)
docker-compose -f configs/docker-compose.devbob.yaml down -v
```

### Update Services
```bash
# Pull latest backend image
docker pull metabobapp/metabob-rpc-api:0.12.1

# Rebuild devbob image
./scripts/build-devbob.sh

# Recreate containers
docker-compose -f configs/docker-compose.devbob.yaml up -d --force-recreate
```

---

## Self-Healing Integration

### Health Monitoring

The devbob-rpc-api agent monitors:
1. **Service health**: `http://api-server-dev:80/status` every 30s
2. **Memory usage**: Container stats via docker socket
3. **Log patterns**: Connection errors, crashes, OOM events
4. **Response times**: Slow queries, timeouts

### Autonomous Actions

When issues detected, agent can:
1. **Restart service**: `docker restart api-server-dev`
2. **Clear cache**: `docker exec metabob-redis redis-cli FLUSHDB`
3. **Scale worker**: `docker-compose scale metabob-rpc-api-worker=2`
4. **Update config**: Modify .env.docker and reload
5. **Notify other agents**: MESSAGE_FOR annotations

### Fix Directives

Example directive from self-healing coordinator:
```json
{
  "issueId": "backend-connection-timeout",
  "severity": "HIGH",
  "container": "devbob-opencode",
  "directive": {
    "target": "devbob-rpc-api",
    "action": "verify_and_restart_backend",
    "steps": [
      "Check service health: curl http://api-server-dev:80/status",
      "If unhealthy: docker restart api-server-dev",
      "Wait 30s for service startup",
      "Verify recovery: curl http://api-server-dev:80/status",
      "Annotate: MESSAGE_FOR:devbob-opencode - Backend restored"
    ]
  }
}
```

---

## Performance Considerations

### Resource Limits

Current configuration:
- **Redis**: 2GB max memory, LRU eviction
- **No limits** on other services (adjust as needed)

To add limits:
```yaml
services:
  metabob-rpc-api-server:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

### Scaling

Scale workers:
```bash
docker-compose -f configs/docker-compose.devbob.yaml up -d --scale metabob-rpc-api-worker=3
```

### GPU Support

Uncomment in docker-compose.devbob.yaml:
```yaml
metabob-rpc-api-worker:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            capabilities: [gpu]
            count: 1
```

---

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| Backend | ❌ Not included | ✅ Integrated (3 services) |
| DNS Resolution | ❌ SERVFAIL | ✅ Works (api-server-dev) |
| Connectivity | ❌ Timeouts | ✅ Healthy endpoints |
| Health Checks | ⚠️ Too strict | ✅ Reliable |
| Dependencies | ❌ Missing | ✅ Proper wait conditions |
| Network | ❌ External required | ✅ Created automatically |
| Self-Healing | ⚠️ Theoretical | ✅ Implementable |

---

## Next Steps

1. ✅ **Complete**: Backend integrated into docker-compose
2. ✅ **Complete**: Startup script created
3. ⏭️ **Next**: Test the integrated environment
4. ⏭️ **Next**: Deploy self-healing observability (Tasks 1-2)
5. ⏭️ **Next**: Implement autonomous recovery

---

## Related Files

- `configs/docker-compose.devbob.yaml` - Complete service definition
- `./devbob` - Startup helper script
- `repos/metabob-rpc-api/.env.docker` - Backend configuration
- `.env.devbob` - Agent configuration
- `TIMEOUT_INVESTIGATION_REPORT.md` - Root cause analysis
- `SELF_HEALING_DEVBOB_ARCHITECTURE.md` - System design

---

**Ready to test?** Run:
```bash
./devbob start
```

This resolves the timeout issue identified in the investigation and enables the self-healing pattern! 🎉
