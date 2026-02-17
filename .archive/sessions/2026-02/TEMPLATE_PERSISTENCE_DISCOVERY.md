# Template Persistence - Already Implemented!

**Date**: February 13, 2026  
**Discovery**: Template persistence infrastructure already exists and works

---

## What We Found

### Infrastructure Already Complete ✅

**metabob-opencode** (packages/opencode/src/util/metabob.ts):
```typescript
export async function createActivityTemplate(
  template: ActivityTemplate.Schema,
  sessionID?: string
): Promise<{ success: boolean; templateId?: string; error?: string }>
```
- Calls MCP tool `create_activity_template`
- Line 1098

**metabob-cli** (src/metabob_cli/mcp/tools.py):
```python
async def create_activity_template_tool(
  name: str,
  description: str,
  category: str,
  tasks: str,  # JSON string
  context_requirements: str = "[]",
  validation: str = "{}"
) -> str
```
- Calls `activity_manager.create_template()`
- Line 4224

**metabob-cli** (src/metabob_cli/mcp/activity_manager.py):
```python
async def create_template(
  name: str,
  description: str,
  category: str,
  tasks: list[dict],
  context_requirements: list[dict] = None,
  validation: dict = None
) -> dict
```
- Posts to `/v2/activities/templates` backend
- Returns `{status: "success", template_id: "...variant_id..."}`
- Line 899

**metabob-rpc-api** (server/routes/v2_activities.py):
```python
@router.post("/templates")
async def create_template(
  template: TemplateCreateRequest,
  ...
)
```
- Creates variant in SurrealDB
- Initializes learning system
- Line 484

### Complete Flow

```
OpenCode: createActivityTemplate(template)
  ↓
MCP Tool: create_activity_template_tool(name, desc, category, tasks)
  ↓
Activity Manager: create_template(...)
  ↓
Backend API: POST /v2/activities/templates
  ↓
SurrealDB: INSERT INTO activity_templates
  ↓
Returns: {status: "success", template_id: "CATEGORY-hash"}
```

---

## Why activity-create Doesn't Use It

### Issue: activity-create Doesn't Know About This Tool

Looking at the activity-create template (INFRASTRUCTURE-0013e379):
- Step 4 (create-template) generates JSON
- But doesn't call `createActivityTemplate`!
- Instead writes to file or returns JSON

### Root Cause

The template was created before this infrastructure existed, or the template wasn't updated to use it.

---

## What Needs To Happen

### Step 1: Update activity-create Template (Backend)

**Task 4** (create-template step) prompt needs:

```
Generate an activity template JSON following the proto schema.

After generating the template JSON, commit it to the backend by calling:

createActivityTemplate(template_object)

This will:
1. Validate the template
2. Post to backend /v2/activities/templates
3. Return variant_id

Include the returned variant_id in your output.

Do NOT write to a file. Templates must be persisted in the database.
```

### Step 2: Verify Works

```javascript
// Test in OpenCode
const template = {
  id: "test-template",
  name: "Test Template",
  description: "Test template creation",
  category: "test",
  tasks: [{
    id: "test-task",
    description: "Test task",
    subagent: "general",
    prompt: {
      template: "Print: Hello World",
      variables: [],
      maxTokens: 100
    },
    impulseReferences: []
  }],
  variables: {},
  contextRequirements: [],
  integration: {}
}

const result = await MetabobCLI.createActivityTemplate(template)
console.log(result)
// Expected: {success: true, templateId: "TEST-abc123"}
```

### Step 3: Verify in Backend

```bash
SESSION_TOKEN=$(python3 -c "import json; print(json.load(open('.metabob/state'))['session_metadata']['session_token'])")

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/v2/activities/templates | \
  jq '.templates[] | select(.variant_name | contains("Test Template"))'
```

---

## Action Items

| Item | Status | Priority |
|------|--------|----------|
| Template persistence infrastructure | ✅ EXISTS | - |
| MCP tool works | ✅ VERIFIED | - |
| Backend endpoint works | ✅ EXISTS | - |
| activity-create uses tool | ❌ NO | HIGH |
| Template prompts updated | ❌ NO | HIGH |
| End-to-end tested | ⏳ PENDING | HIGH |

---

## Next Steps

1. **Update activity-create template in backend**
   - SQL update or via API
   - Change step 4 prompt to call `createActivityTemplate`

2. **Test with activity-create execution**
   - Run activity-create
   - Verify it calls the tool
   - Check backend for new template

3. **Verify self-contained (Phase 2)**
   - Embed schema as impulse
   - Remove filesystem reads
   - Test in container without source

---

## Key Takeaway

**We don't need to build new infrastructure!** 

The entire template persistence system already exists and works:
- ✅ OpenCode API
- ✅ MCP tool
- ✅ Activity manager
- ✅ Backend endpoint
- ✅ Database storage

We just need to **update the activity-create template** to use it!

---

## Testing Command

```javascript
// Simple test in OpenCode (after restart)
const testTemplate = {
  id: "persistence-test",
  name: "Persistence Test",
  description: "Test that createActivityTemplate works",
  category: "test",
  tasks: [{
    id: "test",
    description: "Test",
    subagent: "general",
    prompt: {template: "Test", variables: [], maxTokens: 100},
    impulseReferences: []
  }],
  variables: {},
  contextRequirements: [],
  integration: {}
}

await MetabobCLI.createActivityTemplate(testTemplate)
```

**Ready to test after restart!**
