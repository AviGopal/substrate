# Validation Test Case 4: Template List

**Test**: GET /v2/activities/templates - List templates with Thompson Sampling
**Phase**: 2 (Template Listing)
**Status**: READY (as of 2026-03-14 enforcement)

## Input

```json
{
  "endpoint": "GET /v2/activities/templates",
  "headers": {
    "Authorization": "Bearer {token_from_test_case_1}",
    "Content-Type": "application/json"
  },
  "query": {
    "category": "feature",
    "limit": 50
  }
}
```

## Expected Output

```json
{
  "status": 200,
  "schema": {
    "templates": [
      {
        "variant_id": "string",
        "activity_id": "string",
        "variant_name": "string",
        "description": "string",
        "category": "string",
        "scope": "string | null",
        "org_id": "string | null",
        "project_id": "string | null",
        "metrics": {
          "thompson_alpha": "number",
          "thompson_beta": "number",
          "success_rate": "number",
          "total_executions": "number",
          "avg_duration_ms": "number",
          "avg_cost_usd": "number"
        }
      }
    ],
    "total": "number"
  },
  "validation": {
    "dataSource": "SurrealDB with Redis cache-aside",
    "multiTenantFiltering": "org_id/project_id scope isolation",
    "thompsonSampling": "Alpha/Beta parameters included"
  }
}
```

## Validation Criteria

1. HTTP status must be 200 OK
2. Response must contain `templates` array
3. Each template must have Thompson Sampling metrics
4. Required metrics: `thompson_alpha`, `thompson_beta`, `success_rate`, `total_executions`
5. Multi-tenant filtering must be applied (global + org + project templates visible)
6. Cache-aside pattern: Redis cache checked first, SurrealDB on miss
7. Templates must be filtered by category if specified
8. Limit must be enforced (max 100, default 50)

## Implementation Reference

- File: `repos/metabob-activity-api/src/routes/activities.ts` lines 127-244
- Auth: Bearer token required (session provides org_id/project_id)
- Cache: Redis keys `activity:templates:list` and `activity:template:{variant_id}`
- Cache TTL: 3600 seconds (1 hour)
- SurrealDB query: Scope-based filtering on `activity_template` table
