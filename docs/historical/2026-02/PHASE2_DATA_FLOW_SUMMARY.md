# Phase 2 Instrumentation - Data Flow Summary

**Generated:** 2026-02-22  
**Task:** Trace real data flow for Activity Execution Instrumentation

---

## Critical Finding

**Phase 2 instrumentation endpoints exist but are NOT CONNECTED to the execution flow.**

### Current State

| Component | Status | Location |
|-----------|--------|----------|
| **Backend API** | ✅ Ready | `repos/metabob-rpc-api/server/routes/activity.py` |
| **Database Ops** | ✅ Ready | `repos/metabob-rpc-api/server/db/operations/` |
| **Executor Integration** | ❌ Missing | `repos/metabob-opencode/.../template-executor.ts` |
| **Data Flow** | ❌ Broken | No calls from TypeScript → Python API |

---

## Integration Points Needed

### 1. Activity Start (template-executor.ts:86)

**Add:**
```typescript
await ActivityInstrumentation.storeActivityContent({
  execution_id: activity.id,
  variant_id: template.variantId,
  template_definition: template,
  variable_bindings: options.variables,
  reason: options.reason,
  initial_state: { git_branch, git_commit, impulse_ids },
})
```

**Calls:** `POST /v2/activities/content`  
**Writes to:** `activity_content` table

### 2. Task Start (template-executor.ts:~430)

**Add:**
```typescript
await ActivityInstrumentation.recordTaskStart({
  execution_id: activity.id,
  task_id: task.id,
  task_index: index,
  subagent: task.subagent,
  prompt: fullPrompt,
  state_before: { impulse_count, loaded_impulses },
})
```

**Calls:** `POST /v2/activities/tasks`  
**Writes to:** `task_execution` table

### 3. Task Complete (template-executor.ts:~500)

**Add:**
```typescript
await ActivityInstrumentation.updateTaskExecution(taskExecutionId, {
  execution_id: activity.id,
  task_id: task.id,
  success: true,
  duration_ms: execution.duration,
  tokens_used: execution.tokens,
  cost_usd: execution.cost,
  
  // Context learning metrics
  impulses_loaded: task.impulseReferences?.length || 0,
  impulse_context_tokens: calculateImpulseTokens(...),
  context_ratio: impulseTokens / totalTokens,
})
```

**Calls:** `PATCH /v2/activities/tasks/{id}`  
**Updates:** `task_execution` table

### 4. Impulse Loading (task-execution-shared.ts:~100)

**Add:**
```typescript
await ActivityInstrumentation.trackImpulseLoading({
  execution_id: activityId,
  task_id: taskId,
  impulse_ids: impulseIds,
  total_tokens_loaded: sum(impulse.tokenCount),
})
```

**Purpose:** Track impulse usage for context learning

---

## Context Learning Metrics

### Primary Metric: Context Ratio

```
context_ratio = impulse_context_tokens / total_context_tokens
```

**Purpose:** Measure fraction of task context from impulses vs other sources

**Analysis:** Correlate context_ratio with task success to find optimal ratios

### Supporting Metrics

| Metric | Calculation | Purpose |
|--------|-------------|---------|
| `impulses_loaded` | Count of loaded impulses | Measure impulse usage |
| `impulse_context_tokens` | Sum of impulse tokens | Quantify impulse contribution |
| `budget_utilization` | used_tokens / total_budget | Monitor memory pressure |
| `tokens_freed` | Tokens unloaded via optimization | Track memory optimization |

---

## Data Flow Diagram

```
┌────────────────────────────────────────────────────┐
│ TypeScript Executor (template-executor.ts)        │
│                                                    │
│  execute() ──────────────────┐                    │
│    ├─ Create activity        │                    │
│    ├─ Create impulses        │                    │
│    └─ executeTasks() ────────┼────────────┐       │
│         ├─ Load impulses     │            │       │
│         ├─ Execute task      │            │       │
│         └─ Extract metrics   │            │       │
│                              │            │       │
│         ❌ MISSING:          │            │       │
│         - storeActivityContent            │       │
│         - recordTaskStart                 │       │
│         - updateTaskExecution             │       │
│         - trackImpulseLoading             │       │
└────────────────────────────────────────────────────┘
                              │            │
                              │ HTTP POST  │ HTTP PATCH
                              │            │
                              ▼            ▼
┌────────────────────────────────────────────────────┐
│ Python Backend API (activity.py)                   │
│                                                    │
│  POST /v2/activities/content                       │
│    └─> insert_activity_content()                   │
│                                                    │
│  POST /v2/activities/tasks                         │
│    └─> insert_task_execution()                     │
│                                                    │
│  PATCH /v2/activities/tasks/{id}                   │
│    └─> update_task_execution()                     │
└────────────────────────────────────────────────────┘
                              │
                              │ SurrealDB operations
                              │
                              ▼
┌────────────────────────────────────────────────────┐
│ SurrealDB Tables                                   │
│                                                    │
│  activity_content:                                 │
│    - execution_id (PK)                             │
│    - variant_id                                    │
│    - template_definition                           │
│    - variables                                     │
│    - reason                                        │
│                                                    │
│  task_execution:                                   │
│    - execution_id + task_id (PK)                   │
│    - task_index                                    │
│    - subagent                                      │
│    - prompt                                        │
│    - status, success                               │
│    - duration_ms, cost_usd                         │
│    - tokens_input, tokens_output, tokens_cache     │
│    - [NEW] impulses_loaded                         │
│    - [NEW] impulse_context_tokens                  │
│    - [NEW] context_ratio                           │
└────────────────────────────────────────────────────┘
```

---

## Implementation Requirements

### 1. Create ActivityInstrumentation Module

**File:** `repos/metabob-opencode/packages/opencode/src/session/activity-instrumentation.ts`

**Functions:**
- `storeActivityContent(data)` → POST /v2/activities/content
- `recordTaskStart(data)` → POST /v2/activities/tasks
- `updateTaskExecution(id, data)` → PATCH /v2/activities/tasks/{id}
- `trackImpulseLoading(data)` → Log or future endpoint

### 2. Integrate with Template Executor

**File:** `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts`

**Changes:**
- Import `ActivityInstrumentation`
- Add `storeActivityContent()` call after line 86
- Add `recordTaskStart()` call before task execution (~line 430)
- Add `updateTaskExecution()` call after metrics extraction (~line 500)

### 3. Track Impulse Loading

**File:** `repos/metabob-opencode/packages/opencode/src/session/task-execution-shared.ts`

**Changes:**
- Import `ActivityInstrumentation`
- Add `trackImpulseLoading()` call after impulse loading (~line 100)
- Pass activity/task context through function parameters

### 4. Calculate Context Metrics

**New utility function:**
```typescript
function calculateImpulseTokens(
  impulses: Record<string, Impulse>,
  referencedIds: string[]
): number {
  return referencedIds.reduce((sum, id) => {
    return sum + (impulses[id]?.tokenCount || 0)
  }, 0)
}
```

---

## Testing Strategy

### Phase 1: API Endpoint Testing
- ✅ Endpoints exist and accept requests
- ✅ Database operations work correctly
- ✅ Data persists to SurrealDB

### Phase 2: Integration Testing
1. Create ActivityInstrumentation module
2. Add single integration point (activity start)
3. Test data flow end-to-end
4. Verify data in SurrealDB

### Phase 3: Full Instrumentation
1. Add all integration points
2. Run complete activity execution
3. Verify all metrics captured
4. Analyze context_ratio data

### Phase 4: Validation
1. Query execution history
2. Calculate context effectiveness
3. Identify optimization opportunities
4. Validate learning loop

---

## Next Steps (For Calling Agent)

1. **Design activity template** to implement instrumentation:
   - Task 1: Create ActivityInstrumentation module
   - Task 2: Add activity start instrumentation
   - Task 3: Add task execution instrumentation
   - Task 4: Add impulse loading tracking
   - Task 5: Test data flow end-to-end

2. **Capture required metrics:**
   - `context_ratio` = primary learning signal
   - `impulse_context_tokens` = impulse contribution
   - `budget_utilization` = memory pressure
   - `tokens_freed` = optimization effectiveness

3. **Build analysis queries:**
   - Context ratio by task type
   - Impulse effectiveness analysis
   - Budget pressure correlation
   - Success rate vs context ratio

---

## Key Insights

### 1. Infrastructure is Ready
- Backend API endpoints exist and work
- Database operations are implemented
- Schema supports required metrics
- **Problem:** Not connected to executor

### 2. Integration is Straightforward
- 4 clear integration points
- Existing metric extraction works
- Minimal code changes needed
- **Solution:** Create bridge module + add calls

### 3. Context Learning is Achievable
- All required data is available
- Metrics are well-defined
- Analysis queries are simple
- **Outcome:** Impulse effectiveness learning

### 4. This Enables the Learning Loop
- Capture execution history
- Measure context effectiveness
- Optimize impulse selection
- Improve template quality

---

## Conclusion

**Phase 2 instrumentation is architecturally complete but functionally disconnected.**

The missing piece is a simple bridge: TypeScript executor needs to call Python backend API. Once connected:

1. ✅ Complete execution history captured
2. ✅ Context learning metrics available
3. ✅ Replay capability enabled
4. ✅ Learning loop functional

**This is the foundation for impulse-driven context learning.**

---

**Full technical details:** See `PHASE2_INSTRUMENTATION_DATA_FLOW_TRACE.md`
