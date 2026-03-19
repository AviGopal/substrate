# MiniBob Integration - Implementation Guide
## Step-by-Step Implementation with Code Examples

**Date**: 2026-03-18
**Context**: Practical guide for integrating MiniBob as library into metabob-opencode

---

## Quick Start: 30-Minute Proof of Concept

### Step 1: Install MiniBob Dependency (5 minutes)

```bash
cd repos/metabob-opencode/packages/opencode

# Add MiniBob as local dependency
npm install --save ../../../minibob

# Or manually add to package.json:
```

**`packages/opencode/package.json`**:
```json
{
  "dependencies": {
    "@metabob/minibob": "file:../../../minibob",
    // ... existing dependencies
  }
}
```

```bash
npm install
npm run typecheck  # Should resolve MiniBob types
```

---

### Step 2: Create Basic Adapter (15 minutes)

**`packages/opencode/src/adapters/minibob-adapter.ts`**:
```typescript
/**
 * MiniBob Adapter
 * 
 * Bridges OpenCode activity execution to MiniBob library.
 * Translates between OpenCode's Activity.Info and MiniBob's ActivityExecution.
 */

import { ActivityExecutor, type ExecutorConfig, type ExecuteOptions } from "@metabob/minibob/src/activity"
import { loadTemplateFromMCPOrLocal } from "@metabob/minibob/src/activity"
import type { ActivityExecution, TaskResult, ActivityTemplate as MiniBobTemplate } from "@metabob/minibob/src/types"
import { Config } from "../config/config"
import { Activity } from "../session/activity"
import { Log } from "../util/log"

const log = Log.create({ service: "minibob-adapter" })

export class MiniBobAdapter {
  /**
   * Create MiniBob executor configuration from OpenCode config
   */
  static createExecutorConfig(customTools?: ExecutorConfig["customTools"]): ExecutorConfig {
    const config = Config.load()
    
    return {
      provider: config.provider.type as "anthropic" | "openai",
      apiKey: config.provider.apiKey,
      model: config.provider.model,
      workingDirectory: process.cwd(),
      customTools,
    }
  }

  /**
   * Execute an activity template via MiniBob
   */
  static async executeActivity(options: {
    templateId: string
    variables: Record<string, unknown>
    reason?: string
    onTaskStart?: (taskId: string) => void
    onTaskComplete?: (taskId: string, result: TaskResult) => void
  }): Promise<ActivityExecution> {
    log.debug("executing activity via MiniBob", { 
      templateId: options.templateId,
      variables: Object.keys(options.variables),
    })

    // Create executor
    const config = this.createExecutorConfig()
    const executor = new ActivityExecutor(config)

    // Load template from MCP or local
    const template = await loadTemplateFromMCPOrLocal(options.templateId)
    
    log.debug("loaded template", {
      id: template.id,
      name: template.name,
      taskCount: template.tasks.length,
    })

    // Execute
    const execution = await executor.execute({
      template,
      variables: options.variables,
      reason: options.reason,
      onTaskStart: options.onTaskStart,
      onTaskComplete: options.onTaskComplete,
    })

    log.info("activity execution complete", {
      id: execution.id,
      status: execution.status,
      duration: execution.metrics?.duration,
      cost: execution.metrics?.cost,
    })

    return execution
  }

  /**
   * Translate MiniBob execution result to OpenCode Activity.Info
   */
  static translateExecution(
    minibobExecution: ActivityExecution,
    activityInfo: Activity.Info
  ): Partial<Activity.Info> {
    const isComplete = minibobExecution.status === "completed"
    const isFailed = minibobExecution.status === "failed"

    return {
      status: isComplete ? "done" : isFailed ? "failed" : "executing",
      completedAt: minibobExecution.completedAt,
      stats: {
        tokens: {
          input: minibobExecution.metrics?.totalTokens.input ?? 0,
          output: minibobExecution.metrics?.totalTokens.output ?? 0,
          reasoning: 0, // MiniBob doesn't track extended thinking separately yet
          cache: {
            read: 0, // MiniBob doesn't expose cache stats yet
            write: 0,
          },
        },
        cost: {
          total: minibobExecution.metrics?.cost ?? 0,
          perPrompt: minibobExecution.taskResults.map(task => ({
            file: task.taskId,
            cost: task.tokens 
              ? ((task.tokens.input / 1_000_000) * 3.0 + (task.tokens.output / 1_000_000) * 15.0)
              : 0,
          })),
        },
        metabob: activityInfo.stats.metabob, // Keep existing metabob stats
        duration: minibobExecution.metrics?.duration ?? 0,
      },
    }
  }

  /**
   * Translate MiniBob template to OpenCode ActivityTemplate
   */
  static translateTemplate(minibobTemplate: MiniBobTemplate): any {
    // TODO: Implement full translation if needed
    // For now, MiniBob templates are compatible with OpenCode
    return minibobTemplate
  }
}
```

---

### Step 3: Test Adapter (10 minutes)

**`packages/opencode/src/adapters/__tests__/minibob-adapter.test.ts`**:
```typescript
import { MiniBobAdapter } from "../minibob-adapter"
import { describe, it, expect, beforeAll } from "bun:test"

describe("MiniBobAdapter", () => {
  beforeAll(() => {
    // Set up test environment
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key"
  })

  it("should create executor config from OpenCode config", () => {
    const config = MiniBobAdapter.createExecutorConfig()
    
    expect(config.provider).toBe("anthropic")
    expect(config.apiKey).toBeDefined()
    expect(config.model).toBeDefined()
    expect(config.workingDirectory).toBe(process.cwd())
  })

  it("should execute a simple activity template", async () => {
    // Create a simple test template
    const execution = await MiniBobAdapter.executeActivity({
      templateId: "repos/minibob/templates/hello-world.json",
      variables: { message: "test" },
      reason: "Integration test",
    })

    expect(execution.id).toBeDefined()
    expect(execution.status).toMatch(/completed|failed/)
    expect(execution.metrics).toBeDefined()
  })

  it("should translate MiniBob execution to OpenCode Activity.Info", () => {
    const minibobExecution = {
      id: "act_123",
      templateId: "test-template",
      status: "completed" as const,
      variables: {},
      impulses: [],
      taskResults: [
        {
          taskId: "task-1",
          status: "completed" as const,
          output: "Test output",
          startedAt: Date.now(),
          completedAt: Date.now() + 1000,
          tokens: { input: 100, output: 50 },
        },
      ],
      startedAt: Date.now(),
      completedAt: Date.now() + 1000,
      metrics: {
        duration: 1000,
        cost: 0.005,
        totalTokens: { input: 100, output: 50 },
      },
    }

    const mockActivityInfo: any = {
      stats: {
        metabob: {
          enabled: false,
          issuesResolved: 0,
          issuesAdded: 0,
          totalParticipations: 0,
          totalContextTokens: 0,
        },
      },
    }

    const translated = MiniBobAdapter.translateExecution(minibobExecution, mockActivityInfo)

    expect(translated.status).toBe("done")
    expect(translated.completedAt).toBeDefined()
    expect(translated.stats?.tokens.input).toBe(100)
    expect(translated.stats?.tokens.output).toBe(50)
    expect(translated.stats?.cost.total).toBe(0.005)
  })
})
```

Run test:
```bash
npm run test -- adapters/__tests__/minibob-adapter.test.ts
```

---

## Full Integration: Replacing Activity Execution

### Step 4: Modify Activity Tool

**`packages/opencode/src/tool/activity.ts`** (modified sections):

```typescript
// At the top, add MiniBob import
import { MiniBobAdapter } from "../adapters/minibob-adapter"

// Replace the execute function (around line 300-800)
async execute(params: z.infer<typeof Tool.ActivityTool.Parameters>): Promise<string> {
  const log = Log.create({ service: "activity-tool" })
  
  // ... (keep existing variable validation and setup) ...

  try {
    // ========== NEW: Use MiniBob instead of TrailblazingExecutor ==========
    const execution = await MiniBobAdapter.executeActivity({
      templateId: params.templateId,
      variables: params.variables,
      reason: params.reason,
      onTaskStart: (taskId) => {
        log.info("task started", { taskId })
        // Update UI if needed
      },
      onTaskComplete: (taskId, result) => {
        log.info("task completed", { 
          taskId, 
          status: result.status,
          duration: result.completedAt ? result.completedAt - (result.startedAt ?? 0) : 0,
        })
        // Update UI if needed
      },
    })

    // Update OpenCode activity record with MiniBob results
    const activity = await Activity.get(activityId)
    const updates = MiniBobAdapter.translateExecution(execution, activity)
    await Activity.update(activityId, updates)

    // Return success message
    return this.formatSuccessMessage(execution)
    // ======================================================================
  } catch (error) {
    log.error("activity execution failed", { error })
    throw error
  }
}

// Helper function to format success message
private formatSuccessMessage(execution: any): string {
  const { status, metrics, taskResults } = execution
  
  const completedTasks = taskResults.filter((t: any) => t.status === "completed").length
  const failedTasks = taskResults.filter((t: any) => t.status === "failed").length

  return `
Activity execution ${status}

Tasks:
  ✓ Completed: ${completedTasks}
  ${failedTasks > 0 ? `✗ Failed: ${failedTasks}` : ""}

Metrics:
  Duration: ${metrics?.duration}ms
  Cost: $${metrics?.cost.toFixed(4)}
  Tokens: ${metrics?.totalTokens.input} in / ${metrics?.totalTokens.output} out

${status === "failed" ? `\nError: ${taskResults.find((t: any) => t.status === "failed")?.error}` : ""}
  `.trim()
}
```

---

### Step 5: Update Session Activity Module

**`packages/opencode/src/session/activity.ts`** (add MiniBob execution helper):

```typescript
import { MiniBobAdapter } from "../adapters/minibob-adapter"

// Add new function for MiniBob-based execution
export async function executeViaMiniBob(options: {
  activityId: string
  templateId: string
  variables: Record<string, unknown>
  reason?: string
}): Promise<void> {
  const { activityId, templateId, variables, reason } = options

  log.info("executing activity via MiniBob", { activityId, templateId })

  try {
    // Update status to executing
    await update(activityId, { status: "executing" })

    // Execute via MiniBob
    const execution = await MiniBobAdapter.executeActivity({
      templateId,
      variables,
      reason,
      onTaskStart: (taskId) => {
        log.debug("task started", { activityId, taskId })
      },
      onTaskComplete: (taskId, result) => {
        log.debug("task completed", { activityId, taskId, status: result.status })
      },
    })

    // Translate and update activity record
    const activity = await get(activityId)
    const updates = MiniBobAdapter.translateExecution(execution, activity)
    
    await update(activityId, {
      ...updates,
      status: execution.status === "completed" ? "done" : "failed",
    })

    log.info("activity execution complete", { 
      activityId, 
      status: execution.status,
      duration: execution.metrics?.duration,
    })
  } catch (error) {
    log.error("MiniBob execution failed", { activityId, error })
    await update(activityId, { status: "failed" })
    throw error
  }
}
```

---

## Advanced Integration: Impulse Bridge

### Step 6: Create Impulse Bridge

**`packages/opencode/src/adapters/minibob-impulse-bridge.ts`**:

```typescript
/**
 * MiniBob Impulse Bridge
 * 
 * Translates between OpenCode's 14 impulse types and MiniBob's 4 core types.
 * Provides custom resolvers for OpenCode-specific impulse types.
 */

import { createImpulse, loadImpulses, getImpulseStore } from "@metabob/minibob/src/impulse"
import type { Impulse as MiniBobImpulse, ImpulsePointer } from "@metabob/minibob/src/types"
import type { ActivityTemplate } from "../session/activity-template"

export class MiniBobImpulseBridge {
  /**
   * Translate OpenCode impulse to MiniBob impulse
   */
  static translateImpulse(
    openCodeImpulse: ActivityTemplate.Impulse.Schema
  ): MiniBobImpulse {
    const { id, type, priority, budget } = openCodeImpulse

    // Map OpenCode impulse types to MiniBob pointer types
    let pointer: ImpulsePointer

    switch (type) {
      case "memo":
        pointer = { type: "memo", content: openCodeImpulse.content ?? "" }
        break

      case "file":
        pointer = { 
          type: "file", 
          path: openCodeImpulse.path ?? openCodeImpulse.content ?? "",
          offset: openCodeImpulse.offset,
          limit: openCodeImpulse.limit,
        }
        break

      case "activityOutput":
        pointer = { 
          type: "activityOutput", 
          activityId: openCodeImpulse.activityId ?? "",
          taskId: openCodeImpulse.taskId,
        }
        break

      // OpenCode-specific types → custom resolvers
      case "glob":
      case "command":
      case "git":
      case "search":
      case "metabob":
      case "conversation":
      case "prompt":
      case "session":
      case "directory":
      case "snippet":
        pointer = {
          type: "custom",
          resolver: type,
          data: { ...openCodeImpulse },
        }
        break

      default:
        pointer = {
          type: "custom",
          resolver: "unknown",
          data: { ...openCodeImpulse },
        }
    }

    return createImpulse({
      id,
      pointer,
      budget: budget ?? 5000,
      priority: (priority as "critical" | "high" | "medium" | "low") ?? "medium",
    })
  }

  /**
   * Register custom resolvers for OpenCode-specific impulse types
   */
  static registerCustomResolvers(): void {
    const store = getImpulseStore()

    // Glob resolver
    store.registerResolver("glob", async (data) => {
      const pattern = data.pattern as string
      const cwd = (data.cwd as string) ?? process.cwd()
      
      // Use Bun.Glob
      const glob = new Bun.Glob(pattern)
      const files: string[] = []
      
      for await (const file of glob.scan({ cwd })) {
        files.push(file)
        if (files.length >= 50) break // Limit to 50 files
      }
      
      return files.join("\n")
    })

    // Command resolver
    store.registerResolver("command", async (data) => {
      const command = data.command as string
      
      const proc = Bun.spawn(["bash", "-c", command], {
        stdout: "pipe",
        stderr: "pipe",
      })
      
      const output = await new Response(proc.stdout).text()
      return output
    })

    // Git resolver
    store.registerResolver("git", async (data) => {
      const gitCommand = data.gitCommand as string
      
      const proc = Bun.spawn(["git", ...gitCommand.split(" ")], {
        stdout: "pipe",
        stderr: "pipe",
      })
      
      const output = await new Response(proc.stdout).text()
      return output
    })

    // Add more custom resolvers as needed...
  }

  /**
   * Load impulses for an activity
   */
  static async loadForActivity(
    impulseIds: string[]
  ): Promise<MiniBobImpulse[]> {
    // Register custom resolvers first
    this.registerCustomResolvers()

    // Load via MiniBob
    return loadImpulses(impulseIds)
  }
}
```

---

## Testing & Validation

### Integration Test

**`packages/opencode/tests/integration/minibob-integration.test.ts`**:

```typescript
import { describe, it, expect, beforeAll } from "bun:test"
import { MiniBobAdapter } from "../../src/adapters/minibob-adapter"
import { MiniBobImpulseBridge } from "../../src/adapters/minibob-impulse-bridge"

describe("MiniBob Integration", () => {
  beforeAll(() => {
    // Set up test environment
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "sk-test"
    MiniBobImpulseBridge.registerCustomResolvers()
  })

  it("should execute hello-world activity", async () => {
    const execution = await MiniBobAdapter.executeActivity({
      templateId: "repos/minibob/templates/hello-world.json",
      variables: { message: "Integration test" },
      reason: "Testing MiniBob integration",
    })

    expect(execution.status).toBe("completed")
    expect(execution.taskResults.length).toBeGreaterThan(0)
    expect(execution.metrics?.duration).toBeGreaterThan(0)
  })

  it("should handle impulses correctly", async () => {
    // Create test impulses
    const impulses = [
      MiniBobImpulseBridge.translateImpulse({
        id: "test-memo",
        type: "memo",
        content: "Test memo content",
        priority: "high",
        budget: 1000,
      }),
      MiniBobImpulseBridge.translateImpulse({
        id: "test-file",
        type: "file",
        path: "repos/minibob/README.md",
        priority: "medium",
        budget: 2000,
      }),
    ]

    expect(impulses.length).toBe(2)
    expect(impulses[0].pointer.type).toBe("memo")
    expect(impulses[1].pointer.type).toBe("file")

    // Load impulses
    const loaded = await MiniBobImpulseBridge.loadForActivity([
      "test-memo",
      "test-file",
    ])

    expect(loaded.length).toBe(2)
    expect(loaded[0].loaded).toBe(true)
    expect(loaded[0].content).toBeDefined()
  })

  it("should handle nested activity execution", async () => {
    const execution = await MiniBobAdapter.executeActivity({
      templateId: "repos/minibob/templates/test-nested-activities.json",
      variables: {},
      reason: "Testing nested execution",
    })

    expect(execution.status).toMatch(/completed|failed/)
    // Nested activities should report back
    expect(execution.taskResults.length).toBeGreaterThan(0)
  })
})
```

Run integration tests:
```bash
npm run test -- tests/integration/minibob-integration.test.ts
```

---

## Gradual Rollout Strategy

### Feature Flag Implementation

**`packages/opencode/src/config/config.ts`**:

```typescript
export interface Config {
  // ... existing config ...
  
  experimental: {
    useMiniBobForActivities: boolean
  }
}

export function load(): Config {
  // ... existing loading logic ...
  
  return {
    // ... existing config ...
    experimental: {
      useMiniBobForActivities: process.env.USE_MINIBOB === "true",
    },
  }
}
```

**`packages/opencode/src/tool/activity.ts`** (with feature flag):

```typescript
async execute(params: z.infer<typeof Tool.ActivityTool.Parameters>): Promise<string> {
  const config = Config.load()
  
  if (config.experimental.useMiniBobForActivities) {
    // NEW: Use MiniBob
    return this.executeViaMiniBob(params)
  } else {
    // OLD: Use existing TrailblazingExecutor
    return this.executeViaLegacy(params)
  }
}

private async executeViaMiniBob(params: any): Promise<string> {
  const execution = await MiniBobAdapter.executeActivity({
    templateId: params.templateId,
    variables: params.variables,
    reason: params.reason,
  })
  
  return this.formatSuccessMessage(execution)
}

private async executeViaLegacy(params: any): Promise<string> {
  // Keep existing logic for backward compatibility
  // ...
}
```

**Enable MiniBob**:
```bash
# For testing
export USE_MINIBOB=true
opencode activity add-feature-complete --var featureName="test"

# For production (after validation)
# Update .env or opencode.json
```

---

## Performance Monitoring

### Add Metrics Comparison

**`packages/opencode/src/adapters/minibob-adapter.ts`**:

```typescript
export class MiniBobAdapter {
  static async executeActivity(options: {
    templateId: string
    variables: Record<string, unknown>
    reason?: string
  }): Promise<ActivityExecution> {
    const startTime = Date.now()
    const startMemory = process.memoryUsage().heapUsed

    try {
      const execution = await this._executeInternal(options)

      // Log performance metrics
      const endTime = Date.now()
      const endMemory = process.memoryUsage().heapUsed
      
      log.info("MiniBob execution metrics", {
        templateId: options.templateId,
        duration: endTime - startTime,
        memoryDelta: endMemory - startMemory,
        cost: execution.metrics?.cost,
        tokenCount: execution.metrics?.totalTokens.input + execution.metrics?.totalTokens.output,
      })

      return execution
    } catch (error) {
      const endTime = Date.now()
      log.error("MiniBob execution failed", {
        templateId: options.templateId,
        duration: endTime - startTime,
        error,
      })
      throw error
    }
  }

  private static async _executeInternal(options: any): Promise<ActivityExecution> {
    // ... existing execution logic ...
  }
}
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Performance benchmarks show no regression
- [ ] Feature flag tested in development
- [ ] Documentation updated

### Deployment

1. **Alpha** (Week 1)
   ```bash
   USE_MINIBOB=true opencode activity <template>
   # Test with 5-10 activity templates
   # Monitor: execution time, memory, success rate
   ```

2. **Beta** (Week 2)
   ```bash
   # Enable for all developers
   export USE_MINIBOB=true
   # Test with real workflows
   # Monitor: error rates, user feedback
   ```

3. **Production** (Week 3)
   ```typescript
   // In config.ts, change default:
   experimental: {
     useMiniBobForActivities: true, // Default enabled
   }
   ```

4. **Legacy Removal** (Week 4)
   ```bash
   # Remove old code paths
   git rm src/session/activity-coordination.ts
   git rm src/session/trailblazing-executor.ts
   # ... etc
   ```

---

## Troubleshooting Guide

### Issue 1: MiniBob execution fails

**Symptoms**: Activity fails with "MiniBob execution error"

**Debug**:
```typescript
// Add verbose logging
import { Log } from "../util/log"
const log = Log.create({ service: "minibob-adapter", level: "debug" })

// Check MiniBob installation
import * as MiniBob from "@metabob/minibob"
console.log("MiniBob version:", MiniBob)

// Verify template exists
const template = await loadTemplateFromMCPOrLocal(templateId)
console.log("Template loaded:", template.id, template.name)
```

### Issue 2: Impulse translation fails

**Symptoms**: Impulses not loading correctly

**Debug**:
```typescript
// Check impulse store
import { getImpulseStore } from "@metabob/minibob/src/impulse"
const store = getImpulseStore()
console.log("Registered resolvers:", store.getResolvers())

// Test custom resolver
MiniBobImpulseBridge.registerCustomResolvers()
const resolved = await store.resolve("custom", { type: "glob", pattern: "*.ts" })
console.log("Resolved:", resolved)
```

### Issue 3: Performance regression

**Symptoms**: Activities run slower with MiniBob

**Debug**:
```typescript
// Profile execution
import { performance } from "perf_hooks"

const start = performance.now()
const execution = await MiniBobAdapter.executeActivity(options)
const end = performance.now()

console.log("Execution time:", end - start, "ms")
console.log("Task breakdown:", execution.taskResults.map(t => ({
  id: t.taskId,
  duration: t.completedAt ? t.completedAt - (t.startedAt ?? 0) : 0,
})))
```

---

## Next Steps

1. **Implement Phase 1** - Add MiniBob dependency
2. **Create Adapter** - MiniBobAdapter + ImpulseBridge
3. **Test Integration** - Run integration test suite
4. **Enable Feature Flag** - Test with USE_MINIBOB=true
5. **Monitor Performance** - Compare metrics with legacy
6. **Gradual Rollout** - Alpha → Beta → Production
7. **Remove Legacy** - Delete old code paths

---

**Status**: ✅ Ready for Implementation
**Estimated Time**: 4-5 days
**Risk Level**: Low (feature flag enables safe rollback)
