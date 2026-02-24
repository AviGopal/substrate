# Session Summary: Shared Instructional State Architecture

**Date**: 2026-02-20  
**Duration**: ~2 hours  
**Status**: ✅ Architecture Design Complete - Ready for Implementation

---

## What We Accomplished

### 1. Identified Critical Architecture Gap ✅

**Your Requirement**:
> "We need a representation of the instructional state (the context window, split into different impulses) shared across the session that each activity in the execution graph has a slice of."

**Gap Identified**:
- ❌ Current: Lifecycle hooks create impulses in child sessions (isolated)
- ❌ Current: Activity.impulses stores impulses per-activity (not shared)
- ❌ Current: No execution graph representation
- ❌ Current: No budget allocation per activity/hook

### 2. Designed Complete Solution ✅

Created comprehensive architecture document:
**`SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md`** (20KB)

**Key Concepts**:
1. **Instructional State** - Context representation (SessionMemory, shared)
2. **Functional State** - Codebase changes (Activity, isolated)
3. **Budget Allocation** - Token slices per activity/hook
4. **Execution Graph** - Representation of session with activity nodes

### 3. Verified Current Implementation ✅

Ran static verification script - **ALL CHECKS PASSED**:
- ✅ Lifecycle hook registered
- ✅ Activity template exists (5 tasks)
- ✅ Memory agent tools configured (6/6)
- ✅ Tool implementations complete (6/6)
- ✅ SessionMemory.gatherContext() implemented
- ✅ Impulse scope conversion ready
- ✅ executeActivityInline() implemented

### 4. Created Implementation Roadmap ✅

**3 Milestones**:
1. **Milestone 1**: Unify impulse storage (10-15 hours) ⚡ CRITICAL
2. **Milestone 2**: Budget allocation (15-20 hours)
3. **Milestone 3**: Visualization (10-15 hours)

**Total Estimated**: 35-50 hours

---

## Critical Findings

### The Core Problem

**Current Architecture**:
```
Lifecycle Hook → Child Session (isolated) ❌
  ↓
Creates impulses in child session
  ↓
Transfer logic tries to copy to parent ❌
  ↓
Main Turn (can't see impulses reliably) ❌
```

**Required Architecture**:
```
Lifecycle Hook → Parent Session (shared) ✅
  ↓
Creates impulses in SessionMemory
  ↓
NO transfer needed
  ↓
Main Turn (sees all impulses immediately) ✅
```

### The Solution

**Remove bifurcation**:
```typescript
// ❌ BEFORE: Two storage locations
if (activityID) {
  activity.impulses[id] = impulse  // Isolated
} else {
  sessionMemory.impulses[id] = impulse  // Shared
}

// ✅ AFTER: One storage location
sessionMemory.impulses[id] = impulse  // Always shared
```

---

## Key Architectural Decisions

### 1. SessionMemory is Single Source of Truth ✅

**Decision**: ALL impulses stored in SessionMemory, NONE in Activity.impulses

**Impact**: Breaking change - Activity.Schema.impulses field removed

**Benefit**: 
- Lifecycle hooks enrich parent session
- Nested activities share context
- No transfer logic needed
- Activity composition works

### 2. Lifecycle Hooks Execute in Parent Session ✅

**Decision**: executeActivityInline() executes in parent session context

**Impact**: No child session created for lifecycle hooks

**Benefit**:
- Impulses created in parent session directly
- Main turn sees context immediately
- Pre-loaded impulses work correctly

### 3. Budget Allocation is Advisory ✅

**Decision**: Warn on budget overrun, don't block

**Impact**: Activities can exceed budget, but we track it

**Benefit**:
- Flexible for complex workflows
- Visibility into budget usage
- Can optimize based on data

### 4. Execution Graph Tracks All Nodes ✅

**Decision**: Build graph representation of session execution

**Impact**: Additional storage (~1KB per session)

**Benefit**:
- Debug composition issues
- Visualize budget allocation
- Understand execution patterns

---

## Implementation Plan

### Milestone 1: Unify Impulse Storage (Week 1) ⚡ CRITICAL

**Tasks**:
1. Remove `Activity.Schema.impulses` field
2. Update impulse tools to ALWAYS use SessionMemory
3. Update `executeActivityInline` to execute in parent session
4. Remove transfer logic from lifecycle hooks
5. Add migration for existing activities
6. Write comprehensive tests

**Success Criteria**:
- ✅ 0 instances of transfer logic
- ✅ 100% of impulses in SessionMemory
- ✅ Lifecycle hooks visible to main turn
- ✅ All tests passing

**Estimated**: 10-15 hours

---

### Milestone 2: Budget Allocation (Week 2)

**Tasks**:
1. Add `allocations` to SessionMemory.Store
2. Implement budget APIs (allocate, release, track)
3. Track impulse ownership per allocation
4. Implement execution graph tracking
5. Add budget enforcement (warnings)
6. Write tests

**Success Criteria**:
- ✅ Budget tracked for all activities/hooks
- ✅ Execution graph represents hierarchy
- ✅ Impulse ownership clear
- ✅ Warnings for overruns

**Estimated**: 15-20 hours

---

### Milestone 3: Visualization & Tooling (Week 3)

**Tasks**:
1. Mermaid graph generation
2. Debug tool for execution graph
3. Budget utilization metrics
4. Impulse ownership report
5. CLI visualization
6. Documentation

**Success Criteria**:
- ✅ CLI command shows graph
- ✅ Budget utilization visible
- ✅ Ownership report available
- ✅ Documentation complete

**Estimated**: 10-15 hours

---

## Files Created

### Architecture Documents
1. **`SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md`** (20KB)
   - Complete solution architecture
   - Implementation roadmap
   - Design decisions
   - Testing strategy
   - Migration guide

2. **`SESSION_MEMORY_VERIFICATION_PLAN.md`** (15KB)
   - Static verification checklist
   - Testing procedures
   - Expected log output
   - Troubleshooting guide

3. **`INSTRUCTIONAL_TO_FUNCTIONAL_STATE_BRIDGE.old.md`** (backup)
   - Old conceptual model
   - Preserved for reference

### Testing Scripts
1. **`test-session-memory.sh`**
   - Static verification script
   - All checks passed ✅

---

## Next Actions

### Immediate (Before Implementation)

1. **Review Architecture** (30 min)
   - Read `SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md`
   - Validate design decisions
   - Identify any gaps or concerns

2. **Live Session Test** (15 min) - OPTIONAL
   - Run OpenCode session
   - Test lifecycle hook execution
   - Verify impulse behavior
   - Measure performance

### Implementation (Week 1)

3. **Start Milestone 1** (10-15 hours)
   - Remove Activity.impulses field
   - Update impulse tools
   - Update executeActivityInline
   - Remove transfer logic
   - Add tests

---

## Key Insights

### Insight 1: Two State Spaces

**Instructional State** (shared across execution graph):
- Impulses (lazy-loaded context)
- Budget allocations
- Loading state
- Owned by SESSION

**Functional State** (activity-owned):
- File changes
- Git commits
- Test results
- Verification verdicts
- Owned by ACTIVITY

**Separation enables**: Shared context + isolated changes = composability

---

### Insight 2: Composition Requirements

Your requirements for activity composition:
1. ✅ Activities calling activities (via lifecycle hooks AND tools)
2. ✅ Shared instructional state (SessionMemory)
3. ✅ Property inheritance (output → input between tasks)
4. ✅ Pre-loaded impulses (lifecycle hooks)
5. ✅ Execution graph representation

**All blocked by**: Bifurcated impulse storage (Activity vs SessionMemory)

**Solution**: Unify storage → composition works

---

### Insight 3: Lifecycle Hooks are Context Enrichment

**Not**: Isolated activities with separate state  
**Are**: Pre-turn preparation that enriches parent session

**Impact**: Execute in parent session, not child session

**Benefit**: Impulses immediately available to main turn

---

## Success Metrics

### After Milestone 1
- ✅ 0 instances of impulse transfer logic
- ✅ 100% impulses in SessionMemory
- ✅ Lifecycle hooks visible to main turn
- ✅ Nested activities share context

### After Milestone 2
- ✅ Budget tracked for all activities/hooks
- ✅ Execution graph complete
- ✅ Impulse ownership clear

### After Milestone 3
- ✅ Visualization available
- ✅ Debug tools working
- ✅ Documentation complete

---

## Conclusion

We've identified a **critical architecture gap** and designed a **complete solution**:

1. **Problem**: Impulses stored in two places (isolated)
2. **Solution**: Single source of truth (SessionMemory)
3. **Benefit**: Activity composition works correctly

**The architecture is ready for implementation.**

**Estimated effort**: 35-50 hours across 3 milestones

**Next step**: Implement Milestone 1 (Unify Impulse Storage) - 10-15 hours

---

**Status**: 🟢 Design complete, ready to build
