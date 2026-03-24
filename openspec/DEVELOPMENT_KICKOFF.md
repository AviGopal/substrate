# Development Kickoff - Analysis API Stack

**Date:** 2026-03-23
**Status:** Ready to Begin
**Change:** analysis-api-extraction

---

## What We're Building

```
┌──────────────────────────────────────────────────────────────────┐
│              UNIFIED ANALYSIS & ACTIVITY STACK                   │
└──────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │  Developers         │
                    │  (Claude, Cursor)   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Cloud Dashboard    │  ← React 19 UI
                    │  (NEW)              │     6 unified tabs
                    └──────────┬──────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Analysis    │  │  Activity    │  │     MCP      │
    │  API (NEW)   │  │  API (✓)     │  │  Server(NEW) │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                 │                  │
           ├─────────────────┼──────────────────┤
           │                 │                  │
           ▼                 ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  CPG Library │  │  SurrealDB   │  │     Redis    │
    │  (NEW)       │  │  (running✓)  │  │  (running✓)  │
    └──────────────┘  └──────────────┘  └──────────────┘


NEW: To be developed
✓:   Already operational
```

---

## Current State Review

### ✅ Contracts (All 6 Complete)

**Location:** `openspec/contracts/`

1. **surrealdb-schema.md** (763 lines)
   - All shared tables defined
   - Graph relations documented
   - Migration strategy included

2. **http-api-v2-analysis.md** (458 lines)
   - 7 HTTP endpoints specified
   - Request/response schemas
   - Performance targets (P50 < 100ms, P99 < 300ms)

3. **http-api-v2-activity.md** (1,045 lines) ← **CREATED TODAY**
   - 30+ endpoints documented
   - Thompson Sampling, impulse resolution
   - Execution traces, learning loop
   - Based on operational implementation

4. **mcp-analysis-tools.md** (687 lines)
   - 7 MCP tools defined
   - Input/output schemas
   - Tool workflow patterns

5. **e2e-tests.md** (542 lines)
   - 6 E2E test scenarios
   - Test manifest pattern (provenance tracking)
   - LIVE data requirements (NO MOCKS!)

6. **cpg-library-api.md** (438 lines) ← **CREATED TODAY**
   - Library API for CPG operations
   - Tree-sitter parsing
   - ONNX embeddings
   - FAISS search

**Status:** All contracts complete and validated ✓

---

### ✅ Orchestration Specs (All 6 Complete)

**Location:** `openspec/repos/`

1. **cpg-inference-ts.yaml**
   - Foundation library (critical path)
   - 13 tasks, ~80 hours
   - No service dependencies

2. **metabob-analysis-api.yaml**
   - Backend orchestration
   - 19 tasks, ~100 hours
   - Depends on: cpg-library, surrealdb

3. **metabob-activity-api.yaml**
   - OPERATIONAL (already deployed)
   - Git: github.com/MetabobProject/metabob-activity-api

4. **minibob.yaml**
   - OPERATIONAL (3 replicas running)
   - Git: github.com/AviGopal/minibob

5. **metabob-mcp.yaml**
   - MCP tool wrapper
   - 6 tasks, ~31 hours
   - Depends on: analysis-api

6. **metabob-cloud-dashboard.yaml**
   - React 19 frontend
   - 10 tasks, ~50 hours
   - Depends on: analysis-api, activity-api

**Status:** All specs complete with deployment configs ✓

---

### ✅ Infrastructure (Running)

```bash
$ kubectl get pods -n activity-system
NAME                            READY   STATUS    RESTARTS   AGE
redis-valkey-6bf55ff7d9-tqc4r   1/1     Running   0          3h
surrealdb-0                     1/1     Running   0          3h
```

**What's Running:**
- ✅ SurrealDB 3.x (statefulset, 1 replica)
- ✅ Redis/Valkey (deployment, 1 replica)

**What's NOT Running (yet):**
- ⏸️ metabob-activity-api (service exists but not deployed)
- ⏸️ minibob (service exists but not deployed)
- ⏸️ metabob-analysis-api (to be developed)
- ⏸️ metabob-cloud-dashboard (to be developed)

---

### ✅ Development Plan (Complete)

**Location:** `openspec/PARALLEL_DEVELOPMENT_SEQUENCE.md`

**Key Highlights:**
- 3 parallel tracks
- 10 weeks critical path (vs 15 weeks sequential)
- Continuous deployment strategy
- Validation gates at every level
- Stub-first implementation pattern

---

## Active OpenSpec Changes

```bash
$ openspec list

analysis-api-extraction (373 tasks, in-progress)
  ├── Proposal: Component extraction from monolithic RPC API
  ├── Design: 51KB comprehensive design document
  ├── Tasks: 50KB task breakdown (48 tasks across 4 repos)
  └── Specs: Per-repo task files created

cloud-dashboard-implementation (0 tasks, no-tasks)
  └── Empty change (can be merged into analysis-api-extraction)

opencode-minibob-integration (0 tasks, no-tasks)
  └── Completed, can be archived
```

**Primary Change:** `analysis-api-extraction`

**Scope:**
- Extract analysis capabilities from Python RPC API
- Build new TypeScript/Bun stack
- Deploy unified dashboard
- Enable MCP tool integration

---

## Development Sequence

### Phase 1: Foundation (WEEKS 1-4)

**Track 1A: CPG Library (CRITICAL PATH)**

```
Repository: repos/cpg-inference-ts
Tasks:      CPG-1 through CPG-13
Duration:   ~80 hours (4 weeks)
Output:     @metabob/cpg-inference npm package

WEEK 1: Foundation
  ☐ CPG-1  Project setup (Bun, tree-sitter, TypeScript)        [8h]
  ☐ CPG-2  Core type definitions                               [6h]
  ☐ CPG-3  Tree-sitter parser wrapper                          [8h]
  ☐ CPG-4  Language-specific parsers (TS, JS, Python)          [10h]

WEEK 2: Graph Construction
  ☐ CPG-5  CodePropertyGraph class                             [8h]
  ☐ CPG-6  Component extraction from AST                       [8h]
  ☐ CPG-7  Dependency relationship builder                     [6h]
  ☐ CPG-8  Incremental update mechanism                        [10h]

WEEK 3: Embeddings & Search
  ☐ CPG-9  ONNX embedding model loader                         [6h]
  ☐ CPG-10 Embedding vector generation                         [8h]
  ☐ CPG-11 FAISS similarity search wrapper                     [6h]

WEEK 4: Queries & Publishing
  ☐ CPG-12 GraphQueryEngine                                    [8h]
  ☐ CPG-13 Package and publish to npm                          [8h]

Validation Gates:
  □ Contract cpg-library-api.md matches implementation
  □ Performance benchmarks vs Python (within 2x)
  □ All tests passing (unit + integration)
  □ Published to npm registry
```

---

**Track 1B: E2E Framework (PARALLEL)**

```
Repository: repos/metabob-cloud-dashboard
Tasks:      E2E-1 through E2E-4
Duration:   ~30 hours (2 weeks)
Output:     Playwright E2E test suite with LIVE data

WEEK 1-2: E2E Framework
  ☐ E2E-1  Playwright setup + test manifest pattern            [6h]
  ☐ E2E-2  Live data E2E: Full Analysis Flow                   [8h]
  ☐ E2E-3  Live data E2E: Co-Change Prediction                 [8h]
  ☐ E2E-4  Live data E2E: Dashboard Integration                [8h]

Validation Gates:
  □ Playwright configured, can navigate dashboard
  □ Test manifest pattern working (provenance tracking)
  □ All E2E tests pass with LIVE data (no mocks!)
  □ Tests integrated into CI/CD pipeline

Why Parallel: E2E framework can test existing activity-api
while CPG library is being developed.
```

---

### Phase 2: Service Layer (WEEKS 5-8)

**Track 2A: Analysis API (CRITICAL PATH)**

```
Repository: repos/metabob-analysis-api
Tasks:      API-1 through API-19
Duration:   ~100 hours (4 weeks)
Output:     Deployed analysis-api service (2 replicas)

Prerequisites: cpg-library@1.0.0 published to npm

WEEK 5: Foundation
  ☐ API-1  Project setup + CPG library integration             [8h]
  ☐ API-2  SurrealDB connection + schema validation           [6h]
  ☐ API-3  Priority ranking endpoint                          [8h]
  ☐ API-4  Codebase search endpoint                           [8h]

WEEK 6: Core Analysis
  ☐ API-5  CPGService (build, update, query)                  [10h]
  ☐ API-6  Component annotation endpoint                      [8h]
  ☐ API-7  EmbeddingService                                    [8h]
  ☐ API-8  Similarity search integration                       [6h]

WEEK 7: Learning & Patterns
  ☐ API-9  Co-change pattern storage                          [6h]
  ☐ API-10 Impact relation graph                              [8h]
  ☐ API-11 OnlineLearningService                              [8h]
  ☐ API-12 Pattern recognition                                [8h]

WEEK 8: Advanced Features
  ☐ API-13 Related changes suggestion (embedding similarity)  [8h]
  ☐ API-14 Hybrid scoring (60% embedding + 40% co-change)     [6h]
  ☐ API-15 Impact analysis endpoint                           [8h]
  ☐ API-16 Problem completion tracking                        [6h]
  ☐ API-17 Implementation spec generation                     [8h]
  ☐ API-18 API integration tests                              [8h]
  ☐ API-19 Helm deployment + health checks                    [6h]

Continuous Deployment Strategy:
  After API-3:  Deploy with GET /v2/analysis/priority only
  After API-6:  Add POST /v2/analysis/annotate
  After API-15: Full functionality

Validation Gates:
  □ All 7 endpoints match http-api-v2-analysis.md
  □ Performance targets met (P50 < 100ms, P99 < 300ms)
  □ Integration tests pass (with cpg-library)
  □ E2E tests pass (with live data)
  □ Helm deployment healthy (2 replicas)
```

---

**Track 2B: MCP Server (PARALLEL, starts Week 5)**

```
Repository: repos/metabob-mcp
Tasks:      MCP-1 through MCP-6
Duration:   ~31 hours (2 weeks)
Output:     @metabob/mcp-analysis npm package

Prerequisites: analysis-api GET /v2/analysis/priority (minimum)

WEEK 5-6: MCP Implementation
  ☐ MCP-1  MCP server setup (stdio transport)                 [6h]
  ☐ MCP-2  get_priority_issues tool                           [4h]
  ☐ MCP-3  search_codebase_issues tool (stub until API-4)     [4h]
  ☐ MCP-4  annotate_component tool (stub until API-6)         [4h]
  ☐ MCP-5  suggest_related_changes tool (stub until API-13)   [4h]
  ☐ MCP-6  analyze_change_impact tool (stub until API-15)     [4h]
           mark_problem_complete tool (stub until API-16)     [3h]
           generate_implementation_spec (stub until API-17)   [2h]

Stub Pattern: Tools deploy immediately, implement incrementally
as backend endpoints become available.

Validation Gates:
  □ All 7 tools match mcp-analysis-tools.md contract
  □ Test with actual AI agent (Claude/Cursor)
  □ Error handling matches contract
  □ Published to npm registry
```

---

### Phase 3: Integration (WEEKS 9-10)

**Track 3A: Dashboard Development**

```
Repository: repos/metabob-cloud-dashboard
Tasks:      DASH-1 through DASH-6
Duration:   ~50 hours (2 weeks)
Output:     Deployed dashboard (2 replicas)

Prerequisites: analysis-api deployed, activity-api deployed

WEEK 9: Core UI
  ☐ DASH-1 React 19 + Bun setup with shadcn                   [6h]
  ☐ DASH-2 AnalysisView tab (priority issues, search)         [8h]
  ☐ DASH-3 CoChangeView tab (suggestions, patterns)           [8h]
  ☐ DASH-4 ActivityView tab (templates, executions)           [8h]

WEEK 10: Integration & Polish
  ☐ DASH-5 Live data polling + WebSocket integration          [8h]
  ☐ DASH-6 API client integration + error handling            [6h]

Validation Gates:
  □ All 6 tabs render without errors
  □ Run E2E tests with Playwright (LIVE data!)
  □ Verify API integration matches contracts
  □ Test responsive design
  □ Performance: Dashboard loads < 2s
  □ Helm deployment healthy (2 replicas)
```

---

## Initial Deployment State

Before we start development, let's deploy the **existing operational services**:

```bash
# Deploy activity-api (already coded, just needs deployment)
cd repos/metabob-activity-api
docker build -t metabob-activity-api:latest .

# Deploy minibob (already coded, just needs deployment)
cd repos/minibob
docker build -t minibob:latest .

# Deploy via helmfile
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync

# Verify
kubectl get pods -n activity-system
# Should see:
# - surrealdb-0
# - redis-valkey-xxx
# - metabob-activity-api-xxx
# - minibob-xxx (3 replicas)
```

**This gives us a WORKING baseline to validate against!**

---

## First Actions (RIGHT NOW)

### Step 1: Deploy Operational Services

```bash
# Build images for existing services
./build-activity-system.sh

# Deploy full stack (existing services)
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync

# Verify health
curl http://api.minibob.local/health | jq
# Should return: {"status": "healthy", ...}
```

### Step 2: Verify E2E Test Baseline

```bash
# Install Playwright
cd repos/metabob-cloud-dashboard
bun add -d @playwright/test

# Run baseline E2E test against activity-api
bun playwright test --grep "activity-api baseline"
# This should pass with existing activity-api
```

### Step 3: Start CPG Library Development (Track 1A)

```bash
# Create cpg-inference-ts repository structure
cd repos/cpg-inference-ts
mkdir -p src/{parsers,graph,embedding,search,query}
mkdir -p test/{unit,integration,benchmark}

# Initialize project (CPG-1)
bun init
bun add -d typescript @types/node @types/bun

# Install dependencies
bun add tree-sitter tree-sitter-typescript tree-sitter-javascript tree-sitter-python
bun add onnxruntime-node
bun add faiss-node  # or alternative FAISS binding

# Create first test (TDD approach)
vim test/unit/parser.test.ts
```

### Step 4: Start E2E Framework (Track 1B, parallel)

```bash
# Create E2E test structure
cd repos/metabob-cloud-dashboard
mkdir -p tests/e2e/{fixtures,utils,specs}

# Create test manifest utilities (E2E-1)
vim tests/e2e/utils/test-manifest.ts
# Implement provenance tracking pattern
```

---

## Success Metrics

**After Phase 1 (Week 4):**
- ✅ CPG library published to npm
- ✅ E2E framework validates activity-api
- ✅ Performance benchmarks pass
- ✅ Foundation validated

**After Phase 2 (Week 8):**
- ✅ Analysis-api deployed and healthy
- ✅ MCP server published to npm
- ✅ All 7 analysis tools working
- ✅ E2E tests passing with live data

**After Phase 3 (Week 10):**
- ✅ Dashboard deployed and accessible
- ✅ All 6 tabs functional
- ✅ Full stack operational
- ✅ Continuous deployment validated

---

## Next Command

```bash
# Start development NOW:
cd repos/cpg-inference-ts && bun init
cd ../metabob-cloud-dashboard && bun add -d @playwright/test

# Or deploy existing services first:
./deploy-activity-system.sh
```

**Ready to begin! 🚀**
