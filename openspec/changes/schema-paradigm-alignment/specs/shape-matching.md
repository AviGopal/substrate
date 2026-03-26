# Shape Matching Algorithm

## Overview

Shape matching determines which activities can process a given set of impulses. Activities declare `input_shapes` (required impulse shapes) and the system matches against `available_shapes` (shapes of loaded impulses).

## Core Algorithm

```typescript
/**
 * Filter activities that can process the available impulse shapes.
 *
 * Rule: Activity matches if ALL required shapes are available.
 * Formula: activity.input_shapes ⊆ available_shapes
 */
function matchActivities(
  availableShapes: string[],
  activities: Activity[]
): Activity[] {
  const availableSet = new Set(availableShapes);

  return activities.filter(activity => {
    // Backward compatibility: activities without input_shapes match all
    if (!activity.input_shapes || activity.input_shapes.length === 0) {
      return true;
    }

    // All required shapes must be present
    return activity.input_shapes.every(shape => availableSet.has(shape));
  });
}
```

## Shape Types

Standard shapes recognized by the system:

| Shape | Description | Example Pointer Types |
|-------|-------------|----------------------|
| `goal` | User intent or objective | memo, file |
| `error` | Error message or stack trace | memo, file |
| `source_code` | Code files | file |
| `test_result` | Test output | memo, activityOutput |
| `patch` | Code changes | memo, activityOutput |
| `trace` | Execution trace | activityExecutionTrace |
| `analysis` | LLM analysis output | memo, activityOutput |
| `recommendation` | Suggested action | memo |

## Matching Examples

### Example 1: Debug Activity

```typescript
const debugActivity = {
  id: "debug-null-pointer",
  input_shapes: ["goal", "error", "source_code"],
  output_shapes: ["patch", "analysis"]
};

// Available impulses
const available = ["goal", "error", "source_code", "test_result"];

// Match: ["goal", "error", "source_code"] ⊆ available = true
```

### Example 2: Partial Match (Fails)

```typescript
const complexActivity = {
  id: "full-analysis",
  input_shapes: ["goal", "error", "source_code", "trace"],
  output_shapes: ["recommendation"]
};

// Available impulses
const available = ["goal", "error", "source_code"];

// Match: trace ∉ available = false (activity not selected)
```

### Example 3: No Shape Requirements (Legacy)

```typescript
const legacyActivity = {
  id: "generic-helper",
  input_shapes: [],  // or undefined
  output_shapes: ["analysis"]
};

// Available impulses
const available = ["goal"];

// Match: [] ⊆ anything = true (backward compatible)
```

## Activity Selection Flow

```
1. User provides goal → creates impulse with shape="goal"
2. System loads context → creates impulses with various shapes
3. Collect available shapes: ["goal", "error", "source_code"]
4. Query activities: SELECT * FROM activity WHERE execution_type = 'template'
5. Filter by shape match: input_shapes ⊆ available_shapes
6. Rank by Thompson Sampling: sample from Beta(alpha, beta)
7. Return top N recommendations
```

## Recommendation Query

```typescript
// POST /v2/activities/recommend
interface RecommendRequest {
  task_description: string;
  category?: string;
  impulse_shapes: string[];  // Available shapes
  limit?: number;
}

interface RecommendResponse {
  recommendations: Array<{
    template_id: string;
    template_name: string;
    input_shapes: string[];
    output_shapes: string[];
    selection_metadata: {
      method: "thompson_sampling";
      alpha: number;
      beta: number;
      sample: number;  // Beta distribution sample
      shape_match: boolean;
    };
  }>;
}
```

## Backend Implementation

```surql
-- Find activities matching available shapes
LET $available = ["goal", "error", "source_code"];

SELECT
  id,
  name,
  input_shapes,
  output_shapes,
  (
    SELECT
      count(WHERE success = true) + 1 AS alpha,
      count(WHERE success = false) + 1 AS beta
    FROM execution
    WHERE activity_id = $parent.id
  )[0] AS metrics
FROM activity
WHERE execution_type = 'template'
  AND (
    input_shapes IS NONE
    OR input_shapes = []
    OR input_shapes ALLINSIDE $available
  )
ORDER BY rand()  -- Thompson sampling happens in application
LIMIT 10;
```

## Shape Inference

When creating impulses, shapes are inferred from pointer types:

```typescript
function inferShape(pointer: ImpulsePointer): string {
  switch (pointer.type) {
    case "file":
      if (pointer.path.endsWith(".ts") || pointer.path.endsWith(".js")) {
        return "source_code";
      }
      if (pointer.path.includes("error") || pointer.path.includes("log")) {
        return "error";
      }
      return "file";

    case "memo":
      // Check content for patterns
      if (pointer.content?.includes("Error:") || pointer.content?.includes("at ")) {
        return "error";
      }
      return "memo";

    case "activityExecutionTrace":
      return "trace";

    case "activityOutput":
      return "analysis";  // Default for LLM output

    default:
      return pointer.type;  // Use pointer type as shape
  }
}
```

## Explicit Shape Override

Users can override inferred shapes:

```typescript
const impulse = {
  id: "my-impulse",
  pointer: { type: "file", path: "/src/api.ts" },
  shape: "source_code",  // Explicit shape
  // ...
};
```

## Backward Compatibility

Activities without `input_shapes` (pre-migration) are handled:

1. **During Migration:** Infer shapes from historical executions
2. **At Runtime:** Match all shapes (no filtering)
3. **Gradual Adoption:** New activities require shapes, old ones grandfathered

## Tie-Breaking

When multiple activities have the same Thompson sample:

1. **Primary:** Higher `last_executed_at` (more recently used)
2. **Secondary:** More specific `input_shapes` (longer array)
3. **Tertiary:** Alphabetical by name (deterministic)

```typescript
function tieBreak(a: Activity, b: Activity): number {
  // 1. More recent
  if (a.last_executed_at !== b.last_executed_at) {
    return b.last_executed_at - a.last_executed_at;
  }

  // 2. More specific
  const aShapes = a.input_shapes?.length || 0;
  const bShapes = b.input_shapes?.length || 0;
  if (aShapes !== bShapes) {
    return bShapes - aShapes;
  }

  // 3. Alphabetical
  return a.name.localeCompare(b.name);
}
```

## Shape Evolution

As the system learns, shapes can be refined:

```typescript
// Initial: generic shape
{ shape: "source_code" }

// Learned: more specific shape
{ shape: "typescript_module" }

// Future: hierarchical shapes
{ shape: "source_code/typescript/react_component" }
```

Shape hierarchy (future consideration):
- `source_code` ⊃ `typescript` ⊃ `react_component`
- Activity requiring `source_code` matches `typescript`
