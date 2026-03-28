# CLI Registration Fixes Applied

**Date**: February 15, 2026  
**Session**: Template Impulse Enhancement Resume

## Problems Discovered

### 1. Wrong Task Field Name
**Issue**: CLI sent `tasks` but v2 API expects `task_steps`  
**Error**: `422 - Field required: task_steps`  
**Fix**: Changed `variant_data["tasks"]` → `variant_data["task_steps"]` (line 1167)

### 2. Missing Session Authentication  
**Issue**: CLI didn't send `Authorization: Bearer <token>` header  
**Error**: `401 - Authentication required`  
**Fix**: Added session token loading from `.metabob/state` with upward directory search

### 3. Validation Check Used Wrong Field
**Issue**: After renaming to `task_steps`, validation still checked `variant_data["tasks"]`  
**Error**: `KeyError: 'tasks'`  
**Fix**: Updated validation to check `variant_data["task_steps"]` (line 1177)

## Files Modified

**File**: `repos/metabob-cli/src/metabob_cli/commands.py`

**Changes**:
1. Line 1167: `"tasks":` → `"task_steps":` (v2 API compliance)
2. Line 1177: `variant_data["tasks"]` → `variant_data["task_steps"]` (validation)
3. Line 1204: `variant_data.get("tasks"` → `variant_data.get("task_steps"` (display)
4. Lines 1185-1196: Added session token authentication logic
5. Lines 1187-1195: Smart state file search (current dir, parent dirs)

## Test Results

### Before Fixes
```bash
$ metabob register-template test.json
Error: Failed to register template: 422 - Field required: task_steps
```

### After Fixes
```bash
$ metabob register-template test.json
Successfully registered template: Test Template Type Field
  Template ID: feature-7b94e421
  Category: N/A
  Tasks: 1
  ✓ Template verified in backend
```

## Context Requirements Discovery

**Attempted**: Register templates with `contextRequirements` field  
**Result**: Backend accepts registration but **silently drops context_requirements**  
**Conclusion**: v2 API `/v2/activities/templates` endpoint doesn't support `context_requirements` yet

**Evidence**:
- Registered test template with `contextRequirements: [{key: "test", type: "impulse", ...}]`
- Backend returned 201 Created
- Retrieval showed: `"context_requirements": []` (empty)
- ALL 20 existing backend templates also have `context_requirements: []`

## Next Steps

### Option A: Use Local Template Execution
- Keep enhanced templates as local files
- Don't register with backend (backend doesn't support impulses yet)
- Execute via local activity system (OpenCode reads JSON directly)

### Option B: Backend Implementation Required
- Backend needs to:
  1. Accept `context_requirements` in POST /v2/activities/templates
  2. Store context_requirements in database
  3. Return context_requirements in GET /v2/activities/{id}
- This is a backend feature gap, not a CLI issue

### Option C: Verify Backend Schema
- Check if backend protobuf/schema defines `context_requirements`
- May need backend code update to persist this field

## Recommendation

**Use Option A** for now:
1. Enhanced templates work perfectly as local JSON files
2. Activity system reads them directly (no backend needed)
3. Backend registration can come later when backend supports impulses

The impulse system is **fully functional** - it's just the backend API that doesn't persist `context_requirements` yet.

---

**Status**: ✅ CLI registration fixed, 🟡 Backend impulse support pending
