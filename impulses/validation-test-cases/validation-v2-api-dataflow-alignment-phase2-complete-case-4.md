# Validation Test Case 4: Template List

**Test ID**: validation-v2-api-dataflow-alignment-phase2-complete-case-4  
**Phase**: Phase 2 - Template Routes  
**Endpoint**: GET /v2/activities/templates  
**Purpose**: Verify template listing with Thompson Sampling metrics, Redis cache-aside pattern, and multi-tenant filtering

## Input

```json
{
  "endpoint": "GET /v2/activities/templates",
  "headers": {
    "Authorization": "Bearer {token}",
    "Content-Type": "application/json"
  },
  "queryParams": {
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
    "templates": "array",
    "total": "number"
  },
  "templateSchema": {
    "variant_id": "string",
    "activity_id": "string",
    "name": "string",
    "category": "string",
    "scope": "global | org | project",
    "metrics": {
      "thompson_alpha": "number",
      "thompson_beta": "number",
      "success_rate": "number",
      "total_executions": "number",
      "successful_executions": "number",
      "failed_executions": "number",
      "avg_duration_ms": "number",
      "avg_cost_usd": "number"
    }
  }
}
```

## Validation Criteria

1. **Status Code**: Response must return 200 OK
2. **Response Schema**: Must contain `templates` (array) and `total` (number)
3. **Thompson Sampling Metrics**: Each template must have:
   - `metrics.thompson_alpha` (number)
   - `metrics.thompson_beta` (number)
   - `metrics.success_rate` (number)
   - `metrics.total_executions` (number)
4. **Category Filtering**: If category specified, all templates must match
5. **Pagination**: Templates limited to max 100 (default 50)
6. **Multi-Tenant Filtering**: Templates filtered by org_id/project_id from session
7. **Cache-Aside Pattern**: 
   - Check Redis `activity:templates:list` (SET of variant_ids)
   - On cache hit: Load from Redis `activity:template:{variant_id}`
   - On cache miss: Query SurrealDB → populate Redis with 1hr TTL

## Test Implementation

Location: `tests/validation-harnesses/v2-api-dataflow-alignment-harness.ts:277-355`

Function: `testTemplateList(bearerToken: string)`

## Expected Result

**PASS** - Templates retrieved with complete Thompson Sampling metrics, proper filtering, and cache strategy
