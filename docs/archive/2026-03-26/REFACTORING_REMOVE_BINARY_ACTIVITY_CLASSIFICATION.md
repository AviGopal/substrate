# Refactoring: Remove Binary Activity Classification

**Date**: March 8, 2026  
**Status**: ✅ Complete (Schema Changes)  
**Author**: Activity Mode (OpenCode)

---

## Problem Statement

The activity system had a **strict binary classification** between LLM-assisted and deterministic activities via the `executionMode` field. This prevented the core philosophy of "cooking off" LLM scaffolding as we learn.

### Why This Was Problematic

```typescript
// OLD (WRONG) - Binary classification
executionMode: "llm-assisted" | "deterministic"

// This forced an all-or-nothing choice:
- If executionMode = "llm-assisted": Task MUST have prompt, CANNOT have toolSequence
- If executionMode = "deterministic": Task MUST have toolSequence, CANNOT have prompt

// This prevented progressive optimization:
❌ Can't have some steps LLM, some steps deterministic in same task
❌ Can't gradually convert steps from LLM → deterministic
❌ Can't track readiness for optimization
❌ Forces complete rewrite to change execution approach
```

### Design Philosophy Violated

From the original "ductile rigidity paradigm" (commit `09da75ef`):

> "The purpose of this project is to 'cook off' the LLM scaffolding as we better understand the sequences of steps required to accomplish a task."

**Intended Flow**:
```
Iteration 1: Full LLM assistance (learn the task)
  ↓
Iteration 2: Mix of LLM + deterministic (optimize known steps)
  ↓
Iteration 3: Mostly deterministic + minimal LLM (final polish)
  ↓
Iteration N: Pure deterministic (task fully understood)
```

Binary classification **broke this flow** by preventing gradual transition.

---

## Solution: Progressive Optimization Model

### 1. New `OptimizationMetadata` Schema

Added comprehensive tracking for the "cooking off" process:

```typescript
export const OptimizationMetadataSchema = z.object({
  // Optimization readiness state
  readiness: z.enum([
    "learning",              // Still discovering patterns
    "ready-for-conversion",  // Patterns clear, ready to optimize
    "partially-optimized",   // Some steps optimized
    "fully-optimized"        // All steps optimized
  ]).default("learning"),
  
  // Metrics for optimization decisions
  successRate: z.number().min(0).max(1).default(0),  // Threshold: 0.95 for conversion
  avgCost: z.number().default(0),  // Track cost reduction
  lastOptimized: z.number().optional(),  // When last optimized
  
  // Identified opportunities
  optimizationOpportunities: z.array(z.string()).default([]),
  // e.g., ["Step 2 always produces identical output", "Pattern detected in git operations"]
  
  // Progressive conversion tracking
  deterministicSteps: z.array(z.string()).default([]),  // Steps converted to deterministic
  llmSteps: z.array(z.string()).default([]),  // Steps still needing LLM
})
```

### 2. Updated `TaskSchema` - Hybrid Execution Support

**Key Change**: Tasks can now have **BOTH** prompt and toolSequence:

```typescript
export const TaskSchema = z.object({
  id: z.string(),
  subagent: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
  
  // NEW: Optimization tracking
  optimization: OptimizationMetadataSchema.optional(),
  
  // BOTH can exist simultaneously (hybrid execution)
  prompt: PromptConfigSchema.optional(),
  toolSequence: z.array(ToolCallSchema).optional(),
  
  // REMOVED: executionMode field (no longer binary classification)
  
  validation: ValidationSchema,
  retry: RetryConfigSchema,
  // ...
})
```

### 3. Execution Modes Matrix

Tasks now exist on a **spectrum**, not binary states:

| Configuration | Execution Approach | Optimization Stage |
|--------------|-------------------|-------------------|
| Only `prompt` | Fully LLM-assisted | `learning` |
| Only `toolSequence` | Fully deterministic | `fully-optimized` |
| Both `prompt` + `toolSequence` | **Hybrid** (progressive transition) | `partially-optimized` |
| Neither | ❌ Invalid (must have at least one) | N/A |

### 4. Updated Validation Logic

**Old validation** (binary enforcement):
```typescript
// REMOVED - enforced binary classification
if (mode === "deterministic") {
  if (!task.toolSequence) throw Error("Must have toolSequence")
  if (task.prompt) log.warn("Has prompt, will be ignored")
} else {
  if (!task.prompt) throw Error("Must have prompt")
  if (task.toolSequence) log.warn("Has toolSequence, will be ignored")
}
```

**New validation** (progressive optimization support):
```typescript
function validateExecutionModes(tasks: CreateOptions["tasks"]): void {
  for (const task of tasks) {
    const hasPrompt = !!task.prompt
    const hasToolSequence = !!task.toolSequence && task.toolSequence.length > 0
    
    // Task must have at least one execution method
    if (!hasPrompt && !hasToolSequence) {
      throw new Error(
        `Task "${task.id}" has neither prompt nor toolSequence defined. ` +
        `Tasks must define at least one execution method.`
      )
    }
    
    // Log info about hybrid tasks (this is GOOD, not a warning!)
    if (hasPrompt && hasToolSequence) {
      log.info(
        `Task "${task.id}" has both prompt and toolSequence - hybrid execution mode. ` +
        `This enables progressive "cooking off" of LLM scaffolding.`,
        {
          optimization: task.optimization?.readiness || "learning",
          deterministicSteps: task.optimization?.deterministicSteps?.length || 0,
          llmSteps: task.optimization?.llmSteps?.length || 0,
        }
      )
    }
  }
}
```

---

## Migration Path

### For Existing Templates

**No breaking changes** - existing templates work as-is:

```typescript
// Old template (still valid)
{
  "id": "old-template",
  "tasks": [{
    "id": "task-1",
    "prompt": { "template": "Do something" }
    // No toolSequence = Fully LLM-assisted (still works)
  }]
}
```

**Progressive optimization path**:
```typescript
// Step 1: Start with LLM-assisted
{
  "id": "build-app",
  "tasks": [{
    "id": "task-1",
    "prompt": { "template": "Build the application" },
    "optimization": { "readiness": "learning", "successRate": 0.75 }
  }]
}

// Step 2: Add deterministic steps as patterns emerge (hybrid)
{
  "id": "build-app",
  "tasks": [{
    "id": "task-1",
    "prompt": { "template": "Build the application" },
    "toolSequence": [
      { "tool": "bash", "params": { "command": "npm install" } },
      { "tool": "bash", "params": { "command": "npm run build" } }
    ],
    "optimization": {
      "readiness": "partially-optimized",
      "successRate": 0.92,
      "deterministicSteps": ["install", "build"],
      "llmSteps": ["analyze-errors"],
      "optimizationOpportunities": ["Error handling could be deterministic"]
    }
  }]
}

// Step 3: Eventually remove prompt when fully optimized
{
  "id": "build-app",
  "tasks": [{
    "id": "task-1",
    "toolSequence": [
      { "tool": "bash", "params": { "command": "npm install" } },
      { "tool": "bash", "params": { "command": "npm run build" } },
      { "tool": "bash", "params": { "command": "npm run test" } }
    ],
    "optimization": {
      "readiness": "fully-optimized",
      "successRate": 0.98,
      "deterministicSteps": ["install", "build", "test"],
      "lastOptimized": 1709913600000
    }
  }]
}
```

---

## Benefits

### 1. ✅ Enables Progressive Optimization

Tasks can gradually transition from LLM → deterministic as patterns are learned, not forced to switch all-at-once.

### 2. ✅ Better Cost Tracking

`OptimizationMetadata.avgCost` tracks cost reduction over time as LLM steps are replaced with deterministic steps.

### 3. ✅ Explicit Readiness States

The `readiness` field makes it clear when a task is ready for optimization:
- `learning`: Still figuring it out
- `ready-for-conversion`: Patterns identified, ready to optimize
- `partially-optimized`: In progress
- `fully-optimized`: Done!

### 4. ✅ Identifies Optimization Opportunities

The `optimizationOpportunities` array captures specific patterns observed that could be converted to deterministic:
```typescript
optimizationOpportunities: [
  "Git commit step always uses same message format",
  "File creation pattern is identical across executions",
  "Test command is always 'npm test'"
]
```

### 5. ✅ Backwards Compatible

Existing templates work without modification. No breaking changes.

---

## Implementation Summary

### Files Modified

1. **`repos/metabob-opencode/packages/opencode/src/session/activity-template.ts`**
   - ✅ Added `OptimizationMetadataSchema`
   - ✅ Removed `executionMode` from `TaskSchema`
   - ✅ Added `optimization` field to `TaskSchema`
   - ✅ Updated `CreateOptions` to remove `executionMode`
   - ✅ Updated `validateExecutionModes()` to support hybrid tasks
   - ✅ Added documentation explaining progressive optimization

### Schema Changes

**Removed**:
```typescript
executionMode: z.enum(["llm-assisted", "deterministic"]).optional()
```

**Added**:
```typescript
optimization: OptimizationMetadataSchema.optional()
```

**Validation Changed**:
- Old: Enforce binary separation (prompt XOR toolSequence)
- New: Require at least one, allow both (prompt OR toolSequence OR both)

---

## Next Steps

### 1. Update Template Executor (Future Work)

The executor should detect hybrid tasks and use optimization metadata to decide execution strategy:

```typescript
async function executeTask(task: Task) {
  const hasPrompt = !!task.prompt
  const hasToolSequence = !!task.toolSequence
  
  if (hasPrompt && hasToolSequence) {
    // Hybrid execution - use optimization metadata
    if (task.optimization?.readiness === "fully-optimized") {
      // Prefer deterministic if fully optimized
      return executeDeterministic(task.toolSequence)
    } else {
      // Use LLM with toolSequence as validation/fallback
      return executeHybrid(task)
    }
  } else if (hasToolSequence) {
    // Fully deterministic
    return executeDeterministic(task.toolSequence)
  } else {
    // Fully LLM-assisted
    return executeLLMAssisted(task.prompt)
  }
}
```

### 2. Backend Learning Loop (Future Work)

Backend should track executions and update `optimization` metadata:

```typescript
// After successful execution
if (task.successRate > 0.95 && task.optimization.readiness === "learning") {
  // Promote to ready-for-conversion
  task.optimization.readiness = "ready-for-conversion"
}

// Detect patterns
if (observedPatternInExecution(execution)) {
  task.optimization.optimizationOpportunities.push(
    `Pattern detected: ${pattern.description}`
  )
}
```

### 3. Auto-Optimization (Future Work)

System could automatically suggest or create optimized variants:

```typescript
// When readiness = "ready-for-conversion"
const optimizedVariant = deriveOptimizedTemplate(template, {
  convertSteps: task.optimization.optimizationOpportunities
})
```

---

## Conclusion

This refactoring **removes the artificial binary classification** and enables the **core design philosophy** of progressively "cooking off" LLM scaffolding as workflows become better understood.

Activities are now correctly viewed as a **spectrum** of LLM vs deterministic, not two rigid categories. This allows natural evolution from full LLM assistance → hybrid → fully optimized deterministic execution.

The `OptimizationMetadata` schema provides the necessary tracking and decision-making infrastructure to support this progressive transition in a data-driven way.

**Key Principle**: All activities are a mix of LLM and deterministic functionality. The goal is to gradually optimize, not to classify.
