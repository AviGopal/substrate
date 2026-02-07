# Documentation Jiggle Activity - Visual Guide

## Activity Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     JIGGLE DOCUMENTATION ACTIVITY                        │
│                     Variant: jiggle-documentation-772b239e               │
└─────────────────────────────────────────────────────────────────────────┘

                                    │
                                    │  INPUT VARIABLES
                                    ▼
                    ┌───────────────────────────────┐
                    │  • scope: "entire repo"       │
                    │  • recentDays: 30             │
                    │  • mediumDays: 90             │
                    │  • obsoleteDays: 180          │
                    │  • mode: "dryRun" / "apply"   │
                    │  • archiveInsteadOfDelete     │
                    └───────────────────────────────┘
                                    │
            ┌───────────────────────┴───────────────────────┐
            │         TASK 1: Analyze Docs By Date          │
            ├───────────────────────────────────────────────┤
            │  1. Find all *.md files in repository         │
            │  2. Get last modified timestamp (git/stat)    │
            │  3. Sort by date (newest → oldest)            │
            │  4. Bucket docs by age:                       │
            │     📗 Recent   (< 30 days)                   │
            │     📘 Medium   (30-90 days)                  │
            │     📙 Stale    (90-180 days)                 │
            │     📕 Obsolete (> 180 days)                  │
            │  5. Detect duplicate content                  │
            └───────────────────────────────────────────────┘
                                    │
                                    ▼
                        📄 doc-jiggle-analysis.md
                                    │
                                    │
            ┌───────────────────────┴───────────────────────┐
            │       TASK 2: Percolate Content Backward       │
            ├───────────────────────────────────────────────┤
            │  1. Identify foundational docs:               │
            │     • README.md files                         │
            │     • Architecture docs                       │
            │     • Getting started guides                  │
            │                                               │
            │  2. Find valuable recent details:             │
            │     • New features                            │
            │     • Updated configurations                  │
            │     • Bug fixes / workarounds                 │
            │     • New examples                            │
            │                                               │
            │  3. Percolation logic:                        │
            │     • Move important details UP ⬆            │
            │     • Update foundational docs                │
            │     • Add forward references                  │
            │     • Consolidate redundant info              │
            │                                               │
            │  Mode: dryRun → plan | apply → execute        │
            └───────────────────────────────────────────────┘
                                    │
                                    ▼
                   📄 doc-percolation-plan.md (dryRun)
                   📄 doc-percolation-summary.md (apply)
                                    │
                                    │
            ┌───────────────────────┴───────────────────────┐
            │      TASK 3: Delete Obsolete Documents         │
            ├───────────────────────────────────────────────┤
            │  1. Review obsolete candidates (> 180 days)   │
            │                                               │
            │  2. Deletion criteria (ALL must be true):     │
            │     ✓ Content is outdated/wrong               │
            │     ✓ NOT referenced elsewhere                │
            │     ✓ NOT a foundational doc                  │
            │     ✓ No valuable content to move             │
            │                                               │
            │  3. Safe deletion:                            │
            │     • archiveInsteadOfDelete=true:            │
            │       → Move to .archive/ directory           │
            │     • archiveInsteadOfDelete=false:           │
            │       → Permanently delete                    │
            │                                               │
            │  4. Update cross-references                   │
            │                                               │
            │  Mode: dryRun → plan | apply → execute        │
            └───────────────────────────────────────────────┘
                                    │
                                    ▼
                    📄 doc-deletion-plan.md (dryRun)
                    📄 doc-deletion-summary.md (apply)
                                    │
                                    │
            ┌───────────────────────┴───────────────────────┐
            │        TASK 4: Create Jiggle Summary           │
            ├───────────────────────────────────────────────┤
            │  Combine all reports into summary:            │
            │                                               │
            │  1. Analysis Summary                          │
            │     • Total docs analyzed                     │
            │     • Age distribution                        │
            │     • Duplicates found                        │
            │                                               │
            │  2. Percolation Summary                       │
            │     • Details moved                           │
            │     • Foundational docs updated               │
            │     • Content consolidated                    │
            │                                               │
            │  3. Cleanup Summary                           │
            │     • Docs archived/deleted                   │
            │     • Cross-references updated                │
            │     • Reasons for each action                 │
            │                                               │
            │  4. Recommendations                           │
            │     • Docs needing updates                    │
            │     • Structural improvements                 │
            │     • Next steps                              │
            └───────────────────────────────────────────────┘
                                    │
                                    ▼
                        📄 doc-jiggle-summary.md
                                    │
                                    ▼
                          ✅ ACTIVITY COMPLETE
```

## Age Bucket Classification

```
Timeline (days ago):
    ←─────────────────── TIME ────────────────────→
    0          30          90           180        ∞

    │◄─ Recent ─►│◄─ Medium ─►│◄─ Stale ─►│◄ Obsolete →│
    📗            📘            📙           📕
    
Recent (< 30 days):
  • Latest updates
  • Active development
  • Current features
  • Source for percolation ⬆

Medium (30-90 days):
  • Still relevant
  • May need updates
  • Monitor for staleness

Stale (90-180 days):
  • Review needed
  • Check accuracy
  • Possible merge candidate

Obsolete (> 180 days):
  • Deletion candidates
  • Archive prospects
  • Verify no valuable content
```

## Percolation Pattern

```
BEFORE:                              AFTER:

docs/
  README.md                          README.md
    [Outdated info]                    [✨ Updated with recent details]
                                       [References → recent-feature.md]
  
  recent-feature.md                  recent-feature.md
    [New important detail]             [Detail moved to README]
    [Valuable info]                    [Link: See README for overview]

  another-update.md                  another-update.md
    [Duplicate of above]               [❌ Merged into recent-feature.md]


FLOW:
  recent-feature.md  ──┐
                       ├─► README.md (promoted)
  another-update.md  ──┘
```

## Safe Mode: Dry Run vs Apply

```
┌─────────────────────────────────────────────────────┐
│  mode: "dryRun"                                     │
├─────────────────────────────────────────────────────┤
│  ✓ Analyze all documentation                        │
│  ✓ Create all reports and plans                     │
│  ✓ Identify what WOULD change                       │
│  ✗ NO files modified                                │
│  ✗ NO files deleted/archived                        │
│  ✗ NO cross-references updated                      │
│                                                      │
│  OUTPUT:                                            │
│    • doc-jiggle-analysis.md                         │
│    • doc-percolation-PLAN.md                        │
│    • doc-deletion-PLAN.md                           │
│    • doc-jiggle-summary.md                          │
│                                                      │
│  USE CASE: Safe analysis and planning               │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  mode: "apply"                                      │
├─────────────────────────────────────────────────────┤
│  ✓ Analyze all documentation                        │
│  ✓ Apply percolation changes                        │
│  ✓ Archive/delete obsolete docs                     │
│  ✓ Update cross-references                          │
│  ✓ Modify foundational docs                         │
│                                                      │
│  OUTPUT:                                            │
│    • doc-jiggle-analysis.md                         │
│    • doc-percolation-SUMMARY.md                     │
│    • doc-deletion-SUMMARY.md                        │
│    • doc-jiggle-summary.md                          │
│    • [Modified documentation files]                 │
│                                                      │
│  USE CASE: Actual documentation refresh             │
└─────────────────────────────────────────────────────┘
```

## Example Execution Sequence

### Step 1: Dry Run Analysis
```typescript
activity({
  activityId: 'jiggle-documentation-772b239e',
  variables: {
    scope: 'docs/',           // Limit to docs directory
    recentDays: 30,
    mode: 'dryRun'            // ← Safe mode!
  },
  reason: 'Analyze docs directory health'
})
```

**Output**: 
```
✅ doc-jiggle-analysis.md created
   • 47 docs analyzed
   • 12 recent, 18 medium, 10 stale, 7 obsolete
   • 3 duplicate pairs found

✅ doc-percolation-plan.md created
   • 8 details would be percolated to README.md
   • 2 details would go to ARCHITECTURE.md
   • 3 redundant recent docs would be merged

✅ doc-deletion-plan.md created
   • 5 docs would be archived (obsolete + no value)
   • 12 cross-references would be updated

✅ doc-jiggle-summary.md created
```

### Step 2: Review Plans
```bash
cat doc-percolation-plan.md
cat doc-deletion-plan.md
cat doc-jiggle-summary.md
```

### Step 3: Apply Changes
```typescript
activity({
  activityId: 'jiggle-documentation-772b239e',
  variables: {
    scope: 'docs/',
    mode: 'apply',            // ← Execute changes!
    archiveInsteadOfDelete: true  // ← Safe: archive, don't delete
  },
  reason: 'Apply planned documentation refresh'
})
```

**Result**:
```
✅ Changes applied
   • 8 details percolated to foundational docs
   • 3 docs consolidated
   • 5 docs archived to .archive/2026-02-06/
   • 12 cross-references updated
   • All reports generated
```

## Safety Features

```
┌──────────────────────────────────────────────────┐
│  Conservative Deletion Criteria                  │
├──────────────────────────────────────────────────┤
│  Will NOT delete:                                │
│    ✗ Foundational docs (README, CONTRIBUTING)   │
│    ✗ Referenced by other files                  │
│    ✗ Contains valuable percolatable content     │
│    ✗ Files < obsoleteDays threshold             │
│                                                  │
│  Will archive/delete ONLY if ALL true:          │
│    ✓ > obsoleteDays old (default 180)          │
│    ✓ Content clearly outdated/wrong            │
│    ✓ Not referenced anywhere                    │
│    ✓ Not a foundational document               │
│    ✓ Percolation step found no value           │
└──────────────────────────────────────────────────┘
```

## Integration with Git

```
Activity respects git history:

┌────────────────────────────────────────┐
│  git log -1 --format=%ct filename      │
│  → Gets last commit timestamp          │
│  → More accurate than filesystem mtime │
│  → Reflects actual content changes     │
└────────────────────────────────────────┘

For uncommitted files:
┌────────────────────────────────────────┐
│  stat -c %Y filename                   │
│  → Uses filesystem modified time       │
│  → Fallback for new/untracked files    │
└────────────────────────────────────────┘
```

## Use Cases

### 1. Repository Health Check
```typescript
// Quick assessment of documentation age
activity({
  activityId: 'jiggle-documentation-772b239e',
  variables: { mode: 'dryRun' },
  reason: 'Monthly documentation health check'
})
```

### 2. Pre-Release Documentation Refresh
```typescript
// Clean up docs before major release
activity({
  activityId: 'jiggle-documentation-772b239e',
  variables: {
    recentDays: 14,        // Shorter window for active release
    mode: 'apply',
    archiveInsteadOfDelete: true
  },
  reason: 'Refresh documentation for v2.0 release'
})
```

### 3. Subdirectory Focus
```typescript
// Target specific documentation area
activity({
  activityId: 'jiggle-documentation-772b239e',
  variables: {
    scope: 'docs/api/',    // Focus on API docs only
    obsoleteDays: 90,      // Shorter threshold for API docs
    mode: 'dryRun'
  },
  reason: 'Review API documentation currency'
})
```

---

**Created**: February 6, 2026  
**Activity ID**: `jiggle-documentation-772b239e`  
**Template Location**: `templates/custom/jiggle-documentation.json`
