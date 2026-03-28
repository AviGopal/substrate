# Template A/B Testing Structure - Visual Guide

## Current State (BROKEN) ❌

```
┌─────────────────────────────────────────────────────────┐
│ activity_id = "feature" (generic category)              │
├─────────────────────────────────────────────────────────┤
│ Variant 1: v1-baseline                                  │
│   ├─ create-activity-template logic? ❓                 │
│   └─ Executions: 0                                      │
│                                                          │
│ Variant 2: v3-behavior-informed                         │
│   ├─ create-activity-template logic? ❓                 │
│   └─ Executions: 0                                      │
│                                                          │
│ Variant 3: Add REST Endpoint                            │
│   ├─ DIFFERENT ACTIVITY mixed in! ❌                    │
│   └─ Executions: 0                                      │
│                                                          │
│ ... 9 more unrelated feature variants ...               │
└─────────────────────────────────────────────────────────┘

❌ Thompson Sampling compares DIFFERENT activities
❌ Cannot identify best variant for create-activity-template
❌ No A/B testing possible
```

## Desired State (FIXED) ✅

```
┌──────────────────────────────────────────────────────────┐
│ activity_id = "create-activity-template" (specific)     │
├──────────────────────────────────────────────────────────┤
│ Variant 1: v1-baseline [STABLE] 🟢                       │
│   ├─ Thompson: α=10, β=2 (83% success)                  │
│   ├─ Status: stable                                      │
│   └─ Traffic: 50%                                        │
│                                                           │
│ Variant 2: v3-behavior-informed [CANDIDATE] 🟡           │
│   ├─ Thompson: α=8, β=1 (89% success)                   │
│   ├─ Status: testing                                     │
│   └─ Traffic: 50%                                        │
└──────────────────────────────────────────────────────────┘
                        ↓
            Thompson Sampling Selects
                        ↓
        ┌───────────────┴────────────────┐
        │                                 │
    Execute v1                       Execute v2
    Record outcome                   Record outcome
        │                                 │
    Update α/β                        Update α/β
        │                                 │
        └───────────────┬────────────────┘
                        ↓
            If v2 consistently better:
              Promote v2 → stable
              Create v3 → candidate

✅ Thompson Sampling compares SAME activity variants
✅ Can identify best variant (v2 = 89% vs v1 = 83%)
✅ A/B testing working
✅ Continuous improvement enabled
```

## Multiple Activities (After Fix)

```
activity_id = "create-activity-template"
  ├─ v1-baseline (stable)
  ├─ v2-self-validating (testing)
  └─ v3-behavior-informed (testing)

activity_id = "bug-fix"
  ├─ v1-baseline (stable)
  └─ v2-enhanced (testing)

activity_id = "add-rest-endpoint"
  ├─ basic (stable)
  └─ with-auth (testing)

activity_id = "refactor"
  └─ safe-refactor (stable)

✅ Each activity has its own variants
✅ Thompson Sampling per activity
✅ Independent evolution per activity type
```

## Thompson Sampling Workflow

```
User Request: "Create a new activity template"
                        ↓
              Find all variants where
         activity_id = "create-activity-template"
                        ↓
        ┌───────────────┴─────────────────┐
        │                                  │
    Variant 1                         Variant 2
    α=10, β=2                         α=8, β=1
        │                                  │
    Sample from                        Sample from
    Beta(10,2)                         Beta(8,1)
    = 0.79                             = 0.91
        │                                  │
        └────────────────┬─────────────────┘
                         ↓
              Select variant with max sample
                         ↓
                   Variant 2 (0.91 > 0.79)
                         ↓
                   Execute v2
                         ↓
              Record outcome (success/failure)
                         ↓
        ┌────────────────┴─────────────────┐
        │                                   │
    Success                             Failure
    α = 8+1 = 9                         β = 1+1 = 2
    β = 1                               α = 8
        │                                   │
    Next time:                          Next time:
    Beta(9,1) = higher                  Beta(8,2) = lower
```

## Promotion Logic

```
After N executions (e.g., N=20):

Variant 1 (v1-baseline):
  α=15, β=5 → Success rate = 15/20 = 75%

Variant 2 (v3-behavior-informed):
  α=18, β=2 → Success rate = 18/20 = 90%

Decision:
  v2 significantly better (90% > 75%)
  → Promote v2 to stable
  → Deprecate v1 or keep as fallback
  → Create v3-candidate to test against v2
```

## Fix Summary

### Before
```python
"activity_id": template.category  # ❌ "feature", "bugfix", etc.
```

### After
```python
"activity_id": template.activity_id or _generate_activity_id(template.name)
# ✅ "create-activity-template", "bug-fix", etc.
```

### Impact
- **Before**: 3 generic groups (feature, bugfix, refactor)
- **After**: 15+ specific activities with proper A/B testing
- **Result**: Continuous template improvement enabled

---

**Key Insight**: activity_id must be SPECIFIC (what activity), not GENERIC (what category).
