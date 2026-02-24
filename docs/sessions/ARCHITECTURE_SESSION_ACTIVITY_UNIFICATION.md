# Architecture: Session-Activity Unification & Data Flow

**Date**: 2026-02-20  
**Status**: 🎯 **FOUNDATIONAL ARCHITECTURE DESIGN**

---

## Core Insight

> "All sessions should behave like activities and vice versa. A session is a collection of **instructional state** (LLM context window), and in software development, the **functional state** is the codebase. These are logically separate but happen 'at the same time'."

---

## Conceptual Model

### The Duality

```
┌─────────────────────────────────────────────────────────────┐
│                     Session Execution                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Instructional State          Functional State               │
│  (What LLM knows)            (What code is)                  │
│  ─────────────────           ───────────────                │
│  • Context window            • Codebase files                │
│  • Messages                  • Git state                     │
│  • Impulses (available)      • File system                   │
│  • Loaded impulses           • Build artifacts               │
│  • Tools/capabilities        • Runtime state                 │
│                                                               │
│         │                            │                        │
│         ├───── LLM ─────────────────┤                        │
│         │    (mutates via tools)    │                        │
│         └───────────────────────────┘                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Property**: Instructional and functional states are **logically separate** but **temporally coupled** (happen simultaneously).

---

## Purpose of Each System

### 1. Session System
**Purpose**: Manage instructional state evolution over time

```
Session:
  - ID, messages[], tools, config
  - Represents: "What the LLM is being told"
  - Lifespan: User interaction duration
  - Scope: Single conversation thread
```

**Responsibilities**:
- Track conversation messages
- Manage tool calls and responses
- Coordinate LLM requests
- Maintain session-level state

### 2. Activity System
**Purpose**: Manage structured, multi-step functional state mutations

```
Activity:
  - ID, template, variables, tasks[], status
  - Represents: "Structured work to mutate codebase"
  - Lifespan: Task execution duration
  - Scope: Defined workflow with entry/exit
```

**Responsibilities**:
- Execute template-driven workflows
- Track task execution order
- Manage sub-sessions (one per task)
- Persist work artifacts
- Report metrics/outcomes

### 3. Impulse System
**Purpose**: Learn optimal instructional state composition

```
Impulse:
  - ID, pointer (to content), budget, priority, loaded
  - Represents: "Content that might help LLM"
  - Lifespan: Session/activity duration
  - Scope: Available to load when needed
```

**Responsibilities**:
- Track what content is available
- Budget allocation (token limits)
- Priority-based loading decisions
- Content lifecycle (unloaded → loaded → unloaded)

### 4. Memory Agent
**Purpose**: Optimize instructional state for task success

```
Memory Agent:
  - Observes: Task outcomes, context used, success/failure
  - Learns: "What content helps complete tasks"
  - Decides: Load/unload impulses, negotiate budgets
  - Optimizes: Context window composition
```

**Responsibilities**:
- Monitor session outcomes
- Identify missing context (failures)
- Request impulse loading (negotiation)
- Learn patterns (what content helps)

---

## Unified Model: Session = Activity

### The Realization

**Every session is an activity**, and **every activity has a session**:

```
Activity {
  id: string
  templateId: string
  variables: {...}
  
  // ACTIVITY SPAWNS SESSIONS
  sessions: [
    { task: "task-1", sessionId: "sess_1" },  // Each task = sub-session
    { task: "task-2", sessionId: "sess_2" },
  ]
  
  // ACTIVITY HAS IMPULSES (available, not necessarily loaded)
  impulses: { [id]: Impulse }  // Persisted to storage
  
  // FUNCTIONAL STATE
  directory: string
  branch: string
  commits: string[]
}

Session {
  id: string
  activityId?: string  // Optional: Session may be standalone or within activity
  
  // INSTRUCTIONAL STATE
  messages: Message[]
  tools: Tool[]
  
  // SESSION HAS IMPULSES (subset of activity, dynamically loaded)
  impulses: { [id]: Impulse }  // In-memory, session-scoped
  
  // FUNCTIONAL STATE (if standalone)
  workingDirectory?: string
}
```

**Key Insight**: Sessions and activities are **not separate** - they're **nested**:
- **Top-level session**: User interacts, no activity (standalone)
- **Activity session**: Activity spawns sessions for each task (nested)

---

## Data Flow Architecture

### Principle: Single Source of Truth with Scoped Views

```
┌─────────────────────────────────────────────────────────────┐
│                     STORAGE LAYER                            │
│                   (SurrealDB / Disk)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Activity Records                                            │
│  ├─ activity.id                                              │
│  ├─ activity.impulses: { [id]: Impulse }  ← SOURCE OF TRUTH │
│  ├─ activity.sessions: [sessionId[]]                         │
│  └─ activity.commits, artifacts, metrics                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ load/save
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   IN-MEMORY LAYER                            │
│                   (SessionMemory)                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Session Instructional State (per session)                   │
│  ├─ sessionMemory[sessionId].messages: Message[]            │
│  ├─ sessionMemory[sessionId].impulses: { [id]: Impulse }    │
│  │    ▲                                                      │
│  │    │ SCOPED VIEW of activity.impulses                    │
│  │    │ (loaded impulses for THIS session)                  │
│  │    │                                                      │
│  └────┘                                                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ load on demand
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CONTEXT WINDOW                            │
│                    (LLM Request)                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  <system_prompt>                                             │
│  <messages>                                                  │
│  <loaded_impulses>  ← Content from sessionMemory[sessionId] │
│  <tools>                                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Impulse Lifecycle

### 1. Activity Creation (Template Executor)

```typescript
// Activity created with template
activity = await Activity.create({ templateId, variables })

// Template has contextRequirements
template.contextRequirements = {
  files: ["src/auth.ts"],
  components: [{ file: "src/auth.ts", name: "authenticate" }],
  cpgImpact: true,
}

// Executor creates impulses from requirements
impulses = await Activity.createImpulsesFromRequirements(activity.id, template.contextRequirements)

// WRITE TO STORAGE (Activity.impulses = source of truth)
activity.impulses = impulses
await Activity.save(activity)
```

**Result**: Activity has impulses in storage (persisted, not loaded).

### 2. Task Execution (Lifecycle Hook: turn:started)

```typescript
// Activity spawns sub-session for task
const taskSessionId = await Session.create({ activityId: activity.id })

// Lifecycle hook: turn:started (in parent session)
await executeLifecycleHook({
  hook: "turn:started",
  sessionID: parentSessionId,  // ← PARENT SESSION (not task session)
  context: { activityId, taskId, taskSessionId }
})

// Hook calls Memory Agent
await memoryAgent.optimizeContext({
  sessionID: parentSessionId,
  activityId: activity.id,
  availableImpulses: Object.keys(activity.impulses),  // ← Available in activity
  budget: 50000,
})

// Memory Agent decides to load impulses
await impulse_load({ id: "file:src/auth.ts" })

// impulse_load WRITES TO:
// 1. SessionMemory (parent session) - for TUI visibility
await SessionMemory.updateImpulse(parentSessionId, impulseId, loadedImpulse)

// 2. Activity.impulses (storage) - for persistence
activity.impulses[impulseId] = loadedImpulse
await Activity.save(activity)
```

**Result**: Impulse loaded in parent session, visible in TUI, persisted in activity.

### 3. Task Session Inherits Impulses

```typescript
// Task session starts
const taskSession = await Session.load(taskSessionId)

// COPY loaded impulses from parent to task session
const parentImpulses = await SessionMemory.listImpulses(parentSessionId)
for (const impulse of parentImpulses) {
  if (impulse.loaded) {
    await SessionMemory.addImpulse(taskSessionId, impulse)
  }
}

// Build LLM context for task
const context = buildContext({
  systemPrompt: template.tasks[0].prompt,
  messages: [],
  loadedImpulses: parentImpulses.filter(i => i.loaded),  // ← From parent session
  tools: [...],
})

// LLM executes with inherited context
await llm.request(context)
```

**Result**: Task session has loaded impulses from parent (inherited instructional state).

### 4. Activity Completion

```typescript
// All tasks complete
await Activity.complete(activity.id)

// Activity saved to storage WITH impulses
activity.impulses = { ...all impulses, loaded states, token counts... }
await Activity.save(activity)  // ← Persisted to SurrealDB

// Extract to backend (optional)
await extractActivityToSurrealDB(activity)
// Backend now has complete activity record with impulses
```

**Result**: Activity archived with all impulses for analytics/learning.

---

## Proposed Data Flow Model

### Single Source of Truth: Activity.impulses (Storage)

```
┌─────────────────────────────────────────────────────────────┐
│                   Activity.impulses                          │
│                   (Storage - SurrealDB)                      │
│                   SOURCE OF TRUTH                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Persisted impulses:                                         │
│  - Available impulses (unloaded)                             │
│  - Loaded impulses (with content)                            │
│  - Token counts, priorities, metadata                        │
│  - Lifecycle events (created, loaded, unloaded)              │
│                                                               │
│  Used for:                                                   │
│  - Activity resumption                                       │
│  - Metrics/analytics                                         │
│  - Template executor (reading)                               │
│  - Memory manager plugin (optimization)                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ sync on activity load
                              │ write on impulse change
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              SessionMemory (In-Memory Cache)                 │
│              Per-Session Instructional State                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  sessionMemory[parentSessionId].impulses:                    │
│  - Scoped view of activity.impulses                          │
│  - Dynamically updated (load/unload)                         │
│  - Visible in TUI sidebar                                    │
│                                                               │
│  sessionMemory[taskSessionId].impulses:                      │
│  - Inherited from parent session                             │
│  - Used for task execution                                   │
│  - Includes only loaded impulses                             │
│                                                               │
│  Used for:                                                   │
│  - TUI display (live updates)                                │
│  - LLM context building (which impulses loaded)              │
│  - Fast read access (no disk I/O)                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Operations

### Create Impulse

```typescript
impulse_create({ id, pointer, budget, priority })

1. Create impulse object
2. WRITE to SessionMemory (in-memory, for TUI)
   await SessionMemory.addImpulse(sessionID, impulse)
   
3. WRITE to Activity.impulses (storage, for persistence)
   const activityId = Activity.getActivityForSession(sessionID)
   if (activityId) {
     await Activity.addImpulses(activityId, { [id]: impulse })
   }
```

**Invariant**: Impulse exists in both SessionMemory (fast read) and Activity.impulses (persistence).

### Load Impulse

```typescript
impulse_load({ id })

1. READ from SessionMemory (check if exists)
   const impulse = await SessionMemory.getImpulse(sessionID, id)
   
2. Load content (pointer → content)
   const content = await loadContent(impulse.pointer)
   impulse.content = content
   impulse.loaded = true
   impulse.tokenCount = estimateTokens(content)
   
3. UPDATE SessionMemory (update loaded state)
   await SessionMemory.updateImpulse(sessionID, id, impulse)
   
4. SYNC to Activity.impulses (persist loaded state)
   const activityId = Activity.getActivityForSession(sessionID)
   if (activityId) {
     await Activity.addImpulses(activityId, { [id]: impulse })
   }
```

**Invariant**: Loaded state synced to both SessionMemory and Activity.impulses.

### Unload Impulse

```typescript
impulse_unload({ id })

1. READ from SessionMemory
   const impulse = await SessionMemory.getImpulse(sessionID, id)
   
2. Unload content (free memory)
   impulse.content = undefined
   impulse.loaded = false
   // Keep tokenCount for tracking
   
3. UPDATE SessionMemory
   await SessionMemory.updateImpulse(sessionID, id, impulse)
   
4. SYNC to Activity.impulses
   const activityId = Activity.getActivityForSession(sessionID)
   if (activityId) {
     await Activity.addImpulses(activityId, { [id]: impulse })
   }
```

**Invariant**: Unloaded state synced to both.

### Delete Impulse

```typescript
impulse_delete({ id })

1. DELETE from SessionMemory
   await SessionMemory.removeImpulse(sessionID, id)
   
2. DELETE from Activity.impulses
   const activityId = Activity.getActivityForSession(sessionID)
   if (activityId) {
     const activity = await Activity.load(activityId)
     delete activity.impulses[id]
     await Activity.save(activity)
   }
```

**Invariant**: Impulse removed from both.

---

## Session-Activity Relationship

### Standalone Session (No Activity)

```typescript
// User starts OpenCode TUI
const sessionId = await Session.create({})

// Impulses created in session
await impulse_create({ id: "memo:task-description", ... })

// ONLY SessionMemory (no activity to sync to)
await SessionMemory.addImpulse(sessionId, impulse)
// Activity.addImpulses NOT called (no activity)

// TUI works: reads from SessionMemory ✓
// Activity persistence: N/A (no activity)
```

**Behavior**: SessionMemory-only mode (no activity sync).

### Activity Session (With Activity)

```typescript
// Activity spawns parent session
const activity = await Activity.create({ templateId, variables })
const parentSessionId = activity.sessionId

// Lifecycle hook creates impulses
await impulse_create({ id: "file:src/auth.ts", ... })

// DUAL WRITE
await SessionMemory.addImpulse(parentSessionId, impulse)  // ✓ For TUI
await Activity.addImpulses(activity.id, { [id]: impulse })  // ✓ For persistence

// Task spawns sub-session
const taskSessionId = await Session.create({ activityId: activity.id })

// Inherit loaded impulses from parent
const parentImpulses = await SessionMemory.listImpulses(parentSessionId)
for (const impulse of parentImpulses.filter(i => i.loaded)) {
  await SessionMemory.addImpulse(taskSessionId, impulse)
}

// Task executes with inherited context
// No sync to activity (parent already synced)
```

**Behavior**: Dual write for parent, inherit for children.

---

## Simplified Data Flow (Minimal Maintenance)

### Principle: Sync Once, Read Many

```
impulse_create/load/unload/delete:
  1. Write to SessionMemory (always)
  2. IF in activity context: Sync to Activity.impulses
  3. IF in child session: NO sync (parent already synced)
```

**Decision Tree**:

```typescript
async function syncImpulseToActivity(sessionID: string, impulse: Impulse) {
  // Check if session is part of activity
  const activityId = Activity.getActivityForSession(sessionID)
  if (!activityId) {
    return  // Standalone session, no sync needed
  }
  
  // Check if this is a child session (task session)
  const session = await Session.load(sessionID)
  if (session.parentSessionId) {
    return  // Child session, parent already synced
  }
  
  // This is parent activity session, sync to activity
  await Activity.addImpulses(activityId, { [impulse.id]: impulse })
}
```

**Result**: Single sync point, no duplicate writes.

---

## Inheritance Model: Parent → Child Sessions

### Impulse Inheritance on Task Start

```typescript
// Template executor starts task
async function executeTask(activity: Activity, task: Task) {
  // Create task sub-session
  const taskSessionId = await Session.create({
    activityId: activity.id,
    parentSessionId: activity.sessionId,  // ← Parent session
  })
  
  // Inherit loaded impulses from parent
  await inheritImpulsesFromParent(activity.sessionId, taskSessionId)
  
  // Execute task with inherited context
  await executeTaskSession(taskSessionId, task)
}

async function inheritImpulsesFromParent(parentSessionId: string, childSessionId: string) {
  const parentImpulses = await SessionMemory.listImpulses(parentSessionId)
  
  for (const impulse of parentImpulses) {
    if (impulse.loaded) {
      // Copy loaded impulse to child session
      await SessionMemory.addImpulse(childSessionId, impulse)
    }
  }
  
  log.info("inherited impulses from parent", {
    parentSessionId,
    childSessionId,
    inheritedCount: parentImpulses.filter(i => i.loaded).length,
  })
}
```

**Result**: Child sessions automatically have parent's loaded impulses.

---

## Minimal Maintenance Design

### Single Code Path: Impulse Tools

```typescript
// impulse-create.ts
export const ImpulseCreateTool = Tool.define("impulse_create", async () => {
  return {
    async execute(params, context) {
      const sessionID = context.sessionID
      const impulse = { id: params.id, ... }
      
      // ALWAYS write to SessionMemory (source for TUI)
      await SessionMemory.addImpulse(sessionID, impulse)
      
      // Conditionally sync to activity (source for persistence)
      await syncImpulseToActivity(sessionID, impulse)
      
      return { title: "Created impulse", output: "...", metadata: {} }
    }
  }
})

// Shared helper (used by all impulse tools)
async function syncImpulseToActivity(sessionID: string, impulse: Impulse) {
  const activityId = Activity.getActivityForSession(sessionID)
  if (!activityId) return  // Standalone session
  
  const session = await Session.load(sessionID)
  if (session.parentSessionId) return  // Child session (parent synced)
  
  await Activity.addImpulses(activityId, { [impulse.id]: impulse })
}
```

**Result**: 
- ✅ Single write path (SessionMemory + conditional Activity sync)
- ✅ Works for standalone sessions (no activity)
- ✅ Works for activity sessions (dual write)
- ✅ Works for child sessions (inherit, no duplicate sync)

### Activity Initialization: Sync from Storage

```typescript
// Activity.load() - Warm SessionMemory cache from storage
export async function load(id: string): Promise<Info> {
  const activity = await Storage.read<Info>(["activity", id])
  
  // If activity has active session, sync impulses to SessionMemory
  if (activity.sessionId) {
    const sessionExists = await Session.exists(activity.sessionId)
    if (sessionExists) {
      // Warm cache: Activity.impulses → SessionMemory
      for (const impulse of Object.values(activity.impulses)) {
        await SessionMemory.addImpulse(activity.sessionId, impulse)
      }
    }
  }
  
  return activity
}
```

**Result**: Activity resumption works (impulses loaded from storage into SessionMemory).

---

## Summary: Minimal Maintenance Data Flow

### Data Flow Rules

1. **SessionMemory = Fast Read Layer** (in-memory, per-session)
   - Always written by impulse tools
   - Read by TUI, LLM context builder
   - Scoped to session lifetime

2. **Activity.impulses = Persistence Layer** (storage, per-activity)
   - Synced from SessionMemory (parent session only)
   - Read by template executor, memory manager
   - Persisted for archival, analytics

3. **Sync Strategy**:
   - Write to SessionMemory (always)
   - Sync to Activity.impulses IF parent session of activity
   - NO sync for standalone sessions (no activity)
   - NO sync for child sessions (parent already synced)

4. **Inheritance Strategy**:
   - Child sessions inherit loaded impulses from parent
   - Copy impulses to child SessionMemory at task start
   - NO sync to activity (redundant)

### Code Changes Required

**6 Impulse Tools** (add `syncImpulseToActivity` call):
1. impulse-create.ts
2. impulse-load.ts
3. impulse-unload.ts
4. impulse-delete.ts
5. impulse-update.ts
6. impulse-list.ts (no sync, read-only)

**1 Shared Helper** (new function):
- `syncImpulseToActivity(sessionID, impulse)` - Smart sync logic

**1 Activity Function** (add cache warming):
- `Activity.load()` - Sync impulses from storage to SessionMemory

**1 Template Executor Function** (add inheritance):
- `executeTask()` - Inherit impulses from parent to child session

**Total**: ~8 functions, clear pattern, single code path.

---

## Validation: Does This Achieve Goals?

### ✅ Minimize Maintenance
- Single code path for impulse tools
- Shared `syncImpulseToActivity` helper (reused 6x)
- No alternate logic branches (simple if statement)

### ✅ Minimize Alternate Code Paths
- One write path: SessionMemory + conditional sync
- One read path: SessionMemory (fast)
- One persistence path: Activity.impulses (storage)

### ✅ Activity Execution: Impulses Loaded on Each Turn
- Lifecycle hooks execute in parent session
- Memory agent loads impulses in parent session
- Child tasks inherit loaded impulses from parent

### ✅ Impulses Available in Parent Session/Activity
- Parent session has impulses in SessionMemory (loaded states)
- Activity has impulses in Activity.impulses (persisted)
- TUI shows impulses from parent SessionMemory

### ✅ All Sessions Behave Like Activities
- Standalone sessions: SessionMemory only (lightweight)
- Activity sessions: SessionMemory + Activity.impulses (persisted)
- Unified API: impulse tools work for both

### ✅ Session = Instructional State, Codebase = Functional State
- SessionMemory stores instructional state (impulses, messages)
- Activity stores functional state mutations (commits, artifacts)
- LLM mutates functional via tools, guided by instructional

---

**Status**: 🎯 Architecture design complete  
**Recommended**: Implement this unified data flow model  
**Estimated effort**: 4-5 hours (8 functions, clear pattern)
