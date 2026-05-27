# Cost and Metrics Impulse Shapes

## Overview

This document defines cost and metrics-related impulse shapes that the activity-api resolves. These shapes enable learning and optimization by providing visibility into execution costs, resolver performance, and vessel health.

## Shapes Resolved by Activity-API

### 1. executionCostSummary

**Description**: Aggregate cost metrics for activity executions over a time period.

**Pointer Fields**:
```typescript
{
  type: 'executionCostSummary',
  activityId?: string,     // Optional: filter by activity
  templateId?: string,     // Optional: filter by template
  vesselId?: string,       // Optional: filter by vessel
  since?: string,          // ISO8601 timestamp
  until?: string,          // ISO8601 timestamp
  groupBy?: 'day' | 'week' | 'month' | 'activity' | 'vessel'
}
```

**Content Format**: Markdown table with cost breakdown

**Query**:
```sql
SELECT
  activity_id,
  count() AS execution_count,
  math::sum(cost_usd) AS total_cost,
  math::mean(cost_usd) AS avg_cost,
  math::max(cost_usd) AS max_cost,
  math::min(cost_usd) AS min_cost
FROM execution
WHERE executed_at >= $since AND executed_at <= $until
  [AND activity_id = $activityId]
  [AND resolved_by_vessel_id = $vesselId]
GROUP BY activity_id
ORDER BY total_cost DESC
```

### 2. resolverCostAnalysis

**Description**: Cost breakdown by resolver tier and resolver ID.

**Pointer Fields**:
```typescript
{
  type: 'resolverCostAnalysis',
  shape?: string,          // Optional: filter by impulse shape
  vesselId?: string,       // Optional: filter by vessel
  since?: string,          // ISO8601 timestamp
  limit?: number           // Default: 50
}
```

**Content Format**: Markdown table with resolver cost stats

**Query**:
```sql
SELECT
  value.resolver_id AS resolver_id,
  value.resolver_tier AS resolver_tier,
  count() AS usage_count,
  math::sum(value.cost_usd) AS total_cost,
  math::mean(value.cost_usd) AS avg_cost,
  math::mean(value.latency_ms) AS avg_latency
FROM execution
SPLIT impulse_resolutions
WHERE executed_at >= $since
  [AND value.impulse_id CONTAINS $shape]
  [AND value.vessel_id = $vesselId]
GROUP BY resolver_id, resolver_tier
ORDER BY total_cost DESC
LIMIT $limit
```

### 3. vesselPerformanceMetrics

**Description**: Performance and cost metrics for a specific vessel.

**Pointer Fields**:
```typescript
{
  type: 'vesselPerformanceMetrics',
  vesselId: string,        // Required
  since?: string,          // ISO8601 timestamp
  includeResolutions?: boolean  // Include resolution breakdown
}
```

**Content Format**: Markdown with performance stats and optional resolution breakdown

**Query**:
```sql
-- Aggregate metrics
SELECT
  count() AS execution_count,
  math::mean(duration_ms) AS avg_duration,
  math::sum(cost_usd) AS total_cost,
  math::mean(cost_usd) AS avg_cost,
  count(WHERE success = true) / count() AS success_rate
FROM execution
WHERE resolved_by_vessel_id = $vesselId
  AND executed_at >= $since

-- Resolution breakdown (if includeResolutions = true)
SELECT
  value.resolver_id AS resolver_id,
  value.resolver_tier AS resolver_tier,
  count() AS usage_count,
  math::mean(value.latency_ms) AS avg_latency,
  math::sum(value.cost_usd) AS total_cost
FROM execution
SPLIT impulse_resolutions
WHERE resolved_by_vessel_id = $vesselId
  AND executed_at >= $since
GROUP BY resolver_id, resolver_tier
ORDER BY usage_count DESC
```

### 4. costByActivity

**Description**: Cost breakdown grouped by activity template.

**Pointer Fields**:
```typescript
{
  type: 'costByActivity',
  since?: string,          // ISO8601 timestamp
  until?: string,          // ISO8601 timestamp
  limit?: number,          // Default: 50
  minCost?: number         // Optional: filter activities with total_cost >= minCost
}
```

**Content Format**: Markdown table with activity costs

**Query**:
```sql
SELECT
  activity_id,
  count() AS execution_count,
  math::sum(cost_usd) AS total_cost,
  math::mean(cost_usd) AS avg_cost,
  math::mean(duration_ms) AS avg_duration,
  count(WHERE success = true) / count() AS success_rate
FROM execution
WHERE executed_at >= $since AND executed_at <= $until
GROUP BY activity_id
HAVING total_cost >= $minCost
ORDER BY total_cost DESC
LIMIT $limit
```

### 5. resolverPerformanceByShape

**Description**: Resolver performance metrics grouped by impulse shape.

**Pointer Fields**:
```typescript
{
  type: 'resolverPerformanceByShape',
  shape: string,           // Required: impulse shape to analyze
  since?: string,          // ISO8601 timestamp
  limit?: number           // Default: 20
}
```

**Content Format**: Markdown table with resolver stats for the shape

**Query**:
```sql
SELECT
  value.resolver_id AS resolver_id,
  value.resolver_tier AS resolver_tier,
  count() AS usage_count,
  math::mean(value.latency_ms) AS avg_latency,
  math::sum(value.cost_usd) AS total_cost,
  count(WHERE value.success = true) / count() AS success_rate
FROM execution
SPLIT impulse_resolutions
WHERE value.impulse_id CONTAINS $shape
  AND executed_at >= $since
GROUP BY resolver_id, resolver_tier
ORDER BY usage_count DESC
LIMIT $limit
```

### 6. costTrendOverTime

**Description**: Time-series cost data for trend analysis.

**Pointer Fields**:
```typescript
{
  type: 'costTrendOverTime',
  activityId?: string,     // Optional: filter by activity
  vesselId?: string,       // Optional: filter by vessel
  interval: 'hour' | 'day' | 'week',
  since?: string,          // ISO8601 timestamp
  until?: string           // ISO8601 timestamp
}
```

**Content Format**: Markdown table with time-series data

**Query**:
```sql
SELECT
  time::group(executed_at, $interval) AS time_bucket,
  count() AS execution_count,
  math::sum(cost_usd) AS total_cost,
  math::mean(cost_usd) AS avg_cost,
  count(WHERE success = true) / count() AS success_rate
FROM execution
WHERE executed_at >= $since AND executed_at <= $until
  [AND activity_id = $activityId]
  [AND resolved_by_vessel_id = $vesselId]
GROUP BY time_bucket
ORDER BY time_bucket ASC
```

## Implementation Notes

### Multi-Tenant Isolation

All queries must respect org_id filtering via SurrealDB PERMISSIONS:
```sql
WHERE org_id = $auth.org_id
```

This is automatically enforced by the database when using authenticated connections.

### Error Handling

- Return 400 if required fields missing
- Return 404 if no data found for filters
- Return 500 for database errors

### Response Format

All resolvers return:
```typescript
{
  impulse: {
    id: string,
    pointer: { type: string, ... },
    loaded: true,
    content: string,  // Markdown formatted
    metadata: {
      resolvedAt: string,
      resolvedBy: 'activity-api',
      rowCount?: number,
      queryTimeMs?: number
    }
  }
}
```

### Content Formatting

Use markdown tables for tabular data:
```markdown
## Execution Cost Summary

| Activity ID | Executions | Total Cost | Avg Cost | Max Cost | Success Rate |
|-------------|------------|------------|----------|----------|--------------|
| activity1   | 45         | $1.23      | $0.027   | $0.15    | 95.6%        |
| activity2   | 32         | $0.89      | $0.028   | $0.12    | 93.8%        |
```

Use sections with headers for multi-part data:
```markdown
## Vessel Performance: activity-api-pod-1

### Aggregate Metrics
- Execution Count: 234
- Average Duration: 1,250ms
- Total Cost: $5.67
- Success Rate: 94.4%

### Resolution Breakdown

| Resolver ID | Tier | Usage Count | Avg Latency | Total Cost |
|-------------|------|-------------|-------------|------------|
| file        | LOCAL| 890         | 5ms         | $0.00      |
| git         | LOCAL| 456         | 23ms        | $0.00      |
```

## Related Documentation

- [Resolver Tracking Architecture](../architecture/RESOLVER_TRACKING.md)
- [Impulse Activity Foundation](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
- [Activity API CLAUDE.md](../../repos/metabob-activity-api/CLAUDE.md)

---

**Last Updated**: 2026-04-20
