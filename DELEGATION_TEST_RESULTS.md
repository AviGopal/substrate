# Delegation Test Results - Clean Environment

**Date**: February 13, 2026  
**Test**: Execute activity-create (INFRASTRUCTURE-bda5eef0) in devbob-clean container

---

## Test Objective

Validate that the improved activity-create template:
1. Works in clean environment (no local code)
2. Creates template JSON
3. **Calls createActivityTemplate to persist to backend**
4. Successfully completes all 5 tasks

---

## Test Execution

### Setup ✅
- devbob-clean container running
- API key configured
- Backend connectivity verified
- Empty workspace confirmed

### Delegation ✅
- Target: docker://devbob-clean
- Activity: INFRASTRUCTURE-bda5eef0
- Duration: 308.5 seconds (~5 minutes)
- Completed: Yes (all 5 tasks)
- Error: "Internal error" during cleanup phase

---

## Results

### What Worked ✅

1. **Clean Environment Execution**
   - Activity ran in isolated container
   - No local code dependencies
   - All 5 tasks completed

2. **Template Creation**
   - Created 5 JSON template files:
     - activity-example-rest-endpoint.json
     - activity-fix-bug-complete.json
     - activity-example-fix-bug.json
     - activity-example-refactor.json
     - activity-template-minimal.json
   - Templates are valid JSON
   - Follow correct schema structure

3. **Output Separation**
   - TUI clean (no interference)
   - Status messages on stderr
   - Error report properly formatted

### What Didn't Work ❌

1. **Backend Persistence**
   - ❌ Templates NOT persisted to backend
   - ❌ `createActivityTemplate` tool NOT called
   - ✅ Tool exists in metabob-cli (verified)
   - ✅ Tool has debug logging (verified)

2. **Cleanup Phase Error**
   - "Internal error" during cleanup
   - No detailed error trace
   - Agent completed but reported failure

---

## Root Cause Analysis

### Why createActivityTemplate Wasn't Called

**Hypothesis 1: Agent didn't see the tool**
- Tool defined in metabob-cli MCP server
- Container has metabob-cli installed
- OpenCode configured to use MCP
- **Need to verify**: MCP tool list available to agent

**Hypothesis 2: Prompt unclear**
- Task 4 prompt includes instructions
- Says: "IMPORTANT - PERSISTENCE STEP"
- Says: "you MUST persist it by calling createActivityTemplate"
- **But**: Prompt may need more explicit function signature

**Hypothesis 3: Agent chose file-based approach**
- Created JSON files instead
- May have interpreted task as "write files"
- Didn't understand persistence requirement

**Hypothesis 4: Tool call failed silently**
- Agent attempted to call
- Tool rejected or errored
- Error not surfaced in delegation response

---

## Evidence

### Files Created (in /workspace)
```bash
$ docker exec devbob-clean find /workspace -name '*.json' -mmin -10
/workspace/activity-example-rest-endpoint.json
/workspace/activity-fix-bug-complete.json
/workspace/activity-example-fix-bug.json
/workspace/activity-example-refactor.json
/workspace/activity-template-minimal.json
```

### Template Structure (valid)
```json
{
  "id": "fix-bug-minimal",
  "name": "Fix Bug with Tests",
  "description": "Fix a bug, add regression test...",
  "category": "bugfix",
  "version": {...},
  "tasks": [...]
}
```

### Backend Check (no new templates)
```bash
$ curl /v2/activities/templates | grep "clean-environment"
# No results - template not persisted
```

### Tool Definition (exists)
```python
@tool(name="create_activity_template", description="...")
async def create_activity_template_tool(
    name: str,
    description: str,
    category: str,
    tasks: str,  # JSON array
    ...
)
```

---

## Next Steps

### Option 1: Verify MCP Tool Availability
```bash
# Check if agent can see the tool
docker exec devbob-clean sh -c "
  curl -s http://localhost:8082/tools | jq '.tools[] | select(.name==\"create_activity_template\")'
"
```

### Option 2: Enhance Task 4 Prompt
Current prompt (1512 chars) includes instructions but may need:
- Explicit function signature
- Example call with actual syntax
- Clearer indication it's a TOOL, not a hypothetical function

**Suggested addition**:
```
CRITICAL: Call the MCP tool to persist:

createActivityTemplate({
  name: "{{template_name}}",
  description: "{{template_description}}",
  category: "{{template_category}}",
  tasks: JSON.stringify(taskStepsArray)
})

This is an actual tool available in your environment. You MUST call it.
```

### Option 3: Check MCP Server Logs
```bash
docker exec devbob-clean cat /workspace/.metabob/logs/server.log | \
  grep -i "create_activity_template"
```

### Option 4: Direct Test
Test if tool is callable directly:
```bash
# From inside container
curl -X POST http://localhost:8082/call-tool \
  -d '{"tool": "create_activity_template", "args": {...}}'
```

---

## Success Criteria (Not Yet Met)

- [x] Activity executes in clean environment
- [x] Template JSON created
- [ ] **createActivityTemplate called** ← BLOCKING
- [ ] Template persisted to backend
- [ ] Template appears in /v2/activities/templates

---

## Recommendations

### Immediate Action
1. **Check MCP tool availability** in container
2. **Review MCP server logs** for tool registration
3. **Enhance prompt** with explicit tool signature
4. **Test tool directly** to verify it works

### Medium Term
1. Add validation step that checks backend for template
2. Include createActivityTemplate in impulse examples
3. Make tool call mandatory (validation failure if not called)

### Long Term
1. Activity templates should validate outputs
2. Add "expected tool calls" to task steps
3. Framework should warn if critical tools not called

---

## Conclusion

**Partial Success**: 
- ✅ Clean environment execution works
- ✅ Template creation logic works
- ❌ Backend persistence not happening

**Root Issue**: Agent not calling `createActivityTemplate` tool

**Impact**: Templates work locally but don't persist to backend, so they can't be discovered and reused by other agents.

**Priority**: HIGH - This blocks the entire template evolution system.

---

**Status**: Needs investigation and fix before declaring success.
