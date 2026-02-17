# Testing Status - February 12, 2026

**Session**: Activity execution testing after removing cache and legacy callers

---

## Issue Discovered: Wrong State File

### Problem
metabob-cli MCP tools were loading session token from the wrong location:
- ❌ Loading from: `repos/metabob-cli/.metabob/state` (test token)
- ✅ Should load from: `/workspace/.metabob/state` (real session token)

### Root Cause
`load_config()` uses `Path.cwd()` which is the current working directory where the MCP server runs. If the server runs from `repos/metabob-cli`, it loads the local state file instead of the workspace state file.

### Symptoms
- Direct curl with workspace session token → ✅ Works, returns templates
- metabob-cli get_activity_template_tool → ❌ Returns "not_found"
- OpenCode activity execution → ❌ TypeError (template structure issues)

### Fix Applied
```bash
cp .metabob/state repos/metabob-cli/.metabob/state
```

Copied correct session token to metabob-cli directory so MCP tools can find it.

### Verification
```bash
# Test direct: WORKS NOW ✅
cd repos/metabob-cli
python3 -c "..."
# Result: Status: success, Template found, Task count: 1
```

---

## Backend Status ✅

### Templates Available (20 total)
```
curl -H "Authorization: Bearer <token>" \
  http://localhost:8080/v2/activities/templates
```

**Key Templates**:
- `infrastructure-51aee5c8`: Proof Greeting Feb12 (1 task)
- `INFRASTRUCTURE-0013e379`: Activity Create (for creating new templates)
- `REFACTOR-9c629da6`: Refactor
- `INFRASTRUCTURE-c0b9dfaa`: Code Analysis
- ... and 16 more

### Backend Health
- Status: ✅ Healthy
- Version: 0.16.0
- Endpoint: http://localhost:8080
- Auth: Bearer token required

---

## Changes Applied Today

### 1. Removed Local Caching ✅
**File**: `template-loader.ts`
- Commented out all `TemplateCache.get()` checks
- Commented out all `TemplateCache.put()` calls
- Every load() now calls MCP → Backend

**Purpose**: Enable dynamic variant serving

### 2. Removed Legacy Auto-Registration ✅
**File**: `activity-template.ts`  
- Disabled `autoRegisterWithMetabob()` function
- This was calling save() after templates were already saved
- Caused duplicate creation attempts → 500 errors

**Purpose**: Fix unexpected save() calls

### 3. Re-enabled save() ✅
**File**: `activity-template-repository.ts`
- Restored actual save operation
- Safe now that legacy caller is removed

**Purpose**: Allow legitimate template creation

### 4. Fixed Session Token Loading ✅
**Action**: Copied workspace state to metabob-cli
**Purpose**: MCP tools can authenticate with backend

---

## Testing Plan (After Restart)

### Test 1: Basic Activity Execution
```javascript
activity({
  activityId: "infrastructure-51aee5c8",
  variables: {name: "Test"},
  reason: "Test basic execution without cache"
})
```

**Expected**:
- ✅ No cache hits
- ✅ Fresh MCP call to backend
- ✅ Template loaded successfully  
- ✅ Activity executes

### Test 2: Activity Creation
```javascript
activity({
  activityId: "INFRASTRUCTURE-0013e379",  // activity-create
  variables: {
    template_name: "test-template",
    template_description: "Test",
    category: "infrastructure",
    tasks: JSON.stringify([...])
  },
  reason: "Test template creation"
})
```

**Expected**:
- ✅ New template created
- ✅ Single save() call (not double)
- ✅ Template appears in backend
- ✅ Can execute created template

### Test 3: Multiple Executions
Execute same activity 3 times to verify fresh MCP calls each time.

---

## Next Steps

### Immediate (After Restart)
1. ✅ Verify MCP tools load correct session token
2. Test basic activity execution
3. Verify no cache hits (all MCP calls)
4. Test activity-create template

### Short-term
1. Permanent fix for state file location
   - MCP server should run from workspace root
   - Or use METABOB_CONFIG_PATH env var
2. Test outcome reporting
3. Clean up debug logging

### Medium-term
1. Backend variant selection logic
2. A/B testing framework
3. Performance analytics

---

## Files Modified

1. `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`
   - Removed cache checks and puts

2. `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
   - Disabled autoRegisterWithMetabob()

3. `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`
   - Re-enabled save()

4. `repos/metabob-cli/.metabob/state`
   - Copied correct session token

---

## Debug Artifacts

- `activity-debug.log` - Complete execution trace
- Multiple architecture documentation files
- Test scripts and verification commands

---

**Status**: ✅ Ready for restart and full testing
**Blocker Resolved**: Session token now correct, MCP tools authenticated
