# Schema Mismatch - Immediate Action Plan

**Problem**: Backend API schema doesn't match proto. OpenCode follows proto, backend rejects it.

**Root Cause Document**: See `SCHEMA_MISMATCH_ROOT_CAUSE.md` for complete analysis.

---

## Immediate Fix (30 minutes): MCP Conversion Layer

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Add this conversion function**:

```python
def convert_opencode_to_backend_schema(opencode_template: dict) -> dict:
    """
    Convert OpenCode proto-based template to backend REST API schema.
    
    OpenCode sends (from proto):
      - tasks[].id
      - tasks[].description  
      - tasks[].prompt (nested object)
      
    Backend expects:
      - tasks[].order (int)
      - tasks[].type (str)
      - tasks[].prompt_template (flat string)
    """
    backend_template = {
        "name": opencode_template.get("name"),
        "description": opencode_template.get("description"),
        "category": opencode_template.get("category"),
        "variables": opencode_template.get("variables", {}),
        "context_requirements": opencode_template.get("context_requirements", []),
        "tasks": []
    }
    
    # Convert each task
    for idx, task in enumerate(opencode_template.get("tasks", [])):
        backend_task = {
            "order": idx,  # Add missing field
            "type": "agent_task",  # Add missing field (infer from subagent)
            "agent_mode": task.get("subagent", "general"),
            
            # Flatten nested prompt
            "prompt_template": task.get("prompt", {}).get("template", 
                                                          task.get("prompt", "")),
            
            # Flatten validation
            "validation": task.get("validation", {}),
            
            # Estimate cost budget
            "cost_budget": None  # TODO: Calculate from complexity
        }
        
        backend_template["tasks"].append(backend_task)
    
    return backend_template
```

**Update `create_activity_template` method**:

```python
async def create_activity_template(self, template_data: dict) -> dict:
    """Create activity template via backend API"""
    
    # Convert from OpenCode proto schema to backend schema
    backend_template = convert_opencode_to_backend_schema(template_data)
    
    # Send to backend
    response = await self.client.post(
        "/v2/activities/templates",
        json=backend_template
    )
    
    if response.status_code != 201:
        raise Exception(f"Backend returned {response.status_code}: {response.text}")
    
    return response.json()
```

**Test**:
```bash
cd repos/metabob-cli
python -m pytest tests/mcp/test_activity_manager.py::test_create_template -v
```

---

## Long-Term Fix (2-3 days): Backend Adopts Proto

### Phase 1: Generate Pydantic Models from Proto (4 hours)

**Step 1**: Install proto-to-pydantic generator
```bash
cd repos/metabob-rpc-api
pip install betterproto
```

**Step 2**: Generate Python models from proto
```bash
cd repos/metabob-proto
python -m grpc_tools.protoc \
  --python_betterproto_out=../metabob-rpc-api/server/models/generated \
  --proto_path=proto \
  proto/metabob/activity/variant.proto
```

**Step 3**: Create adapter layer
**File**: `server/models/proto_variant_adapter.py`

```python
from server.models.generated.activity import variant_pb2
from typing import List, Dict

class ProtoTaskStep(BaseModel):
    """Pydantic model matching proto TaskStep"""
    id: str
    subagent: str
    description: str
    dependencies: List[str] = []
    prompt: TaskPrompt
    validation: TaskValidation
    retry: TaskRetry
    metrics: TaskMetrics
    
    class Config:
        # Allow from proto conversion
        arbitrary_types_allowed = True

class TaskPrompt(BaseModel):
    """Nested prompt from proto"""
    template: str
    max_tokens: int = 8000
    compression_strategy: str = "filter"
    variables: List[str] = []

# ... other nested models ...
```

### Phase 2: Update API Endpoints (2 hours)

**File**: `server/routes/v2_activities.py`

**Replace**:
```python
class TemplateTask(BaseModel):
    order: int
    type: str
    prompt_template: str
    # ...
```

**With**:
```python
from server.models.proto_variant_adapter import ProtoTaskStep

class TemplateCreateRequest(BaseModel):
    name: str
    description: str
    category: str
    tasks: List[ProtoTaskStep]  # ← Now uses proto schema
    # ...
```

### Phase 3: Migrate Existing Data (4 hours)

**File**: `scripts/migrate_templates_to_proto_schema.py`

```python
async def migrate_template_tasks():
    """
    Migrate existing templates from old schema to proto schema.
    
    OLD: { order, type, prompt_template }
    NEW: { id, description, prompt: { template }, ... }
    """
    db = get_surreal_connection()
    
    # Get all templates
    templates = await db.select("activity_variants")
    
    for template in templates:
        migrated_tasks = []
        
        for task in template["tasks"]:
            # Convert old schema to new
            migrated_task = {
                "id": f"task-{task['order']}",
                "subagent": task.get("agent_mode", "general"),
                "description": f"Task {task['order']}",
                "dependencies": [],
                "prompt": {
                    "template": task["prompt_template"],
                    "max_tokens": 8000,
                    "compression_strategy": "filter",
                    "variables": []
                },
                "validation": task.get("validation", {}),
                "retry": {
                    "max_attempts": 3,
                    "strategy": "simple",
                    "fallback_prompt": ""
                },
                "metrics": {
                    "success_rate": 0.0,
                    "avg_tokens": 0,
                    "avg_duration": 0,
                    "common_failures": []
                }
            }
            migrated_tasks.append(migrated_task)
        
        # Update template in database
        await db.update(template["id"], {"tasks": migrated_tasks})
```

**Run migration**:
```bash
cd repos/metabob-rpc-api
python scripts/migrate_templates_to_proto_schema.py
```

### Phase 4: Remove MCP Conversion (30 minutes)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Remove the conversion** (backend now accepts proto schema directly):
```python
async def create_activity_template(self, template_data: dict) -> dict:
    # No conversion needed - backend now accepts proto schema!
    response = await self.client.post(
        "/v2/activities/templates",
        json=template_data
    )
    # ...
```

---

## Validation Plan

### Test 1: Template Creation (OpenCode → Backend)
```typescript
// OpenCode test
const template = {
  name: "test-proto-alignment",
  description: "Verify proto schema works",
  category: "test",
  tasks: [{
    id: "task-1",
    subagent: "general",
    description: "Test task",
    dependencies: [],
    prompt: {
      template: "Test prompt with {{variable}}",
      max_tokens: 8000,
      compression_strategy: "filter",
      variables: ["variable"]
    },
    validation: {
      required_files: [],
      required_patterns: [],
      forbidden_patterns: [],
      commands: []
    },
    retry: {
      max_attempts: 3,
      strategy: "simple",
      fallback_prompt: ""
    },
    metrics: {
      success_rate: 0.0,
      avg_tokens: 0,
      avg_duration: 0,
      common_failures: []
    }
  }]
}

await TemplateRepository.save(template)
// Should succeed with 201
```

### Test 2: Template Retrieval
```typescript
const loaded = await TemplateRepository.get("test-proto-alignment")
expect(loaded.tasks[0].prompt.template).toBe("Test prompt with {{variable}}")
```

### Test 3: Template Execution
```typescript
const result = await ActivityTool.execute({
  templateId: "test-proto-alignment",
  variables: { variable: "hello" },
  reason: "Test proto-aligned execution"
})
// Should execute successfully
```

---

## Timeline

**Immediate (today)**:
- ✅ Document root cause (DONE - see SCHEMA_MISMATCH_ROOT_CAUSE.md)
- ⏳ Implement MCP conversion (30 min)
- ⏳ Test with OpenCode (30 min)

**Short-term (this week)**:
- ⏳ Generate Pydantic models from proto (4 hours)
- ⏳ Update API endpoints (2 hours)
- ⏳ Migrate existing data (4 hours)
- ⏳ Remove MCP conversion (30 min)

**Total effort**: ~12 hours of work

---

## Success Criteria

1. ✅ OpenCode can create templates without 422 errors
2. ✅ Backend stores templates in proto schema
3. ✅ Existing templates migrated to new schema
4. ✅ Template execution works end-to-end
5. ✅ No conversion layer needed (direct proto → backend)

---

## Files Modified

### Immediate Fix (MCP Conversion)
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

### Long-Term Fix (Backend Proto Adoption)
- `repos/metabob-rpc-api/server/models/proto_variant_adapter.py` (NEW)
- `repos/metabob-rpc-api/server/routes/v2_activities.py` (MODIFIED)
- `repos/metabob-rpc-api/scripts/migrate_templates_to_proto_schema.py` (NEW)
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` (REVERT conversion)

---

## Communication Plan

**To the team**:
```
Subject: Activity Template Schema Mismatch - Root Cause & Fix

Problem: OpenCode can't create templates (422 error: missing order, type, prompt_template)

Root Cause: Backend API schema diverged from metabob-proto. 
- Proto defines: TaskStep with id, description, prompt (nested)
- Backend expects: TemplateTask with order, type, prompt_template (flat)
- OpenCode follows proto (correct), backend rejects it

Immediate Fix: MCP conversion layer (band-aid) - ETA: today
Long-Term Fix: Backend adopts proto schema (correct) - ETA: this week

Details: See SCHEMA_MISMATCH_ROOT_CAUSE.md
```
