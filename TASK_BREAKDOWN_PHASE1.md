# Phase 1: Schema Alignment - Detailed Task Breakdown

**Goal**: Align backend API schema with proto definitions  
**Validation**: Run `validate-activity-execution-algorithmic.ts` after each task  
**Timeline**: 2-4 hours total

---

## Task 1: Create Proto-Based Pydantic Models (Backend)

**Estimated time**: 1 hour  
**Repository**: `repos/metabob-rpc-api`  
**Files to create/modify**:
- `server/models/proto_task_step.py` (NEW)

### Acceptance Criteria
- [ ] Pydantic model `ProtoTaskStep` matches proto `TaskStep` exactly
- [ ] Nested models: `TaskPrompt`, `TaskValidation`, `TaskRetry`, `TaskMetrics`
- [ ] Includes `impulse_refs: List[ImpulseReference]`
- [ ] All fields have correct types and defaults
- [ ] Model has `to_dict()` and `from_dict()` methods

### Implementation Details

**File**: `server/models/proto_task_step.py`

```python
"""
Proto-aligned TaskStep Pydantic models.

Source of truth: repos/metabob-proto/proto/metabob/activity/variant.proto
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class TaskPrompt(BaseModel):
    """Prompt configuration for task execution.
    
    Source: proto/metabob/activity/variant.proto::TaskPrompt
    """
    template: str = Field(description="Prompt template with {{variable}} interpolation")
    max_tokens: int = Field(default=8000, description="Maximum tokens for response")
    compression_strategy: str = Field(default="filter", description="Context compression strategy")
    variables: List[str] = Field(default_factory=list, description="Variables in template")


class TaskValidation(BaseModel):
    """Validation rules for task completion.
    
    Source: proto/metabob/activity/variant.proto::TaskValidation
    """
    required_files: List[str] = Field(default_factory=list)
    required_patterns: List[str] = Field(default_factory=list)
    forbidden_patterns: List[str] = Field(default_factory=list)
    commands: List[dict] = Field(default_factory=list)


class TaskRetry(BaseModel):
    """Retry configuration for failed tasks.
    
    Source: proto/metabob/activity/variant.proto::TaskRetry
    """
    max_attempts: int = Field(default=3)
    strategy: str = Field(default="simple")
    fallback_prompt: str = Field(default="")


class TaskMetrics(BaseModel):
    """Runtime metrics for task execution.
    
    Source: proto/metabob/activity/variant.proto::TaskMetrics
    """
    success_rate: float = Field(default=0.0)
    avg_tokens: int = Field(default=0)
    avg_duration: int = Field(default=0)
    common_failures: List[str] = Field(default_factory=list)


class ImpulseReference(BaseModel):
    """Reference to an impulse (context requirement).
    
    Source: proto/metabob/activity/execution.proto::ImpulseReference
    """
    impulse_id: str = Field(description="Impulse identifier")
    priority: str = Field(default="MEDIUM", description="HIGH, MEDIUM, LOW")
    required: bool = Field(default=False, description="Must have this impulse")


class ProtoTaskStep(BaseModel):
    """Task step matching proto schema exactly.
    
    Source: proto/metabob/activity/variant.proto::TaskStep
    
    This is the CORRECT schema that OpenCode sends.
    """
    id: str = Field(description="Unique step identifier")
    subagent: str = Field(description="Agent to execute: general, tool, config, session")
    description: str = Field(description="Human-readable task description")
    dependencies: List[str] = Field(default_factory=list, description="Task IDs this depends on")
    
    # Nested configurations
    prompt: TaskPrompt = Field(description="Prompt configuration")
    validation: TaskValidation = Field(default_factory=TaskValidation)
    retry: TaskRetry = Field(default_factory=TaskRetry)
    metrics: TaskMetrics = Field(default_factory=TaskMetrics)
    
    # Impulse provenance (KEY for learning)
    impulse_refs: List[ImpulseReference] = Field(
        default_factory=list,
        description="Impulses required for this task"
    )
    
    # Optional fields
    guidance: List[str] = Field(default_factory=list)
    expected_actions: List[str] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "id": "analyze-error",
                "subagent": "general",
                "description": "Analyze error logs and identify root cause",
                "dependencies": [],
                "prompt": {
                    "template": "Analyze the following error: {{error_context}}",
                    "max_tokens": 8000,
                    "compression_strategy": "filter",
                    "variables": ["error_context"]
                },
                "validation": {
                    "required_patterns": ["root cause:", "solution:"]
                },
                "retry": {
                    "max_attempts": 3,
                    "strategy": "simple"
                },
                "metrics": {
                    "success_rate": 0.85
                },
                "impulse_refs": [
                    {
                        "impulse_id": "errorContext",
                        "priority": "HIGH",
                        "required": True
                    }
                ]
            }
        }
```

### Testing
```bash
cd repos/metabob-rpc-api
python -m pytest tests/models/test_proto_task_step.py -v
```

### Validation Command
```bash
# After implementation, verify imports work
cd repos/metabob-rpc-api
python -c "from server.models.proto_task_step import ProtoTaskStep; print('✅ Import successful')"
```

---

## Task 2: Update Backend API Endpoints

**Estimated time**: 1 hour  
**Repository**: `repos/metabob-rpc-api`  
**Files to modify**:
- `server/routes/v2_activities.py`

### Acceptance Criteria
- [ ] `TemplateCreateRequest` uses `List[ProtoTaskStep]` instead of `List[TemplateTask]`
- [ ] Old `TemplateTask` class removed or deprecated
- [ ] API validation accepts proto schema
- [ ] OpenCode can POST templates without 422 errors
- [ ] Existing tests updated

### Implementation Details

**File**: `server/routes/v2_activities.py`

**Changes**:

1. **Import proto models**:
```python
from server.models.proto_task_step import (
    ProtoTaskStep,
    TaskPrompt,
    TaskValidation,
    ImpulseReference
)
```

2. **Update TemplateCreateRequest**:
```python
class TemplateCreateRequest(BaseModel):
    """Request to create new template - PROTO SCHEMA"""
    
    name: str = Field(description="Template name")
    description: str = Field(description="Template description")
    category: str = Field(description="Template category")
    variables: dict[str, TemplateVariable] = Field(
        default_factory=dict, description="Template variables"
    )
    context_requirements: List[TemplateContextRequirement] = Field(
        default_factory=list, description="Context requirements"
    )
    
    # ← CHANGED: Now uses proto schema
    tasks: List[ProtoTaskStep] = Field(description="Template tasks (proto schema)")
    
    parent_id: Optional[str] = Field(
        None, description="Parent template ID (for derived)"
    )
```

3. **Update create_template endpoint logic**:
```python
@router.post("/templates")
async def create_template(
    template: TemplateCreateRequest = Body(...),
    request: Request = None,
    credentials: HTTPAuthorizationCredentials = Security(SESSION_TOKEN),
    redis: StrictRedis = Depends(get_redis_connection),
    db: SurrealDBClient = Depends(get_surreal_connection),
):
    """Create activity template - accepts proto schema"""
    session = await get_authenticated_session(request, credentials, redis)
    
    try:
        # Convert to storage format
        variant_data = {
            "name": template.name,
            "description": template.description,
            "category": template.category,
            "variables": template.variables,
            
            # Store tasks in proto format
            "task_steps": [task.dict() for task in template.tasks],
            
            # ... rest of fields
        }
        
        # Create in database
        variant = await db.create("activity_variants", variant_data)
        
        return proto_response(variant_to_proto_dict(variant), status_code=201)
    except Exception as e:
        logger.error(f"Failed to create template: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

4. **Deprecate old TemplateTask** (keep for backward compat during migration):
```python
class TemplateTask(BaseModel):
    """DEPRECATED: Use ProtoTaskStep instead.
    
    This schema is kept for backward compatibility during migration.
    Will be removed in next version.
    """
    order: int = Field(description="Task execution order (DEPRECATED)")
    type: str = Field(description="Task type (DEPRECATED)")
    prompt_template: str = Field(description="Prompt template (DEPRECATED)")
    
    # ... other fields
```

### Testing
```bash
cd repos/metabob-rpc-api

# Test with proto schema
curl -X POST http://localhost:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-proto-schema",
    "description": "Test proto alignment",
    "category": "test",
    "tasks": [{
      "id": "task-1",
      "subagent": "general",
      "description": "Test task",
      "dependencies": [],
      "prompt": {
        "template": "Test prompt",
        "max_tokens": 8000
      },
      "validation": {},
      "retry": {"max_attempts": 3},
      "metrics": {},
      "impulse_refs": []
    }]
  }'

# Should return 201 (not 422!)
```

### Validation Command
```bash
# After implementation
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run validate-activity-execution-algorithmic.ts

# Should still show no executions (expected), but no schema errors in backend
```

---

## Task 3: Create Data Migration Script

**Estimated time**: 1 hour  
**Repository**: `repos/metabob-rpc-api`  
**Files to create**:
- `scripts/migrate_templates_to_proto.py` (NEW)

### Acceptance Criteria
- [ ] Script converts existing templates from old schema to proto schema
- [ ] Idempotent (can run multiple times safely)
- [ ] Dry-run mode for testing
- [ ] Reports converted templates
- [ ] Validates migrated data

### Implementation Details

**File**: `scripts/migrate_templates_to_proto.py`

```python
#!/usr/bin/env python3
"""
Migrate activity templates from old schema to proto schema.

OLD SCHEMA:
  tasks: [{ order, type, prompt_template, ... }]

NEW SCHEMA (proto):
  task_steps: [{ id, subagent, description, prompt: {...}, ... }]

Usage:
  python scripts/migrate_templates_to_proto.py --dry-run  # Preview changes
  python scripts/migrate_templates_to_proto.py            # Execute migration
"""

import asyncio
import argparse
from typing import List, Dict, Any
from server.utils.surreal_client import SurrealDBClient
from server.models.proto_task_step import ProtoTaskStep, TaskPrompt


async def migrate_template(template: Dict[str, Any], dry_run: bool = False) -> Dict[str, Any]:
    """
    Convert one template from old schema to proto schema.
    
    Args:
        template: Template dict with old schema
        dry_run: If True, don't modify database
    
    Returns:
        Migrated template dict
    """
    if "task_steps" in template and template["task_steps"]:
        # Already migrated (has proto schema)
        print(f"  ℹ️  Template {template['id']} already migrated")
        return template
    
    if "tasks" not in template:
        print(f"  ⚠️  Template {template['id']} has no tasks field")
        return template
    
    # Convert tasks to proto schema
    proto_tasks = []
    for old_task in template.get("tasks", []):
        # Map old fields to proto fields
        proto_task = {
            "id": f"task-{old_task.get('order', 0)}",
            "subagent": old_task.get("agent_mode", "general"),
            "description": f"Task {old_task.get('order', 0)}",  # Default description
            "dependencies": [],
            
            # Convert flat prompt_template to nested prompt
            "prompt": {
                "template": old_task.get("prompt_template", ""),
                "max_tokens": 8000,
                "compression_strategy": "filter",
                "variables": []
            },
            
            # Convert validation
            "validation": old_task.get("validation", {}),
            
            # Add defaults
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
            },
            
            # Initialize empty impulse refs (will be populated later)
            "impulse_refs": [],
            
            # Optional fields
            "guidance": [],
            "expected_actions": []
        }
        
        proto_tasks.append(proto_task)
    
    # Update template
    migrated = {
        **template,
        "task_steps": proto_tasks,  # New field
        "tasks": None  # Remove old field
    }
    
    print(f"  ✅ Converted {len(proto_tasks)} tasks to proto schema")
    
    return migrated


async def main(dry_run: bool = False):
    """Run migration."""
    print("=== Activity Template Migration to Proto Schema ===\n")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (will modify database)'}\n")
    
    # Connect to database
    db = SurrealDBClient()
    await db.connect()
    
    try:
        # Get all templates
        print("Fetching templates from database...")
        templates = await db.select("activity_variants")
        print(f"Found {len(templates)} templates\n")
        
        # Migrate each template
        migrated_count = 0
        skipped_count = 0
        error_count = 0
        
        for template in templates:
            template_id = template.get("id", "unknown")
            print(f"Processing: {template_id}")
            
            try:
                migrated = await migrate_template(template, dry_run)
                
                if migrated != template:
                    migrated_count += 1
                    
                    if not dry_run:
                        # Update in database
                        await db.update(template_id, migrated)
                        print(f"  💾 Saved to database")
                else:
                    skipped_count += 1
                
            except Exception as e:
                error_count += 1
                print(f"  ❌ Error: {e}")
            
            print()
        
        # Summary
        print("=== Migration Summary ===")
        print(f"Total templates: {len(templates)}")
        print(f"Migrated: {migrated_count}")
        print(f"Skipped (already migrated): {skipped_count}")
        print(f"Errors: {error_count}")
        
        if dry_run:
            print("\n⚠️  DRY RUN: No changes were made to the database")
        else:
            print("\n✅ Migration complete!")
        
    finally:
        await db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate templates to proto schema")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without modifying database")
    args = parser.parse_args()
    
    asyncio.run(main(dry_run=args.dry_run))
```

### Testing
```bash
cd repos/metabob-rpc-api

# Dry run first
python scripts/migrate_templates_to_proto.py --dry-run

# If looks good, run for real
python scripts/migrate_templates_to_proto.py
```

---

## Task 4: End-to-End Validation

**Estimated time**: 30 minutes  
**Repository**: Root (`metabob-devbob`)

### Acceptance Criteria
- [ ] OpenCode can create templates via MCP without errors
- [ ] Created templates have proto schema in backend
- [ ] Validation script shows no schema errors
- [ ] Template can be retrieved and executed

### Test Script

**File**: `test-phase1-validation.ts`

```typescript
#!/usr/bin/env bun
/**
 * Phase 1 Validation: Test proto schema alignment
 */

import { TemplateRepository } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template-repository"

async function testPhase1() {
  console.log("=== Phase 1 Validation: Schema Alignment ===\n")
  
  // Test 1: Create template with proto schema
  console.log("Test 1: Create template with proto schema")
  
  const testTemplate = {
    id: "phase1-test-template",
    name: "Phase 1 Test",
    description: "Validate proto schema alignment",
    category: "test",
    version: "1.0.0",
    author: "test",
    tags: ["test", "validation"],
    tasks: [{
      id: "task-1",
      subagent: "general",
      description: "Test task with proto schema",
      dependencies: [],
      prompt: {
        template: "This is a test prompt with {{variable}}",
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
      },
      impulse_refs: [
        {
          impulse_id: "testContext",
          priority: "MEDIUM",
          required: false
        }
      ]
    }]
  }
  
  try {
    await TemplateRepository.save(testTemplate)
    console.log("✅ Template created successfully\n")
  } catch (error: any) {
    console.error("❌ Template creation failed:", error.message)
    if (error.response?.status === 422) {
      console.error("Schema validation error (422) - PHASE 1 NOT COMPLETE")
      console.error(error.response.data)
    }
    process.exit(1)
  }
  
  // Test 2: Retrieve template
  console.log("Test 2: Retrieve template")
  
  try {
    const retrieved = await TemplateRepository.get("phase1-test-template")
    console.log("✅ Template retrieved successfully")
    console.log(`   Tasks: ${retrieved.tasks.length}`)
    console.log(`   First task ID: ${retrieved.tasks[0].id}`)
    console.log(`   Impulse refs: ${retrieved.tasks[0].impulse_refs?.length || 0}\n`)
  } catch (error: any) {
    console.error("❌ Template retrieval failed:", error.message)
    process.exit(1)
  }
  
  // Test 3: Verify proto schema fields present
  console.log("Test 3: Verify proto schema fields")
  
  const task = (await TemplateRepository.get("phase1-test-template")).tasks[0]
  
  const requiredFields = [
    "id", "subagent", "description", "dependencies",
    "prompt", "validation", "retry", "metrics", "impulse_refs"
  ]
  
  let allPresent = true
  for (const field of requiredFields) {
    if (!(field in task)) {
      console.error(`❌ Missing field: ${field}`)
      allPresent = false
    }
  }
  
  if (allPresent) {
    console.log("✅ All proto fields present\n")
  } else {
    console.error("❌ Proto schema incomplete")
    process.exit(1)
  }
  
  console.log("=== Phase 1 Validation: PASSED ===")
}

testPhase1().catch(error => {
  console.error("Test failed:", error)
  process.exit(1)
})
```

### Run Validation
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Run Phase 1 validation
bun run test-phase1-validation.ts

# Run original validation script
bun run validate-activity-execution-algorithmic.ts

# Expected: Still shows no executions (that's Phase 2+)
# But no 422 schema errors!
```

---

## Summary: Phase 1 Tasks

| Task | Time | Priority | Validation |
|------|------|----------|------------|
| 1. Proto Pydantic models | 1h | HIGH | Import test |
| 2. Update API endpoints | 1h | HIGH | Curl test |
| 3. Migration script | 1h | HIGH | Dry-run test |
| 4. E2E validation | 30m | HIGH | Phase1 test script |

**Total: 3.5 hours**

**Success criteria**: 
- ✅ OpenCode creates templates without 422 errors
- ✅ Backend stores templates in proto schema
- ✅ All proto fields present (including `impulse_refs`)

**Next phase**: Add ExecutionOutcome storage (Phase 2)
