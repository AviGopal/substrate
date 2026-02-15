# Data Handoff Validation Plan

**Purpose**: Validate every data handoff between OpenCode → CLI → Backend to ensure proper architectural boundaries and data integrity.

**Date**: February 14, 2026  
**Status**: Planning Phase

---

## Executive Summary

This document maps **all critical data handoff points** between the three architectural layers and defines validation tests to ensure:

1. ✅ **Architecture boundaries respected** (OpenCode never calls Backend directly)
2. ✅ **Data transformations correct** (Proto → V2 → OpenCode schemas align)
3. ✅ **Authentication flows work** (Session tokens propagate correctly)
4. ✅ **Error handling consistent** (Errors propagate with proper context)
5. ✅ **Data enrichment working** (Each layer adds expected fields)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA FLOW ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────┘

OpenCode (TypeScript)
    │ MCP Protocol (HTTP/SSE)
    │ ✓ No direct backend calls
    │ ✓ No authentication logic
    │ ✓ UI + local state only
    ▼
metabob-cli (Python MCP Server)
    │ HTTP + Bearer Token
    │ ✓ Session token management
    │ ✓ Proto schema validation
    │ ✓ MCP ↔ HTTP bridge
    ▼
metabob-rpc-api (FastAPI)
    │ SurrealDB + Redis
    │ ✓ Source of truth
    │ ✓ Learning engine
    │ ✓ Thompson Sampling
    └─► Database persistence
```

---

## Critical Handoff Points (12 Total)

### Handoff 1: Session Creation
**Flow**: `OpenCode → CLI → Backend`

**OpenCode**:
- Tool: `create_session()` 
- Input: None (implicit from environment)
- Output: `{ sessionId: string, orgId: string, projectId: string }`

**CLI MCP**:
- Handler: `create_session_tool()` in `src/metabob_cli/mcp/tools.py:1500-1600`
- Transforms: Extract environment context
- Adds: `primary_language`, `tech_stack`, `consumer_id`
- Calls: `POST /v2/session/create`

**Backend**:
- Endpoint: `/v2/session/create` in `server/routes/v2_session.py`
- Creates: 
  - `consumer_profiles` row (if new agent)
  - `sessions` row
  - Session token in Redis (30-day TTL)
- Returns: `{ session_id, session_token, org_id, project_id }`

**Validation Tests**:
1. ✅ OpenCode can create session without backend URL
2. ✅ CLI receives MCP call and extracts environment
3. ✅ CLI adds enrichment fields (primary_language, tech_stack)
4. ✅ Backend creates consumer_profile + session + token
5. ✅ Session token returns to CLI and persists in FileStateManager
6. ✅ OpenCode receives session_id for future calls

---

### Handoff 2: Activity Template Search
**Flow**: `OpenCode → CLI → Backend`

**OpenCode**:
- Tool: `search_activities({ category?, query? })`
- Input: Search parameters
- Output: `Activity[]` (OpenCode schema)

**CLI MCP**:
- Handler: `metabob_search_activities_tool()` in `src/metabob_cli/mcp/tools.py:4224-4300`
- Transforms: Pass-through with session token
- Calls: `POST /v2/activities/search`
- Caching: ActivityManager caches results (60s TTL)

**Backend**:
- Endpoint: `/v2/activities/search` in `server/routes/v2_activities.py:502-600`
- Logic:
  1. Query `activities` + `activity_variants` tables
  2. Thompson Sampling variant selection
  3. Record `activity_impressions` (recommendation shown)
  4. Calculate `predicted_ctr`, `expected_value`, `rank`
- Returns: Proto `ActivitySearchResponse` → V2 format

**Validation Tests**:
1. ✅ OpenCode calls search_activities without auth concerns
2. ✅ CLI adds session token from FileStateManager
3. ✅ Backend returns activities with Thompson Sampling scores
4. ✅ CLI transforms Proto → V2 → OpenCode schema
5. ✅ Backend records impression (tracking shown recommendations)
6. ✅ OpenCode receives properly formatted activities

---

### Handoff 3: Activity Execution Start
**Flow**: `OpenCode → CLI → Backend`

**OpenCode**:
- Tool: `activity({ activityId, variables, reason })`
- Input: Activity ID, variables, reason
- Starts: Activity execution flow
- Records: `activity_selections` (user chose this activity)

**CLI MCP**:
- Handler: `metabob_activity_tool()` in `src/metabob_cli/mcp/tools.py:3617-3663`
- Flow:
  1. Load template from ActivityManager cache or backend
  2. Validate variables against template schema
  3. Create execution record: `POST /v2/activities/record/start`
  4. Execute tasks sequentially
- State: Tracks execution in `ActivityManager._executions`

**Backend**:
- Endpoint: `/v2/activities/record/start` in `server/routes/v2_activities.py:700-800`
- Creates:
  - `activity_selections` row (agent chose this variant)
  - `activity_executions` row (status="running")
- Adds: `time_to_decision_ms`, `competing_options`, `predicted_success`
- Returns: `{ execution_id }`

**Validation Tests**:
1. ✅ OpenCode can execute activity with just ID + variables
2. ✅ CLI loads template (from cache or backend)
3. ✅ CLI validates variables match template schema
4. ✅ Backend creates activity_selections row (tracks choice)
5. ✅ Backend creates activity_executions row (status="running")
6. ✅ Execution ID returns to CLI for step tracking

---

### Handoff 4: Activity Step Recording
**Flow**: `CLI → Backend` (OpenCode not involved)

**CLI**:
- Handler: `ActivityManager.execute_task()`
- Collects: Step metrics (tokens, cost, duration, tool_calls)
- Enrichment: Adds `impulses_loaded`, `impulses_created`, `context_summary`
- Calls: `POST /v2/activities/record/step`

**Backend**:
- Endpoint: `/v2/activities/record/step` in `server/routes/v2_activities.py:900-1000`
- Creates: `execution_steps` row
- Validates: `execution_id` exists, `step_order` sequential
- Stores: Full step context including impulse metadata

**Validation Tests**:
1. ✅ CLI records step with impulse metadata
2. ✅ Backend accepts impulses_loaded, impulses_created fields
3. ✅ Backend stores context_summary dict
4. ✅ Step order validation (must be sequential)
5. ✅ Execution linkage (step → execution foreign key)

---

### Handoff 5: Activity Execution Complete
**Flow**: `CLI → Backend`

**CLI**:
- Handler: `ActivityManager.complete_execution()`
- Aggregates: Total tokens, cost, duration from steps
- Determines: `success` (all steps succeeded)
- Calls: `POST /v2/activities/record/complete`

**Backend**:
- Endpoint: `/v2/activities/record/complete` in `server/routes/v2_activities.py:1100-1200`
- Updates:
  - `activity_executions` (status="completed", success, cost, tokens)
  - `activity_selections` (converted=true, conversion_quality)
  - `variant_performance` (Thompson Sampling: alpha += 1 or beta += 1)
- Triggers: Async aggregation job

**Validation Tests**:
1. ✅ CLI aggregates metrics correctly from steps
2. ✅ Backend updates activity_executions with final metrics
3. ✅ Backend updates activity_selections (marks conversion)
4. ✅ Backend updates Thompson Sampling priors (alpha/beta)
5. ✅ Backend triggers aggregation (variant_performance update)

---

### Handoff 6: Component Annotation
**Flow**: `OpenCode → CLI → Backend`

**OpenCode**:
- Tool: `metabob_annotate_component({ file_path, component_name, component_type, reason })`
- Input: Component details + annotation
- Context: Called after code changes to document WHY

**CLI MCP**:
- Handler: `annotate_component_tool()` in `src/metabob_cli/mcp/tools.py`
- Enrichment: Adds execution_id if in activity context
- Calls: `POST /v2/components/annotate`

**Backend**:
- Endpoint: `/v2/components/annotate`
- Creates: `component_changes` row
- Updates: CPG (Code Property Graph) with annotation
- Links: execution_id (if from activity), impulse_ids (if provided)

**Validation Tests**:
1. ✅ OpenCode calls annotation after code changes
2. ✅ CLI adds execution_id from current activity context
3. ✅ Backend creates component_changes row
4. ✅ Backend updates CPG with annotation
5. ✅ Linkage: component_change → execution_id → activity

---

### Handoff 7: Template Creation
**Flow**: `OpenCode → CLI → Backend`

**OpenCode**:
- Tool: `create_activity_template({ name, description, category, tasks })`
- Input: Template definition (OpenCode schema)
- Output: `{ template_id, variant_id }`

**CLI MCP**:
- Handler: `create_activity_template_tool()` in `src/metabob_cli/mcp/tools.py`
- Transforms: OpenCode schema → Proto ActivityTemplate
- Validation: Proto schema validation
- Calls: `POST /v2/activities/templates`

**Backend**:
- Endpoint: `/v2/activities/templates` in `server/routes/v2_activities.py:140-200`
- Creates:
  - `activities` row (metadata)
  - `activity_variants` row (v1 implementation)
- Adds: `source="agent"`, `author_id`, `created_at`, `content_hash`
- Returns: Proto ActivityTemplate

**Validation Tests**:
1. ✅ OpenCode sends template in OpenCode schema
2. ✅ CLI transforms OpenCode → Proto (schema alignment)
3. ✅ CLI validates Proto schema (catch errors early)
4. ✅ Backend creates activities + activity_variants rows
5. ✅ Backend adds source="agent" (provenance tracking)
6. ✅ Response transforms back: Proto → V2 → OpenCode

---

### Handoff 8: Template Loading
**Flow**: `OpenCode → CLI → Backend`

**OpenCode**:
- Tool: `get_activity_template({ activity_id })`
- Input: Activity ID (e.g., "bug-fix-v1")
- Output: Full activity template with tasks

**CLI MCP**:
- Handler: `get_activity_template_tool()`
- Caching: ActivityManager caches templates (indefinite until restart)
- Calls: `GET /v2/activities/templates/{activity_id}` (if cache miss)

**Backend**:
- Endpoint: `/v2/activities/templates/{activity_id}`
- Logic:
  1. Query `activities` table (metadata)
  2. Query `activity_variants` table (Thompson Sampling selection)
  3. Return best variant based on expected_value
- Returns: Proto ActivityTemplate

**Validation Tests**:
1. ✅ OpenCode requests template by ID
2. ✅ CLI checks cache first (avoid redundant backend calls)
3. ✅ CLI calls backend if cache miss
4. ✅ Backend selects variant via Thompson Sampling
5. ✅ Backend returns Proto template
6. ✅ CLI caches template for future use

---

### Handoff 9: Session Token Refresh
**Flow**: `CLI → Backend → CLI`

**CLI**:
- Trigger: Token approaching expiry (< 24 hours remaining)
- Handler: `FileStateManager.refresh_token_if_needed()`
- Calls: `POST /v2/session/refresh`
- Storage: Updates `~/.config/metabob-cli/.metabob-state.json`

**Backend**:
- Endpoint: `/v2/session/refresh`
- Validates: Current token still valid
- Creates: New token with 30-day TTL
- Updates: Redis with new token
- Returns: `{ session_token, expires_at }`

**Validation Tests**:
1. ✅ CLI detects token approaching expiry
2. ✅ CLI calls refresh endpoint with current token
3. ✅ Backend validates current token
4. ✅ Backend creates new token (30-day TTL)
5. ✅ CLI updates FileStateManager cache
6. ✅ CLI persists new token to disk

---

### Handoff 10: Priority Issues Query
**Flow**: `OpenCode → CLI → Backend`

**OpenCode**:
- Tool: `metabob_get_priority_issues()`
- Input: None (uses session context)
- Output: 0-5 priority issues in current work area

**CLI MCP**:
- Handler: `get_priority_issues_tool()`
- Adds: Session token for context
- Calls: `GET /v2/issues/priority`

**Backend**:
- Endpoint: `/v2/issues/priority`
- Logic:
  1. Analyze recent session activity (files modified, components annotated)
  2. Query code quality issues in work area
  3. Rank by severity + relevance
  4. Return top 5 issues
- Returns: Issues with context (resolutions, annotations)

**Validation Tests**:
1. ✅ OpenCode calls without providing work context
2. ✅ Backend infers work area from session history
3. ✅ Backend returns max 5 issues (not overwhelming)
4. ✅ Issues include resolution history + annotations
5. ✅ Empty result if no active work area detected

---

### Handoff 11: Change Impact Analysis
**Flow**: `OpenCode → CLI → Backend`

**OpenCode**:
- Tool: `metabob_analyze_change_impact({ file_path, component_name })`
- Input: File + component to analyze
- Output: Dependencies, dependents, issues, recommendation

**CLI MCP**:
- Handler: `analyze_change_impact_tool()`
- Calls: `POST /v2/analysis/change-impact`

**Backend**:
- Endpoint: `/v2/analysis/change-impact`
- Data source: CPG (Code Property Graph)
- Logic:
  1. Find component in CPG
  2. Traverse dependency graph (max_depth=3)
  3. Identify issues in dependents + dependencies
  4. Calculate blast radius
  5. Generate recommendation (safe / caution / critical)
- Returns: Impact analysis with issues

**Validation Tests**:
1. ✅ OpenCode sends file + component name
2. ✅ Backend queries CPG for component
3. ✅ Backend traverses dependencies correctly
4. ✅ Backend includes issues in related components
5. ✅ Recommendation logic works (safe/caution/critical)

---

### Handoff 12: Deletion Safety Assessment
**Flow**: `OpenCode → CLI → Backend`

**OpenCode**:
- Tool: `metabob_assess_deletion_safety({ file_path, component_name })`
- Input: Component to potentially delete
- Output: Liveness verdict (live/dead/cycle_dead) + safety verdict

**CLI MCP**:
- Handler: `assess_deletion_safety_tool()`
- Calls: `POST /v2/analysis/deletion-safety`

**Backend**:
- Endpoint: `/v2/analysis/deletion-safety`
- Data source: CPG with GC-style liveness analysis
- Logic:
  1. Mark phase: Identify live roots (entry points, public APIs)
  2. Trace phase: Follow dependency graph from roots
  3. Sweep phase: Unmarked code is dead
  4. Return verdict + live paths (if reachable)
- Returns: Liveness verdict + safety recommendation

**Validation Tests**:
1. ✅ OpenCode sends component to assess
2. ✅ Backend performs GC-style liveness analysis
3. ✅ Backend distinguishes live vs. dead cycles
4. ✅ Backend returns live paths if reachable
5. ✅ Safety verdict correct (SAFE/CAUTION/CRITICAL)

---

## Schema Transformation Map

### Proto → V2 → OpenCode

**Critical Fields**:

| Proto Field | V2 Field | OpenCode Field | Notes |
|-------------|----------|----------------|-------|
| `activity_id` | `activity_id` | `activityId` | camelCase transform |
| `task_steps` | `tasks` | `tasks` | V2 supports both fields |
| `intent_keywords` | `intent_keywords` | `intentKeywords` | camelCase transform |
| `expected_cost` | `expected_cost` | `expectedCost` | Float precision maintained |
| `session_token` | `session_token` | N/A (CLI only) | Never exposed to OpenCode |

**Validation Tests**:
1. ✅ Proto → V2 transformation preserves all fields
2. ✅ V2 → OpenCode camelCase conversion correct
3. ✅ OpenCode → V2 → Proto round-trip lossless
4. ✅ Session token never leaks to OpenCode

---

## Authentication Flow Validation

### Session Token Lifecycle

```
1. Session Creation
   Backend generates token → Redis (30-day TTL)
   ↓
2. Token Storage (CLI)
   FileStateManager writes ~/.config/metabob-cli/.metabob-state.json
   ↓
3. Token Usage
   Every MCP → HTTP call: CLI adds "Authorization: Bearer {token}"
   ↓
4. Token Validation (Backend)
   Extract from header → Query Redis → Validate not expired
   ↓
5. Token Refresh (< 24h remaining)
   CLI detects → Calls /v2/session/refresh → Updates FileStateManager
```

**Validation Tests**:
1. ✅ Token created on session creation
2. ✅ Token persists in FileStateManager (~/.config/metabob-cli/)
3. ✅ Token added to every HTTP request (Authorization header)
4. ✅ Backend validates token against Redis
5. ✅ Token refresh works when approaching expiry
6. ✅ Expired tokens rejected with 401

---

## Error Propagation Validation

### Error Flow: Backend → CLI → OpenCode

**Backend Error Format** (Proto):
```protobuf
message Status {
  StatusCode code = 1;  // OK, INVALID_ARGUMENT, NOT_FOUND, etc.
  string message = 2;
  repeated Any details = 3;
}
```

**CLI Error Format** (JSON):
```json
{
  "status": "error",
  "error": "Error message",
  "code": "NOT_FOUND",
  "details": {}
}
```

**OpenCode Error Format** (TypeScript):
```typescript
class MCPError extends Error {
  code: string;
  details?: any;
}
```

**Validation Tests**:
1. ✅ Backend returns Proto Status on error
2. ✅ CLI transforms Proto Status → JSON error
3. ✅ OpenCode receives MCP error with code + message
4. ✅ Error details preserved through layers
5. ✅ User sees actionable error message

---

## Data Enrichment Validation

### Enrichment Layer Responsibilities

| Layer | Enrichment Responsibility |
|-------|---------------------------|
| **OpenCode** | User intent (reason), activity variables, file context |
| **CLI** | Session token, execution_id (if in activity), environment (tech_stack) |
| **Backend** | Thompson Sampling scores, source="agent"/"bootstrap", timestamps, CPG linkage |

**Validation Tests**:
1. ✅ OpenCode provides user-facing data (intent, variables)
2. ✅ CLI adds authentication + execution context
3. ✅ Backend adds learning data (Thompson scores, provenance)
4. ✅ No layer adds data outside its responsibility
5. ✅ Enrichment accumulates correctly (no overwrites)

---

## Validation Test Suite Structure

### Test Organization

```
scripts/
  validate-handoffs/
    01_session_creation.py
    02_activity_search.py
    03_activity_execution_start.py
    04_activity_step_recording.py
    05_activity_execution_complete.py
    06_component_annotation.py
    07_template_creation.py
    08_template_loading.py
    09_session_token_refresh.py
    10_priority_issues.py
    11_change_impact_analysis.py
    12_deletion_safety_assessment.py
    
    run_all_validations.py  # Master test runner
    validation_report.md     # Generated report
```

### Test Requirements

Each test must validate:
1. ✅ **Request format** (schema matches expected)
2. ✅ **Authentication** (token added by CLI, validated by backend)
3. ✅ **Data transformation** (Proto ↔ V2 ↔ OpenCode)
4. ✅ **Enrichment** (each layer adds expected fields)
5. ✅ **Database persistence** (data stored correctly)
6. ✅ **Response format** (client receives expected schema)
7. ✅ **Error handling** (errors propagate with context)

---

## Success Criteria

### Validation Complete When:

1. ✅ All 12 handoff points tested with passing tests
2. ✅ Schema transformations verified (Proto ↔ V2 ↔ OpenCode)
3. ✅ Authentication flow works end-to-end
4. ✅ Error propagation tested (Backend → CLI → OpenCode)
5. ✅ Data enrichment validated (each layer adds expected fields)
6. ✅ Architecture boundaries enforced (OpenCode never calls Backend)
7. ✅ Zero orphaned data (all foreign keys valid)

### Metrics to Track:

- **Test Coverage**: 12/12 handoff points validated
- **Pass Rate**: 100% of tests passing
- **Schema Alignment**: 0 transformation errors
- **Auth Failures**: 0 authentication issues
- **Data Integrity**: 0 orphaned records

---

## Next Steps

1. **Implement test suite** (scripts/validate-handoffs/)
2. **Run validation tests** against local environment
3. **Document results** in validation_report.md
4. **Fix any issues** discovered during validation
5. **Add to CI/CD** for continuous validation

---

**Document Status**: Planning Complete, Ready for Implementation  
**Estimated Implementation Time**: 4-6 hours (12 tests × 20-30 min each)  
**Priority**: High (ensures architectural integrity)
