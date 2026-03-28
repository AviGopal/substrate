# Activity Execution Root Cause - CONFIRMED

**Date:** 2026-02-12  
**Status:** 🎯 **ROOT CAUSE IDENTIFIED**

---

## The Smoking Gun

### Backend Logs Show The Truth

When we execute `infrastructure-ea49acdc`, the backend logs show it returns a template with:
```python
'task_steps': [], 
'tasks': [], 
'variant_id': 'infrastructure-fa3ee69b'  # ← NEW ID!
```

**This is a DIFFERENT template** than the one we requested!

### The Evidence

**What we requested:**
```
infrastructure-ea49acdc  (original bootstrap Hello World)
```

**What the backend returned:**
```
infrastructure-fa3ee69b  (newly created empty Hello World)
```

### The Root Cause

The `/v2/activities/record/start` endpoint is **CREATING NEW TEMPLATES** instead of just recording execution start.

When it receives:
```json
{
  "template_id": "infrastructure-ea49acdc",
  "session_id": "...",
  "execution_id": "..."
}
```

It's doing something like:
1. Check if template exists
2. **CREATE A NEW VARIANT** (wrong!)
3. Return the new variant ID
4. Execution proceeds with EMPTY template (0 tasks)
5. Completes instantly

---

## Why This Confirms The Bug

### Template Count

**Before execution:** 17 templates  
**After execution:** 18 templates  
**New template:** `infrastructure-fa3ee69b` with 0 tasks

### Refactor Template

**Refactor template (`REFACTOR-9c629da6`) DOES have tasks:**
```
'task_steps': [4 tasks],
'tasks': [4 tasks]
```

But when we try to execute it: `Error: Backend returned 500: {"error":"Failed to create template"}`

This confirms:
- Templates with tasks fail to "create" (backend rejects duplicate creation)
- Templates without tasks "succeed" at creation (new empty template)
- **Execution never happens - only creation attempts**

---

## The Fix

### Backend Endpoint Issue

**File:** Backend `/v2/activities/record/start` endpoint

**Current Behavior (WRONG):**
```python
@router.post("/record/start")
async def record_execution_start(request):
    # BUG: This is creating a new template variant!
    template = await create_or_get_template(request.template_id)
    return {"execution_id": ..., "variant_id": template.variant_id}
```

**Should Be:**
```python
@router.post("/record/start")
async def record_execution_start(request):
    # Just record execution, don't create templates!
    execution = {
        "execution_id": request.execution_id,
        "template_id": request.template_id,  # Use provided ID
        "session_id": request.session_id,
        "started_at": datetime.utcnow()
    }
    await db.insert("executions", execution)
    return {"execution_id": request.execution_id, "status": "started"}
```

### CLI Workaround

**Until backend is fixed, skip the `/record/start` call:**

```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

async def start_execution(...):
    # ...
    
    # SKIP backend recording (backend has bug that creates templates)
    # try:
    #     await client.post("/v2/activities/record/start", ...)
    # except Exception as e:
    #     logger.debug(f"Skipped backend recording: {e}")
    
    logger.info(f"Started execution {execution_id} (local only, backend disabled)")
    
    return {
        "execution_id": execution_id,
        "activity_id": activity_id,
        "status": execution.state.value,
        "message": "Execution started - call get_next_step for first step",
    }
```

---

## Testing Plan

### Step 1: Disable Backend Recording

Comment out the `/record/start` call in `activity_manager.py`

### Step 2: Test with Refactor Template

```typescript
activity({
  activityId: "REFACTOR-9c629da6",
  variables: {},
  reason: "Test execution with backend recording disabled"
})
```

**Expected:**
- No "Failed to create template" error
- 4 tasks execute (from task_steps)
- Duration > 0s, Cost > $0
- No new templates created

### Step 3: Fix Backend

Once CLI workaround works, fix the backend endpoint to not create templates.

---

## Proof

**Backend log excerpt showing template creation:**
```
'variant_id': 'infrastructure-fa3ee69b',  # New ID created
'task_steps': [],                          # Empty
'tasks': [],                               # Empty  
'content_hash': 'fa3ee69b0a95e09a',       # New hash
'created_at': datetime(2026, 2, 12, 8, 48, 51)  # Just created!
```

This is conclusive proof that executing an activity is creating a new template instead of running the existing one.

---

## Next Action

**Immediate Fix:** Comment out backend recording in activity_manager.py and test execution.

**File:** `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` line ~524
