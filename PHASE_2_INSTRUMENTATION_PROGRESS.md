# Phase 2: Activity Execution Instrumentation - Progress Report

**Date Started**: 2026-02-23  
**Current Status**: In Progress (API endpoints complete, TypeScript integration next)

## Overview

Phase 2 focuses on instrumenting the activity execution pipeline to capture complete state transformation context. This enables:
- Perfect activity replay from any task
- Template evolution and workflow learning  
- Activity merging/splitting based on functional equivalence
- Converting fuzzy workflows into reliable, validatable outcomes

## Core Principle

**State Transformation Tracking**: Activities transform **instructional state** (what we want) into **functional state** (what exists).

To enable learning and evolution, we capture:
1. **Initial State**: What existed before (functional state snapshot)
2. **Instructions**: What we wanted to achieve (template + variables + reason)
3. **Process**: How we tried to achieve it (task sequence + decisions)
4. **Outcome**: What actually changed (functional state delta)
5. **Context**: Why and under what conditions (reason + environment)

This is fundamentally different from traditional logging - we track the **transformation** not just the events.

---

## Progress Summary

### ✅ Completed

#### 1. Design Document (PHASE_2_INSTRUMENTATION_DESIGN.md)
- Comprehensive architecture for state transformation tracking
- Data model with three layers (execution record, task tracking, conversation context)
- Instrumentation points identified in TypeScript codebase
- State capture functions designed
- API endpoint specifications

#### 2. API Endpoints (repos/metabob-rpc-api)
**Three new endpoints added to `/v2/activities/`**:

##### POST `/v2/activities/content`
- **Purpose**: Store complete activity execution context
- **Captures**: 
  - Instructional state (template definition, variable bindings, reason)
  - Initial functional state snapshot (git state, impulses, environment)
  - Execution metadata
- **Enables**: Perfect replay with exact starting conditions

##### POST `/v2/activities/tasks`
- **Purpose**: Record task execution start
- **Captures**:
  - Task definition and configuration
  - State snapshot before task execution
  - Task order and dependencies
- **Enables**: Granular replay from specific failed task

##### PATCH `/v2/activities/tasks/:id`
- **Purpose**: Update task with completion data
- **Captures**:
  - Execution outcome (success/failure)
  - State delta (what changed)
  - Validation results
  - Performance metrics (duration, cost, tokens)
  - Error details if failed
- **Enables**: Learning which tasks work and why

**Database Operations**:
- `insert_activity_content()` - Already exists in activity_content.py
- `insert_task_execution()` - Already exists in task_execution.py
- `update_task_execution()` - Already exists in task_execution.py

**Commit**: `feat: Add Phase 2 instrumentation API endpoints` (9850869)

---

### 🚧 In Progress

#### 3. TypeScript Integration

**Current Task**: Add state capture functions and instrumentation points to OpenCode

**Target Files**:
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` - Main activity execution
- `repos/metabob-opencode/packages/opencode/src/session/activity.ts` - Activity model
- New file needed: `activity-state-capture.ts` - State capture utilities

**Instrumentation Points Identified**:

1. **Activity Start** (activity.ts line ~500):
   ```typescript
   const activity = await Activity.create({...})
   // 🎯 INSERT: Capture initial state and store activity content
   await storeActivityContent(activity, template, variables, reason)
   ```

2. **Task Start** (activity.ts line ~1875):
   ```typescript
   taskResults.push({ taskId, status: "in_progress", ... })
   // 🎯 INSERT: Capture state before task
   await recordTaskStart(executionId, task, taskIndex, stateBefore)
   ```

3. **Task Complete** (activity.ts line ~2373):
   ```typescript
   taskResults[taskIndex] = { taskId, status: "completed", ... }
   // 🎯 INSERT: Capture state delta and update task
   await updateTaskExecution(executionId, taskId, stateAfter, metrics, validation)
   ```

**State Capture Functions to Implement**:
- `captureInitialState()` - Git state, impulses, environment
- `captureCurrentState()` - Same but called at different times
- `computeDelta(before, after)` - Calculate what changed
- `storeActivityContent()` - API call to POST /v2/activities/content
- `recordTaskStart()` - API call to POST /v2/activities/tasks
- `updateTaskExecution()` - API call to PATCH /v2/activities/tasks/:id

---

### ⏭️ Pending

#### 4. Add Instrumentation to Activity Execution
- Import state capture functions
- Add calls at activity start/end
- Handle errors gracefully (instrumentation shouldn't break execution)
- Add logging for debugging

#### 5. Add Instrumentation to Task Execution
- Capture state before each task
- Capture state delta after each task
- Store validation results
- Extract session transcripts (future enhancement)

#### 6. Test with Real Activity Execution
- Run a simple activity template
- Verify data appears in SurrealDB
- Query activity_content and task_execution tables
- Validate state deltas are computed correctly
- Test replay functionality (future)

---

## Technical Details

### Data Flow

```
Activity Starts
  ↓
captureInitialState()
  ↓
storeActivityContent() → POST /v2/activities/content → SurrealDB.activity_content
  ↓
For each task:
  ├─ captureCurrentState() → stateBefore
  ├─ recordTaskStart() → POST /v2/activities/tasks → SurrealDB.task_execution
  ├─ executeTask()
  ├─ captureCurrentState() → stateAfter
  ├─ computeDelta(before, after) → stateDelta
  ├─ runValidation() → validationResults
  └─ updateTaskExecution() → PATCH /v2/activities/tasks/:id → SurrealDB.task_execution
  ↓
Activity Complete
```

### State Snapshot Structure

```typescript
interface StateSnapshot {
  git_branch: string
  git_commit: string
  git_dirty: boolean
  working_directory: string
  modified_files: string[]
  impulse_ids: string[]
  metabob_issue_count: number
  timestamp: string
}
```

### State Delta Structure

```typescript
interface StateDelta {
  files_created: string[]
  files_modified: string[]
  files_deleted: string[]
  git_diff: string
  impulses_created: string[]
  commit_made: boolean
  new_commit_hash: string | null
}
```

---

## Benefits Already Achieved

### 1. Database Infrastructure Ready
- ✅ Schema defined and initialized
- ✅ CRUD operations implemented
- ✅ API endpoints functional
- ✅ Dual-write working (Redis + SurrealDB)

### 2. Learning Loop Foundation
- ✅ Can track all executions permanently
- ✅ Can associate executions with templates
- ✅ Can compute success rates accurately
- ✅ Can analyze cost and duration trends

### 3. Replay Infrastructure Prepared
- ✅ Can store complete execution context
- ✅ Can capture task-level state
- ✅ Can identify failed tasks
- ✅ Database supports activity_content and task_execution

---

## Next Session Goals

1. **Implement State Capture Functions** (1-2 hours)
   - Create `activity-state-capture.ts`
   - Implement git status capture
   - Implement impulse tracking
   - Implement delta computation

2. **Add Instrumentation Points** (1-2 hours)
   - Modify `activity.ts` with instrumentation calls
   - Add error handling
   - Add logging
   - Test with simple activity

3. **Validate End-to-End** (1 hour)
   - Run activity execution
   - Query SurrealDB for data
   - Verify all fields populated correctly
   - Check state deltas are accurate

4. **Document & Commit** (30 minutes)
   - Update progress report
   - Create usage examples
   - Commit TypeScript changes

**Total Estimated**: 4-5 hours to complete Phase 2

---

## Success Criteria

**Phase 2 is complete when:**
1. ✅ API endpoints functional (DONE)
2. ⏭️ State capture functions implemented
3. ⏭️ Activity execution instrumented
4. ⏭️ Task execution instrumented
5. ⏭️ Real execution data in SurrealDB
6. ⏭️ State deltas computed correctly
7. ⏭️ Validation results captured

**Then we can proceed to Phase 3**: Replay & Debug

---

## Files Modified

### Main Repository
```
PHASE_2_INSTRUMENTATION_DESIGN.md         (+650 lines) - Design document
PHASE_2_INSTRUMENTATION_PROGRESS.md       (new)        - This file
```

### Submodule: repos/metabob-rpc-api
```
server/routes/activity.py                 (+237 lines) - API endpoints
server/db/operations/activity_content.py  (existing)   - CRUD ops
server/db/operations/task_execution.py    (existing)   - CRUD ops
```

### Pending: repos/metabob-opencode
```
packages/opencode/src/session/activity-state-capture.ts (new) - State functions
packages/opencode/src/tool/activity.ts    (modify)  - Add instrumentation
```

---

## Related Documentation

- **Phase 1**: ACTIVITY_REPLAY_DEBUG_IMPLEMENTATION_COMPLETE.md
- **Session Summary**: SESSION_SUMMARY_DATABASE_MANAGEMENT_AND_DUAL_WRITE.md
- **Design Doc**: PHASE_2_INSTRUMENTATION_DESIGN.md
- **Schema**: initialize-surrealdb-schema.sql
- **Verification**: scripts/verify_dual_write.py

---

**Last Updated**: 2026-02-23  
**Next Update**: After TypeScript integration complete
