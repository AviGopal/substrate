# Validation Test Case 2: Session Retrieval

**Test ID**: validation-v2-api-dataflow-alignment-validation-case-2
**Type**: Input/Output Validation
**Component**: GET /v2/session

## Input

```json
{
  "method": "GET",
  "url": "http://localhost:8080/v2/session",
  "headers": {
    "Authorization": "Bearer <Base64 token from test case 1>",
    "Content-Type": "application/json"
  }
}
```

## Expected Output

```json
{
  "status": 200,
  "body": {
    "session_id": "{uuid}",
    "org_id": "test-org-123",
    "project_id": "test-project-456",
    "api_key": null,
    "latest_job_id": null
  }
}
```

## Validation Criteria

1. ✅ Response status is 200
2. ✅ Response contains required fields: session_id, org_id, project_id
3. ✅ org_id matches the value from session creation
4. ✅ project_id matches the value from session creation

## Code Review Validation Result

**Status**: ✅ PASS (Code Review)

**Evidence** (repos/metabob-activity-api/src/middleware/auth.ts:16-73, src/routes/session.ts:89-117):
- Auth middleware extracts Bearer token (line 28)
- Base64 decode to get sessionKey (line 40)
- Redis hget to retrieve session data (line 45)
- Parse and validate with Zod (line 55)
- Extend TTL on access (lines 58-61)
- Attach to context (line 64)
- Route handler retrieves from context (line 100) and returns JSON (line 106)

**Conclusion**: Implementation matches Python RPC API fetch_session_model pattern exactly.
