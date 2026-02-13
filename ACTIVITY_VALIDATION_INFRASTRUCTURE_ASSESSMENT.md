# Activity Template Creation Validation Infrastructure Assessment

**Date**: February 12, 2026  
**Status**: GAPS IDENTIFIED - Implementation Required

## Executive Summary

The activity system is operational for template execution, but **validation infrastructure for activity-create templates is incomplete**. We have the pieces but are missing critical integration:

### ✅ What Exists
1. Activity execution engine with trailblazing mode
2. Template registration via `/v2/activities/templates` API
3. Execution recording via `/v2/activities/record/complete`
4. Basic validation framework in activity_manager.py
5. SurrealDB for execution tracking (via backend)

### ❌ What's Missing
1. **Isolated workspace execution** - No filetree isolation for activity-create
2. **Template registration validation** - No check that template was actually registered
3. **Impulse recording per step** - Step results lack impulse IDs
4. **Variant creation from trailblazing** - No automatic variant generation
5. **Population management** - No merge/split/refine logic

## Current Architecture

### Activity Execution Flow

```
Agent → search_activities() 
     → activity(templateId, variables)
     → ActivityManager.start_execution()
     → Step 1...N execution
     → Validation check
     → [SUCCESS] → record_outcome()
     → [FAILURE] → enter_trailblazing() → additional steps → derive_template()
```

### Data Structures

**ActivityExecution** (in-memory):
```python
@dataclass
class ActivityExecution:
    execution_id: str
    activity_id: str
    session_id: str
    variant_id: str
    current_step_index: int
    state: ExecutionState  # PENDING, RUNNING, TRAILBLAZING, COMPLETED, FAILED
    step_results: list[StepResult]
    total_cost: float
    total_tokens: int
    trailblazing_attempts: int
    variables: dict
```

**StepResult** (in-memory):
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
    # MISSING: impulse_ids: list[str]
```

**Backend Recording** (via `/v2/activities/record/complete`):
```json
{
  "execution_id": "exec_...",
  "success": true/false,
  "duration_ms": 12345,
  "cost": 0.42,
  "tokens": 5000,
  "step_results": [...],
  "outcome": "success|failure",
  "notes": "Trailblazing attempts: 2"
}
```

## Gap Analysis

### Gap 1: Isolated Workspace Execution ⚠️ CRITICAL

**Problem**: Activity-create template executes in the main workspace, polluting the filetree.

**Required**:
```python
class IsolatedWorkspace:
    """Isolated execution environment for activity template creation"""
    
    def __init__(self, base_path: str, template_name: str):
        self.workspace_dir = Path(f".activity-sandbox/{template_name}-{uuid4().hex[:8]}")
        self.created_files: list[str] = []
        
    def __enter__(self):
        """Create isolated directory"""
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        os.chdir(self.workspace_dir)
        return self
        
    def __exit__(self, *args):
        """Cleanup isolated directory"""
        os.chdir(self.original_dir)
        shutil.rmtree(self.workspace_dir)
        
    def track_file(self, filepath: str):
        """Track files created during execution"""
        self.created_files.append(filepath)
```

**Integration Point**: `activity_manager.py::start_execution()`
- Detect if activity is "activity-create" category
- Wrap execution in IsolatedWorkspace context manager
- Pass workspace path to validation

**Validation Enhancement**:
```python
async def _run_validation(self, execution: ActivityExecution, validation: dict) -> dict:
    validation_type = validation.get("type", "none")
    
    if validation_type == "template_registered":
        # NEW: Check if template was actually registered in backend
        template_name = execution.variables.get("template_name")
        results = await self.search_activities(query=template_name, limit=5)
        
        found = any(t.get("name") == template_name for t in results)
        
        if not found:
            return {
                "success": False,
                "error": f"Template '{template_name}' not found in backend after registration"
            }
        return {"success": True}
```

### Gap 2: Impulse Recording Per Step ⚠️ HIGH PRIORITY

**Problem**: StepResult doesn't track impulses used/created during step execution.

**Current**:
```python
@dataclass
class StepResult:
    step_id: str
    success: bool
    output: str
    # Missing impulse tracking!
```

**Required**:
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
    
    # NEW: Impulse tracking
    impulses_loaded: list[str] = field(default_factory=list)  # Impulse IDs loaded as input
    impulses_created: list[str] = field(default_factory=list)  # Impulse IDs created as output
    context_summary: dict = field(default_factory=dict)  # Context selection metadata
```

**Backend Schema Update** (SurrealDB):
```sql
-- Add impulse tracking to execution records
DEFINE TABLE execution_steps SCHEMAFULL;
DEFINE FIELD execution_id ON execution_steps TYPE record(executions);
DEFINE FIELD step_id ON execution_steps TYPE string;
DEFINE FIELD step_index ON execution_steps TYPE int;
DEFINE FIELD success ON execution_steps TYPE bool;
DEFINE FIELD output ON execution_steps TYPE string;
DEFINE FIELD error ON execution_steps TYPE option<string>;
DEFINE FIELD cost ON execution_steps TYPE float;
DEFINE FIELD tokens ON execution_steps TYPE int;
DEFINE FIELD duration_ms ON execution_steps TYPE int;
DEFINE FIELD tool_calls ON execution_steps TYPE array;
DEFINE FIELD impulses_loaded ON execution_steps TYPE array;
DEFINE FIELD impulses_created ON execution_steps TYPE array;
DEFINE FIELD context_summary ON execution_steps TYPE object;
DEFINE FIELD created_at ON execution_steps TYPE datetime DEFAULT time::now();
```

**Integration**: Update `report_step_result()` to accept impulse IDs:
```python
async def report_step_result(
    self,
    execution_id: str,
    result: str,  # "success" | "failure"
    output: str,
    error: Optional[str] = None,
    cost: float = 0.0,
    tokens: int = 0,
    tool_calls: list = None,
    # NEW parameters:
    impulses_loaded: list[str] = None,
    impulses_created: list[str] = None,
    context_summary: dict = None,
) -> dict:
    # ... existing code ...
    
    step_result = StepResult(
        step_id=f"step_{execution.current_step_index}",
        success=(result == "success"),
        output=output,
        error=error,
        cost=cost,
        tokens=tokens,
        duration_ms=duration_ms,
        tool_calls=tool_calls or [],
        impulses_loaded=impulses_loaded or [],
        impulses_created=impulses_created or [],
        context_summary=context_summary or {},
    )
```

### Gap 3: Automatic Variant Creation from Trailblazing ⚠️ MEDIUM PRIORITY

**Problem**: Trailblazing creates fixes but doesn't automatically create new variants.

**Current Flow**:
```
Validation fails → enter_trailblazing() → generate fix step → agent executes
→ validation succeeds → record_outcome(success=True)
→ NO VARIANT CREATED
```

**Required Flow**:
```
Validation fails → enter_trailblazing() → generate fix step → agent executes
→ validation succeeds → capture_trailblazing_changes()
→ derive_template(parent_id, changes, evolution_note="Trailblaze fix")
→ record_outcome(success=True, variant_id=new_variant_id)
```

**Implementation**:
```python
async def _complete_execution(self, execution_id: str, activity: dict) -> dict:
    # ... existing validation logic ...
    
    if validation_result.get("success"):
        execution.state = ExecutionState.COMPLETED
        
        # NEW: If trailblazing was used, create variant
        if execution.trailblazing_attempts > 0:
            variant_result = await self._create_trailblaze_variant(execution, activity)
            if variant_result.get("status") == "success":
                logger.info(f"Created variant {variant_result['template_id']} from trailblazing")
        
        await self._record_outcome(execution, success=True)
        return {"complete": True, "message": "Activity completed and validated"}
        
async def _create_trailblaze_variant(
    self, execution: ActivityExecution, activity: dict
) -> dict:
    """Create new variant from successful trailblazing"""
    
    # Extract changes from trailblazing steps
    trailblaze_steps = [
        sr for sr in execution.step_results 
        if sr.step_id.startswith("trailblaze_")
    ]
    
    if not trailblaze_steps:
        return {"status": "skipped", "message": "No trailblazing steps"}
    
    # Build changes dict
    changes = {
        "description": f"{activity.get('description', '')} (with trailblaze fixes)",
        "tasks": self._merge_trailblaze_steps(activity.get("tasks", []), trailblaze_steps),
        "trailblazing": {
            "enabled": True,
            "max_attempts": execution.trailblazing_attempts + 1
        }
    }
    
    evolution_note = f"Variant created from {execution.trailblazing_attempts} trailblaze fix(es)"
    
    return await self.derive_template(
        parent_id=execution.activity_id,
        changes=changes,
        evolution_note=evolution_note,
        evolution_type="trailblaze_fix"
    )
```

### Gap 4: Population Management (Merge/Split/Refine) ⚠️ LOW PRIORITY

**Problem**: No logic to analyze execution data and decide when to:
- **Merge** two similar templates into one
- **Split** a complex template into multiple simpler ones
- **Refine** a template based on success/failure patterns

**Required**: Backend service (separate from activity execution):
```python
# repos/metabob-rpc-api/services/template_evolution.py

class TemplateEvolutionService:
    """Analyzes execution data and evolves template population"""
    
    async def analyze_population(self, category: str = None):
        """Identify opportunities for merge/split/refine"""
        
        # 1. Find similar templates with redundant tasks
        merge_candidates = await self._find_merge_candidates(category)
        
        # 2. Find complex templates with high failure rates
        split_candidates = await self._find_split_candidates(category)
        
        # 3. Find templates with consistent failure patterns
        refine_candidates = await self._find_refine_candidates(category)
        
        return {
            "merge": merge_candidates,
            "split": split_candidates,
            "refine": refine_candidates
        }
    
    async def _find_merge_candidates(self, category: str) -> list[dict]:
        """Find templates that are similar and could be merged"""
        # Query: Templates with >80% task overlap and similar success rates
        
    async def _find_split_candidates(self, category: str) -> list[dict]:
        """Find templates that are too complex and should be split"""
        # Query: Templates with >7 tasks and success rate <0.5
        
    async def _find_refine_candidates(self, category: str) -> list[dict]:
        """Find templates with consistent failure patterns"""
        # Query: Templates with consistent failures at specific steps
```

**Scheduled Job**: Run every 24 hours or after N executions:
```python
# Background task
async def evolve_template_population():
    service = TemplateEvolutionService()
    
    for category in ["feature", "bugfix", "refactor", "infrastructure"]:
        analysis = await service.analyze_population(category)
        
        # Auto-merge if confidence > 0.9
        for merge in analysis["merge"]:
            if merge["confidence"] > 0.9:
                await service.merge_templates(merge["template_ids"])
        
        # Suggest splits for human review
        for split in analysis["split"]:
            await service.create_split_proposal(split)
```

## Implementation Roadmap

### Phase 1: Isolated Workspace (2 hours)
**Priority**: CRITICAL  
**Files**:
- `repos/metabob-cli/src/metabob_cli/mcp/isolated_workspace.py` (NEW)
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` (UPDATE)

**Tasks**:
1. Create `IsolatedWorkspace` class with context manager
2. Update `start_execution()` to detect activity-create templates
3. Wrap execution in isolated workspace
4. Add `template_registered` validation type
5. Test with activity-create execution

### Phase 2: Impulse Recording (3 hours)
**Priority**: HIGH  
**Files**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` (UPDATE StepResult)
- `repos/metabob-rpc-api/` (UPDATE backend schema + API)

**Tasks**:
1. Add impulse fields to `StepResult` dataclass
2. Update `report_step_result()` signature
3. Update backend `/v2/activities/record/complete` endpoint
4. Add `execution_steps` table to SurrealDB schema
5. Update OpenCode activity tool to pass impulse IDs

### Phase 3: Trailblaze Variant Creation (2 hours)
**Priority**: MEDIUM  
**Files**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` (UPDATE)

**Tasks**:
1. Implement `_create_trailblaze_variant()`
2. Implement `_merge_trailblaze_steps()`
3. Update `_complete_execution()` to call variant creation
4. Test trailblaze-to-variant flow

### Phase 4: Population Management (8+ hours)
**Priority**: LOW (can be deferred)  
**Files**:
- `repos/metabob-rpc-api/services/template_evolution.py` (NEW)
- `repos/metabob-rpc-api/services/scheduler.py` (UPDATE)

**Tasks**:
1. Implement `TemplateEvolutionService`
2. Add scheduled job for population analysis
3. Implement merge/split/refine logic
4. Create admin dashboard for reviewing proposals

## Testing Strategy

### Test 1: Isolated Workspace
```python
# test_isolated_workspace.py
async def test_activity_create_isolation():
    """Verify activity-create runs in isolated directory"""
    
    # Execute activity-create
    exec_id = await manager.start_execution(
        activity_id="INFRASTRUCTURE-0013e379",
        variables={
            "template_name": "test-isolated",
            "template_description": "Test isolation",
            "tasks": [...]
        }
    )
    
    # Verify execution created isolated directory
    assert Path(".activity-sandbox/test-isolated-*/").exists()
    
    # Verify main workspace not polluted
    assert not Path("./test-template.json").exists()
    
    # Verify cleanup after completion
    await wait_for_completion(exec_id)
    assert not any(Path(".activity-sandbox/").iterdir())
```

### Test 2: Impulse Recording
```python
async def test_impulse_recording():
    """Verify impulses are recorded per step"""
    
    exec_id = await manager.start_execution(...)
    
    # Execute step with impulses
    await manager.report_step_result(
        execution_id=exec_id,
        result="success",
        output="Step completed",
        impulses_loaded=["impulse-abc", "impulse-def"],
        impulses_created=["impulse-xyz"],
        context_summary={"tokens": 2000, "source": "session_memory"}
    )
    
    # Verify impulses recorded in backend
    execution_data = await get_execution_from_db(exec_id)
    step_data = execution_data["steps"][0]
    assert "impulse-abc" in step_data["impulses_loaded"]
    assert "impulse-xyz" in step_data["impulses_created"]
```

### Test 3: Trailblaze Variant Creation
```python
async def test_trailblaze_variant():
    """Verify successful trailblazing creates new variant"""
    
    # Execute activity that will fail validation
    exec_id = await manager.start_execution(...)
    
    # Simulate trailblazing
    await manager.enter_trailblazing(exec_id, "Validation failed: X")
    # ... agent fixes issue ...
    
    # Complete execution
    final_state = await manager.get_execution_state(exec_id)
    
    # Verify new variant was created
    assert final_state["variant_created"] is True
    new_variant_id = final_state["new_variant_id"]
    
    # Verify variant is discoverable
    variants = await manager.search_activities(query="test-activity")
    assert any(v["id"] == new_variant_id for v in variants)
```

### Test 4: End-to-End Activity-Create
```python
async def test_activity_create_e2e():
    """Full end-to-end test of activity-create template"""
    
    # 1. Execute activity-create in isolated workspace
    exec_id = await manager.start_execution(
        activity_id="INFRASTRUCTURE-0013e379",
        variables={
            "template_name": "e2e-test-template",
            "template_description": "End-to-end test",
            "template_category": "test",
            "tasks": json.dumps([{
                "subagent": "general",
                "prompt": "Echo hello",
                "validation": {"type": "output_contains", "value": "hello"}
            }])
        }
    )
    
    # 2. Wait for completion (max 5 minutes)
    final_state = await wait_for_completion(exec_id, timeout=300)
    assert final_state["status"] == "completed"
    
    # 3. Verify template was registered in backend
    templates = await manager.search_activities(query="e2e-test-template")
    assert len(templates) > 0
    new_template = templates[0]
    
    # 4. Verify template is executable
    test_exec_id = await manager.start_execution(
        activity_id=new_template["id"],
        variables={}
    )
    test_result = await wait_for_completion(test_exec_id, timeout=60)
    assert test_result["status"] == "completed"
    
    # 5. Verify execution data stored in SurrealDB
    execution_record = await get_execution_from_db(exec_id)
    assert len(execution_record["steps"]) >= 5  # activity-create has 5 steps
    assert all("impulses_loaded" in step for step in execution_record["steps"])
```

## Success Criteria

The validation infrastructure is complete when:

- [x] ✅ Activity execution engine works (already done)
- [ ] ⚠️  Activity-create runs in isolated workspace
- [ ] ⚠️  Template registration is validated
- [ ] ⚠️  Impulses recorded per step in SurrealDB
- [ ] ⚠️  Successful trailblazing creates new variants
- [ ] ⚠️  All execution data queryable from SurrealDB
- [ ] ⏳ Population management (optional, can defer)

## Next Steps

1. **Implement Phase 1** (Isolated Workspace) - 2 hours
2. **Implement Phase 2** (Impulse Recording) - 3 hours
3. **Test End-to-End** with activity-create template
4. **Implement Phase 3** (Trailblaze Variants) - 2 hours
5. **Defer Phase 4** (Population Management) for later

**Estimated Total**: 7 hours for core functionality (Phases 1-3)

## Conclusion

We have a **functional activity execution system** but are **missing validation-specific infrastructure**. The gaps are well-defined and can be implemented in ~7 hours of focused work.

**Priority Order**:
1. Isolated workspace (blocks safe testing)
2. Impulse recording (enables learning)
3. Trailblaze variants (improves templates)
4. Population management (optimization, can wait)

Once Phases 1-3 are complete, we can confidently execute activity-create templates, validate their success, and evolve the template population through trailblazing.
