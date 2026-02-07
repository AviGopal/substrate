# Jiggle Documentation Activity

## Overview

Created a comprehensive activity template for systematically organizing and maintaining documentation by analyzing modification dates, percolating recent details backwards to foundational docs, and archiving obsolete content.

## Activity Template

**File:** `jiggle-documentation.json`  
**Category:** refactor  
**Version:** 1

### Purpose

Documentation tends to accumulate over time with newer docs containing updates that should be in older foundational docs, and obsolete content that should be archived. This activity "jiggle" (systematically sorts and consolidates) the documentation.

### Tasks

1. **analyze-docs-by-date**: Scan repository for markdown files, collect metadata (path, modified date, title), and categorize by age (recent/medium/stale/obsolete)

2. **percolate-content**: Move important details from recent docs backwards into older foundational docs (README, architecture docs, getting started guides)

3. **delete-obsolete-docs**: Remove or archive truly obsolete documentation after conservative review

4. **create-jiggle-summary**: Generate comprehensive summary report of what was analyzed, changed, and cleaned up

### Variables

- `scope` (string, default: "entire repo"): Scope of documentation to analyze
- `recentDays` (number, default: 30): Days to consider a doc "recent"
- `mediumDays` (number, default: 90): Days to consider a doc "medium age"
- `obsoleteDays` (number, default: 180): Days before a doc is potentially obsolete
- `mode` (string, default: "dryRun"): Execution mode - "dryRun" or "apply"
- `archiveInsteadOfDelete` (boolean, default: true): Move to .archive/ instead of deleting

### Example Usage

#### Dry Run (Safe Analysis)
```json
{
  "activityId": "jiggle-documentation",
  "variables": {
    "scope": "entire repo",
    "recentDays": 30,
    "mediumDays": 90,
    "obsoleteDays": 180,
    "mode": "dryRun",
    "archiveInsteadOfDelete": true
  },
  "reason": "Analyze documentation health and create action plan"
}
```

**Output**: 
- `doc-jiggle-analysis.md` - Sorted list of docs by age with obsolescence candidates
- `doc-percolation-plan.md` - Proposed content consolidation changes
- `doc-deletion-plan.md` - Files recommended for archival
- `doc-jiggle-summary.md` - Combined summary with recommendations

#### Apply Changes
```json
{
  "activityId": "jiggle-documentation",
  "variables": {
    "mode": "apply",
    "archiveInsteadOfDelete": true
  },
  "reason": "Refresh documentation by percolating content and archiving obsolete docs"
}
```

**Output**:
- Updated foundational documentation
- `.archive/` directory with obsolete docs
- `doc-jiggle-summary.md` - Summary of changes made

## Integration

### Composition

Can be combined with other activities:

```javascript
// Jiggle docs then commit changes
[
  { template: "jiggle-documentation", variables: { mode: "apply" } },
  { template: "commit-organized-changes", variables: { dryRun: false } }
]
```

### Context Requirements

- `documentationFiles`: List of markdown files with timestamps (2000-4000 tokens)
- `repoStructure`: Repository structure understanding (1000-2000 tokens, optional)

### Quality Gates

- Summary file must exist: `doc-jiggle-summary.md`
- Must contain keywords: "Analysis", "Percolation", "Cleanup"

## Learning Metrics

The template includes comprehensive learning feedback:

### Metrics Captured
- `docs_found`: Total documentation files discovered
- `obsolete_candidates`: Number of potentially obsolete docs
- `duplicates_found`: Number of duplicate docs detected
- `details_percolated`: Number of content pieces moved
- `docs_updated`: Number of foundational docs updated
- `docs_deleted`: Number of docs deleted/archived
- `references_updated`: Number of cross-references fixed

### Improvement Hints
- Date accuracy (1-10 scale)
- Categorization usefulness (1-10)
- Percolation logic quality (1-10)
- Target doc selection quality (1-10)
- Deletion safety (1-10)
- Criteria clarity (1-10)

### Success Patterns
- Agent analyzes git history for doc relevance context
- Agent checks cross-references before deletion
- Agent creates archive rather than deleting
- Agent updates table of contents after changes

### Failure Patterns to Avoid
- Deleting foundational docs (README, CONTRIBUTING)
- Not checking cross-references leads to broken links
- Over-aggressive deletion criteria
- Percolating too much content creates bloat

## Current Status

### ✅ Completed
1. **Template Design**: Full activity template created with 4 tasks, comprehensive variables, validation, and learning hooks
2. **File Created**: `jiggle-documentation.json` (16,571 bytes)
3. **Documentation**: Comprehensive documentation with examples
4. **Template Validation**: Structure follows activity template schema

### 🔄 In Progress - Registration
The template exists but needs to be registered in the activity execution system:

1. **Database**: SurrealDB is running with schema initialized
2. **Backend API**: Metabob RPC API is running on port 8080
3. **MCP Server**: Metabob MCP server is operational with 26 tools
4. **Bootstrap Activities**: 8 activities loaded (bug-fix-v1, feature-impl-v1, etc.)

### ⚠️ Blockers
- Activity discovery/registration pipeline needs debugging
- The `activity` tool can't find activities (even bootstrap ones)
- Template registration via CLI finds 0 templates
- Need to resolve the gap between local template files and activity execution system

## Files

- `jiggle-documentation.json` - Main activity template
- `templates/custom/jiggle-documentation.json` - Copy in custom templates directory
- `repos/metabob-proto/activities/bootstrap/jiggle-documentation.json` - Copy in bootstrap directory

## Next Steps

1. **Debug Activity Discovery**: Investigate why `search_activities` MCP tool isn't finding activities
2. **Register Template**: Use proper API endpoint or registration mechanism  
3. **Test Execution**: Run jiggle-documentation activity in dry-run mode
4. **Verify Learning**: Confirm metrics and feedback capture works
5. **Document Process**: Update activity registration documentation

## Technical Details

### Template Structure
- Uses new activity template format (not bootstrap variant format)
- Includes contextRequirements for intelligent context loading
- Has comprehensive validation rules per task
- Includes retry logic with configurable attempts
- Has hooks for pre/post activity lifecycle
- Enables Metabob integration for code quality
- Defines composition examples for reusability

### Subagent Coordination
All tasks use `general` subagent with:
- Detailed prompt templates with variables
- Max token budgets (6000-12000 per task)
- Compression strategies
- Impulse references for context passing
- Validation commands
- Retry strategies

### Safety Features
- Dry-run mode by default (prevents accidental changes)
- Archive instead of delete (prevents data loss)
- Conservative deletion criteria (multiple checks required)
- Cross-reference validation (prevents broken links)
- Git history analysis (understands relevance vs. staleness)
