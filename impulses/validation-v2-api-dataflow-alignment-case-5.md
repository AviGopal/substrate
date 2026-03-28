# Validation Test Case 5: Execution Recording

**Test**: POST /v2/activities/executions - Record execution and update metrics
**Phase**: 3 (Execution Recording)
**Status**: DEPRECATED (Endpoint marked deprecated in Python RPC API)

## Input

```json
{
  "endpoint": "POST /v2/activities/executions",
  "headers": {
    "Authorization": "Bearer {token}",
    "Content-Type": "application/json"
  },
  "body": {
    "variant_id": "test-template-001",
    "success": true,
    "duration_ms": 1500,
    "cost": 0.0025,
    "tokens": {
      "input": 1000,
      "output": 500,
      "cache": 200
    }
  }
}
```

## Expected Output

```json
{
  "status": 404,
  "note": "DEPRECATED: This endpoint is not implemented in v2 API",
  "reason": "Execution recording moved to /api/v1/learning-loop/executions",
  "architecture": "OpenCode → TemplateMetricsClient → MCP metabob_post_activity_result → CLI → /api/v1/learning-loop/executions"
}
```

## Validation Criteria

1. Endpoint should return 404 Not Found (not implemented)
2. Test should PASS with 404 status (expected behavior)
3. Test should SKIP actual validation (endpoint deprecated)

## Deprecation Notice

As of 2026-03-07, the Python RPC API marks POST /v2/activities/executions as DEPRECATED. The new architecture uses:

```
OpenCode CLI → TemplateMetricsClient.reportExecution()
  → MCP metabob_post_activity_result
  → CLI
  → POST /api/v1/learning-loop/executions
  → SurrealDB
```

This test case should SKIP with PASS status, indicating the endpoint is intentionally not implemented.

## Implementation Reference

- File: N/A (not implemented in TypeScript v2 API)
- Deprecated: `repos/metabob-rpc-api/server/routes/activity.py` lines 534-686
- Replacement: `/api/v1/learning-loop/executions` endpoint
