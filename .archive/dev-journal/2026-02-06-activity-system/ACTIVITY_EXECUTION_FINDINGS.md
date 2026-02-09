# Activity Execution Flow: Key Findings

## ✅ What Works

### 1. metabob-cli MCP Interface (Python)
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Complete MCP Interface Confirmed**:
- ✓ `search_activities(query, category, limit)` - Thompson Sampling search
- ✓ `get_activity(activity_id)` - Load template metadata
- ✓ `start_execution(activity_id, session_id, variables, cost_budget)` - Create execution tracking
- ✓ `get_next_step(execution_id)` - Incremental step delivery
- ✓ `report_step_result(execution_id, step_id, success, metrics)` - Metrics collection
- ✓ `get_execution_state(execution_id)` - Progress tracking

**Backend Integration Confirmed**:
- ✓ POST `/activity-recommendations/recommendations` → Thompson Sampling
- ✓ Execution creates state in SurrealDB
- ✓ Metrics flow back for learning (alpha/beta updates)

**Test Result**: ✅ **WORKING END-TO-END**
```python
# Verified flow:
results = await mgr.search_activities("bug fix", limit=5)  # ✓ Returns ranked list
exec = await mgr.start_execution(variant_id, session_id, vars)  # ✓ Creates exec_xxx
# Execution ID: exec_ed60a22da47a, State: pending ✓
```

### 2. OpenCode Template Loading (TypeScript)
**Location**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts`

**Uses MCP for Template Retrieval**:
- ✓ Calls `MetabobCLI.searchActivities()` for discovery
- ✓ Calls `MetabobCLI.getActivity(activityId)` for loading
- ✓ Implements variant resolution from session impulses
- ✓ Has read-through caching (5-min TTL)

**Architecture**:
```
OpenCode → MetabobCLI → metabob-cli (Python) → metabob-rpc-api → SurrealDB
```

---

## ❌ What's Missing

### OpenCode Does NOT Use Incremental Execution Flow

**Problem**: OpenCode loads the FULL template and executes all steps directly, bypassing the proper MCP execution flow.

#### Current OpenCode Flow (WRONG):
```typescript
// activity.ts:302 - Loads full template
const template = await TemplateRepository.get(templateId, { sessionID: ctx.sessionID })

// activity.ts:324 - Delegates to TemplateExecutor which executes all tasks
const result = await TemplateExecutor.execute({
  templateId,
  variables: params.variables,
  reason: params.reason,
  callingSessionId: ctx.sessionID,
})

// PROBLEM: No MCP calls to:
// - start_execution (no execution_id created in backend)
// - get_next_step (agent sees all steps upfront)
// - report_step_result (no metrics collected for learning)
```

#### Proper MCP Flow (REQUIRED):
```typescript
// 1. Search activities (Thompson Sampling)
const results = await MetabobCLI.searchActivities(query, category, limit)
const selected = results[0]  // Has _meta.variant_id

// 2. Start execution (create tracking state)
const exec = await MetabobCLI.startExecution({
  activity_id: selected._meta.variant_id,
  session_id: ctx.sessionID,
  variables: params.variables,
  cost_budget: 1.0
})
// Returns: { execution_id: "exec_abc123", state: "pending" }

// 3. Incremental step delivery
while (true) {
  const stepResponse = await MetabobCLI.getNextStep(exec.execution_id)
  
  if (stepResponse.complete) break
  if (stepResponse.trailblazing) {
    // Handle validation failure recovery
  }
  
  const step = stepResponse.current_step
  
  // 4. Execute step using tools
  const result = await executeStepWithTools(step)
  
  // 5. Report metrics for learning
  await MetabobCLI.reportStepResult({
    execution_id: exec.execution_id,
    step_id: step.id,
    success: result.success,
    output: result.output,
    cost: result.cost,
    tokens: result.tokens,
    tool_calls: result.tool_calls
  })
}
```

---

## 📊 Gap Analysis

| Feature | metabob-cli MCP | OpenCode Usage | Status |
|---------|----------------|----------------|--------|
| **Template Discovery** | `search_activities()` ✓ | `MetabobCLI.searchActivities()` ✓ | ✅ WORKS |
| **Template Loading** | `get_activity()` ✓ | `MetabobCLI.getActivity()` ✓ | ✅ WORKS |
| **Execution Tracking** | `start_execution()` ✓ | ❌ NOT CALLED | ❌ BROKEN |
| **Incremental Steps** | `get_next_step()` ✓ | ❌ NOT CALLED | ❌ BROKEN |
| **Metrics Collection** | `report_step_result()` ✓ | ❌ NOT CALLED | ❌ BROKEN |
| **State Tracking** | `get_execution_state()` ✓ | ❌ NOT CALLED | ❌ BROKEN |

### Impact of Missing Integration:

1. **No Thompson Sampling Learning**
   - Execution outcomes not recorded in SurrealDB
   - Alpha/beta parameters never updated
   - Activity rankings don't improve over time
   - Future recommendations remain static

2. **No Execution Tracking**
   - No execution_id in backend
   - Can't resume failed activities
   - No state persistence across sessions

3. **No Metrics Collection**
   - Cost, tokens, duration not tracked
   - Can't optimize for performance
   - Can't predict execution costs
   - Trailblazing can't learn from past attempts

4. **No Incremental Delivery**
   - Agent sees all steps upfront (in template)
   - Can "game" system by skipping steps
   - No enforcement of sequential execution
   - Validation not enforced by backend

---

## 🔧 Required Changes

### Add Missing MCP Method Wrappers to MetabobCLI

**Location**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

The comments in the file mention these methods should exist, but they're not implemented:

```typescript
export async function startExecution(options: {
  activityId: string
  sessionId: string
  variables: Record<string, unknown>
  costBudget: number
}): Promise<{ execution_id: string; state: string }> {
  // Call metabob-cli MCP: start_activity_execution
}

export async function getNextStep(executionId: string): Promise<{
  current_step?: { id: string; description: string; prompt: any; tools: any }
  complete: boolean
  trailblazing: boolean
}> {
  // Call metabob-cli MCP: get_next_step
}

export async function reportStepResult(options: {
  executionId: string
  stepId: string
  success: boolean
  output?: string
  error?: string
  cost: number
  tokens: number
  toolCalls: Array<{ tool: string; args: any }>
}): Promise<{ continue: boolean }> {
  // Call metabob-cli MCP: report_step_result
}

export async function getExecutionState(executionId: string): Promise<{
  execution_id: string
  state: string
  current_step_index: number
  total_cost: number
  total_tokens: number
}> {
  // Call metabob-cli MCP: get_execution_state
}
```

### Update ActivityTool to Use Incremental Execution

**Location**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

Replace the current direct execution with MCP-based incremental flow:

```typescript
async execute(params, ctx) {
  const templateId = params.activityId
  
  // 1. Load template metadata only (for validation)
  const template = await TemplateRepository.get(templateId, { sessionID: ctx.sessionID })
  if (!template) throw new Error(`Activity "${params.activityId}" not found`)
  
  // 2. Validate variables
  const validationResult = validateTemplateVariables(template, params.variables)
  if (!validationResult.valid) throw new Error(validationResult.errorMessage)
  
  // 3. Start execution (creates tracking state in backend)
  const exec = await MetabobCLI.startExecution({
    activityId: templateId,
    sessionId: ctx.sessionID,
    variables: params.variables,
    costBudget: 1.0
  })
  
  log.info("started activity execution", { executionId: exec.execution_id })
  
  // 4. Incremental step execution
  const taskResults = []
  let totalCost = 0
  let totalTokens = 0
  
  while (true) {
    // Get next step (only current step, not all steps)
    const stepResponse = await MetabobCLI.getNextStep(exec.execution_id)
    
    if (stepResponse.complete) {
      log.info("activity completed successfully")
      break
    }
    
    const step = stepResponse.current_step!
    
    // Execute step using TaskTool or TemplateExecutor
    const stepResult = await executeStep(step, params.variables, ctx)
    
    // Report result with metrics
    await MetabobCLI.reportStepResult({
      executionId: exec.execution_id,
      stepId: step.id,
      success: stepResult.success,
      output: stepResult.output,
      cost: stepResult.cost,
      tokens: stepResult.tokens,
      toolCalls: stepResult.toolCalls
    })
    
    totalCost += stepResult.cost
    totalTokens += stepResult.tokens
    
    taskResults.push({
      taskId: step.id,
      status: stepResult.success ? "completed" : "failed",
      cost: stepResult.cost
    })
    
    if (!stepResult.success) {
      log.error("step failed", { stepId: step.id })
      break
    }
  }
  
  return {
    activityId: params.activityId,
    success: taskResults.every(t => t.status === "completed"),
    tasks: taskResults,
    cost: totalCost,
    tokens: totalTokens
  }
}
```

---

## 🎯 Next Steps

1. **Implement Missing MCP Wrappers**
   - Add `startExecution()`, `getNextStep()`, `reportStepResult()`, `getExecutionState()` to MetabobCLI
   - Test each method individually with the Python MCP server

2. **Update ActivityTool**
   - Replace direct execution with incremental MCP flow
   - Preserve trailblazing and error handling logic
   - Maintain backward compatibility with existing tests

3. **Verify End-to-End**
   - Run activity in OpenCode
   - Check execution_id created in SurrealDB
   - Verify metrics recorded
   - Confirm Thompson Sampling updates

4. **Update Documentation**
   - Document proper activity execution flow
   - Add examples showing MCP integration
   - Create migration guide for existing activities

---

## 📁 Key Files

### Working (metabob-cli):
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` - Full MCP implementation ✓

### Needs Updates (OpenCode):
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` - Add missing MCP wrappers
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` - Use incremental execution
- `repos/metabob-opencode/packages/opencode/src/session/template-executor.ts` - Integration point

### Already Working (OpenCode):
- `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts` - Uses MCP for loading ✓
- `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts` - Unified interface ✓

---

## Summary

**The infrastructure is in place, but OpenCode isn't using it.**

- ✅ metabob-cli has full MCP interface for incremental execution
- ✅ Backend (metabob-rpc-api + SurrealDB) supports execution tracking
- ✅ OpenCode already uses MCP for template discovery and loading
- ❌ OpenCode bypasses MCP for execution (loads full template, executes directly)
- ❌ No metrics collection = no learning = static recommendations

**Solution**: Add 4 missing MCP wrapper methods to OpenCode and update ActivityTool to use incremental execution flow.
