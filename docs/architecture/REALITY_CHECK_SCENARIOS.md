# Reality Check Scenarios

**Purpose**: Quick reference for "what actually happens" vs "what we think happens"
**Companion to**: IMPLEMENTATION_REALITY_IDIOMS.md

---

## How to Use This Document

When debugging or explaining system behavior:

1. Find the scenario that matches what you're investigating
2. Read "What Users Think" (common assumptions)
3. Read "What Actually Happens" (verified reality)
4. Read "Evidence" (how to verify yourself)
5. Check "Status" (✅ working, ⚠️ partial, ❌ broken)

---

## Scenario 1: User Gives Positive Feedback

### User Action
```
/teach! Great job!
```

### What Users Think
"I'm teaching the system. MiniBob will update Thompson Sampling, and next time this activity will be selected more often."

### What Actually Happens (Verified 2026-04-08)

**Step-by-step reality**:
1. MiniBob parses `/teach!` (1 exclamation = intensity 0)
2. MiniBob calls: `POST /v2/activities/feedback`
   ```json
   {
     "activity_id": "last_executed_activity",
     "direction": "positive",
     "intensity": 0,
     "include_adjacent": true,
     "session_id": "current_session",
     "reason": null
   }
   ```
3. Backend validates activity exists
4. Backend multiplies all shape-conditioned α scores by 1.5x (intensity 0 = 1.5x multiplier)
5. Backend optionally boosts adjacent activities with 1.25x multiplier
6. Backend returns:
   ```json
   {
     "success": true,
     "affected_activities": ["activity_id", "adjacent_1", "adjacent_2"],
     "multiplier": 1.5
   }
   ```
7. MiniBob logs: `[MCP] ✓ taught: activity_id`
8. Next Thompson Sampling selection has higher probability for this activity

### Evidence

**Code locations**:
- Client: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/src/mcp.ts:1410-1452`
- Server: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/src/routes/activities.ts:2429-2680`
- Mount: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/src/index.ts:136`

**Verify yourself**:
```bash
# Check endpoint exists
grep -n "app.post('/feedback'" repos/metabob-activity-api/src/routes/activities.ts
# Output: 2429: Full implementation

# Check route mounted
grep -n "app.route('/v2/activities', activitiesRoutes)" repos/metabob-activity-api/src/index.ts
# Output: 136: Mounted

# Test endpoint
curl -X POST https://activity.metabob.com/v2/activities/feedback \
  -H "Authorization: Bearer $JWT" \
  -d '{"activity_id":"test","direction":"positive","intensity":0}'
```

**Status**: ✅ **WORKING** (fully implemented, production-ready)

---

## Scenario 2: User Gives Negative Feedback

### User Action
```
/warn!! This broke production!
```

### What Users Think
"I'm warning the system. MiniBob will penalize this activity, and it won't be selected as often."

### What Actually Happens (Verified 2026-04-08)

**Step-by-step reality**:
1. MiniBob parses `/warn!!` (2 exclamations = intensity 1)
2. MiniBob calls: `POST /v2/activities/feedback`
   ```json
   {
     "activity_id": "last_executed_activity",
     "direction": "negative",
     "intensity": 1,
     "include_adjacent": false,
     "session_id": "current_session",
     "reason": "This broke production!"
   }
   ```
3. Backend validates activity exists
4. Backend multiplies all shape-conditioned β scores by 2.0x (intensity 1 = 2.0x multiplier)
5. Backend does NOT penalize adjacent activities (warnings are specific)
6. Backend returns:
   ```json
   {
     "success": true,
     "affected_activities": ["activity_id"],
     "multiplier": 2.0
   }
   ```
7. MiniBob logs: `[MCP] ✓ warned: activity_id`
8. Next Thompson Sampling selection has lower probability for this activity

### Evidence

**Intensity mapping**:
- `!` = intensity 0 = 1.5x multiplier
- `!!` = intensity 1 = 2.0x multiplier
- `!!!` = intensity 2 = 2.5x multiplier
- `!!!!` (max) = intensity 3 = 3.0x multiplier

**Code**: Same as Scenario 1

**Status**: ✅ **WORKING**

---

## Scenario 3: Activity Executes and Completes

### User Action
```
minibob --single "fix the login bug"
```

### What Users Think
"MiniBob will execute an activity and automatically update Thompson Sampling based on success/failure."

### What Actually Happens (Verified 2026-04-08)

**Step-by-step reality**:
1. MiniBob infers shapes from goal: `['error', 'source_code', 'goal']`
2. MiniBob requests recommendations: `POST /v2/activities/recommend`
   ```json
   {
     "task_description": "fix the login bug",
     "input_impulse_shapes": ["error", "source_code", "goal"],
     "available_impulses": [],
     "limit": 10
   }
   ```
3. Backend runs Thompson Sampling:
   - Queries shape-conditioned scores for each activity
   - Samples from Beta(α, β) for each
   - Returns top 10 sorted by sampled value
4. MiniBob selects first recommendation
5. MiniBob executes activity (task by task)
6. MiniBob captures execution trace
7. MiniBob reports execution: `POST /v2/activities/execution-traces`
   ```json
   {
     "template_id": "debug-null-pointer",
     "status": "completed",
     "duration": 45000,
     "cost": 0.0234,
     "input_impulse_shapes": ["error", "source_code", "goal"],
     "tasks": [...],
     "metrics": {...}
   }
   ```
8. Backend updates Thompson Sampling:
   - If status = "completed": α += 1 (success)
   - If status = "failed": β += 1 (failure)
   - Updates all shape-conditioned scores

### Evidence

**Code locations**:
- Thompson Sampling: `repos/metabob-activity-api/src/routes/activities.ts:2786-2856`
- Execution reporting: `repos/minibob/src/activity.ts` (executeActivity)
- Trace storage: `repos/metabob-activity-api/src/routes/activities.ts` (POST /execution-traces)

**Verify yourself**:
```bash
# Check Thompson Sampling tests
bun test repos/metabob-activity-api/src/routes/activities.test.ts
# 22+ tests verify Beta distribution sampling, shape-conditioned scores
```

**Status**: ✅ **WORKING**

---

## Scenario 4: CI/CD Catches Deployment Failure

### User Action
```
git push origin dev  # Triggers canary deployment
```

### What Users Think
"CI/CD will validate the deployment. If it fails, Thompson Sampling will learn this template doesn't work in production."

### What Actually Happens (Verified 2026-04-08)

**Step-by-step reality**:
1. GitHub Actions runs `deploy-canary.yml`
2. Workflow validates endpoints:
   ```bash
   # Check health
   curl https://activity.metabob.com/health

   # Check recommendations endpoint
   curl -X POST https://activity.metabob.com/v2/activities/recommend \
     -H "Authorization: Bearer $JWT" \
     -d '{"task_description":"test"}'

   # Validate RecordId normalization
   FIRST_ID_TYPE=$(echo "$RECS" | jq -r '.recommendations[0].template_id | type')
   if [ "$FIRST_ID_TYPE" != "string" ]; then
     echo "❌ template_id is not string - RecordId objects not normalized"
     exit 1
   fi
   ```
3. If validation fails:
   - ✅ Deployment blocked (exit 1)
   - ❌ **NO FEEDBACK TO BACKEND**
   - ❌ Thompson Sampling never learns this failure
4. If validation passes:
   - ✅ Canary deployed
   - ✅ Health monitored
   - ❌ **NO SUCCESS FEEDBACK EITHER**

### What Should Happen

**Missing step** (not implemented):
```yaml
# In deploy-canary.yml, after validation
- name: Report CI result to backend
  run: |
    curl -X POST https://activity.metabob.com/v2/activities/ci-result \
      -H "Authorization: Bearer $JWT" \
      -d '{
        "template_id": "${{ steps.last-activity.outputs.id }}",
        "result": "${{ job.status }}",
        "stage": "canary_deployment",
        "error_type": "RecordId normalization"
      }'
```

### Evidence

**Code locations**:
- CI validation: `repos/deployment/.github/workflows/deploy-canary.yml:488-553`
- Missing: No POST to backend after validation

**Gap**: External validation exists, feedback loop incomplete

**Status**: ⚠️ **PARTIAL** (validation works, feedback doesn't)

---

## Scenario 5: Shape Inference from Goal

### User Action
```
minibob --single "Fix the TypeError in calculator.ts"
```

### What Users Think
"MiniBob will infer that I need error information and source code, then route to the appropriate resolver."

### What Actually Happens (Verified 2026-04-08)

**Step-by-step reality**:
1. MiniBob extracts shapes from goal text (regex patterns):
   - "Fix" → `goal` shape
   - "TypeError" → `error` shape
   - "calculator.ts" → `source_code` shape
2. MiniBob calls: `POST /v2/activities/recommend`
   ```json
   {
     "task_description": "Fix the TypeError in calculator.ts",
     "input_impulse_shapes": ["goal", "error", "source_code"]
   }
   ```
3. Backend queries shape-conditioned scores:
   ```sql
   SELECT * FROM impulse_shape_activity_score
   WHERE shape IN ['goal', 'error', 'source_code']
   ```
4. Backend finds activities:
   - `debug-null-pointer`: α=15, β=3 (83% success with error+source_code)
   - `fix-typo`: α=5, β=8 (38% success with goal only)
5. Backend samples from Beta distributions:
   - `debug-null-pointer`: samples ~0.82
   - `fix-typo`: samples ~0.41
6. Backend returns recommendations sorted by sample value
7. MiniBob selects `debug-null-pointer`
8. MiniBob executes activity
9. **Shape does NOT determine resolver** - pointer type does:
   ```typescript
   // When resolving impulses in the activity:
   if (pointer.type === "file") { /* read from filesystem */ }
   if (pointer.type === "memo") { /* use embedded content */ }
   // NOT: if (metadata.shape === "error") { /* route to error resolver */ }
   ```

### What Was Documented vs Reality

**Documented**: "Shape-based routing sends error shapes to error resolver"

**Reality**: "Shape inference extracts metadata → Thompson Sampling selects activities → Pointer types determine resolvers"

**Shapes are used for**:
- Activity selection (Thompson Sampling)
- Relevance scoring
- Intent classification

**Shapes are NOT used for**:
- Resolver routing (pointer.type does this)
- Content loading (pointer.path does this)

### Evidence

**Code locations**:
- Shape extraction: `repos/metabob-activity-api/src/utils/shape-inference.ts`
- Pointer routing: `repos/minibob/src/impulse.ts:257-530`
- Thompson Sampling: `repos/metabob-activity-api/src/routes/activities.ts:2786-2856`

**Verify yourself**:
```bash
# Check shape inference patterns
grep -A 5 "const CANONICAL_SHAPES" repos/metabob-activity-api/src/utils/shape-inference.ts

# Check pointer type routing (NOT shape routing)
grep -n "if (pointer.type ===" repos/minibob/src/impulse.ts
# 259: memo, 264: file, 291: directoryTree, etc.
```

**Status**: ✅ **WORKING** (but documented incorrectly)

---

## Scenario 6: Missing Impulse Discovery

### User Action
```
minibob --single "optimize the slow test suite"
```

### What Users Think
"MiniBob will figure out what context it needs and load it."

### What Actually Happens (Verified 2026-04-08)

**Step-by-step reality**:
1. MiniBob infers shapes: `['goal', 'test_suite', 'performance']`
2. MiniBob requests recommendations with available impulses: `[]` (none loaded yet)
3. Backend runs Thompson Sampling → recommends `optimize-tests` activity
4. Backend runs missing impulse discovery:
   ```typescript
   discoverMissingImpulses(
     activityIds: ['optimize-tests'],
     loadedImpulseIds: [],
     limit: 5
   )
   ```
5. Backend calculates Bayesian P(success|loaded) for each unloaded impulse:
   - Past executions where impulse was loaded: successes / total
   - Compared to baseline success rate without impulse
6. Backend returns suggestions:
   ```json
   {
     "missing_impulses": [
       {
         "impulse_id": "test_execution_trace",
         "reason": "Critical for 7 activities (avg boost: 78%, 45 past successes)",
         "unlocks_activities": ["optimize-tests", "debug-slow-test"],
         "avg_relevance_boost": 0.78
       },
       {
         "impulse_id": "test_coverage_report",
         "reason": "Helpful for 3 activities (avg boost: 45%, 12 past successes)",
         "unlocks_activities": ["optimize-tests"],
         "avg_relevance_boost": 0.45
       }
     ]
   }
   ```
7. MiniBob loads suggested impulses (if budget allows)
8. MiniBob executes activity with loaded impulses

### What Doesn't Happen

**NOT IMPLEMENTED**:
- ❌ Proactive EnvironmentScanner (doesn't exist)
- ❌ Filesystem scanning before execution
- ❌ Automatic impulse loading (budget-aware suggestions only)

### Evidence

**Code locations**:
- Missing impulse discovery: `repos/metabob-activity-api/src/utils/impulse-relevancy.ts:170-257`
- Integration: Part of Thompson Sampling test suite

**Verify yourself**:
```bash
# Check implementation
grep -n "discoverMissingImpulses" repos/metabob-activity-api/src/utils/impulse-relevancy.ts
# 170: Full Bayesian P(success|loaded) calculation

# Run tests
bun test repos/metabob-activity-api/src/routes/activities.test.ts
# Impulse relevance tests verify suggestions
```

**Status**: ✅ **WORKING**

---

## Scenario 7: Impulse Resolution Multi-Tier Dispatch

### User Action
```typescript
// In activity template:
{
  "impulses": [
    { "id": "memo1", "pointer": { "type": "memo", "content": "..." } },
    { "id": "file1", "pointer": { "type": "file", "path": "src/app.ts" } },
    { "id": "trace1", "pointer": { "type": "activityExecutionTrace", "id": "exec_123" } }
  ]
}
```

### What Users Think
"MiniBob will resolve all these impulses, routing to the appropriate resolver based on pointer type."

### What Actually Happens (Verified 2026-04-08)

**Step-by-step reality**:
1. MiniBob calls `loadImpulses([memo1, file1, trace1])`
2. For each impulse, MiniBob checks pointer type:

**Layer 1: Local memo**
```typescript
if (pointer.type === "memo" && "content" in pointer) {
  return pointer.content  // ✅ Immediate return
}
```

**Layer 2: Local file**
```typescript
if (pointer.type === "file" && "path" in pointer) {
  const file = Bun.file(pointer.path)
  if (!(await file.exists())) throw new Error("File not found")
  const content = await file.text()
  // Handle offset/limit if specified
  return lines.slice(offset, offset + limit).join("\n")  // ✅ Filesystem read
}
```

**Layer 9: Backend MCP fallback**
```typescript
if (pointer.type === "activityExecutionTrace") {
  const mcp = getMCPClient()
  if (!mcp) throw new Error("MCP not available")
  const result = await mcp.resolveImpulse(impulse)  // ✅ Backend resolves
  return result.content
}
```

3. All impulses loaded in parallel (no cascading)
4. Budget enforcement:
   - Content truncated to `budget` tokens (4-chars-per-token heuristic)
   - 10% safety margin applied
   - Warning logged if truncated

### All 10 Layers (Verified)

| Layer | Type | Where Resolved | Status |
|-------|------|----------------|--------|
| 1 | `memo` | Local (embedded) | ✅ |
| 2 | `file` | Local (filesystem) | ✅ |
| 3 | `directoryTree` | Local (Bun.Glob) | ✅ |
| 4 | `gitDiff` | Local (git command) | ✅ |
| 5 | `toolList` | Local (tool registry) | ✅ |
| 6 | `packageConfig` | Local (package.json) | ✅ |
| 7 | Custom resolvers | Vessel-specific | ✅ |
| 8 | Vessel discovery | HTTP capability | ✅ |
| 9 | Backend MCP | metabob-activity-api | ✅ |
| 10 | Fallback | activityOutput | ✅ |

### What Doesn't Happen

**NOT IMPLEMENTED**:
- ❌ Shape-based routing (uses pointer.type, not metadata.shape)
- ❌ Cascading loads (one impulse triggering another)
- ❌ Dependency resolution (all loaded in parallel)

### Evidence

**Code location**: `repos/minibob/src/impulse.ts:257-530`

**Verify yourself**:
```bash
# Check all layers
grep -n "if (pointer.type ===" repos/minibob/src/impulse.ts
# 259: memo
# 264: file
# 291: directoryTree
# 343: gitDiff
# 356: toolList
# 366: packageConfig
# 391-408: custom resolvers
# 410-480: vessel discovery
# 482-501: backend MCP
# 503-517: fallback
```

**Status**: ✅ **WORKING** (all layers functional, minimal tests)

---

## Quick Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Fully working as designed |
| ⚠️ | Partially working (core functional, gaps exist) |
| ❌ | Not working / not implemented |
| ✅⚠️ | Working but untested |

---

## How to Add New Scenarios

When you discover a gap between assumption and reality:

1. Copy a scenario template
2. Fill in "What Users Think" (common assumption)
3. Verify actual behavior (read code, test endpoints)
4. Document "What Actually Happens" (verified reality)
5. Add "Evidence" (code locations, commands to verify)
6. Set "Status" (✅/⚠️/❌)

---

**End of Reality Check Scenarios**
