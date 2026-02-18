# Architecture Quick Reference - Component Roles

**Last Updated**: February 18, 2026  
**Status**: ✅ Verified via runtime testing and code inspection

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

---

## Context Management System (VERIFIED 2026-02-18)

### **Two-Tier Context Architecture**

OpenCode uses a **separation of concerns** between static and dynamic context:

```
┌────────────────────────────────────────────────────┐
│           Tier 1: Static System Context            │
│  SystemPrompt.environment() - src/session/system.ts│
│  • Working directory, git status, platform info    │
│  • Remote context (if applicable)                  │
│  • Project structure                               │
│  • Consistent across turns                         │
└────────────────────────────────────────────────────┘
                       +
┌────────────────────────────────────────────────────┐
│        Tier 2: Dynamic Ephemeral Context           │
│  ImpulseFormatter - src/session/impulse-formatter.ts│
│  • Loaded impulses (high/medium/low priority)      │
│  • Budget-limited (10K tokens default)             │
│  • Created per-turn based on session state         │
│  • Metabob annotations, file contents, bash output │
│  • Injected as separate system message             │
└────────────────────────────────────────────────────┘
```

### **Integration Point**

**File**: `src/session/prompt.ts` lines 1573, 1745

```typescript
// Load impulse context (ephemeral - not stored in messages)
const impulseContext = await ImpulseFormatter.formatImpulseContext({
  sessionID: input.sessionID,
  maxTokens: 10000,
})

// Add to model messages
messages: buildModelMessages({
  system,          // Static system prompt (Tier 1)
  messages: msgs,  // Conversation history
  impulseContext,  // Dynamic context (Tier 2) ← HERE
})
```

### **Memory Agent (Automatic Context Preparation)**

**Status**: 🟡 Partially Verified (infrastructure exists, some tests failing)

**Flow**:
1. **Turn Lifecycle Hook** (priority 10, runs before main agent)
   - File: `src/session/turn-lifecycle-hooks.ts` lines 20-106
   - Checks: `sessionMemory.enabled`, `agent.mode === "primary"`, `promptText > 10 chars`
   - Executes: `manage-session-memory` activity template

2. **Memory Management Activity** (5 tasks)
   - Template: `packages/opencode/templates/built-in/manage-session-memory.json`
   - Task 1: Analyze user intent (classify: code_fix, feature_request, question, etc.)
   - Task 2: Create impulses (unloaded state, pointers only)
   - Task 3: Review context space, decide what to load (60-70% utilization target)
   - Task 4: Optimize if >75% utilization (compress, reorder priorities)
   - Task 5: Finalize context, confirm ready

3. **Impulse Storage**
   - API: `SessionMemory.addImpulse()`, `listImpulses()`, `updateImpulse()`
   - Storage: `~/.local/share/opencode/storage/session-memory/${sessionID}`
   - Events: `session.memory.updated`, `session.impulse.updated`

4. **Context Injection**
   - Formatter: `ImpulseFormatter.formatImpulseContext()` produces `<session_memory>` markdown
   - Injection: Added as system message in `buildModelMessages()`
   - Budget: Default 10,000 tokens max

### **Impulse Types (12 supported)**

| Type | Purpose | Example |
|------|---------|---------|
| `memo` | Inline text content | Error messages, notes |
| `file` | Source code files | `{ path: "src/tool/bash.ts", offset: 100, limit: 50 }` |
| `component` | Specific function/class | `{ file: "src/auth.ts", name: "authenticate" }` |
| `commit` | Git commit diff | `{ hash: "abc123" }` |
| `metabobIssue` | Code quality issue | `{ issueId: "issue-xyz" }` |
| `metabobAnnotation` | Component design decision | `{ file: "...", component: "..." }` |
| `activityOutput` | Previous activity result | `{ activityId: "act_xyz", taskId: "task-1" }` |
| `bashOutput` | Dynamic command output | `{ command: "tail -n 50 logs/app.log" }` |
| `templateDefinition` | Activity template | `{ definition: {...}, source: "conversation" }` |
| `activityRecommendation` | Suggested templates | `{ context: "...", limit: 5 }` |
| `remoteSession` | Remote agent context | `{ remoteSessionId: "...", target: "..." }` |
| `custom` | Extensible resolver | `{ resolver: "metabob-priorities", data: {...} }` |

### **Configuration**

In `opencode.json`:
```json
{
  "sessionMemory": {
    "enabled": true,
    "maxImpulsesPerTurn": 5,
    "budgets": {
      "perImpulse": 2000,
      "perTurn": 10000,
      "contextInjection": 10000
    },
    "analysis": {
      "provider": "anthropic",
      "model": "claude-3-5-haiku-20241022",
      "timeout": 3000
    }
  }
}
```

### **Verification Status**

| Component | Status | Evidence |
|-----------|--------|----------|
| Impulse storage | ✅ Works | Tests pass, execution traces show real impulses created |
| Impulse formatting | ✅ Works | `session-memory-injection.test.ts` now passing (5/5) |
| Context injection | ✅ Works | Verified in `SessionPrompt.prompt()` integration |
| Turn lifecycle hook | ✅ Registered | Code inspection confirms hook registration |
| Memory agent template | ✅ Exists | `manage-session-memory.json` verified |
| End-to-end flow | ⚠️ Partial | Some tests passing, 2/3 failing in `impulse-system-e2e` |
| Real-world usage | ❓ Unclear | Needs manual CLI testing |

**See**: `MEMORY_AGENT_ARCHITECTURE_VERIFIED.md` for complete analysis

---

## Verification Methodology (LEARNED 2026-02-18)

### **Three Levels Required**

1. ✅ **Code Exists** (Static Analysis)
   - Read implementation code
   - Check schemas, types, function signatures
   - Shows: Design intent, structure
   - Does NOT prove: Functionality, integration

2. ✅ **Tests Pass** (Dynamic Verification)
   - Run test suite
   - Check execution traces
   - Shows: Runtime behavior, actual integration
   - Proves: Code works as tested

3. ✅ **Real Usage** (Production Validation)
   - Use feature in real scenarios
   - Monitor logs, metrics, errors
   - Shows: Production readiness, edge cases
   - Proves: Feature works end-to-end

### **Key Insight**

> "Simply looking at the code is never sufficient to determine functionality."

**Why**:
- Code shows intent, not reality
- Tests can be outdated or wrong
- Integration gaps hidden without runtime verification
- Only running tests proves actual behavior

**Process**:
1. Read code (understand design)
2. Read tests (understand expectations)
3. **RUN tests** (verify reality) ← CRITICAL
4. Check traces (confirm usage)
5. Compare sources (identify gaps)
6. Make decisions (fix tests OR code)

---
