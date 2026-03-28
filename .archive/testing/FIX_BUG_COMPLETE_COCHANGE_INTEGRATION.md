# Fix-Bug-Complete Template: Cochange Integration Complete

**Date**: 2026-02-16  
**Status**: ✅ Complete  
**Template**: `fix-bug-complete.json`

## Summary

Successfully integrated cochange prediction and tracking into the `fix-bug-complete` activity template. The template now predicts which files should change together, tracks accuracy, and learns from execution outcomes.

---

## Changes Made

### 1. **analyze-and-locate Task** (Task 0)

#### Changes:
- ✅ Added `"Use metabob_suggest_related_changes to predict files that may need changes"` to guidance
- ✅ Added **"### 3. Predict Related Files"** section to prompt template
- ✅ Instructs agent to call `metabob_suggest_related_changes` early in analysis phase
- ✅ Added **"### Predicted Cochanges"** section to BUG_ANALYSIS.md template
- ✅ Updated validation to require `"### Predicted Cochanges"` pattern

#### Why:
Cochange predictions must happen **before** execution to enable meaningful comparison with actual changes. This allows the learning system to calculate cochange accuracy.

#### Template Section:
```markdown
### 3. Predict Related Files

Use `metabob_suggest_related_changes` to predict which files may need changes:

```typescript
metabob_suggest_related_changes({
  changed_files: ["path/to/suspected/file.ts"],
  top_k: 8
})
```

**Why this matters**:
- Similar bugs may exist in related files
- Fix may require coordinated changes across multiple files
- Helps avoid incomplete fixes that break related functionality

**Store predictions**: Document the predicted cochanges in BUG_ANALYSIS.md for later comparison.
```

#### BUG_ANALYSIS.md Template Addition:
```markdown
### Predicted Cochanges

**Files likely to need changes** (from metabob_suggest_related_changes):
1. `path/to/file1.ts` - [reason: dependency, similar pattern, etc.]
2. `path/to/file2.ts` - [reason]
3. `path/to/file3.ts` - [reason]

**Priority files** (high severity issues): [list files with HIGH issues]

**Note**: These predictions will be compared with actual changes to improve future predictions.
```

---

### 2. **document-and-close Task** (Task 3)

#### Changes:
- ✅ Added `"Use metabob_suggest_related_changes to find related files"` to guidance
- ✅ Inserted new **"## Part 2: Check Related Files and Cochange Accuracy"** section
- ✅ Shifted original "Part 2" to "Part 3" and "Part 3" to "Part 4"
- ✅ Added **"### Related Files Analysis"** section to BUG_FIX_SUMMARY.md template
- ✅ Updated validation to require `"### Related Files Analysis"` and `"Cochange accuracy:"` patterns

#### Why:
After fixing the bug, the agent compares predicted cochanges with actual changes to calculate accuracy. This data is sent to the backend for learning.

#### Template Section:
```markdown
## Part 2: Check Related Files and Cochange Accuracy

### 1. Check Related Files

Use `metabob_suggest_related_changes` to verify related files:

```typescript
metabob_suggest_related_changes({
  changed_files: ["all", "files", "you", "modified.ts"],
  top_k: 8
})
```

**Compare predictions vs actual**:
- Review predicted cochanges from BUG_ANALYSIS.md
- Which predicted files did we actually change? (cochange accuracy)
- Which predicted files did we NOT change? (should we review them?)
- Did we change files that were NOT predicted? (why?)

**Review high-priority suggestions**:
- If related files have HIGH severity issues, consider if they need fixing
- If related files share similar bug patterns, verify the fix applies there too
- Document any additional files that should be reviewed in follow-up

### 2. Calculate Cochange Accuracy

Compare predicted vs actual:
- Predicted files (from BUG_ANALYSIS.md): [count]
- Actually modified files: [count]
- Correct predictions: [count matching]
- Cochange accuracy: X/Y (percentage)
```

#### BUG_FIX_SUMMARY.md Template Addition:
```markdown
### Related Files Analysis

**Predicted Cochanges** (from BUG_ANALYSIS.md):
- Files predicted to change: [list from BUG_ANALYSIS.md]
- Files actually changed: [list from git diff]
- Cochange accuracy: X/Y predictions correct (Z%)

**Related Files Checked** (from metabob_suggest_related_changes):
- Files reviewed for similar issues: [list]
- High-priority files (with critical issues): [list if any]
- Action taken: [Fixed similar bugs / Verified no similar issues / Noted for future work]

**Insights**:
[What did we learn from the cochange analysis? Were predictions accurate? Did we miss any related files?]
```

---

## Data Flow: Cochange Learning Loop

```
┌─────────────────────────────────────────────────────────────┐
│ 1. analyze-and-locate Task (BEFORE execution)               │
│    - Call metabob_suggest_related_changes                   │
│    - Store predictions in BUG_ANALYSIS.md                   │
│    - Set activity.expected.cochanges = predicted_files[]    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. implement-fix + test-fix Tasks (DURING execution)        │
│    - Agent makes code changes                               │
│    - Files modified tracked automatically                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. document-and-close Task (AFTER execution)                │
│    - Call metabob_suggest_related_changes again             │
│    - Compare predicted vs actual files changed              │
│    - Calculate cochange accuracy: correct/total             │
│    - Document in BUG_FIX_SUMMARY.md                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Activity Outcome Recorder (AUTO - after activity ends)   │
│    - Extract predicted cochanges from activity.expected     │
│    - Extract actual changes from git diff                   │
│    - Calculate comparison.cochangeAccuracy                  │
│    - POST /v2/activities/record/complete to backend         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Backend Learning (AUTO - metabob-rpc-api)                │
│    - Update Thompson Sampling (alpha/beta/UCB)              │
│    - Track cochange accuracy per template variant           │
│    - Commission new variants if accuracy < threshold        │
│    - Route future tasks to best-performing variants         │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Status

| Component | Status | Notes |
|-----------|--------|-------|
| **OpenCode CLI** | ✅ Complete | `calculateComparison()` includes cochange accuracy (lines 544-547) |
| **MCP Layer** | ✅ Complete | Captures and forwards outcome data via `_record_outcome()` |
| **Backend API** | ✅ Complete | Auto-updates Thompson Sampling, commissions variants |
| **fix-bug-complete** | ✅ Complete | Now predicts cochanges early and tracks accuracy |
| **add-feature-complete** | ⚠️ Partial | Has cochange tool in doc step, needs early prediction |
| **refactor-component-complete** | ⚠️ Partial | Has cochange tool in doc step, needs early prediction |

---

## Validation

### Required Patterns Added:

**analyze-and-locate validation**:
```json
"requiredPatterns": [
  "## Bug Analysis",
  "### Predicted Cochanges",  // ← NEW
  "### Root Cause",
  "\\*\\*File\\*\\*:",
  "\\*\\*Why it happens\\*\\*:",
  "### Fix Approach"
]
```

**document-and-close validation**:
```json
"requiredPatterns": [
  "## Bug Fix Summary",
  "### Root Cause",
  "### Fix Applied",
  "### Related Files Analysis",  // ← NEW
  "Cochange accuracy:",          // ← NEW
  "### Testing",
  "### Lessons Learned",
  "### Verification Checklist"
]
```

---

## Testing Plan

### Manual Testing:

1. **Execute fix-bug-complete template**:
   ```bash
   opencode activity run fix-bug-complete \
     --bug_description "Authentication fails with null user" \
     --affected_files "src/auth/login.ts"
   ```

2. **Verify outputs**:
   - ✅ BUG_ANALYSIS.md contains "### Predicted Cochanges"
   - ✅ BUG_FIX_SUMMARY.md contains "### Related Files Analysis"
   - ✅ BUG_FIX_SUMMARY.md contains "Cochange accuracy: X/Y"

3. **Check backend data**:
   ```bash
   opencode mcp call get_activity_metrics --activityId "act_xxx"
   ```
   - Verify `comparison.cochangeAccuracy` is present
   - Verify Thompson Sampling updated (alpha/beta values changed)

### Automated Testing:

See: `ACTIVITY_SYSTEM_VALIDATION_REPORT_FEB16.md` for E2E validation test results.

---

## Next Steps

### Immediate (Complete Other Templates):

1. **✅ fix-bug-complete**: DONE
2. **⏭️ add-feature-complete**: Add early cochange prediction
3. **⏭️ refactor-component-complete**: Add early cochange prediction

### Future Enhancements:

1. **Backend Enhancement**:
   - Add `cochange_accuracy` column to `variant_performance_metrics` table
   - Store historical cochange accuracy for trend analysis
   - Use cochange accuracy in variant selection algorithm

2. **Template Auto-Evolution**:
   - If cochange accuracy < 0.5 for 10+ executions → auto-commission variant
   - Variant includes: wider cochange search (top_k: 8 → 12), more aggressive related file checking

3. **Metabob CLI Enhancement**:
   - Pre-populate cochange predictions in impulses before activity starts
   - Memory agent automatically creates cochange impulse for relevant tasks

---

## Expected Behavior

### What Happens Now:

1. **User runs**: `opencode activity fix-bug-complete --bug_description "..."`

2. **analyze-and-locate task**:
   - Agent calls `metabob_suggest_related_changes(["src/auth/login.ts"])`
   - Result: `["src/auth/session.ts", "src/api/users.ts", "src/middleware/auth.ts"]`
   - Stores in BUG_ANALYSIS.md under "### Predicted Cochanges"

3. **implement-fix task**:
   - Agent fixes `src/auth/login.ts`
   - Agent also modifies `src/auth/session.ts` (was predicted ✓)
   - Agent does NOT touch `src/api/users.ts` (was predicted but not needed)

4. **document-and-close task**:
   - Agent calls `metabob_suggest_related_changes(["src/auth/login.ts", "src/auth/session.ts"])`
   - Compares: Predicted 3, Actually changed 2, Correct predictions: 1
   - Cochange accuracy: 1/3 = 33%
   - Documents in BUG_FIX_SUMMARY.md

5. **After activity completes**:
   - OpenCode CLI extracts data, calculates comparison
   - Sends to backend: `{ comparison: { cochangeAccuracy: 0.33 } }`
   - Backend updates Thompson Sampling for this template variant

6. **Learning effect**:
   - Next time, backend may route similar bugs to a different variant
   - OR commission new variant with improved cochange prediction

---

## Files Modified

- ✅ `/home/avi/documents/work/exp-repo/metabob-devbob/fix-bug-complete.json`
  - Updated: Task 0 (analyze-and-locate)
  - Updated: Task 3 (document-and-close)
  - Updated: Validation patterns

---

## Success Metrics

After 10 executions of `fix-bug-complete`:

- **Cochange accuracy > 60%**: Template is learning which files change together
- **Thompson Sampling alpha/beta updated**: Backend is tracking performance
- **Variant commissioned (if accuracy < 50%)**: System auto-improves template

---

## Documentation References

- **Activity Learning Guide**: `COCHANGE_IMPULSE_ACTIVITY_LEARNING_GUIDE.md`
- **Activity System Status**: `ACTIVITY_SYSTEM_VALIDATED_FEB15.md`
- **Session Summary**: See top of this file for previous session context

---

## Conclusion

✅ **fix-bug-complete template now fully integrated with cochange learning**

The template:
- Predicts cochanges early (before execution)
- Tracks accuracy (after execution)
- Sends data to backend automatically
- Contributes to the distributed learning system

Next: Apply same pattern to `add-feature-complete` and `refactor-component-complete`.
