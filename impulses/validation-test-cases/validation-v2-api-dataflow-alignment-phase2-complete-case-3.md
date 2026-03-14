# Validation Test Case 3: Redis Session TTL

**Test ID**: validation-v2-api-dataflow-alignment-phase2-complete-case-3  
**Phase**: Phase 1 - Session Management  
**Operation**: Redis TTL check  
**Purpose**: Verify session has correct TTL of 24 hours (86400 seconds)

## Input

```json
{
  "operation": "Redis TTL check",
  "key": "sessions.{uuid}",
  "expectedTTL": 86400
}
```

## Expected Output

```json
{
  "ttl": "86400 seconds (24 hours)",
  "variance": "±300 seconds (5 minutes)",
  "validation": [
    "TTL should be between 86100 and 86700 seconds",
    "Session auto-expires after 24 hours",
    "TTL is extended on access"
  ]
}
```

## Validation Criteria

1. **TTL Value**: Redis key must have TTL between 86100 and 86700 seconds
2. **Variance Allowed**: ±300 seconds (5 minutes) to account for processing time
3. **Auto-Expiry**: Session should expire automatically after 24 hours
4. **Extension on Access**: TTL should be reset to 86400s when session is accessed

## Test Implementation

Location: `tests/validation-harnesses/v2-api-dataflow-alignment-harness.ts:228-271`

Function: `testRedisSessionTTL(bearerToken: string)`

## Expected Result

**PASS** - Session TTL is within 5 minutes of 24 hours (86400±300 seconds)
