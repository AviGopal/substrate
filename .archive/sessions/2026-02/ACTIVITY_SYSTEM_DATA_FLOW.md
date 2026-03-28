# Activity System Data Flow Mapping

**Date**: February 12, 2026 20:00 PST  
**Purpose**: Map complete data flow between applications for activity creation, execution, and evolution

---

## System Components

### 1. metabob-opencode (Frontend/Execution)
**Language**: TypeScript  
**Responsibilities**:
- Activity execution orchestration
- Impulse space management
- Step-by-step execution
- Agent session management
- User interface (TUI)

### 2. metabob-cli (MCP Bridge)
**Language**: Python  
**Responsibilities**:
- MCP server implementation
- Activity manager (execution coordination)
- Tool implementations (search, execute, report)
- Field name mapping (proto ↔ TypeScript)

### 3. metabob-rpc-api (Backend/Storage)
**Language**: Python + SurrealDB  
**Responsibilities**:
- Template storage (proto format)
- Execution recording
- Variant management
- Learning data storage
- API endpoints

---

## Flow 1: Activity Template Creation

### Current Flow (activity-create template)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER REQUEST (metabob-opencode)                              │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
User: "Create a hello world template"
activity({
  activityId: "INFRASTRUCTURE-0013e379",  // activity-create
  variables: {template_name: "hello-world", ...},
  reason: "User wants greeting template"
})

┌─────────────────────────────────────────────────────────────────┐
│ 2. ACTIVITY TOOL (metabob-opencode)                             │
│    File: packages/opencode/src/tool/activity.ts                 │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ├─ Load template via MCP
                           ├─ Build impulse space
                           │  - Template impulses (ISSUE: schema not embedded)
                           │  - Parent context (user intent)
                           ├─ Start execution via MCP
                           └─ Execute steps in loop

┌─────────────────────────────────────────────────────────────────┐
│ 3. MCP CALL: search_activities (metabob-cli)                    │
│    File: repos/metabob-cli/src/metabob_cli/mcp/tools.py         │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
async def search_activities_tool(query, limit):
    manager = get_activity_manager(base_url, session_token)
    templates = await manager.search_activities(query)
    return {"status": "success", "templates": templates}

┌─────────────────────────────────────────────────────────────────┐
│ 4. ACTIVITY MANAGER (metabob-cli)                               │
│    File: repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
async def search_activities(query):
    # Call backend API
    response = await self.client.get(
        f"{self.base_url}/v2/activities/templates",
        params={"search": query}
    )
    
    # Map fields: snake_case → camelCase
    templates = []
    for t in response["templates"]:
        templates.append({
            "id": t["variant_id"],           # Field mapping
            "name": t["variant_name"],        # Field mapping
            "tasks": t["task_steps"],         # Field mapping
            "impulseReferences": t["impulse_refs"]  # Field mapping
        })
    return templates

┌─────────────────────────────────────────────────────────────────┐
│ 5. BACKEND API (metabob-rpc-api)                                │
│    File: server/routes/v2_activities.py                         │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
@router.get("/templates")
async def list_activity_templates(search: Optional[str] = None):
    # Query SurrealDB
    result = await db.query("""
        SELECT * FROM activity_templates
        WHERE variant_name CONTAINS $search
    """, {"search": search})
    
    return {
        "templates": [
            {
                "variant_id": t["variant_id"],
                "variant_name": t["variant_name"],
                "task_steps": t["task_steps"],
                "impulse_refs": t.get("impulse_refs", [])
            }
            for t in result
        ]
    }

┌─────────────────────────────────────────────────────────────────┐
│ 6. EXECUTION STARTS (metabob-opencode → metabob-cli)            │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
MCP: start_execution(activity_id, variables, session_id)
  ↓
ActivityManager.start_execution()
  ↓
POST /v2/activities/record/start
  {
    "template_id": "INFRASTRUCTURE-0013e379",
    "variant_id": "v1",
    "variables": {...},
    "session_id": "...",
    "execution_id": "exec_abc123"
  }
  ↓
Backend creates execution record
  ↓
Returns: {"status": "success", "execution_id": "exec_abc123"}

┌─────────────────────────────────────────────────────────────────┐
│ 7. STEP EXECUTION LOOP (metabob-opencode)                       │
└─────────────────────────────────────────────────────────────────┘

For each task in template.tasks:
  │
  ├─ MCP: get_next_step(execution_id)
  │  ↓
  │  Returns: {
  │    "status": "success",
  │    "current_step": {
  │      "id": "identify-pattern",
  │      "description": "...",
  │      "prompt": {
  │        "template": "Analyze conversation and identify pattern",
  │        "variables": ["goal", "user_intent"]
  │      },
  │      "impulse_refs": ["activity-schema", "example-template"]
  │    },
  │    "complete": false
  │  }
  │
  ├─ Load impulses (ISSUE: schema from filesystem, not impulses!)
  │  ↓
  │  Current: Reads /server/proto/activity.proto from disk
  │  Correct: Should load from impulse space
  │
  ├─ Execute step via TaskTool (ISSUE: spawns new session!)
  │  ↓
  │  TaskTool.execute() → New agent session
  │  ↓
  │  Agent executes task
  │  ↓
  │  Returns result
  │
  ├─ Register step output as impulse
  │  ↓
  │  impulseSpace[`step-${stepId}-output`] = {
  │    pointer: {type: "memo", content: output}
  │  }
  │
  ├─ MCP: report_step_result(execution_id, step_id, result)
  │  ↓
  │  POST /v2/activities/record/step
  │  {
  │    "execution_id": "exec_abc123",
  │    "step_id": "identify-pattern",
  │    "success": true,
  │    "output": "...",
  │    "cost": 0.002,
  │    "tokens": 800,
  │    "duration_ms": 5000
  │  }
  │  ↓
  │  Backend records step result
  │
  └─ Continue to next step

┌─────────────────────────────────────────────────────────────────┐
│ 8. TEMPLATE CREATION (Inside activity-create execution)         │
└─────────────────────────────────────────────────────────────────┘

Step 4 (create-template) generates JSON:
  {
    "variant_id": "test-hello-world-001",
    "variant_name": "Hello World Test",
    "category": "test",
    "task_steps": [
      {
        "id": "print_hello",
        "description": "Print hello world",
        "prompt": {...},
        "impulse_refs": []
      }
    ],
    "impulse_refs": [],  // ISSUE: Should include schema!
    "required_variables": ["greeting_target"],
    "optional_variables": []
  }

Agent writes this to file (ISSUE: Not committed to backend!)
Or calls backend API? (Need to verify)

┌─────────────────────────────────────────────────────────────────┐
│ 9. TEMPLATE REGISTRATION (metabob-rpc-api)                      │
└─────────────────────────────────────────────────────────────────┘

CURRENT: Manual SQL insert or file import
NEEDED: API endpoint

POST /v2/activities/templates/create
{
  "template_id": "hello-world",
  "variant_name": "Hello World Test",
  "category": "test",
  "task_steps": [...],
  "impulse_refs": [...],
  "created_by": "activity-create",
  "source_execution": "exec_abc123"
}
  ↓
Backend validates proto schema
  ↓
Generates variant_id: "TEST-{hash}"
  ↓
Stores in SurrealDB
  ↓
Returns: {"status": "success", "variant_id": "TEST-abc123"}

┌─────────────────────────────────────────────────────────────────┐
│ 10. EXECUTION COMPLETION (metabob-opencode → backend)           │
└─────────────────────────────────────────────────────────────────┘

All steps complete
  ↓
MCP: report_complete(execution_id, outcome, metrics)
  ↓
POST /v2/activities/record/complete
{
  "execution_id": "exec_abc123",
  "success": true,
  "duration_ms": 841000,
  "cost": 0.0085,
  "tokens": 3400,
  "outcome": "completed_successfully"
}
  ↓
Backend finalizes execution record
  ↓
Returns: {"status": "success"}

```

---

## Flow 2: Activity Template Variant Creation (Trailblazing)

### Current State: NOT IMPLEMENTED ❌

**What Should Happen**:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRAILBLAZING DETECTION (During Execution)                    │
└─────────────────────────────────────────────────────────────────┘

During execution, agent encounters:
  - Missing information (needs additional context)
  - Blocked by validation (prompt doesn't work)
  - Better approach discovered (optimization)
  
Agent decides to deviate from template
  ↓
System detects trailblazing:
  - Step took unexpected path
  - Used different impulses than template specified
  - Generated different output structure
  
Mark execution as trailblazing=true

┌─────────────────────────────────────────────────────────────────┐
│ 2. VARIANT CREATION REQUEST (metabob-opencode)                  │
└─────────────────────────────────────────────────────────────────┘

After successful trailblazing execution:
  ↓
MCP: create_variant(execution_id, changes)
{
  "source_template_id": "INFRASTRUCTURE-0013e379",
  "source_variant_id": "v1",
  "execution_id": "exec_trailblaze_123",
  "changes": {
    "tasks_modified": ["step-1"],
    "tasks_added": ["step-1.5"],
    "impulses_added": ["codebase-context"],
    "reason": "Added intermediate step for better context gathering"
  }
}

┌─────────────────────────────────────────────────────────────────┐
│ 3. VARIANT EXTRACTION (metabob-cli)                             │
└─────────────────────────────────────────────────────────────────┘

ActivityManager.create_variant():
  ↓
  1. Fetch execution record (what actually happened)
  2. Fetch source template (what was planned)
  3. Diff the two:
     - Which steps ran differently?
     - Which impulses were used?
     - What was the outcome?
  4. Generate new variant:
     - Copy source template
     - Apply discovered changes
     - Increment variant number
  5. Submit to backend

POST /v2/activities/templates/create_variant
{
  "source_template_id": "INFRASTRUCTURE-0013e379",
  "source_variant_id": "v1",
  "new_variant": {
    "variant_id": "INFRASTRUCTURE-0013e379-v2",
    "task_steps": [...],  // Modified steps
    "impulse_refs": [...],  // Added impulses
    "metadata": {
      "derived_from": "v1",
      "derived_by_execution": "exec_trailblaze_123",
      "changes": "Added intermediate context gathering step"
    }
  }
}

┌─────────────────────────────────────────────────────────────────┐
│ 4. BACKEND STORES VARIANT (metabob-rpc-api)                     │
└─────────────────────────────────────────────────────────────────┘

Validates new variant:
  - Same template_id (same base template)
  - Different variant_id (v2, v3, etc.)
  - Valid proto format
  ↓
Links to source:
  - variant_history table
  - execution_provenance table
  ↓
Stores variant:
  - activity_templates table (new row)
  - variant_metadata table
  ↓
Returns: {"status": "success", "variant_id": "...-v2"}

┌─────────────────────────────────────────────────────────────────┐
│ 5. VARIANT SELECTION (Future Executions)                        │
└─────────────────────────────────────────────────────────────────┘

Next time activity-create is called:
  ↓
search_activities("activity-create")
  ↓
Returns multiple variants:
  - INFRASTRUCTURE-0013e379-v1 (success rate: 80%)
  - INFRASTRUCTURE-0013e379-v2 (success rate: 95%)  ← Better!
  ↓
Variant selection algorithm:
  - Context similarity (current request vs past executions)
  - Success rate (which variant works better?)
  - Recency (prefer newer variants)
  ↓
Choose variant v2
  ↓
Execute with v2
```

---

## Flow 3: Activity Debugging (NEW - Needs Implementation)

### Proposed: activity-debug Template

```
┌─────────────────────────────────────────────────────────────────┐
│ ACTIVITY: activity-debug                                         │
│ PURPOSE: Analyze failed/suboptimal activity executions          │
└─────────────────────────────────────────────────────────────────┘

Variables:
  - execution_id: The execution to debug
  - issue_description: What went wrong

Steps:
  1. fetch-execution-record
     - Load execution from backend
     - Get all step results
     - Get impulse space state per step
  
  2. analyze-failure-point
     - Identify which step failed/succeeded-poorly
     - Compare expected vs actual output
     - Check which impulses were available vs loaded
  
  3. identify-root-cause
     - Missing impulses?
     - Wrong prompt template?
     - Incorrect variable interpolation?
     - Context overflow?
  
  4. suggest-fixes
     - Recommend impulse additions
     - Propose prompt improvements
     - Suggest task breakdown changes
  
  5. generate-improvement-patch
     - Create variant with fixes
     - Or create update SQL
     - Submit to backend (if confident)

Output:
  - Root cause analysis
  - Suggested fixes
  - New variant created (optional)
```

---

## Flow 4: Activity Template Update (NEW - Needs Implementation)

### Proposed: activity-update Template

```
┌─────────────────────────────────────────────────────────────────┐
│ ACTIVITY: activity-update                                        │
│ PURPOSE: Update existing template in database                    │
└─────────────────────────────────────────────────────────────────┘

Variables:
  - template_id: Template to update
  - variant_id: Variant to update (or "new" for new variant)
  - changes: JSON describing changes

Steps:
  1. fetch-current-template
     - Load from backend
     - Validate exists
  
  2. apply-changes
     - Modify task_steps
     - Update impulse_refs
     - Adjust variables
  
  3. validate-schema
     - Check proto compliance
     - Validate references
     - Check for circular dependencies
  
  4. submit-to-backend
     - If variant_id="new": Create new variant
     - Else: Update existing variant
  
  5. verify-stored
     - Fetch back from backend
     - Confirm changes applied

Output:
  - Updated variant_id
  - Changelog
```

---

## Critical Issues Identified

### Issue 1: Template Creation Not Persisting ❌
**Current**: activity-create generates JSON but doesn't commit to backend  
**Fix Needed**: Add API endpoint and MCP tool for template creation  
**Priority**: CRITICAL

### Issue 2: Schema Not Embedded in Templates ❌
**Current**: activity-create reads schema from filesystem  
**Fix Needed**: Embed schema as impulse in activity-create template  
**Priority**: CRITICAL

### Issue 3: No Variant System ❌
**Current**: Only one version of each template  
**Fix Needed**: Implement trailblazing detection and variant creation  
**Priority**: HIGH

### Issue 4: No Debug Activity ❌
**Current**: Manual debugging only  
**Fix Needed**: Create activity-debug template  
**Priority**: HIGH

### Issue 5: No Update Mechanism ❌
**Current**: Manual SQL updates  
**Fix Needed**: Create activity-update template and API  
**Priority**: MEDIUM

### Issue 6: Single Session Not Implemented ❌
**Current**: TaskTool spawns new session per step  
**Fix Needed**: Direct execution within ActivitySession  
**Priority**: HIGH

---

## Data Models

### activity_templates (SurrealDB)
```sql
DEFINE TABLE activity_templates SCHEMAFULL;

DEFINE FIELD template_id ON activity_templates TYPE string;
DEFINE FIELD variant_id ON activity_templates TYPE string;
DEFINE FIELD variant_name ON activity_templates TYPE string;
DEFINE FIELD category ON activity_templates TYPE string;
DEFINE FIELD task_steps ON activity_templates TYPE array;
DEFINE FIELD impulse_refs ON activity_templates TYPE array;
DEFINE FIELD required_variables ON activity_templates TYPE array;
DEFINE FIELD optional_variables ON activity_templates TYPE array;
DEFINE FIELD created_at ON activity_templates TYPE datetime;
DEFINE FIELD created_by ON activity_templates TYPE string;
DEFINE FIELD source_execution ON activity_templates TYPE string;
```

### activity_executions (SurrealDB)
```sql
DEFINE TABLE activity_executions SCHEMAFULL;

DEFINE FIELD execution_id ON activity_executions TYPE string;
DEFINE FIELD template_id ON activity_executions TYPE string;
DEFINE FIELD variant_id ON activity_executions TYPE string;
DEFINE FIELD session_id ON activity_executions TYPE string;
DEFINE FIELD variables ON activity_executions TYPE object;
DEFINE FIELD trailblazing ON activity_executions TYPE bool;
DEFINE FIELD outcome ON activity_executions TYPE string;
DEFINE FIELD success ON activity_executions TYPE bool;
DEFINE FIELD cost ON activity_executions TYPE number;
DEFINE FIELD duration_ms ON activity_executions TYPE number;
DEFINE FIELD created_at ON activity_executions TYPE datetime;
```

### activity_step_results (SurrealDB)
```sql
DEFINE TABLE activity_step_results SCHEMAFULL;

DEFINE FIELD execution_id ON activity_step_results TYPE string;
DEFINE FIELD step_id ON activity_step_results TYPE string;
DEFINE FIELD step_order ON activity_step_results TYPE number;
DEFINE FIELD success ON activity_step_results TYPE bool;
DEFINE FIELD output ON activity_step_results TYPE string;
DEFINE FIELD error ON activity_step_results TYPE string;
DEFINE FIELD impulses_available ON activity_step_results TYPE array;
DEFINE FIELD impulses_loaded ON activity_step_results TYPE array;
DEFINE FIELD impulses_referenced ON activity_step_results TYPE array;
DEFINE FIELD cost ON activity_step_results TYPE number;
DEFINE FIELD duration_ms ON activity_step_results TYPE number;
```

### variant_history (SurrealDB - NEW)
```sql
DEFINE TABLE variant_history SCHEMAFULL;

DEFINE FIELD template_id ON variant_history TYPE string;
DEFINE FIELD variant_id ON variant_history TYPE string;
DEFINE FIELD parent_variant_id ON variant_history TYPE string;
DEFINE FIELD derived_from_execution ON variant_history TYPE string;
DEFINE FIELD changes_description ON variant_history TYPE string;
DEFINE FIELD created_at ON variant_history TYPE datetime;
```

---

## Next Steps

### Immediate (Fix Critical Issues)
1. **Create template registration API** (backend)
2. **Embed schema in activity-create template** (backend)
3. **Add create_template MCP tool** (metabob-cli)
4. **Wire up template creation in activity-create** (all 3)

### Short-term (Enable Learning)
1. **Record impulse usage** (backend schema update)
2. **Implement trailblazing detection** (metabob-opencode)
3. **Create variant creation API** (backend)
4. **Add variant selection logic** (metabob-cli)

### Medium-term (Enable Self-Improvement)
1. **Build activity-debug template** (new activity)
2. **Build activity-update template** (new activity)
3. **Implement variant selection algorithm** (metabob-cli)
4. **Add success rate tracking** (backend)

Ready to start fixing the critical issues?
