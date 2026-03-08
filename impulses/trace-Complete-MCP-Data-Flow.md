# Complete MCP Data Flow Trace for Activity and Impulse System

## Executive Summary

**Status**: PARTIALLY IMPLEMENTED (40% complete)

**Critical Findings**:
- ✅ 2/5 required MCP tools implemented and working
- ❌ 3/5 critical MCP tools completely missing
- ✅ Architectural compliance enforced (MCP-only, no dual-write)
- ❌ Learning loop broken: no variant creation, no recommendations, no impulse learning

## Working Data Flows

### 1. Activity Execution Recording (✅ WORKING)

**Path**: 
```
Activity.complete() 
  → TemplateMetricsClient.reportExecution(data)
  → MCP.callTool('metabob_post_activity_result', args)
  → CLI metabob_post_activity_result(activity_id, result)
  → httpx.post('/api/v1/learning-loop/executions', json=request_data)
  → RPC API validates ExecutionRequest schema
  → SurrealDB INSERT INTO activity_executions
  → Response: {execution_id, metrics_updated}
```

**Components**:
- `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:96` - reportExecution()
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:300` - metabob_post_activity_result
- Backend endpoint: `POST /api/v1/learning-loop/executions`

**Schema**:
```typescript
{
  activity_id: string,
  template_id: string,
  started_at: ISO8601,
  duration_ms: number,
  success: boolean,
  tokens_input/output/cache: number,
  cost_usd: number,
  impulses_used?: ImpulseUsage[],
  component_changes?: ComponentChange[]
}
```

**Validation**: Proper error handling, timeout handling, graceful degradation

### 2. Template Search/List (✅ WORKING)

**Path**:
```
TemplateRepository.list(category)
  → MCP.callTool('metabob_search_activities', {category})
  → CLI metabob_search_activities(category)
  → httpx.get('/v2/activities/templates?category=X')
  → RPC API queries SurrealDB activity_template table
  → Response: {templates: [{variant_id, name, metrics}]}
```

**Components**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:26` - metabob_search_activities
- Backend endpoint: `GET /v2/activities/templates`

### 3. Boredom Activities (⚠️ PARTIALLY WORKING)

**Path**:
```
BoredomDetection.fetchActivities()
  → MCP.callTool('metabob_fetch_boredom_activities', {threshold})
  → CLI metabob_fetch_boredom_activities(threshold, limit)
  → httpx.get('/api/v1/learning-loop/boredom-activities?threshold=X')
  → RPC API queries templates with low improvement_gradient
  → Response: {activities: [{template_id, priority, metrics}]}
```

**Components**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:565` - metabob_fetch_boredom_activities
- Backend endpoint: `GET /api/v1/learning-loop/boredom-activities`

**Status**: Implementation exists but needs E2E validation of SurrealDB persistence

## Missing Critical Data Flows

### 1. Variant Creation (❌ NOT IMPLEMENTED)

**Required**: `metabob_create_activity_variant`

**Desired Path**:
```
Trailblazing.createVariant(definition)
  → MCP.callTool('metabob_create_activity_variant', variant_def)
  → CLI tool transforms and validates
  → POST /v2/activities/variants
  → SurrealDB INSERT with parent linkage
  → Response: {variant_id}
```

**Parameters**:
```python
{
  "base_template_id": str,  # Base template to derive from
  "variant_definition": dict,  # Task modifications, variable changes
  "metadata": {
    "name": str,
    "description": str,
    "reason_for_creation": str
  }
}
```

**Backend Endpoint**: `POST /v2/activities/variants` (MISSING)

**Impact**: 
- Trailblazing completely broken
- Cannot create dynamic variants
- No template evolution
- Learning loop stuck with static templates

**Implementation Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

### 2. Activity Recommendations (❌ NOT IMPLEMENTED)

**Required**: `metabob_recommend_activities`

**Desired Path**:
```
ActivitySelector.recommend(task)
  → MCP.callTool('metabob_recommend_activities', {task, impulses})
  → CLI tool calls backend ML service
  → POST /v2/activities/recommend with embedding search
  → Thompson Sampling for variant selection
  → Response: ranked templates
```

**Parameters**:
```python
{
  "task_description": str,
  "category": str,  # feature/bugfix/refactor/tool/infrastructure
  "loaded_impulses": list[str],  # Impulse IDs currently loaded
  "limit": int  # Max recommendations (default 5)
}
```

**Response**:
```python
{
  "recommendations": [
    {
      "template_id": str,
      "score": float,  # 0.0-1.0
      "reason": str,
      "impulse_alignment": float  # How well impulses match
    }
  ]
}
```

**Backend Endpoint**: `POST /v2/activities/recommend` (MISSING)

**Impact**:
- No intelligent template selection
- Agent picks templates blindly
- Cannot leverage impulse context
- Recommendation system completely broken

### 3. Impulse Recommendations (❌ NOT IMPLEMENTED)

**Required**: `metabob_recommend_impulses`

**Desired Path**:
```
ImpulseLearning.recommend(activity_id)
  → MCP.callTool('metabob_recommend_impulses', {activity_id})
  → CLI tool queries impulse_usage history
  → POST /v2/impulses/recommend
  → Aggregate usefulness scores by impulse type
  → Response: ranked impulse suggestions
```

**Parameters**:
```python
{
  "activity_id": str,  # Activity/template ID
  "task_description": str,  # Task context
  "limit": int  # Max recommendations (default 10)
}
```

**Response**:
```python
{
  "recommendations": [
    {
      "impulse_type": str,  # file/memo/activityOutput/etc
      "score": float,  # 0.0-1.0 usefulness score
      "reason": str,
      "usage_count": int  # Historical usage for this activity type
    }
  ]
}
```

**Backend Endpoint**: `POST /v2/impulses/recommend` (MISSING)

**Impact**:
- No impulse learning
- Cannot measure usefulness
- Missing feedback loop
- Impulse system ineffective

## Architectural Compliance

### ✅ Enforced Constraints

1. **MCP-Only Communication**: All backend communication goes through MCP layer
2. **Single Write Path**: TemplateMetricsClient is the ONLY execution recording path
3. **No Dual-Write**: Removed HTTP code that bypassed MCP (82 lines removed from activity.ts:1083)
4. **Backend-Only Template Storage**: Templates saved only to backend via MCP

### Evidence

```typescript
// repos/metabob-opencode/packages/opencode/src/session/activity.ts:1086
// REMOVED: Direct HTTP POST to /v2/activities/executions (82 lines removed)
// REASON: Architectural violation - bypassed MCP layer, created dual-write inconsistency
// REPLACEMENT: TemplateMetricsClient.reportExecution() at line 1051 is the ONLY execution recording path
// DATA FLOW: Activity.complete() → TemplateMetricsClient → MCP metabob_post_activity_result → CLI → /api/v1/learning-loop/executions → DB
```

## Backend API Endpoints

### Implemented

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/v1/learning-loop/executions` | POST | Record execution | ✅ Working |
| `/api/v1/learning-loop/boredom-activities` | GET | Fetch low-gradient templates | ⚠️ Needs validation |
| `/v2/activities/templates` | GET | List templates | ✅ Working |
| `/v2/activities/templates/{id}` | GET | Get template by ID | ✅ Working |
| `/v2/activities/templates` | POST | Register new template | ✅ Working |

### Missing (CRITICAL)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/v2/activities/variants` | POST | Create variant | 🔴 CRITICAL |
| `/v2/activities/recommend` | POST | Recommend templates | 🔴 CRITICAL |
| `/v2/impulses/recommend` | POST | Recommend impulses | 🔴 CRITICAL |

## Testing Requirements

### Required E2E Tests

1. **Activity Execution Recording**
   - Execute activity → verify SurrealDB `activity_executions` table
   - Check impulses_used and component_changes are persisted
   - Validate metrics update triggers Thompson Sampling recalculation

2. **Boredom Activities**
   - Insert templates with varying improvement_gradient
   - Call metabob_fetch_boredom_activities(threshold=0.5)
   - Verify only low-gradient templates returned

3. **Variant Creation** (once implemented)
   - Create variant via MCP tool
   - Verify SurrealDB `activity_template` table has new variant
   - Check parent linkage is correct

4. **Activity Recommendations** (once implemented)
   - Register templates with embeddings
   - Request recommendations with task description
   - Verify Thompson Sampling influences ranking

5. **Impulse Recommendations** (once implemented)
   - Execute activities with different impulse types
   - Record impulse_usage patterns
   - Request recommendations for new activity
   - Verify historically useful impulses ranked higher

## Action Items

### Priority: CRITICAL (Blocks Learning Loop)

1. **Implement metabob_create_activity_variant**
   - Location: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`
   - Effort: 4-6 hours
   - Blockers: Need backend endpoint `POST /v2/activities/variants`
   - Owner: TBD

2. **Implement metabob_recommend_activities**
   - Location: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`
   - Effort: 6-8 hours
   - Blockers: Need backend ML service (embedding search + Thompson Sampling)
   - Owner: TBD

3. **Implement metabob_recommend_impulses**
   - Location: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`
   - Effort: 4-6 hours
   - Blockers: Need backend endpoint `POST /v2/impulses/recommend` with usage aggregation
   - Owner: TBD

### Priority: HIGH (Quality Assurance)

4. **Create E2E test suite**
   - Location: `tests/e2e/mcp_data_flow_tests.py`
   - Effort: 8-10 hours
   - Blockers: Need test SurrealDB instance and backend running
   - Owner: TBD

5. **Validate boredom activities SurrealDB persistence**
   - Location: `tests/integration/boredom_detection_test.py`
   - Effort: 2-3 hours
   - Blockers: Need backend with test data
   - Owner: TBD

## Implementation Templates

### Template: metabob_create_activity_variant

```python
@mcp.tool(
    name="metabob_create_activity_variant",
    description="Create a new activity variant derived from a base template",
)
async def metabob_create_activity_variant(
    base_template_id: str,
    variant_definition: dict,
    metadata: dict,
    ctx: Context = None,
):
    """Create variant and persist to SurrealDB via backend API."""
    try:
        request_data = {
            "base_template_id": base_template_id,
            "variant_definition": variant_definition,
            "metadata": metadata,
        }
        
        result = await call_api("POST", "/v2/activities/variants", json=request_data)
        
        if result["status"] != "success":
            return {
                "status": "error",
                "error": result.get("error", "Failed to create variant"),
            }
        
        return {
            "status": "success",
            "variant_id": result["data"]["variant_id"],
            "message": f"Variant created: {result['data']['variant_id']}",
        }
    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to create variant: {str(e)}",
        }
```

### Template: metabob_recommend_activities

```python
@mcp.tool(
    name="metabob_recommend_activities",
    description="Get ranked activity template recommendations based on task and impulse context",
)
async def metabob_recommend_activities(
    task_description: str,
    category: str | None = None,
    loaded_impulses: list[str] = [],
    limit: int = 5,
    ctx: Context = None,
):
    """Query backend ML service for template recommendations."""
    try:
        request_data = {
            "task_description": task_description,
            "category": category,
            "loaded_impulses": loaded_impulses,
            "limit": limit,
        }
        
        result = await call_api("POST", "/v2/activities/recommend", json=request_data)
        
        if result["status"] != "success":
            return {
                "status": "error",
                "error": result.get("error", "Failed to get recommendations"),
            }
        
        return {
            "status": "success",
            "recommendations": result["data"]["recommendations"],
        }
    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to get recommendations: {str(e)}",
        }
```

### Template: metabob_recommend_impulses

```python
@mcp.tool(
    name="metabob_recommend_impulses",
    description="Get ranked impulse recommendations based on historical usefulness",
)
async def metabob_recommend_impulses(
    activity_id: str,
    task_description: str,
    limit: int = 10,
    ctx: Context = None,
):
    """Query impulse usage history for recommendations."""
    try:
        request_data = {
            "activity_id": activity_id,
            "task_description": task_description,
            "limit": limit,
        }
        
        result = await call_api("POST", "/v2/impulses/recommend", json=request_data)
        
        if result["status"] != "success":
            return {
                "status": "error",
                "error": result.get("error", "Failed to get impulse recommendations"),
            }
        
        return {
            "status": "success",
            "recommendations": result["data"]["recommendations"],
        }
    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to get impulse recommendations: {str(e)}",
        }
```

## Summary

**Current State**: 2/5 critical MCP tools implemented (40% complete)

**Key Insight**: The architectural compliance work successfully removed dual-write violations and enforced MCP-only communication. However, it revealed that 3 critical MCP tools were never implemented, breaking the learning loop.

**Next Steps**:
1. Implement 3 missing MCP tools in metabob-cli
2. Create backend endpoints for variant creation and recommendations
3. Build comprehensive E2E test suite
4. Validate SurrealDB persistence for all data flows

**Estimated Total Effort**: 24-32 hours to complete learning loop
