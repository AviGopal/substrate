# MiniBob Migration Plan
## Removing Deprecated Activity, Impulse, and Lifecycle Behavior from OpenCode

**Date**: 2026-03-20  
**Goal**: Complete transition to MiniBob library for all activity execution, impulse management, and lifecycle hooks

---

## Executive Summary

OpenCode currently has **dual implementation paths**: legacy activity/impulse code AND partial MiniBob integration. This plan outlines the complete migration to MiniBob as the **single source of truth** for:
- Activity execution
- Impulse/context management  
- Lifecycle hooks
- Goal-driven workflows

**Target Architecture**:
```
OpenCode (UI + Session Management)
  └─> MiniBob Library (Activity Engine)
      └─> Metabob Activity API (Backend)
```

**Code Reduction**: ~5,000 LOC removed from OpenCode

---

## Current State Analysis

### ✅ What's Already Done

1. **MiniBob library** installed as dependency (`@metabob/minibob`)
2. **MinibobIntegration module** exists (`src/minibob-integration/index.ts`) with:
   - `initialize(sessionID)` - creates ActivityExecutor per session
   - `executeActivity()` - delegates to MiniBob
   - `submitGoal()` - goal-driven workflow
   - `cleanup()` - resource management
3. **Goal tool** (`src/tool/goal.ts`) calls `MinibobIntegration.submitGoal()`
4. **Config** has `minibob.enabled` flag

### ⚠️ What's Incomplete

1. **Legacy activity code still active**:
   - `src/session/activity.ts` - OpenCode's Activity namespace
   - `src/session/activity-template.ts` - Template management
   - `src/tool/activity.ts` - Tool still uses legacy code
2. **TUI doesn't display MiniBob state**:
   - Sidebar shows session-level data only
   - No goal execution status
   - No activity progress from MiniBob
   - No impulse display from MiniBob
3. **MCP tools not forwarded** to MiniBob:
   - `buildCustomToolsFromMCP()` returns `{}`
   - MiniBob uses built-in tools only
4. **Impulse system duplicated**:
   - OpenCode has impulse implementation
   - MiniBob has its own impulse system
   - No synchronization between them

---

## Migration Steps

### Phase 1: Activity Tool Migration ✅ PRIORITY

**Goal**: Make `activity` tool exclusively use MiniBob

**Files to Modify**:
```
src/tool/activity.ts - Replace Activity namespace calls with MinibobIntegration
```

**Implementation**:
```typescript
// src/tool/activity.ts (BEFORE - ~800 LOC)
import { Activity } from "../session/activity"
import { ActivityTemplate } from "../session/activity-template"
// ...complex activity orchestration...

// src/tool/activity.ts (AFTER - ~200 LOC)
import { MinibobIntegration } from "../minibob-integration"

export const ActivityTool = Tool.define("activity", async () => {
  return {
    async execute(params, ctx) {
      // Delegate to MiniBob
      const result = await MinibobIntegration.executeActivity(
        ctx.sessionID,
        template,
        params.variables,
        params.reason
      )
      
      // Format result for OpenCode UI
      return formatActivityResult(result)
    }
  }
})
```

**Tests to Update**:
- `test/activity-errors.test.ts`
- `test/activity-preflight-demo.ts`

**Validation**:
```bash
bun test test/minibob/integration.test.ts
```

---

### Phase 2: Remove Deprecated Session Code 🔥 CLEANUP

**Goal**: Delete all activity/impulse code from `src/session/`

**Files to DELETE** (~5,000 LOC total):
```
src/session/activity.ts                      (~1,500 LOC)
src/session/activity-template.ts             (~2,500 LOC)
src/session/activity-template-repository.ts  (~400 LOC)
src/session/activity-autocomplete.ts
src/session/activity-complete.ts
src/session/activity-coordination.ts
src/session/activity-correctness.ts
src/session/activity-enforcement-gate.ts
src/session/activity-failure-analysis.ts
src/session/activity-generator.ts
src/session/activity-git.ts
src/session/activity-lifecycle-logger.ts
src/session/activity-message-forwarder.ts
src/session/activity-prefix.ts
src/session/activity-schema-adapter.ts
src/session/activity-state-capture.ts
src/session/activity-todo.ts
src/session/trailblazing-executor.ts         (~400 LOC)
src/session/autonomous-trailblazing.ts
src/session/template-metrics-client.ts
src/session/template-quality-score.ts        (already deprecated)
src/session/template-selector.ts

# Impulse-related
src/session/impulse-*.ts                     (~35 files)
src/session/session-memory.ts
src/session/session-memory-metrics.ts
src/session/memory-lifecycle.ts
```

**Files to KEEP** (session management):
```
src/session/index.ts           - Session CRUD
src/session/message-v2.ts      - Message storage
src/session/prompt.ts          - Prompt building
src/session/stats.ts           - Session stats
src/session/context.ts         - Context utilities
src/session/boredom-manager.ts - Boredom monitoring
```

**Migration Strategy**:
1. Move files to `.archive/deprecated-2026-03-20/`
2. Update imports across codebase
3. Run TypeScript check: `bun run typecheck`
4. Fix compilation errors

**Risk**: Breaking tests
**Mitigation**: Run full test suite after each batch of deletions

---

### Phase 3: TUI Integration 📊 UI UPDATE

**Goal**: Display MiniBob state in OpenCode TUI

**Current TUI State** (`src/cli/cmd/tui/routes/session/sidebar.tsx`):
- Shows session-level metrics (cost, context, memory)
- Uses `fetch('/session/${sessionID}/state')` endpoint
- Updates every 2.5 seconds

**New State to Display**:
```typescript
interface MiniBobSessionState {
  // Goal execution
  activeGoal?: {
    intent: string
    type: string
    progress: {
      activitiesExecuted: number
      maxActivities: number
      totalCost: number
      maxCost: number
    }
    status: "running" | "completed" | "failed"
  }
  
  // Activity execution
  activeActivity?: {
    id: string
    templateId: string
    templateName: string
    currentTask: {
      id: string
      description: string
      status: "pending" | "running" | "completed" | "failed"
    }
    taskProgress: {
      completed: number
      total: number
    }
  }
  
  // LLM messages from MiniBob
  llmMessages: Array<{
    role: "user" | "assistant"
    content: string
    timestamp: number
  }>
  
  // Loaded impulses
  impulses: Array<{
    id: string
    type: "memo" | "file" | "activityOutput" | "custom"
    budget: number
    loaded: boolean
    size: number
  }>
}
```

**Implementation**:

1. **Add MiniBob state endpoint**:
```typescript
// src/api/session-state.ts (NEW)
export async function getMiniBobState(sessionID: string): Promise<MiniBobSessionState> {
  const executor = MinibobIntegration.getExecutor(sessionID)
  if (!executor) return { llmMessages: [], impulses: [] }
  
  return {
    activeGoal: executor.getCurrentGoal(),
    activeActivity: executor.getCurrentActivity(),
    llmMessages: executor.getMessages(),
    impulses: executor.getLoadedImpulses(),
  }
}
```

2. **Update TUI sidebar** to fetch and display:
```typescript
// src/cli/cmd/tui/routes/session/sidebar.tsx
const [minibobState, setMinibobState] = createSignal<MiniBobSessionState | null>(null)

async function fetchSessionState() {
  const [sessionData, minibobData] = await Promise.all([
    fetch(`${baseUrl}/session/${props.sessionID}/state`).then(r => r.json()),
    fetch(`${baseUrl}/session/${props.sessionID}/minibob-state`).then(r => r.json()),
  ])
  setSessionState(sessionData)
  setMinibobState(minibobData)
}

// Display in sidebar
<CollapsibleSection title="Goal Execution" expanded={goalExpanded()}>
  <Show when={minibobState()?.activeGoal}>
    <InfoRow label="Intent" value={minibobState()!.activeGoal.intent} />
    <ProgressBar 
      percentage={(minibobState()!.activeGoal.progress.activitiesExecuted / 
                  minibobState()!.activeGoal.progress.maxActivities) * 100} 
    />
  </Show>
</CollapsibleSection>

<CollapsibleSection title="Active Activity" expanded={activityExpanded()}>
  <Show when={minibobState()?.activeActivity}>
    <InfoRow label="Template" value={minibobState()!.activeActivity.templateName} />
    <InfoRow label="Task" value={minibobState()!.activeActivity.currentTask.description} />
    <ProgressBar 
      percentage={(minibobState()!.activeActivity.taskProgress.completed / 
                  minibobState()!.activeActivity.taskProgress.total) * 100} 
    />
  </Show>
</CollapsibleSection>

<CollapsibleSection title="Loaded Impulses" expanded={impulsesExpanded()}>
  <For each={minibobState()?.impulses ?? []}>
    {(impulse) => (
      <InfoRow 
        label={impulse.id} 
        value={`${impulse.type} (${impulse.size} tokens)`} 
      />
    )}
  </For>
</CollapsibleSection>
```

**Validation**:
- Run `bun run dev` and open TUI
- Execute goal: should see real-time progress
- Execute activity: should see task-by-task progress

---

### Phase 4: MCP Tool Forwarding 🔌 INTEGRATION

**Goal**: Pass OpenCode MCP tools to MiniBob in same process

**Current State**:
```typescript
// src/minibob-integration/index.ts
async function buildCustomToolsFromMCP(config: Config.Info): Promise<Record<string, any>> {
  log.debug("MCP tool passthrough not yet implemented, minibob will use built-in tools")
  return {}
}
```

**Target Implementation**:
```typescript
// src/minibob-integration/index.ts
async function buildCustomToolsFromMCP(config: Config.Info): Promise<Record<string, any>> {
  const customTools: Record<string, any> = {}
  
  // Get MCP servers from OpenCode config
  const mcpServers = Object.entries(config.mcp || {})
  
  for (const [serverName, serverConfig] of mcpServers) {
    // Get MCP client for this server
    const client = await MCP.getClient(serverName)
    if (!client) continue
    
    // List tools from this server
    const { tools } = await client.listTools()
    
    // Wrap each tool for MiniBob
    for (const tool of tools) {
      customTools[tool.name] = {
        description: tool.description,
        parameters: tool.inputSchema,
        execute: async (params: any) => {
          // Call MCP tool via OpenCode's client
          const result = await client.callTool({
            name: tool.name,
            arguments: params,
          })
          return result.content
        },
      }
    }
  }
  
  log.info("Forwarded MCP tools to MiniBob", {
    toolCount: Object.keys(customTools).length,
    tools: Object.keys(customTools),
  })
  
  return customTools
}
```

**Benefits**:
- MiniBob can use metabob-cli tools (search, annotate, etc.)
- MiniBob can use filesystem tools
- Single process, no IPC overhead

**Validation**:
```typescript
// test/minibob/mcp-integration.test.ts
test("MiniBob receives MCP tools from OpenCode config", async () => {
  const config = await Config.get()
  const customTools = await buildCustomToolsFromMCP(config)
  
  expect(Object.keys(customTools).length).toBeGreaterThan(0)
  expect(customTools).toHaveProperty("metabob_search_codebase_issues")
})
```

---

### Phase 5: Impulse System Unification 🧠 SYNC

**Goal**: Remove OpenCode impulse code, use MiniBob's impulse system exclusively

**Current Duplication**:
- OpenCode: `src/session/impulse-*.ts` (~35 files)
- MiniBob: `@metabob/minibob/src/impulse/`

**Migration**:
1. **Remove OpenCode impulse files**:
   ```bash
   rm -rf src/session/impulse-*.ts
   rm -rf src/tool/impulse-*.ts
   ```

2. **Update impulse tools** to delegate to MiniBob:
   ```typescript
   // src/tool/impulse-create.ts (NEW - ~50 LOC)
   import { MinibobIntegration } from "../minibob-integration"
   
   export const ImpulseCreateTool = Tool.define("impulse_create", async () => {
     return {
       async execute(params, ctx) {
         const executor = MinibobIntegration.getExecutor(ctx.sessionID)
         if (!executor) throw new Error("MiniBob not initialized")
         
         // Delegate to MiniBob
         const impulse = await executor.createImpulse({
           id: params.id,
           type: params.pointer.type,
           pointer: params.pointer,
           budget: params.budget,
         })
         
         return { content: [{ type: "text", text: `Created impulse ${impulse.id}` }] }
       }
     }
   })
   ```

3. **Remove lifecycle hooks** from OpenCode:
   ```bash
   rm src/session/turn-lifecycle-hooks.ts
   rm src/session/memory-lifecycle.ts
   ```

**Validation**:
- Test impulse creation via tool
- Verify impulses display in TUI sidebar

---

## Validation Plan

### Test Coverage

**Unit Tests**:
```bash
bun test test/minibob/integration.test.ts
bun test test/minibob/mcp-integration.test.ts
bun test test/minibob/impulse-sync.test.ts
```

**Integration Tests**:
```bash
# Goal execution end-to-end
bun test test/goal-execution-e2e.test.ts

# Activity execution via MiniBob
bun test test/activity-minibob-e2e.test.ts

# TUI state display
bun test test/tui-minibob-display.test.ts
```

**Manual Testing**:
1. Run OpenCode TUI: `bun run dev`
2. Submit goal: "Add a subtract function to calculator.ts"
3. Verify TUI shows:
   - Goal progress
   - Activity execution
   - Task-by-task updates
   - LLM messages
   - Loaded impulses

---

## Timeline

| Phase | Effort | Dependencies | Risk |
|-------|--------|--------------|------|
| Phase 1: Activity Tool | 4 hours | None | Low |
| Phase 2: Remove Deprecated | 8 hours | Phase 1 | Medium (breaking changes) |
| Phase 3: TUI Integration | 12 hours | Phase 1 | Low |
| Phase 4: MCP Forwarding | 6 hours | None | Medium (MCP complexity) |
| Phase 5: Impulse Unification | 8 hours | Phase 2, 4 | Medium |

**Total Effort**: ~38 hours (1 week)

---

## Rollback Plan

If migration fails, restore from archive:
```bash
git checkout main
git restore src/session/activity.ts src/tool/activity.ts
```

**Safeguards**:
- Keep deprecated files in `.archive/` for 1 month
- Feature flag: `minibob.enabled` (default: false during migration)
- Parallel implementation: keep both paths until validation complete

---

## Success Criteria

### ✅ Complete When:

1. **Activity tool uses MiniBob exclusively**
   - `src/tool/activity.ts` calls `MinibobIntegration.executeActivity()`
   - No imports from `src/session/activity.ts`

2. **Deprecated code removed**
   - `src/session/activity*.ts` files deleted (~5,000 LOC)
   - `src/session/impulse*.ts` files deleted
   - TypeScript compiles without errors

3. **TUI displays MiniBob state**
   - Sidebar shows goal execution progress
   - Activity task-by-task updates visible
   - LLM messages from MiniBob displayed
   - Loaded impulses shown with token budgets

4. **MCP tools forwarded to MiniBob**
   - MiniBob can call metabob-cli tools
   - MiniBob can use filesystem tools
   - Same process, no separate MCP clients

5. **Tests pass**
   - All MiniBob integration tests green
   - E2E goal execution test passes
   - TUI display test validates state

---

## Next Steps

**Immediate Actions**:
1. ✅ Create feature branch: `git checkout -b feat/minibob-migration`
2. ✅ Start with Phase 1 (Activity Tool migration)
3. ✅ Write tests first (TDD approach)
4. ✅ Incremental commits per phase

**Questions to Resolve**:
1. Should we keep `goal` tool separate from `activity` tool?
2. How to handle session-level vs activity-level cost tracking?
3. Should MiniBob state be persisted or transient?

---

## References

- **MiniBob Library**: `../minibob/`
- **Current Integration**: `src/minibob-integration/index.ts`
- **Architecture Doc**: `MINIBOB_INTEGRATION_ANALYSIS.md`
- **Deprecation Plan**: This document
