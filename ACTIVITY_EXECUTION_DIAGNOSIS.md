# Activity Execution Diagnosis - Complete Analysis

**Date**: February 9, 2026  
**Status**: ✅ ROOT CAUSE IDENTIFIED  
**Issue**: metabob-opencode cannot execute jiggle activity

---

## Test Results Summary

### ✅ Test 1: Direct API Execution - **PASS**
**What it tests**: Backend API → Database (bypassing all tools)

**Result**: SUCCESS
- Session creation: ✅ Works
- Template discovery: ✅ Works  
- Execution start: ✅ Works
- Database recording: ✅ Works

**Conclusion**: The backend v2 API and database are functioning perfectly.

---

### ❌ Test 2: MCP Tools - **FAIL**
**What it tests**: MCP server tools (bypassing OpenCode wrapper)

**Result**: FAILURE
- MCP tools can be imported: ✅ Works
- `search_activities_tool` executes: ✅ Works
- **But returns 0 templates**: ❌ **FAILURE**

**Root Cause Identified**:
```python
# From debugging:
config = get_config_manager()
# Returns:
{
  'base_url': 'http://localhost:8080',
  'session_token': '',  # ← EMPTY!
  'state_directory': '.metabob'
}
```

**The MCP server has NO SESSION TOKEN**, so it cannot authenticate with the v2 API which requires Bearer authentication.

---

### ⚠️  Test 3: OpenCode Activity Tool - **MANUAL TEST REQUIRED**
**What it tests**: Full OpenCode → MCP → Backend flow

**Result**: Cannot be programmatically tested
- OpenCode config: ✅ Correct
- MCP server running: ✅ Running (PID 1841988)
- API key configured: ✅ Present

**But**: Activity tool likely fails because MCP tools return 0 results (due to no session token)

---

## Root Cause Analysis

### The Session Token Problem

The flow should be:

```
1. MCP server starts
2. MCP server creates session with backend
   POST /v2/session (with X-API-Key)
   → Receives session_token
3. MCP server stores session_token in state
4. MCP tools use session_token for all requests
   GET /v2/activities/templates (with Bearer token)
```

### What's Actually Happening

```
1. MCP server starts ✅
2. MCP server does NOT create session ❌
3. session_token remains empty ❌
4. MCP tools try to call v2 API with empty token ❌
   → API returns 401 or empty results
5. OpenCode sees 0 activities ❌
```

### Evidence

```bash
# Direct API with Bearer token
$ curl -H "Authorization: Bearer <valid-token>" http://localhost:8080/v2/activities/templates?query=jiggle
✅ Returns: {"templates": [{"variant_id": "refactor-251a3ca8", ...}]}

# MCP tool with no token
$ python3 -c "from metabob_cli.mcp.tools import search_activities_tool; ..."
❌ Returns: {"status": "success", "count": 0, "activities": []}
```

---

## Why This Happens

### Possible Causes

1. **MCP server startup doesn't create session**
   - The server may be waiting for first tool call
   - Or session creation may be broken
   - Or session may have expired

2. **Session token not persisted**
   - Token created but not saved to state file
   - State file location wrong
   - Permissions issue

3. **Session token expired**
   - Token was created but expired (24h TTL)
   - No refresh mechanism

---

## How To Fix

### Option 1: Force Session Creation on MCP Startup

**File**: `repos/metabob-cli/src/metabob_cli/mcp/server.py`

Add session initialization:
```python
async def initialize_mcp_server():
    """Initialize MCP server with session"""
    from metabob_cli.core.session_manager import SessionManager
    
    # Get API key
    api_key = os.environ.get('METABOB_API_KEY')
    if not api_key:
        logger.warning("No METABOB_API_KEY - session creation will fail")
        return
    
    # Create session
    session_mgr = SessionManager(base_url=...)
    session_data = await session_mgr.create_session(
        org_id=os.environ.get('METABOB_ORG_ID', 'default-org'),
        project_id=os.environ.get('METABOB_PROJECT_ID', 'default-project'),
        agent_name='metabob-mcp'
    )
    
    # Store session token
    from metabob_cli.core.file_state import FileStateManager
    fsm = FileStateManager()
    fsm.session_token = session_data.get('session_token')
    fsm.save()
    
    logger.info(f"MCP session initialized: {session_data.get('session_id')}")
```

### Option 2: Lazy Session Creation

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

In `get_activity_manager()`:
```python
def get_activity_manager(base_url: str, session_token: str):
    # If no session token, create one
    if not session_token:
        logger.info("No session token found, creating new session...")
        session_token = _create_session_sync(base_url)
    
    return ActivityManager(base_url, session_token)
```

### Option 3: Fix Session Token Persistence

**File**: `repos/metabob-cli/src/metabob_cli/core/file_state.py`

Ensure `save()` is called after setting session_token:
```python
def set_session_token(self, token: str):
    self.session_token = token
    self.save()  # ← Must save immediately
```

---

## Immediate Workaround

Until the fix is deployed, you can manually create a session:

```bash
# 1. Create session manually
curl -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: test-api-key" \
  -H "Content-Type: application/json" \
  -d '{"org_id": "test-org", "project_id": "metabob-devbob", "agent_name": "manual", "session_type": "development"}'

# 2. Extract session_token from response

# 3. Save to MCP state file
echo '{"session_token": "<token>", "session_id": "<id>"}' > ~/.metabob-state/state/session.json

# 4. Restart MCP server
pkill -f "metabob-cli mcp"
metabob-cli mcp --transport stdio
```

---

## Verification After Fix

Once fixed, verify with:

```bash
# Test MCP tool
python3 << 'EOF'
import asyncio
from metabob_cli.mcp.tools import search_activities_tool

async def test():
    result = await search_activities_tool(query="jiggle", limit=5)
    print(result)

asyncio.run(test())
EOF

# Should return:
# {"status": "success", "count": 1, "activities": [{"variant_name": "Jiggle Documentation", ...}]}
```

---

## Complete Fix Checklist

- [ ] **Fix session creation**: MCP server creates session on startup
- [ ] **Fix session persistence**: Session token saved to state file
- [ ] **Fix session refresh**: Expired tokens automatically refreshed
- [ ] **Add health check**: Verify session is valid on startup
- [ ] **Add error handling**: Clear error if no API key provided
- [ ] **Test MCP tools**: Verify search_activities returns results
- [ ] **Test OpenCode**: Verify activity tool can execute activities

---

## Impact

**Severity**: HIGH - Blocks all activity execution via OpenCode

**Affected**:
- OpenCode `activity` tool
- All MCP activity tools
- Any activity execution via MCP

**Not Affected**:
- Direct API calls (work fine)
- Backend v2 endpoints (work fine)
- Database (works fine)

---

## Summary

| Component | Status | Issue |
|-----------|--------|-------|
| Backend API | ✅ Working | None |
| Database | ✅ Working | None |
| Template Registration | ✅ Working | None |
| **MCP Session Creation** | ❌ **BROKEN** | **No session token** |
| MCP Tools | ❌ Broken | Cannot auth with backend |
| OpenCode Activity Tool | ❌ Broken | MCP returns 0 results |

**Root Cause**: MCP server has empty session_token, cannot authenticate with v2 API

**Fix**: Initialize session on MCP server startup or lazy-create on first tool call

**Workaround**: Manually create session and save to state file

---

**Status**: Diagnosed  
**Next Action**: Implement session creation fix  
**Priority**: HIGH  
**Estimated Fix Time**: 1-2 hours
