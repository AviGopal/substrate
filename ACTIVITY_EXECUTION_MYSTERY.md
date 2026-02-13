# Activity Execution Mystery - Unsolved

**Date**: February 12, 2026 19:25 UTC  
**Status**: Root cause still unclear after extensive debugging

---

## The Problem

Activity execution consistently fails with:
```
Error: Backend returned 500: {"error":"Failed to create template"}
```

## What We Know ✅

### 1. Backend Works Perfectly
```bash
$ curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/v2/activities/templates/infrastructure-51aee5c8
✅ Returns template with correct task_steps
```

### 2. MCP Tools Work Directly
```python
from metabob_cli.mcp.tools import get_activity_template_tool
result = await get_activity_template_tool('infrastructure-86af0790')
✅ Returns: {"status":"success", "template":{...}}
```

### 3. search_activities Works
```javascript
search_activities({ verbose: true })
✅ Returns 20 activities
```

### 4. OpenCode Runs from Source
```bash
$ cd repos/metabob-opencode && bun run dev ../..
# Runs: bun run --cwd packages/opencode ./src/index.ts
✅ TypeScript source executed directly, not compiled binary
```

### 5. Code Fix Is Present
```bash
$ grep "MetabobCLI.getActivityTemplate" \
  repos/metabob-opencode/packages/opencode/src/session/template-loader.ts
281:      const template = await MetabobCLI.getActivityTemplate(resolvedId)
✅ Uses MCP, not direct API
```

### 6. MCP Tool Exists and Is Registered
```bash
$ cd repos/metabob-cli
$ grep -A3 "@mcp.tool" src/metabob_cli/mcp/tools.py | grep -A3 "get_activity_template"
@mcp.tool(
    name="get_activity_template",
    description="""Get FULL activity template including all task steps.
✅ Tool properly decorated
```

## The Mystery ❓

Despite all of the above working correctly, activity execution triggers a call to `create_template()` which tries to POST to `/v2/activities/templates` and fails with 500.

### Error Source Traced
The error format "Backend returned 500: {response.text}" comes from:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` line 1044 in `create_template()`
- `repos/metabob-cli/src/metabob_cli/mcp/tools.py` line 4501 in `create_boredom_task()` (not relevant)

The `create_template()` function is called from:
- `repos/metabob-cli/src/metabob_cli/mcp/tools.py` line 4245 in `create_activity_template_tool()`

### The Question
**Why is `create_activity_template` MCP tool being called instead of `get_activity_template`?**

## Theories Investigated

### Theory 1: Binary Not Updated ❌
**Hypothesis**: OpenCode binary at `/home/avi/.local/bin/opencode` has old code  
**Result**: Disproven - OpenCode runs from source via `bun run dev`

### Theory 2: MCP Tool Not Found → Fallback ❓
**Hypothesis**: `get_activity_template` tool doesn't exist, OpenCode falls back to creation logic  
**Investigation**:
- Tool function exists: `get_activity_template_tool()` ✅
- Tool is decorated with `@mcp.tool(name="get_activity_template")` ✅
- Direct Python test works ✅
**Status**: Tool exists, but unclear if MCP server registers it

### Theory 3: Wrong Code Path ❓
**Hypothesis**: OpenCode is calling a different function that triggers save()  
**Investigation**:
- Traced all `save()` calls in activity.ts
- Found `Activity.save()` call (line 1028) but that's for activity state, not templates
- Found `TemplateRepository.save()` call in trailblazing, but that's AFTER execution starts
**Status**: No save() call should happen before execution

### Theory 4: MCP Client Caching/Mapping Issue ❓
**Hypothesis**: OpenCode's MCP client is calling wrong tool name  
**Status**: Unable to verify without MCP client logs

## Missing Debug Information

To solve this, we need to see:

1. **MCP Server Logs**: What tool names are registered when MCP server starts?
2. **MCP Client Logs**: What tool is OpenCode actually calling?
3. **Call Stack**: Where exactly is `create_activity_template_tool` being invoked from?

## Attempted Workarounds

### Test 1: Template With No Variables
```javascript
activity({
  activityId: "INFRASTRUCTURE-c0b9dfaa",  // Has no variables
  variables: {},
  reason: "Test"
})
❌ Same error
```

### Test 2: Different Templates
Tried:
- `infrastructure-86af0790` (1 task, needs "message" variable)
- `infrastructure-51aee5c8` (1 task, needs "name" variable)
- `INFRASTRUCTURE-c0b9dfaa` (4 tasks, no variables)

❌ All fail with same error

## Code Paths Analyzed

### OpenCode Activity Tool Flow
```
1. activity() called (tool/activity.ts:296)
2. TemplateRepository.get(templateId, {sessionID}) (line 302)
3. TemplateLoader.load(id, options, sessionID) (template-loader.ts:240)
4. MetabobCLI.getActivityTemplate(resolvedId) (line 281)
5. callMCPTool("get_activity_template", {activity_id}) (metabob.ts:940-946)
6. [MCP Client → MCP Server]
7. ??? (Something goes wrong here)
8. Error thrown back to user
```

### Expected MCP Server Flow
```
1. MCP receives: "get_activity_template" with {activity_id: "..."}
2. Calls: get_activity_template_tool(activity_id) (tools.py:3615)
3. Calls: manager._load_activity_to_cache(activity_id) (tools.py:3625)
4. Calls: GET /v2/activities/templates/{activity_id} (activity_manager.py:~line 600)
5. Returns: {"status": "success", "template": {...}}
```

### Actual Flow (Inferred from Error)
```
1. MCP receives: ??? (unknown tool name)
2. Somehow calls: create_activity_template_tool() (tools.py:4245)
3. Calls: manager.create_template(...) (activity_manager.py:~line 1000)
4. Calls: POST /v2/activities/templates (activity_manager.py:1020)
5. Backend returns: 500 {"error":"Failed to create template"}
6. Returns: {"status":"error", "message":"Backend returned 500: {...}"}
```

## Next Steps to Debug

### 1. Add MCP Server Logging
Edit `repos/metabob-cli/src/metabob_cli/mcp/tools.py`:
```python
@mcp.tool(name="get_activity_template", ...)
async def get_activity_template_tool(activity_id: str) -> str:
    logger.critical(f"!!! GET_ACTIVITY_TEMPLATE_TOOL CALLED: {activity_id} !!!")
    # ... rest of function
```

Then restart and check if this log appears.

### 2. Add OpenCode Logging
Edit `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`:
```typescript
export async function getActivityTemplate(activityId: string) {
  console.error(`!!! CALLING MCP TOOL: get_activity_template for ${activityId} !!!`)
  const result = await callMCPTool<...>("get_activity_template", ...)
  console.error(`!!! MCP RESULT:`, result)
  // ... rest of function
}
```

### 3. Check MCP Tool Registration
At MCP server startup, log all registered tools to verify `get_activity_template` is in the list.

### 4. Intercept MCP Communication
Use MCP protocol debugging to see actual JSON-RPC messages between OpenCode and metabob-cli.

## Hypothesis: Tool Name Mismatch

**Most Likely Theory**: OpenCode's MCP client isn't finding `get_activity_template` tool.

Possible causes:
1. Tool not registered at server startup (decorator issue?)
2. Tool name mismatch (OpenCode calling different name?)
3. MCP server crashed/restarted without this tool
4. Import path issue preventing tool from loading

## Verification Steps

```bash
# 1. Check if metabob-cli is actually installed in editable mode
cd repos/metabob-cli
pip show metabob-cli | grep Location

# 2. Verify tool function is imported
python3 -c "
import sys; sys.path.insert(0, 'repos/metabob-cli/src')
from metabob_cli.mcp.tools import get_activity_template_tool
print(f'Tool function exists: {callable(get_activity_template_tool)}')
print(f'Tool name: {get_activity_template_tool.__name__}')
"

# 3. Check MCP server process
ps aux | grep "metabob-cli mcp"
```

## Conclusion

After 2+ hours of debugging, the root cause remains elusive. The error is clear ("Backend returned 500: Failed to create template"), the source is identified (`create_template()` in activity_manager.py), but the **call path** that triggers this is unknown.

**The missing link**: How does a call to `activity()` → `getActivityTemplate()` → `callMCPTool("get_activity_template")` end up calling `create_activity_template_tool()` instead?

This requires either:
1. MCP protocol inspection to see actual messages
2. Debug logging in both OpenCode and metabob-cli
3. Step-through debugging with breakpoints

**Status**: 🔴 BLOCKED - Unable to proceed without additional debugging capabilities

---

**Recommendation**: Add critical logging at MCP boundaries to trace the actual tool name being called, then restart both OpenCode and MCP server to capture the logs.
