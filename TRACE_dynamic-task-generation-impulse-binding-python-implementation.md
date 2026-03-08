# Trace: Dynamic Task Generation with Impulse Binding (Python Implementation)

## Architecture Correction (Critical)

**Wrong Location:** Previous implementation in `metabob-opencode` (TypeScript) - INCORRECT  
**Correct Location:** `metabob-cli` (Python MCP server) + `metabob-rpc-api` (FastAPI backend)  
**Source:** Architecture correction document, commit 6020e5c

Activity system lives in metabob-cli MCP server, not in metabob-opencode.

---

## Specification Summary

**Phase:** Phase 1 - Impulse Binding Foundation  
**Goal:** Implement impulse type support and binding utilities in Python  
**Components:** 7 files across 2 repositories  
**New Impulse Types:** testResults, taskSummary, scriptArtifact

---

## Component Analysis

### 1. repos/metabob-rpc-api/server/models/request.py

**Component:** ImpulseCreateRequest  
**Location:** Line ~30  

**Current State:**
- Generic `impulse_data: dict` field
- No type validation
- No schema for testResults, taskSummary, scriptArtifact

**Desired State:**
- Add 3 Pydantic models:
  - `ImpulseTestResults(command: str, exit_code: int, passed: bool, output: str)`
  - `ImpulseTaskSummary(task_id: str, success: bool, duration_ms: int, cost: float, tokens: int)`
  - `ImpulseScriptArtifact(file_path: str, language: str, executable: bool, inferred_purpose: str)`

**Gap:** Missing type-safe models for new impulse types

---

### 2. repos/metabob-rpc-api/server/routes/impulse.py

**Component:** create_impulse_endpoint  
**Location:** Line 64  

**Current State:**
- Accepts generic impulse_data dict
- No validation for new types

**Desired State:**
- Extract `impulse_data['type']`
- Validate against new models if type in ['testResults', 'taskSummary', 'scriptArtifact']
- Raise 400 if validation fails

**Gap:** No type-specific validation logic in endpoint

---

### 3. repos/metabob-rpc-api/server/db/operations/impulse_data.py

**Component:** create_impulse  
**Location:** Line 29  

**Current State:**
- Stores impulse_data as-is without type-specific indexing
- Schema: impulse_id, api_key, project_id, impulse_data (dict), created_at, updated_at

**Desired State:**
- Add indexes for efficient querying:
  - `impulse_data.type`
  - `impulse_data.task_id` (for taskSummary)
  - `impulse_data.file_path` (for scriptArtifact)

**Gap:** No specialized storage logic for new types, database schema supports arbitrary JSON but lacks optimized indexes

---

### 4. repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

**Component:** _capture_session_impulses  
**Location:** Lines 1185-1244  

**Current State:**
- Captures impulses from `execution.impulses_used` (set via start_execution)
- Generates: impulse_id, content_hash, tokens_used, was_useful
- Does NOT detect test commands or script artifacts from tool calls

**Desired State:**
- Enhanced detection logic:
  1. **Test Detection:** Find bash tool calls with 'test' in command, extract exit_code, create testResults impulse
  2. **Script Detection:** Find write tool calls for .sh/.py/.js files, set executable=True, infer purpose, create scriptArtifact impulse
  3. **Task Summary:** For each completed step, create taskSummary impulse with StepResult data

**Gap:** Missing tool call inspection logic. Need to iterate through `execution.step_results[].tool_calls` and analyze bash commands and file writes

**Implementation Approach:**
```python
# Iterate through execution.step_results
for step_result in execution.step_results:
    for tool_call in step_result.tool_calls:
        # Detect test commands
        if tool_call['tool'] == 'bash' and 'test' in tool_call.get('command', ''):
            # Create testResults impulse
            
        # Detect script writes
        if tool_call['tool'] == 'write' and tool_call['file_path'].endswith(('.sh', '.py', '.js')):
            # Create scriptArtifact impulse
            
    # Create taskSummary for each step
    # impulse with step_result.success, duration_ms, cost
```

---

### 5. repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

**Component:** bind_impulses_as_variables (NEW FUNCTION)  
**Location:** After _capture_session_impulses (line 1244)  

**Current State:** DOES NOT EXIST

**Desired State:**
```python
def bind_impulses_as_variables(impulses: list[dict]) -> dict:
    """
    Convert impulses to typed dict for template variable binding.
    
    Returns:
        {
            'previous_commands': [str],           # From bashOutput
            'test_results': [dict],                # From testResults
            'all_tests_passed': bool,              # Aggregated
            'created_files': [str],                # From scriptArtifact
            'generated_scripts': [dict],           # From scriptArtifact
            'activity_results': [dict],            # From taskSummary
            'previous_task_success': bool,         # From last taskSummary
            'previous_task_duration': int          # From last taskSummary
        }
    """
    # Filter impulses by type
    # Aggregate data
    # Return typed dict
```

**Gap:** Function does not exist. Need to implement from scratch with type categorization and aggregation logic

---

### 6. repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

**Component:** StepResult  
**Location:** Lines 54-74  

**Current State:**
- `tool_calls: list` field exists but untyped
- No dedicated fields for test results or script artifacts

**Desired State:**
- Document expected structure:
  - `[{'tool': 'bash', 'command': '...', 'exit_code': 0}, ...]`
  - `[{'tool': 'write', 'file_path': 'test.sh', 'is_script': True}, ...]`
- Ensure OpenCode populates correctly

**Gap:** tool_calls field is untyped list, needs documentation and OpenCode integration

---

### 7. repos/metabob-cli/tests/mcp/test_impulse_binding.py

**Component:** Validation tests (NEW FILE)  

**Current State:** Does not exist

**Desired State:**
- `test_bind_impulses_as_variables_empty_input()` - Returns default structure
- `test_bind_impulses_as_variables_test_results()` - Test results aggregated properly
- `test_bind_impulses_as_variables_script_artifacts()` - Script artifacts detected
- `test_bind_impulses_as_variables_task_summaries()` - Previous task data extracted
- `test_bind_impulses_as_variables_mixed_types()` - Complete dict with all 8 keys

**Gap:** No validation tests for Phase 1 implementation

---

## Data Flow

```
Activity Execution (OpenCode)
  ↓
ActivityManager.report_step_result(tool_calls)
  ↓
_capture_session_impulses() [NEW DETECTION LOGIC]
  ↓
Create impulse records (testResults, scriptArtifact, taskSummary)
  ↓
POST /v2/impulses
  ↓
impulse_data.create_impulse()
  ↓
SurrealDB storage
  ↓
[FUTURE] bind_impulses_as_variables() reads from storage
  ↓
Template variables for progressive task generation
```

---

## Implementation Plan Summary

| Step | Repository | File | Action | Priority |
|------|-----------|------|--------|----------|
| 1 | rpc-api | server/models/request.py | Add 3 Pydantic models | HIGH |
| 2 | rpc-api | server/routes/impulse.py | Add type validation | HIGH |
| 3 | cli | mcp/activity_manager.py | Enhance _capture_session_impulses | HIGH |
| 4 | cli | mcp/activity_manager.py | Add bind_impulses_as_variables | HIGH |
| 5 | cli | tests/mcp/test_impulse_binding.py | Create validation tests | MEDIUM |

---

## Critical Assumptions

1. **OpenCode Integration:** OpenCode must populate `StepResult.tool_calls` with structured data:
   - `[{'tool': 'bash', 'command': '...', 'exit_code': 0}, ...]`
   - `[{'tool': 'write', 'file_path': '...', 'is_script': True}, ...]`

2. **Data Flow:** `ActivityManager.report_step_result` receives `tool_calls` from OpenCode activity execution coordinator

3. **Database Support:** SurrealDB `impulse_data` table supports arbitrary JSON fields:
   - `impulse_data.type`
   - `impulse_data.task_id`
   - `impulse_data.file_path`

4. **Future Phases:** Phases 2-3 will call `bind_impulses_as_variables()` when generating progressive tasks

---

## Validation Criteria

### Test Command Detection
**Test:** Execute activity with `npm test` bash call  
**Expected:** testResults impulse created with `exit_code` and `passed=true/false`

### Script Artifact Detection
**Test:** Execute activity that writes `test.sh` file  
**Expected:** scriptArtifact impulse created with `executable=true`, `language='bash'`

### Task Summary Creation
**Test:** Complete activity step  
**Expected:** taskSummary impulse created with correct `task_id`, `success`, `duration`, `cost`

### Binding Utility Structure
**Test:** Call `bind_impulses_as_variables([...])`  
**Expected:** Returned dict has all 8 keys:
- `previous_commands`
- `test_results`
- `all_tests_passed`
- `created_files`
- `generated_scripts`
- `activity_results`
- `previous_task_success`
- `previous_task_duration`

### API Validation
**Test:** POST `/v2/impulses` with `testResults` type  
**Expected:** 201 response and SurrealDB record with `impulse_data.type='testResults'`

---

## Metadata

**Architecture Correction:** Commit 6020e5c  
**Wrong Location:** metabob-opencode (TypeScript)  
**Correct Location:** metabob-cli (Python MCP) + metabob-rpc-api (FastAPI)  
**Phase:** Phase 1: Impulse Binding Foundation  
**Downstream Phases:** Phase 2 (Progressive Task Generation), Phase 3 (Trailblazing Integration)  
**Trace Date:** 2026-03-08  
**Trace Tool:** trace-data-flow-single-feature  
**Components Analyzed:** 7 files across 2 repositories
