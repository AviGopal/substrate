# Next Session Quick Start: Schema Fix & Template Registration

**Context**: Discovered backend schema incompatibilities blocking enhanced template registration  
**Status**: Documentation complete, implementation ready to start  
**Effort**: 4-6 hours for backend fix, 30 min for testing

---

## What Happened Last Session

1. **Created 3 enhanced templates** with full impulse metadata (READY ✅)
2. **Attempted registration** → hit 422 validation errors ❌
3. **Root cause**: Backend uses simplified schema, templates use proto schema
4. **Deliverables**: Complete documentation + implementation plan

---

## Current State

### Enhanced Templates (Ready)
```bash
# Location: repos/metabob-opencode/packages/opencode/templates/built-in/
- fix-bug-complete-enhanced.json (7 contextRequirements, 12 impulse_refs)
- add-rest-endpoint-v2-enhanced.json (1 contextRequirement, 1 impulse_ref)  
- create-activity-template-enhanced.json (5 contextRequirements, 6 impulse_refs)
```

### Documentation (Complete)
```bash
- TEMPLATE_ENHANCEMENT_SCHEMA_MISMATCH_REPORT.md  # Problem analysis
- SCHEMA_FIX_IMPLEMENTATION_PLAN.md               # Solution with code
- SESSION_SUMMARY_FEB15_IMPULSE_TESTING.md        # Complete session log
```

### Blockers
1. **Backend Schema**: ContextRequirements uses `{type, required}`, needs `{key, hint, impulseTypes, budgetRange}`
2. **Prompt Variables**: Backend expects `string[]`, templates have `VariableDefinition[]`

---

## Option A: Implement Backend Schema Fix (4-6 hours)

**Recommended if**: You want to unblock enhanced template registration permanently

### Step 1: Read Implementation Plan (5 min)
```bash
cat SCHEMA_FIX_IMPLEMENTATION_PLAN.md
```

Key sections:
- Update ContextRequirement schema (repos/metabob-rpc-api/server/routes/v2_activities.py)
- Update TaskPrompt.variables schema (repos/metabob-rpc-api/server/models/proto_task_step.py)
- Add backward compatibility validators
- Write unit tests
- Deploy

### Step 2: Implement Changes (2-3 hours)
Follow implementation plan sections 1-2:

**File 1**: `repos/metabob-rpc-api/server/routes/v2_activities.py` (lines 127-132)
```python
# Change from:
class TemplateContextRequirement(BaseModel):
    type: str
    required: bool

# To: (see SCHEMA_FIX_IMPLEMENTATION_PLAN.md for full code)
class TemplateContextRequirement(BaseModel):
    key: str
    hint: str
    impulse_types: List[str]
    required: bool
    budget_range: Optional[TokenBudgetRange]
    # + backward compatibility validator
```

**File 2**: `repos/metabob-rpc-api/server/models/proto_task_step.py` (lines 30-32)
```python
# Change from:
variables: List[str]

# To: (see SCHEMA_FIX_IMPLEMENTATION_PLAN.md for full code)  
variables: List[Union[str, PromptVariable]]
# + normalizer validator for backward compatibility
```

### Step 3: Add Tests (1-2 hours)
```bash
cd repos/metabob-rpc-api
# Add tests from implementation plan section 4
python -m pytest tests/routes/test_v2_activities.py -v
```

### Step 4: Deploy Backend (30 min)
```bash
# Restart backend with new schema
docker-compose restart metabob-backend
# Or however backend is deployed

# Verify health
curl http://localhost:8080/status
```

### Step 5: Register Enhanced Template (5 min)
```bash
cd repos/metabob-cli
python3 -c "
from metabob_cli.commands import register_template
from click.testing import CliRunner

runner = CliRunner()
result = runner.invoke(register_template, [
    '../../repos/metabob-opencode/packages/opencode/templates/built-in/add-rest-endpoint-v2-enhanced.json',
    '--base-url', 'http://localhost:8080',
    '--status', 'active'
])
print(result.output)
"

# Should succeed with 201 Created instead of 422
```

### Step 6: Verify Persistence (2 min)
```bash
# Check if context_requirements persisted
python3 << 'EOF'
import requests
import json

with open('.metabob/state') as f:
    token = json.load(f)["session_metadata"]["session_token"]

response = requests.get(
    "http://localhost:8080/v2/activities/templates/add-rest-endpoint-v2",
    headers={"Authorization": f"Bearer {token}"}
)

template = response.json()
print(f"Context Requirements: {template.get('context_requirements', [])}")
# Should show [{key: "categoryExamples", hint: "...", ...}] NOT []
