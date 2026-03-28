# Validation Harness: surrealdb-async-await-enforcement

## Overview

This validation harness verifies that async/await patterns are correctly enforced in `metabob-rpc-api`, ensuring templates persist to SurrealDB (primary storage) and not just Redis cache.

## Specification

**Name**: `surrealdb-async-await-enforcement`

**Problem**: Templates were being added to Redis but silently failing to persist to SurrealDB due to unawaited coroutines in `server/actions/activity.py`. This caused complete template storage failure - templates disappeared after cache expiry (1 hour).

**Fix Applied**:
1. Made `create_template()` and `record_execution_result()` async
2. Added `await` before all SurrealDB operations (`create_template_record()`, `create_metrics()`, etc.)
3. Updated callers in `routes/activity.py` to await these functions

## Test Strategy

The harness validates the fix by:

1. **Create template via POST** - Verify API accepts template and returns IDs
2. **Verify in GET response** - Template retrievable from Redis cache
3. **Check pod logs** - Zero "coroutine was never awaited" warnings
4. **Query SurrealDB directly** - Template record exists in primary storage
5. **Flush Redis cache** - Clear volatile cache to force SurrealDB fallback
6. **Query API again** - Template still retrievable (loaded from SurrealDB)
7. **Verify synchronization** - Redis cache repopulated from SurrealDB

## Usage

### Prerequisites

- `kubectl` installed and configured (for pod log and direct DB access)
- `curl` for API calls
- `jq` for JSON parsing
- metabob-rpc-api running (local or Kubernetes)
- SurrealDB and Redis accessible

### Environment Variables

```bash
export RPC_API_URL="http://localhost:8081"  # RPC API endpoint
export NAMESPACE="default"                   # Kubernetes namespace
export REDIS_POD="redis-0"                   # Redis pod name
export SURREALDB_POD="surrealdb-0"          # SurrealDB pod name
```

### Run Harness

```bash
# Run with default configuration
./tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh

# Run with custom API URL (local development)
RPC_API_URL="http://localhost:8081" ./tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh

# Run against Kubernetes deployment
export NAMESPACE="metabob-dev"
export RPC_API_URL="http://metabob-rpc-api.metabob-dev.svc.cluster.local:8081"
./tests/validation-harnesses/surrealdb-async-await-enforcement-harness.sh
```

### Exit Codes

- `0` - All tests passed
- `1` - Some tests failed

## Test Cases

### Case 1: Template Creation and Persistence

**Input**:
```json
{
  "name": "test-template",
  "description": "Test template for validation",
  "task_steps": [...],
  "scope": "global"
}
```

**Expected Output**:
- API returns 201 status with `variant_id` and `activity_id`
- Template exists in Redis cache with TTL=3600s
- Template exists in SurrealDB `activity_template` table
- Logs show "✅ Template written to SurrealDB (primary)"
- Zero "coroutine was never awaited" warnings

### Case 2: Cache-Aside Pattern After Cache Flush

**Input**:
1. Create template (Case 1)
2. Flush Redis cache: `redis-cli FLUSHALL`
3. GET `/v2/activities/templates/{variant_id}`

**Expected Output**:
- API returns 200 status with template data
- Logs show "Template cache miss, loading from SurrealDB"
- Template loaded from SurrealDB (primary storage)
- Redis cache repopulated after SurrealDB load
- Subsequent GET hits Redis cache

### Case 3: Execution Metrics Persistence and Learning Loop

**Input**:
```json
{
  "variant_id": "<template_variant_id>",
  "success": true,
  "duration_ms": 5000,
  "cost": 0.02,
  "tokens": {"input": 1000, "output": 500, "cache": 0}
}
```

**Expected Output**:
- API returns updated metrics with `thompson_alpha=2.0`, `thompson_beta=1.0`
- Execution record exists in SurrealDB `activity_execution` table
- Metrics updated in SurrealDB `template_metrics` table
- Logs show "✅ SurrealDB write successful"
- No coroutine warnings

## Validation Checks

The harness performs 8 integration tests:

1. ✓ **API Health Check** - RPC API accessible
2. ✓ **Create Template** - POST endpoint works
3. ✓ **GET Template (Cache Hit)** - Redis cache working
4. ✓ **Pod Log Check** - No coroutine warnings
5. ✓ **SurrealDB Direct Query** - Primary storage persistence
6. ✓ **Flush Redis Cache** - Cache clearing works
7. ✓ **GET Template (Cache Miss)** - SurrealDB fallback works
8. ✓ **Storage Synchronization** - Cache repopulation works

## Success Criteria

All tests must pass:

- ✅ Templates persist to SurrealDB (primary storage)
- ✅ Templates survive Redis cache expiry
- ✅ No "coroutine was never awaited" warnings
- ✅ Cache-aside pattern working correctly
- ✅ Thompson sampling learning loop functional

## Troubleshooting

### Test 4 Failed: Pod Log Check

**Symptom**: Found "coroutine was never awaited" warnings in logs

**Root Cause**: Async functions not properly awaited

**Fix**:
1. Check that `create_template()` is declared as `async def`
2. Verify all SurrealDB calls use `await` keyword
3. Ensure route handlers await action functions

### Test 5 Failed: SurrealDB Direct Query

**Symptom**: Template not found in SurrealDB

**Root Cause**: Templates only writing to Redis cache

**Fix**:
1. Verify `await create_template_record(template)` is present
2. Check SurrealDB connectivity
3. Review logs for SurrealDB write errors

### Test 7 Failed: GET Template After Cache Flush

**Symptom**: Template not found after cache flush (404 error)

**Root Cause**: SurrealDB fallback not working

**Fix**:
1. Verify `get_template_by_id()` is async and awaits DB calls
2. Check cache-aside pattern implementation
3. Ensure SurrealDB records were created in Test 5

## Related Impulses

- `trace-surrealdb-async-await-enforcement` - Trace analysis
- `enforcement-surrealdb-async-await-enforcement` - Enforcement summary
- `validation-surrealdb-async-await-enforcement-case-1` - Test case 1
- `validation-surrealdb-async-await-enforcement-case-2` - Test case 2
- `validation-surrealdb-async-await-enforcement-case-3` - Test case 3
- `harness-surrealdb-async-await-enforcement` - Harness metadata

## Architecture

```
┌─────────────┐
│   Client    │
└─────┬───────┘
      │ POST /v2/activities/templates
      ▼
┌─────────────────────────────────────────┐
│  metabob-rpc-api                        │
│  routes/activity.py                     │
│    ├─ await create_template()          │
│    └─ await record_execution_result()  │
│                                         │
│  actions/activity.py                    │
│    ├─ await create_template_record()   │
│    ├─ await create_metrics()           │
│    └─ await update_metrics_...()       │
└───────┬─────────────────────┬───────────┘
        │                     │
        │ PRIMARY             │ CACHE
        ▼                     ▼
  ┌──────────┐          ┌─────────┐
  │ SurrealDB│          │  Redis  │
  │ (source  │          │ (TTL=   │
  │  of      │          │  3600s) │
  │  truth)  │          └─────────┘
  └──────────┘
```

**Key Points**:
- SurrealDB is primary storage (persistent)
- Redis is read-through cache (volatile, 1-hour TTL)
- All writes go to SurrealDB FIRST, then Redis
- Cache misses fall back to SurrealDB

## Output Example

```
============================================
  SurrealDB Async/Await Enforcement Validation
============================================

Configuration:
  RPC API URL: http://localhost:8081
  Namespace: default

Detecting metabob-rpc-api pod...
  Found pod: metabob-rpc-api-7d8f9c6b5d-x4k2m

Test 1: API Health Check
✓ PASS: API Health Check
  RPC API is accessible at http://localhost:8081

Test 2: Create Template via POST
✓ PASS: Create Template
  Created template: test-template-1709467800-a1b2c3d4
  Activity ID: test-template-1709467800
  Variant ID: test-template-1709467800-a1b2c3d4

Test 3: Verify Template in GET Response (Redis Cache)
✓ PASS: GET Template (Cache Hit)
  Template found in Redis cache

Test 4: Check Pod Logs for Coroutine Warnings
✓ PASS: Pod Log Check
  No coroutine warnings found in logs

Test 5: Query SurrealDB Directly for Template Persistence
✓ PASS: SurrealDB Direct Query
  Template found in SurrealDB (primary storage)

Test 6: Flush Redis Cache
✓ PASS: Flush Redis Cache
  Redis cache flushed successfully

Test 7: Verify Template Accessible After Cache Flush (SurrealDB Fallback)
✓ PASS: GET Template (Cache Miss)
  Template loaded from SurrealDB after cache flush
  This confirms the cache-aside pattern is working correctly

Test 8: Verify Redis and SurrealDB Synchronization
✓ PASS: Storage Synchronization
  Template repopulated in Redis from SurrealDB
  Both storage layers are synchronized

Cleanup: Removing test template
  Test template cleanup attempted

============================================
  Validation Summary
============================================
  Total Tests: 8
  Passed: 8
  Failed: 0

✓ ALL TESTS PASSED

Conclusion:
  The surrealdb-async-await-enforcement specification is correctly implemented.
  Templates persist to SurrealDB (primary storage) and survive cache expiry.
  No coroutine warnings detected in logs.
  The cache-aside pattern is working as expected.
```

## Maintenance

This harness should be run:

- After applying the async/await fix
- Before deploying to production
- As part of CI/CD pipeline
- When modifying activity template storage logic
- When upgrading SurrealDB or Redis versions

## License

Internal use only - Metabob DevBob validation harness.
