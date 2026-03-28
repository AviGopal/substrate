# Runtime Instrumentation Architecture

## The Core Question

**"How do we run activities alongside the runtime of code?"**

This is asking: How can MiniBob **observe and manipulate a running process** (like the TUI) in real-time, not just read/write static files?

---

## The Shift: From Static Code to Living Process

### Current Model (File-Based)

```
┌─────────────────────────────────────────────────────────┐
│                  MiniBob Activity                        │
│                                                           │
│  1. Read file (src/app.ts)                              │
│  2. Analyze code                                         │
│  3. Edit file                                            │
│  4. Write file                                           │
│  5. Run tests                                            │
└─────────────────────────────────────────────────────────┘
                      │
                      ↓
              Code is STATIC
              (Files on disk)
                      │
                      ↓
         User manually restarts process
```

**Limitations:**
- Can only modify files, not running state
- No visibility into runtime behavior
- No direct manipulation of in-memory state
- Requires restart to see changes

### New Model (Runtime-Connected)

```
┌─────────────────────────────────────────────────────────┐
│                  MiniBob Activity                        │
│                                                           │
│  1. Connect to running process via IPC                  │
│  2. Read runtime state (in-memory variables)            │
│  3. Inject code/modify state                            │
│  4. Observe behavior changes                            │
│  5. Record telemetry                                     │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓ IPC/WebSocket/RPC
┌──────────────────┴──────────────────────────────────────┐
│            Running Process (TUI/Server/App)              │
│                                                           │
│  ┌───────────────────────────────────────────────┐      │
│  │  Runtime Instrumentation Layer               │       │
│  │  - State inspector (read variables)          │       │
│  │  - Code injector (eval/hot-reload)           │       │
│  │  - Telemetry collector (metrics/traces)      │       │
│  │  - Event emitter (state changes)             │       │
│  └───────────────────────────────────────────────┘      │
│                                                           │
│  Application Code ← Can be modified WHILE RUNNING       │
└─────────────────────────────────────────────────────────┘
```

**Capabilities:**
- Read live runtime state (variables, objects)
- Modify state without restart
- Inject code dynamically (hot-reload)
- Observe behavior in real-time
- Record execution telemetry

---

## Three Levels of Runtime Instrumentation

### Level 1: **Observability** (Read-Only)
Activities can **read** runtime state but not modify it.

```typescript
// Running TUI Process
const tui = {
  state: {
    sidebar: { expanded: true },
    dialog: { open: false }
  }
}

// MiniBob Activity connects and reads
activity: "inspect-tui-runtime-state"
→ Reads tui.state
→ Creates impulse with snapshot
→ No modification
```

**Implemented:** ✅ TUI Output Capture, State Manager (via impulses)

### Level 2: **Hot-Reload** (Code Replacement)
Activities can **replace code** in running process.

```typescript
// Running TUI Process
function Sidebar() {
  return <div>Old implementation</div>
}

// MiniBob Activity injects new code
activity: "update-sidebar-component"
→ Sends new code via WebSocket
→ Process hot-reloads module
→ Sidebar re-renders with new implementation
→ NO RESTART NEEDED
```

**Status:** ❌ Not implemented (requires HMR/eval infrastructure)

### Level 3: **State Manipulation** (Direct Memory Access)
Activities can **modify runtime state** directly.

```typescript
// Running TUI Process
const tui = {
  state: {
    sidebar: { expanded: true },
    currentRoute: "home"
  }
}

// MiniBob Activity modifies state
activity: "navigate-tui-to-session"
→ Sends RPC: setRoute("session", sessionID)
→ Process updates: tui.state.currentRoute = "session"
→ UI re-renders immediately
→ Activity observes result
```

**Status:** ❌ Not implemented (requires RPC/IPC bridge)

---

## Architecture: MiniBob as Runtime Controller

```
┌───────────────────────────────────────────────────────────────┐
│                     MiniBob Process                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Activity: "Test TUI sidebar collapse"              │     │
│  │                                                       │     │
│  │  1. Connect to TUI runtime via WebSocket            │     │
│  │  2. Read current state: sidebar.expanded = true     │     │
│  │  3. Send command: toggleSidebar()                   │     │
│  │  4. Wait for state change event                     │     │
│  │  5. Assert: sidebar.expanded = false                │     │
│  │  6. Success: Test passes                            │     │
│  └──────────────────────────────────────────────────────┘    │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ WebSocket/IPC
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                  Running TUI Process                             │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Runtime Instrumentation Server                        │     │
│  │  - Listens on ws://localhost:9999                     │     │
│  │  - Exposes RPC methods:                               │     │
│  │    * getState() → current state                       │     │
│  │    * setState(path, value) → modify state             │     │
│  │    * eval(code) → execute code                        │     │
│  │    * on(event, handler) → subscribe to events         │     │
│  │  - Emits events:                                       │     │
│  │    * state-change: { path, oldValue, newValue }       │     │
│  │    * component-render: { component, props }           │     │
│  └────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Application Runtime                                   │     │
│  │  - Sidebar component (live state)                     │     │
│  │  - Dialog manager (live state)                        │     │
│  │  - Route handler (live state)                         │     │
│  │  All accessible via instrumentation server             │     │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation: Runtime Instrumentation Server

### Step 1: Embed WebSocket Server in TUI

```typescript
// repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/runtime-server.ts

import { WebSocketServer } from 'ws'
import { Log } from "@/util/log"

const log = Log.create({ component: "runtime-server" })

export class TUIRuntimeServer {
  private wss: WebSocketServer
  private stateRegistry: Map<string, any> = new Map()
  private eventHandlers: Map<string, Function[]> = new Map()
  
  constructor(port: number = 9999) {
    this.wss = new WebSocketServer({ port })
    
    this.wss.on('connection', (ws) => {
      log.info("MiniBob connected to TUI runtime", { port })
      
      ws.on('message', async (data) => {
        const message = JSON.parse(data.toString())
        const response = await this.handleRPC(message)
        ws.send(JSON.stringify(response))
      })
    })
    
    log.info("TUI Runtime Server started", { port })
  }
  
  /**
   * Handle RPC calls from MiniBob activities
   */
  private async handleRPC(message: any): Promise<any> {
    const { id, method, params } = message
    
    try {
      switch (method) {
        case 'getState':
          return { id, result: this.getState(params.path) }
        
        case 'setState':
          this.setState(params.path, params.value)
          return { id, result: 'ok' }
        
        case 'eval':
          const result = await this.evalCode(params.code)
          return { id, result }
        
        case 'subscribe':
          this.subscribe(params.event, params.handlerID)
          return { id, result: 'subscribed' }
        
        case 'listComponents':
          return { id, result: Array.from(this.stateRegistry.keys()) }
        
        default:
          return { id, error: `Unknown method: ${method}` }
      }
    } catch (error) {
      return { id, error: error.message }
    }
  }
  
  /**
   * Register a component's state for runtime access
   */
  registerComponent(name: string, state: any) {
    this.stateRegistry.set(name, state)
    log.debug("Registered component state", { name })
  }
  
  /**
   * Get state at path (e.g., "sidebar.expanded")
   */
  private getState(path: string): any {
    const parts = path.split('.')
    const componentName = parts[0]
    const component = this.stateRegistry.get(componentName)
    
    if (!component) {
      throw new Error(`Component not found: ${componentName}`)
    }
    
    let value = component
    for (let i = 1; i < parts.length; i++) {
      value = value[parts[i]]
    }
    
    return value
  }
  
  /**
   * Set state at path
   */
  private setState(path: string, value: any) {
    const parts = path.split('.')
    const componentName = parts[0]
    const component = this.stateRegistry.get(componentName)
    
    if (!component) {
      throw new Error(`Component not found: ${componentName}`)
    }
    
    let target = component
    for (let i = 1; i < parts.length - 1; i++) {
      target = target[parts[i]]
    }
    
    const oldValue = target[parts[parts.length - 1]]
    target[parts[parts.length - 1]] = value
    
    // Emit state change event
    this.emit('state-change', { path, oldValue, newValue: value })
    
    log.info("State updated", { path, oldValue, newValue: value })
  }
  
  /**
   * Execute arbitrary code in TUI runtime
   */
  private async evalCode(code: string): Promise<any> {
    log.warn("Executing eval in TUI runtime", { code: code.slice(0, 100) })
    
    // Create context with access to stateRegistry
    const context = {
      stateRegistry: this.stateRegistry,
      console,
    }
    
    const fn = new Function(...Object.keys(context), code)
    return fn(...Object.values(context))
  }
  
  /**
   * Emit event to all subscribers
   */
  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event) || []
    handlers.forEach(handler => handler(data))
    
    // Send to all connected WebSocket clients
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify({
          type: 'event',
          event,
          data
        }))
      }
    })
  }
  
  /**
   * Subscribe to event
   */
  private subscribe(event: string, handlerID: string) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    
    const handler = (data: any) => {
      this.wss.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'event',
            handlerID,
            event,
            data
          }))
        }
      })
    }
    
    this.eventHandlers.get(event)!.push(handler)
  }
  
  close() {
    this.wss.close()
    log.info("TUI Runtime Server stopped")
  }
}
```

### Step 2: Instrument Components

```typescript
// Example: Make Sidebar state runtime-accessible

import { useTUIRuntime } from "./runtime-server"

export function Sidebar(props: { sessionID: string }) {
  const runtime = useTUIRuntime()
  
  const [expanded, setExpanded] = createSignal(true)
  
  // Register state with runtime server
  createEffect(() => {
    runtime.registerComponent('sidebar', {
      expanded: expanded(),
      sessionID: props.sessionID,
      // Expose methods
      toggle: () => setExpanded(!expanded()),
      expand: () => setExpanded(true),
      collapse: () => setExpanded(false),
    })
  })
  
  return <box>{/* ... */}</box>
}
```

### Step 3: MiniBob Runtime Client

```typescript
// repos/minibob/src/runtime-client.ts

import WebSocket from 'ws'

export class RuntimeClient {
  private ws: WebSocket
  private nextID = 1
  private pending = new Map<number, { resolve: Function, reject: Function }>()
  
  constructor(url: string) {
    this.ws = new WebSocket(url)
    
    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      
      if (message.type === 'event') {
        // Handle event
        this.handleEvent(message.event, message.data)
      } else if (message.id) {
        // Handle RPC response
        const pending = this.pending.get(message.id)
        if (pending) {
          if (message.error) {
            pending.reject(new Error(message.error))
          } else {
            pending.resolve(message.result)
          }
          this.pending.delete(message.id)
        }
      }
    })
  }
  
  /**
   * Call RPC method on runtime
   */
  async call(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextID++
      this.pending.set(id, { resolve, reject })
      
      this.ws.send(JSON.stringify({
        id,
        method,
        params
      }))
    })
  }
  
  /**
   * Get state from runtime
   */
  async getState(path: string): Promise<any> {
    return this.call('getState', { path })
  }
  
  /**
   * Set state in runtime
   */
  async setState(path: string, value: any): Promise<void> {
    await this.call('setState', { path, value })
  }
  
  /**
   * Execute code in runtime
   */
  async eval(code: string): Promise<any> {
    return this.call('eval', { code })
  }
  
  /**
   * Subscribe to runtime events
   */
  async subscribe(event: string, handler: Function): Promise<void> {
    const handlerID = `handler-${this.nextID++}`
    // Store handler for events
    await this.call('subscribe', { event, handlerID })
  }
  
  /**
   * List available components
   */
  async listComponents(): Promise<string[]> {
    return this.call('listComponents', {})
  }
  
  close() {
    this.ws.close()
  }
  
  private handleEvent(event: string, data: any) {
    console.log(`[Runtime Event] ${event}`, data)
  }
}
```

### Step 4: Runtime Tool for Activities

```typescript
// repos/minibob/src/tools.ts

import { RuntimeClient } from './runtime-client'

/**
 * Runtime connection tool
 * Allows activities to connect to running processes
 */
export const runtimeTool: Tool = {
  name: "runtime",
  description: "Connect to and manipulate running process state",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["connect", "getState", "setState", "eval", "listComponents"],
        description: "Action to perform"
      },
      url: {
        type: "string",
        description: "WebSocket URL (e.g., ws://localhost:9999)"
      },
      path: {
        type: "string",
        description: "State path (e.g., 'sidebar.expanded')"
      },
      value: {
        description: "Value to set (for setState)"
      },
      code: {
        type: "string",
        description: "Code to execute (for eval)"
      }
    },
    required: ["action"]
  },
  execute: async (input: any) => {
    const { action, url, path, value, code } = input
    
    if (!globalRuntimeClient && url) {
      globalRuntimeClient = new RuntimeClient(url)
      await new Promise(resolve => setTimeout(resolve, 100)) // Wait for connection
    }
    
    if (!globalRuntimeClient) {
      throw new Error("Not connected to runtime. Use action=connect with url first.")
    }
    
    switch (action) {
      case "connect":
        return { status: "connected", url }
      
      case "getState":
        const state = await globalRuntimeClient.getState(path!)
        return { path, state }
      
      case "setState":
        await globalRuntimeClient.setState(path!, value)
        return { path, value, status: "updated" }
      
      case "eval":
        const result = await globalRuntimeClient.eval(code!)
        return { result }
      
      case "listComponents":
        const components = await globalRuntimeClient.listComponents()
        return { components }
      
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }
}

let globalRuntimeClient: RuntimeClient | null = null
```

---

## Usage: Activities Manipulating Runtime

### Example 1: Test TUI State

```typescript
// Activity: Test sidebar collapse
{
  "id": "test-sidebar-collapse-runtime",
  "tasks": [
    {
      "prompt": "Connect to TUI runtime and test sidebar collapse.\n\nSteps:\n1. runtime({ action: 'connect', url: 'ws://localhost:9999' })\n2. runtime({ action: 'getState', path: 'sidebar.expanded' }) → Should be true\n3. runtime({ action: 'setState', path: 'sidebar.expanded', value: false })\n4. runtime({ action: 'getState', path: 'sidebar.expanded' }) → Should be false\n5. Assert test passes"
    }
  ]
}
```

### Example 2: Inject Code Hot-Reload

```typescript
// Activity: Update sidebar title without restart
{
  "prompt": "Update TUI sidebar title dynamically.\n\nruntime({ \n  action: 'eval', \n  code: `\n    const sidebar = stateRegistry.get('sidebar')\n    sidebar.title = 'Updated Title'\n    console.log('Title updated to:', sidebar.title)\n  `\n})\n\nVerify UI updated without restart."
}
```

### Example 3: Navigate TUI from Activity

```typescript
// Activity: Navigate TUI to specific session
{
  "prompt": "Navigate TUI to session abc123.\n\nruntime({ \n  action: 'setState', \n  path: 'route.current', \n  value: { type: 'session', sessionID: 'abc123' }\n})\n\nVerify TUI navigated to session view."
}
```

---

## Benefits of Runtime Instrumentation

### 1. **Live Testing**
Activities can test UI without restart:
```
Activity → Connect to runtime → Manipulate state → Assert behavior → Disconnect
```

### 2. **Hot-Reload Development**
MiniBob can update code while TUI runs:
```
Activity → Detect bug → Generate fix → Inject code → Observe result → No restart!
```

### 3. **Interactive Debugging**
Activities can inspect live state:
```
Activity → Read runtime state → Identify issue → Fix and verify → All programmatically
```

### 4. **Autonomous Optimization**
MiniBob observes runtime metrics and optimizes:
```
Activity → Monitor performance → Detect slow render → Optimize code → Inject fix → Verify improvement
```

### 5. **Self-Healing Systems**
Process detects issue, MiniBob auto-fixes:
```
TUI crashes → Emit error event → Activity receives → Diagnose → Inject fix → Resume
```

---

## Advanced: Process-as-Activity-Target

### Treat Running Process Like a File

```
File:     read(path) → write(path, content) → close
Process:  getState(path) → setState(path, value) → close
```

**Same paradigm, different target!**

### Process Pointer Type

```typescript
// New impulse pointer type: "process"
{
  id: "tui-runtime-state",
  pointer: {
    type: "process",
    url: "ws://localhost:9999",
    path: "sidebar.expanded",
    snapshot: true  // Capture state at impulse creation time
  },
  budget: 500,
  priority: "high"
}

// When loaded:
const client = new RuntimeClient(pointer.url)
const state = await client.getState(pointer.path)
return state
```

### Activities Work Uniformly

```
read({ filePath: "src/app.ts" })           → Read static file
runtime({ action: "getState", path: "..." }) → Read live runtime

edit({ filePath: "src/app.ts", ... })      → Edit static file  
runtime({ action: "setState", ... })       → Edit live runtime
```

**Same mental model, different backends!**

---

## Meta-Level: MiniBob Developing Itself

### Self-Instrumentation

```
MiniBob Runtime Server running on port 9998
  ↓
MiniBob Activity connects to ws://localhost:9998
  ↓
Activity reads: goalProcessor.currentGoal
  ↓
Activity modifies: executor.config.maxCost = 20
  ↓
MiniBob adjusts its own behavior WHILE RUNNING
```

### Self-Improvement Loop

```
1. MiniBob executes activity
2. Activity connects to MiniBob's own runtime
3. Activity reads performance metrics
4. Activity identifies bottleneck
5. Activity injects optimized code
6. MinoBob gets faster WITHOUT RESTART
7. Repeat
```

**This is the process-of-becoming made literal!**

---

## Implementation Roadmap

### Phase 1: Basic Runtime Server ✅ Designed
- WebSocket server in TUI
- RPC handlers (getState, setState, eval)
- Component registration

### Phase 2: MiniBob Client ✅ Designed
- RuntimeClient class
- Runtime tool for activities
- Process pointer type

### Phase 3: Integration
- Start runtime server in TUI app.tsx
- Instrument sidebar component
- Test with activity

### Phase 4: Advanced Features
- Hot-reload module injection
- Breakpoint injection
- Telemetry streaming
- Self-instrumentation

### Phase 5: Self-Improving MiniBob
- MiniBob instruments itself
- Activities optimize MiniBob runtime
- Autonomous performance tuning

---

## Summary

**"How do we run activities alongside runtime code?"**

**Answer:** By embedding a **Runtime Instrumentation Server** in the running process that exposes:
- State inspection (getState)
- State manipulation (setState)
- Code injection (eval)
- Event streaming (subscribe)

Activities connect via WebSocket/IPC and manipulate the process **as if it were a file** - read state, modify state, inject code - all while the process runs.

**This transforms processes from static artifacts into living, observable, modifiable systems that activities can develop, test, and optimize in real-time.**

The process is no longer separate from development - **it IS the development environment.**
