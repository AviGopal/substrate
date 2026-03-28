# DevBob Deployment - Quick Reference Card

## 🚀 Quick Start

```bash
# Deploy everything (2-3 minutes)
./devbob-quickstart.sh

# Or use activity
opencode activity execute deploy-devbob-stack
```

## 📋 Activities

### deploy-devbob-stack
Full infrastructure deployment with validation
```bash
opencode activity execute deploy-devbob-stack \
  --variables '{"profile": "all", "runTestFlow": true}'
```

### delegate-to-devbob
Delegate task to specific container via ACP
```bash
opencode activity execute delegate-to-devbob \
  --variables '{
    "target": "docker://devbob-clean",
    "taskDescription": "Your task summary",
    "prompt": "Full task instructions here"
  }'
```

### submit-analysis-job
Submit and monitor code analysis job
```bash
opencode activity execute submit-analysis-job \
  --variables '{"projectPath": "/workspace/project"}'
```

## 🎯 Common Commands

### Deployment
```bash
# Deploy with specific profile
docker-compose -f docker-compose.unified.yaml --profile all up -d

# Check status
docker ps --filter name=metabob- --filter name=devbob-

# View logs
docker logs -f devbob-clean

# Stop everything
docker-compose -f docker-compose.unified.yaml --profile all down
```

### Health Checks
```bash
# Redis
docker exec metabob-redis redis-cli ping

# SurrealDB
docker exec metabob-surreal /surreal isready --conn http://localhost:8000

# API
curl http://localhost:8080/health

# DevBob containers
docker ps --filter name=devbob- --filter status=running
```

### Container Access
```bash
# Execute command in container
docker exec devbob-clean <command>

# Interactive shell
docker exec -it devbob-clean bash

# View container logs
docker logs devbob-clean --tail 100 --follow
```

## 🌐 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Surrealist UI | http://localhost:8001 | Database UI |
| Metabob API | http://localhost:8080 | Backend API |
| API Health | http://localhost:8080/health | Health check |

## 🤖 DevBob Agents (ACP)

| Agent | Target | Port | Use Case |
|-------|--------|------|----------|
| Clean | `docker://devbob-clean` | 3100 | Testing, experiments |
| RPC API | `docker://devbob-rpc-api` | 3101 | Backend development |
| Dashboard | `docker://devbob-dashboard` | 3102 | Frontend development |

## 📝 Examples

### Parallel Multi-Agent
```bash
# Backend implementation
opencode activity execute delegate-to-devbob \
  --variables '{
    "target": "docker://devbob-rpc-api",
    "taskDescription": "Implement API",
    "prompt": "Create REST endpoints",
    "shareImpulses": ["api-design"]
  }' &

# Frontend implementation
opencode activity execute delegate-to-devbob \
  --variables '{
    "target": "docker://devbob-dashboard",
    "taskDescription": "Implement UI",
    "prompt": "Create UI components",
    "shareImpulses": ["api-design"]
  }' &

wait
```

### Analysis Pipeline
```bash
# 1. Submit analysis
opencode activity execute submit-analysis-job \
  --variables '{
    "projectPath": "/workspace/project",
    "filterSeverity": "HIGH"
  }'

# 2. Review results
cat analysis-summary-{jobId}.md

# 3. Delegate fixes
opencode activity execute delegate-to-devbob \
  --variables '{
    "target": "docker://devbob-clean",
    "taskDescription": "Fix critical issues",
    "prompt": "Fix the issues found in analysis",
    "shareImpulses": ["analysis-results"]
  }'
```

## 🔧 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker logs devbob-clean --tail 50

# Check resources
docker stats --no-stream

# Restart container
docker restart devbob-clean
```

### Delegation Fails
```bash
# Verify container running
docker ps --filter name=devbob-clean

# Check ACP server started
docker logs devbob-clean 2>&1 | grep "ACP server listening"

# Test connectivity
docker exec devbob-clean opencode --version
```

### Job Submission Fails
```bash
# Check backend health
curl http://localhost:8080/health

# Check backend logs
docker logs metabob-rpc-api --tail 100

# Verify database
docker exec metabob-surreal /surreal isready --conn http://localhost:8000
```

## 🎓 Best Practices

### Impulse Sharing
- **Pointer-only** (default): Fast, host must stay active
- **Full content**: Self-contained, larger payload

```bash
# Pointer-only (default)
--variables '{"shareImpulses": ["design"], "sendFullContent": false}'

# Full content (self-contained)
--variables '{"shareImpulses": ["design"], "sendFullContent": true}'
```

### Job Monitoring
- **Active**: Wait for completion (default)
- **Background**: Fire and forget
- **Milestone**: Periodic checks

```bash
# Active monitoring
--variables '{"monitoringMode": "active", "monitorTimeout": 600}'

# Background mode
--variables '{"monitoringMode": "background"}'
```

### Container Selection
- **devbob-clean**: Testing, isolated work
- **devbob-rpc-api**: Backend modifications
- **devbob-dashboard**: Frontend modifications

## 📊 Deployment Profiles

| Profile | Services | Command |
|---------|----------|---------|
| `infra` | Redis, SurrealDB, Surrealist | `--profile infra` |
| `metabob` | API, Worker | `--profile metabob` |
| `devbob` | Agent containers | `--profile devbob` |
| `all` | Everything | `--profile all` |

## 📖 Documentation

- **Full Guide**: `DEPLOYMENT_ACTIVITIES_GUIDE.md`
- **Summary**: `DEPLOYMENT_ACTIVITIES_SUMMARY.md`
- **Workflow Doc**: `DEVBOB_DEPLOYMENT_WORKFLOW.md`

## 🆘 Quick Help

```bash
# List activities
opencode activity list

# Activity details
opencode activity describe deploy-devbob-stack

# Container logs
docker logs <container-name>

# Container stats
docker stats --no-stream

# Network inspection
docker network inspect metabob-network
```

---

**Version**: 1.0  
**Date**: 2026-02-26  
**Activities**: deploy-devbob-stack, delegate-to-devbob, submit-analysis-job
