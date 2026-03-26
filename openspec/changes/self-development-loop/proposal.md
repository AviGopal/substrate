# Self-Development Loop

> **Status**: Ready for Implementation
> **Scope**: minibob + metabob-activity-api
> **Goal**: Enable minibob to develop itself through the activity system
> **Implementation**: Use `/minibob` skill to implement - MiniBob develops itself

---

## Why

The system's core promise is self-improvement through measured activity execution. When minibob encounters a problem it cannot solve with existing activities, it should:

1. Improvise a solution with full recording
2. Extract a reusable template if successful
3. Add that template to the candidate pool
4. Let Thompson Sampling determine if the new template outperforms alternatives

This loop is the "process-of-becoming" made concrete: the system grows its own capabilities by observing what works.

### Current State

Several pieces are working:
- **Thompson Sampling**: Backend selects activities probabilistically based on success rates
- **Trace recording**: Executions are captured and stored
- **Ribosome (backend)**: Can extract templates from execution traces mechanically
- **Improvisation**: GoalImproviser can solve goals without templates

### What's Broken

The loop is incomplete because:

1. **Improvisation doesn't track impulses**: When improvising, we don't record which impulses were loaded and used. The ribosome cannot infer what inputs the extracted template needs.

2. **Ribosome doesn't extract inputSchema**: Even with perfect traces, the extracted templates have no `inputSchema`. They cannot be matched to future goals based on input shapes.

3. **No schema-based activity matching**: Activities are selected by keyword matching and Thompson scores. There's no filtering by "does this activity accept the impulses I have?"

4. **Boredom requires cluster mode**: Local development cannot trigger autonomous improvement because boredom is locked to 3+ pod deployments.

### The Missing Link

The gap between "improvisation succeeded" and "new template available for similar problems" is:

```
improvisation trace (has steps, no input shapes)
      |
      v
ribosome extraction (creates template)
      |
      v
template (missing inputSchema)
      |
      v
activity search (cannot match by shape)
      |
      X  --- template never selected for similar inputs
```

---

## What Changes

### 1. Fix Improvisation Impulse Tracking (minibob)

**Current**: `GoalImproviser.improvise()` executes goals but doesn't track which impulses were loaded.

**Change**: Track impulse loads during improvisation and store in trace:

```typescript
// Before
const trace: ImprovisationTrace = {
  execution_id: "...",
  goal: "...",
  steps: [...],
  // No impulse information
}

// After
const trace: ImprovisationTrace = {
  execution_id: "...",
  goal: "...",
  steps: [...],
  impulses_loaded: [
    { id: "imp-1", type: "file", shape: "source_code", loaded_at: "step-2" },
    { id: "imp-2", type: "file", shape: "error_log", loaded_at: "step-1" },
  ],
  impulses_created: [
    { id: "imp-3", type: "file", shape: "patch", created_at: "step-5" },
  ],
}
```

**Files affected**: `repos/minibob/src/improviser.ts`

### 2. Fix Ribosome inputSchema Extraction (minibob + backend)

**Current**: `extractTemplateFromImprovisation()` creates templates without inputSchema.

**Change**: Infer inputSchema from the impulses that were loaded during execution:

```typescript
// Before
const template: ActivityTemplate = {
  id: "...",
  tasks: [...],
  // No inputSchema
}

// After
const template: ActivityTemplate = {
  id: "...",
  tasks: [...],
  inputSchema: {
    required: [
      { shape: "source_code", description: "File containing the bug" },
      { shape: "error_log", description: "Error output or stack trace" },
    ],
    optional: [
      { shape: "previous_fix_attempts", description: "Prior failed fixes" },
    ],
  },
  outputSchema: {
    produces: [
      { shape: "patch", description: "Code diff fixing the issue" },
    ],
  },
}
```

**Files affected**:
- `repos/minibob/src/template-extractor.ts` (client-side extraction)
- `repos/metabob-activity-api/src/routes/ribosome.ts` (backend extraction)

### 3. Add Schema-Based Activity Matching (minibob + backend)

**Current**: `recommendActivities()` selects by category and Thompson scores only.

**Change**: Pre-filter activities by matching input impulse shapes before applying Thompson Sampling:

```typescript
// Query flow
1. Vessel submits goal with impulses: [{ shape: "error_log" }, { shape: "source_code" }]
2. Backend filters: SELECT * FROM activity_template
     WHERE inputSchema.required IS SUBSET OF provided_shapes
3. Backend applies Thompson Sampling to filtered candidates
4. Vessel receives ranked recommendations that CAN accept its inputs
```

**Files affected**:
- `repos/minibob/src/types.ts` (add inputSchema/outputSchema to ActivityTemplate)
- `repos/minibob/src/goal-processor.ts` (pass impulse shapes to recommendations)
- `repos/metabob-activity-api/src/routes/activities.ts` (schema-based filtering)
- `repos/metabob-activity-api/src/models/schemas.ts` (schema types)

### 4. Unlock Boredom for Local Mode (minibob)

**Current**: `boredomExecutor.start(clusterMode)` requires `clusterMode=true` which only happens with 3+ pods.

**Change**: Add local boredom mode that uses a local queue file instead of backend polling:

```typescript
// New option
boredomExecutor.start({
  mode: 'local',  // or 'cluster'
  localQueuePath: '.minibob/boredom-queue.json',
})
```

**Files affected**: `repos/minibob/src/boredom.ts`

### 5. Create Initial Development Activities (templates)

Seed templates that bootstrap the self-development loop:

| Template | Purpose | inputSchema |
|----------|---------|-------------|
| `debug-failing-activity` | Diagnose why an activity variant fails | `execution_trace`, `activity_template` |
| `improve-activity-prompt` | Refine task prompts based on failure patterns | `activity_template`, `failure_patterns` |
| `extract-pattern-from-traces` | Identify recurring patterns across traces | `execution_traces[]` |

**Files affected**: `templates/development/*.json`

---

## Capabilities Enabled

With these changes complete:

### Automatic Capability Growth

1. User submits: "Fix the auth bug in src/auth.ts"
2. No matching activity (inputSchema doesn't match)
3. Improvisation runs with impulse tracking
4. Success: Ribosome extracts template with inputSchema
5. Next similar bug: New template is candidate
6. Thompson Sampling picks winner over time

### Self-Debugging

When an activity fails repeatedly:
1. Backend identifies low success rate
2. Creates boredom task: "Debug activity X"
3. Minibob improvises debugging approach
4. Extracts `debug-activity-X-v2` template
5. Future debugging benefits from learned approach

### Local Development Loop

Developers can run minibob locally with boredom enabled:
1. Work on a feature
2. Go idle (5 min)
3. Minibob picks up local boredom task
4. Improves its own templates
5. Commit improved templates

---

## Impact

### Code Changes

| Repository | Files | LOC Estimate |
|------------|-------|--------------|
| minibob | `improviser.ts` | +100 |
| minibob | `template-extractor.ts` | +80 |
| minibob | `types.ts` | +40 |
| minibob | `goal-processor.ts` | +50 |
| minibob | `boredom.ts` | +60 |
| metabob-activity-api | `activities.ts` | +150 |
| metabob-activity-api | `ribosome.ts` | +100 |
| metabob-activity-api | `schemas.ts` | +30 |
| templates | `development/*.json` | +300 |

**Total**: ~910 LOC

### Database Changes

```sql
-- activity_template table
ALTER TABLE activity_template ADD input_schema OBJECT;
ALTER TABLE activity_template ADD output_schema OBJECT;

-- activity_execution_traces table (already exists, add fields)
ALTER TABLE activity_execution_traces ADD impulses_loaded ARRAY;
ALTER TABLE activity_execution_traces ADD impulses_created ARRAY;
```

### API Changes

**New query parameter** for `/v2/activities/recommend`:
```
POST /v2/activities/recommend
{
  "goal": "Fix the auth bug",
  "category": "bugfix",
  "impulse_shapes": ["error_log", "source_code"],  // NEW
  "limit": 3
}
```

**New response field** for templates:
```json
{
  "template_id": "debug-null-pointer",
  "input_schema": {
    "required": [{"shape": "error_log"}, {"shape": "source_code"}]
  },
  "output_schema": {
    "produces": [{"shape": "patch"}]
  }
}
```

---

## Success Criteria

The change is complete when this scenario works end-to-end:

1. **Submit novel goal**: `minibob goal "Fix the performance regression in cache.ts"`
2. **No match**: No activity has inputSchema matching (file + error_log + metrics)
3. **Improvise**: Minibob improvises with impulse tracking
4. **Extract**: Successful improvisation triggers ribosome extraction
5. **Store**: New template `fix-perf-regression-v1` stored with inputSchema
6. **Verify**: Query `/v2/activities/templates` shows new template with inputSchema
7. **Match**: Submit similar goal, new template appears in recommendations
8. **Sample**: Both original generic template and new specific template are sampled
9. **Converge**: After 10+ executions, better template has higher Thompson score

### Quantitative Metrics

- 100% of improvisation traces include `impulses_loaded`
- 100% of ribosome-extracted templates have `inputSchema`
- Schema-based filtering reduces recommendation set by >30%
- Local boredom mode functional without cluster

---

## Risks

### Technical Risks

1. **Impulse tracking overhead**: Recording every impulse load adds latency
   - Mitigation: Async logging, batch writes

2. **Schema inference accuracy**: Inferred inputSchema may be too specific or too general
   - Mitigation: Conservative defaults, human review option

3. **Backwards compatibility**: Existing templates lack inputSchema
   - Mitigation: Treat missing inputSchema as "accepts any", gradual migration

### Process Risks

1. **Scope creep**: Each piece reveals more needed changes
   - Mitigation: Strict milestone boundaries

2. **Testing complexity**: Full loop requires deployed backend
   - Mitigation: Unit tests for each component, integration test at end

---

## Out of Scope

The following are explicitly NOT part of this change:

- Dashboard visualization of inputSchema
- MCP integration changes
- Multi-tenant schema isolation
- Activity version control / rollback
- Human-in-the-loop approval for extracted templates

These can be addressed in follow-up changes.

---

## References

- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Canonical architecture
- `openspec/changes/foundation-alignment/proposal.md` - Broader roadmap
- `repos/minibob/src/improviser.ts` - Current improvisation implementation
- `repos/minibob/src/template-extractor.ts` - Current extraction implementation
- `repos/metabob-activity-api/src/routes/ribosome.ts` - Backend ribosome
