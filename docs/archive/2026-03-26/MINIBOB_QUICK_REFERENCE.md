# MiniBob Integration - Quick Reference Card
## Developer Cheat Sheet

**Last Updated**: 2026-03-18

---

## 🚀 Quick Start (30 Minutes)

### 1. Install MiniBob (5 min)

```bash
cd repos/metabob-opencode/packages/opencode
npm install --save ../../../minibob
npm run typecheck  # Verify installation
```

### 2. Import MiniBob (1 line)

```typescript
import { ActivityExecutor } from "@metabob/minibob/src/activity"
import { loadTemplateFromMCPOrLocal } from "@metabob/minibob/src/activity"
```

### 3. Execute Activity (5 lines)

```typescript
const config = { provider: "anthropic", apiKey: "...", model: "...", workingDirectory: "." }
const template = await loadTemplateFromMCPOrLocal("template-id")
const executor = new ActivityExecutor(config)
const execution = await executor.execute({ template, variables: {}, reason: "..." })
console.log(execution.status, execution.metrics)
```

---

## 📖 API Reference

### ActivityExecutor

**Constructor**:
```typescript
new ActivityExecutor(config: ExecutorConfig)
```

**Config**:
```typescript
{
  provider: "anthropic" | "openai",
  apiKey: string,
  model: string,
  workingDirectory: string,
  onSearchActivities?: (category?, verbose?) => Promise<{count, activities}>,
  onCreateActivity?: (params) => Promise<{templateId}>,
  customTools?: Record<string, {definition, handler}>
}
```

**Execute**:
```typescript
await executor.execute({
  template: ActivityTemplate,
  variables: Record<string, unknown>,
  reason?: string,
  onTaskStart?: (taskId: string) => void,
  onTaskComplete?: (taskId: string, result: TaskResult) => void
})
```

**Returns**:
```typescript
{
  id: string,
  templateId: string,
  status: "pending" | "executing" | "completed" | "failed" | "cancelled",
  variables: Record<string, unknown>,
  impulses: Impulse[],
  taskResults: TaskResult[],
  startedAt: number,
  completedAt?: number,
  metrics?: {
    duration: number,
    cost: number,
    totalTokens: { input: number, output: number }
  }
}
```

---

### MCPClient

**Initialize**:
```typescript
import { initializeMCP, getMCPClient } from "@metabob/minibob/src/mcp"

const mcp = await initializeMCP({ 
  endpoint: "http://api.metabob.local/mcp",
  apiKey: "optional"
})
```

**Methods**:
```typescript
// Get template
const template = await mcp.getActivityTemplate("template-id")

// Search templates
const templates = await mcp.searchActivityTemplates({ 
  category: "feature", 
  limit: 10 
})

// Register template
await mcp.registerTemplate(template)

// Report execution
await mcp.reportExecution(execution)

// Register vessel
await mcp.registerVessel({ id, name, version, capabilities, endpoint })
```

---

### Impulse System

**Create**:
```typescript
import { createImpulse } from "@metabob/minibob/src/impulse"

const impulse = createImpulse({
  id: "my-impulse",
  pointer: { type: "memo", content: "..." },
  budget: 5000,
  priority: "high"
})
```

**Pointer Types**:
```typescript
{ type: "memo", content: string }
{ type: "file", path: string, offset?: number, limit?: number }
{ type: "activityOutput", activityId: string, taskId?: string }
{ type: "custom", resolver: string, data: Record<string, unknown> }
```

**Load**:
```typescript
import { loadImpulses } from "@metabob/minibob/src/impulse"

const impulses = await loadImpulses(["impulse-1", "impulse-2"])
```

**Format for Context**:
```typescript
import { formatImpulsesForContext } from "@metabob/minibob/src/impulse"

const context = formatImpulsesForContext(impulses)
// Injects into prompt
```

**Custom Resolver**:
```typescript
import { getImpulseStore } from "@metabob/minibob/src/impulse"

getImpulseStore().registerResolver("my-type", async (data) => {
  // Custom resolution logic
  return "resolved content"
})
```

---

## 🔌 Adapter Pattern

### MiniBobAdapter

```typescript
import { MiniBobAdapter } from "../adapters/minibob-adapter"

// Execute activity
const execution = await MiniBobAdapter.executeActivity({
  templateId: "add-feature-complete",
  variables: { featureName: "test", files: ["src/test.ts"] },
  reason: "Add test feature"
})

// Translate to OpenCode format
const activityInfo = MiniBobAdapter.translateExecution(execution, existingActivity)
```

### MiniBobImpulseBridge

```typescript
import { MiniBobImpulseBridge } from "../adapters/minibob-impulse-bridge"

// Register custom resolvers (call once at startup)
MiniBobImpulseBridge.registerCustomResolvers()

// Translate OpenCode impulse → MiniBob impulse
const minibobImpulse = MiniBobImpulseBridge.translateImpulse(openCodeImpulse)

// Load impulses for activity
const impulses = await MiniBobImpulseBridge.loadForActivity(["impulse-1", "impulse-2"])
```

---

## 🎚️ Feature Flag

### Enable MiniBob

**Environment Variable**:
```bash
export USE_MINIBOB=true
opencode activity <template>
```

**Config File** (`opencode.json`):
```json
{
  "experimental": {
    "useMiniBobForActivities": true
  }
}
```

**Runtime Check**:
```typescript
import { Config } from "../config/config"

const config = Config.load()
if (config.experimental.useMiniBobForActivities) {
  // Use MiniBob
} else {
  // Use legacy
}
```

---

## 🧪 Testing

### Unit Test

```typescript
import { MiniBobAdapter } from "../adapters/minibob-adapter"
import { describe, it, expect } from "bun:test"

describe("MiniBobAdapter", () => {
  it("should execute activity", async () => {
    const execution = await MiniBobAdapter.executeActivity({
      templateId: "repos/minibob/templates/hello-world.json",
      variables: { message: "test" },
    })
    
    expect(execution.status).toBe("completed")
    expect(execution.metrics).toBeDefined()
  })
})
```

### Integration Test

```bash
# Basic execution
opencode activity repos/minibob/templates/hello-world.json --var message="test"

# Nested activities
opencode activity repos/minibob/templates/test-nested-activities.json

# MCP integration
opencode activity add-feature-complete --var featureName="test"
```

### Performance Test

```bash
# Benchmark execution time
time opencode activity add-feature-complete --var featureName="benchmark"

# Memory usage
/usr/bin/time -v opencode activity add-feature-complete
```

---

## 🐛 Debugging

### Enable Verbose Logging

```typescript
import { Log } from "../util/log"

const log = Log.create({ service: "minibob-adapter", level: "debug" })
log.debug("message", { metadata })
```

### Check MiniBob Installation

```typescript
import * as MiniBob from "@metabob/minibob"
console.log("MiniBob:", MiniBob)

import { ActivityExecutor } from "@metabob/minibob/src/activity"
console.log("ActivityExecutor:", ActivityExecutor)
```

### Inspect Template

```typescript
import { loadTemplateFromMCPOrLocal } from "@metabob/minibob/src/activity"

const template = await loadTemplateFromMCPOrLocal("template-id")
console.log("Template:", {
  id: template.id,
  name: template.name,
  taskCount: template.tasks.length,
  variables: template.variables,
})
```

### Profile Execution

```typescript
const start = Date.now()
const execution = await executor.execute({ template, variables, reason })
const end = Date.now()

console.log("Duration:", end - start, "ms")
console.log("Task breakdown:", execution.taskResults.map(t => ({
  id: t.taskId,
  status: t.status,
  duration: t.completedAt ? t.completedAt - (t.startedAt ?? 0) : 0,
  tokens: t.tokens,
})))
```

---

## 📊 File Mapping

### OpenCode → MiniBob Equivalents

| OpenCode File | MiniBob File | Purpose |
|---------------|--------------|---------|
| `activity-coordination.ts` | `src/activity.ts` | Task execution |
| `trailblazing-executor.ts` | `src/activity.ts` | Built into executor |
| `template-metrics-client.ts` | `src/mcp.ts` | MCP client |
| `activity-template-repository.ts` | `src/mcp.ts` | Backend loading |
| `impulse-*.ts` | `src/impulse.ts` | Core 4 types |

### Files to Keep (OpenCode-specific)

| File | Reason |
|------|--------|
| `activity.ts` | UI state management |
| `activity-lifecycle-logger.ts` | TUI logging |
| `activity-complete.ts` | Completion handlers |
| `activity-git.ts` | Git integration |
| `activity-todo.ts` | Todo system |

---

## 🔑 Key Differences

### OpenCode vs MiniBob

| Aspect | OpenCode | MiniBob |
|--------|----------|---------|
| **Focus** | UI/UX | Execution |
| **LOC** | 50,000 | 3,000 |
| **Agents** | 7+ | 1 (general) |
| **Impulses** | 14 types | 4 core types |
| **Tools** | 50+ | 12 core |
| **Runtime** | Node.js | Bun |
| **Use Case** | Interactive dev | Vessel execution |

### Template Loading

**OpenCode** (old):
```typescript
const template = await ActivityTemplate.load(templateId)
```

**MiniBob** (new):
```typescript
const template = await loadTemplateFromMCPOrLocal(templateId)
// Tries MCP first, falls back to local
```

### Execution

**OpenCode** (old):
```typescript
const executor = new TrailblazingExecutor(...)
const result = await executor.execute(...)
```

**MiniBob** (new):
```typescript
const executor = new ActivityExecutor(config)
const execution = await executor.execute({ template, variables, reason })
```

---

## 💡 Tips & Tricks

### Custom Tools

```typescript
const config = {
  provider: "anthropic",
  apiKey: "...",
  model: "...",
  workingDirectory: ".",
  customTools: {
    "my_tool": {
      definition: {
        name: "my_tool",
        description: "My custom tool",
        parameters: { /* schema */ }
      },
      handler: async (params) => {
        // Tool implementation
        return { success: true, output: "..." }
      }
    }
  }
}
```

### Activity Callbacks

```typescript
const config = {
  // ... other config ...
  onSearchActivities: async (category, verbose) => {
    // Custom activity search logic
    return { count: 0, activities: [] }
  },
  onCreateActivity: async (params) => {
    // Custom activity creation logic
    return { templateId: "new-template-id" }
  }
}
```

### Impulse Custom Resolvers

```typescript
import { getImpulseStore } from "@metabob/minibob/src/impulse"

const store = getImpulseStore()

store.registerResolver("git", async (data) => {
  const { gitCommand } = data
  const proc = Bun.spawn(["git", ...gitCommand.split(" ")], { stdout: "pipe" })
  return await new Response(proc.stdout).text()
})

store.registerResolver("search", async (data) => {
  const { pattern, files } = data
  // Custom search logic
  return "search results"
})
```

---

## 🆘 Common Issues

### Issue 1: "Cannot find module '@metabob/minibob'"

**Solution**:
```bash
cd repos/metabob-opencode/packages/opencode
npm install --save ../../../minibob
npm run typecheck
```

### Issue 2: "Template not found"

**Solution**:
```typescript
// Check MCP endpoint
const mcp = getMCPClient()
if (!mcp) {
  console.log("MCP not initialized")
}

// Try explicit path
const template = await loadTemplate("repos/minibob/templates/hello-world.json")
```

### Issue 3: "Impulse resolution failed"

**Solution**:
```typescript
// Register custom resolvers first
MiniBobImpulseBridge.registerCustomResolvers()

// Check impulse exists
const store = getImpulseStore()
const impulse = store.get("impulse-id")
console.log("Impulse:", impulse)
```

### Issue 4: "Activity execution slow"

**Solution**:
```typescript
// Profile task execution
const execution = await executor.execute({
  template,
  variables,
  reason,
  onTaskStart: (taskId) => console.time(taskId),
  onTaskComplete: (taskId) => console.timeEnd(taskId),
})

// Check task breakdown
console.log(execution.taskResults.map(t => ({
  id: t.taskId,
  duration: t.completedAt - (t.startedAt ?? 0),
})))
```

---

## 📚 Documentation Links

- **MiniBob README**: `repos/minibob/README.md`
- **MiniBob Architecture**: `repos/minibob/ARCHITECTURE.md`
- **Integration Analysis**: `MINIBOB_INTEGRATION_ANALYSIS.md`
- **Implementation Guide**: `MINIBOB_IMPLEMENTATION_GUIDE.md`
- **Integration Summary**: `MINIBOB_INTEGRATION_SUMMARY.md`

---

## ✅ Pre-Flight Checklist

Before deploying to production:

- [ ] MiniBob dependency installed
- [ ] Adapter layer created and tested
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks completed
- [ ] Feature flag implemented
- [ ] Documentation updated
- [ ] Team trained on new architecture

---

**Quick Links**:
- GitHub: `repos/minibob`
- NPM: `@metabob/minibob`
- Docs: See above

**Support**: Check documentation or ask team for help

---

*Last Updated: 2026-03-18 | Version: 1.0*
