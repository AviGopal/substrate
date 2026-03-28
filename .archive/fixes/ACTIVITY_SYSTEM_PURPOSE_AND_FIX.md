# Activity System: Purpose, Architecture & Execution Fix

**Date:** 2026-02-12  
**Status:** 📋 Design Document & Fix Plan

---

## Purpose of the Activity System

### Core Mission

The Activity System transforms OpenCode from a **prompt-driven** system into an **activity-driven** learning system where:

1. **Activities are reusable workflows** - Multi-step processes that improve through execution data
2. **Context is dynamically assembled** - Session Memory Agent + Impulses provide relevant context
3. **Metabob drives discovery** - Code analysis determines WHERE and HOW to make changes
4. **System learns continuously** - Each execution improves templates via Thompson Sampling
5. **Components get micro-agents** - Each file/component has its own contextual agent with history

### Key Principles

```
🎯 Goal-Driven: User provides intent, system discovers structure
📊 Data-Driven: Templates evolve based on execution metrics
🧠 Context-Aware: Session memory + impulses provide relevant history
🔍 Discovery-First: Metabob finds existing patterns before creating new ones
📈 Learning Loop: Annotations → Better discovery → Better annotations
```

---

## Architecture Overview

### The Three Layers

```
┌─────────────────────────────────────────────────────────┐
│                    USER LAYER                            │
│  User provides goal: "Add user authentication"           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                ACTIVITY ORCHESTRATION                    │
│                                                          │
│  1. Session Memory Agent (Lifecycle Hook)               │
│     - Analyzes user intent                              │
│     - Loads relevant impulses (metabob annotations)     │
│     - Recommends activities based on goal               │
│                                                          │
│  2. Activity Executor (Template-based)                  │
│     - Loads activity template from backend              │
│     - Executes tasks sequentially                       │
│     - Each task gets its own session with context       │
│                                                          │
│  3. Metabob Integration (Discovery & Validation)        │
│     - Discovers existing patterns                       │
│     - Analyzes change impact                            │
│     - Suggests co-changes                               │
│     - Annotates design decisions                        │
│                                                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  BACKEND LAYER                           │
│                                                          │
│  - Activity Templates (stored in SurrealDB)             │
│  - Execution Tracking (metrics collection)              │
│  - Thompson Sampling (learning algorithm)               │
│  - Session Management (auth & state)                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Component Relationships

```
Session Memory Agent
  ↓ (prepares context)
Activity Executor
  ↓ (fetches template)
Backend (Templates)
  ↓ (returns tasks)
Task Executor
  ↓ (creates sub-session for each task)
Sub-Agent (with impulses)
  ↓ (uses tools)
Metabob Tools
  ↓ (annotates results)
Backend (Learning)
```

---

## Execution Flow (Correct Design)

### Phase 1: Turn Lifecycle (Before Activity Execution)

**File:** `src/session/turn-lifecycle-hooks.ts`

```typescript
// Hook Priority Order: Lower numbers run first

1. activity-decision-reminder (priority: 5)
   Purpose: Reminds agent to check activities first
   Adds impulse: "activity-workflow-reminder"
   When: Non-trivial user requests

2. session-memory-preparation (priority: 10)
   Purpose: Analyzes intent and prepares context
   Invokes: SessionMemoryAgent
   Output: Relevant impulses loaded into session memory
   
3. activity-recommendation (priority: 15) [if enabled]
   Purpose: Suggests activities based on goal
   Uses: search_activities MCP tool
   Output: "Recommended Activities" impulse
```

### Phase 2: Activity Tool Invocation

**File:** `src/tool/activity.ts`

```typescript
// User/Agent calls activity tool
activity({
  activityId: "REFACTOR-9c629da6",
  variables: { target: "src/foo.ts" },
  reason: "Clean up code smells"
})
  ↓
1. Fetch template from backend/MCP
   - TemplateRepository.get(activityId)
   - Returns: Full template with tasks array
   
2. Validate variables
   - Check required variables present
   - Fuzzy matching for typos
   
3. Start execution via MCP
   - MetabobCLI.startExecution() [RECORDS in backend]
   - Returns: execution_id
   
4. Incremental task execution loop
   - getNextStep(execution_id) [ONE task at a time]
   - executeStepWithTracking(step)
   - reportStepResult(execution_id, step_id, metrics)
   
5. Return formatted results
```

### Phase 3: Task Execution (Per-Task Detail)

**File:** `src/tool/activity.ts` → `executeStepWithTracking()`

```typescript
for each step from getNextStep():
  1. Find matching task in template
     - template.tasks.find(t => t.id === step.id)
  
  2. Load task-specific impulses
     - Impulse references defined in task
     - Metabob annotations for components
     - Historical context from past executions
  
  3. Create sub-session for task
     - Session.create({ parentID: callingSessionID })
     - Isolated context for task execution
  
  4. Interpolate prompt with variables
     - Replace {{variable}} in task.prompt.template
     - Merge with default values
  
  5. Execute via TaskTool
     - TaskTool.execute({
         description: task.description,
         prompt: interpolated_prompt,
         subagent_type: task.subagent
       })
     - Sub-agent has access to:
       * Loaded impulses (context)
       * Metabob tools (if enabled)
       * All normal tools
  
  6. Collect metrics
     - Duration, cost, tokens
     - Tool calls made
     - Success/failure status
  
  7. Report to backend
     - reportStepResult() with metrics
     - Backend updates Thompson Sampling
  
  8. Continue or stop
     - If success: getNextStep() for next task
     - If failure: Stop and record
```

### Phase 4: Post-Execution Learning

**Backend:** Thompson Sampling Update

```
After each execution:
1. Record metrics in executions table
2. Update activity_variants table:
   - alpha += success_count
   - beta += failure_count
   - execution_count += 1
   - avg_cost = moving_average(cost)
   - avg_duration = moving_average(duration)
3. Adjust success_rate for future recommendations
```

---

## The Bug: Where Execution Goes Wrong

### Current Broken Flow

```
activity({ activityId: "REFACTOR-9c629da6" })
  ↓
ActivityTool.execute()
  ↓
MetabobCLI.startExecution()
  ↓
MCP start_activity_execution_tool
  ↓
ActivityManager.start_execution()
  ↓
POST /v2/activities/record/start  ← ❌ WRONG ENDPOINT
  │
  └─> Backend creates NEW TEMPLATE instead of recording execution
  │
  └─> Returns execution_id but no tasks ever execute
  │
  └─> getNextStep() returns complete=true immediately
  │
  └─> Activity finishes instantly (0.0s, $0 cost)
```

### What Should Happen

```
activity({ activityId: "REFACTOR-9c629da6" })
  ↓
ActivityTool.execute()
  ↓
MetabobCLI.startExecution()
  ↓
MCP start_activity_execution_tool
  ↓
ActivityManager.start_execution()
  ↓
✅ LOCAL STATE: Create ActivityExecution object
✅ BACKEND: POST /v2/activities/executions/start (if tracking enabled)
  ↓
getNextStep(execution_id)
  ↓
✅ Fetch template from backend
✅ Return current_step (ONE task at a time)
  ↓
executeStepWithTracking()
  ↓
✅ Execute task via TaskTool
✅ Sub-agent runs with impulses
✅ Metabob tools available
  ↓
reportStepResult()
  ↓
✅ Record metrics
✅ Update Thompson Sampling
  ↓
Repeat until all tasks complete
```

---

## The Fix

### Root Cause

**File:** `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:524`

```python
# CURRENT (WRONG):
await client.post(
    "/v2/activities/record/start",  # ← This endpoint might create templates
    json={
        "template_id": activity_id,
        "variables": variables or {},
        "session_id": session_id,
        "execution_id": execution_id,
    },
)
```

**Issue:** This endpoint is either:
1. Creating new templates (wrong behavior)
2. Not properly initializing execution state
3. Missing or incorrectly implemented on backend

### Solution Options

#### Option 1: Fix Backend Endpoint (Recommended)

**Backend Change:** Ensure `/v2/activities/record/start` only records execution, never creates templates

```python
# Backend: server/routes/v2_activities.py

@router.post("/record/start")
async def record_execution_start(request: ExecutionStartRequest):
    """
    Record that an activity execution has started.
    
    This should ONLY create an execution record, NEVER create templates.
    Templates are created via POST /v2/activities/templates (separate endpoint).
    """
    execution = {
        "execution_id": request.execution_id,
        "template_id": request.template_id,
        "session_id": request.session_id,
        "variables": request.variables,
        "started_at": datetime.utcnow(),
        "state": "running",
        "step_results": [],
    }
    
    # Store in executions table (NOT activity_variants table)
    await db.insert("executions", execution)
    
    return {"status": "success", "execution_id": request.execution_id}
```

#### Option 2: Remove Backend Call (Simpler)

**CLI Change:** Make execution tracking purely local until backend is fixed

```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

async def start_execution(...):
    execution_id = f"exec_{uuid.uuid4().hex[:12]}"
    
    # Create LOCAL execution state
    execution = ActivityExecution(
        execution_id=execution_id,
        activity_id=activity_id,
        session_id=session_id,
        variant_id=effective_variant_id,
        variables=variables or {},
        cost_budget=cost_budget,
        state=ExecutionState.RUNNING,
    )
    self._executions[execution_id] = execution
    
    logger.info(f"Started execution {execution_id} (local tracking only)")
    
    # SKIP backend recording for now (backend has bug)
    # try:
    #     await client.post("/v2/activities/record/start", ...)
    # except Exception as e:
    #     logger.debug(f"Skipped backend recording: {e}")
    
    return {
        "execution_id": execution_id,
        "activity_id": activity_id,
        "status": execution.state.value,
        "cost_budget": cost_budget,
        "message": "Execution started - call get_next_step for first step",
    }
```

#### Option 3: Use Correct Endpoint

**CLI Change:** Call execution-specific endpoint

```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

async def start_execution(...):
    # ...
    
    # Use proper execution endpoint (not record endpoint)
    try:
        client = await self._get_client()
        response = await client.post(
            "/v2/activities/executions",  # ← Proper endpoint for creating execution
            json={
                "variant_id": effective_variant_id,
                "session_id": session_id,
                "variables": variables or {},
                "cost_budget": cost_budget,
            },
        )
        backend_execution_id = response.json()["execution_id"]
        logger.info(f"Backend execution created: {backend_execution_id}")
    except Exception as e:
        logger.debug(f"Backend execution creation failed: {e}")
    
    # ...
```

### Fixing get_next_step

**File:** `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

```python
async def get_next_step(self, execution_id: str) -> dict:
    """
    Get the next step to execute.
    
    Returns ONLY the current step, not all future steps.
    """
    execution = self._executions.get(execution_id)
    if not execution:
        return {"complete": True, "message": "Execution not found"}
    
    # Fetch template if not cached
    if execution.variant_id not in self._activity_cache:
        template = await self._fetch_template(execution.variant_id)
        self._activity_cache[execution.variant_id] = template
    
    template = self._activity_cache[execution.variant_id]
    tasks = template.get("tasks", [])  # or task_steps depending on schema
    
    # Check if we're done
    if execution.current_step_index >= len(tasks):
        execution.state = ExecutionState.COMPLETED
        return {"complete": True, "message": "All steps completed"}
    
    # Return current step ONLY
    current_task = tasks[execution.current_step_index]
    
    return {
        "complete": False,
        "current_step": {
            "id": current_task["id"],
            "description": current_task["description"],
            "guidance": current_task.get("guidance", []),
            "tools": current_task.get("tools", {}),
            "validation": current_task.get("validation", {}),
        },
        "progress": {
            "current": execution.current_step_index + 1,
            "total": len(tasks),
            "percent": ((execution.current_step_index + 1) / len(tasks)) * 100,
        },
    }
```

### Fixing report_step_result

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
    duration_ms: int = 0,
    tool_calls: list = None,
) -> dict:
    """
    Report step completion and advance to next step.
    """
    execution = self._executions.get(execution_id)
    if not execution:
        return {"status": "error", "message": "Execution not found"}
    
    # Record result
    result = StepResult(
        step_id=step_id,
        success=success,
        output=output if success else None,
        error=error if not success else None,
        cost=cost,
        tokens=tokens,
        duration_ms=duration_ms,
        tool_calls=tool_calls or [],
    )
    execution.step_results.append(result)
    execution.total_cost += cost
    execution.total_tokens += tokens
    
    # Advance to next step if successful
    if success:
        execution.current_step_index += 1
        execution.state = ExecutionState.STEP_COMPLETE
    else:
        execution.state = ExecutionState.FAILED
    
    logger.info(
        f"Step {step_id} reported: {success}, "
        f"next_index={execution.current_step_index}"
    )
    
    # Optionally report to backend
    try:
        client = await self._get_client()
        await client.post(
            f"/v2/activities/executions/{execution_id}/steps",
            json={
                "step_id": step_id,
                "success": success,
                "output": output,
                "error": error,
                "cost": cost,
                "tokens": tokens,
                "duration_ms": duration_ms,
            },
        )
    except Exception as e:
        logger.debug(f"Failed to report to backend: {e}")
    
    return {
        "status": "success",
        "execution_state": execution.state.value,
        "next_step_index": execution.current_step_index,
    }
```

---

## Implementation Plan

### Step 1: Quick Fix (Local-Only Execution) ⚡

**Goal:** Get activities executing without backend dependency

**Changes:**
1. Comment out `/v2/activities/record/start` call in `activity_manager.py`
2. Ensure `get_next_step()` fetches template and returns tasks
3. Ensure `report_step_result()` advances step index

**Time:** 30 minutes  
**Risk:** Low (only affects logging to backend)

### Step 2: Fix Backend Endpoint 🔧

**Goal:** Make backend properly track executions without creating templates

**Changes:**
1. Review `/v2/activities/record/start` endpoint implementation
2. Ensure it creates execution records, not templates
3. Verify template creation only happens via `/v2/activities/templates`

**Time:** 2 hours  
**Risk:** Medium (backend changes)

### Step 3: Test End-to-End 🧪

**Goal:** Verify full execution flow works

**Tests:**
1. Execute Hello World template (should run 3 tasks)
2. Execute Refactor template (should run 4 tasks)
3. Verify metrics collected
4. Verify Thompson Sampling updates

**Time:** 1 hour  
**Risk:** Low (testing only)

### Step 4: Activity Create Testing 🏗️

**Goal:** Prove Activity Create template works correctly

**Tests:**
1. Execute Activity Create template
2. Verify new template is created
3. Execute newly created template
4. Verify end-to-end workflow

**Time:** 1 hour  
**Risk:** Low (after execution fixed)

---

## Success Criteria

### Execution Works ✅

```typescript
activity({
  activityId: "REFACTOR-9c629da6",
  variables: {},
  reason: "Test execution"
})

// Expected:
// - 4 tasks execute sequentially
// - Each task runs in sub-session
// - Duration > 0s (actual work done)
// - Cost > $0 (LLM calls made)
// - Results visible in output
// - NO new templates created
```

### Activity Create Works ✅

```typescript
activity({
  activityId: "INFRASTRUCTURE-0013e379",
  variables: {
    source_pattern: "Test workflow",
    activity_name: "my-custom-activity",
    target_category: "feature"
  },
  reason: "Create new template"
})

// Expected:
// - Activity Create template executes (5 tasks)
// - Tasks generate new template JSON
// - Final task registers template via POST /v2/activities/templates
// - New template appears in search results
// - Template count increases by 1
```

### Learning Loop Active ✅

```typescript
// After execution
const template = await search_activities({ 
  query: "refactor" 
})

// Expected:
// - execution_count incremented
// - avg_cost updated
// - avg_duration updated
// - success_rate reflects result
// - Thompson Sampling alpha/beta adjusted
```

---

## Next Steps

1. ✅ **Document purpose and architecture** (this file)
2. 🔧 **Implement Quick Fix** (comment out backend call)
3. 🧪 **Test execution** with Hello World template
4. 🔍 **Debug if needed** (check logs, verify tasks execute)
5. 📊 **Measure success** (duration, cost, task count)
6. 🏗️ **Test Activity Create** once execution works
7. 📈 **Verify learning** (Thompson Sampling updates)

---

## Summary

**The Activity System is designed to:**
- Execute reusable multi-step workflows
- Learn from execution data via Thompson Sampling
- Provide context via Session Memory + Impulses
- Discover code structure via Metabob tools
- Enable component-level micro-agents with history

**The Bug:**
- Activities are creating templates instead of executing them
- Root cause: Backend call or endpoint behavior
- Fix: Local execution state + proper task iteration

**The Solution:**
- Make ActivityManager manage execution locally
- Fetch templates and iterate through tasks
- Report metrics to backend (optional)
- Verify execution before testing creation

This transforms the activity system from broken to fully operational! 🚀

---

## Critical Realignment: Activities as Instruction Generators

**Added**: February 12, 2026 19:15 PST (Post-Execution Analysis)

### Fundamental Misunderstanding Corrected

After successfully executing activities, we discovered the implementation misunderstands the core concept:

**Activities are NOT**:
- ❌ Hardcoded scripts to execute
- ❌ Fixed workflows with literal prompts
- ❌ Automation that runs the same way every time

**Activities ARE**:
- ✅ **Instruction generation systems** that adapt to context
- ✅ **Learning frameworks** that improve through experimentation
- ✅ **Hypotheses about how to accomplish goals** that get validated/refined
- ✅ **Record-keeping mechanisms** for analyzing what works and why

### The Core Loop We Should Build

```
1. GENERATE INSTRUCTIONS (not execute hardcoded prompts)
   Template + Context + Past Learnings → Dynamic Instructions
   
2. AGENT EXECUTES
   Agent follows generated instructions (not template prompts)
   
3. RECORD EVERYTHING
   Not just success/fail, but: what was tried, what happened, WHY
   
4. AUTOPSY & LEARN
   Analyze: Did it work? Why/why not? Was success measured correctly?
   This is an ACTIVITY ITSELF (meta-learning)
   
5. EVOLVE TEMPLATE
   Update template based on learnings
   Better instruction generation next time
```

### Current Implementation vs. Should Be

**Current (Wrong)**:
```json
{
  "task_steps": [{
    "prompt": {
      "template": "Look at files and extract pattern"  // Literal instruction
    }
  }]
}
```

This is a script. It doesn't learn. It doesn't adapt.

**Correct**:
```json
{
  "instruction_generation": {
    "context_sources": ["parent_conversation", "user_intent", "code_analysis"],
    "learning_from": ["past_executions_tag:template-creation"],
    "adaptation_rules": {
      "if_context_includes": ["api_endpoint"],
      "then_emphasize": ["openapi_schema"],
      "learned_from": "execution_789"
    }
  }
}
```

Template describes HOW to generate instructions, not the instructions themselves.

### Responsibility Split

**metabob-opencode**: Instruction generation and task completion
- Generate instructions dynamically based on template + context + learnings
- Maintain session continuity across steps
- Pass outputs as impulses to next step
- Handle autopsy analysis (analyzing old activities)
- Template creation IS A TASK (like what we're doing now)

**Backend**: Experimentation and record-keeping
- Store: what was tried, what happened, full context
- Enable querying: "What worked for similar contexts?"
- Track variants and success rates
- Provide data for instruction generation

### This Conversation as Meta-Example

**What we're doing RIGHT NOW** is what the system should do automatically:

1. ✅ Execute activity (activity-create, hello-world)
2. ✅ Observe outcome (worked, but wrong architecture)
3. ✅ Perform autopsy (identify issues: filesystem reads, no context flow, session per step, no TUI)
4. ✅ Identify root causes (impulse system not used, hardcoded prompts)
5. ✅ Suggest improvements (instruction generation, learning loop)
6. ⏳ Update implementation
7. ⏳ Validate improvements work

Steps 1-5 should be an ACTIVITY that analyzes other activities!

### Key Insight: Generalization

"We are supposed to be able to generalize the concept of an activity to manage any arbitrary code execution via instruction generation through the experimentation and record keeping provided by the backend."

This means:
- ✅ Activities aren't workflows, they're instruction generators
- ✅ Each execution is an experiment that teaches the system
- ✅ Templates evolve based on what we learn
- ✅ Autopsy (what we're doing now) is itself an activity
- ✅ System continuously improves through experimentation

### Immediate Fixes Needed

**Priority 1: Context Flow**
- Pass parent agent context as impulses (not just variables)
- Maintain single session across steps (outputs become impulses)
- Remove filesystem dependencies (use impulse system)

**Priority 2: Instruction Generation**
- Templates describe "how to generate" not "what to execute"
- metabob-opencode builds InstructionGenerator
- Dynamic instruction creation based on context + learnings

**Priority 3: Learning Infrastructure**
- Backend records full execution context (not just metrics)
- Enable autopsy analysis queries
- Build activity-analyzer (can be an activity itself!)

**Priority 4: TUI Integration**
- Stream activity progress
- Show instruction generation happening
- Display learning/adaptation in real-time

### The Goal

Transform from:
```
"Run this script" → Execute → Report success/fail
```

To:
```
"Learn how to do this" → Generate instructions → Execute → Record → Analyze → Improve → Repeat
```

This is the difference between automation and learning.

