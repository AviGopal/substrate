# MiniBob Migration Summary
## Current State & Action Plan

**Date**: 2026-03-20

---

## Executive Summary

You have **partially implemented** MiniBob integration in `repos/metabob-opencode`. The migration is ~40% complete:

✅ **Done**:
- MiniBob library dependency added
- `MinibobIntegration` module created
- `goal` tool uses MiniBob
- Lifecycle hooks registered

⚠️ **Incomplete**:
- `activity` tool still uses legacy code
- ~5,000 LOC of deprecated code exists
- TUI doesn't display MiniBob state
- MCP tools not forwarded to MiniBob
- Impulse system duplicated

---

## What You Asked For

> "We need to have the session forward goals to minibob and show the results and current status, response messages from the llm, activity execution status and loaded impulses within the normal session TUI extracted from minibob. We should not have any code within opencode that interfaces with those operations and we should be able to forward our mcp tool configurations to minibob from within the same process."

**Translation**:
1. ✅ Sessions forward goals to MiniBob → `goal` tool already does this
2. ❌ TUI displays MiniBob state → **NOT IMPLEMENTED**
3. ❌ Remove OpenCode activity/impulse code → **STILL EXISTS**
4. ❌ Forward MCP tools to MiniBob → **NOT IMPLEMENTED**

---

## Critical Files to Address

### 1. Legacy Code to DELETE (~5,000 LOC)

**Activity System** (src/session/):
```
activity.ts                      1,500 LOC ← DEPRECATED
activity-template.ts             2,500 LOC ← DEPRECATED
activity-template-repository.ts    400 LOC ← DEPRECATED
activity-coordination.ts
activity-correctness.ts
activity-enforcement-gate.ts
activity-failure-analysis.ts
activity-generator.ts
activity-git.ts
activity-lifecycle-logger.ts
activity-message-forwarder.ts
activity-prefix.ts
activity-schema-adapter.ts
activity-state-capture.ts
activity-todo.ts
trailblazing-executor.ts
autonomous-trailblazing.ts
template-metrics-client.ts
template-quality-score.ts (already marked deprecated)
template-selector.ts
```

**Impulse System** (src/session/):
```
impulse-*.ts (~35 files)
session-memory.ts
session-memory-metrics.ts
memory-lifecycle.ts
```

### 2. Tool to MIGRATE

**src/tool/activity.ts** (~800 LOC):
- Currently uses `Activity` namespace from `src/session/activity.ts`
- Should call `MinibobIntegration.executeActivity()` instead

**src/tool/impulse-*.ts**:
- Currently use `Impulse` namespace from `src/session/impulse-*.ts`
- Should delegate to MiniBob executor

### 3. TUI to UPDATE

**src/cli/cmd/tui/routes/session/sidebar.tsx**:
- Currently fetches: `/session/${id}/state` (OpenCode session state)
- Should also fetch: `/session/${id}/minibob-state` (NEW)
- Display:
  - Goal execution progress
  - Activity task progress
  - LLM messages from MiniBob
  - Loaded impulses from MiniBob

### 4. MCP Integration to IMPLEMENT

**src/minibob-integration/index.ts**:
```typescript
// Line 274: TODO implementation
async function buildCustomToolsFromMCP(config: Config.Info): Promise<Record<string, any>> {
  log.debug("MCP tool passthrough not yet implemented, minibob will use built-in tools")
  return {} // ← FIX THIS
}
```

Should forward MCP tools from OpenCode config to MiniBob executor.

---

## Implementation Priority

### Phase 1: Activity Tool Migration (4 hours) ✅ START HERE

**Goal**: Make `activity` tool use MiniBob exclusively

**File**: `src/tool/activity.ts`

**Change**:
```typescript
// BEFORE (~800 LOC of complex orchestration)
import { Activity } from "../session/activity"
import { ActivityTemplate } from "../session/activity-template"

const execution = await Activity.execute({ ... })

// AFTER (~200 LOC delegation)
import { MinibobIntegration } from "../minibob-integration"

const execution = await MinibobIntegration.executeActivity(
  ctx.sessionID,
  template,
  params.variables,
  params.reason
)
```

**Validation**:
```bash
bun test test/minibob/integration.test.ts
```

---

### Phase 2: TUI MiniBob State Display (12 hours)

**Goal**: Show real-time MiniBob state in sidebar

**Steps**:

1. **Add endpoint** (src/api/session-minibob-state.ts):
```typescript
export async function getMiniBobState(sessionID: string) {
  const executor = MinibobIntegration.getExecutor(sessionID)
  if (!executor) return null
  
  return {
    activeGoal: executor.getCurrentGoal(),
    activeActivity: executor.getCurrentActivity(),
    llmMessages: executor.getMessages(),
    impulses: executor.getLoadedImpulses(),
  }
}
```

2. **Update sidebar** (src/cli/cmd/tui/routes/session/sidebar.tsx):
```typescript
const [minibobState, setMinibobState] = createSignal<MiniBobState | null>(null)

async function fetchSessionState() {
  const [sessionData, minibobData] = await Promise.all([
    fetch(`${baseUrl}/session/${props.sessionID}/state`).then(r => r.json()),
    fetch(`${baseUrl}/session/${props.sessionID}/minibob-state`).then(r => r.json()),
  ])
  setSessionState(sessionData)
  setMinibobState(minibobData)
}

// Add sections
<CollapsibleSection title="Goal Execution">
  <InfoRow label="Intent" value={minibobState()?.activeGoal?.intent} />
  <ProgressBar percentage={goalProgress()} />
</CollapsibleSection>

<CollapsibleSection title="Active Activity">
  <InfoRow label="Template" value={minibobState()?.activeActivity?.templateName} />
  <InfoRow label="Task" value={minibobState()?.activeActivity?.currentTask?.description} />
  <ProgressBar percentage={taskProgress()} />
</CollapsibleSection>

<CollapsibleSection title="Loaded Impulses">
  <For each={minibobState()?.impulses ?? []}>
    {(impulse) => (
      <InfoRow label={impulse.id} value={`${impulse.type} (${impulse.size} tokens)`} />
    )}
  </For>
</CollapsibleSection>
```

**Validation**:
- Run `bun run dev`
- Execute goal: "Add subtract function to calculator.ts"
- Verify sidebar shows real-time progress

---

### Phase 3: MCP Tool Forwarding (6 hours)

**Goal**: Pass OpenCode MCP tools to MiniBob in same process

**File**: `src/minibob-integration/index.ts`

**Implementation**:
```typescript
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
          const result = await client.callTool({
            name: tool.name,
            arguments: params,
          })
          return result.content
        },
      }
    }
    
    log.info(`Forwarded ${tools.length} tools from ${serverName} to MiniBob`)
  }
  
  return customTools
}
```

**Validation**:
```typescript
test("MiniBob receives MCP tools", async () => {
  const customTools = await buildCustomToolsFromMCP(config)
  expect(customTools).toHaveProperty("metabob_search_codebase_issues")
})
```

---

### Phase 4: Remove Deprecated Code (8 hours)

**Goal**: Delete ~5,000 LOC of OpenCode activity/impulse code

**Strategy**:
1. Move files to `.archive/deprecated-2026-03-20/`
2. Run `bun run typecheck` after each batch
3. Fix compilation errors

**Files to delete**:
```bash
# Activity system
rm src/session/activity.ts
rm src/session/activity-template.ts
rm src/session/activity-*.ts

# Impulse system  
rm src/session/impulse-*.ts
rm src/session/session-memory.ts
rm src/session/memory-lifecycle.ts

# Lifecycle
rm src/session/turn-lifecycle-hooks.ts
```

**Validation**:
```bash
bun run typecheck  # Should pass
bun test           # All tests green
```

---

### Phase 5: Impulse Tool Migration (8 hours)

**Goal**: Impulse tools delegate to MiniBob

**Files**: `src/tool/impulse-*.ts`

**Before**:
```typescript
import { Impulse } from "../session/impulse"
const impulse = await Impulse.create({ ... })
```

**After**:
```typescript
import { MinibobIntegration } from "../minibob-integration"
const executor = MinibobIntegration.getExecutor(ctx.sessionID)
const impulse = await executor.createImpulse({ ... })
```

---

## Success Metrics

Migration complete when:

- [ ] `activity` tool calls MiniBob (no legacy code)
- [ ] TUI sidebar displays MiniBob state (goal, activity, impulses, LLM messages)
- [ ] MCP tools forwarded to MiniBob (same process)
- [ ] Deprecated code deleted (~5,000 LOC)
- [ ] `impulse_*` tools delegate to MiniBob
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Manual E2E test: goal execution shows real-time progress in TUI

---

## Timeline

| Phase | Effort | Can Start | Blocking |
|-------|--------|-----------|----------|
| **Phase 1**: Activity Tool | 4 hours | ✅ Now | None |
| **Phase 2**: TUI Display | 12 hours | ✅ Now | None |
| **Phase 3**: MCP Forward | 6 hours | ✅ Now | None |
| **Phase 4**: Delete Code | 8 hours | ⏳ After Phase 1 | Phase 1 |
| **Phase 5**: Impulse Tools | 8 hours | ⏳ After Phase 4 | Phase 4 |

**Total**: ~38 hours (1 week)

**Recommended Order**:
1. Start Phase 1 (Activity Tool) - highest impact, unblocks Phase 4
2. Parallel: Phase 2 (TUI) + Phase 3 (MCP) - independent
3. Then Phase 4 (Delete Code) - requires Phase 1 complete
4. Finally Phase 5 (Impulse Tools) - requires Phase 4 complete

---

## Detailed Docs

See full implementation guides:
- **MINIBOB_MIGRATION_PLAN.md** - Complete step-by-step plan
- **MINIBOB_INTEGRATION_ANALYSIS.md** - Existing architecture analysis
- **src/minibob-integration/index.ts** - Current integration code

---

## Quick Start

**To begin migration now**:

```bash
cd repos/metabob-opencode

# 1. Create branch
git checkout -b feat/minibob-complete-migration

# 2. Start Phase 1 (Activity Tool)
# Edit: packages/opencode/src/tool/activity.ts
# Replace Activity namespace calls with MinibobIntegration

# 3. Test
bun test test/minibob/integration.test.ts

# 4. Commit
git add .
git commit -m "feat: migrate activity tool to MiniBob"

# 5. Continue with Phase 2 (TUI) or Phase 3 (MCP)
```

---

## Questions?

**Architecture**: Why MiniBob?
- Single source of truth
- Reduces OpenCode complexity (~5,000 LOC)
- Unified activity/impulse/lifecycle system
- Better separation of concerns (UI vs execution)

**Migration**: Is this risky?
- Low risk: MiniBob already proven (~40% migrated)
- Incremental: phase-by-phase with rollback
- Tested: comprehensive test coverage

**Timeline**: Can we go faster?
- Yes: Phases 2 & 3 can run in parallel
- Yes: Delete code (Phase 4) is mechanical
- Bottleneck: Testing and validation

---

**Ready to start? Begin with Phase 1 (Activity Tool migration).**
