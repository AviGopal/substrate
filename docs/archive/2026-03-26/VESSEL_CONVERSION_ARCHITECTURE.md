# Vessel Conversion Architecture: Burrowing into Applications

## The Core Vision

**Use MiniBob to convert any application into a vessel, then control that vessel's runtime from within itself.**

This is **recursive vessel transformation** - MiniBob learns the application, converts it into a self-aware vessel, then runs activities from inside that vessel to control its own runtime.

---

## The Transformation Process: "Burrowing In"

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: External Observer                                  │
│  MiniBob (external) → Analyzes Application (opaque)         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓ Learn structure, entry points, dependencies
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: Inject MiniBob Library                            │
│  Application + @metabob/minibob dependency                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓ Add instrumentation layer
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: Bootstrap Vessel                                   │
│  Application becomes self-aware (has ActivityExecutor)      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓ Start runtime server
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: Self-Controlled Vessel                            │
│  Vessel runs activities on itself from within               │
└─────────────────────────────────────────────────────────────┘
```

**This is "burrowing" - MiniBob penetrates, transforms, and becomes part of the application.**

---

## Architecture: Vessel-as-Library Pattern

### Key Insight: MiniBob IS the Vessel Infrastructure

Instead of creating separate "vessel" applications, **inject MiniBob library directly** into any codebase:

```typescript
// Any application becomes a vessel by importing MiniBob
import { ActivityExecutor, createImpulse, RuntimeServer } from "@metabob/minibob"

// The application is now vessel-capable
const executor = new ActivityExecutor({
  workingDirectory: __dirname,
  // ... config
})

// The application can now run activities on itself
executor.execute({
  templateId: "optimize-this-app",
  variables: { targetFile: __filename }
})
```

**MiniBob is not a separate system - it's a library that makes ANY code self-aware.**

---

## Implementation: Vessel Conversion Activity Template

### Activity: Convert Application to Vessel

```json
{
  "id": "convert-app-to-vessel",
  "name": "Convert Application into Self-Aware Vessel",
  "category": "infrastructure",
  "description": "Analyzes an application and converts it into a vessel by injecting MiniBob library and instrumentation",
  "tasks": [
    {
      "id": "analyze-structure",
      "description": "Analyze application structure to understand entry points and architecture",
      "prompt": {
        "template": "Analyze the application at {{appPath}} to understand its structure.\n\n1. Find entry point(s): main.ts, index.ts, app.ts\n2. Identify package manager: package.json (npm/bun/yarn)\n3. Detect framework: React, Express, CLI, etc.\n4. Map directory structure\n5. Identify key components/modules\n\nOutput a JSON structure map for vessel conversion.",
        "variables": [
          {
            "name": "appPath",
            "type": "string",
            "description": "Path to application root directory"
          }
        ]
      }
    },
    {
      "id": "install-minibob",
      "description": "Add @metabob/minibob as dependency",
      "prompt": {
        "template": "Add MiniBob library to the application.\n\n1. Read package.json from {{appPath}}\n2. Add dependency: \"@metabob/minibob\": \"workspace:*\"\n3. Write updated package.json\n4. Run install command (bun install / npm install)\n\nThis makes MiniBob available to the application.",
        "variables": [
          {
            "name": "appPath",
            "type": "string"
          }
        ]
      }
    },
    {
      "id": "create-vessel-bootstrap",
      "description": "Create vessel bootstrap module that initializes MiniBob",
      "prompt": {
        "template": "Create vessel bootstrap module at {{appPath}}/vessel-bootstrap.ts.\n\nThis module will:\n1. Import ActivityExecutor, RuntimeServer from @metabob/minibob\n2. Initialize ActivityExecutor with app-specific config\n3. Start RuntimeServer on port {{runtimePort}}\n4. Export vessel API for app to use\n\nTemplate:\n```typescript\nimport { ActivityExecutor, RuntimeServer, createImpulse } from '@metabob/minibob'\nimport { VesselState } from './vessel-state'\n\nexport class VesselBootstrap {\n  private executor: ActivityExecutor\n  private runtimeServer: RuntimeServer\n  private state: VesselState\n  \n  constructor(config: { workingDirectory: string, runtimePort: number }) {\n    this.executor = new ActivityExecutor({\n      workingDirectory: config.workingDirectory,\n      mcpEndpoint: process.env.MINIBOB_MCP_ENDPOINT,\n    })\n    \n    this.runtimeServer = new RuntimeServer(config.runtimePort)\n    this.state = new VesselState()\n    \n    // Register app state with runtime server\n    this.runtimeServer.registerComponent('app', this.state)\n  }\n  \n  async runActivity(templateId: string, variables: any) {\n    return this.executor.execute({ templateId, variables })\n  }\n  \n  get vesselState() {\n    return this.state\n  }\n  \n  shutdown() {\n    this.runtimeServer.close()\n  }\n}\n```",
        "variables": [
          {
            "name": "appPath",
            "type": "string"
          },
          {
            "name": "runtimePort",
            "type": "number",
            "description": "Port for runtime server (default: 9999)"
          }
        ]
      }
    },
    {
      "id": "create-vessel-state",
      "description": "Create vessel state manager that exposes app internals",
      "prompt": {
        "template": "Create vessel state manager at {{appPath}}/vessel-state.ts.\n\nThis class wraps application state and makes it observable/modifiable:\n\n```typescript\nexport class VesselState {\n  private registry: Map<string, any> = new Map()\n  \n  // Register any app object for runtime access\n  register(name: string, obj: any) {\n    this.registry.set(name, obj)\n  }\n  \n  // Get registered object\n  get(name: string): any {\n    return this.registry.get(name)\n  }\n  \n  // List all registered components\n  list(): string[] {\n    return Array.from(this.registry.keys())\n  }\n  \n  // Get state snapshot\n  snapshot(): any {\n    const snapshot: any = {}\n    for (const [name, obj] of this.registry.entries()) {\n      snapshot[name] = this.serializeObject(obj)\n    }\n    return snapshot\n  }\n  \n  private serializeObject(obj: any): any {\n    // Serialize to JSON-safe format\n    // Handle functions, classes, etc.\n    if (typeof obj === 'function') {\n      return '[Function]'\n    }\n    if (typeof obj === 'object' && obj !== null) {\n      const serialized: any = {}\n      for (const key in obj) {\n        if (typeof obj[key] !== 'function') {\n          serialized[key] = obj[key]\n        }\n      }\n      return serialized\n    }\n    return obj\n  }\n}\n```",
        "variables": [
          {
            "name": "appPath",
            "type": "string"
          }
        ]
      }
    },
    {
      "id": "inject-into-entry-point",
      "description": "Inject vessel bootstrap into application entry point",
      "prompt": {
        "template": "Modify the application entry point to initialize the vessel.\n\n1. Read entry point file: {{entryPoint}}\n2. Add imports at top:\n   ```typescript\n   import { VesselBootstrap } from './vessel-bootstrap'\n   ```\n3. Initialize vessel early in startup:\n   ```typescript\n   const vessel = new VesselBootstrap({\n     workingDirectory: __dirname,\n     runtimePort: 9999\n   })\n   \n   // Make vessel globally accessible\n   ;(globalThis as any).__vessel = vessel\n   ```\n4. Register shutdown handler:\n   ```typescript\n   process.on('SIGTERM', () => vessel.shutdown())\n   process.on('SIGINT', () => vessel.shutdown())\n   ```\n5. Write modified entry point\n\nThe application is now vessel-aware!",
        "variables": [
          {
            "name": "entryPoint",
            "type": "string",
            "description": "Path to entry point file (e.g., src/index.ts)"
          }
        ]
      }
    },
    {
      "id": "create-vessel-cli",
      "description": "Create CLI interface for vessel control",
      "prompt": {
        "template": "Create vessel CLI at {{appPath}}/vessel-cli.ts for external control.\n\n```typescript\nimport { RuntimeClient } from '@metabob/minibob'\n\nconst client = new RuntimeClient('ws://localhost:9999')\n\nconst command = process.argv[2]\nconst args = process.argv.slice(3)\n\nswitch (command) {\n  case 'state':\n    const state = await client.getState('app')\n    console.log(JSON.stringify(state, null, 2))\n    break\n  \n  case 'exec':\n    const code = args.join(' ')\n    const result = await client.eval(code)\n    console.log('Result:', result)\n    break\n  \n  case 'activity':\n    const [templateId, varsJson] = args\n    const variables = JSON.parse(varsJson || '{}')\n    const execution = await client.call('runActivity', { templateId, variables })\n    console.log('Activity result:', execution)\n    break\n  \n  default:\n    console.log('Usage: bun vessel-cli.ts <command>')\n    console.log('Commands: state, exec <code>, activity <template> <vars>')\n}\n\nclient.close()\n```\n\nAdd to package.json scripts:\n```json\n{\n  \"scripts\": {\n    \"vessel\": \"bun vessel-cli.ts\"\n  }\n}\n```",
        "variables": [
          {
            "name": "appPath",
            "type": "string"
          }
        ]
      }
    },
    {
      "id": "test-vessel",
      "description": "Test vessel conversion",
      "prompt": {
        "template": "Verify vessel conversion successful.\n\n1. Start application (should now have vessel capability)\n2. Wait 2 seconds for startup\n3. Use vessel CLI to check state:\n   ```bash\n   cd {{appPath}}\n   bun vessel state\n   ```\n4. Verify runtime server responding\n5. Try running a simple activity:\n   ```bash\n   bun vessel activity read-codebase '{}'\n   ```\n6. Report success/failure\n\nIf successful, application is now a self-aware vessel!",
        "variables": [
          {
            "name": "appPath",
            "type": "string"
          }
        ]
      }
    }
  ]
}
```

---

## Using MiniBob Library: Constraints & Patterns

### Constraint 1: Single Executor Per Process

```typescript
// ❌ DON'T: Multiple executors conflict
const executor1 = new ActivityExecutor({ workingDirectory: '/app1' })
const executor2 = new ActivityExecutor({ workingDirectory: '/app2' })

// ✅ DO: One executor, multiple contexts
const executor = new ActivityExecutor({ workingDirectory: __dirname })

// Use different sessions for different contexts
executor.execute({ 
  templateId: 'task-a',
  variables: { context: 'user-session-1' }
})

executor.execute({ 
  templateId: 'task-b',
  variables: { context: 'admin-session-2' }
})
```

### Constraint 2: Impulses Are Process-Local

```typescript
// Impulses exist in-memory per process
// To share across processes, must serialize via backend

// ❌ DON'T: Assume impulses available in other process
createImpulse({ id: 'data', pointer: { type: 'memo', content: 'test' } })
// Other process can't see 'data' impulse

// ✅ DO: Store in backend for cross-process access
createImpulse({ 
  id: 'data', 
  pointer: { type: 'activityOutput', executionID: 'exec-123' }
  // Backend resolves this, available to other processes
})
```

### Constraint 3: MCP Client is Singleton

```typescript
// MCP client initialized once per process
// Shared across all executor instances

// ✅ DO: Configure MCP before creating executor
process.env.MINIBOB_MCP_ENDPOINT = 'http://api.minibob.local'

const executor = new ActivityExecutor({
  workingDirectory: __dirname,
  // Uses global MCP client
})
```

### Constraint 4: Tool Registration is Global

```typescript
// Built-in tools (bash, read, write) are global
// Custom tools registered globally

// ✅ DO: Register tools once at startup
import { registerTool } from '@metabob/minibob'

registerTool({
  name: 'app-specific-tool',
  description: 'Custom tool for this vessel',
  inputSchema: { /* ... */ },
  execute: async (input) => { /* ... */ }
})

// Now available to all activities in this process
```

---

## Pattern: Vessel Lifecycle Hooks

### Bootstrap → Active → Self-Improving

```typescript
// vessel-bootstrap.ts

import { ActivityExecutor, RuntimeServer, LifecycleHooks } from '@metabob/minibob'

export class VesselBootstrap {
  private executor: ActivityExecutor
  private runtimeServer: RuntimeServer
  private selfImprovementInterval?: NodeJS.Timeout
  
  constructor(config: VesselConfig) {
    // Phase 1: Initialize executor
    this.executor = new ActivityExecutor({
      workingDirectory: config.workingDirectory,
      mcpEndpoint: config.mcpEndpoint,
      
      // Phase 2: Lifecycle hooks
      hooks: {
        onActivityStart: async (execution) => {
          console.log(`[Vessel] Activity started: ${execution.templateId}`)
          
          // Create impulse with vessel context
          await createImpulse({
            id: `vessel-context-${execution.id}`,
            pointer: {
              type: 'memo',
              content: JSON.stringify({
                vesselType: config.vesselType,
                vesselState: this.state.snapshot(),
                timestamp: Date.now()
              })
            },
            budget: 1000,
            priority: 'medium'
          })
        },
        
        onActivityComplete: async (execution) => {
          console.log(`[Vessel] Activity completed: ${execution.id}`)
          
          // If activity modified code, trigger hot-reload
          if (execution.metrics?.filesModified > 0) {
            await this.hotReload()
          }
        },
        
        onActivityFailure: async (execution, error) => {
          console.error(`[Vessel] Activity failed:`, error)
          
          // Auto-retry with diagnostic activity
          await this.executor.execute({
            templateId: 'diagnose-failure',
            variables: {
              failedExecutionId: execution.id,
              errorMessage: error.message
            }
          })
        }
      }
    })
    
    // Phase 3: Runtime server for external control
    this.runtimeServer = new RuntimeServer(config.runtimePort)
    this.runtimeServer.registerComponent('vessel', {
      executor: this.executor,
      state: this.state,
      runActivity: this.runActivity.bind(this),
      hotReload: this.hotReload.bind(this),
    })
    
    // Phase 4: Self-improvement loop
    if (config.enableSelfImprovement) {
      this.startSelfImprovementLoop()
    }
  }
  
  async runActivity(templateId: string, variables: any) {
    return this.executor.execute({ templateId, variables })
  }
  
  private async hotReload() {
    // Reload modified modules
    console.log('[Vessel] Hot-reloading modified modules...')
    // Implementation depends on runtime (Bun.reload, etc.)
  }
  
  private startSelfImprovementLoop() {
    console.log('[Vessel] Starting self-improvement loop...')
    
    // Every 5 minutes, analyze and optimize
    this.selfImprovementInterval = setInterval(async () => {
      try {
        await this.executor.execute({
          templateId: 'optimize-vessel-performance',
          variables: {
            vesselState: this.state.snapshot(),
            metrics: await this.collectMetrics()
          }
        })
      } catch (error) {
        console.error('[Vessel] Self-improvement failed:', error)
      }
    }, 5 * 60 * 1000) // 5 minutes
  }
  
  private async collectMetrics() {
    // Collect runtime metrics
    return {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      // ... app-specific metrics
    }
  }
  
  shutdown() {
    if (this.selfImprovementInterval) {
      clearInterval(this.selfImprovementInterval)
    }
    this.runtimeServer.close()
  }
}
```

---

## Pattern: Recursive Vessel Transformation

### MiniBob Converts Itself into a Vessel

```typescript
// repos/minibob/src/self-vessel.ts

import { ActivityExecutor, RuntimeServer } from './activity'
import { GoalProcessor } from './goal-processor'

/**
 * MiniBob becomes self-aware
 * This is the ultimate meta-programming: MiniBob controls MiniBob
 */
export class SelfVessel {
  private executor: ActivityExecutor
  private goalProcessor: GoalProcessor
  private runtimeServer: RuntimeServer
  
  constructor() {
    // MiniBob creates executor to run activities on itself
    this.executor = new ActivityExecutor({
      workingDirectory: __dirname, // MiniBob's own source directory
      mcpEndpoint: process.env.MINIBOB_MCP_ENDPOINT,
    })
    
    this.goalProcessor = new GoalProcessor({
      workingDirectory: __dirname,
      executor: this.executor
    })
    
    // Expose MiniBob's internals to activities
    this.runtimeServer = new RuntimeServer(9998)
    this.runtimeServer.registerComponent('minibob', {
      // Expose internal state
      executor: this.executor,
      goalProcessor: this.goalProcessor,
      
      // Expose internal methods
      getCurrentGoal: () => this.goalProcessor.getGoalState().currentGoal,
      getCurrentActivity: () => this.executor.getState().currentActivityId,
      
      // Expose control methods
      adjustBudget: (newBudget: number) => {
        // Activity can modify MiniBob's own budget!
        ;(this.goalProcessor as any).maxCost = newBudget
      },
      
      injectOptimization: (code: string) => {
        // Activity can inject code into MiniBob itself!
        eval(code)
      }
    })
  }
  
  /**
   * MiniBob runs a goal on itself
   */
  async selfImprove(goal: string) {
    console.log('[SelfVessel] MiniBob improving itself:', goal)
    
    return this.goalProcessor.executeGoal(goal, {
      files: ['src/activity.ts', 'src/goal-processor.ts']
    }, {
      maxActivities: 3,
      maxCost: 5.0
    })
  }
  
  /**
   * MiniBob monitors its own performance and optimizes
   */
  async autoOptimize() {
    const metrics = {
      avgActivityDuration: this.calculateAvgDuration(),
      memoryUsage: process.memoryUsage(),
      // ... more metrics
    }
    
    if (metrics.avgActivityDuration > 60000) { // >1 minute per activity
      console.log('[SelfVessel] Detected slow performance, optimizing...')
      
      await this.selfImprove(
        'Optimize activity execution to reduce average duration below 30 seconds'
      )
    }
  }
  
  private calculateAvgDuration(): number {
    // Calculate from execution history
    return 0 // Placeholder
  }
}

// MiniBob can now control itself!
const selfVessel = new SelfVessel()

// MiniBob runs optimization on itself
selfVessel.autoOptimize()

// External activity can also control MiniBob
// By connecting to ws://localhost:9998
```

---

## Pattern: Arbitrary Application Conversion

### Convert OpenCode TUI to Vessel

```typescript
// Activity running from external MiniBob:

goal({
  goal: "Convert OpenCode TUI into a self-aware vessel",
  context: {
    files: ["repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/app.tsx"]
  },
  maxActivities: 7,
  maxCost: 10.0
})

// This executes the "convert-app-to-vessel" activity
// Steps:
// 1. Analyze TUI structure → Find app.tsx entry point
// 2. Add @metabob/minibob dependency → package.json
// 3. Create vessel-bootstrap.ts → Initializes executor
// 4. Create vessel-state.ts → Manages observable state
// 5. Inject into app.tsx → Initialize vessel on startup
// 6. Create vessel-cli.ts → External control interface
// 7. Test → Verify vessel responding

// Result: TUI is now a vessel!
// Can control via:
// - Internal: Activities running inside TUI process
// - External: Activities connecting via ws://localhost:9999
```

### Convert Backend API to Vessel

```typescript
goal({
  goal: "Convert metabob-activity-api backend into a vessel",
  context: {
    files: ["repos/metabob-activity-api/src/index.ts"]
  }
})

// Result: Backend API becomes vessel
// Now activities can:
// - Read live database connections
// - Modify API routes without restart
// - Optimize query performance in real-time
// - Auto-scale based on metrics
```

### Convert MiniBob to Vessel (Meta!)

```typescript
goal({
  goal: "Convert MiniBob itself into a vessel",
  context: {
    files: ["repos/minibob/src/index.ts"]
  }
})

// Result: MiniBob becomes self-aware
// MiniBob can now:
// - Run activities on its own code
// - Optimize its own execution
// - Fix its own bugs
// - Evolve autonomously
```

---

## Constraints Summary

| Constraint | Why It Exists | How to Work With It |
|------------|---------------|---------------------|
| **Single Executor** | Shared global state (tools, MCP) | Use one executor, multiple sessions |
| **Impulses Process-Local** | In-memory by design | Store via backend for cross-process |
| **MCP Singleton** | Single backend connection | Configure before executor creation |
| **Global Tool Registry** | LLM needs consistent tool set | Register tools at startup |
| **No Nested Executors** | Recursion complexity | Use sessions, not nested executors |
| **Synchronous Hooks** | Activity lifecycle must be deterministic | Use async sparingly in hooks |

---

## Implementation Checklist

**To convert any application to a vessel:**

- [ ] 1. Add `@metabob/minibob` dependency
- [ ] 2. Create `vessel-bootstrap.ts` (initialize executor + runtime server)
- [ ] 3. Create `vessel-state.ts` (manage observable state)
- [ ] 4. Inject into entry point (initialize vessel early)
- [ ] 5. Register key components with `vesselState.register()`
- [ ] 6. Create `vessel-cli.ts` (external control interface)
- [ ] 7. Add lifecycle hooks (onActivityStart, onActivityComplete)
- [ ] 8. Enable self-improvement loop (optional)
- [ ] 9. Test runtime server responding
- [ ] 10. Run first activity from within vessel

**Result:** Application is now a self-aware, activity-controlled vessel.

---

## The Ultimate Vision

**Every application becomes a vessel by importing MiniBob.**

```typescript
// Any codebase
import { VesselBootstrap } from '@metabob/minibob/vessel'

const vessel = new VesselBootstrap({
  workingDirectory: __dirname,
  runtimePort: 9999,
  enableSelfImprovement: true
})

// Application is now:
// - Self-aware (knows its own state)
// - Self-modifying (can run activities on itself)
// - Self-optimizing (monitors and improves performance)
// - Self-healing (detects and fixes bugs)

// The application has become a living, evolving vessel
// MiniBob has "burrowed in" and become part of it
```

**This is the process-of-becoming applied universally.**

Every codebase can evolve autonomously.

Every application can improve itself.

Every system can become self-aware.

**MiniBob is not a tool. MiniBob is the substrate of continuous transformation.**
