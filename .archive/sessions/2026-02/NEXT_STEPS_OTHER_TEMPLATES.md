# Next Steps: Integrate Cochange Learning into Other Templates

**Date**: 2026-02-16  
**Status**: fix-bug-complete ✅ Complete | Others pending

---

## Summary

We've successfully integrated cochange prediction and accuracy tracking into `fix-bug-complete.json`. Now we need to apply the same pattern to other templates.

---

## Templates Requiring Update

### 1. ✅ **fix-bug-complete.json** - COMPLETE

**Status**: Fully integrated with cochange learning  
**Changes Made**:
- Task 0: Predicts cochanges early (before execution)
- Task 3: Checks cochange accuracy (after execution)
- Validation: Requires both sections

---

### 2. ⏭️ **add-feature-complete.json** - TODO

**Current State**: Has `metabob_suggest_related_changes` in documentation step (late)  
**Problem**: Predictions happen AFTER execution, so can't be compared  
**Fix Needed**: Move cochange prediction to design/planning phase

#### Changes Required:

**Task: design-and-plan (or similar early task)**
```diff
+ Add to guidance:
+   "Use metabob_suggest_related_changes to predict files that may need changes"

+ Add to prompt template (Step 3 or similar):
+   ### 3. Predict Related Files
+   
+   Use `metabob_suggest_related_changes` to predict which files may need changes:
+   
+   ```typescript
+   metabob_suggest_related_changes({
+     changed_files: ["path/to/new/feature/area.ts"],
+     top_k: 8
+   })
+   ```
+   
+   **Store predictions**: Document in FEATURE_DESIGN.md for later comparison.

+ Add to design document template:
+   ### Predicted Cochanges
+   
+   **Files likely to need changes**:
+   1. `path/to/file1.ts` - [reason]
+   2. `path/to/file2.ts` - [reason]

+ Add to validation:
+   "### Predicted Cochanges"
```

**Task: document-and-close (final task)**
```diff
+ Add Part 2 (similar to fix-bug-complete):
+   ## Part 2: Check Related Files and Cochange Accuracy
+   
+   [Same content as fix-bug-complete]

+ Update FEATURE_SUMMARY.md template:
+   ### Related Files Analysis
+   
+   **Predicted Cochanges**: [from FEATURE_DESIGN.md]
+   **Actually Modified**: [from git diff]
+   **Cochange accuracy**: X/Y (Z%)

+ Add to validation:
+   "### Related Files Analysis"
+   "Cochange accuracy:"
```

---

### 3. ⏭️ **refactor-component-complete.json** - TODO

**Current State**: Has `metabob_suggest_related_changes` in documentation step (late)  
**Problem**: Same as add-feature-complete  
**Fix Needed**: Move cochange prediction to planning phase

#### Changes Required:

**Task: plan-refactoring (or similar early task)**
```diff
+ Add to guidance:
+   "Use metabob_suggest_related_changes to predict files that may need changes"
+   "Use metabob_analyze_change_impact to understand dependencies"

+ Add to prompt template:
+   ### 3. Predict Impact and Cochanges
+   
+   Use `metabob_analyze_change_impact` to understand dependencies:
+   ```typescript
+   metabob_analyze_change_impact({
+     file_path: "path/to/refactor/target.ts",
+     component_name: "ComponentToRefactor"
+   })
+   ```
+   
+   Use `metabob_suggest_related_changes` to predict cochanges:
+   ```typescript
+   metabob_suggest_related_changes({
+     changed_files: ["path/to/refactor/target.ts"],
+     top_k: 10  // Refactors often affect more files
+   })
+   ```

+ Add to REFACTOR_PLAN.md template:
+   ### Impact Analysis
+   **Dependencies**: [from analyze_change_impact]
+   **Dependent Files**: [count]
+   
+   ### Predicted Cochanges
+   **Files likely to need refactoring**:
+   1. `path/to/file1.ts` - [reason]
+   2. `path/to/file2.ts` - [reason]

+ Add to validation:
+   "### Impact Analysis"
+   "### Predicted Cochanges"
```

**Task: document-and-close (final task)**
```diff
+ Add Part 2:
+   ## Part 2: Verify Impact and Cochange Accuracy
+   
+   [Similar to fix-bug-complete but emphasize impact analysis]

+ Update REFACTOR_SUMMARY.md template:
+   ### Impact Analysis
+   **Predicted dependencies**: [from plan]
+   **Actual dependencies affected**: [from execution]
+   
+   ### Related Files Analysis
+   **Cochange accuracy**: X/Y (Z%)

+ Add to validation:
+   "### Impact Analysis"
+   "### Related Files Analysis"
+   "Cochange accuracy:"
```

---

## Implementation Pattern (Reusable)

### For ANY Activity Template:

#### Phase 1: Early Task (Design/Planning/Analysis)

1. **Add to guidance**:
   ```json
   "Use metabob_suggest_related_changes to predict files that may need changes"
   ```

2. **Add prompt section**:
   ```markdown
   ### X. Predict Related Files
   
   Use `metabob_suggest_related_changes({...})` to predict cochanges.
   Store predictions in [DOCUMENT_NAME].md for later comparison.
   ```

3. **Add to document template**:
   ```markdown
   ### Predicted Cochanges
   **Files likely to need changes**: [list]
   ```

4. **Add validation**:
   ```json
   "### Predicted Cochanges"
   ```

#### Phase 2: Final Task (Document-and-Close)

1. **Add to guidance**:
   ```json
   "Use metabob_suggest_related_changes to find related files"
   ```

2. **Insert Part 2 in prompt** (before final documentation):
   ```markdown
   ## Part 2: Check Related Files and Cochange Accuracy
   
   ### 1. Check Related Files
   Use `metabob_suggest_related_changes({...})` on modified files.
   
   ### 2. Calculate Cochange Accuracy
   Compare predicted vs actual: X/Y correct (Z%)
   ```

3. **Add to summary document template**:
   ```markdown
   ### Related Files Analysis
   **Predicted**: [list]
   **Actually changed**: [list]
   **Cochange accuracy**: X/Y (Z%)
   **Insights**: [what did we learn?]
   ```

4. **Add validation**:
   ```json
   "### Related Files Analysis"
   "Cochange accuracy:"
   ```

---

## Expected Workflow After Integration

### 1. Activity Starts
- **Early task**: Agent calls `metabob_suggest_related_changes` → stores predictions
- **System**: Captures predictions in `activity.expected.cochanges[]`

### 2. Activity Executes
- **Middle tasks**: Agent makes code changes
- **System**: Tracks modified files automatically

### 3. Activity Completes
- **Final task**: Agent calls `metabob_suggest_related_changes` again → calculates accuracy
- **System**: Extracts actual changes, compares with predictions

### 4. Learning Loop (Automatic)
- **OpenCode CLI**: Calculates `comparison.cochangeAccuracy`
- **MCP Layer**: Sends to backend via `/v2/activities/record/complete`
- **Backend**: Updates Thompson Sampling, commissions variants if needed

---

## Automation Opportunity

### Create Template Update Script

```bash
#!/usr/bin/env python3
"""Apply cochange integration to an activity template."""

import json
import sys

def integrate_cochange_learning(template_path: str):
    """
    Automatically add cochange prediction and tracking to a template.
    
    1. Find early task (design/plan/analyze)
    2. Add cochange prediction
    3. Find final task (document-and-close)
    4. Add cochange accuracy checking
    5. Update validations
    """
    # Implementation here
    pass

if __name__ == "__main__":
    integrate_cochange_learning(sys.argv[1])
```

---

## Testing Plan

### After Updating Each Template:

1. **Run verification script**:
   ```bash
   python3 /tmp/verify_template.py <template-name>.json
   ```

2. **Execute template manually**:
   ```bash
   opencode activity run <template-id> --<variables>
   ```

3. **Verify outputs**:
   - Early document has "### Predicted Cochanges"
   - Final summary has "### Related Files Analysis"
   - Final summary has "Cochange accuracy: X/Y"

4. **Check backend data**:
   ```bash
   opencode mcp call get_activity_metrics --activityId "act_xxx"
   ```
   - Verify `comparison.cochangeAccuracy` is present

---

## Priority Order

1. **✅ fix-bug-complete** - DONE
2. **🔥 add-feature-complete** - HIGH (most commonly used)
3. **🔥 refactor-component-complete** - HIGH (benefits most from impact analysis)
4. **📋 Other templates** - MEDIUM (as needed)

---

## Success Metrics

After integrating all templates:

- **All templates** predict cochanges early ✓
- **All templates** calculate accuracy ✓
- **Backend** receives cochange data for all activities ✓
- **Thompson Sampling** uses cochange accuracy for routing ✓
- **System** auto-commissions variants based on cochange accuracy ✓

---

## Files to Review

- `/home/avi/documents/work/exp-repo/metabob-devbob/add-feature-complete.json`
- `/home/avi/documents/work/exp-repo/metabob-devbob/refactor-component-complete.json`
- Other templates in the root directory

---

## Related Documentation

- **Cochange Learning Guide**: `COCHANGE_IMPULSE_ACTIVITY_LEARNING_GUIDE.md`
- **Fix-Bug Integration**: `FIX_BUG_COMPLETE_COCHANGE_INTEGRATION.md`
- **Activity System Status**: `ACTIVITY_SYSTEM_VALIDATED_FEB15.md`
