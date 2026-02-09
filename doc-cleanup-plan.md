# Documentation Cleanup Plan - APPLY MODE

## Phase 1: Delete Untracked Session Artifacts

These are temporary files generated during sessions that should not be committed:

```bash
# Trash files (session artifacts)
rm -f DOCUMENTATION_JIGGLE_FINAL_SUMMARY.md
rm -f DOC_JIGGLE_COMPREHENSIVE_ANALYSIS.md
rm -f doc-jiggle-analysis-validated.md
```

## Phase 2: Consolidate or Keep Important Untracked Files

These files have value but need to be either committed or merged:

### Keep and Track (Important Reference Docs)
```bash
# These provide important reference information
git add CLI_METABOB_TOOLS_REFERENCE.md       # Metabob tools documentation
git add EXISTING_EXECUTION_TRACKING.md       # Backend infrastructure reference
git add PROTO_SCHEMA_REFERENCE.md            # Proto schema reference
```

### Consolidate into Existing Tracked Files
```bash
# PHASE2_COMPLETE.md has same info as PHASE2_DATA_STORAGE_ANALYSIS.md
# Check if they're duplicates and keep the tracked version
```

## Phase 3: Consolidate Fragmented Documentation

### JIGGLE Documentation (4 files → 2 files)

Current state:
- ✅ JIGGLE_EXECUTION_SUMMARY.md (tracked) - keep as authoritative
- ✅ README-JIGGLE-ACTIVITY.md (tracked) - keep as guide
- ❌ DOCUMENTATION_JIGGLE_FINAL_SUMMARY.md (untracked) - DELETE
- ❌ DOC_JIGGLE_COMPREHENSIVE_ANALYSIS.md (untracked) - DELETE

Action: Delete untracked duplicates

### PHASE2 Documentation (2 files → 1 file)

Current state:
- ✅ PHASE2_DATA_STORAGE_ANALYSIS.md (tracked)
- ❓ PHASE2_COMPLETE.md (untracked)

Action: Compare content, merge if needed, delete duplicate

## Phase 4: Archive Old Session Files

Move archived session logs and test reports from untracked to properly archived:

```bash
# All files in .archive/ that are untracked should be committed to .gitignore
# OR moved to a separate archive location
```

## Phase 5: Validate Documentation Claims

Files to validate against git history:
- Check for "implemented" claims
- Verify features exist in codebase
- Cross-reference commit messages

## Expected Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total docs | 666 | ~640 | -26 (-4%) |
| Untracked root | 7 | 3 | -4 (-57%) |
| Jiggle docs | 4 | 2 | -2 (-50%) |
| Root clutter | 53 | 51 | -2 (-4%) |

## Files to DELETE (Session Artifacts)

1. DOCUMENTATION_JIGGLE_FINAL_SUMMARY.md
2. DOC_JIGGLE_COMPREHENSIVE_ANALYSIS.md
3. doc-jiggle-analysis-validated.md (this analysis file after execution)

## Files to TRACK (Important References)

1. CLI_METABOB_TOOLS_REFERENCE.md
2. EXISTING_EXECUTION_TRACKING.md
3. PROTO_SCHEMA_REFERENCE.md

## Files to CONSOLIDATE

1. PHASE2_COMPLETE.md → merge/compare with PHASE2_DATA_STORAGE_ANALYSIS.md

