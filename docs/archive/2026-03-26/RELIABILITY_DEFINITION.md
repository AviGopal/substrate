# MiniBob Reliability: Definition, Measurement, Goals

## What Is Reliability?

**Reliability = Predictable behavior + Safe failure modes + Bounded costs**

### 1. Predictable Behavior
When you ask MiniBob to do something, it:
- ✅ Does what was requested (not something else)
- ✅ Produces valid, working code
- ✅ Respects validation constraints
- ✅ Behaves consistently across runs

### 2. Safe Failure Modes
When MiniBob fails (and it will):
- ✅ Detects the failure (doesn't commit broken code)
- ✅ Can rollback cleanly (git safety)
- ✅ Provides useful error info (not "something went wrong")
- ✅ Doesn't corrupt the codebase

### 3. Bounded Costs
MiniBob operations are:
- ✅ Predictable in cost (not $50 for a simple task)
- ✅ Bounded in time (not infinite loops)
- ✅ Resource-efficient (doesn't leak memory, spawn processes)

---

## How We Measure Success

### Quantitative Metrics

#### Primary: Outcome Success Rate
Not "did the activity complete" but "did it produce working code?"

```typescript
outcome_success = validation_passed
                  && tests_pass
                  && code_quality_acceptable
                  && cost_within_budget
```

**Thresholds by complexity:**
- Simple operations (read, write, single edit): **≥95%**
- Medium operations (add feature, fix bug): **≥85%**
- Complex operations (refactor, multi-file): **≥70%**

#### Secondary: Safety Metrics
```typescript
safety_score = {
  rollback_success_rate: 100%,        // All failures cleanly rollback
  validation_catch_rate: ≥90%,        // Validation catches bad outputs
  zero_corruption_incidents: true,    // Never corrupt codebase
  cost_overrun_rate: ≤5%,            // Rarely exceed expected cost
}
```

#### Tertiary: Efficiency Metrics
```typescript
efficiency = {
  avg_duration_ms: minimize,          // Faster is better
  avg_cost_usd: minimize,             // Cheaper is better
  real_work_percentage: ≥70%,         // Not stuck in meta-work
  unique_templates_used: maximize,    // Diverse capabilities
}
```

### Qualitative Assessment

After each activity execution, ask:

1. **Would I commit this code?** (Code quality)
2. **Did it understand the task?** (Intent alignment)
3. **Is it maintainable?** (Not hacky, follows patterns)
4. **Would I trust it unsupervised?** (Confidence level)

---

## Our Goals

### Ultimate Goal: Self-Developing Dashboard
**Definition:** The activity dashboard can improve itself through MiniBob without human intervention.

**Success looks like:**
- User requests feature → Dashboard creates impulses → MiniBob executes activity → Feature works
- Dashboard detects bug → Creates debugging impulses → MiniBob fixes → Bug resolved
- Dashboard observes poor performance → Creates optimization activity → Performance improves

**Demonstration:**
- Record video of dashboard modifying itself in real-time
- Show execution traces in the dashboard itself (dogfooding)
- Prove continuous autonomous development is possible

### Intermediate Goal: Reliable Self-Modification
**Definition:** MiniBob can modify a React application (similar to dashboard) with high success rate and no corruption.

**Success criteria:**
```typescript
{
  // Quantitative
  simple_mods_success_rate: ≥95%,     // Change CSS, add component from template
  medium_mods_success_rate: ≥85%,     // Modify component behavior, add feature
  complex_mods_success_rate: ≥70%,    // Multi-file changes, refactors

  // Safety
  zero_corruption_incidents: true,     // Never broke the codebase
  rollback_success_rate: 100%,         // All failures recovered

  // Efficiency
  avg_cost_per_mod: <$0.50,           // Affordable at scale
  real_work_percentage: ≥70%,          // Not wasting time on meta-work
}
```

**Demonstration:**
- Run 50 self-modification activities on test app
- Show success rates meet thresholds
- Prove safety mechanisms work (force failures, verify rollbacks)
- Show cost and time are acceptable

### Near-Term Goal: Template Library Confidence
**Definition:** We have 20+ reliable templates that we trust for common development tasks.

**Success criteria:**
```typescript
{
  templates_with_data: ≥20,            // Statistical significance
  templates_above_threshold: ≥15,      // 75% are reliable
  meta_work_percentage: ≤30%,          // Focus on real work
  problem_templates: ≤2,               // Very few broken templates
}
```

**Demonstration:**
- Run `validate-minibob-readiness.ts` → exit code 0
- Show diversity of templates (features, bugs, refactors, tools)
- Show execution distribution is healthy (not 32x on one template)

---

## Measurement Dashboard

### Daily Checks (Automated)

```bash
# Overall readiness
bun run validate-minibob-readiness.ts

# Meta-work trap check
curl -s "http://api.minibob.local/v2/activities/templates" | \
  jq '[.templates[].metrics.total_executions] | add as $total |
      [.templates[] | select(.category == "infrastructure") | .metrics.total_executions] | add as $meta |
      {total_executions: $total, meta_work_executions: $meta, meta_percentage: ($meta / $total * 100)}'

# Safety incidents (should be 0)
curl -s "http://api.minibob.local/v2/activities/execution-traces?success=false&limit=100" | \
  jq '[.traces[] | select(.error_type == "corruption" or .error_type == "rollback_failed")] | length'

# Cost tracking
curl -s "http://api.minibob.local/v2/activities/templates" | \
  jq '[.templates[].metrics.avg_cost_usd] | add / length'
```

### Weekly Review Questions

1. **Are we making progress?**
   - Are more templates meeting success thresholds?
   - Is execution diversity increasing?
   - Is meta-work percentage decreasing?

2. **Are we staying safe?**
   - Any corruption incidents? (must be 0)
   - Are rollbacks working?
   - Is validation catching mistakes?

3. **Are we learning?**
   - Are success rates improving over time?
   - Are we creating better templates from good executions?
   - Is Thompson Sampling converging on good templates?

4. **Are we ready for next phase?**
   - Do metrics meet thresholds for current goal?
   - Do we feel confident in the system?
   - What's blocking us from advancing?

---

## Critical Success Factors

### 1. Fix Meta-Work Trap FIRST
**Why:** Without this, more executions = more waste, not more learning

**Measurement:** Meta-work percentage must drop from 88% to <30%

**Timeline:** Fix this week

### 2. Establish Safety Guardrails EARLY
**Why:** One corruption incident destroys trust, delays project

**Measurement:** 100% rollback success rate, 0 corruption incidents

**Timeline:** Implement before running 50+ more activities

### 3. Build Template Diversity STEADILY
**Why:** Need breadth of capabilities, not depth on one template

**Measurement:** 20+ templates with ≥5 executions each

**Timeline:** 2 weeks of focused execution

### 4. Validate on Safe Target BEFORE Dashboard
**Why:** Mistakes on throwaway code are learning, mistakes on dashboard are setbacks

**Measurement:** 50+ successful self-modifications on test app

**Timeline:** Week 3

---

## The Reliability Equation

```
Reliability = (Predictability × Safety × Efficiency) / Risk

Where:
- Predictability = Success rate on known-good scenarios
- Safety = Rollback capability + Validation effectiveness
- Efficiency = Real work % × (1 / avg_cost)
- Risk = Corruption incidents + Cost overruns
```

**We need:**
- Predictability: ≥85% average success rate
- Safety: 100% rollback, 90%+ validation catch rate
- Efficiency: ≥70% real work, <$0.50 per activity
- Risk: 0 corruption, <5% cost overruns

---

## Decision Criteria

### "Are we ready for self-modification?"

Run this checklist:

- [ ] `validate-minibob-readiness.ts` exits with code 0
- [ ] Meta-work percentage <30%
- [ ] 0 corruption incidents in last 100 executions
- [ ] Rollback tested and works 100%
- [ ] 20+ templates with ≥5 executions
- [ ] Average success rate ≥85% on medium complexity
- [ ] Average cost per activity <$0.50
- [ ] Qualitative confidence: "I would trust this unsupervised"

**If all checked:** Proceed to test app self-modification

**If any unchecked:** Fix blockers first

---

## Timeline to Reliability

### Week 1: Foundation
**Goal:** Fix meta-work trap, establish safety

**Metrics:**
- Meta-work drops to <30%
- Git safety implemented and tested
- 10+ templates with ≥5 executions

### Week 2: Diversity
**Goal:** Build template library, improve success rates

**Metrics:**
- 20+ templates with ≥5 executions
- Simple: ≥95%, Medium: ≥85%, Complex: ≥70%
- 0 corruption incidents

### Week 3: Validation
**Goal:** Prove reliability on test target

**Metrics:**
- 50+ self-modifications on test app
- Success rates maintained under self-modification
- Qualitative confidence achieved

### Week 4: Dashboard
**Goal:** Demonstrate self-developing dashboard

**Metrics:**
- Dashboard instrumented with MiniBob
- First successful self-modification
- Execution visible in dashboard metrics

---

## What Success Looks Like

### Quantitative
```bash
$ bun run validate-minibob-readiness.ts

================================================================================
MINIBOB READINESS VALIDATION REPORT
================================================================================

✅ READY FOR SELF-MODIFYING DASHBOARD

SUMMARY
--------------------------------------------------------------------------------
Total templates: 50
Templates with sufficient data (>=5 executions): 23
Templates with insufficient data: 27

SUCCESS RATES BY COMPLEXITY
--------------------------------------------------------------------------------
Simple activities (8):
  ✅ 96.2% (threshold: 95%)

Medium activities (12):
  ✅ 87.5% (threshold: 85%)

Complex activities (3):
  ✅ 73.3% (threshold: 70%)

RECOMMENDATIONS
--------------------------------------------------------------------------------
✅ MiniBob is ready for self-modifying dashboard work!
💡 Start with simple modifications (adding UI elements, tweaking styles) before attempting complex changes.

================================================================================
```

### Qualitative

You watch MiniBob:
- Modify the dashboard to add a feature
- Have the change work correctly on first try
- See the execution appear in the dashboard's own metrics
- Feel confident it could do this unsupervised

And you think: **"This is the process-of-becoming, visible in real-time."**

---

## Summary

**What is reliability?** Predictable, safe, efficient behavior

**How do we measure it?** Success rates by complexity, safety metrics, efficiency metrics, qualitative confidence

**What are our goals?**
1. Near-term: 20+ reliable templates (2 weeks)
2. Intermediate: Proven self-modification on test app (3 weeks)
3. Ultimate: Self-developing dashboard (4 weeks)

**What's blocking us?** Meta-work trap (fix this week), then safety mechanisms, then execution volume

**Decision criteria:** When validation script passes + qualitative confidence + 0 safety incidents = ready

**Next steps:** Fix meta-work trap, run validation daily, build toward thresholds
