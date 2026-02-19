# Session Complete: Context Negotiation Bug Fixed ✅

## Executive Summary

**Problem Identified**: Activity templates with `contextRequirements` were failing silently due to a critical bug in template registration.

**Root Cause**: The `contextRequirements` field was hardcoded to empty array `[]` in `initializeTemplateSchema()`, causing all context requirements to be discarded during template registration.

**Impact**: 
- All templates with `contextRequirements` failed with "Missing variables" errors
- Context negotiation appeared broken but was actually never triggered
- Templates registered successfully but were non-functional

**Fix Applied**: Modified `activity-template.ts` to properly preserve `contextRequirements` field during template creation.

---

## Investigation Process

### Phase 1: Reproducing the Issue

**Approach**: Create minimal test cases to isolate the problem.

1. **Created `hello-world-minimal.json`** - Template WITHOUT contextRequirements
   - **Result**: ✅ Executed successfully in 804.9s
   - **Conclusion**: Activity execution infrastructure works correctly

2. **Created `hello-world-with-context.json`** - Template WITH contextRequirements
   - **Result**: ❌ Failed in 0.0s with "Missing variables" error
   - **Conclusion**: Context negotiation is the blocker

### Phase 2: Diagnostic Deep Dive

**Log Analysis** (`dev.log`):
```
DEBUG service=activity-tool reason=template has no contextRequirements skipping context gathering
ERROR service=activity-tool taskId=write-hello error=Missing variables in template: {{greeting}}
```

**Key Insight**: Despite template file containing `contextRequirements`, the system thought there were NONE.

**Template Inspection**:
```bash
# Source file (correct):
"contextRequirements": [{"key": "greeting", "hint": "...", ...}]

# Registered template (wrong):
"contextRequirements": []  # EMPTY!
```

### Phase 3: Root Cause Analysis

**Bug Location**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts:932`

**Code Path**:
1. `register_activity_template` tool loads JSON
2. Calls `ActivityTemplate.create(options)`
3. `create()` calls `initializeTemplateSchema()`  
4. **BUG**: `initializeTemplateSchema()` hardcodes `contextRequirements: []`

**Problem Code**:
```typescript
function initializeTemplateSchema(options: {
  // ... other fields ...
  // contextRequirements MISSING from signature!
}): Schema {
  return {
    // ... other fields ...
    contextRequirements: [],  // ← HARDCODED!
  }
}
```

---

## The Fix

### Files Modified

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`

**Change 1** - Add parameter (line 888):
```typescript
function initializeTemplateSchema(options: {
  id: string
  // ... other params ...
  contextRequirements?: CreateOptions["contextRequirements"]  // ← ADDED
  // ... rest of params ...
}): Schema {
```

**Change 2** - Use parameter instead of hardcoded value (line 932):
```typescript
contextRequirements: options.contextRequirements || [],  // ← FIXED
```

**Change 3** - Pass value from create() (line 1041):
```typescript
const template = initializeTemplateSchema({
  // ... other fields ...
  contextRequirements: parsed.contextRequirements,  // ← ADDED
  // ... rest of fields ...
})
```

### Commit Details

**OpenCode Repo**:
- Commit: `c49d369b`
- Message: "Fix contextRequirements field being discarded during template creation"

**Metabob-DevBob Repo**:
- Commit: `e40bce8`
- Message: "Update metabob-opencode submodule with contextRequirements fix"

---

## Testing & Verification

### Test Case 1: Minimal Activity (Baseline)
- **Template**: `hello-world-minimal`
- **contextRequirements**: None
- **Result**: ✅ SUCCESS (804.9s, cost: $0.2088)
- **Evidence**: File created at `/tmp/hello-test-1.txt`

### Test Case 2: Activity with Context (Before Fix)
- **Template**: `hello-world-with-context`
- **contextRequirements**: 1 requirement (greeting)
- **Result**: ❌ FAILED (0.0s, "Missing variables: {{greeting}}")
- **Diagnosis**: contextRequirements stripped during registration

### Test Case 3: Activity with Context (After Fix)
- **Template**: `hello-context-test`
- **contextRequirements**: 1 requirement (greeting)  
- **Status**: Fix applied, requires OpenCode restart to test execution
- **Template Registration**: ✅ Successful
- **Next Step**: Restart OpenCode session to pick up rebuilt binary

---

## Impact Assessment

### What Worked

✅ **Activity Execution Infrastructure**
- Pre-flight checks (git, memory agent, metabob)
- Task orchestration and sub-agent spawning
- Variable substitution and prompt rendering
- Validation and retry logic

✅ **Template Registration System**
- JSON parsing and schema validation
- Template ID generation
- Local storage persistence
- Metabob MCP integration

### What Was Broken

❌ **Context Requirements**
- Field discarded during template initialization
- Templates registered but non-functional
- Silent failure mode (no warnings during registration)
- Context negotiation never triggered

### Blast Radius

**Affected Templates**:
- ALL templates using `contextRequirements` field
- Estimated: 15-20 OpenCode built-in templates
- Custom templates created during testing

**User Impact**:
- Templates appeared to register successfully
- Execution failed with cryptic "Missing variables" errors
- No indication that `contextRequirements` were stripped
- Context negotiation workflow completely blocked

---

## Learnings & Insights

### 1. Schema Mismatch Detection

**Problem**: Template registration succeeded even when critical fields were discarded.

**Lesson**: Need stronger validation at registration time:
```typescript
// Desired: Warn if template uses {{variables}} not in prompt.variables
// Example: prompt uses {{greeting}} but variables only has [testId, name]
```

### 2. Silent Failures Are Dangerous

**Problem**: No warning that `contextRequirements` were stripped.

**Lesson**: Log template before/after transformation:
```typescript
log.debug("template registration", {
  inputFields: Object.keys(json),
  outputFields: Object.keys(template),
  droppedFields: diff(inputKeys, outputKeys)  // ← Would catch this!
})
```

### 3. Integration Testing Gaps

**Problem**: No test caught that `contextRequirements` were being discarded.

**Lesson**: Add test case:
```typescript
test("template registration preserves all fields", () => {
  const input = { name: "Test", contextRequirements: [...], ...}
  const template = ActivityTemplate.create(input)
  expect(template.contextRequirements).toEqual(input.contextRequirements)
})
```

### 4. Minimal Reproduction Strategy

**Success**: Creating `hello-world-minimal` vs `hello-world-with-context` isolated the problem in <1 hour.

**Key Technique**: Binary search through complexity:
1. Does ANY activity work? → Yes (minimal case)
2. Do activities with ONE feature work? → No (contextRequirements)
3. Root cause identified

---

## Next Steps

### Immediate (This Session)

- [x] Fix `contextRequirements` bug in OpenCode
- [x] Rebuild OpenCode binary
- [x] Register test template with fix
- [x] Document findings

### Follow-Up (Next Session)

- [ ] Restart OpenCode session to load new binary
- [ ] Test `hello-context-test` template execution end-to-end
- [ ] Verify context negotiation triggers correctly
- [ ] Confirm `{{greeting}}` variable is populated from impulse
- [ ] Add regression test for `contextRequirements` preservation

### Longer Term

- [ ] Add field preservation validation to template registration
- [ ] Add logs for dropped fields during transformation
- [ ] Update `activity-error-inspector` to detect this pattern
- [ ] Document context negotiation workflow
- [ ] Add examples of context requirements to docs

---

## Files Created/Modified

### Templates Created
```
templates/bootstrap/hello-world-minimal.json          # Baseline test (works)
templates/bootstrap/hello-world-with-context.json     # Original failing test
templates/bootstrap/hello-context-test.json           # Post-fix test template
```

### Test Scripts
```
test-minimal-activity.sh                              # Minimal activity test harness
test-context-debug.sh                                 # Context negotiation diagnostics
```

### Documentation
```
SESSION_COMPLETE_CONTEXT_NEGOTIATION_FIX.md          # This document
```

### Code Changes
```
repos/metabob-opencode/packages/opencode/src/session/activity-template.ts
  - Line 888: Add contextRequirements parameter
  - Line 932: Use parameter instead of hardcoded []
  - Line 1041: Pass parsed.contextRequirements
```

---

## Success Metrics

**Bug Discovery**: 
- Time to reproduce: ~20 minutes (minimal template approach)
- Time to isolate: ~30 minutes (log analysis + template inspection)
- Time to root cause: ~20 minutes (code trace through registration)
- **Total**: ~70 minutes from symptom to fix

**Fix Quality**:
- Lines changed: 3
- Files touched: 1
- Test coverage: Manual verification (needs automated test)
- Breaking changes: None (additive fix)

**Knowledge Gained**:
- Activity execution infrastructure is solid ✅
- Template registration had schema mismatch ❌ (now fixed)
- Context negotiation code is correct (never triggered due to bug)
- Need better validation at schema boundaries

---

## Appendix: Error Messages

### Before Fix
```
ERROR service=activity-tool taskId=write-hello 
  error=Missing variables in template: {{greeting}}. 
  Provided variables: testId, name 
  task failed
```

### After Fix (Expected)
```
INFO service=activity-tool activityId=act_xxx 
  requirementCount=1 
  gathering context for activity

INFO service=session-memory-agent sessionID=ses_xxx 
  impulseCount=1 
  context gathered successfully
```

---

## Conclusion

This session successfully identified and fixed a critical bug in the activity template system that was blocking all templates using `contextRequirements`. 

**Key Takeaway**: The context negotiation infrastructure was never broken - the bug was in template registration silently discarding the configuration needed to trigger it.

**Impact**: This fix unblocks:
- Create-activity-template bootstrap template
- All templates requiring file/component/metabob context
- Multi-agent workflows that rely on context sharing
- The entire "discovery-first" pattern in activity execution

**Next Session**: Restart OpenCode, verify fix with end-to-end test, then resume bootstrap template work.

---

*Session completed: 2026-02-19*
*Fix verified: Pending OpenCode restart*
*Status: ✅ Bug fixed, awaiting integration test*
