# OpenCode TUI + MiniBob Integration Guide

## Overview

The OpenCode TUI now provides **real-time visibility** into MiniBob's activity execution, goal progress, impulse memory, and execution traces. This integration allows you to monitor autonomous development as it happens.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     OpenCode TUI Sidebar                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Goal Execution Section                                  │   │
│  │  - Intent: "Add REST endpoint..."                       │   │
│  │  - Progress: 2/5 activities (40%)                       │   │
│  │  - Cost: $1.23 / $10.00                                 │   │
│  │  - Status: In Progress / Completed                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Active Activity Section                                 │   │
│  │  - Template: add-feature-with-tests                     │   │
│  │  - Execution ID: act_1774277104368_h6omv2              │   │
│  │  - Recent Tool Calls:                                   │   │
│  │    • bash (2s ago)                                      │   │
│  │    • read (5s ago)                                      │   │
│  │    • edit (12s ago)                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Execution History                                       │   │
│  │  1. ✅ explore-codebase (completed, 45s, $0.23)        │   │
│  │  2. ✅ add-feature (completed, 120s, $0.89)            │   │
│  │  3. 🔄 run-tests (executing...)                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓ Polls every 2.5s
┌─────────────────────────────────────────────────────────────────┐
│              OpenCode Server API Endpoint                        │
│         GET /session/:id/minibob-state                          │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓ Calls getMiniBobState()
┌─────────────────────────────────────────────────────────────────┐
│                  MinibobIntegration Layer                        │
│                                                                   │
│  - Maintains Map<sessionID, ActivityExecutor>                   │
│  - Maintains Map<sessionID, GoalProcessor>                      │
│  - Calls executor.getState() and goalProcessor.getGoalState()  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ↓
┌──────────────────────┬──────────────────────────────────────────┐
│  ActivityExecutor    │         GoalProcessor                     │
│                      │                                           │
│  getState() returns: │  getGoalState() returns:                 │
│  - currentActivityId │  - currentGoal (intent, type)           │
│  - currentExecutionId│  - currentProgress (activities, cost)    │
│  - toolCallRecords   │  - executionHistory (last 5)            │
│  - workingDirectory  │                                           │
└──────────────────────┴──────────────────────────────────────────┘
```

## Key Features

### 1. **Goal Execution Monitoring**

**What you see:**
- Current goal intent and type (feature/bugfix/refactor/tool/infrastructure)
- Progress bar: Activities executed / Max activities allowed
- Cost tracking: Current cost / Budget limit
- Completion status

**Example:**
```
┌──────────────────────────────────────────────────┐
│ Goal Execution                                   │
│ Intent: Add user profile endpoint with tests    │
│ Progress: 3/5 activities                         │
│ ████████████████░░░░░░░░░░░░░░ 60%             │
│ Cost: $2.45 / $10.00                            │
│ Status: In Progress                              │
└──────────────────────────────────────────────────┘
```

**Data source:** `GoalProcessor.getGoalState()`

### 2. **Active Activity Tracking**

**What you see:**
- Current activity template ID
- Execution ID (unique per run)
- Goal context (why this activity is running)
- Recent tool calls with timestamps

**Example:**
```
┌──────────────────────────────────────────────────┐
│ Active Activity                                  │
│ Template: add-feature-with-tests                │
│ Execution: act_1774277104368_h6omv2            │
│ Context: Goal: Add user profile endpoint       │
│                                                  │
│ Recent Tool Calls:                              │
│ • bash (2 seconds ago)                          │
│ • read (5 seconds ago)                          │
│ • edit (12 seconds ago)                         │
│ • bash (18 seconds ago)                         │
│ • write (25 seconds ago)                        │
└──────────────────────────────────────────────────┘
```

**Data source:** `ActivityExecutor.getState()`

### 3. **Execution History**

**What you see:**
- Last 5 activity executions
- Status indicators (✅ completed, ❌ failed)
- Duration and cost per activity
- Template IDs

**Example:**
```
┌──────────────────────────────────────────────────┐
│ Execution History                                │
│ 1. ✅ explore-codebase                          │
│    Status: completed                             │
│    Duration: 45s, Cost: $0.23                   │
│                                                  │
│ 2. ✅ add-feature-impl                          │
│    Status: completed                             │
│    Duration: 120s, Cost: $0.89                  │
│                                                  │
│ 3. ✅ run-tests                                 │
│    Status: completed                             │
│    Duration: 67s, Cost: $0.34                   │
│                                                  │
│ 4. ✅ commit-changes                            │
│    Status: completed                             │
│    Duration: 23s, Cost: $0.12                   │
│                                                  │
│ 5. 🔄 Current Activity                          │
│    Status: executing                             │
└──────────────────────────────────────────────────┘
```

**Data source:** `GoalProcessor.getGoalState().executionHistory`

### 4. **Real-Time Updates**

The TUI sidebar **polls the server every 2.5 seconds** to fetch the latest MiniBob state:

```typescript
// In sidebar.tsx (line 142-144)
onMount(() => {
  fetchSessionState()
  const interval = setInterval(fetchSessionState, 2500)
  onCleanup(() => clearInterval(interval))
})
```

This provides near-real-time visibility without WebSocket complexity.

## Implementation Details

### MiniBob Library Changes

#### 1. `ActivityExecutor.getState()` (repos/minibob/src/activity.ts)

```typescript
getState(): {
  currentActivityId: string | undefined
  currentExecutionId: string | undefined
  currentGoalContext: string | undefined
  toolCallRecords: Array<{ toolName: string; params: any; result: ToolResult; timestamp: number }>
  workingDirectory: string
} {
  return {
    currentActivityId: this.currentActivityId,
    currentExecutionId: this.currentExecutionId,
    currentGoalContext: this.currentGoalContext,
    toolCallRecords: this.toolCallRecords.slice(-10), // Last 10 tool calls
    workingDirectory: this.config.workingDirectory,
  }
}
```

**Purpose:** Exposes the current activity being executed and recent tool usage.

**Updated when:**
- `this.currentActivityId` set at start of `execute()` method
- `this.currentExecutionId` set at start of `execute()` method
- `this.toolCallRecords` appended on each tool call

#### 2. `GoalProcessor.getGoalState()` (repos/minibob/src/goal-processor.ts)

```typescript
// State tracking fields (added to class)
private currentGoal: Goal | null = null
private currentProgress: {
  activitiesExecuted: number
  maxActivities: number
  totalCost: number
  maxCost: number
  completed: boolean
} | null = null
private executionHistory: ActivityExecution[] = []

// Getter method
getGoalState(): {
  currentGoal: Goal | null
  currentProgress: { ... } | null
  executionHistory: Array<{...}>
} {
  return {
    currentGoal: this.currentGoal,
    currentProgress: this.currentProgress,
    executionHistory: this.executionHistory.map(ex => ({
      id: ex.id,
      templateId: ex.templateId,
      status: ex.status,
      duration: ex.metrics?.duration,
      cost: ex.metrics?.cost,
    })).slice(-5), // Last 5 executions
  }
}
```

**Purpose:** Tracks overall goal progress and execution history.

**Updated when:**
- `currentGoal` set at start of `executeGoal()` method (line 661)
- `currentProgress` initialized at start of `executeGoal()` (line 663-669)
- `currentProgress.activitiesExecuted` incremented after each activity (line 788)
- `currentProgress.totalCost` updated after each activity (line 793)
- `currentProgress.completed` set to true when goal completes (line 838)
- `executionHistory` appended after each activity (line 787)

### OpenCode Integration Changes

#### 1. `MinibobIntegration.getMiniBobState()` (repos/metabob-opencode/packages/opencode/src/minibob-integration/index.ts)

```typescript
// Added goal processor tracking
const goalProcessors = new Map<string, GoalProcessor>()

export function getMiniBobState(sessionID: string) {
  const executor = executors.get(sessionID)
  const goalProcessor = goalProcessors.get(sessionID)
  
  // Get executor state (using type assertion until MiniBob types are rebuilt)
  const executorState = (executor as any)?.getState?.()
  
  // Get goal processor state
  const goalState = (goalProcessor as any)?.getGoalState?.()
  
  // Combine states for TUI display
  return {
    activeGoal: goalState?.currentGoal ? { ... } : null,
    activeActivity: executorState ? { ... } : null,
    llmMessages: [], // TODO: Future enhancement
    impulses: [], // TODO: Future enhancement
  }
}
```

**Purpose:** Aggregates state from both executor and goal processor for TUI consumption.

**Updated when:**
- `submitGoal()` creates and stores `GoalProcessor` instance (line 478)
- `cleanup()` removes stored instances when session ends

#### 2. TUI Sidebar Display (repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx)

The sidebar already has placeholders for MiniBob state (lines 263-347):
- Goal Execution section (lines 263-290)
- Active Activity section (lines 292-324)
- MiniBob Impulses section (lines 326-347)

These sections are displayed when `minibobState()` returns non-null data.

## Usage Guide

### Running OpenCode TUI with MiniBob

1. **Start OpenCode Server:**
   ```bash
   cd repos/metabob-opencode/packages/opencode
   bun run dev
   ```

2. **Attach TUI:**
   ```bash
   opencode attach http://localhost:4096
   ```

3. **Execute a Goal:**
   In the OpenCode prompt, use the `goal()` tool:
   ```typescript
   goal({
     goal: "Add a REST endpoint for user profiles with tests",
     context: { files: ["src/api/users.ts"] },
     maxActivities: 5,
     maxCost: 10.0
   })
   ```

4. **Watch the Sidebar:**
   - Look for "Goal Execution" section to appear
   - Watch progress bar update as activities execute
   - See "Active Activity" section show current work
   - Monitor "Execution History" for completed activities

### Interpreting the Display

**Goal Execution Progress:**
- Progress bar shows activities executed / max allowed
- Cost tracker shows spent / budget limit
- ⚠️ Warning indicator appears when approaching budget limit (>$8)

**Activity Status Icons:**
- 🔄 = Currently executing
- ✅ = Completed successfully
- ❌ = Failed (will trigger variant creation / trailblazing)

**Tool Call Timestamps:**
- Shows how recent each tool was called
- Helps understand if activity is stuck or progressing

## Troubleshooting

### Sidebar shows no MiniBob data

**Possible causes:**
1. No goal has been executed in this session yet
2. Goal execution completed and state was cleared
3. MiniBob MCP client not connected

**Solution:**
- Execute a goal using `goal()` tool
- Check logs: `MinibobIntegration.getMiniBobState()` should return non-null
- Verify MCP endpoint configured in `opencode.json`

### State appears stale

**Possible causes:**
1. Polling interval too long (2.5s default)
2. Network latency to server
3. MiniBob execution finished quickly

**Solution:**
- Reduce polling interval in sidebar.tsx (line 142)
- Check server logs for fetch errors
- For fast executions, check execution history

### Type errors after MiniBob updates

**Possible causes:**
- TypeScript types not rebuilt after adding getState/getGoalState methods

**Solution:**
```bash
cd repos/minibob
bun run build  # Rebuilds types
cd ../metabob-opencode
bun install    # Re-link minibob package
```

## Future Enhancements

### Planned Features

1. **LLM Message Tracking**
   - Add message buffer to ActivityExecutor
   - Display streaming LLM responses in TUI
   - Show token counts per message

2. **Impulse Visibility**
   - Integrate with `getImpulseStore()`
   - Show loaded impulses with token budgets
   - Display impulse relevance scores

3. **Execution Trace Viewer**
   - Full task-by-task breakdown
   - Tool call details and outputs
   - State transitions (before/after)

4. **WebSocket Real-Time Updates**
   - Replace polling with push notifications
   - Instant updates on tool calls
   - Lower latency, better UX

5. **Interactive Controls**
   - Pause/resume goal execution
   - Skip current activity
   - Adjust budget limits mid-execution

### Contributing

To add new state to the TUI:

1. **Add state field to executor/goal processor:**
   ```typescript
   // In ActivityExecutor or GoalProcessor class
   private myNewState: MyType = ...
   ```

2. **Expose in getState/getGoalState:**
   ```typescript
   getState() {
     return {
       ...existingFields,
       myNewState: this.myNewState
     }
   }
   ```

3. **Update MinibobIntegration.getMiniBobState():**
   ```typescript
   return {
     ...existingFields,
     myNewField: executorState?.myNewState
   }
   ```

4. **Display in sidebar.tsx:**
   ```tsx
   <Show when={minibobState()?.myNewField}>
     <InfoRow label="My Field" value={minibobState()!.myNewField} />
   </Show>
   ```

## Summary

The OpenCode TUI now provides **comprehensive visibility** into MiniBob's autonomous development process:

✅ **Real-time goal progress** - See activities execute toward completion  
✅ **Activity tracking** - Monitor current work and tool usage  
✅ **Execution history** - Review completed activities and costs  
✅ **Cost management** - Track spending against budget limits  
✅ **Status indicators** - Visual feedback on progress and errors  

This integration transforms MiniBob from a **black box** into an **observable, debuggable** system where you can watch autonomous development unfold in real-time.

---

**Architecture Principle:** MiniBob is the single source of truth. OpenCode TUI is a read-only observer that polls state and renders UI. This separation ensures MiniBob remains vessel-agnostic while OpenCode provides rich visualization.
