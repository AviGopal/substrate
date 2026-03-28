# Final Status: V2 Activity System Tool Registration Issue

**Date**: February 11, 2026  
**Status**: 🟡 **PARTIALLY WORKING** - Backend functional, MCP tools not registered

---

## Executive Summary

Through agent verification (ACP delegation), we discovered that **V2 Activity MCP tools are NOT registered** with the MCP server, preventing agents from accessing the V2 Activity System. However, the **OpenCode activity tool exists** and attempts to call these MCP tools, falling back to empty results when they're unavailable.

---

## What We Verified

### ✅ Local Repository Usage Confirmed
- Dockerfile copies from `repos/metabob-cli/` (line 37)
- Dockerfile copies from `repos/metabob-opencode/` (line 59)
- Our fixes exist in local repos:
  - `_get_session_token()` helper: ✅ Present (tools.py line 42)
  - `METABOB_PROJECT_ID` env var: ✅ Present (session_manager.py line 227)
  - Session creation on startup: ✅ Present (app.py)

### ✅ Fixes Deployed to Container
- Copied fixed Python files directly to container
- Container restarted successfully
- New session created with correct project_id: `exp-repo-dev`
- Session token: Working ✅

### ✅ Agent Can List Tools (ACP vs TUI Same)
Delegated task to agent: "List ALL available tools"

**Agent Response:**
```
Total: 26 tools

Core: bash, edit, webfetch, glob, grep, list, read, write
Todo: todowrite, todoread
Activity: activity, task, test_metabob_mcp
Remote: remote_bash, remote_read, remote_write, remote_sync
Delegation: acp_delegate
Snippets: snippet
Inspection: inspect_llm_request

Metabob (8 code analysis tools):
- metabob_search_codebase_issues
- metabob_mark_problem_complete
- metabob_annotate_component
- metabob_analyze_change_impact
- metabob_list_file_components
- metabob_get_priority_issues
- metabob_suggest_related_changes
- metabob_assess_deletion_safety
```

**Missing MCP Tools:**
- ❌ `search_activities`
- ❌ `get_activity`
- ❌ `execute_activity`
- ❌ All other V2 activity MCP tools

---

## Architecture Discovery

### OpenCode Activity Tool (✅ Present)

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

The `activity` tool that agents see IS functional and attempts to use MCP tools:

```typescript
// Line 832 in metabob.ts
export async function searchActivities(query, options) {
  try {
    const result = await callMCPTool("search_activities", {
      query: query || "",
      category: options?.category ?? null,
      limit: options?.limit || 20,
      min_success_rate: 0.0,
    })
    
    if (result?.status === "success" && Array.isArray(result.activities)) {
      return result.activities  // ✅ Would work if MCP tool was registered
    }
    
    return []  // ❌ Falls back to empty array when MCP tool unavailable
  } catch (error) {
    return []  // ❌ Falls back to empty array on error
  }
}

// Line 867
export async function getActivity(activityId) {
  try {
    const result = await callMCPTool("get_activity", {
      activity_id: activityId,
    })
    // Returns template or undefined
  } catch (error) {
    return undefined
  }
}
```

**Key Insight**: The OpenCode side is correctly implemented and ready to use MCP tools. It just silently falls back to empty results when the MCP tools aren't available.

### MCP Tools (❌ Defined But Not Registered)

**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

The V2 activity tools ARE defined with proper decorators:

```python
# Line 3296
@mcp.tool(
    name="search_activities",
    description="""Search for activity templates by query..."""
)
async def search_activities(...):
    # Implementation exists ✅
    
# Line 3424  
@mcp.tool(
    name="get_activity",
    description="""Get activity metadata..."""
)
async def get_activity(...):
    # Implementation exists ✅
```

**But**: These tools are never exposed to the MCP server.

---

## Root Cause Analysis

### Why Tools Aren't Registered

**File**: `repos/metabob-cli/src/metabob_cli/mcp/server.py`

```python
# Line 111
from metabob_cli.mcp.tools import mcp as MetabobMCP

# Line 114 - COMMENTED OUT!
# import metabob_cli.mcp.activity_template_tools  # noqa: F401
```

The commented-out import suggests:
1. There WAS a plan to modularize V2 activity tools into a separate file
2. That file (`activity_template_tools.py`) **was never created**
3. The tools were defined in `tools.py` but never imported/registered

### Investigation Needed

We need to verify:
1. Is the `mcp` object from `tools.py` the same instance the server uses?
2. Where does the MCP server register tools?
3. Why are code analysis tools registered but activity tools aren't?

---

## Data Flow (Current State)

```
Agent (OpenCode Activity Mode)
│
├─ Has "activity" tool ✅
│  └─ Calls MetabobCLI.searchActivities()
│     └─ Calls callMCPTool("search_activities", ...)
│        │
│        ▼
│     MCP Client → MCP Server (metabob-cli)
│        │
│        ▼
│     ❌ Tool "search_activities" NOT FOUND
│        │
│        ▼
│     Returns undefined
│        │
│        ▼
│     Falls back to empty array []
│        │
│        ▼
│     Agent: "No activities found"
```

**Expected Flow** (if MCP tools were registered):

```
Agent → activity tool → MCP Client → MCP Server
                                      │
                                      ├─ search_activities ✅
                                      ├─ get_activity ✅
                                      └─ execute_activity ✅
                                      │
                                      ▼
                              V2 API Backend (http://api-server-dev:8080)
                                      │
                                      ▼
                              SurrealDB (4 templates)
                                      │
                                      ▼
                              Returns templates to agent ✅
```

---

## Testing Summary

| Test | Method | Result | Details |
|------|--------|--------|---------|
| Backend API | Direct curl | ✅ PASS | All endpoints responding |
| Session Auth | Token from state file | ✅ PASS | Bearer tokens accepted |
| Database | Direct API query | ✅ PASS | 4 templates retrieved |
| Session Creation | Container restart | ✅ PASS | exp-repo-dev session created |
| Agent Tool List | ACP delegation | ✅ PASS | Agent lists 26 tools |
| MCP Activity Tools | Agent tool list | ❌ FAIL | search_activities NOT in list |
| Activity Tool | Agent has it | ✅ PASS | "activity" tool present |
| End-to-End | Agent uses activity | ❌ BLOCKED | Falls back to empty results |

---

## Status by Component

| Component | Status | Details |
|-----------|--------|---------|
| **Backend API** | 🟢 Working | V2 endpoints functional |
| **Database** | 🟢 Working | 4 templates stored |
| **Session Management** | 🟢 Working | Auto-created with correct project_id |
| **OpenCode Activity Tool** | 🟢 Working | Properly calls MCP tools |
| **MCP Tool Registration** | 🔴 **BROKEN** | V2 activity tools not registered |
| **Agent Access** | 🔴 **BLOCKED** | Can't search/retrieve activities |
| **E2E Workflow** | 🔴 **BLOCKED** | Silent failure (empty results) |

---

## What Works

✅ **Infrastructure Layer**:
- Backend API (FastAPI) ← Working
- SurrealDB with templates ← Working  
- Authentication (Bearer tokens) ← Working
- Session management ← Working
- Project scoping (exp-repo-dev) ← Working

✅ **OpenCode Layer**:
- Activity tool defined ← Working
- MetabobCLI.searchActivities() implementation ← Working
- MCP client setup ← Working
- Fallback logic ← Working (too well!)

✅ **MCP Tool Definitions**:
- search_activities defined ← Working
- get_activity defined ← Working
- execute_activity defined ← Working
- Proper @mcp.tool() decorators ← Working

## What's Broken

❌ **MCP Tool Registration**:
- Tools defined but not registered ← **ROOT CAUSE**
- MCP server doesn't expose them ← Consequence
- Agents can't call them ← Consequence
- Silent fallback to empty results ← Masks the problem

---

## Next Steps

### 1. Investigate MCP Server Tool Registration
**File**: `repos/metabob-cli/src/metabob_cli/mcp/server.py`

Questions:
- Where does the MCP server register tools?
- Is `MetabobMCP` (line 111) actually used?
- Why do code analysis tools work but activity tools don't?
- Are there multiple `mcp` instances?

### 2. Fix Tool Registration

**Option A**: Register tools from `tools.py`
- Ensure the `mcp` object in `tools.py` is connected to the server
- Verify all `@mcp.tool()` decorated functions are registered

**Option B**: Create the missing file
- Create `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`
- Move/import V2 activity tools there
- Uncomment line 114 in `server.py`

**Option C**: Explicit registration
- Find where code analysis tools are registered
- Add explicit registration for activity tools

### 3. Rebuild and Test
- Rebuild devbob image with fix
- Restart container
- Delegate task to agent: "Search for feature activities"
- Verify agent gets results from V2 API

### 4. Update Documentation
- Revise V2_ACTIVITY_SYSTEM_COMPLETE.md
- Document the registration issue
- Update architecture diagrams

---

## Lessons Learned

1. **Test End-to-End Through Agents**: Always verify agents can actually use the features, not just that APIs respond to curl
2. **Silent Fallbacks Hide Problems**: OpenCode's graceful fallback to empty arrays masked the MCP registration issue
3. **ACP Delegation is Key**: The ACP delegation test immediately revealed the agent couldn't see the MCP tools
4. **Local Repos Work**: Dockerfile correctly uses local repos, allowing iterative fixes
5. **Container File Copying**: Can hot-patch containers with `docker cp` for quick testing before rebuilds

---

## Key Files

### Backend (✅ Working)
- `repos/metabob-rpc-api/server/routes/v2_activities.py` - V2 API endpoints
- `repos/metabob-rpc-api/server/actions/activity_variants.py` - Database queries

### MCP Layer (🔴 Broken Registration)
- `repos/metabob-cli/src/metabob_cli/mcp/server.py` - **INVESTIGATE THIS**
- `repos/metabob-cli/src/metabob_cli/mcp/tools.py` - V2 activity tools defined (line 3296, 3424)
- `repos/metabob-cli/src/metabob_cli/mcp/app.py` - MCP server startup (fixed ✅)
- `repos/metabob-cli/src/metabob_cli/core/session_manager.py` - Session creation (fixed ✅)

### OpenCode Layer (✅ Working)
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` - Activity tool
- `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` - MCP client (line 825, 863)

### Container
- `configs/Dockerfile.devbob` - Image build (uses local repos ✅)
- Container: `devbob-opencode` (files hot-patched with docker cp)

---

## Conclusion

We've made significant progress:

**✅ Fixed:**
- Session token reading from state file
- Project ID from environment variable
- Session creation on MCP startup
- Verified local repos are used
- Deployed fixes to container

**🔴 Discovered:**
- MCP V2 activity tools not registered with server
- OpenCode activity tool exists and tries to call them
- Silent fallback hides the registration issue
- Root cause: Tools defined but never exposed

**🎯 Next Priority:**
- Investigate MCP server tool registration mechanism
- Fix registration so agents can access V2 activity tools
- Rebuild image and test end-to-end
- Document complete V2 Activity System

**Status**: Infrastructure is solid, integration gap at MCP layer needs one more fix.

---

**Document Version**: 1.0  
**Last Updated**: February 11, 2026  
**Status**: Investigation Complete, Registration Fix Needed
