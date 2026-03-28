# V2 API Standards - Activity Template System

**Date**: February 11, 2026  
**Source of Truth**: `repos/metabob-rpc-api/server/routes/v2_activities.py`  
**Proto Schema**: `repos/metabob-proto/proto/metabob/activity/variant.proto`

---

## Design Principles

### 1. Clean Client Interface
- **CLI sends**: Simple template schema (proto-aligned)
- **Backend handles**: All complexity (Thompson Sampling, A/B testing, variant management)
- **Client ignorant**: No knowledge of variants, selection, or learning system

### 2. Proto Schema Alignment
- **All models**: Match proto definitions exactly
- **No duplication**: Backend does transformation once
- **Future-proof**: Proto is source of truth for evolution

### 3. Backward Compatibility
- **Backend accepts**: Both old and new field names during migration
- **But clients should**: Use new proto schema exclusively
- **Migration path**: Old fields deprecated, will be removed in Phase 2

---

## Complete V2 Schema Reference

### Template Creation Request

**Endpoint**: `POST /v2/activities/templates`  
**Content-Type**: `application/json`  
**Auth**: `Authorization: Bearer <session_token>`

**Request Body** (`TemplateCreateRequest`):

```json
{
  "name": "string (required)",
  "description": "string (required)",
  "category": "string (required) - one of: feature, bugfix, refactor, tool, infrastructure",
  
  "variables": {
    "variableName": {
      "type": "string (required) - string|boolean|number|array",
      "required": "boolean (default: true)",
      "default": "any (optional)",
      "description": "string (optional)"
    }
  },
  
  "context_requirements": [
    {
      "type": "string (required) - codebase_context|user_requirements",
      "required": "boolean (default: true)"
    }
  ],
  
  "tasks": [
    {
      "id": "string (required) - unique within activity",
      "subagent": "string (required) - general|tool|config|session",
      "description": "string (required)",
      "dependencies": ["string (optional) - task IDs"],
      
      "prompt": {
        "template": "string (required) - prompt with {{variables}}",
        "max_tokens": "int (default: 8000)",
        "compression_strategy": "string (default: 'filter') - filter|summarize|truncate",
        "variables": ["string (optional) - variable names"]
      },
      
      "validation": {
        "required_files": ["string (optional)"],
        "required_patterns": ["string (optional)"],
        "forbidden_patterns": ["string (optional)"],
        "commands": [
          {
            "command": "string",
            "expected_exit_code": "int (default: 0)",
            "timeout_seconds": "int (default: 30)"
          }
        ]
      },
      
      "retry": {
        "max_attempts": "int (default: 3)",
        "strategy": "string (default: 'simple') - simple|exponential|adaptive",
        "fallback_prompt": "string (optional)"
      },
      
      "metrics": {
        "success_rate": "float (0.0-1.0, default: 0.0)",
        "avg_tokens": "int (default: 0)",
        "avg_duration": "int (default: 0) - milliseconds",
        "common_failures": ["string (optional)"]
      },
      
      "impulse_refs": [
        {
          "impulse_id": "string (required)",
          "priority": "string (default: 'MEDIUM') - HIGH|MEDIUM|LOW",
          "required": "boolean (default: false)"
        }
      ],
      
      "guidance": ["string (optional) - hints for agent"],
      "expected_actions": ["string (optional) - expected behaviors"],
      
      "tools": {
        "allowed_tools": ["string (optional)"],
        "forbidden_tools": ["string (optional)"]
      },
      
      "complexity": {
        "tier": "string (default: 'MEDIUM') - LOW|MEDIUM|HIGH",
        "estimated_tokens": "int (default: 4000)"
      }
    }
  ],
  
  "parent_id": "string (optional) - for derived templates"
}
```

**Response** (201 Created):

Returns proto `ActivityVariant` message as JSON:

```json
{
  "variant_id": "feature-abc123ef",
  "activity_id": "feature",
  "variant_name": "Custom Feature Template",
  "description": "Template for adding features...",
  "task_steps": [...],
  "variables": {...},
  "content_hash": "abc123ef...",
  "status": "testing",
  "created_at": "2026-02-11T00:00:00Z"
}
```

---

## What the Backend Does (Hidden from Client)

### On Template Creation

```
1. Client sends: TemplateCreateRequest (proto schema)
   ↓
2. Backend validates: Pydantic + proto alignment check
   ↓
3. Backend transforms:
   - name → variant_name (internal)
   - category → activity_id (internal)
   - tasks → task_steps (internal, for hashing)
   - Computes content_hash (genealogy)
   - Generates variant_id: {category}-{hash[:8]}
   ↓
4. Backend stores:
   - INSERT INTO activity_variants
   - INSERT INTO variant_performance_metrics
   - Thompson Sampling initialized (alpha=1.0, beta=1.0)
   ↓
5. Backend returns: ActivityVariant (proto message)
```

### On Template Retrieval

```
1. Client requests: GET /v2/activities/templates/{id}
   ↓
2. Backend uses Thompson Sampling:
   - Samples from Beta distribution for each variant
   - Selects highest sample (exploration + exploitation)
   - Returns "the template" (client unaware of selection)
   ↓
3. Client receives: ActivityVariant (appears as single template)
```

---

## Field Mapping Reference

### What CLI Should Send vs What Backend Stores

| CLI Sends (Proto) | Backend Stores (Internal) | Notes |
|-------------------|---------------------------|-------|
| `name` | `variant_name` + `name` | Backend keeps both for compatibility |
| `category` | `activity_id` + `category` | category is user-facing, activity_id is internal |
| `tasks` | `task_steps` + `tasks` | task_steps used for hashing, tasks for readability |
| `variables` (dict) | `variables` (dict) | No transformation needed |

**Important**: CLI should use proto field names. Backend handles internal mapping.

---

## Minimal Valid Template Example

```json
{
  "name": "Test Echo Activity",
  "description": "Simple test activity",
  "category": "test",
  "variables": {},
  "context_requirements": [],
  "tasks": [
    {
      "id": "echo-task",
      "subagent": "general",
      "description": "Echo a message",
      "dependencies": [],
      "prompt": {
        "template": "Echo: Hello World!",
        "max_tokens": 1000,
        "compression_strategy": "filter",
        "variables": []
      },
      "validation": {
        "required_files": [],
        "required_patterns": [],
        "forbidden_patterns": [],
        "commands": []
      },
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
      "impulse_refs": [],
      "guidance": [],
      "expected_actions": []
    }
  ]
}
```

---

## Deprecated Fields (DO NOT USE)

These fields were in the OLD schema and are **deprecated**:

### Old TemplateTask Schema (DEPRECATED)
```json
{
  "order": 0,                    // ❌ Use "id" instead
  "type": "agent_task",          // ❌ Use "subagent" instead
  "agent_mode": "general",       // ❌ Redundant with subagent
  "prompt_template": "...",      // ❌ Use "prompt.template" instead
  "validation": {...},           // ✅ Still valid (but nested structure changed)
  "cost_budget": 0.5             // ❌ Removed (managed by backend)
}
```

**Why deprecated**:
- `order` is not content-addressable (breaks genealogy)
- `type` is ambiguous (collides with Python keyword)
- `prompt_template` is flat (proto uses nested `prompt` object)
- Missing `impulse_refs` (critical for learning system)

---

## CLI Implementation Guide

### What CLI register_template Should Do

```python
@click.command()
def register_template(template_file: str, base_url: str):
    """Register template - NO TRANSFORMATION NEEDED"""
    
    # 1. Read template file
    with open(template_file, "r") as f:
        template_data = json.load(f)
    
    # 2. Validate required fields
    required = ["name", "description", "category", "tasks"]
    for field in required:
        if field not in template_data:
            raise ValueError(f"Missing required field: {field}")
    
    # 3. Normalize variables (only if needed)
    variables = template_data.get("variables", {})
    if isinstance(variables, list):
        # Convert array to dict: [{name: "x", ...}] → {"x": {...}}
        variables = {v["name"]: v for v in variables}
        template_data["variables"] = variables
    
    # 4. Send directly to backend (NO TRANSFORMATION!)
    response = httpx.post(
        f"{base_url}/v2/activities/templates",
        json=template_data,  # ← Send as-is!
        headers={
            "Authorization": f"Bearer {session_token}",
            "Content-Type": "application/json"
        }
    )
    
    # 5. Handle response
    if response.status_code in [200, 201]:
        result = response.json()
        print(f"✓ Template registered: {result['variant_id']}")
    else:
        print(f"✗ Failed: {response.status_code} - {response.text}")
```

### What CLI Should NOT Do

❌ **Don't transform field names**:
```python
# BAD - Don't do this!
variant_data = {
    "activity_id": template_data["category"],     # ← Backend does this
    "variant_name": template_data["name"],        # ← Backend does this
    "task_steps": transform_tasks(...),           # ← Backend does this
}
```

✅ **Just pass through**:
```python
# GOOD - Let backend handle transformation
response = httpx.post(url, json=template_data)
```

---

## Authentication

### Session Token Required

All v2 endpoints require Bearer token authentication:

```bash
Authorization: Bearer <session_token>
```

### How to Get Session Token

```python
# CLI should manage session lifecycle
response = httpx.post(f"{base_url}/v2/session/create", json={
    "api_key": api_key,
    "project_id": project_id
})

session_data = response.json()
session_token = session_data["session_token"]
session_id = session_data["session_id"]

# Store in ~/.metabob/session.json
save_session({"token": session_token, "id": session_id})
```

---

## Error Handling

### 422 Validation Error

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "name"],
      "msg": "Field required"
    },
    {
      "type": "missing",
      "loc": ["body", "tasks", 0, "prompt"],
      "msg": "Field required"
    }
  ]
}
```

**Cause**: Request doesn't match `TemplateCreateRequest` schema

**Fix**: Ensure all required fields present with correct types

### 401 Unauthorized

```json
{
  "detail": "Invalid or expired session token"
}
```

**Fix**: Re-authenticate with `/v2/session/create`

### 409 Conflict

```json
{
  "detail": "Template variant already exists: feature-abc123ef"
}
```

**Cause**: Content hash collision (exact duplicate template)

**Fix**: Modify template slightly or use existing template

---

## Testing Checklist

After implementing v2 standard:

- [ ] CLI sends proto schema (name, category, tasks)
- [ ] CLI does NOT transform to variant schema
- [ ] Backend accepts request (200/201)
- [ ] Template stored in activity_variants table
- [ ] variant_id generated correctly ({category}-{hash})
- [ ] content_hash computed for genealogy
- [ ] Metrics initialized (Thompson Sampling)
- [ ] Template retrievable via GET
- [ ] Template searchable via search_activities
- [ ] Template executable via activity tool

---

## Migration Path

### Phase 1: Schema Alignment (Current)
- ✅ Backend accepts proto schema
- ✅ Backend maps fields internally
- ⚠️ CLI still using old transformation (needs fix)

### Phase 2: CLI Update (Next)
- Update CLI register_template to send proto schema
- Remove transformation logic
- Test end-to-end flow

### Phase 3: Deprecation Cleanup (Future)
- Remove old TemplateTask schema
- Remove backward compatibility mapping
- Pure proto schema only

---

## Summary

**What changed in v2**:
1. ✅ Proto-aligned schema (TaskStep, not TemplateTask)
2. ✅ Clean field names (name, category, tasks)
3. ✅ Nested prompt configuration
4. ✅ Impulse references for learning
5. ✅ Backend handles all complexity

**What CLI needs to do**:
1. Send template as-is (proto schema)
2. No field name transformation
3. Only normalize variables if array → dict
4. Let backend handle the rest

**Result**:
- Clean separation of concerns
- Future-proof for proto evolution
- No duplication between CLI and backend
- Learning system works transparently

---

**Last Updated**: February 11, 2026  
**Status**: Standards documented, CLI needs update
