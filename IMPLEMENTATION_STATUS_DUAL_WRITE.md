# Implementation Status: Dual-Write Pattern for Impulses

**Date**: 2026-02-20  
**Status**: ✅ Phase 1-2 Complete, Phase 3-4 Remaining

---

## Completed: Phase 1-2 (2 hours)

### Phase 1: Shared Helper Function ✅
**File**: `packages/opencode/src/session/impulse-sync.ts` (NEW)
**Commit**: `926429b1`

- ✅ Created `syncImpulseToActivity()` - Smart sync with parent/child detection
- ✅ Created `deleteImpulseFromActivity()` - Smart delete with parent/child detection
- ✅ Handles 3 cases: standalone session, parent session, child session
- ✅ TypeScript compilation passes

### Phase 2: Impulse Tools Updated ✅
**Files**: 6 impulse tools
**Commit**: `926429b1`

- ✅ `impulse-create.ts` - Write to SessionMemory + sync to Activity
- ✅ `impulse-load.ts` - Update SessionMemory + sync loaded state
- ✅ `impulse-unload.ts` - Update SessionMemory + sync unloaded state
- ✅ `impulse-delete.ts` - Delete from SessionMemory + delete from Activity
- ✅ `impulse-update.ts` - Update SessionMemory + sync changes
- ✅ `impulse-list.ts` - No changes (read-only)
- ✅ TypeScript compilation passes

---

## Remaining: Phase 3-4 (2-3 hours)

### Phase 3: Activity.load() Cache Warming ⏳
**File**: `packages/opencode/src/session/activity.ts`
**Status**: Needs implementation

**Change needed**:
```typescript
export async function load(id: string): Promise<Info> {
  const activity = await Storage.read<Info>(["activity", id])
  
  // Warm SessionMemory cache from storage
  const sessionId = activity.sessionIDs?.[0] || activity.negotiationSessionId
  if (sessionId) {
    const { Session } = await import("./index")
    const { SessionMemory } = await import("./session-memory")
    
    const sessionInfo = await Session.get(sessionId).catch(() => null)
    if (sessionInfo) {
      for (const impulse of Object.values(activity.impulses || {})) {
        await SessionMemory.addImpulse(sessionId, impulse)
      }
    }
  }
  
  return activity
}
```

**Why needed**: Activity resumption requires impulses to be in SessionMemory for TUI display.

### Phase 4: Template Executor Inheritance ⏳
**File**: `packages/opencode/src/session/template-executor.ts`
**Status**: Needs implementation

**Changes needed**:

1. Add inheritance helper:
```typescript
async function inheritImpulsesFromParent(
  parentSessionId: string,
  childSessionId: string
): Promise<void> {
  const parentImpulses = await SessionMemory.listImpulses(parentSessionId)
  for (const impulse of parentImpulses.filter(i => i.loaded)) {
    await SessionMemory.addImpulse(childSessionId, impulse)
  }
}
```

2. Call after task session creation:
```typescript
const taskSessionId = await Session.create({ activityId, parentID: parentSessionId })
await inheritImpulsesFromParent(parentSessionId, taskSessionId)
```

**Why needed**: Child task sessions need parent's loaded impulses for execution context.

---

## Current Architecture (Phase 1-2)

### Data Flow

```
Impulse Tools (create/load/unload/delete/update)
    │
    ├─► SessionMemory (ALWAYS write)
    │   └─► TUI displays impulses ✓
    │
    └─► Activity.impulses (conditional sync if parent session)
        └─► Storage persists ✓
        └─► Template executor reads ✓
        └─► Memory manager reads ✓
```

### Decision Logic

```typescript
syncImpulseToActivity(sessionID, impulse):
  activityId = Activity.getActivityForSession(sessionID)
  if (!activityId) return  // Standalone session
  
  session = await Session.get(sessionID)
  if (session.parentID) return  // Child session
  
  await Activity.addImpulses(activityId, { [impulse.id]: impulse })  // Parent session
```

---

## What Works Now (Phase 1-2)

✅ **Impulse tools work**:
- Create impulse → Writes to SessionMemory + Activity.impulses
- Load impulse → Updates both locations with loaded state
- Unload impulse → Updates both locations with unloaded state
- Delete impulse → Deletes from both locations
- Update impulse → Updates both locations

✅ **TUI will display impulses** (reads SessionMemory)

✅ **Activities persist impulses** (Activity.impulses populated)

✅ **Template executor can read** (activity.impulses exists)

✅ **Memory manager can read** (activity.impulses exists)

---

## What Doesn't Work Yet (Needs Phase 3-4)

❌ **Activity resumption**: Activity.load() doesn't warm SessionMemory cache
- Symptom: Resumed activities won't show impulses in TUI
- Fix: Phase 3 implementation

❌ **Task inheritance**: Child sessions don't inherit parent impulses
- Symptom: Tasks execute without parent's loaded context
- Fix: Phase 4 implementation

---

## Testing Status

### Tested ✅
- TypeScript compilation passes for Phase 1-2
- Impulse tools have correct sync calls
- Smart sync logic handles standalone/parent/child cases

### Not Yet Tested ⏳
- End-to-end flow (needs Phase 3-4)
- TUI display (needs manual test)
- Activity persistence (needs integration test)
- Template execution (needs integration test)

---

## Next Steps

1. **Complete Phase 3** (30-60 min)
   - Implement Activity.load() cache warming
   - Test activity resumption

2. **Complete Phase 4** (30-60 min)
   - Implement inheritance helper in template-executor.ts
   - Find task session creation point
   - Add inheritance call

3. **Phase 5: Testing** (1 hour)
   - Manual TUI test
   - Integration tests
   - Verify no regressions

4. **Commit Phases 3-4** together

---

## Estimated Remaining Time

- Phase 3: 30-60 minutes
- Phase 4: 30-60 minutes
- Phase 5: 1 hour
- **Total**: 2-3 hours

---

**Current Commit**: `926429b1` (Phase 1-2 complete)
**Next**: Implement Phase 3 (Activity.load cache warming)
