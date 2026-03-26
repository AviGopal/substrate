# Computed Views Specification

## Overview

All metrics are computed from the `execution` table rather than stored separately. This eliminates sync bugs and ensures metrics always reflect actual data.

## View: `v_activity_score`

### Purpose

Compute Thompson Sampling parameters (alpha, beta) and aggregate metrics for each activity. Replaces:
- `variant_performance_metrics.thompson_alpha`
- `variant_performance_metrics.thompson_beta`
- `activity_registry.alpha`
- `activity_registry.beta`
- `activity_registry.avg_duration_ms`
- `activity_registry.avg_cost_usd`

### Schema

```sql
DEFINE TABLE IF NOT EXISTS v_activity_score AS
  SELECT
    activity_id,
    count() AS total_executions,
    count(WHERE success = true) AS successes,
    count(WHERE success = false) AS failures,
    -- Thompson Sampling: Beta(alpha, beta) where alpha = successes + 1, beta = failures + 1
    (count(WHERE success = true) + 1) AS alpha,
    (count(WHERE success = false) + 1) AS beta,
    -- Aggregate metrics
    math::mean(duration_ms) AS avg_duration_ms,
    math::mean(cost_usd) AS avg_cost_usd,
    math::sum(cost_usd) AS total_cost_usd,
    math::sum(tokens_in) AS total_tokens_in,
    math::sum(tokens_out) AS total_tokens_out,
    -- Temporal data
    max(executed_at) AS last_executed_at,
    min(executed_at) AS first_executed_at
  FROM execution
  GROUP BY activity_id;
```

### Usage

```typescript
// Get Thompson Sampling recommendation
const activities = await db.query(`
  SELECT
    activity_id,
    alpha,
    beta,
    avg_duration_ms,
    avg_cost_usd
  FROM v_activity_score
  WHERE activity_id IN $candidates
`);

// Sample from Beta distribution for each
const ranked = activities.map(a => ({
  ...a,
  sample: betaRandom(a.alpha, a.beta)
})).sort((a, b) => b.sample - a.sample);
```

### Notes

- New activities have alpha=1, beta=1 (uninformative prior)
- Success rate = (alpha - 1) / (alpha + beta - 2)
- Higher alpha means more successful executions
- View updates automatically when executions are added

---

## View: `v_impulse_relevance`

### Purpose

Compute impulse-activity relevance scores. Replaces:
- `impulse_relevance_metrics`

### Schema

```sql
-- Per-activity impulse shape relevance
DEFINE TABLE IF NOT EXISTS v_impulse_relevance AS
  SELECT
    activity_id,
    -- Get shape from referenced impulse
    (SELECT shape FROM impulse WHERE id IN $parent.input_impulses) AS input_shapes,
    count() AS times_used,
    count(WHERE success = true) AS times_success,
    count(WHERE success = false) AS times_failure,
    -- Relevance score: P(success | impulse loaded)
    (count(WHERE success = true) * 1.0 / count()) AS relevance_score
  FROM execution
  WHERE array::len(input_impulses) > 0
  GROUP BY activity_id;
```

### Alternative: Shape-Based Aggregation

Since the above view may be complex, an alternative is a function-based approach:

```sql
-- Function to compute relevance for a specific (activity, shape) pair
DEFINE FUNCTION fn::impulse_relevance($activity_id: string, $shape: string) {
  LET $with_shape = (
    SELECT count() AS total, count(WHERE success = true) AS success
    FROM execution
    WHERE activity_id = $activity_id
      AND (SELECT shape FROM impulse WHERE id IN $parent.input_impulses) CONTAINS $shape
  );

  LET $without_shape = (
    SELECT count() AS total, count(WHERE success = true) AS success
    FROM execution
    WHERE activity_id = $activity_id
      AND !((SELECT shape FROM impulse WHERE id IN $parent.input_impulses) CONTAINS $shape)
  );

  RETURN {
    activity_id: $activity_id,
    shape: $shape,
    times_with: $with_shape.total,
    success_with: $with_shape.success,
    times_without: $without_shape.total,
    success_without: $without_shape.success,
    relevance: IF $with_shape.total > 0 THEN $with_shape.success / $with_shape.total ELSE 0,
    irrelevance: IF $without_shape.total > 0 THEN $without_shape.success / $without_shape.total ELSE 0
  };
};
```

### Usage

```typescript
// Check if an impulse shape is relevant for an activity
const relevance = await db.query(`
  RETURN fn::impulse_relevance('debug-null-pointer', 'error')
`);

// relevance.relevance >> relevance.irrelevance means "always load this impulse"
if (relevance.relevance > relevance.irrelevance + 0.1) {
  // High relevance - include this impulse
}
```

---

## View: `v_goal_paths`

### Purpose

Find composition activities that accept goal impulses (for goal-to-activity routing). Replaces:
- `goal_execution_paths`

### Schema

```sql
DEFINE TABLE IF NOT EXISTS v_goal_paths AS
  SELECT
    id AS path_id,
    name AS path_name,
    description,
    child_activities,
    input_shapes,
    output_shapes,
    org_id
  FROM activity
  WHERE execution_type = 'composition'
    AND 'goal' IN input_shapes;
```

### Extended: With Success Metrics

```sql
DEFINE TABLE IF NOT EXISTS v_goal_paths_scored AS
  SELECT
    a.id AS path_id,
    a.name AS path_name,
    a.child_activities,
    a.org_id,
    s.alpha,
    s.beta,
    s.total_executions,
    s.avg_duration_ms,
    s.avg_cost_usd
  FROM activity AS a
  LEFT JOIN v_activity_score AS s ON a.id = s.activity_id
  WHERE a.execution_type = 'composition'
    AND 'goal' IN a.input_shapes;
```

### Usage

```typescript
// Find paths for a goal
const paths = await db.query(`
  SELECT * FROM v_goal_paths_scored
  WHERE org_id = $auth.org_id
  ORDER BY (alpha - 1.0) / (alpha + beta - 2) DESC
  LIMIT 5
`);
```

---

## View: `v_composition_graph`

### Purpose

Show activity composition relationships. Replaces:
- `activity_composition_graph`

### Schema

```sql
DEFINE TABLE IF NOT EXISTS v_composition_graph AS
  SELECT
    activity_id AS parent_id,
    (SELECT child_activities FROM activity WHERE id = $parent.activity_id)[0] AS children,
    count() AS execution_count,
    count(WHERE success = true) AS success_count,
    (count(WHERE success = true) * 1.0 / count()) AS success_rate
  FROM execution
  WHERE parent_execution_id IS NONE
    AND activity_id IN (SELECT id FROM activity WHERE execution_type = 'composition')
  GROUP BY activity_id;
```

### Alternative: Derived from execution.parent_execution_id

```sql
-- Direct parent-child from execution traces
DEFINE TABLE IF NOT EXISTS v_execution_tree AS
  SELECT
    parent_execution_id AS parent,
    id AS child,
    activity_id,
    success,
    duration_ms
  FROM execution
  WHERE parent_execution_id IS NOT NONE;
```

---

## View: `v_tool_usage`

### Purpose

Aggregate tool usage patterns. Replaces:
- `tool_usage`
- `tool_usage_patterns`

### Schema

```sql
DEFINE TABLE IF NOT EXISTS v_tool_usage AS
  SELECT
    activity_id AS tool_id,
    (SELECT tool_name FROM activity WHERE id = $parent.activity_id)[0] AS tool_name,
    count() AS call_count,
    count(WHERE success = true) AS success_count,
    count(WHERE success = false) AS failure_count,
    math::mean(duration_ms) AS avg_duration_ms,
    max(executed_at) AS last_used_at
  FROM execution
  WHERE activity_id IN (SELECT id FROM activity WHERE execution_type = 'tool')
  GROUP BY activity_id;
```

### Usage

```typescript
// Get tool usage stats
const toolStats = await db.query(`
  SELECT * FROM v_tool_usage
  ORDER BY call_count DESC
  LIMIT 10
`);
```

---

## View: `v_vessel_activity`

### Purpose

Track vessel activity and health.

### Schema

```sql
DEFINE TABLE IF NOT EXISTS v_vessel_activity AS
  SELECT
    vessel_id,
    count() AS total_executions,
    count(WHERE success = true) AS successful,
    count(WHERE success = false) AS failed,
    math::mean(duration_ms) AS avg_duration_ms,
    math::sum(cost_usd) AS total_cost_usd,
    max(executed_at) AS last_execution_at
  FROM execution
  WHERE vessel_id IS NOT NONE
  GROUP BY vessel_id;
```

---

## Materialization Strategy

### When to Materialize

Views should be materialized when:
1. Query time exceeds 100ms for common operations
2. View is queried more than 100x per minute
3. Underlying data changes infrequently

### Materialization Approach

```sql
-- Create materialized table
DEFINE TABLE activity_score_mat SCHEMAFULL;

-- Copy view schema
DEFINE FIELD activity_id ON activity_score_mat TYPE string;
DEFINE FIELD total_executions ON activity_score_mat TYPE int;
-- ... other fields

-- Refresh function (called periodically or on execution insert)
DEFINE FUNCTION fn::refresh_activity_scores() {
  DELETE activity_score_mat;
  INSERT INTO activity_score_mat (SELECT * FROM v_activity_score);
  RETURN "refreshed";
};

-- Trigger on execution insert (optional)
DEFINE EVENT refresh_on_execution ON TABLE execution WHEN $event = "CREATE" THEN {
  -- Debounce: only refresh if last refresh > 1 minute ago
  IF (SELECT count() FROM activity_score_mat WHERE activity_id = $after.activity_id) = 0 {
    fn::refresh_activity_scores();
  };
};
```

### Redis Cache Layer

For highest performance, cache Thompson Sampling scores in Redis:

```typescript
async function getActivityScores(activityIds: string[]): Promise<ActivityScore[]> {
  // Try Redis first
  const cached = await redis.mget(activityIds.map(id => `score:${id}`));
  const missing = activityIds.filter((_, i) => !cached[i]);

  if (missing.length > 0) {
    // Fetch from SurrealDB
    const scores = await db.query(`
      SELECT * FROM v_activity_score WHERE activity_id IN $missing
    `, { missing });

    // Cache for 1 minute
    await Promise.all(scores.map(s =>
      redis.setex(`score:${s.activity_id}`, 60, JSON.stringify(s))
    ));
  }

  return activityIds.map((id, i) =>
    cached[i] ? JSON.parse(cached[i]) : scores.find(s => s.activity_id === id)
  );
}
```
