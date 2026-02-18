# Repository Alignment Assessment: Proto, CLI, Backend, OpenCode

**Date**: February 12, 2026  
**Status**: ⚠️ PARTIAL ALIGNMENT - Gaps Identified  
**Scope**: Activity template creation, execution, and step recording

---

## Executive Summary

We have **3 repositories** working together with **1 shared proto schema**:

1. **metabob-proto**: Source of truth (proto definitions)
2. **metabob-cli**: MCP server + activity manager (Python)
3. **metabob-rpc-api**: Backend API + SurrealDB (Python/FastAPI)
4. **metabob-opencode**: Activity execution engine (TypeScript) - not yet assessed

**Current Status**:
- ✅ Proto schema defines execution tracking (TaskStep, ExecutionConfig, Hooks)
- ✅ CLI implements activity execution with ActivityManager
- ✅ Backend provides `/v2/activities/record/*` endpoints
- ⚠️ **Impulse tracking per step NOT implemented**
- ⚠️ **Isolated workspace for activity-create NOT implemented**
- ⚠️ **Trailblaze variant creation NOT implemented**
- ❌ **OpenCode integration with proto NOT assessed**

---

## Git History Analysis (Last 2 Days)

### Main Repo (metabob-devbob)
```
c5a0813 Complete activity system testing and verification
fae56c7 Complete MCP integration fixes and state file format correction
fff4484 Add session state management and MCP integration testing
```

**Key Changes**:
- Session token authentication fixed
- State file format corrected (nested `session_metadata`)
- Activity search and execution proven working

### metabob-cli
```
97e700d fix: disable backend /record/start call that creates templates
4e1414f fix: support task_steps field from proto schema in activity execution
b6a2d3b fix: cache FileStateManager to eliminate blocking I/O
```

**Key Changes**:
- **Proto alignment**: Added support for `task_steps` field (proto-aligned)
- **Performance fix**: Cached FileStateManager (16,459x faster)
- **Execution fix**: Disabled /record/start that was creating duplicate templates

**Concerns**:
1. **Incomplete proto adoption**: Uses `tasks` but proto defines `task_steps`
2. **Missing impulse tracking**: StepResult doesn't record impulses
3. **No execution hooks**: Proto defines PreTaskHook, PostTaskHook - not implemented
4. **Variant creation**: derive_template exists but trailblaze integration missing

### metabob-rpc-api
```
5c3bfc5 feat: Complete Phase 2D - Add test scripts and API integration
7720c58 fix(phase2): resolve 3 priority data storage issues for production
6b82376 feat: Implement Phase 2A backend extensions - impulse provenance
```

**Key Changes**:
- **Phase 2 complete**: Backend execution tracking implemented
- **Proto models added**: ProtoTaskStep, TaskPrompt, TaskValidation
- **Impulse provenance**: Added tracking infrastructure

**Concerns**:
1. **Execution recording incomplete**: `/v2/activities/record/step` exists but impulse tracking missing
2. **Proto vs Python models**: Using Pydantic models instead of generated proto bindings
3. **SurrealDB schema**: No `execution_steps` table with impulse tracking

---

## Proto Schema vs Implementation Alignment

### Proto Definitions (Source of Truth)

**File**: `repos/metabob-proto/proto/metabob/activity/variant.proto`

```protobuf
message TaskStep {
  string id = 1;
  string subagent = 2;
  string description = 3;
  repeated string dependencies = 4;
  TaskPrompt prompt = 5;
  TaskValidation validation = 6;
  TaskRetry retry = 7;
  TaskMetrics metrics = 8;
  repeated string guidance = 9;
  repeated string expected_actions = 10;
  TaskTools tools = 11;
  TaskComplexity complexity = 12;
  TaskExecutionConfig execution_config = 20;
  repeated ImpulseReference impulse_refs = 21;  // ⚠️ NOT TRACKED IN EXECUTION
}
```

**File**: `repos/metabob-proto/proto/metabob/activity/execution.proto`

```protobuf
message ExecutionConfig {
  repeated ContextRequirement context_requirements = 1;
  IntegrationConfig integration = 2;
  MetabobIntegrationConfig metabob = 3;
  HooksConfig hooks = 4;  // ⚠️ NOT IMPLEMENTED
  map<string, RepositoryMapping> repositories = 5;
  ContextNegotiation context_negotiation = 6;
  DiscoveryPhase discovery_phase = 7;
  MemoryManagement memory_management = 8;
}

message HooksConfig {
  PreActivityHook pre_activity = 1;   // ⚠️ NOT IMPLEMENTED
  PreTaskHook pre_task = 2;           // ⚠️ NOT IMPLEMENTED
  PostTaskHook post_task = 3;         // ⚠️ NOT IMPLEMENTED
  PostActivityHook post_activity = 4; // ⚠️ NOT IMPLEMENTED
  ErrorHook on_error = 5;             // ⚠️ NOT IMPLEMENTED
}

message PreActivityHook {
  WorkingDirectoryConfig working_directory = 1;  // ⚠️ NEEDED FOR ISOLATED WORKSPACE
  repeated string load_impulses = 2;
  map<string, string> environment = 3;
  repeated ValidationCommand commands = 4;
}

message TemporaryDirectory {
  string prefix = 1;
  CleanupPolicy cleanup = 2;
  
  enum CleanupPolicy {
    CLEANUP_POLICY_ALWAYS = 1;
    CLEANUP_POLICY_ON_SUCCESS = 2;
    CLEANUP_POLICY_ON_ERROR = 3;
    CLEANUP_POLICY_NEVER = 4;
  }
}
```

### CLI Implementation (metabob-cli)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

```python
@dataclass
class StepResult:
    step_id: str
    success: bool
    output: Optional[str]
    error: Optional[str]
    cost: float
    tokens: int
    duration_ms: int
    tool_calls: list
    # ❌ MISSING: impulses_loaded: list[str]
    # ❌ MISSING: impulses_created: list[str]
    # ❌ MISSING: context_summary: dict

@dataclass
class ActivityExecution:
    execution_id: str
    activity_id: str
    session_id: str
    variant_id: str
    current_step_index: int
    state: ExecutionState
    step_results: list[StepResult]
    total_cost: float
    total_tokens: int
    cost_budget: float
    trailblazing_attempts: int
    max_trailblazing_attempts: int
    started_at: float
    variables: dict
    # ❌ MISSING: execution_config (from proto)
    # ❌ MISSING: hooks_config
    # ❌ MISSING: working_directory_config
```

**Key Methods**:
```python
async def start_execution(activity_id, variables, session_id):
    # ✅ Creates execution
    # ❌ Does NOT set up isolated workspace
    # ❌ Does NOT load pre_activity hooks
    # ❌ Does NOT call /record/start (disabled)

async def report_step_result(execution_id, step_id, success, output, cost, tokens):
    # ✅ Records step completion
    # ❌ Does NOT accept impulse_ids parameter
    # ❌ Does NOT record impulses_loaded/created
    # ❌ Does NOT call /record/step endpoint

async def get_next_step(execution_id):
    # ✅ Fetches template and returns current step
    # ❌ Does NOT apply pre_task hooks
    # ❌ Does NOT validate working directory

async def enter_trailblazing(execution_id, failure_reason):
    # ✅ Generates fix step
    # ❌ Does NOT create variant after successful trailblazing
```

### Backend Implementation (metabob-rpc-api)

**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

```python
@router.post("/record/start")
async def record_execution_start():
    # ⚠️ DISABLED in CLI (commit 97e700d)
    # Was creating duplicate templates instead of tracking execution
    pass

@router.post("/record/complete")
async def record_execution_complete(
    execution_id: str,
    success: bool,
    duration_ms: int,
    cost: float,
    tokens: int,
    step_results: list,  # ⚠️ No impulse tracking
    outcome: str
):
    # ✅ Records execution outcome
    # ⚠️ Stores in activity_executions table
    # ❌ Does NOT store impulse_ids per step
    pass

@router.post("/record/step")
async def record_execution_step():
    # ✅ Endpoint exists
    # ❌ NOT CALLED by CLI
    # ❌ Schema does NOT include impulses
    pass
```

**SurrealDB Schema** (inferred from code):
```sql
-- Current schema (incomplete)
TABLE activity_executions {
  execution_id: string,
  variant_id: string,
  session_id: string,
  success: bool,
  duration_ms: int,
  cost: float,
  tokens: int,
  step_results: array,  -- ⚠️ JSON blob, not structured
  outcome: string,
  created_at: datetime
}

-- ❌ MISSING: execution_steps table
-- Should be:
TABLE execution_steps {
  execution_id: record(activity_executions),
  step_id: string,
  step_index: int,
  success: bool,
  output: string,
  error: option<string>,
  cost: float,
  tokens: int,
  duration_ms: int,
  tool_calls: array,
  impulses_loaded: array,   -- ❌ NOT IMPLEMENTED
  impulses_created: array,  -- ❌ NOT IMPLEMENTED
  context_summary: object,  -- ❌ NOT IMPLEMENTED
  created_at: datetime
}
```

---

## Concerns by Repository

### 1. metabob-cli Concerns

#### HIGH Priority

**H1: Impulse Tracking Missing**
- **Issue**: StepResult doesn't track impulses used/created
- **Impact**: Cannot learn which context helps activities succeed
- **Proto field**: `repeated ImpulseReference impulse_refs = 21`
- **Fix**: Add `impulses_loaded`, `impulses_created`, `context_summary` to StepResult

**H2: Isolated Workspace Not Implemented**
- **Issue**: Activity-create pollutes main workspace
- **Impact**: Template creation files clutter repo
- **Proto field**: `PreActivityHook.working_directory`
- **Fix**: Implement TemporaryDirectory with cleanup policy

**H3: Execution Recording Disabled**
- **Issue**: `/record/start` disabled due to bug (commit 97e700d)
- **Impact**: Backend doesn't know execution started until completion
- **Fix**: Fix backend to NOT create templates on /record/start

#### MEDIUM Priority

**M1: Hooks Not Implemented**
- **Issue**: ExecutionConfig.hooks completely ignored
- **Impact**: No pre/post task validation, no workspace setup
- **Proto fields**: PreActivityHook, PreTaskHook, PostTaskHook
- **Fix**: Implement hook execution in activity_manager.py

**M2: Trailblaze Variant Creation Missing**
- **Issue**: Successful trailblazing doesn't create new variant
- **Impact**: Fixes not propagated to template population
- **Proto**: No direct field, but execution outcome should trigger derive
- **Fix**: Call derive_template() after successful trailblazing

**M3: Field Naming Inconsistency**
- **Issue**: Uses `tasks` but proto defines `task_steps`
- **Impact**: Confusion, potential desync with backend
- **Proto field**: `repeated TaskStep task_steps`
- **Fix**: Rename to task_steps (commit 4e1414f partially addressed)

#### LOW Priority

**L1: Execution Config Not Stored**
- **Issue**: ActivityExecution doesn't include execution_config
- **Impact**: Cannot reconstruct execution environment for debugging
- **Proto**: `ExecutionConfig execution_config`
- **Fix**: Add execution_config to ActivityExecution dataclass

### 2. metabob-rpc-api Concerns

#### HIGH Priority

**H1: No execution_steps Table**
- **Issue**: Step results stored as JSON blob in activity_executions
- **Impact**: Cannot query by step, cannot analyze step-level patterns
- **Proto alignment**: Each step should be a separate record
- **Fix**: Create execution_steps table with impulse tracking

**H2: Impulse Provenance Not Connected**
- **Issue**: Phase 2A added impulse provenance but not linked to steps
- **Impact**: Cannot determine which impulses contributed to success
- **Fix**: Link execution_steps to impulses table

**H3: /record/start Creates Templates**
- **Issue**: POST /record/start was creating duplicate templates
- **Impact**: CLI had to disable it (commit 97e700d)
- **Proto**: Should only record execution start, not create templates
- **Fix**: Separate template creation from execution recording

#### MEDIUM Priority

**M1: Proto Bindings Not Used**
- **Issue**: Using Pydantic models instead of generated proto bindings
- **Impact**: Schema drift risk, manual sync required
- **Fix**: Generate Python bindings from proto and use them

**M2: /record/step Not Called**
- **Issue**: Endpoint exists but CLI doesn't use it
- **Impact**: No real-time step tracking, only bulk recording at end
- **Fix**: CLI should call /record/step after each step

**M3: Variant Selection Hidden**
- **Issue**: Backend does Thompson Sampling but CLI gets random variant
- **Impact**: A/B testing not working as designed
- **Proto**: No direct concern, but behavior issue
- **Fix**: Document variant selection algorithm

### 3. metabob-opencode Concerns

#### CRITICAL - Not Yet Assessed

**C1: OpenCode Integration Unknown**
- **Issue**: Haven't examined opencode repo for proto alignment
- **Impact**: Unknown if activity tool properly executes proto-defined workflows
- **Proto**: OpenCode should be the primary consumer of proto schemas
- **Fix**: Assess repos/metabob-opencode activity execution

**C2: Activity Tool Implementation**
- **Issue**: Don't know if activity tool implements hooks, isolated workspaces
- **Impact**: May be duplicating CLI logic or missing features
- **Fix**: Review opencode activity tool code

### 4. metabob-proto Concerns

#### LOW Priority

**L1: Execution Outcome Not Defined**
- **Issue**: No proto message for ActivityExecutionResult
- **Impact**: Backend defines its own structure
- **Proto**: Should define canonical execution result
- **Fix**: Add ActivityExecutionResult message

**L2: Impulse Reference Schema**
- **Issue**: ImpulseReference defined but not linked to execution recording
- **Impact**: Unclear how impulses flow through execution
- **Fix**: Add ExecutionStepResult message with impulse tracking

---

## Activity Execution Flow (Current vs Proto)

### Current Flow (Implemented)

```
1. Agent calls activity(templateId, variables)
   └─> ActivityManager.start_execution()
       ├─> Fetch template from backend
       ├─> Create ActivityExecution in-memory
       └─> Return execution_id

2. Loop: For each step
   └─> ActivityManager.get_next_step()
       ├─> Return current step from template
       └─> Agent executes step
           └─> Agent calls report_step_result(step_id, success, output)
               └─> Append StepResult to execution.step_results

3. All steps complete
   └─> ActivityManager._check_completion()
       ├─> Validate final state
       └─> Call /v2/activities/record/complete (bulk)
           └─> Backend stores in activity_executions table
```

**Missing**:
- ❌ Isolated workspace creation
- ❌ Pre-activity hooks
- ❌ Pre-task hooks (impulse loading)
- ❌ Post-task hooks (impulse unloading)
- ❌ Impulse tracking per step
- ❌ Real-time step recording (/record/step)
- ❌ Variant creation from trailblazing

### Proto-Aligned Flow (Should Be)

```
1. Agent calls activity(templateId, variables)
   └─> ActivityManager.start_execution()
       ├─> Fetch template with ExecutionConfig from backend
       ├─> Execute pre_activity hooks:
       │   ├─> Create temporary workspace (if configured)
       │   ├─> Load impulses specified in load_impulses
       │   └─> Run validation commands
       ├─> Call /v2/activities/record/start  [FIXED: should not create template]
       └─> Return execution_id

2. Loop: For each step
   └─> ActivityManager.get_next_step()
       ├─> Execute pre_task hooks:
       │   ├─> Load task-specific impulses
       │   └─> Validate tool availability
       ├─> Return current step with context
       └─> Agent executes step
           ├─> Track impulses loaded from session memory
           └─> Agent calls report_step_result(
                   step_id, success, output, cost, tokens,
                   impulses_loaded=[...],  # NEW
                   impulses_created=[...], # NEW
                   context_summary={...}   # NEW
               )
               ├─> Append StepResult with impulse tracking
               ├─> Call /v2/activities/record/step (real-time)
               └─> Execute post_task hooks:
                   ├─> Unload low-priority impulses
                   └─> Capture outputs

3. All steps complete (or validation fails)
   └─> ActivityManager._check_completion()
       ├─> Validate final state
       ├─> If trailblazing succeeded:
       │   └─> Call derive_template() to create variant  # NEW
       ├─> Execute post_activity hooks:
       │   ├─> Cleanup temporary workspace
       │   ├─> Persist impulses
       │   └─> Create activity summary
       └─> Call /v2/activities/record/complete
           └─> Backend stores final outcome + links steps
```

---

## Remediation Roadmap

### Phase 1: Critical Fixes (Immediate - 4 hours)

**1.1 Fix /record/start Endpoint** (1 hour)
- File: `repos/metabob-rpc-api/server/routes/v2_activities.py`
- Change: Make /record/start ONLY record execution, NOT create templates
- Re-enable in CLI: Uncomment /record/start call in activity_manager.py

**1.2 Add Impulse Tracking to StepResult** (1 hour)
- File: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`
- Add fields: `impulses_loaded`, `impulses_created`, `context_summary`
- Update `report_step_result()` signature

**1.3 Create execution_steps Table** (1 hour)
- File: `repos/metabob-rpc-api/sql/init/01-init-devbob.sql`
- Add execution_steps table with impulse fields
- Link to activity_executions via foreign key

**1.4 Implement /record/step Calls** (1 hour)
- File: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`
- Call /record/step after each report_step_result()
- Send impulse tracking data

### Phase 2: Isolated Workspace (High Priority - 3 hours)

**2.1 Implement IsolatedWorkspace Class** (2 hours)
- File: `repos/metabob-cli/src/metabob_cli/mcp/isolated_workspace.py` (NEW)
- Context manager for temporary directory creation/cleanup
- Support cleanup policies from proto

**2.2 Integrate with ActivityManager** (1 hour)
- File: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`
- Detect activity-create templates
- Wrap execution in IsolatedWorkspace
- Pass workspace path to validation

### Phase 3: Hooks Implementation (Medium Priority - 4 hours)

**3.1 PreActivityHook** (1 hour)
- Load impulses specified in execution_config
- Set environment variables
- Run validation commands

**3.2 PreTaskHook** (1 hour)
- Load task-specific impulses
- Validate tool availability

**3.3 PostTaskHook** (1 hour)
- Unload low-priority impulses
- Capture outputs and create impulses

**3.4 PostActivityHook** (1 hour)
- Cleanup workspace
- Persist impulses
- Create activity summary

### Phase 4: Trailblaze Variants (Medium Priority - 2 hours)

**4.1 Automatic Variant Creation** (2 hours)
- File: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`
- Call `derive_template()` after successful trailblazing
- Record new variant_id in execution outcome

### Phase 5: OpenCode Assessment (Critical - TBD)

**5.1 Review OpenCode Activity Tool** (4 hours)
- Assess proto alignment in opencode activity tool
- Document gaps and concerns
- Create remediation plan

**5.2 Proto Bindings Generation** (2 hours)
- Generate Python bindings from proto
- Replace Pydantic models with proto models

---

## Testing Strategy

### Test 1: Impulse Tracking End-to-End
```python
# Execute activity with impulse tracking
exec_id = await mgr.start_execution(...)

# Report step with impulses
await mgr.report_step_result(
    execution_id=exec_id,
    step_id="step-1",
    success=True,
    output="Completed",
    impulses_loaded=["context-abc", "pattern-def"],
    impulses_created=["result-xyz"]
)

# Verify in database
steps = await db.query(
    "SELECT * FROM execution_steps WHERE execution_id = $exec_id"
)
assert "context-abc" in steps[0]["impulses_loaded"]
```

### Test 2: Isolated Workspace
```python
# Execute activity-create in isolated workspace
exec_id = await mgr.start_execution(
    activity_id="INFRASTRUCTURE-0013e379",  # activity-create
    variables={...}
)

# Verify workspace created
assert Path(".activity-sandbox/").exists()

# Verify main workspace not polluted
assert not Path("./created-template.json").exists()

# Verify cleanup after completion
await wait_for_completion(exec_id)
assert not Path(".activity-sandbox/").exists()
```

### Test 3: Trailblaze Variant Creation
```python
# Execute activity that will fail validation
exec_id = await mgr.start_execution(...)

# Simulate trailblazing
await mgr.enter_trailblazing(exec_id, "Validation failed")
# ... agent fixes issue ...

# Verify new variant created
execution_data = await mgr.get_execution_outcome(exec_id)
assert execution_data["variant_created"] is True
assert execution_data["new_variant_id"] is not None

# Verify variant discoverable
templates = await mgr.search_activities(...)
assert any(t["id"] == execution_data["new_variant_id"] for t in templates)
```

---

## Success Metrics

- [ ] ✅ All proto-defined fields implemented in CLI
- [ ] ✅ All proto-defined fields stored in backend
- [ ] ✅ Impulses tracked per step in SurrealDB
- [ ] ✅ Activity-create runs in isolated workspace
- [ ] ✅ Trailblaze fixes create new variants automatically
- [ ] ✅ Hooks (pre/post activity/task) functional
- [ ] ✅ OpenCode activity tool assessed and aligned
- [ ] ✅ Proto bindings generated and used

---

## Conclusion

We have **good proto-backend-CLI alignment for basic execution**, but are missing:
1. **Impulse tracking** (critical for learning)
2. **Isolated workspace** (critical for safe template creation)
3. **Hooks implementation** (important for proper execution)
4. **Trailblaze variant creation** (important for evolution)
5. **OpenCode assessment** (unknown alignment status)

**Estimated Total Remediation**: 13 hours (excluding OpenCode assessment)

**Priority Order**:
1. Fix /record/start bug and re-enable
2. Add impulse tracking (CLI + backend)
3. Implement isolated workspace
4. Implement hooks
5. Add trailblaze variant creation
6. Assess and fix OpenCode

Once complete, we'll have full proto alignment and proper activity execution tracking for the learning system.
