# Code Execution Paths Review - Phases 1.1-1.6

## Phase 1.1: Activity Composition Graph (Backend)

### Execution Path:
```
1. Activity A calls Activity B (nested execution)
   ↓
2. Activity B completes with success/failure
   ↓
3. [MISSING IN CODE] Need to trigger POST /v2/activities/composition
   ↓
4. Backend receives composition record
   ↓
5. Check if edge exists (parent + child)
   ↓
6. Update existing edge OR Create new edge
   ↓
7. Compute weight = success_count / execution_count
   ↓
8. Store in activity_composition_graph table
```

### Backend Endpoints:
- POST /v2/activities/composition
- GET /v2/activities/composition/graph

### Status: ✅ Backend code exists
### Issue: Need to verify minibob integration

---

## Phase 1.2: Composition Tracking (Minibob)

### Execution Path:
```
1. ActivityExecutor.execute() starts
   ↓
2. Sets currentActivityId, currentExecutionId, currentGoalContext
   ↓
3. Task execution calls activity tool (nested activity)
   ↓
4. Activity tool handler creates nested executor
   ↓
5. Nested executor executes with parent context
   ↓
6. After nested execution completes:
   ↓
7. Check if MCP enabled && parent context exists
   ↓
8. Call mcp.recordComposition({
      parentActivityId,
      childActivityId,
      executionId,
      goalContext,
      success
   })
   ↓
9. MCP client POSTs to /v2/activities/composition
```

### Code Location:
- repos/minibob/src/activity.ts:142-153
- repos/minibob/src/mcp.ts:240-274

### Status: ✅ Code exists
### Issue: Need to verify integration

---

## Phase 1.3: Impulse Relevance Metrics (Backend)

### Execution Path:
```
1. [NOT YET INTEGRATED IN MINIBOB]
   Activity execution should call:
   POST /v2/activities/impulse-relevance
   
2. Backend receives relevance record:
   - impulse_id
   - activity_variant_id
   - was_loaded (boolean)
   - execution_succeeded (boolean)
   
3. Check if metric exists
   ↓
4. Update counters:
   - times_loaded (if was_loaded)
   - times_execution_succeeded (if was_loaded && succeeded)
   - times_not_loaded_succeeded (if !was_loaded && succeeded)
   
5. Compute Bayesian scores:
   - relevance_score = P(success | impulse present)
   - irrelevance_score = P(success | impulse absent)
   
6. Store in impulse_relevance_metrics table
```

### Backend Endpoints:
- POST /v2/activities/impulse-relevance
- GET /v2/activities/impulse-relevance

### Status: ⚠️ Backend exists, Minibob NOT integrated
### Issue: Phase 1.8 will add minibob integration

---

## Phase 1.4: Tool Calls as Impulses (Minibob)

### Execution Path:
```
1. ActivityExecutor.executeTask() starts
   ↓
2. Reset toolCallRecords = []
   ↓
3. Wrap tool handlers to capture calls
   ↓
4. LLM calls tool (e.g., bash, read, edit)
   ↓
5. Wrapped handler executes
   ↓
6. Record in toolCallRecords:
   - toolName
   - params
   - result
   - timestamp
   ↓
7. After task completes, iterate toolCallRecords
   ↓
8. For each successful tool call:
   Create impulse:
   - id: tool:{toolName}:{taskId}:{timestamp}
   - pointer: { type: "memo", content: result.output }
   - budget: token estimate
   - tags: [tool:X, activity:Y, task:Z]
```

### Code Location:
- repos/minibob/src/activity.ts:468-517

### Status: ✅ Code exists

---

## Phase 1.5: Tool Usage Patterns

### Execution Path:
```
1. Activity execution completes
   ↓
2. Check if MCP enabled
   ↓
3. Report execution to backend
   ↓
4. If toolCallRecords.length > 0:
   ↓
5. For each tool call record:
   Call mcp.recordToolUsage({
     toolName,
     activityVariantId,
     executionId,
     toolSucceeded,
     activitySucceeded,
     paramsComplexity
   })
   ↓
6. MCP client POSTs to /v2/activities/tool-usage
   ↓
7. Backend checks if pattern exists
   ↓
8. Update metrics:
   - times_used++
   - success counts
   - Compute usage_probability
   - Compute success_correlation
   - Determine is_required / is_optional
   ↓
9. Store in tool_usage_patterns table
```

### Code Location:
- Minibob: repos/minibob/src/activity.ts:317-334
- MCP: repos/minibob/src/mcp.ts:280-318
- Backend: repos/metabob-activity-api/src/routes/activities.ts:1620+

### Status: ✅ Code exists

---

## Phase 1.6: Execution Sequences

### Execution Path:
```
1. [MANUAL] User creates session:
   createSession("goal description")
   ↓
2. User executes activity 1
   ↓
3. [MANUAL] User calls:
   recordExecution(sessionId, execution, 'goal')
   ↓
4. Session tracker adds to sequence array
   ↓
5. User executes activity 2, 3, etc.
   ↓
6. [MANUAL] User calls:
   completeSession(sessionId, 'success')
   ↓
7. Check if MCP enabled && executions.length > 0
   ↓
8. Call mcp.recordExecutionSequence({
      sessionId,
      goalContext,
      sequence,
      outcome
   })
   ↓
9. MCP client POSTs to /v2/activities/execution-sequences
   ↓
10. Backend computes aggregates (total duration, cost, count)
    ↓
11. Store in execution_sequences table
    ↓
12. Clean up session from active sessions map
```

### Code Location:
- Minibob: repos/minibob/src/session.ts
- MCP: repos/minibob/src/mcp.ts:320-365
- Backend: repos/metabob-activity-api/src/routes/activities.ts:1950+

### Status: ✅ Code exists
### Issue: Manual integration (not automatic like tool tracking)

---

## Issues Found:

1. **Phase 1.3 NOT integrated in minibob** - Backend exists but minibob doesn't call it
2. **Phase 1.6 is manual** - User must explicitly call session functions
3. **Need to verify Phase 1.2 actually triggers** - Composition tracking in nested calls

## Next Steps:

1. Build backend and check for compilation errors
2. Build minibob and check for compilation errors
3. Create integration test that exercises all paths
4. Run test and validate data flows
