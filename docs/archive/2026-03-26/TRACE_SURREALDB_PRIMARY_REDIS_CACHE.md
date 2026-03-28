# Trace: surrealdb-primary-redis-cache

## Specification
SurrealDB must be the primary data store for all activity data (templates, metrics, executions). Redis is a read-through cache only.

**Write path**: Client → rpc-api → SurrealDB → Redis cache
**Read path**: Client → rpc-api → Redis (cache hit) OR SurrealDB (cache miss) → populate Redis

## Data Flow

```
Entry Point: server/actions/activity.py
  ├─ create_template()
  ├─ record_execution_result()
  └─ list_templates(), get_template_by_id()

Transform Layer: server/db/operations/
  ├─ template_data.py (SurrealDB writes)
  ├─ activity_execution.py (SurrealDB writes)
  └─ template_metrics.py (SurrealDB writes)

Cache Layer: Redis (TTL-based)
  ├─ activity:template:{variant_id}
  ├─ activity:metrics:{variant_id}
  └─ activity:templates:list
```

## Compliance Analysis

### ✅ COMPLIANT Components (8/10)

1. **create_template** (activity.py:253-401)
   - Writes to SurrealDB FIRST (line 343-349)
   - Then caches in Redis with TTL (line 352-362)
   - Header enforces specification (line 4-6)

2. **list_templates** (activity.py:87-196)
   - Cache-aside pattern: Redis → SurrealDB fallback
   - Populates Redis on cache miss (line 120-131)

3. **get_template_by_id** (activity.py:199-250)
   - Cache-aside pattern: Redis → SurrealDB fallback
   - Populates Redis on cache miss (line 221-228)

4. **create_template_record** (template_data.py:26-64)
   - Pure SurrealDB write, no Redis coupling

5. **get_template_by_variant_id** (template_data.py:67-92)
   - Pure SurrealDB read, no Redis coupling

6. **list_all_templates** (template_data.py:95-123)
   - Pure SurrealDB read, no Redis coupling

7. **insert_execution** (activity_execution.py:20-108)
   - Writes to SurrealDB ONLY (line 98)
   - Comment at line 100-106 explicitly states Redis caching removed per spec

8. **update_metrics_after_execution** (template_metrics.py:99-214)
   - Updates SurrealDB directly (line 213)
   - No Redis writes

### ⚠️ PARTIAL COMPLIANCE (1/10)

**record_execution_result** (activity.py:487-712)
- **CRITICAL ISSUE**: Inverted write order
- Current: Redis → SurrealDB → Rollback on failure
- Expected: SurrealDB → Redis cache
- Lines 524-599: Redis atomic update with WATCH
- Lines 602-649: SurrealDB write (should come FIRST)
- Lines 660-697: Complex rollback logic (unnecessary if SurrealDB-first)

**Impact**: Violates single source of truth. If SurrealDB fails, requires rollback.

### ❌ NON-COMPLIANT (1/10)

**MetricsAggregator** (metrics_aggregator.py:1-221)
- **CRITICAL ISSUE**: Redis-only storage, no SurrealDB
- Comment at line 19-20: "Future: Migrate to SurrealDB"
- All methods write directly to Redis
- Bypasses primary storage completely

**Impact**: Metrics data not persisted in primary storage. No single source of truth.

## Critical Gaps

### Gap 1: record_execution_result Write Order

**File**: repos/metabob-rpc-api/server/actions/activity.py:487-712

**Current Implementation**:
```python
# Line 524-599: Redis atomic update
with redis.pipeline() as pipe:
    pipe.watch(metrics_key)
    # ... update Redis metrics ...
    pipe.execute()

# Line 602-649: SurrealDB write (AFTER Redis!)
insert_execution(...)
update_metrics_after_execution(...)

# Line 660-697: Rollback Redis if SurrealDB fails
except Exception as e:
    redis.set(metrics_key, snapshot_metrics_json)
```

**Required Fix**:
```python
# Step 1: Write to SurrealDB FIRST
insert_execution(...)
update_metrics_after_execution(...)

# Step 2: On success, update Redis cache with TTL
redis.set(f"activity:metrics:{variant_id}", json.dumps(metrics), ex=METRICS_CACHE_TTL)
```

**Benefits**:
- Eliminates rollback complexity
- SurrealDB is single source of truth
- Redis cache failure is non-fatal
- Simpler, more maintainable code

### Gap 2: MetricsAggregator Bypasses SurrealDB

**File**: repos/metabob-rpc-api/server/services/metrics_aggregator.py:1-221

**Current Implementation**:
- All methods write directly to Redis
- No integration with SurrealDB
- Duplicate of template_metrics.py functionality

**Required Fix**:
- Deprecate MetricsAggregator service
- Use server/db/operations/template_metrics.py instead
- Replace calls to MetricsAggregator with direct SurrealDB operations

**Benefits**:
- Single implementation of metrics logic
- All metrics persisted in SurrealDB
- Consistent with rest of codebase

## Recommendations

### HIGH Priority

1. **Fix record_execution_result write order**
   - Reverse Redis/SurrealDB write order
   - Eliminate rollback logic
   - File: repos/metabob-rpc-api/server/actions/activity.py:487-712

2. **Deprecate MetricsAggregator service**
   - Replace with template_metrics.py calls
   - File: repos/metabob-rpc-api/server/services/metrics_aggregator.py

### MEDIUM Priority

3. **Add cache invalidation on template updates**
   - update_template_record should invalidate Redis cache
   - delete_template_record should invalidate Redis cache
   - File: repos/metabob-rpc-api/server/db/operations/template_data.py

## Summary

**Overall Compliance**: 75%
- ✅ Compliant: 8 components
- ⚠️ Partial: 1 component (critical fix needed)
- ❌ Non-compliant: 1 component (deprecated service)

**Status**: MOSTLY COMPLIANT with 2 critical gaps requiring fixes

**Infrastructure**: SurrealDB client is solid, operations layer is well-designed. Most components correctly implement SurrealDB-first pattern. Two isolated issues need fixing.
