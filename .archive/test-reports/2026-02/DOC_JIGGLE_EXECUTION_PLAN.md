# Documentation Jiggle - Execution Plan

**Date**: February 8, 2026  
**Status**: READY TO EXECUTE  
**Mode**: Apply (with safety measures)

---

## Executive Summary

**Current State**: 218 markdown files in root  
**Target State**: ~60-70 markdown files in root  
**Reduction**: 68% reduction in root directory clutter  

**Safety**: Archive-first approach, git commit before execution

---

## Execution Phases

### Phase 0: Safety Backup ✅
```bash
git add -A
git commit -m "docs: Backup before documentation jiggle execution"
```

### Phase 1: Trash Cleanup (DELETE 55 files)

#### 1A: Task Logs (5 files) - DELETE
```bash
rm TASK_PHASE1_TASK1_LOG.md
rm TASK_PHASE1_TASK2_LOG.md
rm TASK_PHASE1_TASK3_LOG.md
rm TASK_PHASE1_TASK4_LOG.md
rm TASK_LOG_TEMPLATE.md
```

#### 1B: Session Summaries (9 files) - DELETE
```bash
# Session summaries
rm SESSION_SUMMARY_ACTIVITY_TESTING.md
rm SESSION_SUMMARY_FEB_6_EVENING.md
rm SESSION_SUMMARY_FEB_8_2026.md
rm SESSION_SUMMARY_TASKS_6_7.md

# Session complete files
rm SESSION_COMPLETE_ACTIVITY_TESTING.md
rm SESSION_COMPLETE_FINAL_STATUS.md
rm SESSION_COMPLETE_MCP_EXECUTION.md
rm SESSION_COMPLETE_VARIANT_RESOLUTION.md
```

#### 1C: Status Snapshots - HIGH PRIORITY DELETE (20 files)

**Rationale**: Multiple variations of same status, keep only ONE authoritative doc per area

```bash
# Activity status duplicates (keep ACTIVITY_RELIABILITY_SOLUTION.md)
rm ACTIVITY_SYSTEM_FINAL_STATUS.md
rm ACTIVITY_EXECUTION_FLOW_COMPLETE.md
rm ACTIVITY_TOOL_MCP_INTEGRATION_COMPLETE.md
rm ACTIVITY_TEMPLATE_REGISTRATION_SUCCESS.md

# Validation/verification duplicates
rm ACTIVITY_SYSTEM_ABSOLUTE_VALIDATION.md
rm FINAL_VALIDATION_COMPLETE.md
rm VERIFICATION_COMPLETE.md
rm VALIDATION_COMPLETE.md
rm FINAL_VERIFICATION_SUMMARY.md
rm COMPLETE_FLOW_VALIDATION_SUCCESS.md

# Summary duplicates
rm COMPLETE_FINDINGS_SUMMARY.md
rm COMPLETE_SUMMARY.md
rm COMPREHENSIVE_TEST_REPORT.md
rm INCREMENTAL_PROGRESS_REPORT.md

# Implementation complete duplicates (keep README_IMPLEMENTATION_COMPLETE.md)
rm SYSTEM_INTEGRATION_COMPLETE.md
rm PROJECT_SETUP_COMPLETE.md
rm SETUP_COMPLETE_READY_TO_EXECUTE.md

# Final summaries (keep V2_MIGRATION_FINAL_SUMMARY.md)
rm FINAL_SUMMARY.md
rm FINAL_SUMMARY_V2.md
rm FINAL_SESSION_SUMMARY.md
```

#### 1D: Status Snapshots - MEDIUM PRIORITY DELETE (15 files)

```bash
# Proto compliance duplicates
rm PROTO_COMPLIANCE_IMPLEMENTATION_COMPLETE.md
rm PROTO_ALIGNMENT_COMPLETE.md
rm V2_ACTIVITIES_PROTO_COMPLIANCE_COMPLETE.md
rm V2_API_PROTO_COMPLIANCE_COMPLETE.md
rm V2_SESSION_PROTO_COMPLIANCE_COMPLETE.md
rm METABOB_PROTO_COMPLIANCE_CHECK.md

# Implementation summaries (keep V2_API_IMPLEMENTATION_COMPLETE.md)
rm IMPLEMENTATION_SUMMARY.md
rm FINAL_IMPLEMENTATION_SUMMARY.md
rm CONFIG_SIMPLIFICATION_COMPLETE.md

# API project complete files (keep V2_API_PROJECT_COMPLETE.md)
rm PROJECT_COMPLETE_V2_API_CLEANUP.md
rm V2_API_DEPLOYMENT_VERIFICATION.md

# Migration deliverables
rm V2_MIGRATION_DELIVERABLES_SUMMARY.md
rm CLI_V2_MIGRATION_COMPLETE.md
rm METABOB_CLI_V2_MIGRATION_COMPLETE.md

# Dashboard complete files
rm DASHBOARD_DATA_DISPLAY_COMPLETE.md
```

#### 1E: Other Cleanup (6 files)

```bash
# Redundant executive summaries (keep specific area summaries)
rm EXECUTIVE_SUMMARY.md
rm FINAL_COMPREHENSIVE_SUMMARY.md

# Redundant test reports (keep ACTIVITY_SYSTEM_TEST_FINAL_REPORT.md)
rm TEST_SESSION_FINAL_REPORT.md
rm ACTIVITY_TEST_SUMMARY.md

# Obsolete files
rm ALL_COMPLETE.md
rm READY_FOR_DEPLOYMENT.md
```

**Phase 1 Total**: 55 files deleted

---

### Phase 2: Archive Historical Docs (30 files)

Create archive structure:
```bash
mkdir -p .archive/activity-analysis
mkdir -p .archive/memory-analysis
mkdir -p .archive/v2-migration-analysis
mkdir -p .archive/config-analysis
```

#### 2A: Activity Analysis Files → .archive/activity-analysis/
```bash
mv ACTIVITY_DATA_FLOW_TEST_REPORT.md .archive/activity-analysis/
mv ACTIVITY_EVOLUTION_TEST_PLAN.md .archive/activity-analysis/
mv ACTIVITY_IMPROVEMENTS_VISUAL_SUMMARY.md .archive/activity-analysis/
mv ACTIVITY_REGISTRATION_AND_LEARNING.md .archive/activity-analysis/
mv ACTIVITY_REGISTRATION_PROPER_APPROACH.md .archive/activity-analysis/
mv ACTIVITY_REGISTRATION_SYSTEM_ANALYSIS.md .archive/activity-analysis/
mv ACTIVITY_SUCCESS_OPTIMIZATION_PLAN.md .archive/activity-analysis/
mv ACTIVITY_SYSTEM_ALIGNMENT_SUMMARY.md .archive/activity-analysis/
mv ACTIVITY_SYSTEM_COMPLETE_ARCHITECTURE.md .archive/activity-analysis/
mv ACTIVITY_SYSTEM_EXECUTIVE_SUMMARY.md .archive/activity-analysis/
mv ACTIVITY_SYSTEM_IMPLEMENTATION_PLAN.md .archive/activity-analysis/
mv ACTIVITY_SYSTEM_TEST_SUMMARY.md .archive/activity-analysis/
mv ACTIVITY_SYSTEM_UNDERSTANDING.md .archive/activity-analysis/
mv ACTIVITY_SYSTEM_VERIFICATION_SUMMARY.md .archive/activity-analysis/
mv ACTIVITY_SYSTEM_WORKFLOW_ANALYSIS.md .archive/activity-analysis/
mv ACTIVITY_SYSTEM_WORKING_DIAGNOSIS.md .archive/activity-analysis/
mv ACTIVITY_TEMPLATE_FORMAT_ANALYSIS.md .archive/activity-analysis/
mv ACTIVITY_TOOL_SIMPLIFICATION_SUMMARY.md .archive/activity-analysis/
mv ACTIVITY_VARIANT_ARCHITECTURE_VIOLATION.md .archive/activity-analysis/
mv ACTIVITY_WORKFLOW_QUICK_REFERENCE.md .archive/activity-analysis/
mv ACTIVITY_REGISTRATION_QUICK_REF.md .archive/activity-analysis/
# Keep: ACTIVITY_RELIABILITY_SOLUTION.md (authoritative)
```

#### 2B: Memory Analysis Files → .archive/memory-analysis/
```bash
mv MEMORY_AGENT_ARCHITECTURE_MISMATCH.md .archive/memory-analysis/
mv MEMORY_BUDGET_TOOL_FIX.md .archive/memory-analysis/
mv MEMORY_FIXES_COMPREHENSIVE.md .archive/memory-analysis/
mv MEMORY_FIX_VERIFICATION.md .archive/memory-analysis/
mv MEMORY_INVESTIGATION_REPORT.md .archive/memory-analysis/
mv MEMORY_LEAK_ROOT_CAUSE.md .archive/memory-analysis/
mv SESSION_MEMORY_AGENT_RESPONSIBILITIES.md .archive/memory-analysis/
mv COMPLETE_MEMORY_AGENT_IMPLEMENTATION.md .archive/memory-analysis/
# Keep: SESSION_MEMORY_FINAL.md (authoritative)
```

#### 2C: V2 Migration Analysis → .archive/v2-migration-analysis/
```bash
mv V2_API_PROTO_COMPLIANCE_FIX_PLAN.md .archive/v2-migration-analysis/
mv V2_API_PROTO_COMPLIANCE_REVIEW.md .archive/v2-migration-analysis/
mv V2_API_REFACTORING_NEEDED.md .archive/v2-migration-analysis/
mv V2_ENDPOINT_TEST_PLAN.md .archive/v2-migration-analysis/
mv V2_ENDPOINT_TEST_RESULTS_AND_FIXES.md .archive/v2-migration-analysis/
mv V2_MIGRATION_QUICK_START.md .archive/v2-migration-analysis/
mv MIGRATION_SUMMARY.md .archive/v2-migration-analysis/
# Keep: V2_MIGRATION_FINAL_SUMMARY.md (authoritative)
# Keep: V2_API_PROJECT_COMPLETE.md (authoritative)
# Keep: V2_API_IMPLEMENTATION_COMPLETE.md (authoritative)
```

#### 2D: Config/Architecture Analysis → .archive/config-analysis/
```bash
mv ARCHITECTURE_EVOLUTION_SUMMARY.md .archive/config-analysis/
mv ARCHITECTURE_TRANSFORMATION_SUMMARY.md .archive/config-analysis/
mv ARCHITECTURE_UNDERSTANDING.md .archive/config-analysis/
mv METABOB_CONFIG_SIMPLIFICATION.md .archive/config-analysis/
mv CONFIG_VALIDATION_FIXES.md .archive/config-analysis/
mv DOCKER_CONFIG_RESOLUTION.md .archive/config-analysis/
```

#### 2E: Create Archive READMEs
```bash
# Create README in each archive directory explaining context
```

**Phase 2 Total**: ~30 files archived

---

### Phase 3: Consolidate Remaining Docs

#### Keep as Authoritative (Do Not Touch)
```
ACTIVITY_RELIABILITY_SOLUTION.md - THE activity system doc
SESSION_MEMORY_FINAL.md - THE session memory doc
V2_MIGRATION_FINAL_SUMMARY.md - THE v2 migration doc
README_ARCHITECTURE_DOCS.md - Master architecture overview
README_IMPLEMENTATION_COMPLETE.md - Implementation status
README_MCP_EXECUTION.md - MCP execution guide
MISSION_COMPLETE.md - Thompson Sampling achievement
doc-jiggle-summary.md - Latest jiggle report
JIGGLE_ACTIVITY_READY.md - Jiggle activity template status
```

#### Consolidate Into README_ARCHITECTURE_DOCS.md
**From these analysis files** (add key insights only):
- CORRECT_ARCHITECTURE_DESIGN.md
- PROPER_MEMORY_AGENT_DESIGN.md
- METABOB_DATAFLOW_ARCHITECTURE.md

**Action**: Extract key architectural decisions, add to README_ARCHITECTURE_DOCS.md, then archive originals

---

### Phase 4: Fix Date Issues

```bash
# Fix BOOTSTRAP_COMPLETE_SUMMARY.md date
sed -i 's/Date\*\*: 2026-02-09/Date**: 2026-02-08/' BOOTSTRAP_COMPLETE_SUMMARY.md
```

---

### Phase 5: Create Summary Report

Create `DOC_JIGGLE_ENHANCED_SUMMARY.md` with:
- Files deleted (55)
- Files archived (30)
- Consolidations performed
- Intent vs reality mismatches found and corrected
- Final file count
- Next steps

---

## Expected Results

### File Counts

| Category | Before | After | Change |
|----------|--------|-------|--------|
| Root .md files | 218 | ~60-70 | -148 (-68%) |
| Task logs | 5 | 0 | -5 (-100%) |
| Session summaries | 9 | 0 | -9 (-100%) |
| Status snapshots | 41 | 0 | -41 (-100%) |
| Activity docs | 28 | 1 | -27 (-96%) |
| Memory docs | 8 | 1 | -7 (-87%) |
| V2 docs | 16 | 3 | -13 (-81%) |

### Documentation Structure After

```
Root (60-70 files):
├── Authoritative Guides (10)
│   ├── ACTIVITY_RELIABILITY_SOLUTION.md
│   ├── SESSION_MEMORY_FINAL.md
│   ├── V2_MIGRATION_FINAL_SUMMARY.md
│   ├── README_ARCHITECTURE_DOCS.md
│   ├── README_IMPLEMENTATION_COMPLETE.md
│   ├── README_MCP_EXECUTION.md
│   ├── MISSION_COMPLETE.md
│   └── [3 more core docs]
│
├── Quick References (10)
│   ├── BREADCRUMB_QUICK_START.md
│   ├── MCP_METHODS_QUICK_REFERENCE.md
│   ├── QUICK_ARCHITECTURE_REFERENCE.md
│   └── [7 more quick refs]
│
├── Current Work (10-15)
│   ├── BOOTSTRAP_COMPLETE_SUMMARY.md
│   ├── PHASE1_COMPLETION_SUMMARY.md
│   └── [Active project docs]
│
├── Analysis Reports (10-15)
│   ├── doc-jiggle reports
│   ├── Data analysis
│   └── Design proposals
│
└── Repo-specific (15-20)
    ├── repos/metabob-cli/README.md
    └── repos/metabob-rpc-api/README.md

Archive (85+ files):
├── .archive/activity-analysis/ (21 files)
├── .archive/memory-analysis/ (8 files)
├── .archive/v2-migration-analysis/ (7 files)
├── .archive/config-analysis/ (6 files)
├── .archive/dev-journal/ (existing, ~40 files)
└── .archive/test-reports/ (existing, ~3 files)
```

---

## Validation Checklist

After execution:
- [ ] Root directory has ~60-70 .md files (not 218)
- [ ] All trash files deleted (55 files)
- [ ] Historical docs archived with READMEs (30 files)
- [ ] Archive structure is logical
- [ ] No broken links in authoritative docs
- [ ] Date issues fixed (BOOTSTRAP_COMPLETE_SUMMARY.md)
- [ ] Metabob MCP config filtered from user docs
- [ ] Git commit created with clear message

---

## Safety Measures

1. ✅ Git backup commit before starting
2. ✅ Archive historical docs (don't delete)
3. ✅ Keep one authoritative doc per area
4. ✅ Test a few links after cleanup
5. ✅ Can revert with `git reset --hard` if needed

---

**Status**: READY TO EXECUTE  
**Estimated Time**: 45 minutes  
**Risk Level**: LOW (archive-first, git backup)  
**Expected Impact**: Massive improvement in documentation clarity
