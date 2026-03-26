# Activity.impulses Cleanup Plan

**Date**: 2026-02-20  
**Status**: 📋 PLAN COMPLETE  
**Context**: After fixing impulse tools, need to clean up Activity.impulses references

---

## Situation Analysis

### What We've Done ✅

1. Fixed all 6 impulse tools to use SessionMemory only
2. Committed: `d9460903` (222 lines removed)
3. Impulse creation now always uses SessionMemory

### What Remains ⏳

**Activity module still references `activity.impulses`** in:
1. `packages/opencode/src/tool/activity.ts` - 17 references
2. `packages/opencode/src/session/activity.ts` - Schema + functions
3. Tests - Multiple test files
4. Plugins - memory-manager.ts, impulse-optimizer.ts
5. Scripts - diagnose_session_memory.ts, check_memory_state.ts

---

## Strategic Decision

### Option 1: Keep Activity.impulses as Cache (RECOMMENDED) ✅

**Rationale**: Activity.impulses can serve as a **local cache** for the activity execution context, while SessionMemory remains the source of truth.

**Benefits**:
- ✅ Minimal code changes (mainly semantic)
- ✅ Activity can cache impulses for performance
- ✅ Backwards compatibility maintained
- ✅ Tests don't break
- ✅ Plugins keep working

**Implementation**:
1. Keep `activity.impulses` field in schema
2. Update docs: "Local impulse cache (source of truth: SessionMemory)"
3. On activity start: Load impulses from SessionMemory → cache in activity.impulses
4. On impulse create: Write to SessionMemory, update activity.impulses cache
5. On activity reload: Refresh cache from SessionMemory

**Code Changes**: ~50 lines (documentation, cache refresh logic)

---

### Option 2: Remove Activity.impulses Completely ❌

**Rationale**: Pure architecture - no duplication

**Problems**:
- ❌ Breaks all existing code (17+ references in activity.ts)
- ❌ Breaks all tests
- ❌ Breaks plugins
- ❌ Requires complete rewrite of activity execution logic
- ❌ High risk of introducing bugs

**Code Changes**: ~500+ lines (complete rewrite)

**Risk**: Very high

---

## Recommended Approach: Hybrid (Cache Pattern)

### Conceptual Model

```
SessionMemory (Source of Truth)
    ↓ (on activity start)
activity.impulses (Local Cache)
    ↓ (during execution)
Fast access without DB queries
    ↓ (on changes)
Write-through to SessionMemory
```

### Implementation Steps

**1. Update Schema Documentation** (5 minutes)

```typescript
// In activity.ts schema
impulses: z.record(z.string(), ActivityTemplate.Impulse.Schema)
  .default({})
  .describe("Local impulse cache (source of truth: SessionMemory)")
```

**2. Add Cache Refresh Function** (15 minutes)

```typescript
/**
 * Refresh activity impulse cache from SessionMemory
 */
export async function refreshImpulseCache(activityId: string): Promise<void> {
  const activity = await load(activityId)
  const sessionID = activity.sessionIDs[0]
  
  if (!sessionID) {
    return
  }
  
  // Load impulses from SessionMemory (source of truth)
  const impulses = await SessionMemory.listImpulses(sessionID)
  
  // Update cache
  activity.impulses = {}
  for (const impulse of impulses) {
    // Only cache impulses created by this activity
    if (impulse.metadata?.createdBy === activityId) {
      activity.impulses[impulse.id] = impulse
    }
  }
  
  await save(activity)
  
  log.debug("refreshed impulse cache", {
    activityId,
    impulseCount: Object.keys(activity.impulses).length
  })
}
```

**3. Update addImpulses to Write-Through** (10 minutes)

```typescript
export async function addImpulses(
  activityId: string,
  impulses: Record<string, ActivityTemplate.Impulse.Schema>,
): Promise<void> {
  const activity = await load(activityId)
  const sessionID = activity.sessionIDs[0]
  
  if (!sessionID) {
    throw new Error("Activity has no session")
  }
  
  // Write to SessionMemory (source of truth)
  for (const impulse of Object.values(impulses)) {
    await SessionMemory.addImpulse(sessionID, impulse)
  }
  
  // Update local cache
  activity.impulses = {
    ...activity.impulses,
    ...impulses,
  }
  
  await save(activity)
  
  log.info("added impulses (write-through)", {
    activityId,
    impulseCount: Object.keys(impulses).length,
  })
}
```

**4. Update Activity Tool** (10 minutes)

In `tool/activity.ts` after context gathering:

```typescript
// After: activity.impulses = impulses
// Add: Write to SessionMemory
const sessionID = activity.sessionIDs[0]
for (const impulse of Object.values(impulses)) {
  await SessionMemory.addImpulse(sessionID, impulse)
}

// activity.impulses is now a cache, SessionMemory is source
```

**5. Add Cache Invalidation** (optional)

On activity reload in task execution:

```typescript
// Before task execution
_activity = await Activity.load(_activity.id)

// Refresh cache from SessionMemory
await Activity.refreshImpulseCache(_activity.id)
```

---

## Benefits of Cache Pattern

1. **Backwards Compatibility** ✅
   - Existing code keeps working
   - Tests don't break
   - Plugins function normally

2. **Performance** ✅
   - Fast in-memory access during task execution
   - Avoid repeated SessionMemory queries

3. **Source of Truth** ✅
   - SessionMemory is authoritative
   - TUI always shows correct state
   - Activity cache is just for performance

4. **Low Risk** ✅
   - Minimal code changes
   - Easy to test
   - Easy to revert if issues

5. **Clear Semantics** ✅
   - "activity.impulses" = local cache
   - "SessionMemory" = source of truth
   - Documented in schema

---

## Alternative: Pure Read-Through

If we want to avoid cache staleness entirely:

```typescript
/**
 * Get impulses for activity (read-through from SessionMemory)
 */
export async function getImpulses(activityId: string): Promise<Record<string, Impulse>> {
  const activity = await load(activityId)
  const sessionID = activity.sessionIDs[0]
  
  if (!sessionID) {
    return {}
  }
  
  // Always read from SessionMemory (no cache)
  const impulses = await SessionMemory.listImpulses(sessionID)
  
  // Filter to impulses created by this activity
  return Object.fromEntries(
    impulses
      .filter(i => i.metadata?.createdBy === activityId)
      .map(i => [i.id, i])
  )
}
```

Then replace all `activity.impulses` with `await Activity.getImpulses(activity.id)`.

**Pros**: Always fresh, no cache staleness  
**Cons**: More DB queries, slower

---

## Recommendation

**Use Hybrid Cache Pattern**

**Reasoning**:
1. Low risk (minimal changes)
2. Fast (cached access)
3. Correct (SessionMemory is source)
4. Compatible (existing code works)

**Effort**: 1 hour

**Alternative**: If performance isn't critical, use pure read-through (2-3 hours)

---

## Next Steps

1. **Update schema documentation** (impulses = cache)
2. **Add refreshImpulseCache function**
3. **Update addImpulses to write-through**
4. **Test with lifecycle hooks + activity execution**
5. **Verify TUI sidebar shows impulses**
6. **Commit changes**

---

## Testing Plan

```bash
# 1. Start OpenCode
cd repos/metabob-opencode && bun run dev

# 2. Send message (triggers lifecycle hook)
> "Fix the bug in auth.ts"

# 3. Check TUI sidebar
# Expected: Impulses visible (from SessionMemory)

# 4. Execute activity
activity({
  templateId: "add-feature-complete",
  variables: { featureName: "test", files: ["test.ts"] },
  reason: "Test impulse caching"
})

# 5. Verify impulses appear in TUI
# 6. Check activity.impulses cache populated
# 7. Reload activity, verify cache refreshes
```

---

## Conclusion

**Decision**: Keep `activity.impulses` as **local cache**, SessionMemory as **source of truth**

**Effort**: 1 hour  
**Risk**: Low  
**Benefit**: High (compatibility + correctness)

This is the pragmatic approach that gives us the best of both worlds.
