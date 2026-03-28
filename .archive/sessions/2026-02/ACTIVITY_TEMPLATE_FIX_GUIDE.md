# Activity Template Fix Guide
**Date:** February 13, 2026  
**Purpose:** Manual steps to fix Activity Create and Activity Evolve templates

---

## Summary

We discovered that both Activity Create and Activity Evolve activities have a **prompt bug** where the agent doesn't call the MCP persistence tools. Since we can't use the broken activities to fix themselves, we need to manually update the database.

---

## What Was Already Fixed ✅

**Infrastructure Fix - COMPLETE:**
- ✅ `TemplateRepository.save()` re-enabled with idempotency check
- ✅ Direct MCP tool calls work correctly (`create_activity_template`, `evolve_activity_template`)
- ✅ No more 422 errors from duplicate saves

**File Modified:**
```
repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts
```

---

## What Needs Fixing ⚠️

**Agent Prompts - MANUAL FIX REQUIRED:**

### 1. INFRASTRUCTURE-0013e379 (Activity Create)
**Task:** `create-template` (task 4)  
**Issue:** Prompt doesn't instruct agent to call `create_activity_template` MCP tool  
**Result:** Agent generates JSON but doesn't persist to backend

### 2. INFRASTRUCTURE-57327686 (Activity Evolve)  
**Task:** `create-variant` or `execute-evolution` (task 4)  
**Issue:** Prompt doesn't instruct agent to call `evolve_activity_template` MCP tool  
**Result:** Agent generates variant but doesn't persist to backend

---

## Manual Fix Steps

### Option 1: Direct Database Update (Recommended)

**Using curl + SurrealDB HTTP API:**

```bash
# 1. Get the current template
curl -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "Content-Type: application/json" \
  -H "NS: metabob" \
  -H "DB: production" \
  -d '{
    "query": "SELECT * FROM activity_template WHERE id = '\''INFRASTRUCTURE-0013e379'\''",
    "vars": {}
  }' | jq '.[0].result[0]' > template_backup.json

# 2. Edit the template JSON
# Find the task with id "create-template" and update its prompt to include:
#   "Call create_activity_template MCP tool with the generated template data"
#   "Verify the response status is 'success' and extract template_id"

# 3. Update the database
curl -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "Content-Type: application/json" \
  -H "NS: metabob" \
  -H "DB: production" \
  -d '{
    "query": "UPDATE activity_template:'\''INFRASTRUCTURE-0013e379'\'' SET tasks = $tasks",
    "vars": {"tasks": [PASTE_UPDATED_TASKS_ARRAY_HERE]}
  }'
```

### Option 2: Python Script (Semi-Automated)

We created `fix_activity_create_template_v2.py` but it has authentication issues with the SurrealDB HTTP API. To fix:

1. Update the auth logic to use Content-Type: application/json
2. Parse the signin response properly
3. Use basic auth (-u root:root) instead of Bearer tokens

### Option 3: Direct SurrealDB Client (If surreal CLI installed)

```bash
surreal sql \
  --endpoint ws://localhost:8000 \
  --username root \
  --password root \
  --namespace metabob \
  --database production \
  --pretty

# Then in the SQL prompt:
SELECT * FROM activity_template WHERE id = 'INFRASTRUCTURE-0013e379';

# Copy the output, edit the create-template task, then:
UPDATE activity_template:`INFRASTRUCTURE-0013e379` SET tasks = [
  # ... paste updated tasks array ...
];
```

---

## Required Prompt Changes

### For Activity Create (INFRASTRUCTURE-0013e379)

**Task:** `create-template`  
**Current Prompt:** (Approximately 200-300 chars, focuses on generating JSON)

**Fixed Prompt:** (See `fix_activity_create_template_v2.py` for full text)

Key additions:
```
2. **Call create_activity_template MCP Tool**:
   Use the create_activity_template tool with these parameters:
   - name: <template name from step 1>
   - description: <template description from step 1>
   - category: <category from step 1>
   - tasks: <JSON.stringify(tasks array from step 1)>
   - context_requirements: "[]"
   - validation: "{}"

3. **Verify Persistence**:
   - Check the MCP tool response for status: "success"
   - Extract the template_id from the response
   - Call get_activity_template with the template_id to verify

4. **Return Result**:
   - Return the template_id and confirmation message
```

### For Activity Evolve (INFRASTRUCTURE-57327686)

**Task:** `execute-evolution` or `create-variant`  
**Current Prompt:** (Similar issue - doesn't call MCP tool)

**Fixed Prompt:**

Key additions:
```
2. **Call evolve_activity_template MCP Tool**:
   Use the evolve_activity_template tool with these parameters:
   - parent_id: <parent template ID>
   - changes: <JSON.stringify(changes object)>
   - evolution_note: <explanation of changes>
   - evolution_type: "derived" | "optimized" | "merged"

3. **Verify Persistence**:
   - Check the MCP tool response for status: "success"
   - Extract the new variant_id from the response
   - Verify genealogy tracking (parent_hash, lineage)

4. **Return Result**:
   - Return the variant_id and genealogy info
```

---

## Verification Steps

After fixing the templates:

### Test 1: Verify Template Updated
```bash
# Query the database to confirm changes
curl -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "Content-Type: application/json" \
  -H "NS: metabob" \
  -H "DB: production" \
  -d '{
    "query": "SELECT tasks FROM activity_template WHERE id = '\''INFRASTRUCTURE-0013e379'\''"
  }' | jq '.[0].result[0].tasks[] | select(.id == "create-template") | .prompt' | grep "create_activity_template MCP tool"

# Should output the line containing "create_activity_template MCP tool"
```

### Test 2: Create a Test Template
```bash
# Use the fixed Activity Create template
activity INFRASTRUCTURE-0013e379 variables={
  template_name: "Verification Test",
  template_description: "Test template to verify persistence works",
  template_category: "test",
  workflow_steps: ["Step 1: Do something"],
  success_criteria: "Task completes successfully"
}

# Then verify it exists:
search_activities("Verification Test")
# Should return the newly created template
```

### Test 3: Evolve a Template  
```bash
# Use the fixed Activity Evolve template
activity INFRASTRUCTURE-57327686 variables={
  parent_template_id: "INFRASTRUCTURE-0013e379",
  evolution_goal: "Test evolution",
  specific_changes: "Minor update to test prompt",
  rationale: "Testing that evolution now persists"
}

# Then verify the variant exists:
search_activities("Activity Create")
# Should show multiple variants if evolution worked
```

---

## Workaround Until Fixed

**Use MCP tools directly:**

```typescript
// In opencode session or via MCP client
import { MetabobCLI } from "./util/metabob"

// Create new template
const result = await MetabobCLI.createActivityTemplate({
  id: "test-template-" + Date.now(),
  name: "My Test Template",
  description: "Test description",
  category: "test",
  tasks: [
    {
      id: "step1",
      description: "Do something",
      prompt: "Detailed instructions..."
    }
  ]
})

console.log("Template created:", result.templateId)
```

Or via metabob-cli MCP server:
```python
import asyncio
from metabob_cli.mcp.tools import create_activity_template_tool

result = asyncio.run(create_activity_template_tool(
    name="My Test Template",
    description="Test description",
    category="test",
    tasks='[{"id":"step1","description":"Do something","prompt":"..."}]',
    context_requirements="[]",
    validation="{}"
))

print(result)
```

---

## Success Criteria

- [ ] INFRASTRUCTURE-0013e379 task 4 prompt includes "create_activity_template MCP tool" instruction
- [ ] INFRASTRUCTURE-57327686 task 4 prompt includes "evolve_activity_template MCP tool" instruction
- [ ] Test template creation works end-to-end (activity → persisted → searchable)
- [ ] Test template evolution works end-to-end (activity → variant persisted → searchable)
- [ ] Activity-debug.log shows MCP tool calls: `CREATE_ACTIVITY_TEMPLATE_TOOL CALLED` or `EVOLVE_ACTIVITY_TEMPLATE_TOOL CALLED`

---

## Files to Reference

1. **TEMPLATE_PERSISTENCE_FIX_SUMMARY.md** - Complete root cause analysis
2. **ACTIVITY_CREATE_FAILURE_ANALYSIS.md** - Original investigation
3. **fix_activity_create_template_v2.py** - Python script with correct prompt text
4. **repos/metabob-cli/src/metabob_cli/mcp/tools.py:4224** - MCP tool implementation

---

## Next Steps

1. **Immediate:** Fix INFRASTRUCTURE-0013e379 template in database using one of the manual methods above
2. **Immediate:** Fix INFRASTRUCTURE-57327686 template similarly
3. **Verify:** Test both templates end-to-end
4. **Document:** Update activity system documentation with this known issue
5. **Long-term:** Add validation that checks if templates actually persist after activity execution

---

## Questions?

If the manual fix doesn't work:
- Check SurrealDB logs: `docker logs metabob-surreal`
- Verify connection: `curl http://localhost:8000/health`
- Check authentication: Credentials are root/root (from docker-compose.yaml)
- Try different SurrealDB client libraries or tools
