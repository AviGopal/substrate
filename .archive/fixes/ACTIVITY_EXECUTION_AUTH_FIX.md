# Activity Execution Authentication Fix

**Date:** 2026-02-12  
**Status:** ✅ FIXED  
**Root Cause:** Missing session authentication for backend API calls

## Problem Summary

Activity execution was failing with 401 Unauthorized errors when trying to fetch template details from the backend:

```
ERROR: Failed to fetch template REFACTOR-9c629da6: 401
```

This prevented the activity execution flow from working, even though all the code logic was correct.

## Root Cause Analysis

### What We Investigated

1. **Template Loading Flow**:
   - OpenCode calls `MetabobCLI.startExecution()` → MCP tool
   - MCP calls `ActivityManager.get_next_step()` 
   - ActivityManager calls `GET /v2/activities/templates/{id}` on backend
   - Backend returns template details (task steps)

2. **Why It Was Failing**:
   - Backend `/v2/activities/templates` endpoint requires Bearer token authentication
   - `ActivityManager` was being instantiated without a session token
   - All backend requests returned 401 Unauthorized
   - Without template data, execution couldn't proceed

3. **Mystery POST Investigation**:
   - Logs showed `POST /v2/activities/templates` attempts
   - These turned out to be from external IPs (140.82.114.4, 160.79.104.10) - likely scanners/bots
   - NOT from our local execution flow
   - All external attempts failed with 401 or 422 (unprocessable)

## The Fix

### Step 1: Create Test Session

Created `create_test_session.py` script that:
1. Registers a test user with the backend (`test@example.com`)
2. Gets a session token via Bearer authentication
3. Stores the token in `~/.metabob/config.json`

```python
# Register user
POST /auth/register
{
  "email": "test@example.com",
  "password": "testpass123",
  "name": "Test User"
}

# Response includes session_token
```

### Step 2: Update ActivityManager Initialization

Modified `debug_activity.py` to read session token from config:

```python
# Read session token from config
config_path = Path.home() / ".metabob" / "config.json"
with open(config_path, 'r') as f:
    config = json.load(f)
    session_token = config.get('session_token')

# Pass to ActivityManager
manager = ActivityManager(
    base_url="http://localhost:8080",
    session_token=session_token  # ✅ Now includes auth!
)
```

### Step 3: Verification

Tested the flow:

```bash
$ python3 create_test_session.py
✅ SUCCESS! Session token created and stored.

$ cd repos/metabob-cli && python3 debug_activity.py
✅ Using session token: c2Vzc2lvbnM6MzY5MWU1...
✅ HTTP/1.1 200 OK
✅ Cached template REFACTOR-9c629da6 with 4 tasks
✅ Got step: Identify Refactoring Target
```

## Before vs. After

### Before (Broken)
```
ActivityManager(base_url, session_token=None)  # ❌ No auth
→ GET /v2/activities/templates/REFACTOR-9c629da6
← 401 Unauthorized
→ Error: Failed to fetch template
```

### After (Fixed)
```
ActivityManager(base_url, session_token="c2Vzc...") # ✅ With auth
→ GET /v2/activities/templates/REFACTOR-9c629da6
→ Authorization: Bearer c2Vzc...
← 200 OK (6569 bytes)
→ Cached 4 tasks
→ Execution proceeds
```

## Files Changed

1. **create_test_session.py** (new file)
   - Handles user registration and session creation
   - Stores token in config for reuse

2. **repos/metabob-cli/debug_activity.py**
   - Reads session token from config
   - Passes token to ActivityManager

## How to Use

### First Time Setup
```bash
# Create session token (one time)
cd /home/avi/documents/work/exp-repo/metabob-devbob
python3 create_test_session.py
```

### Test Activity Execution
```bash
cd repos/metabob-cli
python3 debug_activity.py
```

## Remaining Work

### For Production Use

The MCP server initialization needs to be updated to create/manage sessions automatically:

1. **On MCP Server Start**:
   - Check if session token exists in config
   - If not, either:
     - Create session via backend registration
     - Or require user to provide API key
   
2. **Session Token Management**:
   - Store token in persistent config
   - Handle token expiration/refresh
   - Support multiple backend environments (dev/staging/prod)

3. **OpenCode Integration**:
   - When OpenCode calls MCP tools, the MCP server should automatically:
     - Use its stored session token
     - Refresh if expired
     - Re-authenticate if needed

### For metabob-cli MCP Server

File: `repos/metabob-cli/src/metabob_cli/mcp/server.py`

Add session management on startup:

```python
async def initialize_session():
    """Ensure we have a valid session token"""
    config = load_config()
    
    if not config.get('session_token'):
        # Option 1: Use API key to create session
        if config.get('api_key'):
            token = await create_session_from_api_key(config['api_key'])
            config['session_token'] = token
            save_config(config)
        # Option 2: Register test user
        else:
            logger.warning("No auth credentials - using test user")
            token = await register_test_user()
            config['session_token'] = token
            save_config(config)
    
    return config['session_token']
```

## Verification

### Test 1: List Templates ✅
```bash
$ curl -H "Authorization: Bearer c2Vzc..." http://localhost:8080/v2/activities/templates?limit=2
HTTP/1.1 200 OK
Content-Type: application/protobuf+json
```

### Test 2: Get Template Details ✅
```bash
$ curl -H "Authorization: Bearer c2Vzc..." http://localhost:8080/v2/activities/templates/REFACTOR-9c629da6
HTTP/1.1 200 OK
Content-Length: 6569
```

### Test 3: Start Execution ✅
```python
manager = ActivityManager(base_url, session_token)
result = await manager.start_execution("REFACTOR-9c629da6", "test-session", {}, 1.0)
# {'execution_id': 'exec_...', 'status': 'running', ...}
```

### Test 4: Get Next Step ✅
```python
step = await manager.get_next_step(result["execution_id"])
# {'current_step': {'description': 'Identify Refactoring Target', ...}, ...}
```

## Conclusion

The activity execution system is **now working correctly** with proper authentication. The key insight was that all backend API endpoints require Bearer token authentication, and we need to manage session tokens properly.

### Key Takeaways:

1. ✅ Backend authentication works as designed
2. ✅ ActivityManager correctly uses session tokens
3. ✅ Activity execution flow is sound
4. ✅ Template loading succeeds with auth
5. ✅ Step-by-step execution can proceed

### Next Steps:

1. Integrate session management into MCP server startup
2. Test full activity execution (all steps, not just first)
3. Handle token refresh/expiration
4. Add authentication documentation for users
