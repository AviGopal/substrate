# Debug Logging Ready - Restart Required to Observe

**Date**: February 12, 2026 19:32 UTC

---

## Setup Complete ✅

Debug logging has been added to both OpenCode and metabob-cli. The code changes are in place and verified to work (Python test successful).

##What Will Happen After Restart

When you restart OpenCode (`bun run dev`), you'll see debug output in the terminal showing EXACTLY which MCP tool is called.

### Expected Output

When you run an activity, look for these lines in the terminal:

```
!!! OPENCODE: Calling MCP tool "get_activity_template" for activity_id="infrastructure-51aee5c8" !!!
!!! GET_ACTIVITY_TEMPLATE_TOOL CALLED !!! activity_id=infrastructure-51aee5c8
```

OR

```
!!!OPENCODE: Calling MCP tool "create_activity_template" for template="..." !!!
!!! CREATE_ACTIVITY_TEMPLATE_TOOL CALLED !!! name=..., category=...
```

---

## Test Command (After Restart)

```javascript
activity({
  activityId: "infrastructure-51aee5c8",
  variables: {name: "Debug Test"},
  reason: "Observing which MCP tool is called"
})
```

---

## What We'll Learn

The debug output will definitively show:
1. **Which tool OpenCode THINKS it's calling** (`get_activity_template` or `create_activity_template`)
2. **Which tool actually executes** in the MCP server
3. **If there's a mismatch** between what's requested and what executes

This will solve the mystery of why template creation is being attempted.

---

## Files Modified (Ready to Observe)

### repos/metabob-cli/src/metabob_cli/mcp/tools.py
- Line ~3621: Debug log in `get_activity_template_tool()`
- Line ~4228: Debug log in `create_activity_template_tool()`
- **Verified working**: ✅ Python test successful

### repos/metabob-opencode/packages/opencode/src/util/metabob.ts  
- Line ~940: Debug log in `getActivityTemplate()`
- Line ~1104: Debug log in `createActivityTemplate()` with stack trace
- **Status**: Needs Bun reload (restart OpenCode)

---

## Why Restart is Needed

**Current State**:
- OpenCode PID 781876: Running with OLD TypeScript in memory
- MCP server PID 781958: Running with OLD Python modules cached

**After Restart**:
- Bun will load UPDATED TypeScript files
- Python will import UPDATED modules with debug logging
- Debug output will appear in terminal

---

## Alternative: Test Now Without Restart

If you want to see if TypeScript hot-reloaded:

1. Try the activity command again
2. Watch the terminal running `bun run dev`
3. Look for `!!!` lines

If you see them → hot reload worked!
If you don't → restart needed.

---

**Status**: 🟡 DEBUG READY - Restart to observe actual tool calls
