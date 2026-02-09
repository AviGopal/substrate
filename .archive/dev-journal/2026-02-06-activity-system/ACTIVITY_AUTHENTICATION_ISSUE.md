# Activity System Authentication Issue

## Problem Summary

When running OpenCode in development mode (`bun run dev ../.`), **activities cannot run** because the backend API requires authentication, but no authentication credentials are configured for local development.

## System Status

### ✅ Working Components

1. **Backend API** - Running on http://localhost:8080
   ```bash
   $ curl http://localhost:8080/
   {"status":"ok","timestamp":"2026-02-07T23:37:15.809217","version":"0.16.0"}
   ```

2. **MCP Server** - metabob-cli MCP running (2 processes)
   ```bash
   $ ps aux | grep "metabob-cli mcp"
   avi  784132  /home/avi/.pyenv/versions/3.13.2/bin/python3.13 .../metabob-cli mcp --transport stdio
   ```

3. **MCP Tools** - 26 tools available including:
   - `search_activities`
   - `get_activity`
   - `start_activity_execution`
   - `get_next_step`
   - etc.

4. **OpenCode Configuration** - Properly configured
   - Model: `anthropic/claude-sonnet-4-5`
   - Metabob enabled: `true`
   - Metabob URL: `http://localhost:8080`
   - MCP enabled: `true`

### ❌ Failing Components

1. **Backend Activity Endpoints** - Require authentication
   ```bash
   $ curl http://localhost:8080/activities?limit=5
   {"error":"Authorization is invalid"}
   ```

2. **Activity Execution** - Cannot query activities from backend

## Root Cause

The backend has **3 authentication methods** defined:

### File: `repos/metabob-rpc-api/server/routes/activities.py`

```python
async def get_user_or_api_key_or_internal(
    request: Request,
    db: SurrealDBClient,
) -> UserData | ApiKeyData | dict:
    """
    Try API key auth first, then session auth, then allow internal requests.

    For devbob multi-agent environment, we need to support:
    1. API key auth (X-API-Key header) - for authenticated MCP/CLI
    2. Session auth (Authorization: Bearer) - for dashboard
    3. Internal requests (X-Internal-Request header) - for agent-to-agent
    """
    # Check for internal request header (agent-to-agent communication)
    internal_header = request.headers.get("X-Internal-Request")
    if internal_header == "true":
        project_id = request.headers.get("X-Project-ID", "devbob-internal")
        logger.debug(f"Activity auth via internal request (project: {project_id})")
        return {"type": "internal", "project_id": project_id, "org_id": "devbob-org"}
    
    # ... try API key and session auth ...
    
    # No valid auth found
    raise HTTPException(
        status_code=401,
        detail="Authentication required. Provide X-API-Key header, session token, or X-Internal-Request: true",
    )
```

**BUT**, the `list_activities` endpoint does NOT use this function:

```python
@router.get("/activities", response_model=ActivityListResponse)
async def list_activities(
    ...
    user: UserData = Depends(get_current_user),  # ← ALWAYS requires session!
    db: SurrealDBClient = Depends(get_surreal_connection),
):
```

`get_current_user` **only** supports session-based auth, not internal requests or API keys.

## Why This Breaks Activities

When OpenCode's activity tool tries to:
1. Search for activities via backend API
2. Execute activities via backend API  
3. Query activity templates from backend

It gets **401 Unauthorized** because:
- No session token is configured
- No API key is configured
- Internal request header is not supported by the endpoint

## Solutions

### Option 1: Add API Key Authentication (Recommended)

Create an API key and configure it in OpenCode:

```bash
# 1. Create API key (need to implement this endpoint or use dashboard)
curl -X POST http://localhost:8080/auth/api-keys \
  -H "Authorization: Bearer <session>" \
  -d '{"name": "local-dev", "project_id": "exp-repo-dev"}'

# 2. Configure in opencode.json
{
  "metabob": {
    "api_key": "generated-key-here"
  }
}
```

### Option 2: Fix Backend Route (Quick Fix for Dev)

Change the `list_activities` endpoint to support internal requests:

```python
# File: repos/metabob-rpc-api/server/routes/activities.py
@router.get("/activities", response_model=ActivityListResponse)
async def list_activities(
    request: Request,  # Add Request parameter
    project_id: str | None = Query(None),
    org_id: str | None = Query(None),
    activity_type: str | None = Query(None),
    user_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: SurrealDBClient = Depends(get_surreal_connection),
):
    """Get activities with optional filtering."""
    # Use the flexible auth function
    auth = await get_user_or_api_key_or_internal(request, db)
    
    # Extract user data from auth (handle all 3 types)
    if isinstance(auth, UserData):
        user_org_id = auth.org_id
    elif isinstance(auth, ApiKeyData):
        user_org_id = auth.org_id
    elif isinstance(auth, dict):
        user_org_id = auth.get("org_id", "devbob-org")
    
    # ... rest of endpoint logic ...
```

### Option 3: Use MCP Tools Directly (Current Workaround)

The MCP tools bypass the REST API authentication. Activities can work if they use MCP tools:

```typescript
// Instead of HTTP GET /activities
// Use MCP tool
const results = await mcpClient.callTool("search_activities", {
  query: "feature implementation",
  category: "feature-impl"
});
```

### Option 4: Add Session Creation for Dev Mode

Create a development session automatically:

```bash
# Add to ./devbob config init or startup
curl -X POST http://localhost:8080/auth/dev-session \
  -d '{"project_id": "exp-repo-dev", "org_id": "devbob-org"}'
```

Store the session token and configure OpenCode to use it.

## Recommended Action Plan

**Immediate (Today):**
1. Implement Option 2 (fix backend route) to unblock activity development
2. Test with: `curl -H "X-Internal-Request: true" -H "X-Project-ID: exp-repo-dev" http://localhost:8080/activities?limit=5`

**Short-term (This Week):**
1. Add API key generation endpoint to backend
2. Update `./devbob config init` to generate and configure API key
3. Update OpenCode to send `X-API-Key` header when `metabob.api_key` is configured

**Long-term (Next Sprint):**
1. Add automatic session creation for dev mode (detected via environment)
2. Document authentication setup in README
3. Add health check that validates auth is configured

## Files to Modify

1. **Backend Route (Option 2)**
   - `repos/metabob-rpc-api/server/routes/activities.py` - Line 198 (list_activities)
   - `repos/metabob-rpc-api/server/routes/proto_activities.py` - Multiple endpoints

2. **Config Script (Option 4)**
   - `./devbob` - cmd_config function
   - Add API key generation or session creation

3. **OpenCode HTTP Client (Option 1)**
   - `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
   - Add header injection based on config

## Testing Commands

```bash
# Test backend is running
curl http://localhost:8080/

# Test current auth (should fail)
curl http://localhost:8080/activities?limit=5

# Test internal request auth (will work after Option 2)
curl -H "X-Internal-Request: true" \
     -H "X-Project-ID: exp-repo-dev" \
     http://localhost:8080/activities?limit=5

# Test MCP tools (should work now)
cd repos/metabob-opencode && bun run dev ../.. --prompt "search for feature activities"
```

## Next Steps

**Choose one solution and implement it.** Option 2 is fastest for unblocking development, but Option 1 is the proper long-term solution.

Would you like me to implement Option 2 (backend route fix) to get activities working immediately?
