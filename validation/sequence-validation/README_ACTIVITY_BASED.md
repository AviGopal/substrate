# Activity-Based Sequence Validation

## Overview

This validation suite uses **actual MiniBob activity execution** to validate that the system works as documented in the sequence diagrams. Instead of mock tests, we execute real activities through MiniBob's ActivityExecutor, exercising all resolvers.

## Key Difference: Activities, Not Tests

**Old Approach (Mock Tests):**
```typescript
// Mock test with fake traces
const trace = { executionId: "fake", ... };
analyzer.assertRecommendationFlow({ ... });
```

**New Approach (Real Activities):**
```json
{
  "id": "validate-activity-selection",
  "tasks": [
    {
      "id": "analyze_goal",
      "resolver": "goal_analysis",  // ← Real resolver execution
      "config": { "goal": "test goal" }
    }
  ]
}
```

## How It Works

### 1. Validation Activities

Each sequence has a corresponding validation activity in `activities/`:

```
activities/
├── 01-validate-activity-selection.json   # Tests Thompson Sampling, meta-activities
├── 02-validate-impulse-resolution.json   # Tests filtering, dispatch, budget
├── 03-validate-resolver-processing.json  # Tests all resolvers
├── 04-validate-improvisation.json        # Tests ribosome, checkpoints
└── 05-validate-hooks.json                # Tests lifecycle and vessel hooks
```

### 2. Execution Through MiniBob

Activities are executed through MiniBob's real ActivityExecutor:

```bash
# Execute validation activity
bun execute-with-minibob.ts activities/01-validate-activity-selection.json
```

This:
1. Loads the activity template
2. Executes through ActivityExecutor
3. Exercises real resolvers (goal_analysis, llm, bash, etc.)
4. Generates real execution trace
5. Validates trace matches documented sequence

### 3. Trace Validation

The execution trace is validated against the documented sequence:

```typescript
// Verify all expected resolvers executed
const expectedResolvers = ["goal_analysis", "impulse_state_analysis", "activity_recommendation"];
const exercisedResolvers = trace.tasks.map(t => t.resolver?.name);

// Verify dependency order respected
// Verify composition edges recorded
// Verify output impulses created
```

## Example: Activity Selection Validation

**Activity Template** (`01-validate-activity-selection.json`):

```json
{
  "id": "validate-activity-selection",
  "tasks": [
    {
      "id": "analyze_goal",
      "resolver": "goal_analysis",
      "inputShapes": ["goal_description"],
      "outputShapes": ["goal_analysis_result"]
    },
    {
      "id": "check_impulse_state",
      "resolver": "impulse_state_analysis",
      "dependencies": ["analyze_goal"]
    },
    {
      "id": "recommend_activities",
      "resolver": "activity_recommendation",
      "dependencies": ["analyze_goal", "check_impulse_state"]
    }
  ]
}
```

**Execution:**
```bash
bun execute-with-minibob.ts activities/01-validate-activity-selection.json
```

**Output:**
```
Executing: Validate Activity Selection Sequence
Tasks: 5

  🔄 Executing through MiniBob ActivityExecutor...

✅ Execution completed:
   Execution ID: exec-1713345678-abc123
   Status: completed
   Tasks: 5

Task Results:
   ✅ analyze_goal (goal_analysis)
   ✅ check_impulse_state (impulse_state_analysis)
   ✅ recommend_activities (activity_recommendation)
   ✅ verify_thompson_sampling (llm)
   ✅ verify_composition_edges (bash)
```

## Resolvers Exercised

Each validation activity exercises specific resolvers:

| Activity | Resolvers Exercised |
|----------|---------------------|
| **01-activity-selection** | goal_analysis, impulse_state_analysis, activity_recommendation, llm, bash |
| **02-impulse-resolution** | bash, llm (+ impulse filtering, dispatch chain) |
| **03-resolver-processing** | bash, git, llm, file, activity |
| **04-improvisation** | llm, bash (+ ribosome resolver) |
| **05-hooks** | bash, llm (+ lifecycle hooks, vessel hooks) |

## Running Validation

### Quick Start

```bash
cd validation/sequence-validation

# Run all validation activities
bun run-activity-tests.ts

# Run specific activity
bun run-activity-tests.ts --activity 01-validate-activity-selection

# Execute with real MiniBob
bun execute-with-minibob.ts activities/01-validate-activity-selection.json
```

### With Verbose Output

```bash
bun run-activity-tests.ts --verbose
```

### Expected Output

```
🧪 MiniBob Sequence Validation (Activity-Based)

Backend: https://activity.metabob.com
Mode: Activity Execution (Real Resolvers)

📋 Executing 01-validate-activity-selection...
  Activity: Validate Activity Selection Sequence
  Tasks: 5
  Resolvers: goal_analysis, impulse_state_analysis, activity_recommendation, llm, bash
  🔄 Executing through MiniBob ActivityExecutor...
✅ 01-validate-activity-selection: Validation passed (245ms)

📋 Executing 02-validate-impulse-resolution...
✅ 02-validate-impulse-resolution: Validation passed (189ms)

...

============================================================
📊 Validation Summary
============================================================

Total Activities: 5
  ✅ Passed: 5
  ❌ Failed: 0
  ⏱️  Duration: 927ms

Resolvers Exercised:
  - goal_analysis
  - impulse_state_analysis
  - activity_recommendation
  - llm
  - bash
  - git
  - file
  - activity
  - ribosome

============================================================
```

## Validation Criteria

Each activity validates specific aspects of the sequence:

### 1. Activity Selection
- ✅ Meta-activity loads correctly (goal_processing_unified)
- ✅ Thompson Sampling queries backend
- ✅ Tiered fallback works (exact → compatible → fulltext)
- ✅ Heuristic boosts applied (8 components)
- ✅ Composition edges recorded

### 2. Impulse Resolution
- ✅ Relevance filtering (high >0.8 loaded, low <threshold skipped)
- ✅ 6-step resolver dispatch (local → custom → discovery → MCP → fallback)
- ✅ Budget enforcement (large impulses truncated)
- ✅ Dual-mode formatting (pointer-mode vs content-mode)

### 3. Resolver Processing
- ✅ LLM resolver tool calling loop
- ✅ Bash resolver command validation
- ✅ Git resolver operations
- ✅ File resolver read/write
- ✅ Activity resolver (nested execution)
- ✅ Output impulse creation
- ✅ Tool argument pattern recording

### 4. Improvisation
- ✅ improvise_solution activity workflow
- ✅ Ribosome extraction criteria (5 checks)
- ✅ Template generalization (variables extracted)
- ✅ Checkpoint creation (git state captured)
- ✅ Variant creation on failure

### 5. Hooks
- ✅ Lifecycle hooks (onBeforePrompt, onAfterPrompt)
- ✅ Vessel hooks (priority ordering)
- ✅ Condition evaluation (required shapes, required absent)
- ✅ Hook chain execution (multiple hooks per trigger)
- ✅ Caching with TTL
- ✅ Non-blocking execution

## Integration with MiniBob

The validation suite integrates directly with MiniBob's execution system:

```typescript
// execute-with-minibob.ts
import { ActivityExecutor } from "../../repos/minibob/src/activity.ts";

const executor = new ActivityExecutor({
  workingDirectory: process.cwd(),
  backend: "https://activity.metabob.com",
});

const result = await executor.execute({
  template: validationActivity,
  variables: { testGoal: "validate system" },
  reason: "sequence-validation",
});
```

This ensures:
- Real resolver execution
- Real impulse creation and resolution
- Real trace generation and submission
- Real backend integration

## Benefits Over Mock Tests

1. **Validates Real Behavior** - Exercises actual code paths, not mocks
2. **Exercises All Resolvers** - Tests resolver implementations directly
3. **Generates Real Traces** - Produces traces submitted to backend
4. **Tests Integration** - Validates resolver → impulse → activity flow
5. **Self-Validating** - Uses MiniBob to validate MiniBob

## Adding New Validation Activities

1. Create activity template in `activities/`
2. Define tasks using appropriate resolvers
3. Add to `ACTIVITIES` array in `run-activity-tests.ts`
4. Run validation

Example:

```json
{
  "id": "validate-new-feature",
  "name": "Validate New Feature",
  "tasks": [
    {
      "id": "test_feature",
      "resolver": "new_resolver",
      "config": { ... }
    }
  ],
  "metadata": {
    "validatesSequence": "06-new-feature.md",
    "exercisedResolvers": ["new_resolver"]
  }
}
```

## References

- [Sequence Diagrams](/docs/architecture/sequences/README.md)
- [MiniBob Activities](/repos/minibob/activities/)
- [Resolver Implementation](/repos/minibob/src/resolvers/)
- [ActivityExecutor](/repos/minibob/src/activity.ts)
