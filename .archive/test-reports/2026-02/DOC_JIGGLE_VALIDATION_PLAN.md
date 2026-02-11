# Documentation Jiggle - Enhanced Validation Plan

**Date**: February 8, 2026  
**Mode**: Dry Run → Apply  
**Focus**: Truth validation, trash cleanup, consolidation

---

## Executive Summary

Current state: **218 markdown files** in root directory
- **55 files are trash** (task logs, session summaries, status snapshots)
- **52 files are fragmented** (28 activity, 8 memory, 16 v2/migration docs)
- **Need validation**: Check documentation claims against git history

---

## Phase 1: Truth Validation (Documentation vs Reality)

### Goal
Validate that documentation claims match actual git commit history and implementation.

### Files to Validate

#### High Priority: Recent "COMPLETE" files
1. `BOOTSTRAP_COMPLETE_SUMMARY.md` - Claims bootstrap completed Feb 9, 2026
   - ✅ Git commit: e7da43b "refactor: remove non-bootstrap activity templates"
   - ⚠️ **MISMATCH**: Doc dated Feb 9, but today is Feb 8
   - **ACTION**: This file is from the FUTURE or has wrong date

2. `ACTIVITY_RELIABILITY_SOLUTION.md` - Claims production-ready
   - Check: Git commits for activity system fixes
   - Check: Test results mentioned

3. `SESSION_MEMORY_FINAL.md` - Claims transformation complete
   - Check: Session memory code changes in git
   - Check: Architecture claims vs actual code

4. `doc-jiggle-implementation-summary.md` - Claims jiggling completed
   - Check: Archive directory structure exists
   - Check: Files actually moved
   - **ISSUE**: Claims 213 files, but we have 218

### Validation Commands
```bash
# Check for bootstrap work
git log --oneline --since="1 week ago" | grep -i bootstrap

# Check for session memory work
git log --oneline --since="1 month ago" | grep -i "session\|memory"

# Check for activity system work
git log --oneline --since="1 month ago" | grep -i activity

# Verify archive structure
ls -la .archive/dev-journal/
```

### Validation Criteria
- ✅ Documentation date matches git commit date (±1 day)
- ✅ Claimed features have corresponding code commits
- ✅ Test results mentioned have actual test files
- ✅ "COMPLETE" status has implementation proof

---

## Phase 2: Trash Cleanup (55 files)

### Category 1: Task Logs (5 files) - DELETE ALL
- `TASK_PHASE1_TASK1_LOG.md`
- `TASK_PHASE1_TASK2_LOG.md`
- `TASK_PHASE1_TASK3_LOG.md`
- `TASK_PHASE1_TASK4_LOG.md`
- `TASK_LOG_TEMPLATE.md`

**Rationale**: Session-specific task logs, no long-term value

### Category 2: Session Summaries (9 files) - DELETE ALL
- `SESSION_SUMMARY_*.md` (multiple variations)
- `SESSION_COMPLETE_*.md` (multiple variations)

**Rationale**: Point-in-time session status, superseded by final docs

### Category 3: Status Snapshots (41 files) - DELETE MOST

#### DELETE (30+ files):
All files matching these patterns:
- `*_COMPLETE.md` (except key architecture docs)
- `*_FINAL.md` (except SESSION_MEMORY_FINAL.md, V2_MIGRATION_FINAL_SUMMARY.md)
- `*_STATUS.md` (temporary status)
- `*_SUMMARY.md` (unless it's THE authoritative summary)

#### KEEP (10 files - authoritative):
- `ACTIVITY_RELIABILITY_SOLUTION.md` - THE activity system doc
- `SESSION_MEMORY_FINAL.md` - THE session memory doc
- `V2_MIGRATION_FINAL_SUMMARY.md` - THE v2 migration summary
- `README_ARCHITECTURE_DOCS.md` - Master architecture
- `README_IMPLEMENTATION_COMPLETE.md` - Implementation status
- `README_MCP_EXECUTION.md` - MCP guide
- `MISSION_COMPLETE.md` - Thompson Sampling achievement
- `doc-jiggle-summary.md` - Latest jiggle report
- `JIGGLE_ACTIVITY_READY.md` - Jiggle activity status
- Plus a few other critical docs

---

## Phase 3: Consolidation (52 fragmented files → 10 guides)

### Activity System Consolidation (28 files → 3 guides)

**Target Structure**:
1. **ACTIVITY_SYSTEM_GUIDE.md** (User-facing)
   - What are activities?
   - How to use them
   - Available templates
   - Best practices
   
2. **ACTIVITY_SYSTEM_ARCHITECTURE.md** (Developer reference)
   - System design
   - MCP integration
   - Learning system
   - Template format
   
3. **ACTIVITY_SYSTEM_DEVELOPMENT.md** (Historical context)
   - Evolution timeline
   - Key decisions
   - Problems solved

**Source Files to Consolidate**:
```
ACTIVITY_DATA_FLOW_TEST_REPORT.md
ACTIVITY_EVOLUTION_TEST_PLAN.md
ACTIVITY_EXECUTION_FLOW_COMPLETE.md
ACTIVITY_IMPROVEMENTS_VISUAL_SUMMARY.md
ACTIVITY_REGISTRATION_AND_LEARNING.md
ACTIVITY_REGISTRATION_PROPER_APPROACH.md
ACTIVITY_REGISTRATION_SYSTEM_ANALYSIS.md
ACTIVITY_SUCCESS_OPTIMIZATION_PLAN.md
ACTIVITY_SYSTEM_ABSOLUTE_VALIDATION.md
ACTIVITY_SYSTEM_ALIGNMENT_SUMMARY.md
ACTIVITY_SYSTEM_COMPLETE_ARCHITECTURE.md
ACTIVITY_SYSTEM_EXECUTIVE_SUMMARY.md
ACTIVITY_SYSTEM_FINAL_STATUS.md
ACTIVITY_SYSTEM_IMPLEMENTATION_PLAN.md
ACTIVITY_SYSTEM_TEST_FINAL_REPORT.md
ACTIVITY_SYSTEM_TEST_SUMMARY.md
ACTIVITY_SYSTEM_UNDERSTANDING.md
ACTIVITY_SYSTEM_VERIFICATION_SUMMARY.md
ACTIVITY_SYSTEM_WORKFLOW_ANALYSIS.md
ACTIVITY_SYSTEM_WORKING_DIAGNOSIS.md
ACTIVITY_TEMPLATE_FORMAT_ANALYSIS.md
ACTIVITY_TEMPLATE_REGISTRATION_SUCCESS.md
ACTIVITY_TEST_SUMMARY.md
ACTIVITY_TOOL_MCP_INTEGRATION_COMPLETE.md
ACTIVITY_TOOL_SIMPLIFICATION_SUMMARY.md
ACTIVITY_VARIANT_ARCHITECTURE_VIOLATION.md
ACTIVITY_WORKFLOW_QUICK_REFERENCE.md
ACTIVITY_REGISTRATION_QUICK_REF.md
```

**Keep as-is**:
- `ACTIVITY_RELIABILITY_SOLUTION.md` - Already the authoritative doc

### Memory System Consolidation (8 files → 2 guides)

**Target Structure**:
1. **SESSION_MEMORY_GUIDE.md** (User-facing + Architecture)
   - Current architecture
   - Responsibilities
   - Context management
   - Budget monitoring
   
2. **SESSION_MEMORY_DEVELOPMENT.md** (Historical)
   - Transformation journey
   - Problems solved
   - Design decisions

**Source Files to Consolidate**:
```
MEMORY_AGENT_ARCHITECTURE_MISMATCH.md
MEMORY_BUDGET_TOOL_FIX.md
MEMORY_FIXES_COMPREHENSIVE.md
MEMORY_FIX_VERIFICATION.md
MEMORY_INVESTIGATION_REPORT.md
MEMORY_LEAK_ROOT_CAUSE.md
SESSION_MEMORY_AGENT_RESPONSIBILITIES.md
COMPLETE_MEMORY_AGENT_IMPLEMENTATION.md
```

**Keep as-is**:
- `SESSION_MEMORY_FINAL.md` - Already the authoritative doc

### V2/Migration Consolidation (16 files → 2 guides)

**Target Structure**:
1. **V2_API_GUIDE.md** (Current API reference)
   - Endpoints
   - Proto compliance
   - Usage examples
   
2. **V2_MIGRATION_HISTORY.md** (Historical)
   - Migration journey
   - Breaking changes
   - Lessons learned

**Source Files to Consolidate**:
```
V2_ACTIVITIES_PROTO_COMPLIANCE_COMPLETE.md
V2_API_DEPLOYMENT_VERIFICATION.md
V2_API_IMPLEMENTATION_COMPLETE.md
V2_API_PROJECT_COMPLETE.md
V2_API_PROTO_COMPLIANCE_COMPLETE.md
V2_API_PROTO_COMPLIANCE_FIX_PLAN.md
V2_API_PROTO_COMPLIANCE_REVIEW.md
V2_API_REFACTORING_NEEDED.md
V2_ENDPOINT_TEST_PLAN.md
V2_ENDPOINT_TEST_RESULTS_AND_FIXES.md
V2_MIGRATION_DELIVERABLES_SUMMARY.md
V2_MIGRATION_QUICK_START.md
V2_SESSION_API_COMPLETE.md
V2_SESSION_PROTO_COMPLIANCE_COMPLETE.md
MIGRATION_SUMMARY.md
METABOB_CLI_V2_MIGRATION_COMPLETE.md
```

**Keep as-is**:
- `V2_MIGRATION_FINAL_SUMMARY.md` - Already the authoritative doc
- `API_V2_DESIGN.md` - Design reference

---

## Phase 4: Metabob MCP Configuration Filtering

### Critical Filter
**DO NOT include in user-facing docs**:
- Metabob MCP configuration examples
- `.opencode/opencode.json` with metabob MCP setup
- Instructions to configure Metabob as MCP server
- Troubleshooting for Metabob MCP connectivity

**Rationale**: Metabob is an internal system component, not user-configurable

### Files to Review
- `README_ARCHITECTURE_DOCS.md` - Check for MCP config examples
- `ACTIVITY_RELIABILITY_SOLUTION.md` - Keep architecture, remove setup
- `README_MCP_EXECUTION.md` - Ensure focuses on usage, not Metabob config
- Any new consolidated guides

---

## Phase 5: Archive Strategy

### Move to `.archive/` (Historical value, not trash)
```
.archive/dev-journal/2026-02-08-activity-consolidation/
  - All consolidated activity docs
  
.archive/dev-journal/2026-02-08-memory-system/
  - All consolidated memory docs
  
.archive/dev-journal/2026-02-08-v2-migration/
  - All consolidated V2 docs

.archive/task-logs/2026-02-08/
  - All task logs
  
.archive/session-logs/2026-02-08/
  - All session summaries
```

### DELETE (No historical value)
- Duplicate status snapshots
- Temporary analysis files
- Redundant summaries of summaries

---

## Expected Outcome

### Before
- 218 markdown files in root
- 55 trash files
- 52 fragmented files
- 30+ activity docs, 8 memory docs, 16 v2 docs
- Unclear which docs are authoritative

### After
- ~60-70 markdown files in root
- 0 trash files (deleted or archived)
- 10 consolidated guides (3 activity, 2 memory, 2 v2, 3 other areas)
- Clear documentation hierarchy
- All claims validated against git history
- No Metabob MCP config in user docs

### File Reduction
- Root directory: 218 → 60-70 files (68% reduction)
- Trash: 55 → 0 (100% reduction)
- Activity docs: 28 → 3 (89% reduction)
- Memory docs: 8 → 2 (75% reduction)
- V2 docs: 16 → 2 (87% reduction)

---

## Risk Mitigation

### Safety Measures
1. **Git commit before starting** - Can revert if needed
2. **Archive, don't delete** - Historical docs go to `.archive/`
3. **Keep one authoritative doc per area** - Consolidate into it
4. **Validate before consolidation** - Check claims against reality
5. **Review Metabob filtering** - Ensure no user-facing MCP config

### Validation Checkpoints
- [ ] Git history matches documentation claims
- [ ] All "COMPLETE" statuses have implementation proof
- [ ] Archive directories created with READMEs
- [ ] Consolidated guides are coherent
- [ ] No broken links in active docs
- [ ] No Metabob MCP config in user-facing docs
- [ ] Root directory count reduced significantly

---

## Next Steps

1. **Run validation** - Check doc claims vs git reality
2. **Create backup commit** - Safety first
3. **Execute cleanup** - Delete/archive trash files
4. **Consolidate documentation** - Merge fragmented docs
5. **Filter Metabob config** - Remove from user docs
6. **Create summary report** - Document what changed

---

**Status**: READY FOR EXECUTION  
**Estimated Time**: 2-3 hours  
**Risk Level**: LOW (archive-first approach)  
**Expected Impact**: Massive improvement in doc clarity
