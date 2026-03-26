# Quick Start: Docker Compose Profiles

**Last Updated**: February 16, 2026  
**Status**: ✅ Validated  
**Full Details**: See `DOCKER_COMPOSE_PROFILE_VALIDATION.md`

## TL;DR - Copy-Paste Commands

### Option 1: Backend Services Only
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker-compose --profile stable up -d
```
**What you get**: Redis, SurrealDB, API server, Celery worker (5 services)  
**Use for**: Testing backend APIs, development without agents

---

### Option 2: Backend + Single Test Agent
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker-compose --profile stable --profile devbob up -d
```
**What you get**: Backend (5) + devbob-clean agent (1) = 6 services  
**Use for**: Testing activities in clean isolated environment  
**Agent Access**: http://localhost:3000 (ACP), http://localhost:8082 (MCP)

---

### Option 3: Backend + Multi-Agent Development
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker-compose --profile stable --profile devbob-dev up -d
```
**What you get**: Backend (5) + 4 agents (rpc-api, cli, opencode, dashboard) = 9 services  
**Use for**: Self-healing multi-agent development environment  
**Agent Access**:
- devbob-rpc-api: http://localhost:3001 (ACP)
- devbob-cli: http://localhost:3002 (ACP)
- devbob-opencode: http://localhost:3003 (ACP)
- devbob-dashboard: http://localhost:3004 (ACP)

---

## Common Commands

### Check What's Running
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f devbob-clean
docker-compose logs -f metabob-rpc-api-server
```

### Stop Everything
```bash
# Stop (preserve data)
docker-compose --profile stable --profile devbob --profile devbob-dev down

# Stop and remove volumes (clean slate)
docker-compose --profile stable --profile devbob --profile devbob-dev down -v
```

### Health Check
```bash
# Backend health
curl http://localhost:8080/health

# Agent health (devbob-clean)
curl http://localhost:3000/config
```

---

## Before You Start

### Required Environment Variables

Create `.env` file in project root:
```bash
# Required
ANTHROPIC_API_KEY=your_anthropic_key_here
METABOB_API_KEY=your_metabob_key_here

# Optional (defaults shown)
API_VERSION=0.16.12
DEVBOB_VERSION=latest
LOG_LEVEL=INFO
```

### Required Networks

Create external networks (one-time setup):
```bash
docker network create metabob-network
docker network create devbob-network
```

---

## Profile Decision Tree

```
Do you need agents?
├─ NO → Use: --profile stable
│        (Backend services only)
│
└─ YES → What kind of agents?
         ├─ Single clean agent for testing
         │  → Use: --profile stable --profile devbob
         │
         └─ Multiple agents managing codebases
            → Use: --profile stable --profile devbob-dev
```

---

## Troubleshooting

### Error: "depends on undefined service metabob-rpc-api-server"

**Cause**: Tried to run devbob/devbob-dev without stable profile  
**Fix**: Always include `--profile stable` when using agent profiles

```bash
# Wrong
docker-compose --profile devbob up

# Right
docker-compose --profile stable --profile devbob up -d
```

---

### Error: "No such command 'celery-worker'"

**Cause**: Old docker-compose.yaml (before commit c5efdd1)  
**Fix**: Pull latest changes

```bash
git pull
docker-compose --profile stable up -d --build
```

---

### Warning: "ANTHROPIC_API_KEY variable is not set"

**Cause**: Missing .env file  
**Fix**: Create .env file with required keys

```bash
cat > .env << 'ENVEOF'
ANTHROPIC_API_KEY=your_key_here
METABOB_API_KEY=your_key_here
ENVEOF
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Profile: stable (Backend Services)                          │
├─────────────────────────────────────────────────────────────┤
│ • redis (6379)                  - Task queue & cache        │
│ • surreal (8000)                - Database                  │
│ • surrealist (8001)             - Database UI               │
│ • metabob-rpc-api-server (8080) - FastAPI backend           │
│ • celery-worker                 - Analysis worker           │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ (depends on)
                            │
┌─────────────────────────────────────────────────────────────┐
│ Profile: devbob (Single Agent)                              │
├─────────────────────────────────────────────────────────────┤
│ • devbob-clean (3000, 8082)     - Test agent, empty workspace│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Profile: devbob-dev (Multi-Agent Development)               │
├─────────────────────────────────────────────────────────────┤
│ • devbob-rpc-api (3001)         - Manages RPC API codebase │
│ • devbob-cli (3002)             - Manages CLI codebase     │
│ • devbob-opencode (3003)        - Manages OpenCode codebase│
│ • devbob-dashboard (3004)       - Manages Dashboard        │
└─────────────────────────────────────────────────────────────┘
```

---

## Port Reference

| Service                   | Port(s)      | Purpose                |
|---------------------------|--------------|------------------------|
| redis                     | 6379         | Redis cache/queue      |
| surreal                   | 8000         | SurrealDB database     |
| surrealist                | 8001         | Database UI            |
| metabob-rpc-api-server    | 8080         | Backend HTTP API       |
| devbob-clean              | 3000, 8082   | Agent ACP/MCP          |
| devbob-rpc-api            | 3001, 8081   | Agent ACP/MCP          |
| devbob-cli                | 3002, 8083   | Agent ACP/MCP          |
| devbob-opencode           | 3003, 8084   | Agent ACP/MCP          |
| devbob-dashboard          | 3004, 8085   | Agent ACP/MCP          |

---

## Related Documentation

- **Full Validation Report**: `DOCKER_COMPOSE_PROFILE_VALIDATION.md`
- **Deployment State**: `DEPLOYMENT_STATE_FEB16_AFTERNOON.md`
- **Session Summary**: `SESSION_RESUME_FEB16_VALIDATION.md`
- **Project Status**: `ACP_PROJECT_STATUS.md`

---

## Next Steps After Starting

### For Backend Development
```bash
# 1. Start backend
docker-compose --profile stable up -d

# 2. Check health
curl http://localhost:8080/health

# 3. View logs
docker-compose logs -f metabob-rpc-api-server
```

### For Agent Testing
```bash
# 1. Start backend + agent
docker-compose --profile stable --profile devbob up -d

# 2. Connect to agent
curl http://localhost:3000/config

# 3. Use OpenCode CLI to interact
opencode connect http://localhost:3000
```

### For Multi-Agent Development
```bash
# 1. Start everything
docker-compose --profile stable --profile devbob-dev up -d

# 2. Check all agents
for port in 3001 3002 3003 3004; do
  curl -sf http://localhost:$port/config > /dev/null && echo "Port $port: ✅" || echo "Port $port: ❌"
done

# 3. Monitor logs
docker-compose logs -f devbob-rpc-api devbob-opencode
```
