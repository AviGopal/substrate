# Activity System Error Handling - Sprint 1 Implementation

## Executive Summary

The activity system has **strong error handling for in-flight failures** but **lacks pre-flight validation and structured error types**. This Sprint 1 plan adds 4 critical improvements to make activities fail fast with transparency.

**Key Problems Identified:**
1. ❌ Git status not checked → activities fail mid-execution with uncommitted changes
2. ❌ No pre-flight validation → wastes tokens before detecting issues
3. ❌ Generic error strings → error inspector can't classify failures
4. ❌ Error inspector misses pre-task failures → reports "No Errors Found" incorrectly

**Solution:**
Add structured error types, comprehensive pre-flight checks, and fix error inspector to detect ALL failure modes.

---

## 🎯 Sprint 1 Goals

### 1. Add Structured Error Types (Priority: HIGH)
**Impact**: Error classification, better debugging, enables retry logic

**What We're Adding**:
- `ActivityError` base class with `type` field
- Specialized errors: `ValidationError`, `TemplateError`, `GitError`, `ContextError`
- Structured error context (variables, files, requirements)

**Files Modified**:
- `repos/metabob-opencode/packages/opencode/src/tool/activity-errors.ts` (NEW)
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Before**:
```typescript
throw new Error("Activity template not found")
```

**After**:
```typescript
throw new TemplateError(
  "Activity template not found. Use search_activities tool.",
  { templateId: params.templateId }
)
```

---

### 2. Add Pre-flight Activity Checks (Priority: HIGH)
**Impact**: Fail fast, save tokens, clear error messages

**What We're Adding**:
- Git status check (working tree must be clean)
- Memory agent availability check (if context requirements exist)
- Metabob availability check (if required by template)
- Activity-level validation commands
- Pre-flight results surfaced in metadata

**Files Modified**:
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
- `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts`

**Checks Run Before Activity Starts**:
```
✓ Git working tree is clean
✓ Memory agent available (if needed)
✓ Metabob available (if needed)  
✓ Activity validation commands pass
→ If ALL checks pass: create activity and execute
→ If ANY check fails: throw structured error immediately
```

**Example Output**:
```json
{
  "preFlightChecks": {
    "gitStatus": { "clean": true },
    "memoryAgent": { "available": true, "agentName": "memory" },
    "metabob": { "required": false, "available": true },
    "validation": { "passed": true, "errors": [] }
  }
}
```

---

### 3. Fix Activity Error Inspector (Priority: HIGH)
**Impact**: Detect pre-task failures, accurate diagnosis

**What We're Fixing**:
- Detect failures that happen BEFORE task execution (no sessions created)
- Classify structured error types correctly
- Update recommendations based on error classification

**Files Modified**:
- `repos/metabob-opencode/packages/opencode/src/tool/activity-error-inspector.ts`

**Before**:
```
Activity fails with variable validation error
→ Error inspector reports: "No Errors Found"
→ User confused
```

**After**:
```
Activity fails with variable validation error
→ Error inspector detects pre-task failure
→ Shows: "Activity Setup and Validation" error
→ Type: validation
→ Context: missing variables, suggestions
```

---

### 4. Comprehensive Testing (Priority: HIGH)
**Impact**: Prevent regressions, validate all scenarios

**What We're Testing**:
- ✅ Dirty git tree rejection
- ✅ Missing required variables
- ✅ Template not found
- ✅ Missing memory agent
- ✅ Error inspector detects all error types
- ✅ Pre-flight results in metadata

**Files Created**:
- `repos/metabob-opencode/packages/opencode/test/activity-error-handling.test.ts` (NEW)

---

## 📋 Implementation Checklist

### Phase 1: Structured Error Types (2-3 hours)
- [ ] Create `activity-errors.ts` with base class and specialized errors
- [ ] Update activity.ts to throw structured errors (8 locations)
- [ ] Update error inspector to classify structured types
- [ ] Test: Create activity with each error type → verify classification

### Phase 2: Pre-flight Checks (3-4 hours)
- [ ] Add `runActivityPreFlightChecks()` function
- [ ] Add `ActivityGit.getStatus()` to get uncommitted files
- [ ] Add git status check before activity creation
- [ ] Add memory agent availability check
- [ ] Add Metabob availability check
- [ ] Surface pre-flight results in metadata
- [ ] Test: Trigger each pre-flight failure → verify fast fail

### Phase 3: Fix Error Inspector (2-3 hours)
- [ ] Detect pre-task failures (check activity.error + no sessions)
- [ ] Update classifyError() for structured types
- [ ] Add pre-task error to taskErrors array
- [ ] Update recommendations for new error types
- [ ] Test: Create pre-task failures → verify inspector detects them

### Phase 4: Testing (3-4 hours)
- [ ] Write unit tests for structured errors
- [ ] Write integration tests for pre-flight checks
- [ ] Write error inspector tests for all scenarios
- [ ] Write end-to-end activity failure tests
- [ ] Run full test suite → verify 100% pass rate

**Total Time**: 10-14 hours

---

## 🚀 Expected Outcomes

### Before Sprint 1
```
User: Run activity with typo in variable name
→ Activity creates record, gathers context, starts execution
→ Fails 2 minutes later with "Missing variable"
→ Wasted: $0.15, 8,000 tokens, 2 minutes
→ Error inspector: "No Errors Found"
```

### After Sprint 1
```
User: Run activity with typo in variable name
→ Pre-flight validation detects typo immediately
→ Fails in < 1 second with:
    "❌ ValidationError: Missing required variable 'featureName'
     Did you mean 'featureNam'?"
→ Wasted: $0, 0 tokens, 0 seconds
→ Error inspector: "Activity Setup and Validation failed: validation error"
```

### Key Metrics
- ⚡ **90% faster failure detection** (2 minutes → 1 second)
- 💰 **100% token savings** on pre-flight failures
- 🎯 **100% error detection rate** (vs 0% for pre-task failures)
- 📊 **Structured error data** for analytics and retry logic

---

## 📄 Files to Modify

### New Files (2)
1. `repos/metabob-opencode/packages/opencode/src/tool/activity-errors.ts`
   - Structured error types

2. `repos/metabob-opencode/packages/opencode/test/activity-error-handling.test.ts`
   - Comprehensive test suite

### Modified Files (3)
1. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
   - Add structured error throws (8 locations)
   - Add pre-flight checks function
   - Add pre-flight results to metadata
   - **Lines Modified**: 307-311, 330, 438, 729, 739, 766, 788, 298 (new), 487-497

2. `repos/metabob-opencode/packages/opencode/src/tool/activity-error-inspector.ts`
   - Detect pre-task failures
   - Classify structured errors
   - **Lines Modified**: 179-260, 296-312

3. `repos/metabob-opencode/packages/opencode/src/session/activity-git.ts`
   - Add `getStatus()` method to return uncommitted files
   - **Lines Modified**: 75-78 (new method)

**Total Files**: 5 files (2 new, 3 modified)

---

## 🧪 Testing Strategy

### Unit Tests (6 tests)
- `ActivityError` and specialized error types
- Error serialization (toJSON)
- Error classification (classifyError)
- Pre-flight check functions
- Error context extraction
- Error inspector pre-task detection

### Integration Tests (8 tests)
- Dirty git tree → GitError
- Missing variables → ValidationError
- Template not found → TemplateError
- Missing memory agent → ContextError
- Metabob unavailable → ContextError
- Pre-flight results in metadata
- Error inspector detects all types
- End-to-end activity failure scenarios

### Expected Coverage
- **Error handling code**: 95%+
- **Pre-flight checks**: 100%
- **Error inspector**: 90%+

---

## 📊 Risk Assessment

### Low Risk ✅
- Structured error types (additive, no breaking changes)
- Pre-flight checks (fail-fast is safer)
- Error inspector fix (only affects failed activities)

### Medium Risk ⚠️
- Git status check might reject valid scenarios (e.g., submodule changes)
  - **Mitigation**: Add `--ignore-submodules` flag option
- Memory agent check might block valid templates
  - **Mitigation**: Only check if contextRequirements exist

### High Risk ❌
- None identified

---

## 🎬 Next Steps

1. **Review this plan** with team
2. **Approve scope** and timeline (10-14 hours)
3. **Execute Phase 1** (structured errors)
4. **Execute Phase 2** (pre-flight checks)
5. **Execute Phase 3** (error inspector fix)
6. **Execute Phase 4** (testing)
7. **Deploy and monitor** error rates

---

## 📖 Reference Documentation

- **Full Analysis**: `ACTIVITY_ERROR_HANDLING_ANALYSIS.md`
- **Error Flow Diagram**: See "Error Flow Overview" in analysis doc
- **Example Errors**: See "Error surfacing" sections in analysis doc
- **Test Coverage**: See "Testing Strategy" above

---

## Success Criteria

✅ Sprint 1 is **COMPLETE** when:
1. All structured error types implemented and tested
2. Pre-flight checks run before activity creation
3. Error inspector detects pre-task failures
4. All tests pass (100% of new tests)
5. No regressions in existing activity execution
6. Documentation updated with new error types

**Expected Completion**: 2 working days (10-14 hours)
