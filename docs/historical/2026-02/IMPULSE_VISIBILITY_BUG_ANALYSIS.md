# Impulse Visibility Bug Analysis

**Date**: 2026-02-20  
**Issue**: Impulses not showing in TUI sidebar  
**Root Cause**: Impulses stored in Activity.impulses instead of SessionMemory

---

## The Bug

**Symptom**: TUI sidebar shows 0 impulses even after lifecycle hooks execute

**Expected**: Lifecycle hooks create impulses → visible in sidebar

**Actual**: Lifecycle hooks create impulses → stored in Activity.impulses → NOT queried by sidebar

---

## Root Cause: Bifurcated Storage

The `impulse_create` tool has TWO storage paths:
1. **Activity-scoped**: Stores in `Activity.impulses` (when activityId exists)
2. **Session-scoped**: Stores in `SessionMemory` (when no activityId)

The TUI sidebar ONLY queries `SessionMemory`, so activity-scoped impulses are invisible.

---

## The Fix: Milestone 1 Architecture

**Solution**: Always store impulses in SessionMemory (remove Activity.impulses)

**Estimated**: 3-4 hours

**Changes**:
1. Update impulse-create.ts (remove bifurcation)
2. Update impulse-load.ts, impulse-unload.ts, etc.
3. Remove Activity.Schema.impulses field
4. Track impulse ownership via metadata (which activity created it)
5. Test with lifecycle hooks and activities

**Benefits**:
- ✅ TUI sidebar works
- ✅ Single source of truth
- ✅ Activity composition works
- ✅ Shared instructional state operational

---

**Next Action**: Implement fix (see SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md Milestone 1)
