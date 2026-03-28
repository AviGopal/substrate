# Validation Harness: end-to-end-mcp-dataflow-integration

**Harness ID:** harness-end-to-end-mcp-dataflow-integration  
**Type:** file  
**File Path:** tests/validation-harnesses/end-to-end-mcp-dataflow-integration-harness.ts  
**Budget:** 2000 tokens

---

## Overview

This validation harness provides comprehensive integration testing for the end-to-end MCP dataflow architecture. It validates the complete request lifecycle from opencode → MCP → CLI → v2 API → SurrealDB/Redis and back.

---

## Test Coverage

### 1. Session Token Generation and Redis Storage (CRITICAL)
- **Function:** `testSessionTokenGeneration()`
- **Validates:** POST /v2/session endpoint, Redis storage with 24hr TTL
- **Key Checks:**
  - HTTP 200 response
  - session_id and token fields present
  - Redis key `session:info:{session_id}` exists
  - Session data matches input (org_id, project_id, user_id)
  - TTL ~86400s (±60s variance)

### 2. Template Listing with Bearer Token Authentication (HIGH)
- **Function:** `testTemplateListingWithAuth()`
- **Validates:** GET /v2/activities/templates endpoint, Bearer auth
- **Key Checks:**
  - HTTP 200 response
  - Response is array of templates
  - Each template has required fields (id, name, category)
  - Unauthenticated requests rejected
  - Invalid tokens rejected

### 3. Thompson Sampling Metric Calculations (MEDIUM)
- **Function:** `testThompsonSamplingMetrics()`
- **Validates:** Thompson Sampling metrics on templates
- **Key Checks:**
  - Templates have success_rate, expected_value, alpha, beta fields
  - success_rate ∈ [0, 1]
  - alpha ≥ 1, beta ≥ 1
  - Metrics calculated correctly

### 4. Cache-Aside Pattern Implementation (HIGH)
- **Function:** `testCacheAsidePattern()`
- **Validates:** Redis cache-aside pattern with TTL
- **Key Checks:**
  - First request populates cache
  - Cache key: `templates:{org_id}:{project_id}`
  - Cache TTL ~300s (±10s variance)
  - Second request returns identical data
  - Cache hit may be faster (not guaranteed in dev)

### 5. Multi-Tenant Scope Filtering (HIGH)
- **Function:** `testMultiTenantFiltering()`
- **Validates:** Multi-tenant isolation and scope filtering
- **Key Checks:**
  - Different orgs/projects get appropriate templates
  - Global templates visible to all
  - Scope values valid: ['global', 'org', 'project', null]
  - No data leakage

### 6. Architectural Boundary Validation (HIGH)
- **Function:** `testArchitecturalBoundaries()`
- **Validates:** Bearer token authentication enforcement
- **Key Checks:**
  - Unauthenticated requests rejected (401/403)
  - Invalid tokens rejected (401/403)
  - Valid tokens accepted (200)
  - v2 API enforces authentication

### 7. Complete Round-Trip (CRITICAL)
- **Function:** `testCompleteRoundTrip()`
- **Validates:** End-to-end dataflow
- **Key Checks:**
  - Session creation → Redis storage
  - Template listing → Cache population
  - All validation rules from previous tests
  - Complete cycle < 5 seconds

---

## Usage

### Run All Tests
```bash
cd tests/validation-harnesses
ts-node end-to-end-mcp-dataflow-integration-harness.ts
```

### Run Specific Test
```typescript
import { runValidation } from './end-to-end-mcp-dataflow-integration-harness';

const results = await runValidation({ testCase: 'sessionTokenGeneration' });
```

### Programmatic Usage
```typescript
import { runValidation } from './end-to-end-mcp-dataflow-integration-harness';

// Run all tests
const allResults = await runValidation({ verbose: true });

// Run specific test
const specificResult = await runValidation({ 
  testCase: 'completeRoundTrip',
  verbose: true 
});

// Check results
for (const result of allResults) {
  if (!result.pass) {
    console.error(`Failed: ${result.details?.testCase}`);
    console.error(`Error: ${result.error}`);
  }
}
```

---

## Configuration

The harness uses environment variables for configuration:

```bash
export V2_API_BASE_URL="http://localhost:8001"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export SURREALDB_URL="http://localhost:8000"
```

---

## Output Format

Each test returns a `ValidationResult`:

```typescript
interface ValidationResult {
  pass: boolean;
  actual: any;
  expected: any;
  error?: string;
  details?: Record<string, any>;
}
```

### Example Success Output
```json
{
  "pass": true,
  "actual": {
    "sessionCreated": true,
    "sessionInRedis": true,
    "templatesRetrieved": 10,
    "templatesInCache": true,
    "totalTime": 1234
  },
  "expected": {
    "completeRoundTrip": true,
    "steps": 5
  },
  "details": {
    "testCase": "completeRoundTrip"
  }
}
```

### Example Failure Output
```json
{
  "pass": false,
  "actual": {
    "statusCode": 401
  },
  "expected": {
    "statusCode": 200
  },
  "error": "Expected 200, got 401",
  "details": {
    "testCase": "templateListingWithAuth"
  }
}
```

---

## Dependencies

- `ioredis`: Redis client for cache validation
- `http`/`https`: HTTP requests to v2 API
- Node.js 18+
- TypeScript 5+

Install dependencies:
```bash
npm install ioredis
npm install --save-dev @types/node
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E MCP Dataflow Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7
        ports:
          - 6379:6379
      surrealdb:
        image: surrealdb/surrealdb:latest
        ports:
          - 8000:8000
    steps:
      - uses: actions/checkout@v3
      - name: Run validation harness
        run: |
          npm install
          ts-node tests/validation-harnesses/end-to-end-mcp-dataflow-integration-harness.ts
```

---

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

---

## Related Impulses

- Test Case 1: `validation-end-to-end-mcp-dataflow-integration-case-1`
- Test Case 2: `validation-end-to-end-mcp-dataflow-integration-case-2`
- Test Cases 3-7: `validation-end-to-end-mcp-dataflow-integration-cases-3-7`

---

## Maintenance

When updating the harness:
1. Update test cases in impulses
2. Update validation functions in harness file
3. Update this documentation
4. Run all tests to ensure backward compatibility

---

**Version:** 1.0  
**Last Updated:** 2026-03-14  
**Author:** Validation Harness Generator

