# MCP Session Authentication Analysis

**Date:** 2026-02-11  
**Issue:** Understanding where/how MCP manages V2 sessions for activity templates

## Key Discovery

The MCP server **DOES support V2 authentication** but is currently using an **old anonymous V1 session**.

## Session Storage Location

**File:** `/workspace/.metabob/state`

**Current Session:**
```json
{
  "session_metadata": {
    "created_at": "2026-02-11T06:10:34.784689",
    "session_id": "c2Vzc2lvbnM6YW5vbnltb3VzOmRlZmF1bHQ6...",
    "session_token": "c2Vzc2lvbnM6YW5vbnltb3VzOmRlZmF1bHQ6...",
    "format_version": "4.0"
  }
}
```

**Token Decoded:** `sessions:anonymous:default:b844a7a1-286c-4664-aa75-a0db7602e124`

This is an **anonymous V1 session** (no authentication, project_id: "default").

## How MCP Authentication Should Work

### 1. Config File (`/workspace/.metabob/config.json`)

**Current Config:**
```json
{
  "base_url": "http://api-server-dev:8080",
  "api_key": "mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8"
}
```

**Problem:** No `project_id` field (ConfigData doesn't accept it)

### 2. Session Manager (`session_manager.py`)

**Code Flow:**
```python
async def _create_session(self):
    """Create new session with server."""
    
    # Build v2 request
    v2_headers = {"X-API-Key": self.api_key}
    v2_data = {"project_id": "default"}  # ❌ HARDCODED!
    
    # POST /v2/session
    response = await post("/v2/session", headers=v2_headers, json=v2_data)
    
    # Extract session_token
    session_token = response["metadata"]["session_token"]
    
    # Save to state
    self.file_state_manager.set_session_token(session_token)
```

**Problem:** `project_id` is hardcoded as "default" instead of reading from config

### 3. Activity Manager (`activity_manager.py`)

**Code Flow:**
```python
async def search_activities(self):
    """Search activities using V2 API."""
    
    config = get_config_manager()
    base_url = config.get("base_url")
    session_token = config.get("session_token", "")  # ❌ Gets from config, not state!
    
    manager = ActivityManager(base_url, session_token)
    
    # Make request
    client = await _get_client()  # Uses self._session_token
    response = await client.get("/v2/activities/templates")
```

**Problem:** Reads `session_token` from config.json, but it's not stored there - it's in state file!

## The Disconnect

### What's Configured
| Location | Field | Value |
|----------|-------|-------|
| `/workspace/.metabob/config.json` | `api_key` | `mb_uYl7DfW...` ✅ |
| `/workspace/.metabob/config.json` | `session_token` | ❌ NOT SET |
| `/workspace/.metabob/config.json` | `project_id` | ❌ NOT SUPPORTED |

### What's in State
| Location | Field | Value |
|----------|-------|-------|
| `/workspace/.metabob/state` | `session_token` | `c2Vzc2lvbnM6YW5vbnltb3VzOmRlZmF1bHQ6...` |
| `/workspace/.metabob/state` | `session_id` | (same) |

### What Activity Manager Expects
```python
# From get_config_manager()
session_token = config.get("session_token", "")

# If session_token is empty string, ActivityManager makes UNAUTHENTICATED requests!
```

## Root Causes

### 1. Session Token Location Mismatch
- **Session Manager** stores token in `/workspace/.metabob/state`
- **Activity Manager** reads token from `config.get("session_token")`
- **Config file** doesn't have `session_token` field
- **Result:** Activity Manager uses empty string → unauthenticated requests

### 2. Project ID Hardcoding
- Session Manager uses `project_id: "default"` (hardcoded)
- Should use config value or environment variable
- Even if session is created, it's for wrong project

### 3. Lazy Session Creation
- Session Manager only creates sessions when needed
- MCP server starts without creating a session
- First API call triggers session creation
- But by then, Activity Manager already has empty token

## What Works vs What Doesn't

### ✅ Works: Direct API Calls
```bash
# Create session
SESSION=$(curl -X POST http://api-server-dev:8080/v2/session \
  -H "X-API-Key: $API_KEY" \
  -d '{"project_id": "exp-repo-dev"}')

TOKEN=$(echo "$SESSION" | jq -r '.metadata.session_token')

# Search activities  
curl -X GET http://api-server-dev:8080/v2/activities/templates \
  -H "Authorization: Bearer $TOKEN"
# Returns: 4 templates ✅
```

### ❌ Doesn't Work: MCP Tools
```python
# Agent uses MCP tool
result = await tools.search_activities(category="feature")

# Activity Manager gets empty session_token from config
# Makes request without Authorization header
# Backend rejects: 401 Unauthorized ❌
```

## Solutions

### Option A: Fix Config/State Integration (Proper Fix)

**Changes Needed:**

1. **Update `session_manager.py`:**
```python
async def _create_session(self):
    # Read project_id from environment or config
    project_id = os.getenv("METABOB_PROJECT_ID", "default")
    v2_data = {"project_id": project_id}  # Not hardcoded
```

2. **Update `activity_manager.py`:**
```python
async def search_activities(self):
    config = get_config_manager()
    
    # Try config first, then state file
    session_token = config.get("session_token")
    if not session_token:
        # Read from state file
        state = load_state()
        session_token = state.get("session_metadata", {}).get("session_token", "")
```

3. **Update `config.json`:**
```json
{
  "api_key": "mb_uYl7DfW...",
  "session_token": ""  // Will be populated by session manager
}
```

4. **Create session on MCP startup:**
```python
# In mcp/server.py or app.py
async def startup():
    session_mgr = SessionManager()
    await session_mgr._ensure_session()  # Force session creation
```

### Option B: Use Environment Variables (Quick Fix)

**Changes Needed:**

1. **Set environment variables in container:**
```bash
export METABOB_API_KEY="mb_uYl7DfW..."
export METABOB_PROJECT_ID="exp-repo-dev"
export METABOB_SESSION_TOKEN=""  # Empty = will create
```

2. **Update Activity Manager to check env:**
```python
def get_session_token():
    return (
        os.getenv("METABOB_SESSION_TOKEN") or
        config.get("session_token") or
        state.get("session_metadata", {}).get("session_token") or
        ""
    )
```

### Option C: Manual Session Creation (Immediate Workaround)

**Steps:**

1. **Create V2 session manually:**
```bash
docker exec devbob-opencode python3 -c "
import asyncio
from metabob_cli.core.session_manager import SessionManager

async def create_session():
    mgr = SessionManager(api_key='mb_uYl7DfW...', config=...)
    await mgr._ensure_session()
    print('Session created')

asyncio.run(create_session())
"
```

2. **Update config.json with token:**
```bash
docker exec devbob-opencode python3 -c "
import json
state = json.load(open('/workspace/.metabob/state'))
token = state['session_metadata']['session_token']

config = json.load(open('/workspace/.metabob/config.json'))
config['session_token'] = token
json.dump(config, open('/workspace/.metabob/config.json', 'w'), indent=2)
"
```

3. **Restart MCP server**

## Recommended Fix (Priority Order)

1. **HIGH:** Fix `activity_manager.py` to read from state file (not just config)
2. **HIGH:** Fix `session_manager.py` to use env var for project_id
3. **MEDIUM:** Add session creation to MCP startup
4. **LOW:** Update ConfigData to accept project_id field

## Testing After Fix

```python
# In devbob-opencode container
# Test 1: Check session is created with correct project
docker exec devbob-opencode cat /workspace/.metabob/state | \
  jq -r '.session_metadata.session_token' | \
  base64 -d

# Should show: sessions:62a4d853-4673-4450-b17e-4521f96e5c0e:exp-repo-dev:...
# NOT: sessions:anonymous:default:...

# Test 2: Use search_activities MCP tool
# Should return 4 templates (not 401 error)

# Test 3: Register new template via MCP
# Should succeed with new variant_id
```

## Conclusion

**The V2 system is fully functional.** The issue is NOT with V2 APIs or backend - it's a **configuration/integration issue** in how the MCP server manages sessions.

**Quick Summary:**
- ✅ V2 API works perfectly
- ✅ Authentication works perfectly
- ✅ Session Manager has V2 support
- ❌ Activity Manager doesn't find the session token
- ❌ Project ID is hardcoded
- ❌ Session creation is lazy (not proactive)

**Impact:**
- Agent cannot use MCP tools for activities (401 errors)
- Direct API calls work fine (proven)
- Once session integration is fixed, everything will work

**Estimated Fix Time:** 30-60 minutes

**Files to Modify:**
1. `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py` - Read from state file
2. `repos/metabob-cli/src/metabob_cli/core/session_manager.py` - Use env var for project_id
3. `repos/metabob-cli/src/metabob_cli/mcp/app.py` or `server.py` - Create session on startup

---

**Bottom Line:** We have all the pieces. They just need to be connected properly.
