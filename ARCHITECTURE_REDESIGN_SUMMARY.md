# Architecture Redesign Summary: MCP Gateway Pattern

## What Changed

**Problem Identified**: Original Phase 3 plan would have created a **triangle dependency**:
```
metabob-opencode ←→ metabob-rpc-api (direct HTTP calls)
        ↓
metabob-cli (MCP) ←→ metabob-rpc-api
```

This violates separation of concerns and creates dependency hell.

---

## New Architecture: MCP Gateway Pattern

**Core Principle**: ALL backend communication flows through metabob-cli (MCP gateway).

```
metabob-opencode → MCP Protocol → metabob-cli → HTTP REST → metabob-rpc-api
                   (interface)     (gateway)     (API)       (services)
```

**Enforced Rule**: `metabob-opencode` NEVER calls `metabob-rpc-api` directly.

---

## Component Responsibilities

### metabob-opencode (TypeScript)
**Domain**: Developer interaction, activity orchestration, session management

**Allowed**:
- ✅ MCP Protocol (interface only)
- ✅ Local filesystem
- ✅ LLM APIs

**Forbidden**:
- ❌ metabob-rpc-api direct HTTP calls
- ❌ Database connections
- ❌ Backend-specific protocols

---

### metabob-cli (Python) - NEW ROLE: MCP Gateway
**Domain**: Code analysis + backend gateway

**Responsibilities**:
1. Code analysis (bugs, security, CPG)
2. **MCP gateway** for all backend operations
3. Protocol translation (MCP ↔ Backend APIs)
4. Caching, rate limiting, retry logic

**Allowed**:
- ✅ MCP Protocol (server)
- ✅ metabob-rpc-api HTTP client
- ✅ Local analysis cache

**Forbidden**:
- ❌ metabob-opencode internals
- ❌ Activity execution logic

---

### metabob-rpc-api (Python)
**Domain**: Centralized backend services

**Responsibilities**:
- Template registry (SurrealDB)
- Cross-user metrics aggregation
- Statistical analysis (A/B testing)
- Promotion decisions

**Allowed**:
- ✅ Database
- ✅ HTTP framework
- ✅ Statistical libraries

**Forbidden**:
- ❌ MCP Protocol knowledge
- ❌ metabob-opencode internals
- ❌ metabob-cli analysis logic

---

## Phase 3 Implementation Changes

### OLD Plan (WRONG):
```typescript
// metabob-opencode calling RPC API directly ❌
await fetch("http://rpc-api/api/activity-execution", {...})
```

### NEW Plan (CORRECT):
```typescript
// metabob-opencode calls MCP tool ✅
await mcpClient.callTool("metabob_report_execution", {
  template_id: "add-feature-complete",
  variant: "candidate",
  success: true,
  cost: 0.15,
  duration: 45000,
  tokens: {...}
})
```

```python
# metabob-cli forwards to backend ✅
@mcp.tool(name="metabob_report_execution")
async def report_execution(...):
    response = await rpc_client.post("/api/activity-execution", json={...})
    return response.json()
```

---

## Benefits of MCP Gateway Pattern

### 1. Clean Separation of Concerns
- Each component has clear, non-overlapping responsibilities
- No circular dependencies
- Easy to reason about system behavior

### 2. Single Integration Point
- OpenCode only knows MCP protocol
- Swap backends without touching OpenCode
- Add caching/rate-limiting in gateway

### 3. Testability
```typescript
// Mock MCP server for OpenCode tests
const mockMcp = {
  callTool: jest.fn().mockResolvedValue({...})
}
```

### 4. Prevents Dependency Hell
```
metabob-opencode depends on: MCP protocol (interface)
metabob-cli depends on: MCP protocol + RPC API client
metabob-rpc-api depends on: Nothing (pure backend)
```

---

## Phase Breakdown

### Phase 2.3: Metrics Analysis (Current)
**Status**: 🚧 In Progress
**Scope**: Extend Python script for local A/B metrics analysis
**No architecture changes**: Pure local analysis

---

### Phase 3.1: MCP Metrics Tools
**Status**: 📋 Planned
**Scope**: Add MCP gateway tools to metabob-cli

**New MCP Tools**:
1. `metabob_report_execution` - Report execution to backend
2. `metabob_get_template_metrics` - Query aggregated metrics
3. `metabob_get_promotion_recommendation` - Get A/B recommendation
4. `metabob_promote_template` - Promote candidate to stable

**Implementation**: Forward calls to metabob-rpc-api

---

### Phase 3.2: Backend Metrics Endpoints
**Status**: 📋 Planned
**Scope**: Implement backend services in metabob-rpc-api

**New Endpoints**:
- `POST /api/activity-execution` - Record execution
- `GET /api/template/:id/metrics` - Get metrics
- `GET /api/template/:id/recommendation` - Get recommendation
- `POST /api/template/promote` - Promote template

**Services**:
- MetricsAggregator (aggregate execution data)
- PromotionEngine (statistical analysis)
- CacheInvalidator (notify clients)

---

### Phase 3.3: OpenCode Integration
**Status**: 📋 Planned
**Scope**: Update metabob-opencode to use MCP tools

**Changes**:
- Create `template-metrics.ts` module
- Call MCP tools (not direct API)
- Update activity execution to report metrics
- Add CLI commands for metrics/promotion

---

## Migration Checklist

### ✅ Phase 2.1: Schema Extension
- [x] Add A/B fields to ActivityTemplate.Schema
- [x] Update CreateOptions and adapters
- [x] Update test helpers

### ✅ Phase 2.2: Template Selector
- [x] Implement TemplateSelector.select()
- [x] Weighted random selection
- [x] Selection metrics tracking
- [x] Tests (11 scenarios)

### 🚧 Phase 2.3: Metrics Analysis
- [ ] Extend analyze_template_performance.py
- [ ] Add A/B template detection
- [ ] Implement variant metrics aggregation
- [ ] Add statistical comparison (chi-square)
- [ ] Build recommendation engine
- [ ] Generate A/B testing report

### 📋 Phase 3.1: MCP Gateway Tools
- [ ] Create activity_metrics_tools.py
- [ ] Implement metabob_report_execution
- [ ] Implement metabob_get_template_metrics
- [ ] Implement metabob_get_promotion_recommendation
- [ ] Implement metabob_promote_template
- [ ] Unit tests (mock RPC API)
- [ ] Integration tests

### 📋 Phase 3.2: Backend Endpoints
- [ ] Design database schema
- [ ] Create metrics.py endpoints
- [ ] Implement POST /api/activity-execution
- [ ] Implement GET /api/template/:id/metrics
- [ ] Implement GET /api/template/:id/recommendation
- [ ] Implement POST /api/template/promote
- [ ] Create metrics_aggregator.py service
- [ ] Create promotion_engine.py service
- [ ] Unit tests
- [ ] Integration tests

### 📋 Phase 3.3: OpenCode Integration
- [ ] Create template-metrics.ts
- [ ] Implement TemplateMetrics.reportExecution()
- [ ] Implement TemplateMetrics.getRecommendation()
- [ ] Update activity.ts to call reportExecution()
- [ ] Add CLI commands
- [ ] Update TUI
- [ ] Unit tests (mock MCP)
- [ ] Integration tests

### 📋 Phase 3.4: Cleanup
- [ ] Remove any direct RPC API calls from opencode
- [ ] Verify dependency graph (no violations)
- [ ] Update documentation
- [ ] Update architecture diagrams

---

## Current Status

**✅ Completed**:
- Phase 2.1: Template schema with A/B fields
- Phase 2.2: Template selector with weighted routing
- Architecture redesign document

**🚧 In Progress**:
- Phase 2.3: Local metrics analysis script

**📋 Next Steps**:
1. Complete Phase 2.3 (Python script)
2. Implement Phase 3.1 (MCP gateway tools)
3. Implement Phase 3.2 (Backend endpoints)
4. Implement Phase 3.3 (OpenCode integration)

---

## Key Documents

1. **MCP_GATEWAY_ARCHITECTURE.md** - Complete architecture specification
2. **ARCHITECTURE_ASSESSMENT.md** - Original assessment (deprecated)
3. **PHASE_2_1_COMPLETION_SUMMARY.md** - Schema extension details
4. **PHASE_2_2_COMPLETION_SUMMARY.md** - Template selector details

---

## Anti-Patterns to Avoid

### ❌ Direct API Calls from OpenCode
```typescript
// FORBIDDEN
await fetch("http://rpc-api/templates")
```

### ❌ OpenCode Knowing About Backend
```typescript
// FORBIDDEN
const DB_CONNECTION_STRING = "postgresql://..."
```

### ❌ MCP Tools Implementing Business Logic
```python
# FORBIDDEN: Business logic belongs in backend
@mcp.tool(name="metabob_promote_template")
async def promote_template(...):
    if candidate_success_rate > stable_success_rate:  # ❌ BAD
        # Promotion logic should be in backend
```

### ❌ Backend Knowing About MCP
```python
# FORBIDDEN: Backend should be protocol-agnostic
@app.post("/api/activity-execution")
async def record_execution(mcp_request: McpRequest):  # ❌ BAD
    ...
```

---

## Conclusion

**Architecture Principle Enforced**: 
```
metabob-opencode → MCP → metabob-cli → HTTP → metabob-rpc-api
```

**No shortcuts. No exceptions. No direct API calls.**

This clean separation prevents dependency hell, maintains architectural boundaries, and enables independent scaling of each component.

---

**Date**: 2026-02-18
**Status**: Architecture redesign complete, implementation in progress
