# Data Structure Alignment Issue - V2 API Implementation

**Date:** February 8, 2026  
**Priority:** HIGH  
**Issue:** V2 API implementation not following existing data structure patterns

---

## Problem Identified

My V2 API implementation in `server/routes/v2_activities.py` is **creating execution records manually** instead of using the **existing `record_execution()` function** from `server/actions/activities.py`.

### Incorrect Approach (Current)

```python
# v2_activities.py - Lines 673-695
execution_record = {
    "execution_id": execution.execution_id,
    "activity_id": execution.template_id,
    "duration": 0,  # ❌ Wrong field name
    "total_tokens": {"input": 0, ...},  # ❌ Wrong structure
    # ... manually building dict
}
result = await db.create("activity_executions", execution_record)
```

### Correct Approach (Should Be)

```python
# v2_activities.py - Should call existing function
from server.actions.activities import record_execution, RecordExecutionRequest

request = RecordExecutionRequest(
    execution_id=execution.execution_id,
    activity_id=execution.template_id,
    variant_id=execution.template_id,
    user_id=session.user_id,
    project_hash="",
    timestamp=now.timestamp(),
    duration_ms=0,  # ✅ Correct field name
    tokens_used=0,  # ✅ Correct structure (int)
    success=False,
    total_cost=0.0,
    tool_calls=0,
    tool_results=[],
    metabob={}
)

execution = await record_execution(db, request, session.org_id, session.project_id)
```

---

## Existing Data Structure Ethos

### From `server/actions/activities.py`

**ActivityExecution Model (Lines 71-92):**
```python
class ActivityExecution(BaseModel):
    execution_id: str
    activity_id: str
    variant_id: str
    org_id: str
    project_id: str
    user_id: str
    project_hash: str
    timestamp: float
    duration_ms: int  # ✅ NOT "duration"
    success: bool
    total_cost: float = 0
    tokens_used: int = 0  # ✅ NOT object, just int
    tool_calls: int = 0
    tool_results: List[dict[str, Any]]
    metabob: dict[str, Any] | None
    quality_scores: dict[str, float]
```

**RecordExecutionRequest Model (Lines 51-68):**
```python
class RecordExecutionRequest(BaseModel):
    execution_id: str
    activity_id: str
    variant_id: str
    user_id: str
    project_hash: str
    timestamp: float
    duration_ms: int  # ✅ Consistent naming
    tokens_used: int  # ✅ Simple int
    tool_calls: int
    tool_results: List[dict[str, Any]]
    # ...
```

---

## Why This Matters

### 1. Duplication

My manual implementation duplicates logic that already exists:
- Quality score calculation
- Conversion creation
- Metrics updates
- Validation

### 2. Inconsistency

Database schema appears to have:
- `duration` (int) field
- `total_tokens` (object) field

But the Pydantic models use:
- `duration_ms` (int)
- `tokens_used` (int)

**This suggests the database schema itself may be incorrect or there's field mapping happening.**

### 3. Maintenance Burden

Changes to execution recording logic would need to be made in TWO places:
- `activities.py::record_execution()` (the real implementation)
- `v2_activities.py` (my manual version)

---

## Correct Solution

### V2 API Should Be a Thin Wrapper

**Pattern:**
```python
# V2 endpoint translates simple request to full request
@router.post("/record/start")
async def record_execution_start(...):
    session = await get_authenticated_session(...)
    
    # Translate V2 simple request to RecordExecutionRequest
    full_request = RecordExecutionRequest(
        execution_id=execution.execution_id,
        activity_id=execution.template_id,
        variant_id=execution.template_id,
        user_id=session.user_id,
        project_hash="",  # V2 doesn't provide this
        timestamp=time.time(),
        duration_ms=0,  # Will be updated on completion
        success=False,
        total_cost=0.0,
        tokens_used=0,
        tool_calls=0,
        tool_results=[],
        metabob=None
    )
    
    # Call existing function
    execution = await record_execution(
        db, 
        full_request, 
        session.org_id, 
        session.project_id
    )
    
    return {"execution_id": execution.execution_id, ...}
```

---

## Action Items

### Immediate Fix Required

1. ✅ Refactor `v2_activities.py::record_execution_start()`
   - Remove manual dict building
   - Call `activities.record_execution()`

2. ✅ Refactor `v2_activities.py::record_execution_complete()`
   - Create completion request
   - Update via existing patterns

3. ✅ Check database schema alignment
   - Verify field names match Pydantic models
   - Fix schema if necessary

### Validation Needed

1. Rerun Level 1 tests with corrected implementation
2. Verify records match expected structure
3. Confirm no duplicate logic exists

---

## Database Schema Investigation

Need to determine:
- Does `activity_executions` table use `duration` or `duration_ms`?
- Does it use `tokens_used` (int) or `total_tokens` (object)?
- Is there automatic field mapping happening?

**Check via:**
```sql
INFO FOR TABLE activity_executions;
```

---

## Recommendation

**Before proceeding with Level 2-4 testing:**
1. Fix V2 API to use existing `record_execution()` function
2. Align with established data structures
3. Remove manual schema handling
4. Retest Level 1 with proper implementation

**Benefit:**
- Consistency with codebase patterns
- Automatic metrics updates
- Conversion tracking
- Quality score calculations
- Less maintenance burden

---

**Issue Status:** IDENTIFIED  
**Priority:** HIGH (blocks proper data flow)  
**Effort:** 30 minutes to refactor  
**Impact:** Ensures long-term maintainability and consistency
