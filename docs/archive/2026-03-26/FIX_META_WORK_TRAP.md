# Fix: The Meta-Work Trap

## Problem

MiniBob is stuck in a wasteful loop:
- 88% of executions are meta-activities (debugging, analyzing, validating)
- 12% are actual work (writing code, implementing features)
- Thompson Sampling prefers safe meta-work over risky real work
- **32 times** we analyzed a failing template without fixing it

**This must be fixed before we attempt dashboard self-modification.**

---

## Root Cause

Meta-activities are systematically easier to succeed at:
- **Debugging activity**: Just read code and report → 100% success
- **Validation activity**: Check if files exist → 100% success
- **Analysis activity**: Summarize execution traces → 100% success

Real work is harder:
- **Fix bug**: Must understand code, modify correctly, pass validation → 50% success
- **Add feature**: Must integrate with existing code, handle edge cases → 60% success

Thompson Sampling rationally prefers the high-success meta-work.

**The problem isn't the algorithm - it's that we're measuring the wrong thing.**

---

## Solution 1: Outcome-Based Metrics (Immediate)

### Current: Measure Activity Success
```typescript
success = validation_passed ? true : false
```

### Proposed: Measure Outcome Value
```typescript
value = (validation_passed ? 1.0 : 0.0) * activity_weight
```

Where `activity_weight` reflects real-world impact:

| Activity Type | Weight | Reasoning |
|--------------|--------|-----------|
| Fix bug | 1.0 | Direct value: working code |
| Add feature | 1.0 | Direct value: new capability |
| Refactor | 0.8 | Indirect value: code quality |
| Debug/Analyze | 0.2 | Meta-work: only valuable if leads to fixes |
| Validate | 0.1 | Meta-work: no direct output |

### Implementation
```typescript
// In template registration
{
  category: "feature",
  meta_work: false,        // NEW FIELD
  outcome_weight: 1.0,     // NEW FIELD
}

// In Thompson Sampling
const value_score = success ? template.outcome_weight : 0
alpha = previous_alpha + value_score
beta = previous_beta + (1 - value_score)
```

This makes meta-work less attractive to Thompson Sampling without banning it entirely.

---

## Solution 2: Meta-Work Quotas (Immediate)

Limit percentage of executions that can be meta-work.

### Boredom Activity Selection
```typescript
// Before selecting activity
const recent_executions = await getRecentExecutions(limit: 10)
const meta_work_count = recent_executions.filter(e => e.meta_work).length

const meta_work_percentage = meta_work_count / recent_executions.length

// If too much meta-work, exclude from selection
const eligible_templates = all_templates.filter(t => {
  if (meta_work_percentage > 0.3) {  // Max 30% meta-work
    return !t.meta_work
  }
  return true
})

// Then run Thompson Sampling on eligible templates
const selected = thompsonSampling(eligible_templates)
```

---

## Solution 3: Completion Tracking (Better)

Track whether meta-work leads to actual fixes.

### Add Causality Links
```typescript
// When creating a debugging activity
{
  variant_id: "debug-countdown-timer",
  meta_work: true,
  target_template_id: "countdown-timer-original",  // What we're debugging
  resolution_required: true,                        // Must lead to fix
}

// When fix is implemented
{
  variant_id: "countdown-timer-fixed",
  resolves_meta_work: "debug-countdown-timer-execution-123",  // Links back
}
```

### Penalize Unresolved Meta-Work
```typescript
// After 7 days, check if meta-work led to resolution
const unresolved_meta_work = await getMetaWorkWithoutResolution(age_days: 7)

for (const meta of unresolved_meta_work) {
  // Reduce Thompson alpha (treat as partial failure)
  await penalizeTemplate(meta.variant_id, penalty: 0.5)
}
```

This naturally suppresses meta-work that doesn't lead anywhere.

---

## Solution 4: Goal-Directed Selection (Best, but Complex)

Don't select activities randomly - select based on system goals.

### Define System Goals
```typescript
const goals = [
  { type: "improve_success_rate", target_template: "countdown-timer", priority: "high" },
  { type: "add_feature", description: "dashboard cost charts", priority: "medium" },
  { type: "maintain_health", metric: "avg_success_rate", threshold: 0.85, priority: "low" },
]
```

### Select Activities to Advance Goals
```typescript
// For each goal, find templates that contribute
for (const goal of prioritized_goals) {
  if (goal.type === "improve_success_rate") {
    // Prefer "fix" templates over "debug" templates
    // Only select "debug" if no "fix" exists yet
    const fix_template = await findTemplate({
      resolves: goal.target_template,
      category: "bugfix"
    })

    if (fix_template) {
      return fix_template  // Direct value
    } else {
      // Create debugging activity as prerequisite
      const debug_template = await createMetaWorkActivity({
        target: goal.target_template,
        outcome: "create fix template"
      })
      return debug_template
    }
  }
}
```

This ensures meta-work only happens when it's a necessary step toward a real goal.

---

## Implementation Plan

### Phase 1: Immediate (Day 1)
1. **Tag existing templates** as meta-work or real-work
2. **Add outcome weights** to all templates
3. **Implement quota system** (max 30% meta-work in recent executions)
4. **Deploy and validate** that real work increases

### Phase 2: Near-term (Week 1)
1. **Add completion tracking** schema to database
2. **Implement causality links** when creating meta-work
3. **Add penalty system** for unresolved meta-work
4. **Monitor** for reduction in wasteful analysis

### Phase 3: Future (Week 2+)
1. **Design goal system** architecture
2. **Implement goal-directed selection** algorithm
3. **Test** with curated goals
4. **Replace** boredom activities with goal-seeking

---

## Expected Impact

### Before (Current State)
- 88% meta-work executions
- Same problem analyzed 32 times
- No actual fixes implemented
- High success rate but no real progress

### After (With Fixes)
- <30% meta-work executions (quota enforced)
- Meta-work leads to fixes within 7 days
- Real work prioritized by outcome value
- Success rate reflects actual value delivered

---

## Validation

Run this query to track improvement:

```bash
# Meta-work percentage (should decrease to <30%)
curl -s "http://api.minibob.local/v2/activities/templates" | \
  jq '[.templates[].metrics.total_executions] | add as $total |
      [.templates[] | select(.category == "infrastructure") | .metrics.total_executions] | add |
      (. / $total * 100)'

# Unique templates executed (should increase)
curl -s "http://api.minibob.local/v2/activities/templates" | \
  jq '[.templates[] | select(.metrics.total_executions > 0)] | length'

# Real work executions (should increase)
curl -s "http://api.minibob.local/v2/activities/templates" | \
  jq '[.templates[] | select(.category == "feature" or .category == "bugfix") | .metrics.total_executions] | add'
```

---

## Recommendation

**Implement Phase 1 (quota + outcome weights) immediately** before running any more boredom activities.

Without this fix:
- ❌ More executions won't help (just more meta-work)
- ❌ Readiness validation will stay failed (low real-work success)
- ❌ Self-modification is dangerous (system doesn't know how to prioritize real work)

With this fix:
- ✅ Executions focus on actual improvements
- ✅ Success rates reflect real value
- ✅ Safe to enable self-modification

**Next step:** Create PR with Phase 1 implementation.
