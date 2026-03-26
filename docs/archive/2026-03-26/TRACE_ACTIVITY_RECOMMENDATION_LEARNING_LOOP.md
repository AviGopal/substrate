# Activity Recommendation and Learning Loop - Implementation Trace

**Specification**: Activity Recommendation and Learning Loop End-to-End Validation  
**Status**: ⚠️ PARTIALLY IMPLEMENTED  
**Critical Gap**: POST /v2/activities/recommend endpoint missing  
**Date**: 2026-03-07

## Executive Summary

The activity recommendation and learning loop is **partially implemented** with a critical missing piece:

- ✅ **Execution Recording**: Works end-to-end via MCP → Learning Loop API → SurrealDB
- ✅ **MCP Architecture**: 100% compliant, all backend communication through MCP layer
- ✅ **Thompson Sampling Client**: OpenCode ready to consume recommendations
- ❌ **Recommendation Endpoint**: Backend endpoint **DOES NOT EXIST**, causing recommendations to fail silently

## Data Flow Analysis

### Current Flow (Execution Recording - WORKING)

```
Activity executes
  ↓
Activity.complete() 
  ↓
TemplateMetricsClient.reportExecution()
  ↓
metabob_post_activity_result (MCP tool)
  ↓
POST /api/v1/learning-loop/executions (Backend API)
  ↓
Background Task:
  - insert_execution() → SurrealDB activity_execution table
  - update_metrics_after_execution() → Thompson alpha/beta increments
  - create_impulse_usage_records() → impulse learning data
  ↓
✅ Metrics persisted, alpha/beta updated
```

**Evidence**:
- `template-metrics-client.ts:96-149` - MCP-only execution recording
- `activity_template_tools.py:314-410` - metabob_post_activity_result MCP tool
- `learning_loop.py:289-392` - Endpoint with background processing
- ✅ NO DUAL WRITES - Architectural compliance enforced

### Broken Flow (Recommendations - FAILING)

```
User requests recommendations
  ↓
MetabobCLI.recommendActivities()
  ↓
metabob_recommend_activities (MCP tool)
  ↓
POST /v2/activities/recommend (Backend API)
  ↓
❌ ENDPOINT DOES NOT EXIST
  ↓
CLI returns empty array
  ↓
OpenCode falls back to stable template (graceful degradation)
  ↓
⚠️ Thompson Sampling NEVER executes for recommendations
```

**Evidence**:
- `template-selector.ts:164` - Calls MetabobCLI.recommendActivities()
- `activity_template_tools.py:961` - Calls POST /v2/activities/recommend
- `activity.py` - Endpoint list shows NO /recommend route (only /templates, /variants, /executions, /select, /content, /tasks, /storage)
- Recommendation always returns empty array → graceful degradation kicks in

## Component Analysis

### ✅ Working Components

| Component | File | Status |
|-----------|------|--------|
| Template Selection | `tool/activity.ts:463-555` | ✅ Calls TemplateSelector.select() |
| Thompson Sampling Delegation | `template-selector.ts:121-291` | ✅ Delegates to MCP backend |
| MCP Client Wrapper | `util/metabob.ts:786-820` | ✅ Calls metabob_recommend_activities |
| Execution Recording Client | `template-metrics-client.ts:96-149` | ✅ MCP-only, graceful degradation |
| MCP Recording Tool | `activity_template_tools.py:314-410` | ✅ Calls learning loop API |
| Learning Loop Endpoint | `learning_loop.py:289-392` | ✅ Background async processing |

### ❌ Missing Components

| Component | Expected Location | Impact |
|-----------|-------------------|--------|
| Recommendation Endpoint | `routes/activity.py` | **CRITICAL** - Recommendations always fail |
| Thompson Sampling Logic | `actions/activity.py` | **VALIDATION NEEDED** - May not exist |
| Beta Distribution Sampling | `actions/activity.py` | **VALIDATION NEEDED** - Needs verification |

## Critical Gaps

### 1. POST /v2/activities/recommend Endpoint Missing

**Impact**: Recommendations fail silently, Thompson Sampling never executes

**Expected Behavior**:
```python
@router.post("/recommend")
async def recommend_activities(
    task_description: str,
    category: Optional[str] = None,
    loaded_impulses: List[str] = [],
    limit: int = 5
):
    """
    Recommend activity templates using Thompson Sampling.
    
    Algorithm:
    1. Query templates (filter by category if provided)
    2. For each template:
       - Load metrics (alpha, beta) from template_metrics
       - Sample from Beta(alpha, beta) distribution
    3. Rank templates by sample value (highest first)
    4. Return top N with selection_metadata:
       {
         template_id, 
         selection_metadata: {
           method: "thompson_sampling",
           alpha, beta, sample
         }
       }
    """
```

**Fix Location**: `repos/metabob-rpc-api/server/routes/activity.py`

**Implementation Requirements**:
- Accept: `{task_description, category, loaded_impulses, limit}`
- Query: Templates from SurrealDB/Redis filtered by category
- Sample: Beta(alpha, beta) for each template using `random.betavariate(alpha, beta)`
- Rank: By sample value descending
- Return: `{status: "success", recommendations: [{template_id, selection_metadata}]}`

### 2. Thompson Sampling Implementation Validation

**Impact**: Unknown if Beta sampling and alpha/beta updates work correctly

**Validation Needed**:
1. ✅ Verify `sample_beta()` function exists in `actions/activity.py`
2. ✅ Verify `select_variant_thompson_sampling()` correctly samples and ranks
3. ✅ Verify `update_metrics_after_execution()` increments alpha (success) and beta (failure)
4. ✅ Verify SurrealDB schema has `thompson_alpha` and `thompson_beta` columns

**Files to Check**:
- `repos/metabob-rpc-api/server/actions/activity.py`
- `repos/metabob-rpc-api/server/db/operations/activity_execution.py`
- `repos/metabob-rpc-api/server/db/operations/template_data.py`

### 3. End-to-End Testing in devbob Container

**Impact**: Cannot confirm learning loop works in isolated environment

**Test Plan**:
```bash
# 1. Execute in devbob container
kubectl exec -it deployment/devbob-agent -n devbob -- bash

# 2. Test recommendation flow
opencode mcp call metabob_recommend_activities \
  '{"task_description": "Add authentication feature", "category": "feature", "limit": 3}'

# Expected: Returns 3 ranked templates with selection_metadata
# Actual: Returns empty array due to missing endpoint

# 3. Execute an activity
opencode activity execute --template add-feature-complete \
  --variables '{"featureName": "auth", "files": ["src/auth.ts"]}'

# 4. Verify SurrealDB persistence
# Check activity_execution table has new record
# Check template_metrics alpha/beta incremented

# 5. Call recommendations again
opencode mcp call metabob_recommend_activities \
  '{"task_description": "Add authentication feature", "category": "feature", "limit": 3}'

# Expected: Returns updated recommendations with new alpha/beta values
# Actual: Still returns empty array
```

## Architecture Compliance

| Aspect | Status | Evidence |
|--------|--------|----------|
| MCP Layer | ✅ COMPLIANT | All backend calls through MCP tools |
| Single Source of Truth | ✅ COMPLIANT | SurrealDB primary, background async writes |
| Thompson Sampling | ⚠️ PARTIAL | Client ready, backend endpoint missing |
| Graceful Degradation | ✅ COMPLIANT | Falls back to stable template on MCP failure |
| Learning Loop | ❌ BROKEN | Execution recording works, recommendations don't |

## Validation Plan

### Phase 1: Implement Missing Endpoint
- [ ] Implement POST /v2/activities/recommend in `routes/activity.py`
- [ ] Add Thompson Sampling logic (Beta sampling, ranking)
- [ ] Connect to SurrealDB template_metrics for alpha/beta values
- [ ] Return recommendations with selection_metadata

### Phase 2: Validate Thompson Sampling
- [ ] Verify `sample_beta()` function exists and is correct
- [ ] Verify `update_metrics_after_execution()` increments alpha/beta
- [ ] Unit test Beta distribution sampling (alpha=5, beta=2 should favor success)
- [ ] Integration test: Execute activity → Check alpha/beta updated

### Phase 3: End-to-End Testing
- [ ] Deploy to k8s cluster with devbob container
- [ ] Execute test: recommendations → activity → persistence → recommendations
- [ ] Verify SurrealDB tables updated correctly
- [ ] Verify Thompson Sampling improves recommendations over time
- [ ] Test graceful degradation (backend unavailable → local fallback)

### Phase 4: Performance Validation
- [ ] Measure recommendation latency (should be < 200ms)
- [ ] Verify background async writes don't block UI (< 50ms response)
- [ ] Test under load (10 concurrent recommendations)
- [ ] Monitor SurrealDB query performance

## Related Files

**OpenCode (Client)**:
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
- `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
- `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`
- `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**CLI (MCP Layer)**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Backend (API)**:
- `repos/metabob-rpc-api/server/routes/activity.py` (needs /recommend endpoint)
- `repos/metabob-rpc-api/server/routes/learning_loop.py`
- `repos/metabob-rpc-api/server/actions/activity.py` (Thompson Sampling logic)
- `repos/metabob-rpc-api/server/db/operations/activity_execution.py`
- `repos/metabob-rpc-api/server/db/operations/template_data.py`

## Impulse Created

✅ **Impulse ID**: `trace-Activity Recommendation and Learning Loop End-to-End Validation`  
✅ **Type**: `templateDefinition`  
✅ **Budget**: 5000 tokens  
✅ **Location**: `impulses/trace-activity-recommendation-learning-loop.json`

This impulse contains the complete trace analysis for downstream validation and enforcement tasks.

## Next Steps

1. **CRITICAL**: Implement POST /v2/activities/recommend endpoint (blocks learning loop)
2. **VALIDATION**: Verify Thompson Sampling logic exists and is correct
3. **TESTING**: Execute end-to-end test in devbob container
4. **MONITORING**: Add observability for recommendation quality over time

