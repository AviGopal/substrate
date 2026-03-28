# microplastic Task List

## Overview

This task list implements microplastic as a **thin vessel wrapper** with a **self-development loop**. The key insight: microplastic uses MiniBob to develop itself, creating templates that improve both development AND runtime activities.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ARCHITECTURE                                    │
│                                                                         │
│  microplastic (thin wrapper)                                            │
│  ├── ImpulseStateSpace (shared state - OUR CORE CONTRIBUTION)          │
│  ├── @metabob/minibob (execution library - IMPORT)                     │
│  ├── TUI components (region rendering - REUSE src/tui/)                │
│  └── /dev command (self-development - NEW)                             │
│                                                                         │
│  Self-Development Loop:                                                 │
│  /dev goal → MiniBob executes → Trace → Ribosome → Template → Learn    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**API Configuration:**
- Key: `mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB`
- Backend: `http://activity.metabob.local`

---

## Component Reuse Assessment

| Component | Status | Action |
|-----------|--------|--------|
| `src/impulse/store.ts` | ✅ Works | Evolve → ImpulseStateSpace with subscriptions |
| `src/vessel/registry.ts` | ✅ Works | Use as-is, add getImpulseStore() |
| `src/tui/regions.ts` | ✅ Works | Wire to ImpulseStateSpace subscriptions |
| `src/tui/components.ts` | ✅ Works | Add renderTrace, enhance progressBar (done) |
| `src/selection/thompson.ts` | ✅ Works | Use as-is for local sampling |
| `src/ribosome/` | ✅ Works | Use for template extraction |
| `src/execution/executor.ts` | ⚠️ Partial | Refactor to emit impulses |
| `src/failure/` | ⚠️ Partial | Wire to impulse-based recovery |

---

## Phase 1: ImpulseStateSpace Foundation

**Goal:** Evolve ImpulseStore into full ImpulseStateSpace with subscription predicates.

**Testable State:** Impulses can be subscribed to with type/shape/priority filters.

### Tasks

- [ ] 1.1 Add subscription predicate support to ImpulseStore
  ```typescript
  interface SubscriptionPredicate {
    type?: string | string[]      // Pointer type(s)
    shape?: string | string[]     // Impulse shape(s)
    minPriority?: number          // Minimum priority
    custom?: (i: Impulse) => boolean
  }

  subscribe(
    handler: (event: ImpulseStoreEvent) => void,
    predicate?: SubscriptionPredicate
  ): () => void
  ```

- [ ] 1.2 Add query method for matching impulses
  ```typescript
  query(predicate: SubscriptionPredicate): Impulse[]
  ```

- [ ] 1.3 Add impulse lifecycle events with shapes
  - `impulse:created` with shape metadata
  - `impulse:updated` with delta
  - `impulse:completed` with final state
  - `impulse:removed` with cleanup

- [ ] 1.4 Add impulse shape field to Impulse type
  ```typescript
  interface Impulse {
    // ... existing fields
    shape?: string  // "goal", "error", "trace", "code", etc.
  }
  ```

- [ ] 1.5 Create ImpulseStateSpace tests
  - Subscription predicate matching
  - Query correctness
  - Event emission with shapes

**Commit Milestone:** `feat(microplastic): add subscription predicates to ImpulseStateSpace`

**Exit Criteria:**
```typescript
const space = impulseStore
space.subscribe(
  (event) => console.log("File impulse:", event.impulse.id),
  { type: "file", shape: "source_code" }
)
space.create({ pointer: { type: "file", path: "test.ts" }, shape: "source_code" })
// Handler called only for matching impulses
```

---

## Phase 2: VesselProvider Wiring

**Goal:** Wire vessels to ImpulseStateSpace via subscriptions, not direct calls.

**Testable State:** Execution events automatically create impulses that TUI subscribes to.

### Tasks

- [ ] 2.1 Refactor GoalExecutor to emit impulses
  ```typescript
  // Instead of direct TUI calls:
  executor.on("execution:start", () => {
    impulseStore.create({
      pointer: { type: "activity_status" },
      shape: "activity",
      content: { status: "running", name: template.name }
    })
  })
  ```

- [ ] 2.2 Wire TUI to subscribe to execution impulses
  ```typescript
  // RegionManager subscribes to state space
  impulseStore.subscribe(
    (event) => {
      if (event.type === "create") {
        regionManager.add({
          id: event.impulse.id,
          shape: mapImpulseShapeToRegionShape(event.impulse.shape),
          content: event.impulse.content
        })
      }
    },
    { shape: ["activity", "task", "tool_call", "summary", "error"] }
  )
  ```

- [ ] 2.3 Wire input as impulse emission
  ```typescript
  // User submits goal → emit goal impulse
  impulseStore.create({
    pointer: { type: "user_goal" },
    shape: "goal",
    content: { message: inputValue }
  })

  // Executor subscribes to goals
  impulseStore.subscribe(
    (event) => {
      executor.execute({ goal: event.impulse.content.message })
    },
    { shape: "goal" }
  )
  ```

- [ ] 2.4 Create impulse → region shape mapping
  ```typescript
  function mapImpulseShapeToRegionShape(shape: string): RegionShape {
    const mapping: Record<string, RegionShape> = {
      "activity": "activity",
      "task": "activity",
      "tool_call": "tool_call",
      "error": "error",
      "summary": "summary",
      "trace": "trace",
      "code": "code"
    }
    return mapping[shape] ?? "block"
  }
  ```

- [ ] 2.5 Test impulse-driven execution flow
  - Emit goal impulse
  - Verify executor receives it
  - Verify TUI creates regions
  - Verify completion summary appears

**Commit Milestone:** `feat(microplastic): wire vessels via ImpulseStateSpace subscriptions`

**Exit Criteria:**
```bash
bun run src/index.ts "Read package.json"
# Goal flows: input → impulse → executor subscription → execution → impulse → TUI subscription → regions
```

---

## Phase 3: /dev Command Implementation

**Goal:** Implement self-development command that uses MiniBob to modify microplastic.

**Testable State:** `/dev "goal"` executes against microplastic codebase with trace capture.

### Tasks

- [ ] 3.1 Create src/commands/dev.ts
  ```typescript
  export async function devCommand(
    goal: string,
    options: { verbose?: boolean; dryRun?: boolean }
  ): Promise<GoalResult>
  ```

- [ ] 3.2 Initialize MiniBob with backend connection
  ```typescript
  initializeMCP({
    endpoint: process.env.ACTIVITY_API_URL ?? "http://activity.metabob.local",
    instance: {
      instanceId: "microplastic-dev",
      apiKey: process.env.MINIBOB_API_KEY!
    }
  })
  ```

- [ ] 3.3 Create GoalProcessor with microplastic workdir
  ```typescript
  const processor = new GoalProcessor({
    workingDirectory: "repos/microplastic",
    executor: new ActivityExecutor({
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: "claude-sonnet-4-20250514",
      workingDirectory: "repos/microplastic"
    })
  })
  ```

- [ ] 3.4 Wire executor callbacks to ImpulseStateSpace
  ```typescript
  executor.onActivityStarted = (id, templateId, name) => {
    impulseStore.create({
      shape: "activity",
      content: { id, templateId, name, status: "running" }
    })
  }
  ```

- [ ] 3.5 Add /dev to CLI parser
  ```typescript
  if (arg === "/dev" || arg === "--dev") {
    const goal = args.slice(i + 1).join(" ")
    await devCommand(goal, options)
    process.exit(0)
  }
  ```

- [ ] 3.6 Test /dev command
  ```bash
  MINIBOB_API_KEY=mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB \
  bun run src/index.ts /dev "Add a console.log to index.ts"
  ```

**Commit Milestone:** `feat(microplastic): implement /dev self-development command`

**Exit Criteria:**
```bash
MINIBOB_API_KEY=mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB \
ACTIVITY_API_URL=http://activity.metabob.local \
bun run src/index.ts /dev "Add type annotations to impulse store"
# MiniBob executes, trace captured, template potentially extracted
```

---

## Phase 4: Template Seeding

**Goal:** Seed development templates to backend for Thompson Sampling.

**Testable State:** Backend has microplastic-specific templates; recommendations work.

### Tasks

- [ ] 4.1 Create seed templates file
  - `src/primordials/microplastic-templates.ts`
  - Generic: implement-feature, fix-bug, add-tests
  - Specific: add-impulse-shape, add-provider, enhance-tui-region, fix-subscription-bug

- [ ] 4.2 Add seedTemplates() to dev command initialization
  ```typescript
  async function seedTemplates() {
    const mcp = getMCPClient()
    for (const template of MICROPLASTIC_TEMPLATES) {
      await mcp.registerTemplate(template)
    }
  }
  ```

- [ ] 4.3 Add --seed flag for manual seeding
  ```bash
  bun run src/index.ts /dev --seed
  # Seeds all templates to backend
  ```

- [ ] 4.4 Test template recommendations
  ```typescript
  const recommendations = await mcp.recommendActivities(
    "Add new impulse shape for progress bars",
    "feature"
  )
  // Should return microplastic/add-impulse-shape-v1
  ```

**Commit Milestone:** `feat(microplastic): seed development templates to backend`

**Exit Criteria:**
```bash
curl http://activity.metabob.local/v2/activities/templates | jq '.[] | select(.id | startswith("microplastic/"))'
# Returns microplastic-specific templates
```

---

## Phase 5: Instrumentation Activities

**Goal:** Add non-LLM activities for in-vivo tracing without AI cost.

**Testable State:** Instrumentation traces captured and sent to backend.

### Tasks

- [ ] 5.1 Create instrumentation activity definitions
  ```typescript
  const INSTRUMENTATION_ACTIVITIES = [
    {
      id: "impulse_lifecycle",
      category: "instrumentation",
      execution_type: "tool",  // No LLM
      tool_name: "trace_capture"
    },
    {
      id: "subscription_match",
      category: "instrumentation",
      execution_type: "tool"
    },
    {
      id: "resolver_invocation",
      category: "instrumentation",
      execution_type: "tool"
    }
  ]
  ```

- [ ] 5.2 Create trace_capture tool
  ```typescript
  async function traceCaptureHandler(params: {
    event: string
    data: Record<string, unknown>
    timestamp: number
  }): Promise<ToolResult> {
    // Send to backend asynchronously
    getMCPClient()?.storeInstrumentationTrace(params)
    return { success: true }
  }
  ```

- [ ] 5.3 Wire instrumentation to ImpulseStateSpace
  ```typescript
  if (process.env.MICROPLASTIC_INSTRUMENT) {
    impulseStore.subscribe(
      (event) => {
        traceCaptureHandler({
          event: `impulse:${event.type}`,
          data: { impulseId: event.impulse.id, shape: event.impulse.shape },
          timestamp: Date.now()
        })
      },
      {}  // All impulses
    )
  }
  ```

- [ ] 5.4 Add --instrument flag
  ```bash
  bun run src/index.ts --instrument "Read package.json"
  # Captures instrumentation traces
  ```

- [ ] 5.5 Test instrumentation overhead
  - Measure with/without instrumentation
  - Verify < 5ms overhead per impulse

**Commit Milestone:** `feat(microplastic): add instrumentation activities for tracing`

**Exit Criteria:**
```bash
MICROPLASTIC_INSTRUMENT=true bun run src/index.ts "Read package.json"
curl http://activity.metabob.local/v2/activities/execution-traces?activity=impulse_lifecycle
# Returns instrumentation traces
```

---

## Phase 6: Cross-Pollination

**Goal:** Connect development traces to runtime improvement and vice versa.

**Testable State:** Runtime issues create development goals; development improves runtime.

### Tasks

- [ ] 6.1 Create trace analyzer for runtime issues
  ```typescript
  async function analyzeRuntimeTraces(): Promise<DevelopmentGoal[]> {
    const traces = await mcp.queryTraces({
      activity: "impulse_lifecycle",
      success: false,
      limit: 10
    })
    return traces.map(t => ({
      message: `Fix: ${t.error_message}`,
      type: "bugfix",
      context: { traceId: t.execution_id }
    }))
  }
  ```

- [ ] 6.2 Create /dev --analyze command
  ```bash
  bun run src/index.ts /dev --analyze
  # Analyzes runtime traces, suggests development goals
  ```

- [ ] 6.3 Wire ribosome extraction to /dev
  ```typescript
  processor.on("goal:completed", async ({ result }) => {
    if (result.completed && result.executions.some(e => e.improvisation)) {
      // Ribosome already extracts template
      // Template available for future similar goals
    }
  })
  ```

- [ ] 6.4 Create improvement suggestion impulses
  ```typescript
  impulseStore.create({
    shape: "improvement_suggestion",
    content: {
      source: "runtime_analysis",
      goal: "Optimize subscription matching",
      evidence: { traceIds: [...] }
    }
  })
  ```

- [ ] 6.5 Test cross-pollination cycle
  - Create runtime issue (slow subscription)
  - /dev --analyze identifies it
  - /dev executes fix
  - Runtime traces show improvement

**Commit Milestone:** `feat(microplastic): implement cross-pollination between dev and runtime`

**Exit Criteria:**
```bash
# Create runtime issue
MICROPLASTIC_INSTRUMENT=true bun run src/index.ts "Complex goal"

# Analyze and suggest fixes
bun run src/index.ts /dev --analyze
# Output: "Suggestion: Optimize subscription predicate evaluation"

# Execute fix
bun run src/index.ts /dev "Optimize subscription predicate evaluation"
```

---

## Dependency Graph

```
Phase 1 (ImpulseStateSpace)
    │
    ▼
Phase 2 (VesselProvider Wiring)
    │
    ▼
Phase 3 (/dev Command)
    │
    ├─────────────────────────────┐
    │                             │
    ▼                             ▼
Phase 4 (Template Seeding)  Phase 5 (Instrumentation)
    │                             │
    └─────────────┬───────────────┘
                  │
                  ▼
          Phase 6 (Cross-Pollination)
```

**Parallel Work:**
- Phase 4 and Phase 5 can run in parallel after Phase 3
- Tasks within phases can be parallelized where no dependencies exist

---

## Success Criteria

| Phase | Metric |
|-------|--------|
| 1 | Subscription predicates filter correctly |
| 2 | Execution flows through impulses, TUI updates |
| 3 | /dev command executes goals against microplastic |
| 4 | Backend has templates, recommendations work |
| 5 | Instrumentation traces appear in backend |
| 6 | Runtime issues inform development, development improves runtime |

---

## Environment Configuration

```bash
# Required
export ANTHROPIC_API_KEY="sk-ant-..."
export MINIBOB_API_KEY="mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB"

# Optional (with defaults)
export ACTIVITY_API_URL="http://activity.metabob.local"
export MINIBOB_MODEL="claude-sonnet-4-20250514"

# Create .env in repos/microplastic/
echo 'MINIBOB_API_KEY=mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB' >> repos/microplastic/.env
echo 'ACTIVITY_API_URL=http://activity.metabob.local' >> repos/microplastic/.env
```

---

## Related Documentation

- [Self-Development Loop Spec](./specs/self-development-loop/spec.md) - Full specification
- [Design Decisions](./design.md) - Architecture decisions
- [MiniBob Library](../../../repos/minibob/src/lib.ts) - Library entry point
- [Activity API](../../../repos/metabob-activity-api/src/routes/) - Backend endpoints
