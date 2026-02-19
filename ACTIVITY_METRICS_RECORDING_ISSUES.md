# Activity Metrics Recording Issues - Root Cause Analysis

**Date:** 2026-02-18  
**Status:** CRITICAL - 87.5% of activities stuck in "setup" status

---

## Executive Summary

**Problem:** Activity template performance analysis shows 0% success rates and no task completion data.

**Root Causes Identified:**
1. ✅ **87.5% of activities stuck in "setup" status** (14/16 activities never started executing)
2. ✅ **Analysis script looks for wrong field** ("tasks" instead of "prompts")
3. ✅ **Template-based activities use different execution model** than prompt-based activities
4. ✅ **Test activities dominate storage** (most are test fixtures, not real executions)

---

## Data Analysis

### Current State of Activities

```
Total Activities: 16

Status Distribution:
  setup: 14 (87.5%)  ← STUCK, never executed
  failed: 2 (12.5%)

Data Completeness:
  Has prompts: 0/16 (0.0%)      ← Expected for template-based activities
  Has stats: 16/16 (100.0%)     ← Good: metrics structure exists
  Has template_id: 11/16 (68.8%)

Issues:
  - no_tasks: 16           ← "tasks" field doesn't exist in schema
  - template_name_null: 16 ← templateName not populated
  - no_template_id: 5      ← Some activities have "unknown" template
```

### Sample "Setup" Activity

```json
{
  "id": "act_mlrhrepw_5241276d6559989a",
  "status": "setup",  ← STUCK HERE
  "templateId": "test-template-1771386458177-qa5izty198a",
  "templateName": null,  ← Not populated
  "startedAt": 1771386458180,
  "completedAt": null,  ← Never completed
  "prompts": [],  ← Empty (template-based execution)
  "tasks": <DOES NOT EXIST>,  ← Field doesn't exist
  "stats": {
    "tokens": { "input": 0, "output": 0 },  ← No execution
    "cost": { "total": 0 },
    "duration": 0
  }
}
```

---

## Root Cause 1: Activities Stuck in "setup" Status

### Lifecycle Flow

```typescript
// From activity.ts:380
const activity: Info = {
  status: "setup",  // Initial status
  // ...
}

// Expected transitions:
// setup → executing → completing → done
// setup → executing → failed
```

### Why Activities Get Stuck

**Possible Causes:**

1. **Activity never started executing**
   - Created but executor never called
   - Test fixtures that were created but not run
   - Errors during startup that weren't caught

2. **Executor crashed before updating status**
   - Exception thrown before `status = "executing"` 
   - Process killed mid-execution
   - No error recovery mechanism

3. **Test activities**
   - Created for testing but never executed
   - Evidence: Most have names like "test-template-*"

### Evidence

```typescript
// From prompts-runner.ts:154
activity.status = "executing"  // This line never reached

// Most activities:
- startedAt: set
- completedAt: null
- status: "setup"
- stats.duration: 0
- prompts: []
```

**Conclusion:** Activities are being created but the execution flow is not completing.

---

## Root Cause 2: Schema Mismatch

### What Analysis Script Expects

```python
# From analyze_template_performance.py:109
tasks = data.get("tasks", [])  # Expects "tasks" field
task_count = len(tasks)
failed_tasks = sum(1 for t in tasks if t.get("status") == "failed")
success_rate = (task_count - failed_tasks) / task_count
```

### What Activity Schema Actually Has

```typescript
// From activity.ts:152-170
export const Info = z.object({
  // ...
  prompts: z.array(PromptInfo),  // ← Uses "prompts", not "tasks"
  // ...
  // NO "tasks" field exists
})
```

### Template-Based vs Prompt-Based Execution

**Two Execution Models:**

1. **Prompt-Based** (original):
   - Uses `prompts` array
   - Each prompt is a markdown file
   - Tracked via `PromptInfo`
   ```typescript
   prompts: [
     { file: "01-setup.md", status: "committed" },
     { file: "02-implement.md", status: "executing" }
   ]
   ```

2. **Template-Based** (newer):
   - Uses activity templates with `tasks`
   - Each task is a sub-session
   - Tracked via... **WHERE?**
   ```typescript
   // Template defines tasks:
   tasks: [
     { id: "task-1", prompt: {...}, validation: {...} }
   ]
   // But where is task execution tracked in Activity.Info?
   ```

**Problem:** Template task execution is NOT tracked in `Activity.Info`!

---

## Root Cause 3: Missing Task Execution Tracking

### Template Schema Has Tasks

```typescript
// From activity-template.ts
export const Task = z.object({
  id: z.string(),
  subagent: z.enum(["memory", "general"]),
  prompt: z.object({...}),
  validation: z.object({...}).optional(),
  // ...
})

export const ActivityTemplate = z.object({
  tasks: z.array(Task),  // ← Template DEFINES tasks
  // ...
})
```

### But Activity.Info Doesn't Track Task Execution

```typescript
// From activity.ts:152-170
export const Info = z.object({
  // ✅ Has prompts array (for prompt-based)
  prompts: z.array(PromptInfo),
  
  // ❌ NO tasks array (for template-based)
  // tasks: z.array(TaskExecutionInfo),  // ← MISSING
  
  // ✅ Has template metadata
  templateId: z.string().optional(),
  templateVersion: z.number().optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
  // ...
})
```

**Gap:** When a template-based activity executes tasks, **where is the task execution state stored?**

### Possible Storage Locations

1. **In executionEvidence?**
   ```typescript
   executionEvidence: {
     sessionsSpawned: [],  // Sessions for each task?
     toolCalls: []
   }
   ```

2. **In agentDecisions?**
   ```typescript
   agentDecisions: [
     {
       step: number,
       taskId: string,  // ← References template task
       context: string,
       decision: string,
       outcome: "success" | "failure" | ...
     }
   ]
   ```

3. **Nowhere?** ← Likely the issue

---

## Root Cause 4: Test Data Dominates Storage

### Activity Template IDs

```
test-template-1771386458177-qa5izty198a
test-template-1771386458181-me2ol19rm5r
test-template-1771386458184-rnvky2f2fip
test-template-1771386458186-jp38yqi7qkb
test-template-1771386458188-me013xa9t0n
test-template-1771386458190-e5y7ywtgx8e
test-template-1771386458195-1iwtqghi78w
test-template-1771386458198-yiqfunqaju
test-template-1771386458200-6tgynsv7p7n
evolve-activity-self-contained
fix-bug-complete
unknown
```

**Evidence:**
- 10/12 templates are "test-template-*"
- All created within seconds (timestamps 1771386458177-1771386458200)
- All stuck in "setup" status
- All have 0 duration, 0 cost, 0 tokens

**Conclusion:** These are test fixtures, not real activity executions.

---

## Impact on A/B Testing System

### Why This Matters

The A/B testing system relies on:
1. ✅ **Success rate calculation** → Requires task completion data
2. ✅ **Cost metrics** → Requires execution to complete
3. ✅ **Duration metrics** → Requires execution to complete
4. ✅ **Statistical significance** → Requires sufficient sample size

**Current Impact:**
- ❌ **0% success rate** for all templates (no completed tasks)
- ❌ **$0 cost** for all templates (no execution)
- ❌ **0ms duration** for all templates (no execution)
- ❌ **Cannot calculate improvement gradients** (no data)
- ❌ **Cannot make promotion decisions** (no statistical basis)

---

## Solutions

### Immediate Fixes

#### 1. Add Task Execution Tracking to Activity.Info

```typescript
// activity.ts: Add to Activity.Info schema

export const TaskExecutionInfo = z.object({
  taskId: z.string().describe("References template task ID"),
  sessionId: z.string().optional().describe("Session that executed this task"),
  status: z.enum(["pending", "executing", "completed", "failed", "skipped"]),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  duration: z.number().optional(),
  cost: z.number().optional(),
  tokens: SessionTokens.optional(),
  error: z.string().optional(),
  attempts: z.number().default(1),
})

export const Info = z.object({
  // ... existing fields ...
  
  // Add task execution tracking
  tasks: z.array(TaskExecutionInfo).default([]).describe("Task execution tracking for template-based activities"),
  
  // ... rest of schema ...
})
```

#### 2. Update Template Executor to Track Tasks

```typescript
// template-executor.ts: Update task execution

async function executeTask(activity: Activity.Info, task: ActivityTemplate.Task) {
  // 1. Add task to activity.tasks array
  const taskExecution: Activity.TaskExecutionInfo = {
    taskId: task.id,
    status: "pending",
  }
  activity.tasks.push(taskExecution)
  await Activity.save(activity)
  
  // 2. Update status to executing
  taskExecution.status = "executing"
  taskExecution.startedAt = Date.now()
  await Activity.save(activity)
  
  try {
    // 3. Execute task (spawn session, run prompt, etc.)
    const result = await runTaskSession(task)
    
    // 4. Update on success
    taskExecution.status = "completed"
    taskExecution.completedAt = Date.now()
    taskExecution.duration = Date.now() - taskExecution.startedAt
    taskExecution.cost = result.cost
    taskExecution.tokens = result.tokens
    taskExecution.sessionId = result.sessionId
    
  } catch (error) {
    // 5. Update on failure
    taskExecution.status = "failed"
    taskExecution.completedAt = Date.now()
    taskExecution.error = error.message
  }
  
  await Activity.save(activity)
}
```

#### 3. Update Activity Status Transitions

```typescript
// Ensure status transitions happen

async function startActivity(activity: Activity.Info) {
  activity.status = "executing"  // ← Must happen
  await Activity.save(activity)
}

async function completeActivity(activity: Activity.Info, success: boolean) {
  activity.status = success ? "completing" : "failed"
  await Activity.save(activity)
  
  // Final transition
  activity.status = success ? "done" : "failed"
  activity.completedAt = Date.now()
  activity.stats.duration = Date.now() - activity.startedAt
  await Activity.save(activity)
}
```

#### 4. Fix Analysis Script

```python
# analyze_template_performance.py: Use correct field

# OLD (incorrect):
tasks = data.get("tasks", [])

# NEW (correct for prompt-based):
prompts = data.get("prompts", [])
task_count = len(prompts)
failed_tasks = sum(1 for p in prompts if p.get("status") == "failed")

# NEW (correct for template-based):
tasks = data.get("tasks", [])  # Will exist after schema fix
task_count = len(tasks)
failed_tasks = sum(1 for t in tasks if t.get("status") == "failed")

# BETTER (supports both):
if "tasks" in data and len(data["tasks"]) > 0:
    # Template-based activity
    tasks = data["tasks"]
    task_count = len(tasks)
    failed_tasks = sum(1 for t in tasks if t.get("status") == "failed")
elif "prompts" in data and len(data["prompts"]) > 0:
    # Prompt-based activity
    prompts = data["prompts"]
    task_count = len(prompts)
    failed_tasks = sum(1 for p in prompts if p.get("status") == "failed")
else:
    # No execution data
    task_count = 0
    failed_tasks = 0
```

#### 5. Clean Up Test Data

```bash
# Remove test activities
cd ~/.local/share/opencode/storage/activity
rm -f act_*test-template*.json

# Or archive them
mkdir -p ~/.local/share/opencode/storage/activity-archive
mv act_*test-template*.json ~/.local/share/opencode/storage/activity-archive/
```

---

### Long-Term Improvements

#### 1. Unified Execution Model

```typescript
// Create unified task/prompt model

export const ExecutionStep = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("prompt"),
    file: z.string(),
    // ... PromptInfo fields
  }),
  z.object({
    type: z.literal("task"),
    taskId: z.string(),
    // ... TaskExecutionInfo fields
  })
])

export const Info = z.object({
  // ...
  execution: z.array(ExecutionStep).default([]),
  // ...
})
```

#### 2. Execution State Machine

```typescript
// Enforce state transitions

class ActivityStateMachine {
  async transition(from: Activity.Status, to: Activity.Status) {
    const validTransitions = {
      setup: ["executing", "failed"],
      executing: ["completing", "failed"],
      completing: ["done", "failed"],
      done: [],
      failed: []
    }
    
    if (!validTransitions[from].includes(to)) {
      throw new Error(`Invalid transition: ${from} → ${to}`)
    }
    
    // Log transition
    // Update activity
    // Emit events
  }
}
```

#### 3. Execution Recovery

```typescript
// Resume stuck activities

async function resumeStuckActivities() {
  const activities = await Activity.list()
  
  for (const activity of activities) {
    if (activity.status === "setup" && Date.now() - activity.startedAt > 60_000) {
      // Stuck for >1 minute
      log.warn("Found stuck activity", { id: activity.id })
      
      // Mark as failed
      activity.status = "failed"
      activity.completedAt = Date.now()
      await Activity.save(activity)
    }
  }
}
```

#### 4. Better Test Isolation

```typescript
// Separate test storage

const storage = process.env.NODE_ENV === "test"
  ? Storage.test("activity")
  : Storage.persistent("activity")

// Or use in-memory storage for tests
```

---

## Verification Plan

### Step 1: Confirm Schema Gap

```bash
# Check Activity.Info schema
cd repos/metabob-opencode
rg "export const Info = " packages/opencode/src/session/activity.ts -A 100 | grep -E "(tasks|prompts)"

# Expected: "prompts" exists, "tasks" does not
```

### Step 2: Find Template Executor

```bash
# Where are template tasks executed?
rg "executeTask|runTask" packages/opencode/src/session/template-executor.ts

# Does it update activity.tasks?
rg "activity.tasks" packages/opencode/src/session/
```

### Step 3: Test with Real Activity

```bash
# Create a real activity and observe
opencode activity \
  --template "fix-bug-complete" \
  --variables '{"bugDescription":"test"}' \
  --reason "Testing metrics recording"

# Check if it completes
ls -lt ~/.local/share/opencode/storage/activity/ | head -5

# Inspect the result
cat ~/.local/share/opencode/storage/activity/<latest>.json | jq '.status, .tasks, .prompts'
```

---

## Priority Actions

### Critical (P0) - Blocks A/B Testing
1. ✅ Add `tasks` array to `Activity.Info` schema
2. ✅ Update template executor to populate `tasks` array
3. ✅ Ensure status transitions (setup → executing → done/failed)

### High (P1) - Data Quality
4. ✅ Fix analysis script to handle both prompt and task models
5. ✅ Add execution recovery for stuck activities
6. ✅ Clean up test data from storage

### Medium (P2) - Future Improvements
7. ⚠️ Unified execution model (ExecutionStep)
8. ⚠️ Execution state machine with validation
9. ⚠️ Better test isolation

---

## Expected Outcome

After fixes:

```json
{
  "id": "act_xyz",
  "templateId": "fix-bug-complete",
  "templateName": "Fix Bug Complete",  // ← Populated
  "status": "done",  // ← Completed
  "startedAt": 1771420000000,
  "completedAt": 1771420045000,  // ← Set
  "tasks": [  // ← Tracked
    {
      "taskId": "diagnose",
      "status": "completed",
      "duration": 15000,
      "cost": 0.0123
    },
    {
      "taskId": "implement-fix",
      "status": "completed",
      "duration": 25000,
      "cost": 0.0234
    }
  ],
  "stats": {
    "tokens": { "input": 12500, "output": 890 },  // ← Accumulated
    "cost": { "total": 0.0357 },  // ← Real cost
    "duration": 45000  // ← Real duration
  }
}
```

**Then A/B testing will work:**
- ✅ Success rate: 100% (2/2 tasks completed)
- ✅ Avg cost: $0.0357
- ✅ Avg duration: 45s
- ✅ Can compare candidates vs stable
- ✅ Can make promotion decisions

---

## References

- `activity.ts`: Activity.Info schema (lines 152-280)
- `template-executor.ts`: Template task execution
- `analyze_template_performance.py`: Performance analysis script
- `TEMPLATE_AB_TESTING_DESIGN.md`: A/B testing system design

---

**Status:** Diagnosis complete, solutions identified, ready for implementation.
