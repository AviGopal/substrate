# Trace Analysis: context-requirements-evolution

## Specification Information

```json
{
  "specificationName": "context-requirements-evolution",
  "description": "Activity templates must evolve contextRequirements based on actual impulse usage patterns",
  "components": [
    {
      "file": "repos/metabob-opencode/packages/opencode/src/session/task-execution-shared.ts",
      "component": "loadAndFormatImpulses",
      "currentBehavior": "Loads impulses and tracks usageStats in-memory only (loadCount, totalCost, totalTokens). Data is lost after session ends.",
      "desiredBehavior": "Load impulses, track usageStats, AND send impulse data to backend for persistence via ExecutionRequest",
      "gap": "Need to collect impulse data during execution and include in reportExecution() call. Must track: impulse_id, impulse_type, tokens_loaded, cost_usd, loaded_at timestamp"
    },
    {
      "file": "repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts",
      "component": "reportExecution",
      "currentBehavior": "Sends ActivityExecutionData to backend via MCP (dual-write to JSON + Redis + SurrealDB), but does NOT include impulse usage data",
      "desiredBehavior": "Include impulses[] array in execution data sent to backend. Format: [{ impulse_id, impulse_type, tokens_loaded, cost_usd, loaded_at }]",
      "gap": "Need to add impulses[] field to ActivityExecutionData interface and populate from activityImpulses usage stats"
    },
    {
      "file": "repos/metabob-rpc-api/server/routes/learning_loop.py",
      "component": "ExecutionRequest",
      "currentBehavior": "Pydantic model with fields: activity_id, template_id, started_at, duration_ms, success, tokens_*, cost_usd, error_message, error_type, failed_task_id. NO impulses field.",
      "desiredBehavior": "Add impulses: Optional[List[ImpulseExecution]] field to schema where ImpulseExecution = { impulse_id: str, impulse_type: str, tokens_loaded: int, cost_usd: float, loaded_at: str }",
      "gap": "Schema extension required. Need to define ImpulseExecution Pydantic model and add list to ExecutionRequest"
    },
    {
      "file": "repos/metabob-rpc-api/server/routes/learning_loop.py",
      "component": "record_execution",
      "currentBehavior": "Inserts execution record to activity_execution table, updates template_metrics, records failure_pattern. Does NOT persist impulse data.",
      "desiredBehavior": "After inserting execution, loop through request.impulses and insert each into impulse_execution table with foreign key to execution_id",
      "gap": "Need to create impulse_execution table schema in SurrealDB and add insert loop in record_execution endpoint"
    },
    {
      "file": "repos/metabob-rpc-api/server/db/operations/template_metrics.py",
      "component": "update_metrics_after_execution",
      "currentBehavior": "Uses read-modify-write pattern WITHOUT transaction. Calculates incremental aggregates for success_rate, avg_duration_ms, avg_cost_usd, thompson_alpha/beta, improvement_gradient.",
      "desiredBehavior": "Same logic BUT wrapped in transaction with execution insert and impulse inserts. Also use atomic SurrealDB updates instead of read-modify-write to avoid race conditions.",
      "gap": "Need transaction support (BEGIN/COMMIT/ROLLBACK) and refactor metrics update to use atomic operations"
    },
    {
      "file": "repos/metabob-rpc-api/server/services/impulse_analytics.py",
      "component": "analyze_impulse_correlation",
      "currentBehavior": "FILE DOES NOT EXIST",
      "desiredBehavior": "Service that queries activity_execution + impulse_execution (JOIN), partitions by impulse presence, calculates success_rate_with and success_rate_without, computes correlation (lift metric), returns ImpulseCorrelationResponse with recommendations (ADD/REMOVE/NEUTRAL)",
      "gap": "Entire service needs to be created. Should implement: 1) Query all executions with impulse data, 2) Extract unique impulses, 3) For each impulse calculate correlation, 4) Sort by correlation, 5) Return analysis results"
    },
    {
      "file": "repos/metabob-rpc-api/server/routes/learning_loop.py",
      "component": "GET /api/v1/impulse-analytics/correlation",
      "currentBehavior": "ENDPOINT DOES NOT EXIST",
      "desiredBehavior": "REST endpoint that accepts template_id and min_executions (default 20), calls analyze_impulse_correlation service, returns JSON with impulse correlation analysis",
      "gap": "Need to add new endpoint to learning_loop.py router. Should validate template_id exists, check min_executions threshold, call service, return results"
    },
    {
      "file": "repos/metabob-rpc-api/server/services/template_evolution.py",
      "component": "optimize_context_requirements",
      "currentBehavior": "FILE DOES NOT EXIST",
      "desiredBehavior": "Service that calls analyze_impulse_correlation, gets current template, determines changes (ADD high-correlation impulses, REMOVE low-correlation ones), applies changes if auto_apply=True, increments template.version, stores evolution_history, persists updated template",
      "gap": "Entire service needs to be created. Should implement preview-first pattern: 1) Calculate changes, 2) If preview mode, return changes without applying, 3) If auto_apply, apply changes + audit trail + version bump"
    },
    {
      "file": "repos/metabob-rpc-api/server/routes/learning_loop.py",
      "component": "PATCH /api/v1/templates/:id/context-requirements",
      "currentBehavior": "ENDPOINT DOES NOT EXIST",
      "desiredBehavior": "REST endpoint that accepts template_id, correlation_threshold (default 0.2), auto_apply (default false), calls optimize_context_requirements service, returns preview or applied changes",
      "gap": "Need to add new endpoint to learning_loop.py router. Should validate template_id, call evolution service with parameters, return results"
    }
  ],
  "dataFlow": "loadAndFormatImpulses → track usageStats in-memory → reportExecution (NO impulses) → record_execution → insert activity_execution → update template_metrics → [END - data lost] ❌ MISSING: impulse persistence → MISSING: correlation analysis → MISSING: template evolution",
  "traceImpulseId": "trace-context-requirements-evolution"
}
```

---

## Executive Summary

**Status:** ⚠️ **NOT IMPLEMENTED** (0% complete)

**Blocking Issues:**
1. Backend missing `impulses[]` field in ExecutionRequest schema → data loss
2. No impulse correlation analysis service → cannot identify effective impulses  
3. No template evolution service → cannot close learning loop

**Expected Behavior:** After 20+ executions of a template:
1. Analyze impulses_loaded across all executions
2. Calculate correlation: impulse presence → task success
3. Identify high-correlation impulses (>80% success when present vs <50% without)
4. Update template.contextRequirements to include critical impulses
5. Remove impulses with <20% correlation (loaded but not useful)
6. Create template variant with optimized context requirements

**Goal:** Enable templates to self-optimize by learning which context is critical for success, reducing token costs by removing useless context and improving success rates by ensuring critical context is present

---

## Data Flow Diagram

### Current Flow (Partial - 40% implemented)
```
Frontend                    Backend                    Storage
--------                    -------                    -------
loadAndFormatImpulses()
  ↓ track usageStats
  ↓ (in-memory only)
  ↓
Task Execution
  ↓
reportExecution()
  ↓ NO impulses[]     →   record_execution()
                            ↓
                          insert_execution()    →   activity_execution
                            ↓
                          update_metrics()      →   template_metrics
                            ↓
                          [END]
                            ❌ impulse data LOST
```

### Desired Flow (Complete - 100%)
```
Frontend                    Backend                          Storage
--------                    -------                          -------
loadAndFormatImpulses()
  ↓ track usageStats
  ↓ (in-memory)
  ↓
Task Execution
  ↓
reportExecution()
  ↓ WITH impulses[]   →   record_execution()
                            ↓
                          BEGIN TRANSACTION
                            ↓
                          insert_execution()          →   activity_execution
                            ↓
                          insert_impulse_execution()  →   impulse_execution
                            ↓ (loop for each impulse)
                          update_metrics() [ATOMIC]   →   template_metrics
                            ↓
                          COMMIT TRANSACTION
                            ↓
                          [After 20+ executions]
                            ↓
                          analyze_impulse_correlation()
                            ↓ JOIN tables
                            ↓ partition by impulse presence
                            ↓ calculate lift metric
                            ↓
                          optimize_context_requirements()
                            ↓ preview changes
                            ↓ apply if auto_apply=True
                            ↓ version bump
                            ↓
                          [RESULT: Template optimized]  →   Updated template
```

---

## Critical Issues

### Issue 1: Impulse Data Not Persisted (HIGH - BLOCKER)
**Location:** `repos/metabob-opencode/packages/opencode/src/session/task-execution-shared.ts:70`  
**Problem:** Impulse usage tracked in-memory only. Data lost after session ends.  
**Impact:** BLOCKS entire feature - cannot analyze patterns without historical data  
**Fix:** Add impulses[] to ExecutionRequest, persist to impulse_execution table

### Issue 2: Race Condition in Metrics Aggregation (CRITICAL)
**Location:** `repos/metabob-rpc-api/server/db/operations/template_metrics.py:99`  
**Problem:** Read-modify-write without locking. Concurrent executions corrupt success_rate.  
**Impact:** Lost updates, incorrect metrics, broken Thompson Sampling  
**Fix:** Use atomic SurrealDB updates with arithmetic operations

### Issue 3: No Transactions (HIGH)
**Location:** `repos/metabob-rpc-api/server/routes/learning_loop.py:119`  
**Problem:** Three separate writes (execution, metrics, failure) without transaction  
**Impact:** Partial failures leave inconsistent state  
**Fix:** Wrap all writes in BEGIN/COMMIT/ROLLBACK transaction

### Issue 4: Correlation Analysis Missing (HIGH - BLOCKER)
**Location:** Backend - impulse_analytics.py (does not exist)  
**Problem:** No service to analyze impulse effectiveness  
**Impact:** Cannot identify which impulses correlate with success  
**Fix:** Create service with lift metric calculation

### Issue 5: Template Evolution Missing (HIGH - BLOCKER)
**Location:** Backend - template_evolution.py (does not exist)  
**Problem:** No service to update templates based on analysis  
**Impact:** Cannot close learning loop  
**Fix:** Create service with preview-first pattern

---

## Implementation Plan

### Phase 1: Impulse Persistence (1-2 days)
**Goal:** Unblock data collection

**Tasks:**
1. Add `impulses: Optional[List[ImpulseExecution]]` to ExecutionRequest schema
2. Define ImpulseExecution Pydantic model (impulse_id, impulse_type, tokens_loaded, cost_usd, loaded_at)
3. Create `impulse_execution` table in SurrealDB with schema
4. Update `record_execution()` to loop through impulses and insert to impulse_execution table
5. Update `reportExecution()` in template-metrics-client.ts to collect and send impulse data
6. Update ActivityExecutionData interface to include impulses[]

**Success Criteria:** Impulse data persisted to database after execution

### Phase 2: Fix Data Integrity (2-3 days)
**Goal:** Prevent corruption

**Tasks:**
1. Implement transaction support in `record_execution()` (BEGIN/COMMIT/ROLLBACK)
2. Wrap execution + impulses + metrics writes in single transaction
3. Refactor `update_metrics_after_execution()` to use atomic SurrealDB updates
4. Replace read-modify-write with single UPDATE query using arithmetic operations
5. Add validation for logical consistency (completed_at > started_at, duration_ms matches)
6. Add error handling and rollback on transaction failure

**Success Criteria:** All writes succeed or fail atomically, no race conditions

### Phase 3: Correlation Analysis (3-5 days)
**Goal:** Enable insights

**Tasks:**
1. Create `impulse_analytics.py` service file
2. Implement `analyze_impulse_correlation()` function with lift metric calculation
3. Add SurrealDB query to JOIN activity_execution + impulse_execution
4. Implement partition logic (with_impulse vs without_impulse)
5. Calculate success_rate_with, success_rate_without, correlation
6. Generate recommendations (ADD >0.2, REMOVE <-0.1, NEUTRAL otherwise)
7. Add `GET /api/v1/impulse-analytics/correlation` endpoint to learning_loop.py
8. Add input validation (template_id exists, min_executions threshold)
9. Add unit tests for correlation calculations

**Success Criteria:** API returns accurate correlation analysis for templates with 20+ executions

### Phase 4: Template Evolution (3-5 days)
**Goal:** Close learning loop

**Tasks:**
1. Create `template_evolution.py` service file
2. Implement `optimize_context_requirements()` function
3. Add logic to get current template and compare with correlation analysis
4. Determine changes (ADD missing high-correlation, REMOVE existing low-correlation)
5. Implement preview mode (return changes without applying)
6. Implement auto_apply mode (apply changes + version bump + evolution_history)
7. Add `PATCH /api/v1/templates/:id/context-requirements` endpoint
8. Add template versioning support (increment version after changes)
9. Store evolution_history with justifications and audit trail
10. Add unit tests for evolution logic and preview/apply modes

**Success Criteria:** Templates can be automatically updated with high-correlation impulses

---

## Estimated Effort

**Total: 9-15 days**

| Phase | Effort | Description |
|-------|--------|-------------|
| Phase 1: Impulse Persistence | 1-2 days | Unblock data collection |
| Phase 2: Data Integrity | 2-3 days | Prevent corruption |
| Phase 3: Correlation Analysis | 3-5 days | Enable insights |
| Phase 4: Template Evolution | 3-5 days | Close learning loop |

---

## Reusable Patterns Identified

### Pattern 1: Incremental Aggregation
**Formula:** `new_avg = (old_avg * old_count + new_value) / new_count`  
**Use Case:** Real-time metrics aggregation without expensive table scans  
**Abstraction Opportunity:** ✅ Create IncrementalAggregator utility class

### Pattern 2: Correlation Analysis (Lift Metric)
**Formula:** `correlation = success_rate_with - success_rate_without`  
**Use Case:** A/B testing, feature effectiveness, tool/agent performance  
**Abstraction Opportunity:** ✅ Create CorrelationAnalyzer utility class

### Pattern 3: Preview-First Modification
**Flow:** Calculate changes → Preview → Human approval → Apply  
**Use Case:** Any automated system modification (schema, config, templates)  
**Abstraction Opportunity:** ✅ Create PreviewableChangeService base class

### Pattern 4: Dual-Write for Migration
**Flow:** Write to legacy and new backends in parallel  
**Use Case:** Database migration, API migration during transition  
**Abstraction Opportunity:** ⚠️ Useful for migrations, not general-purpose

---

## Success Criteria

- ✅ After 20+ executions, correlation analysis returns accurate lift metrics
- ✅ Template evolution identifies high-correlation impulses (>0.8 threshold)
- ✅ Template evolution removes low-correlation impulses (<0.2 threshold)
- ✅ Updated templates include contextRequirements with justification
- ✅ Template version increments after each evolution
- ✅ All database writes succeed or fail atomically
- ✅ No race conditions in concurrent execution scenarios

---

## Related Documentation

- Full data flow analysis: `docs/data-flows/context-requirements-evolution-flow.md`
- Trace activity output from: `trace-data-flow-single-feature` template
- Created: 2026-02-23
- Impulse ID: `trace-context-requirements-evolution`
- Budget: 5000 tokens

---

## Next Steps

1. **Immediate:** Implement Phase 1 (Impulse Persistence) to unblock data collection
2. **Next:** Implement Phase 2 (Data Integrity) to prevent corruption
3. **Then:** Implement Phase 3 (Correlation Analysis) to enable insights
4. **Finally:** Implement Phase 4 (Template Evolution) to close learning loop

**Validation:** After each phase, run validation activity to verify enforcement
