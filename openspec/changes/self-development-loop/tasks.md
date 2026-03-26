# Self-Development Loop - Tasks

> **Status**: Ready for implementation
> **Estimated Total Effort**: 5-7 days

---

## Dependency Graph

```
M1: Impulse Tracking
     │
     ├──────────────────┐
     │                  │
     ▼                  ▼
M2: Schema Extraction   M4: Local Boredom
     │
     ▼
M3: Schema Matching
     │
     ▼
M5: Development Templates
     │
     ▼
M6: Integration Testing
```

**Critical path**: M1 -> M2 -> M3 -> M6
**Parallel work**: M4 can proceed after M1, M5 can start anytime

---

## Milestone 1: Impulse Tracking in Improviser

**Goal**: Record which impulses are loaded and created during improvisation.

**Repository**: `repos/minibob`

**Effort**: 1 day

### Tasks

#### M1.1: Add impulse tracking types
**File**: `src/types.ts`

- [ ] Add `ImpulseLoadEvent` interface
- [ ] Add `ImpulseCreateEvent` interface
- [ ] Add `ImpulseReference` interface
- [ ] Extend `ImprovisationTrace` with new fields:
  - `impulses_available: ImpulseReference[]`
  - `impulses_loaded: ImpulseLoadEvent[]`
  - `impulses_created: ImpulseCreateEvent[]`

**Acceptance Criteria**:
```typescript
// Types compile without errors
const event: ImpulseLoadEvent = {
  impulse_id: 'file:src/foo.ts',
  shape: 'source_code',
  loaded_at_step: 1,
  loaded_at_timestamp: '2026-03-26T10:00:00Z',
  tokens_used: 500,
  usage: 'essential',
}
```

#### M1.2: Add shape inference utilities
**File**: `src/improviser.ts`

- [ ] Add `inferShape(impulse: Impulse): string` method
- [ ] Add `inferShapeFromPath(path: string): string` method
- [ ] Add canonical shape mappings:
  - `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rs` -> `source_code`
  - `.log`, `error*` -> `error_log`
  - `*.test.*`, `*.spec.*` -> `test_file`
  - `.json` -> `json_data`
  - Default -> `file_content`

**Acceptance Criteria**:
```typescript
expect(inferShapeFromPath('src/auth.ts')).toBe('source_code')
expect(inferShapeFromPath('error.log')).toBe('error_log')
expect(inferShapeFromPath('foo.test.ts')).toBe('test_file')
```

#### M1.3: Track impulse loads during execution
**File**: `src/improviser.ts`

- [ ] Add `loadedImpulses: Map<string, ImpulseLoadEvent>` to GoalImproviser
- [ ] Create `recordImpulseLoad(event: ImpulseLoadEvent)` method
- [ ] Intercept tool calls to detect file reads:
  - `read` tool -> record as load
  - `glob` tool -> record each matched file as potential load
  - `grep` tool -> record searched file as load
- [ ] Assign `usage: 'essential'` to impulses loaded before LLM decision

**Acceptance Criteria**:
```typescript
const trace = await improviser.improvise('Read src/foo.ts and analyze it')
expect(trace.impulses_loaded).toContainEqual(
  expect.objectContaining({
    impulse_id: expect.stringContaining('src/foo.ts'),
    shape: 'source_code',
    usage: 'essential',
  })
)
```

#### M1.4: Track impulse creates during execution
**File**: `src/improviser.ts`

- [ ] Add `createdImpulses: ImpulseCreateEvent[]` to GoalImproviser
- [ ] Create `recordImpulseCreate(event: ImpulseCreateEvent)` method
- [ ] Intercept tool calls to detect file writes:
  - `write` tool -> record as create
  - `edit` tool -> record as create (modified file)
- [ ] Include pointer information in created impulse

**Acceptance Criteria**:
```typescript
const trace = await improviser.improvise('Create a new config file')
expect(trace.impulses_created).toContainEqual(
  expect.objectContaining({
    shape: expect.any(String),
    pointer: expect.objectContaining({ type: 'file' }),
  })
)
```

#### M1.5: Include impulse data in saved traces
**File**: `src/improviser.ts`

- [ ] Update `saveTrace()` to include new fields
- [ ] Ensure ActivityExecution format includes impulse arrays
- [ ] Add impulse data to MCP trace storage call

**Acceptance Criteria**:
```bash
# After improvisation, query backend
curl http://api.minibob.local/v2/activities/execution-traces/exec_improv_123 | jq '.impulses_loaded'
# Returns non-empty array
```

---

## Milestone 2: InputSchema Extraction

**Goal**: Extract inputSchema and outputSchema from improvisation traces.

**Repository**: `repos/minibob` (primary), `repos/metabob-activity-api` (secondary)

**Effort**: 1.5 days

### Tasks

#### M2.1: Add schema types to ActivityTemplate
**File**: `repos/minibob/src/types.ts`

- [ ] Add `ImpulseShape` interface
- [ ] Add `inputSchema` field to `ActivityTemplate`:
  ```typescript
  inputSchema?: {
    required: ImpulseShape[]
    optional?: ImpulseShape[]
  }
  ```
- [ ] Add `outputSchema` field to `ActivityTemplate`:
  ```typescript
  outputSchema?: {
    produces: ImpulseShape[]
  }
  ```

**Acceptance Criteria**:
```typescript
const template: ActivityTemplate = {
  // existing fields...
  inputSchema: {
    required: [{ shape: 'error_log' }],
    optional: [{ shape: 'previous_attempts' }],
  },
  outputSchema: {
    produces: [{ shape: 'patch' }],
  },
}
// Compiles without error
```

#### M2.2: Implement inputSchema extraction
**File**: `repos/minibob/src/template-extractor.ts`

- [ ] Add `extractInputSchema(trace: ImprovisationTrace)` function
- [ ] Group loaded impulses by shape
- [ ] Mark shapes with `usage: 'essential'` as required
- [ ] Mark shapes with other usage as optional
- [ ] Call from `extractTemplateFromImprovisation()`

**Acceptance Criteria**:
```typescript
const trace = {
  impulses_loaded: [
    { shape: 'error_log', usage: 'essential' },
    { shape: 'source_code', usage: 'essential' },
    { shape: 'docs', usage: 'incidental' },
  ],
}
const schema = extractInputSchema(trace)
expect(schema.required.map(s => s.shape)).toEqual(['error_log', 'source_code'])
expect(schema.optional?.map(s => s.shape)).toEqual(['docs'])
```

#### M2.3: Implement outputSchema extraction
**File**: `repos/minibob/src/template-extractor.ts`

- [ ] Add `extractOutputSchema(trace: ImprovisationTrace)` function
- [ ] Collect unique shapes from created impulses
- [ ] Call from `extractTemplateFromImprovisation()`

**Acceptance Criteria**:
```typescript
const trace = {
  impulses_created: [
    { shape: 'patch' },
    { shape: 'test_file' },
  ],
}
const schema = extractOutputSchema(trace)
expect(schema.produces.map(s => s.shape)).toEqual(['patch', 'test_file'])
```

#### M2.4: Add schema confidence scoring
**File**: `repos/minibob/src/template-extractor.ts`

- [ ] Add `calculateSchemaConfidence(trace)` function
- [ ] Base confidence on:
  - Number of impulses loaded (more = higher)
  - Ratio of essential to incidental usage (higher essential = higher)
  - Execution success (success = +0.1)
- [ ] Store confidence in template metadata

**Acceptance Criteria**:
```typescript
const template = await extractTemplateFromImprovisation(successfulTrace)
expect(template.metadata.inputSchemaInferredFrom.confidence).toBeGreaterThan(0.5)
```

#### M2.5: Update backend ribosome with schema extraction
**File**: `repos/metabob-activity-api/src/routes/ribosome.ts`

- [ ] Add `input_schema` and `output_schema` to ExtractedTemplate type
- [ ] Update `extractTemplateFromTraces()` to infer schemas from trace impulse data
- [ ] Store schemas when inserting extracted template

**Acceptance Criteria**:
```bash
curl -X POST http://api.minibob.local/v2/ribosome/extract \
  -d '{"execution_ids": ["exec_123"]}' | jq '.template.input_schema'
# Returns schema object
```

---

## Milestone 3: Schema-Based Activity Matching

**Goal**: Filter activity recommendations by input schema compatibility.

**Repository**: `repos/metabob-activity-api` (primary), `repos/minibob` (secondary)

**Effort**: 1.5 days

### Tasks

#### M3.1: Add database schema fields
**File**: `repos/metabob-proto/surrealdb/core/` (new migration file)

- [ ] Create migration file `006-activity-schema-fields.surql`
- [ ] Add `input_schema OBJECT` field to `activity_template`
- [ ] Add `output_schema OBJECT` field to `activity_template`
- [ ] Create index on `input_schema.required[*].shape`

**Acceptance Criteria**:
```bash
# After migration
surql "INFO FOR TABLE activity_template" | grep input_schema
# Shows field definition
```

#### M3.2: Update backend schema types
**File**: `repos/metabob-activity-api/src/models/schemas.ts`

- [ ] Add `InputSchema` and `OutputSchema` Zod types
- [ ] Add `ImpulseShape` Zod type
- [ ] Update `ActivityTemplate` interface with new fields
- [ ] Update `CreateTemplateRequestSchema` to accept schemas

**Acceptance Criteria**:
```typescript
const validated = CreateTemplateRequestSchema.parse({
  variant_id: 'test',
  // other required fields...
  input_schema: {
    required: [{ shape: 'error_log' }],
  },
})
// No validation error
```

#### M3.3: Implement schema filtering function
**File**: `repos/metabob-activity-api/src/routes/activities.ts`

- [ ] Add `filterByInputSchema(templates, providedShapes)` function
- [ ] Filter logic: template matches if ALL required shapes are in providedShapes
- [ ] Templates without inputSchema match anything (backwards compatible)

**Acceptance Criteria**:
```typescript
const templates = [
  { id: 'a', input_schema: { required: [{ shape: 'error_log' }] } },
  { id: 'b', input_schema: { required: [{ shape: 'test_results' }] } },
  { id: 'c' }, // no schema
]
const filtered = filterByInputSchema(templates, ['error_log', 'source_code'])
expect(filtered.map(t => t.id)).toEqual(['a', 'c'])
```

#### M3.4: Update /recommend endpoint with schema filtering
**File**: `repos/metabob-activity-api/src/routes/activities.ts`

- [ ] Accept `impulse_shapes` in request body
- [ ] Call `filterByInputSchema()` before Thompson Sampling
- [ ] Log filtering reduction for observability

**Acceptance Criteria**:
```bash
curl -X POST http://api.minibob.local/v2/activities/recommend \
  -d '{
    "goal": "Fix bug",
    "impulse_shapes": ["error_log", "source_code"],
    "limit": 3
  }' | jq '.recommendations | length'
# Returns recommendations (may be 0 if no matches)
```

#### M3.5: Update minibob to pass impulse shapes
**File**: `repos/minibob/src/goal-processor.ts`

- [ ] Extract shapes from provided impulses
- [ ] Pass shapes to `mcpClient.recommendActivities()`
- [ ] Add `impulse_shapes` parameter to MCP client method

**Acceptance Criteria**:
```typescript
const result = await goalProcessor.executeGoal('Fix bug', {
  impulses: [
    { shape: 'error_log', ... },
    { shape: 'source_code', ... },
  ],
})
// Backend receives impulse_shapes in recommendation request
```

---

## Milestone 4: Local Boredom Mode

**Goal**: Enable boredom task execution in local development without cluster.

**Repository**: `repos/minibob`

**Effort**: 0.5 days

### Tasks

#### M4.1: Add boredom mode configuration
**File**: `src/boredom.ts`

- [ ] Add `BoredomMode` type: `'cluster' | 'local'`
- [ ] Update `BoredomExecutorConfig` with mode options
- [ ] Add `localQueuePath` configuration option

**Acceptance Criteria**:
```typescript
const executor = new BoredomTaskExecutor({
  mode: 'local',
  localQueuePath: '.minibob/boredom-queue.json',
  // other config...
})
```

#### M4.2: Implement local queue file handling
**File**: `src/boredom.ts`

- [ ] Add `fetchLocalTasks()` method
- [ ] Read tasks from JSON file
- [ ] Filter out completed/assigned tasks
- [ ] Add `addLocalTask()` method for adding tasks

**Acceptance Criteria**:
```typescript
await executor.addLocalTask({
  goal: 'Improve template X',
  priority: 'medium',
  variables: {},
})
// File .minibob/boredom-queue.json contains task
```

#### M4.3: Update start() to support local mode
**File**: `src/boredom.ts`

- [ ] Accept `localMode` option in `start()`
- [ ] Skip cluster mode check when local mode enabled
- [ ] Use appropriate fetch method based on mode

**Acceptance Criteria**:
```typescript
executor.start({ localMode: true })
// Boredom starts without MCP/cluster requirement
```

#### M4.4: Add CLI command for local boredom
**File**: `index.ts` or `src/cli/`

- [ ] Add `minibob boredom add <goal>` command
- [ ] Add `minibob boredom list` command
- [ ] Add `minibob boredom start --local` flag

**Acceptance Criteria**:
```bash
minibob boredom add "Optimize the test template"
minibob boredom list
# Shows added task
minibob boredom start --local
# Starts local boredom loop
```

---

## Milestone 5: Development Activity Templates

**Goal**: Create seed templates that enable minibob self-development.

**Repository**: `repos/minibob` (templates directory)

**Effort**: 1 day

### Tasks

#### M5.1: Create debug-failing-activity template
**File**: `templates/development/debug-failing-activity.json`

- [ ] Define template with:
  - inputSchema: `execution_trace`, `activity_template`
  - Tasks: analyze trace, identify failure point, suggest fix
  - Validation: produces analysis output
- [ ] Test with synthetic failing trace

**Acceptance Criteria**:
```json
{
  "id": "debug-failing-activity",
  "inputSchema": {
    "required": [
      { "shape": "execution_trace" },
      { "shape": "activity_template" }
    ]
  }
}
```

#### M5.2: Create improve-activity-prompt template
**File**: `templates/development/improve-activity-prompt.json`

- [ ] Define template with:
  - inputSchema: `activity_template`, `failure_patterns`
  - Tasks: analyze failure patterns, identify prompt issues, generate improved prompt
  - Validation: produces new prompt text
- [ ] Test with template that has poor success rate

**Acceptance Criteria**:
```bash
minibob run templates/development/improve-activity-prompt.json \
  --var templateId=failing-template-123
# Produces improved prompt suggestion
```

#### M5.3: Create extract-pattern-from-traces template
**File**: `templates/development/extract-pattern-from-traces.json`

- [ ] Define template with:
  - inputSchema: `execution_traces` (collection)
  - Tasks: analyze traces, identify patterns, document learnings
  - Validation: produces pattern document
- [ ] Test with batch of execution traces

**Acceptance Criteria**:
```bash
minibob run templates/development/extract-pattern-from-traces.json \
  --var traceIds='["exec_1", "exec_2", "exec_3"]'
# Produces pattern analysis
```

#### M5.4: Create fix-type-errors template
**File**: `templates/development/fix-type-errors.json`

- [ ] Define template with:
  - inputSchema: `source_code`, `type_error_output`
  - Tasks: parse errors, locate issues, apply fixes
  - Validation: typecheck passes
- [ ] Test on file with type errors

**Acceptance Criteria**:
```bash
# Before: bun run typecheck shows errors
minibob run templates/development/fix-type-errors.json \
  --var targetFile=src/broken.ts
# After: bun run typecheck passes
```

#### M5.5: Register development templates in backend
**Task**: Ensure templates are available via API

- [ ] Add script to register templates: `scripts/register-dev-templates.sh`
- [ ] Include templates in Helm deployment init
- [ ] Verify templates appear in `/v2/activities/templates`

**Acceptance Criteria**:
```bash
curl http://api.minibob.local/v2/activities/templates?category=tool | jq '.[].id'
# Shows development templates
```

---

## Milestone 6: Integration Testing

**Goal**: Verify the complete self-development loop works end-to-end.

**Repository**: Cross-repository

**Effort**: 1 day

### Tasks

#### M6.1: Create integration test harness
**File**: `tests/integration/self-development-loop.test.ts`

- [ ] Setup test environment with local backend
- [ ] Create test fixtures (sample code, errors)
- [ ] Implement test utilities for trace inspection

**Acceptance Criteria**:
```typescript
describe('self-development-loop', () => {
  beforeAll(async () => {
    await setupTestBackend()
  })
  // tests...
})
```

#### M6.2: Test improvisation with impulse tracking
**Test case**:

- [ ] Submit goal with specific impulses
- [ ] Verify improvisation records `impulses_loaded`
- [ ] Verify improvisation records `impulses_created`
- [ ] Verify trace is stored in backend with impulse data

**Acceptance Criteria**:
```typescript
test('improvisation tracks impulses', async () => {
  const result = await minibob.executeGoal('Fix the bug', {
    impulses: [testImpulse],
  })
  const trace = await api.getTrace(result.executionId)
  expect(trace.impulses_loaded.length).toBeGreaterThan(0)
})
```

#### M6.3: Test ribosome extraction with schema
**Test case**:

- [ ] Submit goal that triggers improvisation
- [ ] Wait for ribosome extraction
- [ ] Verify extracted template has `inputSchema`
- [ ] Verify `inputSchema.required` matches loaded impulse shapes

**Acceptance Criteria**:
```typescript
test('ribosome extracts inputSchema', async () => {
  const improvResult = await minibob.improvise(testGoal)
  const template = await api.getTemplateBySourceExecution(improvResult.executionId)
  expect(template.inputSchema?.required).toContainEqual(
    expect.objectContaining({ shape: 'source_code' })
  )
})
```

#### M6.4: Test schema-based activity matching
**Test case**:

- [ ] Create template with specific inputSchema
- [ ] Request recommendations with matching shapes
- [ ] Verify template is in recommendations
- [ ] Request recommendations with non-matching shapes
- [ ] Verify template is NOT in recommendations

**Acceptance Criteria**:
```typescript
test('schema filtering works', async () => {
  // Create template requiring 'error_log'
  await api.createTemplate({
    id: 'test-template',
    inputSchema: { required: [{ shape: 'error_log' }] },
  })

  // Should match
  const recs1 = await api.recommend({ impulse_shapes: ['error_log'] })
  expect(recs1.map(r => r.template_id)).toContain('test-template')

  // Should not match
  const recs2 = await api.recommend({ impulse_shapes: ['test_results'] })
  expect(recs2.map(r => r.template_id)).not.toContain('test-template')
})
```

#### M6.5: Test full loop: improvise -> extract -> match -> sample
**Test case**:

- [ ] Submit novel goal (no matching activity)
- [ ] Verify improvisation happens
- [ ] Verify template extracted with schema
- [ ] Submit similar goal
- [ ] Verify new template is in candidates
- [ ] Verify Thompson Sampling considers new template

**Acceptance Criteria**:
```typescript
test('full self-development loop', async () => {
  // Novel goal - will improvise
  const result1 = await minibob.executeGoal('Fix auth bug in auth.ts', {
    impulses: [errorLog, authSource],
  })
  expect(result1.improvised).toBe(true)

  // Get extracted template
  const templates = await api.listTemplates()
  const extracted = templates.find(t =>
    t.metadata?.sourceExecutionId === result1.executionId
  )
  expect(extracted?.inputSchema?.required).toBeDefined()

  // Similar goal - should find extracted template
  const recs = await api.recommend({
    goal: 'Fix another auth issue',
    impulse_shapes: ['error_log', 'source_code'],
  })
  expect(recs.map(r => r.template_id)).toContain(extracted.id)
})
```

#### M6.6: Test local boredom mode
**Test case**:

- [ ] Add task to local queue
- [ ] Start boredom in local mode
- [ ] Verify task is picked up and executed
- [ ] Verify task is marked complete in queue

**Acceptance Criteria**:
```typescript
test('local boredom executes tasks', async () => {
  await executor.addLocalTask({
    goal: 'Test task',
    priority: 'high',
    variables: {},
  })

  executor.start({ localMode: true })
  await waitForExecution()

  const queue = await readLocalQueue()
  expect(queue.tasks[0].completedAt).toBeDefined()
})
```

---

## Summary Table

| Milestone | Tasks | Effort | Dependencies |
|-----------|-------|--------|--------------|
| M1: Impulse Tracking | 5 | 1 day | None |
| M2: Schema Extraction | 5 | 1.5 days | M1 |
| M3: Schema Matching | 5 | 1.5 days | M2 |
| M4: Local Boredom | 4 | 0.5 days | M1 |
| M5: Dev Templates | 5 | 1 day | M2, M3 |
| M6: Integration Testing | 6 | 1 day | All |

**Total Tasks**: 30
**Total Effort**: 6.5 days

---

## Definition of Done

The self-development loop is complete when:

1. **Impulse tracking**: Every improvisation trace includes `impulses_loaded` and `impulses_created` arrays
2. **Schema extraction**: Every ribosome-extracted template has `inputSchema` with at least one required shape
3. **Schema matching**: `/v2/activities/recommend` with `impulse_shapes` returns only compatible templates
4. **Local boredom**: `minibob boredom start --local` executes tasks from local queue
5. **Development templates**: At least 3 development templates registered with inputSchema
6. **Full loop verified**: Integration test proves improvise -> extract -> match -> sample works

---

## Post-Implementation Checklist

After all milestones complete:

- [ ] Update CLAUDE.md with new capabilities
- [ ] Update DEPLOYMENT_GUIDE.md with migration steps
- [ ] Create PR for each repository
- [ ] Run full integration test suite
- [ ] Deploy to staging environment
- [ ] Monitor first 24h of production deployment
- [ ] Archive this OpenSpec change
