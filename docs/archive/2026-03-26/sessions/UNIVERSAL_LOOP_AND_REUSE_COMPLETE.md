# Universal Loop Architecture and Activity Reuse - Complete

**Date:** 2026-02-22  
**Status:** ✅ Complete
**Principle:** **Use trace-enforce-validate-loop for everything. Reuse existing activities.**

---

## Summary

We've established the architectural foundation for **universal loop usage** and **activity composition** as the core development methodology.

---

## What Was Accomplished

### 1. Bootstrap Templates Integration
✅ Added `trace-data-flow-single-feature` to bootstrap templates  
✅ Added `trace-enforce-validate-loop` to bootstrap templates  
✅ Total bootstrap templates: 6 (was 4)  
✅ Cold start capability: Start from zero with foundational activities

### 2. Architectural Documentation
✅ **UNIVERSAL_LOOP_ARCHITECTURE.md** - Comprehensive guide on using the loop for everything  
✅ **ACTIVITY_COMPOSITION_QUICK_REFERENCE.md** - Practical patterns for composing activities  
✅ **BOOTSTRAP_TEMPLATES_FUNCTIONAL_STATE_INTEGRATION.md** - Bootstrap integration details  
✅ **BOOTSTRAP_INTEGRATION_VERIFICATION.md** - Verification report

---

## Core Principles Established

### 1. Use Loop for Everything

**Mandate:** Every code change must use `trace-enforce-validate-loop`

**Why?**
- **Measure informational state** - Impulses capture what we want
- **Measure functional state** - Metrics capture what code runs
- **Create deterministic validation** - Harnesses prevent regressions
- **Enable learning** - Data feeds boredom system for optimization
- **Path to determinism** - Activities evolve toward zero LLM calls

**When to use:**
- ✅ Adding features
- ✅ Fixing bugs
- ✅ Refactoring code
- ✅ Enforcing specifications
- ✅ ANY code change

### 2. Reuse Existing Activities

**Mandate:** Compose activities, don't reimplement logic

**Why?**
- **Independent measurement** - Each activity tracked separately
- **Independent optimization** - Boredom system optimizes components
- **Reusability** - Patterns become library functions
- **Cost efficiency** - Well-practiced activities get cheaper over time

**Available for composition:**
- `trace-data-flow-single-feature` - Map data flows
- `trace-enforce-validate-loop` - Enforce specifications
- `create-activity` - Create new templates
- `debug-activity-self-contained` - Debug failures
- `evolve-activity-self-contained` - Optimize templates
- `manage-session-memory` - Memory management
- Plus: CPG-enhanced activities, testing activities, infrastructure activities

---

## The "Develop" Pattern

```
Informational State (requirements)
         ↓
    [trace-enforce-validate-loop]
         ↓
Functional State (code)
         ↓
    [Impulse Measurements]
         ↓
Learning Loop (boredom system)
         ↓
Optimized Activities (cheaper, faster, deterministic)
```

**Lifecycle:**
1. **Day 1:** LLM executes every task (learning)
2. **Day 30:** Activities compose other activities (pattern recognition)
3. **Day 90:** Deterministic execution, zero LLM calls (well-practiced)
4. **Failure:** Trailblazing → Boredom optimization → Genealogy rollout

---

## Key Measurements

### Informational State (Impulses per Loop)

| Impulse ID | Purpose | Token Budget |
|------------|---------|--------------|
| `trace-{spec}` | Current vs desired state gaps | 5000 |
| `enforcement-{spec}` | Code mutations with reasoning | 3000 |
| `harness-{spec}` | Validation test harness (file) | 2000 |
| `validation-results-{spec}` | Test pass/fail status | 2000 |
| `conflict-analysis-{spec}` | Cross-spec conflicts | 3000 |
| `ripple-{spec}` | Propagated changes summary | 2000 |

**Total:** ~17,000 tokens of informational state per loop execution

### Functional State (Activity Metrics)

| Metric | Tracked Data |
|--------|--------------|
| Cost | Total LLM API cost ($) |
| Duration | Wall-clock time (ms) |
| Success rate | Pass/fail over time |
| Tool calls | Which tools, frequency |
| Token usage | Input, output, cache |
| Sub-activities | Composition tracking |

**Stored in:** Activity execution records (backend API)

---

## Activity Composition Patterns

### Pattern 1: Basic Loop (Most Common - 80% of tasks)

```typescript
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'feature-name',
    specificationDescription: 'What it does',
    expectedBehavior: 'Outcomes',
    validationStrategy: 'Test approach'
  },
  reason: 'Enforce feature specification with validation'
})
```

**Use for:** Features, bug fixes, refactoring, any code change

### Pattern 2: Trace First (Complex Features)

```typescript
// Step 1: Understand current state
activity({
  templateId: 'trace-data-flow-single-feature',
  variables: { featureName: 'complex-feature' },
  reason: 'Map implementation before changes'
})

// Step 2: Enforce specification
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: { ... },
  reason: 'Enforce spec based on traced implementation'
})
```

**Use for:** Large features, complex existing code, need detailed flow diagram

### Pattern 3: CPG-Enhanced (Related File Changes)

```typescript
// Step 1: Find related files
activity({
  templateId: 'implement-activity-cochange-workflow',
  variables: { targetFile: 'src/payment.ts' },
  reason: 'Identify co-change files before modifying'
})

// Step 2: Enforce with co-change awareness
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: { ... },
  reason: 'Enforce spec with co-change context'
})

// Step 3: Propagate changes
activity({
  templateId: 'propagate-change-through-flow',
  variables: { ... },
  reason: 'Ripple changes through related files'
})
```

**Use for:** Core component changes, changes affecting multiple files

### Pattern 4: Iterative (Multiple Specs)

```typescript
// Spec 1: Foundation
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: { specificationName: 'auth' },
  reason: 'Enforce authentication'
})

// Spec 2: Builds on spec 1
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: { specificationName: 'authz' },
  reason: 'Enforce authorization on top of auth'
})

// Spec 3: Builds on spec 1 + 2
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: { specificationName: 'session-timeout' },
  reason: 'Enforce session management'
})
```

**Use for:** Complex features with layered requirements

### Pattern 5: Meta-Level (Creating Activities)

```typescript
// Design new activity template

// Enforce template pattern using loop
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'migration-activity-pattern',
    // ... enforce activity template structure
  },
  reason: 'Enforce migration activity template pattern'
})

// Register template
register_activity_template({ file_path: '...' })
```

**Use for:** Creating new activity templates with validated patterns

### Pattern 6: Debug and Evolve

```typescript
// Debug failed activity
activity({
  templateId: 'debug-activity-self-contained',
  variables: { activityId: 'act_xyz123' },
  reason: 'Understand failure'
})

// Evolve template based on learnings
activity({
  templateId: 'evolve-activity-self-contained',
  variables: {
    templateId: 'trace-enforce-validate-loop',
    improvementFocus: 'insights from debug report'
  },
  reason: 'Optimize loop based on failure analysis'
})
```

**Use for:** Activity failures, low success rates, cost optimization

---

## Benefits of Universal Loop + Reuse

### 1. Deterministic Verification

**Before:**
- ❌ Manual testing
- ❌ Regressions require re-testing
- ❌ No automation

**After:**
- ✅ Harness created automatically
- ✅ Regression = run harness (no LLM)
- ✅ Deterministic pass/fail

### 2. Continuous Measurement

**Before:**
- ❌ No data on what code runs
- ❌ Can't optimize
- ❌ Manual improvement

**After:**
- ✅ Every execution measured
- ✅ Boredom system optimizes automatically
- ✅ Continuous improvement

### 3. Cost Reduction Over Time

**Before:**
- ❌ Always need LLM
- ❌ High recurring cost
- ❌ Unpredictable

**After:**
- ✅ Start with LLM (learning)
- ✅ Reduce via composition
- ✅ Eventually zero LLM calls (deterministic)
- ✅ Predictable, decreasing cost

### 4. Reusability

**Before:**
- ❌ Duplicate logic in every activity
- ❌ Can't optimize tracing independently
- ❌ Manual maintenance

**After:**
- ✅ Single source of truth (trace-data-flow)
- ✅ Optimize components independently
- ✅ Library of composable activities

---

## Implementation Checklist

### For All Development Tasks

When implementing ANY feature, bug fix, or refactor:

- [ ] Use `trace-enforce-validate-loop` (mandatory)
- [ ] Define clear specification (name, description, behavior, validation)
- [ ] Create deterministic validation harness
- [ ] Store expected values in impulses
- [ ] Annotate components with reasoning (metabob_annotate_component)
- [ ] Verify all validation tests pass
- [ ] Commit with spec tag: `spec-{specificationName}-v1`

### For Activity Authors

When creating new activity templates:

- [ ] Compose existing activities (don't reimplement)
- [ ] Use `trace-enforce-validate-loop` for code changes
- [ ] Use `trace-data-flow-single-feature` for understanding
- [ ] Create impulses for measurements
- [ ] Include validation harness creation
- [ ] Use soft dependencies (no rigid coupling)
- [ ] Document composition patterns in prompt templates

### For System Architects

When designing features:

- [ ] Identify specifications to enforce
- [ ] Map specifications to validation strategies
- [ ] Design deterministic test harnesses
- [ ] Plan impulse structure for measurements
- [ ] Consider co-change patterns (CPG integration)
- [ ] Enable learning loop optimization

---

## Example: Full Workflow

**User Request:** "Add rate limiting to API endpoints"

**Execution:**
```typescript
// Step 1: Invoke the loop
activity({
  templateId: 'trace-enforce-validate-loop',
  variables: {
    specificationName: 'api-rate-limiting',
    specificationDescription: 'API endpoints must enforce 100 requests/min per user',
    expectedBehavior: 'Middleware checks request count, returns 429 if exceeded',
    validationStrategy: 'Test: send 101 requests in 60s → 101st returns 429'
  },
  reason: 'Enforce API rate limiting with deterministic validation'
})

// Outputs created automatically:
// - impulse: trace-api-rate-limiting
// - impulse: enforcement-api-rate-limiting
// - impulse: harness-api-rate-limiting (reusable forever!)
// - impulse: validation-results-api-rate-limiting
// - impulse: conflict-analysis-api-rate-limiting
// - impulse: ripple-api-rate-limiting
// - git commit: spec-api-rate-limiting-v1

// Step 2: Verify propagation
activity({
  templateId: 'propagate-change-through-flow',
  variables: {
    changeDescription: 'Rate limiting middleware',
    affectedFiles: ['src/middleware/rate-limit.ts', 'src/app.ts']
  },
  reason: 'Ensure rate limiting applied to all API routes'
})

// Step 3: Regression testing (future)
// Just run the harness - no LLM needed!
const harness = impulse_load({ id: 'harness-api-rate-limiting' })
// Execute harness → deterministic pass/fail
```

**Measurements Collected:**
- **Informational state:** 6 impulses (~17K tokens)
- **Functional state:** Activity metrics (cost, duration, tools)
- **Validation:** Deterministic harness (reusable)
- **Learning:** Data for boredom optimization

**Future Executions:**
- Regression: Run harness (no LLM)
- Optimization: Boredom system improves loop
- Cost: Eventually zero LLM calls for similar features

---

## Files Created

### Documentation (4 files)

1. **UNIVERSAL_LOOP_ARCHITECTURE.md** (10 KB)
   - Core mandate: use loop for everything
   - The "develop" pattern explained
   - Why universal loop usage?
   - Activity composition principles
   - Benefits and success metrics

2. **ACTIVITY_COMPOSITION_QUICK_REFERENCE.md** (8 KB)
   - Practical composition patterns
   - Available activities for reuse
   - Calling activities from templates
   - Best practices (DO/DON'T)
   - Common scenarios and troubleshooting

3. **BOOTSTRAP_TEMPLATES_FUNCTIONAL_STATE_INTEGRATION.md** (12 KB)
   - Bootstrap integration details
   - Template usage examples
   - Dependencies analysis
   - Learning loop integration
   - Success criteria

4. **BOOTSTRAP_INTEGRATION_VERIFICATION.md** (7 KB)
   - Verification report
   - Template loading tests
   - Dependency analysis
   - Format compatibility checks
   - Next steps

### Code (2 files)

1. **repos/metabob-proto/activities/bootstrap/trace-data-flow-single-feature.json**
   - 7 tasks, 11 KB
   - Maps data flows through features
   - Uses 5 Metabob CPG tools
   - Creates flow diagrams

2. **repos/metabob-proto/activities/bootstrap/trace-enforce-validate-loop.json**
   - 7 tasks, 17 KB
   - Enforces specifications via loop
   - Creates validation harnesses
   - Soft-depends on trace-data-flow

### Modified (1 file)

1. **repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts**
   - Added template file paths
   - Updated TEMPLATE_IDS constant
   - Now loads 6 templates (was 4)

---

## Success Criteria

### ✅ Immediate (Complete)

1. Bootstrap templates include functional state loop
2. trace-enforce-validate-loop available in cold start
3. trace-data-flow-single-feature available as dependency
4. All templates self-contained or soft-dependent
5. Comprehensive documentation created
6. Verification tests passed

### 🎯 Short-Term (Next 30 Days)

1. 80%+ of development tasks use trace-enforce-validate-loop
2. Activity composition patterns adopted
3. Validation harnesses created for all features
4. Impulses used for all measurements
5. Boredom system receives metrics

### 🎯 Long-Term (Next 90 Days)

1. Deterministic execution percentage > 50%
2. Average cost per activity decreasing
3. Activity success rate > 90%
4. Template variants via genealogy
5. Zero LLM calls for well-practiced activities

---

## Adoption Plan

### Week 1: Awareness
- ✅ Documentation created
- 📢 Share UNIVERSAL_LOOP_ARCHITECTURE.md with team
- 📢 Share ACTIVITY_COMPOSITION_QUICK_REFERENCE.md
- 🎯 All team members understand universal loop mandate

### Week 2-4: Practice
- 🎯 Use loop for ALL code changes
- 🎯 Create validation harnesses for every feature
- 🎯 Compose activities instead of reimplementing
- 🎯 Measure adoption: 80%+ tasks use loop

### Month 2-3: Optimization
- 🎯 Collect execution metrics
- 🎯 Boredom system analyzes patterns
- 🎯 Evolve activities based on learnings
- 🎯 Deploy template variants via genealogy
- 🎯 Measure cost reduction

---

## Conclusion

**We've established the architectural foundation for self-improving, deterministic development.**

**Core Achievements:**
1. ✅ trace-enforce-validate-loop in bootstrap templates
2. ✅ Universal loop usage principle established
3. ✅ Activity composition patterns documented
4. ✅ Measurement architecture defined
5. ✅ Path to deterministic execution clear

**What This Enables:**
- **Self-verifying code** - Harnesses prevent regressions
- **Cost-efficient development** - Activities get cheaper over time
- **Deterministic execution** - Zero LLM calls for well-practiced patterns
- **Automated optimization** - Boredom system improves templates
- **Library of patterns** - Activities become reusable components

**Next Steps:**
1. Use loop for every code change (mandatory)
2. Compose activities (don't recreate)
3. Create validation harnesses (deterministic)
4. Measure everything (impulses + metrics)
5. Feed learning loop (boredom optimization)
6. Watch costs decrease and activities evolve

---

**Status:** ✅ Complete  
**Adoption:** Start immediately  
**Goal:** 80%+ of development uses universal loop pattern within 30 days  
**Vision:** Self-optimizing, deterministic software development via measured learning
