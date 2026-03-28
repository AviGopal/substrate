# Architecture Correction: Activity System Location

## Critical Error Identified

**Problem**: Phase 1 implementation for dynamic task generation was committed to **metabob-opencode** repository, but the activity system is actually managed through **metabob-cli** (Python) → **metabob-rpc-api** (FastAPI backend).

**Commits to Revert/Relocate**:
- `765e50e3` in metabob-opencode - Added impulse-binding.ts, modified activity-template.ts
- `3589ab25` in metabob-opencode - Added validation harness

## Correct Architecture

### Activity System Components

```
┌─────────────────────────────────────────────────────────────┐
│ metabob-opencode (TypeScript)                               │
│ - Session management                                        │
│ - Memory agent (creates impulses)                          │
│ - MCP client (calls metabob-cli via MCP protocol)         │
└──────────────────┬──────────────────────────────────────────┘
                   │ MCP Protocol
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ metabob-cli (Python MCP Server)                             │
│ - activity_manager.py: Activity execution orchestration     │
│ - activity_template_tools.py: MCP tools for templates      │
│ - activity_tools.py: MCP tools for execution               │
│ - activity_context_tool.py: Context management             │
│ - learning_tools.py: Impulse tracking                      │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP/REST
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ metabob-rpc-api (FastAPI Backend)                           │
│ - routes/activity.py: Activity CRUD + execution             │
│ - routes/impulse.py: Impulse storage/retrieval             │
│ - db/surrealdb_client.py: Database operations              │
└─────────────────────────────────────────────────────────────┘
```

## Correct Implementation Locations

### Phase 1: Impulse Types and Binding

#### Backend (metabob-rpc-api)

**File**: `repos/metabob-rpc-api/server/models/impulse.py` (or similar)

Add new impulse types:
```python
class ImpulseType(str, Enum):
    FILE = "file"
    BASH_OUTPUT = "bash_output"
    TEST_RESULTS = "test_results"  # NEW
    TASK_SUMMARY = "task_summary"  # NEW
    SCRIPT_ARTIFACT = "script_artifact"  # NEW
    METABOB_ISSUE = "metabob_issue"
    ACTIVITY_OUTPUT = "activity_output"
    MEMO = "memo"
    CUSTOM = "custom"

@dataclass
class TestResultsImpulse:
    type: Literal["test_results"]
    task_id: str
    command: str
    output: str
    exit_code: int
    passed: bool
    test_count: Optional[int] = None
    failed_tests: Optional[list[str]] = None

@dataclass
class TaskSummaryImpulse:
    type: Literal["task_summary"]
    task_id: str
    success: bool
    duration: int  # milliseconds
    cost: float  # USD
    key_outputs: list[str]  # Impulse IDs

@dataclass
class ScriptArtifactImpulse:
    type: Literal["script_artifact"]
    task_id: str
    path: str
    content: str
    executable: bool
    purpose: str
```

**File**: `repos/metabob-rpc-api/server/routes/impulse.py`

Update endpoints to handle new types.

#### MCP Server (metabob-cli)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

Add impulse binding utility:
```python
async def bind_impulses_as_variables(
    self, 
    impulses: list[dict], 
    task_id: str
) -> dict[str, Any]:
    """
    Convert captured impulses into typed variable bindings.
    
    Returns dict with:
    - previous_commands: list[dict]
    - test_results: list[dict]
    - all_tests_passed: bool
    - created_files: list[str]
    - generated_scripts: list[dict]
    - activity_results: list[dict]
    - previous_task_success: bool
    - previous_task_duration: int
    """
    bindings = {}
    
    # Group impulses by type
    by_type = {}
    for impulse in impulses:
        type_name = impulse.get("type")
        if type_name not in by_type:
            by_type[type_name] = []
        by_type[type_name].append(impulse)
    
    # Bind bash outputs
    if "bash_output" in by_type:
        bindings["previous_commands"] = [
            {
                "command": i["command"],
                "output": i["output"],
                "exit_code": i.get("exit_code", 0)
            }
            for i in by_type["bash_output"]
        ]
    
    # Bind test results
    if "test_results" in by_type:
        bindings["test_results"] = [
            {
                "command": i["command"],
                "passed": i["passed"],
                "output": i["output"],
                "test_count": i.get("test_count"),
                "failed_tests": i.get("failed_tests", [])
            }
            for i in by_type["test_results"]
        ]
        bindings["all_tests_passed"] = all(
            i["passed"] for i in by_type["test_results"]
        )
    else:
        bindings["all_tests_passed"] = True
    
    # Bind file artifacts
    if "file" in by_type:
        bindings["created_files"] = [i["path"] for i in by_type["file"]]
    
    # Bind script artifacts
    if "script_artifact" in by_type:
        bindings["generated_scripts"] = [
            {
                "path": i["path"],
                "purpose": i["purpose"],
                "executable": i.get("executable", False)
            }
            for i in by_type["script_artifact"]
        ]
    
    # Bind activity outputs
    if "activity_output" in by_type:
        bindings["activity_results"] = [
            {
                "activity_id": i.get("activity_id"),
                "result": i.get("result")
            }
            for i in by_type["activity_output"]
        ]
    
    # Bind task summaries
    if "task_summary" in by_type:
        last_task = by_type["task_summary"][-1]
        bindings["previous_task_success"] = last_task["success"]
        bindings["previous_task_duration"] = last_task["duration"]
    
    return bindings
```

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

Update `_capture_session_impulses()` method (line ~500):
```python
async def _capture_session_impulses(self, session_id: str) -> list[dict]:
    """
    Capture impulses from session tool calls.
    Enhanced for Phase 1: Detect test results, task summaries, script artifacts.
    """
    # Get session messages from backend
    # ... existing code ...
    
    # Scan tool calls
    for msg in messages:
        for tool_call in msg.get("tool_calls", []):
            # Existing: bash outputs
            if tool_call["name"] == "bash":
                impulses.append({
                    "type": "bash_output",
                    "command": tool_call["input"]["command"],
                    "output": tool_call["output"],
                    "exit_code": tool_call.get("metadata", {}).get("exit_code", 0)
                })
            
            # Existing: file writes
            if tool_call["name"] == "write":
                impulses.append({
                    "type": "file",
                    "path": tool_call["input"]["filePath"],
                    "content": tool_call["input"]["content"]
                })
            
            # NEW: Test results detection
            if tool_call["name"] == "bash" and "test" in tool_call["input"]["command"]:
                impulses.append({
                    "type": "test_results",
                    "task_id": current_task_id,
                    "command": tool_call["input"]["command"],
                    "output": tool_call["output"],
                    "exit_code": tool_call.get("metadata", {}).get("exit_code", 0),
                    "passed": tool_call.get("metadata", {}).get("exit_code", 0) == 0,
                    "test_count": self._extract_test_count(tool_call["output"]),
                    "failed_tests": self._extract_failed_tests(tool_call["output"])
                })
            
            # NEW: Script artifact detection
            if tool_call["name"] == "write" and tool_call["input"]["filePath"].endswith((".sh", ".py", ".js")):
                impulses.append({
                    "type": "script_artifact",
                    "task_id": current_task_id,
                    "path": tool_call["input"]["filePath"],
                    "content": tool_call["input"]["content"],
                    "executable": tool_call["input"]["filePath"].endswith(".sh"),
                    "purpose": self._infer_script_purpose(tool_call["input"]["content"])
                })
            
            # Existing: activity outputs
            if tool_call["name"] == "activity":
                impulses.append({
                    "type": "activity_output",
                    "activity_id": tool_call["input"]["templateId"],
                    "result": tool_call["output"]
                })
    
    # NEW: Add task summary impulse
    impulses.append({
        "type": "task_summary",
        "task_id": current_task_id,
        "success": task_succeeded,
        "duration": task_duration_ms,
        "cost": task_cost,
        "key_outputs": [i["id"] for i in impulses]
    })
    
    return impulses
```

### Phase 2: Progressive Generation

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

Add methods:
```python
async def generate_initial_skeleton(
    self,
    goal_description: str,
    category: str,
    variables: dict,
    max_initial_tasks: int = 2
) -> dict:
    """
    Generate 1-2 starter tasks only (not full plan).
    """
    # Call LLM to decompose goal into initial tasks
    # Return: {"initial_tasks": [...], "context": {...}}

async def propose_next_tasks(
    self,
    context: dict,
    completed_tasks: list[dict],
    captured_impulses: list[dict]
) -> dict:
    """
    Analyze completed work and propose next tasks.
    """
    # Call LLM with execution results
    # Return: {"next_tasks": [...], "complete": bool}

async def execute_task_with_impulse_capture(
    self,
    task: dict,
    variables: dict,
    session_id: str
) -> dict:
    """
    Execute task and capture outputs as impulses.
    """
    # Execute via existing flow
    # Capture impulses
    # Bind as variables
    # Return: {"result": {...}, "captured_impulses": [...]}
```

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

Update `metabob_create_activity_goal_seeking` tool to use progressive generation.

### Phase 3: Backend API

**File**: `repos/metabob-rpc-api/server/routes/activity.py`

Add endpoints:
```python
@router.post("/v2/activities/skeleton")
async def generate_initial_skeleton(request: SkeletonRequest):
    """Generate 1-2 starter tasks for goal."""
    pass

@router.post("/v2/activities/propose-next")
async def propose_next_tasks(request: ProposeNextRequest):
    """Propose next tasks based on completed work."""
    pass
```

## Actions Required

### 1. Revert Incorrect Commits (metabob-opencode)

```bash
cd repos/metabob-opencode
git revert 3589ab25  # Validation harness
git revert 765e50e3  # Impulse binding infrastructure
git push
```

### 2. Implement in Correct Locations (metabob-cli + metabob-rpc-api)

Follow the structure above:
- Phase 1: Impulse types in metabob-rpc-api + binding utility in metabob-cli
- Phase 2: Progressive generation in metabob-cli
- Phase 3: Backend API endpoints in metabob-rpc-api

### 3. Update Specification

Update `SPEC_DYNAMIC_TASK_GENERATION_WITH_IMPULSE_BINDING.md` to reflect correct architecture with Python implementation paths instead of TypeScript.

## Key Architectural Principles

1. **metabob-opencode**: Session management, memory agent, MCP client ONLY
2. **metabob-cli**: Activity orchestration, MCP server, business logic
3. **metabob-rpc-api**: Backend storage, retrieval, learning loop
4. **Communication**: opencode → MCP → metabob-cli → HTTP → metabob-rpc-api

## Validation

After reimplementation:
- Phase 1 validation harness should be in metabob-cli tests
- Backend integration tests in metabob-rpc-api
- E2E tests via MCP protocol from opencode

## Apology

I apologize for the architectural error. The implementation was done in metabob-opencode when it should have been in metabob-cli and metabob-rpc-api. This document provides the correct architecture and implementation paths.
