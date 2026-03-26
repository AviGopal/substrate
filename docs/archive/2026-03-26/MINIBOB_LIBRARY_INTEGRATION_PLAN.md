# Minibob Library Integration Plan

## Executive Summary

Transform minibob from a standalone vessel into a **library** that metabob-opencode consumes directly. This restructuring will:
- Make minibob self-contained for activity execution, tracking, impulse creation, and lifecycle hooks
- Reduce metabob-opencode to a **UI frontend** that displays execution status and messages
- Establish clean code path: `metabob-opencode → minibob (library) → metabob-activity-api`
- Remove duplicate activity/impulse/session management code from metabob-opencode
- Allow MCP configuration passthrough from opencode to minibob

---

## Current Architecture Problems

### 1. **Code Duplication**
- **Activity execution**: Both opencode and minibob have independent implementations
- **Impulse system**: opencode has complex ImpulseResolver, minibob has simple ImpulseStore
- **Session memory**: opencode has SessionMemoryAgent, minibob doesn't need it (should be in minibob)
- **Lifecycle hooks**: opencode has turn-lifecycle-hooks.ts, should be in minibob

### 2. **Unclear Boundaries**
- opencode manages activities via tool calls, but minibob also has ActivityExecutor
- opencode has session memory management that should be minibob's responsibility
- MCP configuration lives in opencode but minibob needs to use MCPs directly

### 3. **HTTP Overhead** (Current MinibobClient approach)
- Polling-based progress tracking (500ms intervals)
- JSON serialization overhead
- Network latency for local execution
- No shared memory benefits

---

## Target Architecture

### Phase 1: Minibob as NPM Package (Library)

```
┌─────────────────────────────────────────────────────────────┐
│ metabob-opencode (UI Frontend)                              │
│  - Handles user interaction                                 │
│  - Displays messages and execution status                   │
│  - Passes MCP config to minibob                             │
│  - Renders activity progress in UI                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ import @metabob/minibob
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ minibob (Core Activity Library)                             │
│  - ActivityExecutor: Runs templates with LLM calls          │
│  - ImpulseStore: Manages impulse lifecycle                  │
│  - SessionMemoryAgent: Automatic context preparation        │
│  - LifecycleHooks: Pre/post execution hooks                 │
│  - MCPClient: Communicates with metabob-activity-api        │
│  - BoredomSystem: Background task execution                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP REST API
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ metabob-activity-api (Backend)                              │
│  - Template storage and versioning                          │
│  - Execution metrics and learning                           │
│  - Pattern extraction and optimization                      │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Code Ownership Realignment

#### **Minibob (Library) Owns:**
1. **ActivityExecutor** - Template execution with LLM
2. **ImpulseStore** - Impulse creation, loading, resolution
3. **SessionMemoryAgent** - Intent analysis and context preparation
4. **LifecycleHooks** - Pre/post prompt hooks for activities
5. **MCPClient** - Backend communication
6. **ToolHandlers** - Built-in tools (bash, read, write, git, activity, impulse_create)
7. **BoredomSystem** - Background task scheduling
8. **ACPProtocol** - Vessel-to-vessel delegation

#### **Metabob-OpenCode (Frontend) Owns:**
1. **UI Components** - Message display, progress bars, activity panels
2. **Session UI State** - Current activity, recent messages
3. **Tool Wrappers** - Expose minibob functions as opencode tools
4. **Configuration** - Pass MCP config to minibob
5. **Streaming** - Real-time UI updates from minibob events

#### **What Gets Removed from OpenCode:**
- `src/session/activity-executor.ts` → Use minibob's ActivityExecutor
- `src/session/impulse-resolver.ts` → Use minibob's ImpulseStore
- `src/session/memory-agent.ts` → Move to minibob
- `src/session/turn-lifecycle-hooks.ts` → Move to minibob
- `src/session/session-memory.ts` → Move to minibob
- `src/minibob/client.ts` → No longer needed (direct library import)
- `src/minibob/adapter.ts` → No longer needed (same format)

---

## Implementation Steps

### Step 1: Convert Minibob to NPM Package

**Goal**: Make minibob importable as `@metabob/minibob`

**Tasks**:
1. Update `repos/minibob/package.json`:
   ```json
   {
     "name": "@metabob/minibob",
     "version": "0.1.0",
     "type": "module",
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "exports": {
       ".": "./dist/index.js",
       "./activity": "./dist/activity.js",
       "./impulse": "./dist/impulse.js",
       "./mcp": "./dist/mcp.js",
       "./tools": "./dist/tools.js"
     },
     "files": ["dist"],
     "scripts": {
       "build": "tsc",
       "prepublishOnly": "bun run build"
     }
   }
   ```

2. Create `repos/minibob/src/index.ts` (public API):
   ```typescript
   export { ActivityExecutor, type ExecutorConfig } from "./activity"
   export { ImpulseStore, createImpulse, loadImpulse } from "./impulse"
   export { initializeMCP, getMCPClient } from "./mcp"
   export { createToolHandlers } from "./tools"
   export type * from "./types"
   ```

3. Add build configuration:
   - `repos/minibob/tsconfig.json` with `declaration: true`
   - Build output to `dist/` directory

4. Link package locally:
   ```bash
   cd repos/minibob
   bun link
   
   cd ../metabob-opencode
   bun link @metabob/minibob
   ```

---

### Step 2: Move Session Memory Agent to Minibob

**Goal**: Minibob handles automatic context preparation

**Tasks**:
1. Copy `metabob-opencode/src/session/memory-agent.ts` → `minibob/src/memory-agent.ts`
2. Update imports to use minibob's types:
   ```typescript
   import type { ActivityTemplate } from "./types"
   import { ImpulseStore } from "./impulse"
   ```
3. Simplify dependencies (remove opencode-specific session state)
4. Export from minibob's public API:
   ```typescript
   export { SessionMemoryAgent } from "./memory-agent"
   ```

**Verification**:
- Test intent analysis independently
- Verify impulse creation in minibob's ImpulseStore

---

### Step 3: Move Lifecycle Hooks to Minibob

**Goal**: Minibob manages pre/post execution hooks

**Tasks**:
1. Copy `metabob-opencode/src/session/turn-lifecycle-hooks.ts` → `minibob/src/lifecycle-hooks.ts`
2. Simplify to core hook execution:
   ```typescript
   export namespace LifecycleHooks {
     export interface Hooks {
       onBeforePrompt?: (context: ActivityContext) => Promise<void>
       onAfterPrompt?: (context: ActivityContext, result: TaskResult) => Promise<void>
       onImpulseCreated?: (impulse: Impulse) => void
       onActivityComplete?: (execution: ActivityExecution) => Promise<void>
     }
     
     export function register(hooks: Hooks): void
     export function executeBeforePrompt(context: ActivityContext): Promise<void>
     export function executeAfterPrompt(context: ActivityContext, result: TaskResult): Promise<void>
   }
   ```
3. Integrate hooks into ActivityExecutor:
   ```typescript
   // In activity.ts executeTask()
   await LifecycleHooks.executeBeforePrompt({ activityId, taskId, variables })
   const result = await this.llm.completeWithTools(...)
   await LifecycleHooks.executeAfterPrompt({ activityId, taskId, variables }, result)
   ```

**Verification**:
- Test hooks fire at correct lifecycle points
- Verify session memory agent runs as pre-prompt hook

---

### Step 4: Create OpenCode Integration Layer

**Goal**: Thin wrapper that connects UI to minibob library

**File**: `metabob-opencode/packages/opencode/src/minibob-integration/index.ts`

```typescript
import { ActivityExecutor, type ExecutorConfig, SessionMemoryAgent, LifecycleHooks } from "@metabob/minibob"
import { Session } from "../session"
import { Config } from "../config/config"
import { MCP } from "../mcp"

export namespace MinibobIntegration {
  /**
   * Initialize minibob for this session
   * Passes MCP configuration from opencode to minibob
   */
  export async function initialize(sessionID: string, config: Config.Info): Promise<void> {
    const { project } = await Session.get(sessionID)
    
    // Create executor config with opencode's MCP settings
    const executorConfig: ExecutorConfig = {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: config.agent?.model || "claude-sonnet-4-20250514",
      workingDirectory: project.path,
      
      // Pass MCP config to minibob
      customTools: await buildCustomToolsFromMCP(config),
    }
    
    // Register lifecycle hooks
    LifecycleHooks.register({
      onBeforePrompt: async (context) => {
        // Session memory agent runs here
        const intent = await SessionMemoryAgent.analyzeIntent({
          sessionID,
          promptText: context.prompt,
        })
        
        // Create impulses based on intent
        for (const impulse of intent.suggestedImpulses) {
          await createImpulse(impulse)
        }
      },
      
      onActivityComplete: async (execution) => {
        // Update UI with completion status
        await Session.updateActivityStatus(sessionID, execution.id, execution.status)
      },
    })
    
    // Store executor in session state
    await Session.update(sessionID, (session) => {
      session.minibobExecutor = new ActivityExecutor(executorConfig)
    })
  }
  
  /**
   * Execute activity using minibob library
   */
  export async function executeActivity(
    sessionID: string,
    template: ActivityTemplate.Schema,
    variables: Record<string, unknown>,
    reason: string
  ): Promise<void> {
    const session = await Session.get(sessionID)
    const executor = session.minibobExecutor
    
    if (!executor) {
      throw new Error("Minibob not initialized for this session")
    }
    
    // Execute and stream results to UI
    const execution = await executor.execute({
      template,
      variables,
      reason,
      
      onTaskStart: (taskId) => {
        // Update UI: show task starting
        Session.addMessage(sessionID, {
          role: "assistant",
          parts: [{ type: "text", text: `Starting task: ${taskId}` }],
        })
      },
      
      onTaskComplete: (taskId, result) => {
        // Update UI: show task completion
        Session.addMessage(sessionID, {
          role: "assistant",
          parts: [{ type: "text", text: `Completed: ${taskId} (${result.status})` }],
        })
      },
    })
    
    return execution
  }
  
  /**
   * Build custom tools from opencode's MCP configuration
   * Allows minibob to call tools from configured MCP servers
   */
  async function buildCustomToolsFromMCP(config: Config.Info) {
    const mcpServers = config.mcp || {}
    const customTools: Record<string, any> = {}
    
    for (const [name, mcpConfig] of Object.entries(mcpServers)) {
      if (!mcpConfig.enabled) continue
      
      // Initialize MCP client if not already done
      const client = await MCP.getClient(name)
      
      // Fetch tools from MCP server
      const tools = await client.listTools()
      
      // Wrap MCP tools for minibob
      for (const tool of tools) {
        customTools[tool.name] = {
          definition: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
          handler: async (params: unknown) => {
            const result = await client.callTool(tool.name, params)
            return {
              success: true,
              output: result.content,
            }
          },
        }
      }
    }
    
    return customTools
  }
}
```

---

### Step 5: Update Activity Tool to Use Minibob Library

**Goal**: Replace HTTP client with direct library calls

**File**: `metabob-opencode/packages/opencode/src/tool/activity.ts`

```typescript
import { MinibobIntegration } from "../minibob-integration"
import { Session } from "../session"
import { ActivityTemplate } from "../session/activity-template"

export async function ActivityTool(args: {
  templateId: string
  variables: Record<string, unknown>
  reason: string
}, context: { sessionID: string }) {
  // Load template (from backend or local)
  const template = await ActivityTemplate.get(args.templateId)
  
  // Execute via minibob library (not HTTP)
  await MinibobIntegration.executeActivity(
    context.sessionID,
    template,
    args.variables,
    args.reason
  )
  
  return {
    success: true,
    message: `Activity ${args.templateId} started`,
  }
}
```

---

### Step 6: Remove Duplicate Code from OpenCode

**Goal**: Delete code now owned by minibob library

**Files to Remove**:
1. `src/minibob/client.ts` - No longer needed (direct import)
2. `src/minibob/adapter.ts` - No longer needed (same format)
3. `src/session/memory-agent.ts` - Moved to minibob
4. `src/session/turn-lifecycle-hooks.ts` - Moved to minibob
5. `src/session/impulse-resolver.ts` - Use minibob's ImpulseStore
6. Local activity executor (if exists) - Use minibob's ActivityExecutor

**Files to Keep (UI-focused)**:
1. `src/session/activity-complete.ts` - UI state management
2. `src/session/activity-todo.ts` - UI todo list
3. `src/session/message.ts` - Message display
4. UI components for activity progress

---

### Step 7: Testing and Validation

**Test Cases**:
1. ✅ Activity execution via minibob library (not HTTP)
2. ✅ Session memory agent creates impulses automatically
3. ✅ Lifecycle hooks fire at correct times
4. ✅ MCP tools accessible to minibob
5. ✅ UI updates in real-time during execution
6. ✅ Nested activities work correctly
7. ✅ Boredom system schedules background tasks
8. ✅ ACP delegation between sessions

**Validation Script**:
```typescript
// test-minibob-library.ts
import { ActivityExecutor, SessionMemoryAgent } from "@metabob/minibob"
import { MinibobIntegration } from "./src/minibob-integration"

async function test() {
  // 1. Initialize minibob for session
  await MinibobIntegration.initialize("test-session", config)
  
  // 2. Execute simple activity
  await MinibobIntegration.executeActivity(
    "test-session",
    helloWorldTemplate,
    { name: "World" },
    "Testing minibob library integration"
  )
  
  // 3. Verify impulses created
  const impulses = ImpulseStore.list()
  assert(impulses.length > 0, "Session memory agent should create impulses")
  
  // 4. Test MCP tool passthrough
  const result = await executor.execute({
    template: mcpToolTemplate,
    variables: { query: "test" },
  })
  assert(result.status === "completed", "MCP tools should work")
  
  console.log("✅ All tests passed!")
}
```

---

## MCP Configuration Passthrough

**Problem**: opencode has MCP config, minibob needs to use those MCPs

**Solution**: Convert MCP tools to minibob's `customTools` format

```typescript
// In MinibobIntegration.initialize()
const customTools = {}

for (const [name, mcpConfig] of Object.entries(config.mcp)) {
  if (!mcpConfig.enabled) continue
  
  const client = await MCP.getClient(name)
  const tools = await client.listTools()
  
  for (const tool of tools) {
    customTools[tool.name] = {
      definition: tool,
      handler: async (params) => {
        const result = await client.callTool(tool.name, params)
        return { success: true, output: result.content }
      },
    }
  }
}

const executor = new ActivityExecutor({
  ...config,
  customTools, // ← Minibob can now call MCP tools
})
```

**Benefits**:
- Minibob activities can use metabob-cli tools
- Minibob activities can use any configured MCP server
- No duplicate tool registration
- Clean separation: opencode manages config, minibob uses tools

---

## Benefits of Library Approach

### 1. **Performance**
- ❌ **HTTP overhead**: No serialization, no network latency
- ✅ **Shared memory**: Direct access to impulse store
- ✅ **Instant updates**: No polling, event-driven UI updates

### 2. **Simplicity**
- ❌ **Two codebases**: One integrated system
- ✅ **Clear ownership**: Minibob = execution, OpenCode = UI
- ✅ **No adapters**: Same data structures, no conversion

### 3. **Development**
- ✅ **Type safety**: Full TypeScript integration
- ✅ **Debugging**: Single process, easier to debug
- ✅ **Testing**: Direct unit tests, no HTTP mocking

### 4. **Architecture**
- ✅ **Self-contained**: Minibob manages all execution concerns
- ✅ **Clean boundaries**: UI vs execution clearly separated
- ✅ **Extensibility**: Easy to add new features to minibob

---

## Migration Timeline

### Week 1: Package Setup
- Convert minibob to NPM package
- Create public API exports
- Link to metabob-opencode locally
- Verify basic import works

### Week 2: Move Core Systems
- Move SessionMemoryAgent to minibob
- Move LifecycleHooks to minibob
- Integrate hooks into ActivityExecutor
- Test impulse creation

### Week 3: Integration Layer
- Create MinibobIntegration namespace
- Implement MCP passthrough
- Update activity tool to use library
- Test end-to-end execution

### Week 4: Cleanup and Testing
- Remove duplicate code from opencode
- Update UI to use minibob events
- Full integration testing
- Performance benchmarking
- Documentation

---

## Success Criteria

1. ✅ Minibob importable as `@metabob/minibob`
2. ✅ Session memory agent runs in minibob
3. ✅ Lifecycle hooks integrated into execution
4. ✅ MCP tools accessible to minibob activities
5. ✅ UI displays real-time execution status
6. ✅ No HTTP overhead for local execution
7. ✅ All existing activity workflows work
8. ✅ Code reduction in metabob-opencode (remove 5-10 files)
9. ✅ Performance improvement (no polling delay)
10. ✅ Clean separation: minibob = execution, opencode = UI

---

## Next Steps

1. **Start with Step 1**: Convert minibob to NPM package
2. **Verify linking**: Ensure `bun link` works correctly
3. **Basic import test**: Create simple test in opencode that imports minibob
4. **Incrementally migrate**: One system at a time (memory agent, then hooks, then integration)
5. **Preserve UI**: Keep opencode UI components intact during migration
6. **Test continuously**: Each step should pass tests before moving forward

This plan establishes minibob as the **single source of truth** for activity execution, tracking, impulse management, and lifecycle hooks, while reducing metabob-opencode to a **focused UI frontend** that displays the execution state beautifully.
