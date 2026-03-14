# Validation Test Case 2: Template Listing with Bearer Token Authentication

**Test Case ID:** validation-end-to-end-mcp-dataflow-integration-case-2  
**Test Name:** Template Listing with Bearer Token Authentication  
**Category:** Integration  
**Priority:** HIGH

## Input

```json
{
  "prerequisites": "Valid session token from case-1",
  "endpoint": "GET /v2/activities/templates?limit=10",
  "headers": {
    "Authorization": "Bearer <token>"
  }
}
```

## Expected Output

```json
{
  "statusCode": 200,
  "body": [
    {
      "id": "<string>",
      "name": "<string>",
      "category": "<string>",
      "success_rate": "<number [0,1]>",
      "expected_value": "<number>",
      "alpha": "<number ≥ 1>",
      "beta": "<number ≥ 1>",
      "task_steps": "<array (optional)>"
    }
  ]
}
```

## Validation Rules

1. HTTP response status code must be 200
2. Response must be an array
3. Each template must have required fields: id, name, category
4. Thompson Sampling fields are optional but if present must be valid
5. Unauthenticated requests must be rejected (401/403)
6. Invalid tokens must be rejected (401/403)

## Success Criteria

- All validation rules pass
- At least one template is returned (if database is seeded)
- Templates have correct structure

