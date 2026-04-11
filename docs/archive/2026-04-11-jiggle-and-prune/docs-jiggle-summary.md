# Documentation Conflict Analysis - Phase 1: Jiggle

**Date**: 2026-04-10
**Scope**: metabob-devbob repository documentation
**Total Files Analyzed**: 4,955 markdown files

---

## Executive Summary

The metabob-devbob repository contains **4,955 markdown files** across the codebase. After systematic analysis with strategic sampling, we identified **55 conflicts** requiring resolution, primarily in root-level status reports and session summaries from recent development work (Apr 8-9, 2026).

**Key Finding**: The documentation structure is largely well-organized with 1,854 files already properly archived. The conflicts are concentrated in **62 root-level files**, most of which are recent session outputs that document completed work.

### Breakdown
- **Canonical Files**: 3 (preserved)
- **Already Archived**: 1,854 files in `docs/archive/`
- **Active Documentation**: 69 files in `docs/` (architecture, guides, testing, RBAC)
- **Root-Level Files**: 62 files (primary conflict zone)
- **Other Repositories**: ~2,970 files in `repos/` subdirectories (out of scope)

---

## Canonical Documents (Never Prune)

These three documents form the foundation of the system. All other documentation derives from or supports these:

1. **CLAUDE.md** (35KB)
   - Project guidance for Claude Code
   - Development philosophy: "MiniBob First, Canary Always"
   - Complete workflows, configuration, and operations reference

2. **README.md** (5.8KB)
   - Project overview and quick start
   - High-level architecture concepts
   - Entry point for new contributors

3. **docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md** (24KB)
   - **THE canonical system definition**
   - All other architecture docs must align with this
   - Core model: Impulses, Activities, Vessels, Resolvers, Learning

---

## Conflict Categories

### 1. Semantic Conflicts (2 files)
Different definitions of core terms (impulse, activity, vessel, authentication).

**Examples:**
- `IDENTITY_CONSOLIDATION_SUMMARY.md` - References deprecated `instance_id` authentication
- Resolution: Archive as historical reference for pre-migration auth flow

### 2. Structural Conflicts (2 files)
Different data structures or patterns that may contradict canonical versions.

**Examples:**
- `ACTIVITY_BASED_IMPROVISATION.md` - VM-as-executor philosophy (may need alignment review)
- `MINIBOB_RESOLVERS_SHAPES_SANDBOX.md` - Technical exploration of resolvers
- Resolution: Keep both, but flag for alignment review against IMPULSE_ACTIVITY_FOUNDATION.md

### 3. Process Conflicts (6 files)
Different workflows that contradict current best practices.

**Examples:**
- `GAP2_SUMMARY.md` - Recommends local K8s instead of canary-first
- `IMPLEMENTATION_REPORT_GAP2_EXECUTION_FEEDBACK.md` - Local K8s workflow documentation
- `LOCAL_DASHBOARD_DEV_SETUP.md` - May conflict with canary-first philosophy
- Resolution: Archive historical, merge/update active docs

### 4. Stale Documents (39 files)
References to resolved issues, completed features, or deprecated patterns.

**Examples:**
- Session summaries from Apr 9 (API key migration, signup fix, template migration)
- Test output reports (superseded by passing CI/CD)
- Status snapshots (deployment, database, CI/CD)
- Resolution: Archive for historical value, delete redundant test outputs

### 5. No Conflict (6 files)
Active documentation that aligns with canonical docs.

**Examples:**
- `COMPOSITION_AND_CONTROL_FLOW.md` - Referenced in CLAUDE.md as complementary
- `TEACHING_AND_FEEDBACK_GUIDE.md` - Active methodology guide
- `USING_REGISTERED_ACTIVITIES.md` - Active user documentation
- Resolution: Keep unchanged

---

## Resolution Summary

| Resolution | Count | Description |
|------------|-------|-------------|
| **Keep** | 13 | Active guides, reference docs, complementary architecture |
| **Archive** | 27 | Session summaries, status reports, migration records |
| **Delete** | 12 | Redundant test outputs, TODO lists, superseded snapshots |
| **Merge** | 3 | Extract unique content to canonical docs, then remove |

---

## Detailed Resolutions

### Keep (13 files)

These files provide active value and align with canonical documentation:

**Architecture:**
- `ACTIVITY_BASED_IMPROVISATION.md` (with alignment review flag)
- `COMPOSITION_AND_CONTROL_FLOW.md` (referenced in CLAUDE.md)
- `VESSEL_TAG_STRATEGY.md`

**Guides:**
- `TEACHING_AND_FEEDBACK_GUIDE.md` - Teaching methodology
- `MINIBOB_CLI_USAGE.md` - CLI reference
- `PRODUCTION_SUBMISSION_GUIDE.md` - Operational procedures
- `PROGRESSIVE_TEMPLATE_VALIDATION.md` - Validation patterns
- `PRE_COMMIT_WORKFLOW.md` - Git workflow
- `USING_REGISTERED_ACTIVITIES.md` - User guide
- `TERMINAL_COMPLETE_GUIDE.md` - Terminal reference
- `QUICK_REFERENCE_TEACHING.md` - Compact teaching guide

**Technical:**
- `MINIBOB_RESOLVERS_SHAPES_SANDBOX.md` (with alignment review flag)

### Archive (27 files)

These document completed work and have historical value:

**Create archive structure:**
```
docs/archive/2026-04-10/
├── api-key-migration/
│   ├── API_KEY_MIGRATION_STATUS.md
│   ├── API_KEY_MIGRATION_COMPLETE_SUMMARY.md
│   ├── API_KEY_FORMAT_MIGRATION.md
│   └── KEY_MANAGEMENT_MIGRATION_PLAN.md
├── sessions/
│   └── SESSION_SUMMARY.md
├── database-audits/
│   ├── CANARY_DATABASE_AUDIT.md
│   └── CANARY_DATABASE_STATE_2026-04-09.md
├── cicd/
│   ├── CICD_ALIGNMENT_REPORT.md
│   └── CI_CD_EVALUATION_REPORT.md
├── troubleshooting/
│   ├── CICD_TAG_MISMATCH_ANALYSIS.md
│   └── DEPLOYMENT_FAILURE_ANALYSIS.md
├── dashboard/
│   ├── CLOUD_DASHBOARD_AUDIT.md
│   └── DASHBOARD_FEATURE_EXPLORATION.md
├── demonstrations/
│   ├── ACTIVITY_USAGE_DEMONSTRATION.md
│   └── COMPLETE_ACTIVITY_DEMO.md
├── gap-analysis/
│   ├── GAP2_SUMMARY.md
│   └── IMPLEMENTATION_REPORT_GAP2_EXECUTION_FEEDBACK.md
├── signup-fix/
│   └── SIGNUP_FIX_COMPLETE.md
├── teaching-sessions/
│   ├── TEACHING_MINIBOB_DASHBOARD_DEVELOPMENT.md
│   ├── TEACHING_MINIBOB_REACT.md
│   └── TEACHING_MINIBOB_SUMMARY.md
├── activity-catalogs/
│   └── REACT_ACTIVITIES_INDEX.md
├── schema-changes/
│   └── SCHEMA_ALIGNMENT_DOCUMENTATION.md
├── research/
│   └── SURREALDB_ALTER_TABLE_RESEARCH.md
├── template-migration/
│   └── TEMPLATE_MIGRATION_AND_REGISTRATION_SUMMARY.md
├── code-style/
│   └── CAMELCASE_ENFORCEMENT_CHANGES.md
└── deprecated-auth/
    └── IDENTITY_CONSOLIDATION_SUMMARY.md
```

### Delete (12 files)

These provide no unique value (redundant test outputs, superseded snapshots):

**Test Outputs:**
- `API_KEY_TEST_RESULTS.md` - Test output, superseded by passing CI/CD
- `CLOUD_DASHBOARD_COMPREHENSIVE_TEST_REPORT.md` - Redundant test output
- `CLOUD_DASHBOARD_DEPLOYMENT_TEST_REPORT.md` - Historical test run
- `CLOUD_DASHBOARD_TESTING_REPORT.md` - Redundant test output
- `TEST_SUMMARY.md` - Historical test output
- `TUTOR_SEARCH_ALIGNMENT_VERIFIED.md` - Validation checkpoint

**Status Snapshots:**
- `CICD_STATUS_REPORT.md` - Superseded by current CI/CD state
- `DEPLOYMENT_STATUS_REPORT.md` - Superseded by current deployment state

**TODO Lists:**
- `ACTIVITY_API_FIX_PLAN.md` - TODO list for completed work
- `SIGNUP_DEBUGGING_STATUS.md` - In-progress debugging notes
- `SIGNUP_DEBUG_NEXT_STEPS.md` - TODO list for completed work
- `REDEPLOYMENT_PLAN.md` - Event-specific TODO list

**Security Risk:**
- `CANARY_TEST_KEYS.md` - Test API keys (should be in secrets, not docs)
  - **Action**: Verify keys are rotated before deletion

### Merge (3 files)

Extract unique content to canonical docs, then delete:

1. **CANARY_SETUP_GUIDE.md** → **CLAUDE.md**
   - Check for unique troubleshooting tips not in CLAUDE.md CI/CD Pipeline section
   - CLAUDE.md already has comprehensive canary deployment documentation

2. **CONTAINER_UPDATE_CHECKLIST.md** → **docs/operations/CONTAINER_UPDATES.md** (create if needed)
   - Extract operational checklist if not already documented
   - Formalize as operations guide

3. **LOCAL_DASHBOARD_DEV_SETUP.md** → **CLAUDE.md**
   - Review against CLAUDE.md "Local Kubernetes (Advanced)" section
   - Ensure consistency with canary-first philosophy
   - Extract any missing local dev details

---

## Active Documentation Inventory

### Root Level (Keep)
- `CLAUDE.md` ✅ Canonical
- `README.md` ✅ Canonical
- `ACTIVITY_BASED_IMPROVISATION.md` - Architecture (review flag)
- `COMPOSITION_AND_CONTROL_FLOW.md` - Architecture (complementary)
- `VESSEL_TAG_STRATEGY.md` - Infrastructure strategy
- `TEACHING_AND_FEEDBACK_GUIDE.md` - Methodology
- `MINIBOB_CLI_USAGE.md` - Reference
- `PRODUCTION_SUBMISSION_GUIDE.md` - Operations
- `PROGRESSIVE_TEMPLATE_VALIDATION.md` - Patterns
- `PRE_COMMIT_WORKFLOW.md` - Git workflow
- `USING_REGISTERED_ACTIVITIES.md` - User guide
- `TERMINAL_COMPLETE_GUIDE.md` - Reference
- `QUICK_REFERENCE_TEACHING.md` - Compact guide
- `MINIBOB_RESOLVERS_SHAPES_SANDBOX.md` - Technical (review flag)

### docs/ (69 active files)

**docs/ root (21 files):**
- `MULTI_TENANT_ARCHITECTURE.md` ✅ Referenced in CLAUDE.md
- `RBAC_GUIDE.md` ✅ Referenced in CLAUDE.md
- `AUTH_JWT_CLAIMS.md` ✅ Referenced in CLAUDE.md
- `SCHEMA_OWNERSHIP.md` ✅ Referenced in CLAUDE.md
- `RBAC_TROUBLESHOOTING.md`
- `ROLLBACK_RUNBOOK.md`
- `MIGRATION_FROM_ANONYMOUS_TO_RBAC.md`
- Plus 14 others (API key, validation, implementation docs)

**docs/architecture/ (31 files):**
- `IMPULSE_ACTIVITY_FOUNDATION.md` ✅ Canonical
- `CODE_UNDERSTANDING_VESSEL_DESIGN.md`
- `CROSS_DOMAIN_LEARNING_PATTERNS.md`
- `GOAL_AWARE_RECOMMENDATION.md`
- `IMPULSE_DRIVEN_TUI.md`
- `HYPOTHESIS_DRIVEN_UNDERSTANDING.md`
- Plus 25+ vessel, impulse, and architecture docs

**docs/guides/ (7 files)**
**docs/testing/ (6 files)**
**docs/troubleshooting/ (1 file)**
**docs/demos/ (1 file)**
**docs/alignment/ (1 file)**

### docs/archive/ (1,854 files)

Already properly archived in dated directories:
- `2026-03-26/` - Large archive with multiple subdirectories
- `2026-03-27-superseded/` - Superseded design documents
- `2026-04-04/` - April 4 archive

**Note**: CLAUDE.md documents this structure:
> **Archived docs** (superseded by foundation doc):
> - `docs/archive/2026-03-27-superseded/`: Historical design documents

---

## Follow-Up Actions

### Immediate (Phase 1 Cleanup)

1. **Create archive directories** (5 min)
   ```bash
   mkdir -p docs/archive/2026-04-10/{api-key-migration,sessions,database-audits,cicd,troubleshooting,dashboard,demonstrations,gap-analysis,signup-fix,teaching-sessions,activity-catalogs,schema-changes,research,template-migration,code-style,deprecated-auth}
   ```

2. **Archive 27 files** (10 min)
   ```bash
   # See detailed archive structure above
   mv API_KEY_MIGRATION_STATUS.md docs/archive/2026-04-10/api-key-migration/
   # ... (repeat for all 27 files)
   ```

3. **Delete 12 files** (5 min)
   ```bash
   # Verify test keys rotated first
   rm API_KEY_TEST_RESULTS.md
   rm CLOUD_DASHBOARD_COMPREHENSIVE_TEST_REPORT.md
   # ... (repeat for all 12 files)
   ```

4. **Review merge candidates** (30 min)
   - Extract unique content from 3 files
   - Update canonical docs
   - Delete originals

### Alignment Reviews (Phase 2)

Three files flagged for alignment review against canonical docs:

1. **ACTIVITY_BASED_IMPROVISATION.md**
   - Compare VM-as-executor philosophy with IMPULSE_ACTIVITY_FOUNDATION.md
   - Check if improvisation patterns align with current resolver/vessel design
   - Update or clarify if drift detected

2. **MINIBOB_RESOLVERS_SHAPES_SANDBOX.md**
   - Verify resolver patterns match IMPULSE_ACTIVITY_FOUNDATION.md
   - Check if sandbox exploration led to implemented patterns
   - Update references to reflect current implementation

3. **LOCAL_DASHBOARD_DEV_SETUP.md** (merge candidate)
   - Ensure consistency with CLAUDE.md "Canary First" philosophy
   - Extract local dev details not in CLAUDE.md
   - Remove after merge

### Documentation Maintenance (Ongoing)

**Guidelines established:**
- Session summaries → Archive in dated directories
- Test outputs → Delete (superseded by CI/CD)
- Status snapshots → Delete or archive (low value)
- Migration records → Archive for historical reference
- Architecture explorations → Keep if unique value, flag for alignment review
- Guides and references → Keep and maintain

**Archive naming convention:**
- Format: `docs/archive/YYYY-MM-DD/category/`
- Categories: sessions, troubleshooting, migrations, research, demonstrations, etc.
- Consistent with existing pattern (2026-03-26, 2026-03-27-superseded, 2026-04-04)

---

## Conflict Patterns Detected

### Pattern 1: Session Summaries
**Trigger**: Daily development work generates status/summary files
**Location**: Root level
**Resolution**: Archive to `docs/archive/YYYY-MM-DD/sessions/`
**Prevention**: Consider automated archiving after 7 days

### Pattern 2: Test Outputs
**Trigger**: Manual test runs generate reports
**Location**: Root level
**Resolution**: Delete (CI/CD provides authoritative test results)
**Prevention**: Discourage manual test report commits

### Pattern 3: Deprecated Auth References
**Trigger**: API key migration deprecates `instance_id` auth
**Location**: Various (summaries, consolidation docs)
**Resolution**: Archive as historical reference
**Prevention**: Update canonical docs when deprecating patterns

### Pattern 4: Local K8s vs Canary
**Trigger**: Evolution from local-first to canary-first development
**Location**: Gap analysis, implementation reports
**Resolution**: Archive old approach, ensure CLAUDE.md reflects current best practice
**Prevention**: Single source of truth for deployment workflow in CLAUDE.md

---

## Statistics

### By Age
- **0 days old (Apr 10)**: 18 files - Mostly session outputs
- **1 day old (Apr 9)**: 24 files - Status reports, testing, teaching
- **8-12 days old (Apr 2-8)**: 8 files - Guides and references (keep)
- **Older**: Mostly already archived

### By Size
- **Small (< 5KB)**: 15 files - Often TODO lists or snapshots (delete candidates)
- **Medium (5-15KB)**: 31 files - Mix of summaries and guides
- **Large (> 15KB)**: 16 files - Comprehensive reports and architecture docs

### By Type
- **Status/Report/Summary**: 29 files (archive or delete)
- **Guide/Reference**: 13 files (keep)
- **Architecture**: 3 files (keep with review flags)
- **Test Output**: 6 files (delete)
- **TODO/Plan**: 4 files (delete)

---

## Recommendations

### Priority 1: Immediate Cleanup
Complete Phase 1 cleanup (archive 27, delete 12, merge 3) to reduce root-level clutter and establish clear documentation structure.

**Impact**: Reduces root-level markdown files from 62 to ~16 active documents, making navigation and maintenance significantly easier.

### Priority 2: Alignment Reviews
Review the 3 flagged files for alignment with IMPULSE_ACTIVITY_FOUNDATION.md. These are valuable architecture documents that may need updates to reflect current patterns.

**Impact**: Ensures architecture documentation remains consistent and accurate.

### Priority 3: Documentation Workflow
Establish conventions for session outputs:
- Session summaries → `docs/archive/YYYY-MM-DD/sessions/`
- Migration records → `docs/archive/YYYY-MM-DD/{migration-name}/`
- Test outputs → Don't commit (CI/CD is source of truth)

**Impact**: Prevents future documentation sprawl.

### Priority 4: Canonical Doc Maintenance
Ensure CLAUDE.md, README.md, and IMPULSE_ACTIVITY_FOUNDATION.md remain the single source of truth. When adding significant documentation, either:
1. Add to canonical docs directly
2. Create complementary doc and reference it in CLAUDE.md
3. Archive as historical if exploratory/temporary

**Impact**: Maintains clear documentation hierarchy.

---

## Phase 2 Considerations

This analysis focused on **Phase 1: Jiggle (Conflict Detection)** for root-level and docs/ files. Future phases could address:

### Phase 2: Deep Archive Analysis
- Analyze 1,854 archived files for redundancy
- Identify candidates for deletion from archive
- Compress or consolidate very old archives

### Phase 3: Repository Documentation
- Analyze ~2,970 files in `repos/` subdirectories
- Each repository may have its own documentation standards
- Focus on overlap/conflicts with root-level canonical docs

### Phase 4: Automated Maintenance
- Git hooks to prevent committing test outputs
- Automated archiving of dated session summaries
- CI checks for documentation conflicts

---

## Conclusion

The metabob-devbob repository has a **well-structured documentation foundation** with clear canonical documents (CLAUDE.md, README.md, IMPULSE_ACTIVITY_FOUNDATION.md) and an established archiving pattern.

**The primary issue** is not fundamental conflicts but rather **natural accumulation** of session outputs and status reports from active development work (Apr 8-10). These 27 files have historical value and should be archived, not deleted.

**Recommended action**: Execute Phase 1 cleanup (archive 27, delete 12, merge 3) to restore clarity to the root-level documentation while preserving historical value in the established archive structure.

The analysis identified **no critical conflicts** that would prevent system understanding or development. The 3 files flagged for alignment review are precautionary - they appear valuable but may benefit from updates to reflect current architectural patterns documented in IMPULSE_ACTIVITY_FOUNDATION.md.

---

## Appendix: Analysis Methodology

### Scope
- **Total files**: 4,955 markdown files
- **Canonical files**: 3 (CLAUDE.md, README.md, IMPULSE_ACTIVITY_FOUNDATION.md)
- **Focus areas**: Root-level (62 files), docs/ (69 active + 1,854 archived)
- **Out of scope**: repos/ subdirectories (~2,970 files - separate repository documentation)

### Approach
1. **Extract canonical concepts** - Key terms, data structures, workflows from foundation docs
2. **Categorize files** - By pattern (status/report, guide, architecture, test, etc.)
3. **Conflict detection** - Semantic, structural, process, staleness indicators
4. **Strategic sampling** - Full scan of root and docs/, statistical analysis of archive
5. **Resolution classification** - Keep, archive, delete, merge with rationale

### Limitations
- **Time-bounded analysis** - Focused on high-impact conflicts, not exhaustive line-by-line review
- **Pattern-based detection** - Used file patterns and sampling, not full content analysis of all 4,955 files
- **Repository scope** - Did not analyze repos/ subdirectories in detail
- **No code analysis** - Documentation conflicts only, not code implementation alignment

### Tools Used
- Bash scripts for file categorization and metadata extraction
- Text pattern matching for conflict indicators
- Manual sampling of representative files from each category
- JSON registry generation for programmatic processing

---

**Generated**: 2026-04-10
**Analyzer**: Claude Sonnet 4.5
**Output**: docs-jiggle-analysis.json, docs-jiggle-summary.md
