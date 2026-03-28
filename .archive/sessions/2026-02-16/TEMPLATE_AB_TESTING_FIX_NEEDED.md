# Template A/B Testing Fix Needed - February 17, 2026

## Problem Identified

The v2 Activities API is assigning `activity_id = category` instead of using proper activity identifiers, which **breaks A/B testing**.

### Current Broken Behavior

**Backend Code** (`repos/metabob-rpc-api/server/routes/v2_activities.py:676`):
```python
variant_data = {
    "name": template.name,
    "variant_name": template.name,
    "description": template.description,
    "category": template.category,
    "activity_id": template.category,  # ❌ WRONG! Maps category to activity_id
    ...
}
```

**Result**: All templates with the same category get the same activity_id:
- All "feature" templates → `activity_id="feature"`
- All "bugfix" templates → `activity_id="bugfix"`  
- All "refactor" templates → `activity_id="refactor"`

**Impact**: Cannot do A/B testing because:
- We need multiple variants with the SAME activity_id (e.g., "create-activity-template-v1", "create-activity-template-v2")
- Thompson Sampling needs to compare variants for the SAME activity
- Currently all feature templates are lumped together under `activity_id="feature"`

### What Should Happen (Correct A/B Testing)

**Activity**: create-activity-template (the "what")
- **Variant 1**: v1-baseline (stable, 50% traffic)
  - `activity_id`: "create-activity-template"
  - `variant_id`: "create-activity-template-abc123"
  - `variant_name`: "v1-baseline"
  - Thompson params: α=10, β=2 (83% success rate)

- **Variant 2**: v3-behavior-informed (candidate, 50% traffic)
  - `activity_id`: "create-activity-template"  
  - `variant_id`: "create-activity-template-def456"
  - `variant_name`: "v3-behavior-informed"
  - Thompson params: α=8, β=1 (89% success rate)

**Thompson Sampling**: Compares variants with same `activity_id`, promotes winner to stable

### Current Broken State

**Activity**: feature (meaningless grouping)
- **Variant 1**: v1-baseline
  - `activity_id`: "feature" ❌
  - `variant_id`: "feature-abcd5b81"
  - Grouped with 10+ OTHER unrelated feature templates

- **Variant 2**: v3-behavior-informed
  - `activity_id`: "feature" ❌
  - `variant_id`: "feature-9ea89f51"
  - Cannot be A/B tested against v1 because they're mixed with other features

## Root Cause

### 1. Missing `activity_id` Field in API Schema

**TemplateCreateRequest** (`server/routes/v2_activities.py`):
```python
class TemplateCreateRequest(BaseModel):
    name: str
    description: str
    category: str
    variables: dict[str, TemplateVariable]
    task_steps: List[ProtoTaskStep]
    parent_id: Optional[str] = None
    # ❌ MISSING: activity_id field
```

### 2. Conversion Script Doesn't Preserve `activity_id`

**Bootstrap Template** has `activity_id`:
```json
{
  "activity_id": "create-activity-template",
  "variant_name": "v3-behavior-informed",
  "category": "feature",
  ...
}
```

**Conversion Script** loses it:
```python
v2_template = {
    "name": name,
    "description": template.get("description"),
    "category": template.get("category", "feature"),
    # ❌ activity_id NOT included
    "task_steps": task_steps,
}
```

### 3. Backend Defaults to Category

Backend has no `activity_id` in request, so defaults to category:
```python
"activity_id": template.category,  # ❌ Fallback behavior
```

## Fix Implementation

### Step 1: Update API Schema

**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

**Add `activity_id` field to TemplateCreateRequest**:
```python
class TemplateCreateRequest(BaseModel):
    name: str
    description: str
    category: str
    activity_id: Optional[str] = None  # ✅ ADD THIS
    variables: dict[str, TemplateVariable] = {}
    context_requirements: List[TemplateContextRequirement] = []
    task_steps: List[ProtoTaskStep]
    parent_id: Optional[str] = None
```

**Update create_template to use activity_id**:
```python
variant_data = {
    "name": template.name,
    "variant_name": template.name,
    "description": template.description,
    "category": template.category,
    "activity_id": template.activity_id or _generate_activity_id(template.name),  # ✅ FIX
    "variables": {k: v.model_dump() for k, v in template.variables.items()},
    "context_requirements": context_reqs_converted,
    "task_steps": [t.model_dump() for t in template.task_steps],
    "parent_id": template.parent_id,
    "org_id": session.org_id,
    "project_id": session.project_id,
}
```

**Add helper function**:
```python
def _generate_activity_id(name: str) -> str:
    """Generate activity_id from template name if not provided"""
    # "Add REST Endpoint" → "add-rest-endpoint"
    return name.lower().replace(" ", "-").replace("_", "-")
```

### Step 2: Update Conversion Script

**File**: `scripts/convert_bootstrap_templates.py`

**Preserve `activity_id` from bootstrap template**:
```python
def convert_template(template: Dict[str, Any], filename: str) -> Dict[str, Any]:
    # Derive name if missing
    name = derive_template_name(template, filename)
    
    # Derive activity_id (priority: activity_id > derived from name)
    if "activity_id" in template and template["activity_id"]:
        activity_id = template["activity_id"]
    else:
        # Generate from name: "Add REST Endpoint" → "add-rest-endpoint"
        activity_id = name.lower().replace(" ", "-").replace("_", "-")
    
    # Build v2 template
    v2_template = {
        "name": name,
        "description": template.get("description", f"Activity template: {name}"),
        "category": template.get("category", "feature"),
        "activity_id": activity_id,  # ✅ ADD THIS
        "variables": {},
        "context_requirements": [],
        "task_steps": task_steps,
    }
    ...
```

### Step 3: Re-register Templates with Correct `activity_id`

**Delete broken templates**:
```bash
curl -X DELETE https://ide.metabob.com/v2/activities/templates/{template_id} \
  -H "Authorization: Bearer $(cat .session_token_production.txt)"
```

**Re-convert with fixed script**:
```bash
python scripts/convert_bootstrap_templates.py \
  repos/metabob-proto/activities/bootstrap \
  .converted-templates-v2
```

**Re-register**:
```bash
python scripts/register_templates_batch.py \
  .converted-templates-v2 \
  .session_token_production.txt \
  https://ide.metabob.com
```

## Expected Result After Fix

### Proper A/B Testing Structure

**Query**: Get variants for "create-activity-template"
```sql
SELECT * FROM activity_variants WHERE activity_id = 'create-activity-template'
```

**Result**:
```json
[
  {
    "variant_id": "create-activity-template-v1-abc123",
    "activity_id": "create-activity-template",
    "variant_name": "v1-baseline",
    "category": "feature",
    "thompson_alpha": 10,
    "thompson_beta": 2,
    "status": "active"
  },
  {
    "variant_id": "create-activity-template-v3-def456",
    "activity_id": "create-activity-template",
    "variant_name": "v3-behavior-informed",
    "category": "feature",
    "thompson_alpha": 1,
    "thompson_beta": 1,
    "status": "testing"
  }
]
```

### Thompson Sampling Workflow

1. **User requests**: "Create a new activity template"
2. **Backend**: 
   - Finds all variants where `activity_id = "create-activity-template"`
   - Samples from Thompson distribution for each variant
   - Selects variant with highest sample
3. **Execution**:
   - Runs selected variant
   - Records success/failure
   - Updates Thompson parameters (α, β)
4. **Learning**:
   - If v3 consistently outperforms v1 → promote v3 to stable
   - Create new candidate (v4) to test against v3
   - Continuous improvement loop

## Current State vs Desired State

### Current (Broken)

```
Templates in DB:
- activity_id="feature" (12 variants, all different activities mixed together)
  - "v1-baseline" (which activity?)
  - "v3-behavior-informed" (which activity?)
  - "Add REST Endpoint" (different activity!)
  - etc.
  
❌ Cannot A/B test because variants are for DIFFERENT activities
❌ Thompson Sampling compares apples to oranges
❌ No way to promote best variant because we don't know what activity it's for
```

### Desired (Fixed)

```
Templates in DB:
- activity_id="create-activity-template" (2 variants, same activity)
  - variant 1: "v1-baseline" (stable)
  - variant 2: "v3-behavior-informed" (candidate)
  
- activity_id="bug-fix" (2 variants, same activity)
  - variant 1: "v1-baseline" (stable)
  - variant 2: "v2-enhanced" (candidate)
  
- activity_id="add-rest-endpoint" (2 variants, same activity)
  - variant 1: "basic" (stable)
  - variant 2: "with-auth" (candidate)

✅ A/B testing works: variants for SAME activity compete
✅ Thompson Sampling compares like to like
✅ Can promote best variant per activity
✅ Continuous improvement per activity type
```

## Priority

**CRITICAL** - This breaks the core learning system

Without this fix:
- ❌ No A/B testing (all variants mixed together)
- ❌ No Thompson Sampling (comparing unrelated activities)
- ❌ No template evolution (can't identify which variant is better)
- ❌ No continuous improvement (no feedback loop)

## Files to Modify

1. ✅ `repos/metabob-rpc-api/server/routes/v2_activities.py`
   - Add `activity_id` field to `TemplateCreateRequest`
   - Update `create_template()` to use `activity_id` instead of `category`
   - Add `_generate_activity_id()` helper

2. ✅ `scripts/convert_bootstrap_templates.py`
   - Preserve `activity_id` from bootstrap templates
   - Generate sensible `activity_id` if missing

3. ✅ Re-register all templates with correct `activity_id`

## Testing Checklist

- [ ] Backend accepts `activity_id` in POST /v2/activities/templates
- [ ] Converted templates include proper `activity_id`
- [ ] Can create 2 variants with same `activity_id`
- [ ] Thompson Sampling selects between variants with same `activity_id`
- [ ] Variant promotion works (stable ← candidate with higher success rate)
- [ ] Gradient analysis groups by `activity_id` not `category`

## Related Issues

- `TEMPLATE_REGISTRATION_COMPLETE_FEB17.md` - Initial registration (with broken activity_id)
- `GRADIENT_ANALYSIS_DEPLOYED_FEB17.md` - Gradient analysis (needs activity_id grouping)
- `SESSION_STATUS_FEB17_EXECUTION_RECORDING_FIXED.md` - Execution recording (working)

---

**Status**: 🔴 Critical Fix Needed  
**Impact**: Blocks A/B testing, Thompson Sampling, and template evolution  
**Date**: February 17, 2026
