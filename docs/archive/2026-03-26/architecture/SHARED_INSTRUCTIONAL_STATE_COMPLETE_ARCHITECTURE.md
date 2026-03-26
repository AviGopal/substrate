# Shared Instructional State: Complete Architecture

**Date**: 2026-02-20  
**Status**: 🔴 Critical Architecture Gap - Design Complete, Implementation Needed  
**Priority**: HIGH - Blocks activity composition and lifecycle hooks

---

## Executive Summary

### The Core Problem

You've identified a **fundamental architecture requirement** that the current implementation doesn't fully support:

> "We need a representation of the instructional state (the context window, split into different impulses) shared across the session that each activity in the execution graph has a slice of."

**Current (Partially Broken)**:
- ✅ SessionMemory exists (session-level impulse storage)
- ✅ Activity.impulses exists (activity-level impulse storage)
- ❌ Lifecycle hooks create impulses in child sessions (isolated)
- ❌ Activities create impulses in their own storage (not shared)
- ❌ No execution graph representation
- ❌ No budget allocation per activity/hook

**What We Need**:
- ✅ **Shared instructional state** across entire session execution graph
- ✅ **Budget slices** for each activity/lifecycle hook
- ✅ **Impulse inheritance** from parent → child activities
- ✅ **Property propagation** from child → parent activities
- ✅ **Pre-loaded impulses** from lifecycle hooks visible to main turn
- ✅ **Execution graph** representation showing all nodes and their context slices

---

## Conceptual Model: Two State Spaces

### 1. Instructional State (Shared Across Execution Graph)

**What**: Representation of available context for decision-making  
**Owner**: Session (NOT individual activities)  
**Lifetime**: Entire session duration  
**Purpose**: Inform all agents in execution graph

**Components**:
```typescript
{
  sessionID: "ses_abc123",
  totalBudget: 50000,  // Total tokens available
  
  // Flat impulse store - shared by all activities
  impulses: {
    "file:auth.ts": {
      budget: 5000,
      loaded: true,
      content: "...",
      owner: "lifecycle:memory-management",  // Who created it
    },
    "metabob:priority": {
      budget: 3000,
      loaded: false,
      content: null,
      owner: "act_xyz",  // Activity that created it
    },
  },
  
  // Budget allocations per execution node
  allocations: {
    "lifecycle:memory-management": {
      allocated: 5000,
      used: 4200,
      impulses: ["file:auth.ts"],
    },
    "act_xyz": {
      allocated: 15000,
      used: 12000,
      impulses: ["metabob:priority", "bash:tests"],
    },
  }
}
```

### 2. Functional State (Activity-Owned)

**What**: Modifications to the codebase  
**Owner**: Individual activities  
**Lifetime**: Activity execution duration  
**Purpose**: Track what changed, enable rollback

**Components**:
```typescript
{
  activityID: "act_xyz",
  templateId: "fix-bug-complete",
  
  // What this activity DID (functional changes)
  workArtifacts: {
    filesChanged: ["src/auth.ts"],
    commits: [{ sha: "abc123", message: "Fix auth bug" }],
    testResults: { passed: 15, failed: 0 },
  },
  
  // Execution evidence (process tracking)
  executionEvidence: {
    sessionsSpawned: ["ses_child1"],
    tasksCompleted: ["gather-context", "fix-bug", "test"],
  },
  
  // Correctness verification
  correctnessVerdict: {
    correct: true,
    reason: "All tests passing",
  },
  
  // ❌ NO impulses field - that's instructional state (in SessionMemory)
}
```

---

## The Architecture Gap

### Current State Analysis

**What Exists**:
1. ✅ `SessionMemory.Store` - Session-level impulse storage
2. ✅ `Activity.Schema` - Activity-level tracking
3. ✅ `turn-lifecycle-hooks.ts` - Pre-turn execution
4. ✅ `executeActivityInline()` - Lifecycle hook execution
5. ✅ Impulse tools (create, load, unload, list)

**What's Broken**:
1. ❌ `executeActivityInline()` creates child session → impulses isolated
2. ❌ `Activity.Schema.impulses` stores impulses per-activity → not shared
3. ❌ Impulse tools check "is activity session?" → special-case logic
4. ❌ No budget allocation per activity/hook
5. ❌ No execution graph representation
6. ❌ Transfer logic in hooks is a band-aid, doesn't solve composition

**Root Cause**:
```typescript
// In activity.ts tool & executeActivityInline:
if (activityID) {
  // ❌ Write to Activity.impulses (isolated storage)
  activity.impulses[id] = impulse
} else {
  // ✅ Write to SessionMemory (shared storage)
  sessionMemory.impulses[id] = impulse
}
```

This bifurcation creates isolation where we need sharing!

---

## Solution Architecture

### Phase 1: Unify Impulse Storage ⚡ CRITICAL

**Goal**: ALL impulses use `SessionMemory`, NONE use `Activity.impulses`

**Changes**:

```typescript
// 1. Remove Activity.Schema.impulses field
export const Schema = z.object({
  id: z.string(),
  templateId: z.string(),
  status: Status,
  
  // ✅ Keep functional state
  workArtifacts: WorkArtifacts.optional(),
  executionEvidence: ExecutionEvidence.optional(),
  correctnessVerdict: CorrectnessVerdict.optional(),
  
  // ❌ REMOVE THIS:
  // impulses: z.record(z.string(), Impulse).optional(),
})

// 2. Update all impulse tools - ALWAYS use SessionMemory
export const ImpulseCreateTool = registerTool({
  async handler({ id, type, pointer, budget, priority }, ctx) {
    const sessionID = ctx.sessionID
    
    // ✅ Always write to SessionMemory
    const store = await SessionMemory.load(sessionID)
    store.impulses[id] = {
      id,
      type,
      pointer,
      budget,
      priority,
      loaded: false,
      content: null,
      owner: determineOwner(ctx),  // NEW: Track who created it
    }
    await SessionMemory.save(store)
    
    // ✅ Track activity stats (NOT impulse storage)
    const activityID = Activity.getActivityForSession(sessionID)
    if (activityID) {
      await Activity.updateMemoryStats(activityID, {
        impulsesCreated: +1,
      })
    }
  }
})

// 3. Update executeActivityInline - Execute in parent session
export async function executeActivityInline(
  templateId: string,
  variables: Record<string, unknown>,
  parentSessionID: string,  // ✅ Execute HERE, not in child
  reason: string,
  parentMessageID: string
) {
  const template = await TemplateRepository.get(templateId)
  const activity = await Activity.create({ ... })
  
  // ✅ NO child session creation!
  // Execute directly in parent session
  const result = await executeTemplate(
    template,
    activity,
    variables,
    parentSessionID,  // ✅ Execute in THIS session
    null,  // No separate calling session
    reason,
    parentMessageID
  )
  
  // ✅ NO impulse transfer needed
  // Impulses already in SessionMemory.load(parentSessionID)
  return {
    success: result.success,
    activityId: activity.id,
    // NO impulses field
  }
}

// 4. Update turn-lifecycle-hooks - Remove transfer logic
async function executeMemoryManagement(ctx) {
  // Execute in parent session
  await executeActivityInline(
    "manage-session-memory",
    variables,
    ctx.sessionID,  // ✅ Execute in THIS session
    reason,
    ctx.messageID
  )
  
  // ✅ NO transfer needed - impulses already in ctx.sessionID
  
  log.info("memory management completed", {
    sessionID: ctx.sessionID,
    impulseCount: (await SessionMemory.load(ctx.sessionID)).impulses.length,
  })
}
```

**Benefits**:
- ✅ Lifecycle hooks create impulses in parent session (visible immediately)
- ✅ Activities share instructional state (no isolation)
- ✅ Nested activities work (child sees parent's impulses)
- ✅ No transfer logic needed (single source of truth)
- ✅ Activity composition "just works"

---

### Phase 2: Budget Allocation & Execution Graph

**Goal**: Track how much budget each activity/hook uses, build execution graph

**Schema Extensions**:

```typescript
// Extend SessionMemory.Store
export interface Store {
  sessionID: string
  impulses: Record<string, Impulse>
  totalBudget: number
  usedTokens: number
  lastOptimized: number
  
  // ✅ NEW: Budget allocations
  allocations: Record<string, BudgetAllocation>
  
  // ✅ NEW: Execution graph
  executionGraph: ExecutionGraph
}

export interface BudgetAllocation {
  id: string  // "lifecycle:memory-management" or "act_xyz"
  type: "lifecycle" | "activity" | "main-agent"
  allocated: number  // Budget slice
  used: number  // Actual tokens used
  impulsesOwned: string[]  // Impulse IDs created
  status: "active" | "released"
}

export interface ExecutionGraph {
  rootNode: ExecutionNode
  nodes: Map<string, ExecutionNode>
}

export interface ExecutionNode {
  id: string
  type: "message" | "activity" | "lifecycle-hook"
  
  // Context
  messageID?: string
  promptText?: string
  activityID?: string
  templateId?: string
  hookName?: string
  
  // Budget
  budgetAllocated: number
  budgetUsed: number
  impulses: string[]
  
  // Execution
  startedAt: number
  completedAt?: number
  status: "pending" | "executing" | "completed" | "failed"
  
  // Graph structure
  parentID?: string
  childIDs: string[]
}
```

**New APIs**:

```typescript
// Budget management
export async function allocateBudget(
  sessionID: string,
  allocationId: string,
  amount: number,
  type: "lifecycle" | "activity" | "main-agent"
): Promise<void> {
  const store = await load(sessionID)
  
  // Check available budget
  const available = store.totalBudget - store.usedTokens
  if (amount > available) {
    log.warn("budget allocation exceeds available", {
      requested: amount,
      available,
      sessionID,
      allocationId,
    })
    // Don't throw - allow overrun, just warn
  }
  
  store.allocations[allocationId] = {
    id: allocationId,
    type,
    allocated: amount,
    used: 0,
    impulsesOwned: [],
    status: "active",
  }
  
  await save(store)
}

export async function releaseBudget(
  sessionID: string,
  allocationId: string
): Promise<void> {
  const store = await load(sessionID)
  if (store.allocations[allocationId]) {
    store.allocations[allocationId].status = "released"
  }
  await save(store)
}

export async function trackImpulseOwnership(
  sessionID: string,
  impulseId: string,
  ownerId: string
): Promise<void> {
  const store = await load(sessionID)
  if (store.allocations[ownerId]) {
    store.allocations[ownerId].impulsesOwned.push(impulseId)
  }
  await save(store)
}

// Execution graph
export async function addExecutionNode(
  sessionID: string,
  node: ExecutionNode
): Promise<void> {
  const store = await load(sessionID)
  store.executionGraph.nodes.set(node.id, node)
  
  // Link to parent
  if (node.parentID) {
    const parent = store.executionGraph.nodes.get(node.parentID)
    if (parent) {
      parent.childIDs.push(node.id)
    }
  }
  
  await save(store)
}

export async function visualizeExecutionGraph(
  sessionID: string
): Promise<string> {
  const store = await load(sessionID)
  return toMermaid(store.executionGraph)
}
```

---

### Phase 3: Activity Composition Patterns

**Goal**: Enable activities to call activities, properties flow correctly

**Pattern 1: Nested Activity Calls**

```typescript
// Parent activity template (e.g., "build-feature-complete")
{
  "tasks": [
    {
      "id": "implement-feature",
      "subagent": "activity",
      "prompt": {
        "template": "Use the activity tool to implement: {{featureName}}",
        "variables": [{"name": "featureName", "type": "string"}]
      }
    },
    {
      "id": "add-tests",
      "subagent": "activity",
      "dependencies": ["implement-feature"],
      "prompt": {
        "template": "Use the activity tool to add tests for: {{featureName}}",
      }
    },
    {
      "id": "commit-changes",
      "subagent": "activity",
      "dependencies": ["add-tests"],
      "prompt": {
        "template": "Use the activity tool to commit changes",
      }
    }
  ]
}
```

**How It Works**:
1. Task 1 executes → calls activity tool for "add-feature-complete"
2. Child activity creates impulses in SESSION (shared)
3. Task 2 executes → sees impulses from Task 1 ✅
4. Task 3 executes → sees impulses from Tasks 1 & 2 ✅

**Pattern 2: Lifecycle Hook Enrichment**

```typescript
// Lifecycle hook runs BEFORE main turn
async function executeMemoryManagement(ctx) {
  // Allocate budget for hook
  await SessionMemory.allocateBudget(
    ctx.sessionID,
    "lifecycle:memory-management",
    5000,
    "lifecycle"
  )
  
  // Execute in parent session
  await executeActivityInline(
    "manage-session-memory",
    { userMessage: ctx.promptText },
    ctx.sessionID,
    "Pre-turn context preparation",
    ctx.messageID
  )
  
  // Impulses created by hook are NOW in ctx.sessionID
  const store = await SessionMemory.load(ctx.sessionID)
  log.info("memory hook completed", {
    impulsesCreated: Object.keys(store.impulses).length,
    budgetUsed: store.allocations["lifecycle:memory-management"].used,
  })
  
  // Main turn starts with enriched context ✅
}
```

**Pattern 3: Property Propagation (Child → Parent)**

```typescript
// Child activity sets property that parent needs
// Example: "gather-context" task creates impulse for "fix-bug" task

// In "fix-bug-complete" template:
{
  "tasks": [
    {
      "id": "gather-context",
      "subagent": "memory",
      "prompt": {
        "template": "Create impulses for bug analysis: {{bugDescription}}",
      },
      "outputs": ["contextImpulses"]  // ✅ Declare outputs
    },
    {
      "id": "fix-bug",
      "subagent": "general",
      "dependencies": ["gather-context"],
      "impulseReferences": ["{{contextImpulses}}"],  // ✅ Reference outputs
      "prompt": {
        "template": "Fix the bug based on gathered context",
      }
    }
  ]
}
```

How outputs work:
1. Task "gather-context" creates impulses via `impulse_create` tool
2. Template executor captures impulse IDs created during task
3. Output `contextImpulses` = array of impulse IDs
4. Task "fix-bug" references `{{contextImpulses}}` → loads those impulses
5. Property flows: child task → parent template → child task ✅

---

## Implementation Roadmap

### Milestone 1: Unify Impulse Storage (Week 1) ⚡ CRITICAL

**Estimated**: 10-15 hours

**Tasks**:
1. [2h] Remove `Activity.Schema.impulses` field, update schema
2. [2h] Update all impulse tools to ALWAYS use `SessionMemory`
3. [2h] Update `executeActivityInline` to execute in parent session
4. [2h] Update turn-lifecycle-hooks to remove transfer logic
5. [2h] Update `executeTemplate` to not create child session for hooks
6. [3h] Add migration for existing activities with impulses
7. [2h] Write comprehensive tests

**Tests**:
- ✅ Lifecycle hook creates impulses in parent session
- ✅ Main agent can see impulses with `impulse_list`
- ✅ Nested activities share instructional state
- ✅ Activity tool works with new storage
- ✅ No regressions in existing functionality

**Success Criteria**:
- ✅ 0 instances of impulse transfer logic
- ✅ 100% of impulses in SessionMemory
- ✅ Lifecycle hook impulses visible to main turn
- ✅ All tests passing

---

### Milestone 2: Budget Allocation (Week 2)

**Estimated**: 15-20 hours

**Tasks**:
1. [3h] Add `allocations` and `executionGraph` to SessionMemory.Store
2. [3h] Implement budget allocation APIs (allocate, release, track)
3. [2h] Update lifecycle hooks to allocate budget
4. [2h] Update activity tool to allocate budget
5. [3h] Track impulse ownership per allocation
6. [2h] Add budget enforcement (warn on overrun)
7. [3h] Implement execution graph tracking
8. [2h] Write tests for budget management

**Tests**:
- ✅ Budget allocation prevents overrun (warning logged)
- ✅ Budget released after activity completes
- ✅ Impulse ownership tracked correctly
- ✅ Execution graph builds correctly
- ✅ Nested activities have proper graph structure

**Success Criteria**:
- ✅ Budget tracked for all activities/hooks
- ✅ Warnings logged for budget overruns
- ✅ Execution graph represents full hierarchy
- ✅ Impulse ownership clear

---

### Milestone 3: Visualization & Tooling (Week 3)

**Estimated**: 10-15 hours

**Tasks**:
1. [3h] Implement Mermaid graph generation
2. [2h] Create debug tool to inspect execution graph
3. [3h] Add budget utilization metrics
4. [2h] Create impulse ownership report
5. [2h] Add graph visualization to CLI
6. [3h] Write documentation and examples

**Deliverables**:
- ✅ CLI command: `opencode inspect-session <sessionID>`
- ✅ Shows execution graph with budget allocation
- ✅ Lists impulses per activity/hook
- ✅ Displays budget utilization
- ✅ Identifies budget bottlenecks

---

## Critical Design Decisions

### Decision 1: Remove Activity.impulses ✅

**Rationale**: Instructional state belongs to SESSION, not activities. Activities should modify shared state, not own isolated copies.

**Impact**: Breaking change, requires migration

**Mitigation**: Add migration script to move existing Activity.impulses → SessionMemory

---

### Decision 2: Lifecycle Hooks Execute in Parent Session ✅

**Rationale**: Lifecycle hooks are pre-turn enrichment, not isolated activities. They prepare context for main turn.

**Impact**: executeActivityInline signature changes, no child session created

**Mitigation**: Update documentation, test extensively

---

### Decision 3: Budget Allocation is Advisory (Warn, Don't Block) ✅

**Rationale**: Activities should be able to exceed budget if needed, but we track and warn about it.

**Impact**: No hard budget limits, but visibility into overruns

**Mitigation**: Log warnings, track metrics, optimize templates based on data

---

### Decision 4: Execution Graph Tracks All Nodes ✅

**Rationale**: Full visibility into execution hierarchy enables debugging, optimization, and learning.

**Impact**: Additional storage overhead (~1KB per session)

**Mitigation**: Archive old graphs, focus on recent sessions

---

## Testing Strategy

### Unit Tests

```typescript
describe("SessionMemory unification", () => {
  test("impulses created in activity visible in session", async () => {
    const sessionID = ulid()
    const activity = await Activity.create({ ... })
    Activity.registerSession(sessionID, activity.id)
    
    // Create impulse via tool
    await ImpulseCreateTool.handler({ id: "test", ... }, { sessionID })
    
    // Verify in SessionMemory
    const store = await SessionMemory.load(sessionID)
    expect(store.impulses["test"]).toBeDefined()
    expect(store.impulses["test"].owner).toBe(activity.id)
  })
  
  test("impulse_list shows all impulses", async () => {
    const sessionID = ulid()
    await SessionMemory.addImpulse(sessionID, { id: "test1", ... })
    await SessionMemory.addImpulse(sessionID, { id: "test2", ... })
    
    const result = await ImpulseListTool.handler({}, { sessionID })
    expect(result.impulses.length).toBe(2)
  })
})

describe("Budget allocation", () => {
  test("allocate and release budget", async () => {
    const sessionID = ulid()
    await SessionMemory.allocateBudget(sessionID, "act1", 10000, "activity")
    
    const store = await SessionMemory.load(sessionID)
    expect(store.allocations["act1"].allocated).toBe(10000)
    
    await SessionMemory.releaseBudget(sessionID, "act1")
    expect(store.allocations["act1"].status).toBe("released")
  })
  
  test("warn on budget overrun", async () => {
    const sessionID = ulid()
    const store = await SessionMemory.load(sessionID)
    store.totalBudget = 10000
    store.usedTokens = 8000
    await SessionMemory.save(store)
    
    // This should warn but not throw
    await SessionMemory.allocateBudget(sessionID, "act1", 5000, "activity")
    // Check logs for warning
  })
})

describe("Execution graph", () => {
  test("build graph from session activity", async () => {
    const sessionID = ulid()
    
    // Add nodes
    await SessionMemory.addExecutionNode(sessionID, {
      id: "root",
      type: "message",
      ...
    })
    await SessionMemory.addExecutionNode(sessionID, {
      id: "hook1",
      type: "lifecycle-hook",
      parentID: "root",
      ...
    })
    
    const store = await SessionMemory.load(sessionID)
    expect(store.executionGraph.nodes.size).toBe(2)
    expect(store.executionGraph.nodes.get("root").childIDs).toContain("hook1")
  })
})
```

### Integration Tests

```typescript
describe("Lifecycle hooks", () => {
  test("hook impulses visible to main turn", async () => {
    const sessionID = ulid()
    
    // Execute lifecycle hook
    await TurnLifecycle.executeHook("memory-management", {
      sessionID,
      promptText: "Fix auth bug",
      agent: { name: "activity", mode: "primary" },
      messageID: ulid(),
    })
    
    // Verify impulses in session
    const store = await SessionMemory.load(sessionID)
    expect(Object.keys(store.impulses).length).toBeGreaterThan(0)
    
    // Verify budget allocated
    expect(store.allocations["lifecycle:memory-management"]).toBeDefined()
  })
})

describe("Activity composition", () => {
  test("nested activity shares parent state", async () => {
    const sessionID = ulid()
    
    // Parent activity creates impulse
    Activity.registerSession(sessionID, "act_parent")
    await ImpulseCreateTool.handler({ id: "parent-impulse", ... }, { sessionID })
    
    // Child activity should see parent impulse
    const result = await ImpulseListTool.handler({}, { sessionID })
    expect(result.impulses.map(i => i.id)).toContain("parent-impulse")
  })
})
```

---

## Migration Guide

### For Existing Code Using Activity.impulses

**Before**:
```typescript
const activity = await Activity.get(activityId)
const impulse = activity.impulses?.["myImpulse"]
```

**After**:
```typescript
const sessionID = Activity.getSessionForActivity(activityId)  // New helper
const store = await SessionMemory.load(sessionID)
const impulse = store.impulses["myImpulse"]
```

### For Lifecycle Hooks

**Before**:
```typescript
const result = await executeActivityInline(templateId, vars, parent, reason, msgId)
// Manually transfer impulses
for (const [id, impulse] of Object.entries(result.impulses)) {
  await SessionMemory.addImpulse(parent, impulse)
}
```

**After**:
```typescript
await executeActivityInline(templateId, vars, parent, reason, msgId)
// NO transfer needed - impulses already in parent ✅
```

### For Activity Templates

**No changes needed** - templates use impulse tools, which now write to SessionMemory automatically ✅

---

## Success Metrics

### After Milestone 1 (Unify Storage)
- ✅ 0 instances of impulse transfer logic in codebase
- ✅ 100% of impulses stored in SessionMemory (not Activity.impulses)
- ✅ Lifecycle hooks create impulses visible to main turn
- ✅ All existing tests passing

### After Milestone 2 (Budget Allocation)
- ✅ Budget tracked for all activities/hooks
- ✅ Execution graph represents full hierarchy
- ✅ Impulse ownership clear (which activity created which impulse)
- ✅ Warnings logged for budget overruns

### After Milestone 3 (Visualization)
- ✅ CLI tool shows execution graph
- ✅ Budget utilization visible
- ✅ Impulse ownership report available
- ✅ Documentation complete

---

## Conclusion

The architecture requires **shared instructional state** where:
1. ✅ SessionMemory is the single source of truth for impulses
2. ✅ Activities operate on shared state (no isolation)
3. ✅ Lifecycle hooks enrich parent session context
4. ✅ Budget allocated per activity/hook (tracked, not enforced)
5. ✅ Execution graph represents full hierarchy
6. ✅ Nested activities compose correctly

This enables the full vision: **activities composing activities, lifecycle hooks pre-loading context, execution graph showing budget allocation, and property propagation between parent/child activities**.

**Next Action**: Implement Milestone 1 (Unify Impulse Storage) - 10-15 hours.
