# Validation Harness: surrealdb-primary-redis-cache

## Overview

This validation harness verifies that the `surrealdb-primary-redis-cache` specification is correctly implemented in the metabob-rpc-api codebase.

## Specification

**SurrealDB as Primary Storage, Redis as Read-Through Cache**

- **Write Path**: Client → rpc-api → SurrealDB (PRIMARY) → Redis cache (TTL)
- **Read Path**: Client → rpc-api → Redis (cache hit) OR SurrealDB (cache miss) → populate Redis
- **Failure Handling**: SurrealDB write failure aborts operation; Redis cache failure is non-fatal

## Test Cases

### Case 1: Write Path - SurrealDB First, Then Redis Cache
**Validates**: `record_execution_result` writes to SurrealDB before Redis

**Expected Behavior**:
- Execution order: SurrealDB.insert_execution → SurrealDB.update_metrics → SurrealDB.get_metrics → Redis.set
- Redis write happens AFTER SurrealDB writes complete
- Cache failure is non-fatal

### Case 2: Read Path - Cache Hit (Redis Only)
**Validates**: `list_templates` uses Redis cache when available

**Expected Behavior**:
- Only Redis.get is called
- SurrealDB is NOT called (cache hit)
- Fast response (cache-only)

### Case 3: Read Path - Cache Miss (SurrealDB Fallback)
**Validates**: `list_templates` falls back to SurrealDB on cache miss

**Expected Behavior**:
- Execution order: Redis.get → SurrealDB.list_all_templates → Redis.set
- SurrealDB is queried on cache miss
- Redis cache is populated after SurrealDB read

### Case 4: Write Path - SurrealDB Failure Aborts Redis Write
**Validates**: SurrealDB write failure prevents Redis cache update

**Expected Behavior**:
- SurrealDB write is attempted
- SurrealDB write fails (simulated)
- Redis write is NOT attempted
- Exception is raised to caller

### Case 5: Write Path - Redis Cache Failure is Non-Fatal
**Validates**: Redis cache failure after SurrealDB success doesn't fail the operation

**Expected Behavior**:
- SurrealDB write succeeds
- Redis cache update is attempted
- Redis cache update fails (simulated)
- Operation continues without exception
- Warning is logged

## Usage

### Run All Test Cases
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
PYTHONPATH=repos/metabob-rpc-api:$PYTHONPATH python3 tests/validation-harnesses/surrealdb-primary-redis-cache-harness.py
```

### Run Single Test Case
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
PYTHONPATH=repos/metabob-rpc-api:$PYTHONPATH python3 tests/validation-harnesses/surrealdb-primary-redis-cache-harness.py validation-surrealdb-primary-redis-cache-case-1
```

## Output Format

```json
{
  "specificationName": "surrealdb-primary-redis-cache",
  "timestamp": "2024-02-28T...",
  "results": [
    {
      "testCaseId": "validation-surrealdb-primary-redis-cache-case-1",
      "testCaseName": "Write Path: SurrealDB First, Then Redis Cache",
      "pass": true,
      "actual": {
        "executionOrder": ["SurrealDB.insert_execution", "SurrealDB.update_metrics", "SurrealDB.get_metrics", "Redis.set"],
        "surrealDBFirst": true
      },
      "expected": {
        "writeOrder": ["SurrealDB.insert_execution", "SurrealDB.update_metrics", "SurrealDB.get_metrics", "Redis.set"],
        "redisWriteAfterSurrealDB": true
      },
      "details": {
        "orderCorrect": true,
        "surrealDBBeforeRedis": true
      }
    }
  ],
  "summary": {
    "total": 5,
    "passed": 5,
    "failed": 0,
    "skipped": 0,
    "passRate": "100%"
  }
}
```

## Validation Strategy

The harness uses **execution order tracking** with mocked dependencies:

1. **Mock SurrealDB and Redis operations**: Replace actual database calls with tracked mocks
2. **Track execution order**: Record each operation with timestamp
3. **Verify write order**: Ensure SurrealDB operations complete before Redis writes
4. **Verify read pattern**: Ensure cache-aside pattern (Redis → SurrealDB fallback → Redis populate)
5. **Verify failure handling**: Ensure SurrealDB failure aborts, Redis failure is non-fatal

## Implementation Details

### ExecutionOrderTracker
Tracks database operations with timestamps to verify execution order.

### Mock Strategy
- `insert_execution`: Mocked to record "SurrealDB.insert_execution" operation
- `update_metrics_after_execution`: Mocked to record "SurrealDB.update_metrics" operation
- `get_metrics`: Mocked to record "SurrealDB.get_metrics" operation and return test data
- `redis.set`: Mocked to record "Redis.set" operation

### Failure Simulation
- **SurrealDB failure**: Mock raises exception to simulate database failure
- **Redis failure**: Mock raises exception to simulate cache failure

## Historical Validation

Test cases are stored as impulses for historical validation without LLM:

- `validation-surrealdb-primary-redis-cache-case-1`
- `validation-surrealdb-primary-redis-cache-case-2`
- `validation-surrealdb-primary-redis-cache-case-3`
- `validation-surrealdb-primary-redis-cache-case-4`
- `validation-surrealdb-primary-redis-cache-case-5`

These impulses contain:
- Input test data
- Expected output/behavior
- Can be run without LLM interpretation

## Related Files

- **Implementation**: `repos/metabob-rpc-api/server/actions/activity.py`
- **Trace Analysis**: `TRACE_SURREALDB_PRIMARY_REDIS_CACHE.md`
- **Enforcement Summary**: `ENFORCEMENT_SURREALDB_PRIMARY_REDIS_CACHE.md`
- **Harness**: `tests/validation-harnesses/surrealdb-primary-redis-cache-harness.py`
