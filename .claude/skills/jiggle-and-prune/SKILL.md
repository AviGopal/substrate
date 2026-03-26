# Jiggle and Prune Documentation Cleanup

Consolidate documentation by resolving conflicts between older and newer documents, favoring the latest understanding.

## Overview

This skill implements a two-phase documentation cleanup:

**Phase 1: Jiggle** - Sort docs by modification time (newest first), compare pairwise to identify conflicts, build conflict registry

**Phase 2: Prune** - In reverse order (oldest first), delete or merge conflicting content based on the conflict registry

## Input

**Required**: Scope - one of:
- `root` - Root-level markdown files (./\*.md)
- `docs` - The docs/ directory
- `<path>` - Specific directory path

**Optional**:
- `--dry-run` - Show what would be changed without making changes
- `--canonical <files>` - Comma-separated list of canonical files that should never be pruned (default: CLAUDE.md,README.md,docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md)

## Process

### Phase 1: Jiggle (Conflict Detection)

1. **List documents** sorted by modification date (newest first)
   ```bash
   find <scope> -maxdepth 1 -name "*.md" -type f | xargs ls -t
   ```

2. **Identify canonical documents**
   - Read each canonical file
   - Extract key concepts (section headers, defined terms, data structures)
   - These become the "truth" that older docs must align with

3. **Pairwise conflict detection**
   For each document (from newest to oldest):
   - Compare against all newer documents (including canonical)
   - Identify conflicts:
     - **Semantic conflict**: Same concept, different definition
     - **Structural conflict**: Same data structure, different fields
     - **Process conflict**: Same workflow, different steps
     - **Naming conflict**: Same thing, different names
   - Record in conflict registry:
     ```json
     {
       "file": "OLD_DOC.md",
       "conflicts_with": "NEWER_DOC.md",
       "type": "semantic",
       "description": "Defines 'impulse' differently",
       "resolution": "delete|merge|archive"
     }
     ```

4. **Categorize documents**
   - **Keep**: No conflicts, or is canonical
   - **Merge**: Has valuable unique content but also conflicts
   - **Archive**: Historical value but conflicts with current understanding
   - **Delete**: No unique value, conflicts with current

### Phase 2: Prune (Conflict Resolution)

1. **Process conflict registry** (oldest first = reverse of Phase 1 order)

2. **For each conflict**:
   - **Delete**: Remove file entirely
   - **Archive**: Move to `docs/archive/YYYY-MM-DD/`
   - **Merge**: Extract unique valuable content into canonical doc, then archive

3. **Update cross-references**
   - Find links to deleted/archived docs
   - Update to point to canonical docs

4. **Generate summary**
   - List of documents kept
   - List of documents archived/deleted
   - Graph of document relationships

## Conflict Detection Heuristics

### Semantic Conflicts
- Same term defined differently
- Same concept explained with contradictory properties
- Example: "Impulses are instructions" vs "Impulses are data pointers"

### Structural Conflicts
- Same interface with different fields
- Same API with different endpoints
- Example: `ActivityTemplate` with vs without `inputSchema`

### Process Conflicts
- Same workflow with different steps
- Same goal with different approaches
- Example: Different deployment procedures

### Staleness Indicators
Documents are likely stale if they:
- Reference removed/renamed code paths
- Describe "planned" features that now exist differently
- Use terminology that's been superseded
- Contain TODOs that are resolved or abandoned

## Output

### During Execution
```
## Phase 1: Jiggle (Conflict Detection)

Canonical documents:
- CLAUDE.md (28KB, 2026-03-26)
- docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md (18KB, 2026-03-26)

Analyzing 1113 documents...

Conflicts found:
- ACTIVITY_CREATION_QUICK_START.md conflicts with CLAUDE.md
  Type: process (describes outdated activity creation workflow)
  Resolution: archive

- VESSEL_ARCHITECTURE_CORRECTED.md conflicts with IMPULSE_ACTIVITY_FOUNDATION.md
  Type: superseded (merged into foundation doc)
  Resolution: delete

[... more conflicts ...]

Summary:
- 42 documents: keep
- 156 documents: archive
- 847 documents: delete
- 68 documents: merge then archive
```

### After Completion
```
## Phase 2: Prune Complete

Kept: 42 documents
Archived: 224 documents (to docs/archive/2026-03-26/)
Deleted: 847 documents
Cross-references updated: 15

Final document structure:
- CLAUDE.md (canonical project guide)
- README.md (project overview)
- DEPLOYMENT_GUIDE.md (how to deploy)
- docs/
  - architecture/
    - IMPULSE_ACTIVITY_FOUNDATION.md (canonical architecture)
  - guides/
    - RBAC_GUIDE.md
    - MULTI_TENANT_ARCHITECTURE.md
  - archive/
    - 2026-03-26/
      - [224 archived documents]
```

## Guardrails

- **Never delete canonical documents**
- **Always archive before delete** (unless --force-delete)
- **Require confirmation** before deleting >10 documents
- **Preserve git history** (don't rewrite, just delete)
- **Create backup** before bulk operations
- **Pause on uncertainty** - if conflict type is unclear, ask

## Example Invocations

```bash
# Dry run on root docs
/jiggle-and-prune root --dry-run

# Full cleanup of root docs
/jiggle-and-prune root

# Clean docs/ directory with extra canonical file
/jiggle-and-prune docs --canonical CLAUDE.md,DEPLOYMENT_GUIDE.md

# Clean specific subdirectory
/jiggle-and-prune docs/architecture
```

## Implementation Notes

This skill is designed to be run interactively with human oversight. It will:

1. Show the conflict analysis and ask for confirmation before Phase 2
2. Process deletions in batches of 20, pausing to show progress
3. Create a rollback script in case of errors
4. Generate a final report for review

The goal is to reduce documentation sprawl while preserving institutional knowledge in a smaller, more coherent set of documents.
