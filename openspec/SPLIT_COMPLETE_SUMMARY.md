# Spec Split - Completion Summary

**Date:** 2026-03-23
**Status:** ✅ Orchestration structure complete, ready for implementation

---

## What We've Accomplished

### ✅ Contracts Created (Shared Interfaces)

1. **openspec/contracts/surrealdb-schema.md**
   - Database contract (all shared tables)
   - Graph relations
   - Migration strategy

2. **openspec/contracts/http-api-v2-analysis.md**
   - 7 HTTP endpoints
   - Request/response schemas
   - Performance targets

3. **openspec/contracts/mcp-analysis-tools.md**
   - 7 MCP tools
   - Input/output schemas
   - Tool workflow

4. **openspec/contracts/e2e-tests.md**
   - 6 E2E test scenarios
   - Test manifest pattern
   - Live data requirements

### ✅ Per-Repo Tasks Split

**repos/cpg-inference-ts/openspec/tasks.md**
- 13 tasks (CPG-1 through CPG-13)
- ~80 hours estimated
- Python → TypeScript translation

**repos/metabob-analysis-api/openspec/tasks.md**
- 19 tasks (API-1 through API-19)
- ~100 hours estimated
- Backend orchestration + services

**repos/metabob-mcp/openspec/tasks.md**
- 6 tasks (MCP-1 through MCP-6)
- ~31 hours estimated
- MCP server + 7 tools

**repos/metabob-cloud-dashboard/openspec/tasks.md**
- 10 tasks (DASH-1 through DASH-6, E2E-1 through E2E-4)
- ~50 hours estimated
- React UI + E2E tests

### ✅ Repository Orchestration Specs (All 6 Complete!)

**Centralized in openspec/repos/ (not in sub-repos!)**

**openspec/repos/cpg-inference-ts.yaml**
- Provides: cpg-library (1.0.0)
- Git: TBD (new repo)
- Deployment: npm library
- Dependencies: None (external npm packages only)

**openspec/repos/metabob-analysis-api.yaml**
- Provides: http-api-v2-analysis (1.0.0)
- Git: none (local repo, no remote yet)
- Deployment: helm/charts/metabob-analysis-api, 2 replicas
- Dependencies: surrealdb-schema, cpg-library

**openspec/repos/metabob-activity-api.yaml**
- Provides: http-api-v2-activity (1.0.0)
- Git: git@github.com:MetabobProject/metabob-activity-api.git
- Deployment: helm/charts/metabob-activity-api, 2 replicas
- Dependencies: surrealdb-schema

**openspec/repos/minibob.yaml**
- Provides: activity-execution-vessel, local-impulse-resolver
- Git: git@github.com:AviGopal/minibob.git
- Deployment: helm/charts/devbob, 3 replicas
- Dependencies: http-api-v2-activity, surrealdb-schema

**openspec/repos/metabob-mcp.yaml**
- Provides: mcp-analysis-tools (1.0.0)
- Git: none (local repo, no remote yet)
- Deployment: npm package (MCP server via stdio)
- Dependencies: http-api-v2-analysis

**openspec/repos/metabob-cloud-dashboard.yaml**
- Provides: web-ui (1.0.0)
- Git: none (local repo, no remote yet)
- Deployment: helm/charts/metabob-cloud-dashboard, 2 replicas
- Dependencies: http-api-v2-analysis, http-api-v2-activity

### ✅ Dependency Graph

```
                    surrealdb-schema (contract)
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   cpg-library    metabob-activity-api  (other consumers)
   (inference)           │
         │               │ provides
         │               │ http-api-v2-activity
         │               │
         │               ├──────────────┐
         │               ▼              ▼
         │           minibob      metabob-cloud-dashboard
         │          (vessel)            │
         │                              │
         ▼                              │
  metabob-analysis-api                 │
         │                              │
         │ provides                     │
         │ http-api-v2-analysis         │
         │                              │
         ├──────────────┬───────────────┘
         ▼              ▼
    metabob-mcp   metabob-cloud-dashboard
         │
         │ provides
         │ mcp-analysis-tools
         │
         └──────────────────────────────▶
              metabob-cloud-dashboard
                  (optional MCP)
```

**Deployment Order:**
1. SurrealDB (database)
2. Parallel: cpg-inference-ts + metabob-activity-api
3. Parallel: metabob-analysis-api + minibob
4. Parallel: metabob-mcp
5. metabob-cloud-dashboard (depends on all)

### ✅ Documentation

**openspec/SPEC_SPLIT_GUIDE.md**
- Structure explanation
- Agent deployment model
- Ripple workflow
- FAQ

**openspec/SPLIT_COMPLETE_SUMMARY.md** (this file)
- Current status
- Next steps

---

## Current Structure

```
metabob-devbob/                    ← Orchestration repo (source of truth)
│
├── openspec/
│   ├── contracts/                 ← Shared interfaces (4 complete, 1 needed)
│   │   ├── surrealdb-schema.md    ✅
│   │   ├── http-api-v2-analysis.md ✅
│   │   ├── http-api-v2-activity.md ⚠️ (MISSING!)
│   │   ├── mcp-analysis-tools.md  ✅
│   │   └── e2e-tests.md           ✅
│   │
│   ├── repos/                     ← Repo orchestration specs ✅ ALL COMPLETE
│   │   ├── cpg-inference-ts.yaml
│   │   ├── metabob-analysis-api.yaml
│   │   ├── metabob-activity-api.yaml
│   │   ├── minibob.yaml
│   │   ├── metabob-mcp.yaml
│   │   └── metabob-cloud-dashboard.yaml
│   │
│   ├── changes/                   ← Work planning
│   │   └── analysis-api-extraction/
│   │
│   ├── SPEC_SPLIT_GUIDE.md
│   └── SPLIT_COMPLETE_SUMMARY.md  ← This file
│
├── repos/                         ← Implementation (working copies)
│   ├── cpg-inference-ts/
│   │   └── openspec/
│   │       ├── internal/ (TO DO)
│   │       └── tasks.md ✅
│   │
│   ├── metabob-analysis-api/
│   │   └── openspec/
│   │       ├── internal/ (TO DO)
│   │       └── tasks.md ✅
│   │
│   ├── metabob-activity-api/      ← Existing operational repo
│   │   └── openspec/
│   │       └── internal/ (TO DO)
│   │
│   ├── minibob/                   ← Existing operational repo
│   │   └── openspec/
│   │       └── internal/ (TO DO)
│   │
│   ├── metabob-mcp/
│   │   └── openspec/
│   │       ├── internal/ (TO DO)
│   │       └── tasks.md ✅
│   │
│   └── metabob-cloud-dashboard/
│       └── openspec/
│           ├── internal/ (TO DO)
│           └── tasks.md ✅
│
└── helm/                          ← Continuous deployment
    ├── activity-system-minimal.yaml.gotmpl
    └── charts/
        ├── devbob/
        ├── metabob-activity-api/
        ├── metabob-analysis-api/
        └── metabob-cloud-dashboard/
```

---

## What Remains

### ⏸️ Internal Specs (Extract from monolithic)

**repos/cpg-inference-ts/openspec/internal/**
- translation.md (Python → TS mapping)
- performance.md (Benchmarks)

**repos/metabob-analysis-api/openspec/internal/**
- architecture.md (Service design)
- services.md (CPG, Embedding, Learning)
- performance.md (Targets)

**repos/metabob-mcp/openspec/internal/**
- implementation.md (Tool mapping)

**repos/metabob-cloud-dashboard/openspec/internal/**
- components.md (React structure)
- integration.md (API clients)

### ⏸️ Meta Specs (Deployment)

**openspec/meta/**
- deployment.md (Helmfile, K8s)
- integration.md (Service mesh)
- tasks.md (DEPLOY-1 through DEPLOY-6)

### ⏸️ CPG Library Contract

**openspec/contracts/cpg-library-api.md**
- Or in repos/cpg-inference-ts/openspec/contracts/api.md
- Library interface for consumers

---

## Agent Assignment

Ready to deploy agents:

**Contract Agents:**
- db-schema-agent → openspec/contracts/surrealdb-schema.md
- analysis-api-contract-agent → openspec/contracts/http-api-v2-analysis.md
- activity-api-contract-agent → openspec/contracts/http-api-v2-activity.md (TO CREATE)
- mcp-tools-contract-agent → openspec/contracts/mcp-analysis-tools.md
- e2e-tests-agent → openspec/contracts/e2e-tests.md

**Repo Agents:**
- cpg-library-agent → repos/cpg-inference-ts
- analysis-api-agent → repos/metabob-analysis-api
- activity-api-agent → repos/metabob-activity-api (existing repo)
- minibob-vessel-agent → repos/minibob (existing repo)
- mcp-agent → repos/metabob-mcp
- cloud-dashboard-agent → repos/metabob-cloud-dashboard

---

## Next Steps (In Order)

### Option A: Complete Structure First
1. Create remaining manifest.yaml files (3 files)
2. Extract internal/ specs from monolithic (8 files)
3. Create meta/ deployment specs (3 files)
4. Validate all dependencies resolve
5. Start implementation

**Pros:** Complete structure, clear boundaries
**Cons:** More upfront work before implementation

### Option B: Start Implementation Immediately
1. Pick one repo (e.g., cpg-inference-ts)
2. Create minimal manifest + internal specs for that repo
3. Implement and validate
4. Prove the structure works
5. Scale to other repos

**Pros:** Faster to working code
**Cons:** May need to refine structure

### Option C: Hybrid Approach
1. Create all manifest.yaml files (quick)
2. Start implementing cpg-inference-ts (foundation)
3. Extract internal specs as needed
4. Refine structure based on learnings

**Pros:** Balance of structure and speed
**Cons:** More coordination needed

---

## Validation Checklist

Before delegating to agents:

**Contracts:**
- [ ] All 4 contracts have clear owners
- [ ] Versions defined (all 1.0.0)
- [ ] Consumers listed
- [ ] Migration guides included

**Tasks:**
- [ ] All tasks have acceptance criteria
- [ ] Dependencies declared (Depends On)
- [ ] Ripple checks included
- [ ] Estimates reasonable

**Manifests:**
- [ ] Dependencies match actual usage
- [ ] Ripple checklists complete
- [ ] Provides/depends_on versioned

**Contracts ↔ Implementation:**
- [ ] http-api-v2-analysis matches API tasks
- [ ] mcp-analysis-tools matches MCP tasks
- [ ] e2e-tests referenced in dashboard tasks

---

## Success Metrics

**Structure Success:**
- ✅ Tasks split by repo (48 total tasks)
- ✅ Contracts define interfaces (4/5 contracts, missing http-api-v2-activity)
- ✅ Ripple workflow documented
- ✅ All repo orchestration specs created (6/6 in openspec/repos/)
- ✅ Orchestration model established (metabob-devbob = source of truth)
- ✅ Deployment configuration (helm charts, k8s, health checks)
- ✅ Validation requirements (tests, E2E with live data)
- ✅ Commit traceability convention (spec → impl → deploy)
- ⏸️ Internal specs extracted (0/6 needed)
- ⏸️ http-api-v2-activity contract (critical for minibob/activity-api)

**Implementation Success (Future):**
- [ ] One repo fully implemented end-to-end
- [ ] Ripple workflow validated
- [ ] E2E tests pass with live data
- [ ] Agents can work independently

---

## Commands for Next Steps

**Extract internal specs:**
```bash
# Read from monolithic spec
less openspec/changes/analysis-api-extraction/design.md

# Extract relevant sections to:
vim repos/metabob-analysis-api/openspec/internal/architecture.md
# etc.
```

**Start implementation (example):**
```bash
cd repos/cpg-inference-ts
bun install
# Follow tasks.md CPG-1 through CPG-13
```

---

## Exit Explore Mode

We've completed the spec splitting exploration! Ready to:

1. **Continue in explore mode** - Extract internal specs
2. **Exit and create change** - Formalize as OpenSpec change
3. **Exit and implement** - Start coding on one repo

What would you like to do next?
