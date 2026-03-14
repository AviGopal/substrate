# Validation Test Case 2: Session Retrieval

**Test**: GET /v2/session - Session Retrieval with Bearer Token
**Phase**: 1 (Session Management)
**Status**: READY

## Input

```json
{
  "endpoint": "GET /v2/session",
  "headers": {
    "Authorization": "Bearer {token_from_test_case_1}",
    "Content-Type": "application/json"
  }
}
```

## Expected Output

```json
{
  "status": 200,
  "schema": {
    "session_id": "uuid string",
    "org_id": "test-org-123",
    "project_id": "test-project-456",
    "api_key": "string | null",
    "latest_job_id": "string | null"
  },
  "validation": {
    "requiredFields": [
      "session_id",
      "org_id",
      "project_id",
      "api_key",
      "latest_job_id"
    ]
  }
}
```

## Validation Criteria

1. HTTP status must be 200 OK
2. Response must contain all required SessionData fields
3. `session_id` must be valid UUID string
4. `org_id` must match input from test case 1
5. `project_id` must match input from test case 1
6. Auth middleware must successfully decode Bearer token
7. Redis lookup must retrieve session data

## Implementation Reference

- File: `repos/metabob-activity-api/src/routes/session.ts` lines 89-117
- Auth: Bearer token required (validated by `src/middleware/auth.ts`)
- Session attached to context by auth middleware
- Route returns session from context
