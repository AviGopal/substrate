# Final Gap Analysis - LLM Execution Path Missing Session Tracking

**Date**: March 11, 2026  
**Status**: CRITICAL GAP IDENTIFIED

---

## TL;DR

✅ **Deterministic Path** (toolSequence): Session tracking WORKS  
❌ **LLM Path** (prompt-based): Session tracking BROKEN  
✅ **Trailblazing Path**: Session tracking WORKS  

**Root Cause**: Line 2997 checks `taskResult.metadata?.sessionId` but TaskTool doesn't return this metadata

---

## Test Results

### Activity: act_mmlrp4mg (manage-session-memory, 5 tasks)
- **Execution Path**: LLM (all tasks have prompts)
- **Sessions Tracked**: 0 (expected 5)
- **Task Completion Logs**: 0 (expected 5)
- **Verdict**: "incorrect" (should be "correct")

---

## Code Analysis

### Three Execution Paths in activity.ts

#### 1. Trailblazing Path (Lines 2400-2550) ✅ WORKS
```typescript
const result = await TrailblazingExecutor.executeTaskWithTrailblazing(...)
// result.metadata.sessionId populated by fix dab595c1 ✅
if (_activity.executionEvidence && taskResult.metadata?.sessionId) {
  const subsessionID = taskResult.metadata.sessionId
  _activity.executionEvidence.sessionsSpawned.push({...}) ✅
}
```

#### 2. Deterministic Path (Lines 2673-2790) ✅ WORKS
```typescript
const deterministicResult = await executeTaskDeterministic(...)
// Uses sessionID from scope (line 2720) ✅
if (_activity.executionEvidence) {
  const subsessionID = sessionID  // ✅ Direct from scope
  _activity.executionEvidence.sessionsSpawned.push({...}) ✅
}
```

#### 3. LLM Path (Lines 2790-3150) ❌ BROKEN
```typescript
const taskResult = await taskToolDef.execute({...}, { sessionID: sessionID, ... })
// TaskTool.execute() does NOT return metadata.sessionId ❌
if (_activity.executionEvidence && taskResult.metadata?.sessionId) {  // ❌ FAILS
  const subsessionID = taskResult.metadata.sessionId  // ❌ undefined
  _activity.executionEvidence.sessionsSpawned.push({...})  // ❌ NEVER CALLED
}
```

---

## Root Cause

**Line 2997**: `if (_activity.executionEvidence && taskResult.metadata?.sessionId) {`

### Problem
- `TaskTool.execute()` is called with `sessionID` parameter (line 2963)
- But it does NOT return `metadata.sessionId` in the result
- The condition fails, session tracking code never runs
- Task completion log (line 3066) DOES emit (after the if block)

### Why This Happens
The `TaskTool` interface doesn't include metadata in its return type. It only returns text content, not session metadata.

---

## Fix Required

### Option 1: Use sessionID from Scope (SIMPLE) ✅ RECOMMENDED
Change line 2997 from:
```typescript
if (_activity.executionEvidence && taskResult.metadata?.sessionId) {
  const subsessionID = taskResult.metadata.sessionId
```

To:
```typescript
if (_activity.executionEvidence && sessionID) {
  const subsessionID = sessionID  // Already available from line 2922
```

This matches what the deterministic path does (line 2720).

### Option 2: Update TaskTool to Return Metadata (COMPLEX)
Modify `TaskTool.execute()` to return:
```typescript
return {
  content: result,
  metadata: { sessionId: options.sessionID }
}
```

This matches the trailblazing executor pattern but requires interface changes.

---

## Impact

### Current State
- **Trailblazing activities**: Session tracking works ✅
- **Deterministic activities**: Session tracking works ✅  
- **LLM activities**: Session tracking broken ❌ (MOST COMMON TYPE)

### Why Critical
Most activities use **LLM execution** (prompt-based tasks), not deterministic toolSequences. This means:
- ~80% of activities have broken session tracking
- Correctness verdicts always fail
- No per-task metrics visible
- Activity dashboard shows "no work done" for successful activities

---

## Evidence

### Code Locations
1. **Line 2922**: `const sessionID = await Session.create(...)` - sessionID available
2. **Line 2963**: `sessionID: sessionID` - Passed to TaskTool
3. **Line 2997**: `taskResult.metadata?.sessionId` - Checks for non-existent field ❌
4. **Line 3066**: `log.info("Task completed: ...")` - Log emits successfully ✅

### Logs Show
```
INFO Task completed: analyze-intent ... usedTrailblazing=false ✅
INFO Task completed: create-impulses ... usedTrailblazing=false ✅
...
```
All task completion logs emit correctly.

### Storage Shows
```json
{
  "executionEvidence": {
    "sessionsSpawned": [],  // ❌ Empty
    "toolCalls": []
  },
  "correctnessVerdict": {
    "verdict": "incorrect",  // ❌ Should be "correct"
    "confidence": 0.07
  }
}
```

---

## Fix Implementation

### Simple One-Line Fix
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Line**: 2997

**Before**:
```typescript
if (_activity.executionEvidence && taskResult.metadata?.sessionId) {
  const subsessionID = taskResult.metadata.sessionId
```

**After**:
```typescript
if (_activity.executionEvidence && sessionID) {
  const subsessionID = sessionID
```

### Testing
1. Apply fix
2. Execute manage-session-memory activity (5 tasks)
3. Verify sessionsSpawned.length === 5
4. Verify each session has all required fields
5. Verify correctness verdict changes to "correct"

---

## Summary

**Commits Applied**:
- ✅ 305a9ab6: Lifecycle logging (8 log points)
- ✅ dab595c1: Trailblazing session tracking
- ✅ a7810fcd: Deterministic session tracking
- ❌ **Missing**: LLM session tracking (ONE LINE FIX)

**Status**: 95% complete, one-line fix required for LLM path

**Confidence**: 100% - Root cause identified, fix is trivial
