# Activity-Create Improvement Plan

**Date**: February 12, 2026 20:15 PST  
**Goal**: Make activity-create the most reliable template with proper variant creation

---

## Critical Issues (Must Fix First)

### Issue 1: Templates Not Persisted to Backend ❌
**Problem**: activity-create generates JSON but doesn't commit to database

**Current Flow**:
```
Step 4 (create-template):
  ↓
Agent generates template JSON
  ↓
Writes to file or returns in output
  ↓
❌ NOT committed to backend
  ↓
Manual SQL insert required
```

**Fix Required**:
1. **Backend**: Add POST `/v2/activities/templates` endpoint
2. **metabob-cli**: Add `create_template` MCP tool
3. **activity-create**: Update step 4 to call MCP tool

---

### Issue 2: Schema Not Self-Contained ❌
**Problem**: activity-create reads schema from filesystem (dev-only)

**Current**:
```typescript
// In step 1: identify-pattern
const schema = fs.readFileSync("/server/proto/activity.proto")
// ❌ Breaks in production!
```

**Fix Required**:
1. **Backend**: Add schema as impulse to activity-create template
2. **Update template**: Step prompts reference impulse, not filesystem
3. **Validate**: Test in container without source files

---

### Issue 3: No Variant Creation System ❌
**Problem**: Trailblazing creates new templates, not variants

**Current**:
- Each template has one version
- No variant tracking
- No success rate comparison
- Can't learn which approach works better

**Fix Required**:
1. **Backend**: variant_history table
2. **Backend**: POST `/v2/activities/templates/create_variant`
3. **metabob-cli**: Detect trailblazing, create variants
4. **Variant selection**: Choose best variant for context

---

## Implementation Plan

### Phase 1: Template Persistence (2-3 hours)

#### Step 1: Backend API Endpoint
**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

```python
@router.post("/templates")
async def create_activity_template(
    template: ActivityTemplateCreate,
    db: SurrealDB = Depends(get_db)
) -> dict:
    """Create new activity template"""
    
    # Validate proto schema
    validate_template_schema(template)
    
    # Generate variant_id if not provided
    if not template.variant_id:
        template.variant_id = generate_variant_id(template.category)
    
    # Check for duplicates
    existing = await db.query(
        "SELECT * FROM activity_templates WHERE variant_id = $vid",
        {"vid": template.variant_id}
    )
    if existing:
        raise HTTPException(400, "Template already exists")
    
    # Store template
    result = await db.create(
        "activity_templates",
        {
            "template_id": template.template_id,
            "variant_id": template.variant_id,
            "variant_name": template.variant_name,
            "category": template.category,
            "task_steps": template.task_steps,
            "impulse_refs": template.impulse_refs,
            "required_variables": template.required_variables,
            "optional_variables": template.optional_variables,
            "created_at": datetime.now(UTC),
            "created_by": template.created_by or "system",
            "source_execution": template.source_execution
        }
    )
    
    return {
        "status": "success",
        "variant_id": result["variant_id"],
        "message": f"Template {result['variant_name']} created"
    }
```

#### Step 2: MCP Tool (metabob-cli)
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

```python
@server.tool()
async def create_activity_template_tool(
    template_json: str,
    created_by: str = "activity-create"
) -> str:
    """Create new activity template in backend
    
    Args:
        template_json: JSON string of template (proto format)
        created_by: Source of creation (execution_id or user)
    
    Returns:
        JSON result with status and variant_id
    """
    config = get_config_manager()
    base_url = config["base_url"]
    session_token = config["session_token"]
    
    # Parse template JSON
    template = json.loads(template_json)
    
    # Call backend API
    response = await httpx.post(
        f"{base_url}/v2/activities/templates",
        json=template,
        headers={"Authorization": f"Bearer {session_token}"}
    )
    
    if response.status_code != 200:
        return json.dumps({
            "status": "error",
            "message": f"Failed to create template: {response.text}"
        })
    
    result = response.json()
    
    return json.dumps({
        "status": "success",
        "variant_id": result["variant_id"],
        "message": f"Template created successfully"
    })
```

#### Step 3: Update activity-create Template
**Task 4** (create-template step) prompt should include:

```
After generating the template JSON, commit it to the backend:

1. Validate the JSON matches proto schema
2. Call create_activity_template tool:
   create_activity_template({
     template_json: <your_generated_json>,
     created_by: "{{execution_id}}"
   })
3. Verify the tool returns success with variant_id
4. Report the new variant_id in your output

Do NOT just write to a file. The template must be committed to the backend.
```

**Validation**: Run activity-create, check backend for new template

---

### Phase 2: Self-Contained Schema (1-2 hours)

#### Step 1: Add Schema as Impulse
**Backend**: Update activity-create template

```python
# In registration or migration script
activity_create_template = {
    "variant_id": "INFRASTRUCTURE-0013e379",
    "variant_name": "Activity Create",
    "impulse_refs": [
        {
            "id": "activity-template-schema",
            "type": "schema",
            "pointer": {
                "type": "memo",
                "content": """
syntax = "proto3";

message ActivityTemplate {
  string template_id = 1;
  string variant_id = 2;
  string variant_name = 3;
  string category = 4;
  repeated TaskStep task_steps = 5;
  repeated Impulse impulse_refs = 6;
  repeated string required_variables = 7;
  repeated string optional_variables = 8;
}

message TaskStep {
  string id = 1;
  string description = 2;
  Prompt prompt = 3;
  repeated string impulse_refs = 4;
  Validation validation = 5;
  RetryConfig retry = 6;
}

// ... full schema
"""
            },
            "description": "Proto schema for activity templates",
            "priority": "high",
            "budget": 3000
        },
        {
            "id": "example-template-basic",
            "type": "example",
            "pointer": {
                "type": "memo",
                "content": """
{
  "variant_id": "example-hello-world",
  "variant_name": "Hello World Example",
  "category": "test",
  "task_steps": [
    {
      "id": "greet",
      "description": "Print greeting",
      "prompt": {
        "template": "Print: Hello {{target}}!",
        "variables": ["target"],
        "max_tokens": 100
      },
      "impulse_refs": [],
      "validation": {
        "type": "output_contains",
        "value": "Hello"
      }
    }
  ],
  "impulse_refs": [],
  "required_variables": ["target"],
  "optional_variables": []
}
"""
            },
            "description": "Example of simple activity template",
            "priority": "medium",
            "budget": 2000
        }
    ],
    "task_steps": [
        {
            "id": "identify-pattern",
            "description": "Analyze conversation and identify pattern",
            "prompt": {
                "template": "Analyze the conversation and user intent to identify the pattern they want to automate. The activity schema is provided in the 'activity-template-schema' impulse. Reference it to understand the structure.",
                "variables": ["goal", "user_intent"],
                "max_tokens": 2000
            },
            "impulse_refs": ["activity-template-schema", "example-template-basic"],
            # ...
        },
        # ... other steps also reference schema impulse
    ]
}
```

#### Step 2: Update Prompts
Remove all filesystem reads:
- ❌ "Read /server/proto/activity.proto"
- ✅ "Reference the activity-template-schema impulse"

#### Step 3: Validate
```bash
# Run in container without source files
docker exec -it clean-container bash
cd /app  # No /server directory
# Run activity-create
# Should work using impulses only
```

---

### Phase 3: Variant System (3-4 hours)

#### Step 1: Backend Schema
```sql
-- variant_history table
CREATE TABLE variant_history (
    template_id STRING,
    variant_id STRING,
    parent_variant_id STRING,
    derived_from_execution STRING,
    changes_description STRING,
    success_rate FLOAT,
    execution_count INT,
    created_at DATETIME
);

-- Update activity_executions
ALTER TABLE activity_executions ADD COLUMN trailblazing BOOL DEFAULT false;
```

#### Step 2: Trailblazing Detection (metabob-opencode)
**File**: `packages/opencode/src/tool/activity.ts`

```typescript
// After step execution
if (stepResult.deviated_from_template) {
  log.info("trailblazing detected", {
    stepId: step.id,
    reason: stepResult.deviation_reason
  })
  
  // Mark execution as trailblazing
  executionMetadata.trailblazing = true
  executionMetadata.deviations.push({
    stepId: step.id,
    reason: stepResult.deviation_reason,
    changes: stepResult.changes_made
  })
}
```

#### Step 3: Variant Creation API
**Backend**: POST `/v2/activities/templates/create_variant`

```python
@router.post("/templates/create_variant")
async def create_variant_from_execution(
    source_template_id: str,
    source_variant_id: str,
    execution_id: str,
    changes: dict,
    db: SurrealDB = Depends(get_db)
):
    """Create new variant based on trailblazing execution"""
    
    # Fetch source template
    source = await db.query(
        "SELECT * FROM activity_templates WHERE variant_id = $vid",
        {"vid": source_variant_id}
    )
    
    # Fetch execution to see what actually happened
    execution = await db.query(
        "SELECT * FROM activity_executions WHERE execution_id = $eid",
        {"eid": execution_id}
    )
    
    # Generate new variant
    new_variant = copy.deepcopy(source)
    new_variant["variant_id"] = f"{source_template_id}-v{next_version}"
    new_variant["variant_name"] = f"{source['variant_name']} (v{next_version})"
    
    # Apply changes from trailblazing
    apply_changes(new_variant, changes)
    
    # Store variant
    await db.create("activity_templates", new_variant)
    
    # Record provenance
    await db.create("variant_history", {
        "template_id": source_template_id,
        "variant_id": new_variant["variant_id"],
        "parent_variant_id": source_variant_id,
        "derived_from_execution": execution_id,
        "changes_description": json.dumps(changes),
        "created_at": datetime.now(UTC)
    })
    
    return {"status": "success", "variant_id": new_variant["variant_id"]}
```

#### Step 4: Variant Selection (metabob-cli)
```python
async def select_best_variant(
    template_id: str,
    context: dict
) -> str:
    """Select best variant for current context"""
    
    # Get all variants
    variants = await self.client.get(
        f"{self.base_url}/v2/activities/templates",
        params={"template_id": template_id}
    )
    
    # Score each variant
    scores = []
    for variant in variants:
        score = calculate_variant_score(
            variant,
            context,
            success_rate=variant["success_rate"],
            recency=variant["created_at"]
        )
        scores.append((variant["variant_id"], score))
    
    # Return best
    best_variant_id = max(scores, key=lambda x: x[1])[0]
    return best_variant_id
```

---

## Testing Plan

### Test 1: Template Persistence
```bash
# Run activity-create
activity({
  activityId: "INFRASTRUCTURE-0013e379",
  variables: {
    template_name: "test-persistence",
    template_goal: "Test that templates are committed"
  },
  reason: "Validate template persistence"
})

# Check backend
curl http://localhost:8080/v2/activities/templates | jq '.templates[] | select(.variant_name | contains("test-persistence"))'
# Should find the new template
```

### Test 2: Self-Contained Schema
```bash
# Run in clean container
docker run -it --rm metabob-devbob bash
# No /server directory exists
# Run activity-create
# Should work using impulses
```

### Test 3: Variant Creation
```bash
# Execute activity with trailblazing
# Backend should detect deviation
# New variant should be created automatically

# Check variants
curl http://localhost:8080/v2/activities/templates?template_id=INFRASTRUCTURE-0013e379
# Should see v1, v2, etc.
```

---

## Success Criteria

After implementation:
- ✅ activity-create commits templates to backend (no manual SQL)
- ✅ activity-create works without filesystem access (production-ready)
- ✅ Trailblazing creates new variants automatically
- ✅ System learns which variants work better
- ✅ Variant selection chooses best approach for context

**Ready to start Phase 1 (Template Persistence)?**
