# Specification Enforcement Execution Plan

**Date:** February 22, 2026  
**Source:** EXTRACTED_RULES_FROM_RECENT_CHANGES.md  
**Goal:** Enforce 10 extracted specifications using trace-enforce-validate-loop

---

## Executive Summary

Extracted **10 specifications** from recent commits representing proven patterns and architectural decisions. These specifications encode the **intent** behind recent changes and should be enforced to prevent regressions.

**Execution Strategy:** Enforce high-priority specifications first, detect conflicts, ripple changes, validate continuously.

---

## Specifications to Enforce

### High Priority (Implement Immediately)

#### 1. Activity State Transformation Tracking ⭐⭐⭐

**Why Critical:** Foundation for activity learning loop - without this, we can't learn or evolve templates.

**Command:**
```bash
activity trace-enforce-validate-loop \
  specificationName="activity-state-transformation-tracking" \
  specificationDescription="All activity executions must track complete state transformations from instructional to functional state. Captures: initial state, instructions (template+variables), process (task sequence), outcome (delta), and context (reason+environment)." \
  expectedBehavior="Every activity execution POSTs to /api/v1/activity-execution/content with template_definition, variable_bindings, initial_state (git_commit, working_directory), reason field populated" \
  validationStrategy="Run hello-world-minimal activity, capture API call, verify POST body contains: template_definition object, variable_bindings object, initial_state.git_commit string, reason string"
```

**Impact:**
- Files affected: `src/agent/activity/activity-executor.ts` (add instrumentation)
- New files: `tests/validation-harnesses/activity-state-transformation-tracking-harness.ts`
- API calls added: `POST /api/v1/activity-execution/content`

**Estimated Time:** 30-45 minutes

---

#### 2. Impulse Usage Tracking ⭐⭐⭐

**Why Critical:** Enables learning WHAT context is useful - directly optimizes token costs while maintaining success rates.

**Command:**
```bash
activity trace-enforce-validate-loop \
  specificationName="impulse-usage-tracking" \
  specificationDescription="All task executions must track impulse loading and creation to learn optimal context strategies. Records impulses_loaded, impulses_created, context_ratio per task." \
  expectedBehavior="Every task execution PATCHes /api/v1/tasks/:id with impulses_loaded (array), impulses_created (array), context_ratio (number 0-1)" \
  validationStrategy="Run activity with impulse loading (manage-session-memory), verify PATCH /api/v1/tasks/:id includes: impulses_loaded non-empty array, impulses_created array, context_ratio between 0 and 1"
```

**Impact:**
- Files affected: `src/agent/activity/task-executor.ts` (add impulse tracking)
- New files: `tests/validation-harnesses/impulse-usage-tracking-harness.ts`
- API calls added: `PATCH /api/v1/tasks/:id` (add impulse fields)

**Estimated Time:** 30-45 minutes

---

#### 3. Non-Blocking Instrumentation ⭐⭐⭐

**Why Critical:** Prevents instrumentation from breaking core functionality - resilience requirement.

**Command:**
```bash
activity trace-enforce-validate-loop \
  specificationName="non-blocking-instrumentation" \
  specificationDescription="Activity instrumentation must never block execution or cause failures if backend unavailable. All API calls wrapped in try/catch, failures logged but not thrown, activity continues executing." \
  expectedBehavior="Activity completes successfully even if instrumentation API returns 500 errors or times out. Errors logged but execution proceeds." \
  validationStrategy="Mock backend API to return 500 errors for all instrumentation endpoints. Run hello-world-minimal activity. Verify: activity status=completed, error logs contain 'instrumentation failed', no thrown exceptions"
```

**Impact:**
- Files affected: All instrumentation call sites (wrap in try/catch)
- New files: `tests/validation-harnesses/non-blocking-instrumentation-harness.ts`
- Pattern: Add error handling to all API calls

**Estimated Time:** 20-30 minutes

---

#### 4. Dual-Write Activity Metrics ⭐⭐

**Why Critical:** Data integrity - ensures metrics available in both fast cache (Redis) and permanent storage (SurrealDB).

**Command:**
```bash
activity trace-enforce-validate-loop \
  specificationName="dual-write-activity-metrics" \
  specificationDescription="Activity execution metrics must be written to both Redis (fast cache with 7-day TTL) and SurrealDB (permanent storage). Both writes should succeed, eventual consistency acceptable." \
  expectedBehavior="Every activity execution writes to Redis key activity_executions:{template_id} AND SurrealDB table activity_execution with same execution_id. Redis has TTL, SurrealDB permanent." \
  validationStrategy="Run hello-world-minimal activity. Query Redis: GET activity_executions:hello-world-minimal. Query SurrealDB: SELECT * FROM activity_execution. Verify both contain same execution_id, Redis has TTL field, SurrealDB has created_at without expiry"
```

**Impact:**
- Files affected: `src/agent/activity/activity-executor.ts` (add dual-write logic)
- Dependencies: Redis client, SurrealDB client
- New files: `tests/validation-harnesses/dual-write-activity-metrics-harness.ts`

**Estimated Time:** 40-60 minutes (depends on client setup)

---

### Medium Priority (Implement After High Priority)

#### 5. SurrealDB Schema Completeness ⭐⭐

**Command:**
```bash
activity trace-enforce-validate-loop \
  specificationName="surrealdb-schema-completeness" \
  specificationDescription="SurrealDB must have complete schema for activity learning loop: activity_execution, template_metrics, failure_patterns, task_execution, activity_content tables." \
  expectedBehavior="Database contains all 5 required tables with correct field definitions" \
  validationStrategy="Connect to SurrealDB, run INFO FOR DB, verify all 5 tables exist, query each table schema to verify required fields (activity_id, execution_id, etc.)"
```

**Estimated Time:** 20-30 minutes (schema likely already exists, validate only)

---

#### 6. Graceful Degradation External Dependencies ⭐⭐

**Command:**
```bash
activity trace-enforce-validate-loop \
  specificationName="graceful-degradation-external-dependencies" \
  specificationDescription="Core activity execution must continue even if external dependencies (API, SurrealDB, Redis) are unavailable. Errors logged, fallback behavior activated, user warned, execution continues." \
  expectedBehavior="Activity execution completes with status=completed even when all external dependencies fail. Error logs contain warnings, no thrown exceptions." \
  validationStrategy="Mock all external dependencies to fail (API 500, Redis ECONNREFUSED, SurrealDB timeout). Run activity. Verify: status=completed, error logs populated, result indicates degraded mode"
```

**Estimated Time:** 30-40 minutes

---

#### 7. Proactive Session Memory Management ⭐

**Command:**
```bash
activity trace-enforce-validate-loop \
  specificationName="proactive-session-memory-management" \
  specificationDescription="Long-running sessions (50+ messages) must periodically manage memory via manage-session-memory activity. Context reduced by 30%+, critical context preserved via impulses." \
  expectedBehavior="Sessions over 50 messages trigger memory management check. After management, session message count reduced, impulses created for archived context." \
  validationStrategy="Create session with 60 messages. Trigger memory management. Verify: message count reduced by 30%+, new impulses created (type=memo), archived context accessible via impulses"
```

**Estimated Time:** 25-35 minutes

---

### Low Priority (Quality Improvements)

#### 8. No Template Self-Reference

**Command:**
```bash
activity trace-enforce-validate-loop \
  specificationName="no-template-self-reference" \
  specificationDescription="Activity template definitions must not include templateId in their own variable definitions to avoid circular dependencies." \
  expectedBehavior="Template creation rejects templates with 'templateId' in variables array. Validation error thrown." \
  validationStrategy="Attempt to create template with templateId variable. Verify: creation fails, error message indicates self-reference detected"
```

**Estimated Time:** 15-20 minutes

---

#### 9. Template Creation No Git Requirement

**Command:**
```bash
activity trace-enforce-validate-loop \
  specificationName="template-creation-no-git-requirement" \
  specificationDescription="Activity templates for creating other templates must have requiresCleanGit=false to allow template creation during exploratory work." \
  expectedBehavior="Templates matching *create*template* have requiresCleanGit=false or undefined" \
  validationStrategy="Load all templates matching pattern. Verify requiresCleanGit field is false or undefined. Fail if any require clean git."
```

**Estimated Time:** 15-20 minutes

---

#### 10. Bootstrap Templates Have Proto Fields

**Command:**
```bash
activity trace-enforce-validate-loop \
  specificationName="bootstrap-templates-have-proto-fields" \
  specificationDescription="Bootstrap category templates must include proto metadata (version, baseTemplate, mutations) for evolution tracking." \
  expectedBehavior="Templates with category=bootstrap have proto.version, and if variants, proto.baseTemplate exists" \
  validationStrategy="Load all bootstrap templates. Verify each has proto field with version. If variant, verify baseTemplate reference exists."
```

**Estimated Time:** 15-20 minutes

---

## Execution Order & Conflict Analysis

### Phase 1: Foundation (Specs 1-3)
**Order:** 3 → 1 → 2

1. **Non-blocking instrumentation** (Spec 3) - FIRST to ensure safety
2. **State transformation tracking** (Spec 1) - Core functionality
3. **Impulse usage tracking** (Spec 2) - Builds on Spec 1

**Rationale:** Establish error resilience BEFORE adding instrumentation, then layer on tracking.

**Potential Conflicts:** None - these complement each other

---

### Phase 2: Data Integrity (Specs 4-5)
**Order:** 5 → 4

1. **Schema completeness** (Spec 5) - Ensure database ready
2. **Dual-write metrics** (Spec 4) - Use the schema

**Rationale:** Can't dual-write without schema existing.

**Potential Conflicts:** None

---

### Phase 3: Resilience & Optimization (Specs 6-7)
**Order:** 6 → 7

1. **Graceful degradation** (Spec 6) - System-wide resilience
2. **Memory management** (Spec 7) - Performance optimization

**Rationale:** Establish resilience before optimizing.

**Potential Conflicts:** None

---

### Phase 4: Quality Improvements (Specs 8-10)
**Order:** Any order, low priority

**Rationale:** These are validation/quality rules, not functional requirements.

---

## Batch Execution Commands

### High Priority Batch (Run First)

```bash
# Spec 3: Non-blocking instrumentation
activity trace-enforce-validate-loop \
  specificationName="non-blocking-instrumentation" \
  specificationDescription="Activity instrumentation must never block execution or cause failures if backend unavailable. All API calls wrapped in try/catch, failures logged but not thrown, activity continues executing." \
  expectedBehavior="Activity completes successfully even if instrumentation API returns 500 errors or times out. Errors logged but execution proceeds." \
  validationStrategy="Mock backend API to return 500 errors for all instrumentation endpoints. Run hello-world-minimal activity. Verify: activity status=completed, error logs contain 'instrumentation failed', no thrown exceptions"

# Wait for completion, then:

# Spec 1: State transformation tracking
activity trace-enforce-validate-loop \
  specificationName="activity-state-transformation-tracking" \
  specificationDescription="All activity executions must track complete state transformations from instructional to functional state. Captures: initial state, instructions (template+variables), process (task sequence), outcome (delta), and context (reason+environment)." \
  expectedBehavior="Every activity execution POSTs to /api/v1/activity-execution/content with template_definition, variable_bindings, initial_state (git_commit, working_directory), reason field populated" \
  validationStrategy="Run hello-world-minimal activity, capture API call, verify POST body contains: template_definition object, variable_bindings object, initial_state.git_commit string, reason string"

# Wait for completion, then:

# Spec 2: Impulse usage tracking
activity trace-enforce-validate-loop \
  specificationName="impulse-usage-tracking" \
  specificationDescription="All task executions must track impulse loading and creation to learn optimal context strategies. Records impulses_loaded, impulses_created, context_ratio per task." \
  expectedBehavior="Every task execution PATCHes /api/v1/tasks/:id with impulses_loaded (array), impulses_created (array), context_ratio (number 0-1)" \
  validationStrategy="Run activity with impulse loading (manage-session-memory), verify PATCH /api/v1/tasks/:id includes: impulses_loaded non-empty array, impulses_created array, context_ratio between 0 and 1"
```

---

## Expected Outcomes

### After Phase 1 (Specs 1-3)
✅ **Instrumentation is resilient** - No failures from tracking  
✅ **Complete state capture** - Every execution tracked  
✅ **Context learning enabled** - Impulse usage measured  

**Files Modified:** ~3-5 files  
**New Harnesses:** 3  
**Commits:** 3 (one per spec)  
**Time:** ~90-120 minutes  

---

### After Phase 2 (Specs 4-5)
✅ **Data integrity guaranteed** - Dual-write to Redis + SurrealDB  
✅ **Schema validated** - All tables present  

**Files Modified:** ~2-3 files  
**New Harnesses:** 2  
**Commits:** 2  
**Time:** ~60-90 minutes  

---

### After All Phases
✅ **10 specifications enforced**  
✅ **10 validation harnesses** (deterministic, LLM-independent)  
✅ **Zero regression risk** - CI/CD validates continuously  
✅ **Living documentation** - Harnesses document expected behavior  
✅ **Knowledge preserved** - 70 impulses created (7 per spec)  

**Total Time:** ~4-6 hours  
**Total Commits:** 10 (tagged `spec-{name}-v1`)  
**Total Impulses:** ~70 (7 per specification)  

---

## Success Metrics

### Before Enforcement
❌ Specifications are implicit (in commit messages, docs, developer heads)  
❌ Regressions possible (no validation)  
❌ Drift inevitable (code evolves, intent forgotten)  
❌ Onboarding hard (new developers don't know rules)  

### After Enforcement
✅ Specifications are explicit (validated continuously)  
✅ Regressions impossible (harnesses catch violations)  
✅ Drift prevented (requirements and code locked together)  
✅ Onboarding easy (harnesses document expected behavior)  

---

## Next Action

**Immediate:** Execute High Priority Batch (Specs 1-3)

**Recommended:** Start with Spec 3 (non-blocking instrumentation) to establish safety foundation.

```bash
activity trace-enforce-validate-loop \
  specificationName="non-blocking-instrumentation" \
  specificationDescription="Activity instrumentation must never block execution or cause failures if backend unavailable. All API calls wrapped in try/catch, failures logged but not thrown, activity continues executing." \
  expectedBehavior="Activity completes successfully even if instrumentation API returns 500 errors or times out. Errors logged but execution proceeds." \
  validationStrategy="Mock backend API to return 500 errors for all instrumentation endpoints. Run hello-world-minimal activity. Verify: activity status=completed, error logs contain 'instrumentation failed', no thrown exceptions"
```

**This will enforce your first specification from recent changes, creating a validation harness that ensures instrumentation never breaks core functionality.** 🚀
