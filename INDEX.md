# Metabob DevBob - Documentation Index

> **Project Status**: Backend integrated, self-healing foundation complete  
> **Last Updated**: 2026-01-27

---

## 🚀 Quick Navigation

### Getting Started
- **[README.md](README.md)** - Project overview and quick start
- **[STATUS.md](STATUS.md)** - Current environment status and configuration
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Command cheat sheet
- **[QUICK_START.md](QUICK_START.md)** - 5-minute setup guide
- **[BOOTSTRAP_GUIDE.md](BOOTSTRAP_GUIDE.md)** - Detailed setup instructions
- **[VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md)** - Health check procedures

### Running the Environment
- **[./devbob](./devbob)** - Start everything
- **[scripts/build-devbob.sh](scripts/build-devbob.sh)** - Build agent image
- **[.env.devbob](.env.devbob)** - Environment configuration

---

## 📁 Project Structure

### Metabob Services (repos/)
```
repos/
├── metabob-rpc-api/      FastAPI backend + celery workers
├── metabob-cli/          Python CLI + MCP server  
├── metabob-opencode/     Bun-based agent IDE (OpenCode fork)
└── cpg-inference/        Code Property Graph engine
```

### Orchestration Layer (this directory)
```
metabob-devbob/
├── configs/              Docker compose + environment
├── scripts/              Helper scripts
├── templates/            Activity templates
└── docs/                 Architecture and investigations
```

---

## 📚 Architecture Documentation

### Core Architecture
- **[docs/SELF_HEALING_DEVBOB_ARCHITECTURE.md](docs/SELF_HEALING_DEVBOB_ARCHITECTURE.md)** - Self-healing system design
- **[docs/DEVBOB_SELF_SUSTAINING_ROADMAP.md](docs/DEVBOB_SELF_SUSTAINING_ROADMAP.md)** - Long-term vision
- **[docs/GNN_COCHANGE_TOOLING_ARCHITECTURE.md](docs/GNN_COCHANGE_TOOLING_ARCHITECTURE.md)** - ML-based co-change prediction

### Integration Guides
- **[docs/investigations/BACKEND_INTEGRATION_GUIDE.md](docs/investigations/BACKEND_INTEGRATION_GUIDE.md)** - Backend + agent integration
- **[SELF_HEALING_INTEGRATION_VERIFICATION.md](SELF_HEALING_INTEGRATION_VERIFICATION.md)** - Self-healing validation

### Quick Starts
- **[docs/SELF_HEALING_QUICK_START.md](docs/SELF_HEALING_QUICK_START.md)** - Test self-healing capabilities
- **[docs/DOGFOODING_QUICK_START.md](docs/DOGFOODING_QUICK_START.md)** - First development session
- **[docs/GNN_COCHANGE_QUICK_START.md](docs/GNN_COCHANGE_QUICK_START.md)** - Use co-change predictions

---

## 🔍 Investigation Reports

### Session Work
- **[SESSION_SUMMARY_2026-01-27.md](SESSION_SUMMARY_2026-01-27.md)** - Latest session summary
- **[REPOSITORY_ANALYSIS.md](REPOSITORY_ANALYSIS.md)** - Branch activity and recommendations
- **[docs/investigations/TIMEOUT_INVESTIGATION_REPORT.md](docs/investigations/TIMEOUT_INVESTIGATION_REPORT.md)** - Agent timeout root cause analysis
- **[docs/investigations/INVESTIGATION_SUMMARY.md](docs/investigations/INVESTIGATION_SUMMARY.md)** - Investigation executive summary
- **[docs/investigations/SESSION_UPDATE.md](docs/investigations/SESSION_UPDATE.md)** - Session progress summary
- **[docs/investigations/BACKEND_INTEGRATION_COMPLETE.md](docs/investigations/BACKEND_INTEGRATION_COMPLETE.md)** - Integration summary

---

## 🎯 Activity Templates

### Available Templates
- **[templates/implement-self-healing-system.json](templates/implement-self-healing-system.json)** - Deploy self-healing infrastructure
- **[templates/specification-driven-implementation.json](templates/specification-driven-implementation.json)** - Implement from specifications
- **[templates/fix-devbob-network-access.json](templates/fix-devbob-network-access.json)** - Debug network issues

### Template System
- Registered in: `.metabob/activities/`
- Search: `search_activities({ category: "feature|bugfix|infrastructure" })`
- Execute: `activity({ templateId, variables, reason })`

---

## 🏗️ Infrastructure

### Services Architecture
```
┌─────────────────────────────────┐
│  Backend Services               │
├─────────────────────────────────┤
│  redis (6379)                   │
│  api-server-dev (8080)          │
│  metabob-worker                 │
└─────────────┬───────────────────┘
              │ http://api-server-dev:80
              │
┌─────────────▼───────────────────┐
│  Devbob Agents                  │
├─────────────────────────────────┤
│  devbob-rpc-api (3001)          │ ◄── Manages backend
│  devbob-dashboard (3002)        │
│  devbob-cli (3003)              │
│  devbob-opencode (3004)         │
└─────────────────────────────────┘
```

### Configuration Files
- **[configs/docker-compose.devbob.yaml](configs/docker-compose.devbob.yaml)** - All services + agents
- **[configs/Dockerfile.devbob](configs/Dockerfile.devbob)** - Agent container image
- **[configs/devbob-entrypoint.sh](configs/devbob-entrypoint.sh)** - Container initialization
- **[.env.devbob](.env.devbob)** - Environment variables

---

## 🛠️ Helper Scripts

### Startup & Management
- `./devbob` - Start all services (backend + agents)
- `scripts/build-devbob.sh` - Build devbob agent image
- `scripts/stop-devbob.sh` - Stop all containers
- `scripts/bootstrap-devbob.sh` - Initialize environment

### Utilities
- `scripts/verify-devbob.sh` - Automated health check
- `scripts/test-devbob-connectivity.sh` - Verify network access
- `scripts/find-messages-for.sh` - Find cross-agent messages

---

## 📊 Current State

### ✅ Completed
- Backend services integrated (redis, api-server, worker)
- All agents connect to backend successfully
- Health checks and service dependencies working
- Docker socket access for service management
- Comprehensive documentation

### 🏗️ In Progress
- Self-healing observability layer (Tasks 1-2)
- Detection engine implementation
- Autonomous recovery workflows

### 📋 Next Steps
1. Test integrated environment (30 min)
2. Deploy health endpoints (1-2 hrs)
3. Implement detection engine (1-2 hrs)
4. Build self-healing coordinator (2 hrs)
5. End-to-end testing (1 hr)

---

## 🧪 Testing & Validation

### Quick Tests
```bash
# Backend health
curl http://localhost:8080/status

# Agent config
curl http://localhost:3004/config

# Container connectivity
docker exec devbob-opencode curl http://api-server-dev:80/status
```

### Validation Reports
- **[SELF_HEALING_INTEGRATION_VERIFICATION.md](SELF_HEALING_INTEGRATION_VERIFICATION.md)** - Integration test results
- **[activity-monitoring-report.json](activity-monitoring-report.json)** - Memory monitoring data

---

## 📖 Learning Resources

### Understanding DevBob
1. Start with [README.md](README.md) for overview
2. Read [QUICK_START.md](QUICK_START.md) for hands-on
3. Explore [docs/SELF_HEALING_DEVBOB_ARCHITECTURE.md](docs/SELF_HEALING_DEVBOB_ARCHITECTURE.md) for design

### Understanding Self-Healing
1. [docs/SELF_HEALING_DEVBOB_ARCHITECTURE.md](docs/SELF_HEALING_DEVBOB_ARCHITECTURE.md) - System design
2. [docs/SELF_HEALING_QUICK_START.md](docs/SELF_HEALING_QUICK_START.md) - How to test
3. [docs/investigations/TIMEOUT_INVESTIGATION_REPORT.md](docs/investigations/TIMEOUT_INVESTIGATION_REPORT.md) - Real-world example

### Advanced Topics
- [docs/INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md](docs/INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md)
- [docs/GNN_COCHANGE_TOOLING_ARCHITECTURE.md](docs/GNN_COCHANGE_TOOLING_ARCHITECTURE.md)
- [docs/INCREMENTAL_DEVBOB_DOGFOODING.md](docs/INCREMENTAL_DEVBOB_DOGFOODING.md)

---

## 🔗 External Links

- [Metabob Platform](https://metabob.com)
- [OpenCode Documentation](https://github.com/metabob/opencode)
- [Docker Documentation](https://docs.docker.com)

---

## 📝 Notes

### File Organization
- **Root directory**: High-level docs (README, QUICK_START, INDEX)
- **docs/**: Architecture and design documents
- **docs/investigations/**: Session reports and investigations
- **configs/**: Docker and environment configuration
- **scripts/**: Executable helper scripts
- **templates/**: Activity templates (JSON)

### Naming Conventions
- `UPPERCASE_WITH_UNDERSCORES.md` - Major documentation
- `lowercase-with-dashes.sh` - Shell scripts
- `lowercase-with-dashes.json` - Configuration/templates
- `activity-monitoring-report.json` - Generated data files

---

**Last Updated**: 2026-01-27  
**Maintainer**: DevBob Multi-Agent System  
**Status**: Backend integrated, ready for self-healing deployment
