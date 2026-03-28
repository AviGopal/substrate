# Trace Summary: Thompson Sampling in RPC API Only (Phase 3)

## Specification
**Thompson Sampling architectural boundary**: ML selection logic belongs in rpc-api. OpenCode delegates via HTTP API.

## Phase 3 Context: Cache-Aside Pattern Implementation

### Current State Analysis

#### ✅ COMPLIANT Components (Keep as-is)
1. **OpenCode Delegation** - Correctly calls RPC API for template selection
   - `template-selector.ts:165` → `RpcHttpClient.selectTemplateVariant()`
   - No local Beta sampling logic (removed in Phase 2)
   
2. **RPC API Endpoints** - Proper architectural boundary
   - `POST /templates/{id}/select` → `select_variant_thompson_sampling()`
   - `sample_beta()` function implements Beta distribution sampling
   
3. **SurrealDB Operations** - Primary storage correctly updated
   - `update_metrics_after_execution()` updates thompson_alpha/beta in SurrealDB
   - `insert_execution()` persists execution records

#### ⚠️ PHASE 3 REFACTORING NEEDED

**Problem**: Inconsistent dual-write patterns across the codebase

| Operation | Current Pattern | Desired Pattern | Risk |
|-----------|----------------|-----------------|------|
| **create_template** | Redis only (no SurrealDB!) | SurrealDB → Redis cache | CRITICAL |
| **record_execution_result** | Redis first → SurrealDB → rollback | SurrealDB → Redis cache | Medium |
| **select_variant_thompson_sampling** | Redis only (no SurrealDB fallback) | Redis with SurrealDB fallback | Low |

### Data Flow Gaps

#### 1. Template Creation (activity.py:260-383)
```
CURRENT:  [Generate IDs] → [Redis: Store] → [Redis: Initialize metrics] → Return
DESIRED:  [SurrealDB: Insert template] → [SurrealDB: Initialize metrics] 
          → [Redis: Cache with TTL] → Return
GAP:      Templates only in Redis (volatile). Lost on Redis restart.
```

#### 2. Execution Recording (activity.py:469-695)
```
CURRENT:  [Redis: WATCH/MULTI/EXEC atomic update] 
          → [SurrealDB: Insert execution + Update metrics]
          → [On SurrealDB fail: Rollback Redis]
          
DESIRED:  [SurrealDB: Transaction (insert + update)]
          → [Redis: Update cache]
          → [On Redis fail: Log warning, continue]
          
GAP:      Order inverted. Should treat Redis as cache, not primary store.
```

#### 3. Template Selection (activity.py:801-923)
```
CURRENT:  [Redis: Load metrics] → [Beta sampling] → [Redis: Increment count] → Return

DESIRED:  [Redis: Load metrics]
          → [On miss: SurrealDB query + populate cache]
          → [Beta sampling]
          → [SurrealDB: Record selection]
          → [Redis: Update cache]
          → Return
          
GAP:      No cache-miss fallback. No selection tracking in SurrealDB.
```

## Phase 3 Refactoring Plan

### Change 1: create_template (activity.py:260-383)
**Objective**: Persist templates to SurrealDB before caching in Redis

**Implementation**:
1. Insert template to SurrealDB
2. Initialize metrics in SurrealDB (thompson_alpha=1.0, thompson_beta=1.0)
3. Populate Redis cache with TTL
4. On Redis failure: log warning and continue (non-fatal)

**Risk**: Low - Additive change, backward compatible

### Change 2: record_execution_result (activity.py:469-695)
**Objective**: Invert write order to match cache-aside pattern

**Implementation**:
1. SurrealDB transaction: insert_execution + update_metrics_after_execution
2. Update Redis cache (read thompson_alpha/beta from SurrealDB result, write to Redis)
3. On Redis failure: log warning and continue (cache-aside tolerates misses)

**Risk**: Medium - Changes write order, requires careful testing

### Change 3: select_variant_thompson_sampling (activity.py:801-923)
**Objective**: Add cache-miss fallback and selection tracking

**Implementation**:
1. On metrics cache miss: query SurrealDB get_metrics() and populate Redis
2. Record selection to SurrealDB (new table: template_selections)
3. Keep Redis selection count increment for fast queries

**Risk**: Low - Additive change, improves resilience

## Validation Criteria

- [ ] Template creation persists to SurrealDB before caching in Redis
- [ ] Execution recording writes to SurrealDB first, then updates Redis cache
- [ ] Template selection falls back to SurrealDB on Redis cache miss
- [ ] Selection history is tracked in SurrealDB for analytics
- [ ] Redis failures are non-fatal and logged as warnings
- [ ] Thompson Sampling parameters (alpha, beta) remain consistent between SurrealDB and Redis
- [ ] All validation harness tests pass after refactoring

## Architectural Compliance Summary

### OpenCode: ✅ COMPLIANT
- Delegates Thompson Sampling to RPC API via HTTP
- No Beta sampling functions
- No Thompson Sampling orchestration
- Clean RpcHttpClient delegation interface

### RPC API: ⚠️ MOSTLY COMPLIANT (Phase 3 refinements needed)
- ✅ sample_beta() correctly implements Beta distribution sampling
- ✅ select_variant_thompson_sampling() implements full Thompson Sampling algorithm
- ✅ POST /templates/{id}/select endpoint exposes selection API
- ✅ update_metrics_after_execution() updates Thompson parameters in SurrealDB
- ⚠️ create_template writes only to Redis (missing SurrealDB persistence)
- ⚠️ record_execution_result uses Redis-first pattern (should be SurrealDB-first)
- ⚠️ select_variant_thompson_sampling has no cache-miss fallback to SurrealDB

## Next Steps

1. **Enforcement Activity**: Implement Phase 3 refactoring changes
2. **Validation**: Run thompson-sampling-in-rpc-api-only-harness.ts
3. **Integration Testing**: Test Redis failure scenarios (cache eviction, restart)
4. **Documentation**: Update architecture docs to reflect cache-aside pattern

## Impulse ID
`trace-thompson-sampling-in-rpc-api-only-phase3` (5000 token budget)
