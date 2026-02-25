# Session Memory and Impulse State Tracing: Complete Analysis

**Date**: 2026-02-24  
**Analysis Type**: Implementation Tracing & Guidelines Documentation  
**Scope**: How session memory agents and impulses link to calling agents in lifecycle hooks

---

## Executive Summary

This analysis provides a complete trace of how **session memory agents** and **impulses** interact when activities run as **lifecycle hooks**, focusing on state slice sharing between parent and child sessions.

### Key Findings

1. **Current Architecture Uses Transfer Model**
   - Lifecycle hooks execute in isolated child sessions
   - Impulses created in child sessions must be transferred to parent
   - Transfer logic converts scope from "activity" → "session"

2. **Planned Architecture Eliminates Transfer**
   - Unified impulse storage in SessionMemory (single source of truth)
   - No child sessions for lifecycle hooks (execute in parent)
   - Immediate visibility of impulses (no transfer needed)

3. **State Slice Guidelines Documented**
   - Session hierarchy clearly defined
   - Scope conversion rules traced
   - Visibility rules for each execution stage

---

## Documentation Created

### 1. Implementation Tracing Document
**File**: `SESSION_MEMORY_LIFECYCLE_TRACING.md`

**Contents**:
- Complete execution flow trace (7 steps)
- Step-by-step code walkthrough with line numbers
- Current vs. planned architecture comparison
- Guidelines for activity template authors
- Testing traceability with debug points

**Key Sections**:
- Current Architecture: State Slice Sharing
- Implementation Trace: Step-by-Step
- State Slice Guidelines: Current Implementation
- Planned Architecture: Unified State Slice
- Execution Flow Trace: Complete Example

### 2. Visual Diagrams Document
**File**: `SESSION_STATE_FLOW_DIAGRAM.md`

**Contents**:
- 10 Mermaid diagrams showing state flow
- Current vs. planned architecture visualizations
- Session hierarchy and execution graphs
- Scope conversion and budget allocation diagrams

**Key Diagrams**:
1. Current Architecture - Transfer-Based Flow
2. State Slice Ownership (Current)
3. Planned Architecture - Unified State
4. Session Hierarchy (Current)
5. Execution Graph (Planned)
6. Scope Conversion Rules
7. Budget Allocation (Planned)
8. Impulse Lifecycle (Current)
9. Impulse Lifecycle (Planned)
10. Multi-Activity Composition (Planned)

---

## Key Questions Answered

### Q1: How do lifecycle hooks share state with the session they're in?

**Answer**: Via a **two-stage transfer process**:

1. **Execution Stage**: Lifecycle hook executes in isolated child session
   - Child session created via `Session.createForActivity()`
   - Activity template executes (e.g., "manage-session-memory")
   - Memory agent analyzes intent and creates impulses
   - Impulses stored in child session's SessionMemory

2. **Transfer Stage**: Impulses transferred to parent session
   - `executeActivityInline()` collects impulses from all spawned sessions
   - Lifecycle hook handler converts scope: "activity" → "session"
   - `SessionMemory.addImpulse()` transfers to parent session
   - Main agent can now see impulses via `impulse_list` tool

**Code Location**: `src/session/turn-lifecycle-hooks.ts` (lines 75-118)

### Q2: How are impulses traced through the system?

**Answer**: Via **SessionMemory storage and session hierarchy**:

```
Parent Session (ses_primary)
└─ Child Session (ses_child_mem)
   ├─ Task Sub-Session (ses_task1) - Memory agent
   └─ Task Sub-Session (ses_task2) - Creates impulses here
      └─ Impulse: { id: "file:auth.ts", scope: "activity", sessionID: "ses_task2" }
         └─ [Transfer] → Parent Session impulse: { scope: "session", sessionID: "ses_primary" }
```

**Trace Points**:
1. Impulse creation: `impulse_create` tool in task sub-session
2. Storage: `SessionMemory[ses_task2].impulses["file:auth.ts"]`
3. Collection: `executeActivityInline()` gathers from all sessions
4. Conversion: Scope changed to "session", sessionID to parent
5. Transfer: Added to `SessionMemory[ses_primary]`
6. Visibility: Main agent sees via `impulse_list`

**Code Locations**:
- Creation: `src/tool/impulse.ts`
- Storage: `src/session/session-memory.ts` (lines 160-220)
- Collection: `src/tool/activity.ts` (lines 1411-1425)
- Transfer: `src/session/turn-lifecycle-hooks.ts` (lines 92-118)

### Q3: What are the state slice guidelines?

**Answer**: **Session hierarchy with scope-based isolation**:

**Ownership Rules**:
- Parent Session: Owns all transferred impulses (scope="session")
- Child Session: Owns impulses during execution (scope="activity")
- Task Sub-Sessions: Create impulses in their own SessionMemory

**Visibility Rules**:
- During execution: Child CANNOT see parent impulses
- After transfer: Parent CAN see child impulses
- Main agent: Sees only parent session impulses

**Scope Conversion Rules**:
| Stage | Scope | SessionID | Storage |
|-------|-------|-----------|---------|
| Creation | "activity" | ses_child | SessionMemory[ses_child] |
| Transfer | "session" | ses_parent | SessionMemory[ses_parent] |
| Usage | "session" | ses_parent | SessionMemory[ses_parent] |

**Code Locations**:
- Scope validation: `src/session/session-memory.ts` (lines 169-179)
- Conversion: `src/session/turn-lifecycle-hooks.ts` (lines 98-101)

### Q4: How will this change in the planned architecture?

**Answer**: **Unified state with no transfer**:

**Current (Transfer-Based)**:
```typescript
// 1. Create child session
const childSession = await Session.createForActivity(...)

// 2. Execute in child
const result = await executeTemplate(..., childSessionID)

// 3. Transfer impulses to parent
for (const impulse of result.impulses) {
  impulse.scope = "session"
  impulse.sessionID = parentSessionID
  await SessionMemory.addImpulse(parentSessionID, impulse)
}
```

**Planned (Unified)**:
```typescript
// 1. Execute in parent session (no child)
await executeTemplate(..., parentSessionID)

// 2. Impulses already in parent
// NO transfer needed - single source of truth
```

**Benefits**:
- ✅ Simpler architecture (no transfer logic)
- ✅ Immediate visibility
- ✅ Nested activities share state automatically
- ✅ Budget tracking per activity/hook
- ✅ Execution graph shows full hierarchy

**Migration Path**: See `SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md` (Phase 1)

---

## Guidelines for Developers

### When Writing Lifecycle Hook Activities

**DO**:
```typescript
// ✅ Create impulses using tools
await impulseCreate({
  id: "context-file",
  type: "file",
  pointer: { type: "file", path: "src/auth.ts" },
  budget: 2000,
  priority: "high"
})

// ✅ Use session scope
impulse.scope = "session"

// ✅ Keep hooks fast (<3s)
config.timeout = 3000
```

**DON'T**:
```typescript
// ❌ Don't assume immediate visibility
const impulses = await impulseList() // Won't see until after transfer

// ❌ Don't try to modify parent directly
await SessionMemory.addImpulse(parentSessionID, ...) // Will fail

// ❌ Don't use activity scope
impulse.scope = "activity" // Will fail transfer validation
```

### When Testing Lifecycle Hooks

**Trace Points to Monitor**:
```typescript
// 1. Hook execution start
log.info("memory management hook: starting execution")

// 2. Child session creation
log.debug("created child session for lifecycle activity")

// 3. Impulse creation
log.info("impulse created", { impulseId, sessionID })

// 4. Impulse collection
log.info("lifecycle activity execution complete", { impulseCount })

// 5. Transfer
log.debug("transferred impulse to parent session", { impulseId })

// 6. Main agent visibility
log.info("impulse_list called", { count })
```

**Test Files**:
- `test/session/turn-lifecycle-hooks.test.ts`
- `test/session/memory-optimization-integration.test.ts`
- `test/session/impulse-system-e2e.test.ts`

---

## Code References

### Key Files
1. **Turn Lifecycle Hooks**: `src/session/turn-lifecycle-hooks.ts`
   - Hook registration (lines 20-180)
   - Impulse transfer logic (lines 92-118)

2. **Activity Tool**: `src/tool/activity.ts`
   - executeActivityInline (lines 1190-1450)
   - Impulse collection (lines 1411-1425)
   - Child session creation (lines 1268-1284)

3. **Session Memory**: `src/session/session-memory.ts`
   - Impulse storage (lines 160-220)
   - Scope validation (lines 169-179)
   - Budget tracking (lines 191-194)

4. **Memory Agent**: `src/session/memory-agent.ts`
   - Intent analysis (lines 140-300)
   - Impulse suggestions (lines 301-400)

### Key Interfaces

```typescript
// SessionMemory.Store (current)
interface Store {
  sessionID: string
  impulses: Record<string, Impulse>
  totalBudget: number
  usedTokens: number
  lastOptimized: number
}

// SessionMemory.Store (planned)
interface Store {
  sessionID: string
  impulses: Record<string, Impulse>  // Single source of truth
  totalBudget: number
  usedTokens: number
  lastOptimized: number
  allocations: Record<string, BudgetAllocation>  // NEW
  executionGraph: ExecutionGraph  // NEW
}

// Impulse Schema
interface Impulse {
  id: string
  type: "file" | "metabobIssue" | "memo" | "bashOutput"
  pointer: Pointer
  budget: number
  priority: "high" | "medium" | "low"
  loaded: boolean
  content?: string
  scope: "session" | "activity"
  sessionID: string
  owner?: string  // NEW in planned architecture
}
```

---

## Migration Roadmap

### Phase 1: Unify Impulse Storage (⚡ CRITICAL)
**Estimated**: 10-15 hours

**Tasks**:
1. Remove `Activity.Schema.impulses` field
2. Update all impulse tools to use SessionMemory
3. Update `executeActivityInline` to execute in parent session
4. Remove transfer logic from lifecycle hooks
5. Write migration for existing activities
6. Comprehensive testing

**Success Criteria**:
- ✅ 0 instances of impulse transfer logic
- ✅ 100% of impulses in SessionMemory
- ✅ Lifecycle hook impulses visible immediately

### Phase 2: Budget Allocation & Execution Graph
**Estimated**: 15-20 hours

**Tasks**:
1. Add allocations to SessionMemory.Store
2. Implement budget allocation APIs
3. Track impulse ownership
4. Build execution graph
5. Add budget enforcement (warnings)

**Success Criteria**:
- ✅ Budget tracked per activity/hook
- ✅ Execution graph shows hierarchy
- ✅ Impulse ownership clear

### Phase 3: Visualization & Tooling
**Estimated**: 10-15 hours

**Tasks**:
1. Mermaid graph generation
2. Debug tools for execution graph
3. Budget utilization metrics
4. CLI visualization
5. Documentation

**Deliverables**:
- ✅ CLI: `opencode inspect-session <sessionID>`
- ✅ Budget utilization reports
- ✅ Execution graph visualization

---

## Related Documentation

### Architecture Documents
- **Primary Spec**: `docs/architecture/SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md`
- **Memory Agent**: `packages/opencode/docs/MEMORY_AGENT_IMPLEMENTATION.md`
- **Impulse System**: `docs/ACTIVITY_IMPULSE_SYSTEM.md`

### Implementation Files
- **Turn Lifecycle**: `src/session/turn-lifecycle.ts`
- **Session Memory**: `src/session/session-memory.ts`
- **Activity Tool**: `src/tool/activity.ts`
- **Memory Agent**: `src/session/memory-agent.ts`

### Test Files
- **Lifecycle Hooks**: `test/session/turn-lifecycle-hooks.test.ts`
- **Memory Integration**: `test/session/memory-optimization-integration.test.ts`
- **Impulse E2E**: `test/session/impulse-system-e2e.test.ts`

---

## Conclusion

This analysis provides complete traceability of how session memory and impulses link through lifecycle hooks:

### Current Implementation (Transfer-Based)
- ✅ Works reliably with transfer logic
- ✅ Impulses eventually visible to main agent
- ⚠️  Complex transfer mechanism
- ⚠️  Temporary isolation during execution

### Planned Implementation (Unified)
- ✅ Simpler architecture (no transfer)
- ✅ Immediate visibility
- ✅ Nested activities compose naturally
- ✅ Budget tracking and execution graphs
- ⚠️  Requires migration effort

**Next Steps**: 
1. Review with team
2. Prioritize Phase 1 implementation
3. Plan migration strategy for existing code

---

**Documents Created**:
- `SESSION_MEMORY_LIFECYCLE_TRACING.md` - Implementation trace
- `SESSION_STATE_FLOW_DIAGRAM.md` - Visual diagrams
- `SESSION_STATE_TRACING_SUMMARY.md` - This summary
