# React-Renderer: Practical Example

## Scenario: Displaying Live Activity Execution

Let's walk through how MiniBob, Terminal, and React-Renderer work together to display a live activity execution.

## The Flow

```
User clicks "Fix Bug" in UI
         ↓
React-Renderer creates ui_event impulse
         ↓
Activity: handle-user-interaction
         ↓
Triggers MiniBob activity: fix-bug
         ↓
MiniBob creates execution trace impulses
         ↓
React-Renderer receives notifications
         ↓
Activity: update-from-execution-trace
         ↓
UI updates in real-time
```

## Implementation

### 1. User Interaction (Browser)

```typescript
// repos/react-renderer/src/components/BugCard.tsx
import { useActivity } from '../hooks/useActivity'

function BugCard({ bug }: { bug: Bug }) {
  const { executeActivity } = useActivity()

  const handleFix = async () => {
    // Create UI event impulse
    const eventImpulse = {
      id: `event-fix-${bug.id}`,
      pointer: {
        type: "ui_event",
        event: "bug.fix",
        payload: { bugId: bug.id }
      },
      budget: 500,
      priority: "high"
    }

    // Execute interaction handler activity
    await executeActivity("handle-user-interaction", {
      impulses: [eventImpulse]
    })
  }

  return (
    <div className="bug-card">
      <h3>{bug.title}</h3>
      <p>{bug.description}</p>
      <button onClick={handleFix}>Fix Bug</button>
    </div>
  )
}
```

### 2. React-Renderer Processes Event

```typescript
// repos/react-renderer/src/activities/interact.ts
import { executeActivity as executeMiniBobActivity } from '../integrations/minibob'

export async function handleUserInteraction(
  impulses: Impulse[]
): Promise<ActivityResult> {
  const eventImpulse = impulses[0]
  const event = await resolveImpulse(eventImpulse)

  // Map UI event to MiniBob activity
  const activityMap = {
    "bug.fix": "fix-bug",
    "task.retry": "retry-task",
    "code.refactor": "refactor-code"
  }

  const activityId = activityMap[event.content.event]

  // Create impulses for MiniBob
  const bugImpulse = {
    id: `bug-${event.content.payload.bugId}`,
    pointer: {
      type: "bug_report",
      bugId: event.content.payload.bugId
    },
    budget: 3000,
    priority: "high"
  }

  // Trigger MiniBob activity execution
  const execution = await executeMiniBobActivity(activityId, {
    impulses: [bugImpulse]
  })

  // Create UI impulse to display execution
  const executionUIImpulse = {
    id: `ui-exec-${execution.id}`,
    pointer: {
      type: "ui_component",
      component: "ExecutionViewer",
      props: { executionId: execution.id }
    },
    budget: 5000,
    priority: "high"
  }

  // Trigger render activity
  await executeActivity("render-impulse-collection", {
    impulses: [executionUIImpulse]
  })

  return {
    status: "success",
    outputs: [executionUIImpulse]
  }
}
```

### 3. MiniBob Executes Activity

```typescript
// In MiniBob (repos/minibob/src/activity.ts)
export async function executeActivity(
  templateId: string,
  options: { impulses: Impulse[] }
): Promise<Execution> {
  const execution = {
    id: nanoid(),
    activityId: templateId,
    status: "in_progress",
    tasks: [],
    impulses: options.impulses
  }

  // As activity progresses, create status impulses
  for (const task of template.tasks) {
    // Before task starts
    const taskStartImpulse = createImpulse({
      pointer: {
        type: "ui_component",
        component: "TaskStatus",
        props: {
          executionId: execution.id,
          taskId: task.id,
          status: "starting"
        }
      }
    })

    // Notify react-renderer
    await fetch("http://react-renderer:3000/impulses/notify", {
      method: "POST",
      body: JSON.stringify({ impulseId: taskStartImpulse.id })
    })

    // Execute task
    const result = await executeTask(task, execution)

    // After task completes
    const taskCompleteImpulse = createImpulse({
      pointer: {
        type: "ui_component",
        component: "TaskStatus",
        props: {
          executionId: execution.id,
          taskId: task.id,
          status: result.success ? "success" : "failure",
          output: result.output
        }
      }
    })

    await fetch("http://react-renderer:3000/impulses/notify", {
      method: "POST",
      body: JSON.stringify({ impulseId: taskCompleteImpulse.id })
    })

    execution.tasks.push(result)
  }

  // Terminal output as impulse
  if (execution.terminalOutput) {
    const terminalImpulse = createImpulse({
      pointer: {
        type: "terminal_snapshot",
        terminalId: execution.terminalId,
        includeScrollback: true
      }
    })

    await fetch("http://react-renderer:3000/impulses/notify", {
      method: "POST",
      body: JSON.stringify({ impulseId: terminalImpulse.id })
    })
  }

  return execution
}
```

### 4. React-Renderer Receives Updates

```typescript
// repos/react-renderer/src/index.ts
import { Hono } from 'hono'
import { executeActivity } from './activities'

const app = new Hono()

// Impulse notification endpoint
app.post("/impulses/notify", async (c) => {
  const { impulseId } = await c.req.json()

  // Execute update activity (non-blocking)
  executeActivity("update-from-execution-trace", {
    impulses: [impulseId]
  }).catch(err => {
    console.error("Failed to update UI:", err)
  })

  return c.json({ status: "queued" })
})

// Real-time updates via SSE
app.get("/events", (c) => {
  return streamSSE(c, async (stream) => {
    const subscription = impulseStore.subscribe((impulse) => {
      stream.writeSSE({
        data: JSON.stringify({
          type: "impulse_updated",
          impulse
        }),
        event: "impulse"
      })
    })

    // Clean up on disconnect
    c.req.raw.signal.addEventListener("abort", () => {
      subscription.unsubscribe()
    })
  })
})

export default app
```

### 5. Browser Receives Updates

```typescript
// repos/react-renderer/src/hooks/useExecutionStatus.ts
import { useEffect, useState } from 'react'

export function useExecutionStatus(executionId: string) {
  const [status, setStatus] = useState<ExecutionStatus | null>(null)

  useEffect(() => {
    // Subscribe to execution updates via SSE
    const eventSource = new EventSource("/events")

    eventSource.addEventListener("impulse", (event) => {
      const { impulse } = JSON.parse(event.data)

      // Check if this impulse is related to our execution
      if (
        impulse.pointer.type === "ui_component" &&
        impulse.pointer.props?.executionId === executionId
      ) {
        // Resolve impulse and update status
        fetch("/impulses/resolve", {
          method: "POST",
          body: JSON.stringify({ impulseId: impulse.id })
        })
          .then(res => res.json())
          .then(data => setStatus(data.content))
      }
    })

    return () => eventSource.close()
  }, [executionId])

  return status
}
```

### 6. React Component Renders

```typescript
// repos/react-renderer/src/components/ExecutionViewer.tsx
import { useExecutionStatus } from '../hooks/useExecutionStatus'
import { useImpulse } from '../hooks/useImpulse'
import { TerminalViewer } from './TerminalViewer'

function ExecutionViewer({ executionId }: { executionId: string }) {
  const status = useExecutionStatus(executionId)

  // Resolve execution trace impulse
  const trace = useImpulse({
    type: "activityExecutionTrace",
    executionId
  })

  // Resolve terminal output impulse
  const terminal = useImpulse({
    type: "terminal_snapshot",
    terminalId: trace?.terminalId
  })

  if (!status || !trace) {
    return <div>Loading execution...</div>
  }

  return (
    <div className="execution-viewer">
      <h2>{trace.activity.name}</h2>

      {/* Task list with live updates */}
      <div className="tasks">
        {trace.tasks.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            status={status.tasks[task.id]}
          />
        ))}
      </div>

      {/* Terminal output */}
      {terminal && (
        <TerminalViewer
          output={terminal.content}
          onCommand={(cmd) => {
            // Send command back to terminal vessel
            executeActivity("terminal-send-command", {
              impulses: [{
                pointer: {
                  type: "terminal_command",
                  terminalId: terminal.terminalId,
                  command: cmd
                }
              }]
            })
          }}
        />
      )}

      {/* Progress indicator */}
      <Progress
        value={status.completedTasks}
        max={trace.tasks.length}
      />
    </div>
  )
}

function TaskItem({ task, status }) {
  return (
    <div className={`task task-${status?.status}`}>
      <span className="task-icon">
        {status?.status === "success" ? "✓" :
         status?.status === "failure" ? "✗" :
         status?.status === "starting" ? "⟳" : "○"}
      </span>
      <span className="task-description">{task.description}</span>
      {status?.output && (
        <pre className="task-output">{status.output}</pre>
      )}
    </div>
  )
}
```

## Terminal Integration

### Terminal Vessel Provides Resolver

```typescript
// repos/terminal/src/index.ts
import { Hono } from 'hono'

const app = new Hono()

// Terminal state storage
const terminals = new Map<string, TerminalState>()

// Resolver endpoint
app.post("/resolve", async (c) => {
  const { pointer } = await c.req.json()

  if (pointer.type !== "terminal_snapshot") {
    return c.json({ error: "Unknown pointer type" }, 400)
  }

  const terminal = terminals.get(pointer.terminalId)
  if (!terminal) {
    return c.json({ error: "Terminal not found" }, 404)
  }

  const snapshot = {
    output: terminal.buffer,
    scrollback: pointer.includeScrollback
      ? terminal.scrollback
      : [],
    cursor: terminal.cursor,
    size: terminal.size
  }

  return c.json({ content: snapshot })
})

// Command execution endpoint
app.post("/execute", async (c) => {
  const { terminalId, command } = await c.req.json()

  const terminal = getOrCreateTerminal(terminalId)

  // Execute command and capture output
  const result = await terminal.execute(command)

  // Notify react-renderer of update
  await fetch("http://react-renderer:3000/impulses/notify", {
    method: "POST",
    body: JSON.stringify({
      impulseId: `terminal-${terminalId}-${Date.now()}`
    })
  })

  return c.json({ result })
})

export default app
```

### React-Renderer Delegates Terminal Resolution

```typescript
// repos/react-renderer/src/resolvers/terminal.ts
export async function resolveTerminalSnapshot(
  pointer: TerminalSnapshotPointer
): Promise<TerminalSnapshot> {
  // Delegate to terminal vessel
  const response = await fetch("http://terminal:8080/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pointer })
  })

  if (!response.ok) {
    throw new Error(`Terminal resolution failed: ${response.statusText}`)
  }

  const { content } = await response.json()
  return content
}

// Register resolver
registerResolver("terminal_snapshot", resolveTerminalSnapshot)
```

## Impulse Viewport Management

The key feature: React-renderer manages a **viewport** into the impulse state space.

```typescript
// repos/react-renderer/src/state/viewport.ts
interface ImpulseViewport {
  // Currently visible impulses
  visible: Set<string>

  // Budget allocation per impulse
  budgets: Map<string, number>

  // Priority for rendering
  priorities: Map<string, "high" | "medium" | "low">

  // Filters
  filters: {
    executionId?: string
    activityType?: string
    timeRange?: [Date, Date]
  }
}

class ViewportManager {
  private viewport: ImpulseViewport

  constructor(totalBudget: number) {
    this.viewport = {
      visible: new Set(),
      budgets: new Map(),
      priorities: new Map(),
      filters: {}
    }
  }

  // Update viewport based on user focus
  async updateFocus(focus: "execution" | "terminal" | "metrics") {
    // Execute activity to recompute viewport
    await executeActivity("update-viewport", {
      impulses: [{
        pointer: {
          type: "ui_state",
          path: "viewport.focus",
          value: focus
        }
      }]
    })
  }

  // Allocate budget across visible impulses
  allocateBudget(impulses: Impulse[]): Map<string, number> {
    const totalBudget = 50000 // Total tokens available

    // Sort by priority
    const sorted = impulses.sort((a, b) => {
      const priorityA = this.viewport.priorities.get(a.id) ?? "low"
      const priorityB = this.viewport.priorities.get(b.id) ?? "low"
      return priorityValue(priorityB) - priorityValue(priorityA)
    })

    // Allocate proportionally
    const budgets = new Map<string, number>()
    let remaining = totalBudget

    for (const impulse of sorted) {
      const requested = impulse.budget ?? 2000
      const allocated = Math.min(requested, remaining)
      budgets.set(impulse.id, allocated)
      remaining -= allocated

      if (remaining <= 0) break
    }

    return budgets
  }
}

function priorityValue(priority: "high" | "medium" | "low"): number {
  return { high: 3, medium: 2, low: 1 }[priority]
}
```

## Learning: Which UI Works?

React-renderer learns through Thompson Sampling which UI patterns work best.

```typescript
// repos/react-renderer/src/learning/metrics.ts
interface UIMetrics {
  templateId: string
  variant: string

  // Success metrics
  userActedWithin: number  // ms until user took action
  actionSucceeded: boolean // Did their action work?
  impulseUtilization: number // % of impulses actually viewed

  // Failure metrics
  userAbandoned: boolean
  errorShown: boolean
}

// Record interaction outcome
async function recordInteraction(
  executionId: string,
  metrics: UIMetrics
) {
  await fetch("http://activity-api/v2/activities/ui-interaction", {
    method: "POST",
    body: JSON.stringify({
      executionId,
      templateId: metrics.templateId,
      variant: metrics.variant,
      outcome: metrics.actionSucceeded ? "success" : "failure",
      timeToAction: metrics.userActedWithin,
      metadata: {
        impulseUtilization: metrics.impulseUtilization,
        abandoned: metrics.userAbandoned
      }
    })
  })
}

// Thompson Sampling for UI template selection
async function selectUITemplate(
  context: { executionType: string }
): Promise<UITemplate> {
  const response = await fetch(
    "http://activity-api/v2/activities/recommend?category=ui",
    {
      method: "POST",
      body: JSON.stringify({ context })
    }
  )

  const { selected } = await response.json()
  return selected
}
```

## Summary: How They Fit Together

1. **Separate Codebases**: Each vessel is independently versioned
   - `repos/minibob`: Activity execution, code operations
   - `repos/terminal`: Terminal state management
   - `repos/react-renderer`: UI rendering, impulse visualization

2. **Impulse-Driven**: Everything is an impulse
   - MiniBob creates execution trace impulses
   - Terminal creates snapshot impulses
   - React-renderer creates UI component impulses

3. **Activity-Controlled**: All updates via activities
   - User clicks → UI event impulse → activity
   - Activity execution → status impulses → render activity
   - Terminal command → command impulse → execute activity

4. **Learning-Enabled**: Each vessel learns independently
   - MiniBob learns which code activities work
   - Terminal learns which commands are effective
   - React-renderer learns which UI patterns work

5. **Viewport = Budget**: Limited screen space managed like token budget
   - Only high-priority impulses displayed
   - Budget allocated based on user focus
   - Viewport adjusts via activities

The key insight: **React-renderer is a navigation system for the impulse state space**. It doesn't own data—it resolves pointers to data owned by other vessels and learns which views into that space are most effective for humans.
