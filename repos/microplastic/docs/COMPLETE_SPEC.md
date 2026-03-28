# Microplastic Complete Specification

## Executive Summary

Microplastic is a self-improving development agent that uses **MiniBob to develop itself**, creating a feedback loop where development activities teach the system how to develop, and runtime traces inform development improvements.

**Key Insight:** Use MiniBob with `mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB` API key against `*.metabob.local` backend to:
1. Develop microplastic features (creates development activity templates)
2. Execute microplastic runtime (creates runtime activity templates)
3. Analyze runtime traces to create development goals
4. Use development templates to improve runtime templates

**Current State:** Phase 1-2 complete (ImpulseStateSpace + partial VesselProvider wiring), Phase 3+ blocked on self-development command.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Interface Boundaries](#interface-boundaries)
3. [Data Flow Mappings](#data-flow-mappings)
4. [Database Schema Integration](#database-schema-integration)
5. [Common Logical Patterns](#common-logical-patterns)
6. [Reorganized Task List](#reorganized-task-list)
7. [Commit Milestones](#commit-milestones)
8. [Self-Development Loop](#self-development-loop)

---

## Architecture Overview

### Three-Layer Model

```
┌─────────────────────────────────────────────────────────────┐
│ PRESENTATION LAYER - Full-Screen TUI                       │
│ ├─ RegionRenderer (full-screen, resize-responsive)         │
│ ├─ RegionManager (stateful regions, priority-based layout) │
│ └─ ExecutionBridge (impulse→region mapping)                │
└──────────────────┬──────────────────────────────────────────┘
                   │ subscribes to
┌──────────────────▼──────────────────────────────────────────┐
│ STATE LAYER - ImpulseStateSpace                            │
│ ├─ ImpulseStore (subscription predicates, query)           │
│ ├─ Impulse shapes (activity, task, tool_call, error, etc.) │
│ └─ Event broadcasting with predicate filtering             │
└──────────────────┬──────────────────────────────────────────┘
                   │ creates impulses
┌──────────────────▼──────────────────────────────────────────┐
│ EXECUTION LAYER - Goal Processing                          │
│ ├─ GoalExecutor (template selection, execution, outcomes)  │
│ ├─ TemplateSelector (Thompson Sampling)                    │
│ ├─ ActivityExecutor (from @metabob/minibob)                │
│ └─ Ribosome (template extraction from traces)              │
└─────────────────────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ BACKEND - Learning System (metabob-activity-api)           │
│ ├─ Template storage & Thompson Sampling                    │
│ ├─ Execution trace persistence                             │
│ ├─ Impulse relevance tracking                              │
│ └─ Tool usage pattern analysis                             │
└─────────────────────────────────────────────────────────────┘
```

### Self-Development Loop

```
┌─────────────────────────────────────────────────────────────┐
│ DEVELOPMENT MODE - MiniBob develops microplastic           │
│                                                             │
│ User: "Add region collapse hotkey"                         │
│   ↓                                                         │
│ minibob goal "Add region collapse hotkey"                  │
│   ├─ Workdir: repos/microplastic                          │
│   ├─ Backend: http://activity.metabob.local                │
│   ├─ Instance: microplastic-dev                            │
│   └─ API Key: mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB     │
│   ↓                                                         │
│ MiniBob executes:                                           │
│   ├─ Reads src/tui/regions.ts                              │
│   ├─ Edits src/tui/renderer.ts (add keyboard handler)      │
│   ├─ Tests change                                           │
│   └─ Records trace                                          │
│   ↓                                                         │
│ Backend learns:                                             │
│   ├─ Creates template: "add-keyboard-hotkey-v1"            │
│   ├─ Tracks: file patterns, edit patterns, test patterns   │
│   └─ Updates Thompson Sampling for future similar goals    │
└─────────────────────────────────────────────────────────────┘
        │
        │ Template reuse
        ▼
┌─────────────────────────────────────────────────────────────┐
│ RUNTIME MODE - Microplastic executes user goals            │
│                                                             │
│ User: "Fix the login bug"                                  │
│   ↓                                                         │
│ microplastic "Fix the login bug"                           │
│   ├─ Thompson Sampling selects template                    │
│   ├─ Executes activity (create regions, show progress)     │
│   └─ Records runtime trace                                 │
│   ↓                                                         │
│ Backend learns:                                             │
│   ├─ Updates alpha/beta for template                       │
│   ├─ Tracks impulse relevance                              │
│   └─ Identifies patterns                                   │
└─────────────────────────────────────────────────────────────┘
        │
        │ Feedback
        ▼
┌─────────────────────────────────────────────────────────────┐
│ CROSS-POLLINATION - Runtime informs development            │
│                                                             │
│ Runtime trace shows: slow region rendering                 │
│   ↓                                                         │
│ Analyzer creates goal: "Optimize region rendering"         │
│   ↓                                                         │
│ MiniBob develops: implements optimization                  │
│   ├─ Uses development templates learned earlier            │
│   └─ Creates trace for development activity improvement    │
│   ↓                                                         │
│ Improved runtime: faster rendering for users               │
└─────────────────────────────────────────────────────────────┘
```

---

## Interface Boundaries

### 1. ImpulseStore Interface

**Purpose:** Shared state space for all data flowing through system

**Key Methods:**
```typescript
interface ImpulseStore {
  create(impulse: Omit<ExtendedImpulse, "id" | "loaded" | "createdAt">): ExtendedImpulse;
  get(id: string): ExtendedImpulse | undefined;
  load(id: string): Promise<ExtendedImpulse>;  // Resolves pointer
  update(id: string, updates: Partial<ExtendedImpulse>): ExtendedImpulse | undefined;
  delete(id: string): boolean;
  query(predicate: SubscriptionPredicate): ExtendedImpulse[];
  subscribe(
    listener: (event: ImpulseStoreEvent) => void,
    predicate?: SubscriptionPredicate
  ): () => void;  // Returns unsubscribe function
}
```

**Subscription Predicate:**
```typescript
interface SubscriptionPredicate {
  type?: string | string[];              // Pointer type filter
  shape?: ImpulseShape | ImpulseShape[]; // Semantic shape filter
  minPriority?: number;                   // Priority threshold (critical=1000, high=750, medium=500, low=250)
  custom?: (impulse: ExtendedImpulse) => boolean;  // Custom logic
}
```

**Critical Feature:** Resolver routing via `setResolvers()` - establishes chain of VesselProviders

**Consumers:**
- ExecutionBridge (subscribes to execution impulses)
- RegionManager (displays impulses as regions)
- Future: Memory agent (optimizes context loading)

### 2. VesselProvider Interface

**Purpose:** Pluggable resolution capabilities

**Key Methods:**
```typescript
interface VesselProvider {
  readonly id: string;
  readonly name: string;

  initialize(context: VesselContext): Promise<void>;
  shutdown(): Promise<void>;

  canResolve(pointer: ImpulsePointer): boolean;
  resolve(impulse: Impulse): Promise<ResolverResult>;

  getCapabilities(): VesselCapability[];
  getActivityTemplates(): ActivityTemplate[];
}
```

**VesselContext:**
```typescript
interface VesselContext {
  impulseStore: ImpulseStore;           // Shared state
  config: VesselConfig;                 // Vessel-specific config
  vessels: Map<string, VesselProvider>; // Access to other vessels
  events: VesselEventEmitter;           // Lifecycle events
  logger: VesselLogger;                 // Scoped logging
}
```

**Resolution Pattern:**
```typescript
// ImpulseStore.load() routing logic
const resolver = this.findResolver(impulse.pointer);
if (!resolver) throw new NoResolverError(impulse.pointer.type);
const result = await resolver.resolve(impulse);
```

### 3. ExecutionBridge Interface

**Purpose:** Maps execution events to UI regions

**Key Insight:** Maintains 1:1 impulse→region mapping for statefulness

**Two Modes:**
1. **Traditional Events** (Phase 1, backward compat)
2. **Impulse Subscriptions** (Phase 2, future)

**Subscription Pattern:**
```typescript
impulseStore.subscribe(
  (event) => {
    const impulse = event.impulse as ExtendedImpulse;
    switch (impulse.shape) {
      case "activity": this.handleActivityImpulse(data); break;
      case "tool_call": this.handleToolCallImpulse(data); break;
      case "error": this.handleErrorImpulse(data); break;
    }
  },
  { shape: ["activity", "task", "tool_call", "summary", "error"] }
);
```

---

## Data Flow Mappings

### Primary Flow: Goal → Execution → Learning

```
1. User Input (Terminal/CLI)
   ↓
2. ExecutionContext { goal, workdir, impulses, verbose, dryRun }
   ↓
3. GoalExecutor.execute(context)
   ├─→ TemplateSelector.select(goal)
   │   └─→ [Thompson Sampling @ backend]
   │       └─→ SelectionResult { template, score, candidates }
   ├─→ emit("execution:template_selected") + emitImpulse()
   │   └─→ ImpulseStore.create({ shape: "activity", ... })
   ├─→ ActivityExecutor.execute(template)
   │   ├─→ For each task:
   │   │   ├─→ emit("execution:task_start") + emitImpulse()
   │   │   ├─→ LLM processes task with tools
   │   │   ├─→ emit("execution:tool_call") + emitImpulse()
   │   │   └─→ emit("execution:task_complete") + emitImpulse()
   │   └─→ ActivityExecution { status, trace, metrics }
   └─→ TemplateSelector.recordOutcome(success, cost, duration)
       └─→ [Backend updates alpha/beta for Thompson Sampling]
```

### Secondary Flow: Impulses → Regions → Rendering

```
1. GoalExecutor.emitImpulse(event, data)
   ├─→ Maps event to shape (activity/task/tool_call/summary/error)
   └─→ ImpulseStore.create({ shape, content: JSON.stringify(data) })
       ↓
2. ImpulseStore.notify({ type: "create", impulse })
   ├─→ Checks subscriptions
   ├─→ Applies predicate filters
   └─→ Calls matching listeners
       ↓
3. ExecutionBridge.handleImpulse(event)
   ├─→ Parses impulse.content (JSON)
   ├─→ Routes by impulse.shape
   └─→ RegionManager.add({ id, shape, content })
       ↓
4. RegionManager.emit("region:added", region)
   ↓
5. RegionRenderer.scheduleRender()
   ├─→ layout = regionManager.getLayout()  // Sorted by priority
   ├─→ lines = renderLayout(layout, ctx)
   └─→ stdout.write(lines)  // Full-screen ANSI rendering
```

### Tertiary Flow: Execution → Trace → Template Extraction

```
1. ActivityExecution completes successfully
   ↓
2. ExecutionTrace { tasks, state_transitions, files_modified }
   ↓
3. Ribosome.assembleTemplateFromExecution(trace)
   ├─→ Extracts task patterns
   ├─→ Identifies invariant prompts
   ├─→ Generates template structure
   └─→ ExtractedTemplate { id, tasks, confidence }
       ↓
4. PromotionManager.promoteTemplate(template)
   ├─→ Validates template completeness
   ├─→ Assigns genealogy metadata
   └─→ POST /v2/activities/templates
       ↓
5. Backend stores template in activity_registry
   ├─→ Sets initial Thompson priors: alpha=1, beta=1
   ├─→ Makes available for future Thompson Sampling
   └─→ Returns success + variant_id
       ↓
6. Next similar goal:
   └─→ Thompson Sampling recommends new template
```

---

## Database Schema Integration

### Field Sourcing Summary

| Field | Source | Calculation | Table |
|-------|--------|-------------|-------|
| **From MiniBob** | | | |
| variant_id | MiniBob execution | Template ID used | activity_execution_traces |
| success | MiniBob execution | true/false outcome | activity_execution_traces |
| duration_ms | MiniBob execution | Wall-clock time | activity_execution_traces |
| cost | MiniBob execution | LLM API cost | activity_execution_traces |
| tokens.{input,output,cache} | MiniBob execution | Token counts | activity_execution_traces |
| error_message | MiniBob execution | Error text if failed | activity_execution_traces |
| impulses_used | MiniBob execution | Impulse IDs loaded | activity_execution_traces |
| execution_trace | MiniBob execution | Full task-by-task record | activity_execution_traces |
| **Computed by Backend** | | | |
| execution_id | Backend | UUID generation | activity_execution_traces |
| org_id | Backend | From JWT $auth.org_id | activity_execution_traces |
| project_id | Backend | From JWT $auth.project_id | activity_execution_traces |
| executed_at | Backend | NOW() | activity_execution_traces |
| thompson_alpha | Backend | successes + 1 | activity_registry, variant_performance_metrics |
| thompson_beta | Backend | failures + 1 | activity_registry, variant_performance_metrics |
| success_rate | Backend | successes / total | variant_performance_metrics |
| avg_duration_ms | Backend | Rolling average | variant_performance_metrics |
| avg_cost_usd | Backend | Rolling average | variant_performance_metrics |
| **Impulse Fields** | | | |
| impulse_id | MiniBob or Backend | Generated ID | impulse_data, impulse |
| impulse_type | MiniBob/Backend | Pointer type | impulse_data |
| pointer | MiniBob/Backend | Full pointer object | impulse_data, impulse |
| shape | Microplastic | Semantic categorization | (new ExtendedImpulse) |
| relevance_score | Backend | successes_with / times_loaded | impulse_relevance_metrics |

### Critical Indexes for Performance

```sql
-- Multi-tenant composite indexes (RBAC enforcement)
idx_activity_executions_org_project_activity
idx_impulse_data_org_project_id
idx_variant_performance_org

-- Domain-specific queries
idx_thompson_selection_execution      -- Explainability logs
idx_composition_org_parent            -- Graph traversal
idx_activity_org_tags                 -- Tag-based discovery
```

### Dual-Write Strategy (Legacy → Paradigm Migration)

Backend writes to both:
1. **Legacy tables:** activity_registry, activity_execution_traces, impulse_data
2. **New tables:** activity, execution, impulse

Controlled by feature flags:
- `DUAL_WRITE_ENABLED=true` - Write to both (default)
- `PARADIGM_READ_ENABLED=true` - Try new schema first
- `PARADIGM_READ_PERCENTAGE=50` - Gradual rollout

---

## Common Logical Patterns

### Pattern 1: Subscription with Predicate Filtering

**Used by:** ImpulseStore, RegionManager, ExecutionBridge

**Core Logic:**
```typescript
// Subscribe with filter
subscribe(listener, predicate) {
  this.subscriptions.set(key, { listener, predicate });
  return () => this.subscriptions.delete(key);
}

// Notify with filtering
private notify(event) {
  for (const [, entry] of this.subscriptions) {
    if (!entry.predicate || matchesPredicate(event.data, entry.predicate)) {
      entry.listener(event);
    }
  }
}
```

**Benefits:**
- Efficient filtering at source
- Subscribers don't process irrelevant events
- Declarative subscription criteria

**Colocation Opportunity:** Extract to `src/patterns/filtered-subscription.ts`

### Pattern 2: Semantic Shapes Over Pointer Types

**Used by:** ImpulseStore, ExecutionBridge, RegionManager

**Core Logic:**
```typescript
// Pointer: HOW to access data
pointer: { type: "file", path: "src/main.ts" }

// Shape: WHAT the data represents
shape: "source_code"

// Routing based on shape, not pointer type
switch (impulse.shape) {
  case "source_code": handleCode(); break;
  case "error": handleError(); break;
  case "trace": handleTrace(); break;
}
```

**Benefits:**
- Decouples semantics from storage
- Same shape can have different pointer types
- Enables shape-based subscriptions

**Colocation Opportunity:** Shape definitions in `src/impulse/shapes.ts`

### Pattern 3: Resolver Chain Architecture

**Used by:** ImpulseStore, VesselProvider system

**Core Logic:**
```typescript
// Set resolver priority
impulseStore.setResolvers([minibobVessel, mcpVessel, backendVessel]);

// Route to first match
private findResolver(pointer) {
  for (const resolver of this.resolvers) {
    if (resolver.canResolve(pointer)) return resolver;
  }
  return undefined;
}
```

**Benefits:**
- Pluggable resolution logic
- Vessels declare capabilities
- Clear precedence order

**Colocation Opportunity:** Resolver registry in `src/vessel/registry.ts`

### Pattern 4: 1:1 State Mapping (Impulse → Region)

**Used by:** ExecutionBridge, RegionManager

**Core Logic:**
```typescript
// Track mappings
private impulseToRegion = new Map<string, string>();

// Get or create
getOrCreateRegion(impulseId, shape, content) {
  const existing = this.impulseToRegion.get(impulseId);
  if (existing) {
    this.regionManager.update(existing, content);
    return existing;
  }
  const regionId = this.createRegion(impulseId, shape, content);
  this.impulseToRegion.set(impulseId, regionId);
  return regionId;
}
```

**Benefits:**
- No duplicate regions
- Stateful updates (not recreating)
- Clear ownership

**Colocation Opportunity:** Already in ExecutionBridge, but could extract to `src/patterns/entity-mapping.ts`

### Pattern 5: Thompson Sampling Learning Loop

**Used by:** TemplateSelector, Backend API

**Core Logic:**
```typescript
// On execution complete
recordOutcome({ templateId, success, cost, duration }) {
  // Backend updates counters
  if (success) successes++;
  else failures++;

  // Compute Thompson parameters
  alpha = successes + 1;  // Beta prior + observed successes
  beta = failures + 1;    // Beta prior + observed failures

  // Next recommendation samples: Beta(alpha, beta) → probability
}
```

**Benefits:**
- Bayesian learning from outcomes
- Exploration/exploitation tradeoff
- No manual tuning required

**Colocation Opportunity:** Thompson logic in backend, but could document in `docs/THOMPSON_SAMPLING.md`

---

## Reorganized Task List

### Phase 1: Foundation (COMPLETE ✅)

**Goal:** Impulse state space with subscription predicates

- ✅ 1.1: SubscriptionPredicate interface
- ✅ 1.2: query() method implementation
- ✅ 1.3: Impulse lifecycle events
- ✅ 1.4: Shape field on Impulse type
- ✅ 1.5: Test suite (16 tests passing)

**Commit:** `bbde1f4` "feat(microplastic): add subscription predicates to ImpulseStateSpace"

### Phase 2: Impulse-Driven Execution (PARTIAL ⚠️)

**Goal:** All execution events flow through ImpulseStateSpace

**Completed:**
- ✅ 2.1: GoalExecutor emits impulses
- ✅ 2.2: ExecutionBridge subscribes to impulses
- ⚠️ 2.3: User input as impulse (NOT DONE)
- ✅ 2.4: Shape mapping (in emitImpulse)
- ⚠️ 2.5: End-to-end testing (HANGING ISSUE)

**Remaining Work:**

**Task 2.3: User Input as Impulse Emission**
```typescript
// In index.ts runInteractiveWithRegions()
function handleUserInput(goal: string) {
  // Create goal impulse
  const goalImpulse = impulseStore.create({
    pointer: { type: "user_goal", goal },
    budget: 500,
    priority: "high",
    shape: "goal",
    content: JSON.stringify({ goal, timestamp: Date.now() }),
  });

  // Executor subscribes to goal impulses
  impulseStore.subscribe(
    (event) => {
      const data = JSON.parse(event.impulse.content);
      executor.execute({ goal: data.goal, ... });
    },
    { shape: "goal" }
  );
}
```

**Task 2.5: Fix Execution Hanging**

Investigate race condition in `runGoalWithRegions()`:
- Check if `executor.execute()` properly awaits
- Verify final event emission
- Ensure renderer gets completion signal
- Remove 500ms timeout hack

**Commit Milestone:** "feat(microplastic): complete impulse-driven execution flow"

### Phase 3: TUI Improvements (COMPLETE ✅)

**Goal:** Full-screen, responsive, stateful rendering

- ✅ 3.1: Full terminal window rendering
- ✅ 3.2: Terminal resize handling
- ✅ 3.3: Viewport scrolling for long content
- ✅ 3.4: Stateful impulse-to-region mapping
- ✅ 3.5: Full-screen clear strategy

**Commit:** `9d94336` "feat(microplastic): full-screen responsive TUI with stateful impulse mapping"

### Phase 4: Self-Development Command (NEW - HIGH PRIORITY)

**Goal:** Use MiniBob to develop microplastic

**Task 4.1: Create /dev Command Entry Point**
```bash
# Usage
microplastic /dev "Add keyboard shortcuts for region collapse"
microplastic --dev "Optimize rendering performance"
```

File: `src/commands/dev.ts`
```typescript
export async function devCommand(
  goal: string,
  options: { verbose?: boolean; dryRun?: boolean }
): Promise<DevResult> {
  // Initialize MiniBob instance
  const minibob = await initializeMiniBobForDev({
    workdir: process.cwd(),  // repos/microplastic
    backendUrl: process.env.ACTIVITY_API_URL ?? "http://activity.metabob.local",
    apiKey: process.env.MINIBOB_API_KEY ?? "mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB",
    instanceId: "microplastic-dev",
  });

  // Execute goal using MiniBob
  const result = await minibob.executeGoal(goal);

  // Report to user
  console.log(`Development execution: ${result.status}`);
  console.log(`Files modified: ${result.filesModified.length}`);

  return result;
}
```

**Task 4.2: MiniBob Instance Initialization**

File: `src/commands/minibob-integration.ts`
```typescript
import { GoalProcessor, ActivityExecutor } from "@metabob/minibob";

export async function initializeMiniBobForDev(config: DevConfig) {
  // Create MiniBob activity executor
  const executor = new ActivityExecutor({
    provider: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: "claude-sonnet-4-20250514",
    workingDirectory: config.workdir,
  });

  // Create goal processor with backend connection
  const processor = new GoalProcessor({
    executor,
    mcpEndpoint: config.backendUrl,
    instanceAuth: {
      instanceId: config.instanceId,
      apiKey: config.apiKey,
    },
  });

  return processor;
}
```

**Task 4.3: Wire /dev to CLI**

File: `src/index.ts`
```typescript
// Add to argument parsing
if (args[0] === "/dev" || args[0] === "--dev") {
  const goal = args.slice(1).join(" ");
  if (!goal) {
    console.error("Usage: microplastic /dev \"goal description\"");
    process.exit(1);
  }

  const result = await devCommand(goal, options);
  process.exit(result.success ? 0 : 1);
}
```

**Task 4.4: Capture Development Traces**

Ensure development executions:
- Store traces in backend
- Tag with `scope: "development"`
- Enable ribosome extraction
- Feed Thompson Sampling for dev activities

**Commit Milestone:** "feat(microplastic): implement /dev self-development command"

### Phase 5: Template Seeding & Verification (NEW)

**Goal:** Ensure primordial templates and microplastic-specific templates are seeded

**Task 5.1: Verify Seeding Success**
```typescript
async function seedTemplates(): Promise<SeedResult> {
  const results = [];

  for (const template of PRIMORDIAL_TEMPLATES) {
    try {
      await selector.createTemplate(template);
      results.push({ id: template.id, status: "success" });
    } catch (error) {
      results.push({ id: template.id, status: "failed", error });
    }
  }

  // Seed microplastic-specific templates
  for (const template of MICROPLASTIC_DEV_TEMPLATES) {
    // ... same logic
  }

  return { success: results.filter(r => r.status === "success").length, total: results.length };
}
```

**Task 5.2: Create Microplastic Development Templates**

File: `src/primordials/microplastic-templates.ts`
```typescript
export const MICROPLASTIC_DEV_TEMPLATES: ActivityTemplate[] = [
  {
    id: "microplastic-add-impulse-shape",
    name: "Add Impulse Shape",
    description: "Add new semantic shape to ImpulseStore",
    tags: ["feature.impulse.shape", "microplastic"],
    tasks: [
      {
        id: "define-shape",
        description: "Add shape to ImpulseShape type",
        prompt: {
          template: "Add new shape '{{shapeName}}' to ImpulseShape type in src/impulse/types.ts",
          variables: [{ name: "shapeName", type: "string", required: true }],
        },
      },
      {
        id: "add-handler",
        description: "Add handler in ExecutionBridge",
        prompt: {
          template: "Create handler for {{shapeName}} impulses in src/tui/execution-bridge.ts",
          variables: [{ name: "shapeName", type: "string", required: true }],
        },
      },
    ],
  },
  {
    id: "microplastic-add-region-component",
    name: "Add Region Component",
    description: "Create new region rendering component",
    tags: ["feature.tui.region", "microplastic"],
    // ... tasks
  },
  {
    id: "microplastic-optimize-rendering",
    name: "Optimize Rendering",
    description: "Improve TUI rendering performance",
    tags: ["optimization.tui.performance", "microplastic"],
    // ... tasks
  },
];
```

**Task 5.3: Seed on First Run**
```typescript
// In index.ts startup
if (!await hasSeededTemplates()) {
  console.log("First run: seeding templates...");
  const result = await seedTemplates();
  console.log(`Seeded ${result.success}/${result.total} templates`);
  await markTemplatesSeeded();
}
```

**Commit Milestone:** "feat(microplastic): seed development templates to backend"

### Phase 6: Instrumentation Activities (NEW)

**Goal:** Add zero-LLM-cost activities for observability

**Task 6.1: Define Instrumentation Activities**

File: `src/activities/instrumentation.ts`
```typescript
export const INSTRUMENTATION_ACTIVITIES: ActivityTemplate[] = [
  {
    id: "instrument-impulse-lifecycle",
    name: "Impulse Lifecycle Trace",
    category: "instrumentation",
    executionFormat: "tool",  // No LLM needed
    tasks: [
      {
        id: "capture",
        toolName: "trace_capture",
        arguments: {
          event: "impulse:{{eventType}}",
          data: {
            impulseId: "{{impulseId}}",
            shape: "{{shape}}",
            timestamp: "{{timestamp}}",
          },
        },
      },
    ],
  },
  {
    id: "instrument-subscription-match",
    name: "Subscription Match Trace",
    category: "instrumentation",
    executionFormat: "tool",
    // ... similar structure
  },
];
```

**Task 6.2: Create Trace Capture Tool**
```typescript
async function traceCaptureHandler(params: {
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}): Promise<ToolResult> {
  // Send to backend asynchronously (fire and forget)
  getMCPClient()?.storeInstrumentationTrace(params).catch(() => {});
  return { success: true };
}
```

**Task 6.3: Wire to ImpulseStore**
```typescript
if (process.env.MICROPLASTIC_INSTRUMENT === "true") {
  impulseStore.subscribe(
    (event) => {
      traceCaptureHandler({
        event: `impulse:${event.type}`,
        data: {
          impulseId: event.impulse.id,
          shape: event.impulse.shape,
        },
        timestamp: Date.now(),
      });
    },
    {}  // All impulses
  );
}
```

**Commit Milestone:** "feat(microplastic): add instrumentation activities for tracing"

### Phase 7: Cross-Pollination (NEW)

**Goal:** Runtime traces inform development, development improves runtime

**Task 7.1: Runtime Trace Analyzer**

File: `src/commands/analyze.ts`
```typescript
export async function analyzeRuntimeTraces(): Promise<DevelopmentGoal[]> {
  // Query recent failing traces
  const failures = await mcp.queryTraces({
    success: false,
    limit: 20,
    since: Date.now() - 86400000,  // Last 24 hours
  });

  // Analyze patterns
  const patterns = await analyzeFailurePatterns(failures);

  // Generate development goals
  return patterns.map(pattern => ({
    goal: `Fix: ${pattern.errorMessage}`,
    type: "bugfix",
    priority: pattern.frequency > 5 ? "high" : "medium",
    context: {
      traceIds: pattern.traceIds,
      errorType: pattern.errorType,
      suggestedFix: pattern.suggestedFix,
    },
  }));
}
```

**Task 7.2: Create /dev --analyze Command**
```bash
microplastic /dev --analyze
# Output:
# 🔍 Analyzing runtime traces...
# Found 3 patterns:
#   1. [HIGH] Region rendering timeout (5 occurrences)
#      Suggested fix: Add caching to layout calculation
#   2. [MEDIUM] Template selection slow (3 occurrences)
#      Suggested fix: Index activity_registry by tags
```

**Task 7.3: Suggestion Impulses**
```typescript
function createImprovementSuggestions(goals: DevelopmentGoal[]) {
  for (const goal of goals) {
    impulseStore.create({
      pointer: { type: "development_suggestion", goal: goal.goal },
      shape: "improvement_suggestion",
      priority: goal.priority === "high" ? "high" : "medium",
      content: JSON.stringify(goal),
    });
  }
}
```

**Task 7.4: Auto-Execute Improvements**
```typescript
// In boredom mode (Phase 8)
impulseStore.subscribe(
  async (event) => {
    const suggestion = JSON.parse(event.impulse.content);
    await devCommand(suggestion.goal, { verbose: true });
  },
  { shape: "improvement_suggestion", minPriority: 750 }  // Only high priority
);
```

**Commit Milestone:** "feat(microplastic): implement cross-pollination feedback loop"

### Phase 8: Boredom Mode (NEW - FINAL)

**Goal:** Autonomous improvement when idle

**Task 8.1: Idle Detection**
```typescript
export class BoredomDetector {
  private lastActivityTime = Date.now();
  private idleThreshold = 5 * 60 * 1000;  // 5 minutes

  markActivity() {
    this.lastActivityTime = Date.now();
  }

  isBored(): boolean {
    return Date.now() - this.lastActivityTime > this.idleThreshold;
  }
}
```

**Task 8.2: Boredom Loop**
```typescript
async function boredomLoop() {
  const detector = new BoredomDetector();

  setInterval(async () => {
    if (!detector.isBored()) return;

    console.log("[Boredom] Looking for improvements...");

    // Analyze runtime
    const suggestions = await analyzeRuntimeTraces();

    if (suggestions.length === 0) {
      console.log("[Boredom] No issues found, system healthy");
      return;
    }

    // Pick highest priority suggestion
    const goal = suggestions[0];
    console.log(`[Boredom] Executing: ${goal.goal}`);

    // Self-develop
    await devCommand(goal.goal, { verbose: false });

    detector.markActivity();
  }, 60000);  // Check every minute
}
```

**Task 8.3: Enable Boredom Mode**
```bash
microplastic --boredom-mode
# Starts interactive session with autonomous improvement
```

**Commit Milestone:** "feat(microplastic): implement boredom mode for autonomous improvement"

---

## Commit Milestones

### Milestone 1: Phase 1-3 Complete ✅
**Status:** DONE
**Commits:**
- `bbde1f4` ImpulseStateSpace foundation
- `9d94336` Full-screen TUI improvements

**Testing State:** Impulse predicates tested, TUI renders correctly

### Milestone 2: Phase 2 Complete (IN PROGRESS)
**Deliverable:** Full impulse-driven execution flow
**Commits planned:**
- Fix execution hanging issue
- Goal input as impulse emission
- End-to-end integration test

**Testing State:** Can execute `microplastic "goal"` without hanging, all events flow through impulses

### Milestone 3: Phase 4 Complete
**Deliverable:** Self-development command working
**Commits planned:**
- `/dev` command implementation
- MiniBob integration
- Development trace capture

**Testing State:** Can run `microplastic /dev "Add feature X"`, MiniBob modifies microplastic code, trace stored in backend

### Milestone 4: Phase 5-6 Complete
**Deliverable:** Templates seeded, instrumentation active
**Commits planned:**
- Template seeding with verification
- Microplastic-specific templates created
- Instrumentation activities added

**Testing State:** Templates appear in backend, instrumentation traces captured without LLM cost

### Milestone 5: Phase 7-8 Complete (FINAL)
**Deliverable:** Full self-improving system
**Commits planned:**
- Runtime trace analyzer
- Cross-pollination feedback
- Boredom mode implementation

**Testing State:** System autonomously detects issues and improves itself when idle

---

## Self-Development Loop Details

### Development Activity Categories

**microplastic-specific templates learn:**

1. **Feature Development**
   - Adding impulse shapes
   - Creating region components
   - Extending vessel capabilities
   - New command handlers

2. **Bug Fixes**
   - Race condition fixes
   - Memory leak resolution
   - Rendering glitches
   - Event propagation issues

3. **Optimizations**
   - Rendering performance
   - Memory usage
   - Backend query efficiency
   - Subscription filtering

4. **Infrastructure**
   - Test coverage expansion
   - CI/CD improvements
   - Documentation updates
   - Schema migrations

### Activity Reuse Examples

**Scenario 1: Adding Keyboard Shortcuts**

First time:
```bash
microplastic /dev "Add Ctrl+C keyboard shortcut to collapse all regions"
```
- MiniBob improvises (no template exists)
- Reads src/tui/renderer.ts
- Searches for key handler patterns
- Adds keyboard event listener
- Tests manually
- Records detailed trace

Backend extracts template: `microplastic-add-keyboard-shortcut-v1`

Second time:
```bash
microplastic /dev "Add Ctrl+E keyboard shortcut to expand all regions"
```
- Thompson Sampling recommends `microplastic-add-keyboard-shortcut-v1`
- Template provides structure
- MiniBob fills in: new key, new handler, new action
- Executes faster (template guidance)
- Records trace, updates alpha/beta

**Scenario 2: Optimizing Performance**

Runtime trace shows: "Region rendering taking 250ms (expected <50ms)"

Analyzer creates suggestion:
```typescript
{
  goal: "Optimize region rendering to reduce latency",
  type: "optimization",
  priority: "high",
  context: {
    currentLatency: 250,
    targetLatency: 50,
    traceIds: ["exec-abc", "exec-def"],
  }
}
```

Boredom mode executes:
```bash
microplastic /dev "Optimize region rendering to reduce latency"
```
- Thompson Sampling recommends `microplastic-optimize-rendering-v1`
- MiniBob profiles code
- Identifies: layout recalculation on every tick
- Implements: memoization of layout
- Tests: verifies latency drops to 30ms
- Records trace

Runtime improves automatically, no user intervention needed.

---

## Testing Strategy

### Unit Tests
- ImpulseStore: subscription predicates, query correctness
- RegionManager: stateful updates, priority sorting
- ExecutionBridge: impulse routing, region mapping
- GoalExecutor: impulse emission, event compatibility

### Integration Tests
- Goal → Execution → Trace → Backend
- Impulse → Region → Rendering pipeline
- Template selection → Thompson Sampling
- Ribosome extraction → Template registration

### End-to-End Tests
- `microplastic "goal"` executes successfully
- `microplastic /dev "goal"` modifies codebase
- Runtime traces feed development suggestions
- Boredom mode autonomously improves

### Performance Tests
- Rendering latency < 50ms
- Impulse subscription overhead < 5ms per event
- Template selection < 100ms (backend query)
- Full execution trace < 500KB

---

## Environment Configuration

### Required Variables

```bash
# LLM Access (Required for execution)
export ANTHROPIC_API_KEY="sk-ant-..."

# Backend Connection (Required for learning)
export ACTIVITY_API_URL="http://activity.metabob.local"

# Self-Development (Required for /dev command)
export MINIBOB_API_KEY="mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB"
export MINIBOB_INSTANCE_ID="microplastic-dev"

# Optional Features
export MICROPLASTIC_INSTRUMENT="true"          # Enable instrumentation
export MICROPLASTIC_BOREDOM_MODE="true"        # Enable autonomous improvement
export MICROPLASTIC_BOREDOM_THRESHOLD_MS="300000"  # 5 minutes idle
```

### Development .env Example

```bash
# repos/microplastic/.env
ANTHROPIC_API_KEY=sk-ant-api03-...
ACTIVITY_API_URL=http://activity.metabob.local
MINIBOB_API_KEY=mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB
MINIBOB_INSTANCE_ID=microplastic-dev
MINIBOB_MODEL=claude-sonnet-4-20250514
MICROPLASTIC_INSTRUMENT=true
```

---

## Summary

**Current State:**
- Foundation solid (Phase 1-3 complete)
- Execution flow needs debugging (Phase 2 partial)
- Self-development not yet implemented (Phase 4-8 missing)

**Critical Path:**
1. Fix execution hanging (unblocks interactive use)
2. Implement /dev command (enables self-development)
3. Add cross-pollination (creates feedback loop)
4. Enable boredom mode (achieves autonomy)

**Key Insight:**
By using MiniBob to develop microplastic, we create a system that:
- Learns development patterns (how to add features, fix bugs, optimize)
- Learns domain patterns (microplastic-specific templates)
- Self-improves autonomously (analyzes runtime, creates development goals)
- Feeds templates back into learning system (Thompson Sampling improves)

This is the "process-of-becoming" in action - the tool develops itself, creating activities that inform future development, in a continuous improvement loop.
