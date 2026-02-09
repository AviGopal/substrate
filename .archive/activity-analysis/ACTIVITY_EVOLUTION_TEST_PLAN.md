# Activity Evolution & Mutation - Complete Test Plan

**Date**: February 6, 2026  
**Goal**: Verify the full activity lifecycle: register → run → capture metrics → evolve → new variant

## Current State

### ✅ What Exists
- `activity-evolve` bootstrap template (5 task steps)
- `activity-create` bootstrap template (4 task steps)
- `opencode activity evolve [template-id]` command
- Evolution hooks in templates (preActivity, postActivity, onError)
- Boredom system for automatic evolution triggers
- A/B testing infrastructure (variant selection, metrics)

### 🔴 What's Broken
- Database serialization: All activities have empty `task_steps[]`
- No activities can execute (including evolution activities)
- Outcome recording may be affected

## Prerequisites (MUST FIX FIRST)

Before we can test evolution, we MUST fix:

### 1. Database Serialization
**File**: `scripts/init-db.py` or use proper registration

**Option A: Fix init-db.py**
```python
# Use SurrealDB Python SDK
from surrealdb import Surreal

async with Surreal("ws://localhost:8000/rpc") as db:
    await db.signin({"user": "local", "pass": "testing"})
    await db.use("metabob", "devbob")
    
    # Direct object insertion (proper serialization)
    await db.create("activity_variants", template_dict)
```

**Option B: Use metabob-cli register-template**
```bash
# This SHOULD work (does proper serialization)
metabob-cli register-template repos/metabob-proto/activities/bootstrap/bug-fix.json

# Verify it worked
curl -H "X-Internal-Request: true" \
  http://localhost:8080/activity-recommendations/variants/bug-fix-v1/details | jq '.task_steps | length'
# Should return: 4 (not 0)
```

### 2. Verify Bootstrap Activities Work
Once serialization is fixed, verify:
```bash
# Check database
python3 << 'EOF'
import httpx
# Query: SELECT task_steps FROM activity_variants WHERE variant_id = 'bug-fix-v1'
# Expected: array with 4 task objects (not empty [])
EOF

# Try executing an activity
opencode  # In interactive mode
# Use activity tool: activity({ activityId: "bug-fix", ... })
# Should NOT error with "not found"
```

## Evolution Test Plan (After Prerequisites)

### Test 1: Manual Activity Evolution

**Objective**: Manually trigger evolution of an existing activity

```bash
# Evolve the bug-fix activity
opencode activity evolve bug-fix --reason "test evolution system"

# Expected behavior:
# 1. Loads bug-fix-v1 template
# 2. Analyzes performance (if metrics exist)
# 3. Creates new variant with mutations
# 4. Registers as bug-fix-<hash> with status="testing"
# 5. Outputs summary
```

**Success Criteria**:
- ✅ No errors during execution
- ✅ New variant created in database
- ✅ New variant has status="testing"
- ✅ task_steps array is populated (not empty)
- ✅ Summary file generated

**Verify**:
```bash
# Check database for new variant
python3 << 'EOF'
import httpx
# SELECT * FROM activity_variants WHERE activity_id = 'bug-fix' ORDER BY created_at DESC
# Should see bug-fix-v1 (original) and bug-fix-<hash> (new)
EOF

# Check variant details
curl -H "X-Internal-Request: true" \
  http://localhost:8080/activity-recommendations/variants/bug-fix-<hash>/details | jq '.'
```

### Test 2: Create New Activity from Scratch

**Objective**: Use activity-create to generate a new activity

```bash
# In opencode interactive mode
activity({
  activityId: "activity-create",
  variables: {
    name: "simple-test-activity",
    description: "A simple test activity for validation",
    category: "test",
    tasks: [
      {
        id: "test-step",
        description: "Simple test step",
        prompt: "Echo hello world"
      }
    ]
  },
  reason: "Test activity creation system"
})

# Expected:
# 1. Creates new activity template JSON
# 2. Validates structure
# 3. Registers in database
# 4. Returns activity_id
```

**Success Criteria**:
- ✅ New activity created
- ✅ Appears in activity list
- ✅ Can be executed

### Test 3: Run Activity and Capture Metrics

**Objective**: Execute an activity and verify metrics are recorded

```bash
# Execute bug-fix activity
activity({
  activityId: "bug-fix",
  variables: {
    bug_description: "Test bug",
    error_message: "Test error"
  },
  reason: "Test outcome recording"
})

# Expected:
# 1. Activity executes
# 2. Outcome recorded in database
# 3. Metrics captured (duration, quality, cost)
```

**Verify Outcome Recording**:
```python
import httpx

# Query activity_outcomes table
query = """
USE NS metabob DB devbob;
SELECT * FROM activity_outcomes 
WHERE variant_id = 'bug-fix-v1' 
ORDER BY created_at DESC 
LIMIT 1;
"""

# Should have:
# - outcome_id
# - variant_id
# - success (true/false)
# - duration_ms
# - quality_score
# - metrics object
```

**Check A/B Testing Metrics**:
```bash
curl -H "X-Internal-Request: true" \
  http://localhost:8080/activity-recommendations/variants/bug-fix-v1/details | jq '{
    impressions: .total_impressions,
    selections: .total_selections,
    conversions: .total_conversions,
    avg_quality: .avg_quality_score
  }'

# Should show incremented counts
```

### Test 4: Automatic Evolution via Boredom

**Objective**: Verify boredom system triggers evolution

**Setup**:
1. Run an activity multiple times
2. Capture various outcomes (some success, some failure)
3. Wait for boredom system to trigger

**Expected**:
```
Boredom system detects:
- Activity has been run N times
- Success rate is X%
- Average quality is Y
- Evolution opportunity exists

Triggers:
- Creates boredom task
- Suggests evolution
- (Optional) Auto-triggers evolution
```

**Manual Trigger** (if auto doesn't work):
```bash
opencode activity evolve --reason "boredom trigger"
# Should auto-select most stale activity
```

### Test 5: Variant A/B Testing

**Objective**: Verify multiple variants are tested via multi-armed bandit

**Setup**:
```bash
# Create 2 variants of same activity
opencode activity evolve bug-fix --reason "create variant A"
opencode activity evolve bug-fix --reason "create variant B"

# Now we have: bug-fix-v1, bug-fix-A, bug-fix-B
```

**Test**:
```bash
# Execute bug-fix multiple times
for i in {1..10}; do
  activity({ activityId: "bug-fix", ... })
done

# Expected:
# - MAB algorithm selects variants
# - Some runs use v1, some use A, some use B
# - Selection weighted by performance
# - Metrics track which variant performed best
```

**Verify**:
```python
# Check impression distribution
query = """
SELECT variant_id, total_impressions, total_conversions, ctr
FROM activity_variants 
WHERE activity_id = 'bug-fix'
"""

# Should show:
# bug-fix-v1: 3 impressions, X conversions
# bug-fix-A: 4 impressions, Y conversions  
# bug-fix-B: 3 impressions, Z conversions
```

### Test 6: Evolution Learning Loop

**Objective**: Complete full cycle - run → learn → evolve → improve

```
1. Run activity → Metrics: 60% success, avg quality 0.6
2. Evolve activity → New variant with improvements
3. Run new variant → Metrics: 80% success, avg quality 0.8
4. MAB favors new variant → More impressions
5. Old variant deprecated → Marked inactive
```

**Steps**:
```bash
# 1. Run original multiple times
for i in {1..5}; do
  activity({ activityId: "bug-fix", ... })
done

# 2. Check metrics
curl .../variants/bug-fix-v1/details | jq .avg_quality_score

# 3. Evolve based on learnings
opencode activity evolve bug-fix --reason "improve based on feedback"

# 4. Run new variant multiple times
for i in {1..5}; do
  activity({ activityId: "bug-fix", ... })
done

# 5. Compare metrics
curl .../variants | jq '.[] | select(.activity_id == "bug-fix") | {variant_id, avg_quality_score}'

# 6. Verify MAB selects better variant more often
```

## Metrics to Track

### Activity Execution Metrics
- Duration (ms)
- Token usage (input/output/cache)
- Cost ($)
- Quality score (0-1)
- Success/failure
- Error messages (if any)

### Variant Performance Metrics
- Total impressions (how many times shown to user)
- Total selections (how many times chosen)
- Total conversions (how many succeeded)
- CTR (click-through rate)
- Conversion rate
- Average quality score
- Thompson sampling alpha/beta
- UCB score
- Expected value

### Evolution Metrics
- Number of variants created
- Evolution type (merge/refine/separate)
- Parent variant(s)
- Mutation applied
- Performance delta vs parent

## Expected Outcomes

### After Test 1 (Manual Evolution)
- New variant exists: `bug-fix-<hash>`
- Status: `testing`
- task_steps: populated with evolved tasks
- Genealogy: links to parent variant

### After Test 2 (Create New)
- New activity: `simple-test-activity`
- Variant: `simple-test-activity-v1`
- Can be executed

### After Test 3 (Metrics)
- `activity_outcomes` table has records
- Variant metrics updated (impressions, conversions)
- A/B testing data populated

### After Test 4 (Boredom)
- Boredom task created
- Evolution triggered automatically
- New variant generated

### After Test 5 (A/B Testing)
- Multiple variants exist
- Impressions distributed across variants
- MAB algorithm selects based on performance

### After Test 6 (Learning Loop)
- Performance improvement visible
- Better variant gets more traffic
- System learns and adapts

## Tools & Commands

### Check Database
```python
import httpx

config = {
    "url": "http://localhost:8000",
    "user": "local",
    "pass": "testing",
    "namespace": "metabob",
    "database": "devbob",
}

# Query variants
query = "USE NS metabob DB devbob; SELECT * FROM activity_variants;"
response = client.post(f"{config['url']}/sql", content=query, ...)
```

### Check API
```bash
# List all variants
curl -H "X-Internal-Request: true" http://localhost:8080/activity-recommendations/variants

# Get variant details
curl -H "X-Internal-Request: true" \
  http://localhost:8080/activity-recommendations/variants/{variant_id}/details

# Get activity (should return best variant)
curl -H "X-Internal-Request: true" http://localhost:8080/activities/{activity_id}
# ^ This endpoint doesn't exist yet (needs to be created per architecture fix)
```

### Evolution Commands
```bash
# Manual evolution
opencode activity evolve <template-id> --reason "..."

# Auto-select stalest
opencode activity evolve --reason "..."

# List activities
opencode activity list
```

## Blockers & Dependencies

### BLOCKER 1: Database Serialization
**Status**: 🔴 Critical  
**Impact**: NO activities can execute  
**Fix**: Use proper serialization (SurrealDB SDK or parameterized queries)  
**Blocks**: ALL tests

### BLOCKER 2: Architecture Boundary
**Status**: ⚠️ Important  
**Impact**: Agents see variant details they shouldn't  
**Fix**: Create `/activities/{id}` endpoint  
**Blocks**: Clean testing

### Dependency: Outcome Recording
**Status**: ❓ Unknown  
**Impact**: Metrics may not be captured  
**Verify**: Check if `activity_outcomes` table exists and is populated

## Success Criteria (Overall)

The evolution system is WORKING when:

✅ Activities execute without errors  
✅ Metrics are captured and stored  
✅ `opencode activity evolve` creates new variants  
✅ New variants have populated task_steps  
✅ A/B testing distributes traffic across variants  
✅ MAB algorithm selects best-performing variants  
✅ Boredom system triggers evolution automatically  
✅ Performance improves over time (learning loop)  

## Next Steps

1. **FIX database serialization** (CRITICAL)
2. **Verify bootstrap activities work**
3. **Run Test 1: Manual evolution**
4. **Run Test 3: Metrics capture**
5. **Run Test 6: Learning loop**

---

**Current Status**: ⏸️ Blocked by database serialization bug  
**Once Fixed**: Full evolution system can be tested end-to-end
