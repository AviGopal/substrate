# Jiggle Documentation Activity - Visual Guide

## The "Jiggle" Metaphor

Think of documentation as layers in a jar:
```
┌─────────────────────────────────────┐
│  Recent Docs (Top Layer)            │  ← New info, scattered
│  ↓ Percolate valuable details down  │
├─────────────────────────────────────┤
│  Medium Age Docs (Middle Layer)     │  ← Partially outdated
│  ↓ Keep relevant, archive obsolete  │
├─────────────────────────────────────┤
│  Foundational Docs (Bottom Layer)   │  ← Should be updated
│  ↑ Receive percolated details       │
├─────────────────────────────────────┤
│  Obsolete Docs (Sediment)           │  ← Remove/archive
└─────────────────────────────────────┘
```

**Jiggling** shakes the jar: valuable content rises to foundational docs, obsolete content settles for removal.

---

## Activity Workflow

### Overview
```
Input: Repository with scattered documentation
   ↓
[Task 1] Analyze & Categorize
   ↓
[Task 2] Percolate Content
   ↓
[Task 3] Delete Obsolete
   ↓
[Task 4] Create Summary
   ↓
Output: Organized, up-to-date documentation
```

### Detailed Task Flow

#### Task 1: Analyze Docs by Date
```
┌─────────────────────────────────────────────────┐
│ Input: Repository with *.md files              │
└────────────────┬────────────────────────────────┘
                 ↓
         ┌───────────────┐
         │ Find all *.md │
         └───────┬───────┘
                 ↓
         ┌───────────────────┐
         │ Get last modified │
         │ (git log OR stat) │
         └───────┬───────────┘
                 ↓
         ┌────────────────────┐
         │ Sort by date       │
         │ (newest → oldest)  │
         └───────┬────────────┘
                 ↓
         ┌──────────────────────────┐
         │ Categorize by age:       │
         │ • Recent (< 30 days)     │
         │ • Medium (30-90 days)    │
         │ • Stale (90-180 days)    │
         │ • Obsolete (> 180 days)  │
         └───────┬──────────────────┘
                 ↓
         ┌─────────────────────────┐
         │ Detect duplicates       │
         │ (similar titles/content)│
         └───────┬─────────────────┘
                 ↓
┌────────────────────────────────────────────────┐
│ Output: doc-jiggle-analysis.md                 │
│ • Sorted file list with ages                   │
│ • Age distribution (recent/medium/stale)       │
│ • Duplicate candidates                         │
│ • Obsolescence candidates                      │
└────────────────────────────────────────────────┘
```

#### Task 2: Percolate Content
```
┌────────────────────────────────────────────────┐
│ Input: doc-jiggle-analysis.md                  │
└────────────────┬───────────────────────────────┘
                 ↓
         ┌──────────────────────┐
         │ Identify foundational│
         │ docs (README, arch)  │
         └───────┬──────────────┘
                 ↓
         ┌──────────────────────────┐
         │ Extract recent details:  │
         │ • New features           │
         │ • Updated configs        │
         │ • Best practices         │
         │ • Bug fixes/workarounds  │
         └───────┬──────────────────┘
                 ↓
         ┌────────────────────────────┐
         │ Decision: Does it belong   │
         │ in foundational doc?       │
         │ ┌───Yes──┐     ┌───No───┐ │
         └─┤        │     │        │─┘
           ↓        ↓     ↓        ↓
     ┌─────────┐  ┌──────────┐  Skip
     │Copy/Move│  │Add ref   │
     │content  │  │to new loc│
     └────┬────┘  └────┬─────┘
          │            │
          └────┬───────┘
               ↓
     ┌──────────────────┐
     │Update cross-refs │
     │and TOCs          │
     └────┬─────────────┘
          ↓
┌────────────────────────────────────────────────┐
│ Output (mode=dryRun):                          │
│   doc-percolation-plan.md                      │
│ OR (mode=apply):                               │
│   doc-percolation-summary.md                   │
│   + Updated foundational docs                  │
└────────────────────────────────────────────────┘
```

#### Task 3: Delete Obsolete Docs
```
┌────────────────────────────────────────────────┐
│ Input: Obsolete candidates from analysis       │
└────────────────┬───────────────────────────────┘
                 ↓
         ┌─────────────────────┐
         │ For each candidate: │
         └────────┬────────────┘
                  ↓
         ┌────────────────────────┐
         │ Check ALL criteria:    │
         │ ☑ Age > threshold      │
         │ ☑ Content outdated     │
         │ ☑ NOT referenced       │
         │ ☑ NOT foundational     │
         │ ☑ No valuable content  │
         └────────┬───────────────┘
                  ↓
         ┌────────────────────────┐
         │ All criteria met?      │
         │ ┌───Yes──┐  ┌───No──┐ │
         └─┤        │  │       │─┘
           ↓        ↓  ↓       ↓
     ┌──────────┐  ┌──────────────┐
     │Archive   │  │Add deprecation│
     │OR Delete │  │notice instead │
     └────┬─────┘  └──────┬───────┘
          │               │
          └───────┬───────┘
                  ↓
         ┌────────────────┐
         │Update references│
         │Remove links    │
         └────┬───────────┘
              ↓
┌────────────────────────────────────────────────┐
│ Output (mode=dryRun):                          │
│   doc-deletion-plan.md                         │
│ OR (mode=apply):                               │
│   doc-deletion-summary.md                      │
│   + .archive/ directory with moved files       │
│   + Updated cross-references                   │
└────────────────────────────────────────────────┘
```

#### Task 4: Create Summary
```
┌─────────────────────────────────────────────────┐
│ Input: All previous task outputs               │
│ • doc-jiggle-analysis.md                        │
│ • doc-percolation-plan.md (or summary)          │
│ • doc-deletion-plan.md (or summary)             │
└────────────────┬────────────────────────────────┘
                 ↓
         ┌──────────────────┐
         │ Combine reports  │
         └───────┬──────────┘
                 ↓
         ┌──────────────────────────┐
         │ Calculate metrics:       │
         │ • Total docs analyzed    │
         │ • Files updated          │
         │ • Files deleted/archived │
         │ • Details percolated     │
         │ • Duplicates found       │
         └───────┬──────────────────┘
                 ↓
         ┌──────────────────────────┐
         │ Generate recommendations:│
         │ • Docs needing updates   │
         │ • Structure improvements │
         │ • Next jiggle schedule   │
         └───────┬──────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│ Output: doc-jiggle-summary.md                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ Analysis Summary                            │ │
│ │ • 142 docs found                            │ │
│ │ • 23 recent, 45 medium, 51 stale, 23 obsolete│ │
│ ├─────────────────────────────────────────────┤ │
│ │ Percolation Summary                         │ │
│ │ • 12 details moved to foundational docs     │ │
│ │ • 5 foundational docs updated               │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Cleanup Summary                             │ │
│ │ • 8 docs archived, 15 deprecated            │ │
│ │ • 34 cross-references updated               │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Recommendations                             │ │
│ │ • Run again in 90 days                      │ │
│ │ • Consider creating index doc               │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Execution Modes

### Mode: dryRun (Safe Default)
```
┌───────────┐     ┌───────────┐     ┌───────────┐
│ Analyze   │────▶│ Plan      │────▶│ Plan      │
│ (read)    │     │ Percolate │     │ Delete    │
└───────────┘     │ (no apply)│     │ (no apply)│
                  └───────────┘     └───────────┘
                        │                  │
                        └──────┬───────────┘
                               ↓
                      ┌──────────────────┐
                      │ Summary          │
                      │ (recommendations)│
                      └──────────────────┘

Result: 4 markdown reports, NO file changes
```

### Mode: apply (Execute Changes)
```
┌───────────┐     ┌───────────┐     ┌───────────┐
│ Analyze   │────▶│ Percolate │────▶│ Delete    │
│ (read)    │     │ (MODIFY)  │     │ (MOVE)    │
└───────────┘     └───────────┘     └───────────┘
                        │                  │
                        └──────┬───────────┘
                               ↓
                      ┌──────────────────┐
                      │ Summary          │
                      │ (what changed)   │
                      └──────────────────┘

Result: Updated docs, .archive/ dir, 4 reports
```

---

## Safety Mechanisms

### 1. Conservative Deletion
```
Deletion Checklist (ALL required):
☐ File age > obsoleteDays threshold
☐ Content clearly outdated/superseded
☐ NOT referenced by other docs
☐ NOT referenced in code
☐ NOT a foundational doc (README, CONTRIBUTING, etc.)
☐ Percolation step found no valuable content to move

If ANY checkbox fails → Skip deletion, add deprecation notice instead
```

### 2. Archive-First Strategy
```
When archiveInsteadOfDelete = true (default):

DELETE file.md
    ↓
Instead:
    ↓
mkdir -p .archive/
    ↓
mv file.md .archive/file.md
    ↓
Add comment: "Archived on YYYY-MM-DD by jiggle-documentation"
    ↓
Update references → "See .archive/file.md (archived)"
```

### 3. Dry-Run Default
```
mode = "dryRun" (default)
    ↓
NO file modifications
    ↓
Create *-plan.md files instead of *-summary.md
    ↓
User reviews plans
    ↓
User re-runs with mode = "apply" if satisfied
```

---

## Variable Configuration Guide

### Scenario: Active Project (frequent updates)
```json
{
  "recentDays": 7,        // Consider docs recent if < 1 week old
  "mediumDays": 30,       // Medium if 1-4 weeks old
  "obsoleteDays": 90,     // Obsolete if > 3 months old
  "mode": "dryRun"        // Review first
}
```

### Scenario: Stable Project (infrequent updates)
```json
{
  "recentDays": 60,       // Recent if < 2 months old
  "mediumDays": 180,      // Medium if 2-6 months old
  "obsoleteDays": 365,    // Obsolete if > 1 year old
  "mode": "dryRun"
}
```

### Scenario: Documentation Subset Only
```json
{
  "scope": "docs/api/",   // Only jiggle API docs
  "mode": "apply",        // Apply changes directly
  "archiveInsteadOfDelete": false  // Actually delete (careful!)
}
```

---

## Output Files

### doc-jiggle-analysis.md
```markdown
# Documentation Jiggle Analysis

## Summary
- Total files: 142
- Recent (< 30d): 23 files
- Medium (30-90d): 45 files
- Stale (90-180d): 51 files
- Obsolete (> 180d): 23 files

## Files by Age (newest first)
1. feature-x-guide.md (2 days old) - "Feature X Guide"
2. config-update.md (5 days old) - "Configuration Updates"
...

## Duplicates Detected
- "Getting Started" appears in README.md and docs/quickstart.md
- "API Reference" covered in both api-docs.md and reference.md

## Obsolescence Candidates
- old-deployment-guide.md (245 days old)
- deprecated-api-v1.md (367 days old)
...
```

### doc-percolation-plan.md (dryRun mode)
```markdown
# Documentation Percolation Plan

## Proposed Changes

### Update README.md
**Add from** feature-x-guide.md (recent):
- New feature X installation steps
- Configuration example for feature X

**Rationale**: Feature X is now core, belongs in README

### Update docs/architecture.md
**Add from** performance-notes.md (recent):
- New caching layer architecture
- Performance optimization details

**Rationale**: Architecture changes should be in main architecture doc

## Summary
- 5 foundational docs to update
- 12 content pieces to percolate
- 3 recent docs can be removed after percolation
```

### doc-deletion-plan.md (dryRun mode)
```markdown
# Documentation Deletion Plan

## Files to Archive

### old-deployment-guide.md (245 days old)
**Reason**: Superseded by new deployment-guide.md
**References**: None found
**Action**: Move to .archive/

### deprecated-api-v1.md (367 days old)
**Reason**: API v1 removed in favor of v2
**References**: None found
**Action**: Move to .archive/

## Files to Keep (with deprecation notice)

### legacy-config.md (220 days old)
**Reason**: Still referenced in migration-guide.md
**Action**: Add deprecation notice, point to new config doc
```

### doc-jiggle-summary.md
```markdown
# Documentation Jiggle Summary

## Analysis
- **Total docs**: 142 markdown files
- **Distribution**: 23 recent, 45 medium, 51 stale, 23 obsolete
- **Duplicates**: 8 potential duplicates identified

## Percolation
- **Details moved**: 12 content pieces
- **Docs updated**: 5 foundational documents
- **Redundant docs removed**: 3 files

## Cleanup
- **Archived**: 8 obsolete files → .archive/
- **Deprecated**: 15 files with notices added
- **References updated**: 34 cross-references fixed

## Recommendations
1. Run jiggle again in 90 days
2. Consider creating docs/INDEX.md for navigation
3. Update CONTRIBUTING.md with doc maintenance guidelines
4. 3 docs need manual review: [list]

## Next Steps
- Review archived files in .archive/
- Verify cross-references still work
- Update documentation overview in README
```

---

## Integration Example

### Compose with Commit Activity
```typescript
// Step 1: Jiggle documentation
activity({
  activityId: "jiggle-documentation",
  variables: {
    scope: "entire repo",
    mode: "apply"
  },
  reason: "Quarterly documentation refresh"
})

// Step 2: Review outputs
// Read: doc-jiggle-summary.md

// Step 3: Commit changes
activity({
  activityId: "commit-organized-changes",
  variables: {
    commitType: "docs",
    message: "docs: jiggle documentation - percolate recent details and archive obsolete"
  },
  reason: "Commit documentation refresh changes"
})
```

---

## Metrics & Learning

### Success Metrics
- Docs found and categorized
- Details successfully percolated
- Obsolete docs archived
- No broken references after cleanup
- Summary report completeness

### Observed Patterns (Success)
✅ Agent checks git history for relevance context  
✅ Agent verifies cross-references before deletion  
✅ Agent archives rather than deletes  
✅ Agent updates table of contents  

### Observed Patterns (Failure)
❌ Deleting foundational docs (README, CONTRIBUTING)  
❌ Not checking cross-references → broken links  
❌ Over-aggressive deletion (removing still-relevant docs)  
❌ Percolating too much → bloating foundational docs  

---

## Template Status

✅ **Created**: `templates/custom/jiggle-documentation.json`  
✅ **Validated**: JSON structure correct, 4 tasks, 6 variables  
✅ **Documented**: Comprehensive guides and examples  
⚠️  **Executable**: Requires Metabob backend (SurrealDB)  

**Ready for production use once backend is connected!**
