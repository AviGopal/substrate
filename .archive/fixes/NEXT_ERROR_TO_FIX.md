# Next Error: search_activities Returns Empty

**Agent Behavior**: Calls search_activities, gets empty results, stops.

**Root Cause**: Unknown - needs investigation.

## What We Know

1. Backend has 27 templates:
   ```bash
   GET /v2/activities/templates
   → {total: 27, templates: [...27 items...]}
   ```

2. MCP tool exists and is implemented:
   ```python
   # repos/metabob-cli/src/metabob_cli/mcp/tools.py
   async def search_activities_tool(...) -> str:
       results = await manager.search_activities(...)
       return json.dumps({"status": "success", "count": len(results), "activities": results})
   ```

3. Activity manager fetches from backend:
   ```python
   # repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py
   async def search_activities(...) -> list[dict]:
       response = await client.get("/v2/activities/templates", params=params)
       return [converted templates]
   ```

4. OpenCode calls MCP tool:
   ```typescript
   // repos/metabob-opencode/packages/opencode/src/util/metabob.ts
   const result = await callMCPTool("search_activities", {query, category, limit})
   if (result?.status === "success" && Array.isArray(result.activities)) {
       return result.activities
   }
   return []
   ```

## Possible Causes

### Option A: MCP Server Not Running
- metabob-cli MCP server not started
- Agent can't connect to MCP
- Calls fail silently

### Option B: MCP Session Not Created
- MCP server needs session_token in config
- Session not initialized on startup
- Backend calls fail with 401

### Option C: Response Format Mismatch
- MCP returns data in unexpected format
- OpenCode can't parse it
- Falls back to empty array

## To Diagnose

Need to add logging or test with actual MCP server running:

```bash
# Start MCP server
METABOB_API_KEY=test-api-key \
METABOB_API_URL=http://localhost:8080 \
METABOB_PROJECT_ID=metabob-devbob \
METABOB_ORG_ID=test-org \
metabob-cli mcp --transport stdio

# Then connect OpenCode to it and call search_activities
# Check MCP server logs to see if tool is being called
```

## Next Steps

1. Start MCP server with logging
2. Call search_activities from OpenCode
3. Check MCP server logs for:
   - Is tool being called?
   - Does it have session_token?
   - What does it return?
   - Are there errors?
4. Fix whatever error appears

**Cannot proceed without actual execution test.**
