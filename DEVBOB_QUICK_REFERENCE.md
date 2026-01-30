# DevBob Backend Quick Reference

## Core Architecture
```
Your Setup: Shared Backend Model
┌─────────────────────────────────┐
│  Metabob RPC-API Backend        │
│  (Redis + FastAPI + Celery)     │
│  Port: 8080 (external)          │
└─────────────┬───────────────────┘
              │
    ┌─────────┼──────────┬──────────┬────────────┐
    ▼         ▼          ▼          ▼            ▼
 RPC-API   CLI       Web        OpenCode    (Future)
 :3001    :3003     :3002        :3004
```

## Essential Commands

### Backend Status
```bash
# Check if backend is running
curl http://localhost:8080/status

# View backend logs
docker logs -f api-server-dev

# Check Redis connection
docker exec metabob-redis redis-cli ping

# View Celery worker status
docker logs -f metabob-worker
```

### Start/Stop Services

#### Start Everything
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob up -d
```

#### Start Only Backend (Recommended First)
```bash
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob \
  up -d redis metabob-rpc-api-server metabob-rpc-api-worker
```

#### Start Backend + One Agent
```bash
# Add devbob-opencode to the backend
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob \
  up -d redis metabob-rpc-api-server metabob-rpc-api-worker devbob-opencode
```

#### Stop All
```bash
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob down
```

### Monitoring Logs

```bash
# Follow all service logs
docker-compose -f configs/docker-compose.devbob.yaml logs -f

# Specific service logs
docker logs -f api-server-dev          # Backend API
docker logs -f metabob-redis           # Redis
docker logs -f metabob-worker          # Celery worker
docker logs -f devbob-opencode         # OpenCode agent
docker logs -f devbob-cli              # CLI agent
docker logs -f devbob-dashboard        # Web agent
docker logs -f devbob-rpc-api          # RPC-API agent

# Follow with timestamps
docker logs -f --timestamps api-server-dev
```

### Container Management

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Get container health status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Inspect container details
docker inspect api-server-dev

# Execute command inside container
docker exec devbob-opencode curl http://api-server-dev:80/status

# Access container shell (for debugging)
docker exec -it metabob-redis sh
```

### Data & Volume Management

```bash
# List volumes
docker volume ls | grep devbob

# Inspect a volume
docker volume inspect metabob_redis_data

# See what files are in a volume
docker run --rm -v metabob_redis_data:/data alpine ls -la /data

# Backup Redis data
docker exec metabob-redis redis-cli SAVE
docker cp metabob-redis:/data/dump.rdb ./redis-backup.rdb

# Restore Redis from backup
docker cp ./redis-backup.rdb metabob-redis:/data/dump.rdb
docker restart metabob-redis
```

## Debugging Common Issues

### Backend Not Starting

```bash
# 1. Check if Redis is healthy
docker-compose -f configs/docker-compose.devbob.yaml ps redis

# 2. View Redis logs
docker logs metabob-redis

# 3. Verify network exists
docker network ls | grep metabob-network

# 4. Check if port 8080 is available
lsof -i :8080

# 5. Check dependencies
docker-compose -f configs/docker-compose.devbob.yaml config | grep -A 5 "depends_on"
```

### Agent Can't Connect to Backend

```bash
# 1. Test from container
docker exec devbob-opencode curl http://api-server-dev:80/status

# 2. Check network connectivity
docker exec devbob-opencode ping api-server-dev

# 3. Verify backend URL in agent config
docker inspect devbob-opencode | grep METABOB_API_URL

# 4. Check agent logs
docker logs devbob-opencode | grep -i "connection\|error\|backend"
```

### High Memory Usage

```bash
# Check container resource usage
docker stats

# Limit Redis memory
docker exec metabob-redis redis-cli CONFIG SET maxmemory 2gb

# Check Redis memory status
docker exec metabob-redis redis-cli INFO memory
```

### Celery Worker Not Processing Jobs

```bash
# Check worker status
docker logs -f metabob-worker

# Check Redis queue
docker exec metabob-redis redis-cli DBSIZE

# List pending tasks
docker exec metabob-redis redis-cli KEYS "celery:*"

# Restart worker
docker restart metabob-worker
```

## Network Debugging

```bash
# List all networks
docker network ls

# Inspect network details
docker network inspect devbob-network

# Test connectivity between containers
docker exec devbob-opencode ping metabob-redis
docker exec devbob-opencode nslookup api-server-dev
docker exec devbob-opencode wget -O- http://api-server-dev:80/status
```

## Cleanup & Maintenance

```bash
# Remove dangling volumes (CAUTION!)
docker volume prune

# Remove stopped containers
docker container prune

# Full cleanup (CAUTION - removes all dangling resources)
docker system prune

# Deep clean - remove everything related to devbob
docker-compose -f configs/docker-compose.devbob.yaml down -v --remove-orphans
```

## Port Reference

| Service | Port | Purpose |
|---------|------|---------|
| Backend API | 8080 | HTTP API (external) |
| Redis | 6379 | Cache/Queue |
| devbob-rpc-api | 3001 | ACP (Agent Protocol) |
| devbob-dashboard | 3002 | ACP |
| devbob-cli | 3003 | ACP |
| devbob-opencode | 3004 | ACP |

## Environment Variables (Key for Backend)

```ini
# Connection
METABOB_API_URL=http://api-server-dev:80
METABOB_PROJECT_ID=devbob-multi-agent

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Logging
LOG_LEVEL=DEBUG

# Performance
API_WORKERS=4
CELERY_CONCURRENCY=4
```

## Troubleshooting Checklist

- [ ] Redis is running and healthy: `docker ps | grep metabob-redis`
- [ ] Backend API is responding: `curl http://localhost:8080/status`
- [ ] Networks exist: `docker network ls | grep devbob`
- [ ] All containers on same network: `docker inspect devbob-opencode | grep Networks -A 10`
- [ ] No port conflicts: `lsof -i :8080 :3001 :3002 :3003 :3004`
- [ ] Enough disk space: `df -h`
- [ ] Environment file is being used: `docker logs api-server-dev | grep "CONFIG_PATH"`

## Performance Tips

1. **Single Celery worker** (`-c 1`) prevents race conditions
2. **Redis LRU eviction** keeps memory bounded
3. **Health checks every 30s** catch failures quickly
4. **Restart policy `unless-stopped`** gives manual control
5. **Check logs regularly** to catch issues early

---

**See Also**: `DEVBOB_BACKEND_CONFIGURATION_GUIDE.md` for detailed configuration
