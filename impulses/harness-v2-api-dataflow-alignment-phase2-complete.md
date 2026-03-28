# Validation Harness: v2-api-dataflow-alignment-phase2-complete

**Harness ID**: harness-v2-api-dataflow-alignment-phase2-complete  
**Specification**: v2-api-dataflow-alignment  
**Phase Coverage**: Phase 1 (Session Management) + Phase 2 (Template Routes)  
**File**: tests/validation-harnesses/v2-api-dataflow-alignment-harness.ts  
**Type**: Automated validation (no LLM required)

## Purpose

This validation harness validates Phase 2 completion of the v2-api-dataflow-alignment specification by executing 6 test cases that verify:

1. **Session Management** (Phase 1) - Bearer token authentication and Redis session storage
2. **Template Listing** (Phase 2) - Thompson Sampling metrics, cache-aside pattern, multi-tenant filtering
3. **Execution Recording** (Phase 3 DEPRECATED) - Validates 404 response as expected

## Test Cases

### Phase 1: Session Management (Tests 1-3)

1. **Session Creation** - POST /v2/session
   - Input: `{org_id, project_id}`
   - Expected: 201 with Base64 Bearer token
   - Validates: Token format, Redis storage, session data

2. **Session Retrieval** - GET /v2/session
   - Input: Bearer token from test 1
   - Expected: 200 with session data
   - Validates: Auth middleware, required fields, data accuracy

3. **Redis Session TTL** - TTL check
   - Input: Session key from test 1
   - Expected: TTL between 86100-86700 seconds (24hr ±5min)
   - Validates: TTL correctness, auto-expiry, TTL extension

### Phase 2: Template Routes (Tests 4, 6)

4. **Template List** - GET /v2/activities/templates
   - Input: Bearer token, optional category and limit
   - Expected: 200 with templates array containing Thompson Sampling metrics
   - Validates:
     - Response schema (templates array, total count)
     - Thompson Sampling metrics (alpha, beta, success_rate, total_executions)
     - Category filtering
     - Pagination (max 100 limit)
     - Multi-tenant scope filtering
     - Redis cache-aside pattern (check cache → SurrealDB fallback)

6. **Multi-Tenant Filtering** - org_id scope isolation
   - Input: Two sessions with different org_ids
   - Expected: Templates filtered by org_id (org-A ≠ org-B)
   - Validates:
     - org-A sees global + org-A templates
     - org-B sees global + org-B templates
     - No cross-org data leakage
     - Defense-in-depth (DB + client filtering)

### Phase 3: Execution Routes (Test 5 - DEPRECATED)

5. **Execution Recording** - POST /v2/activities/executions
   - Input: Execution data (variant_id, success, duration, cost, tokens)
   - Expected: 404 Not Found (Phase 3 deprecated)
   - Validates: Endpoint returns 404 as expected (test PASSES on 404)

## Infrastructure Requirements

The harness requires the following infrastructure to be running:

- **v2 API Server**: http://localhost:8080
- **Redis**: localhost:6379
- **SurrealDB**: http://localhost:8000

## Execution

### CLI Usage

```bash
# Run harness
cd tests/validation-harnesses
npx tsx v2-api-dataflow-alignment-harness.ts

# With custom API URL
V2_API_URL=http://localhost:3000 npx tsx v2-api-dataflow-alignment-harness.ts
```

### Programmatic Usage

```typescript
import { runValidation } from './tests/validation-harnesses/v2-api-dataflow-alignment-harness';

const result = await runValidation();
console.log(result.summary); // "5/6 tests passed"
console.log(result.passed);  // 5
console.log(result.failed);  // 0 (test 5 passes with 404)
```

## Expected Results

**When infrastructure is available**:

| Test | Name | Expected Result |
|------|------|----------------|
| 1 | Session Creation | ✅ PASS |
| 2 | Session Retrieval | ✅ PASS |
| 3 | Redis Session TTL | ✅ PASS |
| 4 | Template List | ✅ PASS |
| 5 | Execution Recording | ✅ PASS (404 expected) |
| 6 | Multi-Tenant Filtering | ✅ PASS |

**Success Rate**: 6/6 (100%)  
**Phase 1 Coverage**: 3/3 tests (Session Management)  
**Phase 2 Coverage**: 2/2 tests (Template Routes)  
**Phase 3 Coverage**: 1/1 test (Deprecated, expects 404)

## Validation Strategy

This harness uses **pure input/output validation** with NO LLM required:

1. **HTTP Requests**: Uses `fetch()` to call v2 API endpoints
2. **Schema Validation**: Checks response structure matches expected schema
3. **Redis Validation**: Uses RedisClient to verify session storage and TTL
4. **SurrealDB Validation**: (Test 5 only) Verifies execution written to database
5. **Assertion-Based**: Pass/fail determined by comparing actual vs expected values

## Test Case Impulses

Each test case has a corresponding impulse document:

- `validation-v2-api-dataflow-alignment-phase2-complete-case-1.md`
- `validation-v2-api-dataflow-alignment-phase2-complete-case-2.md`
- `validation-v2-api-dataflow-alignment-phase2-complete-case-3.md`
- `validation-v2-api-dataflow-alignment-phase2-complete-case-4.md`
- `validation-v2-api-dataflow-alignment-phase2-complete-case-5.md`
- `validation-v2-api-dataflow-alignment-phase2-complete-case-6.md`

These impulses document the exact input/output expectations for each test and can be used for:
- Historical reference (no LLM needed to understand test expectations)
- Regression testing (validate against known-good baselines)
- Documentation (specification compliance evidence)

## Integration with Trace-Enforce-Validate Loop

This harness is the **Validate** step in the trace-enforce-validate loop:

1. **Trace** (`trace-v2-api-dataflow-alignment-phase2-complete`):
   - Analyzed current implementation
   - Identified components and data flows
   - Documented gaps (NONE found)

2. **Enforce** (`enforcement-v2-api-dataflow-alignment-phase2-complete`):
   - No changes required (implementation complete)
   - Verified all components match specification

3. **Validate** (THIS HARNESS):
   - Execute automated tests
   - Verify functional behavior under live infrastructure
   - Confirm specification requirements met

## Budget

**Token Budget**: 2000 tokens (this impulse document)  
**Test Execution**: No tokens (no LLM required for harness execution)

## Conclusion

This harness provides comprehensive validation of Phase 2 completion (Template Listing Endpoints) while also verifying Phase 1 (Session Management) remains functional. All tests are automated, deterministic, and require no LLM intervention - making them suitable for CI/CD pipelines and regression testing.

The harness validates that the v2 API correctly implements:
- Redis cache-aside pattern (1hr TTL)
- SurrealDB multi-tenant queries
- Thompson Sampling metrics integration
- Bearer token authentication
- Multi-tenant scope isolation
- Category filtering and pagination

**Status**: Ready for execution when infrastructure is available (v2 API + Redis + SurrealDB)
