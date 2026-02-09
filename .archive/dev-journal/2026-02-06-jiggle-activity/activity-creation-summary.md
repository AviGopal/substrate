# Documentation Jiggling Activity - Creation Summary

## ✅ Activity Template Created Successfully

**Activity ID**: `jiggle-documentation`  
**Category**: `refactor`  
**Version**: `1`

### Purpose
Systematically sort documentation by date updated, percolate later details backwards while deleting obsolete docs. This creates a "jiggling" effect where valuable recent content bubbles up to foundational documents while stale content settles out.

## Template Structure

### Tasks Defined (4 tasks)

1. **analyze-docs-by-date** (general agent)
   - Scans repository for markdown documentation
   - Collects metadata: path, last modified, size, title
   - Sorts by date and buckets: recent/medium/stale/obsolete
   - Creates analysis report

2. **percolate-content** (general agent)
   - Identifies foundational documents (README, guides, etc.)
   - Finds important details in recent documentation
   - Percolates valuable content backwards to foundational docs
   - Supports dryRun and apply modes

3. **delete-obsolete-docs** (general agent)
   - Reviews obsolete documentation candidates
   - Applies conservative deletion criteria
   - Supports archive mode (safer than deletion)
   - Updates cross-references

4. **create-jiggle-summary** (general agent)
   - Synthesizes results from all three phases
   - Provides metrics and recommendations
   - Creates comprehensive summary report

### Variables Supported

- `scope`: Documentation scope to analyze (default: "entire repo")
- `recentDays`: Days to consider doc "recent" (default: 30)
- `mediumDays`: Days for "medium age" (default: 90)
- `obsoleteDays`: Days for potential obsolescence (default: 180)
- `mode`: Execution mode - "dryRun" or "apply" (default: "dryRun")
- `archiveInsteadOfDelete`: Safety flag (default: true)

### Safety Features

- **Dry-run first**: Default mode is dryRun to preview changes
- **Archive mode**: Move obsolete docs to archive rather than delete
- **Conservative deletion**: Multiple criteria must be met
- **Cross-reference checking**: Verifies no broken links
- **Foundational doc protection**: Won't delete README, CONTRIBUTING, etc.

### Validation & Quality Gates

- JSON structure validation
- Required output files checking
- Pattern validation in reports
- Summary file verification

### Metabob Integration

- Learning mode enabled
- Context token budget: 4000
- Annotation strategy: key-components
- Captures feedback metrics for continuous improvement

## Template File

**Location**: `/home/avi/documents/work/exp-repo/metabob-devbob/jiggle-documentation.json`  
**Size**: 16,571 bytes  
**Format**: Valid JSON (verified with jq)

## Example Usage

### Safe Analysis (Dry Run)
```json
{
  "activityId": "jiggle-documentation",
  "variables": {
    "scope": "entire repo",
    "mode": "dryRun",
    "archiveInsteadOfDelete": true
  },
  "reason": "Analyze documentation health without making changes"
}
```

### Apply Changes
```json
{
  "activityId": "jiggle-documentation",
  "variables": {
    "scope": "docs/",
    "mode": "apply",
    "recentDays": 45,
    "archiveInsteadOfDelete": true
  },
  "reason": "Refresh docs/ directory with content percolation"
}
```

## Testing Status

✅ **Template JSON is valid** (verified with jq)  
✅ **Tasks are well-structured** with clear dependencies  
✅ **Variables have sensible defaults**  
✅ **Safety features implemented**  
⏳ **Registration pending** (requires Metabob backend access)  
⏳ **Execution test pending** (requires registration first)

## Next Steps

1. **Register with Metabob**: Use `opencode activity template register` when backend is available
2. **Execute dry-run**: Test analysis phase on real documentation
3. **Validate reports**: Check quality of generated analysis reports
4. **Apply mode test**: Try percolation and archiving in controlled environment
5. **Iterate based on feedback**: Use learning metrics to improve template

## Design Highlights

### Atomic Task Design
Each task has a single responsibility and can be validated independently.

### Composition Pattern
The activity can be composed with other activities like `commit-organized-changes`.

### Progressive Execution
Supports dry-run → apply workflow for safe iteration.

### Learning Integration
Captures metrics at each task to improve future executions through Metabob's learning system.

## Activity System Testing

This activity template creation demonstrates:
- ✅ Understanding of ActivityTemplate schema
- ✅ Proper task decomposition
- ✅ Variable system design
- ✅ Validation strategy
- ✅ Safety-first approach
- ✅ Metabob integration patterns
- ✅ Activity composition examples

The template is ready for registration and testing once Metabob backend is accessible.
