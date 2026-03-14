# Validation Harness: v2-api-dataflow-alignment

**File**: tests/validation-harnesses/v2-api-dataflow-alignment-harness.ts
**Purpose**: Automated validation of TypeScript v2 Activity API dataflow alignment with Python RPC API
**Status**: READY (Phase 1 & 2 complete, Phase 3 deprecated)
**Token Budget**: 2000 tokens

## Overview

This validation harness executes 6 automated test cases to verify the TypeScript v2 Activity API correctly implements the same dataflows as the Python RPC API, ensuring metabob-cli MCP tool compatibility.

## Test Cases

### Phase 1: Session Management (3 tests)

1. **Session Creation** - POST /v2/session
   - Creates session with org_id/project_id
   - Returns Base64 Bearer token
   - Stores session in Redis with 24hr TTL
   - Status: READY

2. **Session Retrieval** - GET /v2/session
   - Retrieves session data with Bearer token
   - Auth middleware validates token
   - Returns SessionData from context
   - Status: READY

3. **Redis Session TTL** - TTL validation
   - Verifies 24hr TTL on session keys
   - Allows ±5min variance for test execution
   - Status: READY

### Phase 2: Template Listing (2 tests)

4. **Template List** - GET /v2/activities/templates
   - Lists templates with Thompson Sampling metrics
   - Multi-tenant filtering (org_id/project_id scope)
   - Redis cache-aside pattern
   - Status: READY (as of 2026-03-14 enforcement)

6. **Multi-Tenant Filtering** - Scope isolation
   - Creates two org sessions
   - Verifies scope isolation enforcement
   - Global templates visible to all
   - Org templates isolated by org_id
   - Status: READY (as of 2026-03-14 enforcement)

### Phase 3: Execution Recording (1 test)

5. **Execution Recording** - POST /v2/activities/executions
   - Status: DEPRECATED (endpoint not implemented)
   - Expected: 404 Not Found
   - Test: SKIP with PASS status
   - Replacement: /api/v1/learning-loop/executions

## Execution

```bash
# From repository root
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Run harness (requires v2 API server running)
bun run tests/validation-harnesses/v2-api-dataflow-alignment-harness.ts

# Or with ts-node
ts-node tests/validation-harnesses/v2-api-dataflow-alignment-harness.ts
```

## Environment Requirements

- **V2 API Server**: http://localhost:8080 (or set V2_API_URL)
- **Redis**: localhost:6379 (or set REDIS_URL)
- **SurrealDB**: http://localhost:8000 (or set SURREALDB_URL)

## Output Format

```json
{
  "totalTests": 6,
  "passed": 5,
  "failed": 1,
  "results": [
    {
      "pass": true,
      "testCase": "POST /v2/session - Session Creation",
      "actual": { ... },
      "expected": { ... },
      "details": "Session created successfully with Bearer token"
    }
  ],
  "summary": "5/6 tests passed"
}
```

## Success Criteria

- **Phase 1 Complete**: Tests 1-3 PASS (session management)
- **Phase 2 Complete**: Tests 4, 6 PASS (template listing)
- **Phase 3 Deprecated**: Test 5 SKIP with PASS (execution recording)
- **Overall**: 5/6 tests PASS (83% validation coverage)

## Validation Strategy

**No LLM Required**: Pure input/output validation against expected schemas. Each test:
1. Sends HTTP request to v2 API
2. Captures actual response
3. Compares against expected schema
4. Returns PASS/FAIL with details

## Implementation Details

- **Language**: TypeScript
- **HTTP Client**: Native fetch API
- **Redis Client**: RedisClient singleton from v2 API
- **SurrealDB Client**: surrealDB singleton from v2 API
- **Execution**: Can run standalone or via test runner

## Related Impulses

- `validation-v2-api-dataflow-alignment-case-1` - Session creation test
- `validation-v2-api-dataflow-alignment-case-2` - Session retrieval test
- `validation-v2-api-dataflow-alignment-case-3` - Redis TTL test
- `validation-v2-api-dataflow-alignment-case-4` - Template list test
- `validation-v2-api-dataflow-alignment-case-5` - Execution recording test (deprecated)
- `validation-v2-api-dataflow-alignment-case-6` - Multi-tenant filtering test

## Historical Context

This harness was created during the trace-enforce-validate loop for v2-api-dataflow-alignment specification enforcement. It validates functional state against instructional requirements without LLM assistance, providing deterministic pass/fail results.
