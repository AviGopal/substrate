# Architecture Clarification: metabob-mcp Deployment Model

**Date:** 2026-03-23
**Change Type:** Architectural Correction
**Status:** Updated

---

## What Changed

### Previous Understanding (Incorrect)

metabob-mcp was described as:
- A centralized service deployed to Kubernetes cluster
- Sidecar container alongside metabob-analysis-api
- Accessible via HTTP/Istio Gateway
- Shared by all users/agents

```
[Cluster]
  ├─ metabob-analysis-api (StatefulSet)
  ├─ metabob-mcp (Deployment) ← WRONG
  ├─ SurrealDB
  └─ Redis
```

### Corrected Understanding

metabob-mcp is actually:
- A **local process** running in each development workspace
- Runs **alongside the agent executor** (MiniBob, OpenCode, etc.)
- Communicates with agent via **MCP protocol (stdio)**
- Has **local encrypted SQLite** database for workspace state
- **Watches the local codebase** as changes are made
- **Pushes updates** to centralized metabob-analysis-api
- **NOT deployed** to Kubernetes cluster

```
[Local Workspaces]
  Workspace A: MiniBob + metabob-mcp → [sync push] →
  Workspace B: MiniBob + metabob-mcp → [sync push] → [Cluster: analysis-api → SurrealDB]
  Workspace C: OpenCode + metabob-mcp → [sync push] →
```

---

## Why This Matters

### 1. File Watching

metabob-mcp needs access to the local codebase to:
- Watch for file changes in real-time
- Parse modified files immediately
- Extract components and embeddings
- Queue updates for sync

This CANNOT be done from a centralized service without complex mounting of all workspaces.

### 2. MCP Protocol Design

The Model Context Protocol (MCP) is designed for:
- **Local communication** (stdio, named pipes)
- Agent ↔ Tool communication within same environment
- NOT for centralized service architecture

### 3. Workspace Isolation

Each workspace has:
- Different codebase
- Different project context
- Different sync state
- Independent processing queue

Sharing one metabob-mcp instance across workspaces would create conflicts.

### 4. Scalability

With per-workspace deployment:
- ✅ Each workspace processes independently
- ✅ No central bottleneck
- ✅ Scales horizontally (more workspaces = more local instances)
- ✅ Failure in one workspace doesn't affect others

With centralized deployment:
- ❌ Single point of failure
- ❌ All workspace file changes bottleneck through one service
- ❌ Complex workspace routing/isolation logic

---

## Architecture Diagrams

### Data Flow: Workspace → Backend → Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  Development Workspace (Developer's Machine)                 │
│                                                              │
│  ┌────────────┐         MCP Protocol (stdio)                │
│  │  MiniBob   │◄───────────────────────┐                    │
│  │  (agent)   │                        │                    │
│  └──────┬─────┘                        │                    │
│         │                              │                    │
│         │ Code changes                 │                    │
│         ▼                              ▼                    │
│  ┌─────────────────────────┐  ┌──────────────────┐          │
│  │   Codebase Files        │  │  metabob-mcp     │          │
│  │   src/**/*.ts           │  │  (local process) │          │
│  └─────────────────────────┘  └──────┬───────────┘          │
│                                      │                      │
│                                      │ Watch + Parse        │
│                                      ▼                      │
│                           ┌──────────────────┐              │
│                           │  Local SQLite    │              │
│                           │  (encrypted)     │              │
│                           │  - File hashes   │              │
│                           │  - Sync queue    │              │
│                           │  - State         │              │
│                           └──────┬───────────┘              │
└──────────────────────────────────┼──────────────────────────┘
                                   │
                                   │ HTTPS (periodic push)
                                   │ POST /v2/sync/components
                                   │ POST /v2/sync/embeddings
                                   │ POST /v2/sync/annotations
                                   ▼
                        ┌──────────────────────┐
                        │  metabob-analysis-api│
                        │  (Kubernetes cluster)│
                        │  • Validate session  │
                        │  • Store in SurrealDB│
                        │  • Update metrics    │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │     SurrealDB        │
                        │  • code_components   │
                        │  • embeddings        │
                        │  • annotations       │
                        │  • projects (with    │
                        │    sync_status)      │
                        └──────────┬───────────┘
                                   │
                                   │ Query
                                   ▼
                        ┌──────────────────────┐
                        │  metabob-cloud-      │
                        │    dashboard         │
                        │  (Browser)           │
                        │                      │
                        │  Shows sync_status:  │
                        │  • Files indexed     │
                        │  • Components found  │
                        │  • Embeddings gen    │
                        └──────────────────────┘
```

### Component Ownership

| Component | Runs Where | Purpose | Deployed How |
|-----------|-----------|---------|--------------|
| **metabob-mcp** | Local workspace | File watching, parsing, MCP tools | Bundled with agent |
| **metabob-analysis-api** | Kubernetes cluster | Storage, learning, query API | Helm chart |
| **metabob-cloud-dashboard** | Kubernetes cluster | Visualization, management UI | Helm chart |
| **SurrealDB** | Kubernetes cluster | Persistent storage | Helm chart (existing) |

---

## Implications for Implementation

### For metabob-mcp

**Must implement:**
- File watcher (chokidar or similar)
- Local SQLite database (sqlcipher for encryption)
- Sync client (HTTP → analysis-api)
- MCP server (stdio communication)
- Batch processing queue

**Configuration:**
```bash
# Environment variables
WORKSPACE_PATH=/home/user/code/my-project
ANALYSIS_API_URL=http://analysis.minibob.local
API_KEY=sk-ant-***
SQLITE_PATH=./.metabob/workspace.db
SYNC_INTERVAL=30000  # 30 seconds
```

**Startup:**
```bash
# Launched by agent (MiniBob, OpenCode, etc.)
bun run metabob-mcp/src/index.ts
```

### For metabob-analysis-api

**Must implement:**
- Sync endpoints (POST /v2/sync/*)
- Session/project validation
- Batch insert to SurrealDB
- Update project.sync_status
- Handle concurrent pushes from multiple workspaces

**Does NOT need:**
- File watching capability
- Local file system access
- Workspace mounting

### For metabob-cloud-dashboard

**Must query:**
- GET /auth/orgs/{org}/projects (includes sync_status)
- WebSocket events for real-time sync progress

**Must NOT:**
- Access metabob-mcp directly (not possible - local only)
- Assume metabob-mcp is in cluster

### For Deployment (Helm)

**Kubernetes cluster includes:**
- metabob-analysis-api (StatefulSet)
- metabob-cloud-dashboard (Deployment)
- SurrealDB (StatefulSet, existing)
- Redis (Deployment, existing)

**Kubernetes cluster does NOT include:**
- metabob-mcp (runs locally)

---

## Migration Notes

If any code was written assuming centralized metabob-mcp:

1. **Remove Kubernetes manifests** for metabob-mcp
2. **Remove Istio routes** for metabob-mcp
3. **Add sync endpoints** to metabob-analysis-api
4. **Update metabob-mcp** to include file watcher
5. **Add local SQLite** to metabob-mcp
6. **Update agent integration** to launch metabob-mcp as subprocess
7. **Remove any dashboard code** that calls metabob-mcp directly

---

## References

- Updated design: `design-updated.md`
- Original (incorrect) design: `design.md` (line 78: "Sidecar container")
- Dashboard design: `../cloud-dashboard-implementation/design-updated.md`
