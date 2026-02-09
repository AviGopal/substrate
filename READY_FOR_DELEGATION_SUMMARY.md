# Schema Alignment - Ready for Delegation

**Date**: 2026-02-08  
**Status**: ✅ All infrastructure complete, ready to assign tasks  
**Next Step**: Assign Task 1 to backend developer

---

## What's Complete

### ✅ Documentation Infrastructure
1. **DOCUMENTATION_INDEX.md** - Updated with schema alignment section
   - Lists all analysis, implementation, and observability docs
   - References task logs (to be created per-task)
   - Explains documentation agent responsibilities

2. **TASK_LOG_TEMPLATE.md** - Standardized template for task execution logs
   - Implementation log with timestamps
   - Issue tracking with severity levels
   - Decision documentation with reasoning
   - Documentation bug reporting for docs agent
   - Final summary with validation results

### ✅ Analysis & Root Cause (Complete)
- `ALGORITHMIC_VALIDATION_STRATEGY.md` - How to validate with evidence
- `ALGORITHMIC_VALIDATION_FINDINGS.md` - What validation revealed
- `SCHEMA_MISMATCH_ROOT_CAUSE.md` - Algorithmic proof of proto/backend divergence
- `CORRECT_ARCHITECTURE_DESIGN.md` - Design intent with impulse provenance

### ✅ Implementation Guides (Complete)
- `COMPLETE_SOLUTION_SUMMARY.md` - 4-phase plan (10 days)
- `SCHEMA_MISMATCH_ACTION_PLAN.md` - Step-by-step fixes
- `TASK_BREAKDOWN_PHASE1.md` - 4 tasks with copy-paste code
- `DELEGATION_STRATEGY.md` - Assignment and tracking approach

### ✅ Observability Design (Complete)
- `EXECUTION_OBSERVABILITY_PROPOSAL.md` - Stage-based logging
- `OBSERVABILITY_SOLUTION_SUMMARY.md` - Breadcrumb system
- `BREADCRUMB_QUICK_START.md` - Implementation guide

### ✅ Validation Baseline
- Ran `validate-activity-execution-algorithmic.ts`
- Current state: NO executions (expected - templates can't be created)
- Break point: Position 1 (422 schema errors block creation)

---

## How Delegation Works

### For Each Task

**1. Agent receives**:
- Task ID (e.g., `phase1-task1`)
- Task breakdown from `TASK_BREAKDOWN_PHASE1.md`
- List of docs to read
- Clear acceptance criteria
- Validation commands

**2. Agent creates task log**:
```bash
cp TASK_LOG_TEMPLATE.md TASK_PHASE1_TASK1_LOG.md
```

**3. Agent works and logs**:
- Every implementation decision → logged with reasoning
- Every issue encountered → logged with resolution
- Every doc problem found → flagged for docs agent
- All files modified → listed with explanations
- Validation results → recorded with evidence

**4. Agent completes**:
- Final summary in task log
- Updates DOCUMENTATION_INDEX.md (mark task complete)
- Provides evidence validation passed
- Notes any blockers for next task

**5. Documentation agent (background)**:
- Scans all task logs periodically
- Extracts doc issues flagged by task agents
- Annotates referenced docs with `[DOCS-AGENT NOTE]` sections
- Creates scan report: `DOCS_AGENT_SCAN_[DATE].md`

---

## Phase 1 Tasks Ready for Assignment

### Task 1: Create Proto Pydantic Models
**File**: `TASK_BREAKDOWN_PHASE1.md` - Task 1  
**Time**: 1 hour  
**Status**: 📝 Ready to assign  
**Dependencies**: None  

**Create**: `repos/metabob-rpc-api/server/models/proto_task_step.py`

**Deliverable**: Pydantic models matching proto exactly
- ProtoTaskStep with all nested models
- Includes `impulse_refs` field (critical for learning)

**Task log**: `TASK_PHASE1_TASK1_LOG.md` (agent creates from template)

**Validation**:
```bash
python -c "from server.models.proto_task_step import ProtoTaskStep; print('✅')"
```

---

### Task 2: Update API Endpoints
**File**: `TASK_BREAKDOWN_PHASE1.md` - Task 2  
**Time**: 1 hour  
**Status**: 📝 Ready to assign (after Task 1)  
**Dependencies**: Task 1 (needs proto models)

**Modify**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

**Deliverable**: API accepts proto schema
- TemplateCreateRequest uses `List[ProtoTaskStep]`
- Old TemplateTask deprecated

**Task log**: `TASK_PHASE1_TASK2_LOG.md`

**Validation**:
```bash
curl -X POST .../templates -d '{"tasks": [<proto-schema>]}'
# Should return 201 (not 422)
```

---

### Task 3: Create Migration Script
**File**: `TASK_BREAKDOWN_PHASE1.md` - Task 3  
**Time**: 1 hour  
**Status**: 📝 Ready to assign (after Task 2)  
**Dependencies**: Task 2 (API must accept proto)

**Create**: `repos/metabob-rpc-api/scripts/migrate_templates_to_proto.py`

**Deliverable**: Safe migration of existing data
- Converts old schema → proto schema
- Idempotent (can run multiple times)
- Dry-run mode

**Task log**: `TASK_PHASE1_TASK3_LOG.md`

**Validation**:
```bash
python scripts/migrate_templates_to_proto.py --dry-run
# Should show conversion plan without errors
```

---

### Task 4: End-to-End Validation
**File**: `TASK_BREAKDOWN_PHASE1.md` - Task 4  
**Time**: 30 minutes  
**Status**: 📝 Ready to assign (after Tasks 1-3)  
**Dependencies**: All previous tasks

**Create**: `test-phase1-validation.ts`

**Deliverable**: Proof schema alignment works
- OpenCode creates templates successfully
- Backend stores proto schema
- All proto fields present

**Task log**: `TASK_PHASE1_TASK4_LOG.md`

**Validation**:
```bash
bun run test-phase1-validation.ts
# Should output: === Phase 1 Validation: PASSED ===
```

---

## Assignment Template

When assigning a task, send this:

```
TASK ASSIGNMENT

Task: [Task Name from breakdown]
Task ID: phase1-task[N]
Agent: [Agent name]
Time Estimate: [X hours]

BEFORE STARTING:
1. Read TASK_BREAKDOWN_PHASE1.md - Task [N] section (full details)
2. Read referenced docs (listed in task breakdown)
3. Create your task log: cp TASK_LOG_TEMPLATE.md TASK_PHASE1_TASK[N]_LOG.md
4. Review acceptance criteria (checklist in breakdown)

WHILE WORKING:
- Log every decision in your task log with reasoning
- Log every issue with resolution
- Flag any doc problems for documentation agent
- Record files modified with explanations

WHEN COMPLETE:
1. Final summary in task log with validation evidence
2. Update DOCUMENTATION_INDEX.md (mark task complete)
3. Run validation command from breakdown
4. Report: "Task [N] complete" with link to task log

VALIDATION:
[Command from task breakdown]

Expected result: [Pass criteria]

QUESTIONS?
- Full details: TASK_BREAKDOWN_PHASE1.md - Task [N]
- Context: SCHEMA_MISMATCH_ROOT_CAUSE.md
- Design: CORRECT_ARCHITECTURE_DESIGN.md
```

---

## Documentation Agent Setup

### What Docs Agent Does

**Periodic scans** (e.g., every 6 hours or on-demand):
1. Read all `TASK_*_LOG.md` files
2. Extract flagged documentation issues
3. Annotate referenced docs with `[DOCS-AGENT NOTE]` sections
4. Create scan report: `DOCS_AGENT_SCAN_[DATE].md`

### Annotation Format

When task log flags an issue in a doc:
```markdown
---
[DOCS-AGENT NOTE - 2026-02-08]
**Source**: TASK_PHASE1_TASK2_LOG.md (line 123)
**Issue**: Example code uses deprecated TemplateTask class
**Severity**: MEDIUM (causes confusion)
**Recommendation**: Update example to use ProtoTaskStep
**Status**: 📝 Pending human review
---
```

### Scan Report Format

`DOCS_AGENT_SCAN_2026-02-08.md`:
```markdown
# Documentation Agent Scan - 2026-02-08

## Task Logs Reviewed
- TASK_PHASE1_TASK1_LOG.md - ✅ Complete (no issues)
- TASK_PHASE1_TASK2_LOG.md - ✅ Complete (3 doc issues found)

## Issues Found: 3

### HIGH Priority: 0
(none)

### MEDIUM Priority: 3
1. SCHEMA_MISMATCH_ROOT_CAUSE.md - Example uses old schema
2. TASK_BREAKDOWN_PHASE1.md - Import path incorrect
3. CORRECT_ARCHITECTURE_DESIGN.md - Missing field in example

## Documents Annotated: 3
- SCHEMA_MISMATCH_ROOT_CAUSE.md - 1 note added
- TASK_BREAKDOWN_PHASE1.md - 1 note added
- CORRECT_ARCHITECTURE_DESIGN.md - 1 note added

## Recommendations
1. Review annotated docs and update examples
2. Task 3 may encounter same import issue - check preemptively
```

---

## Success Criteria (Phase 1)

Phase 1 is complete when:

- [x] Task 1 complete: Proto models exist, import test passes
- [x] Task 2 complete: API accepts proto, no 422 errors
- [x] Task 3 complete: Migration script works, dry-run passes
- [x] Task 4 complete: E2E test passes
- [x] Validation script confirms: Templates can be created
- [x] All task logs finalized
- [x] Documentation agent has scanned and annotated

**Evidence required**:
```bash
# This must pass:
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run test-phase1-validation.ts

# Output should show:
=== Phase 1 Validation: PASSED ===
✅ Template created successfully
✅ Template retrieved successfully  
✅ All proto fields present
```

---

## Current State

### Validation Baseline
```
Position 1: activity tool invocation ❌ FAIL
  - "started activity execution via MCP" - Found 0 times
  
REASON: Templates can't be created (422 schema errors)
```

### After Phase 1 (Expected)
```
Position 1: activity tool invocation ✅ (or still FAIL but different reason)
  - Templates CAN be created (no 422 errors)
  - May still be 0 executions (that's Phase 2+ work)
  - But schema alignment proven working
```

---

## Next Steps

1. **Assign Task 1** to backend developer
   - Use assignment template above
   - Point to TASK_BREAKDOWN_PHASE1.md - Task 1
   - Agent creates TASK_PHASE1_TASK1_LOG.md

2. **Wait for Task 1 completion**
   - Agent runs validation: import test
   - Agent updates task log with results
   - Agent marks task complete in DOCUMENTATION_INDEX.md

3. **Assign Task 2** (depends on Task 1)
   - Same process

4. **Continue through Tasks 3-4**

5. **Final validation**:
   ```bash
   bun run test-phase1-validation.ts
   ```

6. **Documentation agent scan**:
   - Review all task logs
   - Annotate docs
   - Create scan report

7. **Phase 1 complete** → Proceed to Phase 2

---

## File Locations

**Documentation**:
- `/home/avi/documents/work/exp-repo/metabob-devbob/DOCUMENTATION_INDEX.md`
- `/home/avi/documents/work/exp-repo/metabob-devbob/TASK_LOG_TEMPLATE.md`
- `/home/avi/documents/work/exp-repo/metabob-devbob/TASK_BREAKDOWN_PHASE1.md`

**Task Logs** (created per-task):
- `/home/avi/documents/work/exp-repo/metabob-devbob/TASK_PHASE1_TASK[1-4]_LOG.md`

**Validation**:
- `/home/avi/documents/work/exp-repo/metabob-devbob/validate-activity-execution-algorithmic.ts`

**Code to modify**:
- `repos/metabob-rpc-api/server/models/proto_task_step.py` (NEW)
- `repos/metabob-rpc-api/server/routes/v2_activities.py` (MODIFY)
- `repos/metabob-rpc-api/scripts/migrate_templates_to_proto.py` (NEW)

---

## Summary

**✅ Ready to delegate**: All infrastructure, docs, templates, and validation are in place.

**What each agent needs**:
1. Task ID and breakdown reference
2. TASK_LOG_TEMPLATE.md to copy
3. List of docs to read (in breakdown)
4. Clear validation command

**What each agent produces**:
1. Code changes (specified in breakdown)
2. Complete task log with decisions, issues, validations
3. Doc issue flags for documentation agent
4. Evidence validation passed

**What documentation agent does**:
1. Scans task logs for doc issues
2. Annotates referenced docs
3. Creates scan reports
4. Helps maintain doc quality

**Estimated Phase 1 duration**: 3.5 hours (4 tasks, some can parallel after dependencies met)

**Ready to start**: Assign Task 1 now!
