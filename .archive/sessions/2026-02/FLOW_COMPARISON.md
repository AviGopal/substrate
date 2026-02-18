# Activity Execution Flow - Proven vs Broken

**Date**: February 9, 2026  
**Method**: Code path replication (no LLM, only execution)  
**Status**: ❌ ROOT CAUSE PROVEN

---

## What We Proved

Using the EXACT code path the agent would execute:

### 1. Agent Calls activity() Tool ✅
```typescript
// repos/metabob-opencode/packages/opencode/src/tool/activity.ts:292
async execute(params, ctx) {
  const template = await TemplateRepository.get(templateId, { sessionID: ctx.sessionID })
  // ...
}
```

### 2. TemplateRepository.get() Calls TemplateLoader.load() ✅
```typescript
// repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:156
export async function load(id: string, options, sessionID) {
  // Step 3: Load from backend via direct API
  const { MetabobAPI } = await import("../util/metabob-api")
  const variantDetails = await MetabobAPI.getVariantDetails(resolvedId)
  // ...
}
```

### 3. MetabobAPI.getVariantDetails() Calls Backend ✅
```typescript
// Makes HTTP request:
GET /v2/activities/variants/{variant_id}
```

### 4. Backend Query Executes ✅
```python
# repos/metabob-rpc-api/server/routes/v2_activities.py
# Returns variant details from SurrealDB
```

---

## The Actual Error (Proven by Replication)

### Test Script Output:
```
Step 3: List available activities
  ✓ Found 0 activities in database
  ⚠️  Database is empty - no activities registered

This is why search_activities returns 0 results.
The agent cannot execute activities that don't exist in the database.
```

### Registration Attempt Output:
```
Registering activity...
Status: 422
Response: {"detail":[{
  "type": "string_type",
  "loc": ["body","tasks",0,"prompt","variables",0],
  "msg": "Input should be a valid string",
  "input": {
    "name": "scope",
    "type": "string",
    "required": false,
    "description": "...",
    "default": "entire repo"
  }
}]}
```

---

## Root Cause: Schema Mismatch

### Template Format (jiggle-documentation.json):
```json
{
  "tasks": [{
    "prompt": {
      "variables": [
        {
          "name": "scope",
          "type": "string",
          "required": false,
          "description": "...",
          "default": "entire repo"
        }
      ]
    }
  }]
}
```

### Backend Expected Format (proto_task_step.py:30-32):
```python
class TaskPrompt(BaseModel):
    variables: List[str] = Field(
        default_factory=list,
        description="Variables referenced in template"
    )
```

**Backend expects**: `["scope", "mode", "archiveInsteadOfDelete"]`  
**Template provides**: `[{name:"scope",...}, {name:"mode",...}, ...]`

---

## Why Activity Execution Fails

```
1. Agent calls: activity({ activityId: "jiggle-documentation", ... })
                    ↓
2. TemplateRepository.get("jiggle-documentation")
                    ↓
3. MetabobAPI.getVariantDetails("jiggle-documentation")
                    ↓
4. GET /v2/activities/variants/jiggle-documentation
                    ↓
5. Database query: SELECT * FROM activity_variants WHERE id = "jiggle-documentation"
                    ↓
6. Result: []  (NO MATCHING RECORD)
                    ↓
7. Returns: 404 Not Found
                    ↓
8. TemplateLoader throws: "Template not found: jiggle-documentation"
                    ↓
9. ActivityTool throws: "Activity \"jiggle-documentation\" not found"
                    ↓
10. Agent sees: Error message
```

**The activity cannot be found because it was never registered in the database.**

---

## Why Registration Fails

```
1. Attempt: POST /v2/activities/templates
            Body: {jiggle template JSON}
                ↓
2. Pydantic validation: Check against ProtoTaskStep schema
                ↓
3. TaskPrompt.variables expects: List[str]
   Template provides: List[Dict]
                ↓
4. Validation error: "Input should be a valid string"
                ↓
5. Returns: 422 Unprocessable Entity
                ↓
6. Registration fails
```

**The activity cannot be registered because the template format doesn't match the backend schema.**

---

## The Circular Problem

```
┌─────────────────────────────────────┐
│  Agent needs activity in database   │
│           to execute it             │
└──────────────┬──────────────────────┘
               ↓
┌──────────────────────────────────────┐
│  Activity cannot be registered       │
│  because template format is wrong    │
└──────────────┬───────────────────────┘
               ↓
┌──────────────────────────────────────┐
│  Template format was created for     │
│  OpenCode's ActivityTemplate.Schema  │
│  which doesn't match proto schema    │
└──────────────────────────────────────┘
```

---

## Proof: No Green Checkmarks Work

### What DOESN'T Work:
- ❌ search_activities returns 0 (database empty)
- ❌ activity() tool throws "not found" (no data)
- ❌ Template registration fails (schema mismatch)
- ❌ Manual execution worked, but that's NOT the activity system

### What DOES Work (proven by replication):
- ✅ Backend API is running
- ✅ Code path executes correctly
- ✅ Error messages are accurate
- ✅ Schema validation catches the mismatch

---

## The Fix Required

### Option 1: Fix Template Format
Convert jiggle template variables from objects to strings:

```diff
  "prompt": {
-   "variables": [
-     {"name": "scope", "type": "string", "required": false, ...}
-   ]
+   "variables": ["scope", "mode", "archiveInsteadOfDelete"]
  }
```

**Problem**: Loses metadata (type, required, description, default)

### Option 2: Fix Backend Schema
Update ProtoTaskStep to accept variable objects:

```python
class PromptVariable(BaseModel):
    name: str
    type: str
    required: bool = False
    description: Optional[str] = None
    default: Optional[Any] = None

class TaskPrompt(BaseModel):
    variables: List[Union[str, PromptVariable]]
```

**Problem**: Requires backend code changes and migration

### Option 3: Convert at Boundaries
Add transformation layer that converts between formats:

```typescript
// Before sending to backend
variables: template.variables.map(v => v.name || v)
```

**Problem**: Loses validation benefits, error-prone

---

## What This Session Proved

### ✅ Proven Facts:
1. Backend is running and healthy
2. Database is empty (no activities)
3. Registration API exists (POST /v2/activities/templates)
4. Registration fails with 422 (schema mismatch)
5. Schema mismatch is: `List[object]` vs `List[str]`
6. Code path from agent → backend works correctly
7. Error is NOT in the code, but in the data schema

### ❌ Not Proven:
1. That fixing the schema will make everything work
2. That there aren't other schema mismatches
3. That the activity will execute successfully after registration

### 📋 Next Steps:
1. Choose fix strategy (Option 1, 2, or 3)
2. Implement the fix
3. Register a simple test activity
4. Verify search_activities returns results
5. Verify activity() tool can execute it
6. THEN claim success (with evidence)

---

## Conclusion

**Zero activities have executed successfully via the activity tool.**

The replication proves:
- The code path works
- The database is empty
- Registration fails due to schema mismatch
- No amount of "✅ Complete" claims change this

**What's needed**: Actual schema fix + actual registration + actual execution proof.

---

**Evidence Files**:
- `test-activity-execution-flow.py` - Replicates agent code path
- `register-jiggle-activity.py` - Attempts registration, captures error
- Exit codes: Both return 1 (failure)
- False positives: 0 (actual HTTP calls, actual errors)

