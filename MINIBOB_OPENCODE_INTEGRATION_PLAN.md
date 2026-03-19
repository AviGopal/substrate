# minibob Integration Plan: OpenCode as UI Frontend

## Executive Summary

Transform **metabob-opencode** from a monolithic activity execution system into a **lightweight UI frontend** that delegates all activity execution, impulse management, and lifecycle hooks to **minibob** (used as a library).

**New Architecture:**
```
metabob-opencode (UI + Session)
    ↓ (import as library)
minibob (@metabob/minibob package)
    ↓ (HTTP MCP)
metabob-activity-api (backend)
```

## Current State Analysis

### minibob Capabilities (~4,400 LOC)
✅ **Activity System** (activity.ts):
- Template loading (MCP + local JSON)
- Variable binding and interpolation
- Task execution with dependencies
- Nested activity support
- Validation (files, patterns, commands)
- Retry policies
- Metrics tracking (duration, cost, tokens)
- MCP backend reporting

✅ **Impulse System** (impulse.ts):
- Create impulses (memo, file, activityOutput, custom)
- Load and resolve impulses
- Token budget management
- Custom resolvers
- Activity output storage
- MCP backend sync

✅ **MCP Integration** (mcp.ts, mcp-activity-bridge.ts):
- Connect to metabob-activity-api
- Fetch templates from backend
- Register template variants
- Report execution metrics
- Store/retrieve impulses
- Search activities
- Goal-seeking template creation

✅ **Lifecycle Management**:
- Activity execution lifecycle (start, task execution, completion)
- Impulse creation/load/unload lifecycle
- MCP sync lifecycle
- Validation lifecycle

✅ **ACP Protocol** (acp.ts, acp-gossip.ts):
- Vessel-to-vessel communication
- Task delegation
- Discovery protocol

✅ **Tools** (tools.ts):
- bash, read, write, edit, git
- activity (nested execution)
- impulse_create
- acp_delegate
- search_activities, create_activity_goal_seeking

### metabob-opencode Current Responsibilities

**Keep (UI/Session Management):**
- Terminal UI (TUI) rendering
- User input handling
- Session state tracking
- Message display
- Git context display
- File tree navigation
- Chat interface

**Remove (Delegate to minibob):**
- Activity execution engine (`src/session/activity.ts`)
- Activity template management
- Impulse creation/management (`src/session/impulse-*.ts`)
- Lifecycle hooks (`src/session/memory-lifecycle.ts`, `src/session/turn-lifecycle.ts`)
- Memory agent (`src/session/memory-agent.ts`)
- Activity state tracking
- Metrics collection

## Integration Architecture

### Phase 1: minibob as Library (NOT HTTP Server)

**Package minibob as npm library:**
```json
{
  "name": "@metabob/minibob",
  "version": "0.1.0",
  "main": "index.ts",
  "exports": {
    ".": "./index.ts",
    "./activity": "./src/activity.ts",
    "./impulse": "./src/impulse.ts",
    "./mcp": "./src/mcp.ts"
  }
}
```

**OpenCode imports minibob directly:**
```typescript
// In metabob-opencode/packages/opencode
import { ActivityExecutor, ExecutorConfig } from "@metabob/minibob/activity"
import { createImpulse, loadImpulse } from "@metabob/minibob/impulse"
import { initializeMCP, getMCPClient } from "@metabob/minibob/mcp"
```

**Benefits:**
- No HTTP overhead
- Shared memory (impulses, templates)
- Synchronous API calls
- Single process
- No port conflicts

### Phase 2: OpenCode as Thin UI Layer

**OpenCode keeps:**
1. **Session Management** (`src/session/session.ts`)
   - User conversation state
   - Message history
   - Git context
   - File context

2. **UI Layer** (TUI)
   - Render messages
   - Display activity progress
   - Show impulse sidebar
   - File tree navigation

3. **Tool Coordination** (`src/tool/`)
   - Route activity tool → minibob.ActivityExecutor
   - Route impulse tools → minibob impulse system
   - Pass MCP clients to minibob

4. **Configuration** (`src/config/`)
   - User preferences
   - MCP connections
   - Pass config to minibob

**OpenCode removes:**
1. **Activity Execution** (DELETE `src/session/activity.ts`)
   - Replaced by `minibob.ActivityExecutor`

2. **Impulse Management** (DELETE `src/session/impulse-*.ts`)
   - Replaced by `minibob` impulse system

3. **Memory Agent** (DELETE `src/session/memory-agent.ts`)
   - Minibob handles lifecycle hooks internally

4. **Activity Lifecycle Logging** (DELETE `src/session/activity-lifecycle-logger.ts`)
   - Minibob ActivityExecutor handles this

5. **Template Repository** (DELETE `src/session/activity-template-repository.ts`)
   - Minibob MCP client handles this

### Phase 3: Data Flow

**Activity Execution Flow:**
```
User: "Add a feature"
  ↓
OpenCode Session (session.ts)
  ↓
OpenCode Tool Handler (tool/activity.ts)
  ↓
minibob.ActivityExecutor.execute({ template, variables, reason })
  ↓
minibob creates impulses
  ↓
minibob executes tasks via LLM
  ↓
minibob reports to metabob-activity-api via MCP
  ↓
minibob returns ActivityExecution result
  ↓
OpenCode updates UI with progress
  ↓
User sees activity completion in TUI
```

**Impulse Creation Flow:**
```
LLM calls impulse_create tool
  ↓
OpenCode Tool Handler (tool/impulse-create.ts)
  ↓
minibob.createImpulse({ id, pointer, budget })
  ↓
minibob stores in ImpulseStore
  ↓
minibob syncs to metabob-activity-api via MCP
  ↓
OpenCode updates UI sidebar
```

**MCP Configuration:**
```
OpenCode config.ts initializes MCP connections
  ↓
Pass MCP clients to minibob.initializeMCP()
  ↓
minibob uses MCP for:
  - Template loading
  - Execution reporting
  - Impulse storage
  - Activity search
```

## Implementation Plan

### Step 1: Package minibob as Library

**Tasks:**
- [ ] Update `repos/minibob/package.json` with proper exports
- [ ] Add build script for TypeScript compilation (optional, can use Bun directly)
- [ ] Create `repos/minibob/index.ts` that exports main APIs
- [ ] Test importing in metabob-opencode

**Expected Duration:** 1-2 hours

### Step 2: Create MinibobAdapter in OpenCode

**File:** `repos/metabob-opencode/packages/opencode/src/minibob/executor-adapter.ts`

```typescript
import { ActivityExecutor, type ExecutorConfig } from "@metabob/minibob"
import { Session } from "../session/session"
import { Config } from "../config/config"

export namespace MinibobExecutorAdapter {
  export async function createExecutor(
    session: Session.Info,
    config: Config.Info
  ): Promise<ActivityExecutor> {
    const executorConfig: ExecutorConfig = {
      provider: "anthropic",
      apiKey: config.anthropic.apiKey,
      model: session.agent.model,
      workingDirectory: session.project.directory,
      systemPrompt: getSystemPrompt(session),
      customTools: getOpenCodeTools(session), // Pass opencode-specific tools
    }

    return new ActivityExecutor(executorConfig)
  }

  function getSystemPrompt(session: Session.Info): string {
    // Build system prompt from session context
    return `You are ${session.agent.name}...`
  }

  function getOpenCodeTools(session: Session.Info) {
    // Provide opencode-specific tools (if any)
    // e.g., session state access, UI updates
    return {}
  }
}
```

**Tasks:**
- [ ] Create executor adapter
- [ ] Map opencode Config to minibob ExecutorConfig
- [ ] Pass MCP clients from opencode to minibob
- [ ] Handle custom tools (if needed)

**Expected Duration:** 2-3 hours

### Step 3: Update Activity Tool

**File:** `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Before (current):**
```typescript
import { Activity } from "../session/activity"

export const activity = Tool.define({
  async handler({ session, parameters }) {
    // OpenCode's own activity executor
    return Activity.execute(session, parameters)
  }
})
```

**After (minibob):**
```typescript
import { MinibobExecutorAdapter } from "../minibob/executor-adapter"
import { loadTemplateFromMCPOrLocal } from "@metabob/minibob/activity"

export const activity = Tool.define({
  async handler({ session, config, parameters }) {
    const executor = await MinibobExecutorAdapter.createExecutor(session, config)
    const template = await loadTemplateFromMCPOrLocal(parameters.templateId)
    
    const execution = await executor.execute({
      template,
      variables: parameters.variables,
      reason: parameters.reason,
      onTaskStart: (taskId) => {
        // Update UI
        session.updateUI({ currentTask: taskId })
      },
      onTaskComplete: (taskId, result) => {
        // Update UI
        session.updateUI({ completedTask: taskId, result })
      }
    })

    return {
      activityId: execution.id,
      status: execution.status,
      metrics: execution.metrics
    }
  }
})
```

**Tasks:**
- [ ] Replace Activity.execute with minibob executor
- [ ] Add UI progress callbacks
- [ ] Handle execution errors
- [ ] Update return format

**Expected Duration:** 2-4 hours

### Step 4: Update Impulse Tools

**Files:**
- `src/tool/impulse-create.ts`
- `src/tool/impulse-load.ts`
- `src/tool/impulse-list.ts`
- etc.

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

export const impulse_create = Tool.define({
  handler({ session, parameters }) {
    const impulse = createImpulse({
      id: parameters.id,
      pointer: parameters.pointer,
      budget: parameters.budget,
      priority: parameters.priority
    })
    
    // Update UI sidebar
    session.updateUI({ newImpulse: impulse })
    
    return impulse
  }
})
```

**Tasks:**
- [ ] Update impulse_create
- [ ] Update impulse_load
- [ ] Update impulse_list
- [ ] Update impulse_delete
- [ ] Update impulse_unload
- [ ] Remove opencode impulse manager

**Expected Duration:** 3-4 hours

### Step 5: Initialize MCP in minibob

**File:** `repos/metabob-opencode/packages/opencode/src/session/session.ts`

**Add initialization:**
```typescript
import { initializeMCP } from "@metabob/minibob/mcp"

export namespace Session {
  export async function create(config: Config.Info): Promise<Session.Info> {
    // ... existing session creation ...

    // Initialize minibob MCP connection
    if (config.mcp.metabob?.enabled) {
      await initializeMCP({
        endpoint: config.mcp.metabob.url,
        apiKey: config.metabob.apiKey,
        timeout: 30000
      })
    }

    return session
  }
}
```

**Tasks:**
- [ ] Initialize MCP in session creation
- [ ] Pass MCP config to minibob
- [ ] Handle MCP connection errors
- [ ] Add health check

**Expected Duration:** 1-2 hours

### Step 6: Remove OpenCode Activity System

**Files to DELETE:**
```
src/session/activity.ts                    # Main activity executor
src/session/activity-*.ts                  # All activity helpers
src/session/impulse-*.ts                   # All impulse managers
src/session/memory-agent.ts                # Memory agent (handled by minibob)
src/session/memory-lifecycle.ts            # Lifecycle hooks
src/session/turn-lifecycle.ts              # Turn hooks
src/session/activity-template-repository.ts # Template management
```

**Tasks:**
- [ ] Audit dependencies on deleted files
- [ ] Update imports to use minibob
- [ ] Remove unused exports
- [ ] Clean up tests

**Expected Duration:** 2-3 hours

### Step 7: Update UI to Display minibob Status

**File:** `repos/metabob-opencode/packages/opencode/src/server/tui.ts`

**Add minibob activity progress display:**
```typescript
function renderActivityPanel(execution: ActivityExecution) {
  return (
    <Panel title="Activity Progress">
      <Text>Activity: {execution.templateId}</Text>
      <Text>Status: {execution.status}</Text>
      <Text>Tasks: {execution.taskResults.length}/{execution.totalTasks}</Text>
      <ProgressBar 
        current={execution.taskResults.length} 
        total={execution.totalTasks} 
      />
    </Panel>
  )
}
```

**Tasks:**
- [ ] Add activity progress panel
- [ ] Display task completion
- [ ] Show metrics (duration, cost)
- [ ] Update impulse sidebar

**Expected Duration:** 2-3 hours

### Step 8: Testing & Validation

**Test scenarios:**
1. **Activity Execution**
   - Run simple activity template
   - Run activity with impulses
   - Run nested activities
   - Verify MCP reporting

2. **Impulse Management**
   - Create impulses
   - Load impulses
   - Delete impulses
   - Verify budget enforcement

3. **UI Integration**
   - Activity progress display
   - Impulse sidebar updates
   - Error handling
   - Metrics display

4. **MCP Integration**
   - Template loading
   - Execution reporting
   - Impulse storage
   - Activity search

**Tasks:**
- [ ] Write integration tests
- [ ] Manual testing
- [ ] Performance benchmarks
- [ ] Error handling validation

**Expected Duration:** 4-6 hours

## Migration Checklist

### Configuration Changes

**repos/metabob-opencode/package.json:**
```json
{
  "dependencies": {
    "@metabob/minibob": "workspace:*"
  },
  "workspaces": {
    "packages": [
      "packages/*",
      "../minibob"  // Include minibob in workspace
    ]
  }
}
```

**repos/metabob-opencode/packages/opencode/opencode.json:**
```json
{
  "minibob": {
    "enabled": true,
    "mode": "library"  // Not HTTP server
  },
  "mcp": {
    "metabob": {
      "type": "remote",
      "url": "http://metabob-activity-api:3000/mcp",
      "enabled": true
    }
  }
}
```

### Code Removal Summary

**DELETE these directories:**
- `src/session/activity-*.ts` (except activity-template schema)
- `src/session/impulse-*.ts`
- `src/session/memory-*.ts`

**KEEP these files:**
- `src/session/session.ts` (session management)
- `src/session/message.ts` (message handling)
- `src/session/git.ts` (git context)

**UPDATE these files:**
- `src/tool/activity.ts` → Use minibob executor
- `src/tool/impulse-*.ts` → Use minibob impulse system
- `src/server/tui.ts` → Display minibob progress

### Benefits After Migration

1. **Code Reduction:**
   - Remove ~10,000 LOC from opencode
   - Single source of truth (minibob)

2. **Maintainability:**
   - Activity logic in one place (minibob)
   - OpenCode focuses on UI/UX

3. **Reusability:**
   - Other tools can use minibob library
   - Consistent activity execution across vessels

4. **Performance:**
   - No HTTP overhead
   - Shared memory
   - Faster execution

5. **Features:**
   - Native impulse support
   - ACP protocol
   - Self-development capability

## Rollback Plan

**If integration fails:**
1. Keep old opencode activity system in git branch
2. Feature flag: `config.minibob.enabled = false`
3. Fallback to opencode's activity executor
4. Gradual migration per tool

**Feature flag implementation:**
```typescript
if (config.minibob.enabled) {
  return minibobExecutor.execute(params)
} else {
  return Activity.execute(params) // Old system
}
```

## Timeline Estimate

| Phase | Tasks | Duration |
|-------|-------|----------|
| 1. Package minibob | Setup npm package | 1-2 hours |
| 2. Create adapter | Executor adapter | 2-3 hours |
| 3. Update activity tool | Replace execution | 2-4 hours |
| 4. Update impulse tools | Replace managers | 3-4 hours |
| 5. MCP initialization | Connect to backend | 1-2 hours |
| 6. Remove old code | Delete files | 2-3 hours |
| 7. Update UI | Progress display | 2-3 hours |
| 8. Testing | Integration tests | 4-6 hours |
| **Total** | | **17-27 hours** |

## Success Criteria

✅ **Activity execution:**
- Activities run via minibob executor
- Results displayed in opencode UI
- MCP reporting works

✅ **Impulse system:**
- Impulses created via minibob
- Token budgets enforced
- UI sidebar updates

✅ **Code reduction:**
- 10,000+ LOC removed from opencode
- No duplicated logic

✅ **Performance:**
- Activities execute faster than before
- No HTTP overhead

✅ **Tests:**
- All integration tests pass
- Manual testing complete

## Next Steps

1. **Review this plan** with the team
2. **Create feature branch** `feat/minibob-integration`
3. **Start with Phase 1** (package minibob)
4. **Iterate incrementally** (one phase at a time)
5. **Test thoroughly** after each phase
6. **Merge when stable** and all tests pass

## Questions & Decisions Needed

1. **MCP Configuration:**
   - Should opencode manage MCP connections and pass to minibob?
   - Or should minibob initialize its own MCP clients?
   - **Recommendation:** OpenCode initializes, passes to minibob (better control)

2. **Session Memory:**
   - Does minibob need session memory agent?
   - Or should opencode handle session context?
   - **Recommendation:** OpenCode manages session, minibob manages activity lifecycle

3. **Custom Tools:**
   - Should opencode tools be passed to minibob?
   - Or should minibob only use built-in tools?
   - **Recommendation:** Pass opencode-specific tools (if any) as customTools

4. **Error Handling:**
   - How should minibob errors be displayed in UI?
   - **Recommendation:** minibob throws, opencode catches and displays

5. **Progress Updates:**
   - Real-time progress via callbacks?
   - Or polling minibob state?
   - **Recommendation:** Callbacks (onTaskStart, onTaskComplete) for real-time UI

## Conclusion

This integration transforms metabob-opencode into a **lightweight UI frontend** for minibob, achieving:
- **Separation of concerns:** UI vs execution
- **Code reduction:** 10,000+ LOC removed
- **Reusability:** minibob as library for other tools
- **Performance:** No HTTP overhead
- **Maintainability:** Single source of truth

The migration is **incremental** and **reversible** with feature flags, allowing safe rollback if issues arise.
