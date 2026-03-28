# Component Purpose Verification - Three-Component Architecture

**Date**: February 14, 2026  
**Method**: Code inspection + documentation comparison  
**Components Analyzed**: metabob-opencode, metabob-cli, metabob-rpc-api

---

## Executive Summary

| Component | Stated Purpose | Actual Implementation | Verdict |
|-----------|----------------|----------------------|---------|
| **metabob-opencode** | Activity execution engine + CLI | ✅ Matches | Correct |
| **metabob-cli** | MCP tool provider + background analysis | ⚠️ **Partial mismatch** | Issues found |
| **metabob-rpc-api** | Backend API + storage + learning | ✅ Matches | Correct |

**Key Finding**: metabob-cli has **architectural confusion** - it both provides MCP tools AND manages activity execution state, violating separation of concerns.

---

## Component Analysis

### 1. metabob-opencode (Execution Engine)

#### Stated Purpose (from ARCHITECTURE_SEPARATION_OF_CONCERNS.md)

**What it does**:
- ✓ Parses and validates activity templates
- ✓ Resolves context requirements → impulses
- ✓ Executes task dependency graphs
- ✓ Delegates tasks to specialized agents
- ✓ Coordinates cross-repo activities via ACP
- ✓ Integrates MCP tools from metabob-cli
- ✓ Provides terminal UI for user interaction
- ✓ Manages session state and conversation history

**What it does NOT do**:
- ✗ Store activity templates in database
- ✗ Perform code analysis (delegates to metabob-cli)
- ✗ Run LLM inference (uses AI SDK with provider APIs)
- ✗ Manage backend infrastructure

#### Actual Implementation

**File**: `packages/opencode/src/util/metabob.ts`
```typescript
// Lines 286-350: callMCPTool function
export namespace MetabobCLI {
  async function callMCPTool<T>(
    toolName: string,
    args: Record<string, any>,
    sessionID?: string,
  ): Promise<T | undefined> {
    // Get MCP client
    const clients = await MCP.clients()
    const metabobClient = clients["metabob"]
    
    // Call metabob-cli MCP server
    const result = await metabobClient.callTool({ name: toolName, arguments: args })
    return result.content
  }
}
```

**File**: `packages/opencode/src/util/metabob-api.ts`
```typescript
// Lines 1-23: DEPRECATED marker
/**
 * Direct HTTP client for Metabob RPC API
 * 
 * DEPRECATED: Direct HTTP communication should NOT be used for template operations.
 * All template/activity operations MUST go through metabob-cli MCP server.
 * 
 * Correct Architecture:
 * opencode → metabob-cli (MCP) → metabob-rpc-api (backend)
 */
```

**Verification**: ✅ **MATCHES STATED PURPOSE**

Evidence:
- Uses MCP.clients() to get metabob-cli connection (line 294-304 in metabob.ts)
- Explicitly deprecated direct HTTP calls (metabob-api.ts)
- Calls tools via MCP: search_codebase_issues, mark_problem_complete, etc.
- Does NOT implement code analysis internally

**Data Flow (Actual)**:
```
User Input → OpenCode CLI (metabob.ts)
    ↓
    callMCPTool("search_codebase_issues", args)
    ↓
MCP Client → metabob-cli MCP Server
    ↓
Results → OpenCode → User
```

---

### 2. metabob-cli (MCP Tool Provider + ??)

#### Stated Purpose (from ARCHITECTURE_SEPARATION_OF_CONCERNS.md)

**What it does**:
- ✓ Provides MCP server for code analysis tools
- ✓ Runs background analysis engine
- ✓ Maintains CPG (Code Property Graph)
- ✓ Detects priority issues based on session context
- ✓ Caches analysis results for instant queries
- ✓ Calls metabob-rpc-api for actual analysis

**What it does NOT do**:
- ✗ Execute activity templates
- ✗ Orchestrate agents
- ✗ Manage user sessions
- ✗ Store activity variants

#### Actual Implementation

**File**: `src/metabob_cli/mcp/tools.py`
```python
# Lines 128-150: MCP server setup
mcp = FastMCP("Metabob Agent Assistant")

@mcp.tool()
async def search_codebase_issues(query: str, limit: int = 10) -> str:
    """Search for code quality issues using semantic similarity."""
    # Tool implementation...
```

**So far so good** - Provides MCP tools as documented.

**BUT THEN**:

**File**: `src/metabob_cli/mcp/activity_manager.py`
```python
# Lines 1-23: Module docstring
"""
Activity Manager - Metabob-CLI Activity Specification Management

This module is the single source of truth for activity specifications.
It manages:
- Activity/template storage and retrieval via the backend API
- Incremental step delivery (agents don't see all steps upfront)
- Execution state tracking per session
- Trailblazing mode for failed validations

Architecture:
- OpenCode session memory agent configures activities via impulses
- Executing agent receives steps one at a time as messages
- On validation failure, trailblazing generates additional steps within cost budget
"""

# Lines 78-100: ActivityExecution dataclass
@dataclass
class ActivityExecution:
    """Tracks state of an executing activity"""
    execution_id: str
    activity_id: str
    session_id: str
    current_step_index: int = 0
    state: ExecutionState = ExecutionState.PENDING
    step_results: list[StepResult] = field(default_factory=list)
    total_cost: float = 0.0
    trailblazing_attempts: int = 0
    # ... execution tracking state ...
```

**Verification**: ⚠️ **CONTRADICTS STATED PURPOSE**

**Architectural Violation**:
```
DOCUMENTED:     metabob-cli provides tools only
ACTUAL:         metabob-cli ALSO manages activity execution state

This violates "metabob-cli does NOT execute activity templates"
```

**Evidence of Confusion**:

1. **activity_manager.py** contains:
   - ExecutionState tracking
   - Step result management
   - Trailblazing logic
   - Session-to-execution mapping

2. **Stated in code comments** (activity_manager.py:12-14):
   > "Executing agent receives steps one at a time as messages"
   
   This implies metabob-cli is orchestrating step delivery, but docs say:
   > "metabob-opencode executes task dependency graphs"

3. **Execution tracking** (activity_manager.py:78-100):
   ```python
   class ActivityExecution:
       current_step_index: int = 0
       state: ExecutionState = ExecutionState.PENDING
       step_results: list[StepResult] = field(default_factory=list)
   ```
   
   This is ORCHESTRATION state, not tool state.

**Root Cause**: Two competing mental models coexisting:

**Model A (Documented)**:
```
metabob-opencode: Executes activities (orchestration)
metabob-cli: Provides tools (passive service)
```

**Model B (Implemented)**:
```
metabob-opencode: ??? (unclear)
metabob-cli: Executes activities AND provides tools
```

---

### 3. metabob-rpc-api (Backend Service)

#### Stated Purpose (from ARCHITECTURE_SEPARATION_OF_CONCERNS.md)

**What it does**:
- ✓ Stores activity variants in SurrealDB
- ✓ Processes code analysis jobs (Celery)
- ✓ Provides WebSocket real-time updates
- ✓ Manages LLM inference (OpenAI/vLLM)
- ✓ Tracks performance metrics
- ✓ Implements Thompson sampling for A/B testing
- ✓ Provides /activity/register endpoint

**What it does NOT do**:
- ✗ Execute activity templates directly
- ✗ Provide terminal UI
- ✗ Orchestrate multi-step workflows
- ✗ Manage MCP servers

#### Actual Implementation

**File**: `server/routes/v2_activities.py`
```python
# Lines 1-23: Module docstring
"""
V2 Activities API - Clean template management interface

This module provides a simplified activities API for metabob-cli that hides
ML complexity (Thompson Sampling, CTR optimization, A/B testing) and exposes
clean CRUD operations for activity templates.

Endpoints:
- /v2/activities/templates       - Template CRUD (list, get, create, update, delete)
- /v2/activities/mutate          - Template mutations (derive, lineage)
- /v2/activities/record          - Execution tracking (start, complete, step)

Key Design Principles:
1. Hide ML complexity: Thompson Sampling, A/B testing happen internally
2. Simple CRUD: Clean REST interface for templates
3. Backend intelligence: Learning system works transparently
4. Proper auth: Bearer token only (no X-Internal-Request)
"""

# Lines 55-57: Execution recording
from server.actions.activities import (
    record_execution,
    RecordExecutionRequest,
    ActivityExecution,
)
```

**Verification**: ✅ **MATCHES STATED PURPOSE**

Evidence:
- Provides REST API for template storage (CRUD operations)
- Records execution outcomes for Thompson Sampling learning
- Does NOT contain orchestration logic (no step-by-step execution)
- Stores metrics but doesn't interpret them for orchestration

**Data Flow (Actual)**:
```
POST /v2/activities/templates → Validate → Store in SurrealDB
POST /v2/activities/record/start → Create execution record
POST /v2/activities/record/step → Update execution with step result
POST /v2/activities/record/complete → Finalize + Thompson Sampling feedback
```

**Purpose**: Storage + Learning, NOT Execution

---

## Data Flow Analysis

### Documented Flow (from ARCHITECTURE_SEPARATION_OF_CONCERNS.md)

```
┌─────────────────────┐
│  metabob-opencode   │  (Orchestration)
│  - Parse template   │
│  - Execute tasks    │
│  - Call tools       │
└──────┬──────────────┘
       │ MCP (stdio)
       ▼
┌─────────────────────┐
│   metabob-cli       │  (Tools)
│   - Search issues   │
│   - Mark complete   │
│   - Annotate        │
│   - [8 tools total] │
└──────┬──────────────┘
       │ HTTP API
       ▼
┌─────────────────────┐
│  metabob-rpc-api    │  (Backend)
│  - Store templates  │
│  - Run analysis     │
│  - Track metrics    │
└─────────────────────┘
```

### Actual Flow (from code inspection)

```
┌─────────────────────┐
│  metabob-opencode   │  (???)
│  - Calls MCP tools  │
│  - ??? templates   │
└──────┬──────────────┘
       │ MCP (stdio)
       ▼
┌─────────────────────┐
│   metabob-cli       │  (Tools + ORCHESTRATION??)
│   MCP Tools:        │
│   - Search issues   │
│   - Mark complete   │
│                     │
│   Activity Manager: │  ← UNEXPECTED!
│   - ExecutionState  │
│   - Step tracking   │
│   - Trailblazing    │
└──────┬──────────────┘
       │ HTTP API
       ▼
┌─────────────────────┐
│  metabob-rpc-api    │  (Backend)
│  - Store templates  │
│  - Record execution │
│  - Thompson Sampling│
└─────────────────────┘
```

---

## Specific Discrepancies

### Discrepancy 1: Activity Execution Ownership

**Documentation says**:
> "metabob-opencode executes task dependency graphs"  
> "metabob-cli does NOT execute activity templates"

**Code shows**:
```python
# metabob-cli/src/metabob_cli/mcp/activity_manager.py:78-100
class ActivityExecution:
    """Tracks state of an executing activity"""
    execution_id: str
    current_step_index: int = 0
    state: ExecutionState = ExecutionState.PENDING
    step_results: list[StepResult] = field(default_factory=list)
```

metabob-cli IS tracking execution state, which means it's participating in orchestration.

---

### Discrepancy 2: Step Delivery

**Documentation says**:
> "metabob-opencode parses and validates activity templates"  
> "metabob-opencode executes task dependency graphs"

**Code says**:
```python
# metabob-cli/src/metabob_cli/mcp/activity_manager.py:12-14
"""
- Incremental step delivery (agents don't see all steps upfront)
- Executing agent receives steps one at a time as messages
"""
```

This implies metabob-cli controls WHEN steps are delivered, which is orchestration logic.

---

### Discrepancy 3: Trailblazing

**Documentation**: No mention of metabob-cli generating steps.

**Code shows**:
```python
# metabob-cli/src/metabob_cli/mcp/activity_manager.py:9
- Trailblazing mode for failed validations
```

"Trailblazing generates additional steps" is DEFINITELY orchestration, not tool provision.

---

## Root Cause Analysis

### How Did This Happen?

**Theory 1: Incremental Feature Creep**
- metabob-cli started as tool provider
- Added "activity_manager" for convenience
- Activity manager gradually gained orchestration logic
- Documentation never updated

**Theory 2: Distributed Execution Model**
- Original intent: metabob-cli manages execution STATE
- metabob-opencode provides execution RUNTIME
- Separation was: state tracking vs task execution
- Documentation conflated "state management" with "tool provision"

**Theory 3: Multiple Authors**
- Architecture doc written by one person
- Implementation by another
- No reconciliation step

---

## Correct Architecture (Two Possibilities)

### Option A: OpenCode Owns Orchestration (Matches Documentation)

```
┌─────────────────────────────────────────────┐
│ metabob-opencode (Orchestration)            │
│ - Parse templates                           │
│ - Track execution state (ActivityExecution) │
│ - Deliver steps incrementally               │
│ - Handle trailblazing                       │
│ - Call MCP tools                            │
└──────┬──────────────────────────────────────┘
       │ MCP: Tool calls only
       ▼
┌─────────────────────────────────────────────┐
│ metabob-cli (Tools)                         │
│ - search_codebase_issues                    │
│ - mark_problem_complete                     │
│ - annotate_component                        │
│ - [NO execution state]                      │
└──────┬──────────────────────────────────────┘
       │ HTTP: Fetch templates, record outcomes
       ▼
┌─────────────────────────────────────────────┐
│ metabob-rpc-api (Backend)                   │
│ - Template storage                          │
│ - Execution recording                       │
│ - Thompson Sampling                         │
└─────────────────────────────────────────────┘
```

**Changes Required**:
- Move ActivityExecution to metabob-opencode
- Move trailblazing logic to metabob-opencode
- metabob-cli becomes pure tool provider

---

### Option B: CLI Owns Orchestration (Matches Implementation)

```
┌─────────────────────────────────────────────┐
│ metabob-opencode (Runtime)                  │
│ - Execute tasks (bash, edit, etc.)         │
│ - Provide tools to agents                   │
│ - Manage conversation history               │
│ - Call metabob-cli for orchestration        │
└──────┬──────────────────────────────────────┘
       │ MCP: Orchestration calls
       ▼
┌─────────────────────────────────────────────┐
│ metabob-cli (Tools + Orchestration)         │
│ Tools:                                       │
│ - search_codebase_issues                    │
│ - mark_problem_complete                     │
│                                             │
│ Orchestration:                              │
│ - ActivityExecution state                   │
│ - Step delivery control                     │
│ - Trailblazing generation                   │
└──────┬──────────────────────────────────────┘
       │ HTTP: Templates, recording
       ▼
┌─────────────────────────────────────────────┐
│ metabob-rpc-api (Backend)                   │
│ - Template storage                          │
│ - Execution recording                       │
│ - Thompson Sampling                         │
└─────────────────────────────────────────────┘
```

**Changes Required**:
- Update documentation to reflect CLI's orchestration role
- Rename "metabob-cli" to something like "metabob-orchestrator"
- Clarify that metabob-opencode is the RUNTIME, not orchestrator

---

## Recommendations

### 1. Immediate: Document the Actual Architecture

Create honest documentation that reflects the CURRENT implementation:

```markdown
# Actual Three-Component Architecture

## metabob-opencode (Execution Runtime)
- Provides task execution primitives (bash, edit, read, etc.)
- Manages agent conversation and UI
- **Delegates orchestration to metabob-cli via MCP**

## metabob-cli (Orchestration + Tools)
- **Orchestrates activity execution (ActivityExecution state)**
- **Controls step delivery and trailblazing**
- Provides code analysis MCP tools
- Calls backend for templates and recording

## metabob-rpc-api (Backend Storage + Learning)
- Stores activity templates
- Records execution outcomes
- Implements Thompson Sampling learning
```

### 2. Medium-Term: Refactor to Match Intent

If the INTENT was Option A (OpenCode owns orchestration):

**Steps**:
1. Move `ActivityExecution` class to metabob-opencode
2. Move trailblazing logic to metabob-opencode
3. metabob-cli exposes MCP tools only:
   - `get_template(template_id)` → Returns template JSON
   - `record_execution_start(...)` → HTTP passthrough
   - `record_step(...)` → HTTP passthrough
   - `record_execution_complete(...)` → HTTP passthrough

### 3. Long-Term: Establish Architectural Review Process

**Problem**: Implementation diverged from documentation without detection.

**Solution**:
- Architecture Decision Records (ADRs)
- Quarterly architecture review meetings
- Automated architecture tests (dependency constraints)
- Documentation generated from code annotations

---

## Verification Checklist

To validate which model is correct, answer these questions:

### Questions for Clarification

1. **Who creates the ActivityExecution object?**
   - Option A: metabob-opencode creates it
   - Option B: metabob-cli creates it
   - Actual: ? (need to trace execution)

2. **Who decides when to deliver the next step?**
   - Option A: metabob-opencode controls step flow
   - Option B: metabob-cli controls step flow
   - Actual: ? (need to trace execution)

3. **Who implements trailblazing?**
   - Option A: metabob-opencode generates recovery steps
   - Option B: metabob-cli generates recovery steps
   - Actual: metabob-cli (per activity_manager.py:9)

4. **What does the MCP call look like?**
   - Option A: `callTool("search_issues", {...})`
   - Option B: `callTool("get_next_step", {execution_id})`
   - Actual: ? (need to examine tool calls)

---

## Next Steps

### Investigation Required

1. **Trace a complete activity execution**:
   - Start: Where is ActivityExecution created?
   - Step 1: Who delivers the first step?
   - Step N: Who knows when to move to next step?
   - Complete: Who finalizes the execution?

2. **Examine MCP tool list**:
   ```bash
   # Check what tools metabob-cli actually exposes
   cd repos/metabob-cli
   grep "@mcp.tool" src/metabob_cli/mcp/*.py
   ```

3. **Check for orchestration-related MCP tools**:
   - Does metabob-cli expose `get_next_step()` or similar?
   - Does it expose `start_activity_execution()`?
   - Or only data tools like `search_issues()`?

### Documentation Update Required

Once investigation is complete:

1. Create **ARCHITECTURE_ACTUAL_FEB14.md**
2. Mark **ARCHITECTURE_SEPARATION_OF_CONCERNS.md** as outdated
3. Add note to all architecture docs about verification date

---

## Conclusion

**Summary**: Documentation and implementation have diverged significantly for metabob-cli component.

**Documented Purpose**: Tool provider only  
**Actual Implementation**: Tool provider + Activity orchestrator  

**Impact**:
- ⚠️ Architectural confusion for developers
- ⚠️ Unclear responsibility boundaries
- ⚠️ Potential for duplicate functionality
- ⚠️ Harder to reason about system behavior

**Recommendation**: Choose Option A or Option B, then align EITHER code or docs to match.

**Philosophy**:
> "For something to be true, we need to execute tests that verify the claim."
> 
> Our documentation claimed metabob-cli "does NOT execute activity templates",
> but code inspection reveals it DOES manage execution state and trailblazing.
> 
> This document provides evidence for both the documented intent and the actual
> implementation, enabling an informed decision about which to follow.

---

**Investigation Status**: PARTIALLY COMPLETE  
**Next**: Trace actual execution flow to determine runtime behavior  
**Blockers**: None - can proceed with code tracing
