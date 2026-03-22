# OpenCode ↔ Minibob Separation Plan

**Date**: 2026-03-20  
**Objective**: Remove shadowing functionality from metabob-opencode, keep it as a lightweight TUI frontend  
**Philosophy**: Minibob = execution engine | OpenCode = user interface

---

## Executive Summary

**Current Problem**: metabob-opencode has ~15,000+ lines of activity/impulse/lifecycle code that duplicates and shadows functionality that should live in minibob.

**Target Architecture**:
- **Minibob**: Lightweight agent execution environment (activities, impulses, MCP, vessels, self-development)
- **OpenCode**: TUI frontend for sending goals, displaying results, managing sessions

**Impact**: Remove ~33 files (~15,000 LOC) from opencode, delegate all execution to minibob

---

## Current State Analysis

### OpenCode Duplication (TO BE REMOVED)

| Category | Files | Total LOC | Status |
|----------|-------|-----------|--------|
| **Activity System** | 20 files | ~8,500 LOC | ❌ Shadows minibob |
| **Impulse System** | 7 files | ~2,500 LOC | ❌ Shadows minibob |
| **Memory/Lifecycle** | 4 files | ~2,400 LOC | ❌ Shadows minibob |
| **ACP Delegation** | 9 files | ~1,800 LOC | ❌ Shadows minibob |
| **Session Orchestration** | 5 files | ~3,000 LOC | ⚠️ Mixed (some needed) |

**Total to Remove**: ~33 files, ~15,000+ LOC

### Minibob Core (CANONICAL SOURCE)

| Module | File | LOC | Purpose |
|--------|------|-----|---------|
| Activity Execution | `activity.ts` | 850 | Execute activities with tasks |
| Impulse Management | `impulse.ts` | 300 | Create, store, load impulses |
| Lifecycle Hooks | `lifecycle-hooks.ts` | 200 | Register activity hooks |
| Goal Processing | `goal-processor.ts` | 400 | Parse goals, recommend activities |
| Memory Agent | `memory-agent.ts` | 380 | Session memory management |
| ACP Support | `acp.ts` | 420 | Agent delegation |
| MCP Integration | `mcp.ts` | 500 | MCP server management |
| Boredom System | `boredom.ts` | 340 | Autonomous background tasks |
| Tool System | `tools.ts` | 1,080 | Tool creation & execution |

**Total Minibob**: ~4,500 LOC (clean, focused)

---

## Target Architecture

### Minibob (Execution Engine)

```
┌─────────────────────────────────────────────────┐
│              Minibob Library                     │
├─────────────────────────────────────────────────┤
│ • ActivityExecutor (activities, tasks)          │
│ • GoalProcessor (goal → activity mapping)       │
│ • ImpulseStore (create, load, format impulses)  │
│ • SessionMemoryAgent (context optimization)     │
│ • LifecycleHooks (activity lifecycle)           │
│ • MCPClient (vessel loading, tool discovery)    │
│ • BoredomExecutor (autonomous background work)  │
│ • ACPHandler (agent delegation)                 │
│ • ToolFactory (dynamic tool creation)           │
│ • VesselLoader (load & configure capabilities)  │
└─────────────────────────────────────────────────┘
```

**Responsibilities**:
- ✅ Execute activities with full task orchestration
- ✅ Manage impulses (create, load, resolve, format)
- ✅ Handle lifecycle hooks (onBeforePrompt, onActivityComplete)
- ✅ Process goals into activity recommendations
- ✅ Load vessels (MCP servers) dynamically
- ✅ Create tools via vessel development
- ✅ Self-develop (align code ↔ docs, instrument data flows)
- ✅ Autonomous improvement (boredom system)

### OpenCode (TUI Frontend)

```
┌─────────────────────────────────────────────────┐
│            OpenCode TUI Frontend                 │
├─────────────────────────────────────────────────┤
│ • SessionPrompt (message routing)               │
│ • MinibobIntegration (delegate to minibob)      │
│ • ToolRegistry (expose goal/activity tools)     │
│ • UI Components (TUI display, input handling)   │
│ • Config Management (opencode.json)             │
│ • Project/Instance (workspace context)          │
│ • Provider Integration (Anthropic, OpenAI)      │
└─────────────────────────────────────────────────┘
```

**Responsibilities**:
- ✅ Display TUI interface for user interaction
- ✅ Route user goals to minibob
- ✅ Stream minibob execution results to UI
- ✅ Manage opencode configuration
- ✅ Handle project/workspace context
- ✅ Provide LLM provider configuration
- ❌ NO activity execution
- ❌ NO impulse management
- ❌ NO lifecycle orchestration
- ❌ NO direct ACP delegation

---

## Files to Remove from OpenCode

### 1. Activity System (20 files, ~8,500 LOC)

#### Session Files
- ❌ `session/activity.ts` (1,617 LOC) - Core activity execution
- ❌ `session/activity-complete.ts` (441 LOC) - Completion handlers
- ❌ `session/activity-correctness.ts` (249 LOC) - Validation
- ❌ `session/activity-coordination.ts` (164 LOC) - Multi-activity orchestration
- ❌ `session/activity-state-capture.ts` (301 LOC) - State tracking
- ❌ `session/activity-schema-adapter.ts` (557 LOC) - Schema conversion
- ❌ `session/activity-template-repository.ts` (323 LOC) - Template storage
- ❌ `session/activity-template.ts` (3,000+ LOC) - Template management
- ❌ `session/activity-git.ts` (385 LOC) - Git integration
- ❌ `session/activity-lifecycle-logger.ts` (203 LOC) - Lifecycle logging
- ❌ `session/activity-failure-analysis.ts` (395 LOC) - Error analysis
- ❌ `session/activity-enforcement-gate.ts` (152 LOC) - Quality gates
- ❌ `session/activity-message-forwarder.ts` (388 LOC) - Message forwarding
- ❌ `session/activity-prefix.ts` (150 LOC) - Prefix management
- ❌ `session/activity-todo.ts` (104 LOC) - Todo integration
- ❌ `session/activity-generator.ts` (67 LOC) - Template generation
- ❌ `session/activity-autocomplete.ts` (148 LOC) - Autocomplete
- ❌ `session/template-*.ts` (10+ files, ~2,500 LOC) - Template utilities
- ❌ `session/bootstrap-templates.ts` (500+ LOC) - Template bootstrapping
- ❌ `session/trailblazing-executor.ts` (528 LOC) - Trailblazing mode

#### Tool Files
- ❌ `tool/activity.ts` (4,500+ LOC) - Activity tool implementation
- ❌ `tool/activity-replay.ts` (780 LOC) - Replay failed activities
- ❌ `tool/activity-error-inspector.ts` (1,240 LOC) - Error inspection
- ❌ `tool/activity-errors.ts` (590 LOC) - Error types
- ❌ `tool/create-activity-goal-seeking.ts` (345 LOC) - Goal-seeking template creation
- ❌ `tool/get-activity-template.ts` (73 LOC) - Template retrieval
- ❌ `tool/list-activity-templates.ts` (67 LOC) - Template listing
- ❌ `tool/post-activity-result.ts` (116 LOC) - Result posting
- ❌ `tool/register-activity-template.ts` (368 LOC) - Template registration
- ❌ `tool/search-activities.ts` (207 LOC) - Activity search

#### CLI Files
- ❌ `cli/cmd/activity.ts` (1,828 LOC) - Activity CLI commands

**Replacement**: All delegated to `MinibobIntegration.executeActivity()` and `MinibobIntegration.submitGoal()`

### 2. Impulse System (7 files, ~2,500 LOC)

- ❌ `session/impulse-resolver.ts` (834 LOC) - Resolve impulse pointers
- ❌ `session/impulse-cache.ts` (319 LOC) - Impulse caching
- ❌ `session/impulse-formatter.ts` (183 LOC) - Format for display
- ❌ `session/impulse-serializer.ts` (217 LOC) - Serialize/deserialize
- ❌ `session/impulse-learning.ts` (115 LOC) - Learning integration
- ❌ `session/impulse-binding.ts` (231 LOC) - Bind impulses to activities
- ❌ `session/impulse-sync.ts` (100 LOC) - Sync between sessions

#### Tool Files
- ❌ `tool/impulse-create.ts` (245 LOC)
- ❌ `tool/impulse-delete.ts` (65 LOC)
- ❌ `tool/impulse-list.ts` (136 LOC)
- ❌ `tool/impulse-load.ts` (144 LOC)
- ❌ `tool/impulse-unload.ts` (82 LOC)
- ❌ `tool/impulse-update.ts` (135 LOC)

**Replacement**: Minibob's `ImpulseStore` (via `impulse.ts`)

### 3. Memory & Lifecycle (4 files, ~2,400 LOC)

- ❌ `session/memory-agent.ts` (1,291 LOC) - Memory agent orchestration
- ❌ `session/memory-lifecycle.ts` (347 LOC) - Memory lifecycle hooks
- ❌ `session/memory-manager.ts` (271 LOC) - Memory management
- ❌ `session/session-memory.ts` (494 LOC) - Session memory storage
- ❌ `session/session-memory-metrics.ts` (235 LOC) - Memory metrics
- ❌ `session/turn-lifecycle.ts` (281 LOC) - Turn lifecycle hooks
- ❌ `session/turn-lifecycle-hooks.ts` (525 LOC) - Hook implementations

#### Tool Files
- ❌ `tool/memory-budget.ts`
- ❌ `tool/memory-optimize.ts`
- ❌ `tool/memory-outline.ts`
- ❌ `tool/negotiate-context.ts`
- ❌ `tool/activity-reason.ts`

**Replacement**: Minibob's `SessionMemoryAgent` + `LifecycleHooks`

### 4. ACP Delegation (9 files, ~1,800 LOC)

- ❌ `acp/agent.ts` (998 LOC) - ACP agent implementation
- ❌ `acp/session.ts` (72 LOC) - ACP session management
- ❌ `acp/registry.ts` (122 LOC) - Agent registry
- ❌ `acp/types.ts` (84 LOC) - ACP types
- ❌ `acp/transports/transport.ts` (102 LOC) - Base transport
- ❌ `acp/transports/docker-transport.ts` (186 LOC) - Docker transport
- ❌ `acp/transports/tcp-transport.ts` (118 LOC) - TCP transport
- ❌ `acp/transports/discovery-transport.ts` (66 LOC) - Discovery
- ❌ `acp/transports/factory.ts` (54 LOC) - Transport factory

#### Tool Files
- ❌ `tool/acp-delegate.ts` (729 LOC)
- ❌ `tool/acp-request-impulse-content.ts` (198 LOC)

#### CLI Files
- ❌ `cli/cmd/acp.ts` (90 LOC)

**Replacement**: Minibob's `ACPHandler` (via `acp.ts`)

### 5. Session Orchestration (PARTIAL - Review Needed)

⚠️ **Keep** (Core session management):
- ✅ `session/index.ts` - Session CRUD, metadata
- ✅ `session/prompt.ts` - Message routing to LLM
- ✅ `session/message-v2.ts` - Message types
- ✅ `session/context.ts` - Session context utilities

⚠️ **Remove** (Execution orchestration):
- ❌ `session/goal-seeking-planner.ts` (594 LOC) - Goal decomposition
- ❌ `session/goal-inference-engine.ts` (237 LOC) - Goal inference
- ❌ `session/recommendation-engine.ts` (614 LOC) - Activity recommendations
- ❌ `session/template-selector.ts` (545 LOC) - Template selection
- ❌ `session/autonomous-trailblazing.ts` (660 LOC) - Autonomous mode

**Replacement**: Minibob's `GoalProcessor`

---

## Files to Keep in OpenCode

### Core TUI Functionality

1. **Session Management** (Basic CRUD only)
   - ✅ `session/index.ts` - Session metadata, storage
   - ✅ `session/message-v2.ts` - Message types
   - ✅ `session/context.ts` - Context utilities

2. **Message Routing**
   - ✅ `session/prompt.ts` - Route messages to LLM
   - ✅ `session/prompts-runner.ts` - Run prompts

3. **UI Layer**
   - ✅ All `cli/` files (except `cli/cmd/activity.ts`, `cli/cmd/acp.ts`)
   - ✅ All `tui/` files (if exists)
   - ✅ All `ui/` packages

4. **Configuration**
   - ✅ `config/` - OpenCode configuration
   - ✅ `project/` - Workspace/instance management
   - ✅ `provider/` - LLM provider integration

5. **Core Infrastructure**
   - ✅ `agent/agent.ts` - Agent definitions (plan/review/activity modes)
   - ✅ `tool/tool.ts` - Tool registry and base types
   - ✅ `bus/` - Event bus
   - ✅ `storage/` - Storage layer
   - ✅ `util/` - Utilities
   - ✅ `id/` - ID generation

6. **Minibob Integration** (NEW - Keep)
   - ✅ `minibob-integration/index.ts` - Delegate to minibob
   - ✅ `tool/goal.ts` - Simplified goal tool (delegates to minibob)

---

## Refactored Tool API

### Before (Complex, Duplicated)

```typescript
// opencode implements full activity execution
activity({ templateId, variables, reason, trailblazing: {...} })

// opencode implements impulse management
impulse_create({ id, pointer, budget })
impulse_load({ id })
impulse_unload({ id })

// opencode implements memory management
memory_optimize({ sessionID })
memory_budget({ sessionID })

// opencode implements ACP delegation
acp_delegate({ target, prompt, shareImpulses })
```

### After (Simple, Delegated)

```typescript
// Single goal tool - delegates to minibob
goal({ 
  goal: "Add user authentication with JWT tokens",
  context: { files: ["src/auth.ts"] },
  maxActivities: 5,
  maxCost: 10.0
})

// Minibob handles:
// - Goal parsing
// - Activity recommendation
// - Activity execution
// - Impulse management
// - Memory optimization
// - Lifecycle hooks
// - Self-development
// - Vessel loading
```

---

## Implementation Phases

### Phase 1: Audit & Documentation (1 day)

**Goal**: Understand all dependencies and create removal checklist

1. ✅ Identify all files to remove (this document)
2. Map import dependencies
3. Find external references (tests, docs, examples)
4. Create detailed removal order (dependency-first)
5. Document breaking changes

**Deliverables**:
- Dependency graph
- Removal order checklist
- Breaking changes list

### Phase 2: Simplify Tool API (2 days)

**Goal**: Replace 30+ tools with single `goal` tool

1. **Simplify `tool/goal.ts`**:
   - Remove local goal processing
   - Delegate 100% to `MinibobIntegration.submitGoal()`
   - Add progress streaming from minibob

2. **Remove activity tools**:
   - Delete `tool/activity.ts` (keep MinibobIntegration delegate)
   - Delete `tool/activity-replay.ts`
   - Delete `tool/activity-error-inspector.ts`
   - Delete `tool/search-activities.ts`
   - Delete `tool/register-activity-template.ts`
   - Delete all other activity-* tools

3. **Remove impulse tools**:
   - Delete `tool/impulse-*.ts` (6 files)
   - Impulses managed via minibob activities

4. **Remove memory tools**:
   - Delete `tool/memory-*.ts` (4 files)
   - Delete `tool/negotiate-context.ts`
   - Memory managed by minibob's SessionMemoryAgent

5. **Remove ACP tools**:
   - Delete `tool/acp-delegate.ts`
   - Delete `tool/acp-request-impulse-content.ts`
   - ACP handled by minibob

**Deliverables**:
- Simplified goal tool (100 LOC max)
- 30+ tool files deleted
- Tool registry updated

### Phase 3: Remove Session Orchestration (2 days)

**Goal**: Remove activity/impulse/memory session code

1. **Remove activity session files** (20 files):
   ```bash
   rm session/activity*.ts
   rm session/template*.ts
   rm session/bootstrap-templates.ts
   rm session/trailblazing-executor.ts
   ```

2. **Remove impulse session files** (7 files):
   ```bash
   rm session/impulse-*.ts
   ```

3. **Remove memory session files** (7 files):
   ```bash
   rm session/memory-*.ts
   rm session/turn-lifecycle*.ts
   ```

4. **Remove goal orchestration files** (5 files):
   ```bash
   rm session/goal-*.ts
   rm session/recommendation-engine.ts
   rm session/template-selector.ts
   rm session/autonomous-trailblazing.ts
   ```

**Deliverables**:
- ~40 session files deleted (~15,000 LOC removed)
- Session module simplified to core CRUD + message routing

### Phase 4: Remove ACP Implementation (1 day)

**Goal**: Remove ACP agent/transport code

1. **Remove ACP directory**:
   ```bash
   rm -rf acp/
   ```

2. **Remove ACP CLI**:
   ```bash
   rm cli/cmd/acp.ts
   ```

**Deliverables**:
- `acp/` directory deleted (9 files, ~1,800 LOC)
- ACP CLI removed

### Phase 5: Remove Activity CLI (1 day)

**Goal**: Remove activity CLI commands

1. **Remove activity CLI**:
   ```bash
   rm cli/cmd/activity.ts
   ```

2. **Update CLI help** to reference `goal` command only

**Deliverables**:
- Activity CLI removed (1,828 LOC)
- CLI focused on session management + goal submission

### Phase 6: Update Tests (2 days)

**Goal**: Remove/update tests for deleted code

1. Delete tests for removed files:
   ```bash
   rm test/session/activity-*.test.ts
   rm test/session/impulse-*.test.ts
   rm test/session/memory-*.test.ts
   rm test/tool/activity-*.test.ts
   rm test/tool/impulse-*.test.ts
   rm test/acp-*.test.ts
   ```

2. Add integration tests for `goal` tool:
   - Test goal submission to minibob
   - Test progress streaming
   - Test error handling

**Deliverables**:
- Obsolete tests removed
- New integration tests for minibob delegation

### Phase 7: Update Documentation (1 day)

**Goal**: Document new architecture

1. Update `README.md`:
   - Clarify opencode = TUI frontend
   - Clarify minibob = execution engine

2. Update tool documentation:
   - Remove activity/impulse/memory tool docs
   - Add goal tool documentation

3. Add architecture diagram:
   - OpenCode ← MinibobIntegration → Minibob

**Deliverables**:
- Updated README
- Updated tool docs
- Architecture diagram

### Phase 8: Self-Development Bootstrap (2 days)

**Goal**: Enable minibob self-development

1. **Create bootstrap vessels**:
   - `code-alignment-vessel`: Align code to documentation
   - `instrumentation-vessel`: Instrument data flows
   - `self-improvement-vessel`: Generate improvement activities

2. **Create bootstrap activities**:
   - `align-code-to-docs`: Find doc/code mismatches, fix
   - `instrument-data-flow`: Add logging, tracing to modules
   - `create-vessel-activity`: Generate new vessel from spec

3. **Test self-development loop**:
   - Submit goal: "Align minibob code to documentation"
   - Verify minibob creates and executes activities
   - Verify code changes align to docs

**Deliverables**:
- 3 bootstrap vessels in minibob
- 3 bootstrap activities in minibob
- Self-development test passing

---

## Verification Checklist

### After Removal

- [ ] OpenCode compiles without errors
- [ ] `goal` tool works and delegates to minibob
- [ ] No remaining activity/impulse/memory imports in opencode
- [ ] TUI displays goal execution progress
- [ ] Tests pass (new integration tests)
- [ ] Documentation updated

### Minibob Functionality

- [ ] `MinibobIntegration.submitGoal()` works
- [ ] Activities execute via minibob
- [ ] Impulses managed via minibob
- [ ] Memory optimization via minibob
- [ ] Self-development activities work
- [ ] Vessel loading works
- [ ] Instrumentation works

---

## Success Metrics

### Code Reduction
- **Before**: ~70 files, ~30,000 LOC in opencode session/tool
- **After**: ~30 files, ~10,000 LOC (core UI + delegation)
- **Reduction**: ~40 files, ~20,000 LOC removed (67% reduction)

### Architectural Clarity
- **Before**: Unclear separation, duplicated code
- **After**: Clean separation (UI vs execution)
- **Benefit**: Easier maintenance, no shadowing

### Self-Development Capability
- **Before**: Manual code updates
- **After**: Minibob creates activities to align code/docs and instrument flows
- **Benefit**: Autonomous improvement

---

## Risk Mitigation

### Rollback Plan

1. **Git branches**:
   - Create branch: `refactor/minibob-separation`
   - Keep `main` stable
   - Merge only after full verification

2. **Incremental commits**:
   - Phase 1 commit: Tool simplification
   - Phase 2 commit: Session file removal
   - Phase 3 commit: ACP removal
   - Easy to revert individual phases

3. **Feature flag**:
   - Add `minibob.delegation_mode` config
   - `full`: All execution via minibob (new)
   - `hybrid`: Keep some opencode execution (rollback)
   - `off`: Disable minibob (emergency)

### Testing Strategy

1. **Unit tests**: Test goal tool delegation
2. **Integration tests**: Test full goal → minibob → result flow
3. **E2E tests**: Test TUI goal submission → activity execution
4. **Manual tests**: Execute 5-10 common goals

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Audit | 1 day | None |
| 2. Tool Simplification | 2 days | Phase 1 |
| 3. Session Removal | 2 days | Phase 2 |
| 4. ACP Removal | 1 day | Phase 3 |
| 5. CLI Removal | 1 day | Phase 4 |
| 6. Test Updates | 2 days | Phase 5 |
| 7. Documentation | 1 day | Phase 6 |
| 8. Self-Dev Bootstrap | 2 days | Phase 7 |

**Total**: 12 days (2.5 weeks)

---

## Open Questions

1. **Session storage**: Should sessions remain in opencode or move to minibob?
   - **Recommendation**: Keep in opencode (UI concern)

2. **Config management**: Should minibob config be separate from opencode config?
   - **Recommendation**: Keep unified in `opencode.json` with `minibob` section

3. **Logging**: Should activity logs go to opencode logs or minibob logs?
   - **Recommendation**: Minibob logs to structured JSON, opencode streams to TUI

4. **Backward compatibility**: Should we maintain any old tool API?
   - **Recommendation**: No - clean break, document migration

5. **CLI commands**: Should we keep `activity` CLI for debugging?
   - **Recommendation**: No - use minibob CLI directly for debugging

---

## Conclusion

This refactoring will:
1. ✅ Remove ~20,000 LOC of duplicated code from opencode
2. ✅ Establish clear architectural boundaries
3. ✅ Enable minibob self-development
4. ✅ Simplify opencode to pure TUI frontend
5. ✅ Prevent future shadowing issues

**Next Step**: Begin Phase 1 (Audit & Documentation)

---

**Status**: 📋 **PLAN READY**  
**Estimated Effort**: 12 days  
**Risk Level**: 🟡 MEDIUM (large refactor, but clear separation)
