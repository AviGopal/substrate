# Complete System Architecture (Updated 2026-03-23)

**System:** Metabob Development Platform
**Components:** MiniBob, metabob-mcp, metabob-activity-api, metabob-analysis-api, metabob-cloud-dashboard
**Updated:** Per-workspace metabob-mcp architecture

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT WORKSPACES (Local)                          │
│                                                                                 │
│  Workspace A              Workspace B              Workspace C                  │
│  ┌────────────────┐       ┌────────────────┐       ┌────────────────┐          │
│  │   Developer    │       │   Developer    │       │   Developer    │          │
│  │   Machine      │       │   Machine      │       │   Machine      │          │
│  │                │       │                │       │                │          │
│  │  ┌──────────┐  │       │  ┌──────────┐  │       │  ┌──────────┐  │          │
│  │  │ MiniBob  │  │       │  │ MiniBob  │  │       │  │ OpenCode │  │          │
│  │  │ (agent)  │  │       │  │ (agent)  │  │       │  │ (agent)  │  │          │
│  │  └────┬─────┘  │       │  └────┬─────┘  │       │  └────┬─────┘  │          │
│  │       │MCP     │       │       │MCP     │       │       │MCP     │          │
│  │       │stdio   │       │       │stdio   │       │       │stdio   │          │
│  │       ▼        │       │       ▼        │       │       ▼        │          │
│  │  ┌──────────┐  │       │  ┌──────────┐  │       │  ┌──────────┐  │          │
│  │  │metabob-  │  │       │  │metabob-  │  │       │  │metabob-  │  │          │
│  │  │   mcp    │  │       │  │   mcp    │  │       │  │   mcp    │  │          │
│  │  │(local)   │  │       │  │(local)   │  │       │  │(local)   │  │          │
│  │  │          │  │       │  │          │  │       │  │          │  │          │
│  │  │• Watch   │  │       │  │• Watch   │  │       │  │• Watch   │  │          │
│  │  │• Parse   │  │       │  │• Parse   │  │       │  │• Parse   │  │          │
│  │  │• CPG     │  │       │  │• CPG     │  │       │  │• CPG     │  │          │
│  │  │• Embed   │  │       │  │• Embed   │  │       │  │• Embed   │  │          │
│  │  │• SQLite  │  │       │  │• SQLite  │  │       │  │• SQLite  │  │          │
│  │  └────┬─────┘  │       │  └────┬─────┘  │       │  └────┬─────┘  │          │
│  │       │        │       │       │        │       │       │        │          │
│  │       │Watches │       │       │Watches │       │       │Watches │          │
│  │       ▼        │       │       ▼        │       │       ▼        │          │
│  │  ┌──────────┐  │       │  ┌──────────┐  │       │  ┌──────────┐  │          │
│  │  │Codebase  │  │       │  │Codebase  │  │       │  │Codebase  │  │          │
│  │  │Files     │  │       │  │Files     │  │       │  │Files     │  │          │
│  │  └──────────┘  │       │  └──────────┘  │       │  └──────────┘  │          │
│  └────────┬───────┘       └────────┬───────┘       └────────┬───────┘          │
│           │                        │                        │                  │
└───────────┼────────────────────────┼────────────────────────┼──────────────────┘
            │                        │                        │
            │ HTTPS (sync push)      │                        │
            │ POST /v2/sync/*        │                        │
            │                        │                        │
            └────────────────────────┼────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         KUBERNETES CLUSTER (Cloud)                              │
│                                                                                 │
│                    ┌─────────────────────────────────┐                          │
│                    │      Istio Gateway              │                          │
│                    │  • dashboard.minibob.local      │                          │
│                    │  • analysis.minibob.local       │                          │
│                    │  • api.minibob.local            │                          │
│                    └──────────────┬──────────────────┘                          │
│                                   │                                             │
│              ┌────────────────────┼─────────────────────────┐                   │
│              │                    │                         │                   │
│              ▼                    ▼                         ▼                   │
│   ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐            │
│   │  dashboard      │  │  analysis-api    │  │  activity-api     │            │
│   │  (Port 3000)    │  │  (Port 8080)     │  │  (Port 8080)      │            │
│   │                 │  │                  │  │                   │            │
│   │ • React 19      │  │ • Auth/Sessions  │  │ • Activities      │            │
│   │ • shadcn/ui     │  │ • Projects       │  │ • Templates       │            │
│   │ • WebSocket     │  │ • Problems       │  │ • Executions      │            │
│   │ • Visualization │  │ • Sync endpoints │  │ • Thompson        │            │
│   │                 │  │ • Analytics      │  │   Sampling        │            │
│   └────────┬────────┘  └─────────┬────────┘  └─────────┬─────────┘            │
│            │                     │                      │                      │
│            └─────────────────────┼──────────────────────┘                      │
│                                  │                                             │
│                                  ▼                                             │
│                       ┌──────────────────────┐                                 │
│                       │                      │                                 │
│          ┌────────────┤     SurrealDB 3.x    ├──────────────┐                  │
│          │            │   (StatefulSet)      │              │                  │
│          │            │                      │              │                  │
│          │            │  Namespace:          │              │                  │
│          │            │  activity_system     │              │                  │
│          │            │                      │              │                  │
│          │            │  Database:           │              │                  │
│          │            │  learning_loop       │              │                  │
│          │            └──────────────────────┘              │                  │
│          │                                                  │                  │
│          │ Tables:                                          │                  │
│          │                                                  │                  │
│          ▼                                                  ▼                  │
│  ┌──────────────────┐                            ┌──────────────────┐          │
│  │ Analysis Domain  │                            │ Activity Domain  │          │
│  │ • users          │                            │ • templates      │          │
│  │ • api_keys       │                            │ • executions     │          │
│  │ • organizations  │                            │ • sessions       │          │
│  │ • projects       │                            │ • impulses       │          │
│  │ • problems       │                            │ • metrics        │          │
│  │ • code_components│                            │                  │          │
│  │ • annotations    │                            │                  │          │
│  │ • cochange_      │                            │                  │          │
│  │   patterns       │                            │                  │          │
│  └──────────────────┘                            └──────────────────┘          │
│                                                                                 │
│                         ┌──────────────────┐                                   │
│                         │  Redis/Valkey    │                                   │
│                         │  (Deployment)    │                                   │
│                         │                  │                                   │
│                         │ • CPG cache      │                                   │
│                         │ • FAISS index    │                                   │
│                         │ • Session state  │                                   │
│                         │ • Rate limits    │                                   │
│                         └──────────────────┘                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                     ▲
                                     │
                                     │ Browser Access
                                     │ https://dashboard.minibob.local
                                     │
                            ┌────────┴─────────┐
                            │   User Browser   │
                            │                  │
                            │ • Login          │
                            │ • View Projects  │
                            │ • Track Issues   │
                            │ • Monitor Sync   │
                            │ • Manage Keys    │
                            └──────────────────┘
```

---

## Component Responsibilities

### Local (Per-Workspace)

| Component | Purpose | Technology | Persistence |
|-----------|---------|------------|-------------|
| **MiniBob** | Agent executor | TypeScript/Bun | None (ephemeral) |
| **OpenCode** | Alternative agent | Go/TypeScript | None (ephemeral) |
| **metabob-mcp** | File watching, parsing, MCP tools | TypeScript/Bun | Local SQLite (encrypted) |

### Cluster (Shared)

| Component | Purpose | Technology | Deployment |
|-----------|---------|------------|------------|
| **metabob-analysis-api** | Auth, projects, problems, sync | TypeScript/Bun/Hono | StatefulSet (3 replicas) |
| **metabob-activity-api** | Activities, templates, Thompson | TypeScript/Bun/Hono | Deployment (3 replicas) |
| **metabob-cloud-dashboard** | Web UI, visualization | React 19/Bun | Deployment (2 replicas) |
| **SurrealDB** | Persistent storage | SurrealDB 3.x | StatefulSet (3 replicas) |
| **Redis/Valkey** | Cache, rate limiting | Valkey | Deployment (1 replica) |

---

## Data Flows

### 1. Code Change → Sync → Dashboard

```
Developer writes code
  └─► metabob-mcp detects (file watcher)
      └─► Parse with tree-sitter
          └─► Extract components
              └─► Generate embeddings
                  └─► Store in local SQLite
                      └─► Batch sync (every 30s)
                          └─► POST /v2/sync/components to analysis-api
                              └─► Insert into SurrealDB
                                  └─► Update project.sync_status
                                      └─► WebSocket event to dashboard
                                          └─► Dashboard shows updated metrics
```

### 2. Agent Uses MCP Tool

```
MiniBob needs priority issues
  └─► MCP call: get_priority_issues({ limit: 5 })
      └─► metabob-mcp (local) receives via stdio
          └─► HTTP GET /v2/analysis/priority to analysis-api
              └─► Query SurrealDB
                  └─► Return results
                      └─► metabob-mcp formats as MCP response
                          └─► MiniBob receives via stdio
```

### 3. User Views Dashboard

```
User opens dashboard.minibob.local
  └─► Login: POST /auth/login (analysis-api)
      └─► Receive JWT token
          └─► GET /auth/orgs/{org}/projects
              └─► Query SurrealDB (includes sync_status)
                  └─► Return projects with metrics
                      └─► Dashboard renders:
                          • Projects list
                          • Sync progress
                          • Issue counts
                          • Activity metrics
```

### 4. Activity Execution

```
MiniBob executes activity
  └─► Load template from activity-api
      └─► Execute tasks with LLM
          └─► Write code changes
              └─► metabob-mcp detects changes (file watcher)
                  └─► Parse and sync (see Flow 1)
              └─► Record execution in activity-api
                  └─► Update Thompson Sampling metrics
```

---

## Key Architectural Principles

1. **Per-Workspace Isolation**
   - Each workspace has its own metabob-mcp instance
   - Local SQLite stores workspace-specific state
   - No shared state between workspaces

2. **Push-Based Sync**
   - Workspaces push to cluster (not pull)
   - Reverse chronological order (newest first)
   - Batched for efficiency (50-100 items per request)

3. **Aggregated Metrics**
   - Dashboard shows totals from all workspaces
   - project.sync_status accumulates across pushes
   - No per-workspace breakdown (privacy)

4. **Continuous Process**
   - No completion percentage
   - Shows work done (files indexed, components found)
   - "Continuous Sync Active" status

5. **Centralized Learning**
   - Workspaces push data
   - Cluster aggregates and learns
   - Thompson Sampling improves templates
   - Co-change patterns discovered

6. **Federated APIs**
   - Three independent backends (analysis, activity, mcp-local)
   - Shared auth (JWT from analysis-api)
   - Istio routing

7. **Progressive Enhancement**
   - Core features first
   - Online learning iterative
   - Dashboard adds features over time

---

## Communication Protocols

| From | To | Protocol | Purpose |
|------|-----|----------|---------|
| Agent | metabob-mcp (local) | MCP (stdio) | Tool calls |
| metabob-mcp (local) | analysis-api | HTTPS (POST) | Sync push |
| Dashboard | analysis-api | HTTPS (GET/POST) + WebSocket | Query + real-time |
| Dashboard | activity-api | HTTPS (GET/POST) | Activities data |
| analysis-api | SurrealDB | Native protocol | Persistence |
| activity-api | SurrealDB | Native protocol | Persistence |
| All services | Redis | Native protocol | Cache/state |

---

## Deployment Topology

### Namespaces

- **activity-system** - All services except local workspaces

### Services (Kubernetes)

```yaml
# Externally accessible (Istio Gateway)
- dashboard.minibob.local → metabob-cloud-dashboard:3000
- analysis.minibob.local → metabob-analysis-api:8080
- api.minibob.local      → metabob-activity-api:8080

# Internal only
- surrealdb.activity-system.svc.cluster.local:8000
- redis-valkey.activity-system.svc.cluster.local:6379
```

### Persistent Volumes

- SurrealDB: 50GB per replica (StatefulSet)
- metabob-analysis-api: 10GB per replica (FAISS indexes)

### Resource Limits

| Service | CPU | Memory | Replicas |
|---------|-----|--------|----------|
| analysis-api | 2 | 4GB | 3 |
| activity-api | 1 | 2GB | 3 |
| dashboard | 0.5 | 512MB | 2 |
| SurrealDB | 2 | 4GB | 3 |
| Redis | 1 | 1GB | 1 |

---

## Security Model

### Authentication

- **JWT tokens** issued by analysis-api
- **1:1 user/API key** relationship (username = key name)
- **Workspace authentication** via API key in sync requests

### Authorization

- **Org-scoped** isolation (users see only their org's data)
- **Project-scoped** queries (optional project_id, defaults to default_project_id)
- **Session-scoped** for workspace-specific data

### Data Privacy

- **Local SQLite encrypted** (sqlcipher)
- **HTTPS only** for cluster communication
- **No code content** in embeddings
- **WebSocket auth** via JWT

### Rate Limiting

- **60 req/min** per session for expensive operations
- **10K req/min** global across all sessions
- **Redis-based** distributed rate limiting

---

## References

- **Specs:** `openspec/changes/analysis-api-extraction/design-updated.md`
- **Specs:** `openspec/changes/cloud-dashboard-implementation/design-updated.md`
- **Changes:** `SPEC_ARCHITECTURE_UPDATE_2026-03-23.md`
- **Clarification:** `openspec/changes/analysis-api-extraction/ARCHITECTURE_CLARIFICATION.md`
