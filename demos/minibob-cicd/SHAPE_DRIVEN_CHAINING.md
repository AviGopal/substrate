# Shape-Driven Activity Chaining

## Core Principle

Activities produce output shapes that move us closer to a goal. We don't expect to reach the endpoint in one step - just to get closer.

## The Flow

```
Goal: Produce spec_validation_result from file:path

1. Query: "What activities produce spec_validation_result?"
   → Found: produce-violations-report (needs analysis:violations)

2. Query: "What activities produce analysis:violations?"
   → Found: analyze-error-patterns (needs file:source)

3. Query: "What activities produce file:source?"
   → Found: read-source-file (needs file:path)

4. We have file:path! Chain is complete:
   file:path → read-source-file → file:source → analyze-error-patterns → analysis:violations → produce-violations-report → spec_validation_result
```

## Search and Create

When searching for activities:

1. **Search by output shapes** - Query `/v2/activities/recommend` with target shapes
2. **If found** - Use Thompson Sampling's top recommendation
3. **If missing** - Create a primitive activity that handles the shape

### Creating Primitives

When no activity produces a needed shape:

```json
{
  "id": "primitive-for-<shape>",
  "category": "primitive",
  "inputShapes": ["<available shapes>"],
  "outputShapes": ["<needed shape>"],
  "tasks": [{
    "id": "produce",
    "prompt": {
      "template": "Transform input shapes into <needed shape>..."
    },
    "validation": {
      "requiredFiles": ["outputs/<shape>.json"]
    },
    "outputShapes": ["<needed shape>"]
  }]
}
```

## Shapes Are Learned

Shapes don't have fixed schemas. The system learns acceptable structures through:

1. **Successful executions** - Activities that produce shapes and lead to successful outcomes
2. **Thompson Sampling** - Learns which shape structures work best
3. **Pattern extraction** - Ribosome identifies common structures

What matters:
- Include a `"shape"` field identifying what the data is
- Structure it reasonably for the domain
- The system will learn what works

## Output Files

Each activity should write its output shapes to files:

```
outputs/
├── file-source.json         # shape: file:source
├── analysis-functions.json  # shape: analysis:functions
├── analysis-violations.json # shape: analysis:violations
results/
└── specification-violations.json  # shape: spec_validation_result
```

## Progression Model

The orchestrating activity describes progression, not fixed composition:

```json
{
  "progression": {
    "steps": [
      {
        "goal": "Get source code",
        "inputShapes": ["file:path"],
        "outputShapes": ["file:source"],
        "note": "Search for activity handling this transformation"
      },
      {
        "goal": "Analyze for violations",
        "inputShapes": ["file:source"],
        "outputShapes": ["analysis:violations"]
      }
    ]
  }
}
```

Each step is a transformation query, not a hardcoded activity ID.

## Key Differences from Hardcoded Composition

| Hardcoded | Shape-Driven |
|-----------|--------------|
| `"activityId": "read-source-file"` | Search for `file:path→file:source` |
| Static chain | Dynamic discovery |
| Breaks if activity removed | Finds alternatives |
| One way to complete | Thompson Sampling picks best |

## Integration with Recommendations API

The `/v2/activities/recommend` endpoint already supports shape-based filtering:

```
POST /v2/activities/recommend
{
  "task_description": "Produce analysis:violations from file:source",
  "impulse_shapes": ["file:source", "spec:error-handling"],
  "expected_output_shapes": ["analysis:violations"],
  "limit": 5
}

Response:
{
  "recommendations": [
    {
      "template_id": "analyze-error-patterns",
      "input_shapes": ["file:source", "spec:error-handling"],
      "output_shapes": ["analysis:functions", "analysis:violations"],
      "selection_metadata": {
        "method": "thompson_sampling",
        "sample": 0.85,
        "alpha": 12,
        "beta": 3,
        "boosts": {
          "output_shape_coverage": 4
        },
        "output_shape_analysis": {
          "expected_shapes": ["analysis:violations"],
          "activity_output_shapes": ["analysis:functions", "analysis:violations"],
          "coverage": 1.0,
          "boost": 4
        }
      }
    }
  ]
}
```

**Key parameters:**
- `impulse_shapes`: What shapes are available as input (filters by input compatibility)
- `expected_output_shapes`: What shapes we want to produce (boosts activities that output these)

**Thompson Sampling boosts:**
- Activities covering expected output shapes get +0 to +4 boost based on coverage
- 100% coverage = +4 boost to alpha parameter
- This means activities that produce exactly what we need rise to the top

### Building a Chain

```javascript
async function buildChain(availableShapes, targetShapes) {
  const chain = [];
  let currentShapes = new Set(availableShapes);

  while (!targetShapes.every(s => currentShapes.has(s))) {
    // Find activity that produces shapes we need
    const { recommendations } = await fetch('/v2/activities/recommend', {
      method: 'POST',
      body: JSON.stringify({
        task_description: `Produce ${[...targetShapes].join(', ')}`,
        impulse_shapes: [...currentShapes],
        expected_output_shapes: targetShapes.filter(s => !currentShapes.has(s)),
        limit: 1
      })
    }).then(r => r.json());

    if (recommendations.length === 0) {
      // No activity found - create primitive
      break;
    }

    const activity = recommendations[0];
    chain.push(activity);

    // Add output shapes to current shapes
    activity.output_shapes.forEach(s => currentShapes.add(s));
  }

  return chain;
}
```

The goal processor uses this to build chains dynamically, learning which activities work best for each shape transformation over time.
