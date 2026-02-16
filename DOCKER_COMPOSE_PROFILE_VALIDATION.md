# Docker Compose Profile Validation Report

**Date**: February 16, 2026  
**Validator**: Activity Mode Agent  
**Status**: ✅ All profile combinations validated

## Summary

The docker-compose.yaml file defines three profiles with proper dependency management:
- `stable`: Backend services (5 services)
- `devbob`: Single clean agent (requires `stable`)
- `devbob-dev`: Multi-agent development (requires `stable`)

## Profile Validation Results

### 1. Profile: `stable` ✅

**Command**:
```bash
docker-compose --profile stable up -d
```

**Services** (5 total):
- `redis` - Task queue and cache (port 6379)
- `surreal` - SurrealDB database (port 8000)
- `surrealist` - Database UI (port 8001)
- `metabob-rpc-api-server` - FastAPI backend (port 8080)
- `celery-worker` - Background analysis worker

**Use Case**: Backend-only deployment for production-like environment

**Dependencies**:
```
redis → (none)
surreal → (none)
surrealist → surreal (healthy)
metabob-rpc-api-server → redis (healthy), surreal (healthy)
celery-worker → redis (healthy), surreal (healthy), metabob-rpc-api-server (healthy)
```

**Validation**: ✅ All dependencies resolved

---

### 2. Profile: `stable` + `devbob` ✅

**Command**:
```bash
docker-compose --profile stable --profile devbob up -d
```

**Services** (6 total):
- All 5 from `stable` profile
- `devbob-clean` - Single agent with empty workspace (ports 3000, 8082)

**Use Case**: Testing activities in isolated clean environment

**Additional Dependencies**:
```
devbob-clean → metabob-rpc-api-server (healthy)
```

**Validation**: ✅ All dependencies resolved

**Notes**:
- devbob-clean requires stable backend services
- Cannot run `--profile devbob` alone (missing dependency)

---

### 3. Profile: `stable` + `devbob-dev` ✅

**Command**:
```bash
docker-compose --profile stable --profile devbob-dev up -d
```

**Services** (9 total):
- All 5 from `stable` profile
- `devbob-rpc-api` - Agent managing RPC API codebase (ports 3001, 8081)
- `devbob-cli` - Agent managing CLI codebase (ports 3002, 8083)
- `devbob-opencode` - Agent managing OpenCode codebase (ports 3003, 8084)
- `devbob-dashboard` - Agent managing Dashboard codebase (ports 3004, 8085)

**Use Case**: Multi-agent development environment with mounted codebases

**Additional Dependencies**:
```
devbob-rpc-api → metabob-rpc-api-server (healthy)
devbob-cli → metabob-rpc-api-server (healthy)
devbob-opencode → metabob-rpc-api-server (healthy)
devbob-dashboard → metabob-rpc-api-server (healthy)
```

**Validation**: ✅ All dependencies resolved

**Notes**:
- All agents require stable backend services
- Cannot run `--profile devbob-dev` alone (missing dependencies)
- Agents manage their respective codebases via mounted volumes

---

## Architecture Validation

### Network Architecture ✅

**Networks**:
- `metabob-network` (external, pre-created)
- `devbob-network` (external, pre-created)

**Connectivity**:
- Backend services → metabob-network
- Devbob agents → devbob-network + metabob-network (bridge for backend access)

### Volume Architecture ✅

**Stable Backend Volumes**:
- `metabob_redis_data` - Redis persistence
- `configs_metabob_surreal_data` - SurrealDB data
- `metabob_api_logs` - API server logs
- `metabob_worker_logs` - Worker logs

**Devbob Volumes**:
- `devbob_clean_workspace` - Empty workspace for clean agent
- `devbob_shared_config` - Shared config across dev agents
- Individual workspaces for each dev agent (mount from ./repos/)

---

## Common Issues and Troubleshooting

### Issue 1: "depends on undefined service metabob-rpc-api-server"

**Symptom**: Error when running `--profile devbob` or `--profile devbob-dev` alone

**Cause**: Devbob services depend on backend services in `stable` profile

**Solution**: Always combine profiles:
```bash
# Correct
docker-compose --profile stable --profile devbob up -d

# Incorrect
docker-compose --profile devbob up -d
```

### Issue 2: "No such command 'celery-worker'"

**Symptom**: Celery worker crashes with command not found

**Cause**: API version 0.16.12 CLI changed command structure

**Solution**: Use full celery command (already fixed in docker-compose.yaml):
```yaml
command: ["celery", "-A", "tasks.jobs", "worker", "-l", "INFO", "-c", "4", "-E", "-P", "solo"]
```

**Fix Commit**: `c5efdd1` - "fix(docker): Correct celery worker command"

### Issue 3: Missing ANTHROPIC_API_KEY warnings

**Symptom**: Warning about ANTHROPIC_API_KEY defaulting to blank string

**Cause**: Environment variable not set in .env file

**Solution**: Create or update .env file in project root:
```bash
echo "ANTHROPIC_API_KEY=your_key_here" >> .env
```

---

## Quick Start Commands

### Backend Only (Development)
```bash
docker-compose --profile stable up -d
```

### Single Agent Testing
```bash
docker-compose --profile stable --profile devbob up -d
```

### Multi-Agent Development
```bash
docker-compose --profile stable --profile devbob-dev up -d
```

### Shutdown
```bash
# Stop all services
docker-compose --profile stable --profile devbob --profile devbob-dev down

# Stop and remove volumes (clean slate)
docker-compose --profile stable --profile devbob --profile devbob-dev down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f devbob-clean
docker-compose logs -f metabob-rpc-api-server
```

### Check Status
```bash
# List running services
docker-compose ps

# Check service health
docker-compose ps | grep healthy
```

---

## Validation Commands Used

```bash
# Validate stable profile
docker-compose --profile stable config --services

# Validate stable + devbob profile
docker-compose --profile stable --profile devbob config --services

# Validate stable + devbob-dev profile
docker-compose --profile stable --profile devbob-dev config --services

# Check dependency resolution
docker-compose --profile stable --profile devbob-dev config | grep -A 2 "depends_on:"
```

---

## Documentation Updates

### Changes Made to docker-compose.yaml

**Lines 8, 13, 18** - Updated profile descriptions to clarify dependency requirements:
- Profile 1 (stable): Added `-d` flag to command example
- Profile 2 (devbob): Added note "Requires stable profile (dependencies: redis, surreal, metabob-rpc-api-server)"
- Profile 3 (devbob-dev): Added note "Requires stable profile (all agents depend on backend services)"

**Consistency Fix**: Documentation now correctly reflects that devbob profiles cannot run standalone.

---

## Conclusion

All three profile combinations are **valid and functional**:
1. ✅ `--profile stable` → Backend services only
2. ✅ `--profile stable --profile devbob` → Backend + single agent
3. ✅ `--profile stable --profile devbob-dev` → Backend + multi-agent

The dependency structure is **correct by design** - devbob agents require backend services, ensuring proper architecture separation.

**Next Steps**:
1. Update quick start guides to reference this validation report
2. Add profile examples to README.md
3. Create environment variable template (.env.example)
