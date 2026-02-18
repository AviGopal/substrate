# Durable Schema Alignment Solution

## Problem Statement

Three systems (`metabob-opencode`, `metabob-rpc-api`, `metabob-cli`) have **non-overlapping concerns** but need to **share activity template format**. Currently they drift out of sync, causing agents to create incompatible templates.

## Root Cause

**No enforced single source of truth** for activity template schema across the three systems.

Current state:
- ✅ `metabob-proto` has canonical proto definitions
- ❌ `metabob-opencode` has its own example templates (wrong format)
- ❌ `metabob-rpc-api` manually maintains Pydantic models
- ❌ `metabob-cli` manually maintains Python models
- ❌ No validation that all three agree

## Proposed Solution: Proto-Driven Code Generation

**Single Source of Truth**: `metabob-proto/proto/metabob/activity/variant.proto`

**Strategy**: Generate code for all three systems from proto definitions, with validation layer

## Architecture

```
metabob-proto (source of truth)
│
├── proto/metabob/activity/variant.proto  ← CANONICAL SCHEMA
│
├── scripts/generate.sh                    → Generate code
│
├── gen/                                    (generated, not edited)
│   ├── python/                            → for metabob-rpc-api & metabob-cli
│   └── typescript/                        → for metabob-opencode
│
└── activities/bootstrap/*.json            → EXAMPLE TEMPLATES (validated)
    
Each System Uses Generated Code:
│
├── metabob-rpc-api
│   ├── server/models/proto_task_step.py   → Import from gen/python
│   └── server/routes/v2_activities.py     → Use generated types
│
├── metabob-cli
│   └── src/metabob_cli/mcp/               → Import from gen/python
│
└── metabob-opencode
    └── packages/opencode/src/types/       → Import from gen/typescript
```

## Implementation Plan

### Phase 1: Code Generation Infrastructure ✅

**Status**: Already exists in `metabob-proto`
- ✅ Proto definitions in `variant.proto`
- ✅ Generation script `scripts/generate.sh`
- ✅ Generated Python code in `gen/python/`
- ✅ Generated TypeScript code in `gen/typescript/`

**Action**: None needed, infrastructure ready

### Phase 2: Template Validation System (NEW)

**Goal**: Ensure all example templates conform to proto schema

#### 2.1 Create Validation Script

Location: `repos/metabob-proto/scripts/validate_templates.py`

```python
#!/usr/bin/env python3
"""
Validate activity templates against proto schema.

Usage:
    python scripts/validate_templates.py activities/bootstrap/*.json
    python scripts/validate_templates.py --strict  # Fail on any error
"""

import json
import sys
from pathlib import Path
from google.protobuf import json_format
from metabob.activity import ActivityVariant, TaskStep

def validate_template(template_path: Path) -> tuple[bool, list[str]]:
    """Validate template against proto schema."""
    errors = []
    
    with open(template_path) as f:
        data = json.load(f)
    
    # Try to parse as ActivityVariant proto
    try:
        # Convert JSON to proto message
        variant = json_format.ParseDict(data, ActivityVariant())
        
        # Additional validation rules
        if not variant.variant_id:
            errors.append("Missing variant_id")
        
        if not variant.task_steps:
            errors.append("No task_steps defined")
        
        # Validate each task step
        for i, task in enumerate(variant.task_steps):
            if not task.id:
                errors.append(f"Task {i}: Missing id")
            if not task.subagent:
                errors.append(f"Task {i}: Missing subagent")
            if not task.prompt or not task.prompt.template:
                errors.append(f"Task {i}: Missing prompt.template")
            if not task.validation:
                errors.append(f"Task {i}: Missing validation")
            if not task.retry:
                errors.append(f"Task {i}: Missing retry")
            if not task.metrics:
                errors.append(f"Task {i}: Missing metrics")
        
        return (len(errors) == 0, errors)
    
    except Exception as e:
        errors.append(f"Proto parsing failed: {str(e)}")
        return (False, errors)

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Validate activity templates")
    parser.add_argument("templates", nargs="+", help="Template files to validate")
    parser.add_argument("--strict", action="store_true", help="Fail on any error")
    args = parser.parse_args()
    
    all_valid = True
    for template_path in args.templates:
        path = Path(template_path)
        valid, errors = validate_template(path)
        
        if valid:
            print(f"✓ {path.name}: Valid")
        else:
            print(f"✗ {path.name}: Invalid")
            for error in errors:
                print(f"  - {error}")
            all_valid = False
    
    if not all_valid and args.strict:
        sys.exit(1)
    
    sys.exit(0 if all_valid else 1)

if __name__ == "__main__":
    main()
```

#### 2.2 Add Pre-commit Hook

Location: `repos/metabob-proto/.git/hooks/pre-commit`

```bash
#!/bin/bash
# Validate templates before commit

echo "Validating activity templates..."
python scripts/validate_templates.py --strict activities/bootstrap/*.json

if [ $? -ne 0 ]; then
    echo "❌ Template validation failed. Fix errors before committing."
    exit 1
fi

echo "✓ All templates valid"
exit 0
```

### Phase 3: Distribution Strategy

#### 3.1 Option A: NPM Package (TypeScript) - RECOMMENDED

**Package**: `@metabob/proto-types`

Location: `repos/metabob-proto/package.json`

```json
{
  "name": "@metabob/proto-types",
  "version": "0.1.0",
  "description": "Generated TypeScript types from Metabob proto definitions",
  "main": "gen/typescript/index.ts",
  "types": "gen/typescript/index.d.ts",
  "files": [
    "gen/typescript/**/*.ts",
    "activities/bootstrap/*.json"
  ],
  "scripts": {
    "generate": "./scripts/generate.sh",
    "validate": "python scripts/validate_templates.py activities/bootstrap/*.json",
    "prepublish": "npm run generate && npm run validate"
  },
  "dependencies": {},
  "peerDependencies": {
    "protobufjs": "^7.0.0"
  }
}
```

**Usage in metabob-opencode**:
```typescript
// packages/opencode/src/types/activity.ts
export { ActivityVariant, TaskStep } from '@metabob/proto-types'

// Or import generated types
import type { ActivityVariant } from '@metabob/proto-types'
```

#### 3.2 Option B: Python Package (Pydantic)

**Package**: `metabob-proto-py`

Location: `repos/metabob-proto/pyproject.toml`

```toml
[project]
name = "metabob-proto-py"
version = "0.1.0"
description = "Generated Python types from Metabob proto definitions"
dependencies = [
    "protobuf>=4.0.0",
    "pydantic>=2.0.0"
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

**Usage in metabob-rpc-api**:
```python
# server/models/proto_task_step.py
from metabob_proto_py.activity import TaskStep, ActivityVariant
```

**Usage in metabob-cli**:
```python
# src/metabob_cli/mcp/activity_manager.py
from metabob_proto_py.activity import TaskStep, ActivityVariant
```

#### 3.3 Option C: Git Submodule (Simple, Immediate)

**Setup**:
```bash
# In metabob-opencode
git submodule add ../metabob-proto proto
git submodule update --init --recursive

# Use generated code directly
ln -s proto/gen/typescript/metabob packages/opencode/src/proto
```

**Pros**: Simple, no publishing needed, immediate
**Cons**: Requires submodule management, manual sync

### Phase 4: Migrate Existing Systems

#### 4.1 metabob-rpc-api Migration

**Current**:
```python
# server/models/proto_task_step.py (manually maintained)
class ProtoTaskStep(BaseModel):
    id: str
    subagent: str
    # ... 20+ fields manually defined
```

**After Migration**:
```python
# server/models/proto_task_step.py
from metabob_proto_py.activity import TaskStep as ProtoTaskStep

# Optional: Add Pydantic wrapper if needed
class TaskStepPydantic(BaseModel):
    """Pydantic wrapper for proto TaskStep"""
    
    @classmethod
    def from_proto(cls, proto: ProtoTaskStep):
        return cls(**proto.to_dict())
```

**Migration Steps**:
1. Install metabob-proto-py package
2. Replace manual definitions with imports
3. Update tests to use proto types
4. Run validation suite
5. Deploy

#### 4.2 metabob-cli Migration

**Current**:
```python
# src/metabob_cli/mcp/activity_manager.py
# Manually constructs task objects as dicts
```

**After Migration**:
```python
from metabob_proto_py.activity import TaskStep, ActivityVariant

def create_task(self, task_data: dict) -> TaskStep:
    """Create validated task from dict"""
    return TaskStep(**task_data)  # Proto validation
```

#### 4.3 metabob-opencode Migration

**Current**:
```typescript
// Manually defined interfaces
interface TaskStep {
    id: string;
    agent: string;  // ❌ Wrong field name!
    prompt: string; // ❌ Wrong type!
}
```

**After Migration**:
```typescript
// packages/opencode/src/types/activity.ts
import type { TaskStep, ActivityVariant } from '@metabob/proto-types'

// Use proto-generated types everywhere
export { TaskStep, ActivityVariant }
```

**Replace Example Templates**:
```bash
# Remove old incorrect examples
rm /workspace/test-greeting-activity.json
rm /workspace/test-template.json

# Symlink to validated bootstrap templates
ln -s /workspace/proto/activities/bootstrap/*.json /workspace/examples/
```

### Phase 5: Continuous Validation

#### 5.1 CI/CD Integration

**GitHub Actions**: `.github/workflows/proto-validation.yml`

```yaml
name: Proto Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Generate code
        run: ./scripts/generate.sh
      
      - name: Validate templates
        run: python scripts/validate_templates.py --strict activities/bootstrap/*.json
      
      - name: Run proto tests
        run: pytest tests/proto/
```

#### 5.2 Runtime Validation

**Backend Validation** (metabob-rpc-api):
```python
# server/routes/v2_activities.py
from metabob_proto_py.activity import ActivityVariant
from google.protobuf import json_format

@router.post("/v2/activities/templates")
async def create_template(request: dict):
    """Create activity template with proto validation"""
    
    try:
        # Parse and validate against proto schema
        variant = json_format.ParseDict(request, ActivityVariant())
        
        # Proto validation passed, store in database
        await store_variant(variant)
        
        return {"status": "success", "variant_id": variant.variant_id}
    
    except json_format.ParseError as e:
        # Return clear validation error
        raise HTTPException(
            status_code=422,
            detail=f"Invalid activity template: {str(e)}"
        )
```

**CLI Validation** (metabob-cli):
```python
# src/metabob_cli/mcp/activity_tools.py
@tool
def create_activity_template(template_data: dict) -> dict:
    """Create activity template with validation"""
    from metabob_proto_py.activity import ActivityVariant
    from google.protobuf import json_format
    
    try:
        # Validate before registration
        variant = json_format.ParseDict(template_data, ActivityVariant())
        
        # Register with backend
        response = register_template(variant)
        return {"status": "success", "variant_id": response["variant_id"]}
    
    except Exception as e:
        return {"status": "error", "message": f"Validation failed: {str(e)}"}
```

## Benefits of This Solution

### 1. Single Source of Truth ✅
- Proto definitions are **the only place** schema is defined
- All three systems generate from same source
- No manual synchronization needed

### 2. Compile-Time Safety ✅
- TypeScript types catch mismatches at compile time
- Python type hints catch issues early
- Proto compiler validates schema correctness

### 3. Validation at Every Layer ✅
- **Design time**: Proto compiler validates definitions
- **Build time**: Code generation validates structure
- **Test time**: Validation scripts check examples
- **Runtime**: Backend validates incoming templates
- **CI/CD**: Automated checks prevent bad commits

### 4. Clear Error Messages ✅
- Proto validation errors are specific and actionable
- "Missing field 'subagent'" instead of "422 Unprocessable Entity"
- Developers know exactly what's wrong

### 5. Backward Compatibility ✅
- Proto has built-in versioning (v1, v2, v3)
- Can evolve schema without breaking old clients
- Optional fields for gradual migrations

### 6. Documentation Built-In ✅
- Proto comments become generated code comments
- Self-documenting types
- Examples in bootstrap/ directory are validated

## Migration Roadmap

### Week 1: Infrastructure
- [ ] Add validation script to metabob-proto
- [ ] Add pre-commit hooks
- [ ] Set up CI/CD validation
- [ ] Publish @metabob/proto-types NPM package
- [ ] Publish metabob-proto-py Python package

### Week 2: metabob-opencode
- [ ] Install @metabob/proto-types
- [ ] Replace manual type definitions
- [ ] Update example templates with validated bootstrap
- [ ] Add runtime validation to template creation
- [ ] Deploy to devbob-opencode container

### Week 3: metabob-rpc-api
- [ ] Install metabob-proto-py
- [ ] Replace server/models/proto_task_step.py with imports
- [ ] Add proto validation to POST /v2/activities/templates
- [ ] Update tests
- [ ] Deploy backend

### Week 4: metabob-cli
- [ ] Install metabob-proto-py
- [ ] Update activity_manager.py to use proto types
- [ ] Add validation to MCP tools
- [ ] Update tests
- [ ] Deploy CLI

### Week 5: Verification
- [ ] End-to-end test: Create template in OpenCode → Register in backend → Execute via CLI
- [ ] Performance testing
- [ ] Documentation updates
- [ ] Training for team

## Success Metrics

### Immediate (Week 1-2)
- ✅ All example templates pass validation
- ✅ CI/CD catches invalid templates
- ✅ Code generation works in all three systems

### Short-term (Month 1)
- ✅ Zero schema drift incidents
- ✅ Agent-created templates work first time
- ✅ Clear validation errors when mistakes happen

### Long-term (Quarter 1)
- ✅ 100% of activity templates use proto format
- ✅ Zero manual schema maintenance
- ✅ Easy to add new fields (just update proto)

## Rollout Strategy

### Option A: Big Bang (Risky)
- Migrate all three systems simultaneously
- Requires coordination and testing
- Higher risk but faster completion

### Option B: Incremental (RECOMMENDED)
1. **Phase 1**: Add validation to metabob-proto (no breaking changes)
2. **Phase 2**: Migrate metabob-opencode (fixes agent template generation)
3. **Phase 3**: Migrate metabob-rpc-api (adds runtime validation)
4. **Phase 4**: Migrate metabob-cli (completes the loop)

Each phase is independently deployable and testable.

## Fallback Plan

If proto-driven approach has issues:

### Plan B: JSON Schema Validation
- Define schema in JSON Schema format
- Generate types from JSON Schema
- Less type-safe but simpler tooling

### Plan C: Manual Sync with Tests
- Keep manual definitions
- Add comprehensive integration tests
- Fail CI if systems drift

## Questions to Resolve

1. **Package hosting**: NPM public registry or private?
2. **Versioning strategy**: Semantic versioning or date-based?
3. **Breaking changes**: How to handle proto field removal?
4. **Legacy templates**: Migrate or deprecate old format?
5. **Performance**: Does proto serialization add latency?

## Conclusion

This solution provides **durable alignment** by making proto definitions the **enforced source of truth**. All three systems become **consumers** of generated code rather than **maintainers** of duplicate schemas.

The key insight: **Schema drift happens when systems independently define types**. The fix: **Generate types from single definition, validate everywhere**.

This is a standard industry pattern used by:
- Google (Protocol Buffers across all services)
- Netflix (gRPC service definitions)
- Uber (Thrift schemas)
- Airbnb (Schema registry)

We're applying the same proven pattern to our activity template system.
