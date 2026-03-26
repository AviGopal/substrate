# Architecture Correction: Optimization Tracking via Backend Variants

**Date**: March 9, 2026  
**Status**: ✅ Complete  
**Activity**: trace-enforce-validate-loop

---

## Summary

Three recent commits incorrectly added `OptimizationMetadata` to task schema, violating the principle that **templates are immutable references**. 

**Core Principle**: Optimization happens by creating new variants (new template IDs), not by updating metadata fields.

---

## Problem: Incorrect Architecture

### Problematic Commits

1. **9db99892** - Added `OptimizationMetadataSchema` to TaskSchema
2. **c7a9c87b** - Updated CLI and executor to use optimization metadata
3. **REFACTORING_REMOVE_BINARY_ACTIVITY_CLASSIFICATION.md** - Documented wrong approach

### Why Wrong

```typescript
// ❌ WRONG - Templates should be immutable
TaskSchema {
  optimization: {
    readiness: "learning" | "ready-for-conversion" | "partially-optimized"
    successRate: number
    avgCost: number
    deterministicSteps: string[]
  }
}
```

**Violations**:
- Templates are immutable references → optimization state changes → breaks immutability
- Backend already tracks via `variant_id` → duplicate state
- Creates confusion about source of truth

---

## Correct Architecture: External Tracking

### How Optimization Works

```
1. Execute Template
   activity.ts → extractVariantId() → variant_id: "v1.0"

2. Report to Backend
   POST /api/activities/execution
   { template_id, variant_id, success, cost, duration }

3. Backend Computes Metrics
   Aggregates by variant_id:
   { success_rate: 0.85, avg_cost: 0.198, thompson_alpha: 40, thompson_beta: 7 }

4. Thompson Sampling Recommends
   template-selector.ts → MetabobCLI.recommendActivities()
   Backend returns ranked templates

5. Boredom Activities Evolve
   boredom-manager.ts → executes "evolve-activity"
   Creates NEW template: "fix-bug-v2" (not updates metadata)

6. Continuous Optimization
   Backend tracks both variants, recommends better one
```

### Data Flow

```
OpenCode CLI
     ↓
activity.ts (executor)
     ↓ reportExecution(variant_id, success, cost)
     ↓
Metabob RPC API (backend)
     ├→ POST /api/activities/execution (store metrics)
     ├→ POST /api/activities/recommend (Thompson Sampling)
     └→ GET /api/boredom/priorities (evolution triggers)
     ↓
boredom-manager.ts
     ↓ Creates new template variants (not updates metadata)
```

---

## Solution: Remove OptimizationMetadata

### Commit: ca1c88f4

**Changes Applied**:

1. **Removed OptimizationMetadataSchema** (activity-template.ts)
   - Deleted 19 lines of schema
   - Added documentation explaining external tracking

2. **Removed TaskSchema.optimization field**
   - Tasks no longer have optimization metadata
   - Preserved prompt + toolSequence (hybrid execution still works)

3. **Updated validation function**
   - Removed optimization references in logging
   - Documents external variant_id tracking

4. **Updated CLI display**
   - Removed task.optimization references
   - Simplified to "hybrid (progressive optimization)"

### What Was Preserved

✅ **Binary Classification Removal** (original goal, still correct)
- Tasks can have prompt only, toolSequence only, or both
- No forced binary mode

✅ **Hybrid Execution Support**
- Tasks can have both prompt and toolSequence
- Progressive transition by creating new variants

✅ **Backend Integration** (already correct)
- variant_id in ActivityExecutionData
- Thompson Sampling recommendations
- Boredom-based evolution

---

## Validation

### Test Harness: 8/8 PASS

1. ✅ OptimizationMetadata schema removed
2. ✅ TaskSchema has no optimization field
3. ✅ Hybrid task works without optimization
4. ✅ Backend variant_id tracking exists
5. ✅ Boredom creates variants (not metadata updates)
6. ✅ Thompson Sampling uses backend metrics
7. ✅ CreateOptions has no optimization field
8. ✅ External optimization documentation present

### Related Specifications: 0 Conflicts

Verified against 5 related specifications:
- Template Storage Architecture ✅
- Dynamic Activity Creation ✅
- Complete Architecture Separation ✅
- Activity Template Scope Assignment ✅
- Boredom Activity Detection ✅

---

## Architectural Principles Restored

1. ✅ Templates are immutable references
2. ✅ Optimization via backend variant_id tracking
3. ✅ Thompson Sampling uses backend metrics
4. ✅ Boredom creates new variants (not updates metadata)
5. ✅ Hybrid execution still supported (prompt + toolSequence)

---

## Migration Impact

**Breaking Changes**: None

**Rationale**: OptimizationMetadata was only added March 8, 2026. Never used in production.

**Deployment**: Ready

---

## Files Modified

### repos/metabob-opencode (Commit: ca1c88f4)

1. **activity-template.ts**: Removed OptimizationMetadata, updated docs
2. **cli/cmd/activity.ts**: Removed optimization references
3. **test/validation-harnesses/remove-optimization-metadata-harness.ts**: NEW (440 lines)

### Parent Repo (Commit: f34ab98)

1. **repos/metabob-opencode**: Updated submodule

---

## Before vs After

| Aspect | Before (WRONG) | After (CORRECT) |
|--------|---------------|-----------------|
| **State Location** | In-template metadata | Backend variant_id |
| **Mutability** | Mutable | Immutable |
| **Source of Truth** | Template schema | Backend database |
| **Optimization** | Update metadata | Create new variants |
| **Hybrid Support** | ✅ (with metadata) | ✅ (without metadata) |

---

**Key Takeaway**: Templates are immutable. Optimization happens by creating new variants, not updating metadata.
