# MiniBob Integration Analysis
## Architectural Realignment: OpenCode → MiniBob → Metabob Backend

**Date**: 2026-03-18
**Goal**: Transform metabob-opencode into a UI frontend that delegates activity execution to MiniBob as a library

---

## Executive Summary

We have successfully developed **MiniBob** as a minimal vessel (~3,000 LOC) that provides:
- ✅ Activity template execution
- ✅ Impulse system (context management)
- ✅ ACP protocol (vessel-to-vessel communication)
- ✅ MCP integration (metabob backend connectivity)
- ✅ Nested activity support
- ✅ Database persistence
- ✅ Boredom system (autonomous task execution)
- ✅ Self-improvement capability

**Current State**:
```
metabob-opencode (50,000 LOC)
├── Activity execution logic (~5,000 LOC)
├── Template management
├── Impulse system
├── Session orchestration
└── MCP integration
```

**Target State**:
```
metabob-opencode (UI Frontend)
└── MiniBob (Library - 3,000 LOC)
    ├── Activity execution
    ├── Impulse system
    ├── MCP integration
    └── → metabob-activity-api (Backend)
```

---

## Architecture Comparison

### Current Architecture (OpenCode)

```
┌────────────────────────────────────────────────────────┐
│              metabob-opencode                          │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Session Management (Complex)                    │  │
│  │  - 7+ Agent Types                                │  │
│  │  - Todo System                                   │  │
│  │  - Message Routing                               │  │
│  │  - State Management                              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Activity Execution (Embedded - ~5,000 LOC)      │  │
│  │  - ActivityExecutor                              │  │
│  │  - Template Loading                              │  │
│  │  - Task Execution                                │  │
│  │  - Validation                                    │  │
│  │  - State Tracking                                │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  MCP Integration (Duplicated)                    │  │
│  │  - Template fetching                             │  │
│  │  - Execution reporting                           │  │
│  │  - Metrics tracking                              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│            ↓                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │        metabob-activity-api (Backend)            │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Target Architecture (MiniBob as Library)

```
┌────────────────────────────────────────────────────────┐
│              metabob-opencode (UI Frontend)            │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  TUI/CLI Interface                               │  │
│  │  - Session Display                               │  │
│  │  - User Input                                    │  │
│  │  - Progress Monitoring                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  MiniBob Library Adapter                         │  │
│  │  - Translates OpenCode calls → MiniBob API      │  │
│  │  - Bridges impulse systems                       │  │
│  │  - Forwards events to UI                         │  │
│  └──────────────────────────────────────────────────┘  │
│            ↓                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │        @metabob/minibob (Library)                │  │
│  │                                                  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  ActivityExecutor                          │  │  │
│  │  │  - Template loading (MCP/local)            │  │  │
│  │  │  - Task execution                          │  │  │
│  │  │  - Nested activities                       │  │  │
│  │  │  - Validation                              │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  Impulse System                            │  │  │
│  │  │  - memo, file, activityOutput, custom      │  │  │
│  │  │  - Lazy loading                            │  │  │
│  │  │  - Token budgets                           │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  MCP Client                                │  │  │
│  │  │  - Template fetching                       │  │  │
│  │  │  - Execution reporting                     │  │  │
│  │  │  - Metrics tracking                        │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
│            ↓                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │        metabob-activity-api (Backend)            │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## Code Path Analysis

### Current Code Paths

**Activity Execution in OpenCode**:
```
src/tool/activity.ts
  → src/session/activity.ts
    → src/session/activity-template.ts
      → src/session/template-metrics-client.ts
        → MCP (optional)
```

**Key Components (to be replaced)**:
1. `src/session/activity.ts` - Activity state management (~500 LOC)
2. `src/tool/activity.ts` - Activity tool implementation (~800 LOC)
3. `src/session/activity-template.ts` - Template loading/validation (~1,200 LOC)
4. `src/session/activity-template-repository.ts` - Template storage (~400 LOC)
5. `src/session/template-metrics-client.ts` - Backend communication (~300 LOC)
6. `src/session/activity-coordination.ts` - Task execution (~600 LOC)
7. `src/session/trailblazing-executor.ts` - Trailblazing logic (~400 LOC)

**Total to replace**: ~4,200 LOC

### Target Code Paths

**Activity Execution via MiniBob**:
```
src/tool/activity.ts (adapter)
  → MiniBobAdapter
    → @metabob/minibob/ActivityExecutor
      → @metabob/minibob/MCPClient
        → metabob-activity-api
```

**Adapter Layer** (~200 LOC):
```typescript
// src/adapters/minibob-adapter.ts
import { ActivityExecutor, type ExecutorConfig } from "@metabob/minibob/src/activity"
import { loadTemplateFromMCPOrLocal } from "@metabob/minibob/src/activity"
import { Activity } from "../session/activity"

export class MiniBobAdapter {
  static async executeActivity(options: {
    templateId: string
    variables: Record<string, unknown>
    reason?: string
    onTaskStart?: (taskId: string) => void
    onTaskComplete?: (taskId: string, result: any) => void
  }): Promise<Activity.Execution> {
    // 1. Create MiniBob executor with OpenCode config
    const config: ExecutorConfig = {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: "claude-sonnet-4-20250514",
      workingDirectory: process.cwd(),
    }
    
    // 2. Load template from MCP or local
    const template = await loadTemplateFromMCPOrLocal(options.templateId)
    
    // 3. Execute via MiniBob
    const executor = new ActivityExecutor(config)
    const execution = await executor.execute({
      template,
      variables: options.variables,
      reason: options.reason,
      onTaskStart: options.onTaskStart,
      onTaskComplete: options.onTaskComplete,
    })
    
    // 4. Translate MiniBob execution → OpenCode Activity.Info
    return translateExecution(execution)
  }
}
```

---

## MiniBob API Surface

### ActivityExecutor

```typescript
class ActivityExecutor {
  constructor(config: ExecutorConfig)
  
  async execute(options: ExecuteOptions): Promise<ActivityExecution>
  
  // ExecutorConfig:
  // - provider: "anthropic" | "openai"
  // - apiKey: string
  // - model: string
  // - workingDirectory: string
  // - onSearchActivities?: callback
  // - onCreateActivity?: callback
  // - customTools?: ToolHandlerOptions["customTools"]
  
  // ExecuteOptions:
  // - template: ActivityTemplate
  // - variables: Record<string, unknown>
  // - reason?: string
  // - onTaskStart?: (taskId: string) => void
  // - onTaskComplete?: (taskId: string, result: TaskResult) => void
}
```

### MCPClient

```typescript
class MCPClient {
  constructor(config: MCPConfig)
  
  async getActivityTemplate(templateId: string): Promise<ActivityTemplate | null>
  async searchActivityTemplates(query?: {
    category?: string
    limit?: number
  }): Promise<Array<{ id: string; name: string; category: string; successRate?: number }>>
  async registerTemplate(template: ActivityTemplate): Promise<boolean>
  async reportExecution(execution: ActivityExecution): Promise<boolean>
  async registerVessel(manifest: VesselManifest): Promise<boolean>
}
```

### Impulse System

```typescript
function createImpulse(impulse: {
  id: string
  pointer: ImpulsePointer
  budget: number
  priority: "critical" | "high" | "medium" | "low"
}): Impulse

async function loadImpulses(impulseIds: string[]): Promise<Impulse[]>

function formatImpulsesForContext(impulses: Impulse[]): string

function storeActivityOutput(
  activityId: string,
  taskId: string,
  content: string
): void
```

---

## Migration Strategy

### Phase 1: Add MiniBob as Dependency (Day 1)

**Objective**: Install MiniBob as a library in metabob-opencode

```bash
# In repos/metabob-opencode
cd packages/opencode

# Add MiniBob as local dependency
npm install --save ../../minibob

# Or add to package.json:
{
  "dependencies": {
    "@metabob/minibob": "file:../../minibob"
  }
}
```

**Files Modified**:
- `packages/opencode/package.json` - Add dependency
- `packages/opencode/tsconfig.json` - Add path mapping (if needed)

**Validation**:
```bash
npm run typecheck  # Should resolve MiniBob types
```

---

### Phase 2: Create MiniBob Adapter (Day 1-2)

**Objective**: Create adapter layer that translates OpenCode → MiniBob

**New Files**:

1. **`src/adapters/minibob-adapter.ts`** (~200 LOC)
   ```typescript
   import { ActivityExecutor } from "@metabob/minibob/src/activity"
   import type { ExecutorConfig, ExecuteOptions } from "@metabob/minibob/src/activity"
   import type { ActivityExecution, TaskResult } from "@metabob/minibob/src/types"
   
   export class MiniBobAdapter {
     static createExecutorConfig(): ExecutorConfig {
       // Map OpenCode config → MiniBob config
     }
     
     static async executeActivity(options: {
       templateId: string
       variables: Record<string, unknown>
       reason?: string
     }): Promise<ActivityExecution> {
       // Execute via MiniBob
     }
     
     static translateExecution(
       minibobExecution: ActivityExecution
     ): Activity.Info {
       // Translate MiniBob result → OpenCode Activity.Info
     }
   }
   ```

2. **`src/adapters/minibob-impulse-bridge.ts`** (~150 LOC)
   ```typescript
   import { createImpulse, loadImpulses } from "@metabob/minibob/src/impulse"
   import type { Impulse as MiniBobImpulse } from "@metabob/minibob/src/types"
   import type { ActivityTemplate } from "../session/activity-template"
   
   export class MiniBobImpulseBridge {
     static translateImpulse(
       openCodeImpulse: ActivityTemplate.Impulse.Schema
     ): MiniBobImpulse {
       // Translate OpenCode impulse → MiniBob impulse
     }
     
     static async loadForActivity(
       activityId: string,
       impulseIds: string[]
     ): Promise<MiniBobImpulse[]> {
       // Load impulses via MiniBob
     }
   }
   ```

**Validation**:
```bash
npm run typecheck  # Should compile adapter
npm run test -- adapters/minibob-adapter.test.ts  # Unit tests
```

---

### Phase 3: Integrate Adapter into Activity Tool (Day 2-3)

**Objective**: Replace OpenCode activity execution with MiniBob adapter

**Files Modified**:

1. **`src/tool/activity.ts`** - Replace execution logic
   ```typescript
   // OLD:
   import { TrailblazingExecutor } from "../session/trailblazing-executor"
   const executor = new TrailblazingExecutor(...)
   
   // NEW:
   import { MiniBobAdapter } from "../adapters/minibob-adapter"
   const execution = await MiniBobAdapter.executeActivity({
     templateId,
     variables,
     reason,
   })
   ```

2. **`src/session/activity.ts`** - Update state management
   ```typescript
   // Keep OpenCode's Activity.Info for UI state
   // But delegate execution to MiniBob
   
   export async function execute(
     templateId: string,
     variables: Record<string, unknown>,
     reason?: string
   ): Promise<Activity.Info> {
     // Create activity record
     const activity = await create({ templateId, variables })
     
     // Execute via MiniBob
     const execution = await MiniBobAdapter.executeActivity({
       templateId,
       variables,
       reason,
     })
     
     // Update activity with results
     await update(activity.id, {
       status: execution.status === "completed" ? "done" : "failed",
       completedAt: execution.completedAt,
       stats: MiniBobAdapter.translateStats(execution.metrics),
     })
     
     return get(activity.id)
   }
   ```

**Validation**:
```bash
npm run test -- tool/activity.test.ts
npm run test -- session/activity.test.ts
```

---

### Phase 4: Remove Duplicate Code (Day 3-4)

**Objective**: Delete OpenCode implementations now handled by MiniBob

**Files to Delete/Archive**:
1. `src/session/activity-coordination.ts` - Task execution (replaced by MiniBob)
2. `src/session/trailblazing-executor.ts` - Trailblazing (replaced by MiniBob)
3. `src/session/template-metrics-client.ts` - MCP communication (replaced by MiniBob.MCPClient)
4. `src/session/activity-template-repository.ts` - Local storage (MiniBob uses MCP-first)
5. Impulse-related code duplicated with MiniBob

**Files to Keep (OpenCode-specific)**:
1. `src/session/activity.ts` - Activity state management for UI
2. `src/session/activity-lifecycle-logger.ts` - Logging for TUI
3. `src/session/activity-complete.ts` - Completion handlers
4. `src/session/activity-git.ts` - Git integration (may merge with MiniBob)
5. `src/tool/activity.ts` - Tool interface (now uses adapter)

**Total LOC Removed**: ~4,000 LOC

---

### Phase 5: Integration Testing (Day 4-5)

**Objective**: Ensure end-to-end flow works

**Test Scenarios**:

1. **Basic Activity Execution**
   ```bash
   opencode activity templates/add-feature-complete.json \
     --var featureName="test feature" \
     --var files="src/test.ts"
   ```

2. **Nested Activity Execution**
   ```bash
   # Activity that calls another activity
   opencode activity templates/test-nested-activities.json
   ```

3. **MCP Integration**
   ```bash
   # Template loaded from backend
   opencode activity add-feature-complete \
     --var featureName="backend feature"
   ```

4. **Trailblazing**
   ```bash
   # Activity with trailblazing enabled
   opencode activity templates/fix-bug-complete.json \
     --trailblazing enabled
   ```

**Validation Checklist**:
- [ ] Activity execution completes successfully
- [ ] Impulses are loaded and injected correctly
- [ ] MCP backend receives execution reports
- [ ] TUI displays progress correctly
- [ ] Git commits are created
- [ ] Metabob integration works (issues, annotations)
- [ ] Nested activities execute correctly
- [ ] Error handling works (task failures, retries)

---

## Data Flow Comparison

### Current OpenCode Flow

```
User Input (CLI/TUI)
  ↓
src/tool/activity.ts
  ↓
src/session/trailblazing-executor.ts
  ↓
src/session/activity-coordination.ts
  ↓ (for each task)
Session.create() → Agent.execute()
  ↓
LLM API (Anthropic)
  ↓
Tool execution (bash, read, write, git)
  ↓
src/session/activity-complete.ts
  ↓
src/session/template-metrics-client.ts
  ↓
metabob-activity-api (backend)
```

### Target MiniBob Flow

```
User Input (CLI/TUI)
  ↓
src/tool/activity.ts (adapter)
  ↓
MiniBobAdapter.executeActivity()
  ↓
@metabob/minibob/ActivityExecutor
  ↓ (for each task)
ActivityExecutor.executeTask()
  ↓
LLM API (Anthropic) + Tool Calling
  ↓
MiniBob Tools (bash, read, write, git, activity)
  ↓
@metabob/minibob/MCPClient.reportExecution()
  ↓
metabob-activity-api (backend)
  ↓ (results flow back)
MiniBobAdapter.translateExecution()
  ↓
OpenCode Activity.Info (UI state)
  ↓
TUI Display
```

**Key Simplifications**:
1. No session creation per task (MiniBob handles internally)
2. No separate agent orchestration (single general agent in MiniBob)
3. Direct tool calling (no session routing)
4. MCP-first template loading (backend → local fallback)
5. Automatic metrics reporting (built into MiniBob)

---

## Benefits of MiniBob Integration

### 1. **Reduced Complexity**
- OpenCode: ~50,000 LOC → ~46,000 LOC (remove 4,000 LOC)
- Activity execution: 4,200 LOC → 200 LOC adapter
- Maintenance: Single source of truth for activity logic

### 2. **Better Separation of Concerns**
- **OpenCode**: UI, user experience, session management
- **MiniBob**: Activity execution, impulse system, MCP integration
- Clear boundaries, easier testing

### 3. **Reusability**
- MiniBob can be used standalone (vessel deployment)
- OpenCode can focus on UI/UX improvements
- Other tools can integrate MiniBob as library

### 4. **MCP-First Architecture**
- MiniBob loads templates from backend by default
- Automatic variant tracking and registration
- Learning loop flows through backend naturally

### 5. **Performance**
- MiniBob is optimized for execution (Bun runtime)
- Stateless task execution (lower memory overhead)
- Parallel activity support (via ACP)

### 6. **Self-Development**
- MiniBob can improve itself (self-improve.json)
- Changes to MiniBob automatically benefit OpenCode
- Demonstrates vessel-agnostic becoming

---

## Risks & Mitigations

### Risk 1: Breaking Changes in OpenCode

**Mitigation**:
- Keep Activity.Info schema intact (UI compatibility)
- Adapter layer translates between systems
- Comprehensive integration tests
- Feature flag for gradual rollout

### Risk 2: Impulse System Incompatibility

**Mitigation**:
- MiniBob supports 4 core impulse types (memo, file, activityOutput, custom)
- OpenCode has 14 types → some need custom resolvers
- Create MiniBobImpulseBridge to translate
- Test all impulse types in integration tests

### Risk 3: Loss of OpenCode-Specific Features

**Features to Preserve**:
- Todo system (OpenCode-specific)
- Activity lifecycle logging (TUI)
- Git integration specifics
- Metabob quality gates

**Solution**: Keep these in OpenCode, delegate only execution to MiniBob

### Risk 4: Performance Regression

**Mitigation**:
- Benchmark before/after migration
- MiniBob uses Bun (faster than Node)
- Profile execution paths
- Optimize adapter layer

---

## Success Metrics

### Quantitative
- [ ] OpenCode LOC reduced by ~4,000 lines
- [ ] Activity execution time ≤ current (no regression)
- [ ] Memory usage ≤ current (stateless execution)
- [ ] All existing tests pass
- [ ] Integration test coverage ≥ 90%

### Qualitative
- [ ] Code is easier to understand (separation of concerns)
- [ ] Activity execution is more reliable (single source of truth)
- [ ] MCP integration is cleaner (backend-first)
- [ ] Self-improvement loop works (MiniBob + OpenCode)

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: Add MiniBob Dependency | 4 hours | MiniBob installed, types resolved |
| Phase 2: Create Adapter | 1 day | MiniBobAdapter + ImpulseBridge |
| Phase 3: Integrate into Tool | 1 day | Activity tool uses adapter |
| Phase 4: Remove Duplicate Code | 1 day | ~4,000 LOC deleted |
| Phase 5: Integration Testing | 1 day | All tests pass, e2e validated |
| **Total** | **4-5 days** | **Production-ready** |

---

## Next Steps

1. **Approve Architecture** - Review this document with team
2. **Create Feature Branch** - `feature/minibob-integration`
3. **Execute Phase 1** - Add MiniBob dependency
4. **Iterative Implementation** - Phases 2-5 with continuous testing
5. **Deployment** - Gradual rollout with feature flag

---

## Appendix: File Mapping

### OpenCode Files → MiniBob Equivalents

| OpenCode File | MiniBob Equivalent | Notes |
|---------------|-------------------|-------|
| `src/session/activity-coordination.ts` | `src/activity.ts` | Task execution |
| `src/session/trailblazing-executor.ts` | `src/activity.ts` | Built-in to executor |
| `src/session/template-metrics-client.ts` | `src/mcp.ts` | MCP client |
| `src/session/activity-template-repository.ts` | `src/mcp.ts` | Backend-first loading |
| `src/session/impulse-*.ts` | `src/impulse.ts` | Core 4 types |
| `src/tool/activity.ts` | Adapter layer | Delegates to MiniBob |

### OpenCode Files to Keep (UI-specific)

| File | Reason |
|------|--------|
| `src/session/activity.ts` | UI state management |
| `src/session/activity-lifecycle-logger.ts` | TUI logging |
| `src/session/activity-complete.ts` | Completion handlers |
| `src/session/activity-git.ts` | Git integration (may merge) |
| `src/session/activity-todo.ts` | Todo system (OpenCode-specific) |

---

## Questions for Discussion

1. **Gradual vs. All-at-Once Migration**
   - Should we use feature flag to toggle MiniBob on/off?
   - Or full cutover after Phase 5?

2. **Custom Tools in MiniBob**
   - How to handle OpenCode-specific tools (e.g., TUI interaction)?
   - Pass as `customTools` config to MiniBob?

3. **Impulse Translation**
   - Should we migrate OpenCode impulses to MiniBob's 4 core types?
   - Or create custom resolvers for all 14 types?

4. **Git Integration**
   - Merge OpenCode's activity-git.ts into MiniBob?
   - Or keep as OpenCode-specific wrapper?

5. **Deployment Strategy**
   - Deploy as library (current)?
   - Or publish MiniBob to npm registry?

---

**Document Status**: ✅ Complete - Ready for Review
**Author**: Activity Mode Agent
**Date**: 2026-03-18
