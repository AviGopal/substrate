# Architecture Quick Reference - Component Roles

**Last Updated**: February 14, 2026  
**Status**: ✅ Verified via code inspection

---

## Component Roles (One-Liner)

| Component | Role | Analogy |
|-----------|------|---------|
| **metabob-rpc-api** | Library | Stores templates, remembers outcomes |
| **metabob-cli** | Choreographer | Decides which step comes next |
| **metabob-opencode** | Dancer | Executes the given step |

---

## Responsibility Matrix

| Task | metabob-rpc-api | metabob-cli | metabob-opencode |
|------|-----------------|-------------|------------------|
| **Store activity templates** | ✅ YES | ❌ No | ❌ No |
| **Select variant (Thompson Sampling)** | ✅ YES | ❌ No | ❌ No |
| **Decide WHICH step to deliver** | ❌ No | ✅ YES | ❌ No |
| **Maintain execution state** | ❌ No | ✅ YES | ❌ No |
| **Generate trailblazing steps** | ❌ No | ✅ YES | ❌ No |
| **Execute LLM sessions** | ❌ No | ❌ No | ✅ YES |
| **Run tool calls (bash, edit, etc.)** | ❌ No | ❌ No | ✅ YES |
| **Interpolate prompts** | ❌ No | ❌ No | ✅ YES |
| **Record execution history** | ✅ YES | ❌ No | ❌ No |
| **Update learning (alpha/beta)** | ✅ YES | ❌ No | ❌ No |

---

## Data Flow (Simplified)

```
1. OpenCode → CLI:    "Start activity X with variables Y"
2. CLI → Backend:     "Thompson Sampling: select variant"
3. CLI (internal):    Create ActivityExecution state
4. Loop:
   a. OpenCode → CLI:    "Get next step"
   b. CLI → Backend:     "Load template" (if not cached)
   c. CLI (internal):    Select tasks[current_step_index]
   d. CLI → OpenCode:    "Execute step N: {prompt, tools, validation}"
   e. OpenCode (internal): Run LLM, execute tools, collect metrics
   f. OpenCode → CLI:    "Step N done: {success, cost, tokens}"
   g. CLI (internal):    current_step_index++
5. CLI (internal):    Run validation (if all steps done)
6. CLI → Backend:     "Record outcome + update learning"
```

---

## MCP Tools (Orchestration)

These tools expose CLI's orchestration capabilities:

| Tool | Purpose | Called By |
|------|---------|-----------|
| `start_activity_execution` | Create execution state | OpenCode |
| `get_next_step` | Get current step to execute | OpenCode |
| `report_step_result` | Report metrics, advance state | OpenCode |
| `enter_trailblazing` | Generate fix steps | OpenCode |
| `get_execution_state` | Check execution status | OpenCode |

---

## Key Architectural Patterns

### 1. Incremental Step Delivery ✅
- OpenCode **never sees the full template**
- CLI returns **one step at a time**
- Agent can't "skip ahead" or see future steps

### 2. Orchestrator-Executor Split ✅
- **CLI = Policy** (what to do next)
- **OpenCode = Mechanism** (how to execute it)
- Clear separation of concerns

### 3. State Split ✅
- **CLI memory**: In-flight execution state (current_step_index, step_results)
- **Backend storage**: Historical data (templates, execution records)
- Both needed for full system operation

### 4. MCP as Protocol ✅
- All orchestration happens via MCP tool calls
- OpenCode doesn't call backend directly
- CLI is the orchestration hub

---

## Common Misconceptions (FIXED)

| Misconception | Reality | Evidence |
|---------------|---------|----------|
| "CLI doesn't orchestrate" | CLI IS the orchestrator | MCP tools: start, get_next_step, report |
| "OpenCode decides step order" | CLI decides step order | CLI maintains current_step_index |
| "Backend orchestrates execution" | Backend only stores data | No orchestration logic in v2_activities.py |
| "OpenCode sees all steps upfront" | OpenCode sees ONE step at a time | get_next_step returns current_step only |
| "Trailblazing is in backend" | Trailblazing is in CLI | enter_trailblazing in activity_manager.py |

---

## Files to Check for Evidence

**CLI Orchestration**:
- `repos/metabob-cli/src/metabob_cli/mcp/tools.py` - MCP tool definitions
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` - Orchestration logic

**OpenCode Execution**:
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` - MCP client calls
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` - Step execution

**Backend Storage**:
- `repos/metabob-rpc-api/server/routes/v2_activities.py` - API endpoints

---

## Terminology Guide

| Term | Meaning | Component |
|------|---------|-----------|
| **Orchestration** | Deciding WHICH step to deliver next | CLI |
| **Execution** | Running the LLM session for a given step | OpenCode |
| **Step Delivery** | Incremental delivery of steps one at a time | CLI → OpenCode |
| **ActivityExecution** | In-memory state tracking execution progress | CLI |
| **Trailblazing** | Dynamic fix generation when validation fails | CLI |
| **Thompson Sampling** | Variant selection and learning | Backend |

---

## Design Rationale

### Why This Architecture?

**Benefits**:
1. ✅ **Execution Isolation**: CLI can send steps to containers, remote agents, or OpenCode
2. ✅ **Stateless Executor**: OpenCode doesn't track multi-step state (simpler)
3. ✅ **Incremental Delivery**: Agent can't see future steps (security, control)
4. ✅ **Centralized Trailblazing**: Fix generation in one place (easier to improve)

**Tradeoffs**:
1. ⚠️ **More Network Hops**: OpenCode ↔ CLI ↔ Backend (3 components)
2. ⚠️ **Split State**: In-flight (CLI) vs historical (Backend) requires sync
3. ⚠️ **Harder Debugging**: Flow crosses component boundaries

---

## Quick Diagnostic Commands

### Check MCP Tools Available
```bash
cd repos/metabob-cli
grep "@mcp.tool" src/metabob_cli/mcp/*.py | wc -l
# Should show 30+ tools
```

### Check Orchestration Tools
```bash
cd repos/metabob-cli
grep -E "@mcp.tool.*(start_activity|get_next_step|report_step)" \
  src/metabob_cli/mcp/tools.py
# Should show start_activity_execution, get_next_step, report_step_result
```

### Check OpenCode Calls MCP Tools
```bash
cd repos/metabob-opencode
grep -n "callMCPTool.*activity" packages/opencode/src/util/metabob.ts
# Should show calls to start_activity_execution, get_next_step, report_step_result
```

### Check ActivityExecution State
```bash
cd repos/metabob-cli
grep -A10 "class ActivityExecution" src/metabob_cli/mcp/activity_manager.py
# Should show current_step_index, state, step_results fields
```

---

## Related Documentation

- **Detailed Analysis**: `ARCHITECTURE_RESPONSIBILITY_BOUNDARY_ANALYSIS_FEB14.md`
- **Sequence Diagrams**: `ACTIVITY_EXECUTION_FLOW_SEQUENCE_DIAGRAM.md`
- **Session Summary**: `SESSION_COMPLETE_FEB14_ARCHITECTURE_INVESTIGATION.md`
- **To Be Updated**: `ARCHITECTURE_SEPARATION_OF_CONCERNS.md` (add orchestration role)

---

## Truth Standard

This reference is based on:
- ✅ Actual code inspection (not assumptions)
- ✅ MCP tool enumeration (grep verification)
- ✅ Data structure analysis (ActivityExecution object)
- ✅ Function call tracing (OpenCode → CLI → Backend)

**Confidence Level**: HIGH - All claims verified via code
