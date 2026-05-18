# Composition Execution Semantics

## Overview

Composition activities orchestrate multiple child activities to achieve a complex goal. This specification defines execution order, error handling, and impulse flow between children.

## Composition Structure

```typescript
interface CompositionActivity {
  id: string;
  name: string;
  execution_type: "composition";

  // What shapes this composition requires
  input_shapes: string[];  // e.g., ["goal"]

  // What shapes this composition produces
  output_shapes: string[];  // e.g., ["patch", "test_result"]

  // Ordered list of child activities
  child_activities: string[];  // Activity IDs in execution order

  // Optional: Execution strategy
  execution_strategy?: "sequential" | "parallel" | "conditional";
}
```

## Execution Strategies

### Sequential (Default)

Children execute one after another. Each child receives impulses from all previous children.

```
Parent Input Impulses
    │
    ▼
┌─────────────────┐
│  Child 1        │ ← Receives: parent inputs
│  (analyze)      │ → Produces: analysis
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Child 2        │ ← Receives: parent inputs + analysis
│  (fix)          │ → Produces: patch
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Child 3        │ ← Receives: parent inputs + analysis + patch
│  (test)         │ → Produces: test_result
└─────────────────┘
    │
    ▼
Parent Output Impulses = [analysis, patch, test_result]
```

### Parallel (Future)

Children execute concurrently. Each child receives only parent inputs.

```
Parent Input Impulses
    │
    ├─────────────────┬─────────────────┐
    ▼                 ▼                 ▼
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Child 1 │     │ Child 2 │     │ Child 3 │
│ (lint)  │     │ (type)  │     │ (test)  │
└─────────┘     └─────────┘     └─────────┘
    │                 │                 │
    └─────────────────┴─────────────────┘
                      │
                      ▼
Parent Output Impulses = [lint_result, type_result, test_result]
```

### Conditional (Future)

Children execute based on conditions. Supports branching logic.

```
Parent Input Impulses
    │
    ▼
┌─────────────────┐
│  Condition      │
│  (check type)   │
└─────────────────┘
    │
    ├── IF error_type == "null_pointer" ──▶ Child A
    │
    ├── IF error_type == "type_error" ────▶ Child B
    │
    └── ELSE ─────────────────────────────▶ Child C
```

## Impulse Flow

### Input Impulse Aggregation

```typescript
function getInputImpulsesForChild(
  childIndex: number,
  parentInputs: Impulse[],
  childOutputs: Impulse[][]  // Outputs from children 0..childIndex-1
): Impulse[] {
  // Start with parent inputs
  const inputs = [...parentInputs];

  // Add outputs from all previous children
  for (let i = 0; i < childIndex; i++) {
    inputs.push(...childOutputs[i]);
  }

  return inputs;
}
```

### Output Impulse Collection

```typescript
function collectOutputImpulses(
  childExecutions: ActivityExecution[]
): Impulse[] {
  const outputs: Impulse[] = [];

  for (const execution of childExecutions) {
    // Collect impulses created during execution
    for (const impulseId of execution.output_impulses) {
      outputs.push(await loadImpulse(impulseId));
    }
  }

  return outputs;
}
```

## Error Handling

### Fail-Fast (Default)

Stop execution on first child failure. Record partial results.

```typescript
async function executeSequential(
  composition: CompositionActivity,
  inputImpulses: Impulse[]
): Promise<CompositionExecution> {
  const childOutputs: Impulse[][] = [];
  const childExecutions: ActivityExecution[] = [];

  for (const childId of composition.child_activities) {
    const childInputs = getInputImpulsesForChild(
      childExecutions.length,
      inputImpulses,
      childOutputs
    );

    try {
      const execution = await executeActivity(childId, childInputs);
      childExecutions.push(execution);

      if (!execution.success) {
        // Fail-fast: stop on failure
        return {
          success: false,
          error: {
            type: "child_failure",
            childId,
            childExecution: execution
          },
          childExecutions,
          partialOutputs: childOutputs.flat()
        };
      }

      childOutputs.push(execution.output_impulses);
    } catch (error) {
      return {
        success: false,
        error: { type: "execution_error", childId, error },
        childExecutions,
        partialOutputs: childOutputs.flat()
      };
    }
  }

  return {
    success: true,
    childExecutions,
    output_impulses: childOutputs.flat()
  };
}
```

### Continue-on-Error (Optional)

Continue with remaining children even if one fails. Useful for independent tasks.

```typescript
async function executeContinueOnError(
  composition: CompositionActivity,
  inputImpulses: Impulse[]
): Promise<CompositionExecution> {
  const results = await Promise.allSettled(
    composition.child_activities.map(childId =>
      executeActivity(childId, inputImpulses)
    )
  );

  const successful = results.filter(r => r.status === "fulfilled");
  const failed = results.filter(r => r.status === "rejected");

  return {
    success: failed.length === 0,
    childExecutions: results.map(r =>
      r.status === "fulfilled" ? r.value : null
    ),
    errors: failed.map(r => r.reason),
    output_impulses: successful.flatMap(r => r.value.output_impulses)
  };
}
```

## Execution Recording

### Parent Execution Record

```typescript
interface CompositionExecution {
  id: string;
  activity_id: string;  // Composition activity ID

  // Links to input impulses
  input_impulses: string[];

  // Links to output impulses (aggregated from children)
  output_impulses: string[];

  // Outcome
  success: boolean;
  error?: {
    type: "child_failure" | "execution_error";
    childId?: string;
    message?: string;
  };

  // Aggregated metrics
  duration_ms: number;  // Sum of child durations
  cost_usd: number;     // Sum of child costs
  tokens_in: number;    // Sum of child input tokens
  tokens_out: number;   // Sum of child output tokens

  // No parent (this IS the parent)
  parent_execution_id: null;

  // Trace includes child summaries
  trace: {
    children: Array<{
      activity_id: string;
      execution_id: string;
      success: boolean;
      duration_ms: number;
    }>;
  };
}
```

### Child Execution Records

```typescript
interface ChildExecution {
  id: string;
  activity_id: string;

  input_impulses: string[];
  output_impulses: string[];

  success: boolean;
  duration_ms: number;
  cost_usd: number;

  // Links to parent composition
  parent_execution_id: string;

  // Full trace
  trace: ExecutionTrace;
}
```

## Depth Limiting

Prevent infinite nesting:

```typescript
const MAX_COMPOSITION_DEPTH = 3;

async function executeWithDepthCheck(
  activity: Activity,
  impulses: Impulse[],
  currentDepth: number = 0
): Promise<ActivityExecution> {
  if (currentDepth >= MAX_COMPOSITION_DEPTH) {
    throw new Error(
      `Composition depth exceeded: ${currentDepth} >= ${MAX_COMPOSITION_DEPTH}`
    );
  }

  if (activity.execution_type === "composition") {
    return executeComposition(activity, impulses, currentDepth + 1);
  }

  return executeTemplate(activity, impulses);
}
```

## Cycle Detection

Prevent circular compositions:

```typescript
function detectCycle(
  activityId: string,
  visited: Set<string> = new Set()
): boolean {
  if (visited.has(activityId)) {
    return true;  // Cycle detected
  }

  visited.add(activityId);

  const activity = getActivity(activityId);
  if (activity.execution_type === "composition") {
    for (const childId of activity.child_activities) {
      if (detectCycle(childId, new Set(visited))) {
        return true;
      }
    }
  }

  return false;
}
```

## Thompson Sampling for Compositions

Compositions participate in Thompson Sampling like any activity:

```typescript
// Query includes compositions
SELECT * FROM v_activity_score
WHERE activity_id IN (
  SELECT id FROM activity
  WHERE execution_type IN ['template', 'composition']
    AND 'goal' ALLINSIDE input_shapes
);
```

The alpha/beta parameters reflect the composition's overall success rate, not individual children.

## Example Composition

```typescript
const debugAndFix = {
  id: "debug-and-fix-composition",
  name: "Debug and Fix Bug",
  execution_type: "composition",
  input_shapes: ["goal", "error"],
  output_shapes: ["patch", "test_result"],
  child_activities: [
    "analyze-error",      // Produces: analysis
    "locate-bug",         // Produces: location
    "generate-fix",       // Produces: patch
    "run-tests"           // Produces: test_result
  ],
  execution_strategy: "sequential"
};
```

Execution flow:
1. Receives: `[goal, error]`
2. analyze-error: `[goal, error]` → `[analysis]`
3. locate-bug: `[goal, error, analysis]` → `[location]`
4. generate-fix: `[goal, error, analysis, location]` → `[patch]`
5. run-tests: `[goal, error, analysis, location, patch]` → `[test_result]`
6. Produces: `[analysis, location, patch, test_result]`
