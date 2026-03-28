# Functional State Loop - Quick Start Guide

**Status:** ✅ Template Registered (`trace-enforce-validate-loop`)

---

## What You've Built

A **self-verifying evolutionary system** that bridges **instructional state** (requirements, specs, rules) with **functional state** (code implementation) through a 7-phase activity loop.

### The Loop:

```
1. TRACE      → Understand current implementation of a spec/rule/flow
2. ENFORCE    → Apply code mutations to close gaps
3. VALIDATE   → Create external harness (impulse-based, LLM-independent)
4. RUN        → Execute harness and collect PASS/FAIL results
5. AGGREGATE  → Detect conflicts with other specifications
6. RIPPLE     → Propagate changes across all affected components
7. COMMIT     → Create functional state transition commit with full docs
```

---

## Quick Example: Execution Logging Specification

Let's enforce a simple requirement: **"All activity executions must log start time"**

### Step 1: Run the Activity

```bash
activity trace-enforce-validate-loop \
  specificationName="execution-logging" \
  specificationDescription="All activity executions must log their start time for debugging and monitoring purposes" \
  expectedBehavior="Activity execution logs contain a startedAt timestamp in ISO 8601 format" \
  validationStrategy="Run an activity, parse logs, verify startedAt field exists and is valid ISO 8601 timestamp"
```

### Step 2: What Happens

**Phase 1 - TRACE:**
- Uses `trace-data-flow-single-feature` to map activity execution flow
- Identifies components: ActivityTool → ActivityExecutor → TaskRunner
- Documents gap: "No startedAt logging in ActivityExecutor.run()"
- Creates impulse: `trace-execution-logging` (5000 tokens)

**Phase 2 - ENFORCE:**
- Adds `const startedAt = new Date().toISOString()` in ActivityExecutor.run()
- Adds log statement: `logger.info({startedAt, activityId})`
- Uses `metabob_analyze_change_impact` to check blast radius
- Annotates component with WHY: "Logging for debugging and audit trail"
- Creates impulse: `enforcement-execution-logging` (3000 tokens)

**Phase 3 - CREATE HARNESS:**
- Creates file: `tests/validation-harnesses/execution-logging-harness.ts`
- Harness code:
  ```typescript
  export async function runValidation(input: {activityId: string}) {
    const logs = await captureLogs(() => {
      return ActivityExecutor.run(input.activityId);
    });
    
    const startedAtLog = logs.find(l => l.startedAt);
    const expected = "ISO 8601 timestamp";
    const actual = startedAtLog?.startedAt 
      ? (isValidISO8601(startedAtLog.startedAt) ? "ISO 8601 timestamp" : "Invalid")
      : "Missing";
    
    return {
      pass: actual === expected,
      actual,
      expected
    };
  }
  ```
- Stores test cases as impulses:
  - `validation-execution-logging-case-1`: {activityId: "test-1"}
  - `validation-execution-logging-case-2`: {activityId: "test-2"}
- Creates impulse: `harness-execution-logging` (2000 tokens)

**Phase 4 - RUN VALIDATION:**
- Executes harness with all test cases
- Results: PASS (2/2)
- Creates impulse: `validation-results-execution-logging` (2000 tokens)

**Phase 5 - AGGREGATE CONFLICTS:**
- Searches for other specifications: `validation-results-*` impulses
- Checks if execution-logging conflicts with existing specs
- No conflicts found (first spec!)
- Creates impulse: `conflict-analysis-execution-logging` (3000 tokens)

**Phase 6 - RIPPLE CHANGES:**
- Checks related components with `metabob_suggest_related_changes`
- Finds: TaskRunner.execute also needs logging (co-change pattern)
- Adds startedAt logging to TaskRunner too
- Re-runs validation harness: PASS
- Creates impulse: `ripple-execution-logging` (3000 tokens)

**Phase 7 - COMMIT:**
- Creates comprehensive commit:
  ```
  feat(execution-logging): Add start time logging to activity execution

  Instructional State Change:
  - Requirement: All activity executions must log start time
  - Specification: execution-logging v1

  Functional State Change:
  - Added startedAt logging in ActivityExecutor.run()
  - Added startedAt logging in TaskRunner.execute()
  - Logs in ISO 8601 format for consistency

  Validation:
  - Harness: tests/validation-harnesses/execution-logging-harness.ts
  - Test Cases: 2 (all PASS)
  - External verification: deterministic, LLM-independent

  Components Affected:
  - src/activity/ActivityExecutor.ts (main logging point)
  - src/activity/TaskRunner.ts (ripple change for consistency)
  - tests/validation-harnesses/execution-logging-harness.ts (NEW)

  Impulses Created:
  - trace-execution-logging
  - enforcement-execution-logging
  - harness-execution-logging
  - validation-results-execution-logging
  - conflict-analysis-execution-logging
  - ripple-execution-logging
  - final-execution-logging
  ```
- Tags commit: `spec-execution-logging-v1`
- Creates impulse: `final-execution-logging` (2000 tokens)

---

## Verification Without LLM

The magic is in Phase 3-4: **Validation harnesses are deterministic**

```typescript
// Run the harness anytime, anywhere, without LLM
const harness = loadImpulse("harness-execution-logging");
const testCase = loadImpulse("validation-execution-logging-case-1");

const result = await runValidation(testCase.input);
// result.pass === true (deterministic!)
```

**Benefits:**
- ✅ Fast: No LLM call needed
- ✅ Consistent: Same input → same output
- ✅ Portable: Works in CI/CD, testing, production monitoring
- ✅ Historical: Expected values preserved over time

---

## Advanced Example: Budget Validation with Conflicts

```bash
# First specification
activity trace-enforce-validate-loop \
  specificationName="budget-validation" \
  specificationDescription="Activities must not exceed specified budget limits to prevent runaway costs" \
  expectedBehavior="Throw BudgetExceededError if activity cost exceeds budget parameter" \
  validationStrategy="Run activity with budget=5, simulate cost=10, expect BudgetExceededError"

# Later, a conflicting specification
activity trace-enforce-validate-loop \
  specificationName="unrestricted-admin-execution" \
  specificationDescription="Admin users can execute activities without budget limits" \
  expectedBehavior="Admin activities bypass all resource constraints" \
  validationStrategy="Run activity with admin user, any budget, expect SUCCESS"
```

**What happens in Phase 5 (Aggregate Conflicts):**

```json
{
  "conflicts": [
    {
      "type": "CONTRADICTORY_REQUIREMENTS",
      "spec1": "budget-validation",
      "spec2": "unrestricted-admin-execution",
      "sharedComponent": "ActivityExecutor.execute",
      "description": "Budget validation conflicts with admin bypass requirement",
      "resolution": "Add role-based conditional: if (user.role !== 'admin') validateBudget()"
    }
  ]
}
```

**What happens in Phase 6 (Ripple Changes):**
- Implements resolution: Conditional budget validation
- Re-runs BOTH harnesses:
  - `harness-budget-validation`: PASS (non-admin users still validated)
  - `harness-unrestricted-admin-execution`: PASS (admin users bypass)
- Both specifications now coexist peacefully!

---

## Use Cases Beyond This Example

### 1. Data Validation Rules
```bash
activity trace-enforce-validate-loop \
  specificationName="email-validation" \
  specificationDescription="All user email inputs must be validated against RFC 5322" \
  expectedBehavior="Invalid emails rejected with EmailValidationError" \
  validationStrategy="Feed invalid email formats, expect rejection"
```

### 2. Security Requirements
```bash
activity trace-enforce-validate-loop \
  specificationName="auth-required-api" \
  specificationDescription="All API endpoints (except /health) require authentication" \
  expectedBehavior="Unauthenticated requests return 401 Unauthorized" \
  validationStrategy="Call protected endpoint without token, expect 401"
```

### 3. Performance Constraints
```bash
activity trace-enforce-validate-loop \
  specificationName="response-time-limit" \
  specificationDescription="API responses must complete within 500ms for p95" \
  expectedBehavior="95% of requests complete in under 500ms" \
  validationStrategy="Run 100 requests, measure latency, verify p95 < 500ms"
```

### 4. User Flows
```bash
activity trace-enforce-validate-loop \
  specificationName="user-signup-flow" \
  specificationDescription="Users must verify email before accessing features" \
  expectedBehavior="Unverified users see EmailVerificationRequired error on feature access" \
  validationStrategy="Create user without verification, access feature, expect error"
```

---

## Integration with Existing Architecture

### Combines With:
- **trace-data-flow-single-feature** (Phase 1: Trace)
- **CPG tools** (Phase 5-6: Impact analysis, conflict detection)
- **Impulse system** (All phases: Knowledge preservation)
- **Metabob** (All phases: Code quality, annotations)

### Extends:
- **RIPPLE_CHANGE_ARCHITECTURE.md** - This IS the implementation!
- **FUNCTIONAL_STATE_TRANSFORMATION_PARADIGM.md** - Bridges instructional ↔ functional state

---

## Continuous Verification

### CI/CD Integration

```yaml
# .github/workflows/verify-specifications.yml
name: Verify Specifications

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Load all validation harnesses
        run: |
          for harness in tests/validation-harnesses/*-harness.ts; do
            echo "Running $(basename $harness)"
            bun run $harness
          done
      
      - name: Check all results are PASS
        run: |
          if grep -r "FAIL" test-results/; then
            echo "❌ Specification regression detected"
            exit 1
          fi
          echo "✅ All specifications verified"
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run all validation harnesses
for impulse in validation-results-*; do
  spec=${impulse##validation-results-}
  harness=$(impulse load harness-$spec)
  
  echo "Verifying specification: $spec"
  result=$(run_harness $harness)
  
  if [ "$result" != "PASS" ]; then
    echo "❌ FAIL: $spec"
    echo "Your changes broke specification: $spec"
    echo "Fix the code or update the specification"
    exit 1
  fi
done

echo "✅ All specifications verified"
```

---

## Next Steps

### 1. **Try It Yourself**

Pick a simple requirement from your codebase and run the loop:

```bash
activity trace-enforce-validate-loop \
  specificationName="YOUR-SPEC-NAME" \
  specificationDescription="WHAT REQUIREMENT YOU WANT TO ENFORCE" \
  expectedBehavior="WHAT SHOULD HAPPEN" \
  validationStrategy="HOW TO VERIFY IT"
```

### 2. **Build a Specification Library**

As you add specifications, you're building a **living knowledge base**:

```
specs/
  ├── budget-validation/
  │   ├── harness.ts
  │   ├── test-cases/ (impulses)
  │   └── results/ (impulses)
  ├── auth-required-api/
  ├── email-validation/
  └── ... (grows over time)
```

### 3. **Watch for Conflicts**

The system will automatically detect when new specs conflict with existing ones. This is **proactive architecture enforcement** - conflicts caught BEFORE they cause bugs.

### 4. **Measure Evolution**

Track how your codebase evolves:
- Number of specifications enforced
- Conflict resolution patterns
- Functional state transitions over time
- Knowledge preservation (impulses created)

---

## Success Criteria

**You'll know this works when:**

1. ✅ **Requirements → Code pipeline is automated**
   - Write spec description
   - Run activity
   - Code automatically enforces spec

2. ✅ **Conflicts detected proactively**
   - New specs checked against existing ones
   - Conflicts resolved BEFORE merge
   - No contradictory implementations

3. ✅ **Validation is deterministic**
   - Harnesses run without LLM
   - Historical expected values preserved
   - CI/CD can verify continuously

4. ✅ **Knowledge preserved over time**
   - Every spec has impulses documenting WHY
   - Future changes reference historical context
   - Evolution is traceable

5. ✅ **Codebase evolves cleanly**
   - Changes ripple correctly
   - Informational + functional state synchronized
   - System complexity remains manageable

---

## Architecture Documents

For deeper understanding:

1. **FUNCTIONAL_STATE_LOOP_ARCHITECTURE.md** - Complete 7-phase breakdown with examples
2. **RIPPLE_CHANGE_ARCHITECTURE.md** - Ripple change patterns (Phase 6)
3. **FUNCTIONAL_STATE_TRANSFORMATION_PARADIGM.md** - Theoretical foundation
4. **INSTRUCTIONAL_TO_FUNCTIONAL_STATE_BRIDGE.md** - Instructional ↔ Functional state bridge

---

**You now have a self-verifying evolutionary system. Every requirement you express becomes enforced code, validated deterministically, with conflicts detected automatically. This is software evolution done right.** 🚀
