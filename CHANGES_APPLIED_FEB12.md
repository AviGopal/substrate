# Changes Applied - February 12, 2026

**Goal**: Remove local caching, enable dynamic variant serving, fix legacy save() caller

---

## Changes Made

### 1. Removed Local Template Caching ✅

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`

**What Changed**:
- **Line 247-260**: Commented out TemplateCache.get() check for original ID
- **Line 266-282**: Commented out TemplateCache.get() check for resolved variant_id
- **Line 305**: Commented out TemplateCache.put() after MCP load
- **Line 645**: Commented out TemplateCache.put() after save

**Why**:
- Enable dynamic variant serving from backend
- Backend selects optimal variant each time based on performance data
- Allow A/B testing of template variants
- Support data-driven template evolution

**Impact**:
- Every activity execution → Fresh MCP call → Backend variant selection
- No stale templates
- Backend can experiment with 5% of requests
- System learns which variants work best

---

### 2. Removed Legacy Auto-Registration ✅

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

**What Changed**:
- **Line 790-807**: Disabled `autoRegisterWithMetabob()` function
- Function now just logs debug message and returns
- Commented out the TemplateRepository.save() call

**Why**:
- This function was calling save() AFTER templates were already saved
- Caused duplicate creation attempts → 500 errors
- Templates from backend don't need to be "registered" back to backend
- Legacy pattern from old file-based system

**Impact**:
- No more unexpected save() calls after template creation
- Template creation happens once via proper flow
- Eliminates 500 errors from duplicate creation

---

### 3. Re-enabled Template Save() ✅

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`

**What Changed**:
- **Line 141-152**: Removed debug disable code
- Restored actual save operation via TemplateLoader.save()
- Added comment explaining legitimate use cases

**Why**:
- Save is needed for creating NEW templates (activity-create)
- Save is needed for updating templates (activity-evolve)
- Safe to re-enable now that legacy caller is removed

**Impact**:
- Template creation will work properly
- activity-create template can create templates
- No more duplicate save attempts

---

## Architecture Before vs After

### BEFORE (Problematic)
```
User → activity(id)
  → TemplateRepository.get()
  → TemplateLoader.load()
  → TemplateCache.get() → HIT ✅
  → Return cached template
  → autoRegisterWithMetabob() ❌ ← Tries to save again
  → TemplateRepository.save()
  → POST to backend
  → 500 Error: Template exists
```

### AFTER (Fixed)
```
User → activity(id)
  → TemplateRepository.get()
  → TemplateLoader.load()
  → Skip cache (commented out)
  → MetabobCLI.getActivityTemplate() ✅
  → MCP → Backend SELECT VARIANT
  → Backend returns optimal variant based on data
  → Return template
  → Execute (no save attempt)
  → Report outcome to backend (TODO)
```

---

## Testing Required

### Test 1: Activity Execution (Basic)
```javascript
activity({
  activityId: "infrastructure-51aee5c8",
  variables: {name: "Test"},
  reason: "Verify activities work without cache"
})
```

**Expected**: 
- ✅ Activity executes successfully
- ✅ MCP call to get_activity_template
- ✅ No save() attempt
- ✅ No 500 error

### Test 2: Activity Creation
```javascript
activity({
  activityId: "INFRASTRUCTURE-0013e379",  // activity-create
  variables: {
    template_name: "test-simple",
    template_description: "Test template",
    category: "infrastructure",
    tasks: JSON.stringify([{
      subagent: "general",
      prompt: "Echo 'test'",
      validation: {type: "output_contains", value: "test"}
    }])
  },
  reason: "Test template creation"
})
```

**Expected**:
- ✅ New template created via single save() call
- ✅ No duplicate save attempt
- ✅ Template appears in search_activities
- ✅ Created template can be executed

### Test 3: Multiple Executions (Variant Serving)
```javascript
// Execute same activity multiple times
for (let i = 0; i < 3; i++) {
  activity({
    activityId: "infrastructure-51aee5c8",
    variables: {name: `Test ${i}`},
    reason: `Test ${i}`
  })
}
```

**Expected**:
- ✅ Each execution → Fresh MCP call
- ✅ Backend could serve different variants (if available)
- ✅ No caching between executions

---

## Debug Logging Still Active

**Log File**: `activity-debug.log`

**What's Logged**:
- Every load() call with sessionID
- MCP calls (both OpenCode and metabob-cli)
- save() calls (now should only be for legitimate creation)
- Timestamps for sequence analysis

**Keep For Now**:
- Helpful for verifying no-cache behavior
- Shows MCP calls happening
- Can be removed after confirmation tests pass

---

## Next Steps

### Immediate (After Restart)
1. Test basic activity execution
2. Verify MCP calls happen (not cache hits)
3. Confirm no save() attempts during execution
4. Test activity-create template

### Short-term
1. Clean up debug logging (keep as comments)
2. Add outcome reporting to backend
3. Create ARCHITECTURE_PRINCIPLES.md
4. Commit changes

### Medium-term
1. Backend variant selection logic
2. Success/failure tracking
3. A/B testing framework
4. Performance analytics dashboard

---

## Files Modified

1. `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`
   - Removed cache checks
   - Removed cache puts
   - Added architecture comments

2. `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`
   - Disabled autoRegisterWithMetabob()
   - Removed duplicate save() call

3. `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`
   - Re-enabled save() function
   - Added comments for legitimate uses

---

## Risk Assessment

### Low Risk ✅
- Cache removal: No functionality lost, only performance trade-off
- MCP calls are fast (~100-200ms)
- Backend can cache internally if needed

### Medium Risk ⚠️
- Need to verify activity-create still works
- Template updates might be affected
- Trailblazing flow needs testing

### Mitigations
- Comprehensive testing before full deployment
- Debug logging active to catch issues
- Can re-enable cache if critical issues found
- Clear rollback path (git revert)

---

**Status**: Changes applied, ready for restart and testing ✅
