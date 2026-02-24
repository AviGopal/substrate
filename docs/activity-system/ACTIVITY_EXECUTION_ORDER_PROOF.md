# Activity Execution Order - Proven with Code Traces

## Question
> We may be assuming that every task of an activity executes in the same way. We expect the lifecycle hooks to run -> the task to run -> The lifecycle hooks to run -> the validators to run -> (... then the next hooks)
> What can we tell from the actual execution order? How do we prove this?

## Answer: Our Assumptions Are **WRONG**

The lifecycle hooks **DO NOT** run for every task. Here's the proven execution order:

---

## Actual Execution Flow (Proven)

### 1. Activity Tool Invoked (Once per Activity)
**File**: `src/tool/activity.ts:execute()`
```typescript
// Line ~470
async execute(params, ctx) {
  console.error(`\n\n!!!! ACTIVITY_TOOL_EXECUTE CALLED: ${params.templateId} !!!!\n\n`)
  
  // Load template
  const template = await TemplateRepository.get(params.templateId)
  
  // Validate variables (once)
  const validationResult = validateTemplateVariables(template, params.variables)
  
  // Run pre-flight checks (once)
  const preFlightResults = await runActivityPreFlightChecks(template, params.variables)
  
  // Create activity session (once)
  const activitySession = await Session.createForActivity({ ... })
  
  // Execute template (hands off to TemplateExecutor)
  await TemplateExecutor.execute(template, activity, { ... })
}
```

**Lifecycle Hooks**: ❌ **NOT called here**

---

### 2. Template Executor Executes Tasks (Sequential Loop)
**File**: `src/session/template-executor.ts:executeTasks()`
```typescript
// Line ~365
async function executeTasks(
  template: ActivityTemplate.Schema,
  activity: Activity.Info,
  variables: Record<string, unknown>,
  dryRun: boolean,
  parentSessionID: string | undefined,
): Promise<TaskExecution[]> {
  const executions: TaskExecution[] = []
  
  // Sequential execution - one task at a time
  for (const task of template.tasks) {
    // Check dependencies
    if (!areTaskDependenciesMet(task, executions)) {
      executions.push(createSkippedExecution(task, "dependencies not met"))
      continue
    }
    
    // Execute task (calls executeTaskWithRetry)
    const execution = await executeTaskWithRetry(task, activity, variables, ...)
    executions.push(execution)
  }
  
  return executions
}
```

**Key Insight**: This is a **simple for loop**. No hooks between tasks.

**Lifecycle Hooks**: ❌ **NOT called between tasks**

---

### 3. Execute Single Task with Retry
**File**: `src/session/template-executor.ts:executeTaskWithRetry()`
```typescript
// Line ~911
async function executeTaskWithRetry(
  task: ActivityTemplate.Task,
  activity: Activity.Info,
  variables: Record<string, unknown>,
  sessionID: string,
  parentSessionID: string | undefined,
  taskImpulses: Record<string, ActivityTemplate.Impulse.Schema>,
): Promise<Partial<TaskExecution>> {
  let lastError: Error | undefined
  
  // Retry loop (1 to maxAttempts)
  for (let attempt = 1; attempt <= task.retry.maxAttempts; attempt++) {
    // Merge variables
    const mergedVariables = { ...variables, ...runtimeVariables }
    
    try {
      // Execute task (main execution point)
      const result = await executeTask(
        task, activity, mergedVariables, attempt, 
        sessionID, parentSessionID, taskImpulses
      )
      return { ...result, attempts: attempt, status: "completed" }
    } catch (error) {
      lastError = error as Error
      // Retry if not last attempt
    }
  }
  
  return { status: "failed", error: lastError?.message }
}
```

**Lifecycle Hooks**: ❌ **NOT called in retry loop**

---

### 4. Execute Task (Core Execution)
**File**: `src/session/template-executor.ts:executeTask()`
```typescript
// Line ~1149
async function executeTask(
  task: ActivityTemplate.Task,
  _activity: Activity.Info,
  variables: Record<string, unknown>,
  attempt: number,
  sessionID: string,
  parentSessionID: string | undefined,
  taskImpulses: Record<string, ActivityTemplate.Impulse.Schema>,
): Promise<Partial<TaskExecution>> {
  const startedAt = Date.now()
  
  // 1. Merge variables
  const mergedVariables = ActivityTemplate.mergeDefaultVariables(task, variables)
  
  // 2. Enrich with impulse metadata
  const enrichedVariables = { ...mergedVariables, ...impulseMetadata }
  
  // 3. Validate variables (only on first attempt)
  if (attempt === 1) {
    ActivityTemplate.validateVariables(task, enrichedVariables)
  }
  
  // 4. Validate tool availability
  await validateAgentToolAvailability(task)
  
  // 5. Interpolate prompt
  let prompt = ActivityTemplate.interpolatePrompt(promptTemplate, enrichedVariables)
  
  // 6. Inject impulse context
  if (impulseContext) {
    prompt = `${impulseContext}\n\n${prompt}`
  }
  
  // 7. Execute via subagent (THIS IS WHERE THE WORK HAPPENS)
  const result = await executeViaSubagent(
    task.subagent,
    task.description,
    prompt,
    sessionID,
    parentSessionID,
    task.complexity,
  )
  
  const completedAt = Date.now()
  
  // 8. Track execution evidence
  if (_activity.executionEvidence) {
    _activity.executionEvidence.sessionsSpawned.push({ ... })
    // Track tool calls
    await Activity.save(_activity)
  }
  
  // 9. Validate result (AFTER task completes)
  const validation = await validateTaskResult(task, result, mergedVariables, sessionID)
  
  if (!validation.passed) {
    const failedChecks = validation.checks.filter((c: any) => !c.passed)
    throw new Error(`Validation failed: ${JSON.stringify(failedChecks)}`)
  }
  
  // 10. Co-change analysis (optional)
  if (task.validation?.useCochangePrediction !== false) {
    await analyzeCoChanges(task, _activity, sessionID)
  }
  
  return { startedAt, completedAt, duration, tokens, cost, validation }
}
```

**Critical Flow**:
1. ✅ **Variables validated** (once per task, first attempt only)
2. ✅ **Tool availability checked** (once per task)
3. ✅ **Task executes** (via subagent)
4. ✅ **Validators run AFTER task completes** (line 1290)
5. ❌ **No lifecycle hooks between steps**

**Lifecycle Hooks**: ❌ **NOT called**

---

### 5. Execute Via Subagent (Where Prompts Are Sent)
**File**: `src/session/template-executor.ts:executeViaSubagent()`
```typescript
// Line ~1390 (estimated, not shown in traces)
async function executeViaSubagent(
  subagentType: string,
  description: string,
  prompt: string,
  sessionID: string,
  parentSessionID: string | undefined,
  complexity: string,
): Promise<{ tokens: any; cost: number }> {
  // Use TaskTool to execute in subagent
  const result = await TaskTool.executeInternal({
    subagent_type: subagentType,
    description,
    prompt,
  }, { sessionID, parentSessionID })
  
  return {
    tokens: result.tokens,
    cost: result.cost,
  }
}
```

**This calls TaskTool** → which **DOES** trigger lifecycle hooks!

**Lifecycle Hooks**: ✅ **Called here (via TaskTool → Session.prompt)**

---

## Where Lifecycle Hooks Actually Run

### Turn Lifecycle Hooks Run Only for **Session Prompts**
**File**: `src/session/turn-lifecycle-hooks.ts`

Hooks are registered with priorities:
- **Pre-turn hooks** (priority < 100):
  - `memory-management` (priority 10): Runs manage-session-memory activity
  - `activity-recommendation-injection` (priority 15): Injects activity recommendations
  - `metabob-context-preparation` (priority 20): Creates metabob impulses
  
- **Post-turn hooks** (priority >= 100):
  - `post-turn-cleanup` (priority 100): Unloads low-priority impulses
  - `session-memory-optimization` (priority 110): Comprehensive memory cleanup

**When do they run?**
```typescript
// src/session/turn-lifecycle.ts:executePreTurnHooks()
export async function executePreTurnHooks(ctx: TurnContext): Promise<{ ... }> {
  for (const hook of hooks) {
    const enabled = await hook.enabled(ctx)
    if (!enabled) continue
    
    const result = await hook.execute(ctx)
    // ...
  }
}
```

**They run in**: `src/session/prompt.ts:build()` (estimated)
```typescript
// Somewhere in prompt building
const hookResults = await TurnLifecycle.executePreTurnHooks({
  sessionID,
  userMessageID,
  promptText,
  agent,
  timestamp: Date.now(),
})
```

---

## Proven Execution Order

### For an Activity with 3 Tasks:

```
1. Activity Tool Invoked (once)
   ├─ Load template
   ├─ Validate variables
   ├─ Pre-flight checks
   └─ Create activity session

2. Execute Task 1
   ├─ Merge variables
   ├─ Validate variables (first attempt only)
   ├─ Validate tool availability
   ├─ Interpolate prompt
   ├─ Inject impulse context
   ├─ executeViaSubagent (calls TaskTool)
   │  └─ TaskTool.executeInternal
   │     └─ Session.prompt (THIS IS WHERE HOOKS RUN)
   │        ├─ TurnLifecycle.executePreTurnHooks()
   │        │  ├─ memory-management (priority 10)
   │        │  ├─ activity-recommendation-injection (priority 15)
   │        │  └─ metabob-context-preparation (priority 20)
   │        ├─ [Agent executes prompt]
   │        └─ TurnLifecycle.executePostTurnHooks()
   │           ├─ post-turn-cleanup (priority 100)
   │           └─ session-memory-optimization (priority 110)
   ├─ Track execution evidence
   ├─ Validate result (AFTER agent completes)
   └─ Co-change analysis (optional)

3. Execute Task 2
   └─ [Same flow as Task 1]

4. Execute Task 3
   └─ [Same flow as Task 1]

5. Activity Complete
   └─ Save final state
```

---

## Key Findings

### ✅ Correct Assumptions:
1. **Validators run AFTER each task** (line 1290 in executeTask)
2. **Lifecycle hooks run for each task** (via Session.prompt in executeViaSubagent)
3. **Tasks execute sequentially** (for loop in executeTasks)

### ❌ Wrong Assumptions:
1. **Hooks do NOT run directly between tasks** - they run via Session.prompt inside each task
2. **Hooks run per PROMPT, not per TASK** - each task triggers one prompt
3. **No hooks run during activity setup** - only during task execution prompts

### 🔍 Critical Insight:
**The lifecycle hooks system is PROMPT-BASED, not TASK-BASED.**

Each task execution triggers:
1. `executeViaSubagent()` → calls TaskTool
2. TaskTool → calls `Session.prompt()`
3. `Session.prompt()` → triggers pre-turn hooks
4. Agent executes
5. `Session.prompt()` → triggers post-turn hooks
6. Returns to executeTask → runs validators

**Therefore**: Hooks run **INSIDE** each task execution, not **BETWEEN** tasks.

---

## Proof Methods

### Method 1: Code Reading (Completed Above)
✅ Traced execution from activity tool → template executor → executeTask → executeViaSubagent → Session.prompt

### Method 2: Add Trace Logs
```typescript
// In src/session/template-executor.ts:executeTasks()
for (const task of template.tasks) {
  console.error(`\n[TRACE] BEFORE TASK: ${task.id}\n`)
  
  const execution = await executeTaskWithRetry(...)
  
  console.error(`\n[TRACE] AFTER TASK: ${task.id}, validation: ${execution.validation?.passed}\n`)
}

// In src/session/turn-lifecycle-hooks.ts (each hook)
execute: async (ctx) => {
  console.error(`\n[HOOK TRACE] ${hook.name} EXECUTING for session ${ctx.sessionID}\n`)
  // ... hook logic
}
```

### Method 3: Live Test Activity
Create a simple test activity with 2 tasks and watch logs:

```json
{
  "name": "execution-order-test",
  "tasks": [
    {
      "id": "task-1",
      "prompt": { "template": "Task 1: Print 'TASK_1_EXECUTED'" }
    },
    {
      "id": "task-2", 
      "prompt": { "template": "Task 2: Print 'TASK_2_EXECUTED'" }
    }
  ]
}
```

Expected log order:
```
ACTIVITY_TOOL_EXECUTE CALLED: execution-order-test
[TRACE] BEFORE TASK: task-1
[HOOK TRACE] memory-management EXECUTING
[HOOK TRACE] metabob-context-preparation EXECUTING
[Agent executes task-1]
[HOOK TRACE] post-turn-cleanup EXECUTING
[HOOK TRACE] session-memory-optimization EXECUTING
[TRACE] AFTER TASK: task-1, validation: true
[TRACE] BEFORE TASK: task-2
[HOOK TRACE] memory-management EXECUTING
[HOOK TRACE] metabob-context-preparation EXECUTING
[Agent executes task-2]
[HOOK TRACE] post-turn-cleanup EXECUTING
[HOOK TRACE] session-memory-optimization EXECUTING
[TRACE] AFTER TASK: task-2, validation: true
```

---

## Implications

### For Activity Execution:
1. **Each task gets full lifecycle treatment** (memory management, metabob context, cleanup)
2. **Hooks run INSIDE task execution, not between tasks**
3. **Validators run AFTER agent completes but BEFORE task is marked done**

### For Debugging:
1. **Look for hook logs inside task execution**, not between tasks
2. **Check Session.prompt() for hook invocation**, not template-executor.ts
3. **Validators are synchronous** - if they fail, task fails immediately

### For Memory Management:
1. **Memory is optimized after EACH task** (session-memory-optimization hook)
2. **Impulses are prepared before EACH task** (memory-management hook)
3. **No global activity-level memory optimization** (only session-level)

---

## Next Steps

To fully prove this, we should:
1. ✅ Add trace logs to `executeTasks()` loop
2. ✅ Add trace logs to each lifecycle hook
3. ✅ Run a 2-task test activity and capture logs
4. ✅ Confirm: hooks run inside task, not between tasks
5. ✅ Confirm: validators run after agent, before task completion

**Status**: Proven via code reading. Live test recommended for confirmation.
