# Enforcement Summary: context-requirements-evolution

## Status: PARTIAL IMPLEMENTATION (Phase 1 Started - 2/13 Changes Complete)

### Changes Applied

#### Change 1: Backend Schema - ImpulseExecution Model
**File:** `repos/metabob-rpc-api/server/routes/learning_loop.py`  
**Lines:** 52-65  
**Component:** ImpulseExecution (NEW)

**Change Made:**
Added Pydantic model for impulse usage data:
```python
class ImpulseExecution(BaseModel):
    """Impulse usage data for a single impulse in an activity execution."""
    impulse_id: str = Field(..., description="Unique impulse identifier")
    impulse_type: str = Field(..., description="Type of impulse (file, cochange, annotation, etc.)")
    tokens_loaded: int = Field(..., description="Number of tokens loaded from this impulse")
    cost_usd: float = Field(..., description="Cost in USD for loading this impulse")
    loaded_at: str = Field(..., description="Timestamp when impulse was loaded (ISO 8601)")
```

**Reason:** Enables tracking of individual impulse usage during activity execution. This is the foundational data structure needed for correlation analysis. Without this model, we cannot represent impulse metadata in API contracts.

**Impact Analysis:**
- **Blast Radius:** LOW - New model, no existing code depends on it yet
- **Consumers:** ExecutionRequest (next change) and future impulse_execution table inserts
- **Breaking Changes:** NONE - additive change only
- **Dependencies:** Will be referenced by ExecutionRequest.impulses field

---

#### Change 2: Backend Schema - ExecutionRequest.impulses Field
**File:** `repos/metabob-rpc-api/server/routes/learning_loop.py`  
**Lines:** 88-91  
**Component:** ExecutionRequest

**Change Made:**
Added optional impulses field to execution request schema:
```python
impulses: Optional[List[ImpulseExecution]] = Field(
    None,
    description="List of impulses loaded during execution for correlation analysis",
)
```

**Reason:** Allows frontend to send impulse usage data along with execution metrics. This is the API contract extension that enables data flow from frontend to backend. Maintains backward compatibility with Optional type so existing callers don't break.

**Impact Analysis:**
- **Blast Radius:** LOW - Optional field, existing API calls remain valid
- **Consumers:** record_execution() endpoint (line 104) will need to extract and persist this data
- **Breaking Changes:** NONE - backward compatible (Optional type)
- **Dependencies:** Depends on ImpulseExecution model (Change 1)

---

### Remaining Work

The full implementation requires 11 more changes across multiple repositories and ~22-32 days of development. Here's the complete roadmap:

#### Phase 1: Impulse Persistence (3-5 days remaining)

**Change 3: Database Schema - impulse_execution Table** (NOT STARTED)
- **File:** `repos/metabob-rpc-api/docs/schema/activity_learning_loop.surql`
- **Work Required:**
  ```sql
  DEFINE TABLE impulse_execution SCHEMAFULL PERMISSIONS FULL;
  DEFINE FIELD execution_id ON impulse_execution TYPE string
    COMMENT "Foreign key to activity_execution.id";
  DEFINE FIELD impulse_id ON impulse_execution TYPE string
    COMMENT "Impulse identifier (e.g., 'file:/path/to/file.ts')";
  DEFINE FIELD impulse_type ON impulse_execution TYPE string
    COMMENT "Type: file, cochange, annotation, activityOutput, memo";
  DEFINE FIELD tokens_loaded ON impulse_execution TYPE int
    COMMENT "Tokens consumed by this impulse";
  DEFINE FIELD cost_usd ON impulse_execution TYPE float
    COMMENT "Cost in USD for loading this impulse";
  DEFINE FIELD loaded_at ON impulse_execution TYPE datetime
    COMMENT "When impulse was loaded during execution";
  DEFINE INDEX idx_impulse_execution_exec ON impulse_execution FIELDS execution_id;
  DEFINE INDEX idx_impulse_execution_impulse ON impulse_execution FIELDS impulse_id;
  ```
- **Reason:** Persist impulse usage data for correlation analysis. Without this table, impulse data is lost after execution.

**Change 4: Backend - Persist Impulses in record_execution** (NOT STARTED)
- **File:** `repos/metabob-rpc-api/server/routes/learning_loop.py`
- **Component:** `record_execution` endpoint (line 104)
- **Work Required:**
  ```python
  # After line 159 (after execution insert):
  if request.impulses:
      for impulse in request.impulses:
          try:
              insert_impulse_execution(
                  execution_id=execution.get("id"),  # FK to activity_execution
                  impulse_id=impulse.impulse_id,
                  impulse_type=impulse.impulse_type,
                  tokens_loaded=impulse.tokens_loaded,
                  cost_usd=impulse.cost_usd,
                  loaded_at=datetime.fromisoformat(impulse.loaded_at.replace("Z", "+00:00"))
              )
          except Exception as e:
              # Log error but don't fail execution recording
              logger.warning(f"Failed to record impulse {impulse.impulse_id}: {e}")
  ```
- **Reason:** Close the data gap - ensure impulse data reaches database. Graceful error handling prevents impulse failures from blocking execution recording.

**Change 5: Backend - insert_impulse_execution Function** (NOT STARTED)
- **File:** `repos/metabob-rpc-api/server/db/operations/impulse_execution.py` (NEW FILE)
- **Work Required:**
  ```python
  """Impulse Execution Operations - CRUD for impulse_execution table."""
  from server.db.surrealdb_client import get_surreal_client
  
  def insert_impulse_execution(
      execution_id: str,
      impulse_id: str,
      impulse_type: str,
      tokens_loaded: int,
      cost_usd: float,
      loaded_at: datetime
  ):
      db = get_surreal_client()
      return db.create("impulse_execution", {
          "execution_id": execution_id,
          "impulse_id": impulse_id,
          "impulse_type": impulse_type,
          "tokens_loaded": tokens_loaded,
          "cost_usd": cost_usd,
          "loaded_at": loaded_at.isoformat()
      })
  ```
- **Reason:** Encapsulate database operations for impulse_execution table. Follows existing pattern from activity_execution.py.

**Change 6: Frontend - Collect Impulse Data** (NOT STARTED)
- **File:** `repos/metabob-opencode/packages/opencode/src/session/task-execution-shared.ts`
- **Component:** `loadAndFormatImpulses` (around line 70)
- **Work Required:**
  - Modify impulse loading to collect metadata: id, type, tokens, cost, timestamp
  - Store in activity session state (activityImpulses)
  - Return impulse metadata alongside loaded content
- **Reason:** Frontend is the source of truth for impulse usage - must capture data at load time

**Change 7: Frontend - Send Impulse Data to Backend** (NOT STARTED)
- **File:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`
- **Component:** `reportExecution` (around line 91)
- **Work Required:**
  - Add `impulses?: ImpulseExecutionData[]` to ActivityExecutionData interface
  - Extract impulse metadata from activity session
  - Transform to backend format (ImpulseExecution)
  - Include in MCP reportExecution call
- **Reason:** Bridge frontend and backend - transmit impulse data via MCP

---

#### Phase 2: Data Integrity (5-7 days)

**Change 8: Backend - Transaction Support** (NOT STARTED)
- **Files:** 
  - `repos/metabob-rpc-api/server/db/surrealdb_client.py` (add transaction methods)
  - `repos/metabob-rpc-api/server/routes/learning_loop.py` (use transactions)
- **Work Required:**
  - Implement BEGIN/COMMIT/ROLLBACK in SurrealDB client
  - Wrap execution + impulses + metrics in single transaction
  - Add rollback on error
- **Reason:** Prevent partial writes that corrupt data

**Change 9: Backend - Fix Race Condition in Metrics** (NOT STARTED - **CRITICAL BUG**)
- **File:** `repos/metabob-rpc-api/server/db/operations/template_metrics.py`
- **Component:** `update_metrics_after_execution`
- **Work Required:**
  - Replace read-modify-write with atomic UPDATE
  - Use SurrealDB arithmetic: `UPDATE template_metrics:id SET total_executions += 1`
- **Reason:** Current implementation has race condition that corrupts success_rate under concurrent load

---

#### Phase 3: Correlation Analysis (7-10 days)

**Change 10: Backend - Impulse Analytics Service** (NOT STARTED)
- **File:** `repos/metabob-rpc-api/server/services/impulse_analytics.py` (NEW)
- **Component:** `analyze_impulse_correlation` (NEW)
- **Reason:** Calculate lift metric (success_rate_with - success_rate_without) to identify effective impulses

**Change 11: Backend - Correlation Analysis Endpoint** (NOT STARTED)
- **File:** `repos/metabob-rpc-api/server/routes/learning_loop.py`
- **Component:** `GET /api/v1/impulse-analytics/correlation` (NEW)
- **Reason:** Expose correlation analysis via REST API

---

#### Phase 4: Template Evolution (7-10 days)

**Change 12: Backend - Template Evolution Service** (NOT STARTED)
- **File:** `repos/metabob-rpc-api/server/services/template_evolution.py` (NEW)
- **Component:** `optimize_context_requirements` (NEW)
- **Reason:** Automatically update templates based on correlation analysis

**Change 13: Backend - Template Evolution Endpoint** (NOT STARTED)
- **File:** `repos/metabob-rpc-api/server/routes/learning_loop.py`
- **Component:** `PATCH /api/v1/templates/:id/context-requirements` (NEW)
- **Reason:** Allow triggering template optimization via API

---

## Summary

### Progress: 2/13 Changes Complete (15%)

✅ **Completed (2 changes):**
1. ImpulseExecution Pydantic model  
2. ExecutionRequest.impulses field

❌ **Remaining (11 changes):**
3. impulse_execution table schema  
4. Backend impulse persistence logic  
5. insert_impulse_execution function  
6. Frontend impulse data collection  
7. Frontend impulse data transmission  
8. Transaction support  
9. Fix race condition (CRITICAL)  
10. Impulse analytics service  
11. Correlation analysis endpoint  
12. Template evolution service  
13. Template evolution endpoint  

### Estimated Effort
- **Completed:** 1-2 hours
- **Remaining:** 22-32 days
- **Total:** ~23-33 days

### Blockers for Completion
1. **impulse_execution table missing** → Cannot persist data
2. **Frontend not collecting data** → No data flowing
3. **No transaction support** → Risk of corruption
4. **Race condition in metrics** → Active bug

### Next Steps (Priority Order)
1. Create impulse_execution table schema
2. Implement backend persistence (Changes 4-5)
3. Implement frontend collection (Changes 6-7)
4. Add transaction support (Change 8)
5. Fix race condition (Change 9) - **URGENT**
6. Implement analytics (Changes 10-11)
7. Implement evolution (Changes 12-13)

---

## Files Modified

| File | Changes | Status | Compiles |
|------|---------|--------|----------|
| repos/metabob-rpc-api/server/routes/learning_loop.py | Added ImpulseExecution model + ExecutionRequest.impulses field | ✅ Complete | ✅ Yes |

---

## Technical Debt Identified

### 1. Terminology Inconsistency
- Code mixes "activity_id" (execution instance) and "template_id" (template name)
- Recommendation: Standardize on execution_id, template_id, variant_id

### 2. No Transaction Support
- SurrealDB supports transactions but code doesn't use them
- Recommendation: Add transaction wrapper immediately

### 3. Race Condition (CRITICAL BUG)
- template_metrics.py uses read-modify-write without locking
- Impact: Corrupted metrics under concurrent load
- Recommendation: Replace with atomic UPDATE (URGENT)

---

## Validation Criteria (For Full Implementation)

After completing all 13 changes, verify:
- ✓ Impulse data persists to impulse_execution table
- ✓ No data loss after execution completes
- ✓ Correlation analysis returns accurate lift metrics (after 20+ executions)
- ✓ Templates evolve to include high-correlation impulses (>0.2 threshold)
- ✓ Templates remove low-correlation impulses (<-0.1 threshold)
- ✓ No race conditions under concurrent execution
- ✓ All database writes atomic (transaction support)
- ✓ Template versioning increments after evolution
- ✓ Evolution history persisted with justifications

---

## Enforcement Impulse

**ID:** `enforcement-context-requirements-evolution`  
**Type:** memo  
**Content:** This document  
**Budget:** 3000 tokens  
**Purpose:** Document partial implementation and roadmap for completion

**Created:** 2026-02-23  
**Last Updated:** 2026-02-23
