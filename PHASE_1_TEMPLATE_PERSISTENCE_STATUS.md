# Phase 1: Template Persistence - Status

**Date**: February 12, 2026 21:00 PST  
**Status**: MCP Tool Created ✅, Integration Pending

---

## What We Accomplished

### 1. Created create_activity_template MCP Tool ✅
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`  
**Commit**: `4ed214af0`

**Tool Signature**:
```python
@server.tool()
async def create_activity_template_tool(
    template_json: str,
    created_by: str = "activity-create"
) -> str
```

**Functionality**:
- Accepts template JSON in proto format
- Validates required fields (name, description, category, task_steps)
- Calls POST `/v2/activities/templates` backend endpoint
- Returns variant_id on success

**Backend Integration**:
- Backend endpoint already exists (v2_activities.py line 484)
- Accepts proto format with ProtoTaskStep
- Creates variant in SurrealDB
- Initializes learning system

---

## Next Steps

### Immediate: Test the Tool
Need to restart OpenCode to load new MCP tool, then test:

```javascript
// In OpenCode
const template = {
  name: "Test Template",
  description: "Test template creation",
  category: "test",
  task_steps: [{
    id: "test-step",
    description: "Test step",
    subagent: "general",
    prompt: {
      template: "Print: Hello World",
      variables: [],
      max_tokens: 100
    },
    impulse_refs: []
  }],
  variables: {},
  context_requirements: []
}

// Call MCP tool via metabob-cli
const result = await MetabobCLI.createActivityTemplate(
  JSON.stringify(template),
  "test-user"
)

console.log(result)
// Expected: {status: "success", variant_id: "TEST-abc123"}
```

### Step 2: Update activity-create Template
Once tool is verified working, update the activity-create template:

**Task 4** (create-template) needs to:
1. Generate template JSON (already does this)
2. **NEW**: Call create_activity_template tool
3. Verify success
4. Report variant_id

**Current prompt** (approximate):
```
Generate an activity template JSON following the proto schema.
Write the template to a file.
```

**Updated prompt**:
```
Generate an activity template JSON following the proto schema from the activity-template-schema impulse.

After generating the JSON:
1. Validate it matches the schema
2. Call the create_activity_template tool to commit it to the backend:
   
   create_activity_template({
     template_json: <your_generated_json_string>,
     created_by: "{{execution_id}}"
   })

3. Verify the tool returns {"status": "success", "variant_id": "..."}
4. Include the variant_id in your output

Do NOT write to a file. The template must be committed to the backend database.
```

### Step 3: Validate End-to-End
```bash
# Run activity-create
activity({
  activityId: "INFRASTRUCTURE-0013e379",
  variables: {
    template_name: "persistence-test",
    template_goal: "Test that templates are persisted"
  },
  reason: "Validate template persistence works"
})

# Check backend for new template
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/v2/activities/templates | \
  jq '.templates[] | select(.variant_name | contains("persistence-test"))'

# Should find the template!
```

---

## Architecture Flow (After Integration)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER (metabob-opencode)                                      │
└─────────────────────────────────────────────────────────────────┘
                           │
User: "Create hello world template"
activity({activityId: "activity-create", ...})
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ACTIVITY EXECUTION (metabob-opencode)                        │
└─────────────────────────────────────────────────────────────────┘
                           │
Step 1: identify-pattern   ├─ Uses impulses (schema, examples)
Step 2: define-scope       │
Step 3: design-steps       │
Step 4: create-template    ├─ Generates JSON
   │                       │
   ├─ Generate JSON        │
   ├─ Call MCP tool ────────┐
   │  create_activity_template(json_string)
   │                       │
   ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. MCP TOOL (metabob-cli)                                       │
│    create_activity_template_tool()                              │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ├─ Parse JSON
                           ├─ Validate fields
                           ├─ Call backend API ────┐
                           │                       │
                           ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. BACKEND API (metabob-rpc-api)                                │
│    POST /v2/activities/templates                                │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ├─ Validate proto schema
                           ├─ Generate variant_id
                           ├─ Store in SurrealDB
                           ├─ Initialize learning system
                           │
                           ▼
                  {"status": "success", "variant_id": "TEST-abc123"}
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. RESPONSE FLOWS BACK                                          │
└─────────────────────────────────────────────────────────────────┘
                           │
Backend → MCP Tool → Activity Step 4 → User
                           │
                           ▼
User sees: "Template 'hello-world' created with variant_id: TEST-abc123"
```

---

## Testing Status

| Component | Status | Notes |
|-----------|--------|-------|
| Backend endpoint | ✅ Exists | POST /v2/activities/templates (line 484) |
| MCP tool | ✅ Created | create_activity_template_tool (committed) |
| OpenCode integration | ⏳ Pending | Need restart to load tool |
| activity-create update | ❌ Not done | Need to update template prompts |
| End-to-end test | ⏳ Pending | After restart and template update |

---

## Known Issues

### Issue 1: Tool Not Yet Tested
**Problem**: Tool created but not tested in live environment  
**Fix**: Restart OpenCode, test tool directly  
**Priority**: HIGH

### Issue 2: activity-create Still Writes Files
**Problem**: Template doesn't use new tool yet  
**Fix**: Update template task 4 prompt  
**Priority**: HIGH

### Issue 3: Schema Not Self-Contained (Next Phase)
**Problem**: activity-create reads schema from filesystem  
**Fix**: Phase 2 - Embed schema as impulse  
**Priority**: HIGH

---

## Success Criteria

Phase 1 complete when:
- ✅ MCP tool exists and is committed
- ⏳ Tool successfully creates template in backend
- ⏳ activity-create uses tool instead of file writing
- ⏳ End-to-end test: activity-create → backend → verify template exists

**Current Status**: 1/4 complete (25%)

**Next Action**: Restart OpenCode and test the MCP tool

---

## Commands for Testing

```bash
# 1. Restart OpenCode (loads new MCP tool)
# Done externally

# 2. Test tool directly (in OpenCode)
const result = await MetabobCLI.createActivityTemplate(
  JSON.stringify({
    name: "Test",
    description: "Test",
    category: "test",
    task_steps: [{
      id: "test",
      description: "Test",
      subagent: "general",
      prompt: {template: "Test", variables: [], max_tokens: 100},
      impulse_refs: []
    }],
    variables: {},
    context_requirements: []
  }),
  "test"
)

# 3. Verify in backend
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/v2/activities/templates

# 4. After validation, update activity-create template
# (Backend SQL or via update endpoint)
```

---

**Ready for restart and testing!**
