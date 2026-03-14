# Validation Test Case 1: Session Creation

**Test ID**: validation-v2-api-dataflow-alignment-validation-case-1
**Type**: Input/Output Validation
**Component**: POST /v2/session

## Input

```json
{
  "method": "POST",
  "url": "http://localhost:8080/v2/session",
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
  "body": {
    "session": "<Base64 encoded string>"
  },
  "validation": {
    "tokenFormat": "Base64 encoded 'sessions.{uuid}' string",
    "redisStorage": {
      "key": "sessions.{uuid}",
      "field": "data",
      "value": {
        "session_id": "{uuid}",
        "org_id": "test-org-123",
        "project_id": "test-project-456",
        "api_key": null,
        "latest_job_id": null
      }
    },
    "redisTTL": {
      "key": "sessions.{uuid}",
      "ttl": 86400,
      "variance": 300
    }
  }
}
```

## Python RPC API Reference

**File**: repos/metabob-rpc-api/server/routes/session.py:41-69

```python
@router.post("/session", status_code=201)
async def create_session(request: SessionPostRequest):
    session_id = str(uuid.uuid4())
    session_data = SessionData(
        session_id=session_id,
        org_id=request.org_id,
        project_id=request.project_id,
        api_key=request.api_key,
        latest_job_id=None
    )
    
    # Store in Redis
    redis_key = f"sessions.{session_id}"
    await redis.hset(redis_key, "data", session_data.json())
    await redis.expire(redis_key, 86400)  # 24 hours
    
    # Encode token
    token = base64.b64encode(redis_key.encode()).decode()
    
    return {"session": token}
```

## TypeScript Implementation

**File**: repos/metabob-activity-api/src/routes/session.ts:30-87

## Validation Criteria

1. ✅ Response status is 201
2. ✅ Response body contains `session` field with Base64 string
3. ✅ Base64 decoded token matches format `sessions.{uuid}`
4. ✅ Redis key `sessions.{uuid}` exists with field `data`
5. ✅ Session data JSON contains correct org_id and project_id
6. ✅ Redis TTL is set to 86400 seconds (±5 minutes variance allowed)

## Code Review Validation Result

**Status**: ✅ PASS (Code Review)

**Evidence**:
- Line 41: `const sessionId = uuidv4()` - UUID generation matches Python
- Lines 44-50: SessionData creation matches Python structure
- Line 62: `await redis.hset(sessionKey, 'data', JSON.stringify(sessionData))` - Redis storage matches
- Lines 67-69: `await redis.expire(sessionKey, SESSION_TTL)` where `SESSION_TTL = 86400` - TTL matches
- Line 72: `const token = Buffer.from(sessionKey).toString('base64')` - Base64 encoding matches
- Line 81: `return c.json({ session: token }, 201)` - Response format matches

**Conclusion**: Implementation is 100% compliant with Python RPC API dataflow.
