# Activity Execution Order - Quick Summary

## Your Question
> We may be assuming that every task of an activity executes in the same way. We expect the lifecycle hooks to run -> the task to run -> The lifecycle hooks to run -> the validators to run -> (... then the next hooks)
> What can we tell from the actual execution order? How do we prove this?

## Answer: Your Assumptions Are **PARTIALLY CORRECT**

## ✅ What's Correct
1. **Lifecycle hooks DO run for every task** (via Session.prompt inside executeViaSubagent)
2. **Validators run AFTER each task completes** (line 1290 in executeTask)
3. **Tasks execute sequentially** (simple for loop in executeTasks)

## ❌ What's Wrong
1. **Hooks don't run "between" tasks** - they run **INSIDE** each task execution
2. **Hooks are PROMPT-based, not TASK-based** - they run via Session.prompt()
3. **The execution model is: TASK → (hooks → agent → hooks → validators) → NEXT_TASK**

---

## Proven Execution Flow

### Per Activity (Once):
```
Activity Tool Invoked
├─ Load template
├─ Validate variables (all tasks)
├─ Pre-flight checks (git, memory agent, metabob)
└─ Create activity session
```

### Per Task (Loop):
```
For Each Task:
  ├─ Merge & validate variables
  ├─ Interpolate prompt with impulse context
  ├─ executeViaSubagent (calls TaskTool → Session.prompt)
  │  │
  │  ├─ PRE-TURN HOOKS:
  │  │  ├─ memory-management (priority 10)
  │  │  ├─ activity-recommendation-injection (priority 15)
  │  │  └─ metabob-context-preparation (priority 20)
  │  │
  │  ├─ [Agent Executes Prompt]
  │  │
  │  └─ POST-TURN HOOKS:
  │     ├─ post-turn-cleanup (priority 100)
  │     └─ session-memory-optimization (priority 110)
  │
  ├─ Track execution evidence
  ├─ Validate task result (AFTER agent completes)
  └─ Co-change analysis (optional)
```

### Key Insight:
**Hooks run via `Session.prompt()` which is called INSIDE `executeViaSubagent()`**

This means:
- ✅ Hooks run before agent sees prompt (pre-turn)
- ✅ Hooks run after agent completes (post-turn)
- ✅ Validators run after hooks complete
- ❌ Hooks DON'T run "between tasks" in the executeTasks loop
- ❌ Hooks run "inside tasks" via the Session.prompt call

---

## Code Evidence

### 1. Task Loop (No Hooks Between Tasks)
**File**: `src/session/template-executor.ts:365`
```typescript
async function executeTasks(...) {
  const executions: TaskExecution[] = []
  
  // Simple for loop - NO HOOKS HERE
  for (const task of template.tasks) {
    if (!areTaskDependenciesMet(task, executions)) {
      executions.push(createSkippedExecution(task, "dependencies not met"))
      continue
    }
    
    // Execute task (hooks run INSIDE this call)
    const execution = await executeTaskWithRetry(task, activity, variables, ...)
    executions.push(execution)
  }
  
  return executions
}
```

### 2. Task Execution (Hooks Via Session.prompt)
**File**: `src/session/template-executor.ts:1149`
```typescript
async function executeTask(...) {
  // 1. Prepare variables and prompt
  const mergedVariables = ActivityTemplate.mergeDefaultVariables(task, variables)
  let prompt = ActivityTemplate.interpolatePrompt(promptTemplate, enrichedVariables)
  
  // 2. Execute via subagent (THIS CALLS Session.prompt → triggers hooks)
  const result = await executeViaSubagent(
    task.subagent,
    task.description,
    prompt,
    sessionID,
    parentSessionID,
    task.complexity,
  )
  
  // 3. Validate result (AFTER hooks complete)
  const validation = await validateTaskResult(task, result, mergedVariables, sessionID)
  
  if (!validation.passed) {
    throw new Error(`Validation failed: ${JSON.stringify(failedChecks)}`)
  }
  
  return { startedAt, completedAt, validation }
}
```

### 3. Hooks Registered by Priority
**File**: `src/session/turn-lifecycle-hooks.ts`
```typescript
// PRE-TURN (priority < 100)
TurnLifecycle.registerHook({
  name: "memory-management",
  priority: 10,
  execute: async (ctx) => {
    // Runs BEFORE agent sees prompt
    const result = await executeActivityInline("manage-session-memory", ...)
    // Transfer impulses to session
  }
})

TurnLifecycle.registerHook({
  name: "metabob-context-preparation",
  priority: 20,
  execute: async (ctx) => {
    // Creates metabob impulses BEFORE agent sees prompt
    await SessionMemory.addImpulse(ctx.sessionID, { ... })
  }
})

// POST-TURN (priority >= 100)
TurnLifecycle.registerHook({
  name: "session-memory-optimization",
  priority: 110,
  execute: async (ctx) => {
    // Runs AFTER agent completes
    await SessionMemoryLifecycle.optimizeForTurn({ ... })
  }
})
```

---

## How to Prove It Live

### Method 1: Add Trace Logs
Add these to the codebase:

**In `src/session/template-executor.ts:executeTasks()`**:
```typescript
for (const task of template.tasks) {
  console.error(`\n[TRACE] BEFORE TASK: ${task.id}\n`)
  
  const execution = await executeTaskWithRetry(...)
  
  console.error(`\n[TRACE] AFTER TASK: ${task.id}, validation: ${execution.validation?.passed}\n`)
}
```

**In `src/session/turn-lifecycle-hooks.ts` (each hook)**:
```typescript
execute: async (ctx) => {
  console.error(`\n[HOOK TRACE] ${this.name} EXECUTING for session ${ctx.sessionID}\n`)
  // ... existing hook logic
  console.error(`\n[HOOK TRACE] ${this.name} COMPLETE\n`)
}
```

**In `src/session/template-executor.ts:executeTask()` (line ~1290)**:
```typescript
console.error(`\n[VALIDATION] Running validators for task ${task.id}\n`)
const validation = await validateTaskResult(task, result, mergedVariables, sessionID)
console.error(`\n[VALIDATION] Complete: passed=${validation.passed}\n`)
```

### Method 2: Run Test Activity
Use the test template created in `test-execution-order-template.json`:

```bash
# Register template (using proper opencode CLI)
opencode register-template ./test-execution-order-template.json

# Execute activity
opencode activity execution-order-test \
  --variables '{}' \
  --reason "Testing execution order"
```

### Expected Output Order:
```
[TRACE] BEFORE TASK: task-1
[HOOK TRACE] memory-management EXECUTING
[HOOK TRACE] metabob-context-preparation EXECUTING
[Agent executes]
[HOOK TRACE] post-turn-cleanup EXECUTING
[HOOK TRACE] session-memory-optimization EXECUTING
[VALIDATION] Running validators for task task-1
[VALIDATION] Complete: passed=true
[TRACE] AFTER TASK: task-1

[TRACE] BEFORE TASK: task-2
[HOOK TRACE] memory-management EXECUTING (AGAIN!)
[HOOK TRACE] metabob-context-preparation EXECUTING (AGAIN!)
[Agent executes]
[HOOK TRACE] post-turn-cleanup EXECUTING (AGAIN!)
[HOOK TRACE] session-memory-optimization EXECUTING (AGAIN!)
[VALIDATION] Running validators for task task-2
[VALIDATION] Complete: passed=true
[TRACE] AFTER TASK: task-2
```

This proves:
1. ✅ Hooks run INSIDE each task (between BEFORE and AFTER)
2. ✅ Hooks run MULTIPLE TIMES (once per task)
3. ✅ Validators run AFTER hooks complete
4. ✅ Tasks execute SEQUENTIALLY (AFTER task-1 → BEFORE task-2)

---

## Implications

### For Activity Execution:
- Each task gets **full lifecycle treatment** (memory prep, metabob context, cleanup)
- Hooks run **per prompt**, not per activity
- Memory is optimized **after each task**, not just at activity end

### For Debugging:
- Look for hook logs **inside task execution**, not between tasks
- Check `Session.prompt()` for hook invocation
- Validators are **synchronous** - task fails immediately if validation fails

### For Performance:
- Hooks add overhead **per task** (not just once per activity)
- Memory optimization runs **multiple times** in multi-task activities
- Each task triggers a new prompt → new hook cycle

---

## Files to Review

1. **`src/session/template-executor.ts`**:
   - `executeTasks()` - main task loop (line ~365)
   - `executeTask()` - task execution + validation (line ~1149)
   - `executeViaSubagent()` - calls Session.prompt (triggers hooks)

2. **`src/session/turn-lifecycle.ts`**:
   - `executePreTurnHooks()` - runs before prompt (line ~85)
   - `executePostTurnHooks()` - runs after prompt (line ~184)

3. **`src/session/turn-lifecycle-hooks.ts`**:
   - Hook registrations with priorities (pre-turn < 100, post-turn >= 100)

4. **`src/tool/activity.ts`**:
   - Activity tool entry point (line ~470)
   - Hands off to TemplateExecutor

---

## Conclusion

**Your mental model was close but slightly off:**

❌ Wrong: `hooks → task → hooks → validators → next hooks → next task → ...`

✅ Correct: `task1(hooks → agent → hooks → validators) → task2(hooks → agent → hooks → validators) → ...`

**The hooks are NESTED INSIDE each task, not running BETWEEN tasks.**

This is because:
- Each task calls `executeViaSubagent()`
- Which calls `TaskTool.executeInternal()`
- Which calls `Session.prompt()`
- **And Session.prompt() is where hooks are triggered**

See full details in: `ACTIVITY_EXECUTION_ORDER_PROOF.md`
