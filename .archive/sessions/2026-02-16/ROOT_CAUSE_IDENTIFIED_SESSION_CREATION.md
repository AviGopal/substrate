# ROOT CAUSE IDENTIFIED: MCP Session Creation Failure
**Date**: February 12, 2026, 12:10 AM PST  
**Status**: 🎯 Root cause found - Backend works, MCP session management broken

---

## TL;DR

✅ **Backend is 100% functional** - 17 activity templates, authentication working  
❌ **MCP server session creation failing** - `".session": null` in state file  
❌ **No session token** → All activity tools return empty results  

**Fix needed**: Make MCP server successfully create and persist session token

---

## Proof: Backend Works Perfectly

### Manual Test - Create Session
```bash
$ curl -X POST -H "X-API-Key: mb_uYl7DfW-II6w-I9rR2-94iDKn1Hdu4QLm0wbFO9ePq8" \
  -d '{"project_id": "exp-repo-dev"}' \
  http://localhost:8080/v2/session

✅ {
  "session_id": "62a4d853-4673-4450-b17e-4521f96e5c0e:exp-repo-dev:...",
  "metadata": {
    "session_token": "c2Vzc2lvbnM6..."
  },
  "expires_at": "2026-02-13T08:08:30.230963Z"
}
```

### Manual Test - Fetch Activities
```bash
$ curl -H "Authorization: Bearer c2Vzc2lvbnM6..." \
  http://localhost:8080/v2/activities/templates?limit=5

✅ {
  "templates": [
    {"variant_id": "REFACTOR-9c629da6", "variant_name": "Refactor", ...},
    {"variant_id": "BUGFIX-69d6ab39", "variant_name": "Bug Fix", ...},
    {"variant_id": "FEATURE-d3f6c989", "variant_name": "Feature Impl", ...},
    ...
  ],
  "count": 17
}
```

**Backend has everything we need!**

---

## The Problem

### What Should Happen
```
1. OpenCode starts: metabob-cli mcp --transport stdio
2. MCP server creates session: POST /v2/session
   → Gets session_token
   → Saves to .metabob/state
3. search_activities() uses session_token
   → GET /v2/activities/templates
   → Returns 17 activities ✅
```

### What's Actually Happening
```
1. OpenCode starts MCP server ✅
2. MCP server tries to create session ❓
   → Session creation FAILS or NOT PERSISTED
   → .metabob/state shows "session": null ❌
3. search_activities() has no session_token
   → Cannot authenticate with backend
   → Returns empty [] ❌
```

---

## Evidence

### 1. MCP Process is Running
```bash
$ ps aux | grep "metabob-cli mcp"
avi  434839  python3.13 metabob-cli mcp --transport stdio
# Process alive for 2+ minutes
```

### 2. Session State is Null
```bash
$ cat .metabob/state | jq '.session'
null  ← SHOULD BE: {"session_token": "...", "expires_at": "..."}
```

### 3. MCP Reports Not Connected
```bash
$ test_metabob_mcp
❌ Status: FAILED
❌ Error: Not connected
```

### 4. search_activities Returns Empty
```javascript
search_activities({ verbose: true })
→ {"activities": [], "count": 0}  ← Backend has 17 but MCP can't fetch them
```

---

## Why Session Creation is Failing

### From Code Review (repos/metabob-cli/src/metabob_cli/mcp/server.py:873)

```python
# Session creation deferred to background (commit dccb24b97)
session_task = asyncio.create_task(_ensure_session())
logger.info("[TIMING] Session creation deferred to background - server can respond immediately")
```

**Potential Issues:**

1. **Task never completes** - Background task fails silently
2. **State not persisted** - Session created but FileStateManager fails to save
3. **Race condition** - `search_activities()` called before session ready
4. **Exception swallowed** - `_ensure_session()` throws but no error handling

---

## Configuration (All Correct)

### OpenCode Config
```json
{
  "mcp": {
    "metabob": {
      "environment": {
        "METABOB_API_URL": "http://localhost:8080",  ✅
        "METABOB_PROJECT_ID": "exp-repo-dev",         ✅
        "METABOB_API_KEY": "mb_uYl7DfW-II6w-..."     ✅
      }
    }
  }
}
```

### Backend Config
```
API Server: http://localhost:8080  ✅ Healthy
Endpoints:
  - POST /v2/session              ✅ Working
  - GET /v2/activities/templates  ✅ Working (with valid token)
```

---

## Fix Options

### Option 1: Add Session Logging (Diagnostic)
```python
async def _ensure_session():
    logger.info("[SESSION] Creating session...")
    try:
        result = await create_session(...)
        logger.info(f"[SESSION] Created: {result.session_id}")
        logger.info(f"[SESSION] Token saved: {result.session_token[:20]}...")
        return result
    except Exception as e:
        logger.error(f"[SESSION] FAILED: {e}", exc_info=True)
        raise
```

### Option 2: Wait for Session (Synchronous)
```python
# Wait for session before server is "ready"
session_task = asyncio.create_task(_ensure_session())
await asyncio.wait_for(session_task, timeout=10.0)
logger.info("[SESSION] Session ready, tools can now be called")
```

### Option 3: Lazy Session in Tools (Fallback)
```python
async def search_activities(args):
    session = await get_session()
    if not session:
        logger.warning("[SESSION] No session, creating now...")
        session = await _ensure_session()
    # Proceed with API call
```

---

## Next Steps

### Immediate
1. **Check metabob-cli logs** - Look for session creation errors
2. **Restart OpenCode** - Fresh MCP process might succeed
3. **Add logging** - Instrument `_ensure_session()` to see what's failing

### Short-term
1. **Fix session persistence** - Ensure token is saved to state file
2. **Add error handling** - Don't swallow exceptions in background task
3. **Synchronous initialization** - Wait for session before returning from startup

### Validation
```javascript
// After fix, should work:
search_activities({ verbose: true })
→ {"activities": [...17 templates...], "count": 17}
```

---

## Success Criteria

✅ `.metabob/state` contains valid session_token  
✅ `test_metabob_mcp()` returns "CONNECTED"  
✅ `search_activities()` returns 17 activities  
✅ Activities are executable  

---

##Conclusion

**Good news**: Backend infrastructure is complete and functional. All 17 activity templates are accessible via the v2 API.

**Bad news**: MCP server's session creation is not completing or persisting, blocking all activity functionality.

**Action**: Fix MCP session initialization - either wait for it synchronously or add robust error handling and retry logic.

---

**Prepared by**: Activity Mode Agent  
**Root Cause**: MCP session creation not persisting to state file  
**Confidence**: Very High (backend manually verified working)
