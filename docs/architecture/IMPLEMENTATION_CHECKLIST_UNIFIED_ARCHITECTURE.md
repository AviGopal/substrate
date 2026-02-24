# Implementation Checklist: Unified Session-Activity Architecture

**Date**: 2026-02-20  
**Architecture**: SessionMemory (read layer) + Activity.impulses (persistence layer)  
**Estimated Time**: 4-5 hours

---

## Implementation Order

### Phase 1: Shared Helper Function (30 min)

**File**: `packages/opencode/src/session/impulse-sync.ts` (NEW)

```typescript
import { Activity } from "./activity"
import { Session } from "./session"
import { SessionMemory } from "./session-memory"
import { ActivityTemplate } from "./activity-template"
import { Log } from "../util/log"

const log = Log.create({ service: "impulse-sync" })

/**
 * Sync impulse to Activity.impulses if in parent activity session.
 * 
 * Rules:
 * - Standalone session: No sync (no activity)
 * - Child session: No sync (parent already synced)
 * - Parent activity session: Sync to Activity.impulses
 */
export async function syncImpulseToActivity(
  sessionID: string,
  impulse: ActivityTemplate.Impulse.Schema
): Promise<void> {
  // Check if session is part of activity
  const activityId = Activity.getActivityForSession(sessionID)
  if (!activityId) {
    log.debug("no activity for session, skipping sync", { sessionID })
    return // Standalone session
  }

  // Check if this is a child session
  const session = await Session.load(sessionID)
  if (session.parentSessionId) {
    log.debug("child session, skipping sync (parent synced)", { 
      sessionID, 
      parentSessionId: session.parentSessionId 
    })
    return // Parent already synced
  }

  // Sync to activity (parent session only)
  await Activity.addImpulses(activityId, { [impulse.id]: impulse })
  log.debug("synced impulse to activity", { sessionID, activityId, impulseId: impulse.id })
}

/**
 * Delete impulse from Activity.impulses if in parent activity session.
 */
export async function deleteImpulseFromActivity(
  sessionID: string,
  impulseId: string
): Promise<void> {
  const activityId = Activity.getActivityForSession(sessionID)
  if (!activityId) return

  const session = await Session.load(sessionID)
  if (session.parentSessionId) return

  const activity = await Activity.load(activityId)
  delete activity.impulses[impulseId]
  await Activity.save(activity)
  log.debug("deleted impulse from activity", { sessionID, activityId, impulseId })
}
```

**Checklist**:
- [ ] Create `impulse-sync.ts` file
- [ ] Implement `syncImpulseToActivity()`
- [ ] Implement `deleteImpulseFromActivity()`
- [ ] Add logging for debugging
- [ ] Export functions

---

### Phase 2: Update Impulse Tools (2 hours)

#### 2.1 impulse-create.ts

**Add after SessionMemory.addImpulse()**:

```typescript
import { syncImpulseToActivity } from "../session/impulse-sync"

// After: await SessionMemory.addImpulse(sessionID, impulse)
await syncImpulseToActivity(sessionID, impulse)
```

**Checklist**:
- [ ] Import `syncImpulseToActivity`
- [ ] Add sync call after SessionMemory write
- [ ] Remove commented-out updateMemoryStats block (clean up)
- [ ] Test: Create impulse in activity session → Check activity.impulses

#### 2.2 impulse-load.ts

**Add after SessionMemory.updateImpulse()**:

```typescript
import { syncImpulseToActivity } from "../session/impulse-sync"

// After: await SessionMemory.updateImpulse(sessionID, params.id, loadedImpulse)
await syncImpulseToActivity(sessionID, loadedImpulse)
```

**Checklist**:
- [ ] Import `syncImpulseToActivity`
- [ ] Add sync call after SessionMemory update
- [ ] Test: Load impulse → Check activity.impulses has loaded=true

#### 2.3 impulse-unload.ts

**Add after SessionMemory.updateImpulse()**:

```typescript
import { syncImpulseToActivity } from "../session/impulse-sync"

// After: await SessionMemory.updateImpulse(sessionID, params.id, unloadedImpulse)
await syncImpulseToActivity(sessionID, unloadedImpulse)
```

**Checklist**:
- [ ] Import `syncImpulseToActivity`
- [ ] Add sync call after SessionMemory update
- [ ] Test: Unload impulse → Check activity.impulses has loaded=false, content cleared

#### 2.4 impulse-delete.ts

**Replace SessionMemory.removeImpulse() section**:

```typescript
import { deleteImpulseFromActivity } from "../session/impulse-sync"

// After: await SessionMemory.removeImpulse(sessionID, params.id)
await deleteImpulseFromActivity(sessionID, params.id)
```

**Checklist**:
- [ ] Import `deleteImpulseFromActivity`
- [ ] Add delete call after SessionMemory remove
- [ ] Test: Delete impulse → Check activity.impulses no longer has impulse

#### 2.5 impulse-update.ts

**Add after SessionMemory.updateImpulse()**:

```typescript
import { syncImpulseToActivity } from "../session/impulse-sync"

// After: await SessionMemory.updateImpulse(sessionID, params.id, updatedImpulse)
await syncImpulseToActivity(sessionID, updatedImpulse)
```

**Checklist**:
- [ ] Import `syncImpulseToActivity`
- [ ] Add sync call after SessionMemory update
- [ ] Test: Update impulse → Check activity.impulses reflects changes

#### 2.6 impulse-list.ts

**No changes needed** (read-only tool)

**Checklist**:
- [ ] Verify: No sync calls needed (read-only)

---

### Phase 3: Activity Load - Warm SessionMemory Cache (1 hour)

**File**: `packages/opencode/src/session/activity.ts`

**Update `Activity.load()`**:

```typescript
export async function load(id: string): Promise<Info> {
  const activity = await Storage.read<Info>(["activity", id])
  
  // If activity has active session, warm SessionMemory cache
  if (activity.sessionId) {
    try {
      const sessionExists = await Session.exists(activity.sessionId)
      if (sessionExists) {
        log.debug("warming SessionMemory cache from activity.impulses", { 
          activityId: id, 
          sessionId: activity.sessionId,
          impulseCount: Object.keys(activity.impulses).length
        })
        
        // Sync impulses from storage to SessionMemory
        for (const impulse of Object.values(activity.impulses)) {
          await SessionMemory.addImpulse(activity.sessionId, impulse)
        }
        
        log.info("warmed SessionMemory cache", { 
          activityId: id, 
          sessionId: activity.sessionId,
          impulseCount: Object.keys(activity.impulses).length 
        })
      }
    } catch (error) {
      log.warn("failed to warm SessionMemory cache", { activityId: id, error })
      // Non-critical, continue
    }
  }
  
  log.info("loaded activity", { id })
  return activity
}
```

**Checklist**:
- [ ] Add SessionMemory cache warming in Activity.load()
- [ ] Add error handling (non-critical failure)
- [ ] Add logging for debugging
- [ ] Test: Load activity → Check SessionMemory has impulses

---

### Phase 4: Template Executor - Inherit Impulses (1 hour)

**File**: `packages/opencode/src/session/template-executor.ts`

**Add inheritance helper**:

```typescript
/**
 * Inherit loaded impulses from parent session to child task session.
 */
async function inheritImpulsesFromParent(
  parentSessionId: string,
  childSessionId: string
): Promise<void> {
  const parentImpulses = await SessionMemory.listImpulses(parentSessionId)
  const loadedImpulses = parentImpulses.filter(i => i.loaded)
  
  log.debug("inheriting impulses from parent", {
    parentSessionId,
    childSessionId,
    totalImpulses: parentImpulses.length,
    loadedImpulses: loadedImpulses.length,
  })
  
  for (const impulse of loadedImpulses) {
    await SessionMemory.addImpulse(childSessionId, impulse)
  }
  
  log.info("inherited impulses from parent", {
    parentSessionId,
    childSessionId,
    inheritedCount: loadedImpulses.length,
  })
}
```

**Call in task execution** (find where task session is created):

```typescript
// After creating task session
const taskSessionId = await Session.create({
  activityId: activity.id,
  parentSessionId: activity.sessionId,
})

// Inherit loaded impulses from parent
await inheritImpulsesFromParent(activity.sessionId, taskSessionId)

// Continue with task execution
```

**Checklist**:
- [ ] Add `inheritImpulsesFromParent()` helper
- [ ] Find task session creation point
- [ ] Add inheritance call after session creation
- [ ] Add logging for debugging
- [ ] Test: Execute activity → Check task sessions have parent's loaded impulses

---

### Phase 5: Testing & Validation (1 hour)

#### 5.1 Unit Tests

**Standalone Session**:
```typescript
test("impulse tools work without activity", async () => {
  const sessionId = await Session.create({})
  
  await impulse_create({ id: "test", pointer: { type: "memo", content: "test" }, budget: 1000 })
  
  const impulses = await SessionMemory.listImpulses(sessionId)
  expect(impulses).toHaveLength(1)
  
  // No activity.impulses to check (standalone)
})
```

**Activity Session (Parent)**:
```typescript
test("impulse tools sync to activity in parent session", async () => {
  const activity = await Activity.create({ templateId: "test", variables: {} })
  const parentSessionId = activity.sessionId
  
  await impulse_create({ id: "test", pointer: { type: "memo", content: "test" }, budget: 1000 })
  
  // Check SessionMemory
  const sessionImpulses = await SessionMemory.listImpulses(parentSessionId)
  expect(sessionImpulses).toHaveLength(1)
  
  // Check Activity.impulses
  const reloadedActivity = await Activity.load(activity.id)
  expect(Object.keys(reloadedActivity.impulses)).toHaveLength(1)
  expect(reloadedActivity.impulses["test"]).toBeDefined()
})
```

**Child Session (Task)**:
```typescript
test("impulse tools do NOT sync in child session", async () => {
  const activity = await Activity.create({ templateId: "test", variables: {} })
  const childSessionId = await Session.create({ 
    activityId: activity.id, 
    parentSessionId: activity.sessionId 
  })
  
  await impulse_create({ id: "child-impulse", pointer: { type: "memo", content: "test" }, budget: 1000 })
  
  // Check SessionMemory (child)
  const childImpulses = await SessionMemory.listImpulses(childSessionId)
  expect(childImpulses).toHaveLength(1)
  
  // Check Activity.impulses (should NOT have child-impulse)
  const reloadedActivity = await Activity.load(activity.id)
  expect(reloadedActivity.impulses["child-impulse"]).toBeUndefined()
})
```

**Inheritance**:
```typescript
test("child sessions inherit loaded impulses from parent", async () => {
  const activity = await Activity.create({ templateId: "test", variables: {} })
  const parentSessionId = activity.sessionId
  
  // Create and load impulse in parent
  await impulse_create({ id: "parent-impulse", pointer: { type: "memo", content: "test" }, budget: 1000 })
  await impulse_load({ id: "parent-impulse" })
  
  // Create child session
  const childSessionId = await Session.create({ 
    activityId: activity.id, 
    parentSessionId: parentSessionId 
  })
  
  // Inherit impulses
  await inheritImpulsesFromParent(parentSessionId, childSessionId)
  
  // Check child has parent's loaded impulses
  const childImpulses = await SessionMemory.listImpulses(childSessionId)
  expect(childImpulses).toHaveLength(1)
  expect(childImpulses[0].loaded).toBe(true)
})
```

**Checklist**:
- [ ] Test: Standalone session (no activity sync)
- [ ] Test: Activity parent session (dual write)
- [ ] Test: Child session (no sync, inherit)
- [ ] Test: Activity.load() warms cache
- [ ] Test: Inheritance copies loaded impulses

#### 5.2 Integration Tests

**TUI Display**:
```bash
# Start OpenCode TUI
cd repos/metabob-opencode && bun run dev

# Send message
> "What files are in the current directory?"

# Check TUI sidebar
# Expected: Memory section shows impulses (count > 0)
```

**Activity Persistence**:
```typescript
test("activity persistence includes impulses", async () => {
  const activity = await Activity.create({ templateId: "test", variables: {} })
  
  await impulse_create({ id: "test", pointer: { type: "memo", content: "test" }, budget: 1000 })
  await impulse_load({ id: "test" })
  
  // Save activity
  await Activity.save(activity)
  
  // Reload from storage
  const reloaded = await Activity.load(activity.id)
  expect(Object.keys(reloaded.impulses)).toHaveLength(1)
  expect(reloaded.impulses["test"].loaded).toBe(true)
})
```

**Template Executor**:
```typescript
test("template executor can read activity.impulses", async () => {
  // Execute activity with template that uses impulses
  const result = await activity({
    templateId: "add-feature-complete",
    variables: { featureName: "test", files: ["test.ts"] },
    reason: "Test impulse integration"
  })
  
  // Check activity has impulses after execution
  const activity = await Activity.load(result.activityId)
  expect(Object.keys(activity.impulses).length).toBeGreaterThan(0)
})
```

**Checklist**:
- [ ] Test: TUI shows impulses (manual)
- [ ] Test: Activity persistence includes impulses
- [ ] Test: Template executor reads activity.impulses
- [ ] Test: Memory manager plugin works

---

## Rollout Plan

### Step 1: Implement Shared Helper (30 min)
- Create `impulse-sync.ts`
- Test helper in isolation

### Step 2: Update Impulse Tools One-by-One (2 hours)
- impulse-create.ts → Test
- impulse-load.ts → Test
- impulse-unload.ts → Test
- impulse-delete.ts → Test
- impulse-update.ts → Test

### Step 3: Activity Cache Warming (1 hour)
- Update Activity.load()
- Test activity resumption

### Step 4: Template Executor Inheritance (1 hour)
- Add inheritance helper
- Update task execution
- Test multi-task activities

### Step 5: Full Integration Testing (1 hour)
- Run all unit tests
- Run TUI manual test
- Run template executor tests
- Verify SurrealDB extraction

---

## Success Criteria

### ✅ Unit Tests Pass
- [ ] Standalone session works (SessionMemory only)
- [ ] Activity session works (dual write)
- [ ] Child session works (no duplicate sync)
- [ ] Inheritance works (loaded impulses copied)

### ✅ Integration Tests Pass
- [ ] TUI shows impulses (manual verification)
- [ ] Activity persistence includes impulses
- [ ] Template executor reads activity.impulses
- [ ] Memory manager plugin works

### ✅ No Regressions
- [ ] Existing tests still pass
- [ ] Template execution unchanged
- [ ] Activity completion unchanged
- [ ] SurrealDB extraction unchanged

---

## Estimated Timeline

- **Phase 1** (Shared Helper): 30 minutes
- **Phase 2** (Impulse Tools): 2 hours
- **Phase 3** (Activity Load): 1 hour
- **Phase 4** (Template Executor): 1 hour
- **Phase 5** (Testing): 1 hour

**Total**: 5.5 hours (with buffer)

---

**Next**: Start with Phase 1 (shared helper function)
