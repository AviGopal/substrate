# Activity Evolution: Immediate Action Plan

**Date**: 2026-02-26  
**Goal**: Evolve 5 failed templates to 80%+ success rate  
**Timeline**: 1-2 days

---

## Priority 1: Failed Template Evolution (Today)

### Template 1: align-vessel-code-with-docs
**Quick Win - Debug & Fix**

```bash
# Step 1: Find execution ID
ls -lt .metabob/activities/align-vessel-code-with-docs.json

# Step 2: Debug (activity execution)
# Use: debug-activity-self-contained
# Variables: executionId = "act_[id-from-file]"

# Step 3: Analyze output and identify root cause

# Step 4: Evolve (activity execution)
# Use: evolve-activity-self-contained
# Variables: templateId = "align-vessel-code-with-docs"

# Expected fix: Relax validation or improve documentation alignment prompts
```

---

### Template 2: validate-distributed-devbob-deployment
**Quick Win - Add Retry & Graceful Degradation**

```bash
# Root cause: Early failure suggests connectivity issues

# Evolution targets:
# 1. Add pre-flight connectivity checks
# 2. Partial validation (some components can be missing)
# 3. Retry logic for transient failures
# 4. Better error messages

# Expected improvement: 90%+ success rate (robust to partial outages)
```

---

### Template 3: enforce-distributed-devbob-deployment-constraints
**Medium Complexity - Safety & Idempotency**

```bash
# Root cause: Long duration failure suggests mid-task kubectl failure

# Evolution targets:
# 1. Pre-flight: Check kubectl permissions, namespace, RBAC
# 2. Dry-run mode before actual enforcement
# 3. Idempotent operations (safe to retry)
# 4. Rollback on failure

# Bonus: Compose with validate-deployment-constraints-compliance
# Create: validate-enforce-fix-loop meta-template
```

---

### Template 4: implement-impulse-learning-system
**High Complexity - Incremental Approach**

```bash
# Root cause: Complex 7-task implementation, mid-task failure

# Evolution strategy: Break into phases
# Phase 1: Data capture hooks (standalone)
# Phase 2: Pattern storage (depends on Phase 1)
# Phase 3: Skip decision logic (depends on Phase 2)
# Phase 4: Dashboard (depends on all)
# Phase 5: Integration test

# Create new template: implement-impulse-learning-system-v2
# With checkpoints and intermediate validation
```

---

### Template 5: generate-ai-services-agreement
**Defer or Simplify**

```bash
# Root cause: Legal document format validation failure

# Options:
# A. Simplify: Reduce validation strictness
# B. Human-in-loop: Add review step before validation
# C. Defer: Mark as low-priority, focus on technical templates

# Recommendation: Option C (defer) - focus on high-impact technical templates
```

---

## Priority 2: Performance Optimization (Tomorrow)

### Optimization 1: test-metabob-stack-e2e-fixed
**Parallelize independent tasks**

```typescript
// Current: 884s average (sequential)
// Target: 450s (50% faster via parallelism)

// Independent tasks (can run in parallel):
// - test-redis-data-flow
// - test-surrealdb-data-flow  
// - test-devbob-acp-delegation

// Sequential dependency:
// - validate-deployment-state (prerequisite for all)
// - test-end-to-end-data-flow (depends on above 3)
// - aggregate-test-results (final aggregation)

// Evolution: Update task dependencies to enable parallelism
```

---

## Priority 3: Cleanup (Tomorrow Afternoon)

### Cleanup 1: Remove Test Artifacts

```bash
# Target: 30+ test-cochange-* and test-template-* templates

# Option A: Bulk delete (if no longer needed)
for id in test-cochange-* test-template-*; do
  echo "DELETE FROM activity_template WHERE id = '$id';"
done

# Option B: Archive to separate namespace
# Export to JSON files in .archive/test-templates/

# Option C: Consolidate into test-framework meta-template
# Keep 1-2 best examples, delete rest

# Recommendation: Option A (bulk delete) - they appear to be one-off tests
```

---

## Expected Outcomes

**Metrics After Evolution**:
- Failed templates: 5 → 1 (80% success rate)
- Active templates: 50 → 25 (cleanup)
- Avg cost: $0.61 → $0.50 (18% reduction)
- Avg duration: 378s → 300s (21% reduction)

**Key Improvements**:
1. ✅ 4/5 failed templates working
2. ✅ Registry cleanup (cleaner discovery)
3. ✅ Performance optimized (faster E2E tests)
4. ✅ Best practices documented

---

## Execution Commands

```bash
# TODAY: Debug all failed templates
for template in align-vessel-code-with-docs validate-distributed-devbob-deployment enforce-distributed-devbob-deployment-constraints implement-impulse-learning-system; do
  echo "Debugging: $template"
  # Run debug-activity-self-contained
done

# TODAY: Evolve top 3 templates
for template in align-vessel-code-with-docs validate-distributed-devbob-deployment enforce-distributed-devbob-deployment-constraints; do
  echo "Evolving: $template"
  # Run evolve-activity-self-contained
done

# TOMORROW: Performance optimization
# Evolve test-metabob-stack-e2e-fixed for parallelism

# TOMORROW: Cleanup
# Archive or delete 30+ test templates
```

---

## Success Criteria

**Template Evolution Success** = Template achieves 80%+ success rate on re-test

**Verification**:
```bash
# After evolution, test each template with real inputs
# Track success rate over 3 executions
# If ≥2/3 succeed → Evolution successful
# If <2/3 succeed → Iterate evolution
```

---

**Ready to Execute**: Yes  
**Estimated Time**: 1-2 days  
**Expected ROI**: High (5 templates improved, registry cleaned, performance optimized)
