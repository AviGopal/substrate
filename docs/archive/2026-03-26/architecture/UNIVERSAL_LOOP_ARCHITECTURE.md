# Universal Loop Architecture: trace-enforce-validate for Everything

**Date:** 2026-02-22  
**Status:** ✅ Architectural Foundation  
**Principle:** **Use the loop for EVERYTHING. Reuse existing activities.**

---

## Core Mandate

> **Every development task should use trace-enforce-validate-loop to ensure instructional state aligns with functional state.**

This is not optional - this is the foundation of how we develop software. The loop is how we:
- **Learn by doing** - Measure what code actually runs
- **Self-verify** - Validate without LLM re-evaluation
- **Evolve deterministically** - Reduce LLM dependence over time
- **Reuse patterns** - Compose existing activities instead of recreating

---

## The Universal Pattern

```
Every Development Activity = trace-enforce-validate-loop + Specialized Logic
```

**Breaking it down:**
1. **Trace** - Map current implementation (reuse `trace-data-flow-single-feature`)
2. **Enforce** - Apply code mutations to close gaps
3. **Validate** - Create deterministic harness (impulse-based, no LLM)
4. **Measure** - Impulses capture state at each step
5. **Learn** - Boredom system optimizes based on measurements

**Path to determinism:**
- **Day 1:** LLM executes every step (learning)
- **Day 30:** Activities compose other activities (pattern recognition)
- **Day 90:** Deterministic execution, zero LLM calls (well-practiced)
- **Failure:** Trailblazing → Boredom → Genealogy rollout

---

## Why Universal Loop Usage?

### Problem: Traditional Development Doesn't Measure

```
❌ Traditional workflow:
User: "Add feature X"
Agent: [writes code]
Agent: "Done! ✓"

Reality: 
- No measurement of what code actually runs
- No validation harness for future verification
- No learning from execution
- Manual testing required
```

### Solution: Loop-Based Development Measures Everything

```
✅ Loop-based workflow:
User: "Add feature X"
Agent: [Invoke trace-enforce-validate-loop]

Phase 1 - Trace:
  - Map current implementation via CPG
  - Identify gaps between current and desired
  - Create impulse: trace-{featureName}

Phase 2 - Enforce:
  - Apply code mutations to close gaps
  - Annotate components with reasoning
  - Create impulse: enforcement-{featureName}

Phase 3 - Validate:
  - Build deterministic test harness
  - Store expected values in impulses
  - Create impulse: harness-{featureName}

Phase 4 - Run Validation:
  - Execute harness with test cases
  - PASS/FAIL without LLM involvement
  - Create impulse: validation-results-{featureName}

Result:
- Measured what code runs (functional state)
- Measured what we want (informational state)
- Created deterministic verification (harness)
- Collected data for learning loop
```

---

## Activity Composition: Reuse, Don't Recreate

### Core Principle

> **Activities should compose other activities, not reimplement their logic.**

**Why?**
- **Measurement** - Each activity invocation is measured independently
- **Optimization** - Boredom system optimizes individual activities
- **Reusability** - Patterns become library functions
- **Determinism** - Well-practiced activities need zero LLM calls

### Example: Bad (Reimplementation)

```json
{
  "name": "Add Feature Complete",
  "tasks": [
    {
      "id": "task-1",
      "description": "Trace implementation",
      "prompt": {
        "template": "Manually trace the code using grep and read tools..."
      }
    }
  ]
}
```

**Problems:**
- ❌ Reimplements trace-data-flow logic
- ❌ No measurement of trace quality
- ❌ Can't optimize tracing independently
- ❌ Duplicate effort across activities

### Example: Good (Composition)

```json
{
  "name": "Add Feature Complete",
  "tasks": [
    {
      "id": "task-1",
      "description": "Trace implementation",
      "prompt": {
        "template": "Invoke trace-data-flow-single-feature activity:\n\nactivity({\n  templateId: 'trace-data-flow-single-feature',\n  variables: { featureName: '{{featureName}}' },\n  reason: 'Map current implementation before adding feature'\n})\n\nRead the output impulse: trace-{{featureName}}"
      }
    }
  ]
}
```

**Benefits:**
- ✅ Reuses proven trace-data-flow logic
- ✅ Measures trace quality independently
- ✅ Optimizes tracing via boredom system
- ✅ Single source of truth for tracing

---

## Universal Loop Integration Patterns

### Pattern 1: Add Feature (Requires Trace + Validate)

**User Request:** "Add user authentication"

**Activity Composition:**
```typescript
// Add-Feature-Complete activity
Task 1: Invoke trace-enforce-validate-loop
  activity({
    templateId: "trace-enforce-validate-loop",
    variables: {
      specificationName: "user-authentication",
      specificationDescription: "Users must authenticate with JWT tokens",
      expectedBehavior: "POST /auth/login returns JWT, protected routes verify JWT",
      validationStrategy: "Test harness: login with valid creds → 200 + token, access protected route → 200"
    },
    reason: "Enforce user authentication specification with deterministic validation"
  })

Task 2: Run comprehensive tests
  // Read validation-results-user-authentication impulse
  // Verify all test cases pass
  
Task 3: Commit changes
  // Organize commits based on enforcement-user-authentication impulse
```

**Measurements:**
- **Impulse: trace-user-authentication** - Current vs desired state
- **Impulse: enforcement-user-authentication** - Code changes made
- **Impulse: harness-user-authentication** - Validation harness (reusable!)
- **Impulse: validation-results-user-authentication** - Test results
- **Activity metrics:** Cost, duration, success rate for add-feature-complete

---

### Pattern 2: Fix Bug (Requires Trace + Validate)

**User Request:** "Fix SQL injection vulnerability"

**Activity Composition:**
```typescript
// Fix-Bug-Complete activity
Task 1: Invoke trace-enforce-validate-loop
  activity({
    templateId: "trace-enforce-validate-loop",
    variables: {
      specificationName: "sql-injection-prevention",
      specificationDescription: "All database queries must use parameterized statements",
      expectedBehavior: "No raw SQL strings with user input, all queries use db.query(sql, [params])",
      validationStrategy: "Test harness: attempt injection → query fails safely, valid input → query succeeds"
    },
    reason: "Enforce SQL injection prevention with regression tests"
  })

Task 2: Verify no other injection vulnerabilities
  // Use metabob_search_codebase_issues("sql injection")
  
Task 3: Commit security fix
  // Tag commit: spec-sql-injection-prevention-v1
```

**Measurements:**
- **Impulse: trace-sql-injection-prevention** - Vulnerable code locations
- **Impulse: enforcement-sql-injection-prevention** - Fixes applied
- **Impulse: harness-sql-injection-prevention** - Security test harness (prevents regression!)
- **Impulse: validation-results-sql-injection-prevention** - Security test results
- **Activity metrics:** Cost, duration for bug fixing pattern

---

### Pattern 3: Refactor (Requires Trace + Validate)

**User Request:** "Refactor session management for better testability"

**Activity Composition:**
```typescript
// Refactor-With-Tests activity
Task 1: Invoke trace-data-flow-single-feature
  activity({
    templateId: "trace-data-flow-single-feature",
    variables: { featureName: "session-management" },
    reason: "Map current session flow before refactoring"
  })

Task 2: Invoke trace-enforce-validate-loop
  activity({
    templateId: "trace-enforce-validate-loop",
    variables: {
      specificationName: "session-dependency-injection",
      specificationDescription: "Session management should use dependency injection for testability",
      expectedBehavior: "SessionManager accepts storage interface, tests can mock storage",
      validationStrategy: "Test harness: create SessionManager with mock storage → all tests pass"
    },
    reason: "Enforce dependency injection pattern with validation"
  })

Task 3: Verify no behavior changes
  // Compare harness results before/after refactoring
  // All test cases must produce same results
```

**Measurements:**
- **Impulse: trace-session-management** - Original implementation flow
- **Impulse: trace-session-dependency-injection** - Refactored vs desired
- **Impulse: enforcement-session-dependency-injection** - Refactoring changes
- **Impulse: harness-session-dependency-injection** - Behavior validation
- **Impulse: validation-results-session-dependency-injection** - Before/after comparison
- **Activity metrics:** Refactoring cost, behavior preservation rate

---

### Pattern 4: Create Activity Template (Meta-Level Reuse)

**User Request:** "Create activity template for database migrations"

**Activity Composition:**
```typescript
// Create-Activity activity
Task 1: Design template structure
  // Define variables, tasks, validation

Task 2: Invoke trace-enforce-validate-loop (meta!)
  activity({
    templateId: "trace-enforce-validate-loop",
    variables: {
      specificationName: "migration-activity-template",
      specificationDescription: "Migration activity must trace schema, enforce changes, validate with rollback tests",
      expectedBehavior: "Activity creates migration file, applies it, validates schema, creates rollback harness",
      validationStrategy: "Test harness: execute migration activity → schema matches expected → rollback succeeds"
    },
    reason: "Enforce migration activity pattern with validation"
  })

Task 3: Register template
  // Use register_activity_template tool
```

**Key Insight:** Even creating activities uses the loop! This ensures meta-level patterns are validated.

---

## Reusing Existing Activities

### Available Activities to Compose

**From Bootstrap Templates:**
1. **create-activity** - Create new activity templates
2. **debug-activity-self-contained** - Debug failed executions
3. **evolve-activity-self-contained** - Optimize templates via metrics
4. **manage-session-memory** - Pre-turn memory management
5. **trace-data-flow-single-feature** - Map data flows
6. **trace-enforce-validate-loop** - Enforce specifications

**From Other Categories:**
7. **implement-activity-cochange-workflow** - CPG co-change integration
8. **implement-cpg-test-selection** - CPG-based test selection
9. **propagate-change-through-flow** - Ripple changes via data flow
10. **debug-activity-execution-failure** - Deep dive on failures

### Composition Examples

**Example 1: Feature Development**
```typescript
activity({
  templateId: "trace-enforce-validate-loop",
  variables: {
    specificationName: "payment-processing",
    // ... other variables
  },
  reason: "Add payment processing feature with validation"
})
```

**Example 2: CPG-Enhanced Feature Development**
```typescript
// Step 1: Analyze co-change patterns
activity({
  templateId: "implement-activity-cochange-workflow",
  variables: { targetFile: "src/payment.ts" },
  reason: "Identify related files before modifying payment logic"
})

// Step 2: Trace and enforce
activity({
  templateId: "trace-enforce-validate-loop",
  variables: {
    specificationName: "payment-validation",
    // Use co-change output to inform spec
  },
  reason: "Enforce payment validation with co-change awareness"
})

// Step 3: Propagate changes
activity({
  templateId: "propagate-change-through-flow",
  variables: { 
    changeDescription: "Added payment validation",
    affectedFiles: ["src/payment.ts", "src/checkout.ts"]
  },
  reason: "Ripple validation through payment flow"
})
```

**Example 3: Activity Evolution**
```typescript
// Step 1: Debug failed activity
activity({
  templateId: "debug-activity-self-contained",
  variables: { activityId: "act_xyz123" },
  reason: "Understand why payment-processing activity failed"
})

// Step 2: Evolve template based on learnings
activity({
  templateId: "evolve-activity-self-contained",
  variables: { 
    templateId: "trace-enforce-validate-loop",
    improvementFocus: "payment-specific validation patterns"
  },
  reason: "Optimize loop for payment domain"
})
```

---

## How Activities Call Other Activities

### Syntax in Task Prompts

**In Activity Template JSON:**
```json
{
  "tasks": [
    {
      "id": "task-trace",
      "prompt": {
        "template": "Trace the current implementation using trace-data-flow-single-feature activity.\n\nInvoke:\n\nactivity({\n  templateId: 'trace-data-flow-single-feature',\n  variables: {\n    featureName: '{{featureName}}'\n  },\n  reason: 'Map current implementation before enforcing specification'\n})\n\nWait for activity to complete. Read the output impulse:\n\nimpulse_load({\n  id: 'trace-{{featureName}}',\n  reason: 'Access traced implementation data'\n})\n\nAnalyze the traced data flow and identify gaps..."
      }
    }
  ]
}
```

**Key Points:**
1. **Call activity tool:** `activity({ templateId, variables, reason })`
2. **Wait for completion:** LLM will wait for sub-activity to finish
3. **Read outputs:** Load impulses created by sub-activity
4. **Process results:** Use sub-activity outputs in subsequent logic

### Soft Dependencies

**Soft dependency = Advertised automatically, resolved at runtime**

```json
{
  "name": "Add Feature Complete",
  "description": "Add a new feature with validation",
  "tasks": [
    {
      "id": "task-1",
      "prompt": {
        "template": "Use trace-enforce-validate-loop activity to enforce the feature specification..."
      }
    }
  ]
}
```

**Benefits of soft dependencies:**
- ✅ No rigid coupling (activities can evolve independently)
- ✅ Automatically advertised (search_activities shows available activities)
- ✅ Runtime resolution (LLM finds best activity for task)
- ✅ Graceful degradation (can inline logic if activity unavailable)

---

## Measuring Everything

### Informational State (Impulses)

Every loop phase creates impulses:
- **trace-{spec}** - Current vs desired state gap
- **enforcement-{spec}** - Code mutations with reasoning
- **harness-{spec}** - Validation test harness
- **validation-results-{spec}** - Pass/fail status
- **conflict-analysis-{spec}** - Cross-spec conflicts
- **ripple-{spec}** - Propagated changes summary

**Token budgets per impulse:**
- trace: 5000 tokens
- enforcement: 3000 tokens
- harness: 2000 tokens
- validation-results: 2000 tokens
- conflict-analysis: 3000 tokens
- ripple: 2000 tokens

**Total:** ~17,000 tokens of informational state per loop execution

### Functional State (Activity Metrics)

Every activity invocation measures:
- **Cost:** Total LLM API cost ($)
- **Duration:** Wall-clock time (ms)
- **Success rate:** Pass/fail over time
- **Tool calls:** Which tools used, frequency
- **Token usage:** Input, output, cache tokens
- **Sub-activities:** Which activities composed

**Stored in:** Activity execution records (backend API)

### Learning Loop Integration

```
Informational State (impulses) + Functional State (metrics) → Boredom System → Optimized Activities
```

**How it works:**
1. **Collect metrics** - Every activity execution recorded
2. **Identify patterns** - Boredom system analyzes failures and successes
3. **Optimize activities** - Evolve templates based on data
4. **Deploy variants** - Genealogy system tracks template evolution
5. **Measure improvements** - Compare before/after metrics

**Result:** Activities get cheaper, faster, more deterministic over time.

---

## Creating New Activities with the Loop

### Guideline: All New Activities Should Use the Loop

**When creating any new activity:**
1. **Ask:** Does this activity change code? → YES → Use loop
2. **Ask:** Does this activity need validation? → YES → Use loop
3. **Ask:** Does this activity enforce a pattern? → YES → Use loop

**Rule of thumb:** If it modifies functional state, it needs the loop.

### Template for New Activities

```json
{
  "name": "Your New Activity",
  "description": "What this activity does",
  "category": "feature|bugfix|refactor|infrastructure",
  "tasks": [
    {
      "id": "task-1-enforce-spec",
      "description": "Enforce the specification using the loop",
      "prompt": {
        "template": "Invoke trace-enforce-validate-loop activity:\n\nactivity({\n  templateId: 'trace-enforce-validate-loop',\n  variables: {\n    specificationName: '{{specName}}',\n    specificationDescription: '{{specDescription}}',\n    expectedBehavior: '{{expectedBehavior}}',\n    validationStrategy: '{{validationStrategy}}'\n  },\n  reason: 'Enforce {{specName}} specification with validation'\n})\n\nWait for loop to complete. Read outputs..."
      }
    },
    {
      "id": "task-2-additional-logic",
      "description": "Any additional logic specific to this activity",
      "prompt": {
        "template": "Additional steps beyond the loop..."
      }
    }
  ]
}
```

---

## Benefits of Universal Loop Usage

### 1. Deterministic Verification

**Without loop:**
- ❌ Manual testing required
- ❌ Regression requires re-testing
- ❌ No automation

**With loop:**
- ✅ Harness created automatically
- ✅ Regression = run harness (deterministic)
- ✅ No LLM needed for verification

### 2. Continuous Measurement

**Without loop:**
- ❌ No data on what code runs
- ❌ Can't optimize
- ❌ Manual improvement

**With loop:**
- ✅ Every execution measured
- ✅ Boredom system optimizes
- ✅ Automated improvement

### 3. Activity Composition

**Without loop:**
- ❌ Duplicate logic across activities
- ❌ Can't optimize tracing independently
- ❌ Manual maintenance

**With loop:**
- ✅ Reuse proven activities
- ✅ Optimize components independently
- ✅ Library of patterns

### 4. Path to Determinism

**Without loop:**
- ❌ Always need LLM
- ❌ High cost
- ❌ Unpredictable

**With loop:**
- ✅ Start with LLM (learning)
- ✅ Reduce LLM calls via composition
- ✅ Eventually zero LLM calls (deterministic)
- ✅ Trailblazing recovery for failures

---

## Implementation Checklist

### For Developers

When building features:
- [ ] Use `trace-enforce-validate-loop` for all code changes
- [ ] Create deterministic validation harnesses
- [ ] Store expected values in impulses
- [ ] Annotate components with reasoning (metabob_annotate_component)
- [ ] Measure execution via impulses
- [ ] Commit with spec tag: `spec-{specificationName}-v1`

### For Activity Authors

When creating activities:
- [ ] Compose existing activities (trace-data-flow, trace-enforce-validate-loop)
- [ ] Don't reimplement tracing/enforcement logic
- [ ] Create impulses for measurements
- [ ] Include validation harness creation
- [ ] Use soft dependencies (no rigid coupling)
- [ ] Document activity composition patterns

### For System Architects

When designing features:
- [ ] Identify specifications to enforce
- [ ] Map specifications to validation strategies
- [ ] Design deterministic test harnesses
- [ ] Plan impulse structure for measurements
- [ ] Consider co-change patterns (CPG integration)
- [ ] Enable learning loop optimization

---

## Example: Full Feature Development with Loop

**User Request:** "Add rate limiting to API endpoints"

**Activity Execution:**
```typescript
// Step 1: Invoke the loop
activity({
  templateId: "trace-enforce-validate-loop",
  variables: {
    specificationName: "api-rate-limiting",
    specificationDescription: "API endpoints must enforce 100 requests per minute per user",
    expectedBehavior: "Middleware checks request count, returns 429 if exceeded, allows if under limit",
    validationStrategy: "Test harness: send 101 requests in 60s → 101st returns 429, wait 60s → request succeeds"
  },
  reason: "Enforce API rate limiting specification with deterministic validation"
})

// Outputs created:
// - impulse: trace-api-rate-limiting (current state, gaps)
// - impulse: enforcement-api-rate-limiting (middleware code added)
// - impulse: harness-api-rate-limiting (rate limit test harness)
// - impulse: validation-results-api-rate-limiting (all tests pass)
// - impulse: conflict-analysis-api-rate-limiting (no conflicts)
// - impulse: ripple-api-rate-limiting (applied to all endpoints)
// - git commit: spec-api-rate-limiting-v1

// Step 2: Verify rate limiting applied everywhere
activity({
  templateId: "propagate-change-through-flow",
  variables: {
    changeDescription: "Rate limiting middleware",
    affectedFiles: ["src/middleware/rate-limit.ts", "src/app.ts"]
  },
  reason: "Ensure rate limiting applied to all API routes"
})

// Step 3: Test in real scenario
// Load harness and run validation
const harness = impulse_load({ id: "harness-api-rate-limiting" })
const results = impulse_load({ id: "validation-results-api-rate-limiting" })

// All tests pass → Feature complete
// Harness available for future regression testing (deterministic!)
```

**Measurements collected:**
- **Informational state:** 6 impulses (~17K tokens)
- **Functional state:** Activity metrics (cost, duration, tools used)
- **Validation:** Deterministic harness (reusable forever)
- **Learning:** Data fed to boredom system for optimization

**Future executions:**
- **Regression testing:** Run harness (no LLM needed)
- **Template optimization:** Boredom system improves loop for rate limiting patterns
- **Cost reduction:** Eventually zero LLM calls for similar features

---

## Conclusion

**Universal loop usage = foundation for self-improving, deterministic development**

**Core principles:**
1. ✅ **Use loop for everything** - Trace, enforce, validate all code changes
2. ✅ **Reuse existing activities** - Compose, don't recreate
3. ✅ **Measure everything** - Impulses (informational) + metrics (functional)
4. ✅ **Learn continuously** - Boredom system optimizes via measurements
5. ✅ **Path to determinism** - Reduce LLM calls over time

**What this enables:**
- Self-verifying code (harnesses prevent regressions)
- Cost-efficient development (activities get cheaper over time)
- Deterministic execution (well-practiced activities need zero LLM calls)
- Automated optimization (boredom system improves templates)
- Library of patterns (activities become reusable components)

**Next steps:**
1. Use `trace-enforce-validate-loop` for all development tasks
2. Create validation harnesses for every specification
3. Measure execution via impulses
4. Feed data to learning loop
5. Watch activities evolve toward deterministic execution

---

**Status:** ✅ Architectural foundation established  
**Adoption:** Start using loop immediately for all development  
**Goal:** 80%+ of development tasks use loop within 30 days
