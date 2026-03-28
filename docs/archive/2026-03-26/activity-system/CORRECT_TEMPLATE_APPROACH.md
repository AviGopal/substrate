# Correct Template Identity Approach

## The Key Insight

**activity_id should describe WHAT it does, not HOW it does it**

### ❌ Wrong: Implementation Details in ID
- `create-activity-self-contained` ← "self-contained" is an implementation detail
- `create-activity-ultra-minimal` ← "ultra-minimal" is an implementation detail
- `create-activity-simplified` ← "simplified" is an implementation detail

### ✅ Right: Pure Intent
- `create-activity-template` ← Pure intent: create an activity template
- `fix-bug` ← Pure intent: fix a bug
- `add-feature` ← Pure intent: add a feature
- `refactor-code` ← Pure intent: refactor code

## Why This Matters

### User Perspective
When a user says: **"Create an activity template for adding logging"**

OpenCode should:
1. Recognize intent: `create-activity-template`
2. Ask backend: "Give me the best variant of `create-activity-template`"
3. Execute whatever variant Thompson Sampling recommends
4. User doesn't care if it's "self-contained" or "ultra-minimal" - they just want their template created

### Evolution Perspective
Over time, we'll create better implementations:

```
create-activity-template
  ├─ Variant 1 (gen 0, hash abc123): 4 tasks, 1000-word prompts, 0% success
  ├─ Variant 2 (gen 1, hash def456): 3 tasks, 300-word prompts, 60% success
  └─ Variant 3 (gen 2, hash 3cd903b8): 2 tasks, 150-word prompts, 85% success ✓
```

Thompson Sampling automatically selects Variant 3. Users never see "self-contained" vs "simplified" vs "ultra-minimal".

## Current State After Fix

### Backend Templates
```
Activity: create-activity-template
  └─ Variant: create-activity-template-3cd903b8 (gen 1)
     - Tasks: 2 (design-and-generate → register)
     - Prompts: ~150 words each
     - Status: Ready for testing
     - Expected success: 70-85%
```

### Legacy Templates (Wrong Approach)
```
Activity: create-activity-template-(self-contained)
  └─ Variant: create-activity-template-(self-contained)-ed6cce82

Activity: create-activity-template-(simplified)
  └─ Variant: create-activity-template-(simplified)-147450e5

Activity: create-activity-template-(ultra-minimal)
  └─ Variant: create-activity-template-(ultra-minimal)-6b9f02c6
```

These are **different activities** (wrong), not variants (correct).

## How to Test the Fixed Template

### User Request
```bash
docker exec -it devbob-clean opencode run --prompt "
Create an activity template for adding logging statements to functions.

Template name: Add Logging
Description: Add comprehensive logging at key decision points
Category: tool
"
```

### What Happens
1. OpenCode interprets: User wants `create-activity-template`
2. Backend query: "Best variant of `create-activity-template`?"
3. Backend responds: `create-activity-template-3cd903b8` (only variant, so selected)
4. OpenCode executes variant 3cd903b8
5. Result reported back with variant_id for tracking

### Expected Outcome
- Template JSON created at `/tmp/activity-add-logging/template.json`
- Template registered with backend as `add-logging-{hash}`
- Success message at `/tmp/activity-add-logging/SUCCESS.md`
- Duration: < 2 minutes
- Cost: < $0.30

## Moving Forward

### For New Templates
Always use pure intent in activity_id:
- ✅ `add-feature` (not `add-feature-with-tests`)
- ✅ `fix-bug` (not `fix-bug-with-root-cause`)
- ✅ `refactor-code` (not `refactor-extract-function`)
- ✅ `deploy-application` (not `deploy-with-rollback`)

Implementation details go in:
- Task design (how many tasks, what they do)
- Prompt strategy (short vs verbose)
- Validation rules (strict vs lenient)

### For Improvements
Use `evolve-activity-template` to create new variants:
```bash
opencode run --prompt "
Use evolve-activity-template to improve create-activity-template.

Current issues:
- Prompts could be shorter
- Need better validation
- Should handle edge case X

Generate an improved variant.
"
```

This creates:
- Same activity_id: `create-activity-template`
- New variant_id: `create-activity-template-{new-hash}`
- Generation: 2 (child of current gen 1)
- Parent hash: 3cd903b8

### Thompson Sampling Takes Over
After 5+ executions of each variant:
- Variant 1 (gen 0): 0% success → expected_value: 0.10
- Variant 2 (gen 1): 60% success → expected_value: 0.62
- Variant 3 (gen 2): 85% success → expected_value: 0.86 ✓

Backend automatically routes 95%+ of requests to variant 3.

## Template Naming Convention

### activity_id
- **Format**: `{verb}-{noun}` (kebab-case)
- **Examples**: 
  - `create-activity-template`
  - `add-feature`
  - `fix-bug`
  - `refactor-code`
  - `deploy-application`
  - `run-tests`
  - `generate-documentation`

### name
- **Format**: Human-readable title (Title Case)
- **Examples**:
  - "Create Activity Template"
  - "Add Feature"
  - "Fix Bug"
  - "Refactor Code"

### description
- **Format**: Brief sentence explaining the purpose
- **Examples**:
  - "Create a new activity template by designing tasks and registering with backend"
  - "Add a new feature with tests and documentation"
  - "Fix a bug with root cause analysis and regression tests"

## The Corrected File

**File**: `templates/bootstrap/create-activity-template.json`
**Activity ID**: `create-activity-template` ✅
**Variant ID**: `create-activity-template-3cd903b8`
**Generation**: 1
**Status**: Registered and ready for testing

### Key Improvements Over Original
1. **2 tasks** instead of 4 (50% reduction)
2. **150-word prompts** instead of 1000+ (85% reduction)
3. **Single-shot generation** instead of multi-step workflow
4. **Minimal validation** - JSON syntax only
5. **No git dependencies** - fully repo-agnostic
6. **Pure intent naming** - no implementation details in ID

## Next Steps

1. **Test the fixed template** (5-10 diverse cases)
2. **Track metrics** (success rate, cost, duration)
3. **Iterate if needed** (use `evolve-activity-template`)
4. **Promote to metabob-proto** when proven (80%+ success)

## Success Criteria

Template is ready for production when:
- ✅ activity_id describes pure intent (no implementation details)
- ✅ Success rate ≥ 80% over 10+ executions
- ✅ Average cost < $0.50
- ✅ Average duration < 2 minutes
- ✅ Works across diverse template types (feature, bugfix, refactor, tool, infrastructure)

---

**Status**: ✅ Correct Approach Implemented
**Template**: `create-activity-template` (variant 3cd903b8)
**Ready**: For immediate testing
**Key Learning**: activity_id = intent, not implementation
