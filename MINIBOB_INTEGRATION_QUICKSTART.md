# minibob Integration Quick Start Guide

## TL;DR

Transform metabob-opencode to use minibob as a library for activity execution:

```bash
# 1. Package minibob
cd repos/minibob
# Update package.json exports

# 2. Link to opencode workspace
cd ../metabob-opencode
# Add @metabob/minibob to dependencies

# 3. Update activity tool
# Replace Activity.execute() with minibob.ActivityExecutor

# 4. Remove old code
# Delete src/session/activity*.ts, impulse*.ts, memory*.ts

# Total time: 17-27 hours
```

---

## Phase 1: Package minibob (1-2 hours)

### 1.1 Update minibob package.json

**File:** `repos/minibob/package.json`

```json
{
  "name": "@metabob/minibob",
  "version": "0.1.0",
  "description": "Minimal vessel for activity execution",
  "main": "index.ts",
  "module": "index.ts",
  "type": "module",
  "exports": {
    ".": "./index.ts",
    "./activity": "./src/activity.ts",
    "./impulse": "./src/impulse.ts",
    "./mcp": "./src/mcp.ts",
    "./tools": "./src/tools.ts",
    "./types": "./src/types.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

### 1.2 Create minibob index.ts

**File:** `repos/minibob/index.ts`

```typescript
// Main exports for minibob library
export {
  ActivityExecutor,
  loadTemplate,
  loadTemplateFromMCPOrLocal,
  runActivity,
  type ExecutorConfig,
  type ExecuteOptions,
} from "./src/activity"

export {
  createImpulse,
  loadImpulse,
  loadImpulses,
  formatImpulsesForContext,
  registerResolver,
  storeActivityOutput,
  getImpulseStore,
} from "./src/impulse"

export {
  initializeMCP,
  getMCPClient,
  isMCPEnabled,
} from "./src/mcp"

export {
  createToolHandlers,
  getAllToolDefinitions,
} from "./src/tools"

export type {
  ActivityTemplate,
  ActivityExecution,
  ActivityTask,
  TaskResult,
  Impulse,
  ImpulsePointer,
  Message,
} from "./src/types"
```

### 1.3 Add to opencode workspace

**File:** `repos/metabob-opencode/package.json`

```json
{
  "workspaces": {
    "packages": [
      "packages/*",
      "../minibob"  // Add minibob to workspace
    ]
  }
}
```

**File:** `repos/metabob-opencode/packages/opencode/package.json`

```json
{
  "dependencies": {
    "@metabob/minibob": "workspace:*"
  }
}
```

### 1.4 Install and test

```bash
cd repos/metabob-opencode
bun install

# Test import
cd packages/opencode
bun run -e "import('@metabob/minibob').then(m => console.log(Object.keys(m)))"
```

**Expected output:**
```
[ 'ActivityExecutor', 'createImpulse', 'loadImpulse', ... ]
```

---

## Phase 2: Create Adapter (2-3 hours)

### 2.1 Create executor adapter

**File:** `repos/metabob-opencode/packages/opencode/src/minibob/executor-adapter.ts`

```typescript
import type { ExecutorConfig } from "@metabob/minibob"
import { ActivityExecutor } from "@metabob/minibob"
import type { Session } from "../session/session"
import type { Config } from "../config/config"
import { getMCPClient } from "./mcp-bridge"

export namespace MinibobExecutorAdapter {
  /**
   * Create a minibob ActivityExecutor configured from OpenCode session and config
   */
  export async function createExecutor(
    session: Session.Info,
    config: Config.Info
  ): Promise<ActivityExecutor> {
    const executorConfig: ExecutorConfig = {
      provider: "anthropic",
      apiKey: config.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
      model: session.agent.model,
      workingDirectory: session.project.directory,
      systemPrompt: buildSystemPrompt(session),
      customTools: {}, // Add OpenCode-specific tools if needed
    }

    const executor = new ActivityExecutor(executorConfig)
    return executor
  }

  /**
   * Build system prompt from session context
   */
  function buildSystemPrompt(session: Session.Info): string {
    // Use session.agent.systemPrompt if available
    // Otherwise build from scratch
    return session.agent.systemPrompt ?? `You are ${session.agent.name}, an AI assistant.`
  }
}
```

### 2.2 Create MCP bridge

**File:** `repos/metabob-opencode/packages/opencode/src/minibob/mcp-bridge.ts`

```typescript
import { initializeMCP as initMinibobMCP } from "@metabob/minibob/mcp"
import type { Config } from "../config/config"
import { Log } from "../util/log"

const log = Log.create({ service: "minibob-mcp-bridge" })

/**
 * Initialize minibob MCP client with OpenCode config
 */
export async function initializeMinibobMCP(config: Config.Info): Promise<void> {
  const mcpConfig = config.mcp?.metabob
  
  if (!mcpConfig?.enabled) {
    log.info("MCP disabled in config, skipping minibob MCP initialization")
    return
  }

  try {
    log.info("Initializing minibob MCP client", { url: mcpConfig.url })
    
    await initMinibobMCP({
      endpoint: mcpConfig.url,
      apiKey: config.metabob?.apiKey ?? "",
      timeout: mcpConfig.timeout ?? 30000,
    })
    
    log.info("Minibob MCP client initialized successfully")
  } catch (error) {
    log.error("Failed to initialize minibob MCP client", { error })
    throw error
  }
}

/**
 * Re-export getMCPClient for convenience
 */
export { getMCPClient, isMCPEnabled } from "@metabob/minibob/mcp"
```

---

## Phase 3: Update Tools (5-8 hours)

### 3.1 Update activity tool

**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Before:**
```typescript
import { Activity } from "../session/activity"

export const activity = Tool.define({
  name: "activity",
  description: "Execute an activity template",
  async handler({ session, parameters }) {
    return Activity.execute(session, parameters)
  }
})
```

**After:**
```typescript
import { MinibobExecutorAdapter } from "../minibob/executor-adapter"
import { loadTemplateFromMCPOrLocal } from "@metabob/minibob/activity"
import type { ActivityExecution } from "@metabob/minibob"
import { Tool } from "../session/tool"

export const activity = Tool.define({
  name: "activity",
  description: "Execute an activity template",
  async handler({ session, config, parameters }) {
    // Create minibob executor
    const executor = await MinibobExecutorAdapter.createExecutor(session, config)
    
    // Load template
    const template = await loadTemplateFromMCPOrLocal(parameters.templateId)
    
    // Execute with UI callbacks
    const execution: ActivityExecution = await executor.execute({
      template,
      variables: parameters.variables ?? {},
      reason: parameters.reason,
      onTaskStart: (taskId) => {
        // Update UI: show task starting
        session.ui?.updateActivityProgress({
          activityId: execution.id,
          currentTask: taskId,
          status: "running"
        })
      },
      onTaskComplete: (taskId, result) => {
        // Update UI: show task completed
        session.ui?.updateActivityProgress({
          activityId: execution.id,
          completedTask: taskId,
          result: result.status
        })
      }
    })
    
    // Return result
    return {
      activityId: execution.id,
      templateId: execution.templateId,
      status: execution.status,
      metrics: execution.metrics,
      taskResults: execution.taskResults.map(r => ({
        taskId: r.taskId,
        status: r.status,
        output: r.output,
        error: r.error
      }))
    }
  }
})
```

### 3.2 Update impulse_create tool

**File:** `repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts`

**Before:**
```typescript
import { ImpulseManager } from "../session/impulse-manager"

export const impulse_create = Tool.define({
  handler({ session, parameters }) {
    return ImpulseManager.create(session, parameters)
  }
})
```

**After:**
```typescript
import { createImpulse } from "@metabob/minibob/impulse"
import { Tool } from "../session/tool"

export const impulse_create = Tool.define({
  name: "impulse_create",
  description: "Create an impulse for context management",
  async handler({ session, parameters }) {
    // Create impulse via minibob
    const impulse = createImpulse({
      id: parameters.id,
      pointer: parameters.pointer,
      budget: parameters.budget ?? 4000,
      priority: parameters.priority ?? "medium"
    })
    
    // Update UI sidebar
    session.ui?.addImpulseToSidebar(impulse)
    
    // Return impulse info
    return {
      id: impulse.id,
      type: impulse.pointer.type,
      budget: impulse.budget,
      loaded: impulse.loaded
    }
  }
})
```

### 3.3 Update other impulse tools

**Files to update:**
- `impulse-load.ts` → Use `loadImpulse()`
- `impulse-list.ts` → Use `getImpulseStore().list()`
- `impulse-delete.ts` → Use `getImpulseStore().delete()`
- `impulse-unload.ts` → Use `getImpulseStore().unload()`

**Template for each:**
```typescript
import { loadImpulse, getImpulseStore } from "@metabob/minibob/impulse"

export const impulse_load = Tool.define({
  async handler({ parameters }) {
    const impulse = await loadImpulse(parameters.id)
    return { id: impulse.id, loaded: true, tokenCount: impulse.tokenCount }
  }
})
```

---

## Phase 4: Remove Old Code (2-3 hours)

### 4.1 Delete activity system files

```bash
cd repos/metabob-opencode/packages/opencode

# Delete activity system
rm src/session/activity.ts
rm src/session/activity-*.ts

# Delete impulse system
rm src/session/impulse-*.ts

# Delete memory agent
rm src/session/memory-agent.ts
rm src/session/memory-manager.ts
rm src/session/memory-lifecycle.ts

# Delete lifecycle hooks
rm src/session/turn-lifecycle.ts
rm src/session/turn-lifecycle-hooks.ts
rm src/session/activity-lifecycle-logger.ts
```

### 4.2 Update imports

**Find all references:**
```bash
rg "from.*session/activity['\"]" -l
rg "from.*session/impulse" -l
rg "from.*session/memory" -l
```

**Replace with minibob imports:**
```typescript
// Before
import { Activity } from "../session/activity"
import { ImpulseManager } from "../session/impulse-manager"

// After
import { ActivityExecutor } from "@metabob/minibob"
import { createImpulse, loadImpulse } from "@metabob/minibob/impulse"
```

---

## Phase 5: Update UI (2-3 hours)

### 5.1 Add activity progress panel

**File:** `repos/metabob-opencode/packages/opencode/src/server/tui.ts`

```typescript
import type { ActivityExecution } from "@metabob/minibob"

function ActivityProgressPanel({ execution }: { execution: ActivityExecution }) {
  const completedTasks = execution.taskResults.filter(r => r.status === "completed").length
  const totalTasks = execution.taskResults.length
  const progress = Math.round((completedTasks / totalTasks) * 100)
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue">
      <Text bold>Activity: {execution.templateId}</Text>
      <Text>Status: {execution.status}</Text>
      <Text>Progress: {progress}% ({completedTasks}/{totalTasks} tasks)</Text>
      <ProgressBar value={progress} />
      {execution.metrics && (
        <>
          <Text>Duration: {execution.metrics.duration}ms</Text>
          <Text>Cost: ${execution.metrics.cost.toFixed(4)}</Text>
        </>
      )}
    </Box>
  )
}
```

### 5.2 Update impulse sidebar

**File:** `repos/metabob-opencode/packages/opencode/src/server/tui-impulse-sidebar.ts`

```typescript
import { getImpulseStore } from "@metabob/minibob/impulse"

function ImpulseSidebar() {
  const impulses = getImpulseStore().list()
  
  return (
    <Box flexDirection="column">
      <Text bold>Impulses ({impulses.length})</Text>
      {impulses.map(imp => (
        <Box key={imp.id}>
          <Text>{imp.id} ({imp.pointer.type})</Text>
          <Text dimColor>{imp.loaded ? `${imp.tokenCount}/${imp.budget}` : "not loaded"}</Text>
        </Box>
      ))}
    </Box>
  )
}
```

---

## Phase 6: Initialize MCP (1-2 hours)

### 6.1 Initialize in session creation

**File:** `repos/metabob-opencode/packages/opencode/src/session/session.ts`

```typescript
import { initializeMinibobMCP } from "../minibob/mcp-bridge"

export namespace Session {
  export async function create(config: Config.Info): Promise<Session.Info> {
    // ... existing session creation ...
    
    // Initialize minibob MCP
    if (config.mcp?.metabob?.enabled) {
      await initializeMinibobMCP(config)
    }
    
    return session
  }
}
```

---

## Phase 7: Test (4-6 hours)

### 7.1 Integration test

**File:** `repos/metabob-opencode/packages/opencode/tests/minibob-integration.test.ts`

```typescript
import { describe, it, expect } from "bun:test"
import { ActivityExecutor } from "@metabob/minibob"
import { createImpulse, loadImpulse } from "@metabob/minibob/impulse"

describe("minibob integration", () => {
  it("should execute activity template", async () => {
    const executor = new ActivityExecutor({
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: "claude-sonnet-4-20250514",
      workingDirectory: process.cwd()
    })
    
    const template = {
      id: "test-activity",
      name: "Test Activity",
      category: "feature" as const,
      tasks: [{
        id: "task-1",
        description: "Echo hello",
        prompt: {
          template: "Echo 'hello world'",
          maxTokens: 1000,
          variables: []
        }
      }]
    }
    
    const result = await executor.execute({ template, variables: {} })
    
    expect(result.status).toBe("completed")
    expect(result.taskResults).toHaveLength(1)
  })
  
  it("should create and load impulses", async () => {
    const impulse = createImpulse({
      id: "test-impulse",
      pointer: { type: "memo", content: "test content" },
      budget: 1000,
      priority: "medium"
    })
    
    expect(impulse.id).toBe("test-impulse")
    expect(impulse.loaded).toBe(false)
    
    const loaded = await loadImpulse("test-impulse")
    expect(loaded.loaded).toBe(true)
    expect(loaded.content).toBe("test content")
  })
})
```

### 7.2 Run tests

```bash
cd repos/metabob-opencode/packages/opencode
bun test tests/minibob-integration.test.ts
```

### 7.3 Manual testing

```bash
# Start opencode
bun run dev

# In UI:
# 1. Create an impulse
impulse_create({ id: "test", pointer: { type: "memo", content: "test" }, budget: 1000 })

# 2. Run an activity
activity({ templateId: "hello-world", variables: {}, reason: "testing" })

# 3. Check UI updates
# - Activity progress panel shows progress
# - Impulse sidebar shows impulse
```

---

## Validation Checklist

- [ ] minibob packaged as npm library
- [ ] OpenCode imports minibob successfully
- [ ] Activity tool uses minibob executor
- [ ] Impulse tools use minibob impulse system
- [ ] Old code deleted (activity*.ts, impulse*.ts, memory*.ts)
- [ ] UI displays activity progress
- [ ] UI displays impulse sidebar
- [ ] MCP connection works
- [ ] Integration tests pass
- [ ] Manual testing successful

---

## Troubleshooting

### Import errors

**Error:** `Cannot find module '@metabob/minibob'`

**Fix:**
```bash
cd repos/metabob-opencode
bun install  # Re-install to link workspace package
```

### MCP connection fails

**Error:** `Failed to initialize minibob MCP client`

**Fix:**
1. Check `config.mcp.metabob.url` is correct
2. Verify metabob-activity-api is running
3. Check API key is valid

### Activity execution fails

**Error:** `Template not found`

**Fix:**
1. Verify template exists in MCP backend
2. Check template ID is correct
3. Try loading from local file first

### UI not updating

**Error:** Activity progress not showing

**Fix:**
1. Check `onTaskStart`/`onTaskComplete` callbacks are wired
2. Verify `session.ui?.updateActivityProgress()` is called
3. Check TUI component is rendering correctly

---

## Quick Reference

### minibob Exports

```typescript
// Activity
import { ActivityExecutor, loadTemplateFromMCPOrLocal } from "@metabob/minibob"

// Impulse
import { createImpulse, loadImpulse, getImpulseStore } from "@metabob/minibob/impulse"

// MCP
import { initializeMCP, getMCPClient, isMCPEnabled } from "@metabob/minibob/mcp"

// Types
import type { ActivityExecution, Impulse, ActivityTemplate } from "@metabob/minibob"
```

### Common Patterns

**Execute activity:**
```typescript
const executor = new ActivityExecutor(config)
const template = await loadTemplateFromMCPOrLocal("template-id")
const result = await executor.execute({ template, variables: {}, reason: "..." })
```

**Create impulse:**
```typescript
const impulse = createImpulse({
  id: "my-impulse",
  pointer: { type: "file", path: "src/file.ts" },
  budget: 4000,
  priority: "high"
})
```

**Load impulse:**
```typescript
const impulse = await loadImpulse("my-impulse")
console.log(impulse.content) // File content loaded
```

---

## Next Steps

1. ✅ Complete Phase 1 (package minibob)
2. ⏳ Complete Phase 2 (create adapter)
3. ⏳ Complete Phase 3 (update tools)
4. ⏳ Complete Phase 4 (remove old code)
5. ⏳ Complete Phase 5 (update UI)
6. ⏳ Complete Phase 6 (initialize MCP)
7. ⏳ Complete Phase 7 (test)
8. ⏳ Merge to main

**Estimated Total Time:** 17-27 hours
