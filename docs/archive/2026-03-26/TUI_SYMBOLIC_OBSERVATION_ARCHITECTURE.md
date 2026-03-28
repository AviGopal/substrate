# TUI Symbolic Observation Architecture

## Problem Statement

**Current situation:**
- MiniBob outputs to stdout (`console.log()`) pollutes TUI display (243 console statements)
- TUI state is visual-only, not programmatically observable
- No way to develop/test TUIs using activities (can't "see" UI state symbolically)
- UI updates are side effects, not traced events

**Goal:**
Transform TUI from visual-only to **symbolically observable** so activities can:
1. Capture stdout/stderr without polluting display
2. Read TUI state as structured data (impulses)
3. Record UI interactions as execution traces
4. Test UI updates through symbolic assertions
5. Develop UIs using activity templates with observable feedback

## Architecture: TUI as Observable System

```
┌─────────────────────────────────────────────────────────────────┐
│                     TUI Application                              │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Component   │  │  Component   │  │  Component   │          │
│  │   State      │  │   State      │  │   State      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
│         └──────────────────┼──────────────────┘                  │
│                            ↓                                      │
│                 ┌─────────────────────┐                          │
│                 │  TUI State Manager  │ ← New Component          │
│                 │  (Observable Layer) │                          │
│                 └──────────┬──────────┘                          │
│                            │                                      │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                ┌────────────┴───────────────┐
                │                            │
                ↓                            ↓
    ┌────────────────────┐      ┌────────────────────┐
    │ State Snapshots    │      │ Interaction Events │
    │ (Impulses)         │      │ (Traces)          │
    └────────┬───────────┘      └────────┬───────────┘
             │                            │
             └────────────┬───────────────┘
                          ↓
              ┌─────────────────────────┐
              │  Symbolic Observatory   │
              │  (Activity-Accessible)  │
              └───────────┬─────────────┘
                          │
                          ↓
              ┌─────────────────────────┐
              │   MiniBob Activities    │
              │   - read_tui_state      │
              │   - assert_ui_element   │
              │   - record_interaction  │
              │   - replay_sequence     │
              └─────────────────────────┘
```

## Core Components

### 1. TUI Output Capture System

**Purpose:** Intercept stdout/stderr from MiniBob without polluting TUI display.

**Implementation:**
```typescript
// repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/observability/output-capture.ts

import { createImpulse } from "@metabob/minibob"

export class TUIOutputCapture {
  private originalStdout: typeof process.stdout.write
  private originalStderr: typeof process.stderr.write
  private outputBuffer: Array<{ timestamp: number; stream: 'stdout' | 'stderr'; data: string }> = []
  private sessionID: string
  
  constructor(sessionID: string) {
    this.sessionID = sessionID
    this.originalStdout = process.stdout.write.bind(process.stdout)
    this.originalStderr = process.stderr.write.bind(process.stderr)
  }
  
  /**
   * Start capturing stdout/stderr
   * Stores output in buffer and creates impulses periodically
   */
  start() {
    // Intercept stdout
    process.stdout.write = ((data: any, ...args: any[]) => {
      const str = typeof data === 'string' ? data : data.toString()
      
      // Store in buffer
      this.outputBuffer.push({
        timestamp: Date.now(),
        stream: 'stdout',
        data: str
      })
      
      // Write to stderr instead (TUI uses stdout for rendering)
      // This keeps console.log output visible but separate from TUI
      this.originalStderr(str)
      
      // Flush buffer to impulse every 100 lines
      if (this.outputBuffer.length >= 100) {
        this.flushToImpulse()
      }
      
      return true
    }) as any
    
    // Intercept stderr
    process.stderr.write = ((data: any, ...args: any[]) => {
      const str = typeof data === 'string' ? data : data.toString()
      
      this.outputBuffer.push({
        timestamp: Date.now(),
        stream: 'stderr',
        data: str
      })
      
      this.originalStderr(str)
      
      if (this.outputBuffer.length >= 100) {
        this.flushToImpulse()
      }
      
      return true
    }) as any
  }
  
  /**
   * Stop capturing and restore original stdout/stderr
   */
  stop() {
    process.stdout.write = this.originalStdout
    process.stderr.write = this.originalStderr
    this.flushToImpulse() // Final flush
  }
  
  /**
   * Flush buffer to impulse for symbolic observation
   */
  private async flushToImpulse() {
    if (this.outputBuffer.length === 0) return
    
    const content = this.outputBuffer
      .map(entry => `[${new Date(entry.timestamp).toISOString()}] [${entry.stream}] ${entry.data}`)
      .join('')
    
    // Create impulse with buffered output
    await createImpulse({
      id: `tui-output-${this.sessionID}-${Date.now()}`,
      pointer: { type: "memo", content },
      budget: Math.min(content.length / 4, 10000), // Estimate tokens
      priority: "low",
    })
    
    // Clear buffer
    this.outputBuffer = []
  }
  
  /**
   * Get current buffer without flushing
   */
  getBuffer(): string {
    return this.outputBuffer
      .map(entry => `[${new Date(entry.timestamp).toISOString()}] [${entry.stream}] ${entry.data}`)
      .join('')
  }
}
```

### 2. TUI State Manager (Observable Layer)

**Purpose:** Expose TUI component state as structured data for symbolic access.

**Implementation:**
```typescript
// repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/observability/state-manager.ts

import { createSignal, createEffect } from "solid-js"
import { createImpulse } from "@metabob/minibob"

export interface TUIState {
  route: {
    type: string
    sessionID?: string
  }
  sync: {
    status: string
    sessionCount: number
    mcpStatus: Record<string, string>
  }
  dialog: {
    open: boolean
    type?: string
  }
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
}

export class TUIStateManager {
  private sessionID: string
  private stateHistory: TUIState[] = []
  private maxHistorySize = 50
  
  constructor(sessionID: string) {
    this.sessionID = sessionID
  }
  
  /**
   * Record state snapshot
   * Called on every significant state change
   */
  recordSnapshot(state: Partial<TUIState>) {
    const timestamp = Date.now()
    const fullState = this.mergeWithLastState(state)
    
    this.stateHistory.push(fullState)
    
    // Trim history
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift()
    }
    
    // Create impulse for activities to access
    this.createStateImpulse(fullState, timestamp)
  }
  
  /**
   * Merge partial update with last known state
   */
  private mergeWithLastState(partial: Partial<TUIState>): TUIState {
    const last = this.stateHistory[this.stateHistory.length - 1] || this.getEmptyState()
    return { ...last, ...partial }
  }
  
  /**
   * Create impulse with current state
   */
  private async createStateImpulse(state: TUIState, timestamp: number) {
    const content = JSON.stringify(state, null, 2)
    
    await createImpulse({
      id: `tui-state-${this.sessionID}-${timestamp}`,
      pointer: { type: "memo", content },
      budget: 2000,
      priority: "medium",
    })
  }
  
  /**
   * Get state at specific time or latest
   */
  getState(timestamp?: number): TUIState | null {
    if (!timestamp) {
      return this.stateHistory[this.stateHistory.length - 1] || null
    }
    
    // Find closest state before timestamp
    for (let i = this.stateHistory.length - 1; i >= 0; i--) {
      // Would need to store timestamps with states
      return this.stateHistory[i]
    }
    
    return null
  }
  
  /**
   * Get state diff between two points
   */
  getStateDiff(fromTimestamp: number, toTimestamp: number): any {
    // Implementation: Compare states and return diff
    return {}
  }
  
  private getEmptyState(): TUIState {
    return {
      route: { type: "home" },
      sync: { status: "pending", sessionCount: 0, mcpStatus: {} },
      dialog: { open: false },
      sidebar: { sections: [] },
      minibob: { activeGoal: null, activeActivity: null, executionHistory: [] }
    }
  }
}
```

### 3. TUI Interaction Recorder

**Purpose:** Record user interactions and component updates as execution traces.

**Implementation:**
```typescript
// repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/observability/interaction-recorder.ts

import { createImpulse } from "@metabob/minibob"

export interface TUIInteraction {
  timestamp: number
  type: 'keypress' | 'mouse' | 'component_update' | 'route_change' | 'dialog_open' | 'dialog_close'
  target?: string // Component name or element
  data: any // Event-specific data
}

export class TUIInteractionRecorder {
  private sessionID: string
  private interactions: TUIInteraction[] = []
  private recording = false
  
  constructor(sessionID: string) {
    this.sessionID = sessionID
  }
  
  /**
   * Start recording interactions
   */
  start() {
    this.recording = true
    this.interactions = []
  }
  
  /**
   * Stop recording and create impulse
   */
  async stop(): Promise<string> {
    this.recording = false
    
    const trace = {
      sessionID: this.sessionID,
      startTime: this.interactions[0]?.timestamp,
      endTime: this.interactions[this.interactions.length - 1]?.timestamp,
      duration: this.interactions.length > 0 
        ? this.interactions[this.interactions.length - 1].timestamp - this.interactions[0].timestamp 
        : 0,
      interactions: this.interactions,
    }
    
    const content = JSON.stringify(trace, null, 2)
    const impulseId = `tui-trace-${this.sessionID}-${Date.now()}`
    
    await createImpulse({
      id: impulseId,
      pointer: { type: "memo", content },
      budget: 5000,
      priority: "high",
    })
    
    return impulseId
  }
  
  /**
   * Record a user interaction
   */
  recordInteraction(interaction: Omit<TUIInteraction, 'timestamp'>) {
    if (!this.recording) return
    
    this.interactions.push({
      ...interaction,
      timestamp: Date.now(),
    })
  }
  
  /**
   * Record keypress
   */
  recordKeypress(key: string, modifiers?: string[]) {
    this.recordInteraction({
      type: 'keypress',
      data: { key, modifiers }
    })
  }
  
  /**
   * Record component update
   */
  recordComponentUpdate(componentName: string, stateChange: any) {
    this.recordInteraction({
      type: 'component_update',
      target: componentName,
      data: stateChange
    })
  }
  
  /**
   * Record route change
   */
  recordRouteChange(from: any, to: any) {
    this.recordInteraction({
      type: 'route_change',
      data: { from, to }
    })
  }
}
```

### 4. TUI Observable Context Provider

**Purpose:** Integrate all observability features into TUI app.

**Implementation:**
```typescript
// repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/observability/context.tsx

import { createContext, useContext, ParentComponent, onMount, onCleanup } from "solid-js"
import { TUIOutputCapture } from "./output-capture"
import { TUIStateManager } from "./state-manager"
import { TUIInteractionRecorder } from "./interaction-recorder"

interface TUIObservabilityContext {
  outputCapture: TUIOutputCapture
  stateManager: TUIStateManager
  interactionRecorder: TUIInteractionRecorder
}

const ObservabilityContext = createContext<TUIObservabilityContext>()

export const TUIObservabilityProvider: ParentComponent<{ sessionID: string }> = (props) => {
  const outputCapture = new TUIOutputCapture(props.sessionID)
  const stateManager = new TUIStateManager(props.sessionID)
  const interactionRecorder = new TUIInteractionRecorder(props.sessionID)
  
  onMount(() => {
    outputCapture.start()
    interactionRecorder.start()
  })
  
  onCleanup(() => {
    outputCapture.stop()
    interactionRecorder.stop()
  })
  
  return (
    <ObservabilityContext.Provider value={{ outputCapture, stateManager, interactionRecorder }}>
      {props.children}
    </ObservabilityContext.Provider>
  )
}

export const useTUIObservability = () => {
  const context = useContext(ObservabilityContext)
  if (!context) {
    throw new Error("useTUIObservability must be used within TUIObservabilityProvider")
  }
  return context
}

/**
 * Hook to automatically record component state changes
 */
export function useObservableState<T>(componentName: string, state: T) {
  const { stateManager } = useTUIObservability()
  
  createEffect(() => {
    // Record state snapshot on every change
    stateManager.recordSnapshot({
      // Partial state update for this component
      [componentName]: state
    } as any)
  })
  
  return state
}
```

## Usage in TUI Development

### Integrate into TUI App

```typescript
// repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/app.tsx

import { TUIObservabilityProvider } from "./observability/context"

export function tui(input: { url: string; args: Args }) {
  return new Promise<void>(async (resolve) => {
    // ... existing setup ...
    
    render(
      () => (
        <ErrorBoundary fallback={...}>
          <ArgsProvider {...input.args}>
            <ExitProvider onExit={onExit}>
              <KVProvider>
                <ToastProvider>
                  <RouteProvider>
                    <SDKProvider url={input.url}>
                      <SyncProvider>
                        {/* NEW: Wrap entire app in observability */}
                        <TUIObservabilityProvider sessionID={getCurrentSessionID()}>
                          <ThemeProvider mode={mode}>
                            <LocalProvider>
                              {/* ... rest of providers ... */}
                              <App />
                            </LocalProvider>
                          </ThemeProvider>
                        </TUIObservabilityProvider>
                      </SyncProvider>
                    </SDKProvider>
                  </RouteProvider>
                </ToastProvider>
              </KVProvider>
            </ExitProvider>
          </ArgsProvider>
        </ErrorBoundary>
      )
    )
  })
}
```

### Use in Components

```typescript
// Example: Make sidebar state observable

import { useObservableState, useTUIObservability } from "@tui/observability/context"

export function Sidebar(props: { sessionID: string }) {
  const { interactionRecorder } = useTUIObservability()
  
  const [overviewExpanded, setOverviewExpanded] = createSignal(true)
  const [activitiesExpanded, setActivitiesExpanded] = createSignal(true)
  
  // Make state observable
  useObservableState("sidebar", {
    overviewExpanded: overviewExpanded(),
    activitiesExpanded: activitiesExpanded(),
    sections: {
      overview: { expanded: overviewExpanded() },
      activities: { expanded: activitiesExpanded() }
    }
  })
  
  // Record interactions
  const handleToggleOverview = () => {
    interactionRecorder.recordInteraction({
      type: 'component_update',
      target: 'sidebar-overview',
      data: { expanded: !overviewExpanded() }
    })
    setOverviewExpanded(!overviewExpanded())
  }
  
  return (
    <box>
      <CollapsibleSection 
        title="Overview" 
        expanded={overviewExpanded()}
        onToggle={handleToggleOverview}
      >
        {/* ... */}
      </CollapsibleSection>
    </box>
  )
}
```

## Activity Templates for TUI Development

### 1. Read TUI State Activity

```json
{
  "id": "read-tui-state",
  "name": "Read TUI State Snapshot",
  "category": "tool",
  "tasks": [
    {
      "id": "fetch-state",
      "description": "Fetch latest TUI state snapshot from impulse store",
      "prompt": {
        "template": "Read the latest TUI state snapshot for session {{sessionID}}.\n\nUse the impulse system to find the most recent `tui-state-{{sessionID}}-*` impulse and display its contents.\n\nParse the JSON state and summarize:\n- Current route\n- Open dialogs\n- Sidebar section states\n- MiniBob execution status",
        "variables": [
          {
            "name": "sessionID",
            "type": "string",
            "description": "Session ID to read state for"
          }
        ]
      }
    }
  ]
}
```

### 2. Assert UI Element Activity

```json
{
  "id": "assert-ui-element",
  "name": "Assert UI Element State",
  "category": "tool",
  "tasks": [
    {
      "id": "verify-element",
      "description": "Verify UI element exists and has expected state",
      "prompt": {
        "template": "Verify that the {{elementPath}} in the TUI has the expected state:\n\nExpected state:\n```json\n{{expectedState}}\n```\n\nSteps:\n1. Read latest TUI state snapshot\n2. Navigate to {{elementPath}} in state tree\n3. Compare actual vs expected\n4. Report success/failure with diff\n\nFail the task if states don't match.",
        "variables": [
          {
            "name": "elementPath",
            "type": "string",
            "description": "JSON path to element (e.g., 'sidebar.sections[0].expanded')"
          },
          {
            "name": "expectedState",
            "type": "string",
            "description": "Expected state as JSON"
          }
        ]
      }
    }
  ]
}
```

### 3. TUI Development Workflow Activity

```json
{
  "id": "tui-feature-development",
  "name": "TUI Feature Development with Testing",
  "category": "feature",
  "tasks": [
    {
      "id": "read-current-state",
      "description": "Read current TUI state to understand starting point",
      "prompt": {
        "template": "Read the current TUI state for session {{sessionID}} to understand the baseline UI structure before implementing {{featureName}}."
      }
    },
    {
      "id": "implement-feature",
      "description": "Implement TUI feature with observable hooks",
      "prompt": {
        "template": "Implement {{featureName}} in the TUI.\n\nRequirements:\n1. Add necessary components\n2. Integrate with useTUIObservability() for state tracking\n3. Use useObservableState() to make component state visible to activities\n4. Record user interactions with interactionRecorder\n\nFiles to modify: {{files}}"
      }
    },
    {
      "id": "verify-state-updates",
      "description": "Verify TUI state reflects new feature",
      "prompt": {
        "template": "Verify that the TUI state now includes {{featureName}}.\n\n1. Read latest TUI state snapshot\n2. Check for new state fields related to {{featureName}}\n3. Verify state structure matches expected schema\n\nExpected additions:\n```json\n{{expectedStateChanges}}\n```"
      }
    },
    {
      "id": "simulate-interaction",
      "description": "Simulate user interaction and verify behavior",
      "prompt": {
        "template": "Simulate a user {{interactionType}} on {{targetElement}}.\n\n1. Record interaction trace\n2. Wait for state update\n3. Read new state snapshot\n4. Verify expected state change occurred\n\nThis tests the feature symbolically without visual inspection."
      }
    }
  ]
}
```

## Benefits of Symbolic TUI Development

### 1. **Activity-Driven UI Development**
- Write TUI features using activities
- Test UI logic symbolically (no visual inspection needed)
- Automated UI regression testing

### 2. **Debuggable UI State**
- Every state change is recorded as impulse
- Time-travel debugging through state history
- Compare state snapshots to identify bugs

### 3. **Observable Stdout/Stderr**
- MiniBob console output doesn't pollute TUI
- All output captured as impulses for debugging
- Activities can read console output symbolically

### 4. **Interaction Replay**
- Record user interaction sequences
- Replay interactions to reproduce bugs
- Test UI flows programmatically

### 5. **Self-Improving TUIs**
- MiniBob can observe its own UI
- Activities can fix UI bugs by reading state
- Autonomous UI optimization based on usage patterns

## Implementation Roadmap

1. **Phase 1: Output Capture** ✅ Designed
   - Implement TUIOutputCapture
   - Integrate into app.tsx
   - Test console.log isolation

2. **Phase 2: State Management** ✅ Designed
   - Implement TUIStateManager
   - Create observable context provider
   - Instrument sidebar component

3. **Phase 3: Interaction Recording** ✅ Designed
   - Implement TUIInteractionRecorder
   - Add hooks to key components
   - Test trace generation

4. **Phase 4: Activity Integration**
   - Create activity templates for TUI testing
   - Build symbolic assertion library
   - Document TUI development workflow

5. **Phase 5: Self-Improving TUI**
   - MiniBob observes its own UI usage
   - Autonomous UI layout optimization
   - Predictive UI state management

## Next Steps

Let me now implement the core observability system...
