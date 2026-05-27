# Cost/Metrics Shapes Implementation Summary

## Overview

Implemented 6 new impulse shapes in metabob-activity-api to enable cost tracking, resolver performance analysis, and vessel health monitoring.

**Date**: 2026-04-20  
**Branch**: docs/resolver-tracking

## Implemented Shapes

### 1. executionCostSummary
**Purpose**: Aggregate cost metrics for activity executions over a time period.

**Pointer Fields**:
- `activityId` (optional): Filter by activity
- `vesselId` (optional): Filter by vessel
- `since` (optional): Start date (default: 7 days ago)
- `until` (optional): End date (default: now)
- `groupBy` (optional): Grouping strategy (day/week/month/activity/vessel)

**Returns**: Markdown table with execution counts, total/avg/max/min costs per activity.

### 2. resolverCostAnalysis
**Purpose**: Cost breakdown by resolver tier and resolver ID.

**Pointer Fields**:
- `shape` (optional): Filter by impulse shape
- `vesselId` (optional): Filter by vessel
- `since` (optional): Start date (default: 7 days ago)
- `limit` (optional): Max results (default: 50)

**Returns**: Markdown table with usage count, latency, costs per resolver. Includes tier-level summary.

### 3. vesselPerformanceMetrics
**Purpose**: Performance and cost metrics for a specific vessel.

**Pointer Fields**:
- `vesselId` (required): Vessel to analyze
- `since` (optional): Start date (default: 7 days ago)
- `includeResolutions` (optional): Include resolution breakdown (default: true)

**Returns**: Markdown with aggregate metrics (execution count, avg duration, total cost, success rate) and optional resolver breakdown.

### 4. costByActivity
**Purpose**: Cost breakdown grouped by activity template.

**Pointer Fields**:
- `since` (optional): Start date (default: 7 days ago)
- `until` (optional): End date (default: now)
- `limit` (optional): Max results (default: 50)
- `minCost` (optional): Filter activities with total_cost >= threshold

**Returns**: Markdown table with execution count, total/avg cost, avg duration, success rate per activity.

### 5. resolverPerformanceByShape
**Purpose**: Resolver performance metrics grouped by impulse shape.

**Pointer Fields**:
- `shape` (required): Impulse shape to analyze
- `since` (optional): Start date (default: 7 days ago)
- `limit` (optional): Max results (default: 20)

**Returns**: Markdown table with usage count, latency, cost, success rate per resolver. Includes recommendations for fastest and most reliable resolvers.

### 6. costTrendOverTime
**Purpose**: Time-series cost data for trend analysis.

**Pointer Fields**:
- `activityId` (optional): Filter by activity
- `vesselId` (optional): Filter by vessel
- `interval` (required): Time bucket size (hour/day/week)
- `since` (optional): Start date (default: 7 days ago)
- `until` (optional): End date (default: now)

**Returns**: Markdown table with time buckets, execution counts, costs, success rates. Includes trend analysis comparing first and last periods.

## Files Modified

### 1. /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/src/services/impulse-formatters.ts
**Added 6 formatter functions** (lines 616-841):
- `formatExecutionCostSummaryAsMarkdown()`
- `formatResolverCostAnalysisAsMarkdown()`
- `formatVesselPerformanceMetricsAsMarkdown()`
- `formatCostByActivityAsMarkdown()`
- `formatResolverPerformanceByShapeAsMarkdown()`
- `formatCostTrendOverTimeAsMarkdown()`

**Purpose**: Format query results as markdown tables for LLM consumption.

### 2. /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/src/routes/impulses.ts
**Added 6 resolver cases** (lines 1491-1771):
- Import statements for new formatters (lines 26-35)
- Case handlers in switch statement for each shape
- Query construction with dynamic filters
- Error handling (400 for missing fields, 404 for no data)
- Multi-tenant isolation (org_id filtering via SurrealDB PERMISSIONS)

**Pattern**: Each resolver follows the same structure:
1. Extract and validate pointer fields
2. Build dynamic WHERE clause and params
3. Execute SurrealDB query
4. Format results as markdown
5. Return loaded impulse

### 3. /home/avi/documents/work/exp-repo/metabob-devbob/CLAUDE.md
**Updated Activity-API shapes** (lines 337-348):
Added 6 new cost/metrics shapes to the documented list.

### 4. /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/CLAUDE.md
**Updated registered shapes** (lines 195-208):
Added 6 new cost/metrics shapes to the advertised capabilities.

### 5. /home/avi/documents/work/exp-repo/metabob-devbob/docs/shapes/COST_METRICS_SHAPES.md
**Created design document** (new file):
- Shape definitions with pointer fields
- Query patterns for each shape
- Content formatting guidelines
- Multi-tenant isolation notes
- Error handling patterns

## Database Schema

All resolvers query the existing `execution` table schema:
- `execution.cost_usd` - Execution cost
- `execution.duration_ms` - Execution duration
- `execution.success` - Success/failure flag
- `execution.activity_id` - Activity template ID
- `execution.resolved_by_vessel_id` - Vessel that executed
- `execution.impulse_resolutions[]` - Per-impulse resolution data
  - `impulse_id` - Impulse identifier
  - `resolver_id` - Resolver used
  - `resolver_tier` - Resolver tier (LOCAL/CUSTOM/DISCOVERY/MCP/etc.)
  - `vessel_id` - Vessel that resolved
  - `latency_ms` - Resolution duration
  - `cost_usd` - Resolution cost
  - `success` - Resolution success flag

**No schema changes required** - all data already exists from Phase 1 resolver tracking.

## Query Patterns

### Aggregate Queries
All cost summary shapes use SurrealDB aggregate functions:
- `count()` - Execution/resolution counts
- `math::sum()` - Total costs
- `math::mean()` - Average costs/latencies
- `math::max()` / `math::min()` - Cost ranges

### SPLIT Queries
Resolver-level shapes use `SPLIT impulse_resolutions` to unnest the array and group by resolver properties.

### Time Grouping
`costTrendOverTime` uses `time::group(executed_at, $interval)` for time-series bucketing.

### Dynamic Filtering
All resolvers support optional filters via dynamic WHERE clause construction:
```typescript
const conditions: string[] = ['executed_at >= type::datetime($since)'];
if (activityId) {
  conditions.push('activity_id = $activityId');
  params.activityId = activityId;
}
const whereClause = conditions.join(' AND ');
```

## Multi-Tenant Isolation

All queries automatically respect `org_id` filtering via SurrealDB PERMISSIONS.

**From schema** (`sql/020-paradigm-core-tables.surql`):
```sql
DEFINE TABLE execution SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
    FOR create WHERE org_id = $auth.org_id
```

**Result**: No explicit org_id filtering needed in application code. Database enforces isolation at query level.

## Error Handling

### 400 Bad Request
- Missing required fields (`vesselId` for vesselPerformanceMetrics, `shape` for resolverPerformanceByShape, etc.)

### 404 Not Found
- No data found for the specified filters
- Empty result sets

### 500 Internal Server Error
- Database query failures (caught by Hono error handler)

## Testing

### Type Checking
```bash
cd repos/metabob-activity-api
bun run typecheck
# ✅ PASSED (0 errors)
```

### Manual Testing Pattern
```bash
# Start local activity-api
cd repos/metabob-activity-api
bun run dev

# Test resolver via curl
curl -X POST http://localhost:8080/v2/impulses/resolve \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "impulses": [{
      "id": "test-cost-summary",
      "pointer": {
        "type": "executionCostSummary",
        "since": "2026-04-13T00:00:00Z"
      }
    }]
  }'
```

## Next Steps

### Phase 2: Discovery Registration
Update `src/services/discovery-client.ts` to advertise the new shapes:
```typescript
const shapes = [
  // ... existing shapes ...
  'executionCostSummary',
  'resolverCostAnalysis',
  'vesselPerformanceMetrics',
  'costByActivity',
  'resolverPerformanceByShape',
  'costTrendOverTime'
];
```

### Phase 3: Dashboard Integration
Create visualization components in activity-dashboard:
- Cost over time charts (line/area)
- Resolver performance comparison (bar)
- Vessel health monitoring (gauge)
- Activity cost leaderboard (table)

### Phase 4: MiniBob Integration
Add cost optimization activities:
- "Analyze cost trends for the last 30 days"
- "Find the most expensive activities"
- "Identify slow resolvers for shape X"
- "Compare vessel performance"

## Related Documentation

- [Resolver Tracking Architecture](../architecture/RESOLVER_TRACKING.md)
- [Cost/Metrics Shapes Design](./COST_METRICS_SHAPES.md)
- [Impulse Activity Foundation](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
- [Activity API CLAUDE.md](../../repos/metabob-activity-api/CLAUDE.md)

---

**Last Updated**: 2026-04-20
