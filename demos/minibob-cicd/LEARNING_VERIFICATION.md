# Learning System Verification

## Score Update Flow

When an activity executes, scores are updated through this pipeline:

```
1. MiniBob executes activity
   ├── Extracts input shapes from impulses (inferShape())
   └── Extracts output shapes from created impulses

2. MiniBob sends execution trace to backend
   └── POST /v2/activities/executions
       ├── input_impulse_shapes: ["file:source", "spec:error-handling"]
       └── output_impulse_shapes: ["analysis:violations", "spec_validation_result"]

3. Backend updates Thompson Sampling scores
   ├── Fetches declared output_shapes from activity template
   ├── Computes Jaccard similarity (actual vs declared)
   ├── Computes weighted success score:
   │   └── success + shape_match → alphaDelta, betaDelta
   └── Updates activity table:
       └── thompson_alpha += alphaDelta, thompson_beta += betaDelta

4. Backend updates shape-conditioned scores (async)
   └── UPSERT impulse_shape_activity_score
       ├── For each input shape
       ├── Increments success_count or failure_count
       └── Updates alpha/beta for shape-conditioned selection
```

## Verification Checklist

### 1. Activity Templates Have Shapes

Our primitives declare shapes correctly:

| Activity | inputShapes | outputShapes |
|----------|-------------|--------------|
| `read-source-file` | `["file:path"]` | `["file:source", "file:metadata"]` |
| `analyze-error-patterns` | `["file:source", "spec:error-handling"]` | `["analysis:functions", "analysis:violations"]` |
| `produce-violations-report` | `["analysis:violations", "spec:id"]` | `["spec_validation_result"]` |

### 2. Activities Produce Output Files with Shape Markers

Each activity must write output files with a `"shape"` field:

```json
// outputs/file-source.json
{
  "shape": "file:source",
  "path": "src/tools.ts",
  "content": "...",
  "language": "typescript",
  "lineCount": 1500
}

// outputs/analysis-violations.json
{
  "shape": "analysis:violations",
  "violations": [...],
  "totalViolations": 23
}

// results/specification-violations.json
{
  "shape": "spec_validation_result",
  "totalViolations": 23,
  "compliance": 0.24,
  "specId": "error-handling",
  "violations": [...]
}
```

### 3. MiniBob Creates Output Impulses

When tasks complete, they should create impulses with shape metadata:

```typescript
// Task creates output impulse
const outputImpulse = {
  id: "output-analysis-violations",
  pointer: { type: "file", path: "outputs/analysis-violations.json" },
  metadata: {
    shape: "analysis:violations"  // Critical for learning
  }
};
```

### 4. Backend Receives Shapes in Trace

The execution trace sent to backend should include:

```json
{
  "execution_id": "exec_...",
  "activity_id": "analyze-error-patterns",
  "success": true,
  "input_impulse_shapes": ["file:source", "spec:error-handling"],
  "output_impulse_shapes": ["analysis:functions", "analysis:violations"]
}
```

### 5. Thompson Sampling Updates

After execution, backend updates:

```sql
-- activity table
UPDATE activity
SET
  thompson_alpha = thompson_alpha + 0.85,  -- weighted by shape match
  thompson_beta = thompson_beta + 0.15,
  total_executions = total_executions + 1
WHERE id = "analyze-error-patterns"

-- impulse_shape_activity_score table (per shape)
UPSERT impulse_shape_activity_score:["org_123", "file:source", "analyze-error-patterns"]
MERGE {
  success_count: success_count + 1,
  alpha: success_count + 2,
  beta: failure_count + 1
}
```

## Testing the Learning Loop

### Manual Verification

1. **Run activity and check trace**:
```bash
cd demos/minibob-cicd
minibob --single "validate error handling in node_modules/@metabob/minibob/src/tools.ts" -vv
```

2. **Check execution trace was stored**:
```bash
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/executions?limit=1" | jq '.executions[0] | {
    activity_id,
    success,
    input_impulse_shapes,
    output_impulse_shapes
  }'
```

3. **Check Thompson Sampling scores**:
```bash
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/templates/analyze-error-patterns" | jq '{
    thompson_alpha: .metrics.thompson_alpha,
    thompson_beta: .metrics.thompson_beta,
    success_rate: .metrics.success_rate
  }'
```

4. **Check shape-conditioned scores**:
```bash
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/shape-scores?activity_id=analyze-error-patterns"
```

## Key Implementation Details

### Shape Extraction (MiniBob)

From `repos/minibob/src/improviser.ts:inferShape()`:
- Uses `impulse.metadata?.shape` if present
- Falls back to pointer type inference
- Falls back to file path pattern matching

### Shape Match Scoring (Backend)

From `repos/metabob-activity-api/src/services/thompson-sampling.ts`:
- Jaccard similarity: `|intersection| / |union|`
- Weighted success: `0.7 * shapeMatch + 0.3` (success), `0` (failure)
- Alpha/Beta update: `alphaDelta = weightedScore`, `betaDelta = 1 - weightedScore`

### Shape-Conditioned Selection (Backend)

From `repos/metabob-activity-api/src/routes/activities.ts`:
- Scores stored per `(org_id, shape, activity_id)` tuple
- Used when `impulse_shapes` provided in recommendation request
- Enables learning which activities work best for specific input shapes

## What We Verified

1. ✅ Thompson Sampling scores are updated after each execution
2. ✅ Shape match scoring uses Jaccard similarity
3. ✅ Shape-conditioned scores track per-shape success rates
4. ✅ MiniBob extracts shapes from impulses
5. ✅ Backend updates scores atomically
6. ✅ Recommendations use shape-conditioned scores when shapes provided

## What Activities Must Do

For proper learning:

1. **Declare shapes in template** - `inputShapes` and `outputShapes` fields
2. **Write output files** - MiniBob infers shapes from file paths
3. **Let MiniBob report traces** - Don't disable MCP reporting

## Shape Inference from File Paths

MiniBob infers shapes from file paths using patterns in `SHAPE_PATTERNS`:

| Pattern | Inferred Shape |
|---------|----------------|
| `*.ts, *.js, *.py, etc.` | `source_code` |
| `*.test.ts, *.spec.js` | `test_file` |
| `*.json` | `json_data` |
| `*.log, *error*` | `error_log` |
| `*.md, README*` | `documentation` |
| `*trace*.json` | `execution_trace` |

**Key Insight**: Shapes are learned, not fixed. Even if our custom shapes like `file:source` get inferred as `json_data`, the system learns:
- Which activities produce `json_data` in `outputs/` directory
- Which activities consume `json_data` from `outputs/` directory
- Success rates for different shape+activity combinations

The learning happens through Thompson Sampling - activities that produce the right outputs (validated by `requiredFiles`) get higher scores, regardless of the exact shape name.

## State Transition Tracking

Activities also contribute to state transition learning:

1. **State Snapshot** - Before execution, MiniBob captures:
   - Impulse types present
   - Last activity executed
   - Git state (changes, branch)
   - Goal context

2. **State Signature** - Hashed for pattern matching:
   ```json
   {
     "impulse_types_present": ["file:source", "spec:error-handling"],
     "last_activity_id": "read-source-file",
     "has_git_changes": true,
     "goal_type": "validation"
   }
   ```

3. **Pattern Learning** - Backend learns:
   - "When state has these impulses + this last activity → recommend this next activity"
   - Patterns are discovered from execution data, not predefined

## Summary

The learning system works at multiple levels:

| Level | What's Learned | How It's Used |
|-------|----------------|---------------|
| **Activity scores** | Overall success rate | Thompson Sampling selection |
| **Shape match scores** | Output shape accuracy | Weighted success updates |
| **Shape-conditioned scores** | Per-input-shape success | Context-aware recommendations |
| **State patterns** | State→activity mapping | Pattern-based recommendations |

All learning is automatic - execute activities, the system learns what works.
