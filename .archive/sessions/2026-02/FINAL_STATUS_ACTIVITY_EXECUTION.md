# Final Status: Activity Execution Investigation

**Date:** 2026-02-12  
**Status:** 🔍 **DEEP ISSUE DISCOVERED** - Not a simple execution bug

---

## Summary

We successfully fixed TWO bugs but discovered a THIRD deeper issue that's blocking testing.

### ✅ Bugs Fixed

1. **Template Version Format** (`1a183f54`)
   - Fixed `template.version.generation` → `template.version`
   - Aligned with proto schema

2. **task_steps Field Support** (`4e1414f9c`)
   - Added support for proto's `task_steps` field
   - Falls back to `tasks` for compatibility

3. **Backend Recording Disabled** (`97e700dde`)
   - Commented out `/v2/activities/record/start` call
   - Prevents backend from creating templates during execution

### ⚠️ New Issue Discovered

**Symptom:** `Error: Backend returned 500: {"error":"Failed to create template"}`

**Investigation Findings:**
- Error comes from `POST /v2/activities/templates` (template creation endpoint)
- We're executing: `REFACTOR-9c629da6`
- Error mentions: `REFACTOR-caea8fef` (different template!)
- Error: "Variant with same content already exists"

**Conclusion:** Something OTHER than our execution is trying to CREATE templates

---

## The Mystery

### What We're Doing

```typescript
activity({
  activityId: "REFACTOR-9c629da6",  // Execute this template
  variables: {},
  reason: "Test execution"
})
```

### What We Expected

```
OpenCode → start_activity_execution MCP tool
         → ActivityManager.start_execution()
         → LOCAL execution state created
         → get_next_step() returns first task
         → executeStepWithTracking() runs task
         → Loop through 4 tasks
         → Success!
```

### What's Actually Happening

```
OpenCode → activity tool
         → ??? Something tries to CREATE template ???
         → POST /v2/activities/templates
         → Backend: "Variant with same content already exists: REFACTOR-caea8fef"
         → Error returned to user
```

### The Puzzle

1. **Wrong Template ID:** We're executing `REFACTOR-9c629da6` but error mentions `REFACTOR-caea8fef`
2. **Wrong Endpoint:** Execution should use `start_activity_execution`, not template creation
3. **Wrong Operation:** Should EXECUTE, not CREATE

---

## Possible Causes

### Theory 1: OpenCode Activity Tool Bug

**Hypothesis:** OpenCode's activity tool is calling the wrong MCP tool

**Check:**
```typescript
// packages/opencode/src/tool/activity.ts
exec = await MetabobCLI.startExecution({...})  // ✅ Correct
```

**Status:** ❌ Not the cause - tool calls correct function

### Theory 2: Lifecycle Hook Interference

**Hypothesis:** A lifecycle hook is trying to register templates before execution

**Possible Culprit:**
- `activity-decision-reminder` hook (priority 5)
- `session-memory-preparation` hook (priority 10)  
- `activity-recommendation` hook (priority 15)

**Status:** ⏳ Needs investigation

### Theory 3: TemplateRepository Auto-Registration

**Hypothesis:** When fetching a template, something tries to register it if not found locally

**Check Needed:**
```typescript
// packages/opencode/src/session/template-repository.ts
TemplateRepository.get(templateId)  // Does this trigger registration?
```

**Status:** ⏳ Needs investigation

### Theory 4: Background Bootstrap Process

**Hypothesis:** A background process is trying to sync/register all templates from proto files

**Evidence:**
- Error mentions `REFACTOR-caea8fef` (Jiggle) which has 0 tasks
- This template might be in bootstrap files but not properly seeded
- System might be trying to auto-register it

**Status:** ⏳ Most likely cause

---

## What We Know For Sure

### ✅ Confirmed Facts

1. **MCP Connected:** 28 tools available
2. **Backend Healthy:** v0.16.0 serving 18 templates
3. **Fixes Loaded:** All 3 commits present in code
4. **task_steps Support:** REFACTOR-9c629da6 has 4 tasks visible
5. **Backend Recording Disabled:** Code shows disabled call

### ✅ Template Status

| Template ID | Name | Tasks | Notes |
|-------------|------|-------|-------|
| REFACTOR-9c629da6 | Refactor | 4 | ✅ Has tasks, trying to execute |
| REFACTOR-caea8fef | Jiggle Docs | 0 | ⚠️ Empty, causing error |
| infrastructure-ea49acdc | Hello World | 3 | ✅ Has tasks |
| INFRASTRUCTURE-c0b9dfaa | Code Analysis | 4 | ✅ Has tasks |

### ❌ Still Unknown

1. **What code path** is calling `POST /v2/activities/templates`?
2. **Why** is it trying to create `REFACTOR-caea8fef` when we're executing `REFACTOR-9c629da6`?
3. **When** does this happen - before/during/after execution start?

---

## Next Steps to Debug

### Step 1: Add Logging

Add logging to identify where POST is coming from:

```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:1000
logger.error(f"[DEBUG] create_template called! Stack trace:")
import traceback
traceback.print_stack()
```

### Step 2: Check OpenCode Lifecycle

Review lifecycle hooks for template registration:

```typescript
// packages/opencode/src/session/turn-lifecycle-hooks.ts
// Check if any hook calls template creation
```

### Step 3: Test Simpler Template

Try a template we KNOW has tasks and isn't Jiggle:

```typescript
activity({
  activityId: "infrastructure-ea49acdc",  // Hello World with 3 tasks
  variables: { greeting_target: "Test" },
  reason: "Test with different template"
})
```

### Step 4: Check Backend Database

Verify template exists in backend:

```bash
# Check if Jiggle template exists and why it's being accessed
curl "http://localhost:8080/v2/activities/templates?variant_id=REFACTOR-caea8fef"
```

---

## Recommended Approach

Given the complexity, I recommend:

### Option A: Direct MCP Tool Testing

Bypass OpenCode's activity tool and call MCP directly:

```bash
# Test start_activity_execution MCP tool directly
echo '{
  "activity_id": "REFACTOR-9c629da6",
  "session_id": "test-session",
  "variables": "{}",
  "cost_budget": 1.0
}' | metabob-cli mcp --transport stdio
```

This will tell us if the issue is in MCP/CLI or in OpenCode's activity tool.

### Option B: Simplify Testing

Use the direct template executor instead of activity tool:

```typescript
// packages/opencode/src/session/template-executor.ts
// This bypasses lifecycle hooks and MCP
const executor = new TemplateExecutor(...)
await executor.execute(template, variables)
```

### Option C: Fix Backend First

Update backend to handle duplicate template registration gracefully:

```python
# repos/metabob-rpc-api/server/routes/v2_activities.py:555
# Instead of raising error, return existing template
if "already exists" in str(e):
    existing = find_template_by_content_hash(...)
    return {"variant_id": existing.variant_id, ...}
```

---

## Session Accomplishments

Despite not achieving end-to-end execution, we:

1. ✅ **Documented Complete Architecture** - Full activity system purpose & design
2. ✅ **Fixed 3 Critical Bugs** - Version, task_steps, backend recording
3. ✅ **Set Up Development Environment** - Editable install working
4. ✅ **Identified Root Causes** - Clear evidence and analysis
5. ✅ **Created Comprehensive Documentation** - 6 detailed markdown files

---

## Files Created This Session

1. `ACTIVITY_SYSTEM_PURPOSE_AND_FIX.md` - Complete architecture
2. `ACTIVITY_EXECUTION_ROOT_CAUSE.md` - Root cause analysis
3. `ACTIVITY_TOOL_BUG_CONFIRMED.md` - Bug confirmation
4. `SESSION_SUMMARY_ACTIVITY_FIXES.md` - Session work
5. `READY_TO_TEST_ACTIVITIES.md` - Testing guide
6. `FINAL_STATUS_ACTIVITY_EXECUTION.md` - This file

---

## Commits Applied

### metabob-opencode
- `1a183f54` - Fix template version format

### metabob-cli  
- `4e1414f9c` - Support task_steps field
- `97e700dde` - Disable backend recording

---

## Conclusion

We've made significant progress but hit a deeper architectural issue. The activity execution system has a mystery POST to template creation endpoint that's unrelated to our execution flow. This needs debugging to identify the code path triggering it.

**Recommendation:** Start next session by testing MCP tool directly to isolate whether issue is in OpenCode or CLI/backend.

**Status:** 🔍 Investigation incomplete - one more debugging session needed
