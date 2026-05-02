# Self-Development Loop Specification

## Overview

This spec defines how microplastic uses MiniBob to develop itself, creating a continuous improvement cycle where:
1. Development activities improve microplastic code
2. Runtime instrumentation traces observe behavior
3. Traces inform what to develop next
4. Both feed Thompson Sampling for better template selection

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SELF-DEVELOPMENT LOOP                                │
│                                                                         │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐         │
│   │  /dev   │────▶│ MiniBob │────▶│  Trace  │────▶│Ribosome │         │
│   │ command │     │ Execute │     │ Capture │     │ Extract │         │
│   └─────────┘     └─────────┘     └─────────┘     └─────────┘         │
│        ▲                                               │               │
│        │                                               ▼               │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐         │
│   │ Better  │◀────│Thompson │◀────│ Backend │◀────│Template │         │
│   │Templates│     │Sampling │     │  Store  │     │  Seed   │         │
│   └─────────┘     └─────────┘     └─────────┘     └─────────┘         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Interface Boundaries

### 1. MiniBob Library Interface

**Import from:** `@metabob/minibob`

```typescript
// Core execution
import {
  ActivityExecutor,
  GoalProcessor,
  loadTemplate,
  type ExecutorConfig,
  type ActivityExecution
} from "@metabob/minibob"

// Backend integration
import {
  initializeMCP,
  getMCPClient,
  type MCPConfig
} from "@metabob/minibob"

// Session tracking
import {
  createSession,
  recordExecution,
  completeSession
} from "@metabob/minibob"
```

**Key Methods:**

| Method | Purpose | Returns |
|--------|---------|---------|
| `ActivityExecutor.execute()` | Execute template with variables | `ActivityExecution` |
| `GoalProcessor.processGoal()` | High-level goal execution | `GoalResult` |
| `MCPClient.recommendActivities()` | Thompson Sampling recommendations | `Recommendation[]` |
| `MCPClient.storeExecutionTrace()` | Store trace for learning | `boolean` |
| `MCPClient.registerTemplate()` | Seed new template | `boolean` |

### 2. Activity API Interface

**Endpoint:** `http://activity.metabob.local`

| Route | Method | Purpose |
|-------|--------|---------|
| `/v2/activities/recommend` | POST | Get Thompson Sampled templates |
| `/v2/activities/templates` | POST | Register new template |
| `/v2/activities/execution-traces` | POST | Store execution trace |
| `/v2/activities/tool-usage` | POST | Record tool patterns |
| `/v2/activities/composition` | POST | Record parent-child activities |
| `/v2/activities/impulse-relevance` | POST | Track impulse usefulness |

### 3. ImpulseStateSpace Interface

**Core Methods:**

```typescript
interface ImpulseStateSpace {
  // Emit impulse to state space
  emit(impulse: Impulse): string

  // Subscribe to matching impulses
  subscribe(
    predicate: SubscriptionPredicate,
    handler: (impulse: Impulse) => void
  ): () => void

  // Update impulse content
  update(id: string, content: Partial<ImpulseContent>): void

  // Mark impulse complete
  complete(id: string): void

  // Query matching impulses
  query(predicate: SubscriptionPredicate): Impulse[]

  // Resolve impulse content via provider
  resolve(id: string): Promise<ResolvedContent>
}

interface SubscriptionPredicate {
  type?: string | string[]      // Pointer type(s)
  shape?: string | string[]     // Impulse shape(s)
  minPriority?: number          // Minimum priority
  custom?: (i: Impulse) => boolean  // Custom predicate
}
```

## Database Schemas

### Execution Traces (Learning Input)

**Table:** `execution` (paradigm) / `activity_executions` (legacy)

| Field | Type | Source | Purpose |
|-------|------|--------|---------|
| `execution_id` | string | MiniBob | Unique identifier |
| `activity_id` | string | MiniBob | Template executed |
| `success` | bool | MiniBob | Pass/fail outcome |
| `duration_ms` | int | MiniBob | Execution time |
| `cost_usd` | float | MiniBob | API cost |
| `tokens_input` | int | MiniBob | Input tokens |
| `tokens_output` | int | MiniBob | Output tokens |
| `trace` | object | MiniBob | Full execution trace |
| `input_impulses` | array | MiniBob | Context used |
| `output_impulses` | array | MiniBob | Artifacts created |
| `vessel_id` | string | MiniBob | Which instance |
| `org_id` | record | Auth | Multi-tenant isolation |

### Thompson Sampling Metrics

**Table:** `variant_performance_metrics`

| Field | Type | Computed From | Purpose |
|-------|------|---------------|---------|
| `variant_id` | string | FK | Template ID |
| `total_executions` | int | COUNT(*) | Denominator |
| `successful_executions` | int | COUNT(success=true) | Numerator |
| `thompson_alpha` | float | successes + 1 | Beta prior |
| `thompson_beta` | float | failures + 1 | Beta prior |
| `success_rate` | float | successes/total | Display metric |
| `avg_duration_ms` | float | AVG(duration_ms) | Performance |
| `avg_cost_usd` | float | AVG(cost_usd) | Cost tracking |

### Activity Templates

**Table:** `activity` (paradigm) / `activity_template` (legacy)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique template ID |
| `name` | string | Human name |
| `description` | string | Purpose |
| `category` | enum | feature, bugfix, refactor, tool, infrastructure |
| `tasks` | array | Task definitions |
| `input_shapes` | array | Required impulse shapes |
| `output_shapes` | array | Produced impulse shapes |
| `extracted_from` | string | Source execution (ribosome) |
| `scope` | enum | global, org, project, vessel |

## Seed Templates

### Generic Development Templates

```typescript
const GENERIC_TEMPLATES = [
  {
    id: "implement-feature-v1",
    name: "Implement Feature",
    category: "feature",
    input_shapes: ["goal", "source_code"],
    tasks: [
      { id: "analyze", description: "Analyze requirements and codebase" },
      { id: "implement", description: "Implement the feature" },
      { id: "test", description: "Add tests" },
      { id: "verify", description: "Verify implementation" }
    ]
  },
  {
    id: "fix-bug-v1",
    name: "Fix Bug",
    category: "bugfix",
    input_shapes: ["goal", "error", "source_code"],
    tasks: [
      { id: "diagnose", description: "Diagnose root cause" },
      { id: "fix", description: "Apply fix" },
      { id: "test", description: "Add regression test" }
    ]
  },
  {
    id: "add-tests-v1",
    name: "Add Tests",
    category: "feature",
    input_shapes: ["goal", "source_code"],
    tasks: [
      { id: "analyze", description: "Analyze coverage gaps" },
      { id: "implement", description: "Write tests" },
      { id: "verify", description: "Run and verify" }
    ]
  }
]
```

### Microplastic-Specific Templates

```typescript
const MICROPLASTIC_TEMPLATES = [
  {
    id: "microplastic/add-impulse-shape-v1",
    name: "Add Impulse Shape",
    category: "feature",
    input_shapes: ["goal"],
    output_shapes: ["source_code"],
    tasks: [
      { id: "define", description: "Define new shape in types.ts" },
      { id: "region", description: "Add region rendering in components.ts" },
      { id: "factory", description: "Add factory helper in regions.ts" },
      { id: "test", description: "Add shape tests" }
    ]
  },
  {
    id: "microplastic/add-provider-v1",
    name: "Add VesselProvider",
    category: "feature",
    input_shapes: ["goal"],
    output_shapes: ["source_code"],
    tasks: [
      { id: "interface", description: "Implement VesselProvider interface" },
      { id: "resolver", description: "Implement canResolve/resolve" },
      { id: "register", description: "Register in vessel registry" },
      { id: "test", description: "Add provider tests" }
    ]
  },
  {
    id: "microplastic/enhance-tui-region-v1",
    name: "Enhance TUI Region",
    category: "feature",
    input_shapes: ["goal", "source_code"],
    tasks: [
      { id: "analyze", description: "Analyze current region rendering" },
      { id: "enhance", description: "Implement enhancement" },
      { id: "style", description: "Add ANSI styling" },
      { id: "test", description: "Test rendering" }
    ]
  },
  {
    id: "microplastic/fix-subscription-bug-v1",
    name: "Fix Subscription Bug",
    category: "bugfix",
    input_shapes: ["goal", "error"],
    tasks: [
      { id: "trace", description: "Trace subscription flow" },
      { id: "diagnose", description: "Identify bug" },
      { id: "fix", description: "Apply fix" },
      { id: "test", description: "Add subscription tests" }
    ]
  }
]
```

## /dev Command Flow

### Invocation

```bash
# Self-development mode
microplastic /dev "Add trace region rendering"

# With verbose output
microplastic /dev -v "Improve error handling in impulse store"

# Dry run (show plan only)
microplastic /dev --dry-run "Refactor subscription predicates"
```

### Implementation

```typescript
// src/commands/dev.ts

import {
  GoalProcessor,
  initializeMCP,
  createSession,
  recordExecution,
  completeSession
} from "@metabob/minibob"

export async function devCommand(goal: string, options: DevOptions) {
  // 1. Initialize backend connection
  initializeMCP({
    endpoint: process.env.ACTIVITY_API_URL ?? "http://activity.metabob.local",
    instance: {
      instanceId: process.env.MINIBOB_INSTANCE_ID ?? "microplastic-dev",
      apiKey: process.env.MINIBOB_API_KEY!
    }
  })

  // 2. Create executor targeting microplastic codebase
  const executor = new ActivityExecutor({
    provider: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: process.env.MINIBOB_MODEL ?? "claude-sonnet-4-20250514",
    workingDirectory: "repos/microplastic",

    // Wire callbacks to TUI
    onActivityStarted: (id, templateId, name) => {
      regionManager.add({
        id: `activity-${id}`,
        shape: "activity",
        content: { name, status: "running" }
      })
    },
    onActivityTaskCompleted: (id, taskId, desc, status) => {
      regionManager.update(`activity-${id}`, {
        currentTask: desc,
        status
      })
    },
    onActivityCompleted: (execution) => {
      regionManager.complete(`activity-${execution.id}`)
    }
  })

  // 3. Create goal processor
  const processor = new GoalProcessor({
    workingDirectory: "repos/microplastic",
    executor
  })

  // 4. Create session for execution sequence tracking
  const session = createSession("microplastic-dev")

  // 5. Execute goal
  const result = await processor.processGoal({
    message: goal,
    type: inferGoalType(goal),
    intent: goal,
    context: {
      vessel: "microplastic",
      developmentMode: true
    }
  })

  // 6. Record execution for learning
  for (const execution of result.executions) {
    recordExecution(session.sessionId, execution, 'goal')
  }

  // 7. Complete session
  await completeSession(session.sessionId, result.completed ? 'success' : 'failure')

  // 8. Backend automatically:
  //    - Stores traces
  //    - Updates Thompson Sampling
  //    - Extracts templates via ribosome
  //    - Learns patterns

  return result
}
```

## Trace Improvement Cycle

### 1. Execution → Trace Capture

```
Goal: "Add trace region rendering"
  ↓
Template Selected: microplastic/enhance-tui-region-v1
  ↓
Execution Trace Captured:
{
  execution_id: "exec-abc123",
  activity_id: "microplastic/enhance-tui-region-v1",
  success: true,
  duration_ms: 45000,
  cost_usd: 0.12,
  trace: {
    tasks: [
      { id: "analyze", toolCalls: [...], response: "..." },
      { id: "enhance", toolCalls: [...], response: "..." },
      { id: "style", toolCalls: [...], response: "..." },
      { id: "test", toolCalls: [...], response: "..." }
    ],
    filesModified: ["src/tui/components.ts"],
    filesCreated: ["src/tui/trace-region.ts"]
  }
}
```

### 2. Trace → Ribosome Extraction

```
Successful Trace → Ribosome Analysis:
  - Task boundaries identified
  - Variable points extracted
  - Tool patterns captured

New Template Created:
{
  id: "microplastic/add-trace-region-v1",
  name: "Add Trace Region",
  extracted_from: "exec-abc123",
  category: "feature",
  tasks: [
    { id: "component", description: "Create region component" },
    { id: "render", description: "Implement renderTrace function" },
    { id: "factory", description: "Add createTraceRegion helper" },
    { id: "export", description: "Export from index.ts" }
  ]
}
```

### 3. Template → Thompson Sampling

```
Template: microplastic/add-trace-region-v1

Initial State:
  alpha = 1 (1 success + prior)
  beta = 1 (0 failures + prior)

After 5 more executions (4 success, 1 failure):
  alpha = 5 (4 + 1)
  beta = 2 (1 + 1)

Expected Success Rate: 5/7 = 71%
Thompson Sample: draws from Beta(5, 2) distribution
```

### 4. Cross-Pollination

```
Development Activity Observes:
  - Runtime traces show slow subscription matching
  - Pattern: O(n) predicate evaluation

Development Goal Created:
  "Optimize subscription predicate evaluation"

Runtime Activity Learns:
  - Development template succeeds with index-based matching
  - Pattern extracted: "Create index for common predicates"

Future Development Uses:
  - Template now includes indexing step
  - Success rate improves
```

## Configuration

### Environment Variables

```bash
# Required
export ANTHROPIC_API_KEY="sk-ant-..."
export MINIBOB_API_KEY="mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB"

# Optional (with defaults)
export ACTIVITY_API_URL="http://activity.metabob.local"
export MINIBOB_INSTANCE_ID="microplastic-dev"
export MINIBOB_MODEL="claude-sonnet-4-20250514"
export MINIBOB_WORKDIR="repos/microplastic"
```

### .env File

```bash
# repos/microplastic/.env
MINIBOB_API_KEY=mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB
ACTIVITY_API_URL=http://activity.metabob.local
```

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Template coverage | 80% goals use templates | templates / total goals |
| Improvisation rate | < 20% | improvisations / total goals |
| Success rate | > 70% | successful / total executions |
| Ribosome extraction | > 50% success → template | templates / successful improvisations |
| Cross-pollination | Bidirectional learning | dev traces inform runtime, runtime informs dev |

## Related Documentation

- [Design Decisions](../../design.md) - Decision 8 (Thin Vessel Wrapper), Decision 9 (Activities as Instrumentation)
- [MiniBob Library](../../../../repos/minibob/src/lib.ts) - Library entry point
- [Activity API Routes](../../../../repos/metabob-activity-api/src/routes/) - Backend endpoints
- [Thompson Sampling](../../../../repos/microplastic/src/selection/thompson.ts) - Local sampling
