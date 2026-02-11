# Phase 2: Execution & Learning System - Task Breakdown

**Date**: 2026-02-09  
**Dependencies**: Phase 1 (Schema Alignment) ✅ COMPLETE  
**Estimated Duration**: 2-3 days  
**Approach**: Constraint-based, architecture-aligned, incremental

---

## Design Constraints & Principles

### 1. **Proto Schema is Source of Truth**
- **Constraint**: All storage must match `execution.proto` definitions
- **Validation**: Compare code against proto before implementing
- **Action**: Read proto file first, extract exact field names and types

### 2. **Three-System Architecture**
- **metabob-opencode**: Executor (no storage, reports outcomes)
- **metabob-rpc-api**: Repository (stores outcomes, commissions variants)
- **metabob-cli**: Mediator (connects code structure to executions)

### 3. **Existing Code Reuse**
- **Constraint**: Use existing `record_execution()` in `server/actions/activities.py`
- **Constraint**: Extend existing `ActivityExecution` model (don't replace)
- **Constraint**: Use existing `activity_outcomes` tracking infrastructure
- **Action**: Read existing code thoroughly before adding new code

### 4. **Incremental Implementation**
- **Constraint**: Each task must be independently testable
- **Constraint**: No "big bang" - add features one at a time
- **Constraint**: Validate at each step before proceeding

---

## Pre-Phase Analysis (1 hour - START HERE)

**Purpose**: Understand existing architecture before changing anything

### Task 0: Architectural Discovery
**Duration**: 60 minutes  
**Why**: Prevent duplicating existing functionality, ensure alignment

**Sub-tasks**:
1. **Read Proto Definitions** (15 min)
   - File: `repos/metabob-proto/proto/metabob/activity/execution.proto`
   - Extract: All message definitions, field names, field numbers
   - Document: Exact proto schema we must match
   - Output: `PROTO_SCHEMA_REFERENCE.md` with copy-pasted proto

2. **Map Existing Backend Infrastructure** (20 min)
   - Files to read:
     - `repos/metabob-rpc-api/server/actions/activities.py` (record_execution)
     - `repos/metabob-rpc-api/server/models/activity_outcome.py` (existing models)
     - `repos/metabob-rpc-api/server/routes/v2_activities.py` (API endpoints)
   - Questions to answer:
     - What execution tracking exists today?
     - What fields are already stored?
     - What's missing for impulse provenance?
     - What API endpoints exist for execution?
   - Output: `EXISTING_EXECUTION_TRACKING.md` with findings

3. **Map Existing CLI Integration** (15 min)
   - Files to read:
     - `repos/metabob-cli/src/metabob_cli/mcp/app.py` (MCP server)
     - `repos/metabob-cli/src/metabob_cli/mcp/` (available tools)
   - Questions to answer:
     - What Metabob tools are available?
     - How does component analysis work?
     - How does annotation work?
     - What's the API for cochange analysis?
   - Output: `CLI_METABOB_TOOLS_REFERENCE.md`

4. **Map Existing OpenCode Activity System** (10 min)
   - Files to check:
     - `repos/metabob-opencode/packages/opencode/src/activity/` (if exists)
     - Recent test files in opencode (what's already implemented?)
   - Questions to answer:
     - How does OpenCode execute activities today?
     - What outcome reporting exists?
     - What needs to be added?
   - Output: `OPENCODE_ACTIVITY_STATUS.md`

**Acceptance Criteria**:
- [x] Proto schema documented with exact field names
- [x] Existing execution tracking mapped (what exists, what's missing)
- [x] CLI Metabob tools cataloged (what's available)
- [x] OpenCode activity status assessed
- [x] No code written yet (pure discovery)

**Output**: Four reference documents that inform all subsequent tasks

---

## Phase 2A: Backend - Execution Outcome Storage (6-8 hours)

**Purpose**: Extend backend to store impulse provenance and component changes

### Task 1: Proto Model Extension
**Duration**: 2 hours  
**Dependencies**: Task 0 complete

**Context Check**:
- Read: `PROTO_SCHEMA_REFERENCE.md` (from Task 0)
- Read: `repos/metabob-rpc-api/server/models/proto_task_step.py` (Phase 1 example)
- Pattern: Follow same Pydantic-from-proto pattern

**Sub-tasks**:
1. **Create Proto Execution Models** (60 min)
   - File: `repos/metabob-rpc-api/server/models/proto_execution.py`
   - Models to create (from `execution.proto`):
     ```python
     class ImpulseUsage(BaseModel):
         """Tracks which impulses were used during execution"""
         impulse_id: str  # "errorContext", "componentAnnotations"
         content_hash: str  # SHA-256 of impulse content
         tokens_used: int  # How many tokens this impulse consumed
         was_useful: bool  # Whether agent actually referenced it
     
     class ComponentChange(BaseModel):
         """Tracks what code components were modified"""
         file_path: str  # "src/auth.ts"
         component_name: str  # "validateToken"
         change_type: str  # "MODIFIED", "CREATED", "DELETED"
         related_impulses: List[str]  # Impulses that informed this change
     
     class ExecutionOutcome(BaseModel):
         """Complete execution outcome with provenance"""
         execution_id: str
         variant_id: str
         session_id: str  # Link to session
         success: bool
         duration_ms: int
         cost: float
         tokens_used: int
         # NEW: Impulse provenance
         impulses_used: List[ImpulseUsage]
         # NEW: Component tracking
         component_changes: List[ComponentChange]
         # Existing fields (from current ActivityExecution)
         timestamp: datetime
         tool_calls: int
         failure_reason: Optional[str]
     ```
   - **Constraint**: Match proto field names exactly (not camelCase)
   - **Validation**: Import test - no errors

2. **Extend Existing ActivityExecution Model** (30 min)
   - File: `repos/metabob-rpc-api/server/actions/activities.py` (update existing)
   - Add new fields to `ActivityExecution`:
     ```python
     class ActivityExecution(BaseModel):
         # ... existing fields ...
         
         # NEW: Phase 2 additions
         impulses_used: List[dict] = Field(default_factory=list)
         component_changes: List[dict] = Field(default_factory=list)
     ```
   - **Constraint**: Don't break existing execution tracking
   - **Validation**: Existing tests still pass

3. **Database Schema Check** (30 min)
   - File: Check SurrealDB schema for `activity_executions` table
   - Question: Does SurrealDB need schema migration?
   - Answer: No (schemaless), but add indexes:
     ```surql
     DEFINE INDEX execution_variant ON activity_executions FIELDS variant_id;
     DEFINE INDEX execution_impulse ON activity_executions FIELDS impulses_used.impulse_id;
     DEFINE INDEX execution_component ON activity_executions FIELDS component_changes.file_path;
     ```
   - **Validation**: Indexes created successfully

**Acceptance Criteria**:
- [x] Proto models created matching execution.proto exactly
- [x] ActivityExecution model extended (backward compatible)
- [x] Database indexes added for new fields
- [x] All existing tests still pass
- [x] Import validation successful

**Testing**:
```python
# Test proto models
from server.models.proto_execution import ExecutionOutcome, ImpulseUsage
outcome = ExecutionOutcome(
    execution_id="test",
    variant_id="bug-fix-v1",
    session_id="sess_123",
    success=True,
    duration_ms=5000,
    cost=0.10,
    tokens_used=1500,
    impulses_used=[
        {"impulse_id": "errorContext", "content_hash": "abc123", 
         "tokens_used": 800, "was_useful": True}
    ],
    component_changes=[
        {"file_path": "src/auth.ts", "component_name": "validateToken",
         "change_type": "MODIFIED", "related_impulses": ["errorContext"]}
    ]
)
assert outcome.execution_id == "test"
```

---

### Task 2: API Endpoint Extension
**Duration**: 3 hours  
**Dependencies**: Task 1 complete

**Context Check**:
- Read: `repos/metabob-rpc-api/server/routes/v2_activities.py` (current endpoints)
- Read: `repos/metabob-rpc-api/server/actions/activities.py` (record_execution function)

**Sub-tasks**:
1. **Extend Existing record_execution Function** (90 min)
   - File: `repos/metabob-rpc-api/server/actions/activities.py`
   - Current signature:
     ```python
     async def record_execution(
         db: SurrealDBClient,
         execution_data: RecordExecutionRequest
     ) -> ActivityExecution:
     ```
   - Add impulse/component handling:
     ```python
     # After storing base execution
     if execution_data.impulses_used:
         await store_impulse_provenance(db, execution_id, execution_data.impulses_used)
     
     if execution_data.component_changes:
         await store_component_changes(db, execution_id, execution_data.component_changes)
     
     # Check if variant commissioning needed
     if await should_commission_variant(db, execution_data):
         new_variant = await commission_variant_from_execution(db, execution_data)
         logger.info(f"Commissioned new variant: {new_variant.variant_id}")
     ```
   - **Constraint**: Don't break existing execution recording
   - **Validation**: Existing callers still work

2. **Add Impulse Provenance Storage** (45 min)
   - File: `repos/metabob-rpc-api/server/actions/impulse_provenance.py` (new)
   - Function:
     ```python
     async def store_impulse_provenance(
         db: SurrealDBClient,
         execution_id: str,
         impulses_used: List[ImpulseUsage]
     ) -> None:
         """
         Store which impulses were used in execution.
         Updates impulse effectiveness metrics.
         """
         for impulse in impulses_used:
             # Update impulse_provenance table
             await db.query("""
                 UPDATE impulse_provenance
                 SET 
                     used_count += 1,
                     success_count += $success,
                     total_tokens += $tokens,
                     last_used = time::now()
                 WHERE impulse_id = $impulse_id
             """, {
                 "impulse_id": impulse.impulse_id,
                 "success": 1 if impulse.was_useful else 0,
                 "tokens": impulse.tokens_used
             })
     ```
   - **Validation**: Impulse stats update correctly

3. **Add Component Change Storage** (45 min)
   - File: `repos/metabob-rpc-api/server/actions/component_tracking.py` (new)
   - Function:
     ```python
     async def store_component_changes(
         db: SurrealDBClient,
         execution_id: str,
         component_changes: List[ComponentChange]
     ) -> None:
         """
         Store which components were modified.
         Links components to impulses for learning.
         """
         for change in component_changes:
             await db.create("component_changes", {
                 "execution_id": execution_id,
                 "file_path": change.file_path,
                 "component_name": change.component_name,
                 "change_type": change.change_type,
                 "related_impulses": change.related_impulses,
                 "timestamp": datetime.now(timezone.utc)
             })
     ```
   - **Validation**: Component changes stored correctly

**Acceptance Criteria**:
- [x] record_execution extended to handle new fields
- [x] Impulse provenance storage working
- [x] Component change storage working
- [x] Existing execution recording still works
- [x] No breaking changes to API

**Testing**:
```python
# Test execution with impulses
await record_execution(db, RecordExecutionRequest(
    execution_id="test_123",
    variant_id="bug-fix-v1",
    impulses_used=[{
        "impulse_id": "errorContext",
        "content_hash": "abc123",
        "tokens_used": 800,
        "was_useful": True
    }],
    component_changes=[{
        "file_path": "src/auth.ts",
        "component_name": "validateToken",
        "change_type": "MODIFIED",
        "related_impulses": ["errorContext"]
    }]
))

# Verify storage
impulse_stats = await db.select("impulse_provenance:errorContext")
assert impulse_stats["used_count"] > 0
```

---

### Task 3: Variant Commissioning Logic
**Duration**: 3 hours  
**Dependencies**: Task 2 complete

**Context Check**:
- Read: `CORRECT_ARCHITECTURE_DESIGN.md` (commissioning rules)
- Read: `repos/metabob-rpc-api/server/actions/activity_variants.py` (existing variant logic)

**Sub-tasks**:
1. **Implement Divergence Detection** (90 min)
   - File: `repos/metabob-rpc-api/server/actions/variant_commissioning.py` (new)
   - Function:
     ```python
     async def should_commission_variant(
         db: SurrealDBClient,
         execution_data: RecordExecutionRequest
     ) -> bool:
         """
         Determine if execution should trigger variant commissioning.
         
         Triggers:
         1. Execution succeeded with different impulses than template specified
         2. Pattern detected (3+ similar executions)
         3. Success rate significantly better than parent variant
         """
         # Get parent variant
         variant = await db.select(f"activity_variants:{execution_data.variant_id}")
         
         # Check impulse divergence
         template_impulses = set(extract_impulse_ids(variant["task_steps"]))
         execution_impulses = set(i["impulse_id"] for i in execution_data.impulses_used if i["was_useful"])
         
         divergence = len(execution_impulses - template_impulses) / max(len(template_impulses), 1)
         
         if divergence > 0.3:  # 30% different impulses
             # Check if pattern (3+ similar executions)
             similar_count = await count_similar_executions(
                 db, 
                 execution_data.variant_id,
                 execution_impulses
             )
             
             if similar_count >= 3:
                 logger.info(f"Pattern detected: {similar_count} similar executions")
                 return True
         
         return False
     ```
   - **Validation**: Pattern detection works correctly

2. **Implement Variant Creation** (60 min)
   - Function:
     ```python
     async def commission_variant_from_execution(
         db: SurrealDBClient,
         execution_data: RecordExecutionRequest
     ) -> ActivityVariant:
         """
         Create new variant from successful execution.
         
         Process:
         1. Copy parent variant structure
         2. Update impulse_refs to match what was actually useful
         3. Compute content hash
         4. Store with genealogy linking to parent
         """
         parent = await db.select(f"activity_variants:{execution_data.variant_id}")
         
         # Build new variant with successful impulses
         new_task_steps = copy.deepcopy(parent["task_steps"])
         for task in new_task_steps:
             # Update impulse_refs to what was actually used
             task["impulse_refs"] = [
                 {"impulse_id": i["impulse_id"], "priority": "HIGH", "required": True}
                 for i in execution_data.impulses_used
                 if i["was_useful"]
             ]
         
         # Create variant
         content_hash = compute_content_hash(new_task_steps)
         variant_id = f"{parent['activity_id']}-{content_hash[:8]}"
         
         await create_variant(db, CreateVariantRequest(
             activity_id=parent["activity_id"],
             variant_name=f"auto-{content_hash[:8]}",
             description=f"Auto-commissioned from execution {execution_data.execution_id}",
             task_steps=new_task_steps,
             parent_id=execution_data.variant_id,
             source_execution_id=execution_data.execution_id
         ))
         
         return variant_id
     ```
   - **Validation**: New variants created correctly with genealogy

3. **Add Commissioning Logging** (30 min)
   - Track variant commissioning events
   - Log: parent variant, execution that triggered it, divergence score
   - **Validation**: Events logged for analysis

**Acceptance Criteria**:
- [x] Divergence detection implemented
- [x] Pattern detection working (3+ similar executions)
- [x] Variant creation from execution working
- [x] Genealogy preserved (parent_id, source_execution_id)
- [x] Impulse provenance transferred to new variant
- [x] Commissioning events logged

**Testing**:
```python
# Simulate 3 successful executions with same impulse pattern
for i in range(3):
    await record_execution(db, RecordExecutionRequest(
        execution_id=f"test_{i}",
        variant_id="bug-fix-v1",
        success=True,
        impulses_used=[
            {"impulse_id": "errorContext", "was_useful": True},
            {"impulse_id": "newImpulse", "was_useful": True}  # Divergence!
        ]
    ))

# Fourth execution should trigger commissioning
result = await record_execution(db, RecordExecutionRequest(
    execution_id="test_3",
    variant_id="bug-fix-v1",
    success=True,
    impulses_used=[
        {"impulse_id": "errorContext", "was_useful": True},
        {"impulse_id": "newImpulse", "was_useful": True}
    ]
))

# Verify new variant created
variants = await db.query("SELECT * FROM activity_variants WHERE parent_id = 'bug-fix-v1'")
assert len(variants) > 0
assert "newImpulse" in str(variants[0]["task_steps"])
```

---

## Phase 2B: CLI Integration - Component Association (4-6 hours)

**Purpose**: Connect metabob-cli component analysis to execution outcomes

### Task 4: MCP Tool Integration Assessment
**Duration**: 2 hours  
**Dependencies**: Task 0 complete

**Context Check**:
- Read: `CLI_METABOB_TOOLS_REFERENCE.md` (from Task 0)
- Read: `repos/metabob-cli/src/metabob_cli/mcp/app.py`

**Sub-tasks**:
1. **Map Available Metabob Tools** (60 min)
   - Tools to document:
     - `metabob_list_file_components` - Get components in file
     - `metabob_annotate_component` - Add annotation to component
     - `metabob_get_component_annotations` - Read existing annotations
     - `metabob_suggest_related_changes` - Cochange analysis
     - `metabob_search_codebase_issues` - Find related issues
   - Document: Input parameters, output format, usage examples
   - **Output**: `METABOB_TOOL_USAGE_GUIDE.md`

2. **Design Component Extraction Flow** (60 min)
   - Question: How does OpenCode report what files/components changed?
   - Option A: OpenCode extracts from git diff
   - Option B: CLI extracts when recording outcome
   - Option C: Both (OpenCode provides files, CLI extracts components)
   - **Decision**: Document chosen approach with rationale
   - **Output**: `COMPONENT_EXTRACTION_DESIGN.md`

**Acceptance Criteria**:
- [x] All Metabob tools documented with examples
- [x] Component extraction flow designed
- [x] Data flow diagram created (user action → component annotation)
- [x] No code written yet (design only)

---

### Task 5: Component Change Extraction
**Duration**: 2-3 hours  
**Dependencies**: Task 4 complete

**Context Check**:
- Read: `COMPONENT_EXTRACTION_DESIGN.md` (from Task 4)
- Read: `repos/metabob-cli/src/metabob_cli/mcp/` (existing tool implementations)

**Sub-tasks**:
1. **Add MCP Tool: extract_execution_components** (90 min)
   - File: `repos/metabob-cli/src/metabob_cli/mcp/activity_tools.py` (new or extend existing)
   - Tool:
     ```python
     @mcp.tool()
     async def extract_execution_components(
         execution_id: str,
         changed_files: List[str],
         git_diff: Optional[str] = None
     ) -> Dict[str, Any]:
         """
         Extract component changes from execution.
         
         Given list of changed files, identifies which components
         (functions, classes) were modified and annotates them.
         
         Returns component_changes for backend storage.
         """
         component_changes = []
         
         for file_path in changed_files:
             # Get components in this file
             components = await metabob_list_file_components(file_path)
             
             for component in components:
                 # Check if this component was actually modified
                 if git_diff and component_in_diff(component, git_diff, file_path):
                     component_changes.append({
                         "file_path": file_path,
                         "component_name": component["name"],
                         "change_type": detect_change_type(component, git_diff),
                         "related_impulses": []  # Filled by backend
                     })
         
         return {"component_changes": component_changes}
     ```
   - **Validation**: Tool callable via MCP, returns correct format

2. **Add MCP Tool: annotate_execution_components** (60 min)
   - Tool:
     ```python
     @mcp.tool()
     async def annotate_execution_components(
         execution_id: str,
         component_changes: List[Dict],
         execution_description: str
     ) -> Dict[str, Any]:
         """
         Annotate components modified during execution.
         
         Creates component annotations explaining WHY changes were made.
         These annotations feed back into future impulse synthesis.
         """
         annotations_created = []
         
         for change in component_changes:
             annotation = await metabob_annotate_component(
                 file_path=change["file_path"],
                 component_name=change["component_name"],
                 component_type="function",  # TODO: Detect actual type
                 reason=f"Modified by execution {execution_id}: {execution_description}"
             )
             
             annotations_created.append({
                 "file_path": change["file_path"],
                 "component": change["component_name"],
                 "annotation_id": annotation.get("id")
             })
         
         return {"annotations": annotations_created}
     ```
   - **Validation**: Annotations created successfully

**Acceptance Criteria**:
- [x] Component extraction tool implemented
- [x] Annotation tool implemented
- [x] Tools accessible via MCP
- [x] Output format matches backend expectations
- [x] Git diff parsing works correctly

**Testing**:
```python
# Test component extraction
result = await extract_execution_components(
    execution_id="test_123",
    changed_files=["src/auth.ts"],
    git_diff="""
    +++ src/auth.ts
    @@ -10,5 +10,7 @@
     function validateToken(token: string) {
    +  if (!token) return false;
       return jwt.verify(token, SECRET);
     }
    """
)
assert len(result["component_changes"]) == 1
assert result["component_changes"][0]["component_name"] == "validateToken"
```

---

## Phase 2C: OpenCode Integration - Outcome Reporting (3-4 hours)

**Purpose**: Enable OpenCode to report execution outcomes with impulse/component data

### Task 6: Outcome Reporting Flow Design
**Duration**: 1 hour  
**Dependencies**: Task 5 complete

**Context Check**:
- Read: `OPENCODE_ACTIVITY_STATUS.md` (from Task 0)
- Read: Existing OpenCode activity code

**Sub-tasks**:
1. **Design Outcome Reporting Flow** (60 min)
   - Question: When does OpenCode report execution outcome?
   - Answer: After activity completes (success or failure)
   - Flow:
     ```
     Activity execution completes
     ↓
     OpenCode collects:
     - execution_id
     - success/failure
     - duration, cost, tokens
     - files modified (from git status)
     ↓
     Call MCP tool: report_execution_outcome
     ↓
     CLI extracts components from files
     ↓
     CLI calls backend: POST /v2/activities/executions/complete
     ↓
     Backend stores + checks commissioning
     ```
   - **Output**: `OUTCOME_REPORTING_FLOW.md`

**Acceptance Criteria**:
- [x] Flow documented with sequence diagram
- [x] Data format specified for each step
- [x] Error handling specified
- [x] Rollback strategy defined

---

### Task 7: OpenCode Outcome Reporting (Implementation)
**Duration**: 2-3 hours  
**Dependencies**: Task 6 complete

**Context Check**:
- Read: `OUTCOME_REPORTING_FLOW.md` (from Task 6)
- Read: Existing OpenCode activity orchestration code

**Sub-tasks**:
1. **Add MCP Tool: report_execution_outcome** (CLI side) (90 min)
   - File: `repos/metabob-cli/src/metabob_cli/mcp/activity_tools.py`
   - Tool:
     ```python
     @mcp.tool()
     async def report_execution_outcome(
         execution_id: str,
         variant_id: str,
         session_id: str,
         success: bool,
         duration_ms: int,
         cost: float,
         tokens_used: int,
         changed_files: List[str],
         impulses_loaded: List[Dict],  # From session memory
         git_diff: Optional[str] = None,
         failure_reason: Optional[str] = None
     ) -> Dict[str, Any]:
         """
         Report activity execution outcome to backend.
         
         1. Extracts component changes from changed_files
         2. Maps impulses_loaded to impulses_used (tracks which were useful)
         3. Calls backend API to store outcome
         4. Returns commissioning info if new variant created
         """
         # Extract components
         components_result = await extract_execution_components(
             execution_id, changed_files, git_diff
         )
         
         # Map impulses (TODO: Track which were actually useful)
         impulses_used = [
             {
                 "impulse_id": imp["id"],
                 "content_hash": compute_hash(imp["content"]),
                 "tokens_used": imp.get("tokens", 0),
                 "was_useful": True  # TODO: Sophisticated tracking
             }
             for imp in impulses_loaded
         ]
         
         # Call backend
         async with httpx.AsyncClient() as client:
             response = await client.post(
                 f"{BACKEND_URL}/v2/activities/executions/complete",
                 json={
                     "execution_id": execution_id,
                     "variant_id": variant_id,
                     "session_id": session_id,
                     "success": success,
                     "duration_ms": duration_ms,
                     "cost": cost,
                     "tokens_used": tokens_used,
                     "impulses_used": impulses_used,
                     "component_changes": components_result["component_changes"],
                     "failure_reason": failure_reason
                 },
                 headers={"Authorization": f"Bearer {get_api_key()}"}
             )
         
         result = response.json()
         
         # Annotate components if successful
         if success and components_result["component_changes"]:
             await annotate_execution_components(
                 execution_id,
                 components_result["component_changes"],
                 "Activity execution outcome"
             )
         
         return result
     ```
   - **Validation**: Tool works end-to-end

2. **OpenCode Integration** (if needed) (60 min)
   - Location: `repos/metabob-opencode/packages/opencode/src/activity/`
   - After activity execution:
     ```typescript
     // After activity completes
     const changedFiles = await getGitChangedFiles();
     const impulsesLoaded = sessionMemory.getLoadedImpulses();
     
     await mcp.call("report_execution_outcome", {
       execution_id: activity.executionId,
       variant_id: activity.variantId,
       session_id: sessionId,
       success: activity.success,
       duration_ms: activity.durationMs,
       cost: activity.cost,
       tokens_used: activity.tokensUsed,
       changed_files: changedFiles,
       impulses_loaded: impulsesLoaded,
       failure_reason: activity.failureReason
     });
     ```
   - **Note**: May already exist; check first!

**Acceptance Criteria**:
- [x] MCP tool implemented and tested
- [x] OpenCode calls tool after execution
- [x] Component extraction works
- [x] Backend receives complete outcome data
- [x] Annotations created for successful executions

**Testing**:
```python
# End-to-end test
result = await report_execution_outcome(
    execution_id="test_e2e",
    variant_id="bug-fix-v1",
    session_id="sess_123",
    success=True,
    duration_ms=5000,
    cost=0.10,
    tokens_used=1500,
    changed_files=["src/auth.ts"],
    impulses_loaded=[
        {"id": "errorContext", "content": "...", "tokens": 800}
    ]
)

assert result["success"] == True
assert "commissioned" in result

# Verify backend stored it
execution = await backend_db.select(f"activity_executions:{result['execution_id']}")
assert len(execution["impulses_used"]) > 0
assert len(execution["component_changes"]) > 0
```

---

## Phase 2D: End-to-End Validation (2 hours)

### Task 8: Integration Testing
**Duration**: 2 hours  
**Dependencies**: Tasks 1-7 complete

**Sub-tasks**:
1. **Create E2E Test Scenario** (30 min)
   - Scenario: Execute bug-fix template with error context
   - Expected: Backend stores outcome, checks commissioning
   - File: `tests/integration/test_phase2_execution_learning.py`

2. **Execute Test & Validate** (60 min)
   - Run: Full flow from OpenCode → CLI → Backend
   - Verify:
     - Execution stored with impulses
     - Components extracted and annotated
     - Commissioning logic runs (may not trigger if pattern not detected)
     - All data matches proto schema

3. **Performance Check** (30 min)
   - Measure: Overhead of new tracking
   - Target: <100ms added latency
   - Optimize if needed

**Acceptance Criteria**:
- [x] E2E test passes
- [x] All data flows correctly
- [x] Performance acceptable
- [x] Proto compliance verified

---

## Success Metrics

**Phase 2 Complete When**:
- ✅ Backend stores execution outcomes with impulse provenance
- ✅ Backend detects patterns and commissions variants automatically
- ✅ CLI extracts components from changed files
- ✅ CLI annotates components with execution context
- ✅ OpenCode reports outcomes via MCP
- ✅ E2E test demonstrates full learning loop
- ✅ All code matches proto schema
- ✅ No breaking changes to existing functionality

---

## Risk Mitigation

### Risk 1: Existing Code Collision
**Mitigation**: Task 0 (discovery) runs first, maps everything
**Validation**: Read existing code before writing new code

### Risk 2: Proto Schema Mismatch
**Mitigation**: Copy proto definitions verbatim into reference doc
**Validation**: Compare Pydantic models to proto line-by-line

### Risk 3: Performance Impact
**Mitigation**: Task 8 includes performance testing
**Validation**: Measure latency, optimize if >100ms overhead

### Risk 4: Breaking Changes
**Mitigation**: Extend existing models, don't replace
**Validation**: Run existing tests after each task

---

## Timeline Estimate

**Phase 2A (Backend)**: 6-8 hours
- Task 1: 2 hours
- Task 2: 3 hours
- Task 3: 3 hours

**Phase 2B (CLI)**: 4-6 hours
- Task 4: 2 hours
- Task 5: 2-3 hours

**Phase 2C (OpenCode)**: 3-4 hours
- Task 6: 1 hour
- Task 7: 2-3 hours

**Phase 2D (Validation)**: 2 hours
- Task 8: 2 hours

**Pre-Phase (Discovery)**: 1 hour
- Task 0: 1 hour

**Total**: 16-21 hours (2-3 days with breaks and debugging)

---

## Next Session Start Here

1. **Run Task 0**: Architectural discovery (1 hour)
   - Create four reference documents
   - No coding yet
   - Pure analysis

2. **Review outputs** with user before proceeding

3. **Begin Task 1** only after Task 0 validated

**Remember**: Discovery first, implementation second!
