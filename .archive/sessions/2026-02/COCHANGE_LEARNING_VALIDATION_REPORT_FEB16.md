# Cochange Learning Integration - Validation Report

**Date**: 2026-02-16  
**Session**: Resume from Feb 15-16 integration work  
**Status**: ✅ Templates validated, ⏭️ Re-registration required for testing

---

## Executive Summary

**Integration Status**: ✅ **COMPLETE**  
**Template Validation**: ✅ **PASSED**  
**Testing Status**: ⏭️ **BLOCKED - Re-registration required**

The cochange learning integration has been successfully implemented in all three major activity templates. JSON file validation confirms all required components are present and correctly structured. However, the templates registered in the backend are older versions and need to be updated before full end-to-end testing can proceed.

---

## What Was Completed

### Templates Integrated (3/3)

1. ✅ **fix-bug-complete.json** (33,731 bytes)
   - Task 0: Includes `metabob_suggest_related_changes` with `top_k: 8`
   - Task 0: Stores predictions in `### Predicted Cochanges` section
   - Final Task: Calculates accuracy and stores in `BUG_FIX_SUMMARY.md`
   - Validation: Requires `"Cochange accuracy:"` pattern

2. ✅ **add-feature-complete.json** (40,712 bytes)
   - Task 0: Includes `metabob_suggest_related_changes` with `top_k: 8`
   - Task 0: Stores predictions in `FEATURE_DESIGN.md`
   - Final Task: Calculates accuracy in `FEATURE_SUMMARY.md`
   - Validation: Requires `"Cochange accuracy:"` pattern

3. ✅ **refactor-component-complete.json** (49,994 bytes)
   - Task 0: Uses both `analyze_change_impact` AND `suggest_related_changes` (`top_k: 10`)
   - Task 0: Stores predictions in `REFACTORING_PLAN.md`
   - Final Task: Calculates accuracy in `REFACTORING_SUMMARY.md`
   - Validation: Requires `"Cochange accuracy:"` pattern

### Integration Pattern Applied

**Early Task (Design/Planning)**:
```typescript
// Guidance added
"Use metabob_suggest_related_changes to predict files that may need changes"

// Prompt template section
### 3. Predict Related Files

Use `metabob_suggest_related_changes` to predict which files may need changes:

metabob_suggest_related_changes({
  changed_files: ["path/to/suspected/file.ts"],
  top_k: 8
})

**Store predictions**: Document the predicted cochanges in [DESIGN_DOC].md 
for later comparison.

// Validation
"### Predicted Cochanges"  // Required section in design doc
```

**Late Task (Documentation/Summary)**:
```typescript
// Guidance added
"Compare predicted vs actual cochanges and calculate accuracy"

// Prompt template section
### 2. Calculate Cochange Accuracy

Compare predicted vs actual:
- Predicted files (from [DESIGN_DOC].md): [count]
- Actually modified files: [count]
- Correct predictions: [count matching]
- Cochange accuracy: X/Y (percentage)

// Validation
"Cochange accuracy:"  // Required pattern in summary doc
```

---

## Validation Results

### ✅ JSON Structure Validation

**fix-bug-complete.json**:
```bash
# Task 0 variables (all optional except bug_description)
- bug_description: required=true
- error_message: required=false
- steps_to_reproduce: required=false
- affected_files: required=false

# Final task validation
- "Cochange accuracy:" ✓ Present in requiredPatterns
```

**add-feature-complete.json**:
```bash
# Task 0 variables
- feature_name: required=true
- feature_description: required=true
- [other variables...]

# Final task validation
- "Cochange accuracy:" ✓ Present in requiredPatterns
```

**refactor-component-complete.json**:
```bash
# Task 0 variables
- component_file: required=true
- component_name: required=true
- refactoring_goal: required=true

# Final task validation
- "Cochange accuracy:" ✓ Present in requiredPatterns
```

### ❌ Backend Registration Status

**Current State**:
```bash
# Templates registered in backend have OLD schema
bug-fix-93374d0f:
  - Variables: bug_description, error_message, previous_step_output
  - Status: OUTDATED (missing cochange integration)

feature-impl-c4b2e8ee:
  - Status: OUTDATED (missing cochange integration)

refactor-72eb4607:
  - Status: OUTDATED (missing cochange integration)
```

**Root Cause**: JSON files updated but not re-registered with backend

---

## Architecture Verification

### Learning Loop Design

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PREDICTION (Early Task)                                  │
│    ┌──────────────────────────────────────────────────┐    │
│    │ metabob_suggest_related_changes()                │    │
│    │ → Store predictions in design doc                │    │
│    │ → Agent sees predictions before implementation   │    │
│    └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. IMPLEMENTATION (Middle Tasks)                            │
│    ┌──────────────────────────────────────────────────┐    │
│    │ Agent implements changes                         │    │
│    │ → May be influenced by predictions               │    │
│    │ → Modifies files based on analysis               │    │
│    └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. COMPARISON (Final Task)                                  │
│    ┌──────────────────────────────────────────────────┐    │
│    │ Compare predictions vs actual                    │    │
│    │ → Extract predictions from design doc            │    │
│    │ → Get actual changes from git diff               │    │
│    │ → Calculate accuracy: (Correct / Total) * 100%   │    │
│    │ → Document in summary with insights              │    │
│    └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. EXTRACTION (OpenCode CLI - Automatic)                    │
│    ┌──────────────────────────────────────────────────┐    │
│    │ CLI parses summary document                      │    │
│    │ → Regex: /Cochange accuracy:.*?(\d+\/\d+)/      │    │
│    │ → Extracts: cochangeAccuracy = X/Y              │    │
│    │ → Adds to outcome metadata                       │    │
│    └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. BACKEND LEARNING (Metabob RPC API)                       │
│    ┌──────────────────────────────────────────────────┐    │
│    │ Receives outcome with cochangeAccuracy           │    │
│    │ → Updates Thompson Sampling weights              │    │
│    │ → Commissions variants if accuracy < 50%         │    │
│    │ → Adjusts routing for future tasks               │    │
│    └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### CLI Extraction Logic

**Location**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:544-547`

```typescript
// Extract cochange accuracy from summary document
const cochangeMatch = summaryContent.match(/Cochange accuracy:.*?(\d+\/\d+)/)
if (cochangeMatch) {
  comparison.cochangeAccuracy = cochangeMatch[1] // e.g., "3/5"
}
```

**Verification**: ✅ This code path exists and is active in the current codebase

---

## Test Environment Setup

### Test Workspace Created

```
test-cochange-learning/
├── src/
│   └── auth.ts          # Contains intentional null pointer bug
├── tests/               # Empty (tests to be created by template)
└── README.md           # Test scenario documentation
```

**Bug Scenario**:
```typescript
export function getUserProfile(user: User): { name: string; email: string } {
  // BUG: No null check - crashes if user is null
  return {
    name: user.name,      // Crashes here if user is null
    email: user.email
  };
}
```

**Expected Test Flow**:
1. Run `bug-fix-93374d0f` activity
2. Task 0: Agent predicts related files (auth-utils.ts, session.ts, users.ts)
3. Task 1-2: Agent fixes bug, adds null check
4. Task 3: Agent calculates accuracy (predictions vs actual)
5. CLI extracts accuracy from BUG_FIX_SUMMARY.md
6. Backend receives structured outcome data

---

## Blocking Issues

### Issue 1: Template Re-Registration Required

**Problem**: Backend has old template versions without cochange integration

**Evidence**:
```bash
# Attempting to run activity with new variables fails
$ activity(activityId: "bug-fix-93374d0f", variables: {...})
Error: Missing required variables:
  - error_message (required in old template)
  - previous_step_output (required in old template)
Unexpected variables:
  - affected_files (new in updated template)
  - steps_to_reproduce (new in updated template)
```

**Solution**: Re-register templates using `register_activity_template` tool

**Steps**:
```typescript
// In agent context with register_activity_template tool available:
register_activity_template({
  file_path: "fix-bug-complete.json",
  register_with_metabob: true
})

register_activity_template({
  file_path: "add-feature-complete.json",
  register_with_metabob: true
})

register_activity_template({
  file_path: "refactor-component-complete.json",
  register_with_metabob: true
})
```

**Note**: This tool may only be available in certain agent modes (general/tool agent, not activity agent)

---

## Next Steps

### Immediate Actions Required

#### 1. Re-Register Templates ⚠️ CRITICAL

**Approach A: Use register_activity_template tool**
```typescript
// Requires agent context with tool access (general agent or tool agent)
register_activity_template({ file_path: "fix-bug-complete.json" })
register_activity_template({ file_path: "add-feature-complete.json" })
register_activity_template({ file_path: "refactor-component-complete.json" })
```

**Approach B: Use OpenCode CLI (if available)**
```bash
# If there's a CLI command for registration
opencode template register fix-bug-complete.json
opencode template register add-feature-complete.json
opencode template register refactor-component-complete.json
```

**Approach C: Backend Direct Registration**
```bash
# If there's a backend API endpoint
curl -X POST http://backend/api/v2/templates/register \
  -H "Content-Type: application/json" \
  -d @fix-bug-complete.json
```

**Approach D: Template Library Reload**
```typescript
// If templates are auto-discovered from project directory
TemplateLibrary.reload()
// or
TemplateLibrary.installFromDirectory("./")
```

#### 2. Run Integration Tests

Once templates are re-registered:

**Test 1: fix-bug-complete**
```typescript
activity({
  activityId: "bug-fix-[NEW_HASH]",  // New hash after re-registration
  variables: {
    bug_description: "getUserProfile crashes with null user",
    affected_files: "test-cochange-learning/src/auth.ts",
    steps_to_reproduce: "Call getUserProfile(null)"
  },
  reason: "Validate cochange learning integration"
})
```

**Expected Outputs**:
- ✓ `BUG_ANALYSIS.md` contains `### Predicted Cochanges` section
- ✓ Predictions list related files (e.g., auth-utils.ts, session.ts)
- ✓ `BUG_FIX_SUMMARY.md` contains `Cochange accuracy: X/Y (Z%)`
- ✓ CLI extracts accuracy and sends to backend
- ✓ Backend stores outcome with cochangeAccuracy field

**Test 2: add-feature-complete**
```typescript
activity({
  activityId: "feature-impl-[NEW_HASH]",
  variables: {
    feature_name: "User Avatar Upload",
    feature_description: "Allow users to upload profile avatars"
  },
  reason: "Validate cochange learning in feature development"
})
```

**Test 3: refactor-component-complete**
```typescript
activity({
  activityId: "refactor-[NEW_HASH]",
  variables: {
    component_file: "test-cochange-learning/src/auth.ts",
    component_name: "authenticate",
    refactoring_goal: "Extract authentication logic to separate service"
  },
  reason: "Validate cochange learning in refactoring workflow"
})
```

#### 3. Verify Backend Learning

```bash
# Check if backend received cochange accuracy
opencode activity outcomes --last 3 --json | jq '.[] | {
  activityId,
  templateId,
  cochangeAccuracy: .comparison.cochangeAccuracy
}'

# Expected output:
# {
#   "activityId": "act_xyz",
#   "templateId": "bug-fix-[HASH]",
#   "cochangeAccuracy": "3/5"  # 60% accuracy
# }
```

#### 4. Monitor Thompson Sampling

```bash
# Check if backend is routing based on cochange accuracy
opencode activity stats --template bug-fix-complete

# Expected: Templates with higher accuracy get more traffic
```

---

## Success Criteria

### Phase 1: Template Validation ✅ COMPLETE
- [x] All 3 templates include cochange prediction in early task
- [x] All 3 templates include accuracy calculation in final task
- [x] All 3 templates have validation for required sections
- [x] JSON structure is valid and follows schema

### Phase 2: Registration & Testing ⏭️ PENDING
- [ ] Templates re-registered with updated schema
- [ ] Activity execution succeeds with new variables
- [ ] Predictions appear in design documents
- [ ] Accuracy appears in summary documents
- [ ] CLI extracts accuracy correctly
- [ ] Backend receives structured outcome data

### Phase 3: Learning Verification ⏭️ PENDING
- [ ] Backend updates Thompson Sampling weights
- [ ] Templates with higher accuracy get prioritized
- [ ] Variants commissioned for low-accuracy templates
- [ ] Cochange predictions improve over time

---

## Risk Assessment

### Low Risk ✅
- Template JSON structure: Validated and correct
- Integration pattern: Consistent across all templates
- Validation rules: Properly configured
- CLI extraction: Code path verified to exist

### Medium Risk ⚠️
- Template registration: May require specific agent mode or CLI access
- Backend availability: Need to verify MCP backend is running
- Test workspace: Minimal setup, may need more realistic scenario

### High Risk ❌
- None identified at this time

---

## Documentation Status

### Created This Session
1. ✅ `COCHANGE_LEARNING_VALIDATION_REPORT_FEB16.md` (this file)

### Created Previous Session (Feb 15-16)
1. ✅ `FIX_BUG_COMPLETE_COCHANGE_INTEGRATION.md`
2. ✅ `ADD_FEATURE_COMPLETE_COCHANGE_INTEGRATION.md`
3. ✅ `REFACTOR_COMPONENT_COMPLETE_COCHANGE_INTEGRATION.md`
4. ✅ `SESSION_SUMMARY_FEB16_COCHANGE_INTEGRATION_COMPLETE.md`
5. ✅ `COCHANGE_LEARNING_TESTING_PLAN.md`
6. ✅ `COCHANGE_IMPULSE_ACTIVITY_LEARNING_GUIDE.md` (comprehensive reference)

### Recommended Additional Documentation
- [ ] Template registration troubleshooting guide
- [ ] Backend API integration guide
- [ ] Monitoring dashboard setup guide
- [ ] Template authoring best practices (incorporating cochange learning)

---

## Recommendations

### For Immediate Testing

1. **Switch to General Agent Mode**
   - Activity mode may have restricted tool access
   - General agent has `register_activity_template` tool
   - Can then re-register templates and run tests

2. **Verify Backend Status**
   ```bash
   # Check if Metabob MCP backend is running
   opencode mcp status
   # or
   curl http://backend/health
   ```

3. **Create Realistic Test Scenarios**
   - Current test workspace is minimal
   - Add more related files (auth-utils.ts, session.ts, users.ts)
   - Create interdependencies to test cochange predictions

### For Long-Term Success

1. **Automated Template Registration**
   - Add pre-commit hook to re-register templates on change
   - Or file watcher that auto-registers on save

2. **Cochange Accuracy Dashboard**
   - Track accuracy trends over time
   - Visualize which templates are improving
   - Monitor variant commissioning

3. **Template Evolution Monitoring**
   - Track when variants are created
   - Compare parent vs variant accuracy
   - Retire low-performing variants

4. **Expand to Remaining Templates**
   - Apply same pattern to `add-unit-tests.json`
   - Apply to `add-rest-endpoint.json`
   - Apply to infrastructure/tool templates

---

## Conclusion

The cochange learning integration is **structurally complete** and validated. All three major activity templates now include:

✅ Early prediction using `metabob_suggest_related_changes`  
✅ Prediction storage in design documents  
✅ Accuracy calculation comparing predictions vs actual changes  
✅ Accuracy storage in summary documents with required validation  
✅ CLI extraction path verified to exist  

**The only blocker** is re-registering the updated templates with the backend so they can be executed with the new variables and tested end-to-end.

**Recommended immediate action**: Switch to general agent mode and use `register_activity_template` tool to update the backend, then proceed with integration testing.

---

## Quick Reference

**Template Files**:
- `/home/avi/documents/work/exp-repo/metabob-devbob/fix-bug-complete.json` (33KB)
- `/home/avi/documents/work/exp-repo/metabob-devbob/add-feature-complete.json` (40KB)
- `/home/avi/documents/work/exp-repo/metabob-devbob/refactor-component-complete.json` (49KB)

**Test Workspace**:
- `/home/avi/documents/work/exp-repo/metabob-devbob/test-cochange-learning/`

**Current Activity IDs** (old versions):
- `bug-fix-93374d0f` (needs re-registration)
- `feature-impl-c4b2e8ee` (needs re-registration)
- `refactor-72eb4607` (needs re-registration)

**CLI Extraction Code**:
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:544-547`

**Registration Tool**:
- `register_activity_template({ file_path: "template.json" })`
- Tool description: `repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.txt`

---

**Report Generated**: 2026-02-16T10:24:45Z  
**Session ID**: [Current Session]  
**Agent Mode**: Activity Mode (tool restrictions apply)
