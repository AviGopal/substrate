# Activity Composition and Control Flow

## Overview

MiniBob activities can compose - one activity can call another via the `activity` tool. Understanding how composition works, how to observe it, how to prevent loops, and how to extend sequences is critical to building complex autonomous systems.

## Current Composition Implementation

### How Activities Call Each Other

When an LLM executing an activity decides to delegate work, it calls the `activity` tool:

```typescript
// Inside a task's LLM execution
LLM decides: "I need to analyze the codebase first"
→ Calls activity tool with params:
  {
    templateId: "explore-codebase",
    variables: { path: "./src" },
    reason: "Need to understand structure before modifying"
  }
```

### The Composition Mechanism

```typescript
// In tool handler: onActivityExecute (src/activity.ts:299-366)
async (templateId, variables, reason) => {
  // 1. Load child template
  const template = await loadTemplateFromMCPOrLocal(templateId)

  // 2. Create ISOLATED executor
  const isolatedConfig: ExecutorConfig = {
    workingDirectory: config.workingDirectory,
    model: config.model,
    provider: config.provider,
    apiKey: config.apiKey,
    // NO parent context
    customTools: {},  // Don't inherit parent's accumulated state
    // Track nesting depth
    maxNestingDepth: (config.maxNestingDepth ?? 3) - 1,
  }

  // 3. Check nesting depth (prevents deep recursion)
  if ((config.maxNestingDepth ?? 3) <= 0) {
    return {
      error: "Maximum nesting depth reached",
      status: "failed"
    }
  }

  // 4. Execute child activity
  const nestedExecutor = new ActivityExecutor(isolatedConfig)
  const result = await nestedExecutor.execute({
    template,
    variables,
    parentActivityId: this.currentActivityId,
    parentExecutionId: this.currentExecutionId,
    goalContext: reason?.substring(0, 200)  // Brief summary only
  })

  // 5. Record composition in backend
  if (isMCPEnabled()) {
    await mcp.recordComposition({
      parentActivityId: this.currentActivityId,
      childActivityId: template.id,
      executionId: this.currentExecutionId,
      goalContext: reason,
      success: result.status === "completed"
    })
  }

  // 6. Return SUMMARY only (not full trace)
  return {
    id: result.id,
    status: result.status,
    summary: result.status === "completed"
      ? `Activity completed successfully`
      : `Activity failed: ${result.error?.substring(0, 200)}`
  }
}
```

### Key Design Decisions

1. **Context Isolation**: Child activities start fresh, don't inherit parent's accumulated context
2. **Depth Limiting**: Default max depth = 3 levels
3. **Summary Return**: Only success/failure and brief summary returned, not full execution trace
4. **Composition Recording**: Backend learns which activities work well together

## Observing Composition

### What Gets Recorded

Every time activity A calls activity B, a composition record is created:

```typescript
{
  parent_activity_id: "analyze-and-fix",
  child_activity_id: "explore-codebase",
  execution_id: "act_1234567890_abc123",
  goal_context: "Need to understand structure before modifying",
  success: true,
  timestamp: "2025-03-23T10:00:00.000Z"
}
```

### Backend Storage (Composition Graph)

The backend stores this as a **weighted directed graph**:

```
Node: Activity Template ID
Edge: Parent → Child with weight = success_count / total_count

Example:
analyze-and-fix → explore-codebase (weight: 0.85, 17/20 successes)
analyze-and-fix → improvise-goal (weight: 0.60, 6/10 successes)
explore-codebase → read-file (weight: 0.95, 19/20 successes)
```

### Querying the Composition Graph

```bash
# Get composition graph from backend
curl "http://api.minibob.local/v2/activities/composition/graph?limit=50" | jq .
```

**Response**:
```json
{
  "nodes": [
    {
      "activity_id": "analyze-and-fix",
      "times_called": 45,
      "times_succeeded": 38,
      "success_rate": 0.844
    },
    {
      "activity_id": "explore-codebase",
      "times_called": 120,
      "times_succeeded": 114,
      "success_rate": 0.95
    }
  ],
  "edges": [
    {
      "from": "analyze-and-fix",
      "to": "explore-codebase",
      "weight": 0.85,
      "times_composed": 20,
      "times_succeeded": 17
    }
  ]
}
```

### Visualizing Composition

You can visualize the composition graph to see:
- Which activities commonly call which other activities
- Which compositions succeed most often
- Which activities are "hubs" (called by many others)
- Which activities are "leaves" (don't call others)

**Example visualization** (using Graphviz or similar):
```
┌─────────────────┐
│  process-goal   │
│  (entry point)  │
└────────┬────────┘
         │
         ├──→ explore-codebase (85% success)
         │    └──→ read-file (95% success)
         │
         ├──→ improvise-goal (60% success)
         │    └──→ extract-template (70% success)
         │
         └──→ search-and-execute (75% success)
              ├──→ explore-codebase (90% success)
              └──→ improvise-goal (55% success)
```

## Loop Prevention

### Current Mechanism: Depth Limiting

The current implementation prevents **deep recursion** but NOT **cycles**:

```typescript
maxNestingDepth: 3  // Default

// Prevents:
A → B → C → D → ... (too deep)

// Does NOT prevent:
A → B → A (simple cycle)
A → B → C → A (longer cycle)
```

### Problem: Cycles Are Possible

```
Activity: "improvise-and-learn"
  Task 1: Use activity tool: improvise-goal
    → improvise-goal calls activity tool: improvise-and-learn
      → LOOP!
```

With depth=3, this would execute 3 times before hitting the limit:
```
improvise-and-learn (depth=3)
  → improvise-goal (depth=2)
    → improvise-and-learn (depth=1)
      → improvise-goal (depth=0)
        → BLOCKED: "Maximum nesting depth reached"
```

But this wastes 3 executions before detection!

### Solution: Call Stack Tracking

**Add activity call stack to ExecutorConfig**:

```typescript
export interface ExecutorConfig {
  // ... existing fields

  /**
   * Activity call stack for cycle detection.
   * Tracks the chain of activity IDs leading to current execution.
   */
  activityCallStack?: string[]
}
```

**Check for cycles before execution**:

```typescript
async (templateId, variables, reason) => {
  // Get current call stack
  const callStack = config.activityCallStack ?? []

  // Check if this activity is already in the call stack (cycle detected)
  if (callStack.includes(templateId)) {
    console.warn(`[Composition] Cycle detected: ${callStack.join(' → ')} → ${templateId}`)
    return {
      status: "failed",
      error: `Cycle detected: Activity ${templateId} called recursively`,
      callStack: [...callStack, templateId]
    }
  }

  // Check depth limit
  if (callStack.length >= (config.maxNestingDepth ?? 3)) {
    return {
      status: "failed",
      error: "Maximum nesting depth reached"
    }
  }

  // Create isolated config with updated call stack
  const isolatedConfig: ExecutorConfig = {
    // ... other fields
    activityCallStack: [...callStack, templateId],
    maxNestingDepth: (config.maxNestingDepth ?? 3) - callStack.length
  }

  // Execute child
  const result = await nestedExecutor.execute({ ... })

  // ... return result
}
```

**Benefits**:
- ✅ Detects cycles immediately (not after 3 iterations)
- ✅ Provides clear error message with full call stack
- ✅ Backend can learn about problematic cycles
- ✅ Can be used to warn (not block) for known-safe cycles

### Cycle Detection Visualization

```bash
# Query backend for detected cycles
curl "http://api.minibob.local/v2/activities/composition/cycles" | jq .
```

**Response**:
```json
{
  "cycles": [
    {
      "cycle": ["improvise-and-learn", "improvise-goal", "improvise-and-learn"],
      "times_detected": 5,
      "last_detected": "2025-03-23T10:30:00.000Z"
    },
    {
      "cycle": ["A", "B", "C", "A"],
      "times_detected": 2,
      "last_detected": "2025-03-23T09:15:00.000Z"
    }
  ]
}
```

## Extending Sequences

### Pattern 1: Sequential Tasks Within One Activity

**Use case**: Multiple steps that MUST happen in order

```json
{
  "id": "deploy-application",
  "tasks": [
    {
      "id": "build",
      "description": "Build the application",
      "dependencies": []
    },
    {
      "id": "test",
      "description": "Run tests",
      "dependencies": ["build"]
    },
    {
      "id": "deploy",
      "description": "Deploy to production",
      "dependencies": ["test"]
    }
  ]
}
```

**Control flow**: VM automatically orders by dependencies

```
execute(deploy-application)
  ↓
topologicalSort(tasks)
  → [build, test, deploy]
  ↓
execute build
  ↓
execute test (only if build succeeded)
  ↓
execute deploy (only if test succeeded)
```

### Pattern 2: Activity Composition via LLM Decision

**Use case**: Steps determined dynamically based on context

```json
{
  "id": "analyze-and-fix",
  "tasks": [
    {
      "id": "decide-approach",
      "description": "Analyze problem and decide which activities to use",
      "prompt": {
        "template": "Problem: {{problem}}\n\nAnalyze and decide:\n1. Do we need to explore the codebase first?\n2. Do we need to diagnose the issue?\n3. Can we improvise a fix or use existing template?\n\nCall appropriate activities using the activity tool."
      }
    }
  ]
}
```

**Control flow**: LLM decides which activities to call

```
execute(analyze-and-fix)
  ↓
LLM analyzes problem
  ↓
LLM decides: "Need to explore first"
  ↓
LLM calls: activity(explore-codebase)
  → Child executes
  → Returns summary
  ↓
LLM sees result, decides: "Now I can improvise"
  ↓
LLM calls: activity(improvise-goal)
  → Child executes
  → Returns summary
  ↓
Task completes
```

### Pattern 3: Chaining via Output Impulses

**Use case**: Pass data from one activity to the next

```json
{
  "id": "pipeline",
  "tasks": [
    {
      "id": "analyze",
      "outputImpulses": ["analysis-result"]
    },
    {
      "id": "generate",
      "impulseReferences": ["analysis-result"],
      "dependencies": ["analyze"]
    },
    {
      "id": "validate",
      "impulseReferences": ["analysis-result"],
      "dependencies": ["generate"]
    }
  ]
}
```

**Data flow**:
```
analyze → creates impulse "analysis-result"
  ↓
generate → loads impulse "analysis-result"
  ↓
validate → loads impulse "analysis-result"
```

### Pattern 4: Parallel Composition (Future)

**Use case**: Multiple independent activities that can run concurrently

```json
{
  "id": "comprehensive-analysis",
  "tasks": [
    {
      "id": "parallel-analyses",
      "description": "Run multiple analyses in parallel",
      "prompt": {
        "template": "Run these activities in parallel:\n1. activity(check-security)\n2. activity(check-performance)\n3. activity(check-style)\n\nWait for all to complete."
      }
    },
    {
      "id": "aggregate",
      "description": "Aggregate results from all analyses",
      "dependencies": ["parallel-analyses"]
    }
  ]
}
```

**Note**: Current implementation is sequential. Parallel execution would require:
- Multiple ActivityExecutor instances
- Coordination mechanism
- Concurrent LLM calls (careful with rate limits)

## Multiple Activities Coordination

### Scenario: Complex Workflow

```
Goal: "Add authentication to the application"

Workflow:
1. explore-codebase
   → Understand current structure
2. search-activities
   → Find if auth template exists
3. IF template exists:
   → Use existing template
   ELSE:
   → improvise-goal
   → extract-template
4. test-changes
5. create-pr
```

### Implementation Strategy

**Option 1: Single Orchestrator Activity**

```json
{
  "id": "add-feature-workflow",
  "tasks": [
    {
      "id": "orchestrate",
      "prompt": {
        "template": "Goal: {{goal}}\n\nFollow this workflow:\n1. Use activity(explore-codebase)\n2. Use activity(search-activities)\n3. Based on results, either:\n   - Use existing template\n   - Call activity(improvise-goal)\n4. Use activity(test-changes)\n5. Use activity(create-pr)\n\nExecute each step and adapt based on results."
      }
    }
  ]
}
```

**Pros**:
- ✅ Single point of control
- ✅ LLM can adapt workflow dynamically
- ✅ Easy to modify workflow (edit one task)

**Cons**:
- ❌ Long-running single task
- ❌ All in LLM context (token accumulation)
- ❌ Harder to restart from middle if fails

**Option 2: Multi-Task Sequential**

```json
{
  "id": "add-feature-workflow",
  "tasks": [
    {
      "id": "explore",
      "prompt": {
        "template": "Use activity(explore-codebase) with path={{path}}"
      },
      "outputImpulses": ["codebase-structure"]
    },
    {
      "id": "search",
      "prompt": {
        "template": "Use activity(search-activities) for {{goal}}"
      },
      "outputImpulses": ["search-results"],
      "dependencies": ["explore"]
    },
    {
      "id": "implement",
      "impulseReferences": ["codebase-structure", "search-results"],
      "prompt": {
        "template": "Based on search results, either use existing template or improvise"
      },
      "dependencies": ["search"]
    },
    {
      "id": "test",
      "prompt": {
        "template": "Use activity(test-changes)"
      },
      "dependencies": ["implement"]
    },
    {
      "id": "pr",
      "prompt": {
        "template": "Use activity(create-pr)"
      },
      "dependencies": ["test"]
    }
  ]
}
```

**Pros**:
- ✅ Clear stages
- ✅ Can restart from any task
- ✅ Each task has fresh LLM context
- ✅ Easy to add validation between steps

**Cons**:
- ❌ Less flexible (fixed sequence)
- ❌ More complex activity definition

**Recommendation**: Start with Option 2 (structured), allow Option 1 (flexible) for complex cases

## The Hooks System

### What Are Hooks?

Hooks are **callbacks** that fire at specific points in the activity lifecycle. They allow:
- Observation of execution
- Custom behavior injection
- Integration with external systems
- Debugging and logging

### Available Hooks

#### 1. ExecutorConfig Hooks (VM-level)

```typescript
interface ExecutorConfig {
  // When child activity is called from activity tool
  onActivityExecute?: (
    templateId: string,
    variables: Record<string, unknown>,
    reason?: string
  ) => Promise<ActivityExecution>

  // When LLM wants to search for activities
  onSearchActivities?: (
    category?: string,
    verbose?: boolean
  ) => Promise<{ count: number; activities: unknown[] }>

  // When LLM wants to create a new activity (trailblazing)
  onCreateActivity?: (params: {
    goalDescription: string
    templateName: string
    category: string
    variables: Record<string, unknown>
  }) => Promise<{ templateId: string }>
}
```

**When they fire**:
- `onActivityExecute`: When LLM calls `activity` tool
- `onSearchActivities`: When LLM calls `search_activities` tool
- `onCreateActivity`: When LLM calls `create_activity_goal_seeking` tool

**Example use**:
```typescript
const executor = new ActivityExecutor({
  // ... config
  onActivityExecute: async (templateId, variables, reason) => {
    console.log(`🔄 Delegating to: ${templateId}`)
    console.log(`   Reason: ${reason}`)
    // Custom logic here
    return await defaultActivityExecute(templateId, variables, reason)
  }
})
```

#### 2. ExecuteOptions Hooks (Execution-level)

```typescript
interface ExecuteOptions {
  // Before each task starts
  onTaskStart?: (taskId: string) => void

  // After each task completes
  onTaskComplete?: (taskId: string, result: TaskResult) => void
}
```

**When they fire**:
- `onTaskStart`: Right before VM executes a task
- `onTaskComplete`: Right after task completes (success or failure)

**Example use**:
```typescript
await executor.execute({
  template,
  variables,
  onTaskStart: (taskId) => {
    console.log(`▶️  Starting task: ${taskId}`)
    progressBar.update(taskId)
  },
  onTaskComplete: (taskId, result) => {
    console.log(`${result.status === 'completed' ? '✅' : '❌'} Completed: ${taskId}`)
    progressBar.complete(taskId)
  }
})
```

### Hook Use Cases

#### Use Case 1: Progress Tracking

```typescript
const totalTasks = template.tasks.length
let completed = 0

await executor.execute({
  template,
  variables,
  onTaskStart: (taskId) => {
    console.log(`[${completed}/${totalTasks}] Starting: ${taskId}`)
  },
  onTaskComplete: (taskId, result) => {
    completed++
    console.log(`[${completed}/${totalTasks}] ${result.status === 'completed' ? '✅' : '❌'} ${taskId}`)
  }
})
```

#### Use Case 2: Real-Time Dashboard Updates

```typescript
await executor.execute({
  template,
  variables,
  onTaskStart: (taskId) => {
    websocket.send({ type: 'task_start', taskId, timestamp: Date.now() })
  },
  onTaskComplete: (taskId, result) => {
    websocket.send({
      type: 'task_complete',
      taskId,
      status: result.status,
      duration: result.duration,
      timestamp: Date.now()
    })
  }
})
```

#### Use Case 3: Composition Tracking

```typescript
const compositionStack: string[] = []

const executor = new ActivityExecutor({
  // ... config
  onActivityExecute: async (templateId, variables, reason) => {
    compositionStack.push(templateId)
    console.log(`📊 Call stack: ${compositionStack.join(' → ')}`)

    const result = await defaultExecute(templateId, variables, reason)

    compositionStack.pop()
    return result
  }
})
```

#### Use Case 4: Metrics Collection

```typescript
const metrics = {
  tasksStarted: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  totalDuration: 0
}

await executor.execute({
  template,
  variables,
  onTaskStart: () => {
    metrics.tasksStarted++
  },
  onTaskComplete: (taskId, result) => {
    if (result.status === 'completed') {
      metrics.tasksCompleted++
    } else {
      metrics.tasksFailed++
    }
    metrics.totalDuration += result.duration ?? 0
  }
})

console.log('Execution metrics:', metrics)
```

### Why Hooks Are Valuable

1. **Observability**: See what's happening during execution without modifying VM code
2. **Integration**: Connect MiniBob to external systems (dashboards, monitoring, etc.)
3. **Customization**: Add behavior without changing core VM
4. **Testing**: Inject test doubles or mock implementations
5. **Debugging**: Trace execution flow and composition
6. **Metrics**: Collect performance data
7. **Extensibility**: Add new capabilities without forking

### Future Hooks (Potential)

```typescript
interface ExecutorConfig {
  // Lifecycle hooks
  onExecutionStart?: (execution: ActivityExecution) => void
  onExecutionComplete?: (execution: ActivityExecution) => void
  onExecutionFail?: (execution: ActivityExecution, error: Error) => void

  // Impulse hooks
  onImpulseLoad?: (impulseId: string) => void
  onImpulseCreate?: (impulse: Impulse) => void

  // Tool hooks
  onToolCall?: (toolName: string, params: any) => void
  onToolComplete?: (toolName: string, result: ToolResult) => void

  // Composition hooks
  onCompositionStart?: (parentId: string, childId: string) => void
  onCompositionComplete?: (parentId: string, childId: string, success: boolean) => void
  onCycleDetected?: (callStack: string[]) => void
}
```

## Practical Example: Observable Composition

Let's build a complete example showing composition with hooks:

```typescript
// Track the full composition graph
const compositionGraph: { parent: string; child: string; success: boolean }[] = []
const callStack: string[] = []

const executor = new ActivityExecutor({
  workingDirectory: process.cwd(),
  model: "claude-sonnet-4-20250514",
  provider: "anthropic",
  apiKey: process.env.ANTHROPIC_API_KEY,

  // Hook: Track composition
  onActivityExecute: async (templateId, variables, reason) => {
    const parent = callStack[callStack.length - 1] || 'ROOT'

    // Check for cycles
    if (callStack.includes(templateId)) {
      console.error(`❌ CYCLE DETECTED: ${callStack.join(' → ')} → ${templateId}`)
      throw new Error(`Cycle detected: ${templateId}`)
    }

    // Check depth
    if (callStack.length >= 3) {
      console.error(`❌ MAX DEPTH: ${callStack.join(' → ')} → ${templateId}`)
      throw new Error(`Max depth exceeded`)
    }

    console.log(`🔄 ${parent} → ${templateId}`)
    console.log(`   Reason: ${reason}`)
    console.log(`   Depth: ${callStack.length + 1}`)

    callStack.push(templateId)

    try {
      const result = await defaultActivityExecute(templateId, variables, reason)

      compositionGraph.push({
        parent,
        child: templateId,
        success: result.status === 'completed'
      })

      console.log(`✅ ${templateId} completed`)
      return result
    } catch (error) {
      compositionGraph.push({
        parent,
        child: templateId,
        success: false
      })
      console.log(`❌ ${templateId} failed`)
      throw error
    } finally {
      callStack.pop()
    }
  }
})

// Execute with task hooks
await executor.execute({
  template,
  variables: { goal: "Add authentication" },
  onTaskStart: (taskId) => {
    console.log(`  ▶️  Task: ${taskId}`)
  },
  onTaskComplete: (taskId, result) => {
    console.log(`  ${result.status === 'completed' ? '✅' : '❌'} Task: ${taskId}`)
  }
})

// Print composition graph
console.log('\n📊 Composition Graph:')
compositionGraph.forEach(({ parent, child, success }) => {
  console.log(`  ${parent} → ${child} [${success ? 'SUCCESS' : 'FAILED'}]`)
})
```

**Output**:
```
🔄 ROOT → add-feature-workflow
   Reason: Add authentication
   Depth: 1
  ▶️  Task: orchestrate

  🔄 add-feature-workflow → explore-codebase
     Reason: Need to understand current structure
     Depth: 2
    ▶️  Task: explore
    ✅ Task: explore
  ✅ explore-codebase completed

  🔄 add-feature-workflow → search-activities
     Reason: Find existing auth templates
     Depth: 2
    ▶️  Task: search
    ✅ Task: search
  ✅ search-activities completed

  🔄 add-feature-workflow → improvise-goal
     Reason: No existing template, improvising
     Depth: 2
    ▶️  Task: improvise
    ✅ Task: improvise
  ✅ improvise-goal completed

  ✅ Task: orchestrate
✅ add-feature-workflow completed

📊 Composition Graph:
  ROOT → add-feature-workflow [SUCCESS]
  add-feature-workflow → explore-codebase [SUCCESS]
  add-feature-workflow → search-activities [SUCCESS]
  add-feature-workflow → improvise-goal [SUCCESS]
```

## Summary

### Composition Observation
- ✅ Backend records every composition
- ✅ Composition graph queryable via API
- ✅ Success rates tracked
- ✅ Can visualize which activities call which

### Loop Prevention
- ⚠️ Current: Depth limiting only (blocks deep recursion)
- ❌ Missing: Cycle detection (A→B→A still possible)
- ✅ Solution: Add call stack tracking

### Extending Sequences
- ✅ Pattern 1: Sequential tasks with dependencies
- ✅ Pattern 2: Dynamic composition via LLM
- ✅ Pattern 3: Data passing via impulses
- 🔄 Pattern 4: Parallel composition (future)

### Multiple Activities
- ✅ Orchestrator pattern for complex workflows
- ✅ Composition hooks for tracking
- ✅ Context isolation prevents interference

### Hooks System
- ✅ VM-level hooks: onActivityExecute, onSearchActivities, onCreateActivity
- ✅ Execution-level hooks: onTaskStart, onTaskComplete
- ✅ Use cases: Progress tracking, dashboards, metrics, debugging
- 🔄 Future: More lifecycle hooks (impulses, tools, composition)

**The hooks system is valuable because**: It provides observability and extensibility without modifying the VM core. You can add custom behavior, integrate external systems, and debug complex composition graphs - all through callbacks, not code changes.

## Next Steps

1. **Implement cycle detection**: Add call stack tracking to prevent A→B→A loops
2. **Build composition visualizer**: Dashboard showing real-time composition graph
3. **Create composition templates**: Standard patterns for common workflows
4. **Document hook best practices**: Guide for using hooks effectively
5. **Add more hooks**: Impulse, tool, and detailed lifecycle hooks
