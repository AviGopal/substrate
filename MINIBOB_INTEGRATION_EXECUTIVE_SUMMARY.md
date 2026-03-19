# Executive Summary: minibob Integration

## The Goal

Transform **metabob-opencode** from a monolithic activity execution system into a **lightweight UI frontend** that uses **minibob as a library** for all activity execution, impulse management, and lifecycle hooks.

---

## The Problem

**Current State:**
- metabob-opencode contains **10,000+ lines** of activity execution logic
- Duplicates functionality that should be in the vessel layer (minibob)
- Tightly coupled UI and execution logic
- Not reusable by other tools
- Memory agent and lifecycle hooks embedded in OpenCode

**Issues:**
- Hard to maintain (changes need to happen in two places)
- No separation of concerns (UI + execution mixed)
- Other vessels can't leverage OpenCode's activity system
- OpenCode is doing too much

---

## The Solution

**Use minibob as a library** instead of HTTP server:

```typescript
// In metabob-opencode
import { ActivityExecutor } from "@metabob/minibob"

const executor = new ActivityExecutor(config)
const result = await executor.execute({ template, variables, reason })
```

**New Architecture:**
```
metabob-opencode (UI Frontend)
    ↓ (import as library)
minibob (@metabob/minibob package)
    ↓ (HTTP MCP)
metabob-activity-api (backend)
```

---

## What Changes

### OpenCode Keeps (UI Only)
- ✅ Terminal UI (TUI) rendering
- ✅ Session management (messages, state)
- ✅ User input handling
- ✅ Git context display
- ✅ File navigation
- ✅ Tool coordination (route to minibob)

### OpenCode Removes (Delegate to minibob)
- ❌ Activity execution engine (`src/session/activity*.ts`)
- ❌ Impulse management (`src/session/impulse*.ts`)
- ❌ Memory agent (`src/session/memory-agent.ts`)
- ❌ Lifecycle hooks (`src/session/*-lifecycle.ts`)
- ❌ Template repository
- ❌ ~10,000 lines of code

### minibob Handles (Self-Contained)
- ✅ Activity template execution
- ✅ Impulse system (create, load, resolve)
- ✅ MCP integration (templates, reporting)
- ✅ Lifecycle management
- ✅ Tool execution (bash, file, git, activity, impulse)
- ✅ LLM interaction
- ✅ Validation and metrics

---

## Why Use minibob as Library (Not HTTP Server)

**Option 1: HTTP Server** ❌
```
OpenCode → HTTP → minibob server → HTTP → metabob-activity-api
```
- Network overhead
- Serialization cost
- Port management
- Complex deployment

**Option 2: Library Import** ✅
```
OpenCode → minibob library → HTTP → metabob-activity-api
```
- No HTTP overhead
- Shared memory (impulses, templates)
- Synchronous API
- Single process
- Simple deployment

---

## Benefits

### 1. Code Reduction
- **Before:** OpenCode = 15,000 LOC
- **After:** OpenCode = 5,000 LOC (UI only)
- **Removed:** 10,000 LOC of activity logic

### 2. Separation of Concerns
- **OpenCode:** UI/UX (rendering, input, display)
- **minibob:** Execution (activities, impulses, lifecycle)
- **Backend:** Learning (Thompson Sampling, metrics)

### 3. Reusability
- minibob as npm package: `@metabob/minibob`
- Other tools can import and use
- Single source of truth for activities

### 4. Maintainability
- Changes to activity logic: **only in minibob**
- Changes to UI: **only in OpenCode**
- No duplication

### 5. Performance
- No HTTP serialization
- Shared memory (faster impulse access)
- Direct function calls

---

## Implementation Steps

### Step 1: Package minibob (1-2 hours)
```json
// repos/minibob/package.json
{
  "name": "@metabob/minibob",
  "exports": {
    ".": "./index.ts",
    "./activity": "./src/activity.ts",
    "./impulse": "./src/impulse.ts"
  }
}
```

### Step 2: Create Adapter (2-3 hours)
```typescript
// repos/metabob-opencode/src/minibob/executor-adapter.ts
export async function createExecutor(session, config) {
  return new ActivityExecutor({
    provider: "anthropic",
    apiKey: config.anthropic.apiKey,
    model: session.agent.model,
    workingDirectory: session.project.directory,
  })
}
```

### Step 3: Update Tools (5-8 hours)
```typescript
// repos/metabob-opencode/src/tool/activity.ts
import { MinibobExecutorAdapter } from "../minibob/executor-adapter"

export const activity = Tool.define({
  async handler({ session, config, parameters }) {
    const executor = await MinibobExecutorAdapter.createExecutor(session, config)
    return executor.execute(parameters)
  }
})
```

### Step 4: Remove Old Code (2-3 hours)
Delete:
- `src/session/activity*.ts`
- `src/session/impulse*.ts`
- `src/session/memory*.ts`

### Step 5: Update UI (2-3 hours)
- Activity progress panel
- Impulse sidebar updates
- Metrics display

### Step 6: Test (4-6 hours)
- Integration tests
- Manual testing
- Performance validation

**Total:** 17-27 hours

---

## Migration Path

### Phase 1: Setup
1. Package minibob as npm library
2. Add to OpenCode workspace
3. Test imports

### Phase 2: Integration
1. Create adapter
2. Update activity tool
3. Update impulse tools

### Phase 3: Cleanup
1. Remove old code
2. Update UI
3. Test thoroughly

### Phase 4: Validation
1. All tests pass
2. Manual testing
3. Performance check

---

## Risk Mitigation

**Feature Flag Approach:**
```typescript
if (config.minibob.enabled) {
  // Use minibob executor
  return minibobExecutor.execute(params)
} else {
  // Fallback to old OpenCode activity system
  return Activity.execute(params)
}
```

**Rollback Plan:**
- Keep old code in git branch
- Feature flag toggle
- Gradual migration per tool

---

## Success Criteria

✅ **Activity Execution:**
- Activities run via minibob
- Results display in OpenCode UI
- MCP reporting works

✅ **Impulse System:**
- Impulses created via minibob
- UI sidebar updates
- Token budgets enforced

✅ **Code Quality:**
- 10,000 LOC removed
- No duplicated logic
- Clean separation

✅ **Performance:**
- Faster than before
- No HTTP overhead

✅ **Tests:**
- All integration tests pass
- Manual testing complete

---

## Timeline

| Phase | Duration |
|-------|----------|
| 1. Package minibob | 1-2 hours |
| 2. Create adapter | 2-3 hours |
| 3. Update tools | 5-8 hours |
| 4. Remove old code | 2-3 hours |
| 5. Update UI | 2-3 hours |
| 6. Test & validate | 4-6 hours |
| **Total** | **17-27 hours** |

---

## Key Decisions

### 1. Library vs HTTP Server
**Decision:** Use minibob as library (import)
**Reason:** No HTTP overhead, shared memory, simpler

### 2. Who Manages MCP?
**Decision:** OpenCode initializes, passes to minibob
**Reason:** Better control, OpenCode owns config

### 3. Who Manages Session Memory?
**Decision:** OpenCode manages session, minibob manages activity lifecycle
**Reason:** Clear separation (UI vs execution)

### 4. Custom Tools?
**Decision:** Pass OpenCode tools to minibob as `customTools`
**Reason:** Flexibility, OpenCode can extend minibob

### 5. Progress Updates?
**Decision:** Callbacks (onTaskStart, onTaskComplete)
**Reason:** Real-time UI updates, better UX

---

## Next Steps

1. ✅ **Review this summary** with team
2. ⏳ **Create feature branch** `feat/minibob-integration`
3. ⏳ **Start Phase 1** (package minibob)
4. ⏳ **Iterate incrementally** (one phase at a time)
5. ⏳ **Test thoroughly** after each phase
6. ⏳ **Merge when stable** and all tests pass

---

## Questions?

**Q: Why not use minibob as HTTP server?**
A: No need for HTTP overhead when we can import as library. Simpler, faster, same process.

**Q: What about other vessels?**
A: They can also import `@metabob/minibob` as library, or run as HTTP server (both supported).

**Q: What if we need to rollback?**
A: Feature flag allows gradual migration and easy rollback to old system.

**Q: How does MCP work?**
A: OpenCode initializes MCP connections, passes clients to minibob, minibob uses them for templates/reporting.

**Q: What about memory agent?**
A: Removed. minibob handles activity lifecycle internally. OpenCode manages session state.

**Q: What about lifecycle hooks?**
A: Moved to minibob. Activity execution lifecycle is self-contained in minibob's ActivityExecutor.

---

## Conclusion

This integration achieves:
- ✅ **Separation of concerns:** UI (OpenCode) vs Execution (minibob)
- ✅ **Code reduction:** 10,000 LOC removed
- ✅ **Reusability:** minibob as library for other tools
- ✅ **Performance:** No HTTP overhead
- ✅ **Maintainability:** Single source of truth

**Recommendation:** Proceed with integration. Start with Phase 1 (package minibob), validate, then continue incrementally.
