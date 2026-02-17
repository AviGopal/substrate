# Iteration 2: Correct Approach - Memory Agent Manages Context

**Date**: February 12, 2026  
**Key Insight**: Session memory agent should manage impulse space, not hardcode which impulses to load

---

## The Correct Architecture

### Problem with Our Previous Plan
We were going to **manually** accumulate impulses:
```typescript
// WRONG - We decide what to pass
priorStepOutputs.push({
  id: "step-output",
  content: result.output
})
```

### Correct Approach
**Prefill impulse space** with ALL available impulses, then let **session memory agent** decide what to load:

```typescript
// RIGHT - Prefill impulse space with pointers
impulseSpace = {
  // Template impulses
  "activity-schema": {pointer: {...}, budget: 2000, loaded: false},
  "example-template": {pointer: {...}, budget: 1500, loaded: false},
  
  // Parent context
  "parent-intent": {pointer: {type: "memo", content: reason}, budget: 500, loaded: false},
  "parent-conversation": {pointer: {type: "conversation", ...}, budget: 2000, loaded: false},
  
  // Prior step outputs (as pointers, not loaded)
  "step-1-output": {pointer: {type: "activityOutput", activityId, taskId: "step-1"}, budget: 1000, loaded: false},
  "step-2-output": {pointer: {type: "activityOutput", activityId, taskId: "step-2"}, budget: 1000, loaded: false},
}

// Session memory agent uses impulse tools to:
// - list_impulses (see what's available)
// - load_impulse (bring into context)
// - unload_impulse (free up space)
// - analyze relevance (decide what matters)
```

---

## Why This Matters

### Learning Loop
As activities execute, backend records:
1. **Which impulses were made available** (impulse space)
2. **Which impulses memory agent chose to load** (decisions)
3. **Which impulses were actually referenced** (in output/reasoning)
4. **What the outcome was** (success/failure)

Over time, we learn:
- "For task X, impulse Y is always needed" (high correlation)
- "Impulse Z is never used" (noise)
- "When context includes A, also need B" (patterns)

### Example: activity-create Learning
```
Execution 1:
  Available: [schema, examples, parent-intent, codebase-files]
  Loaded: [schema, examples, codebase-files]  ← Memory agent decided
  Used: [schema, examples]  ← Actually referenced
  Outcome: Success (but read codebase-files unnecessarily)
  
Execution 2:
  Available: [schema, examples, parent-intent]  ← Removed codebase-files
  Loaded: [schema, examples]
  Used: [schema, examples]
  Outcome: Success
  
Learning: codebase-files not needed, parent-intent available but not loaded
```

---

## Implementation: Iteration 2

### Change 1: Prefill Impulse Space (Not Load Content)

**File**: `packages/opencode/src/tool/activity.ts`

**Before MCP execution loop**:
```typescript
// Build complete impulse space (pointers only, not loaded content)
const impulseSpace: Record<string, ActivityTemplate.Impulse> = {}

// 1. Add template impulses
for (const impulseRef of template.impulse_refs || []) {
  impulseSpace[impulseRef.id] = {
    id: impulseRef.id,
    type: impulseRef.type,
    pointer: impulseRef.pointer,
    description: impulseRef.description || `Template impulse: ${impulseRef.id}`,
    priority: impulseRef.priority || "medium",
    budget: impulseRef.budget || 1000,
    // NOT LOADED - just pointer
  }
}

// 2. Add parent context impulses (pointers)
if (params.reason) {
  impulseSpace["parent-user-intent"] = {
    id: "parent-user-intent",
    type: "user-intent",
    pointer: {
      type: "memo",
      content: params.reason
    },
    description: "User's stated reason for activity",
    priority: "high",
    budget: 500
  }
}

// 3. Add prior step outputs as pointers (empty initially)
const registerStepOutput = (stepId: string, output: string) => {
  impulseSpace[`step-${stepId}-output`] = {
    id: `step-${stepId}-output`,
    type: "step-output",
    pointer: {
      type: "memo",  // Or activityOutput
      content: output
    },
    description: `Output from step ${stepId}`,
    priority: "high",
    budget: 1500
  }
}

log.info("impulse space prefilled", {
  totalImpulses: Object.keys(impulseSpace).length,
  categories: {
    template: template.impulse_refs?.length || 0,
    parent: 1,
    steps: 0  // Will grow as steps complete
  }
})
```

### Change 2: Pass Impulse Space to Each Step

**In execution loop**:
```typescript
for (const step of steps) {
  // Pass ENTIRE impulse space to step
  // Memory agent will decide what to load
  const result = await executeStepWithTracking(
    step,
    variables,
    template,
    ctx,
    impulseSpace  // Full space of available impulses
  )
  
  // Register step output as NEW impulse (pointer)
  if (result.success && result.output) {
    registerStepOutput(step.id, result.output)
    
    log.info("step output registered as impulse", {
      stepId: step.id,
      impulseId: `step-${step.id}-output`,
      outputLength: result.output.length
    })
  }
  
  taskResults.push(result)
}
```

### Change 3: Let Memory Agent Manage Context

**In `executeStepWithTracking`**:
```typescript
async function executeStepWithTracking(
  step: any,
  variables: Record<string, unknown>,
  template: any,
  ctx: any,
  impulseSpace: Record<string, ActivityTemplate.Impulse>  // NEW
): Promise<...> {
  
  log.info("executing step with impulse space", {
    stepId: step.id,
    availableImpulses: Object.keys(impulseSpace).length,
    taskImpulseRefs: task.impulseReferences?.length || 0
  })
  
  // Create activity info with full impulse space
  const activityInfo = {
    id: template.id,
    impulses: impulseSpace,  // ALL available impulses (pointers)
    // ... other fields
  }
  
  // Session memory agent will:
  // 1. See all available impulses via list_impulses
  // 2. Decide which to load based on task needs
  // 3. Use load_impulse/unload_impulse to manage context
  
  // For now, we still load task impulse references
  // But memory agent COULD override this decision
  const impulseRefsToLoad = task.impulseReferences || []
  
  log.debug("task specifies impulse references", {
    specified: impulseRefsToLoad,
    available: Object.keys(impulseSpace)
  })
  
  const impulseSection = await loadAndFormatImpulses(
    impulseRefsToLoad,
    activityInfo.impulses
  )
  
  // ... rest of execution
}
```

---

## What This Enables

### 1. Memory Agent Has Visibility
```typescript
// Memory agent can call:
list_impulses()  // See: [parent-intent, step-1-output, schema, ...]

// And decide:
load_impulse("step-1-output")  // Needed
// Don't load "schema" - not relevant for this step
```

### 2. Backend Records Decisions
```json
{
  "execution_id": "exec_123",
  "step_id": "step-2",
  "impulse_space": {
    "available": ["parent-intent", "step-1-output", "schema", "examples"],
    "loaded_by_template": ["schema"],
    "loaded_by_agent": ["step-1-output"],
    "not_loaded": ["parent-intent", "examples"]
  },
  "outcome": "success",
  "output_references": ["step-1-output"]  // Which impulses were actually used
}
```

### 3. Learning Happens
After 10 executions:
```
Analysis: For step-2 of activity-create:
  - step-1-output: loaded 10/10 times, referenced 10/10 → REQUIRED
  - schema: loaded 10/10 times, referenced 3/10 → OPTIONAL
  - examples: loaded 2/10 times, referenced 2/10 → RARE
  - parent-intent: loaded 0/10 times, never referenced → NOT NEEDED

Template Update: Remove schema from step-2 impulse_refs
```

---

## Validation Strategy

### Test 1: Impulse Space Prefilled
```bash
# Run activity
# Check logs for:
# "impulse space prefilled" - totalImpulses > 0
# "executing step with impulse space" - availableImpulses grows per step
```

### Test 2: Step Outputs Registered
```bash
# After step 1 completes
# Log should show: "step output registered as impulse: step-1-output"
# Step 2 should see: availableImpulses += 1
```

### Test 3: Memory Agent Can See Impulses
```bash
# Enable memory agent logging
# Should see: list_impulses called
# Should see: load_impulse decisions
```

---

## Code Changes Summary

**File**: `packages/opencode/src/tool/activity.ts`

**Lines changed**: ~80 lines
1. Build impulse space (30 lines)
2. Pass to executeStepWithTracking (10 lines)
3. Register outputs as impulses (20 lines)
4. Update executeStepWithTracking signature (5 lines)
5. Pass impulse space to activity info (15 lines)

**Time**: 2-3 hours
**Risk**: Low - using existing impulse infrastructure

---

## After This Iteration

We'll have:
- ✅ Complete impulse space visible to memory agent
- ✅ Step outputs registered as impulses
- ✅ Parent context available as impulses
- ✅ Foundation for learning (backend can see decisions)
- ✅ Still working execution (validated)

**Next iteration**: 
- Record which impulses were loaded vs available (backend)
- Analyze patterns across executions (learning)
- Remove TaskTool (single session)

---

## Key Difference from Previous Plan

**Before**: We hardcode "pass step outputs forward"
```typescript
// We decide
priorOutputs.push(result.output)
```

**Now**: We make impulses **available**, memory agent decides
```typescript
// Register as available
impulseSpace[id] = {pointer: ...}
// Memory agent decides if/when to load
```

This enables the learning loop!

Ready to implement this approach?
