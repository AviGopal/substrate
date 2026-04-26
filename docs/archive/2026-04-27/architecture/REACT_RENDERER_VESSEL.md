# React-Renderer Vessel

A vessel that resolves UI-related impulses and manages activity-driven rendering.

## Core Principle

React-renderer is a **navigation system for UI possibility space**. It doesn't just render components—it learns which UI patterns effectively surface the impulse state space for human observation and interaction.

## Impulse Types Resolved

### `ui_component`
Points to a React component configuration that doesn't exist until rendered.

```typescript
{
  type: "ui_component",
  component: "ExecutionViewer",
  props: {
    executionId: "exec_abc123",
    includeTrace: true
  },
  viewport: { width: 1200, height: 800 }
}
```

### `ui_state`
Points to application state in the UI state space.

```typescript
{
  type: "ui_state",
  path: "execution.current.tasks",
  query: { status: "in_progress" },
  limit: 10
}
```

### `terminal_snapshot`
Points to terminal output state (delegates to terminal vessel).

```typescript
{
  type: "terminal_snapshot",
  terminalId: "term_xyz",
  includeScrollback: true,
  format: "ansi"
}
```

### `ui_event`
Points to a user interaction that should trigger an activity.

```typescript
{
  type: "ui_event",
  event: "task.retry",
  payload: { taskId: "task_123" },
  metadata: { source: "dashboard" }
}
```

## Activities in React-Renderer

### Activity: `render-impulse-collection`
**Purpose**: Render a set of impulses as a cohesive UI

```json
{
  "id": "render-impulse-collection",
  "category": "ui",
  "tasks": [
    {
      "id": "resolve-ui-impulses",
      "description": "Resolve all UI impulses within budget",
      "impulseRefs": ["ui_state", "ui_component"],
      "validation": {
        "requiredPatterns": ["all-impulses-loaded"]
      }
    },
    {
      "id": "compute-layout",
      "description": "Determine component arrangement",
      "impulseRefs": ["layout_config"],
      "validation": {
        "requiredPatterns": ["layout-computed"]
      }
    },
    {
      "id": "render-components",
      "description": "Render React component tree",
      "validation": {
        "requiredPatterns": ["dom-updated"]
      }
    }
  ]
}
```

### Activity: `update-from-execution-trace`
**Purpose**: Update UI when activity execution progresses

```json
{
  "id": "update-from-execution-trace",
  "category": "ui",
  "tasks": [
    {
      "id": "fetch-trace-impulse",
      "description": "Load execution trace",
      "impulseRefs": ["activityExecutionTrace"],
      "validation": {
        "requiredPatterns": ["trace-loaded"]
      }
    },
    {
      "id": "diff-ui-state",
      "description": "Compute UI state changes",
      "validation": {
        "requiredPatterns": ["diff-computed"]
      }
    },
    {
      "id": "apply-ui-update",
      "description": "Apply changes to UI state",
      "validation": {
        "requiredPatterns": ["state-updated"]
      }
    }
  ]
}
```

### Activity: `handle-user-interaction`
**Purpose**: Convert user event into activity execution

```json
{
  "id": "handle-user-interaction",
  "category": "ui",
  "tasks": [
    {
      "id": "validate-event",
      "description": "Ensure event is well-formed",
      "impulseRefs": ["ui_event"],
      "validation": {
        "requiredPatterns": ["event-valid"]
      }
    },
    {
      "id": "determine-activity",
      "description": "Map event to activity template",
      "validation": {
        "requiredPatterns": ["activity-selected"]
      }
    },
    {
      "id": "trigger-activity",
      "description": "Execute activity in MiniBob",
      "validation": {
        "requiredPatterns": ["activity-started"]
      }
    }
  ]
}
```

## Integration Architecture

### MiniBob → React-Renderer
MiniBob creates UI impulses during execution:

```typescript
// In MiniBob activity execution
const statusImpulse = createImpulse({
  id: "execution-status",
  pointer: {
    type: "ui_component",
    component: "TaskProgress",
    props: {
      taskId: currentTask.id,
      status: currentTask.status,
      progress: currentTask.progress
    }
  },
  budget: 2000,
  priority: "high"
})

// Notify react-renderer of new impulse
await fetch("http://react-renderer:3000/impulses/notify", {
  method: "POST",
  body: JSON.stringify({ impulseId: statusImpulse.id })
})
```

### React-Renderer → Terminal
React-renderer resolves terminal impulses by delegating:

```typescript
// In React-Renderer resolver
registerResolver("terminal_snapshot", async (pointer) => {
  // Delegate to terminal vessel
  const response = await fetch("http://terminal:8080/resolve", {
    method: "POST",
    body: JSON.stringify({ pointer })
  })
  return response.json()
})
```

### User Event → Activity
User interactions become activities:

```typescript
// In React component
function TaskCard({ task }) {
  const handleRetry = async () => {
    // Create UI event impulse
    const event = createImpulse({
      pointer: {
        type: "ui_event",
        event: "task.retry",
        payload: { taskId: task.id }
      }
    })

    // Trigger activity execution
    await executeActivity("handle-user-interaction", {
      impulses: [event]
    })
  }

  return <button onClick={handleRetry}>Retry</button>
}
```

## State Space Visualization

The key innovation: **UI displays a portion of the impulse state space**.

```typescript
// React-Renderer exposes "viewport" into impulse space
interface ImpulseViewport {
  // Which impulses are visible
  visibleImpulses: string[]

  // Budget allocation (which impulses get loaded)
  budgetAllocation: Map<string, number>

  // Display priority (which impulses render first)
  displayPriority: Map<string, number>

  // Filters (which region of state space to show)
  filters: {
    shape?: string
    sourceType?: string
    minRelevance?: number
    timeRange?: [Date, Date]
  }
}

// Activity: update-viewport
// Adjusts which impulses are visible based on user focus
{
  "id": "update-viewport",
  "tasks": [
    {
      "id": "determine-focus",
      "description": "Identify user's current focus area",
      "validation": { "requiredPatterns": ["focus-identified"] }
    },
    {
      "id": "select-impulses",
      "description": "Choose impulses to display",
      "validation": { "requiredPatterns": ["impulses-selected"] }
    },
    {
      "id": "allocate-budget",
      "description": "Distribute token budget across visible impulses",
      "validation": { "requiredPatterns": ["budget-allocated"] }
    }
  ]
}
```

## Learning in React-Renderer

React-renderer learns which UI patterns work through Thompson Sampling:

### Metrics Tracked
- **Time to comprehension**: How long until user takes action
- **Interaction success rate**: Did user action lead to desired outcome
- **Impulse utilization**: Which impulses were actually looked at
- **Navigation efficiency**: How many clicks to reach goal

### Template Variants
Different ways to render the same impulse:

```typescript
// Variant A: Detailed view
{
  "id": "render-execution-detailed",
  "component": "ExecutionDetailView",
  "timesToSuccess": 12,
  "timesToFailure": 3
}

// Variant B: Compact view
{
  "id": "render-execution-compact",
  "component": "ExecutionCompactView",
  "timesToSuccess": 8,
  "timesToFailure": 7
}

// Thompson Sampling selects which variant to use
// Based on success rates, react-renderer learns
// which presentation works better
```

## Codebase Structure

```
repos/react-renderer/
├── package.json
├── src/
│   ├── index.ts              # Server entry (activity executor)
│   ├── resolvers/            # Impulse resolvers
│   │   ├── ui-component.ts
│   │   ├── ui-state.ts
│   │   └── terminal.ts       # Delegates to terminal vessel
│   ├── activities/           # Activity templates
│   │   ├── render.ts
│   │   ├── update.ts
│   │   └── interact.ts
│   ├── components/           # React components
│   │   ├── ImpulseViewer.tsx
│   │   ├── ExecutionViewer.tsx
│   │   └── StateExplorer.tsx
│   ├── state/                # State management
│   │   ├── impulse-viewport.ts
│   │   └── activity-state.ts
│   └── learning/             # Learning system
│       ├── metrics.ts
│       └── thompson.ts
└── templates/                # Activity templates (JSON)
    ├── render-impulse-collection.json
    ├── update-from-execution-trace.json
    └── handle-user-interaction.json
```

## Example: Displaying Activity Execution

### Step 1: MiniBob executes activity
```typescript
// In MiniBob
const execution = await executeActivity("fix-bug", {
  impulses: [bugReport, codeFile]
})

// Create UI impulse for status
const statusImpulse = createImpulse({
  pointer: {
    type: "ui_component",
    component: "ExecutionStatus",
    props: { executionId: execution.id }
  }
})
```

### Step 2: React-renderer receives notification
```typescript
// In react-renderer server
app.post("/impulses/notify", async (req) => {
  const { impulseId } = req.body

  // Execute render activity
  await executeActivity("render-impulse-collection", {
    impulses: [impulseId]
  })
})
```

### Step 3: Activity resolves impulse
```typescript
// In render activity
const impulse = await resolveImpulse(impulseId)
// impulse.content = { component: "ExecutionStatus", props: {...} }

// Compute layout
const layout = computeLayout([impulse], viewport)

// Render component
const component = renderComponent(
  impulse.content.component,
  impulse.content.props
)
```

### Step 4: Browser displays result
```typescript
// React component
function ExecutionStatus({ executionId }) {
  // Subscribes to execution trace impulse
  const trace = useImpulse({
    type: "activityExecutionTrace",
    executionId
  })

  return (
    <div>
      <h2>{trace.activity.name}</h2>
      <TaskList tasks={trace.tasks} />
      <Progress value={trace.progress} />
    </div>
  )
}
```

## Key Design Decisions

### 1. UI State IS Impulse State
Don't maintain separate UI state. The UI is just a rendered view of impulses.

### 2. Activities Control Updates
All UI updates happen via activities. No direct state mutations.

### 3. Viewport = Budget Allocation
Limited screen space = token budget. Viewport management is impulse prioritization.

### 4. Learning from Interactions
Track which UI patterns lead to successful user actions. Thompson Sampling optimizes.

### 5. Delegation, Not Ownership
React-renderer doesn't own data. It resolves pointers to data owned by other vessels.

## Integration with Activity-API

React-renderer records traces just like MiniBob:

```typescript
// After rendering activity completes
await fetch("http://activity-api/v2/activities/execution-traces", {
  method: "POST",
  body: JSON.stringify({
    activityId: "render-impulse-collection",
    templateId: "render-impulse-collection-v1",
    tasks: [
      {
        taskId: "resolve-ui-impulses",
        status: "success",
        duration: 120,
        toolCalls: [
          { tool: "resolve", args: { impulseId: "exec_status" } }
        ]
      }
    ],
    outcome: "success",
    cost: 0.0, // No LLM usage
    duration: 250
  })
})
```

This allows:
- Thompson Sampling for UI templates
- Learning which render patterns work
- A/B testing different UI approaches
- Metrics on comprehension time

## Why Separate Vessel?

From SYSTEM_UNDERSTANDING_2.txt conversation:

> "All vessels contain all other vessels because like everything in the informational state it's wacky. It's impossible for us to remain becoming unless we are able to differentiate concepts explicitly and treat them as separate. So having separate vessels that are separately versionable let's us make more incremental and durable changes to the functional state such that we are able to learn the gradient in the informational state."

React-renderer is separate because:
1. **Independent learning**: UI patterns evolve separately from code activities
2. **Gradient isolation**: We can measure "did UI change help?" independently
3. **Versioning**: Roll back UI changes without touching MiniBob
4. **Specialization**: UI rendering is a distinct capability

## Next Steps

1. Create repos/react-renderer with basic structure
2. Implement ui_component resolver
3. Build simple ImpulseViewer component
4. Add activity templates for rendering
5. Integrate with MiniBob via impulse notifications
6. Add learning metrics and Thompson Sampling
7. Deploy as separate service in activity-system namespace
