# Documentation Coherence Update - Decision Analysis

## Executive Summary

**Decision Type:** COMPOSE (Multi-phase Sequential Approach)

**Goal:** Update documentation in `/home/avi/documents/work/exp-repo/metabob-devbob/docs` to reduce incoherence with recent code changes, operating in DRY-RUN mode first with user confirmation gates.

---

## Reasoning

This task is **complex and non-trivial**, requiring:

- ✓ Multiple sequential phases with dependencies
- ✓ Repository-wide git history analysis across 30+ sub-repos
- ✓ Documentation inventory with metadata (mtime, cross-references)
- ✓ Semantic comparison and coherence classification
- ✓ User confirmation gates before destructive operations
- ✓ DRY-RUN analysis before execution
- ✓ Audit trails and comprehensive reporting
- ✓ Protected file safeguards

These characteristics make it unsuitable for direct one-off tool execution and ideal for composition into reusable sub-goals.

---

## Composition Structure

### Phase 1: SEARCH - Repository Analysis via Git

**Goal:** Poll recent git changes across all sub-repos to build a canonical list of modified concepts, schemas, endpoints, environment variables, and file paths.

**Operations:**
1. List all subdirectories in `repos/`
2. For each repo: `git log --since='2 weeks ago' --stat`
3. Collect uncommitted changes: `git status` and `git diff`
4. Extract and categorize changes by type
5. Build canonical modification list

**Output:** Changed concepts inventory with categorization

---

### Phase 2: SORT - Documentation Inventory & Classification

**Goal:** Inventory all documentation files, compare against canonical docs and Phase 1 findings, and classify each doc as keep/merge/archive/delete based on coherence analysis.

**Operations:**
1. List all files in `docs/` with metadata (mtime, size)
2. Sort by modification time (newest first)
3. For each doc: compare against canonical docs (CLAUDE.md, README.md, IMPULSE_ACTIVITY_FOUNDATION.md)
4. Cross-reference against Phase 1 changes
5. Classify with coherence rationale

**Output:** Classification matrix with keep/merge/archive/delete decisions

---

### Phase 3: UPDATE - Staged Application with Confirmation

**Goal:** Apply changes in staged manner - DRY-RUN first for user review, then execute archival and updates in reverse chronological order.

**Operations:**
1. Generate DRY-RUN report showing all planned changes (no execution)
2. Present to user for review and approval
3. Upon approval: process docs in reverse mtime order (oldest first)
4. Create archive directory: `docs/archive/2026-04-22/`
5. Move archived docs to archive
6. Update cross-references in remaining docs
7. Enforce protection: **Never delete** CLAUDE.md, README.md, IMPULSE_ACTIVITY_FOUNDATION.md
8. **PAUSE before any bulk delete >10 files**

**Output:** Executed changes with audit trail and confirmations

---

### Phase 4: REPORT - Comprehensive Reporting

**Goal:** Generate complete documentation of the entire search-sort-update process, findings, changes applied, and remaining decisions.

**Operations:**
1. Document SEARCH process and findings
2. Explain SORT classification methodology
3. List all UPDATE changes applied with timestamps
4. Provide: kept docs, archived docs, deleted docs, updated cross-references
5. Identify remaining manual decisions and recommendations

**Output:** Comprehensive audit report in markdown format

---

## Execution Variables

| Variable | Value |
|----------|-------|
| repoBasePath | `/home/avi/documents/work/exp-repo/metabob-devbob` |
| docsPath | `/home/avi/documents/work/exp-repo/metabob-devbob/docs` |
| reposPath | `/home/avi/documents/work/exp-repo/metabob-devbob/repos` |
| archivePath | `/home/avi/documents/work/exp-repo/metabob-devbob/docs/archive/2026-04-22` |
| dryRun | `true` (CRITICAL - no changes until user confirms) |
| gitLogTimeframe | `2 weeks ago` |
| bulkDeleteThreshold | `10` (pause before >10 file deletion) |

### Protected Documents (Never Delete)
- CLAUDE.md
- README.md
- docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md

---

## Next Steps

1. **Review** DECISION_OUTPUT.json for detailed execution strategy
2. **Confirm** approval to proceed with Phase 1 (SEARCH)
3. **Review** Phase 2 classification results before proceeding
4. **Review** DRY-RUN report before Phase 3 execution
5. **Give final approval** before any destructive changes
6. **Review** final Phase 4 report

---

## Safeguards

✓ DRY-RUN mode enabled - no changes without user confirmation
✓ Protected files cannot be deleted
✓ Bulk deletion threshold (>10 files) requires pause and approval
✓ Archive structure preserves outdated docs for reference
✓ Cross-references updated automatically
✓ Comprehensive audit trail of all operations
✓ Reusable methodology for future documentation maintenance

---

## Metadata

- **Created:** 2026-04-22
- **Decision Type:** COMPOSE
- **Sub-Goals:** 4 (SEARCH, SORT, UPDATE, REPORT)
- **Status:** Ready for Phase 1 execution upon user approval
