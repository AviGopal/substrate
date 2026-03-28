# DevBob Architecture Visual Reference

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Host Machine (Linux)                             │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Docker Network: devbob-network                │   │
│  │                                                                   │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │             Backend Services (Profile: backend)          │  │   │
│  │  │                                                           │  │   │
│  │  │  ┌───────────┐  ┌───────────┐  ┌────────────────────┐  │  │   │
│  │  │  │   Redis   │  │ SurrealDB │  │  RPC API Server    │  │  │   │
│  │  │  │  :6379    │  │   :8000   │  │      :8080         │  │  │   │
│  │  │  └─────┬─────┘  └─────┬─────┘  └──────────┬─────────┘  │  │   │
│  │  │        │               │                   │             │  │   │
│  │  │        └───────────────┴───────────────────┘             │  │   │
│  │  │                        │                                 │  │   │
│  │  │                ┌───────┴─────────┐                       │  │   │
│  │  │                │ Celery Worker   │                       │  │   │
│  │  │                └─────────────────┘                       │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  │                                                                   │   │
│  │  ┌──────────────────────────────────────────────────────────┐  │   │
│  │  │         DevBob Agents (Profile: all-agents)              │  │   │
│  │  │                                                           │  │   │
│  │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │  │   │
│  │  │  │ devbob-    │ │ devbob-    │ │ devbob-    │          │  │   │
│  │  │  │ rpc-api    │ │ dashboard  │ │ cli        │          │  │   │
│  │  │  │ ACP:3001   │ │ ACP:3002   │ │ ACP:3003   │          │  │   │
│  │  │  │ MCP:8081   │ │ MCP:8082   │ │ MCP:8083   │          │  │   │
│  │  │  └────────────┘ └────────────┘ └────────────┘          │  │   │
│  │  │                                                           │  │   │
│  │  │  ┌────────────┐ ┌────────────┐                          │  │   │
│  │  │  │ devbob-    │ │ devbob     │                          │  │   │
│  │  │  │ opencode   │ │ (orchestr) │                          │  │   │
│  │  │  │ ACP:3004   │ │ ACP:3005   │                          │  │   │
│  │  │  │ MCP:8084   │ │ MCP:8085   │                          │  │   │
│  │  │  └────────────┘ └────────────┘                          │  │   │
│  │  └──────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              Host Development Environment                        │   │
│  │                                                                   │   │
│  │  opencode CLI → configs/opencode.host.json                       │   │
│  │  API URL: http://localhost:8080                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📊 Port Allocation Map

### Backend Services (Profile: backend)
| Service | Internal Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| Redis | 6379 | 6379 | Task queue & cache |
| SurrealDB | 8000 | 8000 | Database |
| Surrealist | 8080 | 8001 | DB Web UI |
| RPC API Server | 8080 | 8080 | Main API |

### DevBob Agent Containers

#### devbob-rpc-api (Profile: devbob-rpc-api)
| Service | Internal Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| OpenCode ACP | 3001 | 3001 | Agent Control Protocol |
| MCP Server | 8082 | 8081 | Model Context Protocol |
| HTTP Bridge | 8080 | 8091 | HTTP API Bridge |
| Dashboard UI | 3000 | 3010 | Metabob CLI Dashboard |
| Dashboard API | 8088 | 3020 | Dashboard Backend |

#### devbob-dashboard (Profile: devbob-dashboard)
| Service | Internal Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| OpenCode ACP | 3002 | 3002 | Agent Control Protocol |
| MCP Server | 8082 | 8082 | Model Context Protocol |
| HTTP Bridge | 8080 | 8092 | HTTP API Bridge |
| Dashboard UI | 3000 | 3011 | Metabob CLI Dashboard |
| Dashboard API | 8088 | 3021 | Dashboard Backend |
| Dev Server (local) | 3010 | 3030 | Web dev server |
| Dev Server (cloud) | 3020 | 3040 | Cloud dev server |

#### devbob-cli (Profile: devbob-cli)
| Service | Internal Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| OpenCode ACP | 3003 | 3003 | Agent Control Protocol |
| MCP Server | 8082 | 8083 | Model Context Protocol |
| HTTP Bridge | 8080 | 8093 | HTTP API Bridge |
| Dashboard UI | 3000 | 3012 | Metabob CLI Dashboard |
| Dashboard API | 8088 | 3022 | Dashboard Backend |

#### devbob-opencode (Profile: devbob-opencode)
| Service | Internal Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| OpenCode ACP | 3004 | 3004 | Agent Control Protocol |
| MCP Server | 8082 | 8084 | Model Context Protocol |
| HTTP Bridge | 8080 | 8094 | HTTP API Bridge |
| Dashboard UI | 3000 | 3013 | Metabob CLI Dashboard |
| Dashboard API | 8088 | 3023 | Dashboard Backend |

#### devbob (Profile: devbob-orchestrator)
| Service | Internal Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| OpenCode ACP | 3005 | 3005 | Agent Control Protocol |
| MCP Server | 8082 | 8085 | Model Context Protocol |
| HTTP Bridge | 8080 | 8095 | HTTP API Bridge |
| Dashboard UI | 3000 | 3014 | Metabob CLI Dashboard |
| Dashboard API | 8088 | 3024 | Dashboard Backend |

## 🔀 Profile Deployment Matrix

| Profile | Services Started | Containers | Memory | Use Case |
|---------|------------------|------------|--------|----------|
| **backend** | redis, surreal, rpc-api, worker | 6 | ~2GB | Backend only |
| **testing** | backend + devbob-opencode | 7 | ~3GB | Integration testing |
| **development** | backend + all-agents | 11 | ~6GB | Full dev environment |
| **all-agents** | All 5 devbob containers | 5 | ~4GB | Multi-agent testing (no backend) |
| **devbob-rpc-api** | devbob-rpc-api container | 1 | ~800MB | RPC API agent only |
| **devbob-opencode** | devbob-opencode container | 1 | ~800MB | OpenCode agent only |
| **devbob-orchestrator** | devbob container | 1 | ~800MB | Orchestration agent only |

## 🔌 Configuration Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Configuration Selection               │
└─────────────────────────────────────────────────────────┘

Host Machine:
  opencode CLI
    │
    └─→ configs/opencode.host.json
          │
          └─→ metabob.base_url: "http://localhost:8080"

DevBob Container:
  devbob-entrypoint.sh
    │
    ├─→ Detect: RUNNING_IN_CONTAINER=true
    │
    └─→ configs/opencode.devbob.json
          │
          └─→ metabob.base_url: "http://host.docker.internal:8080"
```

## 🌐 Network Communication

```
┌──────────────────────────────────────────────────────┐
│                Network: metabob-network              │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Backend Services                                    │
│  ┌──────────┐                                        │
│  │  Redis   │ ←─── All services connect internally  │
│  │ SurrealDB│                                        │
│  │ RPC API  │                                        │
│  └────┬─────┘                                        │
│       │                                              │
│       │ Internal DNS: metabob-rpc-api-server:8080   │
│       │                                              │
│  ┌────▼──────────────────────────────────────┐      │
│  │         DevBob Agents                     │      │
│  │  (Connect via internal service names)     │      │
│  └───────────────────────────────────────────┘      │
│                                                      │
└──────────────────────────────────────────────────────┘

Host Machine Access:
  → http://localhost:8080  (RPC API)
  → http://localhost:3001  (devbob-rpc-api ACP)
  → http://localhost:3004  (devbob-opencode ACP)
```

## 📁 Volume Structure

```
Docker Volumes:
├── metabob_redis_data          # Redis persistence
├── metabob_surreal_data        # SurrealDB data
├── metabob_api_logs            # API server logs
├── metabob_worker_logs         # Celery worker logs
├── devbob_config               # Shared config (all agents)
├── devbob_auth                 # Shared auth tokens
├── devbob_rpc_api_workspace    # RPC API codebase
├── devbob_cli_workspace        # CLI codebase
├── devbob_opencode_workspace   # OpenCode codebase
└── devbob_web_workspace        # Dashboard codebase

Host Mounts:
└── metabob-devbob/             # Mounted to devbob container
    ├── repos/                   # Sub-repos (git submodules or clones)
    └── configs/                 # Configuration files
```

## 🚀 Startup Sequence

### Profile: backend
```
1. Start redis
   └─→ Wait for health check (redis-cli ping)
2. Start surreal
   └─→ Wait for health check (surreal isready)
3. Run db-init (one-time)
   └─→ Seeds database schema
4. Start metabob-rpc-api-server
   └─→ Depends on: redis, surreal
   └─→ Wait for health check (curl /health)
5. Start metabob-rpc-api-worker
   └─→ Depends on: redis
```

### Profile: testing (backend + devbob-opencode)
```
1. Backend startup (steps 1-5 above)
2. Start devbob-opencode
   └─→ Depends on: metabob-rpc-api-server
   └─→ Wait for backend health
   └─→ Load: configs/opencode.devbob.json
   └─→ Wait for health check (curl ACP /config)
```

### Profile: development (all services)
```
1. Backend startup (steps 1-5)
2. Start all devbob agents in parallel
   ├─→ devbob-rpc-api
   ├─→ devbob-dashboard
   ├─→ devbob-cli
   ├─→ devbob-opencode
   └─→ devbob
```

## 🔍 Health Check Endpoints

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Redis | `redis-cli ping` | `PONG` |
| SurrealDB | `/health` on :8000 | `200 OK` |
| RPC API Server | `GET /health` | `{"status": "healthy"}` |
| DevBob Agents | `GET :300X/config` | `{"acp": {...}}` |

---

**Quick Reference**: Use this diagram to understand port mappings and service dependencies.
