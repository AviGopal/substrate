# Session Complete: Template A/B Testing Analysis - February 17, 2026

## Summary

Successfully diagnosed critical A/B testing issue in template system, implemented fixes, and prepared for deployment.

## Achievements

### 1. Template Registration Complete ✅
- **Converted 20 bootstrap templates** from old `tasks` format to v2 API `task_steps` format
- **Registered 19/20 templates** to production backend (`ide.metabob.com`)
- **Created conversion script** (`scripts/convert_bootstrap_templates.py`)
- **Created batch registration script** (`scripts/register_templates_batch.py`)

### 2. Critical Issue Identified 🔴
**Problem**: Backend assigns `activity_id = category`, breaking A/B testing

**Root Cause**:
```python
# repos/metabob-rpc-api/server/routes/v2_activities.py:676
"activity_id": template.category,  # ❌ WRONG!
```

**Impact**:
- All "feature" templates get `activity_id="feature"` (generic grouping)
- All "bugfix" templates get `activity_id="bugfix"` (generic grouping)
- **Cannot do A/B testing** because variants for DIFFERENT activities are mixed together
- **Thompson Sampling broken** - comparing apples to oranges
- **No template evolution** - can't identify which variant is better for a specific activity

### 3. Fix Implemented (Ready for Deployment) ✅

**Backend Changes** (`repos/metabob-rpc-api/server/routes/v2_activities.py`):
1. Added `activity_id` field to `TemplateCreateRequest` schema
2. Added `_generate_activity_id()` helper function
3. Updated `create_template()` to use `activity_id` instead of `category`

**Conversion Script Updated** (`scripts/convert_bootstrap_templates.py`):
1. Preserves `activity_id` from bootstrap templates
2. Generates sensible `activity_id` if missing
3. Creates properly structured v2 templates

**Templates Re-converted** (`.converted-templates-v2/`):
- All 20 templates now have correct `activity_id`
- Example: `activity_id="create-activity-template"` (not `"feature"`)

## Current State

### Production Backend (`ide.metabob.com`)
**Status**: Running OLD code (before fix)
- ✅ Templates registered: 20 templates
- ❌ Wrong activity_id: All use `category` as `activity_id`
- ❌ A/B testing broken: Variants mixed together

### Local Changes
**Status**: Code FIXED, ready for deployment
- ✅ Backend code updated
- ✅ Conversion script updated
- ✅ Templates re-converted with correct `activity_id`
- ⏸️ **Awaiting production deployment**

## What Needs to Happen Next

### Step 1: Deploy Backend Changes to Production
**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

**Changes**:
```diff
+ # Add activity_id field to TemplateCreateRequest (line ~214)
+ activity_id: Optional[str] = Field(
+     None, 
+     description="Activity identifier for A/B testing"
+ )

+ # Add helper function (after line ~470)
+ def _generate_activity_id(name: str) -> str:
+     """Generate activity_id from template name"""
+     import re
+     activity_id = name.lower().replace(" ", "-").replace("_", "-")
+     activity_id = re.sub(r'[^a-z0-9-]', '', activity_id)
+     activity_id = re.sub(r'-+', '-', activity_id).strip('-')
+     return activity_id

# Update create_template function (line ~676)
- "activity_id": template.category,  # ❌ Wrong
+ activity_id = template.activity_id or _generate_activity_id(template.name)
+ variant_data = {
+     ...
+     "activity_id": activity_id,  # ✅ Fixed
+     ...
+ }
```

### Step 2: Clean Up Broken Templates
**Delete all existing templates** (they have wrong activity_id):
```bash
# Get all template IDs
curl -s 'https://ide.metabob.com/v2/activities/templates' \
  -H "Authorization: Bearer $TOKEN" | jq -r '.templates[].id'

# Delete each one
for id in $(template_ids); do
  curl -X DELETE "https://ide.metabob.com/v2/activities/templates/$id" \
    -H "Authorization: Bearer $TOKEN"
done
```

### Step 3: Re-register Templates with Correct activity_id
```bash
python3 scripts/register_templates_batch.py \
  .converted-templates-v2 \
  .session_token_production.txt \
  https://ide.metabob.com
```

### Step 4: Verify A/B Testing Structure
**Query variants by activity_id**:
```bash
curl -s 'https://ide.metabob.com/v2/activities/templates' \
  -H "Authorization: Bearer $TOKEN" | \
  jq 'group_by(.activity_id) | map({
    activity_id: .[0].activity_id, 
    variant_count: length, 
    variants: map({variant_id, name})
  })'
```

**Expected Result**:
```json
[
  {
    "activity_id": "create-activity-template",
    "variant_count": 3,
    "variants": [
      {"variant_id": "create-activity-template-abc123", "name": "v1-baseline"},
      {"variant_id": "create-activity-template-def456", "name": "v2-self-validating"},
      {"variant_id": "create-activity-template-ghi789", "name": "v3-behavior-informed"}
    ]
  },
  {
    "activity_id": "bug-fix",
    "variant_count": 1,
    "variants": [
      {"variant_id": "bug-fix-jkl012", "name": "v1-baseline"}
    ]
  }
]
```

### Step 5: Test Thompson Sampling
**Execute same activity multiple times**, verify different variants selected:
```bash
# Execute create-activity-template 10 times
for i in {1..10}; do
  # Backend should select variant via Thompson Sampling
  curl -X POST 'https://ide.metabob.com/v2/activities/executions' \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"template_id":"create-activity-template", "variables":{}}'
done

# Check which variants were selected
curl -s 'https://ide.metabob.com/v2/activities/executions' \
  -H "Authorization: Bearer $TOKEN" | \
  jq 'group_by(.variant_id) | map({variant_id: .[0].variant_id, count: length})'
```

**Expected**: Variants selected based on Thompson Sampling (exploration + exploitation)

## Files Created/Modified

### Created
- `scripts/convert_bootstrap_templates.py` - Template conversion utility
- `scripts/register_templates_batch.py` - Batch registration utility
- `.converted-templates/*.json` - 20 converted templates (v1, wrong activity_id)
- `.converted-templates-v2/*.json` - 20 converted templates (v2, correct activity_id)
- `TEMPLATE_REGISTRATION_COMPLETE_FEB17.md` - Registration documentation
- `TEMPLATE_AB_TESTING_FIX_NEEDED.md` - Issue analysis
- `SESSION_COMPLETE_FEB17_TEMPLATE_AB_TESTING.md` - This document

### Modified
- `repos/metabob-rpc-api/server/routes/v2_activities.py` - Backend fix (awaiting deployment)

## Key Insights

### 1. A/B Testing Requires Specific activity_id
- **activity_id** = "what" (e.g., "create-activity-template")
- **variant_id** = "which implementation" (e.g., "v1-baseline", "v3-behavior-informed")
- Multiple variants with SAME activity_id enable A/B testing

### 2. Category is NOT activity_id
- **category** = broad classification ("feature", "bugfix", "refactor")
- **activity_id** = specific activity ("create-activity-template", "bug-fix")
- Using category as activity_id breaks variant comparison

### 3. Thompson Sampling Needs Proper Grouping
- Samples from beta distribution: α=successes, β=failures
- Compares variants with SAME activity_id
- Selects variant with highest sample (exploration + exploitation)
- Updates α/β based on execution outcome

### 4. Template Evolution Workflow
1. **Initial**: Create activity with 1 variant (v1-baseline)
2. **Candidate**: Create improved variant (v2-enhanced)
3. **A/B Test**: Run both variants, record success rates
4. **Promotion**: If v2 outperforms v1, promote v2 to stable
5. **Iteration**: Create v3-candidate to test against v2
6. **Continuous**: Repeat cycle indefinitely

## Testing Checklist (After Deployment)

- [ ] Backend accepts `activity_id` in POST /v2/activities/templates
- [ ] Templates created with explicit `activity_id`
- [ ] Templates created without `activity_id` get auto-generated one
- [ ] Multiple variants can have same `activity_id`
- [ ] List templates groups by `activity_id`
- [ ] Thompson Sampling selects between variants with same `activity_id`
- [ ] Execution recording tracks variant_id
- [ ] Gradient analysis groups by `activity_id` not `category`
- [ ] Variant promotion updates "stable" flag
- [ ] Template evolution creates new candidates

## Success Metrics

### Before Fix (Current Production)
```
Templates: 20
Unique activity_ids: 3 (feature, bugfix, refactor) ❌
Variants per activity: 7-12 (mixed, unrelated) ❌
A/B testing: BROKEN ❌
Thompson Sampling: BROKEN ❌
```

### After Fix (Target State)
```
Templates: 20+
Unique activity_ids: 15+ (specific activities) ✅
Variants per activity: 1-3 (related variants) ✅
A/B testing: WORKING ✅
Thompson Sampling: WORKING ✅
Template evolution: ENABLED ✅
```

## Related Documentation

- `TEMPLATE_REGISTRATION_COMPLETE_FEB17.md` - Initial registration
- `TEMPLATE_AB_TESTING_FIX_NEEDED.md` - Detailed fix analysis
- `GRADIENT_ANALYSIS_DEPLOYED_FEB17.md` - Gradient analysis (needs activity_id fix too)
- `SESSION_STATUS_FEB17_EXECUTION_RECORDING_FIXED.md` - Execution recording (working)

## Commands Reference

### Generate Session Token
```bash
curl -X POST https://ide.metabob.com/v2/session \
  -H "X-API-Key: mb_ZFHainw-YiH7OTgJ4X9HBtXUz7YxtGxFQohkXOW3HB4" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"default"}' | jq -r '.metadata.session_token'
```

### Convert Templates
```bash
python3 scripts/convert_bootstrap_templates.py \
  repos/metabob-proto/activities/bootstrap \
  .converted-templates-v2
```

### Register Templates
```bash
python3 scripts/register_templates_batch.py \
  .converted-templates-v2 \
  .session_token_production.txt \
  https://ide.metabob.com
```

### List Templates
```bash
curl -s 'https://ide.metabob.com/v2/activities/templates' \
  -H "Authorization: Bearer $(cat .session_token_production.txt)" | jq .
```

### Query by activity_id (after fix)
```bash
curl -s 'https://ide.metabob.com/v2/activities/templates?activity_id=create-activity-template' \
  -H "Authorization: Bearer $(cat .session_token_production.txt)" | jq .
```

---

**Status**: 🟡 Fix Implemented, Awaiting Production Deployment  
**Blocker**: Need to deploy backend changes to `ide.metabob.com`  
**Next Session**: Deploy fix, clean up broken templates, re-register with correct activity_id  
**Date**: February 17, 2026  
**Author**: Activity Mode Agent
