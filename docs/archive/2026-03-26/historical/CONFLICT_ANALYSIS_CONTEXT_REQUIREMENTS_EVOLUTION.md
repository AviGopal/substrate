# Conflict Analysis: context-requirements-evolution

**Specification:** context-requirements-evolution  
**Analysis Date:** 2026-02-23  
**Status:** ✅ NO CONFLICTS DETECTED  
**Critical Issue:** ⚠️ 1 race condition affects multiple specs

---

## Executive Summary

Analyzed the **context-requirements-evolution** specification against all other specifications in the system. Found **ZERO requirement conflicts** - all specifications are complementary and work together to create a complete learning system.

**Key Finding:** One CRITICAL race condition bug in `template_metrics.py` affects both `impulse-usage-tracking` and `context-requirements-evolution`. Must be fixed before full implementation.

---

## Specifications in System

| Specification | Status | Validation | Implementation |
|---------------|--------|------------|----------------|
| context-requirements-evolution | ⏳ IN PROGRESS | ❌ FAIL (0/3) | 15% (2/13 changes) |
| impulse-usage-tracking | ✅ ENFORCED | ✅ PASS (3/3) | 100% complete |
| context-window-utilization-data-flow | ✅ ENFORCED | ✅ PASS (all tests) | 100% complete |

---

## Shared Components Analysis

### Component 1: task-execution-shared.ts (loadAndFormatImpulses)

**Affected By:**
- `impulse-usage-tracking` - Adds usageStats tracking (loadCount, totalTokens, totalCost)
- `context-requirements-evolution` - Needs to collect impulse metadata for backend

**Conflict Type:** NONE  
**Reason:** Both specifications are ADDITIVE and complementary.

**Current State:**
- ✅ `impulse-usage-tracking`: Local usageStats tracking implemented
- ❌ `context-requirements-evolution`: Backend metadata collection NOT implemented

**Resolution:** Extend existing function to collect metadata alongside usageStats  
**Risk Level:** LOW - Additive change only

---

### Component 2: template-metrics-client.ts (reportExecution)

**Affected By:**
- `impulse-usage-tracking` - Sends context_ratio and token breakdown {input, output, cache}
- `context-requirements-evolution` - Needs to send impulses[] array

**Conflict Type:** SCHEMA EXTENSION  
**Reason:** Both specs extend the same payload, but different fields.

**Current State:**
- ✅ `impulse-usage-tracking`: context_ratio and tokens breakdown sent
- ❌ `context-requirements-evolution`: impulses[] array NOT sent

**Resolution:** Add impulses[] field to ActivityExecutionData interface. Both fields coexist.  
**Risk Level:** LOW - Backward compatible (Optional field)

---

### Component 3: learning_loop.py (ExecutionRequest)

**Affected By:**
- `impulse-usage-tracking` - Backend receives context_ratio
- `context-requirements-evolution` - Backend needs impulses[] field

**Conflict Type:** NONE  
**Reason:** Both fields already coexist in schema.

**Current State:**
- ✅ `impulse-usage-tracking`: context_ratio field exists
- ✅ `context-requirements-evolution`: ImpulseExecution model and impulses[] field added

**Resolution:** ALREADY RESOLVED  
**Risk Level:** NONE - No changes needed

---

### Component 4: template_metrics.py (update_metrics_after_execution)

**Affected By:**
- `impulse-usage-tracking` - Updates metrics with context_ratio data
- `context-requirements-evolution` - Relies on accurate metrics for correlation analysis

**Conflict Type:** ⚠️ DATA CORRUPTION (CRITICAL)  
**Reason:** Read-modify-write without locking corrupts metrics under concurrent load.

**Current State:**
- ❌ CRITICAL BUG: Race condition in read-modify-write pattern
- Impact: Both specs will produce incorrect data under concurrent execution

**Resolution:** MUST implement transactions and atomic updates (Phase 2 from enforcement plan)  
**Risk Level:** CRITICAL - Blocks both specs from working correctly

---

## Cross-Specification Dependencies

### Dependency: impulse-usage-tracking → context-requirements-evolution

**Type:** POSITIVE DEPENDENCY  
**Relationship:** context-requirements-evolution DEPENDS ON impulse-usage-tracking

**Reason:** 
- context-requirements-evolution needs impulse usage data to calculate correlations
- impulse-usage-tracking provides this data via usageStats

**Current State:** ✅ RESOLVED (impulse-usage-tracking already enforced)

**Impact:** Enables context-requirements-evolution feature. No conflict.

---

### Dependency: context-window-utilization-data-flow ↔ context-requirements-evolution

**Type:** INDEPENDENT with POSITIVE SYNERGY  
**Relationship:** Independent features that complement each other

**Synergy:**
- context-requirements-evolution removes unhelpful impulses
- → Reduces total impulse tokens
- → context-window-utilization warnings decrease
- → More efficient token usage

**Conflict:** NONE

---

## Data Flow Analysis

### Frontend Data Collection

```
impulse-usage-tracking:
  loadAndFormatImpulses() → loadImpulsesForTask()
    → Update usageStats (loadCount++, totalTokens +=)
    → Store in activityImpulses

context-requirements-evolution (planned):
  loadAndFormatImpulses()
    → Collect metadata (id, type, tokens, cost, timestamp)
    → Return metadata array for backend
```

**Conflict:** NONE - Different data from same source  
**Integration:** Extend function to return both usageStats updates AND metadata array

---

### Frontend to Backend Transmission

```
impulse-usage-tracking:
  reportExecution()
    → context_ratio: number
    → tokens: {input, output, cache}

context-requirements-evolution (planned):
  reportExecution()
    → impulses: ImpulseExecution[]
```

**Conflict:** NONE - Different fields, same payload  
**Integration:** Add impulses[] alongside existing fields

---

### Backend Processing

```
impulse-usage-tracking:
  ExecutionRequest receives context_ratio
  → Stores in activity_execution table

context-requirements-evolution:
  ExecutionRequest receives impulses[]
  → Stores in impulse_execution table (NEW)
```

**Conflict:** NONE - Different tables  
**Integration:** Both tables linked by execution_id foreign key

---

## Race Condition Impact Analysis

### Critical Bug: template_metrics.py

**Location:** `update_metrics_after_execution` function

**Issue:** Read-modify-write pattern without transaction or locking

**Example:**
```python
# Thread A reads metrics
metrics = get_metrics(template_id)
total = metrics.total_executions  # 5

# Thread B reads metrics (same value!)
metrics = get_metrics(template_id)
total = metrics.total_executions  # 5

# Thread A updates
total += 1  # 6
update_metrics(template_id, {"total_executions": 6})

# Thread B updates (overwrites A's update!)
total += 1  # 6 (should be 7!)
update_metrics(template_id, {"total_executions": 6})

# Result: Lost update
```

**Impact on impulse-usage-tracking:**
- Incorrect success_rate aggregates
- Wrong thompson_alpha/beta for sampling
- Misleading context_ratio averages

**Impact on context-requirements-evolution:**
- Incorrect success rates → wrong correlation calculations
- Bad correlations → wrong template evolution decisions
- Templates evolve incorrectly, reducing performance

**Resolution:** Implement atomic updates with SurrealDB arithmetic:
```python
# Atomic update (no race condition)
db.query("""
  UPDATE template_metrics:id
  SET total_executions += 1,
      success_count += $success,
      avg_duration_ms = (avg_duration_ms * total_executions + $duration) / (total_executions + 1)
""")
```

**Priority:** CRITICAL - Must fix before continuing

---

## API Endpoint Conflicts

### Learning Loop Endpoints

**From impulse-usage-tracking:**
- `POST /api/v1/learning-loop/executions` - Record execution with context_ratio
- `GET /api/v1/learning-loop/templates/:id/metrics` - Get template metrics

**From context-requirements-evolution:**
- `GET /api/v1/impulse-analytics/correlation` - Analyze impulse correlations (NEW)
- `PATCH /api/v1/templates/:id/context-requirements` - Evolve template (NEW)

**Conflict:** NONE - Different endpoint paths  
**Resolution:** All endpoints can coexist

---

## Conflict Matrix

| Spec 1 | Spec 2 | Component | Conflict | Resolution |
|--------|--------|-----------|----------|------------|
| impulse-usage-tracking | context-requirements-evolution | task-execution-shared.ts | NONE | Additive - extend metadata |
| impulse-usage-tracking | context-requirements-evolution | template-metrics-client.ts | NONE | Additive - schema extension |
| impulse-usage-tracking | context-requirements-evolution | learning_loop.py | NONE | Coexist - both fields |
| impulse-usage-tracking | context-requirements-evolution | template_metrics.py | DATA CORRUPTION | FIX RACE CONDITION |
| context-window-utilization | context-requirements-evolution | (none) | NONE | Independent |

**Summary:** 1 critical issue (race condition), 0 requirement conflicts

---

## Implementation Order Recommendations

### Current State
1. ✅ impulse-usage-tracking (DONE)
2. ✅ context-window-utilization-data-flow (DONE)
3. ⏳ context-requirements-evolution (15% complete)

### Recommended Order

**Step 1: Fix Race Condition** (CRITICAL - 1-2 days)
- File: `template_metrics.py`
- Change: Implement atomic updates with transactions
- Benefit: Unblocks both impulse-usage-tracking and context-requirements-evolution

**Step 2: Complete Phase 1 - Impulse Persistence** (3-5 days)
- Create impulse_execution table
- Backend persistence logic
- Frontend metadata collection
- Benefit: Enables data collection for correlation analysis

**Step 3: Complete Phase 3 - Correlation Analysis** (7-10 days)
- impulse_analytics.py service
- Lift metric calculation
- GET /api/v1/impulse-analytics/correlation endpoint
- Benefit: Identifies effective impulses

**Step 4: Complete Phase 4 - Template Evolution** (7-10 days)
- template_evolution.py service
- optimize_context_requirements function
- PATCH /api/v1/templates/:id/context-requirements endpoint
- Benefit: Closes learning loop, templates auto-optimize

---

## Shared Component Integration Recommendations

### 1. task-execution-shared.ts

**Current:** impulse-usage-tracking tracks usageStats  
**Add:** Collect impulse metadata for context-requirements-evolution

```typescript
// Existing (impulse-usage-tracking)
loadedImpulse.usageStats.loadCount++
loadedImpulse.usageStats.totalTokens += tokenCount

// Add (context-requirements-evolution)
const metadata = {
  impulse_id: loadedImpulse.id,
  impulse_type: loadedImpulse.type,
  tokens_loaded: loadedImpulse.tokenCount,
  cost_usd: calculateCost(loadedImpulse.tokenCount),
  loaded_at: new Date().toISOString()
}

return { loadedImpulse, metadata }
```

**Risk:** LOW - Additive only

---

### 2. template-metrics-client.ts

**Current:** impulse-usage-tracking sends context_ratio  
**Add:** Send impulses[] array for context-requirements-evolution

```typescript
interface ActivityExecutionData {
  // Existing
  context_ratio: number  // impulse-usage-tracking
  tokens: { input, output, cache }  // impulse-usage-tracking
  
  // Add
  impulses?: ImpulseExecution[]  // context-requirements-evolution
}
```

**Risk:** LOW - Optional field, backward compatible

---

### 3. template_metrics.py

**Current:** Has race condition bug  
**Fix:** Atomic updates with transactions

```python
# Replace read-modify-write
async with db.transaction():
  await db.query("""
    UPDATE template_metrics:id
    SET total_executions += 1,
        success_count += $success,
        avg_cost = (avg_cost * total_executions + $cost) / (total_executions + 1)
  """, success=1 if success else 0, cost=cost_usd)
```

**Risk:** LOW - Standard transaction pattern  
**Benefit:** Fixes bug affecting both specs

---

## Testing Recommendations

### Integration Tests

**After Phase 1 Complete:**
1. Run impulse-usage-tracking validation harness
2. Run context-requirements-evolution validation harness
3. Verify both context_ratio AND impulses[] sent in same payload
4. Verify no data loss or corruption

**After Phase 2 Complete:**
5. Stress test with 10 concurrent executions
6. Verify no race conditions
7. Verify metrics remain accurate

**After Phase 4 Complete:**
8. Measure context window utilization before/after evolution
9. Verify templates evolve correctly
10. Verify success rates improve

---

## Synergy Opportunities

### Cross-Spec Optimization Metrics

**Metric 1: Context Efficiency**
- From impulse-usage-tracking: context_ratio per execution
- From context-requirements-evolution: Impulse effectiveness scores
- Combined: Identify high-cost, low-effectiveness impulses for removal

**Metric 2: Token Savings**
- From context-window-utilization: Total tokens before evolution
- From context-requirements-evolution: Impulses removed
- Combined: Measure token savings from template optimization

**Metric 3: Success Rate Improvement**
- From impulse-usage-tracking: Baseline success rates
- From context-requirements-evolution: Success rates after evolution
- Combined: Prove template evolution increases success

---

## Conclusion

### Summary

✅ **NO SPECIFICATION CONFLICTS**  
✅ **All specs are complementary**  
✅ **Work together to create complete learning system**

⚠️ **1 CRITICAL BLOCKER**  
❌ Race condition in template_metrics.py affects multiple specs  
🔧 Must fix with transactions and atomic updates

### Recommendations

**Immediate (Priority: CRITICAL):**
1. Fix race condition in template_metrics.py
2. Implement transactions for all metrics updates
3. Use atomic SurrealDB updates

**Short-term (Priority: HIGH):**
4. Complete context-requirements-evolution Phase 1 (Impulse Persistence)
5. Coordinate schema changes across repos
6. Run integration tests

**Long-term (Priority: MEDIUM):**
7. Complete Phases 3 & 4 (Correlation Analysis + Template Evolution)
8. Measure cross-spec synergies
9. Optimize based on combined metrics

### Impact

When all 3 specifications are fully implemented:
- ✅ Templates learn which impulses are effective
- ✅ Unhelpful impulses automatically removed
- ✅ Context window usage optimized
- ✅ Success rates improve
- ✅ Token costs decrease
- ✅ Complete learning loop closed

**Estimated Timeline:**
- Fix race condition: 1-2 days
- Complete Phase 1: 3-5 days
- Complete Phases 3-4: 14-20 days
- **Total: ~18-27 days to full implementation**

---

**Impulse ID:** `conflict-analysis-context-requirements-evolution`  
**Type:** memo  
**Budget:** 3000 tokens  
**Created:** 2026-02-23
