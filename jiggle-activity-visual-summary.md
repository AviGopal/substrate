# Jiggle Documentation Activity - Visual Summary

## Activity Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   JIGGLE DOCUMENTATION ACTIVITY                  │
│                          (refactor category)                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌──────────────┐     ┌────────────┐     ┌─────────────┐
│   Task 1    │────▶│    Task 2    │────▶│   Task 3   │────▶│   Task 4    │
│   Analyze   │     │  Percolate   │     │   Delete   │     │  Summarize  │
│  Docs by    │     │   Content    │     │  Obsolete  │     │   Results   │
│    Date     │     │              │     │    Docs    │     │             │
└─────────────┘     └──────────────┘     └────────────┘     └─────────────┘
      │                    │                    │                   │
      ▼                    ▼                    ▼                   ▼
┌─────────────┐     ┌──────────────┐     ┌────────────┐     ┌─────────────┐
│  doc-jiggle │     │doc-percolation│     │doc-deletion│     │ doc-jiggle- │
│ -analysis.md│     │  -plan.md    │     │ -plan.md   │     │ summary.md  │
└─────────────┘     └──────────────┘     └────────────┘     └─────────────┘
```

## Task Details

### Task 1: Analyze Docs by Date
```
Input:  All *.md files in repository
        ↓
Process: • Find all markdown files
         • Get modification timestamps
         • Sort by date (newest → oldest)
         • Categorize by age buckets
        ↓
Output: doc-jiggle-analysis.md
        • Recent (< 30 days)
        • Medium (30-90 days)
        • Stale (90-180 days)
        • Obsolete (> 180 days)
```

### Task 2: Percolate Content
```
Input:  Recent docs + Analysis report
        ↓
Process: • Identify foundational docs (README, etc.)
         • Extract valuable recent details
         • Determine promotion targets
         • Merge/move content
         • Update cross-references
        ↓
Output: mode=dryRun  → doc-percolation-plan.md
        mode=apply   → doc-percolation-summary.md + updated docs
```

### Task 3: Delete Obsolete Docs
```
Input:  Obsolete candidates + Analysis
        ↓
Process: • Review each obsolete doc
         • Check: still relevant?
         • Check: referenced elsewhere?
         • Conservative deletion criteria
         • Archive or delete
        ↓
Output: mode=dryRun  → doc-deletion-plan.md
        mode=apply   → doc-deletion-summary.md + .archive/
```

### Task 4: Create Summary
```
Input:  All previous task outputs
        ↓
Process: • Combine all reports
         • Calculate metrics
         • Provide recommendations
         • Create unified summary
        ↓
Output: doc-jiggle-summary.md
        • Complete activity summary
        • Metrics and statistics
        • Next steps
```

## Variables

```
┌────────────────────┬──────────┬──────────────┬─────────────────────────────┐
│ Variable           │ Type     │ Default      │ Purpose                     │
├────────────────────┼──────────┼──────────────┼─────────────────────────────┤
│ scope              │ string   │ "entire repo"│ What docs to analyze        │
│ recentDays         │ number   │ 30           │ Recent threshold            │
│ mediumDays         │ number   │ 90           │ Medium age threshold        │
│ obsoleteDays       │ number   │ 180          │ Obsolescence threshold      │
│ mode               │ string   │ "dryRun"     │ dryRun or apply             │
│ archiveInsteadOf   │ boolean  │ true         │ Archive vs delete           │
│   Delete           │          │              │                             │
└────────────────────┴──────────┴──────────────┴─────────────────────────────┘
```

## Safety Features

```
┌─────────────────────────────────────────────────────────────────┐
│                         SAFETY MECHANISMS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Dry-Run Mode (DEFAULT)                                      │
│     ✓ Creates plan files without making changes                 │
│     ✓ Safe to run anytime                                       │
│                                                                  │
│  2. Archive Instead of Delete (DEFAULT)                         │
│     ✓ Moves files to .archive/ directory                        │
│     ✓ Preserves history                                         │
│                                                                  │
│  3. Conservative Deletion Criteria (ALL must be true)           │
│     ✓ File age > obsoleteDays threshold                         │
│     ✓ Content clearly outdated/wrong/superseded                 │
│     ✓ NOT referenced by other docs or code                      │
│     ✓ NOT a foundational doc                                    │
│                                                                  │
│  4. Cross-Reference Validation                                  │
│     ✓ Checks for links to deleted docs                          │
│     ✓ Updates or removes broken links                           │
│                                                                  │
│  5. Git History Analysis                                        │
│     ✓ Considers commit history context                          │
│     ✓ Distinguishes "untouched but valid" from "truly obsolete" │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Learning System

```
┌─────────────────────────────────────────────────────────────────┐
│                      FEEDBACK & METRICS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Task 1 (analyze-docs-by-date)                                  │
│    Metrics:                                                      │
│      • docs_found                                                │
│      • obsolete_candidates                                       │
│      • duplicates_found                                          │
│    Hints:                                                        │
│      • date_accuracy (1-10)                                      │
│      • categorization_usefulness (1-10)                          │
│                                                                  │
│  Task 2 (percolate-content)                                     │
│    Metrics:                                                      │
│      • details_percolated                                        │
│      • docs_updated                                              │
│      • redundant_docs_removed                                    │
│    Hints:                                                        │
│      • percolation_logic (1-10)                                  │
│      • target_selection (1-10)                                   │
│                                                                  │
│  Task 3 (delete-obsolete-docs)                                  │
│    Metrics:                                                      │
│      • docs_deleted                                              │
│      • false_positives                                           │
│      • references_updated                                        │
│    Hints:                                                        │
│      • deletion_safety (1-10)                                    │
│      • criteria_clarity (1-10)                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Example Usage Patterns

### Pattern 1: Safe Analysis (Recommended First Run)
```bash
activity({
  activityId: "jiggle-documentation",
  variables: {
    mode: "dryRun",
    scope: "entire repo"
  },
  reason: "Analyze documentation health without making changes"
})

Output:
  ✓ doc-jiggle-analysis.md    (age distribution)
  ✓ doc-percolation-plan.md   (proposed consolidations)
  ✓ doc-deletion-plan.md      (obsolete candidates)
  ✓ doc-jiggle-summary.md     (complete analysis)
```

### Pattern 2: Targeted Analysis
```bash
activity({
  activityId: "jiggle-documentation",
  variables: {
    mode: "dryRun",
    scope: "docs/",
    obsoleteDays: 90  // More aggressive threshold
  },
  reason: "Analyze just the docs/ directory"
})
```

### Pattern 3: Apply Changes (After Reviewing Plans)
```bash
# Step 1: Review dry-run outputs
# Step 2: Apply if satisfied

activity({
  activityId: "jiggle-documentation",
  variables: {
    mode: "apply",
    archiveInsteadOfDelete: true
  },
  reason: "Execute documentation refresh based on reviewed plan"
})

Output:
  ✓ Updated foundational docs
  ✓ .archive/ with obsolete content
  ✓ doc-jiggle-summary.md (what changed)
```

## Status: February 6, 2026

```
┌──────────────────────────────────────────────────────────────┐
│                     IMPLEMENTATION STATUS                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Template Design         ████████████████████  100% ✅       │
│  JSON Structure          ████████████████████  100% ✅       │
│  Task Definitions        ████████████████████  100% ✅       │
│  Variables System        ████████████████████  100% ✅       │
│  Safety Features         ████████████████████  100% ✅       │
│  Learning Config         ████████████████████  100% ✅       │
│  Documentation           ████████████████████  100% ✅       │
│  Test Scripts            ████████████████████  100% ✅       │
│                                                               │
│  Registration            ████░░░░░░░░░░░░░░░░   20% ⚠️       │
│  Backend Integration     ████░░░░░░░░░░░░░░░░   20% ⚠️       │
│  End-to-End Testing      ░░░░░░░░░░░░░░░░░░░░    0% ⏸️       │
│                                                               │
└──────────────────────────────────────────────────────────────┘

 ✅ = Complete     ⚠️ = In Progress     ⏸️ = Blocked
```

## Key Insights

### What Makes This Activity Special

1. **Conservative by Default**
   - Dry-run mode prevents accidents
   - Archive instead of delete preserves history
   - Multiple safety checks before deletion

2. **Intelligent Context Awareness**
   - Uses git history for relevance assessment
   - Distinguishes "untouched" from "obsolete"
   - Checks cross-references before changes

3. **Comprehensive Learning**
   - 15+ metrics captured
   - 6 improvement hints (1-10 scale)
   - Success/failure pattern tracking

4. **Composable & Reusable**
   - Works standalone or with other activities
   - Can be scoped (entire repo or specific dirs)
   - Configurable thresholds for different contexts

---

**Template File**: jiggle-documentation.json (16,571 bytes)  
**Validation**: ✅ All tests passed  
**Status**: 🟡 Ready for registration
