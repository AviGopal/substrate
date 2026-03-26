# Trace: devbob-activity-execution-validation

**Specification**: Validate complete end-to-end activity recommendation and learning loop by executing activities from devbob container in k8s and following execution via metabob-rpc-api logs.

**Trace Date**: 2026-03-07  
**Status**: ⚠️ INCOMPLETE - Missing critical components for Thompson Sampling and learning loop closure

---

## Current State Summary

### Deployment Status ✅
- **Backend**: `metabob-rpc-api.metabob.svc.cluster.local:8080` (version 0.23.1-cache-fix-v2)
- **DevBob**: `devbob-84466fdfff-dd87l` running in k8s namespace `metabob`
- **Network**: k8s service DNS works ✅, external ingress blocked ❌
- **Tests**: 4/4 critical tests passing (100%)

### Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│ DevBob Container (k8s pod)                                       │
│  ├─ opencode CLI (activity.ts:1-1648)                           │
│  │   Commands: list, template, run, init, clear, metrics,       │
│  │             recommend <template-id>, promote, evolve          │
│  │   ❌ MISSING: activity recommend --task (ML-based)           │
│  │                                                               │
│  └─ MCP Client (mcp/index.ts:1-472)                             │
│      ├─ Config: opencode.devbob.json                            │
│      │   mcp.metabob.url: http://metabob-rpc-api...8080         │
│      └─ Tools: Connects to metabob-cli MCP server               │
└─────────────────────────────────────────────────────────────────┘
                          │ HTTP/MCP
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ metabob-cli MCP Server (Python)                                 │
│  activity_template_tools.py:1-1104                              │
│  ✅ metabob_search_activities                                   │
│  ✅ metabob_get_activity_template                               │
│  ✅ metabob_register_activity_template                          │
│  ✅ metabob_post_activity_result                                │
│  ✅ metabob_fetch_boredom_activities                            │
│  ✅ metabob_create_activity_variant                             │
│  ⚠️  metabob_recommend_activities (defined but backend missing) │
│  ⚠️  metabob_recommend_impulses (defined but backend missing)   │
└─────────────────────────────────────────────────────────────────┘
                          │ HTTP REST
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ metabob-rpc-api Backend (FastAPI)                               │
│  ├─ Learning Loop Router (learning_loop.py:1-150+)             │
│  │   POST /api/v1/learning-loop/executions ✅                   │
│  │   GET  /api/v1/learning-loop/boredom-activities ✅           │
│  │   ❌ MISSING: POST /v2/activities/recommend                 │
│  │                                                               │
│  └─ Database Operations (activity_execution.py:1-150+)         │
│      insert_execution() → SurrealDB ✅                           │
│      ❌ MISSING: update_metrics_after_execution() with alpha/beta│
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ SurrealDB                                                        │
│  ├─ activity_executions table ✅                                │
│  │   Columns: activity_id, template_id, success, tokens,        │
│  │            cost, duration_ms, impulses_used, component_changes│
│  │                                                               │
│  └─ template_metrics table ⚠️                                   │
│      ❌ MISSING: alpha, beta columns for Thompson Sampling      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Analysis

### Expected Flow (Specification)
```
1. DevBob: opencode activity recommend --task "Add REST endpoint"
   → MCP: metabob_recommend_activities
   → Backend: POST /v2/activities/recommend (Thompson Sampling)
   → SurrealDB: SELECT * FROM template_metrics ORDER BY sample_score
   → Response: 3-5 templates with {alpha, beta, sample_score}

2. DevBob: opencode activity run <template-id>
   → Activity executes with session_id
   → On completion: metabob_post_activity_result

3. MCP: metabob_post_activity_result
   → Backend: POST /api/v1/learning-loop/executions
   → SurrealDB: INSERT INTO activity_executions
   → SurrealDB: UPDATE template_metrics SET alpha = alpha + 1 WHERE success
   → Response: {metrics_updated: true}

4. DevBob: opencode activity recommend --task "Add REST endpoint"
   → MCP: metabob_recommend_activities
   → Backend: Thompson Sampling with UPDATED alpha/beta
   → Response: Different rankings (learning loop closed ✅)
```

### Current Flow (Actual)
```
1. DevBob: opencode activity recommend <template-id> ❌ (A/B testing only)
   → recommendation-engine.ts uses LOCAL scoring only
   → NO Thompson Sampling integration

2. DevBob: opencode activity run <directory>
   → Activity executes ✅
   → metabob_post_activity_result NOT called ❌

3. Manual POST to /api/v1/learning-loop/executions ✅
   → SurrealDB INSERT works ✅
   → alpha/beta NOT updated ❌

4. Learning loop DOES NOT close ❌
```

---

## Critical Gaps

### Gap 1: OpenCode CLI Missing ML-Based Recommendation Command
**File**: `repos/metabob-opencode/packages/opencode/src/cli/cmd/activity.ts`  
**Current**: Lines 1150-1248 implement `recommend <template-id>` for A/B testing  
**Missing**: `activity recommend --task <description>` that calls `metabob_recommend_activities`

**Required Implementation**:
```typescript
.command({
  command: "recommend [task]",
  describe: "get ML-based activity recommendations",
  builder: (yargs: Argv) => {
    return yargs
      .positional("task", {
        describe: "task description for recommendation",
        type: "string",
      })
      .option("category", {
        describe: "filter by category",
        type: "string",
        choices: ["feature", "bugfix", "refactor", "tool", "infrastructure"],
      })
      .option("limit", {
        describe: "max recommendations to return",
        type: "number",
        default: 5,
      })
  },
  handler: async (args) => {
    // Call metabob_recommend_activities MCP tool
    // Display Thompson Sampling results
  }
})
```

### Gap 2: RecommendationEngine Not Integrated with Thompson Sampling
**File**: `repos/metabob-opencode/packages/opencode/src/session/recommendation-engine.ts`  
**Current**: Lines 73-120 use local scoring (category match, keywords, success rate)  
**Missing**: Integration with `metabob_recommend_activities` MCP tool

**Required Change**: Add MCP tool call in `generate()`:
```typescript
// After local scoring
if (shouldUseMLRecommendations(context)) {
  const mcpRecommendations = await MetabobMCP.recommendActivities({
    taskDescription: context.taskScope.taskType,
    category: context.taskScope.taskType,
    loadedImpulses: context.impulseIDs || [],
    limit: 5
  })
  
  // Merge with local recommendations, prioritize ML results
  activities = mergeScoredActivities(activities, mcpRecommendations)
}
```

### Gap 3: Backend Missing Thompson Sampling Endpoint
**File**: `repos/metabob-rpc-api/server/routes/activity.py` OR `learning_loop.py`  
**Missing**: `POST /v2/activities/recommend`

**Required Implementation**:
```python
@router.post("/v2/activities/recommend")
async def recommend_activities(request: RecommendationRequest):
    """
    Implement Thompson Sampling for activity template recommendation.
    
    1. Query template_metrics for alpha/beta values
    2. For each template: sample ~ Beta(alpha, beta)
    3. Sort by sampled value (exploitation + exploration)
    4. Return top N templates with selection_metadata
    """
    templates = await get_all_metrics()
    
    for template in templates:
        # Thompson Sampling: sample from Beta distribution
        alpha = template.get("alpha", 1)
        beta = template.get("beta", 1)
        sample_score = np.random.beta(alpha, beta)
        template["selection_metadata"] = {
            "alpha": alpha,
            "beta": beta,
            "sample_score": sample_score
        }
    
    # Sort by sample_score descending
    ranked = sorted(templates, key=lambda t: t["selection_metadata"]["sample_score"], reverse=True)
    
    return {
        "status": "success",
        "recommendations": ranked[:request.limit],
        "selection_method": "thompson_sampling"
    }
```

### Gap 4: template_metrics Missing alpha/beta Columns
**File**: `repos/metabob-rpc-api/server/db/operations/template_metrics.py`  
**Issue**: Schema may not include Thompson Sampling columns

**Required Schema**:
```python
{
    "template_id": str,
    "total_executions": int,
    "success_rate": float,
    "avg_duration_ms": int,
    "avg_cost_usd": float,
    "improvement_gradient": float,
    "alpha": int,  # Successes (initialize to 1)
    "beta": int,   # Failures (initialize to 1)
    "last_updated": datetime
}
```

**Migration**:
```sql
-- SurrealDB schema update
UPDATE template_metrics SET alpha = 1, beta = 1 WHERE alpha IS NULL;
```

### Gap 5: Learning Loop Not Closing After Execution
**File**: `repos/metabob-rpc-api/server/routes/learning_loop.py`  
**Current**: Lines 111-150+ `POST /api/v1/learning-loop/executions` inserts execution but doesn't update metrics  
**Required**: After `insert_execution()`, call:

```python
# Update template_metrics with execution outcome
await update_metrics_after_execution(
    template_id=template_id,
    success=request_data["success"]
)
```

**Implementation in `db/operations/template_metrics.py`**:
```python
async def update_metrics_after_execution(template_id: str, success: bool):
    """Update alpha/beta for Thompson Sampling after execution."""
    db = await get_surreal_client()
    
    if success:
        # Increment alpha (successes)
        await db.query(
            "UPDATE template_metrics SET alpha = alpha + 1 WHERE template_id = $template_id",
            {"template_id": template_id}
        )
    else:
        # Increment beta (failures)
        await db.query(
            "UPDATE template_metrics SET beta = beta + 1 WHERE template_id = $template_id",
            {"template_id": template_id}
        )
    
    # Recalculate success_rate and improvement_gradient
    await recalculate_template_metrics(template_id)
```

### Gap 6: DevBob Container Needs Rebuild
**File**: Docker image `devbob:latest` in k8s  
**Issue**: May not have latest OpenCode with new CLI commands  
**Required**: Rebuild and deploy after implementing Gaps 1-5

---

## Validation Strategy

### Test Scenario: Complete Learning Loop
```bash
# Step 1: Get initial recommendations (with Thompson Sampling)
kubectl exec devbob-84466fdfff-dd87l -n metabob -- \
  opencode activity recommend --task "Add REST endpoint" --limit 3

# Expected output:
# {
#   "status": "success",
#   "recommendations": [
#     {
#       "template_id": "add-rest-endpoint",
#       "selection_metadata": {
#         "alpha": 5,
#         "beta": 2,
#         "sample_score": 0.712
#       },
#       ...
#     },
#     ...
#   ]
# }

# Step 2: Execute recommended template
kubectl exec devbob-84466fdfff-dd87l -n metabob -- \
  opencode activity run add-rest-endpoint --variables '{"method":"POST","path":"/api/test"}' --reason "Testing learning loop"

# Step 3: Monitor backend logs for execution recording
kubectl logs -f metabob-rpc-api-c4548d7ff-tfdbd -n metabob | grep "POST /api/v1/learning-loop/executions"

# Expected log:
# [2026-03-07 12:34:56] POST /api/v1/learning-loop/executions - 201 - {"metrics_updated": true, "alpha_updated": 6}

# Step 4: Get recommendations again (verify learning loop closed)
kubectl exec devbob-84466fdfff-dd87l -n metabob -- \
  opencode activity recommend --task "Add REST endpoint" --limit 3

# Expected: alpha incremented from 5 to 6 for executed template
# {
#   "recommendations": [
#     {
#       "template_id": "add-rest-endpoint",
#       "selection_metadata": {
#         "alpha": 6,  # ← Incremented
#         "beta": 2,
#         "sample_score": 0.745
#       }
#     }
#   ]
# }

# Step 5: Test all 5 MCP tools
for tool in metabob_recommend_activities metabob_post_activity_result metabob_create_activity_variant metabob_recommend_impulses metabob_fetch_boredom_activities; do
  echo "Testing $tool..."
  # Test via opencode CLI or direct MCP call
done
```

### Success Criteria
- ✅ `metabob_recommend_activities` returns templates with Thompson Sampling metadata (alpha, beta, sample_score)
- ✅ Activity execution recorded in SurrealDB with session_id
- ✅ Backend logs show `POST /v2/activities/executions` with `metrics_updated=true`
- ✅ Second recommendation call shows updated alpha/beta values (learning loop closed)
- ✅ All 5 MCP tools functional from DevBob container

---

## Critical Path to Completion

1. **Backend**: Implement `POST /v2/activities/recommend` with Thompson Sampling logic
2. **Backend**: Add `alpha`/`beta` columns to `template_metrics` table
3. **Backend**: Update `POST /api/v1/learning-loop/executions` to call `update_metrics_after_execution()`
4. **OpenCode**: Add `activity recommend --task` CLI command in `activity.ts`
5. **OpenCode**: Integrate `metabob_recommend_activities` in `recommendation-engine.ts`
6. **DevOps**: Rebuild and deploy devbob container with latest OpenCode
7. **Validation**: Execute test scenario from DevBob container

---

## Impulse Reference

This trace has been stored in impulse: `trace-devbob-activity-execution-validation`

**Impulse Type**: `templateDefinition`  
**Budget**: 5000 tokens  
**Usage**: Downstream validation and enforcement tasks

---

## Related Files

### OpenCode (metabob-opencode)
- `packages/opencode/src/cli/cmd/activity.ts` - CLI commands
- `packages/opencode/src/session/recommendation-engine.ts` - Local recommendation logic
- `packages/opencode/src/mcp/index.ts` - MCP client
- `packages/opencode/src/session/activity-template-repository.ts` - Template storage

### MCP Server (metabob-cli)
- `src/metabob_cli/mcp/activity_template_tools.py` - MCP tool implementations
- `src/metabob_cli/mcp/api_client.py` - HTTP client for backend
- `src/metabob_cli/mcp/learning_tools.py` - Learning loop tools

### Backend (metabob-rpc-api)
- `server/routes/learning_loop.py` - Learning loop endpoints
- `server/routes/activity.py` - Activity management endpoints
- `server/db/operations/activity_execution.py` - Execution CRUD
- `server/db/operations/template_metrics.py` - Metrics operations

### Configuration
- `configs/opencode.devbob.json` - DevBob MCP configuration

---

**Generated**: 2026-03-07  
**Traced By**: OpenCode trace-data-flow-single-feature  
**Next Steps**: Implement gaps 1-6, rebuild devbob, execute validation
