# Jiggle Documentation Activity - Current Status & Usage Guide

**Date**: 2026-02-07  
**Status**: ✅ **READY FOR USE**  
**Location**: `repos/metabob-proto/activities/bootstrap/jiggle-documentation.json`

---

## Executive Summary

The **jiggle-documentation** activity is a complete, tested activity template that systematically organizes documentation by:

1. **Analyzing** modification dates to understand doc age distribution
2. **Percolating** important recent details backwards into foundational documents
3. **Archiving** obsolete content safely (never deletes, always preserves)
4. **Summarizing** the entire process with actionable recommendations

**Key Achievement**: This activity has already been successfully executed and generated comprehensive analysis reports for the metabob-devbob repository.

---

## Current Status: Evidence of Success

### ✅ Activity Template Exists
- **File**: `repos/metabob-proto/activities/bootstrap/jiggle-documentation.json`
- **Size**: 16,571 bytes
- **Format**: Complete activity template with tasks, variables, validation, learning system
- **Validation**: All structure checks pass

### ✅ Successfully Executed (Previous Run)
The activity was executed on **2026-02-06** and generated three comprehensive reports:

| Report | Lines | Size | Purpose |
|--------|-------|------|---------|
| `doc-jiggle-analysis.md` | 626 | 34KB | Documentation inventory sorted by age |
| `doc-percolation-plan.md` | 456 | 12KB | Content consolidation recommendations |
| `doc-jiggle-analysis-dated.md` | 371 | 26KB | Dated variant of analysis |

**Total Analysis**: 1,453 lines of detailed documentation insights

### ✅ Generated Actionable Insights

#### Analysis Results:
- **481 markdown files** discovered and analyzed
- **442 recent files** (< 30 days) - 91% active documentation
- **19 duplicate groups** identified (49 files affected)
- **4 obsolete candidates** (180+ days old)

#### Percolation Opportunities Identified:
1. 🔴 **HIGH**: Backend setup → Documentation Index (15 min)
2. 🔴 **HIGH**: Activity system guide → Architecture docs (20 min)
3. 🟡 **MEDIUM**: Operational instructions → Quick reference (15 min)
4. 🟡 **MEDIUM**: Metabob config → OpenCode README (10 min)
5. 🟢 **LOW**: Work patterns → Resume here (5 min)

**Total effort**: 65 minutes to implement all recommendations

---

## How to Use This Activity

### Method 1: Using the `activity` Tool (Recommended)

Within an OpenCode session, use the activity tool:

```javascript
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "entire repo",
    recentDays: 30,
    mediumDays: 90,
    obsoleteDays: 180,
    mode: "dryRun",
    archiveInsteadOfDelete: true
  },
  reason: "Analyze documentation health and identify consolidation opportunities"
})
```

### Method 2: CLI Execution (Alternative)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
opencode activity run repos/metabob-proto/activities/bootstrap/jiggle-documentation
```

### Method 3: Direct Template Testing

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./test-jiggle-activity-simple.sh
```

---

## Configuration Options

### Variables Reference

| Variable | Type | Default | Purpose | Recommended Values |
|----------|------|---------|---------|-------------------|
| `scope` | string | "entire repo" | What to analyze | "entire repo", "docs/", "root only" |
| `recentDays` | number | 30 | Recent threshold | 7-30 days |
| `mediumDays` | number | 90 | Medium age threshold | 30-90 days |
| `obsoleteDays` | number | 180 | Obsolescence threshold | 90-365 days |
| `mode` | string | "dryRun" | Execution mode | "dryRun" or "apply" |
| `archiveInsteadOfDelete` | boolean | true | Archive vs delete | Always `true` for safety |

### Mode: Dry Run vs Apply

#### Dry Run Mode (Default - SAFE)
```javascript
{ mode: "dryRun" }
```
- ✅ **Reads only** - no changes made
- ✅ **Generates plans** - shows what would be done
- ✅ **Zero risk** - safe for exploration

**Outputs**:
- `doc-jiggle-analysis.md` - What was found
- `doc-percolation-plan.md` - What should be consolidated
- `doc-deletion-plan.md` - What could be archived

#### Apply Mode (Executes Changes)
```javascript
{ mode: "apply" }
```
- ⚠️ **Makes changes** - edits/moves files
- ⚠️ **Creates archive** - moves obsolete files to `.archive/`
- ✅ **No deletion** - only moves to archive (if archiveInsteadOfDelete=true)

**Outputs**:
- Updated foundational documents
- `.archive/` directory with obsolete content
- `doc-jiggle-summary.md` - Summary of changes made

---

## Task Breakdown

### Task 1: analyze-docs-by-date
**Duration**: ~2-3 minutes  
**Token Budget**: 8,000 tokens

**Actions**:
1. Finds all `*.md` files in scope
2. Collects metadata (path, modified date, size, title)
3. Categorizes by age (recent/medium/stale/obsolete)
4. Detects potential duplicates
5. Generates inventory report

**Output**: `doc-jiggle-analysis.md`

### Task 2: percolate-content
**Duration**: ~3-5 minutes  
**Token Budget**: 12,000 tokens

**Actions**:
1. Identifies foundational docs (README, index, architecture)
2. Finds valuable details in recent docs
3. Proposes content movements
4. Plans cross-reference updates

**Output**: `doc-percolation-plan.md` (dry run) or `doc-percolation-summary.md` (apply)

### Task 3: delete-obsolete-docs
**Duration**: ~2-3 minutes  
**Token Budget**: 10,000 tokens

**Actions**:
1. Reviews obsolete candidates conservatively
2. Checks cross-references
3. Verifies deletion criteria (ALL must be true)
4. Archives (moves to `.archive/`) instead of deleting

**Output**: `doc-deletion-plan.md` (dry run) or `doc-deletion-summary.md` (apply)

### Task 4: create-jiggle-summary
**Duration**: ~1-2 minutes  
**Token Budget**: 6,000 tokens

**Actions**:
1. Combines all task outputs
2. Provides metrics and statistics
3. Generates actionable recommendations
4. Creates comprehensive summary

**Output**: `doc-jiggle-summary.md`

---

## Safety Features

### 🛡️ Built-in Safety

1. **Dry Run Default**: Never makes changes unless explicitly told to apply
2. **Archive, Don't Delete**: Obsolete files moved to `.archive/`, never deleted
3. **Conservative Criteria**: Multiple checks required before archiving anything
4. **Cross-reference Validation**: Ensures no broken links
5. **Git History Analysis**: Distinguishes "untouched but valid" from "truly obsolete"
6. **Foundational Doc Protection**: Never archives README, CONTRIBUTING, or core docs

### ⚠️ What Gets Archived (Only in Apply Mode)

A file is only archived if **ALL** of these are true:
- ✅ File is older than `obsoleteDays` (default: 180 days)
- ✅ Content is clearly outdated/wrong/superseded
- ✅ NOT referenced by other docs or code
- ✅ NOT a foundational document
- ✅ Valuable content already percolated elsewhere

**Reality**: Most files pass these checks. Archives are conservative.

---

## Example Use Cases

### Use Case 1: New Developer Onboarding Prep
**Goal**: Make documentation discoverable for new developers

```javascript
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "entire repo",
    mode: "dryRun"
  },
  reason: "Identify documentation improvements before new team member joins"
})
```

**Review**: Check percolation plan for high-priority improvements to foundational docs.

### Use Case 2: Quarterly Documentation Maintenance
**Goal**: Keep docs fresh and organized

```javascript
activity({
  activityId: "jiggle-documentation",
  variables: {
    recentDays: 90,
    obsoleteDays: 365,
    mode: "dryRun"
  },
  reason: "Quarterly documentation health check"
})
```

**Review**: Longer thresholds for less aggressive recommendations.

### Use Case 3: Post-Major-Release Cleanup
**Goal**: Archive outdated migration guides and old architecture docs

```javascript
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "docs/migration/",
    obsoleteDays: 30,
    mode: "apply",
    archiveInsteadOfDelete: true
  },
  reason: "Clean up pre-v2 migration guides after successful v2 release"
})
```

**Note**: Focused scope + apply mode for targeted cleanup.

### Use Case 4: Find Documentation Duplicates
**Goal**: Consolidate redundant documentation

```javascript
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "entire repo",
    mode: "dryRun"
  },
  reason: "Identify and plan consolidation of duplicate documentation"
})
```

**Review**: Check analysis report for duplicate groups section.

---

## Integration with Other Activities

### Composition: Jiggle → Commit

After applying jiggle changes, commit them:

```javascript
// Step 1: Jiggle and apply
activity({
  activityId: "jiggle-documentation",
  variables: { mode: "apply" },
  reason: "Refresh documentation structure"
})

// Step 2: Commit changes
activity({
  activityId: "commit-organized-changes",
  variables: { dryRun: false },
  reason: "Commit documentation refresh"
})
```

### Composition: Analyze → Review → Apply

Safe multi-step workflow:

```javascript
// Step 1: Analyze
activity({
  activityId: "jiggle-documentation",
  variables: { mode: "dryRun" },
  reason: "Generate documentation health report"
})

// Step 2: Review reports manually
// (Human reviews doc-percolation-plan.md and doc-deletion-plan.md)

// Step 3: Apply approved changes
activity({
  activityId: "jiggle-documentation",
  variables: { mode: "apply" },
  reason: "Execute reviewed documentation improvements"
})
```

---

## Learning System Integration

### Metrics Captured

The activity captures comprehensive metrics for continuous improvement:

**Task 1 (Analysis)**:
- `docs_found`: Total documentation files discovered
- `obsolete_candidates`: Number of potentially obsolete docs
- `duplicates_found`: Number of duplicate docs detected

**Task 2 (Percolation)**:
- `details_percolated`: Number of content pieces moved
- `docs_updated`: Number of foundational docs updated
- `redundant_docs_removed`: Number of redundant recent docs removed

**Task 3 (Deletion)**:
- `docs_deleted`: Number of docs archived
- `false_positives`: Number of incorrectly flagged docs
- `references_updated`: Number of cross-references fixed

### Improvement Hints

After execution, provide feedback on:
- Date accuracy (1-10)
- Categorization usefulness (1-10)
- Percolation logic quality (1-10)
- Target doc selection quality (1-10)
- Deletion safety (1-10)
- Criteria clarity (1-10)

This feedback helps the activity evolve and improve over time.

---

## Troubleshooting

### Issue: Activity Not Found

**Symptom**: `activity` tool says "Activity not found: jiggle-documentation"

**Solutions**:
1. Check backend is running: `curl http://localhost:8080/`
2. Verify template exists: `ls repos/metabob-proto/activities/bootstrap/jiggle-documentation.json`
3. Check registration: `opencode activity template list | grep jiggle`
4. Use variant ID if needed: Try `jiggle-documentation-v1` or check actual variant_id in JSON

### Issue: No Output Files Generated

**Symptom**: Activity completes but no `doc-*.md` files created

**Solutions**:
1. Check execution mode: Should be in project root directory
2. Verify working directory: `pwd` should be project root
3. Check task logs for errors
4. Try with minimal scope: `{ scope: "." }`

### Issue: False Positive Obsolete Candidates

**Symptom**: Important docs flagged as obsolete

**Solutions**:
1. Increase `obsoleteDays`: Use 365+ for conservative threshold
2. Review criteria: Check if docs are untouched but still valid
3. Adjust scope: Exclude specific directories from analysis
4. Provide feedback: Mark false positives in learning system

### Issue: Too Much Percolation

**Symptom**: Percolation plan suggests moving too much content

**Solutions**:
1. Adjust thresholds: Increase `recentDays` to be more selective
2. Review manually: Not all suggestions need to be applied
3. Staged approach: Apply high-priority percolations first
4. Provide feedback: Rate "percolation_logic" lower for improvement

---

## Next Steps

### Immediate Actions

1. **Review Previous Execution**:
   - ✅ Read `doc-jiggle-analysis.md` - understand current state
   - ✅ Read `doc-percolation-plan.md` - review recommendations
   - 🔄 Decide which percolations to apply

2. **Apply High-Priority Improvements**:
   - Backend setup → Documentation Index (15 min)
   - Activity system guide → Architecture docs (20 min)

3. **Consolidate Duplicates**:
   - Merge 3 duplicate groups identified
   - Total time: ~10 minutes

### Future Improvements

**Template Evolution**:
- Add semantic similarity detection for better duplicate finding
- Integrate with documentation linter
- Add automatic TOC generation
- Include documentation coverage metrics

**Composition**:
- Create "doc-maintenance" workflow combining jiggle + commit + PR
- Add integration with CI/CD for automated doc health checks

**Learning**:
- Collect feedback from multiple executions
- Refine percolation logic based on user ratings
- Adjust deletion criteria based on false positive rates

---

## Files Created by This Activity

### Template & Scripts
- `repos/metabob-proto/activities/bootstrap/jiggle-documentation.json` - Activity template (16KB)
- `test-jiggle-activity-simple.sh` - Validation script (5KB)
- `test-jiggle-activity.sh` - Full test suite (3KB)

### Documentation
- `JIGGLE_DOCUMENTATION_ACTIVITY.md` - Usage guide (7KB)
- `JIGGLE_ACTIVITY_TEST_RESULTS.md` - Test results (9KB)
- `JIGGLE_ACTIVITY_VISUAL.md` - Visual diagrams (18KB)
- `README-JIGGLE-ACTIVITY.md` - Package index (8KB)
- `jiggle-activity-visual-summary.md` - Visual summary (14KB)
- `jiggle-documentation-visual.md` - Visual guide (20KB)
- `JIGGLE_ACTIVITY_STATUS.md` - This file

### Generated Reports (from execution)
- `doc-jiggle-analysis.md` - Analysis report (34KB, 626 lines)
- `doc-percolation-plan.md` - Percolation plan (12KB, 456 lines)
- `doc-jiggle-analysis-dated.md` - Dated variant (26KB, 371 lines)

**Total**: 14 files, 170KB of documentation and reports

---

## Conclusion

The **jiggle-documentation** activity is a production-ready tool for:
- ✅ Understanding documentation health
- ✅ Identifying consolidation opportunities
- ✅ Safely archiving obsolete content
- ✅ Maintaining documentation quality over time

**Current Status**: Already successfully executed, comprehensive reports generated, ready for immediate use.

**Recommended Next Action**: Review the percolation plan and apply high-priority improvements to foundational documents.

---

**Activity Contact**: This activity is part of the Metabob Activity System  
**Support**: See `ACTIVITY_WORKFLOW_QUICK_REFERENCE.md` for activity system guidance  
**Architecture**: See `QUICK_ARCHITECTURE_REFERENCE.md` for system overview
