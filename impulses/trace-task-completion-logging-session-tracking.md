# Trace Analysis: Task Completion Logging and Session Tracking

## Executive Summary
**Root Cause**: TrailblazingExecutor.executeTaskWithTrailblazing returns TaskResult without metadata.sessionId field, causing session tracking condition to fail at activity.ts:2878. This prevents sessionsSpawned from being populated and breaks correctness validation.

**Impact**: 
- 0 sessions tracked in multi-task activities using trailblazing
- Task output variable inheritance broken
- Correctness verdicts fail due to missing session data

**Solution**: Add metadata.sessionId to TrailblazingExecutor.TaskResult schema and return statements

---

## Specification
**Feature**: Task Completion Logging and Session Tracking  
**Lines**: activity.ts:2511 (logging), activity.ts:2877-2900 (tracking)  
**Requirement**: Every task in multi-task activities must emit completion logs and populate sessionsSpawned array with per-task metrics (duration, cost, sessionId, taskId, messageCount, toolCallCount)

---

## Component Analysis

### 1. TrailblazingExecutor.TaskResult Schema
**File**: `repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts:41-52`

**Current State**:
```typescript
export const TaskResult = z.object({
  success: z.boolean(),
  attempts: z.number(),
  duration: z.number(),
  cost: z.number(),
  tokens: z.object({
    input: z.number(),
    output: z.number(),
    cache: z.number(),
  }),
  recoveryAttempts: z.array(RecoveryAttempt).optional(),
  finalError: z.string().optional(),
})
```

**Desired State**:
```typescript
export const TaskResult = z.object({
  success: z.boolean(),
  attempts: z.number(),
  duration: z.number(),
  cost: z.number(),
  tokens: z.object({
    input: z.number(),
    output: z.number(),
    cache: z.number(),
  }),
  metadata: z.object({
    sessionId: z.string(),
  }).optional(),
  recoveryAttempts: z.array(RecoveryAttempt).optional(),
  finalError: z.string().optional(),
})
```

**Gap**: Add `metadata: { sessionId }` field

---

### 2. TrailblazingExecutor.executeTaskWithTrailblazing Return Statements
**File**: `repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts`

**Three Return Paths**:
1. **Success** (Line 220-227)
2. **Failure** (Line 246-254)
3. **Cost Limit Exceeded** (Line 265-273)

**Current State**: All three return paths missing metadata field

**Desired State**: All three should include:
```typescript
metadata: {
  sessionId: params.sessionID,
}
```

**Gap**: Add metadata.sessionId to all 3 return statements

---

### 3. Activity Execution - Trailblazing Path
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:2429-2522`

**Current Behavior**:
- Line 2429: Calls `TrailblazingExecutor.executeTaskWithTrailblazing()`
- Line 2444-2448: Updates cost/duration/tokens
- Line 2511-2522: Logs task completion ✅
- **MISSING**: No session tracking (result.metadata is undefined)

**Desired Behavior**: After line 2448, add:
```typescript
// Track session for correctness validation
if (_activity.executionEvidence && result.metadata?.sessionId) {
  const subsessionID = result.metadata.sessionId
  
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
    duration: result.duration,
    cost: result.cost,
  })
  
  log.debug("tracked session for correctness validation", {
    taskId,
    sessionID: subsessionID,
    messageCount: _activity.executionEvidence.sessionsSpawned[_activity.executionEvidence.sessionsSpawned.length - 1].messageCount,
    toolCallCount: _activity.executionEvidence.sessionsSpawned[_activity.executionEvidence.sessionsSpawned.length - 1].toolCallCount,
  })
  
  // Track tool calls from session
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
    log.warn("failed to extract tool calls from session", { taskId, error })
  }
}
```

**Gap**: Add session tracking code in trailblazing path

---

### 4. Activity Execution - Non-Trailblazing Path
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:2834-2903`

**Current Behavior**:
- Line 2834: Calls `taskToolDef.execute()` which returns metadata.sessionId ✅
- Line 2878-2903: Tracks session correctly ✅
- **MISSING**: No task completion logging

**Desired Behavior**: After line 2903, add:
```typescript
// ENFORCEMENT: Prominent task completion log with metrics for lifecycle visibility
log.info(`Task completed: ${taskId}`, {
  taskId,
  description: task.description,
  activityId: _activity.id,
  attempts: 1,
  duration,
  durationSeconds: Math.round(duration / 1000),
  cost,
  costFormatted: `$${cost.toFixed(4)}`,
  usedTrailblazing: false,
  success: true,
})
```

**Gap**: Add task completion logging in non-trailblazing path

---

### 5. Task Output Variable Inheritance
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:2984-3016`

**Current Behavior**:
- Depends on `taskResult.metadata?.sessionId`
- If undefined, silently fails with warning
- Variable inheritance (e.g., `analyzeIntentOutput`) broken

**Desired Behavior**:
Once TrailblazingExecutor returns metadata.sessionId, this will work automatically

**Gap**: Depends on TrailblazingExecutor fix

---

### 6. Reference Implementation: TaskTool.execute
**File**: `repos/metabob-opencode/packages/opencode/src/tool/task.ts:253-260, 321-330`

**Status**: ✅ CORRECT

Returns:
```typescript
return {
  title: params.description,
  metadata: {
    summary: all,
    sessionId: sessionID,  // ← This is what TrailblazingExecutor needs
    agent: agent.name,
    reusingSession: shouldReuseSession,
  },
  output: (result.parts.findLast((x: any) => x.type === "text") as any)?.text ?? "",
}
```

---

## Data Flow Comparison

### Trailblazing Path (BROKEN ❌)
```
Activity.execute (2429) 
  → TrailblazingExecutor.executeTaskWithTrailblazing (58)
  → TaskTool.execute (182) [internal]
  → Returns TaskResult WITHOUT metadata
  → result (2429) has NO metadata.sessionId
  → Condition fails: result.metadata?.sessionId
  → sessionsSpawned NOT populated ❌
  → Task output NOT captured ❌
```

### Non-Trailblazing Path (WORKS ✅)
```
Activity.execute (2834)
  → taskToolDef.execute
  → TaskTool.execute (37)
  → Returns WITH metadata.sessionId (321-330)
  → taskResult (2834) HAS metadata.sessionId
  → Condition succeeds: taskResult.metadata?.sessionId (2878)
  → sessionsSpawned populated ✅
  → Task output captured (2984) ✅
```

---

## Validation Evidence

**Test**: `tests/validation-harnesses/multi-task-activity-tracking-harness.ts`

**Result**: 
- Activity completed successfully
- **0 task completion logs** (should be 7)
- **0 sessions tracked** (should be 7)

**Expected**:
```javascript
activity.executionEvidence.sessionsSpawned = [
  {
    sessionID: "session_abc123",
    taskId: "task-1",
    agentType: "general",
    startTime: 1234567890,
    endTime: 1234567900,
    messageCount: 5,
    toolCallCount: 3,
    duration: 10000,
    cost: 0.05,
  },
  // ... 6 more
]
```

**Actual**:
```javascript
activity.executionEvidence.sessionsSpawned = []
```

---

## Fix Strategy

### Step 1: Update TrailblazingExecutor.TaskResult Schema ⚙️
**File**: `repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts:41-52`

Add:
```typescript
metadata: z.object({
  sessionId: z.string(),
}).optional(),
```

### Step 2: Update TrailblazingExecutor Return Statements ⚙️
**File**: `repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts`

**Location 1**: Line 220-227 (success)
**Location 2**: Line 246-254 (failure)
**Location 3**: Line 265-273 (cost limit)

Add to all three:
```typescript
metadata: {
  sessionId: params.sessionID,
},
```

### Step 3: Add Session Tracking in Trailblazing Path ⚙️
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**After line 2448**, add session tracking block (see Component 3 for full code)

### Step 4: Add Task Completion Logging in Non-Trailblazing Path ⚙️
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**After line 2903**, add task completion log (see Component 4 for full code)

### Step 5: Validation ✅
Run and verify:
```bash
cd repos/metabob-opencode
npm test -- multi-task-activity-tracking-harness.ts
```

**Success Criteria**:
- ✅ 7 task completion logs emitted
- ✅ 7 sessions in sessionsSpawned array
- ✅ Each session has: taskId, duration, cost, sessionID, messageCount, toolCallCount
- ✅ Correctness validation passes
- ✅ Task output variable inheritance works

---

## Files to Modify

1. `repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts`
   - Lines 41-52: Add metadata to schema
   - Lines 220-227: Add metadata to success return
   - Lines 246-254: Add metadata to failure return
   - Lines 265-273: Add metadata to cost limit return

2. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`
   - After line 2448: Add session tracking for trailblazing path
   - After line 2903: Add task completion logging for non-trailblazing path

---

## Breaking Changes

**None** - All changes are additive:
- Adding optional field to schema
- Adding metadata to return values
- Adding logging and tracking code

---

## Dependencies

1. Session tracking → requires TrailblazingExecutor metadata.sessionId
2. Task output variables → requires TrailblazingExecutor metadata.sessionId
3. Correctness validation → requires sessionsSpawned populated
4. Lifecycle logging → requires task completion logs

All dependencies resolved by this fix.
