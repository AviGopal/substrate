# TUI Symbolic Observation - Implementation Guide

## ✅ **Completed: Three Core Observability Systems**

We've created a comprehensive observability layer that makes TUI state, outputs, and interactions **symbolically accessible** to activities through impulses.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      TUI Application                              │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Component Renders & Updates                    │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                            │                                      │
│           ┌────────────────┼────────────────┐                    │
│           ↓                ↓                ↓                     │
│  ┌────────────────┐ ┌─────────────┐ ┌──────────────────┐       │
│  │  OutputCapture │ │ StateManager│ │ InteractionRecord│       │
│  └────────┬───────┘ └──────┬──────┘ └────────┬─────────┘       │
│           │                 │                  │                  │
└───────────┼─────────────────┼──────────────────┼──────────────────┘
            │                 │                  │
            │                 │                  │
            └─────────────────┴──────────────────┘
                              │
                              ↓
                    Creates Impulses
                              │
              ┌───────────────┴───────────────┐
              ↓                               ↓
    ┌──────────────────┐          ┌──────────────────┐
    │ tui-output-*     │          │ tui-state-*      │
    │ (console logs)   │          │ (state snapshot) │
    └──────────────────┘          └──────────────────┘
                              ↓
                    ┌──────────────────┐
                    │ tui-trace-*      │
                    │ (interactions)   │
                    └──────────────────┘
                              │
                              ↓
              ┌───────────────────────────────┐
              │   MiniBob Activities Can:     │
              │   - Read console output       │
              │   - Assert UI state           │
              │   - Replay interactions       │
              │   - Test UI symbolically      │
              └───────────────────────────────┘
```

---

## Implemented Components

### 1. **TUI Output Capture** ✅

**File:** `repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/observability/output-capture.ts`

**Purpose:** Intercepts stdout/stderr from MiniBob console.log statements and routes them away from TUI display.

**Key Features:**
- Intercepts `process.stdout.write` and `process.stderr.write`
- Buffers output entries with timestamps
- Routes stdout → stderr (keeps console output visible but not in TUI)
- Flushes buffer to impulses every 100 entries or 5 seconds
- Creates `tui-output-{sessionID}-{timestamp}` impulses

**Usage:**
```typescript
const outputCapture = new TUIOutputCapture(sessionID)
outputCapture.start() // Start intercepting
// ... TUI runs ...
outputCapture.stop()  // Restore original streams, final flush
```

**Impulse Created:**
```typescript
{
  id: "tui-output-abc123-1774280000000",
  type: "memo",
  content: `
[2025-03-23T12:00:00.000Z] [stdout] [Activity] Starting: add-feature
[2025-03-23T12:00:01.500Z] [stdout] [Task] Executing: task-1
[2025-03-23T12:00:03.200Z] [stderr] [ERROR] File not found: src/missing.ts
  `,
  budget: 2000,
  priority: "low"
}
```

### 2. **TUI State Manager** ✅

**File:** `repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/observability/state-manager.ts`

**Purpose:** Captures TUI component state as structured JSON snapshots accessible to activities.

**Key Features:**
- Records state snapshots on every significant change
- Maintains history of last 50 snapshots
- Throttles impulse creation (max every 2 seconds)
- Supports state diffs between timestamps
- Creates `tui-state-{sessionID}-{timestamp}` impulses

**State Structure:**
```typescript
interface TUIState {
  timestamp: number
  route: { type: string, sessionID?: string }
  sync: { status: string, sessionCount: number, mcpStatus: Record<string, string> }
  dialog: { open: boolean, type?: string }
  sidebar: {
    sections: Array<{
      name: string
      expanded: boolean
      itemCount: number
    }>
  }
  minibob: {
    activeGoal: any
    activeActivity: any
    executionHistory: any[]
  }
  custom: Record<string, any> // Component-specific state
}
```

**Usage:**
```typescript
const stateManager = new TUIStateManager(sessionID)

// Record state change
stateManager.recordSnapshot({
  sidebar: {
    sections: [
      { name: "Overview", expanded: true, itemCount: 5 },
      { name: "Activities", expanded: false, itemCount: 3 }
    ]
  }
})

// Get current state
const currentState = stateManager.getState()

// Get state at specific time
const pastState = stateManager.getStateAt(timestamp)

// Get diff
const diff = stateManager.getStateDiff(fromTime, toTime)
```

**Impulse Created:**
```json
{
  "id": "tui-state-abc123-1774280000000",
  "type": "memo",
  "content": {
    "timestamp": 1774280000000,
    "route": { "type": "session", "sessionID": "abc123" },
    "sidebar": {
      "sections": [
        { "name": "Overview", "expanded": true, "itemCount": 5 },
        { "name": "Goal Execution", "expanded": true, "itemCount": 2 }
      ]
    },
    "minibob": {
      "activeGoal": { "intent": "Add feature", "progress": 0.6 },
      "activeActivity": { "templateId": "add-feature-with-tests" }
    }
  },
  "budget": 2000,
  "priority": "medium"
}
```

### 3. **TUI Interaction Recorder** ✅

**File:** `repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/observability/interaction-recorder.ts`

**Purpose:** Records user interactions and component updates as execution traces for replay and analysis.

**Key Features:**
- Records keypresses, mouse events, component updates, route changes, dialogs
- Creates timestamped interaction traces
- Supports custom events
- Calculates trace duration
- Creates `tui-trace-{sessionID}-{timestamp}` impulses on stop

**Usage:**
```typescript
const recorder = new TUIInteractionRecorder(sessionID)

recorder.start() // Start recording

// Record various interactions
recorder.recordKeypress('Enter', ['ctrl'])
recorder.recordMouse('click', 'sidebar-overview-toggle')
recorder.recordComponentUpdate('Sidebar', { overviewExpanded: false })
recorder.recordRouteChange({ type: 'home' }, { type: 'session', sessionID: 'abc' })
recorder.recordDialogOpen('model-selector')

const impulseId = await recorder.stop() // Stop and create trace impulse
```

**Impulse Created:**
```json
{
  "id": "tui-trace-abc123-1774280000000",
  "type": "memo",
  "content": {
    "sessionID": "abc123",
    "startTime": 1774279950000,
    "endTime": 1774280000000,
    "duration": 50000,
    "interactions": [
      {
        "timestamp": 1774279951000,
        "type": "keypress",
        "data": { "key": "Enter", "modifiers": ["ctrl"] }
      },
      {
        "timestamp": 1774279952500,
        "type": "mouse",
        "target": "sidebar-overview-toggle",
        "data": { "action": "click" }
      },
      {
        "timestamp": 1774279953000,
        "type": "component_update",
        "target": "Sidebar",
        "data": { "overviewExpanded": false }
      }
    ]
  },
  "budget": 5000,
  "priority": "high"
}
```

---

## Integration Patterns

### Pattern 1: Integrate into TUI App

```typescript
// repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/app.tsx

import { TUIOutputCapture } from "./observability/output-capture"
import { TUIStateManager } from "./observability/state-manager"
import { TUIInteractionRecorder } from "./observability/interaction-recorder"

export function tui(input: { url: string; args: Args }) {
  return new Promise<void>(async (resolve) => {
    const sessionID = getCurrentSessionID() // Get from context
    
    // Initialize observability systems
    const outputCapture = new TUIOutputCapture(sessionID)
    const stateManager = new TUIStateManager(sessionID)
    const interactionRecorder = new TUIInteractionRecorder(sessionID)
    
    // Start capturing
    outputCapture.start()
    interactionRecorder.start()
    
    // Cleanup on exit
    const onExit = async () => {
      outputCapture.stop()
      await interactionRecorder.stop()
      await input.onExit?.()
      resolve()
    }
    
    render(() => (
      <App 
        stateManager={stateManager} 
        interactionRecorder={interactionRecorder} 
      />
    ))
  })
}
```

### Pattern 2: Make Component State Observable

```typescript
// Example: Sidebar component

export function Sidebar(props: { 
  sessionID: string, 
  stateManager: TUIStateManager,
  interactionRecorder: TUIInteractionRecorder
}) {
  const [overviewExpanded, setOverviewExpanded] = createSignal(true)
  const [activitiesExpanded, setActivitiesExpanded] = createSignal(true)
  
  // Record state changes
  createEffect(() => {
    props.stateManager.recordSnapshot({
      sidebar: {
        sections: [
          { name: "Overview", expanded: overviewExpanded(), itemCount: 5 },
          { name: "Activities", expanded: activitiesExpanded(), itemCount: 3 }
        ]
      }
    })
  })
  
  // Record interactions
  const handleToggleOverview = () => {
    props.interactionRecorder.recordInteraction({
      type: 'component_update',
      target: 'sidebar-overview',
      data: { expanded: !overviewExpanded() }
    })
    setOverviewExpanded(!overviewExpanded())
  }
  
  return <box>{/* ... */}</box>
}
```

---

## Activity Templates for TUI Development

### Activity 1: Read TUI Console Output

```json
{
  "id": "read-tui-console-output",
  "name": "Read TUI Console Output",
  "category": "tool",
  "tasks": [
    {
      "id": "find-output-impulse",
      "description": "Find latest TUI output impulse for session",
      "prompt": {
        "template": "Find and read the latest TUI console output for session {{sessionID}}.\n\n1. Search for impulses matching pattern: tui-output-{{sessionID}}-*\n2. Load the most recent impulse\n3. Display the console output\n4. Summarize any errors or warnings found\n\nThis allows symbolic observation of console.log output without visual TUI inspection.",
        "variables": [
          {
            "name": "sessionID",
            "type": "string",
            "description": "TUI session ID"
          }
        ]
      }
    }
  ]
}
```

### Activity 2: Assert TUI State

```json
{
  "id": "assert-tui-state",
  "name": "Assert TUI State Matches Expected",
  "category": "tool",
  "tasks": [
    {
      "id": "verify-state",
      "description": "Verify TUI state matches expected structure",
      "prompt": {
        "template": "Verify that the TUI state for session {{sessionID}} matches expected structure.\n\nExpected state at path {{statePath}}:\n```json\n{{expectedState}}\n```\n\nSteps:\n1. Find latest tui-state-{{sessionID}}-* impulse\n2. Parse JSON state\n3. Navigate to {{statePath}}\n4. Compare actual vs expected (deep equality)\n5. Report success or failure with diff\n\nFail the task if actual state doesn't match expected.",
        "variables": [
          {
            "name": "sessionID",
            "type": "string"
          },
          {
            "name": "statePath",
            "type": "string",
            "description": "JSON path (e.g., 'sidebar.sections[0].expanded')"
          },
          {
            "name": "expectedState",
            "type": "string",
            "description": "Expected value as JSON"
          }
        ]
      }
    }
  ]
}
```

### Activity 3: Analyze Interaction Trace

```json
{
  "id": "analyze-tui-interaction-trace",
  "name": "Analyze TUI Interaction Trace",
  "category": "tool",
  "tasks": [
    {
      "id": "analyze-trace",
      "description": "Analyze recorded TUI interaction trace",
      "prompt": {
        "template": "Analyze the TUI interaction trace for session {{sessionID}}.\n\n1. Find latest tui-trace-{{sessionID}}-* impulse\n2. Parse interaction sequence\n3. Summarize:\n   - Total interactions: count\n   - Duration: milliseconds\n   - Interaction types: breakdown\n   - Component updates: which components changed\n   - Route changes: navigation path\n4. Identify any patterns or anomalies\n\nThis enables symbolic UI testing without manual interaction.",
        "variables": [
          {
            "name": "sessionID",
            "type": "string"
          }
        ]
      }
    }
  ]
}
```

---

## Benefits of Symbolic TUI Observation

### ✅ **stdout/stderr Isolation**
- Console.log output from MiniBob doesn't pollute TUI display
- All output captured as impulses for debugging
- Activities can read console output symbolically

### ✅ **Programmatic State Access**
- TUI state is no longer visual-only
- Activities can read component state as JSON
- Test UI logic without visual inspection

### ✅ **Interaction Replay**
- Record user interaction sequences
- Replay for debugging or testing
- Analyze UI usage patterns

### ✅ **Activity-Driven UI Development**
- Write TUI features using activities
- Test UI updates through assertions
- Automated UI regression testing

### ✅ **Self-Improving TUIs**
- MiniBob can observe its own UI
- Activities can fix UI bugs by reading state
- Autonomous UI optimization

---

## Usage Examples

### Example 1: Debug TUI Issue with Output Capture

```bash
# User reports: "TUI is slow when opening sidebar"

# Activity reads console output impulse:
activity({
  template: "read-tui-console-output",
  variables: { sessionID: "abc123" }
})

# Finds in output:
[stdout] [WARN] Sidebar render took 2500ms
[stdout] [ERROR] Failed to fetch session state: timeout

# Activity diagnoses: Network timeout causing slow render
# Activity fixes: Add retry logic and loading state
```

### Example 2: Test UI Feature Symbolically

```bash
# Implement new "Collapse All" button in sidebar

# 1. Implement feature (activity)
activity({
  template: "add-tui-feature",
  variables: {
    featureName: "Collapse All button",
    files: ["src/cli/cmd/tui/routes/session/sidebar.tsx"]
  }
})

# 2. Assert state updated correctly (activity)
activity({
  template: "assert-tui-state",
  variables: {
    sessionID: "abc123",
    statePath: "sidebar.sections",
    expectedState: JSON.stringify([
      { name: "Overview", expanded: false },
      { name: "Activities", expanded: false }
    ])
  }
})

# 3. Verify interaction trace (activity)
activity({
  template: "analyze-tui-interaction-trace",
  variables: { sessionID: "abc123" }
})

# Result: Feature tested without manual visual inspection!
```

### Example 3: Autonomous UI Optimization

```bash
# MiniBob observes TUI usage patterns via traces
# Finds: Users always expand "Goal Execution" section first
# Decision: Make "Goal Execution" expanded by default
# MiniBob modifies sidebar.tsx automatically
# Verifies change via state assertions
# Creates PR: "Optimize default sidebar layout based on usage"
```

---

## Next Steps to Complete Integration

### 1. Create Context Provider (SolidJS)

```typescript
// repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/observability/context.tsx

import { createContext, useContext, type ParentComponent } from "solid-js"

interface TUIObservability {
  outputCapture: TUIOutputCapture
  stateManager: TUIStateManager
  interactionRecorder: TUIInteractionRecorder
}

const ObservabilityContext = createContext<TUIObservability>()

export const TUIObservabilityProvider: ParentComponent<{ sessionID: string }> = (props) => {
  const observability = {
    outputCapture: new TUIOutputCapture(props.sessionID),
    stateManager: new TUIStateManager(props.sessionID),
    interactionRecorder: new TUIInteractionRecorder(props.sessionID)
  }
  
  onMount(() => {
    observability.outputCapture.start()
    observability.interactionRecorder.start()
  })
  
  onCleanup(() => {
    observability.outputCapture.stop()
    observability.interactionRecorder.stop()
  })
  
  return (
    <ObservabilityContext.Provider value={observability}>
      {props.children}
    </ObservabilityContext.Provider>
  )
}

export const useTUIObservability = () => useContext(ObservabilityContext)!
```

### 2. Instrument Sidebar Component

Add state recording and interaction tracking to existing sidebar.

### 3. Create Activity Templates

Store templates in `templates/` directory for TUI development.

### 4. Test End-to-End

Run TUI, execute goal, verify impulses created, test activity can read state.

---

## Summary

**✅ Implemented:**
1. `TUIOutputCapture` - Captures stdout/stderr as impulses
2. `TUIStateManager` - Snapshots component state as impulses
3. `TUIInteractionRecorder` - Records interactions as traces

**📋 Remaining:**
- Create SolidJS context provider
- Integrate into app.tsx
- Instrument components (sidebar, dialogs)
- Create activity templates
- Test with real TUI session

**🎯 Outcome:**
TUI is now **symbolically observable** - activities can read console output, assert state, replay interactions, and develop UI features without visual inspection. This enables **activity-driven TUI development** and **autonomous UI improvement**.
