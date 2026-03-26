# Activity-Centric Execution Model: Functional State Validation

**Date**: 2026-02-24  
**Vision**: Main sessions orchestrate activity sequences until functional state is verified valid  
**Core Principle**: **Never trust instructional state or generated content - validate functional state**

---

## Executive Summary

The **Activity-Centric Execution Model** shifts OpenCode from "agent writes code" to "agent orchestrates activities that produce validated functional state."

### Key Insights

1. **Instructional state is untrustworthy**: LLM-generated explanations, plans, and content can be wrong
2. **Functional state is verifiable**: Code execution, test results, validation output are ground truth
3. **Activities bridge the gap**: Activities transform instructional intent into validated functional state
4. **Main session orchestrates**: Main session is a sequence of activity executions + validation checks

### The Problem with Traditional Approach

```
Traditional Flow (BROKEN):
┌────────────────────────────────────────────┐
│ User: "Add feature X"                      │
└────────────────────────────────────────────┘
                ↓
┌────────────────────────────────────────────┐
│ Agent: "I'll implement feature X..."       │
│ - Writes code                              │
│ - Explains what it did                     │
│ - Claims success                           │
└────────────────────────────────────────────┘
                ↓
      ❌ TRUST PROBLEM:
      - Did agent actually implement correctly?
      - Does code work?
      - Are explanations accurate?
      - Is functional state valid?
```

**Problem**: We're trusting **instructional state** (agent's explanation) without verifying **functional state** (code actually works).

### The Activity-Centric Solution

```
Activity-Centric Flow (VALIDATED):
┌────────────────────────────────────────────┐
│ User: "Add feature X"                      │
└────────────────────────────────────────────┘
                ↓
┌────────────────────────────────────────────┐
│ Main Session (Orchestrator)                │
│ 1. Execute: add-feature-complete           │
│ 2. Validate: Tests pass? YES ✓             │
│ 3. Execute: commit-organized-changes       │
│ 4. Validate: Commit created? YES ✓         │
│ 5. DONE: Functional state validated        │
└────────────────────────────────────────────┘
                ↓
      ✅ VERIFICATION:
      - Activities produce artifacts (code, tests, commits)
      - Validation harnesses verify outputs
      - Functional state checked at each step
      - Only proceed if validation passes
```

**Solution**: Main session orchestrates activities and validates functional state at each step.

---

## Core Architecture: Main Session as Activity Orchestrator

### Main Session Responsibilities

The main session does **NOT** write code. It orchestrates activities and validates outputs.

```typescript
MainSession {
  role: "orchestrator",
  responsibilities: [
    "Understand user intent",
    "Select appropriate activities",
    "Execute activities in sequence",
    "Validate functional state after each activity",
    "Retry/recover from failures",
    "Report verified results to user"
  ],
  forbidden: [
    "Write code directly",
    "Trust instructional state",
    "Assume success without validation",
    "Skip functional state checks"
  ]
}
```

### Activity Responsibilities

Activities produce **validated functional state**.

```typescript
Activity {
  inputs: {
    instructionalState: "What user wants",
    context: "Files, issues, requirements"
  },
  process: [
    "Execute tasks (subagents write code)",
    "Run validation commands",
    "Collect evidence (what was actually done)",
    "Verify functional state"
  ],
  outputs: {
    functionalState: "Code, tests, commits (actual artifacts)",
    validationEvidence: "Test results, lint output, etc.",
    correctnessVerdict: "Confidence that activity succeeded"
  }
}
```

---

## The Trust Boundary

### What We Trust (Functional State)

✅ **Test results**: Pass/fail is ground truth  
✅ **Compilation output**: TypeScript errors are real  
✅ **Linter output**: eslint errors are real  
✅ **Git status**: Files changed/committed are real  
✅ **Command exit codes**: 0 = success, non-zero = failure  
✅ **File existence**: File exists or doesn't  

**Why**: These are **external systems** that don't lie. They're deterministic and verifiable.

### What We Don't Trust (Instructional State)

❌ **LLM explanations**: "I implemented feature X" (might be wrong)  
❌ **Agent claims**: "Tests pass" (verify with actual test run)  
❌ **Code comments**: "This function does Y" (might be outdated)  
❌ **Documentation**: README says one thing, code does another  
❌ **Activity success claims**: Trust validation evidence, not status  

**Why**: These are **generated content** that can be wrong, outdated, or hallucinated.

---

## Validation Strategy: Functional State at Every Step

### Validation Levels

**Level 1: Activity Validation (Built-in)**

Every activity has validation commands that check functional state:

```json
{
  "tasks": [
    {
      "id": "task-1",
      "description": "Implement feature",
      "validation": {
        "commands": [
          { "command": "npm run typecheck", "description": "TypeScript compilation" },
          { "command": "npm test -- feature.test.ts", "description": "Feature tests" }
        ]
      }
    }
  ]
}
```

**Activity validation evidence**:
```typescript
activity.validationEvidence = {
  executed: true,
  timestamp: 1708819200000,
  overallPassed: true,
  commands: [
    {
      command: "npm run typecheck",
      exitCode: 0,
      stdout: "tsc: No errors",
      passed: true
    },
    {
      command: "npm test -- feature.test.ts",
      exitCode: 0,
      stdout: "5 tests passed",
      passed: true
    }
  ]
}
```

**Level 2: Correctness Verification (Post-activity)**

After activity completes, compute correctness verdict from evidence:

```typescript
const verdict = computeCorrectnessVerdict(activity)

verdict = {
  verdict: "correct",
  confidence: 0.95,
  issues: [
    // No critical issues
  ]
}
```

**Checks performed**:
- Were agent sessions spawned? (work was done)
- Were tools called? (actions taken)
- Were files changed? (functional state modified)
- Did validation commands pass? (outputs valid)
- Were commits made? (changes persisted)

**Level 3: External Validation (Harnesses)**

For critical specifications, create validation harnesses:

```typescript
// tests/validation-harnesses/budget-validation-harness.ts
export async function runValidation(input: {budget: number, cost: number}) {
  // Run actual code with test input
  const activity = await ActivityTool.execute({
    templateId: "hello-world-minimal",
    variables: {testId: "test"},
    budget: input.budget
  })
  
  // Check against expected output
  const expected = input.cost > input.budget 
    ? "BudgetExceededError" 
    : "SUCCESS"
  
  const actual = activity.error?.name || "SUCCESS"
  
  return {
    pass: actual === expected,
    actual,
    expected
  }
}
```

**Benefits**:
- Deterministic: No LLM needed for verification
- Repeatable: Same input → same output
- Historical: Can verify past functional states
- External: Independent of instructional state

---

## Main Session Flow: Activity Orchestration

### Pattern 1: Simple Feature Addition

**User Request**: "Add user profile endpoint"

**Main Session Execution**:
```
1. Analyze Intent (memory agent)
   ↓
   Impulses: file:src/api/users.ts, metabob:priority-issues
   
2. Execute Activity: add-feature-complete
   Variables: {
     featureName: "user profile endpoint",
     files: ["src/api/users.ts", "src/types/user.ts"],
     description: "GET /api/users/:id endpoint"
   }
   ↓
   Activity Tasks:
   - Task 1: Implement endpoint
   - Task 2: Add tests
   - Task 3: Run validation (npm test, typecheck)
   ↓
   Validation Evidence:
   - Tests: 8 passed ✓
   - TypeScript: No errors ✓
   - Files changed: 2 ✓
   
3. Verify Correctness
   computeCorrectnessVerdict(activity)
   ↓
   Verdict: "correct" (confidence: 0.92)
   
4. Execute Activity: commit-organized-changes
   Variables: { message: "Add user profile endpoint" }
   ↓
   Validation Evidence:
   - Commit created: abc123 ✓
   - Files in commit: 2 ✓
   
5. Report to User
   "✅ Feature added and committed successfully
    - Endpoint: GET /api/users/:id
    - Tests: 8 passed
    - Commit: abc123"
```

**Key Points**:
- Main session never wrote code
- Activities produced functional state (code + tests)
- Validation evidence verified outputs
- User gets verified results, not claims

### Pattern 2: Bug Fix with Validation

**User Request**: "Fix TypeError in auth.ts line 42"

**Main Session Execution**:
```
1. Analyze Intent (memory agent)
   ↓
   Impulses: file:src/auth.ts, file:test/auth.test.ts
   
2. Execute Activity: fix-bug-complete
   Variables: {
     bugDescription: "TypeError at line 42",
     files: ["src/auth.ts"]
   }
   ↓
   Activity Tasks:
   - Task 1: Analyze bug root cause
   - Task 2: Implement fix
   - Task 3: Verify tests pass
   - Task 4: Run validation
   ↓
   Validation Evidence:
   - Tests: 12 passed ✓
   - TypeScript: No errors ✓
   - Linter: No errors ✓
   
3. Verify Correctness
   computeCorrectnessVerdict(activity)
   ↓
   Verdict: "correct" (confidence: 0.95)
   Issues: []
   
4. Run External Validation Harness (if exists)
   harness = loadImpulse("harness-auth-validation")
   result = runValidation(harness)
   ↓
   Result: PASS ✓
   
5. Execute Activity: commit-organized-changes
   Variables: { message: "Fix TypeError in auth validation" }
   ↓
   Commit created: def456 ✓
   
6. Report to User
   "✅ Bug fixed and validated
    - Tests: 12 passed
    - External validation: PASS
    - Commit: def456"
```

**Key Points**:
- Bug fix validated with tests AND external harness
- Functional state verified (tests actually pass)
- Commit only made after validation
- User confident fix actually works

### Pattern 3: Specification Enforcement

**User Request**: "Enforce budget validation on all activities"

**Main Session Execution**:
```
1. Execute Activity: trace-enforce-validate-loop
   Variables: {
     specificationName: "budget-validation",
     expectedBehavior: "Throw BudgetExceededError if cost > budget"
   }
   ↓
   Activity Phases:
   - Phase 1: Trace current implementation
   - Phase 2: Enforce specification (mutate code)
   - Phase 3: Create validation harness
   - Phase 4: Run validation
   - Phase 5: Aggregate conflicts
   - Phase 6: Ripple changes
   - Phase 7: Commit functional state transition
   ↓
   Validation Evidence:
   - Harness: budget-validation-harness.ts created ✓
   - Test cases: 5 created ✓
   - Harness results: 5/5 PASS ✓
   - Conflicts: 1 detected, resolved ✓
   - Ripple changes: 3 components updated ✓
   
2. Verify Correctness
   computeCorrectnessVerdict(activity)
   ↓
   Verdict: "correct" (confidence: 0.98)
   
3. Verify Harness Deterministically
   for each test case:
     result = runValidation(testCase)
     assert(result.pass === true)
   ↓
   All test cases: PASS ✓
   
4. Report to User
   "✅ Specification enforced and validated
    - Functional state: Budget validation active
    - Harness: 5/5 test cases pass
    - Conflicts resolved: 1
    - Commit: ghi789
    - Continuous verification: Enabled"
```

**Key Points**:
- Specification enforcement is functional state change
- External harness enables deterministic verification
- Conflicts detected and resolved before commit
- Future regressions caught by harness

---

## Activity Composition Patterns

### Pattern 1: Sequential Activities

Activities execute in sequence, each validating before proceeding:

```
Activity 1: implement-feature
  ↓ (validate: tests pass)
Activity 2: add-documentation  
  ↓ (validate: docs build)
Activity 3: commit-changes
  ↓ (validate: commit created)
DONE (all functional state validated)
```

**Main Session Code**:
```typescript
async function orchestrateFeature(featureName: string) {
  // Activity 1: Implement
  const impl = await activity({
    templateId: "add-feature-complete",
    variables: { featureName, ... }
  })
  
  // Validate functional state
  const verdict1 = computeCorrectnessVerdict(impl.activity)
  if (verdict1.verdict !== "correct") {
    throw new Error("Feature implementation failed validation")
  }
  
  // Activity 2: Document (using impl outputs)
  const docs = await activity({
    templateId: "add-documentation",
    variables: { 
      files: impl.activity.workArtifacts.filesChanged,
      ...
    }
  })
  
  // Validate functional state
  const verdict2 = computeCorrectnessVerdict(docs.activity)
  if (verdict2.verdict !== "correct") {
    throw new Error("Documentation failed validation")
  }
  
  // Activity 3: Commit
  const commit = await activity({
    templateId: "commit-organized-changes",
    variables: { message: `Add ${featureName}` }
  })
  
  // Validate commit created
  assert(commit.activity.workArtifacts.commitsMade.length > 0)
  
  return {
    success: true,
    validated: true,
    commits: commit.activity.workArtifacts.commitsMade
  }
}
```

### Pattern 2: Conditional Activities

Activities execute conditionally based on validation results:

```
Activity 1: attempt-fix
  ↓
  Validate: tests pass?
  ├─ YES → commit-changes (DONE)
  └─ NO → debug-and-retry
           ↓
           Validate: tests pass?
           ├─ YES → commit-changes (DONE)
           └─ NO → escalate-to-human
```

**Main Session Code**:
```typescript
async function orchestrateBugFix(bugDescription: string) {
  // Attempt 1: Fix bug
  const fix = await activity({
    templateId: "fix-bug-complete",
    variables: { bugDescription }
  })
  
  // Validate
  const verdict = computeCorrectnessVerdict(fix.activity)
  
  if (verdict.verdict === "correct") {
    // Tests pass, commit
    const commit = await activity({
      templateId: "commit-organized-changes",
      variables: { message: `Fix: ${bugDescription}` }
    })
    return { success: true, attempts: 1 }
  }
  
  // Tests failed, debug and retry
  const debug = await activity({
    templateId: "debug-test-failures",
    variables: {
      testOutput: fix.activity.validationEvidence.commands
    }
  })
  
  const retry = await activity({
    templateId: "fix-bug-complete",
    variables: { 
      bugDescription,
      debugInfo: debug.output
    }
  })
  
  const verdict2 = computeCorrectnessVerdict(retry.activity)
  
  if (verdict2.verdict === "correct") {
    const commit = await activity({
      templateId: "commit-organized-changes",
      variables: { message: `Fix: ${bugDescription} (retry)` }
    })
    return { success: true, attempts: 2 }
  }
  
  // Still failing, escalate
  return {
    success: false,
    reason: "Tests still failing after retry",
    evidence: retry.activity.validationEvidence
  }
}
```

### Pattern 3: Parallel Activities (Independent Work)

Activities that don't depend on each other execute in parallel:

```
Activity 1: add-frontend-feature ──┐
                                   ├──> commit-all-changes
Activity 2: add-backend-feature ───┘
                                   ↑
                         (both validated)
```

**Main Session Code**:
```typescript
async function orchestrateFullStackFeature(featureName: string) {
  // Execute frontend and backend in parallel
  const [frontend, backend] = await Promise.all([
    activity({
      templateId: "add-feature-complete",
      variables: { 
        featureName: `${featureName} frontend`,
        files: ["src/components/..."]
      }
    }),
    activity({
      templateId: "add-feature-complete",
      variables: { 
        featureName: `${featureName} backend`,
        files: ["src/api/..."]
      }
    })
  ])
  
  // Validate both
  const verdict1 = computeCorrectnessVerdict(frontend.activity)
  const verdict2 = computeCorrectnessVerdict(backend.activity)
  
  if (verdict1.verdict !== "correct" || verdict2.verdict !== "correct") {
    throw new Error("One or both activities failed validation")
  }
  
  // Both validated, commit together
  const commit = await activity({
    templateId: "commit-organized-changes",
    variables: {
      message: `Add ${featureName} (frontend + backend)`,
      files: [
        ...frontend.activity.workArtifacts.filesChanged,
        ...backend.activity.workArtifacts.filesChanged
      ]
    }
  })
  
  return {
    success: true,
    validated: true,
    commits: commit.activity.workArtifacts.commitsMade
  }
}
```

---

## Validation Evidence Schema

### Activity.ValidationEvidence

```typescript
interface ValidationEvidence {
  executed: boolean
  timestamp: number
  overallPassed: boolean
  commands: Array<{
    command: string
    description: string
    exitCode: number
    stdout: string
    stderr: string
    duration: number
    passed: boolean
  }>
}
```

### Activity.ExecutionEvidence

```typescript
interface ExecutionEvidence {
  sessionsSpawned: string[]
  toolCalls: Array<{
    tool: string
    input: Record<string, unknown>
    output: unknown
    timestamp: number
  }>
  duration: number
  tokenUsage: {
    input: number
    output: number
    cache: number
  }
}
```

### Activity.WorkArtifacts

```typescript
interface WorkArtifacts {
  filesChanged: string[]
  filesCreated: string[]
  filesDeleted: string[]
  commitsMade: Array<{
    hash: string
    message: string
    files: string[]
  }>
}
```

### Activity.CorrectnessVerdict

```typescript
interface CorrectnessVerdict {
  computed: boolean
  verdict: "correct" | "suspicious" | "incorrect" | "unknown"
  confidence: number  // 0-1
  issues: Array<{
    severity: "critical" | "warning" | "info"
    category: string
    message: string
  }>
}
```

---

## Main Session Prompt Engineering

### System Prompt for Activity-Centric Mode

```
You are Activity Mode - the unified implementation agent.

CORE PRINCIPLE: You orchestrate activities and validate functional state.
You do NOT write code directly. You execute activities that produce validated code.

YOUR WORKFLOW:
1. Understand user intent
2. Search for relevant activity templates
3. Execute activity with appropriate variables
4. Validate functional state from activity outputs
5. If validation fails: retry, debug, or escalate
6. If validation passes: proceed to next activity
7. Report validated results to user

VALIDATION STRATEGY:
- Trust functional state (test results, compilation output, file changes)
- Don't trust instructional state (LLM explanations, claims, documentation)
- Use activity.validationEvidence to verify outputs
- Use computeCorrectnessVerdict() for confidence assessment
- Only proceed when functional state is validated

FORBIDDEN:
- ❌ Write code directly (use activities)
- ❌ Trust activity success without validation
- ❌ Skip correctness verification
- ❌ Assume tests pass without checking evidence
- ❌ Commit without validated functional state

ACTIVITY SELECTION:
- "add feature" → add-feature-complete
- "fix bug" → fix-bug-complete
- "refactor" → refactor-with-tests
- "enforce spec" → trace-enforce-validate-loop
- "commit changes" → commit-organized-changes

VALIDATION CHECKLIST (per activity):
✓ Activity completed without errors
✓ Validation commands ran (validationEvidence.executed)
✓ Validation commands passed (validationEvidence.overallPassed)
✓ Files changed (workArtifacts.filesChanged.length > 0)
✓ Correctness verdict computed (verdict === "correct")
✓ Confidence acceptable (confidence >= 0.8)

If any check fails: investigate, retry, or escalate.
```

### Example Main Session Interaction

**User**: "Add a REST endpoint for user profiles"

**Activity Mode (Main Session)**:
```
I'll add the user profile endpoint using the add-feature-complete activity.

[Executing activity: add-feature-complete]
Variables:
- featureName: "user profile endpoint"
- files: ["src/api/users.ts", "src/types/user.ts"]
- description: "GET /api/users/:id endpoint"

[Activity completed]

[Validating functional state...]
✓ Validation executed: true
✓ Tests passed: 8/8 ✓
✓ TypeScript compiled: No errors ✓
✓ Files changed: 2 files
✓ Correctness verdict: "correct" (confidence: 0.92)

[Functional state validated successfully]

[Executing activity: commit-organized-changes]
Variables:
- message: "Add user profile endpoint with tests"

[Activity completed]

✓ Commit created: abc123def456
✓ Files in commit: 2

[Reporting to user]

✅ User profile endpoint added and validated

Functional State:
- Endpoint: GET /api/users/:id
- Tests: 8 passed
- Files: src/api/users.ts, src/types/user.ts
- Commit: abc123def456

Validation Evidence:
- All tests pass ✓
- TypeScript compilation clean ✓
- Correctness confidence: 92%

The functional state is verified and committed.
```

**Key Points**:
- Main session orchestrated 2 activities
- Validated functional state after each activity
- Reported verified results (not claims)
- User confident endpoint actually works

---

## Migration Path: From Direct Execution to Activity-Centric

### Phase 1: Recognize When to Use Activities

**Before** (Direct Execution):
```
User: "Add feature X"
Agent: *writes code directly*
Agent: "I added feature X"
```

**After** (Activity-Centric):
```
User: "Add feature X"
Agent: search_activities({ category: "feature" })
Agent: activity({ templateId: "add-feature-complete", ... })
Agent: "Feature X added and validated (tests pass)"
```

**Guideline**: If task requires >1 step, use activity.

### Phase 2: Always Validate Functional State

**Before**:
```typescript
// Activity completes
return { success: true, message: "Feature added" }
// Trust success status
```

**After**:
```typescript
// Activity completes
const verdict = computeCorrectnessVerdict(activity)
if (verdict.verdict !== "correct") {
  throw new Error("Validation failed")
}
return { success: true, validated: true, confidence: verdict.confidence }
// Trust validation evidence
```

**Guideline**: Always compute correctness verdict and check confidence.

### Phase 3: Build Validation Harnesses for Critical Specs

**Before**:
```
Specification: "Activities must validate budget"
Implementation: *manually write code*
Verification: *hope it works*
```

**After**:
```
Specification: "Activities must validate budget"
Activity: trace-enforce-validate-loop
Harness: budget-validation-harness.ts (5 test cases)
Verification: Run harness → 5/5 PASS ✓
Continuous: Harness runs in CI, catches regressions
```

**Guideline**: For specifications, use trace-enforce-validate-loop activity.

---

## Success Metrics

### Activity Usage
- **Target**: 90%+ of tasks use activities (not direct execution)
- **Current**: ~60% (needs improvement)
- **How to improve**: Search activities first, create templates for novel patterns

### Functional State Validation
- **Target**: 100% of activities validated before proceeding
- **Current**: ~80% (some activities skip validation)
- **How to improve**: Add validation commands to all activity templates

### Correctness Confidence
- **Target**: 95%+ average confidence on "correct" verdicts
- **Current**: ~85% (some activities have low confidence)
- **How to improve**: Add more validation commands, improve evidence collection

### Harness Coverage
- **Target**: All critical specifications have harnesses
- **Current**: ~10% (harness pattern is new)
- **How to improve**: Use trace-enforce-validate-loop for new specs

---

## Related Documentation

- **Functional State Loop**: `docs/architecture/FUNCTIONAL_STATE_LOOP_ARCHITECTURE.md`
- **Activity Correctness**: `repos/metabob-opencode/packages/opencode/src/session/activity-correctness.ts`
- **Activity Template**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
- **Memory Agent Optimization**: `MEMORY_AGENT_IMPULSE_OPTIMIZATION_ARCHITECTURE.md`
- **Session State Tracing**: `SESSION_MEMORY_LIFECYCLE_TRACING.md`

---

## Conclusion

### From Agent-Centric to Activity-Centric

**Old Model** (Agent-Centric):
- Agent writes code directly
- Trust agent's claims
- Hope code works
- Validation is optional

**New Model** (Activity-Centric):
- Main session orchestrates activities
- Validate functional state at every step
- Verify with external evidence
- Validation is mandatory

### Core Principles

1. **Orchestrate, don't implement**: Main session orchestrates, activities implement
2. **Validate, don't trust**: Functional state is verified, instructional state is ignored
3. **Evidence, not claims**: Use validation evidence, not success status
4. **Harnesses, not hopes**: External harnesses verify specifications deterministically

### The Future

As we accumulate validated functional state:
- **Activity templates improve** (learn from successful executions)
- **Harnesses accumulate** (every spec has deterministic verification)
- **Confidence increases** (validated functional state is trustworthy)
- **System evolves** (instructional → functional state bridge strengthens)

**The goal**: A self-verifying evolutionary system where functional state is always validated and instructional state is continuously aligned with reality.
