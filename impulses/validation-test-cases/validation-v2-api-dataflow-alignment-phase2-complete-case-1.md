# Validation Test Case 1: Session Creation

**Test ID**: validation-v2-api-dataflow-alignment-phase2-complete-case-1  
**Phase**: Phase 1 - Session Management  
**Endpoint**: POST /v2/session  
**Purpose**: Verify session creation returns valid Base64 Bearer token and stores session in Redis

## Input

```json
{
  "endpoint": "POST /v2/session",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "org_id": "test-org-123",
    "project_id": "test-project-456"
  }
}
```

## Expected Output

```json
{
  "status": 201,
  "schema": {
    "session": "string (Base64 token)"
  }
}
```

## Validation Criteria

1. **Status Code**: Response must return 201 Created
2. **Token Format**: Response body must contain `session` field with Base64-encoded string
3. **Token Decode**: Token must decode to `sessions.{uuid}` format
4. **Redis Storage**: Session must be stored in Redis at key `sessions.{uuid}`
5. **Session Data**: Redis hash must contain `data` field with JSON:
   ```json
   {
     "session_id": "uuid",
     "org_id": "test-org-123",
     "project_id": "test-project-456",
     "created_at": "timestamp",
     "last_accessed": "timestamp"
   }
   ```

## Test Implementation

Location: `tests/validation-harnesses/v2-api-dataflow-alignment-harness.ts:52-161`

Function: `testSessionCreation()`

## Expected Result

**PASS** - Session created successfully with correct org_id and project_id stored in Redis
