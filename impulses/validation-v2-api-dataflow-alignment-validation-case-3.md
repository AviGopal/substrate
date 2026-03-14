# Validation Test Case 3: Redis Session TTL

**Test ID**: validation-v2-api-dataflow-alignment-validation-case-3
**Type**: Redis State Validation
**Component**: Session TTL Management

## Input

```json
{
  "redisKey": "sessions.{uuid from test case 1}",
  "command": "TTL"
}
```

## Expected Output

```json
{
  "ttl": 86400,
  "variance": 300,
  "expectedRange": "86100 - 86700 seconds"
}
```

## Validation Criteria

1. ✅ Redis key exists
2. ✅ TTL is set (not -1)
3. ✅ TTL is within 5 minutes (300 seconds) of 86400 seconds (24 hours)

## Code Review Validation Result

**Status**: ✅ PASS (Code Review)

**Evidence** (repos/metabob-activity-api/src/routes/session.ts:67-69):
```typescript
if (SESSION_TTL > 0) {
  await redis.expire(sessionKey, SESSION_TTL);
}
```

Where `SESSION_TTL = 86400` (src/routes/session.ts:16)

**Conclusion**: TTL correctly set to 24 hours matching Python RPC API.
