# Session Summary: Correctness Validation - Architecture Discovery & Fix

## What Happened

### Initial Goal
Test the Phase 1.5 correctness validation system implementation to verify evidence collection works.

### Discovery Process
1. **Committed Phase 1.5** (verdict computation) ✅
2. **Ran test activity** (`ultra-simple-test`) ✅  
3. **Inspected activity file** - Found NO evidence fields ❌
4. **Root cause analysis** - Discovered architectural mismatch

### Root Cause Identified
**Phases 1.1-1.4 evidence collection code is in the wrong location**.

#### The Problem
- **Evidence collection implemented in**: `template-executor.ts`
- **Actual execution path uses**: `activity.ts` → local `executeTemplate()` function → `TaskTool.execute()`
- **Result**: `template-executor.ts` is NEVER called during activity execution
- **Evidence**: Zero imports of `template-executor.ts` in `activity.ts`

#### Execution Flow (Actual)
```
activity tool
  ↓
activity.ts::executeTemplate() [local function]
  ↓
TaskTool.execute()
  ↓
spawns session (sessionID in result.metadata.sessionId)
  ↓
[NO TRACKING HAPPENS - our code is in template-executor.ts]
```

### Current Status
- ✅ Phase 1.1: Schema added correctly (executionEvidence, validationEvidence, workArtifacts, correctnessVerdict)
- ✅ Phase 1.5: Verdict computation works (tested compilation)
- ❌ Phase 1.2: Session tracking in WRONG FILE (template-executor.ts instead of activity.ts)
- ❌ Phase 1.3: Validation logging likely also in wrong place
- ❌ Phase 1.4: File change tracking may be in wrong place

## Required Fix

### Fix Location
`activity.ts` after `TaskTool.execute()` completes (TWO places):
1. **Standard execution path** (line ~1630)
2. **Trailblazing execution path** (line ~1312)

### Implementation Plan

#### Step 1: Add Helper Functions to activity.ts
Import or define:
```typescript
async function getSessionMessageCount(sessionID: string): Promise<number>
async function getSessionToolCallCount(sessionID: string): Promise<number>
```

#### Step 2: Track Sessions After TaskTool Execution
Add after line 1629 (standard path):
```typescript
// Track session for correctness validation
if (_activity.executionEvidence && taskResult.metadata?.sessionId) {
  _activity.executionEvidence.sessionsSpawned.push({
    sessionID: taskResult.metadata.sessionId,
    taskId,
    agentType: task.subagent,
    startTime,
    endTime: Date.now(),
    messageCount: await getSessionMessageCount(taskResult.metadata.sessionId),
    toolCallCount: await getSessionToolCallCount(taskResult.metadata.sessionId),
  })
  
  await Activity.save(_activity)
}
```

#### Step 3: Same for Trailblazing Path
Add similar tracking in trailblazing execution path.

#### Step 4: Verify Other Evidence Collection
- Check Phase 1.3 validation logging location
- Check Phase 1.4 file change tracking location
- Ensure all evidence collection happens in activity.ts

### Testing Plan
1. Implement session tracking fix
2. Re-run `ultra-simple-test` activity
3. Inspect activity storage file
4. Verify fields present:
   - `executionEvidence.sessionsSpawned[0]` with sessionID, messageCount, toolCallCount
   - `correctnessVerdict` with verdict, confidence, issues

## Next Session Actions
1. Review this summary
2. Implement session tracking in activity.ts (both paths)
3. Check/fix validation logging location (Phase 1.3)
4. Check/fix file tracking location (Phase 1.4)
5. Test with ultra-simple-test
6. Document results

## Key Files
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode/src/tool/activity.ts` - FIX HERE
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode/src/session/template-executor.ts` - Evidence code here (WRONG PLACE)
- `~/.local/share/opencode/storage/activity/act_mlrcyw03_0bba12618622e0db.json` - Test activity (no evidence fields)

## Lessons Learned
- ✅ Always trace ACTUAL execution path, not assumed path
- ✅ Test immediately after each phase to catch issues early
- ✅ Verify imports - if module X doesn't import module Y, Y's code won't run
- ⚠️  We implemented 4 phases without testing until Phase 1.5
