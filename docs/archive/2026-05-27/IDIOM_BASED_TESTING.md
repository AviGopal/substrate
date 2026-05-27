# Idiom-Based Testing: MiniBob-TUI Example

**Question:** "How do we test MiniBob-TUI using our idioms (impulses, activities, resolvers)?"

**Answer:** Express testing as a state transformation with shaped inputs and outputs.

---

## The Idiom Pattern

### 1. Define State Space

**Current State (Input Impulses):**
```typescript
[
  {
    id: "minibob-tui-source",
    pointer: { type: "directory", path: "repos/minibob-tui/src" },
    metadata: {
      shape: "source_code",
      language: "typescript",
      status: "untested"
    }
  },
  {
    id: "minibob-tui-package",
    pointer: { type: "file", path: "repos/minibob-tui/package.json" },
    metadata: {
      shape: "package_manifest",
      dependency: "@metabob/minibob@^0.3.7",
      installStatus: "unknown"
    }
  }
]
```

**Desired State (Output Impulses):**
```typescript
[
  {
    id: "test-results",
    metadata: {
      shape: "test_results",
      status: "verified",
      passedChecks: 4,
      failedChecks: 0
    },
    content: {
      productionPackage: "PASS",
      importResolution: "PASS",
      demoScript: "PASS",
      typeChecking: "PASS"
    }
  },
  {
    id: "verification-report",
    pointer: { type: "file", path: "/tmp/minibob-tui-test-report.md" },
    metadata: {
      shape: "verification_report",
      format: "markdown",
      timestamp: "2026-04-09T10:30:00Z"
    }
  }
]
```

### 2. Activity = State Transformation

The activity bridges input state → output state:

```typescript
{
  id: "test-minibob-tui-production-package",
  inputShapes: ["source_code", "package_manifest"],
  outputShapes: ["test_results", "verification_report"],

  // Transformation logic
  tasks: [
    { verify production package },
    { test imports },
    { run demo script },
    { check types },
    { generate report }
  ]
}
```

### 3. Resolvers Execute Tasks

Each task uses appropriate resolvers:

| Task | Resolver | Why |
|------|----------|-----|
| Verify production package | File resolver | Read package.json (deterministic) |
| Test imports | Bash resolver | Run bun command (deterministic) |
| Run demo script | Bash resolver | Execute shell script (deterministic) |
| Check types | Bash resolver | Run typecheck (deterministic) |
| Generate report | LLM resolver | Synthesize findings (reasoning) |

**Notice:** LLM resolver only used for the final synthesis task!

---

## Making General Requests to State Space

### The Request Pattern

```typescript
// Instead of free-form goal:
// ❌ "Test MiniBob-TUI with production package"

// Use shaped request:
// ✅ Request transformation from shaped inputs to shaped outputs
await minibob.requestTransformation({
  input: [
    { shape: "source_code", path: "repos/minibob-tui/src" },
    { shape: "package_manifest", path: "repos/minibob-tui/package.json" }
  ],
  output: [
    { shape: "test_results" },
    { shape: "verification_report" }
  ]
});
```

### How MiniBob Processes This

1. **Shape Matching:**
   ```
   Find activities where:
     inputShapes ⊇ request.input.shapes
     outputShapes ⊇ request.output.shapes
   ```

2. **Thompson Sampling:**
   ```
   Rank matched activities by:
     - Success rate
     - Relevance score
     - Recent performance
   ```

3. **Execute Best Activity:**
   ```
   activity = topRanked()
   result = activity.execute(inputImpulses)
   ```

4. **Learn from Outcome:**
   ```
   if result.success:
     updateScore(activity.id, +reward)
   else:
     updateScore(activity.id, -penalty)
     extractAttemptTemplate(result.trace)
   ```

---

## How This Is an Activity

**Question:** "How is testing an activity?"

**Answer:** It's a state transition with measurable outcomes.

### State Transition View

```
┌─────────────────────────────────────────────────────────────┐
│                    BEFORE (Input State)                      │
├─────────────────────────────────────────────────────────────┤
│ • Source code exists (status: untested)                     │
│ • package.json declares dependency (status: unknown)        │
│ • node_modules may or may not exist                         │
│ • Import compatibility unknown                              │
│ • Type errors unknown                                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Activity: test-minibob-tui
                           │ (5 tasks execute)
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    AFTER (Output State)                      │
├─────────────────────────────────────────────────────────────┤
│ • Production package verified (status: installed)           │
│ • Imports tested (status: working)                          │
│ • Demo script executed (status: passed)                     │
│ • Type errors documented (status: known)                    │
│ • Verification report exists (status: generated)            │
└─────────────────────────────────────────────────────────────┘
```

### Measurable Outcomes

**Activities must have measurable success criteria:**

```json
{
  "validation": {
    "requiredFiles": [
      "/tmp/minibob-tui-test-report.md"
    ],
    "requiredPatterns": [
      "✓ Production package installed",
      "✓ All imports work correctly"
    ],
    "forbiddenPatterns": [
      "✗ Import test failed"
    ]
  }
}
```

**Success = All validations pass**

---

## Idiom Checklist

When creating an activity, verify it follows idioms:

- [ ] **Input is shaped** - Declares `inputShapes: [...]`
- [ ] **Output is shaped** - Declares `outputShapes: [...]`
- [ ] **Transformation is clear** - Tasks show how input → output
- [ ] **Validation is measurable** - Success/failure is deterministic
- [ ] **Resolvers are appropriate** - Use deterministic when possible
- [ ] **LLM only for reasoning** - Not for execution or data access
- [ ] **Traces are captured** - Learning loop gets feedback
- [ ] **Template is reusable** - Variables for different contexts

---

## Using the Activity

### Method 1: Direct Execution

```bash
# Register activity template with backend
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d @repos/metabob-proto/activities/testing/test-minibob-tui-production-package.json

# Execute via MiniBob
minibob --single "Execute test-minibob-tui-production-package activity"
```

### Method 2: Shaped Request

```bash
# MiniBob finds the activity automatically by shapes
minibob --single "Transform source code and package manifest into test results and verification report for MiniBob-TUI"
```

MiniBob will:
1. Parse intent → identify shapes: `source_code`, `package_manifest` → `test_results`, `verification_report`
2. Query backend: `GET /v2/activities/recommend?inputShapes=source_code,package_manifest&outputShapes=test_results,verification_report`
3. Get recommendation: `test-minibob-tui-production-package`
4. Execute activity
5. Return results

### Method 3: Goal-Based (Improvisation)

```bash
# If no template exists, MiniBob improvises
minibob --single "Test MiniBob-TUI with production package"
```

MiniBob will:
1. No matching activity found
2. Enter improvisation mode
3. LLM decomposes into steps
4. Execute steps
5. Extract attempt template
6. Submit to backend for learning

**This is the "expensive path"** - use only when no template exists.

---

## LLM Resolver's Role

**The LLM resolver is for reasoning about metadata, not executing tasks.**

### ❌ Wrong: LLM as Universal Executor

```typescript
// DON'T do this
{
  "task": "test-imports",
  "prompt": "Read the file at repos/minibob-tui/src/index.ts and check if imports work"
  // ❌ LLM shouldn't read files - file resolver should
}
```

### ✅ Right: LLM Reasons, Resolvers Execute

```typescript
// DO this
{
  "task": "test-imports",
  "inputImpulses": [
    {
      id: "tui-source",
      pointer: { type: "file", path: "repos/minibob-tui/src/index.ts" },
      metadata: { shape: "source_code" }
      // File resolver loads this
    }
  ],
  "prompt": "Given the source code in impulse 'tui-source', determine which imports need testing and generate the test script"
  // ✅ LLM reasons about what to test
  // ✅ Bash resolver executes the test
}
```

---

## Complete Flow Example

### Scenario: Test MiniBob-TUI

**User Request:**
```bash
minibob --single "Verify MiniBob-TUI works with production package"
```

**MiniBob Processing:**

1. **Goal Analysis (LLM):**
   - Intent: Verification/testing
   - Target: MiniBob-TUI
   - Constraint: Production package
   - → Shapes: `source_code`, `package_manifest` → `test_results`

2. **Activity Discovery (Backend):**
   ```
   GET /v2/activities/recommend
   POST {
     "inputShapes": ["source_code", "package_manifest"],
     "outputShapes": ["test_results", "verification_report"]
   }

   Response: {
     "recommended": [
       {
         "id": "test-minibob-tui-production-package",
         "score": 0.85,
         "reason": "exact shape match"
       }
     ]
   }
   ```

3. **Activity Execution:**
   ```
   Task 1: verify-production-package
     → File resolver: Read package.json
     → Bash resolver: Check node_modules
     → Result: PASS

   Task 2: test-import-resolution
     → Write resolver: Create test file
     → Bash resolver: Run bun command
     → Result: PASS

   Task 3: run-demo-script
     → Bash resolver: Execute script
     → Result: PASS

   Task 4: check-type-compatibility
     → Bash resolver: Run typecheck
     → Result: FAIL (type errors found)

   Task 5: generate-verification-report
     → LLM resolver: Synthesize findings
     → Write resolver: Create markdown report
     → Result: PASS
   ```

4. **Trace Captured:**
   ```json
   {
     "executionId": "exec_test_123",
     "activityId": "test-minibob-tui-production-package",
     "status": "success",
     "duration": 15234,
     "tasksCompleted": 5,
     "tasksTotal": 5,
     "cost": 0.0234,
     "tokens": 8942
   }
   ```

5. **Learning Update (Backend):**
   ```
   Thompson Sampling:
     activity: test-minibob-tui-production-package
     reward: +1 (success)
     newScore: 0.87 (was 0.85)

   Impulse Relevance:
     shape: source_code → relevant: true
     shape: package_manifest → relevant: true
     shape: test_results → produced: true
   ```

---

## Summary

### How to Do This With Our Idioms

1. **Define shapes** for inputs and outputs
2. **Create activity** that transforms input shapes → output shapes
3. **Use appropriate resolvers** for each task (not always LLM!)
4. **Validate outcomes** with measurable criteria
5. **Capture traces** for learning

### How to Make General Requests to State Space

Instead of free-form goals, request transformations:

```typescript
transform(
  from: [{ shape: "X" }, { shape: "Y" }],
  to: [{ shape: "Z" }]
)
```

MiniBob finds activities where `inputShapes ⊇ from.shapes` and `outputShapes ⊇ to.shapes`.

### How LLM Resolver Will Resolve

LLM resolver is used when:
- **Reasoning** about ambiguous input
- **Generating** new content
- **Synthesizing** multiple sources

NOT for:
- Reading files (file resolver)
- Executing commands (bash resolver)
- Accessing databases (database resolver)
- Loading modules (import resolver)

### How This Is an Activity

Testing is a state transition:
- Input: Untested code + unknown package state
- Output: Test results + verification report
- Measurable: Pass/fail + specific checks
- Reusable: Works for any package with similar structure

**Every goal that changes state can be an activity.**

---

## Created Activity Template

📄 `repos/metabob-proto/activities/testing/test-minibob-tui-production-package.json`

This template demonstrates all idioms:
- ✅ Shaped inputs (`source_code`, `package_manifest`)
- ✅ Shaped outputs (`test_results`, `verification_report`)
- ✅ Measurable validation (required files, patterns)
- ✅ Appropriate resolvers (file, bash, write, LLM)
- ✅ Reusable structure (variables for paths)

**To use it:**
```bash
# Register template
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d @repos/metabob-proto/activities/testing/test-minibob-tui-production-package.json

# Execute via shaped request
minibob --single "Test MiniBob-TUI production package"
# MiniBob finds the template by shapes and executes it
```
