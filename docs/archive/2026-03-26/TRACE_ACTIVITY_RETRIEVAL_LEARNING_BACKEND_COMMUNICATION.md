# Data Flow Trace: Activity Retrieval and Learning Backend Communication

**Specification**: activity-retrieval-learning-backend-communication  
**Date**: 2026-03-04  
**Status**: ✅ COMPLIANT

## Executive Summary

The architecture is **already compliant** with the specification. All activity retrieval flows through metabob-cli MCP to the backend, learning data flows back through the same path, OpenCode does not manage activity storage locally, and there are no implicit file dependencies.

## Specification Requirements

1. ✅ **OpenCode must not store or manage activities locally** - Activities retrieved from backend only
2. ✅ **All activity retrieval goes through metabob-cli MCP** - MCP is the gateway
3. ✅ **Learning data flows back to backend** - Execution results posted via MCP
4. ✅ **No implicit file dependencies** - No local file reads required for execution

## Component Analysis

### 1. Activity Retrieval Flow

#### Entry Point: OpenCode Template Repository
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`

```
TemplateRepository.list() → TemplateLoader.list() → MetabobCLI.searchActivities()
TemplateRepository.get() → TemplateLoader.load() → MetabobCLI.getActivity()
```

**Current Behavior**: ✅ COMPLIANT
- Calls TemplateLoader which delegates to MetabobCLI MCP functions
- No local file reading except for bootstrap templates (fallback only)
- Cache-first strategy with MCP fallback

**Evidence**:
- Line 114-133: `TemplateRepository.get()` calls `TemplateLoader.load()`
- Line 64-89: `TemplateRepository.list()` calls `TemplateLoader.list()`

---

#### MCP Layer: OpenCode → metabob-cli
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

**Component**: `MetabobCLI.searchActivities()`
- **Current**: Calls MCP tool `search_activities` (line 688)
- **Desired**: Continue calling MCP tool ✅
- **Gap**: None

**Component**: `MetabobCLI.getActivity()`
- **Current**: Calls MCP tool `activity` (line 758)
- **Desired**: Continue calling MCP tool ✅
- **Gap**: None

**Component**: `MetabobCLI.registerActivityTemplate()`
- **Current**: ✅ REMOVED local file writes (lines 807-813 commented out)
- **Desired**: Backend-only registration ✅
- **Gap**: None

**Evidence**:
```typescript
// Line 688: searchActivities calls MCP
const result = await callMCPTool<{...}>("search_activities", {...})

// Line 758: getActivity calls MCP
const result = await callMCPTool<{...}>("activity", {
  activity_id: activityId,
})

// Lines 807-813: Local file writes REMOVED (architectural constraint enforcement)
// ARCHITECTURAL CONSTRAINT: Templates should NOT be stored locally (except cache)
// Templates are stored in backend via MCP for centralized learning and quality control
```

---

#### MCP Gateway: metabob-cli
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Component**: `metabob_search_activities()`
- **Current**: Calls RPC API `GET /v2/activities/templates` (line 56)
- **Desired**: Continue calling backend API ✅
- **Gap**: None

**Component**: `metabob_get_activity_template()`
- **Current**: Calls RPC API `GET /v2/activities/templates/{template_id}` (line 126)
- **Desired**: Continue calling backend API ✅
- **Gap**: None

**Evidence**:
```python
# Line 56: Search templates via RPC API
result = await call_api("GET", "/v2/activities/templates", params=params)

# Line 126: Get template via RPC API
result = await call_api("GET", f"/v2/activities/templates/{template_id}")
```

---

#### Backend API: metabob-rpc-api
**File**: `repos/metabob-rpc-api/server/routes/activity.py`

**Component**: `list_activity_templates()`
- **Current**: Returns templates from Redis storage (MVP)
- **Desired**: Continue returning from Redis ✅
- **Gap**: None (SurrealDB migration is future work)

**File**: `repos/metabob-rpc-api/server/actions/activity.py`
- Implements `list_templates()`, `get_template_by_id()`, `record_execution_result()`
- Uses Redis for template storage (content-addressable variants)
- Uses Thompson Sampling for variant selection

---

### 2. Learning Data Flow

#### Entry Point: Activity Execution Complete
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Function**: `Activity.execute()`
- Calls `TemplateMetricsClient.reportExecution()` on completion (lines 1051, 1356)
- Includes impulse usage and component changes in execution data

**Evidence**:
```typescript
// Line 1051: Report successful execution
TemplateMetricsClient.reportExecution({
  activity_id: activity.id,
  template_id: activity.templateId,
  success: true,
  duration: elapsed,
  cost: totalCost,
  tokens: { input, output, cache },
  impulses_used: [...],
  component_changes: [...]
})
```

---

#### MCP Layer: Metrics Reporting
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

**Component**: `TemplateMetricsClient.reportExecution()`
- **Current**: Calls MCP tool `metabob_post_activity_result` (line 110) ✅
- **Desired**: Continue calling MCP tool ✅
- **Gap**: None

**Evidence**:
```typescript
// Line 82-92: ARCHITECTURAL BOUNDARY ENFORCEMENT comment
// This method uses the MCP tool 'metabob_post_activity_result' to delegate metrics reporting
// to metabob-cli, which forwards to metabob-rpc-api backend. This maintains the
// architectural boundary: opencode → MCP → cli → backend (no direct HTTP).

// Line 110: Call MCP tool
const result = await callMCPTool<{...}>(
  "metabob_post_activity_result",
  {
    activity_id: data.activity_id,
    result: {
      success: data.success,
      duration: data.duration,
      cost: data.cost,
      tokens: data.tokens,
      impulses_used: data.impulses_used,
      component_changes: data.component_changes
    }
  }
)
```

---

#### MCP Gateway: Learning Loop
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Component**: `metabob_post_activity_result()`
- **Current**: Calls RPC API `POST /api/v1/learning-loop/executions` (line 376) ✅
- **Desired**: Continue calling backend API ✅
- **Gap**: None

**Evidence**:
```python
# Lines 354-365: Include learning data (impulses_used, component_changes)
if result.get("impulses_used"):
    request_data["impulses_used"] = result.get("impulses_used")
    logger.debug(f"[LEARNING] Including {len(result.get('impulses_used'))} impulses")

if result.get("component_changes"):
    request_data["component_changes"] = result.get("component_changes")
    logger.debug(f"[LEARNING] Including {len(result.get('component_changes'))} component changes")

# Line 376: Call Learning Loop API
response = await client.post(
    f"{api_base}/api/v1/learning-loop/executions",
    json=request_data,
    headers={"Content-Type": "application/json"}
)
```

---

#### Backend Storage: SurrealDB
**File**: `repos/metabob-rpc-api/server/db/operations/activity_execution.py`

**Component**: `insert_execution()`
- **Current**: Stores execution data in SurrealDB including impulses_used and component_changes ✅
- **Desired**: Continue storing in SurrealDB ✅
- **Gap**: None

**Evidence**:
```python
# Lines 79-96: Execution data with learning fields
data = {
    "activity_id": activity_id,
    "template_id": template_id,
    "started_at": started_at,
    "duration_ms": duration_ms,
    "success": success,
    "tokens_input": tokens_input,
    "tokens_output": tokens_output,
    "tokens_cache": tokens_cache,
    "cost_usd": cost_usd,
    "impulses_used": impulses_used if impulses_used else None,
    "component_changes": component_changes if component_changes else None,
    "created_at": datetime.utcnow()
}
```

---

### 3. Storage Architecture Enforcement

#### Template Repository: Backend-Only Saves
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`

**Component**: `TemplateRepository.save()`
- **Current**: ✅ REMOVED local file writes (lines 160-183)
- **Enforcement**: Throws error if backend='local' only (lines 167-172)
- **Desired**: Backend-only saves ✅
- **Gap**: None

**Evidence**:
```typescript
// Lines 160-183: Architectural constraint enforcement
// ARCHITECTURAL CONSTRAINT: Templates should NOT be saved to local storage
// Only backend via MCP is allowed for centralized learning and quality control

if (backends.includes("local") && !backends.includes("metabob") && !backends.includes("all")) {
  throw new Error(
    "Backend='local' is not supported. Templates must be saved to backend via MCP. " +
    "Use backend='metabob' or backend='all' (which now means metabob only)."
  )
}
```

---

## Data Flow Summary

### Activity Retrieval
```
1. OpenCode: TemplateRepository.get(id)
2. OpenCode: TemplateLoader.load(id) → checks cache
3. OpenCode: MetabobCLI.getActivity(id) → MCP call
4. MCP Transport: "activity" tool invocation
5. metabob-cli: metabob_get_activity_template(id)
6. HTTP: GET /v2/activities/templates/{id}
7. metabob-rpc-api: get_template_by_id(id)
8. Redis/SurrealDB: Template data retrieval
9. Response reverses path back to OpenCode
10. OpenCode: Cache template, return to caller
```

### Learning Data Flow
```
1. OpenCode: Activity.execute() completes
2. OpenCode: TemplateMetricsClient.reportExecution(data)
3. OpenCode: MCP call to "metabob_post_activity_result"
4. MCP Transport: Tool invocation with execution data
5. metabob-cli: metabob_post_activity_result(activity_id, result)
6. HTTP: POST /api/v1/learning-loop/executions
7. metabob-rpc-api: insert_execution(...)
8. SurrealDB: activity_execution record created
9. SurrealDB: Template metrics aggregated
10. Response confirms storage success
```

---

## Architectural Boundaries

### 1. MCP Boundary
- **Location**: OpenCode | metabob-cli
- **Contract**: MCP tools (search_activities, activity, metabob_post_activity_result)
- **Coupling**: Loose (MCP abstraction layer)
- **Resilience**: Graceful degradation when MCP unavailable
- **Status**: ✅ COMPLIANT

### 2. HTTP/RPC Boundary
- **Location**: metabob-cli | metabob-rpc-api
- **Contract**: REST API endpoints
  - `GET /v2/activities/templates` (list)
  - `GET /v2/activities/templates/{id}` (get)
  - `POST /api/v1/learning-loop/executions` (metrics)
- **Coupling**: Loose (HTTP)
- **Resilience**: Error handling with retries in api_client.py
- **Status**: ✅ COMPLIANT

### 3. Database Boundary
- **Location**: metabob-rpc-api | SurrealDB/Redis
- **Contract**: 
  - Redis: Template storage (MVP)
  - SurrealDB: Execution data (activity_execution table)
- **Coupling**: Medium (direct DB operations)
- **Resilience**: Connection pooling, error handling
- **Status**: ✅ COMPLIANT

---

## Validation Evidence

### No Local File Dependencies
1. ✅ `MetabobCLI.registerActivityTemplate()` - local writes REMOVED (lines 807-813)
2. ✅ `TemplateRepository.save()` - enforces backend-only saves
3. ✅ Activity execution does not require local template files
4. ✅ Bootstrap templates are fallback only (not required for operation)

### Backend Communication
1. ✅ All MCP tools properly call backend API
2. ✅ No direct HTTP calls from OpenCode (MCP abstraction maintained)
3. ✅ Learning data includes impulses_used and component_changes
4. ✅ Execution results stored in SurrealDB

### Graceful Degradation
1. ✅ MCP unavailable → logs warning, continues operation
2. ✅ Backend unavailable → falls back to cache (templates) or logs error (metrics)
3. ✅ Non-blocking metrics reporting (failures logged, not thrown)

---

## Gap Analysis

### Current Gaps
**None** - Architecture is fully compliant with specification.

---

## Recommendations

### 1. Validation Harness
**Priority**: High  
**Action**: Create end-to-end integration test
- Mock activity execution → verify metrics stored in backend
- Test template retrieval → cache → backend flow
- Validate impulse and component change data flow

### 2. Monitoring
**Priority**: Medium  
**Action**: Add observability metrics
- MCP call latency and success rates
- Backend API response times
- Cache hit/miss ratios
- Learning data storage success rates

### 3. Documentation
**Priority**: Medium  
**Action**: Update architecture docs
- Document current state (this trace as source)
- Update MCP tool contracts
- Document learning data schema

### 4. Testing
**Priority**: High  
**Action**: Add integration tests
- Test learning data flow with real impulses
- Test component change tracking
- Test Thompson Sampling variant selection
- Test graceful degradation scenarios

---

## Conclusion

The activity-retrieval-learning-backend-communication specification is **fully implemented and compliant**. All activity retrieval flows through metabob-cli MCP to the backend, learning data flows back through the same path, OpenCode does not manage activity storage locally (local writes were removed in previous commits), and there are no implicit file dependencies.

The architecture follows the principle: **OpenCode → MCP → metabob-cli → metabob-rpc-api → Database**

No changes are required. Focus should shift to:
1. Creating validation harnesses to test the flow
2. Adding monitoring and observability
3. Writing integration tests
4. Documenting the architecture for future maintainers

---

## Trace Metadata

**Impulse ID**: trace-activity-retrieval-learning-backend-communication  
**Type**: templateDefinition  
**Budget**: 5000 tokens  
**Created**: 2026-03-04  
**Status**: COMPLETE ✅
