# Session Memory and Impulse Linkage: Complete Tracing Guide

**Date**: 2026-02-24  
**Status**: Implementation Tracing & Guidelines  
**Scope**: How session memory agents and impulses link to calling agents in lifecycle hooks

---

## Executive Summary

This document traces how **session memory agents** and **impulses** link up when activities run as **lifecycle hooks**, with a focus on state slice sharing and the guidelines that govern this architecture.

### Key Questions Answered

1. **How do lifecycle hooks share state with the session they're in?**
2. **How are impulses created during lifecycle hook execution transferred to parent sessions?**
3. **What are the current guidelines vs. planned architecture?**
4. **How does the execution trace flow through the system?**

---

## Current Architecture: State Slice Sharing

### Overview: Two-Stage State Flow

```
┌─────────────────────────────────────────────────────────────┐
│ PARENT SESSION (ses_primary)                                │
│                                                              │
│ 1. Turn Lifecycle Hook Triggered                            │
│    - User message arrives                                    │
│    - Pre-turn hook: "memory-management" (priority 10)       │
│                                                              │
│ 2. executeActivityInline() Called                           │
│    ├─ Creates CHILD SESSION (ses_child_memory)              │
│    ├─ Executes "manage-session-memory" activity template    │
│    ├─ Memory agent analyzes intent                          │
│    └─ Memory agent creates impulses (in child session)      │
│                                                              │
│ 3. Impulse Transfer (CURRENT)                               │
│    ├─ Collect impulses from child session                   │
│    ├─ Convert scope: "activity" → "session"                 │
│    ├─ Transfer to parent SessionMemory                      │
│    └─ Impulses NOW visible in parent session                │
│                                                              │
│ 4. Main Agent Executes                                      │
│    ├─ Reads impulses from SessionMemory                     │
│    ├─ Loads high-priority impulses                          │
│    └─ Uses enriched context                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Trace: Step-by-Step

### Step 1: Lifecycle Hook Registration

**File**: `src/session/turn-lifecycle-hooks.ts` (lines 20-180)

```typescript
TurnLifecycle.registerHook({
  name: "memory-management",
  priority: 10,  // Runs BEFORE main turn
  
  enabled: async (ctx) => {
    // Guard conditions:
    // - sessionMemory.enabled !== false
    // - agent.mode === "primary" (not subagents)
    // - promptText.length >= 10
    return true
  },
  
  execute: async (ctx) => {
    // CRITICAL ENTRY POINT
    const { executeActivityInline } = await import("../tool/activity")
    
    // Execute activity in CHILD session
    const result = await executeActivityInline(
      "manage-session-memory",
      { userMessage: ctx.promptText },
      ctx.sessionID,           // Parent session ID
      reason,
      ctx.userMessageID
    )
    
    // IMPULSE TRANSFER LOGIC (lines 92-118)
    for (const [id, impulse] of Object.entries(result.impulses)) {
      const sessionImpulse = {
        ...impulse,
        scope: "session" as const,  // Convert scope
        sessionID: ctx.sessionID,    // Set to parent
      }
      
      await SessionMemory.addImpulse(ctx.sessionID, sessionImpulse)
    }
    
    return { success: true, modified: true }
  }
})
```

**Key Guidelines**:
- ✅ Lifecycle hooks execute via `executeActivityInline()`
- ✅ Child session created for isolation (agent messages don't pollute parent)
- ✅ Impulses transferred back to parent after execution
- ✅ Scope converted from "activity" → "session"

---

### Step 2: Activity Inline Execution

**File**: `src/tool/activity.ts` (lines 1190-1450)

```typescript
export async function executeActivityInline(
  templateId: string,
  variables: Record<string, unknown>,
  parentSessionID: string,    // Parent session
  reason: string,
  parentMessageID: string,
  abortSignal?: AbortSignal
): Promise<{
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
  success: boolean
  activityId: string
  cancelled?: boolean
}> {
  
  // 1. CREATE CHILD SESSION (lines 1268-1284)
  // "The memory agent must run as a true subagent — isolated from the 
  //  primary session — so its LLM calls and tool messages do NOT appear 
  //  in the primary session's history."
  const childSession = await Session.createForActivity({
    title: `Lifecycle: ${template.name}`,
    callingSessionID: parentSessionID,
    activityId: "",  // Set after Activity.create
  })
  const childSessionID = childSession.id
  
  // 2. CREATE ACTIVITY TRACKING (lines 1286-1332)
  const activity = await Activity.create({
    directory: process.cwd(),
    branch: "lifecycle-hook",
    baseCommit: "HEAD",
    title: template.name,
  })
  
  activity.templateId = template.id
  activity.variables = variables
  activity.reason = reason
  activity.callingSessionId = parentSessionID
  activity.sessionIDs = [childSessionID]
  
  // Link activity to child session
  await Session.update(childSessionID, (draft) => {
    draft.activityId = activity.id
  })
  
  // 3. EXECUTE TEMPLATE IN CHILD SESSION (lines 1340-1350)
  const result = await executeTemplate(
    template,
    activity,
    variables,
    childSessionID,        // Execute in CHILD
    abortSignal,
    parentModel,
    {
      onStatusUpdate: () => {},
      parentSessionID,     // Track parent for scope
    }
  )
  
  // 4. COLLECT IMPULSES FROM ALL SESSIONS (lines 1411-1425)
  const collectedImpulses: Record<string, ActivityTemplate.Impulse.Schema> = {}
  
  const sessionsToCollect = new Set([childSessionID, ...activity.sessionIDs])
  for (const sid of sessionsToCollect) {
    const sessionImpulses = await SessionMemory.listImpulses(sid)
    for (const impulse of sessionImpulses) {
      // Later sessions win on duplicate IDs
      collectedImpulses[impulse.id] = impulse
    }
  }
  
  // 5. RETURN IMPULSES TO CALLER (line 1436)
  return {
    impulses: collectedImpulses,
    success: result.success,
    activityId: activity.id,
  }
}
```

**Key Guidelines**:
- ✅ Child session isolates agent messages from parent
- ✅ Activity tracking links child session(s) to activity
- ✅ Impulses collected from ALL sessions spawned during execution
- ✅ Caller (lifecycle hook) responsible for transferring impulses to parent

---

### Step 3: Impulse Creation During Execution

**File**: `src/tool/activity.ts` (lines 2431-2444)

```typescript
// Inside executeTemplate → TaskTool execution
const result = await TaskTool.run(
  agent,
  enrichedPrompt,
  {
    sessionID: sessionID,
    messageID: Identifier.ascending("message"),
    agent: agent.name,
    parentSessionID: options?.parentSessionID,
    extra: {
      // DON'T pass activityId for lifecycle hooks!
      // When executing in parent session, impulses should be 
      // session-scoped not activity-scoped
      // activityId: _activity.id,  // COMMENTED OUT
    },
  },
)
```

**Key Guidelines**:
- ✅ TaskTool executes as subagent in its own session
- ✅ Impulses created via impulse tools (impulse_create, etc.)
- ✅ No activityId passed for lifecycle hooks → session-scoped impulses
- ⚠️  Impulses stored in child session's SessionMemory

---

### Step 4: SessionMemory Storage

**File**: `src/session/session-memory.ts` (lines 160-220)

```typescript
export async function addImpulse(
  sessionID: string,
  impulse: ActivityTemplate.Impulse.Schema
): Promise<void> {
  const store = await load(sessionID)
  
  // Infer scope if not provided
  const scope = impulse.scope || (impulse.sessionID ? "session" : "activity")
  
  // Validate scope
  if (scope !== "session") {
    throw new Error(`Cannot add impulse with scope "${scope}" to session memory`)
  }
  
  // Validate sessionID matches
  if (impulse.sessionID !== sessionID) {
    throw new Error(`Impulse sessionID "${impulse.sessionID}" does not match store sessionID "${sessionID}"`)
  }
  
  // Ensure scope is set
  const impulseWithScope = {
    ...impulse,
    scope: "session" as const,
  }
  
  // Add impulse
  store.impulses[impulse.id] = impulseWithScope
  
  // Update budget
  store.totalBudget = Object.values(store.impulses).reduce((sum, imp) => sum + imp.budget, 0)
  store.usedTokens = Object.values(store.impulses)
    .filter((imp) => imp.loaded)
    .reduce((sum, imp) => sum + (imp.tokenCount || 0), 0)
  
  await save(store)
}
```

**Key Guidelines**:
- ✅ SessionMemory is the storage layer for session-scoped impulses
- ✅ Scope validation ensures only "session" impulses stored
- ✅ SessionID must match store sessionID
- ✅ Budget tracking updated on every impulse add

---

## State Slice Guidelines: Current Implementation

### 1. Session Hierarchy

```
Parent Session (ses_primary)
└─ SessionMemory.Store
   ├─ impulses: {} (empty initially)
   ├─ totalBudget: 50000
   └─ usedTokens: 0

   Child Session (ses_child_memory)
   └─ SessionMemory.Store
      ├─ impulses: { "file:auth.ts": {...}, "metabob:priority": {...} }
      ├─ totalBudget: 5000
      └─ usedTokens: 4200

   [Transfer happens here]

Parent Session (ses_primary) [AFTER TRANSFER]
└─ SessionMemory.Store
   ├─ impulses: { "file:auth.ts": {...}, "metabob:priority": {...} }
   ├─ totalBudget: 50000
   └─ usedTokens: 4200
```

### 2. Scope Conversion Rules

| Stage | Scope | SessionID | Storage Location |
|-------|-------|-----------|------------------|
| Creation (child session) | "activity" | ses_child | SessionMemory[ses_child] |
| Transfer (lifecycle hook) | "session" | ses_primary | SessionMemory[ses_primary] |
| Usage (main agent) | "session" | ses_primary | SessionMemory[ses_primary] |

### 3. Visibility Rules

**During lifecycle hook execution**:
- ❌ Parent session CANNOT see child impulses
- ✅ Child session CAN create impulses
- ✅ Child session CAN see its own impulses

**After lifecycle hook execution**:
- ✅ Parent session CAN see transferred impulses
- ✅ Main agent CAN load impulses
- ✅ Impulses appear as if created in parent session

---

## Planned Architecture: Unified State Slice

### The Vision (from SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md)

```
┌─────────────────────────────────────────────────────────────┐
│ PARENT SESSION (ses_primary)                                │
│                                                              │
│ SessionMemory.Store [SINGLE SOURCE OF TRUTH]                │
│ ├─ impulses: {}                                             │
│ ├─ allocations: {                                           │
│ │    "lifecycle:memory-management": {                       │
│ │      allocated: 5000,                                     │
│ │      used: 4200,                                          │
│ │      impulses: ["file:auth.ts"]                           │
│ │    }                                                       │
│ │  }                                                         │
│ └─ executionGraph: {                                        │
│      nodes: [                                                │
│        { id: "hook1", type: "lifecycle-hook", ... }         │
│      ]                                                       │
│    }                                                         │
│                                                              │
│ ✅ NO child session needed                                  │
│ ✅ NO impulse transfer needed                               │
│ ✅ Lifecycle hooks execute in parent session                │
│ ✅ All activities share instructional state                 │
└─────────────────────────────────────────────────────────────┘
```

### Proposed Changes

**Phase 1: Unify Impulse Storage** (⚡ CRITICAL)

1. Remove `Activity.Schema.impulses` field
2. ALL impulses use SessionMemory (never Activity.impulses)
3. executeActivityInline executes in PARENT session (no child)
4. Remove impulse transfer logic from lifecycle hooks

**Benefits**:
- ✅ Lifecycle hooks create impulses in parent session (visible immediately)
- ✅ Activities share instructional state (no isolation)
- ✅ Nested activities work (child sees parent's impulses)
- ✅ No transfer logic needed (single source of truth)

**Phase 2: Budget Allocation & Execution Graph**

1. Add `allocations` field to SessionMemory.Store
2. Track budget per activity/lifecycle hook
3. Build execution graph showing hierarchy
4. Track impulse ownership

---

## Execution Flow Trace: Complete Example

### Scenario: User sends "Fix auth bug"

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Message Arrives                                     │
│    - Session: ses_abc123                                    │
│    - Message: "Fix auth bug"                                │
└─────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Pre-Turn Lifecycle Hooks (TurnLifecycle.executeHooks)   │
│    - Priority 10: "memory-management"                       │
│    - enabled() check: ✅ (sessionMemory enabled, primary)  │
└─────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. executeActivityInline("manage-session-memory")          │
│    - Parent: ses_abc123                                     │
│    - Create child: ses_child_mem                            │
│    - Variables: { userMessage: "Fix auth bug" }            │
└─────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Activity Execution in Child Session                      │
│    - Template: "manage-session-memory"                      │
│    - Task 1: Analyze intent (memory agent)                  │
│      ├─ Agent: "memory" subagent                            │
│      ├─ Session: ses_task1 (sub-session of child)          │
│      ├─ Output: Intent { type: "code_fix", impulses: [...] }│
│      └─ No impulses created yet                             │
│                                                              │
│    - Task 2: Create impulses (general agent)                │
│      ├─ Agent: "general" subagent                           │
│      ├─ Session: ses_task2 (sub-session of child)          │
│      ├─ Tool: impulse_create("file:src/auth.ts")           │
│      ├─ Storage: SessionMemory[ses_task2]                   │
│      └─ Impulse created: { id: "file:auth.ts", scope: "activity" }│
└─────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Impulse Collection (executeActivityInline)              │
│    - Sessions: [ses_child_mem, ses_task1, ses_task2]       │
│    - Collect from each: SessionMemory.listImpulses()        │
│    - Result: { "file:auth.ts": {...} }                      │
└─────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Impulse Transfer (lifecycle hook)                        │
│    - For each impulse in result.impulses:                   │
│      ├─ Convert scope: "activity" → "session"               │
│      ├─ Set sessionID: ses_abc123 (parent)                  │
│      └─ SessionMemory.addImpulse(ses_abc123, impulse)       │
│    - Transferred: 1 impulse                                 │
└─────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Main Agent Execution                                     │
│    - Session: ses_abc123                                    │
│    - impulse_list: ✅ sees "file:auth.ts"                  │
│    - impulse_load("file:auth.ts"): ✅ loads content        │
│    - Context enriched: 4200 tokens                          │
│    - Agent response: "I see the auth bug in line 42..."     │
└─────────────────────────────────────────────────────────────┘
```

### Key Observations

1. **Child Session Isolation**: Memory agent runs in isolated session (ses_child_mem)
2. **Task Sub-Sessions**: Each task creates its own sub-session (ses_task1, ses_task2)
3. **Impulse Locations**: Impulses created in task sub-sessions
4. **Collection Phase**: All sessions inspected for impulses
5. **Transfer Phase**: Impulses moved from child → parent with scope conversion
6. **Visibility**: Main agent sees impulses as if they were always in parent session

---

## Guidelines for Activity Template Authors

### When Writing Lifecycle Hook Activities

**DO**:
- ✅ Create impulses using `impulse_create` tool
- ✅ Use session-scoped impulses (set scope="session")
- ✅ Return impulses in activity output
- ✅ Keep hooks fast (<3s target)

**DON'T**:
- ❌ Assume impulses are immediately visible to parent
- ❌ Try to modify parent session directly
- ❌ Create activity-scoped impulses (use session scope)
- ❌ Load impulses within the hook (main agent loads them)

### When Writing Nested Activities

**CURRENT (with transfer)**:
```typescript
// Parent activity calls child activity
// Child impulses need manual transfer
```

**PLANNED (unified state)**:
```typescript
// Parent activity calls child activity
// Child impulses automatically visible (no transfer)
```

---

## Testing Traceability

### Key Test Files

1. **turn-lifecycle-hooks.test.ts**: Validates hook execution and impulse transfer
2. **memory-optimization-integration.test.ts**: Tests full memory agent flow
3. **impulse-system-e2e.test.ts**: End-to-end impulse creation and loading

### Trace Points for Debugging

```typescript
// 1. Hook execution
log.info("memory management hook: starting execution")

// 2. Child session creation
log.debug("created child session for lifecycle activity")

// 3. Impulse collection
log.info("lifecycle activity execution complete", { impulseCount })

// 4. Impulse transfer
log.debug("transferred impulse to parent session", { impulseId, scope })

// 5. Main agent visibility
log.info("impulse_list called", { sessionID, count })
```

---

## Related Documentation

- **Architecture**: `docs/architecture/SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md`
- **Memory Agent**: `packages/opencode/docs/MEMORY_AGENT_IMPLEMENTATION.md`
- **Turn Lifecycle**: `src/session/turn-lifecycle.ts`
- **Session Memory**: `src/session/session-memory.ts`
- **Activity Tool**: `src/tool/activity.ts`

---

## Conclusion

### Current State: Transfer-Based Architecture

**How it works**:
1. Lifecycle hooks execute in child sessions (isolation)
2. Impulses created in child sessions
3. Transfer logic converts scope and moves impulses to parent
4. Main agent sees transferred impulses

**Tradeoffs**:
- ✅ Agent messages isolated from parent session
- ✅ Impulses eventually visible to main agent
- ⚠️  Complex transfer logic needed
- ⚠️  Temporary isolation during execution

### Planned State: Unified Architecture

**How it will work**:
1. Lifecycle hooks execute in parent sessions (no isolation)
2. Impulses created directly in parent SessionMemory
3. No transfer needed (single source of truth)
4. Main agent sees impulses immediately

**Tradeoffs**:
- ✅ Simpler architecture (no transfer)
- ✅ Immediate visibility
- ✅ Nested activities just work
- ⚠️  Agent messages visible in parent (acceptable for hooks)

**Next Steps**: Implement Phase 1 of unified architecture (remove Activity.impulses, unify storage)
