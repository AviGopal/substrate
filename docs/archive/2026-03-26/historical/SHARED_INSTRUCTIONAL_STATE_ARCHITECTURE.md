# Shared Instructional State Architecture

## The Core Problem

**Current (Broken)**: Activities create impulses in isolated child sessions that can't be seen by the parent.

**Needed**: A shared instructional state (context window representation) that spans the execution graph.

## Architecture Vision

```
Session (owns instructional state)
├─ Instructional State
│   ├─ Budget: 50,000 tokens
│   ├─ Impulses: Map<id, Impulse>
│   └─ Allocations: Map<activityId, budgetSlice>
│
├─ Activity: manage-session-memory (lifecycle hook)
│   ├─ Operates on PARENT session's instructional state ✅
│   ├─ Creates impulses directly in parent ✅
│   └─ No transfer needed ✅
│
├─ Activity: add-feature-complete (user tool call)
│   ├─ Operates on PARENT session's instructional state ✅
│   ├─ Creates impulses directly in parent ✅
│   └─ No transfer needed ✅
│
└─ Main Agent
    └─ Sees ALL impulses from activities ✅
```

## Key Insight

**Instructional State belongs to the SESSION, not the activity.**

Activities are **functional state transitions** (they change the codebase).
Impulses are **instructional state** (they represent available context).

Activities should **operate on the parent session's instructional state** rather than creating their own isolated copy.

## Implementation Strategy

### Phase 1: Minimal Fix (Immediate)

Make lifecycle hooks execute in parent session context:

```typescript
// executeActivityInline - BEFORE
const activitySession = await Session.createForActivity({
  title: `Lifecycle: ${template.name}`,
  callingSessionID: parentSessionID,
  activityId: "",
})

// Execute in CHILD session (isolated) ❌
const result = await executeTemplate(
  template,
  activity,
  variables,
  activitySession.id,  // Child session ❌
  ...
)

// executeActivityInline - AFTER  
// DON'T create child session for lifecycle hooks
// Execute directly in parent session context ✅

const result = await executeTemplate(
  template,
  activity,
  variables,
  parentSessionID,  // Parent session ✅
  ...
)
```

**Impact**:
- ✅ Impulses created in parent session
- ✅ No transfer needed
- ✅ Main agent sees impulses immediately
- ⚠️ Execution still happens in parent (need to consider isolation)

### Phase 2: InstructionalState Abstraction (Later)

Create proper abstraction for shared state:

```typescript
class InstructionalState {
  sessionID: string
  totalBudget: number
  impulses: Map<string, Impulse>
  allocations: Map<string, number> // activityId → budget
  
  // Create impulse in session's state
  async createImpulse(impulse: Impulse): Promise<void>
  
  // Allocate budget slice to activity
  allocate(activityId: string, budget: number): void
  
  // Release budget back to pool
  release(activityId: string): void
  
  // Get available budget
  getAvailable(): number
}
```

**Benefits**:
- ✅ Centralized budget management
- ✅ Clear ownership (session owns state)
- ✅ Composable (activities share state)
- ✅ Measurable (track allocations)

## Why This Matters

### Without Shared State
```
User: "Fix auth bug"
  ↓
Lifecycle Hook: manage-session-memory
  Creates impulses in CHILD session ❌
  Returns to parent ❌
  ↓
Main Agent: 
  Sees NO impulses ❌
  Has no context ❌
  Makes uninformed decisions ❌
```

### With Shared State
```
User: "Fix auth bug"
  ↓
Lifecycle Hook: manage-session-memory
  Creates impulses in PARENT session ✅
  ↓
Main Agent:
  Sees ALL impulses ✅
  Has full context ✅
  Makes informed decisions ✅
```

## Open Questions

1. **Execution Isolation**: Should activity tasks execute in parent session or child?
   - **Parent**: Simpler, impulses automatically shared
   - **Child**: Better isolation, but need to share instructional state reference

2. **Budget Enforcement**: How strict?
   - **Strict**: Throw error if activity exceeds budget
   - **Flexible**: Allow overrun, track for metrics

3. **Concurrent Activities**: Can multiple activities run simultaneously?
   - If yes, need locking for instructional state modifications
   - If no, simpler but less flexible

## Next Steps

1. ✅ Document the architecture (this file)
2. ⏳ Implement Phase 1 (execute in parent session)
3. ⏳ Test with lifecycle hook
4. ⏳ Verify impulses visible to main agent
5. ⏳ Design Phase 2 (InstructionalState class)
6. ⏳ Implement Phase 2
7. ⏳ Extend to all activities (not just lifecycle hooks)

## Success Criteria

After Phase 1:
- ✅ Lifecycle hook creates impulses
- ✅ Main agent can see impulses with `impulse_list`
- ✅ Main agent can load impulses with `impulse_load`
- ✅ No transfer logic needed
- ✅ No "context has been reset" messages

After Phase 2:
- ✅ All activities share instructional state
- ✅ Budget managed centrally
- ✅ Nested activities work correctly
- ✅ Clear separation: instructional vs functional state
