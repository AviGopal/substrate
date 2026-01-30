# DevBob Quick Reference Card

**Use this as your go-to cheat sheet for DevBob operations.**

---

## 🚀 Essential Commands

```bash
# Start everything (backend + all agents)
./devbob start

# Check status
./devbob status

# Verify health
./scripts/verify-devbob.sh

# View logs
./devbob logs <container-name>

# Stop everything
./devbob stop

# Rebuild image
./scripts/build-devbob.sh
```

---

## 📦 Container Architecture

### Backend Services (3)
- **metabob-redis** - Port 6379
- **api-server-dev** - Port 8080
- **metabob-worker** - Celery worker

### Agent Containers (4)
- **devbob-rpc-api** - Port 3001 (ACP), 8081 (MCP)
- **devbob-dashboard** - Port 3002 (ACP), 8082 (MCP)
- **devbob-cli** - Port 3003 (ACP), 8083 (MCP)
- **devbob-opencode** - Port 3004 (ACP), 8084 (MCP)

---

## 🔗 Service Endpoints

### Backend
```bash
# API status
curl http://localhost:8080/status

# Redis ping
docker exec metabob-redis redis-cli ping
```

### Agents (External)
```bash
# Agent configs
curl http://localhost:3001/config  # rpc-api
curl http://localhost:3002/config  # dashboard
curl http://localhost:3003/config  # cli
curl http://localhost:3004/config  # opencode
```

### Internal (Container → Backend)
```bash
# From inside containers
http://api-server-dev:80/status
```

---

## 📂 Repository Configuration

| Agent | Repository |
|-------|------------|
| devbob-rpc-api | metabobproject/metabob-rpc-api |
| devbob-dashboard | metabobproject/web |
| devbob-cli | metabobproject/metabob-cli |
| devbob-opencode | avigopal/opencode |

**Note**: Dashboard service uses the `web` repository (intentional naming mismatch).

---

## 🔍 Common Checks

### Container Status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### Logs
```bash
# Specific container
docker logs devbob-opencode

# Follow logs
docker logs -f devbob-opencode

# Last 50 lines
docker logs --tail 50 devbob-opencode
```

### Repository Status
```bash
# Check if repo cloned
docker exec devbob-dashboard ls -la /workspace

# Check git branch
docker exec devbob-dashboard sh -c "cd /workspace && git branch"
```

---

## 🛠️ Troubleshooting

### Container Won't Start
```bash
# View logs
docker logs <container-name>

# Restart
./devbob restart <container-name>

# Rebuild image
./scripts/build-devbob.sh
./devbob start
```

### Backend Not Responding
```bash
# Check backend health
curl http://localhost:8080/status

# Check backend logs
docker logs api-server-dev

# Restart backend
./devbob restart api-server-dev
```

### Agent Can't Reach Backend
```bash
# Test internal connectivity
docker exec devbob-opencode curl http://api-server-dev:80/status

# Check network
docker network ls | grep metabob

# Check environment
docker exec devbob-opencode env | grep METABOB_API_URL
```

### Repository Not Cloned
```bash
# Check SSH keys
docker exec devbob-rpc-api ls -la /root/.ssh/

# Check environment
docker exec devbob-rpc-api env | grep REPO

# Manual clone
docker exec -it devbob-rpc-api sh
cd /workspace
git clone $REPO_URL .
```

---

## 📝 Configuration Files

### Primary
- `configs/docker-compose.devbob.yaml` - Service definitions
- `.env.devbob` - Environment variables
- `repos/metabob-rpc-api/.env.docker` - Backend config
- `./devbob` - CLI script

### Documentation
- `STATUS.md` - Current state
- `VERIFICATION_CHECKLIST.md` - Health checks
- `QUICK_REFERENCE.md` - This file
- `INDEX.md` - Full documentation index

---

## 🎯 Quick Tests

### Backend Health
```bash
curl -s http://localhost:8080/status | jq
```

### All Agent Endpoints
```bash
for port in 3001 3002 3003 3004; do
  echo "Port $port:"
  curl -s http://localhost:$port/config | jq '.codebase_name'
done
```

### Internal Connectivity
```bash
docker exec devbob-opencode curl -s http://api-server-dev:80/status | jq
```

### Repository Check
```bash
for agent in devbob-rpc-api devbob-dashboard devbob-cli devbob-opencode; do
  echo "=== $agent ==="
  docker exec $agent sh -c "cd /workspace && git remote -v | head -1"
done
```

---

## 💡 Pro Tips

### Start Fresh
```bash
# Stop everything
./devbob stop

# Remove volumes (warning: loses data)
docker volume rm $(docker volume ls -q | grep devbob)

# Start again (will re-clone repos)
./devbob start
```

### Watch Logs
```bash
# All containers
docker-compose -f configs/docker-compose.devbob.yaml logs -f

# Specific service
docker logs -f devbob-opencode
```

### Execute Commands in Container
```bash
# Interactive shell
docker exec -it devbob-opencode sh

# One-off command
docker exec devbob-opencode ls -la /workspace
```

### Check Resource Usage
```bash
docker stats --no-stream
```

---

## 📊 Environment Variables

### Key Variables in .env.devbob
```bash
# Repositories
DEVBOB_RPC_API_REPO=git@github.com:metabobproject/metabob-rpc-api.git
DEVBOB_WEB_REPO=git@github.com:metabobproject/web.git
DEVBOB_CLI_REPO=git@github.com:metabobproject/metabob-cli.git
DEVBOB_OPENCODE_REPO=git@github.com:avigopal/opencode.git

# LLM Keys
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...

# Backend
METABOB_API_URL=http://api-server-dev:80
METABOB_PROJECT_ID=devbob-multi-agent
```

---

## 🔄 Typical Workflow

### First Time Setup
```bash
1. ./scripts/build-devbob.sh              # Build image
2. ./devbob start                         # Start all services
3. ./scripts/verify-devbob.sh             # Verify health
4. docker logs devbob-opencode            # Check logs
```

### Daily Use
```bash
./devbob start                            # Start
./scripts/verify-devbob.sh                # Quick check
# ... do your work ...
./devbob logs <agent>                     # Check logs if needed
./devbob stop                             # Stop when done
```

### Debugging Issues
```bash
./devbob status                           # See what's running
docker logs <container>                   # Check logs
curl http://localhost:8080/status         # Test backend
./scripts/verify-devbob.sh                # Run all checks
```

---

## 📚 More Information

- **Full docs**: See `INDEX.md`
- **Current status**: See `STATUS.md`
- **Health checks**: See `VERIFICATION_CHECKLIST.md`
- **Architecture**: See `docs/SELF_HEALING_DEVBOB_ARCHITECTURE.md`

---

**Last Updated**: 2026-01-27  
**Quick help**: `./devbob --help`
