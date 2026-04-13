# Execution Flow Fix Plan

**Priority-Ordered Fixes for Reliable Execution**

## Critical Path: 3 Fixes, 7 Hours Total

These fixes are REQUIRED for reliable execution and must be implemented in order.

---

## Fix 1: Soft Category Matching 🔴 CRITICAL

**Priority**: 1 (MUST FIX FIRST)
**Complexity**: Simple
**Time Estimate**: 2 hours
**Impact**: Unblocks recommendations

### Problem

Activities are filtered out by category matching BEFORE Thompson Sampling runs. This means most activities never get a chance to be recommended.

**Example failure**:
- Goal: "debug the failed execution" → category: `"debugging"` or `"bugfix"`
- Activity: category: `"meta"`, tags: `["debugging", "ribosome"]`
- Result: **FILTERED OUT** before Thompson Sampling

### Root Cause

**File**: `repos/metabob-activity-api/src/routes/activities.ts`

```typescript
// Lines 3129-3134 (CURRENT - category is a boost but FTS filter eliminates)
// 7. Category preference boost (soft, not hard filter)
const templateCategory = template.category;
let categoryBoost = 0;
if (category && templateCategory === category) {
  categoryBoost = 3;  // Exact category match
}
totalBoost += categoryBoost;
```

The problem is EARLIER in the flow - FTS search or shape filtering eliminates activities before this boost is even applied.

### Solution

**Step 1**: Find where category filtering happens (likely in FTS search or initial query).

**Step 2**: Remove category from hard filter, make it purely a boost.

**Step 3**: Ensure ALL activities reach Thompson Sampling stage.

### Implementation

```typescript
// BEFORE (approximate - need to find exact location)
const templates = await queryActivitiesByCategory(category, shapes, ...);
// ^ This eliminates non-matching activities

// AFTER
const templates = await queryActivitiesByShapes(shapes, ...);
// ^ Get ALL activities, filter by category in scoring only
```

### Testing

```bash
# 1. Register activity with category "meta"
# 2. Request recommendation with category "bugfix"
# 3. Verify activity APPEARS in recommendations (even with lower score)

# Expected log:
# "Received 3 recommendations from backend"
# "Template: debug-activity-self-contained (score: 0.45, category_boost: 0)"
```

### Success Criteria

- [ ] Activities with non-matching categories appear in recommendations
- [ ] Category boost still applies (+3 alpha for exact match)
- [ ] Thompson Sampling runs on full activity set
- [ ] At least 50% of registered activities reach scoring stage

---

## Fix 2: Thompson Sampling Score Updates 🔴 CRITICAL

**Priority**: 2 (MUST FIX SECOND)
**Complexity**: Medium
**Time Estimate**: 4 hours
**Impact**: Enables learning loop

### Problem

Executions are stored in the database but Thompson Sampling scores (`thompson_alpha`, `thompson_beta`) are NEVER updated. This breaks the learning loop - activities can't improve their scores over time.

**Evidence**:
- Execution stored: `/v2/activities/executions` endpoint ✅
- Score updated: ❌ MISSING

### Root Cause

**File**: `repos/metabob-activity-api/src/routes/activities.ts:1409-1708`

The `/executions` endpoint stores execution records but doesn't update `thompson_alpha`/`thompson_beta` fields on the `activity` table.

### Solution (Option A - Recommended)

**Update the `activity` table directly** after each execution:

```typescript
// In POST /v2/activities/executions handler (after storing execution)

// Update Thompson Sampling scores
const scoreUpdate = await surrealDB.query(`
  UPDATE activity
  SET
    thompson_alpha = thompson_alpha + ${validated.success ? 1 : 0},
    thompson_beta = thompson_beta + ${validated.success ? 0 : 1},
    total_executions = total_executions + 1,
    successful_executions = successful_executions + ${validated.success ? 1 : 0},
    failed_executions = failed_executions + ${validated.success ? 0 : 1},
    last_executed_at = time::now()
  WHERE id = $activity_id
`, { activity_id: activityId });

logger.info('Thompson Sampling scores updated', {
  activity_id: activityId,
  success: validated.success,
  new_alpha: scoreUpdate.thompson_alpha,
  new_beta: scoreUpdate.thompson_beta,
});
```

### Solution (Option B - Alternative)

**Use SurrealDB DEFINE EVENT** to auto-update on execution insert:

```sql
-- sql/migrations/055-thompson-sampling-auto-update.surql

DEFINE EVENT update_thompson_scores ON execution WHEN $event = "CREATE" THEN {
  UPDATE activity
  SET
    thompson_alpha = thompson_alpha + ($after.success ? 1 : 0),
    thompson_beta = thompson_beta + ($after.success ? 0 : 1),
    total_executions = total_executions + 1,
    last_executed_at = time::now()
  WHERE id = $after.activity_id;
};
```

### Implementation Steps

1. **Add score update logic** to `/executions` endpoint (Option A)
   - OR create migration with DEFINE EVENT (Option B)

2. **Initialize score fields** if they don't exist:
   ```sql
   -- Ensure all activities have score fields
   UPDATE activity SET
     thompson_alpha = 1,  -- Prior
     thompson_beta = 1,   -- Prior
     total_executions = 0,
     successful_executions = 0,
     failed_executions = 0
   WHERE thompson_alpha IS NULL;
   ```

3. **Test score increment**:
   ```bash
   # Before execution
   SELECT thompson_alpha, thompson_beta FROM activity WHERE id = 'test-activity';
   # Result: alpha=1, beta=1

   # Execute activity (success)
   minibob --single "test the feature"

   # After execution
   SELECT thompson_alpha, thompson_beta FROM activity WHERE id = 'test-activity';
   # Expected: alpha=2, beta=1
   ```

### Testing

```bash
# Test success case
minibob --single "run the test activity" # Should succeed

# Verify alpha incremented
surreal sql ... "SELECT thompson_alpha, thompson_beta FROM activity WHERE id = '<activity-id>'"
# Expected: alpha += 1

# Test failure case
minibob --single "run the failing activity" # Should fail

# Verify beta incremented
surreal sql ... "SELECT thompson_alpha, thompson_beta FROM activity WHERE id = '<activity-id>'"
# Expected: beta += 1
```

### Success Criteria

- [ ] `thompson_alpha` increments on successful execution
- [ ] `thompson_beta` increments on failed execution
- [ ] `total_executions` increments on any execution
- [ ] `last_executed_at` updates to current time
- [ ] Scores persist across server restarts
- [ ] Multiple executions accumulate scores correctly

---

## Fix 3: Cache Invalidation on Score Update 🟠 HIGH

**Priority**: 3 (FIX IMMEDIATELY AFTER #2)
**Complexity**: Simple
**Time Estimate**: 1 hour
**Impact**: Faster learning loop feedback

### Problem

Redis caches template data for 1 hour (`TEMPLATE_CACHE_TTL = 3600`). When Thompson Sampling scores update (after Fix 2), cached templates still have old scores. This delays learning loop feedback by up to 1 hour.

### Root Cause

**File**: `repos/metabob-activity-api/src/routes/activities.ts:110`

```typescript
const TEMPLATE_CACHE_TTL = 3600; // 1 hour in seconds
```

Cache is invalidated on new template registration but NOT on score updates.

### Solution

**Invalidate cache after score updates** (in Fix 2's code):

```typescript
// In POST /v2/activities/executions handler (after updating scores)

// Invalidate Redis cache for this template
const redis = RedisClient.getInstance();
await redis.del(CACHE_LIST_KEY);  // Invalidate full template list
await redis.del(`${CACHE_KEY_PREFIX}${activityId}`);  // Invalidate specific template

logger.debug('Redis cache invalidated after score update', {
  activity_id: activityId,
});
```

### Implementation Steps

1. **Import RedisClient** in activities.ts (already imported ✅)

2. **Add cache invalidation** after score update in Fix 2

3. **Test cache invalidation**:
   ```bash
   # Execute activity
   minibob --single "test the feature"

   # Immediately request recommendations
   minibob --single "test another feature"

   # Verify fresh scores in logs (not stale cache)
   # Expected: Updated thompson_alpha/beta in recommendation metadata
   ```

### Testing

```bash
# Step 1: Check cache before execution
redis-cli GET "activity:template:<activity-id>"
# Should have old scores

# Step 2: Execute activity
minibob --single "test the feature"

# Step 3: Check cache after execution
redis-cli GET "activity:template:<activity-id>"
# Should be EMPTY (invalidated)

# Step 4: Request recommendations (triggers cache refresh)
minibob --single "recommend similar activity"

# Step 5: Check cache again
redis-cli GET "activity:template:<activity-id>"
# Should have FRESH scores
```

### Success Criteria

- [ ] Cache invalidated immediately after score update
- [ ] Fresh scores appear in next recommendation request
- [ ] No 1-hour delay for score propagation
- [ ] Template list cache also invalidated

---

## Testing the Complete Fix

**After all 3 fixes are implemented**, run this end-to-end test:

### E2E Test: Learning Loop Validation

```bash
# Step 1: Register new activity
minibob --single "register the test activity"

# Step 2: Check initial scores
surreal sql ... "SELECT thompson_alpha, thompson_beta FROM activity WHERE id = '<activity-id>'"
# Expected: alpha=1, beta=1 (priors)

# Step 3: Execute activity 5 times (all success)
for i in {1..5}; do
  minibob --single "run the test activity"
  sleep 2
done

# Step 4: Verify score accumulation
surreal sql ... "SELECT thompson_alpha, thompson_beta FROM activity WHERE id = '<activity-id>'"
# Expected: alpha=6, beta=1

# Step 5: Request recommendations for similar goal
minibob --single "recommend test activities"

# Step 6: Verify activity appears higher in rankings
# Expected in logs:
# "Template: <activity-id> (score: 0.85, thompson_alpha: 6, thompson_beta: 1)"
# Should rank HIGHER than activities with alpha=1

# Step 7: Execute activity again (failure this time)
# Manually inject failure or run failing variant

# Step 8: Verify beta incremented
surreal sql ... "SELECT thompson_alpha, thompson_beta FROM activity WHERE id = '<activity-id>'"
# Expected: alpha=6, beta=2

# Step 9: Verify score decreased in next recommendation
minibob --single "recommend test activities again"
# Expected: Score lower than before (beta increased)
```

### Success Criteria for E2E Test

- [ ] Scores increment after each execution
- [ ] Recommendations reflect updated scores within 1 minute
- [ ] Higher-scored activities rank higher in recommendations
- [ ] Learning loop completes: execute → update → recommend → execute
- [ ] No manual intervention required (automated learning)

---

## Optional Improvements (After Critical Path)

These are NOT required for basic reliability but improve the system:

### Improvement 1: Retry with Broader Search

**Priority**: Medium
**Time**: 3 hours

**Change**: Try broader recommendations before falling back to improvisation.

**Benefit**: More learning opportunities, fewer improvisation sessions.

---

### Improvement 2: Reduce Cache TTL

**Priority**: Low
**Time**: 30 minutes

**Change**: Reduce `TEMPLATE_CACHE_TTL` from 3600s to 300s (5 minutes).

**Benefit**: Faster feedback even if cache invalidation misses.

---

### Improvement 3: Discovery Error Suppression

**Priority**: Low
**Time**: 30 minutes

**Change**: Lower discovery error log level from WARN to DEBUG.

**Benefit**: Reduces log noise (discovery errors are expected in offline mode).

---

## Implementation Order

**Week 1 (Critical Path)**:
1. Monday: Fix 1 (Soft Category Matching) - 2 hours
2. Tuesday: Fix 2 (Thompson Sampling Updates) - 4 hours
3. Wednesday: Fix 3 (Cache Invalidation) - 1 hour
4. Thursday: E2E Testing - 2 hours
5. Friday: Deploy to canary, monitor

**Week 2 (Improvements)**:
- Optional improvements if time permits

---

## Deployment Strategy

### Canary Deployment

1. **Deploy Fix 1** to canary environment
   - Monitor recommendation counts (should increase)
   - Verify no regressions

2. **Deploy Fix 2** to canary environment
   - Monitor score updates in database
   - Verify learning loop works

3. **Deploy Fix 3** to canary environment
   - Monitor cache hit rates (should decrease initially)
   - Verify fresh scores in recommendations

4. **Promote to production** after 24 hours of stable canary

### Rollback Plan

If any fix causes issues:

```bash
# Rollback canary deployment
cd repos/deployment
./scripts/rollback-canary.sh <previous-tag>

# Or rollback specific service
helm rollback metabob-activity-api -n activity-system
```

---

## Success Metrics

### Before Fixes

- Recommendation success rate: ~10% (most activities filtered out)
- Thompson Sampling scores: Static (never update)
- Learning loop: Broken (no score updates)
- Cache propagation delay: 1 hour

### After Fixes

- Recommendation success rate: >70% (activities reach Thompson Sampling)
- Thompson Sampling scores: Dynamic (update after each execution)
- Learning loop: Working (execute → update → recommend)
- Cache propagation delay: <1 minute

### Monitoring

**Dashboard metrics to watch**:
- Recommendation count per request
- Thompson alpha/beta distribution
- Cache hit rate
- Execution success rate
- Time from execution to score update

**Log patterns to look for**:
- "Thompson Sampling scores updated" (Fix 2)
- "Redis cache invalidated after score update" (Fix 3)
- "Received N recommendations" where N > 1 (Fix 1)

---

**Plan Generated**: 2026-04-13
**Total Critical Path Time**: 7 hours
**Expected Impact**: Unblocks reliable execution, enables learning loop
