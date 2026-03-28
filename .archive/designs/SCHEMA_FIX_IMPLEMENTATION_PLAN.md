# Backend Schema Fix: Implementation Plan

**Objective**: Update backend v2 API to accept full proto schema for `contextRequirements` and `prompt.variables`

**Effort**: 4-6 hours  
**Priority**: HIGH (blocks impulse adoption at 13%)  
**Risk**: LOW (backward compatible if done correctly)

---

## Changes Required

### 1. Update ContextRequirement Schema (30 min)

**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py`

**Current** (lines 127-132):
```python
class TemplateContextRequirement(BaseModel):
    """Context requirement for template"""
    type: str = Field(description="Context type (codebase_context, user_requirements)")
    required: bool = Field(default=True, description="Whether context is required")
```

**New**:
```python
class TemplateContextRequirement(BaseModel):
    """Context requirement for template - matches proto schema"""
    
    key: str = Field(description="Unique identifier (used as impulse ID)")
    hint: str = Field(description="Human-readable description of needed context")
    impulse_types: List[str] = Field(
        default_factory=list,
        description="Accepted impulse types (memo, file, component, etc.)"
    )
    required: bool = Field(default=False, description="Whether this is mandatory")
    budget_range: Optional[TokenBudgetRange] = Field(
        None,
        description="Token budget allocation (min/max)"
    )
    
    # Backward compatibility: accept old 'type' field as alias for 'key'
    @field_validator('key', mode='before')
    @classmethod
    def handle_legacy_type(cls, v, info):
        # If 'type' provided but not 'key', use 'type' as 'key'
        if not v and 'type' in info.data:
            return info.data['type']
        return v

class TokenBudgetRange(BaseModel):
    """Token budget range"""
    min_tokens: int = Field(description="Minimum tokens")
    max_tokens: int = Field(description="Maximum tokens")
```

### 2. Update TaskPrompt Variables Schema (30 min)

**File**: `repos/metabob-rpc-api/server/models/proto_task_step.py`

**Current** (line 30-32):
```python
class TaskPrompt(BaseModel):
    variables: List[str] = Field(
        default_factory=list, description="Variables referenced in template"
    )
```

**New**:
```python
class PromptVariable(BaseModel):
    """Variable definition in prompt"""
    name: str = Field(description="Variable name")
    type: str = Field(description="Variable type (string, number, boolean, etc.)")
    required: bool = Field(default=True, description="Whether variable is required")
    description: str = Field(description="Human-readable description")
    default: Optional[Any] = Field(None, description="Default value if not provided")

class TaskPrompt(BaseModel):
    template: str = Field(description="Prompt template with {{variable}} interpolation")
    max_tokens: int = Field(default=8000, description="Maximum tokens for response")
    compression_strategy: str = Field(
        default="filter",
        description="Context compression strategy: filter, summarize, truncate",
    )
    
    # Accept both formats for backward compatibility
    variables: List[Union[str, PromptVariable]] = Field(
        default_factory=list,
        description="Variables (strings for legacy, objects for new templates)"
    )
    
    @field_validator('variables', mode='after')
    @classmethod
    def normalize_variables(cls, v):
        """Convert legacy string format to new object format internally"""
        result = []
        for var in v:
            if isinstance(var, str):
                # Legacy format: convert to object
                result.append(PromptVariable(
                    name=var,
                    type="string",
                    required=True,
                    description=f"Variable: {var}"
                ))
            else:
                result.append(var)
        return result
```

### 3. Database Schema (1-2 hours)

**Note**: Current database already has `context_requirements` field (JSON), so **no migration needed**! 
Field exists but is empty for all templates. Just start populating it.

**Verify** (SurrealDB):
```surql
-- Check existing schema
INFO FOR TABLE activity_variant;

-- Test inserting rich context_requirements
UPDATE activity_variant:test_id SET context_requirements = [{
  key: "categoryExamples",
  hint: "Search for similar templates",
  impulse_types: ["toolOutput", "memo"],
  required: false,
  budget_range: { min_tokens: 3000, max_tokens: 5000 }
}];
```

### 4. Testing (2-3 hours)

#### Unit Tests
```python
# Test backward compatibility
def test_context_requirement_legacy_type():
    """Old templates with 'type' field still work"""
    data = {"type": "codebase_context", "required": True}
    cr = TemplateContextRequirement(**data)
    assert cr.key == "codebase_context"

def test_context_requirement_new_schema():
    """New templates with full schema work"""
    data = {
        "key": "categoryExamples",
        "hint": "Find similar templates",
        "impulse_types": ["toolOutput"],
        "required": False,
        "budget_range": {"min_tokens": 3000, "max_tokens": 5000}
    }
    cr = TemplateContextRequirement(**data)
    assert cr.key == "categoryExamples"
    assert len(cr.impulse_types) == 1

def test_prompt_variables_string_format():
    """Legacy string variables still work"""
    data = {"template": "Hello {{name}}", "variables": ["name", "age"]}
    prompt = TaskPrompt(**data)
    assert len(prompt.variables) == 2
    assert isinstance(prompt.variables[0], PromptVariable)
    assert prompt.variables[0].name == "name"

def test_prompt_variables_object_format():
    """New object variables work"""
    data = {
        "template": "Hello {{name}}",
        "variables": [
            {"name": "name", "type": "string", "required": True, "description": "User name"}
        ]
    }
    prompt = TaskPrompt(**data)
    assert len(prompt.variables) == 1
    assert prompt.variables[0].name == "name"
```

#### Integration Tests
1. Register old template (string variables) → should work
2. Register new template (object variables) → should work
3. Register enhanced template (full context requirements) → should work
4. Retrieve all three → should return correct schemas
5. Execute all three → should work correctly

### 5. Update CLI (30 min)

**File**: `repos/metabob-cli/src/metabob_cli/commands.py`

No changes needed! CLI already sends the rich schema. Just need to:
1. Rebuild binary: `python -m build`
2. Test registration: `metabob-cli register-template add-rest-endpoint-v2-enhanced.json`

---

## Backward Compatibility Strategy

**Key Design Decision**: Make changes **backward compatible** so existing templates don't break.

1. **ContextRequirement**: Accept both `type` (old) and `key` (new) fields via validator
2. **TaskPrompt.variables**: Accept both `string[]` (old) and `PromptVariable[]` (new) via Union type
3. **Database**: No migration needed, JSON field already exists

This means:
- ✅ All 20 existing templates keep working
- ✅ New templates can use rich schema
- ✅ Old CLI binaries keep working
- ✅ Zero downtime deployment

---

## Deployment Plan

### Step 1: Code Changes (2 hours)
1. Update schema models (v2_activities.py, proto_task_step.py)
2. Add validators for backward compatibility
3. Add unit tests
4. Commit: "feat(api): Support full proto schema for context requirements and variables"

### Step 2: Testing (2 hours)
1. Run unit tests
2. Run integration tests with old + new templates
3. Test manual registration via CLI
4. Verify OpenCode can load and execute

### Step 3: Deployment (30 min)
1. Deploy backend with new schema support
2. Rebuild CLI binary
3. Verify health check: `curl http://localhost:8080/status`

### Step 4: Validation (30 min)
1. Register one enhanced template
2. Retrieve and verify context_requirements not empty
3. Execute template and verify impulse system works
4. Measure token reduction

---

## Rollback Plan

If issues arise:
1. **Code issue**: Revert commit, redeploy previous version
2. **Data issue**: No migration was run, so no data corruption possible
3. **Compatibility issue**: Validator ensures old format still works

**Risk**: VERY LOW (backward compatible design, no DB changes)

---

## Success Metrics

After deployment:
- ✅ Enhanced templates register successfully (422 errors gone)
- ✅ Backend returns non-empty context_requirements
- ✅ Old templates still work (no regression)
- ✅ Token usage reduced by 30-50% with impulse system
- ✅ All 20 backend templates can be enhanced

---

## Files to Modify

1. `repos/metabob-rpc-api/server/routes/v2_activities.py` - ContextRequirement schema
2. `repos/metabob-rpc-api/server/models/proto_task_step.py` - TaskPrompt.variables schema
3. `repos/metabob-rpc-api/tests/routes/test_v2_activities.py` - Add backward compat tests
4. `repos/metabob-cli/dist/` - Rebuild binary

---

## Next Session Checklist

- [ ] Implement schema changes
- [ ] Add unit tests for backward compatibility
- [ ] Test with enhanced templates
- [ ] Deploy to backend
- [ ] Rebuild CLI binary
- [ ] Register first enhanced template
- [ ] Measure token reduction
- [ ] Document results

**Estimated Total Time**: 4-6 hours  
**Can Start Immediately**: Yes (all requirements known)
