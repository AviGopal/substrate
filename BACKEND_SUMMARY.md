# DevBob Shared Backend Architecture Summary

## Executive Summary

Your DevBob setup uses a **Shared Backend Architecture** where all development agents connect to a single, unified Metabob RPC-API backend instance. This provides:

- ✅ **Unified Analysis Context**: All agents operate from the same code baseline
- ✅ **Efficient Resource Usage**: One backend instance vs. separate backends per agent
- ✅ **Easy Debugging**: Centralized logging and metrics
- ✅ **Stable Development**: Consistent analysis across all sessions
- ✅ **Cross-Agent Communication**: Agents can compare findings and coordinate

## What You Have

### Backend Services (3 components)
```
┌────────────────────────────────────────┐
│  Redis 7 (Port 6379)                   │
│  • Cache and task queue                │
│  • Persistent storage (/data volume)   │
│  • 2GB max memory with LRU eviction    │
└────────────────┬───────────────────────┘
                 │
┌────────────────▼───────────────────────┐
│  FastAPI Server (Port 8080 external)   │
│  • Code analysis backend                │
│  • Health check: /status endpoint      │
│  • Metrics collection enabled          │
└────────────────┬───────────────────────┘
                 │
┌────────────────▼───────────────────────┐
│  Celery Worker                          │
│  • Processes analysis jobs             │
│  • Single concurrent worker (stable)   │
│  • DEBUG logging enabled               │
└─────────────────────────────────────────┘
```

### DevBob Agents (4 containers)
Each agent connects to the shared backend above:

| Agent | Port | Role | Status |
|-------|------|------|--------|
| **devbob-opencode** | 3004 | OpenCode development | ✅ Running |
| **devbob-rpc-api** | 3001 | RPC-API codebase | ⚠️ Can start |
| **devbob-cli** | 3003 | CLI codebase | ⚠️ Can start |
| **devbob-dashboard** | 3002 | Web/Dashboard codebase | ⚠️ Can start |

## Key Features

### 1. Single Backend Instance
```
Shared Backend (1 instance)
    ↑     ↑     ↑     ↑
    |     |     |     |
Agent1  Agent2 Agent3 Agent4

Advantages:
• Lower resource overhead (single Redis, single API server)
• Consistent analysis baseline
• Unified metrics and monitoring
• Simpler debugging and log analysis
```

### 2. Network Architecture
```
Networks:
├── devbob-network     (bridge) - For agent-to-agent communication
└── metabob-network    (bridge) - For backend services

Internal DNS:
├── redis              → redis:6379
├── metabob-rpc-api-server → http://api-server-dev:80
├── devbob-opencode    → port 3004
└── devbob-rpc-api     → port 3001
```

### 3. Data Persistence
All important data is persisted via Docker volumes:
- **Redis data**: `metabob_redis_data` - persistent across restarts
- **API logs**: `metabob_api_logs` - for debugging analysis
- **Worker logs**: `metabob_worker_logs` - for job processing
- **Agent workspaces**: Per-agent repositories and state

### 4. Health & Monitoring
```
Health Checks (Every 30 seconds):
├── Redis: redis-cli ping
├── API Server: HTTP GET /status
├── Agents: HTTP GET /config
└── Auto-restart on failure (unless-stopped policy)
```

## How It Works

### Agent to Backend Communication
```
1. Agent starts
   ↓
2. Reads METABOB_API_URL = http://api-server-dev:80
   ↓
3. Waits for backend to be healthy (WAIT_FOR_BACKEND=true)
   ↓
4. Connects and begins analysis
   ↓
5. All analysis results stored in shared Redis
   ↓
6. Shared context available to all agents
```

### Analysis Job Flow
```
Agent Request
    ↓
API Server (validates request)
    ↓
Redis (queues job)
    ↓
Celery Worker (processes job)
    ↓
Redis (stores results)
    ↓
API Server (retrieves results)
    ↓
Agent (receives analysis)
```

## Getting Started

### Option 1: Automated Startup (Recommended)
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./START_BACKEND.sh
```
This script:
1. Validates configuration
2. Creates necessary networks
3. Starts backend services
4. Waits for health checks
5. Shows status and next steps

### Option 2: Manual Startup
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Start backend only
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob \
  up -d redis metabob-rpc-api-server metabob-rpc-api-worker

# Wait ~30 seconds...

# Verify backend is running
curl http://localhost:8080/status

# Start one or more agents
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob \
  up -d devbob-opencode devbob-cli
```

## Configuration

### Environment Variables (`.env.devbob`)
```ini
# Backend Connection (all agents use these)
METABOB_API_URL=http://api-server-dev:80
METABOB_PROJECT_ID=devbob-multi-agent
METABOB_API_KEY=<your-key-if-needed>

# LLM Provider
ANTHROPIC_API_KEY=<your-api-key>

# Logging
LOG_LEVEL=DEBUG

# Performance
API_WORKERS=4
CELERY_CONCURRENCY=4
```

### Docker Compose Services
File: `configs/docker-compose.devbob.yaml`

Defines:
- `redis` - cache and queue
- `metabob-rpc-api-server` - analysis backend
- `metabob-rpc-api-worker` - job processor
- `devbob-rpc-api` - agent for RPC-API
- `devbob-opencode` - agent for OpenCode
- `devbob-cli` - agent for CLI
- `devbob-dashboard` - agent for Dashboard

## Port Mapping

| External | Internal | Service |
|----------|----------|---------|
| 8080 | 80 | Backend API |
| 6379 | 6379 | Redis |
| 3001 | 3001 | devbob-rpc-api (ACP) |
| 3002 | 3002 | devbob-dashboard (ACP) |
| 3003 | 3003 | devbob-cli (ACP) |
| 3004 | 3000 | devbob-opencode (ACP) |

## Monitoring & Debugging

### Quick Health Check
```bash
# Backend status
curl http://localhost:8080/status

# From agent container
docker exec devbob-opencode curl http://api-server-dev:80/status

# Redis health
docker exec metabob-redis redis-cli ping
```

### View Logs
```bash
# All services
docker-compose -f configs/docker-compose.devbob.yaml logs -f

# Specific service
docker logs -f api-server-dev
docker logs -f metabob-worker
docker logs -f devbob-opencode
```

### Container Status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Common Operations

### Start Everything
```bash
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob up -d
```

### Stop Everything
```bash
docker-compose -f configs/docker-compose.devbob.yaml down
```

### Restart Backend
```bash
docker-compose -f configs/docker-compose.devbob.yaml restart \
  redis metabob-rpc-api-server metabob-rpc-api-worker
```

### Add a New Agent
```bash
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob \
  up -d devbob-cli
```

### Clean Full Rebuild
```bash
# Stop and remove volumes
docker-compose -f configs/docker-compose.devbob.yaml down -v

# Start fresh
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob up -d
```

## Troubleshooting

### Backend Not Starting
```bash
# Check if Redis is healthy
docker logs metabob-redis | tail -20

# Verify network exists
docker network ls | grep metabob-network

# Check port conflicts
lsof -i :8080 :6379
```

### Agent Can't Connect
```bash
# Test from agent
docker exec devbob-opencode curl http://api-server-dev:80/status

# Check agent logs
docker logs devbob-opencode | grep -i "error\|connection"

# Verify backend URL
docker inspect devbob-opencode | grep METABOB_API_URL
```

### High Memory Usage
```bash
# Check Redis memory
docker exec metabob-redis redis-cli INFO memory

# View all containers' resource usage
docker stats --no-stream
```

## Best Practices

1. **Always start backend first**: Agents depend on it being healthy
2. **Monitor health checks**: They catch problems early
3. **Keep logs accessible**: Use volume mounts for persistence
4. **Single worker process**: `-c 1` prevents race conditions
5. **Regular backups**: Especially Redis data
6. **Use environment file**: Keeps configuration centralized

## Documentation Files

| File | Purpose |
|------|---------|
| `DEVBOB_BACKEND_CONFIGURATION_GUIDE.md` | Comprehensive setup guide with architecture details |
| `DEVBOB_QUICK_REFERENCE.md` | Command reference and troubleshooting |
| `BACKEND_SETUP_STATUS.md` | Current status and detailed diagnostics |
| `START_BACKEND.sh` | Automated startup script (recommended) |
| `verify-devbob-backend.sh` | Configuration verification script |

## Benefits of This Architecture

### For Development
- All agents share the same code understanding
- No sync issues between agents
- Consistent analysis results

### For Operations
- Single service to monitor
- Easier debugging and troubleshooting
- Lower resource overhead
- Simpler scaling (upgrade backend, not agents)

### For Stability
- Centralized health monitoring
- Consistent dependency management
- Automatic restart on failure
- Persistent data across restarts

## Current Status

✅ Configuration Files Ready  
✅ Docker Networks Created  
✅ Environment Configured  
⚠️ Backend Services Ready to Start  
✅ Agents Ready to Connect  

## Next Steps

1. **Start Backend**: Run `./START_BACKEND.sh` or use manual commands
2. **Verify Connectivity**: `curl http://localhost:8080/status`
3. **Start Agents**: Add agents as needed (all use same backend)
4. **Monitor Operations**: Use `docker logs -f` for each service
5. **Debug Issues**: Refer to troubleshooting guides above

---

## Quick Command Reference

```bash
# Navigate to project
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Start backend (automated)
./START_BACKEND.sh

# Start backend (manual)
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob \
  up -d redis metabob-rpc-api-server metabob-rpc-api-worker

# Verify backend running
curl http://localhost:8080/status

# Start all agents
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob up -d

# View status
docker-compose -f configs/docker-compose.devbob.yaml ps

# Follow logs
docker-compose -f configs/docker-compose.devbob.yaml logs -f

# Stop everything
docker-compose -f configs/docker-compose.devbob.yaml down
```

---

**Location**: `/home/avi/documents/work/exp-repo/metabob-devbob`  
**Configuration**: `configs/docker-compose.devbob.yaml`  
**Environment**: `.env.devbob`  
**Last Updated**: 2026-01-30
