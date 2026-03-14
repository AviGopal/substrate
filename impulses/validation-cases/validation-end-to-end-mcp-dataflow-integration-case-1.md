# Validation Test Case 1: Session Token Generation and Redis Storage

**Test Case ID:** validation-end-to-end-mcp-dataflow-integration-case-1  
**Test Name:** Session Token Generation and Redis Storage  
**Category:** Integration  
**Priority:** HIGH

## Input

```json
{
  "endpoint": "POST /v2/session",
  "body": {
    "org_id": "test-org-123",
    "project_id": "test-project-456",
    "user_id": "test-user-789"
  }
}
```

## Expected Output

```json
{
  "statusCode": 200,
  "body": {
    "session_id": "<string>",
    "token": "<string>"
  },
  "redis": {
    "key": "session:info:<session_id>",
    "data": {
      "org_id": "test-org-123",
      "project_id": "test-project-456",
      "user_id": "test-user-789"
    },
    "ttl": 86400
  }
}
```

## Validation Rules

1. HTTP response status code must be 200
2. Response must include `session_id` and `token` fields
3. Redis must contain session data at key `session:info:{session_id}`
4. Session data must match input (org_id, project_id, user_id)
5. TTL must be ~24 hours (86400 seconds, ±60s variance allowed)

## Success Criteria

- All 5 validation rules pass
- Session can be retrieved from Redis
- Token can be used for subsequent API calls

