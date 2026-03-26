# OpenSpec Architecture Update: metabob-mcp Per-Workspace Model

**Date:** 2026-03-23
**Scope:** analysis-api-extraction + cloud-dashboard-implementation
**Type:** Architecture Correction

---

## Summary

Corrected the architecture for **metabob-mcp** across all OpenSpec documentation:

**Previous (incorrect):** metabob-mcp deployed as centralized Kubernetes service
**Corrected:** metabob-mcp runs locally in each development workspace alongside agent

---

## Files Updated

### 1. analysis-api-extraction

#### Created:
- `openspec/changes/analysis-api-extraction/design-updated.md`
  - Corrected architecture diagram showing per-workspace metabob-mcp
  - Added file watcher component
  - Added local SQLite storage
  - Added sync client for pushing to analysis-api
  - Added sync endpoints to analysis-api (/v2/sync/*)
  - Removed Kubernetes deployment for metabob-mcp

- `openspec/changes/analysis-api-extraction/ARCHITECTURE_CLARIFICATION.md`
  - Detailed explanation of what changed and why
  - Before/after diagrams
  - Implications for each component
  - Migration notes

#### Key Changes:
- metabob-mcp now includes:
  - File watcher (chokidar)
  - Local SQLite database (encrypted, WAL mode)
  - Sync client (HTTP → analysis-api)
  - MCP server (stdio, not HTTP)
  - Batch processing queue

- metabob-analysis-api now includes:
  - POST /v2/sync/components (receive workspace pushes)
  - POST /v2/sync/embeddings (receive workspace pushes)
  - POST /v2/sync/annotations (receive workspace pushes)
  - Updates to project.sync_status (aggregated metrics)

### 2. cloud-dashboard-implementation

#### Created:
- `openspec/changes/cloud-dashboard-implementation/design-updated.md`
  - Clarified dashboard NEVER accesses metabob-mcp directly
  - Updated architecture diagram showing local workspaces
  - Added sync progress visualization components
  - Added useSyncProgress hook
  - Added SyncProgress component
  - Updated WebSocket events to include sync_progress type

#### Key Changes:
- Dashboard queries sync_status from projects table via analysis-api
- sync_status shows accumulated metrics (not percentages):
  - files_indexed
  - components_found
  - embeddings_generated
  - last_sync_at
- WebSocket receives sync_progress events from analysis-api
- No direct connection to metabob-mcp (impossible - it's local)

---

## Architecture Comparison

### Before (Incorrect)

```
┌─────────────────────────────────────┐
│        Kubernetes Cluster           │
│                                     │
│  ┌────────────────┐                 │
│  │ analysis-api   │                 │
│  └────────────────┘                 │
│                                     │
│  ┌────────────────┐                 │
│  │ metabob-mcp    │ ← CENTRALIZED   │
│  │ (Deployment)   │                 │
│  └────────────────┘                 │
│                                     │
│  ┌────────────────┐                 │
│  │ SurrealDB      │                 │
│  └────────────────┘                 │
└─────────────────────────────────────┘
            ▲
            │ MCP tools?
            │ (unclear how this works)
            │
    ┌───────┴────────┐
    │  MiniBob       │
    │  (local agent) │
    └────────────────┘
```

### After (Corrected)

```
┌──────────────────────────────────────────┐
│  Workspace A (Developer Machine)         │
│                                          │
│  ┌────────────┐     ┌──────────────┐    │
│  │  MiniBob   │◄────┤ metabob-mcp  │    │
│  │  (agent)   │ MCP │ (local)      │    │
│  └────────────┘     └──────┬───────┘    │
│                            │            │
│                    Watches codebase     │
│                    Local SQLite         │
└────────────────────────────┼────────────┘
                             │
                             │ HTTPS
                             │ POST /v2/sync/*
                             ▼
            ┌──────────────────────────────┐
            │  Kubernetes Cluster          │
            │                              │
            │  ┌────────────────┐          │
            │  │ analysis-api   │          │
            │  │ (sync endpoints)│         │
            │  └────────┬───────┘          │
            │           │                  │
            │           ▼                  │
            │  ┌────────────────┐          │
            │  │  SurrealDB     │          │
            │  │  (aggregated   │          │
            │  │   metrics)     │          │
            │  └────────┬───────┘          │
            │           │                  │
            │           │ Query            │
            │           ▼                  │
            │  ┌────────────────┐          │
            │  │  dashboard     │          │
            │  └────────────────┘          │
            └──────────────────────────────┘
```

---

## Data Flow: File Change → Dashboard Display

```
1. Developer writes code
   └─► MiniBob executes activity
       └─► Files changed on disk

2. metabob-mcp (local) detects change
   └─► File watcher triggers
       └─► Parse with tree-sitter
           └─► Extract components
               └─► Generate embeddings
                   └─► Store in local SQLite
                       └─► Queue for sync

3. Sync loop (every 30s)
   └─► Batch pending items (50-100)
       └─► POST /v2/sync/components
           └─► POST /v2/sync/embeddings
               └─► POST /v2/sync/annotations

4. metabob-analysis-api receives push
   └─► Validate session/project from JWT
       └─► Insert into SurrealDB
           └─► Update project.sync_status:
               {
                 files_indexed: +N,
                 components_found: +N,
                 embeddings_generated: +N,
                 last_sync_at: now()
               }
           └─► Emit WebSocket event:
               {
                 type: "sync_progress",
                 data: { project_id, files_indexed: N, ... }
               }

5. Dashboard receives update
   └─► WebSocket handler updates UI
       └─► Displays accumulated metrics:
           • Files indexed: 1,247
           • Components found: 3,891
           • Embeddings generated: 3,891
           • Last sync: 2 minutes ago
```

---

## Key Principles

1. **metabob-mcp is local** - runs in each workspace, not centralized
2. **MCP protocol is local** - stdio communication between agent and mcp
3. **Sync is push-based** - workspace pushes to cluster, not pull
4. **Reverse chronological** - newest changes processed first
5. **Aggregated metrics** - dashboard shows totals from all workspaces
6. **Continuous process** - no completion percentage, just work done

---

## Implementation Checklist

### metabob-mcp

- [ ] Add file watcher (chokidar)
- [ ] Add local SQLite database (sqlcipher)
- [ ] Add sync client (HTTP POST to analysis-api)
- [ ] Add batch processing queue
- [ ] Add MCP server (stdio, not HTTP)
- [ ] Add configuration (workspace path, API URL, etc.)

### metabob-analysis-api

- [ ] Add POST /v2/sync/components endpoint
- [ ] Add POST /v2/sync/embeddings endpoint
- [ ] Add POST /v2/sync/annotations endpoint
- [ ] Update project.sync_status on each sync
- [ ] Emit WebSocket sync_progress events
- [ ] Handle concurrent pushes from multiple workspaces

### metabob-cloud-dashboard

- [ ] Add useSyncProgress hook
- [ ] Add SyncProgress component
- [ ] Update ProjectSchema to include sync_status
- [ ] Add sync_progress WebSocket event handler
- [ ] Display accumulated metrics (not percentages)
- [ ] Show "Continuous Sync Active" badge

### Deployment

- [ ] Remove Kubernetes manifests for metabob-mcp
- [ ] Remove Istio routes for metabob-mcp
- [ ] Update Helm charts (only analysis-api + dashboard)
- [ ] Update MiniBob integration to launch metabob-mcp locally
- [ ] Document local development setup

---

## References

- **analysis-api-extraction:**
  - `openspec/changes/analysis-api-extraction/design-updated.md`
  - `openspec/changes/analysis-api-extraction/ARCHITECTURE_CLARIFICATION.md`

- **cloud-dashboard-implementation:**
  - `openspec/changes/cloud-dashboard-implementation/design-updated.md`
  - `openspec/changes/cloud-dashboard-implementation/specs/data-models/spec-updated.md`

- **Related:**
  - User clarification: "metabob-mcp needs to run locally along side the agent executor. Since it has to scan the codebase as changes are made"

---

## Next Steps

1. Review updated specs
2. Confirm architecture aligns with vision
3. Begin implementation with corrected model
4. Update any existing code that assumed centralized metabob-mcp
