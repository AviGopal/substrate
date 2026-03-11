# Trace: Non-Trailblazing Session Tracking

## Specification
**Name:** Non-Trailblazing Session Tracking
**Status:** ❌ INCOMPLETE - Session tracking exists in LLM-assisted path but NOT in deterministic path
**Fix Commit:** dab595c1 (partial fix - only added task completion logging)

## Summary
The non-trailblazing execution path has TWO sub-paths:
1. **Deterministic execution** (lines 2670-2725) - NO session tracking ❌
2. **LLM-assisted execution** (lines 2728-3100) - HAS session tracking (lines 2931-2987) ✅

The validation failure occurs because:
- Deterministic tasks (no prompt, has toolSequence) execute via `executeTaskDeterministic()`
- This path updates totals, logs completion, but NEVER populates `executionEvidence.sessionsSpawned`
- Validation harness expects sessionsSpawned.length === task count, finds length === 0

## Components Traced

### 1. Deterministic Execution Path
**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Lines:** 2670-2725  
**Entry Point:** Line 2670 - `if (!hasPrompt && hasToolSequence)`

**Current Flow:**
```
2676: executeTaskDeterministic() called
      ↓
2683-2688: Extract duration, update totalCost, totalDuration, totalTokens
      ↓
2690-2700: Update taskResults array with status
      ↓
2702: Call onStatusUpdate callback
      ↓
2704-2720: Check if deterministicResult.success === false, handle failure
      ↓
2722: log.info("deterministic task completed successfully")
      ↓
❌ MISSING: Session tracking code (should be here)
      ↓
2725: continue (skip to next task)
```

**Missing Code Block:**
After line 2722, need to add ~60 lines of session tracking:
- Check `_activity.executionEvidence` exists
- Extract `sessionID` from scope (already available from line 2679 parameter)
- Add `sessionID` to `_activity.sessionIDs` array if not present
- Push session object to `executionEvidence.sessionsSpawned` with 9 fields:
  - sessionID
  - taskId
  - agentType (task.subagent)
  - startTime (from line 2345)
  - endTime (Date.now())
  - messageCount (via getSessionMessageCount)
  - toolCallCount (via getSessionToolCallCount)
  - duration (from line 2683)
  - cost (from line 2685, always 0 for deterministic)
- Extract tool calls from session messages
- Save activity with `Activity.save(_activity)`

### 2. LLM-Assisted Execution Path ✅
**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Lines:** 2728-3100  
**Entry Point:** Line 2728 - LLM-assisted execution (hasPrompt || !hasToolSequence)

**Current Flow (CORRECT):**
```
2733: Merge variables
      ↓
2752: Load impulses
      ↓
2779-2793: Pre-flight validation
      ↓
2810-2835: Interpolate prompt, inject impulses and reason
      ↓
2838-2871: Get agent, validate tools
      ↓
2888-2910: TaskTool.execute() - delegates to agent
      ↓
2921-2929: Extract metrics, update totals
      ↓
✅ 2931-2987: SESSION TRACKING CODE BLOCK (correct implementation)
      ↓
2991-3002: Task completion log with metrics
      ↓
3014-3046: Post-execution and legacy validation
      ↓
3051-3084: Extract task output for variable inheritance
      ↓
3087-3107: Update taskResults status
```

**Session Tracking Block (lines 2931-2987):**
```typescript
// Track session for correctness validation
if (_activity.executionEvidence && taskResult.metadata?.sessionId) {
  const subsessionID = taskResult.metadata.sessionId
  
  // Track task session in activity.sessionIDs for orchestration
  if (!_activity.sessionIDs.includes(subsessionID)) {
    _activity.sessionIDs.push(subsessionID)
  }
  
  _activity.executionEvidence.sessionsSpawned.push({
    sessionID: subsessionID,
    taskId,
    agentType: task.subagent,
    startTime,
    endTime: Date.now(),
    messageCount: await getSessionMessageCount(subsessionID),
    toolCallCount: await getSessionToolCallCount(subsessionID),
    duration,
    cost,
  })
  
  log.debug("tracked session for correctness validation", {
    taskId,
    sessionID: subsessionID,
    messageCount: _activity.executionEvidence.sessionsSpawned[_activity.executionEvidence.sessionsSpawned.length - 1].messageCount,
    toolCallCount: _activity.executionEvidence.sessionsSpawned[_activity.executionEvidence.sessionsSpawned.length - 1].toolCallCount,
  })
  
  // Track individual tool calls for correctness validation
  try {
    const messages = await Session.messages({ sessionID: subsessionID })
    for (const message of messages) {
      if (message.info.role === 'assistant') {
        for (const part of message.parts) {
          if (part.type === 'tool' && part.tool) {
            _activity.executionEvidence.toolCalls.push({
              sessionID: subsessionID,
              tool: part.tool,
              timestamp: message.info.time.created || Date.now(),
            })
          }
        }
      }
    }
  } catch (error) {
    log.warn("failed to track tool calls", { sessionID: subsessionID, error })
  }
  
  await Activity.save(_activity)
}
```

### 3. Helper Functions
**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Lines:** 2034-2054

```typescript
async function getSessionMessageCount(sessionID: string): Promise<number> {
  try {
    const messages = await Session.messages({ sessionID })
    return messages.length
  } catch {
    return 0
  }
}

async function getSessionToolCallCount(sessionID: string): Promise<number> {
  try {
    const messages = await Session.messages({ sessionID })
    return messages.filter(m => m.info.role === 'assistant' && m.info.summary).length
  } catch {
    return 0
  }
}
```

### 4. executeTaskDeterministic Function
**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Lines:** 2071-2208

**Signature:**
```typescript
async function executeTaskDeterministic(
  task: ActivityTemplate.Task,
  variables: Record<string, unknown>,
  sessionID: string,  // ← sessionID is passed in but NOT returned
  abortSignal: AbortSignal,
): Promise<{
  success: boolean
  duration: number
  cost: number  // Always 0 for deterministic
  tokens: { input: number; output: number; cache: number }  // Always 0s
  toolCallResults: Array<{ tool: string; success: boolean; output?: any; error?: string }>
  // ❌ NO sessionID field in return type
}>
```

**Key Finding:** The `sessionID` is available in the calling scope (passed as parameter at line 2679), so session tracking CAN access it even though it's not returned.

### 5. Session ID Scope
**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`  
**Lines:** 531-538

```typescript
// Create dedicated session for activity execution
const activitySession = await Session.createForActivity({
  title: `Activity: ${template.name}`,
  callingSessionID: ctx.sessionID,
  activityId: "",
})
let sessionID = activitySession.id  // ← ONE session for entire activity
```

**Important:** In non-trailblazing mode, ALL tasks share the SAME sessionID (the activity session). This is different from trailblazing mode where each task gets its own session.

## Data Flow Diagram

```
Activity Start (line 538)
  └─ sessionID = activitySession.id (ONE session for all tasks)
       ↓
  Task Loop (line 2328)
    └─ for each taskId in topological order
         ↓
    Task Start (line 2345)
      └─ startTime = Date.now()
           ↓
    Branch on execution mode (line 2670)
      ├─ Deterministic (!hasPrompt && hasToolSequence)
      │    ↓
      │  executeTaskDeterministic(task, vars, sessionID, abort)
      │    ↓
      │  Update totals (lines 2683-2688)
      │    ↓
      │  Update taskResults (lines 2690-2700)
      │    ↓
      │  Handle failure (lines 2704-2720)
      │    ↓
      │  Log completion (line 2722)
      │    ↓
      │  ❌ MISSING: Track session in sessionsSpawned
      │    ↓
      │  continue to next task (line 2725)
      │
      └─ LLM-Assisted (hasPrompt || !hasToolSequence)
           ↓
         Merge variables, load impulses (lines 2733-2752)
           ↓
         Pre-flight validation (lines 2779-2793)
           ↓
         Interpolate prompt (lines 2805-2835)
           ↓
         Get agent, validate tools (lines 2838-2871)
           ↓
         TaskTool.execute(prompt, sessionID) (line 2888)
           ↓
         Extract metrics (lines 2921-2929)
           ↓
         ✅ Track session in sessionsSpawned (lines 2931-2987)
           ↓
         Task completion log (lines 2991-3002)
           ↓
         Post-execution validation (lines 3014-3046)
           ↓
         Extract task output (lines 3051-3084)
           ↓
         Update taskResults (lines 3087-3107)
```

## Root Cause

**Issue:** Deterministic execution path missing session tracking code

**Evidence:**
1. Commit dab595c1 only added task completion logging at line 2991-3002
2. Session tracking code at lines 2931-2987 was added ONLY for LLM-assisted path
3. Deterministic path has NO session tracking between line 2722 and 2725
4. Validation harness shows sessionsSpawned.length === 0 for deterministic tasks

**Impact:**
- Activities using deterministic tasks fail correctness validation
- sessionsSpawned array stays empty
- Correctness verdict is 'incorrect' instead of 'correct' or 'likely-correct'
- Analytics and learning loop miss execution data for deterministic tasks

**Affected Activities:**
Any activity template with tasks that have:
- `toolSequence` defined (array of tool calls)
- NO `prompt` field (deterministic execution)

## Solution

**Approach:** Add session tracking code to deterministic execution path

**Implementation:**
1. **Location:** After line 2722 ("deterministic task completed successfully")
2. **Before:** Line 2725 (continue statement)
3. **Code to add:** ~60 lines matching structure at lines 2931-2987

**Detailed Steps:**
1. Check `_activity.executionEvidence` exists (should always be true from line 578 initialization)
2. Use `sessionID` from scope (available at line 2679 as parameter)
3. Check if `sessionID` is already in `_activity.sessionIDs` array
4. If not, add it: `_activity.sessionIDs.push(sessionID)`
5. Create session entry object with 9 required fields
6. Push to `_activity.executionEvidence.sessionsSpawned`
7. Log debug message with session tracking confirmation
8. Extract tool calls from session messages (loop through Session.messages)
9. Add tool calls to `_activity.executionEvidence.toolCalls`
10. Save activity: `await Activity.save(_activity)`

**Code Template:**
```typescript
// After line 2722, before line 2725:

// Track session for correctness validation (deterministic execution)
if (_activity.executionEvidence) {
  // Use sessionID from scope (passed as parameter at line 2679)
  const subsessionID = sessionID
  
  // Track task session in activity.sessionIDs for orchestration
  if (!_activity.sessionIDs.includes(subsessionID)) {
    _activity.sessionIDs.push(subsessionID)
  }
  
  _activity.executionEvidence.sessionsSpawned.push({
    sessionID: subsessionID,
    taskId,
    agentType: task.subagent,
    startTime,  // Available from line 2345
    endTime: Date.now(),
    messageCount: await getSessionMessageCount(subsessionID),
    toolCallCount: await getSessionToolCallCount(subsessionID),
    duration,  // Available from line 2683
    cost: deterministicResult.cost,  // Available from line 2685 (always 0)
  })
  
  log.debug("tracked session for correctness validation (deterministic)", {
    taskId,
    sessionID: subsessionID,
    messageCount: _activity.executionEvidence.sessionsSpawned[
      _activity.executionEvidence.sessionsSpawned.length - 1
    ].messageCount,
    toolCallCount: _activity.executionEvidence.sessionsSpawned[
      _activity.executionEvidence.sessionsSpawned.length - 1
    ].toolCallCount,
  })
  
  // Track individual tool calls for correctness validation
  try {
    const messages = await Session.messages({ sessionID: subsessionID })
    for (const message of messages) {
      if (message.info.role === 'assistant') {
        for (const part of message.parts) {
          if (part.type === 'tool' && part.tool) {
            _activity.executionEvidence.toolCalls.push({
              sessionID: subsessionID,
              tool: part.tool,
              timestamp: message.info.time.created || Date.now(),
            })
          }
        }
      }
    }
    log.debug("tracked tool calls for deterministic task", {
      taskId,
      sessionID: subsessionID,
      toolCallsTotal: _activity.executionEvidence.toolCalls.length,
    })
  } catch (error) {
    log.warn("failed to track tool calls for deterministic task", { 
      sessionID: subsessionID, 
      error 
    })
  }
  
  await Activity.save(_activity)
}
```

## Validation Criteria

After implementing the fix, validation harness should pass ALL checks:

1. **✅ Task completion logs present**
   - Verify: `log.info` calls with taskId, duration, cost, usedTrailblazing: false
   - Lines: 2991-3002 (already working from dab595c1)

2. **✅ sessionsSpawned array populated**
   - Verify: `executionEvidence.sessionsSpawned.length === number of tasks`
   - Each entry has 9 required fields
   - Field: `sessionID` - string (activity session ID)
   - Field: `taskId` - string (task identifier)
   - Field: `agentType` - string (task.subagent)
   - Field: `startTime` - number (timestamp in ms)
   - Field: `endTime` - number (timestamp in ms)
   - Field: `messageCount` - number (from getSessionMessageCount)
   - Field: `toolCallCount` - number (from getSessionToolCallCount)
   - Field: `duration` - number (task duration in ms)
   - Field: `cost` - number (task cost in USD, 0 for deterministic)

3. **✅ Correctness verdict NOT 'incorrect'**
   - Verify: Activity.correctnessVerdict is 'correct' or 'likely-correct'
   - Driven by sessionsSpawned and toolCalls arrays being populated

4. **✅ Activity storage persists**
   - Verify: `Activity.save()` called after populating sessionsSpawned
   - Verify: Reload activity from storage shows sessionsSpawned data

## References

### Working Implementation
- **File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
- **Lines:** 2931-2987 (LLM-assisted path session tracking)
- **Lines:** 2449-2502 (Trailblazing path session tracking - similar structure)

### Validation Harness
- **File:** `tests/validation-harnesses/task-completion-logging-fix-verification-harness.ts`
- **Lines:** 328-358 (sessionsSpawned validation checks)

### Helper Functions
- **File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
- **Lines:** 2034-2041 (getSessionMessageCount)
- **Lines:** 2046-2054 (getSessionToolCallCount)

### Related Files
- **File:** `repos/metabob-opencode/packages/opencode/src/tool/task.ts`
- **Lines:** 321-330 (TaskTool return structure with metadata.sessionId)

## Trace Impulse

**Impulse ID:** `trace-Non-Trailblazing Session Tracking`
**Type:** templateDefinition
**Budget:** 5000 tokens
**Content:** This markdown document

## Next Steps for Enforcement Task

1. Open `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
2. Navigate to line 2722 (after "deterministic task completed successfully" log)
3. Insert session tracking code block (60 lines from template above)
4. Test with validation harness: `task-completion-logging-fix-verification-harness.ts`
5. Verify sessionsSpawned.length === expected task count
6. Verify correctness verdict is not 'incorrect'
7. Commit with message: "Add session tracking to deterministic execution path"
8. Run validation in fresh session to confirm fix completeness
