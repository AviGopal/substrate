# Phase 2 Instrumentation Data Flow Trace

**Date:** 2026-02-22  
**Objective:** Trace the actual data flow for Phase 2 instrumentation to understand where activity execution context and impulse data flows through the system.

---

## Executive Summary

**CRITICAL FINDING:** Phase 2 instrumentation API endpoints exist but are **NOT CURRENTLY CONNECTED** to the activity execution flow.

### Current State

1. **Backend API Ready:** `/api/content` and `/api/tasks` endpoints exist in `repos/metabob-rpc-api/server/routes/activity.py`
2. **Database Operations Ready:** `insert_activity_content()` and `insert_task_execution()` functions exist and work
3. **Execution Flow Gap:** The TypeScript activity executor (`template-executor.ts`) does NOT call these endpoints
4. **Missing Instrumentation:** No code currently captures or sends execution context to SurrealDB

### What This Means

**Phase 2 instrumentation is designed but not implemented.** The infrastructure is ready but dormant. We need to:

1. Add instrumentation calls in `template-executor.ts` 
2. Capture impulse context and metrics during execution
3. Send data to backend API endpoints
4. Complete the learning loop

---

## Data Flow Architecture (As Designed)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Activity Execution Flow                       │
└─────────────────────────────────────────────────────────────────┘

1. ENTRY POINT: template-executor.ts::execute()
   ├─> Creates Activity from template
   ├─> Creates impulses from context requirements
   └─> Calls executeTasks()

2. TASK EXECUTION: template-executor.ts::executeTasks()
   ├─> FOR EACH TASK:
   │   ├─> Load impulses (loadAndFormatImpulses)
   │   ├─> Execute task in session
   │   ├─> Extract metrics (extractMetricsFromSession)
   │   └─> Update task execution record
   │
   └─> CURRENTLY MISSING INSTRUMENTATION:
       ├─> ❌ Store activity_content at start
       ├─> ❌ Record task_execution for each task
       ├─> ❌ Track impulse loading/unloading
       ├─> ❌ Capture context_ratio metrics
       └─> ❌ Send data to backend API

3. BACKEND API: repos/metabob-rpc-api/server/routes/activity.py
   ├─> POST /v2/activities/content → insert_activity_content()
   └─> POST /v2/activities/tasks → insert_task_execution()

4. DATABASE: SurrealDB
   ├─> activity_content table (execution context + template)
   └─> task_execution table (per-task metrics)
```

---

## Detailed Component Analysis

### 1. Activity Execution Entry Point

**File:** `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Function:** `execute(options: ExecutionOptions)`

**Current Flow:**
```typescript
// Line 67-153
async function execute(rawOptions: z.input<typeof ExecutionOptions>): Promise<ExecutionResult> {
  // 1. Get template from repository
  const template = await TemplateRepository.get(options.templateId)
  
  // 2. Create activity
  let activity = await createActivityFromTemplate(template, options)
  
  // 3. Create impulses from context requirements (if any)
  if (!options.dryRun && template.contextRequirements) {
    const impulses = await Activity.createImpulsesFromRequirements(...)
    await Activity.addImpulses(activity.id, impulses)
  }
  
  // 4. Execute tasks
  const executions = await executeTasks(template, activity, options.variables, options.dryRun)
  
  // 5. Calculate totals and update metrics
  const result = { ... }
  
  // 6. Update template metrics (Thompson Sampling)
  await updateTemplateMetrics(template, result)
  
  return result
}
```

**Missing Instrumentation:**
```typescript
// ❌ SHOULD ADD HERE (after line 86):
// Store activity content at start
await storeActivityContent({
  execution_id: activity.id,
  variant_id: template.variantId,
  activity_id: template.id,
  template_definition: template,
  variable_bindings: options.variables,
  reason: options.reason || "CLI execution",
  initial_state: {
    git_branch: activity.branch,
    git_commit: activity.baseCommit,
    impulse_ids: Object.keys(activity.impulses),
  },
  started_at: new Date().toISOString(),
})
```

### 2. Task Execution Loop

**File:** `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Function:** `executeTasks(template, activity, variables, dryRun, parentSessionID?)`

**Current Flow:**
```typescript
// Line 365-595
async function executeTasks(...): Promise<TaskExecution[]> {
  // 1. Create ONE session for entire activity
  const session = await Session.create({ parentID: parentSessionID, ... })
  
  // 2. Initialize task execution records
  const executions = new Map<string, TaskExecution>()
  
  // 3. Get execution order (topological sort)
  const order = topologicalSort(template.tasks)
  
  // 4. FOR EACH TASK IN ORDER:
  for (const taskId of order) {
    const task = template.tasks.find(t => t.id === taskId)
    const execution = executions.get(taskId)
    
    // Mark as executing
    execution.status = "executing"
    
    // Load impulses for this task
    const impulseSection = await loadAndFormatImpulses(
      task.impulseReferences || [],
      activity.impulses
    )
    
    // Build prompt with variables and impulses
    const prompt = interpolateVariables(task.prompt.template, variables)
    const fullPrompt = prompt + "\n\n" + impulseSection
    
    // Execute task in session
    await Session.sendMessage({
      sessionID: session.id,
      text: fullPrompt,
    })
    
    // Extract metrics from last assistant message
    const { tokens, cost } = await extractMetricsFromSession(session.id)
    
    // Update execution record
    execution.status = "completed"
    execution.tokens = tokens
    execution.cost = cost
    execution.duration = Date.now() - startTime
  }
  
  return Array.from(executions.values())
}
```

**Missing Instrumentation:**
```typescript
// ❌ SHOULD ADD BEFORE TASK EXECUTION (line ~430):
// Record task start with state snapshot
const taskExecutionId = await recordTaskStart({
  task_execution_id: `${activity.id}::${task.id}`,
  execution_id: activity.id,
  task_id: task.id,
  task_index: order.indexOf(taskId),
  task_definition: task,
  state_before: {
    impulse_count: Object.keys(activity.impulses).length,
    loaded_impulse_count: Object.values(activity.impulses).filter(i => i.loaded).length,
  },
  started_at: new Date().toISOString(),
  status: "running",
})

// ❌ SHOULD ADD AFTER TASK EXECUTION (line ~500):
// Update task execution with completion data
await updateTaskExecution(taskExecutionId, {
  execution_id: activity.id,
  task_id: task.id,
  status: execution.status === "completed" ? "success" : "failed",
  success: execution.status === "completed",
  duration_ms: execution.duration,
  tokens_used: execution.tokens,
  cost_usd: execution.cost,
  
  // NEW METRICS FOR CONTEXT LEARNING:
  impulses_loaded: task.impulseReferences?.length || 0,
  impulses_referenced: task.impulseReferences || [],
  total_context_tokens: execution.tokens.input,
  impulse_context_tokens: calculateImpulseTokens(activity.impulses, task.impulseReferences),
  
  completed_at: new Date().toISOString(),
})
```

### 3. Impulse Loading and Context

**File:** `repos/metabob-opencode/packages/opencode/src/session/task-execution-shared.ts`

**Function:** `loadAndFormatImpulses(impulseIds, activityImpulses)`

**Current Flow:**
```typescript
// Line 70-129
async function loadAndFormatImpulses(
  impulseIds: string[],
  activityImpulses: Record<string, ActivityTemplate.Impulse.Schema>
): Promise<string> {
  // Load all impulses in parallel
  const loadedImpulses = await Promise.all(
    impulseIds.map(async (id) => {
      const impulse = activityImpulses[id]
      if (!impulse.loaded) {
        return await ImpulseResolver.load(impulse)
      }
      return impulse
    })
  )
  
  // Update activity impulses in-place
  for (let i = 0; i < impulseIds.length; i++) {
    if (loadedImpulses[i]) {
      activityImpulses[impulseIds[i]] = loadedImpulses[i]
    }
  }
  
  // Format impulse section
  return formatImpulseSection(impulseContentMap)
}
```

**Current Tracking:**
- ✅ Impulses are loaded on-demand
- ✅ Token counts are tracked (`impulse.tokenCount`)
- ✅ Budgets are tracked (`impulse.budget`)
- ❌ Loading events are NOT sent to backend
- ❌ Context ratios are NOT calculated
- ❌ Impulse effectiveness is NOT recorded

**Missing Instrumentation:**
```typescript
// ❌ SHOULD ADD AFTER LOADING:
// Track impulse loading event
await trackImpulseLoading({
  execution_id: activity.id,
  task_id: currentTaskId,
  impulse_ids: impulseIds,
  tokens_loaded: loadedImpulses.reduce((sum, i) => sum + (i.tokenCount || 0), 0),
  timestamp: new Date().toISOString(),
})
```

### 4. Backend API Endpoints (Ready but Unused)

**File:** `repos/metabob-rpc-api/server/routes/activity.py`

**Endpoint 1:** `POST /v2/activities/content` (Line 392-468)

```python
@router.post("/content")
async def store_activity_content(content: Dict[str, Any]) -> Dict[str, str]:
    """
    Store complete activity execution context for replay/learning.
    
    Request Body:
    {
      "execution_id": "exec_abc123_timestamp",
      "variant_id": "template-variant-hash",
      "activity_id": "template-name",
      "template_definition": {...},
      "variable_bindings": {...},
      "reason": "...",
      "initial_state": {
        "git_branch": "main",
        "git_commit": "abc123",
        "impulse_ids": [...],
      },
      "started_at": "2026-02-23T10:30:00Z"
    }
    
    Returns:
    {
      "status": "stored",
      "execution_id": "exec_abc123_timestamp"
    }
    """
    from server.db.operations.activity_content import insert_activity_content
    
    # Validate required fields
    required = ["execution_id", "variant_id", "activity_id", "template_definition", "variable_bindings"]
    
    # Store in SurrealDB
    insert_activity_content(
        execution_id=content["execution_id"],
        variant_id=content["variant_id"],
        template_definition=content["template_definition"],
        variables=content["variable_bindings"],
        reason=content.get("reason", ""),
    )
    
    return {"status": "stored", "execution_id": content["execution_id"]}
```

**Endpoint 2:** `POST /v2/activities/tasks` (Line 471-542)

```python
@router.post("/tasks")
async def record_task_start(task_execution: Dict[str, Any]) -> Dict[str, str]:
    """
    Record task execution start with state snapshot.
    
    Request Body:
    {
      "task_execution_id": "task_exec_abc123",
      "execution_id": "exec_abc123_timestamp",
      "task_id": "task-1",
      "task_index": 0,
      "task_definition": {...},
      "state_before": {
        "impulse_count": 5,
      },
      "started_at": "2026-02-23T10:30:15Z",
      "status": "running"
    }
    """
    from server.db.operations.task_execution import insert_task_execution
    
    # Store in SurrealDB
    insert_task_execution(
        execution_id=task_execution["execution_id"],
        task_id=task_execution["task_id"],
        task_index=task_execution["task_index"],
        subagent=task_execution.get("subagent", "general"),
        prompt=task_execution.get("prompt", ""),
        status=task_execution.get("status", "pending"),
    )
    
    return {"status": "recorded", "task_execution_id": task_execution["task_execution_id"]}
```

**Endpoint 3:** `PATCH /v2/activities/tasks/{task_execution_id}` (Line 545-614)

```python
@router.patch("/tasks/{task_execution_id}")
async def update_task_execution(
    task_execution_id: str,
    update: Dict[str, Any]
) -> Dict[str, str]:
    """
    Update task execution with completion data and state delta.
    
    Request Body:
    {
      "execution_id": "exec_abc123",
      "task_id": "task-1",
      "status": "success" | "failed",
      "success": true,
      "duration_ms": 45000,
      "tokens_used": {...},
      "cost_usd": 0.05,
      "completed_at": "2026-02-23T10:31:00Z"
    }
    """
    from server.db.operations.task_execution import update_task_execution as update_task
    
    # Update in SurrealDB
    update_task(
        execution_id=update["execution_id"],
        task_id=update["task_id"],
        updates=update,
    )
    
    return {"status": "updated", "task_execution_id": task_execution_id}
```

**Status:** ✅ Endpoints exist and work  
**Problem:** ❌ Never called by TypeScript executor

### 5. Database Operations (Ready and Working)

**File:** `repos/metabob-rpc-api/server/db/operations/activity_content.py`

**Function:** `insert_activity_content(execution_id, variant_id, template_definition, variables, reason)`

```python
def insert_activity_content(...) -> Dict[str, Any]:
    """Insert activity content (template + variables + reason)."""
    db = get_surreal_client()
    
    data = {
        "execution_id": execution_id,
        "variant_id": variant_id,
        "template_definition": template_definition,
        "variables": variables,
        "reason": reason,
        "created_at": datetime.utcnow().isoformat(),
    }
    
    result = db.create("activity_content", data)  # ← WRITES TO SURREALDB
    return result
```

**File:** `repos/metabob-rpc-api/server/db/operations/task_execution.py`

**Function:** `insert_task_execution(execution_id, task_id, task_index, subagent, prompt, status)`

```python
def insert_task_execution(...) -> Dict[str, Any]:
    """Insert a new task execution record."""
    db = get_surreal_client()
    
    data = {
        "execution_id": execution_id,
        "task_id": task_id,
        "task_index": task_index,
        "subagent": subagent,
        "prompt": prompt,
        "status": status,
        "success": False,
        "started_at": datetime.utcnow().isoformat(),
        "duration_ms": 0,
        "tokens_input": 0,
        "tokens_output": 0,
        "tokens_cache": 0,
        "cost_usd": 0.0,
        "retry_count": 0,
    }
    
    result = db.create("task_execution", data)  # ← WRITES TO SURREALDB
    return result
```

**Function:** `update_task_execution(execution_id, task_id, updates)`

```python
def update_task_execution(...) -> Dict[str, Any]:
    """Update a task execution record."""
    db = get_surreal_client()
    
    # Find the task
    query = """
        SELECT * FROM task_execution 
        WHERE execution_id = $execution_id AND task_id = $task_id 
        LIMIT 1
    """
    result = db.query(query, {"execution_id": execution_id, "task_id": task_id})
    record_id = result[0][0]["id"]
    
    # Update the record
    updated = db.update(record_id, updates)  # ← UPDATES IN SURREALDB
    return updated
```

**Status:** ✅ All database operations work correctly  
**Problem:** ❌ Never called because API endpoints aren't called

---

## Missing Integration Points

### Integration Point 1: Activity Start Instrumentation

**Location:** `template-executor.ts::execute()` after line 86

**What to add:**
```typescript
// Store activity content in SurrealDB for replay/learning
if (!options.dryRun) {
  await ActivityInstrumentation.storeActivityContent({
    execution_id: activity.id,
    variant_id: template.variantId,
    activity_id: template.id,
    template_definition: template,
    variable_bindings: options.variables,
    reason: options.reason || "Activity execution",
    initial_state: {
      git_branch: activity.branch,
      git_commit: activity.baseCommit,
      modified_files: [],
      impulse_ids: Object.keys(activity.impulses),
    },
    environment: {
      cwd: process.cwd(),
      node_version: process.version,
    },
    started_at: new Date().toISOString(),
  })
}
```

### Integration Point 2: Task Start Instrumentation

**Location:** `template-executor.ts::executeTasks()` before task execution (~line 430)

**What to add:**
```typescript
// Record task start with state snapshot
if (!dryRun) {
  await ActivityInstrumentation.recordTaskStart({
    task_execution_id: `${activity.id}::${task.id}`,
    execution_id: activity.id,
    task_id: task.id,
    task_index: order.indexOf(taskId),
    subagent: task.subagent,
    prompt: fullPrompt,
    state_before: {
      git_diff: await getGitDiff(),
      impulse_count: Object.keys(activity.impulses).length,
      loaded_impulses: Object.values(activity.impulses)
        .filter(i => i.loaded)
        .map(i => i.id),
      file_states: {},
    },
    started_at: new Date().toISOString(),
    status: "running",
  })
}
```

### Integration Point 3: Task Completion Instrumentation

**Location:** `template-executor.ts::executeTasks()` after metrics extraction (~line 500)

**What to add:**
```typescript
// Update task execution with completion data
if (!dryRun) {
  const impulseTokens = calculateImpulseTokens(
    activity.impulses,
    task.impulseReferences || []
  )
  
  await ActivityInstrumentation.updateTaskExecution(`${activity.id}::${task.id}`, {
    execution_id: activity.id,
    task_id: task.id,
    status: execution.status === "completed" ? "success" : "failed",
    success: execution.status === "completed",
    state_after: {
      git_diff: await getGitDiff(),
      impulse_count: Object.keys(activity.impulses).length,
    },
    state_delta: {
      files_created: [],
      files_modified: [],
      git_diff: "",
      impulses_created: [],
    },
    duration_ms: execution.duration,
    tokens_used: execution.tokens,
    cost_usd: execution.cost,
    
    // Context learning metrics
    impulses_loaded: task.impulseReferences?.length || 0,
    impulses_referenced: task.impulseReferences || [],
    total_context_tokens: execution.tokens.input,
    impulse_context_tokens: impulseTokens,
    context_ratio: impulseTokens / execution.tokens.input,
    
    completed_at: new Date().toISOString(),
  })
}
```

### Integration Point 4: Impulse Loading Tracking

**Location:** `task-execution-shared.ts::loadAndFormatImpulses()` after loading (~line 100)

**What to add:**
```typescript
// Track impulse loading event for context learning
if (currentTaskId && currentActivityId) {
  await ActivityInstrumentation.trackImpulseLoading({
    execution_id: currentActivityId,
    task_id: currentTaskId,
    impulse_ids: impulseIds,
    impulses_loaded: loadedImpulses.filter(i => i !== null).map(i => ({
      id: i.id,
      type: i.pointer.type,
      tokens: i.tokenCount || 0,
      budget: i.budget,
    })),
    total_tokens_loaded: loadedImpulses.reduce((sum, i) => sum + (i?.tokenCount || 0), 0),
    timestamp: new Date().toISOString(),
  })
}
```

---

## Required New Module: ActivityInstrumentation

**File to create:** `repos/metabob-opencode/packages/opencode/src/session/activity-instrumentation.ts`

```typescript
import { Config } from "../config/config"

/**
 * Activity Execution Instrumentation (Phase 2)
 * 
 * Sends execution data to backend API for learning loop:
 * - Activity content (template + variables)
 * - Task execution records (start/complete)
 * - Impulse loading events
 * - Context learning metrics
 */
export namespace ActivityInstrumentation {
  const API_BASE = Config.metabob?.apiUrl || "http://localhost:8081"
  
  export async function storeActivityContent(data: {
    execution_id: string
    variant_id: string
    activity_id: string
    template_definition: any
    variable_bindings: Record<string, unknown>
    reason: string
    initial_state: any
    environment?: any
    started_at: string
  }): Promise<void> {
    const url = `${API_BASE}/v2/activities/content`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to store activity content: ${response.statusText}`)
    }
  }
  
  export async function recordTaskStart(data: {
    task_execution_id: string
    execution_id: string
    task_id: string
    task_index: number
    subagent: string
    prompt: string
    state_before: any
    started_at: string
    status: string
  }): Promise<void> {
    const url = `${API_BASE}/v2/activities/tasks`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to record task start: ${response.statusText}`)
    }
  }
  
  export async function updateTaskExecution(
    task_execution_id: string,
    data: {
      execution_id: string
      task_id: string
      status: string
      success: boolean
      state_after?: any
      state_delta?: any
      duration_ms: number
      tokens_used: { input: number; output: number; cache: number }
      cost_usd: number
      impulses_loaded?: number
      impulses_referenced?: string[]
      total_context_tokens?: number
      impulse_context_tokens?: number
      context_ratio?: number
      completed_at: string
    }
  ): Promise<void> {
    const url = `${API_BASE}/v2/activities/tasks/${task_execution_id}`
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to update task execution: ${response.statusText}`)
    }
  }
  
  export async function trackImpulseLoading(data: {
    execution_id: string
    task_id: string
    impulse_ids: string[]
    impulses_loaded: Array<{
      id: string
      type: string
      tokens: number
      budget: number
    }>
    total_tokens_loaded: number
    timestamp: string
  }): Promise<void> {
    // For now, this can be a no-op or log to console
    // In future, may want separate endpoint for impulse events
    console.log("[ActivityInstrumentation] Impulse loading:", data)
  }
}
```

---

## Context Learning Metrics to Capture

### 1. Context Ratio

**Definition:** `impulse_context_tokens / total_context_tokens`

**Purpose:** Measure what fraction of task context comes from impulses vs other sources

**Calculation:**
```typescript
function calculateImpulseTokens(
  impulses: Record<string, ActivityTemplate.Impulse.Schema>,
  referencedIds: string[]
): number {
  return referencedIds.reduce((sum, id) => {
    const impulse = impulses[id]
    return sum + (impulse?.tokenCount || 0)
  }, 0)
}

const impulseTokens = calculateImpulseTokens(activity.impulses, task.impulseReferences || [])
const contextRatio = impulseTokens / execution.tokens.input
```

### 2. Impulse Effectiveness

**Metrics to track:**
- `impulses_loaded`: Number of impulses loaded for task
- `impulses_referenced`: Array of impulse IDs referenced
- `impulse_context_tokens`: Total tokens from impulses
- `context_ratio`: Fraction of context from impulses

**Future analysis:**
- Correlate context_ratio with task success
- Identify optimal context ratios per task type
- Detect over-contexting (too many impulses → confusion)
- Detect under-contexting (too few impulses → missing info)

### 3. Budget Utilization

**Metrics to track:**
- `total_budget`: Sum of all impulse budgets
- `used_tokens`: Sum of loaded impulse tokens
- `budget_utilization`: `used_tokens / total_budget`
- `peak_utilization`: Highest utilization during activity

**Current tracking location:** `template-executor.ts::checkBudgetPressure()`

### 4. Memory Optimization Events

**Metrics to track:**
- `optimizations`: Number of optimization passes
- `impulses_unloaded`: Total impulses unloaded
- `tokens_freed`: Total tokens freed by unloading

**Current tracking location:** `template-executor.ts::optimizeImpulsesForNextTask()`

---

## Implementation Plan

### Phase 1: Create Instrumentation Module ✅
- Create `activity-instrumentation.ts`
- Implement API client functions
- Add error handling and logging

### Phase 2: Instrument Activity Start ✅
- Add `storeActivityContent()` call in `execute()`
- Capture initial state (git, impulses)
- Test with simple activity

### Phase 3: Instrument Task Execution ✅
- Add `recordTaskStart()` before task execution
- Add `updateTaskExecution()` after task completion
- Capture context learning metrics

### Phase 4: Track Impulse Loading ✅
- Add tracking in `loadAndFormatImpulses()`
- Capture impulse metadata
- Calculate context ratios

### Phase 5: Verify Data Flow 🔄
- Run test activity
- Verify data in SurrealDB
- Check `activity_content` table
- Check `task_execution` table

### Phase 6: Build Analysis Tools 📋
- Query execution history
- Calculate context effectiveness
- Identify optimization opportunities

---

## Next Steps

1. **Create activity template** to implement this instrumentation
2. **Design template tasks** for each integration point
3. **Test incrementally** after each integration point
4. **Verify data flow** end-to-end
5. **Build analysis queries** to validate metrics

---

## Conclusion

**Phase 2 instrumentation is architecturally sound but not yet connected.**

The missing link is the TypeScript → Backend API integration. Once we add instrumentation calls in the executor, we'll have:

1. ✅ Complete execution history in SurrealDB
2. ✅ Context learning metrics (impulse effectiveness)
3. ✅ Replay capability (full state capture)
4. ✅ Learning loop (template optimization)

**This is the foundation for impulse-driven context learning.**
