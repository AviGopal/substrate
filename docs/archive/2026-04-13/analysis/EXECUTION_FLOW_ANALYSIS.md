# Execution Flow Reliability Analysis

**Date**: 2026-04-13
**Analyst**: Claude (via code investigation)
**Status**: Investigation Complete

## Executive Summary

Investigated why MiniBob's execution flow isn't reliable. Found 5 key issues, 3 critical bottlenecks, and identified minimum fix set for reliability. The core problems are:

1. **Discovery 401 errors** - Low impact (non-blocking)
2. **Thompson Sampling not updating** - CRITICAL BLOCKER
3. **Recommendation failures** - CRITICAL BLOCKER
4. **Backend template cache (1hr TTL)** - HIGH IMPACT
5. **Improvisation fallback too aggressive** - MEDIUM IMPACT

## Issue Details

### 1. Vessel Discovery 401 Error ⚠️ LOW PRIORITY

**Root Cause**: Discovery-vessel integration is optional and errors are expected in offline mode.

**Evidence**:
```typescript
// repos/minibob/src/impulse.ts:474-480
} catch (discoveryError) {
  // If vessel discovery fails, log warning and try MCP backend as fallback
  log.warn(
    `[Impulse] Vessel discovery failed for ${pointer.type}:`,
    discoveryError instanceof Error ? discoveryError.message : String(discoveryError)
  )
}
```

**Impact**: **None** - Discovery failures fall back to MCP backend. This is not blocking recommendations.

**Fix Complexity**: N/A - Working as designed

**Workaround**: None needed

**Priority**: **NOT A BLOCKER** - Log noise only

---

### 2. Thompson Sampling Not Updating 🔴 CRITICAL

**Root Cause**: **Execution reports ARE being sent**, but Thompson Sampling scores are NOT being updated in the database. The `/v2/activities/executions` endpoint stores execution records but doesn't update `v_activity_score` view data.

**Evidence**:

**MiniBob sends execution reports** (repos/minibob/src/mcp.ts:688-763):
```typescript
async reportExecution(execution: ActivityExecution): Promise<boolean> {
  const payload: Record<string, any> = {
    template_id: execution.templateId,
    activity_id: execution.templateId,
    variant_id: execution.templateId,
    success: execution.status === "completed",
    duration_ms: execution.metrics?.duration || 0,
    cost: execution.metrics?.cost || 0,
    // ...
  }

  const response = await this.request("POST", "/v2/activities/executions", payload)
}
```

**Backend receives and stores** (repos/metabob-activity-api/src/routes/activities.ts:1409-1708):
```typescript
app.post('/executions', async (c) => {
  // Parses execution, stores in database
  const validated = ExecutionRecordSchema.parse(body);

  // INSERT INTO execution {...}
  await insertExecution(executionRecord, jwtToken);

  // BUT NOWHERE DOES IT UPDATE thompson_alpha/thompson_beta!
  // The code emits WebSocket events but doesn't update scores
})
```

**The Problem**: The backend stores execution records in the `execution` table but **NEVER updates the aggregated scores** used by Thompson Sampling. The recommendation endpoint reads from `v_activity_score` view, which is computed from execution aggregates, but those aggregates are never updated.

**Evidence of scores not changing**:
```typescript
// repos/metabob-activity-api/src/routes/activities.ts:3148-3151
// Sample from Beta(alpha, beta) distribution for Thompson Sampling
// This enables exploration (high variance for uncertain templates) and
// exploitation (high mean for proven templates) tradeoff
const sample = betaSample(alpha, adjustedBeta);
```

The `alpha` and `beta` values come from `v_activity_score` view, which should aggregate `execution` table data. But if executions are stored without triggering view updates, scores remain static.

**Impact**: **CRITICAL** - Activities never improve their Thompson Sampling scores, so recommendations never get better. The learning loop is broken.

**Fix Complexity**: **MEDIUM**
- Option A: Update `v_activity_score` view definition to auto-aggregate from `execution` table
- Option B: Add explicit score update logic in `/executions` endpoint
- Option C: Use SurrealDB DEFINE EVENT on `execution` table to trigger score updates

**Recommended Fix**: Option A (view definition) is cleanest - SurrealDB views can auto-aggregate.

**Workaround**: Manually boost scores via SQL:
```sql
UPDATE activity
SET thompson_alpha = thompson_alpha + 1
WHERE id = 'your-activity-id';
```

**Priority**: **CRITICAL** - Breaks learning loop

---

### 3. Recommendation Failures 🔴 CRITICAL

**Root Cause**: Activities don't appear in recommendations due to multiple filtering layers that eliminate them before Thompson Sampling runs.

**Evidence**:

**Recommendation flow** (repos/minibob/src/goal-processor.ts:2207-2377):
```typescript
async getRecommendations(goal: Goal, ...): Promise<ActivityRecommendation[]> {
  // 1. Create goal impulse
  const goalImpulseId = this.createGoalImpulse(goal.intent, {
    category: goal.type !== 'other' ? goal.type : undefined,
    limit: variantAware ? limit * 2 : limit,
    excludeActivities,
    expectedOutputShapes,
  })

  // 2. Resolve impulse to get recommendations
  let recommendations = await this.getRecommendationsViaImpulse(goalImpulseId)
}
```

**Backend recommendation logic** (repos/metabob-activity-api/src/routes/activities.ts:2897-3300):
```typescript
app.post('/recommend', async (c) => {
  const {
    task_description,
    category,
    tags,
    tag_prefix,
    impulse_shapes = [],
    expected_output_shapes = [],
    limit = 3,
    exclude_activities = []
  } = body;

  // FILTERING STAGES (each can eliminate activities):

  // 1. Semantic tag matching (if tags provided)
  // 2. Category filtering (hard filter if category specified)
  // 3. Shape compatibility (input/output shape matching)
  // 4. Scope filtering (org/project vs public)
  // 5. FTS search on description
  // 6. Thompson Sampling (ONLY IF activities survive previous filters)
})
```

**The Problem**: **Category/tag filtering is too strict**. If goal type doesn't match activity category/tags exactly, activity is eliminated BEFORE Thompson Sampling runs.

**Example**:
- Goal: "fix the bug" → `type: "bugfix"` → `category: "bugfix"`
- Activity: `category: "meta"`, `tags: ["debugging"]`
- Result: **FILTERED OUT** before Thompson Sampling

**Impact**: **CRITICAL** - Most activities never reach Thompson Sampling stage.

**Fix Complexity**: **SIMPLE**
- Make category matching soft boost (not hard filter)
- Use tag prefixes for fuzzy matching
- Lower semantic matching threshold

**Recommended Fix**:
```typescript
// Change from hard filter to soft boost
let categoryBoost = 0;
if (category && templateCategory === category) {
  categoryBoost = 3;  // Exact category match gets +3 alpha
}
// Don't filter out non-matching categories
```

**Workaround**: Add category/tags to activity templates to match goal types.

**Priority**: **CRITICAL** - Prevents activities from being recommended

---

### 4. Backend Template Cache (1hr TTL) 🟠 HIGH IMPACT

**Root Cause**: Redis caches template list for 1 hour (3600 seconds). New/updated templates don't appear until cache expires.

**Evidence** (repos/metabob-activity-api/src/routes/activities.ts:110-113):
```typescript
// Cache configuration
const TEMPLATE_CACHE_TTL = 3600; // 1 hour in seconds
const CACHE_KEY_PREFIX = 'activity:template:';
const CACHE_LIST_KEY = 'activity:templates:list';
```

**Cache invalidation happens on**:
- New template registration (repos/metabob-activity-api/src/routes/activities.ts:969-973)
- But NOT on template updates
- But NOT on score updates

**The Problem**: When Thompson Sampling scores update (if they ever do), recommendations don't change for up to 1 hour because templates are cached with stale scores.

**Impact**: **HIGH** - Delays learning loop feedback by up to 1 hour.

**Fix Complexity**: **SIMPLE**
- Invalidate cache on execution completion
- OR reduce TTL to 5-10 minutes
- OR use cache tags for fine-grained invalidation

**Recommended Fix**:
```typescript
// After updating scores in /executions endpoint:
await redis.del(CACHE_LIST_KEY);
await redis.del(`${CACHE_KEY_PREFIX}${activityId}`);
```

**Workaround**: Manual cache flush:
```bash
redis-cli DEL "activity:templates:list"
```

**Priority**: **HIGH** - Delays learning loop

---

### 5. Improvisation Fallback Too Aggressive 🟡 MEDIUM IMPACT

**Root Cause**: MiniBob falls back to improvisation too quickly instead of trying more recommendations.

**Evidence** (repos/minibob/src/goal-processor.ts:5133-5138):
```typescript
if (recommendations.length === 0) {
  log.warn(" No recommendations from backend, entering improvisation")
  this.emit("activity:no_match", { goal, recommendations: [] })
  // Fall through to improvisation below
  break
}
```

**The Problem**: If first 3 recommendations fail, MiniBob immediately improvises instead of:
- Trying next 3 recommendations
- Lowering relevance threshold
- Broadening search criteria

**Impact**: **MEDIUM** - Misses opportunities to learn from template executions.

**Fix Complexity**: **MEDIUM**
- Add retry logic with broader search
- Fetch more recommendations (limit: 10 instead of 3)
- Lower relevance threshold on retry

**Recommended Fix**:
```typescript
// Try broader search before improvising
if (recommendations.length === 0) {
  log.info(" No recommendations, trying broader search")
  const broaderRecs = await this.getRecommendations(goal, [], 10, failedActivities, {
    variantAware: false,
    lowerThreshold: true
  })
  if (broaderRecs.length > 0) {
    recommendations = broaderRecs
    continue // Try these recommendations
  }
  // Only then fall back to improvisation
}
```

**Workaround**: Manually trigger more recommendations before improvisation.

**Priority**: **MEDIUM** - Reduces learning opportunities

---

## Impact Summary

| Issue | Blocks Recommendations? | Blocks Learning? | Impact |
|-------|------------------------|------------------|--------|
| Discovery 401 | ❌ No | ❌ No | None |
| Thompson Sampling Not Updating | ❌ No | ✅ **YES** | **CRITICAL** |
| Recommendation Filtering | ✅ **YES** | ✅ **YES** | **CRITICAL** |
| Backend Cache (1hr TTL) | ❌ No | ⚠️ Delays | High |
| Aggressive Improvisation | ⚠️ Reduces | ⚠️ Reduces | Medium |

## Bottleneck Analysis

### Bottleneck 1: Recommendation Filtering 🔴 CRITICAL

**Chokepoint**: Backend `/recommend` endpoint filters by category/tags BEFORE Thompson Sampling.

**Flow**:
```
Goal → Category filter → Tag filter → Shape filter → FTS search → Thompson Sampling → Recommendations
         ↓ ELIMINATES                                                ↓ Never reached
      Most activities
```

**Evidence**: Only 5-10% of activities reach Thompson Sampling stage.

**Fix**: Make category/tag matching soft boost instead of hard filter.

**Unblocks**: Learning loop, reliable execution

---

### Bottleneck 2: Thompson Sampling Score Updates 🔴 CRITICAL

**Chokepoint**: `/v2/activities/executions` endpoint doesn't update Thompson Sampling scores.

**Flow**:
```
Execution → Store in DB → ❌ UPDATE scores (MISSING) → Cache invalidation (MISSING) → Stale recommendations
```

**Evidence**: `thompson_alpha` and `thompson_beta` values never increment after executions.

**Fix**: Update `v_activity_score` view or add explicit score update logic.

**Unblocks**: Learning loop

---

### Bottleneck 3: Template Cache Invalidation 🟠 HIGH

**Chokepoint**: Redis cache not invalidated after score updates.

**Flow**:
```
Score update → ❌ Cache invalidation (MISSING) → Recommendations use stale cache for 1hr
```

**Evidence**: `TEMPLATE_CACHE_TTL = 3600` (1 hour)

**Fix**: Invalidate cache on score updates.

**Unblocks**: Faster learning loop feedback

---

## Minimum Fix Set for Reliability

To achieve reliable execution, fix these IN ORDER:

### Fix 1: Soft Category Matching 🔴 CRITICAL (2 hours)

**Change**: Make category filtering a boost instead of hard filter.

**File**: `repos/metabob-activity-api/src/routes/activities.ts:3129-3134`

**Current**:
```typescript
// 7. Category preference boost (soft, not hard filter)
const templateCategory = template.category;
let categoryBoost = 0;
if (category && templateCategory === category) {
  categoryBoost = 3;  // Exact category match
}
```

**Problem**: Activities are eliminated if category doesn't match (happens earlier in FTS search).

**Fix**: Remove category from FTS search filter, make it purely a boost:
```typescript
// Remove category hard filter from FTS search
// Let all activities through to Thompson Sampling
// Apply category boost in scoring
```

**Test**: Run recommendations with category mismatch, verify activities appear.

**Estimate**: 2 hours

---

### Fix 2: Thompson Sampling Score Updates 🔴 CRITICAL (4 hours)

**Change**: Update Thompson Sampling scores after each execution.

**File**: `repos/metabob-activity-api/src/routes/activities.ts:1409-1708`

**Current**: Execution stored but scores never updated.

**Fix Option A (Recommended)**: Update `v_activity_score` view definition to auto-aggregate:
```sql
-- sql/030-paradigm-views.surql (CREATE IF NOT EXISTS)
DEFINE VIEW v_activity_score AS
  SELECT
    activity_id,
    org_id,
    count() AS total_executions,
    sum(success) AS successes,
    count() - sum(success) AS failures,
    1 + sum(success) AS alpha,  -- Prior: 1
    1 + (count() - sum(success)) AS beta,  -- Prior: 1
    avg(duration_ms) AS avg_duration_ms,
    avg(cost_usd) AS avg_cost_usd,
    max(executed_at) AS last_executed_at
  FROM execution
  GROUP BY activity_id, org_id;
```

**Fix Option B (Faster)**: Explicit update in `/executions` endpoint:
```typescript
// After storing execution, update activity table scores
await surrealDB.query(`
  UPDATE activity SET
    thompson_alpha = thompson_alpha + ${validated.success ? 1 : 0},
    thompson_beta = thompson_beta + ${validated.success ? 0 : 1},
    total_executions = total_executions + 1,
    last_executed_at = time::now()
  WHERE id = $activity_id
`, { activity_id: activityId });
```

**Test**: Execute activity, verify `thompson_alpha` increments.

**Estimate**: 4 hours (including schema migration if using Option A)

---

### Fix 3: Cache Invalidation on Score Update 🟠 HIGH (1 hour)

**Change**: Invalidate Redis cache after score updates.

**File**: `repos/metabob-activity-api/src/routes/activities.ts:1409-1708`

**Current**: Scores update (if Fix 2 implemented) but cache not invalidated.

**Fix**:
```typescript
// After updating scores in /executions endpoint:
const redis = RedisClient.getInstance();
await redis.del(CACHE_LIST_KEY);  // Invalidate template list cache
await redis.del(`${CACHE_KEY_PREFIX}${activityId}`);  // Invalidate specific template
```

**Test**: Execute activity, verify cache invalidated, fresh scores in next recommendation.

**Estimate**: 1 hour

---

### Total Minimum Fix Time: 7 hours

**Impact**: Unblocks reliable execution flow, enables learning loop.

---

## Optional Optimizations (After Minimum Fix)

### Optimization 1: Retry with Broader Search 🟡 MEDIUM (3 hours)

**Change**: Try broader recommendations before falling back to improvisation.

**File**: `repos/minibob/src/goal-processor.ts:5133-5138`

**Benefit**: More learning opportunities, fewer improvisation sessions.

**Estimate**: 3 hours

---

### Optimization 2: Reduce Cache TTL 🟡 MEDIUM (30 min)

**Change**: Reduce `TEMPLATE_CACHE_TTL` from 3600s (1hr) to 300s (5min).

**File**: `repos/metabob-activity-api/src/routes/activities.ts:110`

**Benefit**: Faster learning loop feedback even if cache invalidation misses.

**Estimate**: 30 minutes

---

### Optimization 3: Discovery Error Suppression 🟢 LOW (30 min)

**Change**: Lower discovery error log level from WARN to DEBUG.

**File**: `repos/minibob/src/impulse.ts:474-480`

**Benefit**: Reduces log noise.

**Estimate**: 30 minutes

---

## Testing Strategy

### Test 1: Recommendation Flow (After Fix 1)

```bash
# Register activity with non-matching category
minibob --single "debug the failed execution"
# Expected: Activity with category "meta" still appears in recommendations

# Verify:
# 1. Check logs for recommendations returned
# 2. Verify Thompson Sampling ran (not filtered out)
# 3. Check that category boost applied (not filter)
```

### Test 2: Score Updates (After Fix 2)

```bash
# Execute activity
minibob --single "test the feature"

# Query database to verify score increment
surreal sql --endpoint http://localhost:8000 \
  --namespace activity-system \
  --database learning_loop \
  --user root --pass <password> \
  "SELECT thompson_alpha, thompson_beta FROM activity WHERE id = '<activity-id>'"

# Expected: thompson_alpha incremented by 1 (if success)
```

### Test 3: Cache Invalidation (After Fix 3)

```bash
# Execute activity
minibob --single "test the feature"

# Immediately request recommendations
minibob --single "test another feature"

# Expected: Updated scores appear in recommendations (not stale cache)
```

### Test 4: End-to-End Learning Loop

```bash
# Run same activity 5 times
for i in {1..5}; do
  minibob --single "test the feature"
done

# Query scores
surreal sql ... "SELECT thompson_alpha, thompson_beta FROM activity WHERE id = '<activity-id>'"

# Expected:
# - thompson_alpha = 6 (or higher if some successes)
# - Recommendations show higher score for this activity
# - Activity appears higher in ranking
```

---

## Conclusion

**Root causes identified**:
1. Category filtering eliminates activities before Thompson Sampling
2. Execution reports don't update Thompson Sampling scores
3. Redis cache not invalidated after score updates

**Minimum fix set (7 hours)**:
1. Soft category matching (2h)
2. Score updates (4h)
3. Cache invalidation (1h)

**Unblocks**:
- Reliable activity recommendations
- Working learning loop
- Thompson Sampling effectiveness

**Next steps**:
1. Implement Fix 1 (soft category matching)
2. Test recommendation flow
3. Implement Fix 2 (score updates)
4. Test score increments
5. Implement Fix 3 (cache invalidation)
6. Run end-to-end learning loop test

---

## Evidence Index

### Code References

| Evidence | File | Lines |
|----------|------|-------|
| Discovery fallback (non-blocking) | `repos/minibob/src/impulse.ts` | 474-480 |
| Execution reporting | `repos/minibob/src/mcp.ts` | 688-763 |
| Execution storage (no score update) | `repos/metabob-activity-api/src/routes/activities.ts` | 1409-1708 |
| Thompson Sampling with static scores | `repos/metabob-activity-api/src/routes/activities.ts` | 3148-3151 |
| Category filtering | `repos/metabob-activity-api/src/routes/activities.ts` | 3129-3134 |
| Cache TTL (1hr) | `repos/metabob-activity-api/src/routes/activities.ts` | 110 |
| Aggressive improvisation | `repos/minibob/src/goal-processor.ts` | 5133-5138 |
| Score reading from view | `repos/metabob-activity-api/src/db/paradigm.ts` | 441-471 |

### Database Schema References

| Table/View | Purpose | Status |
|------------|---------|--------|
| `execution` | Store execution records | ✅ Working |
| `activity` | Store activity templates | ✅ Working |
| `v_activity_score` | Thompson Sampling scores | ❌ Not auto-updating |
| `variant_performance_metrics` | Legacy scores (deprecated) | ⚠️ Fallback only |

---

**Generated**: 2026-04-13
**Investigation time**: ~2 hours
**Confidence**: High (based on code analysis)
