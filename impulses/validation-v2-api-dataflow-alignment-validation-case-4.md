# Validation Test Case 4: Template List with Thompson Sampling

**Test ID**: validation-v2-api-dataflow-alignment-validation-case-4
**Type**: Input/Output Validation
**Component**: GET /v2/activities/templates

## Input

```json
{
  "method": "GET",
  "url": "http://localhost:8080/v2/activities/templates?category=feature&limit=10",
  "headers": {
    "Authorization": "Bearer <Base64 token>",
    "Content-Type": "application/json"
  }
}
```

## Expected Output

```json
{
  "status": 200,
  "body": {
    "templates": [
      {
        "variant_id": "string",
        "name": "string",
        "description": "string",
        "category": "feature",
        "scope": "global|org|project",
        "org_id": "string|null",
        "project_id": "string|null",
        "metrics": {
          "thompson_alpha": "number",
          "thompson_beta": "number",
          "success_rate": "number",
          "total_executions": "number",
          "avg_cost": "number",
          "avg_duration_ms": "number"
        }
      }
    ],
    "total": "number"
  }
}
```

## Validation Criteria

1. ✅ Response status is 200
2. ✅ Response contains `templates` array
3. ✅ Each template has `metrics` object
4. ✅ Metrics include `thompson_alpha` and `thompson_beta` (Thompson Sampling)
5. ✅ Metrics include `success_rate`, `total_executions`
6. ✅ Templates filtered by category if specified
7. ✅ Limit enforced (max 100)
8. ✅ Multi-tenant scope filtering applied (global/org/project)

## Code Review Validation Result

**Status**: ✅ PASS (Code Review)

**Evidence** (repos/metabob-activity-api/src/routes/activities.ts:126-269):

**Redis Cache-Aside Pattern** (lines 149-181):
- Check cache: `smembers("activity:templates:list")`
- Load from cache: `get("activity:template:{variantId}")`
- Cache miss triggers SurrealDB query

**SurrealDB Query with Scope Filtering** (lines 68-108):
```typescript
// Project scope
WHERE (scope IS NULL OR scope = 'global'
       OR (scope = 'org' AND org_id = $org_id)
       OR (scope = 'project' AND project_id = $project_id))

// Org scope
WHERE (scope IS NULL OR scope = 'global'
       OR (scope = 'org' AND org_id = $org_id))

// No scope
WHERE (scope IS NULL OR scope = 'global')
```

**Thompson Sampling Metrics** (src/models/schemas.ts:46-64):
- thompson_alpha: z.number()
- thompson_beta: z.number()
- success_rate: z.number()
- total_executions: z.number()

**Category Filtering** (lines 217-220):
```typescript
if (category) {
  filteredTemplates = allTemplates.filter(t => t.category === category);
}
```

**Client-Side Scope Enforcement** (lines 225-245):
- Double-check scope isolation
- Filter out templates that don't match session scope

**Conclusion**: Implementation matches Python RPC API list_templates with full Thompson Sampling support and Redis cache-aside pattern.
