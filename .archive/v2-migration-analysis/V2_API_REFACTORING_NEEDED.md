# V2 API Refactoring Required - Data Structure Alignment

**Date:** February 8, 2026  
**Priority:** HIGH  
**Issue:** V2 API not following existing data structure patterns

---

## Root Cause Analysis

### Existing Pattern (activities.py)

The established `record_execution()` function expects **complete execution data upfront**:

```python
class RecordExecutionRequest(BaseModel):
    execution_id: str
    activity_id: str
    variant_id: str
    duration_ms: int  # ✅ Full duration required
    success: bool  # ✅ Final success state required
    tokens_used: int  # ✅ Simple int, not object
    tool_calls: int
    tool_results: List[dict]
    # ... all fields required at once
```

**Usage:**
```python
execution = await record_execution(db, request, org_id, project_id)
# Records COMPLETE execution with all metrics
# Also updates: conversions, variant metrics, activity metrics
```

### V2 API Pattern (Incremental Recording)

V2 API introduces a **different pattern** - incremental recording:

```python
# Step 1: Start (partial data)
POST /v2/activities/record/start
{
  "template_id": "...",
  "execution_id": "...",
  "variables": {}
  # NO duration, success, tokens yet
}

# Step 2: Optional step tracking
POST /v2/activities/record/step
{
  "execution_id": "...",
  "step_order": 1,
  "success": true,
  "duration_ms": 5000
}

# Step 3: Complete (final data)
POST /v2/activities/record/complete
{
  "execution_id": "...",
  "success": true,
  "duration_ms": 15000,
  "cost": 0.05,
  "tokens": 8000
}
```

---

## The Conflict

**Existing Function:** Expects complete data, records once  
**V2 API:** Provides incomplete data, updates incrementally

**My Implementation:** Created manual dict building (wrong approach)

**Correct Approach Options:**

### Option A: Use Existing Infrastructure for Complete Only

```python
@router.post("/record/start"):
    # Create minimal placeholder record manually
    # (since record_execution expects complete data)
    
@router.post("/record/complete"):
    # Now we have complete data!
    # Call record_execution() here
    request = RecordExecutionRequest(...)
    execution = await record_execution(db, request, org_id, project_id)
```

### Option B: Create New Incremental Functions

```python
# In activities.py - add new functions
async def start_execution(db, execution_id, activity_id, ...) -> ActivityExecution:
    """Create initial execution record with partial data"""
    
async def update_execution(db, execution_id, updates) -> ActivityExecution:
    """Update execution with new data"""
    
async def complete_execution(db, execution_id, final_data) -> ActivityExecution:
    """Finalize execution and trigger metrics updates"""
```

---

## Field Name Corrections Needed

My current implementation uses:
- ❌ `duration` → Should be `duration_ms`
- ❌ `total_tokens: object` → Should be `tokens_used: int`
- ❌ Manual dict → Should use Pydantic models

Correct structure from `ActivityExecution`:
```python
duration_ms: int  # NOT duration
tokens_used: int  # NOT total_tokens
tool_calls: int
tool_results: List[dict[str, Any]]
```

---

## Database Schema Confusion

The database schema shows:
- `duration` (int) field
- `total_tokens` (object) field  

But Pydantic models use:
- `duration_ms` (int)
- `tokens_used` (int)

**This suggests:**
1. Either the database schema is wrong
2. Or there's field mapping during model_dump()
3. Or my schema definition was incorrect

**Need to check:** What does `ActivityExecution.model_dump()` actually produce?

---

## Recommended Refactoring

### Phase 1: Align Field Names

```python
# V2 API should match ActivityExecution model
@router.post("/record/start"):
    initial_execution = ActivityExecution(
        execution_id=execution.execution_id,
        activity_id=execution.template_id,
        variant_id=execution.template_id,
        org_id=session.org_id,
        project_id=session.project_id,
        user_id=session.user_id,
        project_hash="",
        timestamp=time.time(),
        duration_ms=0,  # ✅ Correct field name
        success=False,
        total_cost=0.0,
        tokens_used=0,  # ✅ Simple int
        tool_calls=0,
        tool_results=[],
        metabob=None,
        quality_scores={}
    )
    
    result = await db.create("activity_executions", initial_execution.model_dump())
```

### Phase 2: Use Existing Functions for Updates

```python
@router.post("/record/complete"):
    # Build complete RecordExecutionRequest
    full_request = RecordExecutionRequest(
        execution_id=execution.execution_id,
        activity_id=...,  # Need to fetch from DB
        variant_id=...,  # Need to fetch from DB
        duration_ms=execution.duration_ms,
        success=execution.success,
        tokens_used=execution.tokens,
        # ... complete data
    )
    
    # Use existing function which also:
    # - Calculates quality scores
    # - Creates conversions
    # - Updates variant metrics
    # - Updates activity metrics
    updated = await record_execution(db, full_request, org_id, project_id)
```

---

## Action Plan

1. ✅ Refactor `/record/start` to use ActivityExecution model
2. ✅ Fix field names: `duration_ms`, `tokens_used`
3. ✅ Refactor `/record/complete` to potentially use `record_execution()`
4. ✅ Test with Level 1 script
5. ✅ Verify database records match expected structure

---

**Status:** ISSUE IDENTIFIED  
**Impact:** Medium - Works but doesn't follow patterns  
**Effort:** 30-45 minutes to refactor properly  
**Benefit:** Long-term maintainability and consistency
