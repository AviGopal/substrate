# Activity Execution Flow - Sequence Diagram

**Date**: February 14, 2026  
**Purpose**: Visualize actual MCP tool calls and data flow during activity execution  
**Based On**: Code inspection of metabob-opencode, metabob-cli, metabob-rpc-api

---

## Sequence Diagram: Normal Activity Execution

```
User                OpenCode            metabob-cli         metabob-rpc-api
 │                     │                     │                      │
 │  activity(...)      │                     │                      │
 ├────────────────────>│                     │                      │
 │                     │                     │                      │
 │                     │ 1. MCP: start_activity_execution          │
 │                     ├────────────────────>│                      │
 │                     │   {activity_id,     │                      │
 │                     │    session_id,      │                      │
 │                     │    variables,       │                      │
 │                     │    cost_budget}     │                      │
 │                     │                     │                      │
 │                     │                     │  Thompson Sampling   │
 │                     │                     │  variant selection   │
 │                     │                     ├─────────────────────>│
 │                     │                     │                      │
 │                     │                     │<─────────────────────┤
 │                     │                     │  {variant_id}        │
 │                     │                     │                      │
 │                     │                     │  POST /v2/activities/record/start
 │                     │                     ├─────────────────────>│
 │                     │                     │                      │
 │                     │                     │<─────────────────────┤
 │                     │                     │  {execution_id}      │
 │                     │                     │                      │
 │                     │  Creates:           │                      │
 │                     │  ActivityExecution{ │                      │
 │                     │    execution_id,    │                      │
 │                     │    variant_id,      │                      │
 │                     │    current_step: 0, │                      │
 │                     │    state: RUNNING   │                      │
 │                     │  }                  │                      │
 │                     │                     │                      │
 │                     │<────────────────────┤                      │
 │                     │  {execution_id,     │                      │
 │                     │   state,            │                      │
 │                     │   variant_id}       │                      │
 │                     │                     │                      │
 │  ┌─────────────────────────── STEP LOOP ──────────────────────┐ │
 │  │                 │                     │                      │ │
 │  │                 │ 2. MCP: get_next_step                     │ │
 │  │                 ├────────────────────>│                      │ │
 │  │                 │   {execution_id}    │                      │ │
 │  │                 │                     │                      │ │
 │  │                 │                     │  Load template       │ │
 │  │                 │                     │  (if not cached)     │ │
 │  │                 │                     ├─────────────────────>│ │
 │  │                 │                     │  GET /v2/activities/ │ │
 │  │                 │                     │      templates/{id}  │ │
 │  │                 │                     │                      │ │
 │  │                 │                     │<─────────────────────┤ │
 │  │                 │                     │  {tasks: [...]}      │ │
 │  │                 │                     │                      │ │
 │  │                 │                     │  Select step:        │ │
 │  │                 │                     │  tasks[current_step_index]
 │  │                 │                     │                      │ │
 │  │                 │<────────────────────┤                      │ │
 │  │                 │  {current_step: {   │                      │ │
 │  │                 │    id,              │                      │ │
 │  │                 │    description,     │                      │ │
 │  │                 │    prompt: {        │                      │ │
 │  │                 │      template,      │                      │ │
 │  │                 │      variables      │                      │ │
 │  │                 │    },               │                      │ │
 │  │                 │    tools,           │                      │ │
 │  │                 │    validation       │                      │ │
 │  │                 │  },                 │                      │ │
 │  │                 │  complete: false}   │                      │ │
 │  │                 │                     │                      │ │
 │  │                 │  Interpolate prompt │                      │ │
 │  │                 │  with variables     │                      │ │
 │  │                 │                     │                      │ │
 │  │                 │  Execute LLM:       │                      │ │
 │  │                 │  - Run agent session│                      │ │
 │  │                 │  - Call tools (bash,│                      │ │
 │  │                 │    edit, read, etc) │                      │ │
 │  │                 │  - Collect metrics  │                      │ │
 │  │                 │                     │                      │ │
 │  │  [Progress]     │                     │                      │ │
 │  │<────────────────┤                     │                      │ │
 │  │  "Step 1/4..."  │                     │                      │ │
 │  │                 │                     │                      │ │
 │  │                 │ 3. MCP: report_step_result                │ │
 │  │                 ├────────────────────>│                      │ │
 │  │                 │   {execution_id,    │                      │ │
 │  │                 │    step_id,         │                      │ │
 │  │                 │    success: true,   │                      │ │
 │  │                 │    output,          │                      │ │
 │  │                 │    cost,            │                      │ │
 │  │                 │    tokens,          │                      │ │
 │  │                 │    tool_calls,      │                      │ │
 │  │                 │    impulses_loaded, │                      │ │
 │  │                 │    impulses_created}│                      │ │
 │  │                 │                     │                      │ │
 │  │                 │                     │  POST /v2/activities/record/step
 │  │                 │                     ├─────────────────────>│ │
 │  │                 │                     │  {execution_id,      │ │
 │  │                 │                     │   step_order,        │ │
 │  │                 │                     │   success,           │ │
 │  │                 │                     │   duration_ms,       │ │
 │  │                 │                     │   cost,              │ │
 │  │                 │                     │   tokens}            │ │
 │  │                 │                     │                      │ │
 │  │                 │                     │<─────────────────────┤ │
 │  │                 │                     │  {recorded: true}    │ │
 │  │                 │                     │                      │ │
 │  │                 │                     │  Update:             │ │
 │  │                 │                     │  - step_results.append()
 │  │                 │                     │  - total_cost += cost│ │
 │  │                 │                     │  - current_step_index++
 │  │                 │                     │                      │ │
 │  │                 │<────────────────────┤                      │ │
 │  │                 │  {continue: true,   │                      │ │
 │  │                 │   next_step_index}  │                      │ │
 │  │                 │                     │                      │ │
 │  └────────────────────── REPEAT IF MORE STEPS ────────────────┘ │
 │                     │                     │                      │
 │                     │ 4. MCP: get_next_step (final check)       │
 │                     ├────────────────────>│                      │
 │                     │                     │                      │
 │                     │                     │  Check:              │
 │                     │                     │  current_step_index  │
 │                     │                     │  >= len(tasks)?      │
 │                     │                     │  YES → Run validation│
 │                     │                     │                      │
 │                     │                     │  Run validation cmds │
 │                     │                     │  (if defined)        │
 │                     │                     │                      │
 │                     │<────────────────────┤                      │
 │                     │  {complete: true,   │                      │
 │                     │   validation_passed}│                      │
 │                     │                     │                      │
 │                     │ 5. MCP: report_step_result (final)        │
 │                     ├────────────────────>│                      │
 │                     │   {success: true}   │                      │
 │                     │                     │                      │
 │                     │                     │  POST /v2/activities/record/complete
 │                     │                     ├─────────────────────>│ │
 │                     │                     │  {execution_id,      │ │
 │                     │                     │   success: true,     │ │
 │                     │                     │   total_cost,        │ │
 │                     │                     │   total_tokens,      │ │
 │                     │                     │   outcomes}          │ │
 │                     │                     │                      │ │
 │                     │                     │  Thompson Sampling:  │ │
 │                     │                     │  Update alpha/beta   │ │
 │                     │                     │  for variant_id      │ │
 │                     │                     │                      │ │
 │                     │                     │<─────────────────────┤ │
 │                     │                     │                      │ │
 │                     │<────────────────────┤                      │
 │                     │  {completed: true}  │                      │
 │                     │                     │                      │
 │  Activity Complete  │                     │                      │
 │<────────────────────┤                     │                      │
 │  {success, metrics} │                     │                      │
 │                     │                     │                      │
```

---

## Sequence Diagram: Trailblazing Flow (Validation Failure)

```
User                OpenCode            metabob-cli         metabob-rpc-api
 │                     │                     │                      │
 │  [Steps 1-3 same as normal execution]     │                      │
 │                     │                     │                      │
 │                     │ get_next_step       │                      │
 │                     ├────────────────────>│                      │
 │                     │                     │                      │
 │                     │                     │  All steps complete, │
 │                     │                     │  run validation:     │
 │                     │                     │  $ npm test          │
 │                     │                     │  Exit code: 1 ❌     │
 │                     │                     │                      │
 │                     │<────────────────────┤                      │
 │                     │  {complete: false,  │                      │
 │                     │   trailblazing: true│                      │
 │                     │   validation_error} │                      │
 │                     │                     │                      │
 │  [Show validation   │                     │                      │
 │   failure to user]  │                     │                      │
 │<────────────────────┤                     │                      │
 │                     │                     │                      │
 │                     │ MCP: enter_trailblazing                    │
 │                     ├────────────────────>│                      │
 │                     │   {execution_id,    │                      │
 │                     │    failure_context, │                      │
 │                     │    max_cost: 0.5}   │                      │
 │                     │                     │                      │
 │                     │                     │  Generate fix step:  │
 │                     │                     │  - Analyze failure   │
 │                     │                     │  - Create targeted   │
 │                     │                     │    fix prompt        │
 │                     │                     │                      │
 │                     │                     │  Update state:       │
 │                     │                     │  - state = TRAILBLAZING
 │                     │                     │  - trailblazing_attempts++
 │                     │                     │                      │
 │                     │<────────────────────┤                      │
 │                     │  {trailblaze_step:{ │                      │
 │                     │    id,              │                      │
 │                     │    description,     │                      │
 │                     │    prompt,          │                      │
 │                     │    cost_limit       │                      │
 │                     │  }}                 │                      │
 │                     │                     │                      │
 │                     │  Execute fix step   │                      │
 │                     │  (same as normal    │                      │
 │                     │   step execution)   │                      │
 │                     │                     │                      │
 │                     │ report_step_result  │                      │
 │                     ├────────────────────>│                      │
 │                     │                     │                      │
 │                     │                     │  Re-run validation:  │
 │                     │                     │  $ npm test          │
 │                     │                     │  Exit code: 0 ✅     │
 │                     │                     │                      │
 │                     │<────────────────────┤                      │
 │                     │  {complete: true,   │                      │
 │                     │   validation_passed}│                      │
 │                     │                     │                      │
 │  [Continue with completion steps...]      │                      │
 │                     │                     │                      │
```

---

## Data Flow Summary

### Phase 1: Initialization (Once per Activity)

```
OpenCode → CLI:          start_activity_execution(activity_id, variables)
CLI → Backend:           Thompson Sampling → select variant
CLI → Backend:           POST /v2/activities/record/start
Backend → CLI:           execution_id
CLI → OpenCode:          execution_id, variant_id, state
```

**CLI State Created**:
```python
ActivityExecution {
  execution_id: "exec-abc123"
  variant_id: "add-feature-v2"
  current_step_index: 0
  state: RUNNING
  step_results: []
  total_cost: 0.0
  total_tokens: 0
}
```

### Phase 2: Step Execution Loop (Repeats for Each Step)

```
OpenCode → CLI:          get_next_step(execution_id)
CLI → Backend:           GET /v2/activities/templates/{variant_id} [if not cached]
CLI (internal):          Select tasks[current_step_index]
CLI → OpenCode:          current_step {...}, complete: false

OpenCode (internal):     Interpolate prompt with variables
OpenCode (internal):     Execute LLM session
OpenCode (internal):     Run tool calls (bash, edit, etc.)
OpenCode (internal):     Collect metrics

OpenCode → CLI:          report_step_result(execution_id, metrics)
CLI → Backend:           POST /v2/activities/record/step
CLI (internal):          current_step_index++
CLI → OpenCode:          continue: true, next_step_index
```

**Repeat until**: `current_step_index >= len(tasks)`

### Phase 3: Validation & Completion

```
OpenCode → CLI:          get_next_step(execution_id)
CLI (internal):          All steps done → run validation commands
CLI (internal):          If validation fails → return trailblazing: true
CLI (internal):          If validation passes → return complete: true
CLI → OpenCode:          {complete: true | trailblazing: true}

[If complete=true]
OpenCode → CLI:          report_step_result (final)
CLI → Backend:           POST /v2/activities/record/complete
Backend (internal):      Update Thompson Sampling priors (alpha/beta)
CLI → OpenCode:          {completed: true}

[If trailblazing=true]
OpenCode → CLI:          enter_trailblazing(execution_id, failure_context)
CLI (internal):          Generate fix step dynamically
CLI → OpenCode:          trailblaze_step {...}
[Return to Phase 2 for fix step execution]
```

---

## Key Observations

### 1. Incremental Step Delivery ✅
- OpenCode **never sees the full template**
- CLI returns **ONLY current step** via get_next_step
- Prevents prompt leakage and maintains control

### 2. State Ownership ✅
- **CLI owns**: `current_step_index`, `state`, `step_results`
- **Backend owns**: Template definitions, execution history, learning data
- **OpenCode owns**: LLM session, tool execution, user interaction

### 3. MCP as Communication Protocol ✅
- All orchestration happens via MCP tool calls
- OpenCode doesn't call backend directly (goes through CLI)
- Clear boundary: MCP tools are the contract

### 4. Trailblazing Generation ✅
- CLI generates fix steps **dynamically**
- Not pre-defined in template
- Based on validation failure context

### 5. Thompson Sampling Integration ✅
- Variant selection happens at START
- Learning feedback happens at COMPLETE
- OpenCode doesn't know variants exist (just executes given variant)

---

## Component Roles (VERIFIED)

| Component | Role | Analogy |
|-----------|------|---------|
| **metabob-rpc-api** | Library | Stores books, remembers what works |
| **metabob-cli** | Choreographer | Decides which dance move comes next |
| **metabob-opencode** | Dancer | Executes the move, shows the performance |

**Flow**: Choreographer checks Library for dance routine, tells Dancer one move at a time, Dancer performs it, reports back, repeat.

---

## Documentation Gap

**Current docs say**: "metabob-cli provides tools, doesn't orchestrate"  
**Reality**: "metabob-cli IS the orchestrator via MCP tools"

**Fix Needed**: Update architecture docs to show:
1. CLI as step orchestrator (not just tool provider)
2. MCP tools for orchestration (start, get_next_step, report)
3. ActivityExecution state management in CLI
4. Trailblazing generation in CLI

---

## Next Steps

1. ✅ **This Diagram** - Visualize actual flow
2. 🔄 **Update ARCHITECTURE_SEPARATION_OF_CONCERNS.md** - Add orchestration role to CLI
3. 🔄 **Add this diagram to docs** - Reference for developers
4. 🔄 **Verify with live trace** - Run activity with logging to confirm

**No code changes needed** - architecture is correct, docs need updating.
