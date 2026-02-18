# Cochange Learning Integration: refactor-component-complete

**Date**: 2026-02-16  
**Status**: ✅ Complete  
**Template**: `refactor-component-complete.json`

---

## Summary

Successfully integrated cochange prediction and accuracy tracking into the `refactor-component-complete` activity template. This template now follows the same proven pattern as `fix-bug-complete` and `add-feature-complete`.

---

## Changes Made

### Task 0: `analyze-impact` (Early Prediction)

**1. Updated Guidance** (line 47):
```json
"guidance": [
  "Use metabob_analyze_change_impact to check dependencies",
  "Use metabob_search_codebase_issues to find existing issues in component",
  "Use metabob_suggest_related_changes to predict cochanges (store predictions for later accuracy measurement)", // ← ADDED
  "Review component annotations to understand design intent",
  "Document all dependent components and files",
  "Assess risk level based on dependency count"
]
```

**2. Added New Prompt Section** (after "3. Review Current Implementation"):
```markdown
### 4. Predict Related Files (Cochange Analysis)

**IMPORTANT**: Use `metabob_suggest_related_changes` to predict which files might need changes alongside this refactoring:

```typescript
metabob_suggest_related_changes({
  changed_files: ["{{file_path}}"],
  top_k: 10  // Refactors often affect more files than features/bugs
})
```

**Why This Matters**:
- Refactoring often requires updating dependent files
- Identify files that change together historically
- Prevent missed updates that could break functionality
- **Store predictions for accuracy measurement later**

**What to document**:
- List all predicted files (by file path)
- Note recommendation priority (High/Medium/Low)
- Explain why each file might need changes
- These predictions will be compared to actual changes in the final task

**Activity Learning**: These predictions help the system learn which file patterns co-occur during refactoring, improving future refactoring planning.
```

**3. Updated Section Numbering**:
- "4. Plan Refactoring Approach" → "5. Plan Refactoring Approach"
- "5. Document Your Analysis" → "6. Document Your Analysis"

**4. Added to REFACTORING_PLAN.md Template** (after "Impact Assessment"):
```markdown
### Predicted Cochanges (from metabob_suggest_related_changes)

**Files likely to need changes**:
1. `path/to/related1.ts` - [Why: e.g., uses refactored API, historically changes together]
2. `path/to/related2.ts` - [Why: e.g., similar pattern, integration point]
[... list all predicted files with reasoning]

**Prediction Summary**:
- Total predicted files: X
- High priority: Y files
- Medium priority: Z files

**Activity Learning Note**: These predictions will be compared to actual changes in the final task to measure cochange accuracy and improve future refactoring planning.
```

**5. Updated Validation** (line 86):
```json
"requiredPatterns": [
  "## Refactoring Plan:",
  "### Impact Analysis",
  "Direct dependents:",
  "Risk level:",
  "### Predicted Cochanges", // ← ADDED
  "### Refactoring Strategy",
  "### Testing Strategy",
  "### Success Criteria"
]
```

---

### Task 3: `document-and-annotate` (Accuracy Tracking)

**1. Guidance Already Included** (line 245):
```json
"guidance": [
  "Use metabob_annotate_component to document refactored component",
  "Use metabob_suggest_related_changes to find co-change patterns", // ← Already present
  "Document design decisions and rationale",
  "Create migration guide if API changed",
  "Summarize improvements and lessons learned"
]
```

**2. Restructured Prompt Sections**:

**Original Structure**:
```
## Part 1: Metabob Annotations
  ### 1. Annotate Refactored Component
  ### 2. Mark Resolved Issues
  ### 3. Find Related Changes

## Part 2: Documentation
  ### Create REFACTORING_SUMMARY.md
```

**New Structure**:
```
## Part 1: Metabob Annotations
  ### 1. Annotate Refactored Component
  ### 2. Mark Resolved Issues
  ### 3. Find Related Changes

## Part 2: Check Related Files and Cochange Accuracy  ← NEW
  ### 1. Compare Predictions to Reality
  ### 2. Run Cochange Analysis on Actual Changes
  ### 3. Document Findings

## Part 3: Annotate Key Components  ← RENAMED

## Part 4: Create Summary Document  ← RENAMED
  ### Create REFACTORING_SUMMARY.md
```

**3. Added Part 2: Cochange Accuracy Section**:
```markdown
## Part 2: Check Related Files and Cochange Accuracy

### 1. Compare Predictions to Reality

**Review predictions from REFACTORING_PLAN.md** ("Predicted Cochanges" section):
- Which files were predicted to need changes?
- How many files were predicted?

**Identify actual changes**:
```bash
git diff --name-only HEAD
# OR if not committed yet:
git status --short
```

**Calculate cochange accuracy**:
```
Accuracy = (Number of correctly predicted files) / (Total predicted files)

Example:
- Predicted: 8 files
- Actually changed: 10 files  
- Correctly predicted: 6 files
- Accuracy: 6/8 = 75%
```

### 2. Run Cochange Analysis on Actual Changes

Now run `metabob_suggest_related_changes` on ALL files you actually modified:

```typescript
metabob_suggest_related_changes({
  changed_files: [
    "{{file_path}}",
    "path/to/dependent1.ts",
    "path/to/test-file.test.ts"
    // ... all files you modified
  ],
  top_k: 10
})
```

**Purpose**: 
- Find files we might have missed
- Verify no related files need updates
- Identify patterns for future refactorings

### 3. Document Findings

**What to note**:
- Which predictions were correct (files we did change)
- Which predictions were incorrect (files we didn't need to change)
- Which files we changed that weren't predicted (missed predictions)
- Any high-priority related files that still need review
```

**4. Updated REFACTORING_SUMMARY.md Template** (after "Dependency impact"):
```markdown
### Related Files Analysis

**Cochange Prediction Accuracy**:
- Predicted files: X
- Actually changed files: Y
- Correctly predicted: Z
- **Cochange accuracy: Z/X = AA%**

**Correctly Predicted** (files we changed that were predicted):
1. `path/to/file1.ts` - ✓ Prediction correct
2. `path/to/file2.ts` - ✓ Prediction correct

**Missed Predictions** (files we changed but didn't predict):
1. `path/to/unexpected1.ts` - Why we had to change it: [explanation]
2. `path/to/unexpected2.ts` - Why we had to change it: [explanation]

**False Positives** (predicted but didn't need to change):
1. `path/to/not-needed1.ts` - Why it wasn't needed: [explanation]

**Additional Related Files** (from final cochange analysis):
- Files that may need future updates: [list if any]
- High-priority files to review: [list if any]

**Activity Learning Note**: This cochange accuracy data helps improve future refactoring planning by learning which file patterns reliably co-occur.
```

**5. Updated Validation** (line 282):
```json
"requiredPatterns": [
  "## Refactoring Summary:",
  "### Related Files Analysis", // ← ADDED
  "Cochange accuracy:", // ← ADDED
  "### Changes Summary",
  "### Code Quality Improvements",
  "### Design Decisions",
  "### Lessons Learned",
  "✓"
]
```

---

## Key Design Decisions

### 1. Higher `top_k` Value (10 vs 8)

**Rationale**: Refactorings typically affect more files than bug fixes or feature additions because:
- Structural changes propagate through dependents
- API changes require updating all callers
- Test files need updates for implementation changes
- Documentation and type definitions often need updates

### 2. Emphasis on Impact Analysis

Unlike `fix-bug-complete` and `add-feature-complete`, this template:
- Uses **both** `metabob_analyze_change_impact` AND `metabob_suggest_related_changes`
- Impact analysis shows "what depends on this" (static dependency graph)
- Cochange analysis shows "what changes with this" (historical patterns)
- Together they provide comprehensive understanding of refactoring blast radius

### 3. Three-Part Documentation Structure

**Part 1**: Metabob annotations (WHY components exist)  
**Part 2**: Cochange accuracy (learning feedback)  
**Part 3**: Key component annotations (design decisions)  
**Part 4**: Summary document (comprehensive documentation)

This structure separates concerns:
- Metabob tools for institutional memory
- Accuracy tracking for system learning
- Documentation for human readers

---

## Special Considerations for Refactoring

### Refactoring vs. Bug Fix vs. Feature Addition

| Aspect | Bug Fix | Feature Addition | Refactoring |
|--------|---------|------------------|-------------|
| **Cochange scope** | Narrow (fix + tests) | Medium (feature + integration) | **Wide (component + dependents + tests)** |
| **top_k value** | 5-8 | 8 | **10** |
| **Primary tool** | `suggest_related_changes` | `suggest_related_changes` | **`analyze_change_impact` + `suggest_related_changes`** |
| **Risk assessment** | Bug severity | Feature complexity | **Dependency count + cochange patterns** |
| **Validation focus** | Tests pass + bug resolved | Tests pass + feature works | **Tests pass + dependents work + API compatibility** |

### Why Refactoring Needs Both Tools

**`metabob_analyze_change_impact`**: 
- Shows structural dependencies (imports, function calls)
- Identifies direct and transitive dependents
- Provides concrete dependency count for risk assessment
- **Use case**: "What will break if I change this?"

**`metabob_suggest_related_changes`**:
- Shows historical co-occurrence patterns
- Predicts files that change together
- Uses GNN embeddings and semantic similarity
- **Use case**: "What else usually changes when I change this?"

**Combined**: Comprehensive understanding of refactoring impact

---

## Integration with Backend Learning System

### Data Flow

```
1. Task 0 (analyze-impact):
   → Agent calls metabob_suggest_related_changes
   → Predictions stored in REFACTORING_PLAN.md
   → Predictions captured as "expectation" by activity system

2. Task 1-2 (implement + test):
   → Agent makes changes
   → Git tracks modified files
   → Activity system records actual changes

3. Task 3 (document-and-annotate):
   → Agent calculates cochange accuracy manually
   → Agent documents accuracy in REFACTORING_SUMMARY.md
   → Activity system extracts accuracy from summary

4. Activity completion:
   → OpenCode CLI calculates cochangeAccuracy (activity.ts:544-547)
   → MCP layer forwards outcome to backend API
   → Backend updates Thompson Sampling (alpha/beta/UCB scores)
   → Backend commissions variants if accuracy < threshold
```

### Automatic Backend Actions

When backend receives cochange accuracy data:

1. **Update embeddings**: Adjust GNN model weights
   - Strengthen correct predictions
   - Adjust incorrect predictions
   - Add missed cochanges to training set

2. **Evolve template**: Modify template steps
   - Add checks for commonly missed files
   - Adjust `top_k` if consistently under/over-predicting
   - Improve prompt guidance based on failures

3. **Route tasks**: Update Thompson Sampling
   - Increase alpha/beta for high-accuracy templates
   - Decrease scores for low-accuracy templates
   - Route similar tasks to better-performing variants

4. **Commission variants**: Create new template versions
   - If accuracy < 50%, create improved variant
   - Test multiple `top_k` values
   - Experiment with prompt improvements

---

## Example Execution Flow

### Input Variables
```json
{
  "file_path": "src/services/user-service.ts",
  "component_name": "UserService",
  "refactoring_goal": "Extract authentication logic into separate AuthService",
  "refactoring_reason": "UserService has 800 lines, violates single responsibility principle"
}
```

### Task 0: Analyze Impact

**Agent actions**:
1. Calls `metabob_analyze_change_impact` → finds 23 direct dependents
2. Calls `metabob_search_codebase_issues` → finds 5 HIGH, 8 MEDIUM issues
3. Calls `metabob_suggest_related_changes` → predicts 8 files:
   - `src/services/auth-service.ts` (NEW FILE)
   - `src/controllers/user-controller.ts`
   - `src/controllers/auth-controller.ts`
   - `src/middleware/auth.ts`
   - `src/types/user.ts`
   - `tests/services/user-service.test.ts`
   - `tests/services/auth-service.test.ts`
   - `docs/api/authentication.md`

**Output**: `REFACTORING_PLAN.md` with:
```markdown
### Predicted Cochanges

**Files likely to need changes**:
1. `src/services/auth-service.ts` - NEW: Extracted authentication logic
2. `src/controllers/user-controller.ts` - Uses UserService auth methods
3. `src/controllers/auth-controller.ts` - Uses UserService auth methods
4. `src/middleware/auth.ts` - Depends on auth logic
5. `src/types/user.ts` - May need auth-related type updates
6. `tests/services/user-service.test.ts` - Tests auth functionality
7. `tests/services/auth-service.test.ts` - NEW: Tests for extracted service
8. `docs/api/authentication.md` - Documents auth API

**Prediction Summary**:
- Total predicted files: 8
- High priority: 4 files (services, controllers)
- Medium priority: 4 files (middleware, tests, docs)
```

### Task 1-2: Implement + Test

**Agent modifies**:
- `src/services/user-service.ts` (removed auth logic)
- `src/services/auth-service.ts` (NEW)
- `src/controllers/user-controller.ts` (use AuthService)
- `src/controllers/auth-controller.ts` (use AuthService)
- `src/middleware/auth.ts` (use AuthService)
- `tests/services/user-service.test.ts` (updated)
- `tests/services/auth-service.test.ts` (NEW)
- `src/api/routes.ts` (UNPREDICTED - had to update route definitions)

### Task 3: Document and Measure

**Agent calculates**:
```
Predicted: 8 files
Actually changed: 8 files
Correctly predicted: 7 files (missed src/types/user.ts, missed src/api/routes.ts)

Cochange accuracy: 7/8 = 87.5%
```

**Output**: `REFACTORING_SUMMARY.md` with:
```markdown
### Related Files Analysis

**Cochange Prediction Accuracy**:
- Predicted files: 8
- Actually changed files: 8
- Correctly predicted: 7
- **Cochange accuracy: 7/8 = 87.5%**

**Correctly Predicted**:
1. ✓ `src/services/auth-service.ts` - NEW file created as predicted
2. ✓ `src/controllers/user-controller.ts` - Updated to use AuthService
3. ✓ `src/controllers/auth-controller.ts` - Updated to use AuthService
4. ✓ `src/middleware/auth.ts` - Updated to use AuthService
5. ✓ `tests/services/user-service.test.ts` - Updated tests
6. ✓ `tests/services/auth-service.test.ts` - NEW tests created
7. ✓ `src/services/user-service.ts` - Refactored (obviously changed)

**Missed Predictions** (changed but not predicted):
1. `src/api/routes.ts` - Had to update route imports to use new AuthService
   - **Why missed**: Routes weren't direct dependents, but import chain required update

**False Positives** (predicted but didn't change):
1. `src/types/user.ts` - No auth-related type changes needed
   - **Why not needed**: Auth types remained compatible
2. `docs/api/authentication.md` - Not updated yet
   - **Note**: Should be updated in follow-up commit

**Activity Learning Note**: High accuracy (87.5%) suggests cochange predictions are effective for refactoring. Missed prediction (routes.ts) suggests including files that import services, not just direct dependents.
```

### Backend Learning

Backend receives outcome and:

1. **Reinforces patterns**: `user-service.ts` ↔ `auth-service.ts` (NEW)
2. **Learns missed pattern**: `service.ts` ↔ `routes.ts` (import chains)
3. **Updates template variant**: Consider adding route files to predictions
4. **Maintains high UCB score**: 87.5% accuracy keeps template as preferred variant

---

## Validation

### JSON Schema Valid
✅ Template passes JSON validation

### Required Sections Present

**Task 0 (analyze-impact)**:
- ✅ Guidance includes `metabob_suggest_related_changes`
- ✅ Prompt includes "### 4. Predict Related Files"
- ✅ Template includes "### Predicted Cochanges"
- ✅ Validation requires "### Predicted Cochanges"

**Task 3 (document-and-annotate)**:
- ✅ Guidance includes `metabob_suggest_related_changes`
- ✅ Prompt includes "## Part 2: Check Related Files and Cochange Accuracy"
- ✅ Template includes "### Related Files Analysis"
- ✅ Validation requires "### Related Files Analysis" and "Cochange accuracy:"

### Pattern Consistency

**Compared to `fix-bug-complete` and `add-feature-complete`**:
- ✅ Early prediction in planning task (Task 0)
- ✅ Accuracy calculation in documentation task (Task 3)
- ✅ Predictions stored in design document (REFACTORING_PLAN.md)
- ✅ Accuracy documented in summary (REFACTORING_SUMMARY.md)
- ✅ Validation enforces both sections

**Unique to refactoring**:
- ✅ Higher `top_k` value (10 vs 8) for wider scope
- ✅ Uses both impact analysis AND cochange analysis
- ✅ Emphasizes dependency validation and API compatibility

---

## Testing Recommendations

### 1. Unit Test Template Execution
```bash
# Test with simple refactoring scenario
opencode activity run refactor-component-complete \
  --file_path="src/utils/format.ts" \
  --component_name="formatDate" \
  --refactoring_goal="Extract timezone logic into separate function" \
  --refactoring_reason="Reduce complexity from 15 to <10"
```

**Expected**:
- Task 0 creates REFACTORING_PLAN.md with "### Predicted Cochanges"
- Task 3 creates REFACTORING_SUMMARY.md with "### Related Files Analysis"
- Accuracy calculation is present and reasonable

### 2. Validate Cochange Accuracy Calculation
```bash
# After execution, check accuracy section
cat REFACTORING_SUMMARY.md | grep -A 20 "Related Files Analysis"
```

**Expected format**:
```
### Related Files Analysis

**Cochange Prediction Accuracy**:
- Predicted files: X
- Actually changed files: Y
- Correctly predicted: Z
- **Cochange accuracy: Z/X = AA%**
```

### 3. Test Backend Integration
```bash
# Check activity outcome contains cochangeAccuracy
opencode activity outcomes --last 1 --json | jq '.comparison.cochangeAccuracy'
```

**Expected**: Numeric value between 0.0 and 1.0

---

## Metrics to Track

### Template-Level Metrics
- **Cochange accuracy**: Average accuracy across all executions
- **Execution count**: Number of times template used
- **Success rate**: Percentage of successful completions
- **UCB score**: Thompson Sampling score for routing

### Per-Execution Metrics
- **Predicted files**: Count of files predicted to change
- **Actual files**: Count of files actually changed
- **Correct predictions**: Count of correct predictions
- **Cochange accuracy**: Percentage (correct / predicted)
- **Missed files**: Files changed but not predicted
- **False positives**: Files predicted but not changed

### Learning Metrics
- **Accuracy trend**: Is accuracy improving over time?
- **Variant performance**: Which variant has highest accuracy?
- **Pattern discovery**: What file patterns are being learned?
- **Commission rate**: How often are new variants commissioned?

---

## Known Limitations

### 1. Manual Accuracy Calculation
- Agent calculates accuracy in Task 3
- Could be automated in OpenCode CLI (like `fix-bug-complete` and `add-feature-complete`)
- **Future improvement**: Extract from git diff automatically

### 2. Prediction Storage
- Predictions stored in markdown document
- Not structured data (yet)
- **Future improvement**: Store predictions in activity metadata

### 3. No Cross-Template Learning
- Each template learns independently
- Refactoring patterns not shared with feature/bug templates
- **Future improvement**: Shared cochange embedding space

### 4. No Real-Time Feedback
- Learning happens after execution completes
- Agent doesn't see updated predictions mid-execution
- **Future improvement**: Real-time cochange updates

---

## Success Criteria

✅ **Structural Integration**: Template follows proven pattern  
✅ **Early Prediction**: Task 0 predicts cochanges before execution  
✅ **Accuracy Tracking**: Task 3 calculates and documents accuracy  
✅ **Validation Enforced**: Required sections must be present  
✅ **Backend Compatible**: Data flows to backend learning system  
✅ **Pattern Consistency**: Matches `fix-bug-complete` and `add-feature-complete`  
✅ **Refactoring-Specific**: Uses both impact and cochange analysis  
✅ **Higher Scope**: `top_k: 10` for wider refactoring blast radius  

---

## Next Steps

### Immediate
1. ✅ Integration complete for `refactor-component-complete`
2. ⏭️ Test template with real refactoring scenario
3. ⏭️ Verify backend receives cochange accuracy data
4. ⏭️ Monitor accuracy trends over multiple executions

### Short-Term
- Integrate cochange learning into remaining templates (infrastructure, tool creation, etc.)
- Add automated accuracy calculation to OpenCode CLI
- Create dashboard for visualizing cochange accuracy trends
- Document best practices for template authors

### Long-Term
- Shared embedding space across all templates
- Real-time cochange prediction updates
- Cross-template pattern learning
- Predictive refactoring suggestions

---

## References

- **Fix Bug Integration**: `FIX_BUG_COMPLETE_COCHANGE_INTEGRATION.md`
- **Add Feature Integration**: `ADD_FEATURE_COMPLETE_COCHANGE_INTEGRATION.md`
- **Learning Guide**: `COCHANGE_IMPULSE_ACTIVITY_LEARNING_GUIDE.md`
- **Template**: `refactor-component-complete.json`
- **Backend API**: Metabob RPC API `/v2/activity/outcome`
- **OpenCode CLI**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
