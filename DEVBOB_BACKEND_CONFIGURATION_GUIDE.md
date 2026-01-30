# DevBob Backend Configuration Guide

## Overview

Your DevBob setup is configured to run a **shared metabob RPC-API backend** that all DevBob agents connect to. This architecture provides:

- ✅ **Unified Backend**: Single metabob-rpc-api-server instance serving all agents
- ✅ **Stable Analysis**: Consistent code analysis across all development sessions
- ✅ **Efficient Monitoring**: Easy access to logs and debugging via container inspection
- ✅ **Resource Optimization**: Single Redis/Celery worker instance vs. separate backends per agent
- ✅ **Cross-Agent Communication**: All agents share the same analysis context

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Shared Metabob Backend                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐      ┌──────────────────┐                   │
│  │   Redis 7        │      │  Celery Worker   │                   │
│  │  (Cache/Queue)   │◄────►│  (Analysis)      │                   │
│  └────────┬─────────┘      └────────┬─────────┘                   │
│           │                          │                             │
│           └──────────────┬───────────┘                             │
│                          │                                          │
│                  ┌───────▼────────┐                               │
│                  │  FastAPI Server │ (api-server-dev:8080)        │
│                  │  Port: 80 (int) │                              │
│                  └────────────────┘                               │
│                  ▲ Shared by all agents                           │
└──────────────────┼────────────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────────┬──────────────┐
        │                     │              │              │
    ┌───▼──┐             ┌───▼──┐      ┌───▼──┐      ┌───▼──┐
    │Devbob│             │Devbob│      │Devbob│      │Devbob│
    │RPC-API              │CLI   │      │Web    │      │OpenCode
    │ACP:3001│             │ACP:3003│      │ACP:3002│      │ACP:3004│
    └───┬──┘             └───┬──┘      └───┬──┘      └───┬──┘
        │                     │              │              │
        │ (Backend Manager)   │              │              │
        └─────────────────────┴──────────────┴──────────────┘
                All agents connect to:
            http://api-server-dev:80
```

## Backend Services

### 1. Redis (Container: metabob-redis)
- **Purpose**: Task queue and cache for analysis jobs
- **Port**: 6379 (internal network)
- **Configuration**:
  - Max memory: 2GB with LRU eviction policy
  - Persistence: AOF (Append Only File)
  - Health check: redis-cli ping every 10s
- **Volume**: `metabob_redis_data:/data` (persistent)

### 2. Metabob RPC API Server (Container: api-server-dev)
- **Purpose**: FastAPI backend for code analysis
- **Ports**:
  - Internal: Port 80
  - External: Port 8080 (localhost:8080)
- **Connection String**: `http://api-server-dev:80` (internal to containers)
- **Configuration**:
  - LOG_LEVEL: DEBUG
  - Connects to Redis at `redis:6379`
  - Health check: HTTP GET /status every 30s
- **Volumes**:
  - `.env.docker` configuration file
  - `metrics/` directory for metrics collection
  - Logs mounted to `metabob_api_logs`

### 3. Celery Worker (Container: metabob-worker)
- **Purpose**: Background job processor for analysis tasks
- **Configuration**:
  - Single concurrent worker (-c 1) for stability
  - Solo pool (-P solo) for simplicity
  - DEBUG logging enabled
- **Connection**: Connects to Redis at `redis:6379`
- **Volume**: `metabob_worker_logs` for log persistence

## DevBob Agents Configuration

### Connection Settings (All Agents)
Each DevBob agent has identical backend connection configuration:

```yaml
METABOB_API_URL: http://api-server-dev:80
METABOB_PROJECT_ID: devbob-multi-agent
METABOB_API_KEY: ${METABOB_API_KEY:-}
WAIT_FOR_BACKEND: true
```

### All Agent ACP Ports
- **devbob-rpc-api**: Port 3001
- **devbob-dashboard**: Port 3002
- **devbob-cli**: Port 3003
- **devbob-opencode**: Port 3004

## Networking

### Network Names
```
Primary: devbob-network (devbob)
Backend: metabob-network (external, must exist)
```

### Network Access
- **Agents**: Connected to both `devbob` and `metabob-network`
- **Backend Services**: Connected to `metabob-network` only
- **Cross-Container**: Use container names (e.g., `http://api-server-dev:80`)
- **Host Access**: Use localhost with published ports (e.g., `http://localhost:8080`)

## Quick Start Commands

### Start Only Backend Services
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Start Redis and Metabob backend
docker-compose -f configs/docker-compose.devbob.yaml \
  --env-file .env.devbob \
  up -d redis metabob-rpc-api-server metabob-rpc-api-worker
```

### Start Backend + One DevBob Agent
```bash
# Backend + OpenCode agent (for local development)
docker-compose -f configs/docker-compose.devbob.yaml \
  --env-file .env.devbob \
  up -d metabob-rpc-api-server redis metabob-rpc-api-worker devbob-opencode
```

### Start All Services
```bash
docker-compose -f configs/docker-compose.devbob.yaml \
  --env-file .env.devbob \
  up -d
```

### View Logs
```bash
# Backend API server logs
docker logs -f api-server-dev

# Redis logs
docker logs -f metabob-redis

# Celery worker logs
docker logs -f metabob-worker

# OpenCode agent logs
docker logs -f devbob-opencode

# All logs with tail -f
docker-compose -f configs/docker-compose.devbob.yaml logs -f
```

### Test Connectivity
```bash
# Test backend API
curl http://localhost:8080/status

# Test from container (internal network)
docker exec devbob-opencode curl http://api-server-dev:80/status

# Check backend health
curl http://localhost:8080/health
```

### Stop and Clean
```bash
# Stop all containers
docker-compose -f configs/docker-compose.devbob.yaml \
  --env-file .env.devbob \
  down

# Stop and remove volumes (CAUTION - deletes data)
docker-compose -f configs/docker-compose.devbob.yaml \
  --env-file .env.devbob \
  down -v
```

## Backend Stability & Debugging

### Health Checks
All services have health checks configured:

```yaml
# Backend Server
Interval: 30s
Timeout: 10s
Retries: 5
Start Period: 30s

# Agents
Interval: 30s
Timeout: 10s
Retries: 5
Start Period: 120s
```

### Monitoring Backend Metrics

The backend exposes metrics at:
```
http://localhost:8080/metrics
```

Access container logs for detailed analysis:
```bash
# Get metrics from running backend
docker exec api-server-dev curl http://localhost:80/metrics

# Or from host
curl http://localhost:8080/metrics
```

### Common Issues & Solutions

#### 1. Redis Connection Error
```bash
# Problem: Backend can't connect to Redis
# Solution:
docker logs -f metabob-redis
# Check if Redis is healthy:
docker-compose -f configs/docker-compose.devbob.yaml ps redis
```

#### 2. Backend API Not Responding
```bash
# Check backend status
curl http://localhost:8080/status

# View backend logs
docker logs -f api-server-dev

# Verify network connectivity
docker exec api-server-dev nc -zv redis 6379
```

#### 3. Agent Can't Connect to Backend
```bash
# From inside agent container
docker exec devbob-opencode curl http://api-server-dev:80/status

# Check network
docker exec devbob-opencode ping api-server-dev

# View agent logs
docker logs -f devbob-opencode
```

#### 4. Celery Worker Not Processing Jobs
```bash
# Check worker logs
docker logs -f metabob-worker

# Verify worker is connected to Redis
docker exec metabob-redis redis-cli INFO stats

# Check task queue
docker exec metabob-redis redis-cli KEYS "*celery*"
```

## Environment Configuration

### Key Environment Variables (`.env.devbob`)

```ini
# Backend API
METABOB_API_URL=http://api-server-dev:80
METABOB_PROJECT_ID=devbob-multi-agent
METABOB_API_KEY=<your-api-key>

# Analysis Configuration
MAX_DOWNSTREAM_EFFECTS=50
MAX_SIMILAR_CHUNKS=20
MAX_TRANSITIVE_DEPTH=2

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379

# Backend Concurrency
API_WORKERS=4
CELERY_CONCURRENCY=4

# Logging
LOG_LEVEL=DEBUG
```

## Volume Management

### Shared Volumes (All Agents)
- `devbob_config`: Shared configuration across agents
- `devbob_auth`: Shared authentication data

### Backend Volumes
- `metabob_redis_data`: Redis persistent data
- `metabob_api_logs`: API server logs
- `metabob_worker_logs`: Celery worker logs

### Per-Agent Workspaces
- `devbob_rpc_api_workspace`: RPC-API agent repository
- `devbob_web_workspace`: Dashboard agent repository
- `devbob_cli_workspace`: CLI agent repository
- `devbob_opencode_workspace`: OpenCode agent repository

## Advanced Debugging

### Extract Backend Data for Analysis
```bash
# Export Redis data
docker exec metabob-redis redis-cli --rdb /data/backup.rdb

# Copy logs from container
docker cp metabob-worker:/opt/app/logs /tmp/metabob-logs

# Get API metrics
docker exec api-server-dev cat /opt/app/metrics/latest.json
```

### Database Inspection
```bash
# Connect to Redis CLI
docker exec -it metabob-redis redis-cli

# Common Redis commands:
# Check all keys
KEYS *

# Get memory stats
INFO memory

# Get analysis tasks
KEYS celery:*

# Check connected clients
CLIENT LIST
```

### Rebuilding Backend Without Agents
```bash
# Clean rebuild of just backend services
docker-compose -f configs/docker-compose.devbob.yaml \
  --env-file .env.devbob \
  down -v

docker-compose -f configs/docker-compose.devbob.yaml \
  --env-file .env.devbob \
  up -d redis metabob-rpc-api-server metabob-rpc-api-worker
```

## Stability Recommendations

1. **Always start backend first**: Dependencies ensure Redis → Worker → API order
2. **Monitor health checks**: Watch container health via `docker ps`
3. **Keep logs accessible**: Use volume mounts for persistent logs
4. **Single worker process**: `-c 1` ensures no race conditions
5. **Memory limits**: Redis maxmemory prevents OOM crashes
6. **Restart policy**: `unless-stopped` means manual control is required

## Next Steps

1. ✅ Review this configuration guide
2. Start backend services: `docker-compose up -d redis metabob-rpc-api-server metabob-rpc-api-worker`
3. Verify connectivity: `curl http://localhost:8080/status`
4. Start DevBob agents as needed
5. Monitor logs for issues: `docker-compose logs -f`
6. Debug with container inspection as needed

---

**Configuration File**: `/home/avi/documents/work/exp-repo/metabob-devbob/configs/docker-compose.devbob.yaml`  
**Environment File**: `/home/avi/documents/work/exp-repo/metabob-devbob/.env.devbob`
