# Functional State Transformation Loop Architecture

**Vision:** Self-verifying evolutionary system that bridges **instructional state** (what we want) with **functional state** (what exists), using activities to trace, enforce, validate, aggregate conflicts, and ripple changes across the codebase.

---

## Core Concept: Instructional ↔ Functional State Bridge

### Traditional Development (Broken Bridge)

```
Instructional State                    Functional State
(Requirements, Specs)                  (Code Implementation)
        │                                     │
        │  ❌ Manual translation               │
        │  ❌ Implicit knowledge                │
        │  ❌ Drift over time                   │
        │                                     │
        ↓                                     ↓
   [Written down]                       [Written in code]
   
Problem: No automatic verification that code matches intent
```

### Functional State Loop (Connected Bridge)

```
Instructional State ←──────────────→ Functional State
(Requirements)       [Activity Loop]  (Code)
        │                                     │
        │  ✅ Trace actual implementation      │
        │  ✅ Enforce via code mutations       │
        │  ✅ Validate externally (impulses)   │
        │  ✅ Aggregate conflicts              │
        │  ✅ Ripple changes                   │
        │                                     │
        ↓                                     ↓
   [Specifications]  ←───[Harnesses]───→  [Implementation]
   
Solution: Continuous verification loop ensures alignment
```

---

## The 7-Phase Loop

### Phase 1: **Trace Specification**

**Goal:** Understand how a specification/rule/flow is CURRENTLY implemented

**Actions:**
1. Use `trace-data-flow-single-feature` to map current implementation
2. Identify all components involved
3. Compare CURRENT STATE vs DESIRED STATE
4. Document gaps

**Output:** Impulse containing trace analysis
- ID: `trace-{specificationName}`
- Type: templateDefinition
- Content: Component list, data flow, gaps
- Budget: 5000 tokens

**Example:**
```json
{
  "specificationName": "budget-validation",
  "components": [
    {
      "file": "src/activity/ActivityTool.ts",
      "component": "ActivityTool.execute",
      "currentBehavior": "No budget checking",
      "desiredBehavior": "Throw error if budget exceeded",
      "gap": "Add budget validation before execution"
    }
  ],
  "dataFlow": "ActivityTool → ActivityExecutor → TaskRunner → Activity.save"
}
```

---

### Phase 2: **Enforce Specification**

**Goal:** Apply code mutations to close gaps identified in Phase 1

**Actions:**
1. For each component with a gap:
   - Use `metabob_analyze_change_impact` BEFORE changing
   - Apply code mutation
   - Use `metabob_annotate_component` to document WHY
2. Ensure changes ripple through data flow:
   - Update schemas, transformations, validations
   - Propagate to all entry/exit points

**Output:** Impulse containing enforcement summary
- ID: `enforcement-{specificationName}`
- Type: memo
- Content: List of changes made with reasons
- Budget: 3000 tokens

**Example:**
```json
{
  "changesApplied": [
    {
      "file": "src/activity/ActivityTool.ts",
      "component": "ActivityTool.execute",
      "changeMade": "Added budget validation check before executor.run()",
      "reason": "Enforce budget-validation spec to prevent runaway costs",
      "impactAnalysis": "3 dependents, 0 breaking changes"
    }
  ]
}
```

---

### Phase 3: **Create Validation Harness**

**Goal:** Build external validation mechanism using impulses (NOT LLM-dependent)

**Key Insight:** By attaching validation to impulses, we can verify consistency WITHOUT needing an LLM to re-evaluate. Historical expected values enable deterministic verification.

**Actions:**
1. Create validation script that:
   - Loads application/component
   - Feeds test inputs
   - Captures actual outputs
   - Compares against expected outputs
   - Returns PASS/FAIL (deterministic)

2. Store expected values as impulses:
   - ID: `validation-{specificationName}-case-N`
   - Type: memo
   - Content: `{input: X, expectedOutput: Y}`

3. Create harness file:
   - File: `tests/validation-harnesses/{specificationName}-harness.ts`
   - Exports: `runValidation(input) => {pass: boolean, actual, expected}`

**Output:** Impulse pointing to harness
- ID: `harness-{specificationName}`
- Type: file
- Pointer: Harness file path
- Budget: 2000 tokens

**Example Harness:**
```typescript
// tests/validation-harnesses/budget-validation-harness.ts
export async function runValidation(input: {budget: number, cost: number}) {
  const activity = await ActivityTool.execute({
    templateId: "hello-world-minimal",
    variables: {testId: "test", name: "test"},
    budget: input.budget
  });
  
  const expected = input.cost > input.budget 
    ? "BudgetExceededError" 
    : "SUCCESS";
  
  const actual = activity.error?.name || "SUCCESS";
  
  return {
    pass: actual === expected,
    actual,
    expected
  };
}
```

**Expected Values Impulse:**
```json
// validation-budget-validation-case-1
{
  "input": {"budget": 5, "cost": 10},
  "expectedOutput": "BudgetExceededError"
}
```

---

### Phase 4: **Run Validation**

**Goal:** Execute validation harness and collect results

**Actions:**
1. Load harness impulse
2. Load all test case impulses
3. Execute harness for each test case
4. Compare actual vs expected
5. Create results impulse

**Output:** Impulse containing validation results
- ID: `validation-results-{specificationName}`
- Type: memo
- Content: PASS/FAIL per test case
- Budget: 2000 tokens

**Example:**
```json
{
  "validationResults": [
    {
      "testCase": "validation-budget-validation-case-1",
      "status": "PASS",
      "actual": "BudgetExceededError",
      "expected": "BudgetExceededError"
    }
  ],
  "overallStatus": "PASS"
}
```

---

### Phase 5: **Aggregate Conflicts**

**Goal:** Detect conflicts between multiple specifications

**Key Insight:** As we accumulate specifications across the codebase, we need to verify that new specifications don't contradict existing ones. This is where instructional state conflicts are discovered BEFORE they cause functional state issues.

**Actions:**
1. Load validation results for current spec
2. Search for OTHER specification results (all `validation-results-*` impulses)
3. Detect conflicts:
   - Contradictory requirements?
   - Shared components with different requirements?
   - Breaking changes to other specs?
4. Cross-reference with CPG:
   - `metabob_suggest_related_changes` - files affected by multiple specs
   - `metabob_analyze_change_impact` - overlapping dependencies

**Output:** Impulse containing conflict analysis
- ID: `conflict-analysis-{specificationName}`
- Type: memo
- Content: Conflict matrix and resolution recommendations
- Budget: 3000 tokens

**Example:**
```json
{
  "conflicts": [
    {
      "type": "CONTRADICTORY_REQUIREMENTS",
      "spec1": "budget-validation",
      "spec2": "unrestricted-admin-execution",
      "sharedComponent": "ActivityExecutor.execute",
      "description": "Budget validation conflicts with admin bypass requirement",
      "resolution": "Add role-based bypass logic: if (user.role !== 'admin') validateBudget()"
    }
  ],
  "sharedComponents": [
    {
      "component": "ActivityExecutor.execute",
      "affectedBySpecs": ["budget-validation", "unrestricted-admin-execution"],
      "recommendation": "Refactor to support conditional budget validation"
    }
  ]
}
```

---

### Phase 6: **Ripple Changes**

**Goal:** Propagate changes across all affected components to ensure functional state consistency

**Key Insight:** This is where **informational state transitions** (what we know) drive **functional state transitions** (what the code does). As changes ripple across the codebase, we maintain consistency of both states simultaneously.

**Actions:**
1. Load conflict analysis and enforcement summary
2. For each affected component:
   a. Use `metabob_analyze_change_impact` for blast radius
   b. Apply changes to maintain consistency across:
      - All entry points
      - All transformations
      - All validations
      - All exit points
   c. Update tests to cover ripple changes
   d. Annotate components with cross-spec context

3. Resolve conflicts (if any):
   - Implement resolution strategy from conflict analysis
   - Add conditional logic for conflicting requirements
   - Refactor shared components if needed

4. Re-run validation harnesses:
   - Execute harness for this spec → Verify PASS
   - Execute harnesses for conflicting specs → Verify all PASS
   - If any FAIL → Debug and iterate

**Output:** Impulse containing ripple summary
- ID: `ripple-{specificationName}`
- Type: memo
- Content: All components updated, validation status
- Budget: 3000 tokens

**Example:**
```json
{
  "componentsUpdated": [
    {
      "file": "src/activity/ActivityExecutor.ts",
      "component": "ActivityExecutor.run",
      "changeMade": "Added conditional budget check based on user role",
      "reason": "Ripple change to resolve conflict with unrestricted-admin-execution spec"
    }
  ],
  "validationStatus": {
    "thisSpec": "PASS",
    "conflictingSpecs": [
      {"spec": "unrestricted-admin-execution", "status": "PASS"}
    ]
  },
  "functionalStateTransition": {
    "before": "Budget validation not enforced",
    "after": "Budget validation enforced for non-admin users, bypassed for admins"
  }
}
```

---

### Phase 7: **Commit Functional State Transition**

**Goal:** Commit the complete instructional → functional state transition with comprehensive documentation

**Actions:**
1. Load all impulses created during workflow
2. Create comprehensive commit message:
   - **Instructional State Change**: What requirement is now enforced
   - **Functional State Change**: What code changed to enforce it
   - **Validation**: How it's verified (harness reference)
   - **Conflicts Resolved**: Any conflicts addressed
   - **Components Affected**: List of modified components
   - **Ripple Impact**: Cross-component changes made

3. Create git commit with:
   - All modified files
   - All new test harnesses
   - Updated flow documentation

4. Tag commit with specification metadata:
   ```bash
   git tag -a "spec-{specificationName}-v1" -m "Specification enforcement: {specificationName}"
   ```

**Output:** Impulse containing final summary
- ID: `final-{specificationName}`
- Type: memo
- Content: Complete transformation summary
- Budget: 2000 tokens

**Example Commit Message:**
```
feat(budget-validation): Enforce activity budget limits

Instructional State Change:
- Requirement: Activities must not exceed specified budget limits
- Specification: budget-validation v1

Functional State Change:
- Added budget validation in ActivityTool.execute
- Added BudgetExceededError error type
- Updated ActivityExecutor to track budget usage
- Added conditional bypass for admin users

Validation:
- Harness: tests/validation-harnesses/budget-validation-harness.ts
- Test Cases: 5 (all PASS)
- External verification: deterministic, LLM-independent

Conflicts Resolved:
- Conflict with unrestricted-admin-execution spec
- Resolution: Role-based conditional validation

Components Affected:
- src/activity/ActivityTool.ts (entry point)
- src/activity/ActivityExecutor.ts (execution logic)
- src/activity/errors.ts (error types)
- tests/validation-harnesses/budget-validation-harness.ts (NEW)

Ripple Impact:
- 3 components updated for consistency
- 5 validation test cases added
- Flow documentation regenerated

Impulses Created:
- trace-budget-validation
- enforcement-budget-validation
- harness-budget-validation
- validation-results-budget-validation
- conflict-analysis-budget-validation
- ripple-budget-validation
- final-budget-validation
```

---

## Why This Architecture Works

### 1. **Deterministic Validation (No LLM Required)**

By storing expected values as impulses, we can verify specifications WITHOUT needing an LLM:

```typescript
// Historical expected value (impulse)
const expected = loadImpulse("validation-budget-validation-case-1");

// Run actual code
const actual = await runValidation(expected.input);

// Deterministic comparison
const pass = actual.output === expected.expectedOutput; // true/false
```

**Benefit:** Fast, consistent, repeatable verification across time and environments.

---

### 2. **Conflict Detection via Aggregation**

As specifications accumulate, the system detects conflicts BEFORE they cause bugs:

```
Spec 1: "All activities must validate budget"
Spec 2: "Admin activities bypass all limits"

Aggregation detects: CONFLICT on ActivityExecutor.execute
Resolution: Conditional validation based on user role
```

**Benefit:** Instructional state conflicts discovered and resolved systematically.

---

### 3. **Informational + Functional State Transition**

Every change makes TWO synchronized transitions:

**Informational State:**
- Documentation updated (flow diagrams)
- Annotations added (component context)
- Impulses created (validation harnesses)
- Commit messages (why + what)

**Functional State:**
- Code mutated (implementation)
- Tests added (verification)
- Ripple changes applied (consistency)
- Harnesses created (external validation)

**Benefit:** Code and knowledge evolve together, no drift.

---

### 4. **Ripple Change Management**

Changes automatically propagate through data flows:

```
Entry Point → Validation → Transformation → Business Logic → Persistence → Response
    ↓             ↓              ↓                 ↓              ↓           ↓
 [UPDATE]      [UPDATE]       [UPDATE]          [UPDATE]       [UPDATE]   [UPDATE]
```

**Benefit:** No forgotten components, complete consistency.

---

## Example Workflow: Add Budget Validation

### Command:
```bash
activity trace-enforce-validate-loop \
  specificationName="budget-validation" \
  specificationDescription="Activities must not exceed specified budget limits to prevent runaway costs" \
  expectedBehavior="Throw BudgetExceededError if activity cost exceeds budget parameter" \
  validationStrategy="Run activity with budget=5, simulate cost=10, expect BudgetExceededError"
```

### What Happens:

**Phase 1 - Trace:**
- Maps current activity execution flow
- Identifies: No budget checking exists
- Creates: `trace-budget-validation` impulse

**Phase 2 - Enforce:**
- Adds budget validation to ActivityTool.execute
- Adds BudgetExceededError error type
- Creates: `enforcement-budget-validation` impulse

**Phase 3 - Create Harness:**
- Creates: `tests/validation-harnesses/budget-validation-harness.ts`
- Stores expected values: `validation-budget-validation-case-1` through `case-5`
- Creates: `harness-budget-validation` impulse

**Phase 4 - Run Validation:**
- Executes harness with all test cases
- All PASS
- Creates: `validation-results-budget-validation` impulse

**Phase 5 - Aggregate Conflicts:**
- Finds conflict with `unrestricted-admin-execution` spec
- Recommends: Role-based bypass
- Creates: `conflict-analysis-budget-validation` impulse

**Phase 6 - Ripple Changes:**
- Updates ActivityExecutor to add conditional validation
- Re-runs both harnesses → Both PASS
- Creates: `ripple-budget-validation` impulse

**Phase 7 - Commit:**
- Creates comprehensive commit with all changes
- Tags: `spec-budget-validation-v1`
- Creates: `final-budget-validation` impulse

### Result:
- ✅ Specification enforced across all components
- ✅ Validation harness ensures consistency over time
- ✅ Conflicts detected and resolved
- ✅ Complete instructional → functional state bridge
- ✅ No drift possible (harness validates continuously)

---

## Advanced Patterns

### Pattern 1: **Continuous Verification**

Run all harnesses periodically to ensure specifications remain enforced:

```bash
# CI/CD pipeline
for spec in validation-results-*; do
  harness=$(impulse load harness-${spec##validation-results-})
  result=$(run_harness $harness)
  if [ "$result" != "PASS" ]; then
    echo "REGRESSION: $spec failed"
    exit 1
  fi
done
```

---

### Pattern 2: **Specification Evolution**

When requirements change, re-run the loop:

```bash
activity trace-enforce-validate-loop \
  specificationName="budget-validation" \  # Same spec
  specificationDescription="Activities must validate budget OR have admin override" \  # Updated
  expectedBehavior="Throw BudgetExceededError unless user.role === 'admin'" \  # New behavior
  validationStrategy="Test both user roles"
```

System will:
1. Detect changes in specification
2. Update code to match new requirement
3. Update harnesses with new test cases
4. Re-validate all related specs
5. Commit as `spec-budget-validation-v2`

---

### Pattern 3: **Cross-Specification Inference**

As specifications accumulate, the system can infer patterns:

```
Specs: budget-validation, rate-limiting, quota-enforcement
Pattern Detected: All are "resource-constraint" specs
Inference: Extract common ResourceValidator component
Refactor: All specs use shared validator with different configs
```

---

## Success Metrics

**We'll know this works when:**

1. ✅ **Zero drift** between requirements and code
   - Every spec has a harness
   - All harnesses PASS continuously
   - CI fails on harness regression

2. ✅ **Conflicts detected proactively**
   - New specs checked against ALL existing specs
   - Conflicts resolved before code merged
   - No contradictory implementations

3. ✅ **Knowledge preserved over time**
   - Impulses capture WHY decisions were made
   - Future changes reference historical context
   - Specifications evolve, not replaced

4. ✅ **Evolutionary codebase**
   - Changes ripple correctly across components
   - Informational + functional state synchronized
   - System complexity manageable at scale

---

## Next Steps

### Immediate: Test the Loop

1. **Choose a simple spec:** "Activity must log execution start time"
2. **Run the loop:**
   ```bash
   activity trace-enforce-validate-loop \
     specificationName="execution-logging" \
     specificationDescription="All activity executions must log start time for debugging" \
     expectedBehavior="Activity log contains startedAt timestamp" \
     validationStrategy="Run activity, check logs for timestamp"
   ```
3. **Verify all 7 phases complete**
4. **Run harness manually** to verify deterministic validation

### Medium Term: Build Specification Library

- Budget validation
- Rate limiting
- Authentication requirements
- Data validation rules
- Performance constraints

### Long Term: Self-Evolving System

- Specifications drive code evolution
- Conflicts auto-detected and resolved
- Knowledge accumulated in impulses
- System adapts to new requirements while maintaining consistency

---

**This is the future of software evolution: Instructional and functional state moving together, verified continuously, conflicts resolved systematically, knowledge preserved eternally.**
