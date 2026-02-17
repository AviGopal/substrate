# Add-Feature-Complete Template: Cochange Integration Complete

**Date**: 2026-02-16  
**Status**: ✅ Complete  
**Template**: `add-feature-complete.json`

## Summary

Successfully integrated cochange prediction and tracking into the `add-feature-complete` activity template. The template now predicts which files should change together during feature implementation, tracks accuracy, and learns from execution outcomes.

---

## Changes Made

### 1. **design-feature Task** (Task 0) - Early Prediction

#### Changes:
- ✅ Added `"Use metabob_suggest_related_changes to predict files that may need changes"` to guidance
- ✅ Added **"### Step 3: Predict Related Files"** section to prompt template (renumbered from Step 3 to Step 4 for "Create Design Document")
- ✅ Instructs agent to call `metabob_suggest_related_changes` early in design phase
- ✅ Added **"### Predicted Cochanges"** section to FEATURE_DESIGN.md template
- ✅ Updated validation to require `"### Predicted Cochanges"` pattern

#### Why:
Cochange predictions must happen **before** implementation to enable meaningful comparison with actual changes. This allows the learning system to calculate cochange accuracy and improve future predictions.

#### Template Section Added:
```markdown
## Step 3: Predict Related Files

Use `metabob_suggest_related_changes` to predict which files may need changes:

```typescript
metabob_suggest_related_changes({
  changed_files: ["path/to/feature/area.ts"],
  top_k: 8
})
```

**Why this matters**:
- New features often require changes in related files (tests, configs, docs)
- Identifies dependencies that need updating
- Helps avoid incomplete implementations that break existing functionality
- Enables learning: system improves by comparing predictions vs actual changes

**Store predictions**: Document the predicted cochanges in FEATURE_DESIGN.md for later comparison.
```

#### FEATURE_DESIGN.md Template Addition:
```markdown
### Predicted Cochanges

**Files likely to need changes** (from metabob_suggest_related_changes):
1. `path/to/file1.ts` - [reason: dependency, similar pattern, related functionality, etc.]
2. `path/to/file2.ts` - [reason]
3. `path/to/file3.ts` - [reason]

**Priority files** (high severity issues): [list files with HIGH issues if any]

**Note**: These predictions will be compared with actual changes to improve future predictions.
```

---

### 2. **document-and-annotate Task** (Task 3) - Accuracy Tracking

#### Changes:
- ✅ Added `"Use metabob_suggest_related_changes to find related files"` to guidance
- ✅ Inserted new **"## Part 2: Check Related Files and Cochange Accuracy"** section
- ✅ Added **"## Part 3: Annotate Key Components"** section (Metabob annotations)
- ✅ Added **"## Part 4: Create Summary Document"** section
- ✅ Added **"### Related Files Analysis"** section to FEATURE_SUMMARY.md template
- ✅ Updated validation to require:
  - `"FEATURE_SUMMARY.md"` file
  - `"## Feature Summary:"` pattern
  - `"### Related Files Analysis"` pattern
  - `"Cochange accuracy:"` pattern

#### Why:
After implementing the feature, the agent compares predicted cochanges with actual changes to calculate accuracy. This data is sent to the backend for learning and template evolution.

#### Template Sections Added:

**Part 2: Check Related Files and Cochange Accuracy**
```markdown
## Part 2: Check Related Files and Cochange Accuracy

### 1. Check Related Files

Use `metabob_suggest_related_changes` to verify related files were properly updated:

```typescript
metabob_suggest_related_changes({
  changed_files: ["all", "files", "you", "created", "or", "modified.ts"],
  top_k: 8
})
```

**Compare predictions vs actual**:
- Review predicted cochanges from FEATURE_DESIGN.md
- Which predicted files did we actually change? (cochange accuracy)
- Which predicted files did we NOT change? (should we review them?)
- Did we change files that were NOT predicted? (why?)

**Review high-priority suggestions**:
- If related files have HIGH severity issues, consider if they need updating for consistency
- If related files share similar patterns, verify the feature integrates properly
- Document any additional files that should be reviewed or updated in follow-up

### 2. Calculate Cochange Accuracy

Compare predicted vs actual:
- Predicted files (from FEATURE_DESIGN.md): [count]
- Actually modified/created files: [count]
- Correct predictions: [count matching]
- Cochange accuracy: X/Y (percentage)

**Learning note**: This data helps the system improve future predictions.
```

**FEATURE_SUMMARY.md Template Addition**:
```markdown
### Related Files Analysis

**Predicted Cochanges** (from FEATURE_DESIGN.md):
- Files predicted to change: [list from FEATURE_DESIGN.md]
- Files actually changed: [list from git diff or created files]
- Cochange accuracy: X/Y predictions correct (Z%)

**Related Files Checked** (from metabob_suggest_related_changes):
- Files reviewed for integration: [list]
- High-priority files (with critical issues): [list if any]
- Action taken: [Updated for integration / Verified compatibility / Noted for future work]

**Insights**:
[What did we learn from the cochange analysis? Were predictions accurate? Did we miss any related files that needed updating?]
```

---

## Data Flow: Cochange Learning Loop

```
┌─────────────────────────────────────────────────────────────┐
│ 1. design-feature Task (BEFORE implementation)              │
│    - Call metabob_suggest_related_changes                   │
│    - Store predictions in FEATURE_DESIGN.md                 │
│    - Set activity.expected.cochanges = predicted_files[]    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. implement-feature + test-feature Tasks (DURING)          │
│    - Agent creates/modifies files                           │
│    - Files tracked automatically                            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. document-and-annotate Task (AFTER implementation)        │
│    - Call metabob_suggest_related_changes again             │
│    - Compare predicted vs actual files changed              │
│    - Calculate cochange accuracy: correct/total             │
│    - Document in FEATURE_SUMMARY.md                         │
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
| **OpenCode CLI** | ✅ Complete | `calculateComparison()` includes cochange accuracy |
| **MCP Layer** | ✅ Complete | Captures and forwards outcome data |
| **Backend API** | ✅ Complete | Auto-updates Thompson Sampling, commissions variants |
| **fix-bug-complete** | ✅ Complete | Cochange learning integrated |
| **add-feature-complete** | ✅ Complete | Cochange learning integrated (this doc) |
| **refactor-component-complete** | ⚠️ Partial | Next priority for integration |

---

## Validation

### Required Patterns Added:

**design-feature validation**:
```json
"requiredPatterns": [
  "## Feature Design:",
  "### Overview",
  "### Requirements",
  "### Acceptance Criteria",
  "### Existing Patterns Found",
  "### Predicted Cochanges",  // ← NEW
  "### Architecture",
  "### File Structure",
  "### Components",
  "### Data Flow",
  "### Error Scenarios",
  "### Change Impact Analysis",
  "### Testing Strategy",
  "### Implementation Checklist"
]
```

**document-and-annotate validation**:
```json
"requiredFiles": [
  "*.md",
  "FEATURE_SUMMARY.md"  // ← NEW
],
"requiredPatterns": [
  "## Overview",
  "## Usage",
  "## API Reference",
  "Example",
  "```",
  "## Feature Summary:",        // ← NEW
  "### Related Files Analysis",  // ← NEW
  "Cochange accuracy:"           // ← NEW
]
```

---

## Expected Behavior

### What Happens Now:

1. **User runs**: `opencode activity add-feature-complete --feature_name "user-profile" --feature_description "..."`

2. **design-feature task**:
   - Agent calls `metabob_suggest_related_changes(["src/features/profile"])`
   - Result: `["src/api/users.ts", "src/types/user.ts", "src/tests/profile.test.ts"]`
   - Stores in FEATURE_DESIGN.md under "### Predicted Cochanges"

3. **implement-feature task**:
   - Agent creates `src/features/profile/index.ts`, `src/features/profile/types.ts`
   - Agent modifies `src/api/users.ts` (was predicted ✓)
   - Agent modifies `src/types/user.ts` (was predicted ✓)

4. **test-feature task**:
   - Agent creates `src/features/profile/__tests__/profile.test.ts`

5. **document-and-annotate task**:
   - Agent calls `metabob_suggest_related_changes(["src/features/profile/index.ts", "src/api/users.ts", ...])`
   - Compares: Predicted 3, Actually created/changed 5, Correct predictions: 2
   - Cochange accuracy: 2/3 = 67%
   - Documents in FEATURE_SUMMARY.md

6. **After activity completes**:
   - OpenCode CLI extracts data, calculates comparison
   - Sends to backend: `{ comparison: { cochangeAccuracy: 0.67 } }`
   - Backend updates Thompson Sampling for this template variant

7. **Learning effect**:
   - Next time, backend may route similar features to a different variant
   - OR commission new variant with improved cochange prediction

---

## Differences from fix-bug-complete

### Similarities:
- Both predict cochanges early
- Both calculate accuracy late
- Both use same validation patterns
- Both follow same learning loop

### Differences:
- **Feature template**: Predicts NEW files to create + existing files to modify
- **Bug template**: Predicts existing files that need fixing
- **Feature template**: Has 4 parts in final task (Doc, Cochange, Annotations, Summary)
- **Bug template**: Has 4 parts in final task (similar structure)
- **Feature template**: Creates FEATURE_SUMMARY.md
- **Bug template**: Creates BUG_FIX_SUMMARY.md

---

## Testing Plan

### Manual Testing:

1. **Execute add-feature-complete template**:
   ```bash
   opencode activity run add-feature-complete \
     --feature_name "email-notifications" \
     --feature_description "Send email notifications for important events" \
     --requirements "Support HTML emails, queue-based delivery, retry on failure" \
     --acceptance_criteria "Emails sent successfully, failures retried, delivery tracked"
   ```

2. **Verify outputs**:
   - ✅ FEATURE_DESIGN.md contains "### Predicted Cochanges"
   - ✅ FEATURE_SUMMARY.md exists
   - ✅ FEATURE_SUMMARY.md contains "### Related Files Analysis"
   - ✅ FEATURE_SUMMARY.md contains "Cochange accuracy: X/Y"

3. **Check backend data**:
   ```bash
   opencode mcp call get_activity_metrics --activityId "act_xxx"
   ```
   - Verify `comparison.cochangeAccuracy` is present
   - Verify Thompson Sampling updated (alpha/beta values changed)

---

## Next Steps

### Immediate (Complete Other Templates):

1. **✅ fix-bug-complete**: DONE
2. **✅ add-feature-complete**: DONE (this document)
3. **⏭️ refactor-component-complete**: Add early cochange prediction + impact analysis

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

## Success Metrics

After 10 executions of `add-feature-complete`:

- **Cochange accuracy > 60%**: Template is learning which files change together for features
- **Thompson Sampling alpha/beta updated**: Backend is tracking performance
- **Variant commissioned (if accuracy < 50%)**: System auto-improves template

---

## Files Modified

- ✅ `/home/avi/documents/work/exp-repo/metabob-devbob/add-feature-complete.json`
  - Updated: Task 0 (design-feature)
  - Updated: Task 3 (document-and-annotate)
  - Updated: Validation patterns

---

## Conclusion

✅ **add-feature-complete template now fully integrated with cochange learning**

The template:
- Predicts cochanges early (before implementation)
- Tracks accuracy (after implementation)
- Sends data to backend automatically
- Contributes to the distributed learning system

Next: Apply same pattern to `refactor-component-complete`.
