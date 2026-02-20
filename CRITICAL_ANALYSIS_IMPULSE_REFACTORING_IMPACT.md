# CRITICAL ANALYSIS: Impulse Refactoring Impact

**Date**: 2026-02-20  
**Status**: 🚨 **BREAKING CHANGE IDENTIFIED**  
**Severity**: HIGH - Impacts core persistence and activity tracking

---

## Executive Summary

Our refactoring to move impulses from `Activity.impulses` to `SessionMemory` has **broken critical functionality**:

1. ❌ **Activity persistence**: Activities are saved with impulses to storage/SurrealDB
2. ❌ **Template executor**: Directly reads/writes `activity.impulses` in 6+ places
3. ❌ **Memory manager**: Plugin reads `activity.impulses` for optimization
4. ❌ **Activity completion**: Impulses are part of activity archival/extraction
5. ❌ **Impulse tracking**: `Activity.addImpulses()` is the canonical write path

**We removed the write path but not the read paths.**

---

## What We Broke

### 1. Activity Persistence to Storage ❌

**File**: `packages/opencode/src/session/activity.ts`

```typescript
export async function save(activity: Info): Promise<void> {
  const cleanedActivity = cleanImpulsesForStorage(activity)  // ← Expects activity.impulses
  await Storage.write(["activity", activity.id], cleanedActivity)
}

// Activity.impulses is persisted to storage (SurrealDB)
// Used for:
// - Activity archival
// - Session extraction
// - Activity resumption
// - Metrics/analytics
```

**Problem**: Our impulse tools no longer write to `activity.impulses`, so:
- Activities are saved with empty impulses `{}`
- Storage/SurrealDB has incomplete activity records
- Activity extraction will fail (no impulses to extract)

### 2. Template Executor Direct Access ❌

**File**: `packages/opencode/src/session/template-executor.ts`

Direct reads/writes to `activity.impulses` in 6+ places:

```typescript
Line 188: const allImpulses = Object.values(activity.impulses)
Line 231: const impulse = activity.impulses[impulseId]
Line 252: const impulse = activity.impulses[impulseId]
Line 257: activity.impulses[impulseId] = unloaded
Line 335: activity.impulses[impulse.id] = unloaded
Line 624: const impulse = activity.impulses[id]
Line 640: activity.impulses[id] = loadedImpulse
```

**Problem**: Template executor expects impulses in activity, not SessionMemory.

### 3. Activity.addImpulses() Canonical Write Path ❌

**File**: `packages/opencode/src/session/activity.ts`

```typescript
export async function addImpulses(
  activityId: string,
  impulses: Record<string, ActivityTemplate.Impulse.Schema>
): Promise<void> {
  const activity = await load(activityId)
  activity.impulses = { ...activity.impulses, ...impulses }  // ← Merges into activity
  await save(activity)  // ← Persists to storage
}
```

**Called by**:
- Template executor: Creates impulses from contextRequirements
- Template executor: Creates follow-up impulses
- Memory manager: (potentially)

**Problem**: This function is the canonical way to add impulses to activities, but our tools bypass it.

### 4. Memory Manager Plugin ❌

**File**: `packages/plugin-activities/src/memory-manager.ts`

```typescript
Line 81:  const impulses = Object.values(activity.impulses)
Line 126: const impulses = Object.values(activity.impulses)
Line 167: const impulses = Object.values(activity.impulses)
Line 255: const impulses = Object.values(activity.impulses)
Line 313: return Object.values(activity.impulses).reduce(...)
```

**Problem**: Memory optimization plugin expects activity.impulses to exist.

### 5. Trailblazing Executor ❌

**File**: `packages/opencode/src/session/trailblazing-executor.ts`

```typescript
Line 89: impulseSection = await loadAndFormatImpulses(task.impulseReferences, activity.impulses)
Line 93: if (activity.impulses[id]) { taskImpulses[id] = activity.impulses[id] }
Line 94: taskImpulses[id] = activity.impulses[id]
```

**Problem**: Trailblazing executor loads impulses from activity.

---

## Why This Happened

### Original Architecture (Pre-Refactoring)

```
Impulse Creation:
  impulse_create tool → Activity.addImpulses() → activity.impulses → Storage

Impulse Loading:
  Template Executor → activity.impulses → Read impulse → Load content

TUI Display:
  TUI sidebar → sync.data.session_memory[sessionID]?.impulses → SessionMemory ✗ (didn't work)
```

**Problem**: TUI queried SessionMemory but impulses were in Activity.impulses.

### Our Refactoring (Current, Broken)

```
Impulse Creation:
  impulse_create tool → SessionMemory.addImpulse() → SessionMemory ONLY

Impulse Loading:
  Template Executor → activity.impulses ✗ (empty!) → BROKEN

Activity Persistence:
  Activity.save() → activity.impulses ✗ (empty!) → Storage has no impulses

TUI Display:
  TUI sidebar → SessionMemory → ✓ (should work, but breaks everything else)
```

**Problem**: We fixed TUI but broke activity persistence and template execution.

---

## Correct Architecture (What We Need)

### Option 1: Dual Write (Write-Through Cache) ✅

**SessionMemory = Source of Truth, Activity.impulses = Cache**

```typescript
// impulse-create.ts
await SessionMemory.addImpulse(sessionID, impulse)  // ✓ Source of truth

// Also write to activity.impulses if in activity context
const activityId = Activity.getActivityForSession(sessionID)
if (activityId) {
  await Activity.addImpulses(activityId, { [impulse.id]: impulse })  // ✓ Cache for persistence
}
```

**Benefits**:
- ✅ TUI works (SessionMemory)
- ✅ Activity persistence works (activity.impulses)
- ✅ Template executor works (activity.impulses)
- ✅ Memory manager works (activity.impulses)
- ✅ Backward compatible

**Drawbacks**:
- Dual write complexity
- Sync issues if writes fail partially

### Option 2: SessionMemory Only + Fix All Consumers ❌

**SessionMemory = Only Source**

```typescript
// Change ALL readers:
template-executor.ts: activity.impulses → SessionMemory.listImpulses(sessionID)
memory-manager.ts: activity.impulses → SessionMemory.listImpulses(sessionID)
trailblazing-executor.ts: activity.impulses → SessionMemory.listImpulses(sessionID)

// Change Activity.save():
activity.ts: Don't persist activity.impulses, persist reference to SessionMemory

// Change Activity.addImpulses():
activity.ts: Forward to SessionMemory instead of activity.impulses
```

**Benefits**:
- Single source of truth
- Cleaner architecture long-term

**Drawbacks**:
- ❌ 50+ changes needed
- ❌ High risk of breaking tests
- ❌ Activity persistence model changes (storage schema change)
- ❌ Breaks activity extraction (activities won't have impulses in storage)
- ❌ Time-consuming (5-10 hours)

### Option 3: Revert + TUI Fix Only ⚠️

**Activity.impulses = Source of Truth, Fix TUI Query**

```typescript
// Revert impulse tools to use Activity.addImpulses()
// Fix TUI to query Activity.impulses instead of SessionMemory
```

**Benefits**:
- Minimal changes
- Keeps existing architecture

**Drawbacks**:
- Doesn't solve architectural problem
- TUI querying activities is weird (should query session state)
- Doesn't enable shared instructional state

---

## Recommended Solution

### Dual Write (Option 1) - Write-Through Cache Pattern

**Implementation** (2-3 hours):

1. **Update impulse-create.ts** (add dual write):
   ```typescript
   // Write to SessionMemory (source of truth)
   await SessionMemory.addImpulse(sessionID, impulse)
   
   // Write to activity.impulses (cache for persistence)
   const activityId = Activity.getActivityForSession(sessionID)
   if (activityId) {
     await Activity.addImpulses(activityId, { [impulse.id]: impulse })
   }
   ```

2. **Update impulse-load.ts** (sync loaded state):
   ```typescript
   // Load from SessionMemory
   const impulse = await SessionMemory.getImpulse(sessionID, params.id)
   // ... load content ...
   // Update SessionMemory
   await SessionMemory.updateImpulse(sessionID, params.id, loadedImpulse)
   
   // Sync to activity.impulses if in activity context
   const activityId = Activity.getActivityForSession(sessionID)
   if (activityId) {
     await Activity.addImpulses(activityId, { [params.id]: loadedImpulse })
   }
   ```

3. **Update impulse-unload.ts** (same pattern)

4. **Update impulse-delete.ts** (dual delete):
   ```typescript
   await SessionMemory.removeImpulse(sessionID, params.id)
   
   const activityId = Activity.getActivityForSession(sessionID)
   if (activityId) {
     const activity = await Activity.load(activityId)
     delete activity.impulses[params.id]
     await Activity.save(activity)
   }
   ```

5. **Update impulse-update.ts** (dual update)

6. **Add sync on Activity.load()** (ensure cache is warm):
   ```typescript
   export async function load(id: string): Promise<Info> {
     const activity = await Storage.read<Info>(["activity", id])
     
     // Sync impulses to SessionMemory if session exists
     const sessionID = /* get session ID for activity */
     if (sessionID) {
       for (const impulse of Object.values(activity.impulses)) {
         await SessionMemory.addImpulse(sessionID, impulse)
       }
     }
     
     return activity
   }
   ```

**Testing** (1 hour):
- Verify TUI shows impulses ✓
- Verify Activity.save() includes impulses ✓
- Verify template executor works ✓
- Verify memory manager works ✓
- Verify activity extraction works ✓

**Total time**: 3-4 hours

---

## Impact Assessment

### If We Don't Fix This

1. ❌ **Activities saved with no impulses** → SurrealDB has incomplete records
2. ❌ **Template executor fails** → Can't load/unload impulses during execution
3. ❌ **Memory optimization broken** → Plugin can't optimize memory
4. ❌ **Activity extraction fails** → Can't extract activities from sessions
5. ❌ **Metrics broken** → No impulse stats in activity analytics

### If We Implement Dual Write

1. ✅ **TUI shows impulses** → Original bug fixed
2. ✅ **Activities persist correctly** → SurrealDB has complete records
3. ✅ **Template executor works** → Reads from activity.impulses
4. ✅ **Backward compatible** → Existing code unchanged
5. ✅ **Low risk** → 6 files changed, clear pattern

---

## Next Steps (Immediate)

1. **STOP** - Do NOT run TUI test yet (will show broken state)
2. **Implement dual write** - Follow Option 1 above (3-4 hours)
3. **Test comprehensively**:
   - TUI shows impulses ✓
   - Activity.save() includes impulses ✓
   - Template execution works ✓
4. **Then run TUI test** - Should work end-to-end

---

## Files Requiring Changes

**Must Change** (Dual Write):
1. `packages/opencode/src/tool/impulse-create.ts` - Add dual write
2. `packages/opencode/src/tool/impulse-load.ts` - Sync loaded state
3. `packages/opencode/src/tool/impulse-unload.ts` - Sync unloaded state
4. `packages/opencode/src/tool/impulse-delete.ts` - Dual delete
5. `packages/opencode/src/tool/impulse-update.ts` - Dual update
6. `packages/opencode/src/session/activity.ts` - Optional: Sync on load

**Do NOT Change** (Keep as-is):
- `template-executor.ts` - Reads activity.impulses (works with cache)
- `memory-manager.ts` - Reads activity.impulses (works with cache)
- `trailblazing-executor.ts` - Reads activity.impulses (works with cache)

---

## Commit History

**Current broken state**:
```
d7c95e01 - Fix TypeScript errors in impulse tools (HEAD)
d9460903 - Fix: Always store impulses in SessionMemory ← BREAKS PERSISTENCE
```

**Need to add**:
```
NEXT - Implement write-through cache: dual write to SessionMemory + Activity.impulses
```

---

**Status**: 🚨 Breaking change identified, fix required before testing  
**Estimated fix time**: 3-4 hours  
**Risk**: Medium (clear pattern, well-defined changes)  
**Priority**: CRITICAL (blocks TUI test and activity persistence)
