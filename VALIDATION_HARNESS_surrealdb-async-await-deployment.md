# Validation Harness: surrealdb-async-await-deployment

## Status: ✅ CREATED

## Overview

Created comprehensive validation harness for the **surrealdb-async-await-deployment** specification. The harness validates that async/await fixes from commit 9756fa5 are successfully deployed and functioning correctly in the Kubernetes cluster.

## Harness Structure

### TypeScript Wrapper
**File**: `tests/validation-harnesses/surrealdb-async-await-deployment-harness.ts`

- Programmatic interface for test execution
- JSON output for CI/CD integration
- Historical test case validation (no LLM required)
- Deployment info inspection
- Pod log analysis

### Bash Implementation
**File**: `tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh`

- 8 comprehensive integration tests
- Direct Kubernetes pod interaction
- SurrealDB and Redis cache testing
- Coroutine warning detection

## Test Strategy (8 Tests)

### Test 1: API Health Check
- **Purpose**: Verify API is accessible at api.metabob.local
- **Method**: HTTP GET to /api/health
- **Pass Criteria**: HTTP 200 response

### Test 2: Create Template
- **Purpose**: POST template and verify creation
- **Method**: POST /v2/activities/templates with test template
- **Pass Criteria**: Returns variant_id and activity_id

### Test 3: Redis Cache Hit
- **Purpose**: Verify template cached in Redis
- **Method**: GET /v2/activities/templates/{variant_id}
- **Pass Criteria**: Template returned immediately from cache

### Test 4: Pod Log Check
- **Purpose**: Verify zero coroutine warnings
- **Method**: kubectl logs analysis
- **Pass Criteria**: No "coroutine was never awaited" messages

### Test 5: SurrealDB Persistence
- **Purpose**: Confirm template persisted to primary storage
- **Method**: Direct SurrealDB query via kubectl exec
- **Pass Criteria**: Template found in activity_template table

### Test 6: Cache Flush
- **Purpose**: Flush Redis without data loss
- **Method**: redis-cli FLUSHALL
- **Pass Criteria**: Cache flushed successfully

### Test 7: SurrealDB Fallback
- **Purpose**: Template accessible after cache flush
- **Method**: GET /v2/activities/templates/{variant_id} after flush
- **Pass Criteria**: Template loaded from SurrealDB (cache-aside pattern)

### Test 8: Storage Sync
- **Purpose**: Redis and SurrealDB synchronized
- **Method**: Verify template repopulated in Redis
- **Pass Criteria**: Template exists in both storage layers

## Test Cases (Historical - No LLM Required)

### Case 1: Successful Deployment
**Impulse**: `validation-surrealdb-async-await-deployment-case-1`

**Input**:
- RPC API URL: http://api.metabob.local/api
- Namespace: metabob
- Redis Pod: redis-0
- SurrealDB Pod: surrealdb-0

**Expected Output**:
- All 8 tests PASS
- Zero coroutine warnings
- Pod: metabob-rpc-api-9c85b8b96-6swdf
- Image: metabob-rpc-api:9756fa5-async-await
- Status: RUNNING (Fixed)

### Case 2: Broken Deployment
**Impulse**: `validation-surrealdb-async-await-deployment-case-2`

**Input**: Same as Case 1

**Expected Output**:
- At least 1 test FAIL
- Coroutine warnings present
- Pod: metabob-rpc-api-cdc954554-wmrnd
- Image: metabob-rpc-api:fixed-await
- Status: RUNNING (Broken)

### Case 3: API Not Accessible
**Impulse**: `validation-surrealdb-async-await-deployment-case-3`

**Input**: Same as Case 1

**Expected Output**:
- API health check FAIL
- Cannot proceed with other tests
- API not accessible

## Usage

### Run Full Validation (TypeScript)
```bash
npx ts-node tests/validation-harnesses/surrealdb-async-await-deployment-harness.ts
```

### Run Full Validation (Bash)
```bash
RPC_API_URL=http://api.metabob.local/api \
NAMESPACE=metabob \
./tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh
```

### Run Specific Test Case
```bash
npx ts-node tests/validation-harnesses/surrealdb-async-await-deployment-harness.ts test-case 0
```

### Get Deployment Info Only
```bash
npx ts-node tests/validation-harnesses/surrealdb-async-await-deployment-harness.ts info metabob
```

## Validation Criteria

### Deployment Success
- ✅ New pod running with metabob-rpc-api:9756fa5-async-await image
- ✅ Pod status: RUNNING and READY
- ✅ API accessible at api.metabob.local

### Async/Await Enforcement
- ✅ Zero "coroutine was never awaited" warnings in pod logs
- ✅ Await keywords present in traceback (if errors occur)
- ✅ Functions properly awaiting async operations

### Persistence Verification
- ✅ Templates persist to SurrealDB (primary storage)
- ✅ Templates survive Redis cache flush
- ✅ Cache-aside pattern working correctly
- ✅ Redis and SurrealDB synchronized

## Impulses Created

1. **harness-surrealdb-async-await-deployment**
   - Type: file
   - Path: tests/validation-harnesses/surrealdb-async-await-deployment-harness.ts
   - Budget: 2000 tokens

2. **validation-surrealdb-async-await-deployment-case-1**
   - Successful deployment scenario
   - All tests pass

3. **validation-surrealdb-async-await-deployment-case-2**
   - Broken deployment scenario
   - Coroutine warnings present

4. **validation-surrealdb-async-await-deployment-case-3**
   - API not accessible scenario
   - Health check fails

## Integration with CI/CD

### Exit Codes
- **0**: All tests passed
- **1**: At least one test failed

### JSON Output Format
```json
{
  "pass": true/false,
  "totalTests": 8,
  "passedTests": 7,
  "failedTests": 1,
  "tests": [ ... ],
  "deploymentInfo": { ... },
  "conclusion": "..."
}
```

## Related Files

- `tests/validation-harnesses/surrealdb-async-await-deployment-harness.ts` - TypeScript wrapper
- `tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh` - Bash implementation
- `impulses/validation-surrealdb-async-await-deployment-case-1.json` - Test case 1
- `impulses/validation-surrealdb-async-await-deployment-case-2.json` - Test case 2
- `impulses/validation-surrealdb-async-await-deployment-case-3.json` - Test case 3
- `impulses/harness-surrealdb-async-await-deployment.json` - Harness metadata

## Conclusion

The validation harness is **READY FOR USE**. It provides:

1. ✅ Comprehensive 8-test integration validation
2. ✅ Programmatic TypeScript interface
3. ✅ Historical test cases (no LLM required)
4. ✅ CI/CD integration via JSON output
5. ✅ Deployment info inspection
6. ✅ Pod log analysis for coroutine warnings
7. ✅ Direct SurrealDB query verification
8. ✅ Cache flush testing

The harness validates that the surrealdb-async-await-deployment specification is correctly enforced in the deployed environment.

---

*Harness created on: 2026-03-03*
*Agent: validation-subagent (trace-enforce-validate-loop activity)*
