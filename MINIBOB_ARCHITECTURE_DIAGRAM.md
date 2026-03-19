# minibob Integration Architecture

## Current Architecture (Before)

```
┌─────────────────────────────────────────────────────────────────┐
│                    metabob-opencode                             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   TUI/CLI    │  │   Session    │  │    Tools     │          │
│  │              │  │              │  │              │          │
│  │ - Rendering  │  │ - Messages   │  │ - activity   │          │
│  │ - Input      │  │ - State      │  │ - impulse_*  │          │
│  │ - Display    │  │ - Git ctx    │  │ - bash       │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           │                                    │
│  ┌────────────────────────▼──────────────────────────────┐     │
│  │         Activity System (OpenCode Native)             │     │
│  │                                                        │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │     │
│  │  │  Activity    │  │   Impulse    │  │   Memory    │ │     │
│  │  │  Executor    │  │   Manager    │  │   Agent     │ │     │
│  │  │              │  │              │  │             │ │     │
│  │  │ ~5000 LOC    │  │ ~3000 LOC    │  │ ~2000 LOC   │ │     │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │     │
│  │         │                 │                 │         │     │
│  │         └─────────────────┼─────────────────┘         │     │
│  │                           │                           │     │
│  │  ┌────────────────────────▼─────────────────────┐     │     │
│  │  │     Lifecycle Hooks & State Tracking         │     │     │
│  │  └──────────────────────────────────────────────┘     │     │
│  └────────────────────────┬───────────────────────────────┘     │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │
                            │ HTTP MCP
                            ▼
         ┌──────────────────────────────────────┐
         │      metabob-activity-api            │
         │                                      │
         │  - Template registry                 │
         │  - Execution tracking                │
         │  - Learning loop                     │
         │  - Thompson Sampling                 │
         └──────────────────────────────────────┘
```

**Problems:**
- 10,000+ LOC duplicated logic (activity, impulse, lifecycle)
- OpenCode owns activity execution (should be in vessel)
- Memory agent tightly coupled
- No reusability (other tools can't use OpenCode's activity system)

---

## New Architecture (After minibob Integration)

```
┌─────────────────────────────────────────────────────────────────┐
│             metabob-opencode (UI Frontend)                      │
│                      ~5,000 LOC                                 │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   TUI/CLI    │  │   Session    │  │    Tools     │          │
│  │              │  │              │  │              │          │
│  │ - Rendering  │  │ - Messages   │  │ - activity   │──┐       │
│  │ - Input      │  │ - State      │  │ - impulse_*  │  │       │
│  │ - Display    │  │ - Git ctx    │  │ - bash       │  │       │
│  └──────────────┘  └──────────────┘  └──────┬───────┘  │       │
│                                             │          │       │
│                                             │   Delegates to   │
│                                             │   minibob lib    │
└─────────────────────────────────────────────┼──────────┼───────┘
                                              │          │
                        import as library     │          │
                                              ▼          │
┌─────────────────────────────────────────────────────────────────┐
│                  @metabob/minibob (Library)                     │
│                      ~4,400 LOC                                 │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              ActivityExecutor                          │     │
│  │                                                        │     │
│  │  - Template loading (MCP + local)                      │     │
│  │  - Variable binding                                    │     │
│  │  - Task execution (LLM + tools)                        │     │
│  │  - Nested activities                                   │     │
│  │  - Validation                                          │     │
│  │  - Metrics tracking                                    │     │
│  └────────────────────────┬───────────────────────────────┘     │
│                           │                                    │
│  ┌────────────────────────▼───────────────────────────────┐     │
│  │              Impulse System                            │     │
│  │                                                        │     │
│  │  - Create impulses (memo, file, activityOutput)        │     │
│  │  - Load & resolve pointers                             │     │
│  │  - Token budget enforcement                            │     │
│  │  - Custom resolvers                                    │     │
│  │  - MCP sync                                            │     │
│  └────────────────────────┬───────────────────────────────┘     │
│                           │                                    │
│  ┌────────────────────────▼───────────────────────────────┐     │
│  │              MCP Activity Bridge                       │     │
│  │                                                        │     │
│  │  - Template fetch                                      │     │
│  │  - Execution reporting                                 │     │
│  │  - Impulse storage                                     │     │
│  │  - Activity search                                     │     │
│  │  - Goal-seeking creation                               │     │
│  └────────────────────────┬───────────────────────────────┘     │
│                           │                                    │
│  ┌────────────────────────▼───────────────────────────────┐     │
│  │         Tools (bash, file, git, activity, impulse)     │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ HTTP MCP
                              ▼
         ┌──────────────────────────────────────┐
         │      metabob-activity-api            │
         │                                      │
         │  - Template registry                 │
         │  - Execution tracking                │
         │  - Learning loop                     │
         │  - Thompson Sampling                 │
         │  - Impulse storage                   │
         └──────────────────────────────────────┘
```

**Benefits:**
- ✅ OpenCode: 5,000 LOC (UI only)
- ✅ minibob: 4,400 LOC (self-contained vessel)
- ✅ No duplication
- ✅ minibob reusable as library
- ✅ Single source of truth for activities
- ✅ Clean separation: UI vs execution

---

## Data Flow: Activity Execution

```
┌─────────────────────────────────────────────────────────────────┐
│  User                                                           │
│    │                                                            │
│    │ "Add authentication feature"                              │
│    ▼                                                            │
│  ┌─────────────────────────────────────────────────┐            │
│  │ OpenCode TUI                                    │            │
│  │  - Parse user input                             │            │
│  │  - Create activity tool call                    │            │
│  └───────────────────┬─────────────────────────────┘            │
│                      │                                          │
│                      │ activity({ templateId, variables })      │
│                      ▼                                          │
│  ┌─────────────────────────────────────────────────┐            │
│  │ OpenCode Tool Handler (tool/activity.ts)        │            │
│  │  - Route to minibob                             │            │
│  └───────────────────┬─────────────────────────────┘            │
└────────────────────────┼────────────────────────────────────────┘
                         │
                         │ executor.execute({ template, variables })
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  minibob.ActivityExecutor                                       │
│    │                                                            │
│    ├─► 1. Load template from MCP/local                         │
│    │                                                            │
│    ├─► 2. Create impulses (if needed)                          │
│    │      └─► minibob.ImpulseStore.create()                    │
│    │           └─► MCP sync (POST /impulses)                   │
│    │                                                            │
│    ├─► 3. Execute tasks sequentially                           │
│    │      ├─► Load impulses                                    │
│    │      ├─► Build prompt with impulse context                │
│    │      ├─► LLM call with tools                              │
│    │      ├─► Execute tool calls (bash, file, git, etc.)       │
│    │      └─► Store task output                                │
│    │                                                            │
│    ├─► 4. Validate results                                     │
│    │      └─► Run validation commands                          │
│    │                                                            │
│    ├─► 5. Report execution to MCP                              │
│    │      └─► POST /activities/executions                      │
│    │           - Success/failure                               │
│    │           - Metrics (duration, cost, tokens)              │
│    │           - Task results                                  │
│    │                                                            │
│    └─► 6. Return ActivityExecution result                      │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │
            │ { id, status, metrics, taskResults }
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpenCode Tool Handler                                          │
│    │                                                            │
│    ├─► Update UI with progress                                 │
│    │    - Display activity status                              │
│    │    - Show task completion                                 │
│    │    - Update metrics                                       │
│    │                                                            │
│    └─► Return to user                                          │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────────────────────────────────┐            │
│  │ OpenCode TUI                                    │            │
│  │  - Render activity completion                   │            │
│  │  - Show metrics (duration, cost)                │            │
│  │  - Display task outputs                         │            │
│  └─────────────────────────────────────────────────┘            │
│           │                                                     │
│           ▼                                                     │
│  User sees result                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Impulse Creation

```
┌─────────────────────────────────────────────────────────────────┐
│  LLM calls impulse_create tool                                  │
│    │                                                            │
│    │ { id: "analysis", type: "file", content: "src/auth.ts" }  │
│    ▼                                                            │
│  ┌─────────────────────────────────────────────────┐            │
│  │ OpenCode Tool Handler (tool/impulse-create.ts)  │            │
│  │  - Validate parameters                          │            │
│  │  - Route to minibob                             │            │
│  └───────────────────┬─────────────────────────────┘            │
└────────────────────────┼────────────────────────────────────────┘
                         │
                         │ createImpulse({ id, pointer, budget })
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  minibob.ImpulseStore                                           │
│    │                                                            │
│    ├─► 1. Create impulse record                                │
│    │      - Store in memory map                                │
│    │      - Set loaded=false initially                         │
│    │                                                            │
│    ├─► 2. Sync to MCP backend (if enabled)                     │
│    │      └─► POST /impulses                                   │
│    │           - id, pointer, budget, priority                 │
│    │                                                            │
│    └─► 3. Return impulse object                                │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │
            │ { id, pointer, budget, loaded: false }
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpenCode Tool Handler                                          │
│    │                                                            │
│    ├─► Update UI sidebar                                       │
│    │    - Add impulse to sidebar list                          │
│    │    - Show impulse metadata                                │
│    │                                                            │
│    └─► Return to LLM                                           │
│           │                                                     │
│           ▼                                                     │
│  LLM receives confirmation                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### OpenCode (UI Frontend)

**Keep:**
- ✅ Terminal UI rendering (TUI)
- ✅ User input handling
- ✅ Session state (messages, history)
- ✅ Git context display
- ✅ File tree navigation
- ✅ Chat interface
- ✅ Tool coordination (route to minibob)
- ✅ Configuration management
- ✅ MCP connection initialization

**Remove:**
- ❌ Activity execution engine
- ❌ Activity template management
- ❌ Impulse creation/management
- ❌ Lifecycle hooks
- ❌ Memory agent
- ❌ Activity state tracking
- ❌ Metrics collection

**LOC:** ~5,000 (down from ~15,000)

---

### minibob (Execution Library)

**Responsibilities:**
- ✅ Activity template execution
- ✅ Impulse system (create, load, resolve)
- ✅ MCP integration (template loading, reporting)
- ✅ Lifecycle management (activity, impulse)
- ✅ Tool execution (bash, file, git, activity, impulse)
- ✅ LLM interaction
- ✅ Validation
- ✅ Metrics tracking
- ✅ ACP protocol (vessel-to-vessel)

**LOC:** ~4,400

---

### metabob-activity-api (Backend)

**Responsibilities:**
- ✅ Template registry
- ✅ Execution tracking
- ✅ Learning loop (Thompson Sampling)
- ✅ Impulse storage
- ✅ Metrics aggregation
- ✅ Activity search
- ✅ Goal-seeking template creation

**LOC:** ~8,000 (separate service)

---

## Migration Strategy

### Phase 1: Package minibob as Library
1. Update `repos/minibob/package.json`
2. Add exports for ActivityExecutor, Impulse, MCP
3. Test importing in opencode

### Phase 2: Create OpenCode Adapter
1. Create `src/minibob/executor-adapter.ts`
2. Map OpenCode config → minibob ExecutorConfig
3. Pass MCP clients to minibob

### Phase 3: Update Tools
1. Update `tool/activity.ts` → Use minibob executor
2. Update `tool/impulse-*.ts` → Use minibob impulse system
3. Add UI progress callbacks

### Phase 4: Remove Old Code
1. Delete `src/session/activity*.ts`
2. Delete `src/session/impulse*.ts`
3. Delete `src/session/memory*.ts`
4. Clean up imports

### Phase 5: Update UI
1. Activity progress panel
2. Impulse sidebar
3. Metrics display

### Phase 6: Test & Validate
1. Integration tests
2. Manual testing
3. Performance benchmarks

**Total Effort:** 17-27 hours

---

## Success Metrics

- ✅ OpenCode LOC: ~5,000 (down from ~15,000)
- ✅ minibob as reusable library
- ✅ No duplicated logic
- ✅ All tests passing
- ✅ UI displays activity progress
- ✅ MCP reporting works
- ✅ Impulse system functional

---

## Conclusion

This architecture transforms metabob-opencode from a **monolithic activity system** into a **lightweight UI frontend** that delegates all execution logic to minibob (used as a library).

**Key Benefits:**
1. **Separation of concerns:** UI vs execution
2. **Code reduction:** 10,000 LOC removed
3. **Reusability:** minibob as library for other tools
4. **Maintainability:** Single source of truth
5. **Performance:** No HTTP overhead (library import)
6. **Flexibility:** Other vessels can use minibob

This is the **correct architecture** for a vessel-based system: OpenCode focuses on **user experience**, minibob focuses on **activity execution**, and the backend focuses on **learning and optimization**.
