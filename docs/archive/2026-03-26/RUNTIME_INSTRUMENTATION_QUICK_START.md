# Runtime Instrumentation - Quick Start Guide

## The Revolutionary Idea

**Treat running processes like files:**
- `read(filePath)` → `getState(processPath)`
- `write(filePath, content)` → `setState(processPath, value)`
- `edit(filePath, oldStr, newStr)` → `eval(code)` (hot-reload)

**Activities can now develop, test, and optimize code WHILE IT RUNS.**

---

## What This Enables

### 1. **Live Development** (No Restart)
```
MiniBob detects bug in running TUI
  ↓
Activity generates fix
  ↓
Activity injects code via runtime.eval()
  ↓
TUI updates WITHOUT RESTART
  ↓
Activity verifies fix works
```

### 2. **Interactive Testing**
```
Activity connects to running TUI
  ↓
Activity: runtime.setState("dialog.open", true)
  ↓
TUI dialog opens
  ↓
Activity: runtime.getState("dialog.type")
  ↓
Assert: dialog.type === "model-selector"
```

### 3. **Self-Improving Systems**
```
TUI monitors its own performance
  ↓
Emits event: "slow-render: Sidebar 2500ms"
  ↓
MiniBob activity receives event
  ↓
Activity diagnoses: Too many state updates
  ↓
Activity injects memoization code
  ↓
TUI becomes faster AUTOMATICALLY
```

---

## Implementation: 3 Steps

### Step 1: Add Runtime Server to Process

```typescript
// repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/app.tsx

import { TUIRuntimeServer } from "./runtime-server"

export function tui(input: { url: string; args: Args }) {
  return new Promise<void>(async (resolve) => {
    
    // START RUNTIME SERVER
    const runtimeServer = new TUIRuntimeServer(9999)
    console.log("TUI Runtime Server: ws://localhost:9999")
    
    const onExit = async () => {
      runtimeServer.close() // Cleanup
      await input.onExit?.()
      resolve()
    }
    
    render(() => (
      <App runtimeServer={runtimeServer} />
    ))
  })
}
```

### Step 2: Register Component State

```typescript
// repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx

export function Sidebar(props: { 
  sessionID: string,
  runtimeServer: TUIRuntimeServer 
}) {
  const [expanded, setExpanded] = createSignal(true)
  
  // REGISTER STATE WITH RUNTIME
  createEffect(() => {
    props.runtimeServer.registerComponent('sidebar', {
      // State
      expanded: expanded(),
      sessionID: props.sessionID,
      
      // Methods (callable from activities)
      toggle: () => setExpanded(!expanded()),
      expand: () => setExpanded(true),
      collapse: () => setExpanded(false),
      
      // Read-only computed
      get isExpanded() { return expanded() }
    })
  })
  
  return <box>{/* ... */}</box>
}
```

### Step 3: Use from Activity

```typescript
// Activity can now control TUI!

// Connect
runtime({ 
  action: "connect", 
  url: "ws://localhost:9999" 
})

// Read state
runtime({ 
  action: "getState", 
  path: "sidebar.expanded" 
})
// → true

// Call method
runtime({ 
  action: "eval", 
  code: "stateRegistry.get('sidebar').collapse()" 
})

// Verify state changed
runtime({ 
  action: "getState", 
  path: "sidebar.expanded" 
})
// → false
```

---

## Real-World Example: Fix Bug in Running TUI

### Scenario
User reports: "Sidebar doesn't remember collapsed state after refresh"

### Traditional Approach (File-Based)
```
1. Read sidebar.tsx file
2. Analyze code (find bug: no localStorage)
3. Edit file (add localStorage)
4. Write file
5. User manually restarts TUI
6. Test fix
```
**Time:** 5 minutes + user action

### Runtime Approach
```
1. Activity connects to running TUI
2. runtime.getState("sidebar.expanded") → true
3. Activity injects fix:
   runtime.eval(`
     const sidebar = stateRegistry.get('sidebar')
     const original = sidebar.toggle
     sidebar.toggle = () => {
       original()
       localStorage.setItem('sidebar-expanded', sidebar.expanded)
     }
   `)
4. Activity calls: runtime.eval("sidebar.toggle()")
5. Activity verifies: localStorage has value
6. Activity writes permanent fix to file
7. TUI NEVER RESTARTED
```
**Time:** 30 seconds, NO user action

---

## Architecture Comparison

### File-Based (Current)
```
┌──────────────┐         ┌──────────────┐
│   Activity   │────────▶│   src/*.ts   │
│  (MiniBob)   │  write  │   (files)    │
└──────────────┘         └──────────────┘
                                │
                                │ user restarts
                                ↓
                         ┌──────────────┐
                         │   Process    │
                         │  (running)   │
                         └──────────────┘
```

### Runtime-Based (New)
```
┌──────────────┐         ┌──────────────┐
│   Activity   │────────▶│   Process    │
│  (MiniBob)   │ WebSocket│  (running)   │
└──────────────┘         └──────┬───────┘
       │                        │
       │ also writes            │ NO RESTART
       ↓                        ↓
┌──────────────┐         ┌──────────────┐
│   src/*.ts   │         │  Updated UI  │
│   (files)    │         │   (live)     │
└──────────────┘         └──────────────┘
```

---

## Process Pointer Type

### New Impulse Type: `process`

```typescript
// Create impulse pointing to runtime state
{
  id: "tui-sidebar-state",
  pointer: {
    type: "process",
    url: "ws://localhost:9999",
    path: "sidebar",
    snapshot: true  // Capture state now, or subscribe to updates?
  },
  budget: 500,
  priority: "high"
}

// When activity loads this impulse:
const client = new RuntimeClient("ws://localhost:9999")
const state = await client.getState("sidebar")

// Returns:
{
  expanded: true,
  sessionID: "abc123",
  toggle: [Function],
  expand: [Function],
  collapse: [Function]
}
```

### Unified Access Pattern

```typescript
// Read from file
const fileContent = read({ filePath: "src/app.ts" })

// Read from runtime (SAME PARADIGM!)
const runtimeState = runtime({ 
  action: "getState", 
  path: "app.state" 
})

// Both return data
// Both can be modified
// Both are observable
```

---

## Meta-Level: MiniBob Instruments Itself

### MiniBob Running MiniBob

```typescript
// MiniBob starts with runtime server on port 9998
const minibobServer = new TUIRuntimeServer(9998)

minibobServer.registerComponent('goalProcessor', {
  currentGoal: goalProcessor.currentGoal,
  currentProgress: goalProcessor.currentProgress,
  
  // Methods
  adjustBudget: (newBudget) => {
    goalProcessor.maxCost = newBudget
  },
  skipActivity: () => {
    goalProcessor.skipCurrent()
  }
})

// Now MiniBob activity can control MiniBob!
runtime({ 
  action: "connect", 
  url: "ws://localhost:9998" 
})

runtime({ 
  action: "eval", 
  code: "stateRegistry.get('goalProcessor').adjustBudget(50)" 
})

// MiniBob just modified its OWN budget while running a goal!
```

### Self-Optimization Loop

```
MiniBob activity A executes
  ↓
Activity B monitors MiniBob's runtime
  ↓
B detects: A is slow (>5s per task)
  ↓
B injects optimization into A's executor
  ↓
A speeds up MID-EXECUTION
  ↓
B records: "Optimized activity A runtime by 40%"
```

**This is autonomous self-improvement made real!**

---

## Advanced Patterns

### Pattern 1: Breakpoint Injection

```typescript
// Activity injects debugging breakpoint into running code
runtime({ 
  action: "eval", 
  code: `
    const sidebar = stateRegistry.get('sidebar')
    const original = sidebar.toggle
    sidebar.toggle = function() {
      console.log('[BREAKPOINT] sidebar.toggle called')
      console.log('Current state:', this.expanded)
      debugger  // Pauses execution!
      return original.apply(this, arguments)
    }
  `
})
```

### Pattern 2: Telemetry Injection

```typescript
// Activity adds performance monitoring to running code
runtime({ 
  action: "eval", 
  code: `
    const sidebar = stateRegistry.get('sidebar')
    const original = sidebar.toggle
    sidebar.toggle = function() {
      const start = performance.now()
      const result = original.apply(this, arguments)
      const duration = performance.now() - start
      console.log('[TELEMETRY] sidebar.toggle took', duration, 'ms')
      return result
    }
  `
})
```

### Pattern 3: A/B Testing Runtime

```typescript
// Activity runs A/B test on live UI
runtime({ 
  action: "eval", 
  code: `
    const variant = Math.random() > 0.5 ? 'A' : 'B'
    const sidebar = stateRegistry.get('sidebar')
    
    if (variant === 'A') {
      sidebar.title = 'Overview' // Control
    } else {
      sidebar.title = 'Session Details' // Treatment
    }
    
    console.log('[A/B Test] Showing variant:', variant)
  `
})

// Activity monitors which variant performs better
// Activity automatically switches to winner
```

### Pattern 4: Hot-Reload Module

```typescript
// Activity replaces entire component without restart
runtime({ 
  action: "eval", 
  code: `
    // New implementation
    function NewSidebar(props) {
      return <box>Completely new sidebar!</box>
    }
    
    // Replace in registry
    stateRegistry.set('sidebar-component', NewSidebar)
    
    // Force re-render
    document.dispatchEvent(new Event('hot-reload'))
  `
})
```

---

## Implementation Files

### 1. Runtime Server (Embedded in Process)
**File:** `repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/runtime-server.ts`
- WebSocket server (ws://localhost:9999)
- RPC handlers: getState, setState, eval, subscribe
- Component registry: Map<string, any>
- Event emitter: state-change, component-render

### 2. Runtime Client (Used by Activities)
**File:** `repos/minibob/src/runtime-client.ts`
- WebSocket client
- RPC call wrapper
- Event subscription
- Async response handling

### 3. Runtime Tool (Exposed to LLM)
**File:** `repos/minibob/src/tools.ts` (add to existing)
- Tool name: `runtime`
- Actions: connect, getState, setState, eval, subscribe, listComponents
- Manages global RuntimeClient instance

### 4. Process Pointer Type (Impulse System)
**File:** `repos/minibob/src/impulse.ts` (add new type)
- Type: `process`
- Fields: url, path, snapshot
- Resolver: Connects to runtime, fetches state

---

## Testing the System

### Test 1: Basic Connection
```bash
# Terminal 1: Start TUI with runtime server
cd repos/metabob-opencode
bun run dev --runtime-port=9999

# Terminal 2: MiniBob connects
cd repos/minibob
node -e "
const { RuntimeClient } = require('./dist/runtime-client.js')
const client = new RuntimeClient('ws://localhost:9999')
client.listComponents().then(console.log)
"
# Output: ['sidebar', 'dialog', 'route']
```

### Test 2: State Manipulation
```bash
# MiniBob activity
activity({
  template: "test-runtime-state",
  variables: {
    url: "ws://localhost:9999",
    component: "sidebar",
    action: "collapse"
  }
})

# Activity executes:
# runtime({ action: "connect", url: "ws://localhost:9999" })
# runtime({ action: "eval", code: "stateRegistry.get('sidebar').collapse()" })
# runtime({ action: "getState", path: "sidebar.expanded" })
# Assert: expanded === false
```

### Test 3: Hot-Reload
```bash
# MiniBob detects slow render
# Activity injects memoization
runtime({ 
  action: "eval", 
  code: `
    const Sidebar = stateRegistry.get('sidebar-component')
    const Memoized = React.memo(Sidebar)
    stateRegistry.set('sidebar-component', Memoized)
  `
})
# TUI re-renders with memoized component
# NO RESTART HAPPENED
```

---

## Benefits Summary

| Capability | File-Based | Runtime-Based |
|------------|------------|---------------|
| **Modify code** | ✅ Write to disk | ✅ Inject via eval |
| **Test changes** | ❌ Requires restart | ✅ Instant |
| **Observe behavior** | ❌ Logs only | ✅ Full state access |
| **User disruption** | ❌ High (restart) | ✅ None |
| **Development speed** | Slow (minutes) | Fast (seconds) |
| **Self-improvement** | ❌ Not possible | ✅ MiniBob optimizes itself |

---

## Next Steps

1. **Implement Runtime Server** - Add to TUI app.tsx
2. **Implement Runtime Client** - Add to MiniBob tools
3. **Add Runtime Tool** - Expose to LLM
4. **Test Basic Connection** - Verify RPC works
5. **Instrument Sidebar** - Make state accessible
6. **Create Test Activity** - Verify manipulation works
7. **Add Process Pointer** - Impulse system integration
8. **Self-Instrumentation** - MiniBob instruments MiniBob
9. **Autonomous Optimization** - Activities improve running code

---

## The Vision

**Every running process becomes a living, observable, modifiable system.**

Activities don't just develop **static code** - they develop **running processes**.

MiniBob doesn't just write files - it **controls reality**.

The boundary between **development** and **runtime** dissolves.

**Code is no longer static. Code is alive. And activities are its doctors, optimizers, and architects - all working while the patient remains awake.**
