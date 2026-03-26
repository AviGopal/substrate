# Extracted Rules from Recent Changes

**Date:** February 22, 2026  
**Source:** Git commits from last 14 days  
**Purpose:** Extract intents/rules to enforce via trace-enforce-validate-loop

---

## Methodology

Analyzed recent commits to identify **underlying requirements, constraints, and patterns** that should be enforced as specifications.

**Pattern Recognition:**
- Commit messages with "must", "should", "require", "enforce"
- Architecture documents describing requirements
- Implementation patterns that reveal intent
- Design decisions that imply constraints

---

## Extracted Specifications

### Category 1: Activity Instrumentation & Tracking

#### Rule 1: **Activity State Transformation Tracking**

**Extracted From:** Commits 9a70e9f, 7d09b52 (Phase 2 instrumentation)

**Intent Discovered:**
> "Activities transform instructional state (what we want) into functional state (what exists). To enable evolution, we must capture: initial state, instructions, process, outcome, and context."

**Specification:**
```yaml
Name: activity-state-transformation-tracking
Description: All activity executions must track complete state transformations from instructional to functional state
Expected Behavior: |
  Every activity execution captures:
  1. Initial state (functional state before execution)
  2. Instructions (template + variables + reason)
  3. Process (task sequence + decisions)
  4. Outcome (functional state delta)
  5. Context (why and under what conditions)
Validation Strategy: |
  Run activity, verify POST to /api/v1/activity-execution/content contains:
  - template_definition
  - variable_bindings
  - initial_state.git_commit
  - initial_state.working_directory
  - reason field populated
```

---

#### Rule 2: **Impulse Usage Tracking for Context Learning**

**Extracted From:** Commit 1091779 (Impulse-driven context learning)

**Intent Discovered:**
> "The activity system learns WHAT CONTEXT to provide (via impulses), not just execution tracking. Track impulses_loaded and impulses_created per task. Measure context_ratio to optimize token costs while maintaining success rates."

**Specification:**
```yaml
Name: impulse-usage-tracking
Description: All task executions must track impulse loading and creation to learn optimal context strategies
Expected Behavior: |
  Every task execution records:
  - impulses_loaded: Array of impulse IDs loaded
  - impulses_created: Array of impulse IDs created
  - context_ratio: context tokens / total tokens
  - impulse_chain: Dependency between impulses across tasks
Validation Strategy: |
  Run activity with impulse loading, verify PATCH /api/v1/tasks/:id includes:
  - impulses_loaded field (non-empty array)
  - impulses_created field (array)
  - context_ratio (number between 0-1)
```

---

#### Rule 3: **Non-Blocking Error-Resilient Instrumentation**

**Extracted From:** Commit 9a70e9f (Instrumentation implementation)

**Intent Discovered:**
> "Non-blocking, error-resilient instrumentation. Graceful degradation if API unavailable."

**Specification:**
```yaml
Name: non-blocking-instrumentation
Description: Activity instrumentation must never block execution or cause failures if backend unavailable
Expected Behavior: |
  - Instrumentation calls wrapped in try/catch
  - API failures logged but don't throw
  - Activity continues executing even if tracking fails
  - No timeout delays for instrumentation
Validation Strategy: |
  1. Mock backend API to return 500 errors
  2. Run activity execution
  3. Verify activity completes successfully
  4. Verify error logged but not thrown
```

---

### Category 2: Data Persistence & Dual-Write

#### Rule 4: **Dual-Write to Redis and SurrealDB**

**Extracted From:** Commit f0402f8 (Dual-write verification)

**Intent Discovered:**
> "Thompson Sampling with fast Redis cache, permanent storage in SurrealDB. Both must receive data correctly."

**Specification:**
```yaml
Name: dual-write-activity-metrics
Description: Activity execution metrics must be written to both Redis (fast cache) and SurrealDB (permanent storage)
Expected Behavior: |
  - Every activity execution writes to Redis: activity_executions:{template_id}
  - Same execution writes to SurrealDB: activity_execution table
  - Both writes succeed or both rollback (eventual consistency acceptable)
  - Redis TTL: 7 days, SurrealDB: permanent
Validation Strategy: |
  1. Run activity execution
  2. Query Redis: GET activity_executions:{template_id}
  3. Query SurrealDB: SELECT * FROM activity_execution WHERE execution_id = '...'
  4. Verify both contain same execution_id
  5. Verify Redis has TTL, SurrealDB has no expiry
```

---

#### Rule 5: **SurrealDB Schema Completeness**

**Extracted From:** Commit f0402f8 (Schema initialization)

**Intent Discovered:**
> "5 tables for activity learning loop: activity_execution, template_metrics, failure_patterns, task_execution, activity_content"

**Specification:**
```yaml
Name: surrealdb-schema-completeness
Description: SurrealDB must have complete schema for activity learning loop with all 5 required tables
Expected Behavior: |
  Database contains tables:
  1. activity_execution: Individual execution records
  2. template_metrics: Aggregated Thompson Sampling metrics
  3. failure_patterns: Error pattern analysis
  4. task_execution: Task-level tracking for replay/debug
  5. activity_content: Full context for activity replay
Validation Strategy: |
  1. Connect to SurrealDB
  2. Query: INFO FOR DB
  3. Verify all 5 tables exist
  4. Verify each table has required fields (activity_id, execution_id, etc.)
```

---

### Category 3: Activity Template Quality

#### Rule 6: **Activity Templates Must Not Self-Reference**

**Extracted From:** Commit message "fix(create-activity): remove templateId self-reference, make it required"

**Intent Discovered:**
> Activity templates should not reference their own template ID in variables, as it creates circular dependencies.

**Specification:**
```yaml
Name: no-template-self-reference
Description: Activity template definitions must not include templateId in their own variable definitions
Expected Behavior: |
  - Template JSON files don't have "templateId" in variables array
  - Template creation rejects self-referencing templates
  - Validation error if template tries to reference itself
Validation Strategy: |
  1. Load all activity templates
  2. For each template, check variables array
  3. Verify no variable named "templateId" or "template_id"
  4. If found, fail validation
```

---

#### Rule 7: **Clean Git Requirement for Template Creation**

**Extracted From:** Commit "feat(activity): set requiresCleanGit=false for create-activity-template"

**Intent Discovered:**
> Template creation activities should not require clean git state, as they're often used during exploratory work.

**Specification:**
```yaml
Name: template-creation-no-git-requirement
Description: Activity templates for creating other templates must have requiresCleanGit=false
Expected Behavior: |
  - Templates with names matching "*create*template*" have requiresCleanGit=false
  - Allows template creation during exploratory/dirty git states
  - Other activities may still require clean git
Validation Strategy: |
  1. Load all templates matching pattern "*create*template*"
  2. Verify requiresCleanGit field is false or undefined
  3. Fail if any require clean git state
```

---

### Category 4: Context & Memory Management

#### Rule 8: **Session Memory Must Be Managed Proactively**

**Extracted From:** Activity template "manage-session-memory" (100% success rate)

**Intent Discovered:**
> Sessions accumulate context over time, requiring proactive memory management to maintain clarity and token efficiency.

**Specification:**
```yaml
Name: proactive-session-memory-management
Description: Long-running sessions must periodically manage memory to prevent context bloat and maintain clarity
Expected Behavior: |
  - Sessions over 50 messages trigger memory management check
  - Memory management activity runs to summarize/archive context
  - Session context reduced by 30%+ after management
  - Critical context preserved via impulses
Validation Strategy: |
  1. Create session with 60+ messages
  2. Trigger memory management
  3. Verify session message count reduced
  4. Verify impulses created for archived context
  5. Verify critical decisions still accessible
```

---

### Category 5: Bootstrap & Template Requirements

#### Rule 9: **Bootstrap Templates Must Have Proto Fields**

**Extracted From:** Commit "Add required proto fields to Group A bootstrap templates"

**Intent Discovered:**
> Core bootstrap templates need proto (prototype) fields for template evolution and variant tracking.

**Specification:**
```yaml
Name: bootstrap-templates-have-proto-fields
Description: Bootstrap category templates must include proto metadata for evolution tracking
Expected Behavior: |
  Templates in bootstrap category have fields:
  - proto.version: Version number for template evolution
  - proto.baseTemplate: Reference to base if variant
  - proto.mutations: List of changes from base
Validation Strategy: |
  1. Load all templates with category="bootstrap"
  2. Verify each has proto field
  3. Verify proto.version exists
  4. If variant, verify proto.baseTemplate exists
```

---

### Category 6: Error Handling & Resilience

#### Rule 10: **Graceful Degradation for External Dependencies**

**Extracted From:** Multiple commits (instrumentation, dual-write)

**Intent Discovered:**
> External dependencies (APIs, databases) should fail gracefully without breaking core functionality.

**Specification:**
```yaml
Name: graceful-degradation-external-dependencies
Description: Core activity execution must continue even if external dependencies (API, SurrealDB, Redis) are unavailable
Expected Behavior: |
  - Activity execution completes successfully even if:
    * Instrumentation API returns 500
    * SurrealDB connection fails
    * Redis connection fails
  - Errors logged with context
  - Fallback behavior activated
  - User warned but execution continues
Validation Strategy: |
  1. Mock external dependencies to fail
  2. Run activity execution
  3. Verify activity completes (status=completed)
  4. Verify error logs contain warnings
  5. Verify no thrown exceptions
```

---

## Summary Statistics

**Total Specifications Extracted:** 10

**By Category:**
- Activity Instrumentation: 3 specs
- Data Persistence: 2 specs
- Template Quality: 2 specs
- Context Management: 1 spec
- Bootstrap Requirements: 1 spec
- Error Handling: 1 spec

**Enforcement Priority:**

### High Priority (Implement First)
1. **activity-state-transformation-tracking** - Foundation for learning loop
2. **impulse-usage-tracking** - Critical for context optimization
3. **dual-write-activity-metrics** - Data integrity requirement
4. **non-blocking-instrumentation** - Prevents execution failures

### Medium Priority
5. **surrealdb-schema-completeness** - Infrastructure requirement
6. **graceful-degradation-external-dependencies** - Resilience
7. **proactive-session-memory-management** - Performance optimization

### Low Priority (Nice to Have)
8. **no-template-self-reference** - Template quality
9. **template-creation-no-git-requirement** - Developer experience
10. **bootstrap-templates-have-proto-fields** - Evolution tracking

---

## Next Steps: Enforce These Rules

### Immediate Action: Run Trace-Enforce-Validate Loop

For each high-priority specification:

```bash
# Example: Enforce Rule 1
activity trace-enforce-validate-loop \
  specificationName="activity-state-transformation-tracking" \
  specificationDescription="All activity executions must track complete state transformations from instructional to functional state" \
  expectedBehavior="Every activity execution captures initial state, instructions, process, outcome, and context" \
  validationStrategy="Run activity, verify POST to /api/v1/activity-execution/content contains required fields"

# Example: Enforce Rule 2
activity trace-enforce-validate-loop \
  specificationName="impulse-usage-tracking" \
  specificationDescription="All task executions must track impulse loading and creation to learn optimal context strategies" \
  expectedBehavior="Every task execution records impulses_loaded, impulses_created, context_ratio" \
  validationStrategy="Run activity with impulse loading, verify PATCH /api/v1/tasks/:id includes impulse tracking fields"

# Example: Enforce Rule 4
activity trace-enforce-validate-loop \
  specificationName="dual-write-activity-metrics" \
  specificationDescription="Activity execution metrics must be written to both Redis and SurrealDB" \
  expectedBehavior="Every execution writes to both stores with same execution_id" \
  validationStrategy="Run activity, query both Redis and SurrealDB, verify both contain execution record"
```

### Benefits of Enforcing These Rules

1. **Prevent Regressions:** Future changes can't accidentally remove instrumentation
2. **Ensure Consistency:** All activities follow same tracking patterns
3. **Enable Learning:** Complete data enables activity evolution
4. **Validate Architecture:** Specifications verify design intent is implemented
5. **Living Documentation:** Validation harnesses document expected behavior

---

## Pattern Recognition Insights

### Pattern 1: **Dual Concerns** (Functional + Informational)

Many commits show dual concerns:
- Functional: Make the code work
- Informational: Track WHY and HOW it worked

**Rule:** Every functional change should have informational counterpart (instrumentation, annotation, documentation)

### Pattern 2: **Non-Blocking Side Effects**

Repeated pattern: Core functionality must not fail due to side effects (logging, instrumentation, tracking)

**Rule:** All observability/tracking code must be error-resilient with graceful degradation

### Pattern 3: **State Transformation Thinking**

Shift from "implement feature X" to "transform state A→B to achieve X"

**Rule:** All activities should document state transformations, not just actions taken

### Pattern 4: **Context Optimization Over Time**

Evolution from "capture everything" to "capture what matters"

**Rule:** Instrumentation should enable learning what context is actually useful (impulse tracking)

---

## Conflict Analysis

### Potential Conflict: Rule 3 vs Rule 4

**Rule 3:** Non-blocking instrumentation (fail gracefully)  
**Rule 4:** Dual-write to both stores (both must succeed)

**Resolution:** Eventual consistency - attempt both writes, log failures, retry async. Primary execution continues regardless.

### Potential Conflict: Rule 8 vs Rule 2

**Rule 8:** Proactive memory management (reduce context)  
**Rule 2:** Track all impulse loading (need context to learn)

**Resolution:** Memory management preserves impulse metadata while archiving content. Learning still possible from metadata.

---

## Recommendation: Batch Enforcement

Instead of enforcing rules one-by-one, create a **specification suite**:

```bash
# Create specification suite for "Activity Learning Loop Foundation"
activity create-specification-suite \
  suiteName="activity-learning-loop-foundation" \
  specifications=[
    "activity-state-transformation-tracking",
    "impulse-usage-tracking",
    "dual-write-activity-metrics",
    "non-blocking-instrumentation"
  ] \
  enforceOrder=true \
  validateCrossSpec=true
```

This would:
1. Enforce all 4 specs in order
2. Detect conflicts between them
3. Create unified validation suite
4. Generate comprehensive commit

---

**These 10 rules represent the accumulated wisdom from recent development. Enforcing them via trace-enforce-validate-loop will prevent regressions and ensure future changes align with proven patterns.** ✨
