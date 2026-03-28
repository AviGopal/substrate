# Schema Alignment - Quick Start Guide

## Problem
Agents create activity templates in wrong format because they learn from incorrect examples.

## Solution
Use Protocol Buffers as single source of truth for all three systems.

## Quick Wins (1-2 hours each)

### 1. Fix devbob-opencode Container Examples ⚡
**Impact**: Fixes agent template generation immediately

```bash
cd repos/metabob-proto

# Copy validated bootstrap templates to container
docker cp activities/bootstrap/feature-impl.json devbob-opencode:/workspace/examples/
docker cp activities/bootstrap/bug-fix.json devbob-opencode:/workspace/examples/
docker cp activities/bootstrap/refactor.json devbob-opencode:/workspace/examples/

# Remove incorrect examples
docker exec devbob-opencode rm /workspace/test-greeting-activity.json
docker exec devbob-opencode rm /workspace/test-template.json

# Restart container
docker restart devbob-opencode
```

**Test**: Ask agent to create template, verify it uses correct format

### 2. Add Template Validation ⚡
**Impact**: Prevents bad templates from being created

```bash
cd repos/metabob-proto

# Create validation script (copy from DURABLE_SCHEMA_ALIGNMENT_SOLUTION.md)
vim scripts/validate_templates.py

# Make executable
chmod +x scripts/validate_templates.py

# Test it
python scripts/validate_templates.py activities/bootstrap/*.json
```

**Expected**: All bootstrap templates pass validation

### 3. Add Runtime Validation to Backend ⚡
**Impact**: Backend rejects invalid templates with clear errors

```python
# repos/metabob-rpc-api/server/routes/v2_activities.py

from google.protobuf import json_format
from metabob.activity import ActivityVariant

@router.post("/v2/activities/templates")
async def create_template(request: dict):
    try:
        # Validate against proto schema
        variant = json_format.ParseDict(request, ActivityVariant())
        # ... continue with storage
    except json_format.ParseError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid template: {str(e)}"
        )
```

## Medium-term (1-2 days)

### 4. Publish Proto Packages
```bash
# Python package
cd repos/metabob-proto
python -m build
pip install dist/metabob-proto-py-0.1.0.tar.gz

# TypeScript package
npm publish
```

### 5. Migrate metabob-rpc-api
```python
# Before (manual)
from server.models.proto_task_step import ProtoTaskStep

# After (generated)
from metabob_proto_py.activity import TaskStep
```

## Long-term (1-2 weeks)

### 6. Complete System Migration
- Week 1: metabob-opencode
- Week 2: metabob-rpc-api
- Week 3: metabob-cli
- Week 4: End-to-end testing

## Verification Checklist

✅ All bootstrap templates pass validation
✅ Agent-created templates use proto format
✅ Backend validates incoming templates
✅ Clear error messages when format wrong
✅ No manual schema maintenance needed

## Key Files

- **Proto definition**: `repos/metabob-proto/proto/metabob/activity/variant.proto`
- **Bootstrap templates**: `repos/metabob-proto/activities/bootstrap/*.json`
- **Validation script**: `repos/metabob-proto/scripts/validate_templates.py`
- **Backend validation**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

## Success Metrics

- **Immediate**: Zero agent template format errors
- **Week 1**: All new templates auto-validated
- **Month 1**: 100% proto-driven, zero drift
