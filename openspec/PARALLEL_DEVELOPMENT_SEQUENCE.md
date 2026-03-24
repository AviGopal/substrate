# Parallel Development Sequence

**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-03-23

## Overview

This document defines the sequencing strategy for parallel development across 6 repositories while maintaining:
- **Alignment**: All implementations match contracts
- **Ripple Integrity**: Changes propagate correctly through dependencies
- **System Availability**: Each task keeps the system running
- **Spec Constraints**: Design decisions enforced via contracts

---

## Dependency Graph

```
                    ┌─────────────────┐
                    │  SurrealDB 3.x  │
                    │   (running ✓)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────────┐   ┌────────────┐
│ cpg-library  │   │ activity-api     │   │  (others)  │
│ (FOUNDATION) │   │ (OPERATIONAL ✓)  │   │            │
│              │   │                  │   │            │
│ 13 tasks     │   │ No new tasks     │   │            │
│ ~80 hours    │   │ (existing code)  │   │            │
└──────┬───────┘   └────────┬─────────┘   └────────────┘
       │                    │
       │                    │
       ▼                    ▼
┌──────────────┐   ┌──────────────────┐
│ analysis-api │   │     minibob      │
│              │   │ (OPERATIONAL ✓)  │
│ 19 tasks     │   │                  │
│ ~100 hours   │   │ No new tasks     │
└──────┬───────┘   │ (existing code)  │
       │           └────────┬─────────┘
       │                    │
       ├────────────────────┤
       │                    │
       ▼                    ▼
┌──────────────┐   ┌──────────────────┐
│     mcp      │   │  cloud-dashboard │
│              │   │                  │
│ 6 tasks      │   │ 10 tasks (4 dev  │
│ ~31 hours    │   │ + 6 E2E tests)   │
└──────────────┘   │ ~50 hours        │
                   └──────────────────┘


CRITICAL PATH: cpg-library → analysis-api → dashboard
PARALLEL TRACKS:
  Track 1: cpg-library development (FOUNDATION)
  Track 2: activity-api contracts (already done!)
  Track 3: Dashboard E2E testing (can start now!)
```

---

## Phase Breakdown

### Phase 0: Bootstrap (COMPLETE ✓)

**Status:** Infrastructure running, contracts defined

**What's Running:**
- SurrealDB 3.x (statefulset, 1 replica)
- Redis/Valkey (deployment, 1 replica)

**What's Defined:**
- ✅ openspec/contracts/surrealdb-schema.md
- ✅ openspec/contracts/http-api-v2-analysis.md
- ✅ openspec/contracts/http-api-v2-activity.md
- ✅ openspec/contracts/mcp-analysis-tools.md
- ✅ openspec/contracts/e2e-tests.md
- ✅ openspec/repos/*.yaml (all 6 orchestration specs)

**Operational Services:**
- metabob-activity-api (running, serving /v2/activities/*)
- minibob (running, 3 replicas for boredom activities)

**Blockers Cleared:**
- All contracts exist
- All repo specs exist
- Infrastructure healthy

**Next:** Phase 1 can begin in parallel tracks!

---

### Phase 1: Foundation Layer (PARALLEL)

**Duration:** ~80 hours (critical path)
**Goal:** Build cpg-library foundation for analysis-api

#### Track 1A: CPG Library Translation (CRITICAL PATH)

**Repository:** repos/cpg-inference-ts
**Tasks:** CPG-1 through CPG-13 (openspec/repos/cpg-inference-ts.yaml)
**Contract:** openspec/contracts/cpg-library-api.md (TO CREATE!)
**Dependencies:** None (pure library, npm packages only)
**Agent:** cpg-library-agent

**Task Sequence:**
```
WEEK 1: Foundation
  CPG-1  Project setup (Bun, tree-sitter, TypeScript)        [8h]
  CPG-2  Core type definitions                               [6h]
  CPG-3  Tree-sitter parser wrapper                          [8h]
  CPG-4  Language-specific parsers (TS, JS, Python)          [10h]

WEEK 2: Graph Construction
  CPG-5  CodePropertyGraph class                             [8h]
  CPG-6  Component extraction from AST                       [8h]
  CPG-7  Dependency relationship builder                     [6h]
  CPG-8  Incremental update mechanism                        [10h]

WEEK 3: Embeddings & Search
  CPG-9  ONNX embedding model loader                         [6h]
  CPG-10 Embedding vector generation                         [8h]
  CPG-11 FAISS similarity search wrapper                     [6h]

WEEK 4: Queries & Publishing
  CPG-12 GraphQueryEngine                                    [8h]
  CPG-13 Package and publish to npm                          [8h]

TOTAL: ~100 hours (80 hours with parallelization)
```

**Validation Gates:**
- After CPG-5: Can build CPG from TypeScript file ✓
- After CPG-8: Can update graph incrementally ✓
- After CPG-11: Can perform similarity search ✓
- After CPG-13: Published to npm, analysis-api can install ✓

**Ripple Checklist:**
```yaml
- [ ] Contract matches implementation (cpg-library-api.md)
- [ ] Performance benchmarks vs Python baseline
  - [ ] Parse performance within 2x
  - [ ] Query performance within 1.5x
  - [ ] Memory usage < Python
- [ ] All tests passing (unit + integration)
- [ ] Published to npm (@metabob/cpg-inference)
- [ ] Notify: openspec/repos/metabob-analysis-api.yaml
```

**CRITICAL:** This is the critical path! All analysis features depend on CPG library.

---

#### Track 1B: Dashboard E2E Framework (PARALLEL - CAN START NOW!)

**Repository:** repos/metabob-cloud-dashboard
**Tasks:** E2E-1 through E2E-4 (from tasks.md)
**Dependencies:** None! (Uses existing activity-api)
**Agent:** cloud-dashboard-agent

**Why Parallel:** E2E framework can be built against existing activity-api while CPG library is being developed.

**Task Sequence:**
```
E2E-1  Playwright setup + test manifest pattern             [6h]
E2E-2  Live data E2E: Full Analysis Flow                    [8h]
E2E-3  Live data E2E: Co-Change Prediction                  [8h]
E2E-4  Live data E2E: Dashboard Integration                 [8h]

TOTAL: 30 hours
```

**Validation Gates:**
- After E2E-1: Playwright configured, can navigate dashboard ✓
- After E2E-2: Can execute full analysis flow with LIVE data ✓
- After E2E-4: All E2E tests passing with provenance tracking ✓

**IMPORTANT:** These E2E tests become the VALIDATION GATE for all future changes!

---

### Phase 2: Service Layer (PARALLEL after cpg-library published)

**Duration:** ~100 hours (critical path)
**Prerequisites:** cpg-library published to npm

#### Track 2A: Analysis API Implementation (CRITICAL PATH)

**Repository:** repos/metabob-analysis-api
**Tasks:** API-1 through API-19 (from tasks.md)
**Contract:** openspec/contracts/http-api-v2-analysis.md
**Dependencies:** cpg-library@1.0.0, surrealdb-schema
**Agent:** analysis-api-agent

**Task Sequence:**
```
WEEK 1: Foundation
  API-1  Project setup + CPG library integration              [8h]
  API-2  SurrealDB connection + schema validation            [6h]
  API-3  Priority ranking endpoint                           [8h]
  API-4  Codebase search endpoint                            [8h]

WEEK 2: Core Analysis
  API-5  CPGService (build, update, query)                   [10h]
  API-6  Component annotation endpoint                       [8h]
  API-7  EmbeddingService                                     [8h]
  API-8  Similarity search integration                        [6h]

WEEK 3: Learning & Patterns
  API-9  Co-change pattern storage                           [6h]
  API-10 Impact relation graph                               [8h]
  API-11 OnlineLearningService                               [8h]
  API-12 Pattern recognition                                  [8h]

WEEK 4: Advanced Features
  API-13 Related changes suggestion (embedding similarity)   [8h]
  API-14 Hybrid scoring (60% embedding + 40% co-change)      [6h]
  API-15 Impact analysis endpoint                            [8h]
  API-16 Problem completion tracking                         [6h]

WEEK 5: Spec Generation & Deployment
  API-17 Implementation spec generation                       [8h]
  API-18 API integration tests                                [8h]
  API-19 Helm deployment + health checks                      [6h]

TOTAL: ~140 hours
```

**Continuous Deployment Strategy:**
```
After API-3:  Deploy with GET /v2/analysis/priority only
              → System can return priority issues (empty OK)
              → Health check passes
              → E2E tests adjusted to expect limited functionality

After API-6:  Add POST /v2/analysis/annotate
              → Now can store annotations
              → Still missing search, but system functional

After API-15: Add all remaining endpoints
              → Full functionality
              → E2E tests validate complete flow
```

**Ripple Checklist:**
```yaml
- [ ] All 7 endpoints match http-api-v2-analysis.md contract
- [ ] Performance targets met (P50 < 100ms, P99 < 300ms)
- [ ] Integration tests pass (with cpg-library)
- [ ] E2E tests pass (with live data)
- [ ] Helm deployment healthy (2 replicas)
- [ ] Notify: openspec/repos/metabob-mcp.yaml
- [ ] Notify: openspec/repos/metabob-cloud-dashboard.yaml
```

---

#### Track 2B: MCP Server (PARALLEL - starts when API-3 complete)

**Repository:** repos/metabob-mcp
**Tasks:** MCP-1 through MCP-6 (from tasks.md)
**Contract:** openspec/contracts/mcp-analysis-tools.md
**Dependencies:** analysis-api (GET /v2/analysis/priority minimum)
**Agent:** mcp-agent

**Why Parallel:** Can start once priority endpoint exists, build stubs for remaining tools.

**Task Sequence:**
```
WEEK 1: Foundation
  MCP-1  MCP server setup (stdio transport)                  [6h]
  MCP-2  get_priority_issues tool                            [4h]
  MCP-3  search_codebase_issues tool (stub until API-4)      [4h]
  MCP-4  annotate_component tool (stub until API-6)          [4h]

WEEK 2: Advanced Tools
  MCP-5  suggest_related_changes tool (stub until API-13)    [4h]
  MCP-6  analyze_change_impact tool (stub until API-15)      [4h]
         mark_problem_complete tool (stub until API-16)      [3h]
         generate_implementation_spec tool (stub until API-17) [2h]

TOTAL: ~31 hours
```

**Stub Pattern:**
```typescript
// Initial implementation (when backend not ready)
export async function suggest_related_changes(input) {
  return {
    suggestions: [],
    message: "Backend endpoint not yet implemented",
    available: false
  };
}

// Final implementation (after API-13 complete)
export async function suggest_related_changes(input) {
  const response = await fetch(
    `${ANALYSIS_API_URL}/v2/analysis/suggest-changes`,
    { method: 'POST', body: JSON.stringify(input) }
  );
  return response.json();
}
```

**Benefits:**
- MCP server deployable immediately
- Tools work incrementally as backend completes
- AI agents get feedback about availability
- System always functional

**Ripple Checklist:**
```yaml
- [ ] All 7 tools match mcp-analysis-tools.md contract
- [ ] Test with actual AI agent (Claude/Cursor)
- [ ] Error handling matches contract (with suggestions)
- [ ] Published to npm (@metabob/mcp-analysis)
- [ ] Notify: openspec/repos/metabob-cloud-dashboard.yaml
```

---

### Phase 3: Integration Layer (PARALLEL)

**Duration:** ~50 hours
**Prerequisites:** analysis-api deployed, mcp published

#### Track 3A: Dashboard Development

**Repository:** repos/metabob-cloud-dashboard
**Tasks:** DASH-1 through DASH-6 (from tasks.md)
**Contract:** openspec/contracts/ui-routes.md
**Dependencies:** analysis-api, activity-api (both running)
**Agent:** cloud-dashboard-agent

**Task Sequence:**
```
WEEK 1: Core UI
  DASH-1 React 19 + Bun setup with shadcn                    [6h]
  DASH-2 AnalysisView tab (priority issues, search)          [8h]
  DASH-3 CoChangeView tab (suggestions, patterns)            [8h]
  DASH-4 ActivityView tab (templates, executions)            [8h]

WEEK 2: Integration & Polish
  DASH-5 Live data polling + WebSocket integration           [8h]
  DASH-6 API client integration + error handling             [6h]

TOTAL: 44 hours (plus 30h E2E from Phase 1)
```

**Continuous Deployment:**
```
After DASH-2: Deploy with Analysis tab only
              → Can view priority issues
              → Other tabs show "Coming Soon"
              → System functional, limited features

After DASH-4: All tabs functional
              → Full feature set
              → E2E tests validate all tabs
```

**Ripple Checklist:**
```yaml
- [ ] All 6 tabs render without errors
- [ ] Run E2E tests with Playwright (LIVE data!)
- [ ] Verify API integration matches contracts
  - [ ] http-api-v2-analysis endpoints
  - [ ] http-api-v2-activity endpoints
- [ ] Test responsive design
- [ ] Validate live data displays correctly
- [ ] Performance: Dashboard loads < 2s
- [ ] Helm deployment healthy (2 replicas)
```

---

## Parallel Execution Summary

```
┌──────────────────────────────────────────────────────────────┐
│                    PARALLEL TIMELINE                         │
└──────────────────────────────────────────────────────────────┘

WEEK 1:
  Track 1A: CPG-1, CPG-2, CPG-3, CPG-4                [32h]
  Track 1B: E2E-1, E2E-2                               [14h]

WEEK 2:
  Track 1A: CPG-5, CPG-6, CPG-7, CPG-8                [32h]
  Track 1B: E2E-3, E2E-4                               [16h]

WEEK 3:
  Track 1A: CPG-9, CPG-10, CPG-11                     [20h]
  Track 2A: API-1, API-2 (waiting for CPG publish)    [14h]

WEEK 4:
  Track 1A: CPG-12, CPG-13 (publish!)                 [16h]
  Track 2A: API-3, API-4, API-5                        [26h]
  Track 2B: MCP-1, MCP-2, MCP-3 (starts when API-3 done)

WEEK 5-8:
  Track 2A: API-6 through API-19                      [100h]
  Track 2B: MCP-4, MCP-5, MCP-6                       [15h]
  Track 3A: DASH-1, DASH-2, DASH-3                    [22h]

WEEK 9:
  Track 3A: DASH-4, DASH-5, DASH-6                    [22h]
  Final E2E validation across all services


CRITICAL PATH: CPG (4 weeks) → Analysis API (4 weeks) → Dashboard (2 weeks)
TOTAL TIME: ~10 weeks with full parallelization
WITHOUT PARALLELIZATION: ~15 weeks
```

---

## Continuous Availability Strategy

### Principle: Every Deployment Keeps System Running

**Strategy 1: Stub-First Implementation**

Services deploy with stub endpoints immediately:

```typescript
// Week 1: Deploy analysis-api with stubs
app.get('/v2/analysis/priority', (c) => {
  return c.json({ issues: [], total: 0 }); // Empty but valid
});

// Week 3: Implement actual logic
app.get('/v2/analysis/priority', async (c) => {
  const issues = await db.query('SELECT * FROM analysis_problems');
  return c.json({ issues, total: issues.length });
});
```

**Benefits:**
- System always responds (no 404s)
- Contracts maintained from day 1
- Dashboard can integrate early
- Health checks pass

---

**Strategy 2: Feature Flags**

For complex features, hide behind flags:

```typescript
const ENABLE_EMBEDDING_SEARCH = process.env.ENABLE_EMBEDDING_SEARCH === 'true';

app.post('/v2/analysis/codebase/search', async (c) => {
  if (!ENABLE_EMBEDDING_SEARCH) {
    return c.json({
      results: [],
      message: "Embedding search not yet enabled",
      fallback_to_text_search: true
    });
  }

  // Full implementation
  const results = await embeddingService.search(...);
  return c.json({ results });
});
```

**Dashboard adapts:**
```tsx
{searchResults.message && (
  <Alert>
    <InfoIcon />
    <AlertDescription>{searchResults.message}</AlertDescription>
  </Alert>
)}
```

---

**Strategy 3: Blue/Green Services**

For breaking changes, run both versions:

```yaml
# analysis-api-v1 (existing stub)
# analysis-api-v2 (new implementation)
# Istio routes traffic based on header

apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: analysis-api
spec:
  http:
  - match:
    - headers:
        x-api-version:
          exact: "2"
    route:
    - destination:
        host: analysis-api-v2
  - route:
    - destination:
        host: analysis-api-v1  # default
```

---

### Rollback Procedure

**Automated (Helm):**
```bash
# If health checks fail, Kubernetes won't route traffic to new pods
# Manual rollback if needed:
helm rollback metabob-analysis-api -n activity-system
```

**E2E Validation Gate:**
```bash
# Before marking deployment successful:
./validate-e2e-tests.sh
# If E2E tests fail:
#   - Log failure
#   - Alert team
#   - Rollback automatically
```

---

## Ripple Propagation

### When Contract Changes

**Example: Adding new endpoint to analysis-api**

1. **Update Contract First**
   ```bash
   vim openspec/contracts/http-api-v2-analysis.md
   # Add: GET /v2/analysis/code-quality
   ```

2. **Check Ripple**
   ```bash
   grep -r "http-api-v2-analysis" openspec/repos/
   # → metabob-analysis-api.yaml (implements it)
   # → metabob-mcp.yaml (wraps it in MCP tool)
   # → metabob-cloud-dashboard.yaml (consumes it)
   ```

3. **Update All Consumers**
   - Add task to analysis-api: API-20
   - Add task to mcp: MCP-7 (new tool)
   - Add task to dashboard: DASH-7 (display quality)

4. **Validate Ripple Checklist**
   ```yaml
   analysis-api:
     - [ ] Implement GET /v2/analysis/code-quality
     - [ ] Update API tests
     - [ ] Update contract reference
     - [ ] Notify mcp, dashboard

   mcp:
     - [ ] Add get_code_quality tool
     - [ ] Test with AI agent
     - [ ] Notify dashboard

   dashboard:
     - [ ] Add Quality tab
     - [ ] Run E2E tests
     - [ ] Validate live data
   ```

---

## Validation Gates

### Per-Task Validation

**Every task must pass:**
```bash
# 1. Unit tests
bun test

# 2. Type checking
bun run typecheck

# 3. Lint
bun run lint

# 4. Build
bun run build

# 5. Contract validation (if applicable)
./validate-contract.sh <contract-name>
```

---

### Per-Service Validation

**Before marking service complete:**

```bash
# 1. All tasks complete
[ ] Check tasks.md for completion status

# 2. Integration tests pass
bun run test-integration

# 3. Performance benchmarks met
[ ] P50 < target
[ ] P99 < target

# 4. Health check passes
curl http://localhost:8080/health | jq .status
# → "healthy"

# 5. Helm deployment succeeds
helm upgrade --install <service> ./helm/charts/<service>
kubectl wait --for=condition=ready pod -l app=<service> --timeout=120s

# 6. E2E tests pass (with LIVE data)
./run-e2e-tests.sh --service <service>
```

---

### Cross-Service Validation

**Before marking phase complete:**

```bash
# 1. All services healthy
kubectl get pods -n activity-system | grep Running
# → All pods Running

# 2. Contract alignment verified
./validate-all-contracts.sh

# 3. Ripple checklist complete
# → Check each service's ripple section

# 4. Full E2E suite passes
./run-all-e2e-tests.sh
# → All 6 E2E scenarios pass with LIVE data

# 5. Performance under load
./load-test.sh --duration 5m --rps 100
# → All services respond within targets
```

---

## Commit Traceability

### Format

```
type: description (refs: change-id#task-id spec: contract@version)
```

### Examples

```bash
# CPG Library
git commit -m "feat: add tree-sitter parser wrapper
(refs: analysis-api-extraction#CPG-3 spec: cpg-library-api@1.0.0)"

# Analysis API
git commit -m "feat: implement priority ranking endpoint
(refs: analysis-api-extraction#API-3 spec: http-api-v2-analysis@1.0.0)"

# MCP Server
git commit -m "feat: add get_priority_issues tool
(refs: analysis-api-extraction#MCP-2 spec: mcp-analysis-tools@1.0.0)"

# Dashboard
git commit -m "feat: add Analysis view tab
(refs: analysis-api-extraction#DASH-2 spec: http-api-v2-analysis@1.0.0)"
```

### Verification

```bash
# Check traceability
git log --grep="refs: analysis-api-extraction" --oneline

# Map implementation to spec
./trace-implementation.sh analysis-api-extraction#API-3
# → Shows commit, files changed, contract referenced
```

---

## Spec Constraint Enforcement

### Design Decisions Locked in Contracts

**Example: Hybrid Scoring Algorithm**

**Contract says:**
```markdown
## Hybrid Scoring

Co-change suggestions use:
- 60% embedding similarity (semantic)
- 40% co-change frequency (historical)

Formula: `score = 0.6 * embedding_sim + 0.4 * cochange_freq`
```

**Implementation must match:**
```typescript
// repos/metabob-analysis-api/src/services/online-learning.ts

const hybridScore = 0.6 * embeddingSimilarity + 0.4 * cochangeFrequency;
// ✓ Matches contract

// ✗ This would violate contract:
// const hybridScore = 0.5 * embeddingSimilarity + 0.5 * cochangeFrequency;
```

**Validation:**
```bash
# Contract validator checks implementation
./validate-contract.sh http-api-v2-analysis

# Output:
# ✓ Endpoint GET /v2/analysis/suggest-changes exists
# ✓ Response format matches schema
# ✓ Hybrid scoring algorithm matches spec (60/40 split)
# ✗ WARNING: P99 latency 450ms exceeds target 400ms
```

---

### Breaking Change Protocol

**If design decision needs to change:**

1. **Document reasoning**
   ```bash
   vim openspec/changes/analysis-api-extraction/design.md
   # Add section: "Design Change: Hybrid Scoring Adjustment"
   ```

2. **Update contract FIRST**
   ```bash
   vim openspec/contracts/http-api-v2-analysis.md
   # Change: 60/40 → 70/30 with reasoning
   ```

3. **Bump contract version**
   ```yaml
   version: 1.1.0  # Minor bump for algorithm change
   breaking_changes:
     - "Hybrid scoring changed from 60/40 to 70/30 split"
   ```

4. **Ripple to all consumers**
   ```bash
   # Check ripple notifications
   grep -r "http-api-v2-analysis" openspec/repos/
   # → Update mcp (may need test adjustments)
   # → Update dashboard (UI implications?)
   ```

5. **Update implementations**
   ```bash
   # Analysis API
   git commit -m "feat: adjust hybrid scoring to 70/30 split
   (refs: analysis-api-extraction#API-14-v2 spec: http-api-v2-analysis@1.1.0)"

   # MCP (tests may need adjustment)
   git commit -m "test: update scoring expectations for 70/30 split
   (refs: analysis-api-extraction#MCP-5-v2 spec: mcp-analysis-tools@1.0.1)"
   ```

---

## Summary

**Parallel Development Enabled By:**
- Clear contract boundaries
- Stub-first implementations
- Feature flags for incomplete work
- Blue/green deployment option
- Comprehensive E2E validation

**System Availability Maintained By:**
- Every deployment functional (even if limited)
- Health checks pass at all times
- E2E tests validate before completion
- Rollback procedures automated

**Alignment Enforced By:**
- Contract-first development
- Validation gates per task/service/phase
- Ripple propagation through specs
- Commit traceability to specs

**Critical Path:** CPG Library → Analysis API → Dashboard (~10 weeks)

**Parallel Optimization:** E2E tests + MCP server reduce total time significantly

**Next Action:** Start Phase 1 Track 1A (CPG Library) and Track 1B (E2E Framework) in parallel!
