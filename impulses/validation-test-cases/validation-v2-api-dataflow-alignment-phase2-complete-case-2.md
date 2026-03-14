# Validation Test Case 2: Session Retrieval

**Test ID**: validation-v2-api-dataflow-alignment-phase2-complete-case-2  
**Phase**: Phase 1 - Session Management  
**Endpoint**: GET /v2/session  
**Purpose**: Verify session retrieval with Bearer token returns session data from Redis

## Input

```json
{
  "endpoint": "GET /v2/session",
  "headers": {
    "Authorization": "Bearer {token from case 1}",
    "Content-Type": "application/json"
  }
}
```

## Expected Output

```json
{
  "status": 200,
  "schema": {
    "session_id": "string",
    "org_id": "string",
    "project_id": "string",
    "created_at": "timestamp",
    "last_accessed": "timestamp"
  }
}
```

## Validation Criteria

1. **Status Code**: Response must return 200 OK
2. **Required Fields**: Response must contain `session_id`, `org_id`, `project_id`
3. **Data Accuracy**: 
   - `org_id` must match `test-org-123`
   - `project_id` must match `test-project-456`
4. **Authentication**: Bearer token must be validated via auth middleware
5. **TTL Extension**: Redis TTL should be extended to 86400s (24 hours) on access

## Test Implementation

Location: `tests/validation-harnesses/v2-api-dataflow-alignment-harness.ts:167-222`

Function: `testSessionRetrieval(bearerToken: string)`

## Expected Result

**PASS** - Session retrieved successfully with Bearer token, all required fields present
