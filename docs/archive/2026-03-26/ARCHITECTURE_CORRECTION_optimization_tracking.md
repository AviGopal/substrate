# Architecture Correction: Optimization Tracking via Backend Variants

**Date**: March 9, 2026  
**Status**: ✅ Complete  
**Activity**: trace-enforce-validate-loop

---

## Problem Statement

Three recent commits incorrectly added `OptimizationMetadata` to the activity template schema, violating the core architectural principle that **templates are immutable references**.

### Problematic Commits

1. **9db99892** - "refactor: remove binary activity classification, enable progressive optimization"
   - Added `OptimizationMetadataSchema` with readiness tracking
   - Added `optimization` field to `TaskSchema`
   - Incorrectly assumed optimization state should be in templates

2. **c7a9c87b** - "feat(progressive-optimization): Complete ripple changes"
   - Updated CLI to display optimization readiness
   - Updated executor to check optimization metadata
   - Further embedded incorrect architecture

3. **REFACTORING_REMOVE_BINARY_ACTIVITY_CLASSIFICATION.md**
   - Documented the OptimizationMetadata approach
   - Reinforced the incorrect pattern

### Why This Was Wrong

```typescript
// ❌ WRONG - Templates are NOT mutable
TaskSchema {
  optimization: {
    readiness: "learning" | "ready-for-conversion" | "partially-optimized" | "fully-optimized"
    successRate: number
    avgCost: number
    deterministicSteps: string[]
    llmSteps: string[]
  }
}
```

**Architectural Violations**:
- Templates should be immutable references (content-addressable by template_id)
- Optimization state changes over time → violates immutability
- Backend already tracks this via `variant_id` → duplicate state
- Creates confusion about source of truth (template vs backend)

---

## Correct Architecture: External Optimization Tracking

### Core Principle

> **Templates are immutable references. Optimization happens by creating new variants, not by updating metadata fields.**

### How Optimization Actually Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     OPTIMIZATION LIFECYCLE                       │
└─────────────────────────────────────────────────────────────────┘

1. USER EXECUTES TEMPLATE
   Template: "fix-bug-complete" (v1.0)
   ↓
   activity.ts:complete() extracts variant_id from selection_reason
   
2. BACKEND TRACKS EXECUTION
   ↓
   activity.ts:reportExecution() → POST /api/activities/execution
   ActivityExecutionData {
     template_id: "fix-bug-complete",
     variant_id: "v1.0",              ← Backend tracks this
     success: true,
     duration: 45000,
     cost: 0.234,
     tokens: { input: 12000, output: 1500 }
   }
   
3. BACKEND COMPUTES METRICS (Thompson Sampling)
   ↓
   Backend aggregates executions by variant_id:
   {
     variant_id: "v1.0",
     executions: 47,
     success_rate: 0.85,              ← Measured, not declared
     avg_cost: 0.198,                 ← Measured, not declared
     thompson_alpha: 40,              ← For recommendation
     thompson_beta: 7
   }
   
4. RECOMMENDATION SYSTEM QUERIES BACKEND
   ↓
   template-selector.ts:selectTemplate()
   → MetabobCLI.recommendActivities(context)
   → Backend returns ranked templates with Thompson Sampling scores
   
5. BOREDOM ACTIVITIES CREATE EVOLVED VARIANTS
   ↓
   boredom-manager.ts detects low success rate
   → Executes "evolve-activity-self-contained" activity
   → Creates NEW template: "fix-bug-complete-v2" (variant_id: "v2.0")
   → New variant registered in backend
   
6. CONTINUOUS OPTIMIZATION
   ↓
   Backend tracks both variants:
   - v1.0: success_rate = 0.85, avg_cost = 0.198
   - v2.0: success_rate = 0.92, avg_cost = 0.156  ← Better!
   ↓
   Thompson Sampling recommends v2.0 more frequently
   ↓
   Over time, v2.0 becomes dominant variant
```

### Data Flow Architecture

```
┌───────────────┐
│  OpenCode CLI │
│  (Frontend)   │
└───────┬───────┘
        │
        │ 1. Execute template
        ├─────────────────────────────────────┐
        │                                     │
        ▼                                     ▼
┌───────────────────┐              ┌──────────────────┐
│   activity.ts     │              │ template-        │
│   (Executor)      │              │ selector.ts      │
│                   │              │ (Thompson)       │
│ - complete()      │              │                  │
│ - reportExecution │              │ - selectTemplate │
└─────────┬─────────┘              └────────┬─────────┘
          │                                 │
          │ 2. Report execution             │ 3. Query recommendations
          │    (variant_id, success,        │    (context)
          │     cost, duration)             │
          │                                 │
          ▼                                 ▼
┌─────────────────────────────────────────────────────┐
│        Metabob RPC API (Backend)                    │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ POST /api/activities/execution              │   │
│  │ - Stores execution data by variant_id       │   │
│  │ - Updates Thompson Sampling parameters      │   │
│  │ - Computes success_rate, avg_cost           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ POST /api/activities/recommend              │   │
│  │ - Thompson Sampling ranking                 │   │
│  │ - Returns templates with variant_id         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ GET /api/boredom/priorities                 │   │
│  │ - Identifies templates needing evolution    │   │
│  │ - Based on low success_rate, high cost      │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
          │
          │ 4. Boredom activities evolve templates
          ▼
┌─────────────────────────────────────┐
│  boredom-manager.ts                 │
│                                     │
│  - Detects idle time (5 min)       │
│  - Fetches prioritized work        │
│  - Executes evolve-activity         │
│  - Creates NEW template variant     │
│    (not updates metadata)           │
└─────────────────────────────────────┘
```

---

## Corrected Implementation

### Commit: ca1c88f4

**Title**: "feat(activity-template): Remove OptimizationMetadata - Use Backend Variant Tracking"

### Changes Applied

#### 1. Removed OptimizationMetadata Schema

**Before** (WRONG):
```typescript
export const OptimizationMetadataSchema = z.object({
  readiness: z.enum(["learning", "ready-for-conversion", "partially-optimized", "fully-optimized"]),
  successRate: z.number().min(0).max(1).default(0),
  avgCost: z.number().default(0),
  lastOptimized: z.number().optional(),
  optimizationOpportunities: z.array(z.string()).default([]),
  deterministicSteps: z.array(z.string()).default([]),
  llmSteps: z.array(z.string()).default([]),
})
```

**After** (CORRECT):
```typescript
// NOTE: Optimization tracking happens EXTERNALLY via backend variant tracking system.
// Templates are immutable references. Optimization happens by creating new variants (new template IDs),
// not by updating metadata fields. See:
// - Backend variant tracking: variant_id in ActivityExecutionData (activity.ts, template-metrics.ts)
// - Thompson Sampling: template-selector.ts queries backend metrics (thompson_alpha, thompson_beta)
// - Template evolution: boredom-manager.ts creates new variants via evolve-activity-self-contained
// Tasks can still have both prompt and toolSequence (hybrid execution) without optimization metadata.
```

#### 2. Removed TaskSchema.optimization Field

**Before** (WRONG):
```typescript
export const TaskSchema = z.object({
  id: z.string(),
  // ...
  optimization: OptimizationMetadataSchema.optional().describe(
    "Optimization metadata for tracking progressive conversion"
  ),
  prompt: PromptConfigSchema.optional(),
  toolSequence: z.array(ToolCallSchema).optional(),
  // ...
})
```

**After** (CORRECT):
```typescript
export const TaskSchema = z.object({
  id: z.string(),
  // ...
  // NO optimization field
  prompt: PromptConfigSchema.optional().describe(
    "Prompt configuration for LLM-assisted execution. Can coexist with toolSequence for hybrid execution."
  ),
  toolSequence: z.array(ToolCallSchema).optional().describe(
    "Predefined sequence of tool calls for deterministic execution. Can coexist with prompt for hybrid execution."
  ),
  // ...
})
```

#### 3. Updated validateExecutionModes()

**Before** (WRONG):
```typescript
if (hasPrompt && hasToolSequence) {
  log.info(
    `Task "${task.id}" has both prompt and toolSequence - hybrid execution mode.`,
    {
      taskId: task.id,
      optimization: task.optimization?.readiness || "learning",  // ❌ Wrong
      deterministicSteps: task.optimization?.deterministicSteps?.length || 0,
      llmSteps: task.optimization?.llmSteps?.length || 0,
    }
  )
}
```

**After** (CORRECT):
```typescript
if (hasPrompt && hasToolSequence) {
  log.info(
    `Task "${task.id}" has both prompt and toolSequence - hybrid execution mode. ` +
    `This enables progressive "cooking off" of LLM scaffolding as patterns are learned. ` +
    `Optimization tracking happens externally via backend variant_id system.`,
    {
      taskId: task.id,
    }
  )
}
```

#### 4. Updated CLI Display

**Before** (WRONG):
```typescript
const modeLabel = isHybrid 
  ? `hybrid (${task.optimization?.readiness || "learning"})` // ❌ Wrong
  : hasToolSequence ? "deterministic" : "llm-assisted"
```

**After** (CORRECT):
```typescript
const modeLabel = isHybrid 
  ? "hybrid (progressive optimization)"  // ✅ Correct - no metadata
  : hasToolSequence ? "deterministic" : "llm-assisted"
```

---

## What Was Preserved

### ✅ Binary Classification Removal (Still Correct)

The original goal was correct: **remove binary `executionMode` classification**.

```typescript
// ✅ CORRECT - Binary classification still removed
// Tasks can have:
// - Only prompt (LLM-assisted)
// - Only toolSequence (deterministic)
// - Both (hybrid execution)

// This part was RIGHT and is preserved:
export const TaskSchema = z.object({
  prompt: PromptConfigSchema.optional(),      // Can have
  toolSequence: z.array(ToolCallSchema).optional(),  // Can have both
})
```

### ✅ Hybrid Execution Support (Still Correct)

Tasks can still have both `prompt` and `toolSequence` simultaneously.

**Use Case**: Progressive transition
1. Start: Only prompt (LLM figures it out)
2. Middle: Prompt + toolSequence (LLM validates deterministic steps)
3. End: Only toolSequence (fully deterministic)

This transition happens by **creating new template variants**, not by updating metadata.

### ✅ Backend Integration (Already Correct)

The backend integration was already correct and is preserved:

```typescript
// ✅ template-metrics.ts (PRESERVED)
export interface ActivityExecutionData {
  activity_id: string
  template_id: string
  variant_id?: string        // ← Backend tracks this
  success: boolean
  duration: number
  cost: number
  tokens?: { input: number, output: number, cache: number }
}

// ✅ activity.ts:complete() (PRESERVED)
const variantId = extractVariantId(activity.selection_reason)
await reportExecution({
  variant_id: variantId,    // ← Sent to backend
  // ...
})

// ✅ template-selector.ts (PRESERVED)
const recommendations = await MetabobCLI.recommendActivities(context)
// Backend returns templates with Thompson Sampling scores

// ✅ boredom-manager.ts (PRESERVED)
const priorities = await fetchBoredomPriorities()
await executeActivity("evolve-activity-self-contained", {
  templateId: priority.template_id,
  optimizationGoal: "improve success rate"
})
// Creates NEW template variant, not updates metadata
```

---

## Validation

### Test Harness Created

**File**: `repos/metabob-opencode/packages/opencode/test/validation-harnesses/remove-optimization-metadata-harness.ts`

**Size**: 14KB (440 lines)

### Test Coverage (8/8 PASS)

1. ✅ **OptimizationMetadata schema removed**
   - No `OptimizationMetadataSchema` in activity-template.ts
   - No `export type OptimizationMetadata`

2. ✅ **TaskSchema has no optimization field**
   - Verified by parsing schema definition
   - No `optimization:` in TaskSchema object

3. ✅ **Hybrid task works without optimization**
   - Task with both prompt and toolSequence parses successfully
   - No validation errors

4. ✅ **Backend variant tracking exists**
   - `variant_id` field in `ActivityExecutionData`
   - Verified in template-metrics.ts

5. ✅ **Boredom creates variants**
   - Confirmed boredom-manager.ts executes evolve-activity
   - Does not update template metadata

6. ✅ **Thompson Sampling uses backend metrics**
   - Confirmed template-selector.ts calls MetabobCLI.recommendActivities()
   - Backend returns ranked templates

7. ✅ **CreateOptions has no optimization field**
   - Verified CreateOptions schema has no optimization
   - Template creation API clean

8. ✅ **External optimization documentation present**
   - Comments in activity-template.ts explain backend tracking
   - References variant_id, Thompson Sampling, boredom evolution

---

## Related Specifications Verified

The trace-enforce-validate-loop activity analyzed **5 related specifications** for conflicts:

1. **Template Storage Architecture** - ✅ ALIGNED
   - Both enforce immutability principle
   - No conflicts

2. **Dynamic Activity Creation** - ✅ COMPLEMENTARY
   - Both use variant creation pattern
   - No conflicts

3. **Complete Architecture Separation** - ✅ ALIGNED
   - Both use backend via MCP for state
   - No conflicts

4. **Activity Template Scope Assignment** - ✅ INDEPENDENT
   - Different metadata concerns
   - No conflicts

5. **Boredom Activity Detection** - ✅ COMPLEMENTARY
   - Both use backend metrics
   - No conflicts

**Result**: Zero conflicts detected across all related specifications.

---

## Architectural Principles Restored

### 1. ✅ Templates are Immutable References

Templates don't change. They're content-addressable by `template_id` + `variant_id`.

### 2. ✅ Optimization via Backend Variant Tracking

`variant_id` in `ActivityExecutionData` is the source of truth for optimization state.

### 3. ✅ Thompson Sampling Uses Backend Metrics

`template-selector.ts` queries backend for recommendations, not template metadata.

### 4. ✅ Boredom Creates New Variants

`boredom-manager.ts` creates new templates via evolve-activity, not metadata updates.

### 5. ✅ Hybrid Execution Still Supported

Tasks can have both `prompt` and `toolSequence` for progressive transition.

---

## Migration Impact

### Breaking Changes: None

**Rationale**: `OptimizationMetadata` was only added in commits 9db99892 and c7a9c87b (March 8, 2026). It was never used in production or by any existing templates.

### Deployment: Ready

All validation tests pass. No migration required.

---

## Summary

| Aspect | Before (WRONG) | After (CORRECT) |
|--------|---------------|-----------------|
| **Optimization State** | In-template metadata | Backend variant_id |
| **Template Mutability** | Mutable (metadata updates) | Immutable (references) |
| **Source of Truth** | Template schema | Backend database |
| **Optimization Method** | Update metadata fields | Create new variants |
| **Hybrid Execution** | Supported (with metadata) | Supported (without metadata) |
| **Binary Classification** | Removed ✅ | Still removed ✅ |

### Key Takeaway

**Templates are immutable references. Optimization happens by creating new variants (new template IDs), not by updating metadata fields.**

The system architecture was **corrected** to align with this principle by removing `OptimizationMetadata` and relying on the existing backend variant tracking, Thompson Sampling, and boredom-based evolution systems.

---

## Files Modified

### In opencode Repository (Commit: ca1c88f4)

1. **packages/opencode/src/session/activity-template.ts**
   - Removed OptimizationMetadataSchema (19 lines)
   - Removed TaskSchema.optimization field (4 lines)
   - Removed CreateOptions.optimization field (10 lines)
   - Added documentation explaining external tracking (7 lines)
   - Updated validateExecutionModes() logging (3 lines)

2. **packages/opencode/src/cli/cmd/activity.ts**
   - Removed task.optimization references (6 lines)
   - Simplified mode label display (1 line)

3. **packages/opencode/test/validation-harnesses/remove-optimization-metadata-harness.ts**
   - NEW: Comprehensive validation harness (440 lines)

### In Parent Repository (Commit: f34ab98)

1. **repos/metabob-opencode** (submodule)
   - Updated to commit ca1c88f4

---

**Status**: ✅ Architecture corrected, validated, and documented.
