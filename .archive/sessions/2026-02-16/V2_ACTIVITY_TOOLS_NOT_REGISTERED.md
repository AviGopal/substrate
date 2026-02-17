# Critical Finding: V2 Activity Tools Not Registered with MCP Server

**Date**: February 11, 2026  
**Status**: 🔴 **BLOCKER IDENTIFIED**

---

## Issue Summary

The V2 Activity System tools (`search_activities`, `get_activity`, etc.) are **defined in the code but NOT registered with the MCP server**. This means agents cannot access these tools, preventing them from using the V2 Activity System.

---

## Evidence

### 1. Agent Cannot See Activity Tools ✓ CONFIRMED

Delegated task to `devbob-opencode` to list Metabob tools:

**Agent Response:**
```
I have access to the following Metabob tools:

1. metabob_search_codebase_issues
2. metabob_mark_problem_complete
3. metabob_annotate_component
4. metabob_analyze_change_impact
5. metabob_list_file_components
6. metabob_get_priority_issues
7. metabob_suggest_related_changes
8. metabob_assess_deletion_safety
```

**Missing Tools:**
- ❌ `search_activities`
- ❌ `get_activity`
- ❌ `execute_activity`
- ❌ Any other V2 activity tools

### 2. Tools ARE Defined in Code ✓ CONFIRMED

File: `/opt/metabob-cli/src/metabob_cli/mcp/tools.py`

```python
# Line 3296
@mcp.tool(
    name="search_activities",
    description="""Search for activity templates..."""
)
async def search_activities(...):
    ...

# Line 3424  
@mcp.tool(
    name="get_activity",
    description="""Get activity metadata..."""
)
async def get_activity(...):
    ...
```

Tools exist with proper `@mcp.tool()` decorators!

### 3. Import Is Commented Out ✓ ROOT CAUSE

File: `/opt/metabob-cli/src/metabob_cli/mcp/server.py`

```python
# Line 111
from metabob_cli.mcp.tools import mcp as MetabobMCP

# Line 114 - THE PROBLEM
# import metabob_cli.mcp.activity_template_tools  # noqa: F401
```

The import for `activity_template_tools` is **commented out**, and that file **doesn't even exist**:

```bash
$ docker exec devbob-opencode ls /opt/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py
ls: cannot access '...activity_template_tools.py': No such file or directory
```

---

## Root Cause Analysis

### What's Happening

1. **V2 activity tools are defined** in `tools.py` with `@mcp.tool()` decorators (lines 3296, 3424, etc.)
2. **The `mcp` object** (from FastMCP) collects these decorated functions
3. **BUT** the MCP server in `server.py` only imports the basic tools
4. **The commented-out import** suggests there WAS a plan to modularize activity tools into a separate file
5. **That file was never created**, so the tools are orphaned in `tools.py` but never exposed

### Why Tools Aren't Registered

The MCP server initialization flow:
1. `server.py` imports `mcp` from `tools.py` (line 111)
2. This DOES load the `mcp` object with all the `@mcp.tool()` decorated functions
3. HOWEVER, the server is using a DIFFERENT MCP instance or the tools aren't being properly exported

**Most Likely**: The `mcp` object in `tools.py` has the V2 activity tools, but the MCP server is using a different tool registry.

---

## Why Previous Tests "Worked"

Our previous V2 API tests showed:
- ✅ Backend API working (direct curl tests passed)
- ✅ Session authentication working (Bearer tokens accepted)
- ✅ Templates in database (4 templates found via curl)

**BUT** we never actually tested agent workflow end-to-end because:
- We delegated a "search activities" task
- The agent searched LOCAL FILES instead of using MCP tools
- We mistook local file search results for API results

The agent **cannot** access the V2 Activity System because the MCP tools aren't registered!

---

## Impact

| Component | Status | Details |
|-----------|--------|---------|
| Backend API | ✅ Working | Direct API calls with curl succeed |
| Session Auth | ✅ Working | Bearer tokens authenticate correctly |
| Database | ✅ Working | 4 templates stored and retrievable |
| MCP Tools | ❌ **BROKEN** | V2 activity tools not registered |
| Agent Access | ❌ **BLOCKED** | Agents cannot use V2 system |
| E2E Workflow | ❌ **BLOCKED** | No way for agents to execute activities |

---

## Solution

### Option 1: Register Tools in tools.py (Quick Fix)

The V2 activity tools are already defined in `tools.py`. We need to ensure they're registered with the MCP server.

**File**: `repos/metabob-cli/src/metabob_cli/mcp/server.py`

Check if the `mcp` object from `tools.py` is actually being used by the server. If not, we need to explicitly register the tools.

### Option 2: Create activity_template_tools.py (Original Design)

Create the missing file that line 114 references:

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

```python
"""
V2 Activity System MCP Tools
"""
from metabob_cli.mcp.tools import mcp

# Re-export activity tools or define them here
# This file would import and register the V2 activity tools

# Then uncomment line 114 in server.py:
# import metabob_cli.mcp.activity_template_tools  # noqa: F401
```

### Option 3: Check MCP Object Usage (Investigation Needed)

The `mcp` object is imported as `MetabobMCP` in server.py line 111:
```python
from metabob_cli.mcp.tools import mcp as MetabobMCP
```

Need to verify:
1. Is `MetabobMCP` actually passed to the MCP server?
2. Are there multiple MCP instances?
3. Is there a tool registration step we're missing?

---

## Files to Investigate

1. **repos/metabob-cli/src/metabob_cli/mcp/server.py**
   - Line 111: `from metabob_cli.mcp.tools import mcp as MetabobMCP`
   - Line 114: Commented-out import
   - Find where `MetabobMCP` is used
   - Check MCP server initialization

2. **repos/metabob-cli/src/metabob_cli/mcp/tools.py**
   - Line 3296: `search_activities` tool
   - Line 3424: `get_activity` tool
   - Verify `mcp` object is the same one server uses

3. **repos/metabob-cli/src/metabob_cli/mcp/app.py**
   - Check how MCP server is started
   - Verify tool registration process

---

## Next Steps

1. **Investigate server.py** - Find where `MetabobMCP` is used and how tools are registered
2. **Verify MCP object** - Confirm `mcp` in tools.py is the same instance server uses
3. **Fix registration** - Either:
   - Ensure existing V2 tools in tools.py are registered
   - Or create activity_template_tools.py and uncomment import
4. **Test end-to-end** - Delegate task to agent and verify it can use `search_activities`
5. **Update documentation** - Revise V2_ACTIVITY_SYSTEM_COMPLETE.md with correct status

---

## Status Update

**Previous Assessment**: ✅ V2 Activity System Complete and Operational  
**Actual Status**: ❌ **V2 Activity Tools NOT ACCESSIBLE to Agents**

The backend infrastructure is solid:
- ✅ V2 API endpoints working
- ✅ Authentication mechanism working
- ✅ Database with templates working
- ✅ Session management working

But the MCP layer is broken:
- ❌ V2 activity tools not registered with MCP server
- ❌ Agents cannot access V2 system
- ❌ Activity execution blocked

**This is a critical integration gap that must be fixed before the V2 Activity System can be used by agents.**

---

## Lessons Learned

1. **Test E2E workflows** - Don't just test individual components
2. **Verify agent capabilities** - Ask agent to list its tools before assuming it can use them
3. **Check registration, not just definition** - Tools can exist in code but not be registered
4. **Inspect actual usage** - Agent may fall back to alternative methods (file search) instead of using expected tools

---

**Document Version**: 1.0  
**Status**: Investigation Complete, Fix Needed  
**Priority**: 🔴 **CRITICAL** - Blocks all V2 Activity System usage by agents
