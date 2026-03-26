# Self-Development Loop - Technical Design

> **Status**: Draft
> **Last Updated**: 2026-03-26

---

## Overview

This document specifies the technical implementation for closing the self-development loop. The key insight is that we need to track what data flows INTO an improvisation so we can specify what inputs the extracted template requires.

---

## 1. Data Structures

### 1.1 Impulse Shape

A minimal descriptor of what kind of data an impulse contains.

```typescript
/**
 * Describes the semantic shape of an impulse's content.
 * Used for activity matching - activities declare what shapes they need.
 */
interface ImpulseShape {
  /** Semantic type identifier (e.g., "error_log", "source_code", "test_results") */
  shape: string

  /** Human-readable description of what this shape represents */
  description?: string

  /** Whether content is a collection (array) or single item */
  isCollection?: boolean

  /** For collections, expected item shape */
  itemShape?: string
}
```

**Canonical shapes** (starting vocabulary):

| Shape | Description | Typical Source |
|-------|-------------|----------------|
| `source_code` | Code file contents | file pointer |
| `error_log` | Error output, stack traces | file or memo |
| `test_results` | Test execution output | bash result |
| `execution_trace` | Activity execution history | backend pointer |
| `activity_template` | Template definition | backend pointer |
| `patch` | Code diff | generated |
| `analysis` | LLM analysis output | generated |
| `metrics` | Performance/success metrics | backend pointer |
| `file_tree` | Directory structure | glob result |

### 1.2 Activity Input/Output Schema

Extends ActivityTemplate with schema declarations.

```typescript
interface ActivityTemplate {
  id: string
  name: string
  description: string
  category: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  tasks: ActivityTask[]
  variables: VariableDefinition[]

  // NEW: Schema declarations
  inputSchema?: {
    /** Impulse shapes that MUST be provided */
    required: ImpulseShape[]
    /** Impulse shapes that MAY be provided (enhance execution) */
    optional?: ImpulseShape[]
  }

  outputSchema?: {
    /** Impulse shapes this activity produces */
    produces: ImpulseShape[]
  }

  metadata?: {
    // Existing fields...
    extractedFrom?: "execution" | "goal-seeking" | "manual"
    sourceExecutionId?: string

    // NEW: Extraction provenance
    inputSchemaInferredFrom?: {
      executionId: string
      impulsesUsed: string[]
      confidence: number
    }
  }
}
```

### 1.3 Enhanced Improvisation Trace

Track impulses throughout improvisation.

```typescript
interface ImprovisationTrace {
  execution_id: string
  goal: string
  improvisation: true
  started_at: string
  completed_at?: string
  steps: ImprovisationStep[]
  outcome: ImprovisationOutcome
  context?: Record<string, unknown>

  // NEW: Impulse tracking
  impulses_available: ImpulseReference[]  // Impulses offered at start
  impulses_loaded: ImpulseLoadEvent[]     // Impulses actually loaded during execution
  impulses_created: ImpulseCreateEvent[]  // Impulses produced during execution
}

interface ImpulseReference {
  id: string
  pointer_type: string  // "file", "memo", "activityExecutionTrace", etc.
  shape: string         // Semantic shape
  budget: number
}

interface ImpulseLoadEvent {
  impulse_id: string
  shape: string
  loaded_at_step: number
  loaded_at_timestamp: string
  tokens_used: number
  /** Whether this impulse was essential (used in decision) or incidental */
  usage: "essential" | "incidental" | "unused"
}

interface ImpulseCreateEvent {
  impulse_id: string
  shape: string
  created_at_step: number
  created_at_timestamp: string
  /** Pointer to where the impulse content is stored */
  pointer: ImpulsePointer
}
```

### 1.4 Backend Schema Extensions

SurrealDB schema additions.

```surql
-- Add input/output schema to activity_template
DEFINE FIELD input_schema ON TABLE activity_template TYPE option<object>;
DEFINE FIELD output_schema ON TABLE activity_template TYPE option<object>;

-- Add impulse tracking to execution traces
DEFINE FIELD impulses_available ON TABLE activity_execution_traces TYPE option<array>;
DEFINE FIELD impulses_loaded ON TABLE activity_execution_traces TYPE option<array>;
DEFINE FIELD impulses_created ON TABLE activity_execution_traces TYPE option<array>;

-- Index for schema-based queries
DEFINE INDEX activity_template_input_shapes ON TABLE activity_template
  COLUMNS input_schema.required[*].shape;
```

---

## 2. Algorithms

### 2.1 Impulse Tracking During Improvisation

**Location**: `repos/minibob/src/improviser.ts`

```typescript
class GoalImproviser {
  private loadedImpulses: Map<string, ImpulseLoadEvent> = new Map()
  private createdImpulses: ImpulseCreateEvent[] = []

  async improvise(
    goal: string,
    config: ImprovisationConfig = {},
    initialImpulses?: Impulse[]  // NEW: Accept initial context
  ): Promise<ImprovisationTrace> {

    // Track available impulses
    const impulsesAvailable = (initialImpulses || []).map(imp => ({
      id: imp.id,
      pointer_type: imp.pointer.type,
      shape: this.inferShape(imp),
      budget: imp.budget,
    }))

    // ... existing improvisation loop ...

    // Before each tool call, check if impulse data is being used
    const toolResult = await this.executeWithImpulseTracking(
      step, toolHandler, decision.params
    )

    // After loop completes, finalize trace
    const trace: ImprovisationTrace = {
      // ... existing fields ...
      impulses_available: impulsesAvailable,
      impulses_loaded: Array.from(this.loadedImpulses.values()),
      impulses_created: this.createdImpulses,
    }

    return trace
  }

  private async executeWithImpulseTracking(
    step: number,
    handler: ToolHandler,
    params: Record<string, unknown>
  ): Promise<ToolResult> {
    // Track file reads as impulse loads
    if (params.path && typeof params.path === 'string') {
      this.recordImpulseLoad({
        impulse_id: `file:${params.path}`,
        shape: this.inferShapeFromPath(params.path),
        loaded_at_step: step,
        loaded_at_timestamp: new Date().toISOString(),
        tokens_used: 0,  // Will be calculated after load
        usage: 'essential',  // Assume essential, refine later
      })
    }

    const result = await handler(params)

    // Track file writes as impulse creates
    if (params.path && (handler.name === 'write' || handler.name === 'edit')) {
      this.recordImpulseCreate({
        impulse_id: `file:${params.path}`,
        shape: this.inferShapeFromPath(params.path),
        created_at_step: step,
        created_at_timestamp: new Date().toISOString(),
        pointer: { type: 'file', path: params.path as string },
      })
    }

    return result
  }

  private inferShape(impulse: Impulse): string {
    // Return existing shape if available
    if (impulse.metadata?.shape) return impulse.metadata.shape

    // Infer from pointer type
    switch (impulse.pointer.type) {
      case 'file': return this.inferShapeFromPath((impulse.pointer as any).path)
      case 'activityExecutionTrace': return 'execution_trace'
      case 'activityTemplate': return 'activity_template'
      case 'activityMetrics': return 'metrics'
      default: return 'unknown'
    }
  }

  private inferShapeFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs'].includes(ext || '')) {
      return 'source_code'
    }
    if (path.includes('error') || path.includes('.log')) {
      return 'error_log'
    }
    if (path.includes('test') || path.includes('.spec.')) {
      return 'test_file'
    }
    return 'file_content'
  }
}
```

### 2.2 InputSchema Extraction from Traces

**Location**: `repos/minibob/src/template-extractor.ts`

```typescript
export async function extractTemplateFromImprovisation(
  trace: ImprovisationTrace
): Promise<ActivityTemplate> {

  // Existing task extraction...
  const taskGroups = identifyTaskBoundaries(trace.steps)
  const tasks = taskGroups.map((group, index) => createTask(group, index))

  // NEW: Extract input schema from loaded impulses
  const inputSchema = extractInputSchema(trace)

  // NEW: Extract output schema from created impulses
  const outputSchema = extractOutputSchema(trace)

  const template: ActivityTemplate = {
    id: `tpl_${Date.now()}_${randomId()}`,
    name: capitalizeGoal(trace.goal),
    category: inferCategory(trace.goal, trace.outcome),
    description: trace.goal,
    tasks,
    variables: [],

    // NEW: Schema declarations
    inputSchema,
    outputSchema,

    metadata: {
      extractedFrom: 'execution',
      sourceExecutionId: trace.execution_id,
      inputSchemaInferredFrom: {
        executionId: trace.execution_id,
        impulsesUsed: trace.impulses_loaded.map(i => i.impulse_id),
        confidence: calculateSchemaConfidence(trace),
      },
      createdAt: Date.now(),
      author: 'ribosome',
    },
  }

  return template
}

function extractInputSchema(trace: ImprovisationTrace): ActivityTemplate['inputSchema'] {
  // Group loaded impulses by shape
  const shapeGroups = new Map<string, ImpulseLoadEvent[]>()
  for (const load of trace.impulses_loaded) {
    const existing = shapeGroups.get(load.shape) || []
    existing.push(load)
    shapeGroups.set(load.shape, existing)
  }

  // Essential impulses become required inputs
  const required: ImpulseShape[] = []
  const optional: ImpulseShape[] = []

  for (const [shape, loads] of shapeGroups) {
    const essentialLoads = loads.filter(l => l.usage === 'essential')
    const impulseShape: ImpulseShape = {
      shape,
      description: `${shape} used during improvisation`,
    }

    if (essentialLoads.length > 0) {
      required.push(impulseShape)
    } else {
      optional.push(impulseShape)
    }
  }

  return required.length > 0 ? { required, optional } : undefined
}

function extractOutputSchema(trace: ImprovisationTrace): ActivityTemplate['outputSchema'] {
  if (!trace.impulses_created || trace.impulses_created.length === 0) {
    return undefined
  }

  const produces: ImpulseShape[] = []
  const seenShapes = new Set<string>()

  for (const created of trace.impulses_created) {
    if (!seenShapes.has(created.shape)) {
      seenShapes.add(created.shape)
      produces.push({
        shape: created.shape,
        description: `Output produced during improvisation`,
      })
    }
  }

  return produces.length > 0 ? { produces } : undefined
}

function calculateSchemaConfidence(trace: ImprovisationTrace): number {
  let confidence = 0.5  // Base

  // More loaded impulses = higher confidence in input requirements
  if (trace.impulses_loaded.length >= 2) confidence += 0.1
  if (trace.impulses_loaded.length >= 5) confidence += 0.1

  // Essential impulses boost confidence
  const essentialCount = trace.impulses_loaded.filter(l => l.usage === 'essential').length
  confidence += Math.min(0.2, essentialCount * 0.05)

  // Success outcome boosts confidence
  if (trace.outcome.goal_achieved) confidence += 0.1

  return Math.min(1.0, confidence)
}
```

### 2.3 Schema-Based Activity Matching

**Location**: `repos/metabob-activity-api/src/routes/activities.ts`

```typescript
/**
 * Filter activities by input schema compatibility.
 * An activity matches if ALL its required shapes are present in provided shapes.
 */
async function filterByInputSchema(
  templates: ActivityTemplate[],
  providedShapes: string[]
): Promise<ActivityTemplate[]> {
  const providedSet = new Set(providedShapes)

  return templates.filter(template => {
    // Templates without inputSchema match anything (backwards compatible)
    if (!template.inputSchema?.required) {
      return true
    }

    // Check all required shapes are provided
    return template.inputSchema.required.every(req =>
      providedSet.has(req.shape)
    )
  })
}

// In /v2/activities/recommend endpoint
app.post('/recommend', async (c) => {
  const body = await c.req.json()
  const {
    goal,
    category,
    impulse_ids = [],
    impulse_shapes = [],  // NEW
    limit = 3
  } = body

  // 1. Fetch all candidate templates
  let templates = await listAllTemplatesFromDB(100, orgId, projectId, jwtToken)

  // 2. Filter by category if specified
  if (category) {
    templates = templates.filter(t => t.category === category)
  }

  // 3. NEW: Filter by input schema compatibility
  if (impulse_shapes.length > 0) {
    templates = await filterByInputSchema(templates, impulse_shapes)
    logger.info('Schema filtering applied', {
      before: templates.length,
      providedShapes: impulse_shapes,
    })
  }

  // 4. Apply Thompson Sampling to remaining candidates
  const ranked = applyThompsonSampling(templates)

  return c.json({
    recommendations: ranked.slice(0, limit),
  })
})
```

### 2.4 Local Boredom Mode

**Location**: `repos/minibob/src/boredom.ts`

```typescript
export interface BoredomMode {
  type: 'cluster' | 'local'
  // Cluster mode settings
  pollInterval?: number
  idleThreshold?: number
  // Local mode settings
  localQueuePath?: string
  localPollInterval?: number
}

export class BoredomTaskExecutor {
  private mode: BoredomMode

  constructor(config: BoredomExecutorConfig) {
    this.mode = config.mode || { type: 'cluster' }
    // ... existing initialization
  }

  /**
   * Start with mode detection
   */
  start(options?: { clusterMode?: boolean, localMode?: boolean }): void {
    if (this.isRunning) {
      console.log("[Boredom] Already running")
      return
    }

    if (!isMCPEnabled() && !options?.localMode) {
      console.log("[Boredom] MCP not enabled and local mode not specified, disabled")
      return
    }

    // NEW: Support local mode without cluster
    if (options?.localMode) {
      this.mode = {
        type: 'local',
        localQueuePath: '.minibob/boredom-queue.json',
        localPollInterval: 30000,
      }
      console.log("[Boredom] Starting in LOCAL mode")
    } else if (options?.clusterMode) {
      this.mode = { type: 'cluster' }
      console.log("[Boredom] Starting in CLUSTER mode")
    } else {
      console.log("[Boredom] No mode specified, disabled")
      return
    }

    this.isRunning = true
    this.loop().catch(this.handleLoopError)
  }

  private async fetchTasks(): Promise<BoredomTask[]> {
    if (this.mode.type === 'local') {
      return this.fetchLocalTasks()
    }
    return this.fetchClusterTasks()
  }

  private async fetchLocalTasks(): Promise<BoredomTask[]> {
    const queuePath = this.mode.localQueuePath || '.minibob/boredom-queue.json'

    try {
      const file = Bun.file(queuePath)
      if (!(await file.exists())) {
        return []
      }

      const content = await file.json()
      const tasks = (content.tasks || []) as BoredomTask[]

      // Filter out completed/assigned tasks
      return tasks.filter(t => !t.assignedTo && !t.completedAt)
    } catch (error) {
      console.warn("[Boredom] Local queue read failed:", error)
      return []
    }
  }

  /**
   * Add task to local queue (for development)
   */
  async addLocalTask(task: Omit<BoredomTask, 'id' | 'createdAt'>): Promise<string> {
    const queuePath = this.mode.localQueuePath || '.minibob/boredom-queue.json'
    const taskId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    let queue: { tasks: BoredomTask[] } = { tasks: [] }

    try {
      const file = Bun.file(queuePath)
      if (await file.exists()) {
        queue = await file.json()
      }
    } catch {}

    const fullTask: BoredomTask = {
      ...task,
      id: taskId,
      createdAt: Date.now(),
    }

    queue.tasks.push(fullTask)

    await Bun.write(queuePath, JSON.stringify(queue, null, 2))

    console.log(`[Boredom] Local task added: ${taskId}`)
    return taskId
  }
}
```

---

## 3. Flow Diagrams

### 3.1 Improvisation with Tracking

```
User Goal: "Fix auth bug in src/auth.ts"
     │
     ▼
┌─────────────────────────────────────┐
│  GoalImproviser.improvise()         │
│                                     │
│  impulses_available = [             │
│    { id: "file:src/auth.ts",        │
│      shape: "source_code" },        │
│    { id: "file:error.log",          │
│      shape: "error_log" }           │
│  ]                                  │
└───────────────┬─────────────────────┘
                │
     ┌──────────▼──────────┐
     │   Step 1: read      │
     │   file:error.log    │
     │                     │
     │   → track load:     │
     │     shape=error_log │
     │     usage=essential │
     └──────────┬──────────┘
                │
     ┌──────────▼──────────┐
     │   Step 2: read      │
     │   file:src/auth.ts  │
     │                     │
     │   → track load:     │
     │     shape=source_code
     │     usage=essential │
     └──────────┬──────────┘
                │
     ┌──────────▼──────────┐
     │   Step 3-4: analyze │
     │   (LLM reasoning)   │
     └──────────┬──────────┘
                │
     ┌──────────▼──────────┐
     │   Step 5: edit      │
     │   file:src/auth.ts  │
     │                     │
     │   → track create:   │
     │     shape=patch     │
     └──────────┬──────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  ImprovisationTrace                 │
│                                     │
│  impulses_loaded = [                │
│    { shape: "error_log",            │
│      usage: "essential" },          │
│    { shape: "source_code",          │
│      usage: "essential" }           │
│  ]                                  │
│                                     │
│  impulses_created = [               │
│    { shape: "patch" }               │
│  ]                                  │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  Ribosome Extraction                │
│                                     │
│  inputSchema = {                    │
│    required: [                      │
│      { shape: "error_log" },        │
│      { shape: "source_code" }       │
│    ]                                │
│  }                                  │
│                                     │
│  outputSchema = {                   │
│    produces: [                      │
│      { shape: "patch" }             │
│    ]                                │
│  }                                  │
└─────────────────────────────────────┘
```

### 3.2 Schema-Based Activity Matching

```
User submits goal with impulses:
     │
     │  impulses = [
     │    { shape: "error_log" },
     │    { shape: "source_code" }
     │  ]
     │
     ▼
┌─────────────────────────────────────┐
│  /v2/activities/recommend           │
│                                     │
│  1. Fetch all templates (N=50)      │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  2. Filter by inputSchema           │
│                                     │
│  Template A:                        │
│    inputSchema.required = [         │
│      { shape: "error_log" },        │
│      { shape: "source_code" }       │
│    ]                                │
│    ✓ MATCH (all required present)   │
│                                     │
│  Template B:                        │
│    inputSchema.required = [         │
│      { shape: "test_results" }      │
│    ]                                │
│    ✗ NO MATCH (test_results missing)│
│                                     │
│  Template C:                        │
│    inputSchema = undefined          │
│    ✓ MATCH (no requirements)        │
│                                     │
│  Remaining: N=25                    │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  3. Apply Thompson Sampling         │
│                                     │
│  Template A: α=12, β=2  → sample=0.85
│  Template C: α=5, β=8   → sample=0.41
│                                     │
│  Ranked: [A, C]                     │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  4. Return recommendations          │
│                                     │
│  [                                  │
│    { template_id: "A",              │
│      score: 0.85,                   │
│      input_schema: {...} },         │
│    { template_id: "C",              │
│      score: 0.41,                   │
│      input_schema: null }           │
│  ]                                  │
└─────────────────────────────────────┘
```

---

## 4. Testing Strategy

### 4.1 Unit Tests

**Impulse Tracking** (`repos/minibob/src/improviser.test.ts`):
```typescript
test('tracks file reads as impulse loads', async () => {
  const improviser = new GoalImproviser({ workingDirectory: '/tmp/test' })
  const trace = await improviser.improvise('Read and analyze file', {
    maxSteps: 5,
    saveTrace: false,
  })

  expect(trace.impulses_loaded).toContainEqual(
    expect.objectContaining({ shape: expect.any(String) })
  )
})

test('tracks file writes as impulse creates', async () => {
  const trace = await improviser.improvise('Create a new file', {
    maxSteps: 5,
    saveTrace: false,
  })

  expect(trace.impulses_created.length).toBeGreaterThan(0)
})
```

**Schema Extraction** (`repos/minibob/src/template-extractor.test.ts`):
```typescript
test('extracts inputSchema from loaded impulses', async () => {
  const trace: ImprovisationTrace = {
    // ... minimal trace with impulses_loaded
    impulses_loaded: [
      { impulse_id: 'f1', shape: 'error_log', usage: 'essential', ... },
      { impulse_id: 'f2', shape: 'source_code', usage: 'essential', ... },
    ],
  }

  const template = await extractTemplateFromImprovisation(trace)

  expect(template.inputSchema?.required).toContainEqual(
    expect.objectContaining({ shape: 'error_log' })
  )
  expect(template.inputSchema?.required).toContainEqual(
    expect.objectContaining({ shape: 'source_code' })
  )
})
```

**Schema Filtering** (`repos/metabob-activity-api/src/routes/activities.test.ts`):
```typescript
test('filters templates by inputSchema', async () => {
  const templates = [
    { id: 'a', inputSchema: { required: [{ shape: 'error_log' }] } },
    { id: 'b', inputSchema: { required: [{ shape: 'test_results' }] } },
    { id: 'c', inputSchema: undefined },
  ]

  const filtered = await filterByInputSchema(templates, ['error_log'])

  expect(filtered.map(t => t.id)).toEqual(['a', 'c'])
})
```

### 4.2 Integration Tests

**Full Loop Test**:
```typescript
test('self-development loop e2e', async () => {
  // 1. Submit goal that will improvise
  const result1 = await minibob.executeGoal('Fix the test bug', {
    impulses: [
      { shape: 'error_log', content: '...' },
      { shape: 'source_code', content: '...' },
    ],
  })

  expect(result1.improvised).toBe(true)

  // 2. Verify template was extracted with inputSchema
  const templates = await api.get('/v2/activities/templates')
  const extracted = templates.find(t => t.metadata?.sourceExecutionId === result1.executionId)

  expect(extracted?.inputSchema?.required).toContainEqual(
    expect.objectContaining({ shape: 'error_log' })
  )

  // 3. Submit similar goal - should match extracted template
  const result2 = await minibob.executeGoal('Fix another bug', {
    impulses: [
      { shape: 'error_log', content: '...' },
      { shape: 'source_code', content: '...' },
    ],
  })

  expect(result2.templateId).toBe(extracted.id)
})
```

---

## 5. Migration Strategy

### 5.1 Database Migration

```surql
-- Step 1: Add new fields (nullable, no breaking change)
DEFINE FIELD input_schema ON TABLE activity_template TYPE option<object>;
DEFINE FIELD output_schema ON TABLE activity_template TYPE option<object>;
DEFINE FIELD impulses_loaded ON TABLE activity_execution_traces TYPE option<array>;
DEFINE FIELD impulses_created ON TABLE activity_execution_traces TYPE option<array>;

-- Step 2: Create index for shape queries
DEFINE INDEX idx_activity_template_shapes ON TABLE activity_template
  COLUMNS input_schema.required[*].shape;
```

### 5.2 Backwards Compatibility

- Templates without `inputSchema` are treated as "accepts any input"
- Queries without `impulse_shapes` skip schema filtering
- Existing traces without `impulses_loaded` still work
- No breaking API changes - all new fields are optional

### 5.3 Gradual Rollout

1. **Week 1**: Deploy schema changes, no behavior change
2. **Week 2**: Enable impulse tracking in improviser
3. **Week 3**: Enable schema extraction in ribosome
4. **Week 4**: Enable schema-based filtering (opt-in via flag)
5. **Week 5**: Make schema filtering default

---

## 6. Configuration

### 6.1 Environment Variables

```bash
# Enable schema-based activity matching (default: false initially)
MINIBOB_SCHEMA_MATCHING_ENABLED=true

# Enable local boredom mode
MINIBOB_BOREDOM_MODE=local
MINIBOB_BOREDOM_QUEUE_PATH=.minibob/boredom-queue.json

# Impulse tracking verbosity
MINIBOB_IMPULSE_TRACKING_VERBOSE=false
```

### 6.2 Runtime Configuration

```typescript
// In minibob config
{
  features: {
    schemaMatchingEnabled: true,
    impulseTrackingEnabled: true,
  },
  boredom: {
    mode: 'local',
    localQueuePath: '.minibob/boredom-queue.json',
  },
}
```

---

## 7. Observability

### 7.1 Logging

```
[Improviser] Step 3: Loading impulse file:src/auth.ts (shape=source_code)
[Improviser] Step 5: Created impulse file:src/auth.ts.patch (shape=patch)
[Improviser] Trace complete: 2 impulses loaded, 1 impulse created

[Ribosome] Extracting template from trace exec_improv_123
[Ribosome] Inferred inputSchema: required=[error_log, source_code]
[Ribosome] Template extracted: tpl_abc123 (confidence=0.75)

[Activities] Schema filtering: 50 candidates -> 12 matching shapes [error_log, source_code]
[Activities] Thompson sampling: tpl_abc123 selected (score=0.87)
```

### 7.2 Metrics

```typescript
// New metrics to expose
minibob_improvisation_impulses_loaded_total
minibob_improvisation_impulses_created_total
minibob_template_extraction_confidence_histogram
minibob_schema_filtering_reduction_ratio
```

---

## 8. Future Extensions

### 8.1 Shape Inference Improvements

- Use LLM to infer shapes from content when not obvious
- Learn shape vocabulary from usage patterns
- Support hierarchical shapes (e.g., `source_code.typescript`)

### 8.2 Output Shape Prediction

- Predict what shapes an activity will produce before execution
- Enable activity composition planning

### 8.3 Schema Evolution

- Track schema changes over template versions
- Alert on breaking schema changes
- Auto-migrate dependent activities
