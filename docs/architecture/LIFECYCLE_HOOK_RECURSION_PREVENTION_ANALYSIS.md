# Lifecycle Hook Recursion Prevention: Mechanism Comparison

## The Question
"Couldn't we just prevent activities from spawning other activities with the id in the same session? What are the tradeoffs of these mechanisms?"

## Current State

### Current Mechanism: Agent Mode Check
```typescript
// turn-lifecycle-hooks.ts
enabled: async (ctx) => {
  if (ctx.agent.mode !== "primary") {
    return false  // Skip all subagents
  }
  return true
}
```

**Logic**: Only primary agents run lifecycle hooks. All subagents skip hooks.

## Proposed Mechanisms

### Mechanism 1: Agent Name Check (from previous analysis)
```typescript
enabled: async (ctx) => {
  // Prevent recursion: memory agent can't spawn itself
  if (ctx.agent.name === "memory") {
    return false
  }
  
  // Respect explicit opt-out
  if (ctx.agent.config?.skipLifecycleHooks === true) {
    return false
  }
  
  return true
}
```

**Logic**: Skip only memory agent (which spawns itself). All other agents run hooks.

### Mechanism 2: Activity ID Tracking (your suggestion)
```typescript
// Track which activities are already running in this session
const runningActivities = new Map<string, Set<string>>()  // sessionID -> Set<activityTemplateId>

enabled: async (ctx) => {
  const config = await Config.get()
  
  if (config.sessionMemory?.enabled === false) {
    return false
  }
  
  // Check if memory-management activity is already running in this session
  const templateId = "manage-session-memory"
  const running = runningActivities.get(ctx.sessionID) || new Set()
  
  if (running.has(templateId)) {
    return false  // Already running, skip
  }
  
  return true
}

execute: async (ctx) => {
  const templateId = "manage-session-memory"
  
  // Mark as running
  const running = runningActivities.get(ctx.sessionID) || new Set()
  running.add(templateId)
  runningActivities.set(ctx.sessionID, running)
  
  try {
    // Execute activity
    const result = await executeActivityInline(templateId, {...}, ctx.sessionID, ...)
    
    return result
  } finally {
    // Always cleanup, even on error
    const running = runningActivities.get(ctx.sessionID)
    if (running) {
      running.delete(templateId)
      if (running.size === 0) {
        runningActivities.delete(ctx.sessionID)
      }
    }
  }
}
```

**Logic**: Track which activity templates are currently executing per session. Prevent same template from running twice in same session.

### Mechanism 3: Session Hierarchy Check
```typescript
enabled: async (ctx) => {
  const config = await Config.get()
  
  if (config.sessionMemory?.enabled === false) {
    return false
  }
  
  // Get session hierarchy
  const session = await Session.get(ctx.sessionID)
  
  // If this session has a parent, check if parent is running memory-management
  if (session.parentID) {
    const parentActivity = Activity.getActivityForSession(session.parentID)
    if (parentActivity) {
      const activity = await Activity.load(parentActivity)
      if (activity.templateId === "manage-session-memory") {
        return false  // Parent is memory agent, skip
      }
    }
  }
  
  return true
}
```

**Logic**: Check session parent hierarchy. Skip if parent session is running memory-management activity.

### Mechanism 4: Call Stack Tracking
```typescript
// Track call stack depth per session
const callStack = new Map<string, string[]>()  // sessionID -> stack of templateIds

enabled: async (ctx) => {
  const templateId = "manage-session-memory"
  const stack = callStack.get(ctx.sessionID) || []
  
  // Check if this template is already in the call stack
  if (stack.includes(templateId)) {
    return false  // Recursive call detected
  }
  
  return true
}

execute: async (ctx) => {
  const templateId = "manage-session-memory"
  
  // Push to call stack
  const stack = callStack.get(ctx.sessionID) || []
  stack.push(templateId)
  callStack.set(ctx.sessionID, stack)
  
  try {
    const result = await executeActivityInline(templateId, {...}, ctx.sessionID, ...)
    return result
  } finally {
    // Pop from call stack
    const stack = callStack.get(ctx.sessionID)
    if (stack) {
      stack.pop()
      if (stack.length === 0) {
        callStack.delete(ctx.sessionID)
      }
    }
  }
}
```

**Logic**: Maintain call stack of running templates per session. Detect recursion like a debugger would.

## Detailed Comparison

### Mechanism 0: Current (Agent Mode Check)

**Pros**:
- ✅ Simple (1 line check)
- ✅ Fast (no async calls, no lookups)
- ✅ Zero state management
- ✅ 100% prevents recursion (no edge cases)
- ✅ Works across all hooks uniformly

**Cons**:
- ❌ Too broad (blocks ALL subagents, not just problematic ones)
- ❌ Activity tasks don't get lifecycle hooks
- ❌ Trailblazing task attempts don't get hooks
- ❌ Prevents useful hook execution
- ❌ No granular control

**Recursion Prevention**: 🟢 Perfect (100% effective)  
**Flexibility**: 🔴 Poor (all-or-nothing)  
**Performance**: 🟢 Excellent (O(1))  
**Complexity**: 🟢 Minimal (1 line)  
**State Management**: 🟢 None required

---

### Mechanism 1: Agent Name Check

**Pros**:
- ✅ Simple (2-3 line check)
- ✅ Fast (no async calls, no lookups)
- ✅ Minimal state management
- ✅ More granular than mode check
- ✅ Activity tasks get hooks
- ✅ Easy to understand (explicit agent name)

**Cons**:
- ❌ Hardcoded agent name (coupling)
- ❌ Assumes memory agent is the only problem
- ⚠️ What if we add more self-spawning agents?
- ⚠️ Doesn't prevent OTHER recursive scenarios
- ⚠️ Memory agent could still spawn via different path

**Recursion Prevention**: 🟡 Good (catches main case, but not all)  
**Flexibility**: 🟡 Better (allows most agents)  
**Performance**: 🟢 Excellent (O(1))  
**Complexity**: 🟢 Low (few lines)  
**State Management**: 🟢 None required

**Edge Cases**:
- Memory agent spawned via task tool (not lifecycle hook) ← Still runs hooks!
- New agent "memory-v2" added ← Needs code update
- Plugin adds agent that spawns memory agent ← Not caught

---

### Mechanism 2: Activity ID Tracking (Your Suggestion)

**Pros**:
- ✅ Precise (prevents exact recursion scenario)
- ✅ Activity tasks get hooks
- ✅ Flexible (any activity can be tracked)
- ✅ No hardcoded agent names
- ✅ Works for ANY self-spawning activity
- ✅ Prevents manage-session-memory from spawning itself

**Cons**:
- ❌ State management required (Map per session)
- ❌ Cleanup complexity (must cleanup on success AND error)
- ❌ Race conditions possible (async activity execution)
- ⚠️ Doesn't prevent A → B → A cycles (different activities)
- ⚠️ Memory leaks if cleanup fails
- ⚠️ Per-session state (not per-activity hierarchy)

**Recursion Prevention**: 🟡 Good (prevents direct recursion)  
**Flexibility**: 🟢 Excellent (works for all activities)  
**Performance**: 🟡 Good (O(1) lookup, but state management overhead)  
**Complexity**: 🟡 Medium (state + cleanup logic)  
**State Management**: 🔴 Required (Map<sessionID, Set<templateId>>)

**Edge Cases**:
- Activity A spawns Activity B, B spawns A ← Not prevented!
- Parallel activities in same session ← Need Set, not single value
- Child session vs parent session tracking ← Which session to check?
- Cleanup failure → memory leak → session locked forever
- Activity crashes before cleanup → state pollution

**Example Problem Scenario**:
```
User message (session S1)
  ↓
Pre-turn hook: memory-management (template: manage-session-memory)
  ↓
  Mark: S1 → {manage-session-memory}
  ↓
  Task 1: "Analyze intent" (child session S2)
    ↓
    Pre-turn hook check: S2 has no running activities ← PASSES!
    ↓
    memory-management spawns again! ← RECURSION!
```

**Solution**: Need to check PARENT session hierarchy, not just current session.

---

### Mechanism 3: Session Hierarchy Check

**Pros**:
- ✅ Checks actual execution hierarchy
- ✅ Catches parent-child recursion
- ✅ No state management needed (uses existing Session data)
- ✅ Works across session boundaries
- ✅ Activity tasks get hooks (unless parent is memory agent)
- ✅ Prevents recursion through child sessions

**Cons**:
- ❌ Async database lookups (Session.get, Activity.load)
- ❌ Performance cost (2+ DB queries per hook check)
- ⚠️ Only checks immediate parent (not full ancestry)
- ⚠️ Doesn't prevent sibling recursion (parallel tasks)
- ⚠️ What if parent activity isn't memory-management but spawns it?

**Recursion Prevention**: 🟢 Good (catches parent-child)  
**Flexibility**: 🟢 Good (works across session boundaries)  
**Performance**: 🔴 Poor (async DB queries per hook)  
**Complexity**: 🟡 Medium (hierarchy traversal)  
**State Management**: 🟢 None (uses existing data)

**Edge Cases**:
```
User message (S1, no activity)
  ↓
Hook: memory-management spawns (S2, activity A1)
  ↓
  Task 1 (S3, parent=S2)
    ↓
    Hook check: parent is S2, S2's activity is A1 (manage-session-memory)
    ↓
    SKIP ← Works! ✅
    
BUT...

User message (S1, no activity)
  ↓
Hook: memory-management spawns (S2, activity A1)
  ↓
  Task 1 (S3, parent=S2)
    ↓
    Task delegates to another agent (S4, parent=S3)
      ↓
      Hook check: parent is S3, S3's activity is ??? (task session, no activity)
      ↓
      PASSES! ← Recursion possible if we're deep in hierarchy
```

**Solution**: Need to check ENTIRE ancestor chain, not just immediate parent.

---

### Mechanism 4: Call Stack Tracking

**Pros**:
- ✅ Exact recursion detection (like a debugger)
- ✅ Catches direct recursion (A → A)
- ✅ Catches cyclic recursion (A → B → A)
- ✅ Works across session boundaries (if stack includes session ancestry)
- ✅ Flexible (works for any template)
- ✅ No hardcoded agent names

**Cons**:
- ❌ State management required (stack per session)
- ❌ Cleanup complexity (must cleanup on success AND error)
- ❌ Performance overhead (stack operations)
- ⚠️ Doesn't work across session boundaries (unless we traverse parent chain)
- ⚠️ Memory leaks if cleanup fails
- ⚠️ Race conditions (concurrent activities)

**Recursion Prevention**: 🟢 Excellent (catches all patterns)  
**Flexibility**: 🟢 Excellent (works for all scenarios)  
**Performance**: 🟡 Good (stack operations fast, but state management)  
**Complexity**: 🔴 High (stack + cleanup + error handling)  
**State Management**: 🔴 Required (Map<sessionID, string[]>)

**Edge Cases**:
```
User message (S1)
  ↓
  Stack[S1] = []
  ↓
Hook: memory-management
  ↓
  Stack[S1] = ["manage-session-memory"]
  ↓
  Task 1 (S2, child session)
    ↓
    Stack[S2] = [] ← NEW SESSION, EMPTY STACK!
    ↓
    Hook: memory-management
    ↓
    Stack[S2] = ["manage-session-memory"]
    ↓
    RECURSION! ← Not caught because different session
```

**Solution**: Merge parent session's stack into child session's stack.

---

## The Real Problem: Session Boundaries

All mechanisms face the same fundamental issue:

**Child sessions are separate execution contexts**

When an activity spawns a child session for a task:
1. Child session gets NEW sessionID
2. Child session might have DIFFERENT agent
3. Child session's lifecycle hooks run INDEPENDENTLY

**Example Recursion Path**:
```
User Message (session S1, agent: activity)
    ↓
  Pre-turn hooks for S1
    ↓
  Hook: memory-management (enabled for primary agent)
    ↓
    Spawn manage-session-memory activity (activity A1)
        ↓
      Task 1 execution (child session S2, agent: memory)
          ↓
        Pre-turn hooks for S2
            ↓
          Hook: memory-management check
              ↓
            Current mechanism: agent.mode !== "primary" ← agent is "memory" (subagent) ← SKIP ✓
            Mechanism 1: agent.name !== "memory" ← SKIP ✓
            Mechanism 2: S2 not in runningActivities[S2] ← PASS! ← RECURSION!
            Mechanism 3: parent S1 has no activity (user session) ← PASS! ← RECURSION!
            Mechanism 4: Stack[S2] is empty ← PASS! ← RECURSION!
```

**The issue**: We need to track state ACROSS session boundaries.

---

## Improved Mechanism 2: Activity Tracking with Session Hierarchy

```typescript
// Track running activities per SESSION TREE (not just session)
const runningActivities = new Map<string, Set<string>>()  // rootSessionID -> Set<templateId>

function getRootSession(sessionID: string): string {
  // Traverse parent chain to find root
  let current = sessionID
  while (true) {
    const session = Session.get(current)  // Would need to be sync or cached
    if (!session.parentID) {
      return current  // Found root
    }
    current = session.parentID
  }
}

enabled: async (ctx) => {
  const templateId = "manage-session-memory"
  
  // Get root session (top of hierarchy)
  const rootSessionID = await getRootSessionID(ctx.sessionID)
  
  // Check if template is running ANYWHERE in this session tree
  const running = runningActivities.get(rootSessionID) || new Set()
  if (running.has(templateId)) {
    return false  // Already running in this session tree
  }
  
  return true
}

execute: async (ctx) => {
  const templateId = "manage-session-memory"
  const rootSessionID = await getRootSessionID(ctx.sessionID)
  
  // Mark as running at ROOT level
  const running = runningActivities.get(rootSessionID) || new Set()
  running.add(templateId)
  runningActivities.set(rootSessionID, running)
  
  try {
    const result = await executeActivityInline(templateId, {...}, ctx.sessionID, ...)
    return result
  } finally {
    // Cleanup at ROOT level
    const running = runningActivities.get(rootSessionID)
    if (running) {
      running.delete(templateId)
      if (running.size === 0) {
        runningActivities.delete(rootSessionID)
      }
    }
  }
}
```

**Pros**:
- ✅ Tracks across session boundaries
- ✅ Prevents recursion in entire session tree
- ✅ Works for any activity template
- ✅ No hardcoded agent names
- ✅ Activity tasks get hooks (unless already running)

**Cons**:
- ❌ Async parent chain traversal (performance cost)
- ❌ State management required
- ❌ Cleanup complexity
- ⚠️ What if root session ends but children still running?
- ⚠️ Memory leaks if cleanup fails

---

## Improved Mechanism 3: Session Hierarchy with Full Ancestry Check

```typescript
async function isActivityInAncestry(sessionID: string, templateId: string): Promise<boolean> {
  let current = sessionID
  
  while (current) {
    const session = await Session.get(current)
    const activityId = Activity.getActivityForSession(current)
    
    if (activityId) {
      const activity = await Activity.load(activityId)
      if (activity.templateId === templateId) {
        return true  // Found in ancestry
      }
    }
    
    if (!session.parentID) {
      break  // Reached root
    }
    current = session.parentID
  }
  
  return false  // Not in ancestry
}

enabled: async (ctx) => {
  const templateId = "manage-session-memory"
  
  // Check if this template is running in ANY ancestor session
  if (await isActivityInAncestry(ctx.sessionID, templateId)) {
    return false  // Already running in parent/grandparent/etc.
  }
  
  return true
}
```

**Pros**:
- ✅ No state management needed
- ✅ Checks entire ancestry chain
- ✅ Works across session boundaries
- ✅ No cleanup required
- ✅ No memory leaks

**Cons**:
- ❌ Multiple async DB queries per hook check (O(depth))
- ❌ Performance scales with session depth
- ⚠️ Doesn't prevent sibling recursion (parallel tasks spawning same activity)
- ⚠️ Race conditions (activity starts during ancestry check)

---

## Recommendation: Hybrid Approach

**Combine Mechanism 1 (agent name) + Mechanism 3 (ancestry check)**

```typescript
enabled: async (ctx) => {
  const config = await Config.get()
  
  if (config.sessionMemory?.enabled === false) {
    return false
  }
  
  // Quick check: Skip memory agent entirely (prevents most cases)
  if (ctx.agent.name === "memory") {
    return false  // Memory agent never runs memory-management hook
  }
  
  // Skip for very short messages (likely acknowledgments)
  if (ctx.promptText.length < 10) {
    return false
  }
  
  // Deep check: Verify not already running in ancestry
  // (Catches edge cases like: user → activity → task → memory-management attempt)
  const templateId = "manage-session-memory"
  if (await isActivityInAncestry(ctx.sessionID, templateId)) {
    log.debug("memory-management already in ancestry, skipping", {
      sessionID: ctx.sessionID,
    })
    return false
  }
  
  return true
}
```

**Why This Works**:

1. **Fast path**: Agent name check catches 99% of cases (no DB queries)
2. **Safety net**: Ancestry check catches edge cases
3. **No state management**: Uses existing session/activity data
4. **No cleanup**: No manual state to track
5. **Performance**: Fast path avoids DB queries most of the time

**Trade-offs**:
- ✅ Prevents all recursion scenarios
- ✅ Activity tasks get hooks (unless memory agent)
- ✅ Minimal state management
- ⚠️ Ancestry check is O(depth) but rarely executed
- ⚠️ Doesn't prevent sibling recursion (parallel tasks)

---

## Answer to Your Question

> "Couldn't we just prevent activities from spawning other activities with the id in the same session?"

**Yes!** That's Mechanism 2: Activity ID Tracking.

**But there are important caveats**:

1. **Session boundaries**: Must track across ENTIRE session tree (root session), not just current session
2. **Cleanup complexity**: Must cleanup on success, error, AND abort
3. **Memory leaks**: Failed cleanup → activity permanently blocked in that session
4. **Race conditions**: Concurrent activities might both pass the check

**Your mechanism would work if implemented as "Improved Mechanism 2"** (track at root session level).

---

## Final Recommendation Table

| Mechanism | Recursion Prevention | Flexibility | Performance | Complexity | State Mgmt |
|-----------|---------------------|-------------|-------------|-----------|------------|
| **0. Current (mode check)** | 🟢 Perfect | 🔴 Poor | 🟢 Excellent | 🟢 Minimal | 🟢 None |
| **1. Agent name check** | 🟡 Good | 🟡 Better | 🟢 Excellent | 🟢 Low | 🟢 None |
| **2. Activity ID tracking** | 🟡 Good | 🟢 Excellent | 🟡 Good | 🟡 Medium | 🔴 Required |
| **2b. Activity ID + hierarchy** | 🟢 Excellent | 🟢 Excellent | 🔴 Poor | 🔴 High | 🔴 Required |
| **3. Session hierarchy** | 🟢 Good | 🟢 Good | 🔴 Poor | 🟡 Medium | 🟢 None |
| **3b. Full ancestry check** | 🟢 Excellent | 🟢 Excellent | 🔴 Poor | 🟡 Medium | 🟢 None |
| **4. Call stack tracking** | 🟢 Excellent | 🟢 Excellent | 🟡 Good | 🔴 High | 🔴 Required |
| **Hybrid (1 + 3b)** | 🟢 Perfect | 🟢 Excellent | 🟢 Good | 🟡 Medium | 🟢 None |

## My Recommendation: **Hybrid (1 + 3b)**

**Implementation**:
1. Agent name check (fast path, catches 99%)
2. Full ancestry check (safety net, catches edge cases)
3. No state management
4. No cleanup complexity
5. Activity tasks get hooks

**Code**:
```typescript
enabled: async (ctx) => {
  // Fast path: Skip memory agent (prevents most cases)
  if (ctx.agent.name === "memory") {
    return false
  }
  
  // Safety net: Check if already running in ancestry
  if (await isActivityInAncestry(ctx.sessionID, "manage-session-memory")) {
    return false
  }
  
  return true
}
```

**Your suggestion (Activity ID tracking) would also work**, but requires more careful implementation with session hierarchy traversal and cleanup handling.

Both approaches are valid! The hybrid is simpler but has DB query overhead (rare). Activity tracking is more complex but avoids DB queries.

**Which do you prefer?**
