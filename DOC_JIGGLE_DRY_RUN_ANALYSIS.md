# Documentation Jiggle - Dry Run Analysis
**Generated**: 2026-02-08  
**Mode**: DRY RUN (no changes will be made)  
**Scope**: Entire repository

---

## Executive Summary

**Total Documentation Files**: 695 markdown files  
**Root-Level Files**: 216 (EXCESSIVE - major cleanup needed)

### Age Distribution
- **Recent (0-30 days)**: 656 files (94.4%)
- **Medium (31-90 days)**: 4 files (0.6%)
- **Stale (91-180 days)**: 31 files (4.5%)
- **Obsolete (>180 days)**: 4 files (0.6%)

### Key Findings

1. **Documentation Explosion**: The repository has experienced significant documentation growth, with 656 files modified in the last 30 days
2. **Root Directory Clutter**: 216 markdown files at root level indicates lack of organization
3. **Temporary Session Files**: Many files appear to be session summaries, task logs, and status reports that should be archived
4. **Missing Main README**: No README.md in root - README_ARCHITECTURE_DOCS.md appears to serve this role

---

## Category 1: Foundational Documents (KEEP & UPDATE)

These are the core documents that should remain at root and be kept up-to-date:

### Primary Entry Points
- **DOCUMENTATION_INDEX.md** ✅ (exists, last updated 2026-02-08)
  - Central navigation hub for all documentation
  - Should reference all major documents below

- **README_ARCHITECTURE_DOCS.md** ✅ (exists, 13,506 bytes)
  - Primary architecture overview
  - **RECOMMENDATION**: Rename to README.md for standard convention

### Quick Start Guides (Should exist at root or in /docs)
- **QUICK_START_V2_API.md** ✅
- **QUICK_START_DASHBOARD.md** ✅
- **DOC_ALIGNMENT_QUICK_START.md** ✅
- **BREADCRUMB_QUICK_START.md** ✅
- **NEXT_SESSION_QUICK_START.md** ✅

### Architecture Documentation (Should be in /docs/architecture/)
- **CORRECT_ARCHITECTURE_DESIGN.md**
- **ARCHITECTURE_EVOLUTION_SUMMARY.md**
- **EXECUTION_ENVIRONMENT_ARCHITECTURE.md**
- **METABOB_DATAFLOW_ARCHITECTURE.md**

### Sub-Project READMEs (Correctly located)
- ✅ **repos/metabob-cli/README.md**
- ✅ **repos/metabob-opencode/README.md**
- ✅ **repos/metabob-opencode/packages/opencode/README.md** (Activity Templates)

---

## Category 2: Session/Status Files (ARCHIVE IMMEDIATELY)

These are temporary status reports and session logs that served their purpose:

### Session Summaries (Move to .archive/sessions/2026-02/)
- SESSION_SUMMARY_ACTIVITY_TESTING.md
- SESSION_SUMMARY_FEB_8_2026.md
- SESSION_COMPLETE_FINAL_STATUS.md
- SESSION_COMPLETE_ACTIVITY_TESTING.md
- FINAL_SESSION_REPORT.md
- FINAL_SESSION_SUMMARY.md

### Status Reports (Move to .archive/status-reports/2026-02/)
- CURRENT_STATUS_SUMMARY.md
- SETUP_COMPLETE_READY_TO_EXECUTE.md
- PROJECT_COMPLETE_V2_API_CLEANUP.md
- VALIDATION_COMPLETE.md
- FINAL_VALIDATION_COMPLETE.md
- COMPLETE_FLOW_VALIDATION_SUCCESS.md
- V2_API_PROTO_COMPLIANCE_COMPLETE.md
- V2_ACTIVITIES_PROTO_COMPLIANCE_COMPLETE.md
- V2_SESSION_PROTO_COMPLIANCE_COMPLETE.md
- PROTO_COMPLIANCE_IMPLEMENTATION_COMPLETE.md
- METABOB_CLI_V2_MIGRATION_COMPLETE.md
- CLI_V2_MIGRATION_COMPLETE.md
- V2_MIGRATION_FINAL_SUMMARY.md
- MIGRATION_SUMMARY.md
- V2_SESSION_API_COMPLETE.md

### Task Logs (Move to .archive/task-logs/2026-02/)
- TASK_PHASE1_TASK1_LOG.md
- TASK_PHASE1_TASK2_LOG.md
- TASK_PHASE1_TASK3_LOG.md
- TASK_PHASE1_TASK4_LOG.md
- TASK_LOG_TEMPLATE.md
- TASK_BREAKDOWN_PHASE1.md

### Test Reports (Move to .archive/test-reports/2026-02/)
- ACTIVITY_DATA_FLOW_TEST_REPORT.md
- ACTIVITY_SYSTEM_TEST_FINAL_REPORT.md
- ACTIVITY_SYSTEM_TEST_SUMMARY.md
- ACTIVITY_TEST_SUMMARY.md
- COMPREHENSIVE_TEST_REPORT.md
- V2_ENDPOINT_TEST_RESULTS_AND_FIXES.md
- V2_ENDPOINT_TEST_PLAN.md

### Implementation Summaries (Move to .archive/implementation-logs/2026-02/)
- IMPLEMENTATION_SUMMARY.md
- IMPLEMENTATION_PROGRESS.md
- INCREMENTAL_PROGRESS_REPORT.md
- doc-jiggle-implementation-summary.md
- DOCUMENTATION_JIGGLE_EXECUTION_SUMMARY.md
- JIGGLE_DOCUMENTATION_SUMMARY.md

---

## Category 3: Specific Feature/Project Documentation (CONSOLIDATE)

These documents relate to specific features/projects and should be organized:

### Activity System (Move to /docs/activities/ or consolidate into main activity doc)
**Count**: ~30 files  
**Recommendation**: These should be consolidated into 2-3 comprehensive documents

- ACTIVITY_EXECUTION_FLOW_COMPLETE.md
- ACTIVITY_SYSTEM_COMPLETE_ARCHITECTURE.md
- ACTIVITY_SYSTEM_UNDERSTANDING.md
- ACTIVITY_SYSTEM_ABSOLUTE_VALIDATION.md
- ACTIVITY_SYSTEM_WORKFLOW_ANALYSIS.md
- ACTIVITY_REGISTRATION_AND_LEARNING.md
- ACTIVITY_REGISTRATION_PROPER_APPROACH.md
- ACTIVITY_REGISTRATION_SYSTEM_ANALYSIS.md
- ACTIVITY_RELIABILITY_SOLUTION.md
- ACTIVITY_SUCCESS_OPTIMIZATION_PLAN.md
- ACTIVITY_TEMPLATE_FORMAT_ANALYSIS.md
- ACTIVITY_TEMPLATE_REGISTRATION_SUCCESS.md
- ACTIVITY_TOOL_MCP_INTEGRATION_COMPLETE.md
- ACTIVITY_TOOL_SIMPLIFICATION_SUMMARY.md
- ACTIVITY_WORKFLOW_QUICK_REFERENCE.md
- JIGGLE_ACTIVITY_READY.md
- JIGGLE_ACTIVITY_TEST_RESULTS.md
- JIGGLE_ACTIVITY_VISUAL.md
- JIGGLE_DOCUMENTATION_ACTIVITY.md
- README-JIGGLE-ACTIVITY.md
- README-JIGGLE-TEST.md

**Consolidation Plan**:
1. **Primary**: Keep ACTIVITY_SYSTEM_COMPLETE_ARCHITECTURE.md (rename to ACTIVITIES.md)
2. **Quick Ref**: Keep ACTIVITY_WORKFLOW_QUICK_REFERENCE.md
3. **Archive Rest**: Move detailed analysis/status docs to .archive/

### V2 API Migration (Move to .archive/v2-migration/)
**Count**: ~20 files  
**Status**: Migration is complete, these are historical records

- V2_API_PROJECT_COMPLETE.md
- V2_API_PROTO_COMPLIANCE_REVIEW.md
- V2_API_PROTO_COMPLIANCE_FIX_PLAN.md
- V2_API_PROTO_COMPLIANCE_COMPLETE.md
- V2_API_DEPLOYMENT_VERIFICATION.md
- V2_API_REFACTORING_NEEDED.md
- V2_MIGRATION_QUICK_START.md
- CLI_PROTO_HANDLING_UPDATE.md
- PROTO_ALIGNMENT_COMPLETE.md
- PROTO_COMPLIANCE_VALIDATION_PLAN.md
- PROTO_DATA_STRUCTURE_ALIGNMENT.md

### Memory Management (Consolidate to /docs/memory/ or archive)
- MEMORY_INVESTIGATION_REPORT.md
- MEMORY_FIX_VERIFICATION.md
- MEMORY_FIXES_COMPREHENSIVE.md
- MEMORY_BUDGET_TOOL_FIX.md
- MEMORY_LEAK_ROOT_CAUSE.md
- MEMORY_AGENT_ARCHITECTURE_MISMATCH.md
- PROPER_MEMORY_AGENT_DESIGN.md
- MESSAGE_HISTORY_AND_IMPULSE_SHARING.md
- RESTART_INSTRUCTIONS.md
- CACHE_THRASHING_FIX.md

**Consolidation**: Create single MEMORY_SYSTEM.md with overview, keep detailed fixes in .archive/

### Dashboard Integration (Move to /docs/dashboard/ or repos/metabob-dashboard/)
- DASHBOARD_EXPLORATION_COMPLETE.md
- DASHBOARD_DATA_EXPLORATION_SUMMARY.md
- DASHBOARD_DATA_DISPLAY_COMPLETE.md
- DASHBOARD_V2_VERIFICATION.md
- DASHBOARD_INTEGRATION_STATUS.md
- DEVBOB_DASHBOARD_V2_SETUP.md

### Configuration & Setup (Consolidate)
- CONFIG_SIMPLIFICATION_COMPLETE.md
- CONFIG_VALIDATION_FIXES.md
- METABOB_CONFIG_SIMPLIFICATION.md
- COMPLETE_REFACTORING_SUMMARY.md

**Consolidation**: Merge into CONFIGURATION.md

### Schema & Data Alignment (Archive - project complete)
- SCHEMA_MISMATCH_ROOT_CAUSE.md
- SCHEMA_MISMATCH_ACTION_PLAN.md
- DATA_STRUCTURE_ALIGNMENT_ISSUE.md
- DATA_FRAGMENTATION_ANALYSIS.md
- PROJECT_DATA_CONSISTENCY_FIX.md

---

## Category 4: Obsolete/Superseded Documents (ARCHIVE)

Documents that are clearly outdated or superseded by newer versions:

### Superseded by Newer Versions
- COMPLETE_SUMMARY.md (multiple newer summaries exist)
- COMPLETE_FINDINGS_SUMMARY.md
- FINAL_SUMMARY.md
- FINAL_STATUS.md
- FINAL_STATUS.txt
- FINAL_COMPREHENSIVE_SUMMARY.md (superseded by recent specific summaries)

### Duplicate Documentation Cleanup Files
- doc-deletion-plan-summary.md
- doc-deletion-plan.md
- doc-jiggle-analysis-new.md
- doc-jiggle-filtered-plan.md
- doc-jiggle-summary.md
- doc-percolation-plan.md

**Note**: These are meta-documentation about documentation cleanup - should be archived after this process

### Historical Action Plans (Archive - completed)
- ACTION_PLAN_NEXT_SESSION.md
- NEXT_STEPS.md
- NEXT_SESSION_CLI_MIGRATION.md

---

## Category 5: Delegation & Protocol Documentation (REVIEW)

### Keep (valuable processes)
- DELEGATION_STRATEGY.md
- DOCUMENTATION_ALIGNMENT_PROTOCOL.md
- EXAMPLE_DOC_ALIGNMENT_SESSION.md

### Review for Metabob Internal Config (FILTER as requested)

**IMPORTANT**: The user specifically requested filtering out Metabob MCP configuration recommendations. Metabob is an internal system component, NOT a user-configurable MCP tool.

Files to review for inappropriate Metabob setup instructions:
- README_MCP_EXECUTION.md - Check if this suggests users configure Metabob
- QUICK_START_*.md files - Ensure no user-facing Metabob MCP setup

**Filtering Principle**: 
- ✅ OK: Documentation about using Metabob features (code analysis, annotations)
- ❌ REMOVE: Instructions for users to configure Metabob MCP servers
- ✅ OK: Internal documentation about Metabob system architecture
- ❌ REMOVE: Treating Metabob as an example MCP tool configuration

---

## Percolation Recommendations

### From Recent to Foundational

#### 1. Activity System Updates → README_ARCHITECTURE_DOCS.md
**Source**: ACTIVITY_RELIABILITY_SOLUTION.md (Feb 7)  
**Key Content**:
- Activity system is production-ready with Thompson Sampling
- 8 bootstrap templates available
- MCP integration complete

**Action**: Update the "Activity System" section in README_ARCHITECTURE_DOCS.md with production-ready status

#### 2. V2 API Completion → README_ARCHITECTURE_DOCS.md
**Source**: V2_API_PROJECT_COMPLETE.md  
**Key Content**:
- V2 API migration fully complete
- All proto compliance validated
- New endpoint structure documented

**Action**: Add V2 API completion status to architecture overview

#### 3. Memory System Fixes → README_ARCHITECTURE_DOCS.md or MEMORY_SYSTEM.md
**Source**: MEMORY_FIXES_COMPREHENSIVE.md  
**Key Content**:
- Memory leak root causes identified
- Budget tool fixes implemented
- Cache thrashing resolved

**Action**: Create consolidated MEMORY_SYSTEM.md with fix history

#### 4. Quick Start Consolidation → README_ARCHITECTURE_DOCS.md
**Sources**: Multiple QUICK_START_*.md files  
**Action**: Create a "Quick Start Guide" section linking to:
- Getting Started (new file)
- V2 API Quick Start
- Dashboard Quick Start
- Development Setup

#### 5. Documentation Process → DOCUMENTATION_INDEX.md
**Source**: DOCUMENTATION_ALIGNMENT_PROTOCOL.md, this analysis  
**Action**: Add section on documentation maintenance process

---

## Proposed Directory Structure

```
/
├── README.md (renamed from README_ARCHITECTURE_DOCS.md)
├── DOCUMENTATION_INDEX.md (updated with new structure)
├── GETTING_STARTED.md (new - consolidated quick start)
├── ACTIVITIES.md (consolidated activity system docs)
├── MEMORY_SYSTEM.md (new - consolidated memory docs)
├── CONFIGURATION.md (consolidated config docs)
│
├── docs/
│   ├── architecture/
│   │   ├── DATA_FLOW.md (renamed from METABOB_DATAFLOW_ARCHITECTURE.md)
│   │   ├── EXECUTION_ENVIRONMENT.md
│   │   └── SCHEMA_DESIGN.md (consolidated)
│   │
│   ├── api/
│   │   ├── V2_API_GUIDE.md (consolidated)
│   │   └── PROTO_SCHEMA.md
│   │
│   ├── dashboard/
│   │   └── DASHBOARD_GUIDE.md (consolidated)
│   │
│   └── processes/
│       ├── DELEGATION_STRATEGY.md
│       └── DOCUMENTATION_ALIGNMENT_PROTOCOL.md
│
├── repos/
│   ├── metabob-cli/
│   │   └── README.md
│   ├── metabob-opencode/
│   │   └── README.md
│   └── metabob-rpc-api/
│       └── README.md
│
└── .archive/
    ├── sessions/
    │   └── 2026-02/ (session summaries)
    ├── status-reports/
    │   └── 2026-02/ (completion reports)
    ├── task-logs/
    │   └── 2026-02/ (task execution logs)
    ├── test-reports/
    │   └── 2026-02/ (test results)
    ├── implementation-logs/
    │   └── 2026-02/ (implementation summaries)
    ├── v2-migration/
    │   └── [all V2 migration docs]
    └── activity-analysis/
        └── [detailed activity analysis docs]
```

---

## Statistics

### Files to Archive: ~150 files
- Session/status files: ~30
- Task logs: ~10
- Test reports: ~15
- V2 migration docs: ~20
- Activity analysis docs: ~25
- Implementation summaries: ~15
- Superseded summaries: ~10
- Historical action plans: ~5
- Other temporary docs: ~20

### Files to Consolidate: ~60 files
- Activity system: 30 → 2-3 files
- Memory system: 10 → 1 file
- Configuration: 5 → 1 file
- Dashboard: 6 → 1 file
- V2 API (keep some): 5-10 → 2-3 files

### Files to Keep at Root: ~15 files
- README.md
- DOCUMENTATION_INDEX.md
- GETTING_STARTED.md
- ACTIVITIES.md
- MEMORY_SYSTEM.md
- CONFIGURATION.md
- Quick start guides (3-5)
- Process docs (2-3)

### Files to Move to /docs: ~20 files
- Architecture docs
- API docs
- Dashboard docs
- Process docs

---

## Duplicate Detection

### Potential Duplicates (Similar Titles/Content)
1. **Session Summaries** (multiple with similar purpose):
   - SESSION_SUMMARY_ACTIVITY_TESTING.md
   - SESSION_COMPLETE_ACTIVITY_TESTING.md
   - FINAL_SESSION_SUMMARY.md
   
2. **Complete/Final Status** (many completion announcements):
   - COMPLETE_SOLUTION_SUMMARY.md
   - FINAL_COMPREHENSIVE_SUMMARY.md
   - PROJECT_COMPLETE_V2_API_CLEANUP.md
   - VALIDATION_COMPLETE.md
   - FINAL_VALIDATION_COMPLETE.md

3. **Activity System Docs** (overlapping content):
   - ACTIVITY_SYSTEM_COMPLETE_ARCHITECTURE.md
   - ACTIVITY_SYSTEM_UNDERSTANDING.md
   - ACTIVITY_EXECUTION_FLOW_COMPLETE.md

4. **Jiggle Documentation** (meta-docs about this process):
   - doc-jiggle-implementation-summary.md
   - DOCUMENTATION_JIGGLE_EXECUTION_SUMMARY.md
   - JIGGLE_DOCUMENTATION_SUMMARY.md

---

## Cross-Reference Analysis

### High-Risk Archives (Check References Before Moving)

These files might be referenced by code or other documentation:

1. **DOCUMENTATION_INDEX.md** - Keep, update references
2. **README_ARCHITECTURE_DOCS.md** - Rename to README.md, update refs
3. **ACTIVITY_WORKFLOW_QUICK_REFERENCE.md** - Keep, widely referenced
4. **BREADCRUMB_QUICK_START.md** - Keep, implementation guide

### Safe to Archive (Likely Not Referenced)

- All session summaries
- All status reports
- All task logs
- All test reports
- Historical action plans

---

## Next Steps (For Apply Mode)

When running in `apply` mode, this process will:

1. **Create Directory Structure**
   - Create /docs/ with subdirectories
   - Create .archive/ subdirectories by date/type

2. **Archive Session/Status Files**
   - Move ~150 temporary files to .archive/
   - Preserve timestamp metadata

3. **Consolidate Documentation**
   - Merge activity docs → ACTIVITIES.md
   - Merge memory docs → MEMORY_SYSTEM.md
   - Merge config docs → CONFIGURATION.md
   - Merge dashboard docs → docs/dashboard/DASHBOARD_GUIDE.md

4. **Percolate Content**
   - Update README_ARCHITECTURE_DOCS.md with recent completions
   - Rename README_ARCHITECTURE_DOCS.md → README.md
   - Update DOCUMENTATION_INDEX.md with new structure
   - Create GETTING_STARTED.md with quick start info

5. **Update Cross-References**
   - Scan all remaining docs for links to archived files
   - Update links to point to archive locations
   - Update DOCUMENTATION_INDEX.md navigation

6. **Filter Metabob MCP Configuration**
   - Review README_MCP_EXECUTION.md
   - Remove any user-facing Metabob MCP setup instructions
   - Keep only legitimate MCP tool documentation

7. **Create Summary**
   - Document all changes made
   - List archived files
   - List consolidated files
   - Report broken references (if any)

---

## Safety Checks

✅ No README.md exists (safe to rename README_ARCHITECTURE_DOCS.md)  
✅ .archive/ directory exists and is actively used  
✅ All identified files for archival are >30 days old or marked complete  
✅ Consolidation targets have overlapping content (verified manually)  
✅ Primary entry points identified (DOCUMENTATION_INDEX.md)  
⚠️  Cross-references need validation before archiving  
⚠️  Metabob MCP config filtering needs manual review

---

## Recommendations

### Immediate Actions (High Priority)
1. ✅ **Run this analysis** - Complete
2. 🔄 **Review recommendations** - Manual review needed
3. ⏭️  **Run in apply mode** - After approval
4. ⏭️  **Update DOCUMENTATION_INDEX.md** - After apply

### Process Improvements (Medium Priority)
1. Establish naming convention for session/status files (use dates)
2. Create /docs/ structure early to avoid root clutter
3. Archive completed project docs within 1 week of completion
4. Use subdirectories for feature-specific documentation

### Long-Term Maintenance (Low Priority)
1. Run jiggling process monthly
2. Automated detection of obsolete docs (>90 days unchanged)
3. Automated cross-reference validation
4. Documentation coverage metrics

---

**End of Dry Run Analysis**

**Ready for Apply Mode**: Yes, with manual review of:
1. Cross-reference validation results
2. Metabob MCP configuration filtering
3. Consolidation content merging strategy
