# Bootstrap Learning Loop: From Agentic to Algorithmic

> **Purpose**: This document defines how MiniBob progressively refines agentic workflows into algorithmic ones through improvisation, failure recovery, and change search.

## Overview

The bootstrap learning loop enables MiniBob to:
1. Start with minimal knowledge (few/zero templates)
2. Improvise solutions using LLM inference
3. Extract patterns from successful improvisations
4. Retry failed improvisations with modifications
5. Build up a library of validated, reusable templates
6. Progressively shift from expensive LLM calls to cheap template execution

**Current State**: 70% implemented - infrastructure exists but feedback loop is incomplete

**Missing Pieces**: Retry logic, execution feedback, variant creation, change search, composition tracking

---

## The Complete Loop

```
User Goal
  ↓
[1] Search for Changes
  ├─ Query similar execution traces (by state/changes)
  ├─ Search goal paths (Thompson Sampling for sequences)
  └─ Find semantic goal matches (embeddings)
  ↓
[2] Activity Recommendation (Thompson Sampling)
  ├─ Shape-conditioned filtering
  ├─ Failure penalty application
  └─ Variant-aware selection
  ↓
[3a] Execute Recommended Activity (if confidence > threshold)
  ├─ Load impulses
  ├─ Execute tasks
  ├─ Validate outputs
  └─ → [Record Feedback] → Update Thompson Sampling
  ↓
[3b] Improvisation (if no confident recommendation)
  ├─ LLM + tools in agentic loop
  ├─ Track shapes, impulses, tool calls
  ├─ Create execution trace
  └─ Determine outcome (success/failure/stuck)
  ↓
[4] Template Extraction
  ├─ SUCCESS → Extract reusable template
  ├─ FAILURE → Extract attempt template + analyze
  └─ Register both with backend (Thompson Sampling α=1, β=1)
  ↓
[5] Variant Creation (from failures)
  ├─ Clone attempt template
  ├─ Apply suggested fixes (add impulses, modify prompts)
  ├─ Mark as variant with lineage tracking
  └─ Register variant (gets its own Thompson scores)
  ↓
[6] Retry Attempt Template
  ├─ Execute variant with modified inputs
  ├─ Validate against expected outputs
  ├─ → Success: Template promoted, variant score increases
  └─ → Failure: New variant created, original score decreases
  ↓
[7] Record Everything
  ├─ Execution feedback (success/failure/cost/duration)
  ├─ Impulse relevance (which impulses were used?)
  ├─ Composition (which activities called which?)
  ├─ Tool usage patterns
  └─ All data flows back to Thompson Sampling
  ↓
[Back to 1] Next Goal (with improved templates)
```

---

## Gap 1: Retry Logic for Attempt Templates

### Current State
- Attempt templates extracted from failed improvisations (✅)
- Stored in backend with failure metadata (✅)
- **NEVER RETRIED** ❌

### What's Needed

**File**: `repos/minibob/src/goal-processor.ts`

Add `retryAttemptTemplate()` method:

```typescript
/**
 * Retry an attempt template with suggested fixes applied
 */
private async retryAttemptTemplate(
  attemptTemplate: ActivityTemplate,
  failureAnalysis: ImprovisationFailureAnalysis,
  goal: Goal
): Promise<ActivityExecution> {
  log.info(`[Retry] Attempting retry of ${attemptTemplate.id} with fixes`)

  // 1. Apply suggested fixes from failure analysis
  const variant = await this.createVariantFromAttempt(
    attemptTemplate,
    failureAnalysis
  )

  // 2. Add missing impulses identified in failure analysis
  const additionalImpulses = await this.resolveMissingImpulses(
    failureAnalysis.suggestedFixes
  )

  // 3. Execute variant with enhanced context
  const executor = new ActivityExecutor({
    template: variant,
    variables: goal.variables || {},
    impulses: [...goal.impulses, ...additionalImpulses]
  })

  const execution = await executor.execute()

  // 4. Record execution feedback (Gap 2)
  await this.recordExecutionFeedback(variant.id, execution)

  // 5. If success, mark original attempt as "solved by variant"
  if (execution.status === 'completed') {
    await this.recordVariantResolution(attemptTemplate.id, variant.id)
  }

  return execution
}
```

**Integration Point**: Call after `extractAttemptTemplate()` in `improvisationWithMultipleTurns()`:

```typescript
// Line ~3700 in goal-processor.ts
if (totalCost > maxCost) {
  const failureAnalysis = analyzeImprovisationFailure(improvResult)
  const attemptTemplate = await extractAttemptTemplate(improvResult, failureAnalysis)

  // Register attempt
  if (mcp) {
    await mcp.registerTemplate(attemptTemplate)
  }

  // NEW: Immediately retry with fixes
  try {
    const retryExecution = await this.retryAttemptTemplate(
      attemptTemplate,
      failureAnalysis,
      goal
    )

    if (retryExecution.status === 'completed') {
      log.info(`[Bootstrap] Retry succeeded - template validated!`)
      return this.convertExecutionToGoalResult(retryExecution, goal)
    }
  } catch (error) {
    log.warn(`[Bootstrap] Retry failed: ${error.message}`)
    // Continue with normal improvisation path
  }
}
```

---

## Gap 2: Execution Feedback Recording

### Current State
- Activities execute (✅)
- Results tracked locally (✅)
- **NO FEEDBACK TO BACKEND** ❌

### What's Needed

**Backend Endpoint** (NEW): `POST /v2/activities/feedback`

**File**: `repos/metabob-activity-api/src/routes/activities.ts`

```typescript
/**
 * Record execution feedback for Thompson Sampling updates
 */
router.post("/feedback", async (c) => {
  const body = await c.req.json()
  const { template_id, execution_id, success, duration, cost, error_type } = body

  // Validate inputs
  if (!template_id || !execution_id || success === undefined) {
    return c.json({ error: "Missing required fields" }, 400)
  }

  // Update Thompson Sampling parameters
  const db = await getDB()
  const template = await db.select(template_id)

  if (!template || !template.id) {
    return c.json({ error: "Template not found" }, 404)
  }

  // Update alpha (success count) or beta (failure count)
  const alphaInc = success ? 1 : 0
  const betaInc = success ? 0 : 1

  await db.query(`
    UPDATE ${template_id} SET
      thompson_alpha += ${alphaInc},
      thompson_beta += ${betaInc},
      total_executions += 1,
      last_executed_at = time::now(),
      avg_duration = (avg_duration * total_executions + ${duration}) / (total_executions + 1),
      avg_cost = (avg_cost * total_executions + ${cost}) / (total_executions + 1)
  `)

  // Record execution trace
  await db.create("execution_trace", {
    execution_id,
    template_id,
    timestamp: new Date(),
    success,
    duration,
    cost,
    error_type,
  })

  return c.json({
    updated: true,
    new_alpha: template.thompson_alpha + alphaInc,
    new_beta: template.thompson_beta + betaInc
  })
})
```

**MiniBob Integration**:

**File**: `repos/minibob/src/mcp.ts`

```typescript
/**
 * Record execution feedback to backend
 */
async recordExecutionFeedback(
  templateId: string,
  execution: ActivityExecution
): Promise<void> {
  if (!this.client) {
    log.warn("[MCP] No client available for feedback recording")
    return
  }

  try {
    await this.client.request({
      method: "POST",
      url: "/v2/activities/feedback",
      body: {
        template_id: templateId,
        execution_id: execution.id,
        success: execution.status === 'completed',
        duration: execution.metrics?.duration || 0,
        cost: execution.metrics?.cost || 0,
        error_type: execution.error ? this.classifyError(execution.error) : undefined
      }
    })

    log.info(`[Feedback] Recorded for ${templateId}: ${execution.status}`)
  } catch (error) {
    log.error(`[Feedback] Failed to record: ${error.message}`)
  }
}

private classifyError(error: string): string {
  if (error.includes("not found")) return "file_not_found"
  if (error.includes("permission")) return "permission_denied"
  if (error.includes("timeout")) return "timeout"
  if (error.includes("syntax")) return "syntax_error"
  return "unknown"
}
```

**Call Site**: After every activity execution in `ActivityExecutor.execute()`:

```typescript
// File: repos/minibob/src/activity.ts
// After execution completes (line ~1100)

const execution: ActivityExecution = {
  id: executionId,
  template,
  status: allTasksSucceeded ? 'completed' : 'failed',
  taskResults,
  metrics: { duration: totalDuration, cost: totalCost }
}

// NEW: Record feedback
const mcp = getMCPClient()
if (mcp) {
  await mcp.recordExecutionFeedback(template.id, execution)
}

return execution
```

---

## Gap 3: Variant Creation from Failures

### Current State
- Failure analysis suggests fixes (✅)
- **NO AUTOMATIC VARIANT CREATION** ❌

### What's Needed

**File**: `repos/minibob/src/goal-processor.ts`

```typescript
/**
 * Create variant template from attempt template with fixes applied
 */
private async createVariantFromAttempt(
  attemptTemplate: ActivityTemplate,
  failureAnalysis: ImprovisationFailureAnalysis
): Promise<ActivityTemplate> {
  const variantId = `${attemptTemplate.id}-variant-${Date.now()}`

  // Clone template
  const variant: ActivityTemplate = {
    ...attemptTemplate,
    id: variantId,
    name: `${attemptTemplate.name} (Variant)`,
    metadata: {
      ...attemptTemplate.metadata,
      isVariant: true,
      parentTemplateId: attemptTemplate.id,
      variantReason: failureAnalysis.failureReason,
      appliedFixes: failureAnalysis.suggestedFixes,
      createdAt: Date.now()
    }
  }

  // Apply fixes to tasks
  variant.tasks = variant.tasks.map(task => {
    const modifiedTask = { ...task }

    // Add file discovery steps if "not found" error
    if (failureAnalysis.failureReason.includes("not found")) {
      modifiedTask.prompt.template =
        "First, verify the file exists using glob or read tools.\n\n" +
        task.prompt.template
    }

    // Add permission checks
    if (failureAnalysis.failureReason.includes("permission")) {
      modifiedTask.validation = {
        ...task.validation,
        requiredPermissions: ["read", "write"]
      }
    }

    // Increase retry attempts for timeout errors
    if (failureAnalysis.failureReason.includes("timeout")) {
      modifiedTask.retry = {
        ...task.retry,
        maxAttempts: (task.retry?.maxAttempts || 2) + 1
      }
    }

    return modifiedTask
  })

  // Enhance input schema with missing impulses
  const missingShapes = failureAnalysis.missingInputShapes || []
  if (missingShapes.length > 0) {
    variant.inputSchema = {
      ...variant.inputSchema,
      required: [
        ...(variant.inputSchema?.required || []),
        ...missingShapes.map(shape => ({ shape, description: `Added from failure analysis` }))
      ]
    }
  }

  return variant
}
```

**Backend Support**: Store variant lineage

**File**: `repos/metabob-activity-api/src/routes/activities.ts`

Add to template schema:
```typescript
// In activity_template table definition
{
  isVariant: boolean,
  parentTemplateId?: string,
  variantReason?: string,
  appliedFixes?: string[],
  variantGeneration?: number  // How many variants deep
}
```

---

## Gap 4: Impulse Relevance Tracking

### Current State
- Impulses loaded during execution (✅)
- **NO RELEVANCE SCORING** ❌

### What's Needed

**Backend Endpoint** (EXISTS but unused): `POST /v2/activities/impulse-relevance`

**MiniBob Integration**:

**File**: `repos/minibob/src/activity.ts`

```typescript
/**
 * After task execution, record which impulses were actually used
 */
private async recordImpulseRelevance(
  activityId: string,
  loadedImpulses: Impulse[],
  usedImpulseIds: Set<string>,
  executionSuccess: boolean
): Promise<void> {
  const mcp = getMCPClient()
  if (!mcp) return

  for (const impulse of loadedImpulses) {
    const wasUsed = usedImpulseIds.has(impulse.id)

    await mcp.recordImpulseRelevance({
      impulse_id: impulse.id,
      activity_id: activityId,
      was_loaded: true,
      was_used: wasUsed,
      execution_success: executionSuccess,
      timestamp: Date.now()
    })
  }
}
```

**Track Usage**: Instrument tool handlers to track which impulses are accessed

```typescript
// In ToolHandler for 'read'
const impulseId = `file:${params.path}`
usedImpulses.add(impulseId)  // Track access
```

**Backend Calculation**: Update relevance scores

```typescript
// In backend: calculate relevance score
relevance_score = (times_used_in_success) / (times_loaded)
// Range: 0.0 (loaded but never helped) to 1.0 (always helped when loaded)
```

**Use in Recommendations**: Boost activities that historically use available impulses

```typescript
// In recommendActivities()
if (activity.inputSchema.required.includes(shape)) {
  const relevanceScore = await getImpulseRelevance(activity.id, impulseId)
  if (relevanceScore > 0.7) {
    score += 0.15  // Boost if impulse is highly relevant
  }
}
```

---

## Gap 5: Composition Graph Recording

### Current State
- Activities can call other activities (✅ - improviser has "activity" tool)
- **NO COMPOSITION TRACKING** ❌

### What's Needed

**Backend Endpoint** (EXISTS): `POST /v2/activities/composition`

**MiniBob Integration**:

**File**: `repos/minibob/src/improviser.ts`

In the `activity` tool handler (line ~162):

```typescript
private createActivityToolHandler(): ToolHandler {
  return async (params: Record<string, unknown>): Promise<ToolResult> => {
    const activityId = params.activity_id as string
    const parentActivityId = this.currentActivityId  // Track parent

    // ... existing execution logic ...

    const execution = await this.activityExecutor.execute({
      template,
      variables,
      reason: `Called as tool during improvisation`
    })

    // NEW: Record composition
    const mcp = await import('./mcp').then(m => m.getMCPClient())
    if (mcp && parentActivityId) {
      await mcp.recordComposition({
        parent_activity_id: parentActivityId,
        child_activity_id: activityId,
        execution_id: execution.id,
        success: execution.status === 'completed',
        context: "Called during improvisation"
      })
    }

    return result
  }
}
```

**Use in Recommendations**: Boost activities that are frequently composed together

```typescript
// In backend recommendActivities()
// If we know activity A is running, and historically A → B is a successful pattern:
if (currentActivityId) {
  const frequentChildren = await getCompositionChildren(currentActivityId)
  for (const child of frequentChildren) {
    if (child.id === candidate.id && child.success_rate > 0.7) {
      score += 0.2  // Strong composition signal
    }
  }
}
```

---

## Gap 6: Execution Trace Similarity Search (Change Search)

### Current State
- Execution traces stored with full state snapshots (✅)
- Embedding service infrastructure ready (✅)
- **NO SIMILARITY SEARCH** ❌

### What's Needed

**Backend Endpoint** (NEW): `POST /v2/activities/execution-traces/search/similar`

**File**: `repos/metabob-activity-api/src/routes/execution-traces.ts`

```typescript
router.post("/search/similar", async (c) => {
  const { goal_description, state_description, limit = 5 } = await c.req.json()

  // 1. Generate embedding for current goal/state
  const embedding = await embeddingService.embed(goal_description + " " + state_description)

  // 2. Vector similarity search (requires vector index on goal_embedding field)
  const db = await getDB()
  const similar = await db.query(`
    SELECT
      id,
      execution_id,
      activity_id,
      input_state,
      output_state,
      stateTransition,
      success,
      vector::similarity::cosine(goal_embedding, ${embedding}) AS similarity_score
    FROM execution_trace
    WHERE success = true
    ORDER BY similarity_score DESC
    LIMIT ${limit}
  `)

  return c.json({ traces: similar })
})
```

**MiniBob Integration**:

**File**: `repos/minibob/src/search-first-executor.ts`

Add to the search flow (line ~100):

```typescript
async executeGoal(goal: string, context?: Record<string, any>): Promise<any> {
  log.info(`[SearchFirst] Executing goal: ${goal}`)

  // NEW: Step 1 - Search for similar execution traces
  const mcp = getMCPClient()
  if (mcp) {
    const similarTraces = await mcp.searchSimilarExecutionTraces(goal, context)

    if (similarTraces.length > 0 && similarTraces[0].similarity_score > 0.85) {
      log.info(`[ChangeSearch] Found similar trace: ${similarTraces[0].execution_id}`)

      // Extract pattern and replay
      const pattern = this.extractPatternFromTrace(similarTraces[0])
      return this.replayPattern(pattern, goal, context)
    }
  }

  // Step 2 - Existing flow (Thompson Sampling recommendations)
  const recommendations = await this.searchForActivity(goal, context)

  // ... rest of existing logic ...
}
```

**Pattern Extraction**:

```typescript
private extractPatternFromTrace(trace: ExecutionTrace): ExecutionPattern {
  return {
    toolSequence: trace.tasks.flatMap(t => t.toolCalls.map(tc => tc.tool)),
    filesModified: trace.stateTransition.after.map(f => f.path),
    filesCreated: trace.output_state.filesCreated,
    impulseShapes: trace.input_impulse_shapes,
    commands: trace.tasks.flatMap(t =>
      t.toolCalls.filter(tc => tc.tool === 'bash').map(tc => tc.params.command)
    )
  }
}
```

---

## Implementation Priority

### Phase 1: Close the Feedback Loop (High Impact, Low Effort)
- ✅ **Gap 2** - Execution Feedback Recording
  - Files: 1 backend endpoint, 1 MiniBob integration
  - Impact: Thompson Sampling finally learns from real usage
  - Effort: 2-3 hours

- ✅ **Gap 4** - Impulse Relevance Tracking
  - Files: Instrument tool handlers, backend endpoint exists
  - Impact: Better impulse recommendations
  - Effort: 2-3 hours

- ✅ **Gap 5** - Composition Graph Recording
  - Files: 1 integration point in improviser
  - Impact: Pattern-based activity chaining
  - Effort: 1-2 hours

### Phase 2: Enable Bootstrap Retry (Medium Impact, Medium Effort)
- ✅ **Gap 1** - Retry Attempt Templates
  - Files: goal-processor.ts additions
  - Impact: Failures become learning opportunities
  - Effort: 4-6 hours

- ✅ **Gap 3** - Variant Creation
  - Files: Template cloning, fix application logic
  - Impact: Systematic failure recovery
  - Effort: 4-6 hours

### Phase 3: Advanced Search (High Impact, High Effort)
- ✅ **Gap 6** - Execution Trace Similarity Search
  - Files: Backend vector search, MiniBob integration
  - Impact: Learn from past solutions directly
  - Effort: 8-10 hours

---

## Success Metrics

**After Phase 1** (Feedback Loop):
- Thompson Sampling alpha/beta values update after each execution
- Activity scores converge toward true success rates
- Low-performing templates get naturally deprioritized

**After Phase 2** (Bootstrap Retry):
- Failed improvisations generate variants
- Variants get retried automatically
- Success rate of variants > original attempts
- Template count grows organically from usage

**After Phase 3** (Change Search):
- Similar goals reuse successful patterns without improvisation
- Execution cost decreases over time (fewer LLM calls)
- Agentic → Algorithmic transition visible in metrics

---

## Observability

Track these metrics in the activity dashboard:

```typescript
{
  // Bootstrap health
  improvisation_to_template_ratio: number  // Should decrease over time
  template_reuse_rate: number              // Should increase over time
  variant_success_rate: number             // Variants vs originals

  // Learning effectiveness
  thompson_sampling_convergence: number    // How fast scores stabilize
  impulse_relevance_accuracy: number       // Predicted vs actual usage
  composition_pattern_frequency: number    // How often patterns repeat

  // Cost efficiency
  avg_cost_per_goal: number                // Should decrease over time
  llm_call_frequency: number               // Should decrease over time
  template_execution_percentage: number    // Should increase over time
}
```

---

## Files to Modify

### MiniBob
1. `repos/minibob/src/goal-processor.ts` - Retry logic, variant creation
2. `repos/minibob/src/mcp.ts` - Feedback recording, similarity search
3. `repos/minibob/src/activity.ts` - Impulse relevance tracking
4. `repos/minibob/src/improviser.ts` - Composition recording
5. `repos/minibob/src/search-first-executor.ts` - Change search integration

### Backend
1. `repos/metabob-activity-api/src/routes/activities.ts` - Feedback endpoint
2. `repos/metabob-activity-api/src/routes/execution-traces.ts` - Similarity search
3. `repos/metabob-activity-api/src/models/schemas.ts` - Variant schema fields

---

## Next Steps

1. **Implement Phase 1** - Close the feedback loop (execution feedback, impulse relevance, composition)
2. **Validate** - Run test goals, verify Thompson Sampling updates
3. **Implement Phase 2** - Enable bootstrap retry (attempt templates, variants)
4. **Validate** - Verify variants are created and retried automatically
5. **Implement Phase 3** - Add change search (similarity, pattern replay)
6. **Monitor** - Track metrics in dashboard, watch agentic → algorithmic transition

The bootstrap learning loop will then be complete, enabling MiniBob to teach itself through continuous usage.
