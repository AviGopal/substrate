# Activity Tool Bug Confirmed ✅

**Date:** 2026-02-12  
**Reporter:** User  
**Status:** 🐛 **BUG CONFIRMED**

---

## Summary

The `activity` tool in OpenCode is incorrectly attempting to CREATE activity templates instead of EXECUTING them. This is a critical bug that breaks the entire activity system workflow.

---

## Expected Behavior

When calling:
```typescript
activity({
  activityId: "REFACTOR-9c629da6",
  variables: {},
  reason: "Refactor code"
})
```

**Should:**
1. ✅ Fetch the template with ID `REFACTOR-9c629da6`
2. ✅ Execute the 4 tasks defined in that template
3. ✅ Return results from task execution
4. ❌ **NOT create a new template**

---

## Actual Behavior

**Test 1: Hello World (`infrastructure-ea49acdc`)**
```typescript
activity({
  activityId: "infrastructure-ea49acdc",
  variables: { greeting_target: "DevBob" },
  reason: "Test execution"
})
```

**Result:**
- ❌ Completed instantly (0.0s, $0 cost)
- ❌ No tasks executed (empty task list)
- ❌ Created NEW template `infrastructure-fa3ee69b` with 0 tasks
- ❌ Template count increased from 17 → 18

**Test 2: Refactor (`REFACTOR-9c629da6`)**
```typescript
activity({
  activityId: "REFACTOR-9c629da6",
  variables: {},
  reason: "Test with real template"
})
```

**Result:**
- ❌ Error: `Backend returned 500: {"error":"Failed to create template"}`
- ❌ Attempted to CREATE template instead of EXECUTE
- ❌ Backend rejected the creation attempt

---

## Root Cause Analysis

### Issue Location

The bug is somewhere in the chain:
```
OpenCode activity tool 
  → MetabobCLI.startExecution() 
  → MCP start_activity_execution 
  → ActivityManager.start_execution()
  → Backend API call
```

### Smoking Gun

**Backend Error Message:** `"Failed to create template"`

This message confirms the backend is receiving a **template creation request** when it should be receiving an **execution request**.

### Likely Culprit

**File:** `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`  
**Line:** ~524

```python
await client.post(
    "/v2/activities/record/start",  # ← Recording execution start
    json={
        "template_id": activity_id,
        "variables": variables or {},
        "session_id": session_id,
        "execution_id": execution_id,
    },
)
```

**Hypothesis:** This endpoint might be incorrectly triggering template creation instead of just recording execution start.

**OR:** There's another API call happening that creates templates.

**OR:** The backend's `/v2/activities/record/start` endpoint is bugged and creates templates.

---

## Evidence

### 1. Backend API Confusion

The error message `"Failed to create template"` appears when:
- We try to execute `infrastructure-ea49acdc` (succeeds but creates template)
- We try to execute `REFACTOR-9c629da6` (fails with error)

This suggests:
- Some templates succeed at creation (Hello World)
- Some fail at creation (Refactor)
- **None are being executed properly**

### 2. Template Creation Instead of Execution

**Before execution:** 17 templates  
**After executing `infrastructure-ea49acdc`:** 18 templates  
**New template:** `infrastructure-fa3ee69b` (same name, 0 tasks)

This is clear evidence of template CREATION, not EXECUTION.

### 3. No Task Execution

Both test cases show:
- Zero duration (0.0s)
- Zero cost ($0)
- No tasks executed
- No LLM calls made

This confirms NO ACTUAL EXECUTION is happening.

---

## Correct Design

### Activity Execution (What SHOULD happen)

```typescript
// User wants to execute existing template
activity({
  activityId: "REFACTOR-9c629da6",  // ← Existing template ID
  variables: { target: "src/foo.ts" },
  reason: "Clean up code smells"
})

// Expected flow:
1. Fetch template from backend (GET /v2/activities/templates/{id})
2. Start execution tracking (POST /v2/activities/executions/start)
3. For each task:
   - Get next step (GET /v2/activities/executions/{id}/next-step)
   - Execute step in LLM agent
   - Report result (POST /v2/activities/executions/{id}/report-step)
4. Complete execution (POST /v2/activities/executions/{id}/complete)
5. Return results
```

### Activity Creation (What ACTIVITY CREATE template does)

```typescript
// User wants to CREATE new template
activity({
  activityId: "INFRASTRUCTURE-0013e379",  // ← Activity Create template
  variables: {
    source_pattern: "...",
    activity_name: "new-workflow",
    target_category: "feature"
  },
  reason: "Create new template"
})

// Expected flow:
1. Execute Activity Create template (normal execution)
2. Template's tasks analyze patterns and generate new template JSON
3. Template's final task registers new template:
   - POST /v2/activities/templates (creates new template)
   - Returns new template ID
4. Return success with new template ID
```

**Key Difference:**
- **Execution:** Uses existing template, runs tasks, NO template creation
- **Creation:** Uses Activity Create template, tasks create JSON, registers via API

---

## Impact

**Severity:** 🔴 **CRITICAL**

**Blocks:**
- ❌ All activity execution (nothing actually runs)
- ❌ Activity system testing
- ❌ Activity Create template testing (can't test if execution is broken)
- ❌ Demonstrating end-to-end workflow

**Workarounds:**
- None identified (bug is fundamental to execution flow)

---

## Fix Strategy

### Investigation Steps

1. **Check backend logs** for API calls during execution:
   ```bash
   docker logs api-server-dev --tail 200 | grep -E "POST|activities|template"
   ```

2. **Check ActivityManager.start_execution** implementation:
   - Line ~524: What does `/v2/activities/record/start` actually do?
   - Is this the correct endpoint?
   - Should it be `/v2/activities/executions/start` instead?

3. **Check backend API endpoints:**
   - What does `/v2/activities/record/start` do?
   - Is there template creation logic there?
   - Should there be a different endpoint for execution?

### Potential Fixes

**Option 1: Wrong Endpoint**
```python
# Current (WRONG?):
await client.post("/v2/activities/record/start", ...)

# Should be:
await client.post("/v2/activities/executions/start", ...)
```

**Option 2: Backend Bug**
- Backend's `/v2/activities/record/start` is creating templates
- Need to fix backend to only record execution, not create template

**Option 3: Missing Execution Flow**
- Activity Manager isn't actually executing tasks
- Need to implement task execution loop
- Currently just recording and returning immediately

---

## Testing Plan

Once fixed, verify:

### Test 1: Execute Hello World
```typescript
activity({
  activityId: "infrastructure-ea49acdc",
  variables: { greeting_target: "Test" },
  reason: "Verify execution works"
})

// Expected:
- ✅ 3 tasks execute
- ✅ Duration > 0s
- ✅ Cost > $0
- ✅ Task outputs visible
- ❌ NO new template created
- ✅ Template count stays at 18
```

### Test 2: Execute Refactor
```typescript
activity({
  activityId: "REFACTOR-9c629da6",
  variables: {},
  reason: "Test real template"
})

// Expected:
- ✅ 4 tasks execute
- ✅ Refactoring workflow runs
- ❌ NO error about template creation
- ❌ NO new template created
```

### Test 3: Create Activity (After fixing execution)
```typescript
activity({
  activityId: "INFRASTRUCTURE-0013e379",  // Activity Create
  variables: {
    source_pattern: "Test workflow",
    activity_name: "test-activity",
    target_category: "infrastructure"
  },
  reason: "Test template creation via Activity Create"
})

// Expected:
- ✅ Activity Create template executes (5 tasks)
- ✅ New template gets created (via template's logic)
- ✅ Template count increases by 1
- ✅ New template appears in search results
```

---

## Related Issues

### Version Fix (Already Fixed) ✅
- Template version format issue (`template.version.generation`)
- Fixed by aligning with proto schema
- Commit: `1a183f54`

### Activity Tool Bug (This Issue) 🐛
- Activity tool creates templates instead of executing
- Blocking all activity testing
- Needs urgent fix

### Activity Create 500 Error ⚠️
- Might be related to this bug
- Or separate backend issue
- Will retest after fixing execution bug

---

## User's Original Statement

> "The activity tool seems to be doing the incorrect thing, and creating activities itself (rather than running them)"

**Verdict:** ✅ **100% CORRECT**

The user identified the bug precisely. The activity tool is indeed creating activities when it should be executing them.

---

## Next Actions

1. **Immediate:** Check backend logs to see what API calls are being made
2. **Investigation:** Review ActivityManager.start_execution implementation
3. **Fix:** Correct the API endpoint or backend logic
4. **Test:** Run test plan to verify fix
5. **Document:** Update activity system documentation

---

**Priority:** 🔴 **CRITICAL**  
**Assigned To:** Activity Mode Agent  
**Status:** Ready for fix
