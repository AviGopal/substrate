# Iteration 2 Revised: Minimal Changes Based on Existing Code

**Date**: February 12, 2026  
**Finding**: Extensive impulse infrastructure already exists!

---

## What Already Exists ✅

### 1. Impulse Types (Complete)
**Location**: `packages/opencode/src/session/activity-template.ts`

Already defined:
- `Impulse.Pointer` - All pointer types (memo, file, component, etc.)
- `Impulse.Schema` - Full impulse structure
- `Impulse.UsageStats` - Tracking
- Zod schemas for validation

**Action**: ✅ No changes needed

### 2. Impulse Loading (Partial)
**Location**: `packages/opencode/src/session/task-execution-shared.ts`

Function `loadAndFormatImpulses()` already exists and:
- Loads impulse content
- Formats for context
- Tracks usage stats

**Current Issue**: Only called per-task, not accumulated across tasks

### 3. Impulse Resolution (Complete)
**Location**: `packages/opencode/src/session/impulse-resolver.ts`

- Resolves all impulse pointer types
- Handles caching
- Integrates with backend

**Action**: ✅ No changes needed

---

## What's Missing (Minimal Changes Needed)

### Issue 1: New Session Per Step

**Current Code** (`activity.ts` line ~640):
```typescript
const taskResult = await taskToolDef.execute(
  {prompt: prompt, ...},
  {sessionID: ctx.sessionID, ...}  // Creates NEW session
)
```

**Problem**: TaskTool spawns new agent session, loses context

**Minimal Fix**: Don't use TaskTool, execute directly in current session

### Issue 2: No Impulse Accumulation

**Current**: Each task loads its own impulses independently
**Needed**: Accumulate impulses across steps

### Issue 3: No Parent Context

**Current**: Activity starts with only template impulses
**Needed**: Capture parent session context as impulses

---

## Iteration 2: Minimal Changes Plan

### Change 1: Pass Prior Step Outputs as Impulses (1-2 hours)

**File**: `packages/opencode/src/tool/activity.ts`

**Current code** (in MCP execution loop):
```typescript
for (const step of steps) {
  const result = await executeStepWithTracking(step, variables, template, ctx)
  taskResults.push(result)
}
```

**Change to**:
```typescript
const priorStepOutputs: ActivityTemplate.Impulse[] = []

for (const step of steps) {
  // Add prior outputs as impulses
  const stepImpulses = [
    ...template.impulseReferences || [],
    ...priorStepOutputs
  ]
  
  const result = await executeStepWithTracking(
    step, 
    variables, 
    template, 
    ctx,
    stepImpulses  // NEW parameter
  )
  
  // Save output as impulse for next step
  if (result.success && result.output) {
    priorStepOutputs.push({
      id: `step-${step.id}-output`,
      type: "activityOutput",
      pointer: {
        type: "memo",
        content: result.output
      },
      description: `Output from step: ${step.description}`,
      priority: "high",
      budget: 2000
    })
  }
  
  taskResults.push(result)
}
```

**Function signature change**:
```typescript
async function executeStepWithTracking(
  step: any,
  variables: Record<string, unknown>,
  template: any,
  ctx: any,
  accumulatedImpulses: ActivityTemplate.Impulse[]  // NEW
): Promise<...>
```

**Inside function, pass to loadAndFormatImpulses**:
```typescript
// Merge task impulses + accumulated impulses
const allImpulses = [
  ...task.impulseReferences,
  ...accumulatedImpulses
]

impulseSection = await loadAndFormatImpulses(allImpulses, _activity.impulses)
```

**Validation**: Run `./scripts/validate-simple.sh`
- Should still pass
- Step 2 now receives Step 1 output (check logs)

---

### Change 2: Capture Parent Context (30 minutes)

**File**: `packages/opencode/src/tool/activity.ts`

**In `execute()` function**, before starting execution:

```typescript
// Capture parent context as impulses
const parentContextImpulses: ActivityTemplate.Impulse[] = []

// User intent
if (params.reason) {
  parentContextImpulses.push({
    id: "parent-user-intent",
    type: "user-intent",
    pointer: {
      type: "memo",
      content: params.reason
    },
    description: "User's stated reason for running this activity",
    priority: "high",
    budget: 500
  })
}

// Add to initial prior step outputs
const priorStepOutputs: ActivityTemplate.Impulse[] = [...parentContextImpulses]
```

**Validation**: Run validation
- Parent context should appear in Step 1 logs

---

### Change 3: Remove Debug Logging (15 minutes)

**File**: `packages/opencode/src/tool/activity.ts`

Remove all `fs.appendFileSync()` calls we added for debugging:
- Remove file import
- Remove all debug log writes
- Keep structured `log.info/debug/warn` calls

**Validation**: Run validation - should still work

---

## Summary: Minimal Changes

**Total changes**: ~50 lines of code across 1 file
**Time**: 2-3 hours
**Risk**: Low - using existing infrastructure

**What we're doing**:
1. ✅ Accumulate impulses across steps (use existing loadAndFormatImpulses)
2. ✅ Capture parent context (add impulses to initial array)
3. ✅ Clean up debug logging

**What we're NOT doing**:
- ❌ Creating new classes
- ❌ Rewriting execution flow
- ❌ Touching impulse infrastructure (already complete)
- ❌ Changing TaskTool (will address in next iteration)

---

## After This Iteration

We'll have:
- ✅ Step continuity (outputs flow forward)
- ✅ Parent context available to steps
- ✅ Clean code (debug logs removed)
- ✅ Still working execution (validated)

Next iteration can address:
- Replace TaskTool with direct execution (for single session)
- Self-contained templates (impulse-based schema)
- TUI integration

Ready to proceed with these minimal changes?
