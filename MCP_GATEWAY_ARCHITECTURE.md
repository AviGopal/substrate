# MCP Gateway Architecture: Clean Separation of Concerns

## Executive Summary

**Core Principle**: `metabob-opencode` ONLY communicates with backends through `metabob-cli` (MCP gateway).

**Why**: Prevents dependency hell, maintains clean boundaries, single integration point.

**Architecture Pattern**: 
```
metabob-opencode → MCP Protocol → metabob-cli → Backend APIs → metabob-rpc-api
                   (interface)     (gateway)     (HTTP/DB)     (services)
```

---

## 1. System Components & Responsibilities

### 1.1 metabob-opencode (TypeScript - AI Coding Agent)

**Domain**: Developer interaction, activity orchestration, session management

**Allowed Dependencies**:
- ✅ MCP Protocol (interface only, not implementation)
- ✅ Local filesystem (storage, git)
- ✅ LLM APIs (Anthropic, OpenAI)
- ✅ Terminal UI

**Forbidden Dependencies**:
- ❌ metabob-rpc-api (direct HTTP calls)
- ❌ Database connections
- ❌ Backend-specific protocols

**Communication Pattern**:
```typescript
// ✅ CORRECT: Use MCP tools
await mcpClient.callTool("metabob_search_activities", { category: "feature" })
await mcpClient.callTool("metabob_report_execution", { templateId, result })

// ❌ WRONG: Direct API calls
await fetch("http://rpc-api/templates")  // FORBIDDEN
await db.query("SELECT * FROM templates")  // FORBIDDEN
```

---

### 1.2 metabob-cli (Python - MCP Gateway)

**Domain**: Code analysis, MCP server, backend gateway

**Responsibilities**:
1. **Code Analysis Engine**:
   - Static analysis (bugs, security, quality)
   - CPG construction and querying
   - Issue detection and prioritization
   
2. **MCP Gateway** (NEW ROLE):
   - Expose all backend operations as MCP tools
   - Handle protocol translation (MCP ↔ Backend APIs)
   - Cache responses, rate limiting, retry logic
   - Authentication/authorization for backend calls

**Allowed Dependencies**:
- ✅ MCP Protocol (server implementation)
- ✅ metabob-rpc-api (HTTP client)
- ✅ Local analysis cache
- ✅ Tree-sitter, static analyzers

**Forbidden Dependencies**:
- ❌ metabob-opencode internals (TypeScript code)
- ❌ Activity execution logic (that's opencode)

**Communication Pattern**:
```python
# ✅ CORRECT: MCP tool forwards to backend
@mcp.tool(name="metabob_search_activities")
async def search_activities(category: str):
    # Gateway forwards to RPC API
    response = await rpc_client.get(f"/api/templates?category={category}")
    return response.json()

# ✅ CORRECT: MCP tool performs local analysis
@mcp.tool(name="metabob_search_codebase_issues")
async def search_issues(query: str):
    # Local analysis, no backend call
    return issue_cache.search(query)
```

---

### 1.3 metabob-rpc-api (Python - Backend Services)

**Domain**: Centralized data, multi-user services, statistical analysis

**Responsibilities**:
- Template registry (SurrealDB or similar)
- Cross-user metrics aggregation
- Statistical analysis (A/B testing, promotions)
- Template quality scoring
- User/organization management

**Allowed Dependencies**:
- ✅ Database (SurrealDB, PostgreSQL)
- ✅ HTTP framework (FastAPI)
- ✅ Statistical libraries (scipy, numpy)

**Forbidden Dependencies**:
- ❌ MCP Protocol (doesn't know about MCP)
- ❌ metabob-opencode internals
- ❌ metabob-cli analysis logic

**Communication Pattern**:
```python
# ✅ CORRECT: Pure REST API
@app.get("/api/templates")
async def list_templates(category: str = None):
    return await template_registry.list(category)

# ✅ CORRECT: Backend business logic
@app.post("/api/activity-execution")
async def record_execution(execution: ExecutionResult):
    await metrics_aggregator.record(execution)
    recommendation = await promotion_engine.evaluate(execution.template_id)
    return recommendation
```

---

## 2. Data Flow Patterns

### 2.1 Template Discovery (Read-Only)

```
User: "search activity templates"
  ↓
metabob-opencode: TemplateRepository.list({ category: "feature" })
  ↓
MCP Call: metabob_search_activities({ category: "feature" })
  ↓
metabob-cli: activity_template_tools.py
  ├─ Check local cache (.metabob/activities/)
  ├─ If cache miss → HTTP GET /api/templates?category=feature
  └─ Return: { templates: [...], source: "metabob-rpc-api" }
  ↓
metabob-rpc-api: GET /api/templates
  ├─ Query template registry (SurrealDB)
  ├─ Aggregate metrics across users
  └─ Return: [{ id, name, category, successRate, avgCost, ... }]
  ↓
metabob-cli: Cache response, return to opencode
  ↓
metabob-opencode: Display templates to user
```

**Key Points**:
- ✅ OpenCode never touches RPC API directly
- ✅ metabob-cli handles caching (reduces backend load)
- ✅ RPC API is pure backend service (no MCP knowledge)

---

### 2.2 Template Execution & Metrics Reporting (Write Path)

```
User: "add feature X"
  ↓
metabob-opencode: ActivityExecutor.execute(template, variables)
  ├─ A/B selection: TemplateSelector.select("add-feature-complete")
  ├─ Execute tasks (spawn agents, run tools)
  ├─ Collect executionEvidence
  └─ Report metrics
  ↓
MCP Call: metabob_report_execution({
  templateId: "add-feature-complete",
  variant: "candidate",
  success: true,
  cost: 0.15,
  duration: 45000,
  tokens: { input: 8000, output: 2000, cache: 5000 }
})
  ↓
metabob-cli: activity_metrics_tools.py (NEW - Phase 3)
  ├─ Validate execution data
  ├─ HTTP POST /api/activity-execution
  └─ Return: { recorded: true, recommendation: "KEEP_TESTING" }
  ↓
metabob-rpc-api: POST /api/activity-execution
  ├─ Store execution record in DB
  ├─ Update aggregated metrics (success rate, cost, duration)
  ├─ Evaluate A/B test status
  │   ├─ Sample size >= 30?
  │   ├─ Statistical significance (chi-square)?
  │   └─ Cost delta acceptable?
  └─ Return recommendation (PROMOTE / KEEP_TESTING / PRUNE)
  ↓
metabob-cli: Return recommendation to opencode
  ↓
metabob-opencode: (Optional) Display recommendation to user
```

**Key Points**:
- ✅ Metrics reporting is async (non-blocking)
- ✅ Gateway handles retry logic if backend unavailable
- ✅ Backend makes statistical decisions (not client)

---

### 2.3 A/B Testing: Template Selection (Current Implementation - Phase 2)

**Current (Client-Side Selection)**:
```
metabob-opencode: TemplateSelector.select("add-feature-complete")
  ├─ Load template from cache (TemplateRepository)
  ├─ Check template.candidateIds = ["add-feature-v2"]
  ├─ Weighted random: Math.random() < 0.1 → select candidate
  ├─ Load candidate template
  ├─ If load fails → fallback to stable
  └─ Return: { template, variant: "candidate", fallback: false }
```

**Future (Backend-Side Selection via MCP - Phase 3 Option)**:
```
metabob-opencode: TemplateSelector.select("add-feature-complete")
  ↓
MCP Call: metabob_select_template({ templateId: "add-feature-complete" })
  ↓
metabob-cli: activity_selection_tools.py (NEW)
  ├─ HTTP GET /api/template/add-feature-complete/select
  └─ Return: { templateId: "add-feature-v2", variant: "candidate", template: {...} }
  ↓
metabob-rpc-api: GET /api/template/:id/select
  ├─ Load template + candidates
  ├─ Weighted random selection
  ├─ Advanced: Multi-armed bandit, contextual selection
  └─ Return selected template
```

**Decision**: Keep client-side for now (Phase 2), gateway option available for Phase 3.

---

## 3. MCP Tool Inventory

### 3.1 Existing Tools (metabob-cli/mcp/)

#### Code Analysis Tools
- `metabob_search_codebase_issues` - Find bugs/issues (local analysis)
- `metabob_get_priority_issues` - Get top issues (local analysis)
- `metabob_mark_problem_complete` - Mark issue fixed (local + backend)
- `metabob_annotate_component` - Document design decisions (local + backend)
- `metabob_analyze_change_impact` - CPG impact analysis (local)
- `metabob_list_file_components` - List file components (local)
- `metabob_assess_deletion_safety` - Safe to delete? (local)
- `metabob_suggest_related_changes` - Co-change patterns (local)

#### Activity Template Tools (Existing)
- `metabob_search_activities` - List templates (local cache → backend)
- `metabob_get_activity_template` - Get template by ID (local cache → backend)
- `metabob_register_activity_template` - Register new template (local + backend)

---

### 3.2 NEW Tools Required (Phase 3)

#### Activity Metrics Tools (metabob-cli/mcp/activity_metrics_tools.py)

```python
@mcp.tool(name="metabob_report_execution")
async def report_execution(
    template_id: str,
    variant: str,  # "stable" | "candidate"
    success: bool,
    cost: float,
    duration: float,
    tokens: dict,  # { input, output, cache }
    task_count: int,
    failed_tasks: int,
    execution_id: str
) -> dict:
    """
    Report activity execution result to backend for metrics aggregation.
    
    Backend aggregates across users for:
    - Success rate by variant
    - Cost/duration averages
    - A/B test statistical analysis
    - Promotion recommendations
    
    Returns:
        {
            "recorded": true,
            "recommendation": "PROMOTE" | "KEEP_TESTING" | "PRUNE",
            "reason": "Candidate shows 10% success improvement (p<0.05)"
        }
    """
    # Forward to metabob-rpc-api
    response = await rpc_client.post("/api/activity-execution", json={...})
    return response.json()


@mcp.tool(name="metabob_get_template_metrics")
async def get_template_metrics(template_id: str) -> dict:
    """
    Get aggregated metrics for a template (stable + all candidates).
    
    Returns:
        {
            "stable": {
                "templateId": "add-feature-complete",
                "executions": 120,
                "successRate": 0.75,
                "avgCost": 0.15,
                "avgDuration": 45000
            },
            "candidates": [
                {
                    "templateId": "add-feature-v2",
                    "executions": 32,
                    "successRate": 0.85,
                    "avgCost": 0.18,
                    "avgDuration": 42000
                }
            ]
        }
    """
    response = await rpc_client.get(f"/api/template/{template_id}/metrics")
    return response.json()


@mcp.tool(name="metabob_get_promotion_recommendation")
async def get_promotion_recommendation(template_id: str) -> dict:
    """
    Get A/B testing promotion recommendation for a template.
    
    Backend performs:
    - Statistical comparison (chi-square test)
    - Sample size validation (>= 30 each)
    - Cost delta analysis
    - Success rate improvement check
    
    Returns:
        {
            "action": "PROMOTE" | "KEEP_TESTING" | "PRUNE",
            "reason": "Detailed explanation",
            "statistics": {
                "sampleSize": { "stable": 120, "candidate": 32 },
                "successRateDiff": 0.10,
                "pValue": 0.03,
                "costDelta": 0.20,
                "durationDelta": -0.07
            }
        }
    """
    response = await rpc_client.get(f"/api/template/{template_id}/recommendation")
    return response.json()


@mcp.tool(name="metabob_promote_template")
async def promote_template(
    stable_id: str,
    candidate_id: str,
    reason: str
) -> dict:
    """
    Promote a candidate template to become the new stable version.
    
    Backend actions:
    - Archive old stable template
    - Update candidate status to "stable"
    - Update candidateIds for other variants
    - Notify other clients (cache invalidation)
    
    Returns:
        {
            "promoted": true,
            "newStableId": "add-feature-v2",
            "archivedId": "add-feature-complete"
        }
    """
    response = await rpc_client.post("/api/template/promote", json={...})
    return response.json()
```

---

## 4. Backend API Endpoints (metabob-rpc-api - Phase 3)

### 4.1 Template Registry Endpoints (Existing/Enhanced)

```python
# repos/metabob-rpc-api/src/endpoints/templates.py

@router.get("/api/templates")
async def list_templates(
    category: str | None = None,
    status: str | None = None  # stable | candidate | archived
) -> list[dict]:
    """List templates with optional filters."""
    return await template_registry.list(category, status)


@router.get("/api/template/{template_id}")
async def get_template(template_id: str) -> dict:
    """Get full template by ID."""
    return await template_registry.get(template_id)


@router.post("/api/template")
async def register_template(template: dict) -> dict:
    """Register new template."""
    template_id = await template_registry.register(template)
    return {"id": template_id}
```

---

### 4.2 Metrics & A/B Testing Endpoints (NEW - Phase 3)

```python
# repos/metabob-rpc-api/src/endpoints/metrics.py

@router.post("/api/activity-execution")
async def record_execution(execution: ExecutionResult) -> dict:
    """
    Record activity execution result.
    
    Aggregates metrics, evaluates A/B tests, returns recommendation.
    """
    # Store execution
    await execution_store.insert(execution)
    
    # Update aggregated metrics
    await metrics_aggregator.update(
        template_id=execution.template_id,
        variant=execution.variant,
        success=execution.success,
        cost=execution.cost,
        duration=execution.duration,
        tokens=execution.tokens
    )
    
    # Evaluate A/B test status
    recommendation = await promotion_engine.evaluate(execution.template_id)
    
    return {
        "recorded": True,
        "recommendation": recommendation.action,
        "reason": recommendation.reason
    }


@router.get("/api/template/{template_id}/metrics")
async def get_template_metrics(template_id: str) -> dict:
    """Get aggregated metrics for template and candidates."""
    stable_metrics = await metrics_aggregator.get_metrics(template_id)
    
    # Get candidate metrics
    template = await template_registry.get(template_id)
    candidate_metrics = []
    for candidate_id in template.get("candidateIds", []):
        metrics = await metrics_aggregator.get_metrics(candidate_id)
        candidate_metrics.append(metrics)
    
    return {
        "stable": stable_metrics,
        "candidates": candidate_metrics
    }


@router.get("/api/template/{template_id}/recommendation")
async def get_recommendation(template_id: str) -> dict:
    """Get promotion recommendation based on A/B test results."""
    return await promotion_engine.evaluate(template_id)


@router.post("/api/template/promote")
async def promote_template(request: PromoteRequest) -> dict:
    """Promote candidate to stable, archive old stable."""
    # Archive old stable
    await template_registry.update_status(request.stable_id, "archived")
    
    # Promote candidate
    await template_registry.update_status(request.candidate_id, "stable")
    
    # Update genealogy
    await template_registry.update_genealogy(
        template_id=request.candidate_id,
        parent_id=request.stable_id,
        reason=request.reason
    )
    
    # Invalidate caches (notify MCP servers)
    await cache_invalidator.notify_template_update(request.candidate_id)
    
    return {
        "promoted": True,
        "newStableId": request.candidate_id,
        "archivedId": request.stable_id
    }
```

---

## 5. Implementation Phases

### Phase 2.3: Metrics Analysis (Current - Local Only)

**Goal**: Validate metrics aggregation logic with local data

**Files**:
- `analyze_template_performance.py` (extend)

**Scope**:
- Parse executionEvidence from local storage
- Aggregate by template variant
- Calculate success rates, costs, durations
- Statistical comparison (chi-square test)
- Generate recommendations

**No backend changes**: Pure local analysis script

---

### Phase 3.1: MCP Metrics Tools (metabob-cli)

**Goal**: Add MCP gateway tools for metrics reporting

**New Files**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_metrics_tools.py`

**Tools to Add**:
1. `metabob_report_execution` - Report execution to backend
2. `metabob_get_template_metrics` - Query aggregated metrics
3. `metabob_get_promotion_recommendation` - Get A/B test recommendation
4. `metabob_promote_template` - Promote candidate to stable

**Implementation**:
```python
# Forward calls to metabob-rpc-api
@mcp.tool(name="metabob_report_execution")
async def report_execution(...):
    response = await rpc_client.post("/api/activity-execution", json={...})
    return response.json()
```

**Testing**:
- Unit tests: Mock RPC API responses
- Integration tests: Against real/test RPC API

---

### Phase 3.2: Backend Metrics Endpoints (metabob-rpc-api)

**Goal**: Implement metrics aggregation and A/B testing backend

**New Files**:
- `repos/metabob-rpc-api/src/endpoints/metrics.py`
- `repos/metabob-rpc-api/src/services/metrics_aggregator.py`
- `repos/metabob-rpc-api/src/services/promotion_engine.py`

**Database Schema**:
```sql
-- Activity executions table
CREATE TABLE activity_executions (
    id VARCHAR PRIMARY KEY,
    template_id VARCHAR NOT NULL,
    variant VARCHAR NOT NULL,  -- 'stable' | 'candidate'
    success BOOLEAN NOT NULL,
    cost FLOAT NOT NULL,
    duration FLOAT NOT NULL,
    tokens JSONB NOT NULL,
    task_count INT NOT NULL,
    failed_tasks INT NOT NULL,
    user_id VARCHAR,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_executions_template ON activity_executions(template_id);
CREATE INDEX idx_executions_variant ON activity_executions(template_id, variant);
CREATE INDEX idx_executions_timestamp ON activity_executions(timestamp);

-- Aggregated metrics (materialized view or cron-updated)
CREATE TABLE template_metrics (
    template_id VARCHAR PRIMARY KEY,
    executions INT,
    successful INT,
    failed INT,
    success_rate FLOAT,
    avg_cost FLOAT,
    avg_duration FLOAT,
    avg_tokens JSONB,
    last_updated TIMESTAMP DEFAULT NOW()
);
```

**Services**:
1. **MetricsAggregator**: Aggregate execution data
2. **PromotionEngine**: Statistical analysis, recommendations
3. **CacheInvalidator**: Notify clients of template changes

---

### Phase 3.3: OpenCode Integration (metabob-opencode)

**Goal**: Use MCP tools for metrics reporting

**Files to Modify**:
- `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
- `repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts` (NEW)

**Changes**:
```typescript
// repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts

export namespace TemplateMetrics {
  /**
   * Report execution result to backend via MCP.
   */
  export async function reportExecution(
    templateId: string,
    result: ExecutionResult
  ): Promise<void> {
    const mcpClient = await getMcpClient()
    
    // Use MCP tool (not direct API call)
    await mcpClient.callTool("metabob_report_execution", {
      template_id: templateId,
      variant: result.variant,
      success: result.status === "done",
      cost: result.stats.cost.total,
      duration: result.stats.duration,
      tokens: result.stats.tokens,
      task_count: result.executionEvidence.sessionsSpawned.length,
      failed_tasks: result.failedTasks,
      execution_id: result.id
    })
  }
  
  /**
   * Get promotion recommendation via MCP.
   */
  export async function getRecommendation(
    templateId: string
  ): Promise<PromotionRecommendation> {
    const mcpClient = await getMcpClient()
    
    const response = await mcpClient.callTool(
      "metabob_get_promotion_recommendation",
      { template_id: templateId }
    )
    
    return response
  }
}
```

**Integration Points**:
- After activity execution → `TemplateMetrics.reportExecution()`
- In TUI/dashboard → `TemplateMetrics.getRecommendation()`
- CLI command → `opencode template promote <candidate-id>`

---

## 6. Dependency Graph (Clean Separation)

```
┌─────────────────────────────────────────────────────────────────┐
│ metabob-opencode (TypeScript)                                   │
│                                                                  │
│ Dependencies:                                                    │
│   - MCP Protocol (interface only) ✅                            │
│   - Local filesystem ✅                                          │
│   - LLM APIs ✅                                                  │
│                                                                  │
│ Forbidden:                                                       │
│   - metabob-rpc-api HTTP client ❌                              │
│   - Database connections ❌                                      │
│                                                                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ MCP Protocol (interface)
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│ metabob-cli (Python) - MCP Gateway                              │
│                                                                  │
│ Dependencies:                                                    │
│   - MCP Protocol (server implementation) ✅                     │
│   - metabob-rpc-api HTTP client ✅                              │
│   - Local analysis cache ✅                                      │
│   - Tree-sitter, analyzers ✅                                    │
│                                                                  │
│ Forbidden:                                                       │
│   - metabob-opencode internals ❌                               │
│   - Activity execution logic ❌                                  │
│                                                                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP REST API
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│ metabob-rpc-api (Python) - Backend Services                     │
│                                                                  │
│ Dependencies:                                                    │
│   - Database (SurrealDB) ✅                                      │
│   - HTTP framework (FastAPI) ✅                                  │
│   - Statistical libraries ✅                                     │
│                                                                  │
│ Forbidden:                                                       │
│   - MCP Protocol knowledge ❌                                    │
│   - metabob-opencode internals ❌                               │
│   - metabob-cli analysis logic ❌                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**metabob-opencode**:
```typescript
// Mock MCP client
const mockMcp = {
  callTool: jest.fn().mockResolvedValue({ templates: [...] })
}

test("TemplateRepository.list uses MCP", async () => {
  const templates = await TemplateRepository.list({ category: "feature" })
  expect(mockMcp.callTool).toHaveBeenCalledWith("metabob_search_activities", {...})
})
```

**metabob-cli**:
```python
# Mock RPC API client
@pytest.mark.asyncio
async def test_report_execution_forwards_to_backend(mock_rpc_client):
    await report_execution(template_id="test", ...)
    mock_rpc_client.post.assert_called_once_with("/api/activity-execution", ...)
```

**metabob-rpc-api**:
```python
# Test statistical analysis
def test_promotion_engine_chi_square():
    stable = {"executions": 100, "successful": 75}
    candidate = {"executions": 100, "successful": 85}
    recommendation = promotion_engine.evaluate(stable, candidate)
    assert recommendation.action == "PROMOTE"
    assert recommendation.p_value < 0.05
```

---

### 7.2 Integration Tests

**End-to-End Flow**:
```typescript
// Start test MCP server + RPC API
test("Full metrics reporting flow", async () => {
  // 1. Execute activity
  const result = await ActivityExecutor.execute(template, variables)
  
  // 2. Report metrics (via MCP → RPC API)
  await TemplateMetrics.reportExecution(template.id, result)
  
  // 3. Query recommendation
  const rec = await TemplateMetrics.getRecommendation(template.id)
  
  // 4. Verify backend received data
  const metrics = await rpcApi.getMetrics(template.id)
  expect(metrics.executions).toBe(1)
})
```

---

## 8. Migration Checklist

### Phase 3.1: MCP Gateway Tools
- [ ] Create `activity_metrics_tools.py` in metabob-cli
- [ ] Implement `metabob_report_execution` tool
- [ ] Implement `metabob_get_template_metrics` tool
- [ ] Implement `metabob_get_promotion_recommendation` tool
- [ ] Implement `metabob_promote_template` tool
- [ ] Add unit tests (mock RPC API)
- [ ] Add integration tests (against test RPC API)
- [ ] Update MCP tool documentation

### Phase 3.2: Backend Endpoints
- [ ] Design database schema (activity_executions, template_metrics)
- [ ] Create `metrics.py` endpoint file
- [ ] Implement `POST /api/activity-execution`
- [ ] Implement `GET /api/template/:id/metrics`
- [ ] Implement `GET /api/template/:id/recommendation`
- [ ] Implement `POST /api/template/promote`
- [ ] Create `metrics_aggregator.py` service
- [ ] Create `promotion_engine.py` service (chi-square, statistical tests)
- [ ] Add unit tests (service logic)
- [ ] Add integration tests (API endpoints)
- [ ] Add database migrations

### Phase 3.3: OpenCode Integration
- [ ] Create `template-metrics.ts` module
- [ ] Implement `TemplateMetrics.reportExecution()`
- [ ] Implement `TemplateMetrics.getRecommendation()`
- [ ] Update `activity.ts` to call `reportExecution()` after execution
- [ ] Add CLI command: `opencode template metrics <id>`
- [ ] Add CLI command: `opencode template promote <candidate-id>`
- [ ] Update TUI to show recommendations
- [ ] Add unit tests (mock MCP)
- [ ] Add integration tests (against MCP server)

### Phase 3.4: Cleanup
- [ ] Remove any direct RPC API calls from opencode (if any)
- [ ] Remove old metrics reporting code (if any)
- [ ] Update documentation
- [ ] Update architecture diagrams
- [ ] Verify dependency graph (no violations)

---

## 9. Benefits Summary

### ✅ Clean Separation
- Each component has clear, non-overlapping responsibilities
- No circular dependencies
- Easy to reason about system behavior

### ✅ Testability
- Mock MCP protocol for OpenCode tests
- Mock RPC API for CLI tests
- Each layer independently testable

### ✅ Flexibility
- Swap RPC API implementation without touching OpenCode
- Add new backends (alternative registries) via MCP tools
- Version MCP protocol independently

### ✅ Scalability
- MCP gateway can cache, rate-limit, batch requests
- Backend can scale horizontally (stateless API)
- OpenCode remains lightweight (no backend dependencies)

### ✅ Security
- Single gateway point for authentication/authorization
- Backend doesn't expose complex protocols (just REST)
- OpenCode can't accidentally bypass security (no direct API access)

---

## 10. Anti-Patterns to Avoid

### ❌ Direct API Calls from OpenCode
```typescript
// FORBIDDEN
await fetch("http://rpc-api/templates")
```

### ❌ OpenCode Knowing About Backend Details
```typescript
// FORBIDDEN
const DB_CONNECTION_STRING = "postgresql://..."
```

### ❌ MCP Tools Implementing Business Logic
```python
# FORBIDDEN: Business logic belongs in backend
@mcp.tool(name="metabob_promote_template")
async def promote_template(...):
    # Don't implement promotion logic here!
    # Forward to backend which has the logic
    if candidate_success_rate > stable_success_rate:  # ❌ BAD
        ...
```

### ❌ Backend Knowing About MCP Protocol
```python
# FORBIDDEN: Backend should be protocol-agnostic
@app.post("/api/activity-execution")
async def record_execution(mcp_request: McpRequest):  # ❌ BAD
    ...
```

---

## 11. Conclusion

**Core Principle Enforced**: `metabob-opencode` → MCP → `metabob-cli` → HTTP → `metabob-rpc-api`

**No shortcuts, no exceptions.**

This architecture prevents dependency hell, maintains clean boundaries, and scales gracefully.

All backend communication flows through the MCP gateway. Period.

---

**Status**: 
- Phase 2.1-2.2: ✅ Complete (template schema, selector)
- Phase 2.3: 🚧 In Progress (local metrics analysis)
- Phase 3.1-3.3: 📋 Planned (MCP gateway implementation)

**Next Steps**: 
1. Complete Phase 2.3 (Python script for local analysis)
2. Design Phase 3.1 in detail (MCP tools specification)
3. Implement Phase 3.1-3.3 sequentially
