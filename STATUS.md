# DevBob Environment Status

**Last Updated**: 2026-01-27

## Architecture Overview

### Backend Services (3 containers)
- **redis** (port 6379) - Task queue and cache
- **metabob-rpc-api-server** (port 8080) - FastAPI backend
- **metabob-rpc-api-worker** - Celery analysis worker

### Agent Containers (4 containers)
- **devbob-rpc-api** (port 3001) - Manages backend + metabob-rpc-api codebase
- **devbob-dashboard** (port 3002) - Web/dashboard frontend codebase
- **devbob-cli** (port 3003) - CLI tools codebase
- **devbob-opencode** (port 3004) - OpenCode platform codebase

## Repository Configuration

| Agent | Codebase Name | Repository | Branch |
|-------|---------------|------------|--------|
| devbob-rpc-api | rpc-api | metabobproject/metabob-rpc-api | main |
| devbob-dashboard | dashboard | metabobproject/web | main |
| devbob-cli | cli | metabobproject/metabob-cli | main |
| devbob-opencode | opencode | avigopal/opencode | feat/activity-execution-fixes |

**Note**: The dashboard agent uses the `web` repository (naming mismatch is intentional).

## Quick Start

```bash
# Start everything (backend + all agents)
./devbob start

# Check status
./devbob status

# View logs
./devbob logs [service-name]

# Stop everything
./devbob stop
```

## Service Endpoints

### Backend
- API Status: http://localhost:8080/status
- Redis: localhost:6379

### Agents (ACP)
- devbob-rpc-api: http://localhost:3001/config
- devbob-dashboard: http://localhost:3002/config
- devbob-cli: http://localhost:3003/config
- devbob-opencode: http://localhost:3004/config

### Agents (MCP)
- devbob-rpc-api: http://localhost:8081
- devbob-dashboard: http://localhost:8082
- devbob-cli: http://localhost:8083
- devbob-opencode: http://localhost:8084

## Configuration Files

- **configs/docker-compose.devbob.yaml** - All service definitions
- **.env.devbob** - Environment variables and repo URLs
- **repos/metabob-rpc-api/.env.docker** - Backend service configuration
- **./devbob** - Main CLI script

## Recent Changes

### 2026-01-27: Backend Integration Complete
- ✅ Integrated 3 backend services (redis, server, worker)
- ✅ All agents connect to `http://api-server-dev:80`
- ✅ Added service health checks and dependencies
- ✅ Simplified workflow to single `./devbob start` command
- ✅ Repository URLs configured for all agents
- ✅ Confirmed naming: `devbob-dashboard` service uses `web` repository

### Issues Resolved
- ✅ Agent timeout issue (backend was missing)
- ✅ DNS SERVFAIL errors (proper service names)
- ✅ Memory growth from retries (backend now available)

## Next Steps

1. **Test the environment**:
   ```bash
   ./devbob stop
   ./devbob start
   ./devbob status
   ```

2. **Verify repositories are cloned**:
   ```bash
   docker exec devbob-rpc-api ls -la /workspace
   docker exec devbob-dashboard ls -la /workspace
   docker exec devbob-cli ls -la /workspace
   docker exec devbob-opencode ls -la /workspace
   ```

3. **Test backend connectivity**:
   ```bash
   curl http://localhost:8080/status
   curl http://localhost:3001/config
   ```

4. **Begin dogfooding workflow** (see QUICK_START.md)
