# Validation Test Case 1: Session Creation

**Test**: POST /v2/session - Session Creation
**Phase**: 1 (Session Management)
**Status**: READY

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
    "session": "string (Base64 encoded)"
  },
  "validation": {
    "tokenFormat": "Base64",
    "decodedFormat": "sessions.{uuid}",
    "redisStorage": "sessions.{uuid}",
    "redisFields": {
      "data": "JSON serialized SessionData"
    },
    "redisTTL": "86400 seconds (24 hours)"
  }
}
```

## Validation Criteria

1. HTTP status must be 201 Created
2. Response must contain `session` field with string value
3. Token must be valid Base64
4. Decoded token must match pattern `sessions.{uuid}`
5. Redis key `sessions.{uuid}` must exist
6. Redis hash field `data` must contain JSON SessionData
7. Redis TTL must be approximately 86400 seconds (±300s variance)

## Implementation Reference

- File: `repos/metabob-activity-api/src/routes/session.ts` lines 30-87
- Auth: No authentication required for session creation
- Redis pattern: `sessions.{uuid}` with hash field `data`
- Token encoding: `Base64(sessions.{uuid})`
