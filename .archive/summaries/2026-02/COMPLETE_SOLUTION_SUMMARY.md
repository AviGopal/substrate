# Complete Solution Summary - Activity System Schema Alignment

**Date**: 2026-02-08  
**Problem**: Schema mismatch preventing activity template creation  
**Root Cause**: Backend API diverged from proto  
**Solution**: Align backend with proto + implement full design intent

---

## What We Discovered (Algorithmic Evidence)

### The Schema Mismatch

**Three different schemas**:
1. **Proto** (variant.proto): `TaskStep` with `id`, `description`, `prompt` (nested), `impulse_refs`
2. **Backend API** (v2_activities.py): `TemplateTask` with `order`, `type`, `prompt_template` (flat) 
3. **OpenCode** (activity-template.ts): Matches proto ✅

**Evidence**: 422 error showing backend expects fields that don't exist in proto
- Missing: `order`, `type`, `prompt_template`
- Present: `id`, `description`, `prompt` (nested)

**Documented in**: `SCHEMA_MISMATCH_ROOT_CAUSE.md`

---

## The Design Intent (From Architect)

### Three System Roles

**metabob-opencode** (Executor):
- Runs activity templates
- Executes with impulse-enriched context
- Reports outcomes

**metabob-rpc-api** (Repository):
- Stores templates with impulse provenance
- Tracks which impulses led to success
- Commissions new variants when patterns emerge

**metabob-cli** (Mediator):
- Associates code structure changes with executions
- Synthesizes impulses from component analysis
- Connects execution outcomes to codebase state

**Key insight**: The system learns which impulses (context) lead to successful outcomes, and crystallizes that knowledge into templates.

**Documented in**: `CORRECT_ARCHITECTURE_DESIGN.md`

---

## The Missing Pieces

### 1. Impulse Provenance Tracking (NOT IN CURRENT BACKEND)

Proto defines:
```protobuf
message TaskStep {
  repeated ImpulseReference impulse_refs = 21;  // ← Missing in backend API
}

message ImpulseReference {
  string impulse_id = 1;        // "errorContext", "componentAnnotations"
  ImpulsePriority priority = 2;
  bool required = 3;
}
```

Backend API has:
```python
class TemplateTask(BaseModel):
    order: int
    type: str
    prompt_template: str
    # ← No impulse_refs field!
```

**Impact**: Backend can't track which impulses templates need, breaking the learning loop.

### 2. Component-to-Execution Association (NOT IMPLEMENTED)

Design intent: metabob-cli should associate code changes with activity executions

**Missing**:
- ExecutionOutcome storage with component_changes
- Component annotation integration
- Impulse synthesis from component analysis

### 3. Variant Commissioning Logic (NOT IMPLEMENTED)

Design intent: Backend should automatically create new variants from successful executions

**Missing**:
- Divergence detection
- Pattern recognition (3+ similar divergences)
- Genealogy tracking with source_execution_id

---

## The Complete Solution

### Phase 1: Schema Alignment (Immediate - 2 hours)

**Backend API migration to proto schema**:

```python
# repos/metabob-rpc-api/server/routes/v2_activities.py

# BEFORE (wrong schema):
class TemplateTask(BaseModel):
    order: int
    type: str
    prompt_template: str

# AFTER (proto schema):
from server.models.proto_variant import ProtoTaskStep

class ProtoTaskStep(BaseModel):
    """Matches proto TaskStep exactly"""
    id: str
    subagent: str
    description: str
    dependencies: List[str]
    prompt: TaskPrompt                         # Nested object
    validation: TaskValidation                 # Nested object  
    retry: TaskRetry                           # Nested object
    metrics: TaskMetrics                       # Nested object
    impulse_refs: List[ImpulseReference]       # ← KEY: Provenance tracking

class TemplateCreateRequest(BaseModel):
    name: str
    description: str
    category: str
    tasks: List[ProtoTaskStep]  # ← Now uses proto schema
```

**Migration script for existing data**:
```python
# scripts/migrate_to_proto_schema.py

async def migrate_templates():
    """Convert old schema to proto schema"""
    templates = await db.select("activity_variants")
    
    for template in templates:
        # Convert tasks
        proto_tasks = []
        for task in template["tasks"]:
            proto_task = {
                "id": f"task-{task['order']}",
                "subagent": task.get("agent_mode", "general"),
                "description": f"Task {task['order']}",
                "dependencies": [],
                "prompt": {
                    "template": task["prompt_template"],
                    "max_tokens": 8000
                },
                "validation": task.get("validation", {}),
                "retry": {"max_attempts": 3, "strategy": "simple"},
                "metrics": {"success_rate": 0.0},
                "impulse_refs": []  # Initialize empty
            }
            proto_tasks.append(proto_task)
        
        # Update in database
        await db.update(template["id"], {"task_steps": proto_tasks})
```

### Phase 2: Impulse Provenance (1-2 days)

**Add ExecutionOutcome storage**:

```python
# New SurrealDB table: execution_outcomes

class ExecutionOutcome(BaseModel):
    execution_id: str
    variant_id: str
    impulses_used: List[ImpulseUsage]       # What impulses were loaded
    component_changes: List[ComponentChange] # What code changed
    success: bool
    duration_ms: int
    cost: float

class ImpulseUsage(BaseModel):
    impulse_id: str
    content_hash: str
    tokens_used: int
    was_useful: bool  # Agent actually used it

class ComponentChange(BaseModel):
    file_path: str
    component_name: str
    change_type: str  # MODIFIED, CREATED, DELETED
    related_impulses: List[str]  # Impulses that informed this change
```

**Backend endpoint**:
```python
@router.post("/executions/{execution_id}/complete")
async def complete_execution(
    execution_id: str,
    outcome: ExecutionOutcome,
    db: SurrealDBClient = Depends(get_surreal_connection)
):
    """Record execution outcome with impulse usage"""
    
    # Store outcome
    await db.create("execution_outcomes", outcome.dict())
    
    # Update variant metrics
    await update_variant_metrics(outcome.variant_id, outcome)
    
    # Update impulse provenance
    await update_impulse_provenance(outcome.impulses_used)
    
    # Check variant commissioning
    if await should_commission_variant(outcome):
        new_variant = await commission_variant(outcome)
        return {"commissioned": True, "variant_id": new_variant.variant_id}
    
    return {"commissioned": False}
```

### Phase 3: CLI Integration (2-3 days)

**Component analysis integration**:

```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py

async def enrich_template_with_components(
    template: dict,
    context: dict
) -> dict:
    """
    Enrich template request with component analysis.
    
    Uses Metabob tools:
    - list_file_components: Find components in current file
    - get_component_annotations: Load WHY components exist
    - suggest_related_changes: Find cochange patterns
    - search_codebase_issues: Find related issues
    """
    from .metabob_tools import (
        list_file_components,
        get_component_annotations,
        suggest_related_changes,
        search_codebase_issues
    )
    
    # Get components
    components = await list_file_components(context.get("current_file"))
    
    # Load annotations (why components exist)
    annotations = {}
    for comp in components:
        ann = await get_component_annotations(comp["file_path"], comp["name"])
        annotations[comp["name"]] = ann
    
    # Get cochange patterns
    cochanges = await suggest_related_changes([context.get("current_file")])
    
    # Get related issues
    issues = await search_codebase_issues(context.get("query", ""))
    
    # Synthesize impulses
    component_impulses = synthesize_component_impulses(
        components, annotations, cochanges, issues
    )
    
    # Add to template request
    template["component_context"] = {
        "components": components,
        "annotations": annotations,
        "cochanges": cochanges,
        "issues": issues[:5],  # Top 5 issues
        "synthesized_impulses": component_impulses
    }
    
    return template

def synthesize_component_impulses(
    components: list,
    annotations: dict,
    cochanges: dict,
    issues: list
) -> list:
    """
    Create impulses from component analysis.
    
    Returns impulses containing:
    - Why components exist (from annotations)
    - How they relate (from cochange patterns)
    - Common issues (from issue search)
    """
    impulses = []
    
    for comp in components:
        impulse = {
            "id": f"component-{comp['name']}-context",
            "type": "component",
            "priority": "MEDIUM",
            "content": {
                "component": comp["name"],
                "file": comp["file_path"],
                "why_exists": annotations.get(comp["name"], {}).get("reason", ""),
                "cochange_partners": [
                    c["file"] for c in cochanges.get("suggestions", [])
                ],
                "common_issues": [
                    {"severity": i["severity"], "description": i["description"]}
                    for i in issues if comp["file_path"] in i.get("file_path", "")
                ]
            }
        }
        impulses.append(impulse)
    
    return impulses
```

**Execution outcome reporting**:

```python
async def report_execution_outcome(
    execution_id: str,
    variant_id: str,
    result: dict
) -> None:
    """
    Report execution outcome to backend.
    
    Includes:
    - Impulses that were used
    - Components that changed
    - Success/failure
    - Metrics
    """
    # Extract code changes from git diff
    component_changes = await extract_component_changes(result["changes"])
    
    # Annotate changed components
    for change in component_changes:
        await annotate_component(
            file_path=change["file_path"],
            component_name=change["component_name"],
            component_type=change["component_type"],
            reason=f"Modified by activity {execution_id}: {result['description']}"
        )
    
    # Build outcome
    outcome = {
        "execution_id": execution_id,
        "variant_id": variant_id,
        "impulses_used": result["impulses_used"],
        "component_changes": component_changes,
        "success": result["success"],
        "duration_ms": result["duration_ms"],
        "cost": result["cost"]
    }
    
    # Send to backend
    response = await self.client.post(
        f"/v2/activities/executions/{execution_id}/complete",
        json=outcome
    )
    
    if response.status_code == 200 and response.json().get("commissioned"):
        logger.info(f"New variant commissioned: {response.json()['variant_id']}")
```

### Phase 4: Variant Commissioning (1 day)

**Backend logic**:

```python
# repos/metabob-rpc-api/server/services/variant_service.py

async def should_commission_variant(outcome: ExecutionOutcome) -> bool:
    """
    Determine if execution should trigger new variant creation.
    
    Triggers:
    1. Execution diverged significantly (>30%) from template
    2. Different impulses used than template specified
    3. Pattern emerges (3+ executions with same divergence)
    """
    variant = await db.get("activity_variants", outcome.variant_id)
    
    # Calculate divergence
    divergence = calculate_divergence(variant.task_steps, outcome.actions_taken)
    
    if divergence > 0.3:  # 30% threshold
        # Check for pattern
        similar = await find_similar_divergences(
            outcome.variant_id,
            outcome.divergence_pattern
        )
        
        if len(similar) >= 3:  # Pattern threshold
            return True
    
    return False

async def commission_variant(outcome: ExecutionOutcome) -> ActivityVariant:
    """
    Create new variant from successful execution.
    
    Process:
    1. Extract actual steps from execution
    2. Compute content hash (genealogy)
    3. Preserve useful impulses
    4. Store with provenance
    """
    parent = await db.get("activity_variants", outcome.variant_id)
    
    # Extract what agent actually did
    actual_steps = extract_steps_from_execution(outcome)
    
    # Filter to impulses that were actually useful
    useful_impulse_refs = [
        ref for ref in outcome.impulses_used
        if ref.was_useful
    ]
    
    # Create new variant
    new_variant = ActivityVariant(
        variant_id=f"{parent.activity_id}-{compute_hash(actual_steps)[:8]}",
        activity_id=parent.activity_id,
        genealogy=Genealogy(
            content_hash=compute_hash(actual_steps),
            parent_hash=parent.genealogy.content_hash,
            reason="PATTERN_EMERGENCE",
            source_execution_id=outcome.execution_id
        ),
        task_steps=actual_steps,
        # Update task steps with useful impulses
        task_steps=[
            {**step, "impulse_refs": useful_impulse_refs}
            for step in actual_steps
        ]
    )
    
    await db.create("activity_variants", new_variant.dict())
    
    return new_variant
```

---

## Implementation Timeline

**Week 1**:
- ✅ Day 1: Document root cause (DONE)
- ⏳ Day 2: Backend schema migration (2 hours)
- ⏳ Day 2: Data migration script (1 hour)
- ⏳ Day 3-4: ExecutionOutcome storage (2 days)

**Week 2**:
- ⏳ Day 5-7: CLI component integration (3 days)
- ⏳ Day 8: Variant commissioning logic (1 day)
- ⏳ Day 9-10: End-to-end testing (2 days)

**Total**: 10 days

---

## Success Criteria

1. ✅ OpenCode can create templates without 422 errors
2. ✅ Templates store impulse_refs (provenance)
3. ✅ Executions record impulse usage
4. ✅ CLI associates code changes with executions
5. ✅ Backend commissions variants from patterns
6. ✅ System learns: successful impulses → better templates

---

## Documentation Created

1. **SCHEMA_MISMATCH_ROOT_CAUSE.md** - Algorithmic proof of schema divergence
2. **SCHEMA_MISMATCH_ACTION_PLAN.md** - Immediate fixes and migration steps
3. **CORRECT_ARCHITECTURE_DESIGN.md** - Full design intent and data flows
4. **COMPLETE_SOLUTION_SUMMARY.md** (this document) - Integration of all pieces

---

## Key Takeaways

**The real problem**: Not just schema mismatch, but missing architecture:
- Backend schema lacks impulse provenance tracking
- No component-to-execution association
- No variant commissioning logic
- CLI doesn't synthesize component impulses

**The complete fix**: 
1. Align backend schema with proto (enables provenance)
2. Add ExecutionOutcome storage (enables learning)
3. Integrate CLI component analysis (enables synthesis)
4. Implement variant commissioning (enables evolution)

**The vision**: A system that learns which context (impulses) leads to successful outcomes, and crystallizes that knowledge into better templates over time.

This transforms the system from **static templates** into **evolutionary patterns** that improve through use.
