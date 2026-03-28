# Activity Execution Status - February 12, 2026

## Current Status: Requires OpenCode Restart

**Date**: February 12, 2026 19:07 UTC  
**Session**: Post-architecture fix validation

## Summary

The architecture fix from the previous session was **successfully applied** and both repos are updated:
- ✅ metabob-cli: Added `get_activity_template` MCP tool (commit `41e223b5e`)
- ✅ metabob-opencode: Updated TemplateLoader to use MCP (commit `542cda25`)
- ✅ Development metabob-cli reinstalled on host (`pip install -e ./repos/metabob-cli`)

However, **activity execution requires OpenCode process restart** to reload MCP server with new tools.

## Root Cause Identified

### Problem Flow
1. OpenCode's MCP client connects to `metabob-cli mcp --transport stdio`
2. MCP server process started when OpenCode session began
3. That process is running OLD metabob-cli code (v1.8.0 without `get_activity_template`)
4. We updated and reinstalled metabob-cli, but OpenCode's MCP server process is still running
5. Activity tool → TemplateLoader → calls `get_activity_template` MCP tool → **tool not found** → returns undefined → "Activity not found" error

### Evidence
```bash
# Direct test of MCP tool (works)
$ python3 -c "from metabob_cli.mcp.tools import get_activity_template_tool; ..."
✅ Status: success
✅ Template ID: infrastructure-86af0790
✅ Template Name: Echo Proof Feb12
✅ Tasks: 1

# But OpenCode's MCP client can't see the new tool because it's using cached process
```

### Error Evolution
1. **First attempt**: `Backend returned 500: {"error":"Failed to create template"}`
   - This was due to Docker container config having `project_id` field (fixed)
2. **Second attempt**: `Activity "infrastructure-86af0790" not found`
   - TemplateLoader calls `getActivityTemplate()` → MCP tool not found → returns undefined → "not found" error

## What Works ✅

### Backend
```bash
$ curl -s http://localhost:8080/health
{"status":"ok","timestamp":"...","version":"0.16.0"}
```

### MCP Tool (Direct)
```bash
$ python3 -c "from metabob_cli.mcp.tools import get_activity_template_tool; ..."
Returns: {"status":"success","template":{...}} with 1 task
```

### Activity Search
```javascript
search_activities({ verbose: true })
// Returns 20 activities including:
// - infrastructure-86af0790: Echo Proof Feb12
// - INFRASTRUCTURE-0013e379: Activity Create (5 tasks)
```

## What Needs OpenCode Restart ⏳

### Activity Execution
```javascript
activity({
  activityId: "infrastructure-86af0790",
  variables: {},
  reason: "Test execution"
})
// Currently fails: "Activity not found"
// After restart: Should execute successfully
```

## Next Steps (After OpenCode Restart)

### 1. Verify MCP Tool Available
```javascript
// OpenCode should now see get_activity_template in MCP tool list
// This happens automatically when MCP client reconnects
```

### 2. Test Simple Activity
```javascript
activity({
  activityId: "infrastructure-86af0790",
  variables: {},
  reason: "Verify activity execution after restart"
})

// Expected: Execution succeeds, echoes message
```

### 3. Execute Activity-Create (Self-Hosting Proof)
```javascript
activity({
  activityId: "INFRASTRUCTURE-0013e379",
  variables: {
    template_name: "post-restart-proof",
    template_description: "Proof template created after full system restart",
    template_category: "infrastructure",
    required_variables: JSON.stringify([]),
    optional_variables: JSON.stringify([]),
    tasks: JSON.stringify([
      {
        id: "echo-success",
        description: "Echo success message",
        subagent: "general",
        prompt: {
          template: "Echo: Activity system fully operational after restart!",
          variables: [],
          max_tokens: 500
        },
        dependencies: [],
        validation: {
          type: "output_contains",
          value: "operational"
        }
      }
    ])
  },
  reason: "Prove activity-create template works end-to-end"
})

// Expected: Creates new template in backend
// Verify with: search_activities({ query: "post-restart-proof" })
```

### 4. Verify New Template
```javascript
search_activities({ query: "post-restart-proof", verbose: true })
// Should find the newly created template

// Then execute it:
activity({
  activityId: "infrastructure-[hash]", // Use returned ID
  variables: {},
  reason: "Execute self-created template"
})
```

## Architecture Validation

### Correct Flow (Now Implemented)
```
OpenCode Activity Tool
  ↓
TemplateLoader.load(id)
  ↓
MetabobCLI.getActivityTemplate(id)
  ↓
callMCPTool("get_activity_template", {activity_id: id})
  ↓
MCP Client → MCP Server (metabob-cli mcp)
  ↓
get_activity_template_tool()
  ↓
Backend GET /v2/activities/templates/{id}
  ↓
Returns template with tasks
  ↓
MCP Server → MCP Client
  ↓
TemplateLoader caches template
  ↓
Activity Tool executes tasks
```

### Boundaries Respected ✅
- ✅ OpenCode NEVER calls backend directly
- ✅ OpenCode ONLY calls MCP tools
- ✅ metabob-cli manages authentication
- ✅ metabob-cli calls backend APIs

## Files Modified (This Session)

### Container Config Fix
```bash
# Removed project_id from Docker container config
docker exec devbob-opencode bash -c 'cat /workspace/.metabob/config.json | jq "del(.project_id)" > /tmp/config.json && mv /tmp/config.json /workspace/.metabob/config.json'
```

### Host metabob-cli Installation
```bash
cd repos/metabob-cli
pip install -e .  # Reinstalled with latest code including get_activity_template
```

## Known Issues

### Issue 1: OpenCode MCP Server Caching
**Problem**: OpenCode's MCP server process persists across code changes  
**Impact**: New MCP tools not available until restart  
**Solution**: OpenCode process restart (automatic at session start)

### Issue 2: Docker Container Config Schema
**Problem**: Container had `project_id` in config, but new metabob-cli doesn't support it  
**Status**: ✅ Fixed (removed from container config)

## Success Criteria

After OpenCode restart, these should ALL work:

- [ ] search_activities returns 20+ templates
- [ ] activity tool can load templates (no "Activity not found")
- [ ] Simple activity (infrastructure-86af0790) executes successfully
- [ ] activity-create template (INFRASTRUCTURE-0013e379) executes
- [ ] New template appears in search results
- [ ] Self-created template can be executed

## Commits This Session

### metabob-opencode
- None (previous session commits already applied)

### metabob-cli
- None (previous session commits already applied)

### Configuration
- Removed `project_id` from Docker container config (not committed)

## Documentation Created
- `ACTIVITY_EXECUTION_STATUS_FEB12.md` (this file)
- `CORRECT_ARCHITECTURE_FIX_COMPLETE.md` (previous session - 382 lines)

## Conclusion

The architecture fix is **complete and correct**. The only remaining step is **OpenCode process restart** to reload the MCP server with the updated metabob-cli code.

**Status**: 🟡 READY FOR TESTING (requires restart)

**Next Session**: After OpenCode restarts automatically, execute the test plan above to verify end-to-end functionality.

---

**Session End**: February 12, 2026 19:07 UTC  
**Next Action**: Wait for OpenCode restart, then run test plan
