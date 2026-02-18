# Correct Architecture Design - Activity System Data Flow

**Date**: 2026-02-08  
**Based on**: Core design considerations from architect

---

## The Design Intent

### Three System Roles

**1. metabob-opencode** (Executor)
- **Role**: Run activities, execute templates
- **Responsibility**: Activity execution runtime
- **Storage**: None (ephemeral session state only)
- **Schema**: Proto-based (execution-time structures)

**2. metabob-rpc-api Backend** (Repository)
- **Role**: Store activity templates with provenance
- **Responsibility**: 
  - Template versioning and variants
  - Impulse provenance tracking (why template exists)
  - Variant commissioning triggers (when to create new variants)
  - Learning from executions
- **Storage**: SurrealDB (persistent)
- **Schema**: Proto-based (storage schema)

**3. metabob-cli** (Mediator)
- **Role**: Mediate between OpenCode and Backend
- **Responsibility**:
  - Associate code structure changes with activity executions
  - Track component annotations (why components exist, how they work)
  - Synthesize impulses about components that change frequently
  - Connect execution outcomes to codebase state
- **Storage**: None (reads from Metabob analysis engine)
- **Schema**: Translation layer between systems

---

## Data Flow: The Complete Picture

```
┌────────────────────────────────────────────────────────────────┐
│ USER: "Fix authentication bug"                                 │
└──────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────────┐
│ metabob-opencode (Executor)                                    │
│ ──────────────────────────────────────────────────────────────│
│ 1. Activity tool called                                        │
│ 2. Requests template from backend via MCP                      │
└──────────────────────┬─────────────────────────────────────────┘
                       │
                       │ MCP: search_activities("bugfix", context)
                       ▼
┌────────────────────────────────────────────────────────────────┐
│ metabob-cli (Mediator)                                         │
│ ──────────────────────────────────────────────────────────────│
│ 1. Queries code structure (component analysis)                 │
│ 2. Checks which components changed recently                    │
│ 3. Retrieves annotations: WHY components exist                 │
│ 4. Synthesizes impulses:                                       │
│    - "auth.ts changes with jwt.ts 90% of time"                 │
│    - "JWT validation added after security audit"               │
│    - "Common failure: token expiration logic"                  │
│ 5. Forwards enriched request to backend                        │
└──────────────────────┬─────────────────────────────────────────┘
                       │
                       │ POST /v2/activities/search
                       │ + code_context: { components, annotations }
                       ▼
┌────────────────────────────────────────────────────────────────┐
│ metabob-rpc-api Backend (Repository)                           │
│ ──────────────────────────────────────────────────────────────│
│ 1. Searches templates with impulse provenance:                 │
│    - Template: "fix-auth-bug"                                  │
│    - Provenance: Created from successful fix of similar issue  │
│    - Impulses used: errorContext, authComponentContext         │
│ 2. Returns template with provenance metadata                   │
└──────────────────────┬─────────────────────────────────────────┘
                       │
                       │ Template + provenance
                       ▼
┌────────────────────────────────────────────────────────────────┐
│ metabob-cli (Mediator) - Enrichment                            │
│ ──────────────────────────────────────────────────────────────│
│ 1. Loads impulses specified in template provenance:            │
│    - errorContext: Recent authentication errors from logs      │
│    - authComponentContext: Annotations on auth.ts, jwt.ts      │
│ 2. Adds component relationship data:                           │
│    - "auth.ts depends on jwt.ts"                               │
│    - "Both modified in last 3 commits"                         │
│ 3. Returns enriched template to OpenCode                       │
└──────────────────────┬─────────────────────────────────────────┘
                       │
                       │ Enriched template with impulses
                       ▼
┌────────────────────────────────────────────────────────────────┐
│ metabob-opencode (Executor) - Execution                        │
│ ──────────────────────────────────────────────────────────────│
│ 1. Session memory agent loads impulses                         │
│ 2. Executes tasks with enriched context                        │
│ 3. Agent sees:                                                 │
│    - What files to focus on (from component analysis)          │
│    - Why they exist (from annotations)                         │
│    - How they relate (from cochange analysis)                  │
│ 4. Makes fixes, runs tests, commits                            │
│ 5. Reports execution outcome                                   │
└──────────────────────┬─────────────────────────────────────────┘
                       │
                       │ Execution outcome
                       ▼
┌────────────────────────────────────────────────────────────────┐
│ metabob-cli (Mediator) - Learning                              │
│ ──────────────────────────────────────────────────────────────│
│ 1. Associates execution with code changes:                     │
│    - "Activity modified: auth.ts, jwt.ts"                      │
│    - "Tests passed: 15/15"                                     │
│    - "Commit: Fixed token expiration"                          │
│ 2. Updates component annotations:                              │
│    - annotate_component(auth.ts, "Fixed token expiration...")  │
│ 3. Forwards learning to backend                                │
└──────────────────────┬─────────────────────────────────────────┘
                       │
                       │ POST /v2/activities/executions/complete
                       │ + code_changes, annotations, metrics
                       ▼
┌────────────────────────────────────────────────────────────────┐
│ metabob-rpc-api Backend (Repository) - Learning & Evolution    │
│ ──────────────────────────────────────────────────────────────│
│ 1. Records execution outcome                                   │
│ 2. Updates template metrics (success rate, cost, duration)     │
│ 3. Stores impulse provenance:                                  │
│    - "This execution used impulses: X, Y, Z"                   │
│    - "These impulses led to success"                           │
│ 4. Checks variant commissioning rules:                         │
│    - If execution diverged significantly from template         │
│    - If agent trailblazed new approach                         │
│    - If pattern emerges (3+ similar divergences)               │
│    → Commission new variant from this execution                │
│ 5. Stores new variant with genealogy:                          │
│    - parent_variant_id: original template                      │
│    - content_hash: unique signature                            │
│    - provenance: "Created from successful execution #123"      │
│    - impulses_used: [errorContext, authComponentContext]       │
└────────────────────────────────────────────────────────────────┘
```

---

## Schema Design: What Each System Stores

### Proto Schema (Source of Truth)

**TaskStep** - What to execute
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
  
  // Execution configuration
  TaskExecutionConfig execution_config = 20;
  
  // KEY: Impulse provenance tracking
  repeated ImpulseReference impulse_refs = 21;
}

message ImpulseReference {
  string impulse_id = 1;          // "errorContext", "authComponentContext"
  ImpulsePriority priority = 2;   // HIGH, MEDIUM, LOW
  bool required = 3;              // Must have this impulse to execute
}
```

**ActivityVariant** - What to store
```protobuf
message ActivityVariant {
  string variant_id = 1;
  string activity_id = 2;
  
  // Genealogy tracking (content-addressable)
  metabob.common.Genealogy genealogy = 6;
  
  // Implementation
  repeated TaskStep task_steps = 7;
  
  // OpenCode execution configuration
  ExecutionConfig execution_config = 20;
  
  // Learning configuration
  LearningConfig learning = 24;
}

message Genealogy {
  string content_hash = 1;        // SHA-256 of variant content
  string parent_hash = 2;         // Parent variant hash
  EvolutionReason reason = 3;     // SUCCESS, FAILURE_RECOVERY, OPTIMIZATION
  string source_execution_id = 4; // Execution that created this variant
}
```

**ExecutionOutcome** - What to learn from
```protobuf
message ExecutionOutcome {
  string execution_id = 1;
  string variant_id = 2;
  
  // What impulses were actually used
  repeated ImpulseUsage impulses_used = 3;
  
  // What code components were modified
  repeated ComponentChange component_changes = 4;
  
  // Metrics
  bool success = 5;
  int32 duration_ms = 6;
  double cost = 7;
}

message ImpulseUsage {
  string impulse_id = 1;
  string content_hash = 2;       // What version of impulse
  int32 tokens_used = 3;
  bool was_useful = 4;           // Agent used it in reasoning
}

message ComponentChange {
  string file_path = 1;
  string component_name = 2;     // Function/class name
  ChangeType change_type = 3;    // MODIFIED, CREATED, DELETED
  repeated string related_impulses = 4; // Impulses that informed this change
}
```

---

## Backend Storage (SurrealDB Tables)

### Table: `activity_variants`
**Schema**: Proto `ActivityVariant`
**Indexes**: 
- `variant_id` (unique)
- `activity_id` 
- `content_hash` (genealogy lookup)
- `status` (ACTIVE, DEPRECATED)

**Sample Record**:
```json
{
  "variant_id": "bug-fix-a3f2c1",
  "activity_id": "bug-fix",
  "genealogy": {
    "content_hash": "sha256:a3f2c1...",
    "parent_hash": "sha256:891bde...",
    "reason": "SUCCESS",
    "source_execution_id": "exec_abc123"
  },
  "task_steps": [
    {
      "id": "analyze-error",
      "impulse_refs": [
        {"impulse_id": "errorContext", "priority": "HIGH", "required": true},
        {"impulse_id": "componentAnnotations", "priority": "MEDIUM", "required": false}
      ]
    }
  ]
}
```

### Table: `execution_outcomes`
**Schema**: Proto `ExecutionOutcome`
**Indexes**:
- `execution_id` (unique)
- `variant_id` (lookup by template)
- `created_at` (temporal queries)

**Sample Record**:
```json
{
  "execution_id": "exec_abc123",
  "variant_id": "bug-fix-a3f2c1",
  "impulses_used": [
    {
      "impulse_id": "errorContext",
      "content_hash": "sha256:xyz...",
      "tokens_used": 1500,
      "was_useful": true
    }
  ],
  "component_changes": [
    {
      "file_path": "src/auth.ts",
      "component_name": "validateToken",
      "change_type": "MODIFIED",
      "related_impulses": ["errorContext", "componentAnnotations"]
    }
  ],
  "success": true,
  "duration_ms": 45000,
  "cost": 0.15
}
```

### Table: `impulse_provenance`
**Schema**: Custom (tracks impulse usage patterns)
**Purpose**: Learn which impulses lead to successful outcomes

**Sample Record**:
```json
{
  "impulse_id": "errorContext",
  "content_hash": "sha256:xyz...",
  "used_in_executions": 45,
  "success_rate": 0.89,
  "avg_tokens": 1500,
  "common_variants": ["bug-fix-a3f2c1", "debug-b4e3d2"],
  "component_associations": [
    {"component": "auth.ts::validateToken", "frequency": 0.75},
    {"component": "jwt.ts::decode", "frequency": 0.60}
  ]
}
```

---

## Metabob-CLI Responsibilities

### 1. Component Analysis Integration

**Before execution**:
```python
def enrich_template_request(activity_id: str, context: dict) -> dict:
    """
    Add component analysis to template search.
    
    Uses Metabob tools to:
    - Identify components in user's working directory
    - Load annotations (why components exist)
    - Check cochange patterns (what changes together)
    - Find recent issues (component quality)
    """
    components = list_file_components(context["current_file"])
    annotations = get_component_annotations(components)
    cochanges = suggest_related_changes([context["current_file"]])
    issues = search_codebase_issues(context["query"])
    
    return {
        "activity_id": activity_id,
        "code_context": {
            "components": components,
            "annotations": annotations,
            "cochange_patterns": cochanges,
            "related_issues": issues
        }
    }
```

**After execution**:
```python
def record_execution_outcome(execution_id: str, changes: dict) -> None:
    """
    Associate execution with code changes.
    
    1. Extract file modifications from git diff
    2. Identify changed components
    3. Annotate components with execution context
    4. Report to backend for learning
    """
    for file_path, changes in changes.items():
        components = extract_changed_components(file_path, changes)
        
        for component in components:
            # Document WHY this change was made
            annotate_component(
                file_path=file_path,
                component_name=component.name,
                component_type=component.type,
                reason=f"Modified by activity {execution_id}: {changes.description}"
            )
    
    # Send to backend for learning
    backend.record_execution_outcome({
        "execution_id": execution_id,
        "component_changes": component_changes,
        "impulses_used": [...]
    })
```

### 2. Impulse Synthesis

**Synthesize component context**:
```python
def synthesize_component_impulses(component: str) -> list[Impulse]:
    """
    Create impulses from component analysis.
    
    Returns impulses containing:
    - Why component exists (from annotations)
    - How it's used (from dependency analysis)
    - Common issues (from issue tracking)
    - Change patterns (from cochange analysis)
    """
    annotations = get_component_annotations([component])
    dependencies = analyze_dependencies(component)
    issues = search_codebase_issues(f"component:{component}")
    cochanges = get_cochange_patterns(component)
    
    return [
        Impulse(
            id=f"component-{component}-context",
            type="component",
            content={
                "why_exists": annotations.get(component, {}).get("reason"),
                "dependencies": dependencies,
                "common_issues": [i.description for i in issues],
                "cochange_partners": cochanges
            }
        )
    ]
```

---

## Variant Commissioning Logic

**Backend decides when to create new variant**:

```python
async def check_variant_commissioning(execution_outcome: ExecutionOutcome) -> bool:
    """
    Determine if execution should commission a new variant.
    
    Triggers:
    1. Execution diverged from template (agent trailblazed)
    2. Different impulses used than template specified
    3. Pattern emerges (3+ executions with same divergence)
    """
    original_variant = await db.get("activity_variants", execution_outcome.variant_id)
    
    # Check for divergence
    divergence_score = calculate_divergence(
        expected_steps=original_variant.task_steps,
        actual_actions=execution_outcome.actions_taken
    )
    
    if divergence_score > 0.3:  # 30% divergence
        # Check if pattern (has this divergence happened before?)
        similar_divergences = await db.query(
            "SELECT * FROM execution_outcomes "
            "WHERE variant_id = $variant_id "
            "AND divergence_pattern = $pattern",
            variant_id=execution_outcome.variant_id,
            pattern=compute_pattern(execution_outcome)
        )
        
        if len(similar_divergences) >= 3:  # Pattern threshold
            # Commission new variant
            new_variant = await commission_variant(
                parent_variant=original_variant,
                source_execution=execution_outcome,
                reason="PATTERN_EMERGENCE"
            )
            
            logger.info(f"Commissioned new variant: {new_variant.variant_id}")
            return True
    
    return False

async def commission_variant(
    parent_variant: ActivityVariant,
    source_execution: ExecutionOutcome,
    reason: EvolutionReason
) -> ActivityVariant:
    """
    Create new variant from successful execution.
    
    Process:
    1. Extract actual steps from execution
    2. Compute content hash
    3. Store with genealogy linking to parent
    4. Preserve impulse provenance
    """
    # Extract what agent actually did
    actual_steps = extract_task_steps_from_execution(source_execution)
    
    # Compute content-addressable hash
    content_hash = compute_content_hash(actual_steps)
    
    # Create new variant
    new_variant = ActivityVariant(
        variant_id=f"{parent_variant.activity_id}-{content_hash[:8]}",
        activity_id=parent_variant.activity_id,
        genealogy=Genealogy(
            content_hash=content_hash,
            parent_hash=parent_variant.genealogy.content_hash,
            reason=reason,
            source_execution_id=source_execution.execution_id
        ),
        task_steps=actual_steps,
        # Preserve impulses that were actually useful
        execution_config=ExecutionConfig(
            context_requirements=[
                req for req in parent_variant.execution_config.context_requirements
                if was_impulse_useful(req.key, source_execution)
            ]
        )
    )
    
    # Store in database
    await db.create("activity_variants", new_variant)
    
    return new_variant
```

---

## Schema Alignment: The Fix

**Current problem**: Backend API schema doesn't match proto

**Correct fix**: Backend must use proto schema

### Backend API Update

**Replace** `v2_activities.py`:
```python
class TemplateTask(BaseModel):
    order: int
    type: str
    prompt_template: str
```

**With proto-based schema**:
```python
from server.models.proto_variant import ProtoTaskStep

class TemplateCreateRequest(BaseModel):
    name: str
    description: str
    category: str
    tasks: List[ProtoTaskStep]  # ← Proto schema
    
class ProtoTaskStep(BaseModel):
    """Matches proto TaskStep exactly"""
    id: str
    subagent: str
    description: str
    dependencies: List[str]
    prompt: TaskPrompt          # Nested
    validation: TaskValidation  # Nested
    retry: TaskRetry            # Nested
    metrics: TaskMetrics        # Nested
    impulse_refs: List[ImpulseReference]  # ← KEY: Provenance tracking
```

---

## Summary: The Correct Architecture

**What each system does**:

1. **metabob-opencode**: Executes templates with impulse-enriched context
2. **metabob-rpc-api**: Stores templates with impulse provenance, commissions variants
3. **metabob-cli**: Mediates by connecting code structure to execution outcomes

**Key data flows**:
- **Template → Execution**: Backend sends template + impulse specs → CLI loads impulses from component analysis → OpenCode executes with enriched context
- **Execution → Learning**: OpenCode reports outcome → CLI associates with component changes → Backend learns impulse patterns and commissions variants
- **Component → Impulse**: CLI synthesizes impulses from Metabob component analysis (annotations, cochanges, issues)

**Why impulse provenance matters**:
- Templates remember which impulses led to success
- Future executions load those same impulses
- Learning accumulates: successful patterns become templates
- Component annotations feed into impulses (crystallized knowledge)

**Schema must be proto-based** to support this architecture. Current backend schema lacks impulse tracking entirely.
