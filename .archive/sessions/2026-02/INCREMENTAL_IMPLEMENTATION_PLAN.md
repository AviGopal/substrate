# Incremental Implementation Plan with Validation

**Date**: February 12, 2026  
**Strategy**: Short jumps + end-to-end validation at each stage

---

## Validation Strategy

### Test Environment: devbob Container
Use `devbob-opencode` container for isolated testing:
- Clean environment each test
- No pollution between iterations
- Easy rollback if something breaks

### Test Script: `validate-activity-execution.sh`
Runs after each change to verify:
1. ✅ Basic activity execution still works
2. ✅ New feature works as expected
3. ✅ No regressions introduced

---

## Iteration 1: Baseline Validation Script

**Goal**: Create test script that validates current working state

### Create Test Script
```bash
#!/bin/bash
# validate-activity-execution.sh

set -e

echo "=== Activity System Validation ==="
echo "Date: $(date)"
echo ""

# Test 1: Simple activity execution
echo "[Test 1] Simple activity execution (echo-proof)"
RESULT=$(cat <<'SCRIPT' | docker exec -i devbob-opencode opencode --no-tui
activity({
  activityId: "infrastructure-86af0790",
  variables: {message: "Validation test"},
  reason: "Validate system works"
})
SCRIPT
)

if echo "$RESULT" | grep -q "✅"; then
    echo "✅ Test 1 PASSED - Activity executed successfully"
else
    echo "❌ Test 1 FAILED - Activity did not complete"
    exit 1
fi

# Test 2: Verify metrics reported
if echo "$RESULT" | grep -q "Cost:"; then
    echo "✅ Test 2 PASSED - Metrics reported"
else
    echo "❌ Test 2 FAILED - No metrics"
    exit 1
fi

# Test 3: Verify task completion
if echo "$RESULT" | grep -q "Echo message"; then
    echo "✅ Test 3 PASSED - Task shown in output"
else
    echo "❌ Test 3 FAILED - Task not shown"
    exit 1
fi

echo ""
echo "=== All Tests Passed ✅ ==="
```

### Tasks
1. Create validation script
2. Test it runs successfully with current code
3. Commit baseline

**Time**: 30 minutes  
**Deliverable**: Working validation script

---

## Iteration 2: Add Impulse Infrastructure (No Behavior Change)

**Goal**: Add impulse types and structures WITHOUT changing execution flow

### Changes
1. Define `Impulse` type in TypeScript
2. Add `impulse_refs` field to template loading
3. Add impulse storage (empty for now)
4. No execution changes yet

### Code Changes
```typescript
// packages/opencode/src/session/activity-types.ts (new file)
export interface Impulse {
  id: string
  type: "memo" | "conversation" | "file" | "code"
  content: string
  metadata?: Record<string, any>
}

export interface ImpulseRef {
  id: string
  type: string
  // Will be resolved to Impulse when needed
}

// packages/opencode/src/tool/activity.ts
// Add field to activity execution context
interface ActivityExecutionContext {
  sessionID: string
  messageHistory: any[]
  workingFiles: any[]
  impulses: Impulse[]  // NEW - empty for now
}
```

### Validation
Run `validate-activity-execution.sh` - should still pass (no behavior change)

**Time**: 1 hour  
**Validation**: All tests pass, execution unchanged

---

## Iteration 3: Capture Parent Context as Impulses (Read-Only)

**Goal**: Capture parent context but don't use it yet

### Changes
1. Implement `captureParentContext()` function
2. Convert context to impulses
3. Store in execution context
4. Log captured impulses (for verification)
5. Don't pass to execution yet

### Code Changes
```typescript
// packages/opencode/src/tool/activity.ts

private async captureParentContext(ctx, params): Promise<Impulse[]> {
  const impulses: Impulse[] = []
  
  // User intent
  if (params.reason) {
    impulses.push({
      id: "user-intent",
      type: "memo",
      content: params.reason,
      metadata: {source: "activity-tool"}
    })
  }
  
  // Recent conversation (last 5 messages)
  if (ctx.messageHistory && ctx.messageHistory.length > 0) {
    impulses.push({
      id: "parent-conversation",
      type: "conversation",
      content: JSON.stringify(ctx.messageHistory.slice(-5)),
      metadata: {source: "parent-session"}
    })
  }
  
  // Log for verification
  log.info("captured parent context", {
    impulseCount: impulses.length,
    impulseIds: impulses.map(i => i.id)
  })
  
  return impulses
}

// In execute() function
const parentImpulses = await this.captureParentContext(ctx, params)
// Store but don't use yet
```

### Validation
1. Run `validate-activity-execution.sh` - should pass
2. Check logs for "captured parent context" message
3. Verify impulse IDs appear in logs

**Time**: 1 hour  
**Validation**: Tests pass + logs show impulses captured

---

## Iteration 4: Create ActivitySession Class (Empty Shell)

**Goal**: Create session class structure without changing execution

### Changes
1. Create `ActivitySession` class
2. Initialize at activity start
3. Use for execution (but just wraps existing code)
4. No impulse passing yet

### Code Changes
```typescript
// packages/opencode/src/session/activity-session.ts (new file)

export class ActivitySession {
  private executionId: string
  private parentSessionId: string
  private impulses: Impulse[]
  private stepOutputs: Map<string, any> = new Map()
  
  constructor(
    executionId: string,
    parentSessionId: string,
    initialImpulses: Impulse[]
  ) {
    this.executionId = executionId
    this.parentSessionId = parentSessionId
    this.impulses = initialImpulses
    
    log.info("ActivitySession created", {
      executionId,
      impulseCount: initialImpulses.length
    })
  }
  
  async executeStep(
    step: TaskStep,
    currentImplementation: () => Promise<any>
  ): Promise<any> {
    // For now, just call existing implementation
    const result = await currentImplementation()
    
    // Store output for future use
    this.stepOutputs.set(step.id, result)
    
    return result
  }
  
  getStepOutput(stepId: string): any {
    return this.stepOutputs.get(stepId)
  }
  
  getAllOutputs(): any[] {
    return Array.from(this.stepOutputs.values())
  }
  
  async close() {
    log.info("ActivitySession closed", {
      executionId: this.executionId,
      stepsExecuted: this.stepOutputs.size
    })
  }
}

// In activity.ts - use the session
const session = new ActivitySession(
  exec.execution_id,
  ctx.sessionID,
  [...template.impulse_refs, ...parentImpulses]
)

for (const step of template.tasks) {
  const result = await session.executeStep(step, async () => {
    // Existing executeStepWithTracking logic here
    return await executeStepWithTracking(step, ...)
  })
}

await session.close()
```

### Validation
1. Run `validate-activity-execution.sh` - should pass
2. Check logs for "ActivitySession created" and "closed"
3. Verify step outputs stored

**Time**: 2 hours  
**Validation**: Tests pass + session lifecycle logged

---

## Iteration 5: Pass Step Outputs Forward (First Real Change)

**Goal**: Make step outputs available to subsequent steps

### Changes
1. Convert step outputs to impulses
2. Add to session impulse stack
3. Log cumulative impulses per step
4. Don't change how steps execute yet (they won't see impulses)

### Code Changes
```typescript
// In ActivitySession.executeStep()
async executeStep(
  step: TaskStep,
  stepIndex: number,
  currentImplementation: () => Promise<any>
): Promise<any> {
  // Add prior step outputs as impulses
  const priorOutputImpulses: Impulse[] = []
  for (let i = 0; i < stepIndex; i++) {
    const priorOutput = this.stepOutputs.get(`step-${i}`)
    if (priorOutput?.output) {
      priorOutputImpulses.push({
        id: `step-${i}-output`,
        type: "memo",
        content: priorOutput.output,
        metadata: {
          fromStep: i,
          stepId: priorOutput.stepId
        }
      })
    }
  }
  
  // Accumulate impulses
  this.impulses = [
    ...this.impulses,
    ...priorOutputImpulses
  ]
  
  log.info("executing step with accumulated context", {
    stepIndex,
    totalImpulses: this.impulses.length,
    priorOutputCount: priorOutputImpulses.length
  })
  
  // Execute (still using old method)
  const result = await currentImplementation()
  
  this.stepOutputs.set(`step-${stepIndex}`, result)
  
  return result
}
```

### Validation
1. Run `validate-activity-execution.sh` - should pass
2. Check logs for "accumulated context" messages
3. Verify impulse count increases per step
4. Run multi-step activity, verify Step 2 logs show Step 1 output

**Time**: 1-2 hours  
**Validation**: Tests pass + logs show accumulation

---

## Iteration 6: Actually Use Impulses in Execution

**Goal**: Pass accumulated impulses to agent execution

### Changes
1. Modify step execution to include impulses in agent context
2. Agent receives impulses (implementation depends on agent architecture)
3. Verify agent can see impulses

### Code Changes
```typescript
// Depends on how agent execution works
// Conceptual:
async executeStep(
  step: TaskStep,
  stepIndex: number
): Promise<any> {
  // Accumulated impulses from before
  const context = {
    impulses: this.impulses,
    step: step,
    priorOutputs: this.getAllOutputs()
  }
  
  // Execute with impulses
  const result = await executeStepWithImpulses(step, context)
  
  this.stepOutputs.set(`step-${stepIndex}`, result)
  
  return result
}
```

### Validation
1. Run `validate-activity-execution.sh`
2. Verify execution still works
3. **NEW TEST**: Run activity with 2 steps where step 2 needs step 1 output
4. Verify step 2 can reference step 1 result

**Time**: 2-3 hours  
**Validation**: Tests pass + step continuity works

---

## Iteration 7: Remove Filesystem Reads

**Goal**: Update activity-create template to use impulses

### Changes
1. Add schema as impulse to activity-create template (backend)
2. Update prompts to reference impulses instead of files
3. Test activity-create works without filesystem

### Backend Changes
```sql
-- Add impulse_refs to activity-create template
UPDATE activity_templates
SET impulse_refs = [
  {
    "id": "activity-schema",
    "type": "memo",
    "content": "<full proto schema here>"
  },
  {
    "id": "example-template",
    "type": "memo",
    "content": "<example template JSON>"
  }
]
WHERE variant_id = 'INFRASTRUCTURE-0013e379';

-- Update task prompts
UPDATE task_steps
SET prompt.template = 'Using the activity schema provided in the activity-schema impulse, design a template for {{goal}}'
WHERE task_id = 'design-template' 
  AND activity_id = 'INFRASTRUCTURE-0013e379';
```

### Validation
1. Run `validate-activity-execution.sh`
2. **NEW TEST**: Run activity-create in container WITHOUT source files
3. Verify it works using only impulses

**Time**: 2 hours  
**Validation**: activity-create works without filesystem

---

## Validation Script Evolution

As we progress, enhance the validation script:

```bash
# After Iteration 5
echo "[Test 4] Multi-step context passing"
# Run activity with 2 steps
# Verify step 2 receives step 1 output

# After Iteration 7
echo "[Test 5] No filesystem dependency"
# Run in clean container
# Verify no file reads
```

---

## Rollback Strategy

After each iteration:
```bash
# If validation fails
git stash  # Save changes
git reset --hard HEAD  # Rollback
# Debug issue
# Try again
```

---

## Iteration Summary

| Iteration | Goal | Time | Validation |
|-----------|------|------|------------|
| 1 | Baseline validation script | 30min | Script runs |
| 2 | Add impulse infrastructure | 1hr | Tests pass, no behavior change |
| 3 | Capture parent context | 1hr | Tests pass + logs show capture |
| 4 | Create ActivitySession shell | 2hr | Tests pass + session lifecycle logged |
| 5 | Pass outputs forward | 2hr | Tests pass + accumulation logged |
| 6 | Use impulses in execution | 3hr | Tests pass + continuity works |
| 7 | Remove filesystem reads | 2hr | activity-create works without files |

**Total**: ~12 hours with validation at each step

---

## Next Step

Let's start with **Iteration 1: Create baseline validation script**.

This will:
1. Verify current system works
2. Give us confidence to make changes
3. Catch regressions immediately

Ready to create the validation script?
