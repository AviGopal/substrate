# Validation Test Case 3: Redis Session TTL

**Test**: Redis Session TTL - 24 hour expiry
**Phase**: 1 (Session Management)
**Status**: READY

## Input

```json
{
  "redisKey": "sessions.{uuid_from_test_case_1}",
  "operation": "TTL",
  "expectedTTL": 86400
}
```

## Expected Output

```json
{
  "status": "success",
  "validation": {
    "ttl": "86400 seconds (±300s variance)",
    "range": "86100 - 86700 seconds",
    "note": "5 minute variance allowed for test execution time"
  }
}
```

## Validation Criteria

1. Redis TTL command must return positive integer
2. TTL must be between 86100 and 86700 seconds
3. Session key must exist in Redis
4. TTL must be automatically renewed on session access

## Implementation Reference

- File: `repos/metabob-activity-api/src/routes/session.ts` line 75
- Auth middleware: `src/middleware/auth.ts` lines 67-71 (TTL renewal)
- Redis TTL set during session creation
- TTL extended on every session access
