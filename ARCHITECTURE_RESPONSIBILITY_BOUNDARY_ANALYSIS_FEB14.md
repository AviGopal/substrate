# Architecture Responsibility Boundary Analysis - February 14, 2026

**Investigation**: Trace actual execution flow to determine who orchestrates activity execution  
**Method**: Code inspection of MCP tools, function calls, and implementation logic  
**Status**: ✅ **Analysis Complete - Clear Responsibility Boundaries Identified**

---

## Executive Summary

**Finding**: The architecture has **clear separation of concerns** that differs from some documentation claims.

### Actual Responsibility Boundaries

| Component | Role | Evidence |
|-----------|------|----------|
| **metabob-opencode** | **Step Executor** | Runs agent sessions, calls LLM, executes tool calls |
| **metabob-cli** | **Step Orchestrator** | Decides WHICH step to deliver next, tracks state, manages trailblazing |
| **metabob-rpc-api** | **Storage & Learning** | Persists data, runs Thompson Sampling, provides templates |

### Key Architectural Pattern: **Orchestrator-Executor Split**

```
metabob-cli (orchestrator)        metabob-opencode (executor)
   │                                      │
   │  1. start_activity_execution         │
   ├─────────────────────────────────────>│
   │     (returns execution_id)           │
   │                                      │
   │  2. get_next_step                    │
   ├─────────────────────────────────────>│
   │     (returns ONLY current step)      │
   │                                      │
   │                                     [Executes step via LLM]
   │                                     [Calls tools as needed]
   │                                     [Collects metrics]
   │                                      │
   │  3. report_step_result               │
   │<─────────────────────────────────────┤
   │     (receives metrics, decides next) │
   │                                      │
   │  4. get_next_step (next iteration)   │
   ├─────────────────────────────────────>│
   │     (incremental delivery)           │
```

**Critical Distinction**: 
- **CLI decides WHICH step** (policy/orchestration)
- **OpenCode executes GIVEN step** (mechanism/execution)

---

## Evidence: MCP Tools Exposed by metabob-cli

### Orchestration Tools (Found)
```python
# File: repos/metabob-cli/src/metabob_cli/mcp/tools.py

@mcp.tool(name="start_activity_execution")
async def start_activity_execution_tool(
    activity_id: str,
    session_id: str,
    variables: str,
    cost_budget: float
) -> str:
    """Start executing an activity"""
    # Creates ActivityExecution object
    # Returns execution_id

@mcp.tool(name="get_next_step")
async def get_next_step_tool(execution_id: str) -> str:
    """Get the next step to execute in an activity"""
    # Fetches template from backend
    # Returns ONLY current step based on current_step_index
    # Agent cannot see future steps

@mcp.tool(name="report_step_result")
async def report_step_result_tool(
    execution_id: str,
    step_id: str,
    success: bool,
    output: str,
    error: str,
    cost: float,
    tokens: int
) -> str:
    """Report completion of a step"""
    # Records step result in ActivityExecution
    # Advances current_step_index
    # Decides if validation needed
    # Returns next action (continue/complete/trailblazing)

@mcp.tool(name="enter_trailblazing")
async def enter_trailblazing_tool(
    execution_id: str,
    failure_context: str,
    max_cost: float
) -> str:
    """Enter trailblazing mode to fix validation failures"""
    # Generates fix steps dynamically
    # Managed by cli's ActivityManager

@mcp.tool(name="get_execution_state")
async def get_execution_state_tool(execution_id: str) -> str:
    """Get current state of an activity execution"""
    # Returns ActivityExecution state from cli memory
```

### Data/Analysis Tools (Also Found)
```python
@mcp.tool(name="search_codebase_issues")
@mcp.tool(name="mark_problem_complete")
@mcp.tool(name="annotate_component")
@mcp.tool(name="analyze_change_impact")
@mcp.tool(name="list_file_components")
@mcp.tool(name="get_priority_issues")
@mcp.tool(name="suggest_related_changes")
@mcp.tool(name="assess_deletion_safety")
# ... etc (code quality tools)
```

**Conclusion**: CLI exposes **both orchestration AND analysis tools** via MCP.

---

## Evidence: metabob-opencode Calls MCP Tools

### File: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

#### 1. startExecution (Lines 1154-1207)
```typescript
export async function startExecution(options: {
  activityId: string
  sessionId: string
  variables: Record<string, unknown>
  costBudget: number
}): Promise<{
  execution_id: string
  state: string
  activity_id: string
  variant_id: string
}> {
  const result = await callMCPTool<{...}>(
    "start_activity_execution",  // ← MCP tool call to cli
    {
      activity_id: options.activityId,
      session_id: options.sessionId,
      variables: JSON.stringify(options.variables),
      cost_budget: options.costBudget,
    },
    options.sessionId,
  )
  
  return {
    execution_id: result.execution_id,
    state: result.state,
    activity_id: result.activity_id,
    variant_id: result.variant_id,
  }
}
```

**What this means**: OpenCode asks CLI to create execution, receives execution_id.

#### 2. getNextStep (Lines 1218-1281)
```typescript
export async function getNextStep(executionId: string): Promise<{
  current_step?: {...}
  complete: boolean
  trailblazing: boolean
}> {
  const result = await callMCPTool<{...}>(
    "get_next_step",  // ← MCP tool call to cli
    { execution_id: executionId }
  )
  
  return {
    current_step: result.current_step,  // ← Only sees CURRENT step
    complete: result.complete,
    trailblazing: result.trailblazing,
  }
}
```

**What this means**: OpenCode asks CLI "what's next?", receives ONE step at a time.

#### 3. reportStepResult (Lines 1292-1360)
```typescript
export async function reportStepResult(options: {
  executionId: string
  stepId: string
  success: boolean
  output?: string
  error?: string
  cost: number
  tokens: number
  ...
}): Promise<{
  continue: boolean
  next_step_index?: number
  validation_passed?: boolean
}> {
  const result = await callMCPTool<{...}>(
    "report_step_result",  // ← MCP tool call to cli
    {...options}
  )
  
  return {
    continue: result.continue,
    next_step_index: result.next_step_index,
    validation_passed: result.validation_passed,
  }
}
```

**What this means**: OpenCode reports "I finished step X with metrics Y", CLI decides what's next.

---

## Evidence: Who Executes the Step?

### File: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

#### Function: `executeStepWithTracking` (Lines 719-818)
```typescript
async function executeStepWithTracking(
  step: any,
  variables: Record<string, unknown>,
  template: any,
  ctx: any,
  impulseSpace: Record<string, ActivityTemplate.Impulse>
): Promise<{
  success: boolean
  output?: string
  error?: string
  toolCalls: Array<{ tool: string; args?: any }>
}> {
  // Find the matching task in the template
  const task = template.tasks?.find((t: any) => t.id === step.id)
  
  // Merge variables with defaults
  const mergedVariables = ActivityTemplate.mergeDefaultVariables(task, variables)
  
  // Interpolate prompt with variables
  let prompt = ActivityTemplate.interpolatePrompt(task.prompt.template, mergedVariables)
  
  try {
    // Get TaskTool definition and execute
    const taskToolDef = await TaskTool.init()
    const taskResult = await taskToolDef.execute(
      {
        description: task.description,
        prompt: prompt,  // ← Actual LLM prompt
        subagent_type: task.subagent,
      },
      {...ctx}  // ← Session context
    )
    
    return {
      success: true,
      output: taskResult.output || "",
      error: undefined,
      toolCalls
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      toolCalls
    }
  }
}
```

**What this means**: OpenCode runs the actual LLM session, executes tools, collects output.

---

## Evidence: Who Decides Next Step?

### File: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

#### Function: `get_next_step` (Lines 711-784)
```python
async def get_next_step(self, execution_id: str) -> dict:
    """
    Get the next step to execute.
    
    Fetches steps from the backend and returns ONLY the current step.
    The agent cannot see future steps.
    """
    execution = self._executions.get(execution_id)  # ← ActivityExecution state
    if not execution:
        return {"error": f"Execution not found: {execution_id}"}
    
    # Fetch template details (includes steps) if not cached
    lookup_id = execution.variant_id or execution.activity_id
    activity = self._activity_cache.get(lookup_id)
    if not activity or "tasks" not in activity:
        # Fetch from backend
        response = await client.get(f"/v2/activities/templates/{lookup_id}")
        tasks = template.get("task_steps", template.get("tasks", []))
        activity = {..., "tasks": tasks}
        self._activity_cache[lookup_id] = activity
    
    tasks = activity.get("tasks", [])
    
    if execution.current_step_index >= len(tasks):
        # All steps done, check validation
        return await self._check_completion(execution)
    
    task = tasks[execution.current_step_index]  # ← Select current step
    
    return {
        "execution_id": execution_id,
        "step_index": execution.current_step_index,
        "total_steps": len(tasks),
        "current_step": task,  # ← Return ONLY this step
        "variables": execution.variables,
        "cost_remaining": execution.cost_budget - execution.total_cost,
        "complete": False,
        "trailblazing": False,
    }
```

**What this means**: CLI maintains state, loads template, selects which step to deliver next.

#### Function: `report_step_result` (Lines 786-860+)
```python
async def report_step_result(
    self,
    execution_id: str,
    step_id: str,
    success: bool,
    output: str = "",
    error: str = "",
    cost: float = 0.0,
    tokens: int = 0,
    ...
) -> dict:
    """
    Report completion of a step.
    
    Advances execution state and determines next action:
    - Move to next step
    - Trigger validation
    - Enter trailblazing mode
    """
    execution = self._executions.get(execution_id)
    
    result = StepResult(
        step_id=step_id,
        success=success,
        output=output,
        error=error,
        cost=cost,
        tokens=tokens,
        ...
    )
    execution.step_results.append(result)  # ← Record result
    execution.total_cost += cost
    execution.total_tokens += tokens
    
    if not success:
        # Check if we should enter trailblazing
        if execution.state == ExecutionState.TRAILBLAZING:
            execution.trailblazing_attempts += 1
            if execution.trailblazing_attempts >= execution.max_trailblazing_attempts:
                execution.state = ExecutionState.FAILED
                return {"failed": True, "message": "Max trailblazing attempts reached"}
        # ... trailblazing logic
    
    # Advance to next step
    execution.current_step_index += 1  # ← CLI controls index
    
    # Decide what's next
    return {
        "continue": True,
        "next_step_index": execution.current_step_index,
        ...
    }
```

**What this means**: CLI decides: continue, enter trailblazing, or complete execution.

---

## Evidence: ActivityExecution Object

### File: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

```python
@dataclass
class ActivityExecution:
    """Tracks state of an executing activity"""
    execution_id: str
    activity_id: str
    variant_id: str
    session_id: str
    variables: dict
    cost_budget: float
    
    # Orchestration state
    current_step_index: int = 0  # ← CLI controls which step is next
    state: ExecutionState = ExecutionState.PENDING
    step_results: list[StepResult] = field(default_factory=list)
    
    # Trailblazing state
    trailblazing_attempts: int = 0
    max_trailblazing_attempts: int = 3
    
    # Metrics
    total_cost: float = 0.0
    total_tokens: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
```

**What this means**: CLI maintains execution state in memory (not opencode, not backend during execution).

---

## Architectural Clarity: Who Does What?

### metabob-cli (Orchestrator)

**Responsibilities** (VERIFIED):
- ✅ Create `ActivityExecution` objects
- ✅ Load templates from backend
- ✅ Maintain `current_step_index` (which step is next)
- ✅ Decide when to deliver next step
- ✅ Decide when validation is needed
- ✅ Generate trailblazing fix steps
- ✅ Track execution metrics (cost, tokens)
- ✅ Determine completion/failure
- ✅ Expose MCP tools for all of the above

**What it does NOT do**:
- ❌ Execute LLM calls
- ❌ Run agent sessions
- ❌ Execute tool calls (bash, edit, read, etc.)
- ❌ Interact with user filesystem directly

### metabob-opencode (Executor)

**Responsibilities** (VERIFIED):
- ✅ Call MCP tools to orchestrate activity flow
- ✅ Execute LLM sessions for each step
- ✅ Interpolate step prompts with variables
- ✅ Run agent subagents (via TaskTool)
- ✅ Execute tool calls (bash, edit, read, write, etc.)
- ✅ Collect step metrics (tokens, cost, tool calls)
- ✅ Report results back to CLI
- ✅ Display progress to user

**What it does NOT do**:
- ❌ Decide which step comes next
- ❌ Load full templates (only sees current step)
- ❌ Manage execution state across steps
- ❌ Generate trailblazing steps
- ❌ Determine when activity is complete

### metabob-rpc-api (Storage & Learning)

**Responsibilities** (VERIFIED):
- ✅ Store activity templates in SurrealDB
- ✅ Store execution records (starts, steps, completions)
- ✅ Run Thompson Sampling for variant selection
- ✅ Update alpha/beta priors based on outcomes
- ✅ Track activity selections (CTR calculations)
- ✅ Store impulse metadata and usage patterns
- ✅ Provide templates via GET /v2/activities/templates/{id}

**What it does NOT do**:
- ❌ Execute activities
- ❌ Orchestrate step delivery
- ❌ Maintain in-flight execution state
- ❌ Generate trailblazing steps

---

## Comparison with Documentation

### ARCHITECTURE_SEPARATION_OF_CONCERNS.md Claims

**Documented** (OLD):
```
metabob-cli:
  What it does:
    - ✓ Provides MCP server for code analysis tools
    - ✓ Runs background analysis engine
    - ✓ Caches analysis results
  
  What it does NOT do:
    - ✗ Execute activity templates  ← INCORRECT
    - ✗ Orchestrate agents          ← INCORRECT
    - ✗ Manage user sessions        ← PARTIALLY INCORRECT
```

**Actual** (VERIFIED):
```
metabob-cli:
  What it does:
    - ✓ Provides MCP server for code analysis tools
    - ✓ Runs background analysis engine  
    - ✓ Caches analysis results
    - ✓ Orchestrates activity step delivery  ← MISSING FROM DOCS
    - ✓ Manages execution state (ActivityExecution)  ← MISSING FROM DOCS
    - ✓ Generates trailblazing steps  ← MISSING FROM DOCS
    - ✓ Decides when to validate/complete  ← MISSING FROM DOCS
  
  What it does NOT do:
    - ✗ Execute LLM calls (opencode does this)
    - ✗ Run agent sessions (opencode does this)
    - ✗ Execute tool calls directly (opencode does this)
```

---

## Why This Architecture Makes Sense

### Design Rationale

**Separation of Concerns**:
1. **CLI = Policy** (what to do next)
2. **OpenCode = Mechanism** (how to execute it)
3. **Backend = Memory** (what happened before)

**Benefits**:
- ✅ OpenCode can be stateless (doesn't need to track multi-step state)
- ✅ CLI can swap execution engines (opencode, containers, remote agents)
- ✅ Incremental step delivery prevents prompt leakage
- ✅ Trailblazing logic centralized in one place
- ✅ Easy to add execution isolation (CLI just changes where steps are sent)

**Tradeoffs**:
- ⚠️ More network hops (opencode ↔ CLI ↔ backend)
- ⚠️ State split between CLI memory and backend storage
- ⚠️ Harder to debug (flow crosses 3 components)

---

## Recommendations

### 1. Update Documentation ✅ Priority: HIGH

**Files to Update**:
- `ARCHITECTURE_SEPARATION_OF_CONCERNS.md`
- `ARCHITECTURE_VISUAL.md`
- `ACTIVITY_SYSTEM_QUICK_START.md`

**Changes Needed**:
- Clarify CLI's orchestration role
- Document orchestration vs execution split
- Add sequence diagram showing MCP tool calls
- Explain why this design was chosen

### 2. Consistent Terminology

**Avoid**:
- ❌ "metabob-cli executes activities" (ambiguous)
- ❌ "opencode orchestrates execution" (incorrect)

**Use**:
- ✅ "metabob-cli orchestrates step delivery"
- ✅ "metabob-opencode executes steps via LLM"
- ✅ "CLI decides policy, OpenCode implements mechanism"

### 3. Consider Renaming (Optional)

If confusion persists, consider:
- `metabob-cli` → `metabob-orchestrator` (clearer role)
- Or add subtitle: "metabob-cli (Activity Orchestration + Code Analysis)"

---

## Summary

| Claim | Status | Evidence |
|-------|--------|----------|
| CLI provides MCP tools | ✅ TRUE | 30+ @mcp.tool decorators found |
| CLI orchestrates steps | ✅ TRUE | get_next_step, report_step_result implementation |
| CLI maintains ActivityExecution | ✅ TRUE | activity_manager.py lines 39-60 |
| CLI generates trailblazing steps | ✅ TRUE | enter_trailblazing implementation |
| OpenCode executes LLM sessions | ✅ TRUE | executeStepWithTracking calls TaskTool |
| OpenCode controls step order | ❌ FALSE | Calls get_next_step to receive instructions |
| Documentation accurately describes CLI role | ❌ FALSE | Missing orchestration responsibilities |

**Verdict**: Implementation is architecturally sound but documentation is incomplete/misleading.

---

## Next Actions

1. ✅ **This Analysis** - Complete understanding of actual architecture
2. 🔄 **Update Documentation** - Align docs with implementation
3. 🔄 **Add Sequence Diagrams** - Visualize MCP tool flow
4. 🔄 **Verify with Execution Trace** - Run activity and confirm flow matches

**No code changes needed** - architecture is correct, only documentation needs updating.
