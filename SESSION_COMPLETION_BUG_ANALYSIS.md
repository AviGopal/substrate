# Session Completion Bug - Root Cause Analysis

**Date**: February 14, 2026  
**Status**: 🚨 **CRITICAL BUG IDENTIFIED**

---

## Problem Summary

Session completion data (outcome, tool_usage_stats, total_duration) is **NOT being persisted to Redis** even though `completeSession()` is called in the process exit handler.

### Observable Symptoms

```python
# Redis data shows:
Session: ses_3a4e304c9ffeT4JQ5k86GsmigN (main user session)
  Tool invocations: 5  ✅ (recorded correctly)
  Has outcome: False  ❌
  Has completed_at: False  ❌
  Has total_duration: False  ❌
  Has tool_usage_stats: False  ❌
```

Tool invocations ARE being recorded, but completion data is MISSING.

---

## Root Cause

The agent execution tracker uses a **singleton global variable** `currentSession` to track the active session:

```typescript
// In agent-execution-tracker.ts
let currentSession: SessionExecution | null = null

export async function startSession(sessionId: string, goal: string): Promise<void> {
  currentSession = {  // ← OVERWRITES previous value
    session_id: sessionId,
    agent_identity: identity,
    goal: goal,
    // ...
  }
}
```

### The Bug Scenario

1. **User starts main session**: `ses_3a4e304c9ffeT4JQ5k86GsmigN`
   - `currentSession = { session_id: "ses_3a4e304c9ffeT4JQ5k86GsmigN", ... }`

2. **Memory agent starts sub-session**: `ses_3a4e300e2ffeshuX6i7H1SU30p`
   - `currentSession = { session_id: "ses_3a4e300e2ffeshuX6i7H1SU30p", ... }`  ← **OVERWRITES parent**

3. **Process exits and calls completeSession()**:
   ```typescript
   const currentSession = AgentExecutionTracker.getCurrentSession()
   if (currentSession) {
     await AgentExecutionTracker.completeSession(...)
   }
   ```
   - Completes `ses_3a4e300e2ffeshuX6i7H1SU30p` (sub-agent session) ✅
   - **Ignores** `ses_3a4e304c9ffeT4JQ5k86GsmigN` (main user session) ❌

### Result

- Sub-agent session gets completion data (but we don't care about it)
- **Main user session never gets completed** - no outcome, no tool stats, no total_duration
- Data is incomplete for analysis and self-improvement

---

## Why Tool Invocations Still Work

Tool invocations ARE recorded correctly because we fixed this in the previous session:

```typescript
// In tool.ts
AgentExecutionTracker.recordToolCall(id, args, {
  success,
  duration_ms: duration,
  error,
  sessionID: ctx.sessionID,        // Current session ID
  parentSessionID: ctx.parentSessionID  // ← Parent session ID passed here
})

// In agent-execution-tracker.ts
export async function recordToolCall(..., result: { sessionID, parentSessionID }) {
  const targetSessionId = result.parentSessionID || result.sessionID  // ← Uses parent if available
  await recordToolInvocation(targetSessionId, invocation)
}
```

Tool tracking correctly uses `parentSessionID` to record to the correct session. **Session completion does not have this logic.**

---

## Evidence from Logs

```
[DEBUG] Starting agent execution tracking for session ses_3a4e304c9ffeT4JQ5k86GsmigN
[DEBUG] Session tracking started...

[DEBUG] Starting agent execution tracking for session ses_3a4e300e2ffeshuX6i7H1SU30p  ← Overwrites
[DEBUG] Session tracking started...

[TOOL-EXEC] Recording tool call...
[TOOL-EXEC] Context - sessionID: ses_3a4e300e2ffeshuX6i7H1SU30p, parentSessionID: NONE
[TRACKER] Target session for recording: ses_3a4e300e2ffeshuX6i7H1SU30p  ← Wrong session completed

# Process exits, completeSession() called with currentSession = sub-agent session
```

---

## Impact Assessment

### Severity: **CRITICAL**

- **Data loss**: Main user sessions never get completion data
- **Self-improvement broken**: Cannot analyze what worked/didn't work
- **Tool stats missing**: Cannot learn which tools are effective
- **Analytics broken**: Cannot measure session success rates

### Scope

- **Affects**: All sessions with sub-agents (memory agent, task delegation, etc.)
- **Does NOT affect**: Sessions without sub-agents (rare in practice)
- **Workaround**: None - this is a fundamental architecture issue

---

## Solution Options

### Option 1: Session Stack (Preferred)

Track a stack of sessions instead of a single `currentSession`:

```typescript
let sessionStack: SessionExecution[] = []

export async function startSession(sessionId: string, goal: string, parentSessionId?: string): Promise<void> {
  const session = {
    session_id: sessionId,
    parent_session_id: parentSessionId,
    // ...
  }
  sessionStack.push(session)
  // ...
}

export async function completeAllSessions(): Promise<void> {
  // Complete sessions in reverse order (children first, then parents)
  while (sessionStack.length > 0) {
    const session = sessionStack.pop()
    await _completeSession(session)
  }
}

export async function completeSession(sessionId?: string): Promise<void> {
  if (sessionId) {
    // Complete specific session
    const index = sessionStack.findIndex(s => s.session_id === sessionId)
    if (index >= 0) {
      const session = sessionStack.splice(index, 1)[0]
      await _completeSession(session)
    }
  } else {
    // Complete current session (top of stack)
    const session = sessionStack.pop()
    if (session) {
      await _completeSession(session)
    }
  }
}
```

**Pros**:
- Properly tracks nested sessions
- Supports completing specific sessions or all sessions
- Clean architecture
- Future-proof for deeper nesting

**Cons**:
- Requires refactoring ~50 lines
- Need to update process exit handler

### Option 2: Complete All Active Sessions on Exit

Instead of completing just `currentSession`, complete ALL sessions we've seen:

```typescript
let allSessions: Map<string, SessionExecution> = new Map()

export async function startSession(sessionId: string, goal: string): Promise<void> {
  const session = { session_id: sessionId, ... }
  allSessions.set(sessionId, session)
  currentSession = session  // Keep currentSession for backward compatibility
}

export async function completeAllActiveSessions(): Promise<void> {
  for (const session of allSessions.values()) {
    if (!session.completed_at) {  // Only complete if not already completed
      await _completeSingleSession(session)
    }
  }
}
```

**Pros**:
- Simpler change (~30 lines)
- Backward compatible
- Guaranteed to complete all sessions

**Cons**:
- Doesn't track parent-child relationships explicitly
- Completes sub-agent sessions even if we don't need their data
- Less clean architecture

### Option 3: Track Parent Session Explicitly

Keep `currentSession` but track the main parent session separately:

```typescript
let currentSession: SessionExecution | null = null
let mainSession: SessionExecution | null = null  // ← Track main session separately

export async function startSession(sessionId: string, goal: string, isMainSession: boolean = false): Promise<void> {
  const session = { session_id: sessionId, ... }
  currentSession = session
  
  if (isMainSession) {
    mainSession = session  // ← Remember main session
  }
}

export async function completeMainSession(): Promise<void> {
  if (mainSession && !mainSession.completed_at) {
    await _completeSession(mainSession)
  }
}
```

**Pros**:
- Minimal changes (~20 lines)
- Explicitly tracks what we care about (main session)
- Fast to implement

**Cons**:
- Doesn't handle all edge cases (multiple main sessions, etc.)
- Doesn't complete sub-agent sessions (may be okay)
- Less robust than Option 1

---

## Recommended Solution

**Option 1: Session Stack** is the best long-term solution.

**Immediate fix**: Option 3 (Track Parent Session) to unblock testing, then migrate to Option 1.

---

## Implementation Plan

### Phase 1: Immediate Fix (30 minutes)

1. Add `mainSession` tracking
2. Update `index.ts` to call `completeMainSession()` on exit
3. Test with our session completion test script
4. Verify Redis data includes completion fields

### Phase 2: Proper Architecture (2 hours)

1. Implement session stack
2. Update all session-related methods
3. Add tests for nested sessions
4. Update documentation

---

## Testing Verification

After fix, we should see:

```python
Session: ses_3a4e304c9ffeT4JQ5k86GsmigN (main user session)
  Tool invocations: 5  ✅
  Has outcome: True  ✅
  Has completed_at: True  ✅
  Has total_duration: True  ✅
  Has tool_usage_stats: True  ✅
  
Tool Usage Stats:
[
  {
    "tool_name": "list",
    "invocation_count": 3,
    "success_count": 3,
    "failure_count": 0,
    "total_duration_ms": 48,
    "avg_duration_ms": 16.0
  },
  {
    "tool_name": "read",
    "invocation_count": 2,
    "success_count": 2,
    "failure_count": 0,
    "total_duration_ms": 8,
    "avg_duration_ms": 4.0
  }
]
```

---

## Related Issues

- Tool invocation tracking: ✅ FIXED (previous session - parent session attribution)
- Session start tracking: ✅ WORKING
- Session completion tracking: ❌ **THIS BUG**

---

**Next Steps**: Implement immediate fix (Option 3) to unblock session completion testing.
