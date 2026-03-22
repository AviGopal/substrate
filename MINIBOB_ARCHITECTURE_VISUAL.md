# Minibob Architecture: Current vs Ideal State

## Visual Comparison

### Current Implementation: Single-Step Thompson Sampling

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER GOAL                                │
│                "Add authentication to API"                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │  Goal Processor    │
         │  parseGoal()       │
         └────────┬───────────┘
                  │
                  │ Iteration 1
                  ▼
    ┌─────────────────────────────┐
    │  Backend Recommendation     │
    │  (Thompson Sampling)        │
    │                             │
    │  Templates:                 │
    │   1. add-feature  (α=10,β=2)│ ◄─── Sample from Beta(α,β)
    │   2. scaffold     (α=5,β=3) │
    │   3. implement    (α=8,β=1) │
    └────────┬────────────────────┘
             │
             │ Pick top: add-feature
             ▼
    ┌──────────────────┐
    │  Execute         │
    │  add-feature     │
    │                  │
    │  Status: success │
    └────────┬─────────┘
             │
             │ Update α=11, β=2
             │
             ▼
    ┌──────────────────┐
    │  Check Complete? │
    │  Yes → DONE      │
    └──────────────────┘

❌ GAPS:
- No memory of what was tried
- No sequence learning  
- No composition tracking
- Each goal starts from zero
```

---

### Ideal Implementation: Learned Execution Graphs

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER GOAL                                │
│                "Add authentication to API"                       │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │  Goal Processor    │
         │  parseGoal()       │
         └────────┬───────────┘
                  │
                  ▼
    ┌───────────────────────────────────────────────────┐
    │   Learned Execution Paths (FROM HISTORY)          │
    │                                                    │
    │   Path A: scaffold → implement → test → commit    │
    │   ├─ Success: 45/50 (90%)                        │
    │   ├─ Avg Cost: $0.80                             │
    │   └─ Avg Time: 5 min                             │
    │                                                    │
    │   Path B: add-feature → test → commit             │
    │   ├─ Success: 32/40 (80%)                        │
    │   ├─ Avg Cost: $0.50                             │
    │   └─ Avg Time: 3 min                             │
    │                                                    │
    │   Path C: add-feature → commit                    │
    │   ├─ Success: 20/35 (57%)                        │
    │   ├─ Avg Cost: $0.30                             │
    │   └─ Avg Time: 2 min                             │
    └────────┬──────────────────────────────────────────┘
             │
             │ Thompson Sample on PATHS (not templates)
             │ Choose: Path A (highest sample from Beta distributions)
             │
             ▼
    ┌─────────────────────────────────────────┐
    │  PLANNED SEQUENCE (Multi-Step)          │
    │                                          │
    │  Step 1: scaffold                        │
    │  Step 2: implement                       │
    │  Step 3: test                            │
    │  Step 4: commit                          │
    │                                          │
    │  Expected: 90% success, $0.80, 5 min    │
    └────────┬────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │  EXECUTE STEP 1: scaffold               │
    │                                          │
    │  Impulses Loaded (learned):              │
    │   ✓ file:src/**/*.ts  (99% relevant)    │
    │   ✓ memo:requirements  (87% relevant)    │
    │   ✗ file:tests/**      (12% relevant)    │◄── Skip (not needed for scaffold)
    │                                          │
    │  Tools Used (tracked):                   │
    │   ✓ read (5x)                           │
    │   ✓ write (3x)                          │
    │   ✓ bash (1x)                           │
    │                                          │
    │  Status: success                         │
    └────────┬────────────────────────────────┘
             │
             │ Store: activityOutput impulse
             │ Update: composition graph edge
             │         scaffold → implement (weight += 1)
             │
             ▼
    ┌─────────────────────────────────────────┐
    │  EXECUTE STEP 2: implement              │
    │                                          │
    │  Impulses Loaded:                        │
    │   ✓ activityOutput:scaffold             │◄── Previous step output
    │   ✓ file:src/**/*.ts                    │
    │   ✓ tool_result:bash:npm_test           │◄── Tool call from step 1
    │                                          │
    │  Tools Used:                             │
    │   ✓ edit (8x)                           │
    │   ✓ bash (2x)                           │
    │   ✓ git (1x)                            │
    │                                          │
    │  Status: success                         │
    └────────┬────────────────────────────────┘
             │
             │ Update: graph edge implement → test
             │
             ▼
    ┌─────────────────────────────────────────┐
    │  EXECUTE STEP 3: test                   │
    │  Status: success                         │
    └────────┬────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │  EXECUTE STEP 4: commit                 │
    │  Status: success                         │
    └────────┬────────────────────────────────┘
             │
             │ SEQUENCE COMPLETE
             │
             ▼
    ┌─────────────────────────────────────────┐
    │  LEARNING UPDATE                         │
    │                                          │
    │  Path A: scaffold → impl → test → commit│
    │    Success count: 45 → 46               │
    │    Thompson α: 45 → 46                  │
    │    Thompson β: 5 → 5                    │
    │                                          │
    │  Composition Graph:                      │
    │    scaffold → implement  (weight: 0.92) │
    │    implement → test      (weight: 0.95) │
    │    test → commit         (weight: 1.00) │
    │                                          │
    │  Impulse Relevance:                      │
    │    file:src/**/*.ts @ scaffold  (99%)   │
    │    activityOutput @ implement   (100%)  │
    │    tool_result:test @ commit    (85%)   │
    │                                          │
    │  Tool Requirements:                      │
    │    scaffold needs: read, write          │
    │    implement needs: edit, bash, git     │
    │    test needs: bash                     │
    │    commit needs: git                    │
    └─────────────────────────────────────────┘

✅ BENEFITS:
- Multi-step planning from history
- Impulse relevance learned (skip unnecessary loads)
- Tool requirements known (pre-flight checks)
- Composition graph guides next execution
- Each goal execution teaches the system
```

---

## Execution Graph Evolution

### After 10 Executions

```
                  ┌──────────────┐
                  │ add-feature  │
                  └───┬──────────┘
                      │
           ┌──────────┼──────────┐
           │          │          │
           ▼          ▼          ▼
       ┌──────┐  ┌──────┐  ┌──────────┐
       │ test │  │commit│  │ scaffold │
       └──┬───┘  └──────┘  └────┬─────┘
          │                     │
          │                     ▼
          │              ┌─────────────┐
          │              │  implement  │
          │              └──────┬──────┘
          │                     │
          └─────────────┬───────┘
                        ▼
                   ┌────────┐
                   │ commit │
                   └────────┘

Edge Weights (learned probabilities):
  add-feature → test       : 0.60
  add-feature → commit     : 0.30
  add-feature → scaffold   : 0.10
  test → commit           : 1.00
  scaffold → implement    : 0.90
  implement → commit      : 0.95
```

### After 100 Executions (Learned Patterns)

```
                  ┌──────────────┐
                  │ add-feature  │
                  └───┬──────────┘
                      │
           ┌──────────┼──────────────────────┐
           │          │                      │
           │(0.15)    │(0.80)                │(0.05)
           ▼          ▼                      ▼
       ┌──────┐  ┌──────────┐          ┌──────────┐
       │commit│  │   test   │          │ scaffold │
       └──────┘  └────┬─────┘          └────┬─────┘
                      │                     │
                 (1.0)│                (0.9)│
                      ▼                     ▼
                 ┌────────┐          ┌─────────────┐
                 │ commit │          │  implement  │
                 └────────┘          └──────┬──────┘
                                            │
                                       (0.95)│
                                            ▼
                                       ┌────────┐
                                       │ commit │
                                       └────────┘

💡 LEARNED INSIGHTS:
- "Simple features skip tests (15%)"
- "Most features need tests (80%)"
- "Complex features use scaffold → implement (5%)"
- "Tests always followed by commit"
- "Implement rarely skips commit"
```

---

## Impulse Learning Flow

### Iteration 1: No Data

```
Activity: add-feature
Impulses Available: 
  - file:src/**/*.ts    (budget: 5000 tokens)
  - file:tests/**/*.ts  (budget: 3000 tokens)  
  - memo:requirements   (budget: 2000 tokens)
  - memo:architecture   (budget: 1000 tokens)

Decision: Load ALL (no data to optimize)
Total Tokens: 11,000
Result: SUCCESS
```

### Iteration 10: Initial Learning

```
Activity: add-feature
Impulses with Metrics:
  - file:src/**/*.ts    (98% success correlation) ✓ LOAD
  - file:tests/**/*.ts  (45% success correlation) ? SKIP
  - memo:requirements   (92% success correlation) ✓ LOAD
  - memo:architecture   (30% success correlation) ? SKIP

Decision: Load high-value only
Total Tokens: 7,000 (36% savings)
Result: SUCCESS
```

### Iteration 50: Optimized

```
Activity: add-feature
Learned Patterns:
  - file:src/**/*.ts    (99% success, ALWAYS needed)     ✓
  - memo:requirements   (87% success, USUALLY needed)    ✓
  - file:tests/**/*.ts  (12% success, RARELY needed)     ✗
  - memo:architecture   (8% success, IRRELEVANT)         ✗

Optimized Budget:
  - file:src/**/*.ts    3500 tokens (was 5000)  ← Learned enough
  - memo:requirements   1500 tokens (was 2000)  ← Learned enough

Total Tokens: 5,000 (55% savings vs iteration 1)
Success Rate: 99% (same as loading everything)
```

---

## Variant Evolution

### Generation 0: Initial Template

```
┌────────────────────────────────────┐
│  add-feature-complete              │
│                                    │
│  Success Rate: 70%                 │
│  Avg Cost: $0.60                   │
│  Executions: 50                    │
│                                    │
│  Failure Analysis:                 │
│   - Multi-file features: 40% fail  │
│   - Single-file features: 90% pass │
│   - Large features: 50% fail       │
└────────────────────────────────────┘
```

### Generation 1: Boredom Task "Split Variant"

```
BOREDOM TASK: create-variant-split
Source: add-feature-complete
Reason: Multi-file failures detected

Analysis:
  - Single-file features succeed consistently
  - Multi-file features often fail due to dependency handling
  - Split recommended

NEW VARIANTS:
┌────────────────────────────────────┐
│  add-feature-single-file           │
│  (Parent: add-feature-complete)    │
│                                    │
│  Genealogy: {                      │
│    parent: "add-feature-complete", │
│    split_reason: "file_count",     │
│    generation: 1                   │
│  }                                 │
│                                    │
│  Success Rate: 95% (predicted)     │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│  add-feature-multi-file            │
│  (Parent: add-feature-complete)    │
│                                    │
│  Genealogy: {                      │
│    parent: "add-feature-complete", │
│    split_reason: "file_count",     │
│    generation: 1                   │
│  }                                 │
│                                    │
│  Tasks Modified:                   │
│   + Added: analyze-dependencies    │
│   + Added: order-file-changes      │
│                                    │
│  Success Rate: 85% (predicted)     │
└────────────────────────────────────┘
```

### Generation 2: A/B Testing

```
Thompson Sampling with 3 Variants:

Variant A: add-feature-complete     (α=35, β=15) → sample=0.68
Variant B: add-feature-single-file  (α=19, β=1)  → sample=0.92 ← SELECTED
Variant C: add-feature-multi-file   (α=8, β=2)   → sample=0.75

Result: Variant B selected for single-file goal
        Variant C selected for multi-file goal
        Variant A rarely selected (deprecated)
```

---

## Tool Tracking as Impulses

### Current: Tools Execute, No Learning

```
LLM: "I'll fix the bug"
Tool Call: bash("npm test")
Result: "Test failed: auth.spec.ts line 42"
LLM: "I see the issue, let me fix it"
Tool Call: edit(file="auth.ts", ...)
Result: "File edited"

❌ Lost: No record that test output led to the fix
❌ Lost: No learning that bash is critical for this activity
❌ Lost: No impulse created for next task to reference
```

### Ideal: Tools Create Impulses

```
LLM: "I'll fix the bug"
Tool Call: bash("npm test")
Result: "Test failed: auth.spec.ts line 42"

↓ Auto-create impulse ↓

Impulse Created:
{
  id: "tool:bash:1234567",
  type: "tool_execution",
  pointer: {
    type: "tool_call_result",
    toolName: "bash",
    params: { command: "npm test" },
    result: "Test failed: auth.spec.ts line 42",
    executionId: "exec_abc123"
  },
  budget: 500,
  metadata: {
    activity_id: "fix-bug-complete",
    task_id: "task-1-diagnose",
    timestamp: 1710000000
  }
}

LLM Next Message Gets:
<impulse id="tool:bash:1234567" type="tool_call_result">
Test failed: auth.spec.ts line 42
</impulse>

Tool Call: edit(file="auth.ts", ...)

Later Learning:
✓ Activity "fix-bug" ALWAYS uses bash for testing
✓ Tool result impulses have 95% success correlation
✓ bash tool is REQUIRED for this activity (vessel check)
```

---

## Summary Comparison

| Dimension | Current | Ideal | Impact |
|-----------|---------|-------|--------|
| **Activity Selection** | Single-step Thompson Sampling | Multi-step path Thompson Sampling | 10x faster goal completion |
| **Impulse Loading** | Load everything | Load only relevant (learned) | 50% token savings |
| **Tool Tracking** | Not tracked | Tracked as impulses | Vessel requirements known |
| **Composition** | Possible but not learned | Graph with edge weights | Predictable execution |
| **Variants** | Manual creation | Auto-created from failures | Continuous improvement |
| **Goal Planning** | Trial-and-error loop | Learned optimal paths | Reliable execution |
| **Boredom Tasks** | Infrastructure only | Variant creation + optimization | Self-improvement |

---

## Next Goal: Close the Learning Loops

The architecture is sound. The execution works. 

**What's missing: Feedback loops that turn execution data into learned patterns.**

Every execution should:
1. ✅ Record what happened (done)
2. ❌ Update composition graph (missing)
3. ❌ Update impulse relevance (missing)
4. ❌ Update tool requirements (missing)
5. ❌ Update path probabilities (missing)

Once these loops close, the system becomes truly autonomous.
