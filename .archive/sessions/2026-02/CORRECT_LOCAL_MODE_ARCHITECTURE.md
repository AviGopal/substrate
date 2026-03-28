# Correct LOCAL Mode Architecture

## Date: February 13, 2026

## The Key Insight

**You're absolutely right!** In LOCAL mode, the architecture should be:

```
Browser
  ↓
metabob-cli MCP Server (SSE mode)
  ├── Serves: Dashboard UI (static files)
  ├── Provides: MCP API endpoints (/problems, /annotations, etc.)
  └── Gateway to: metabob-rpc-api backend (for V2 activities/learning data)
      ↓
metabob-rpc-api (V2 API Backend)
  ├── /v2/session
  ├── /v2/activities/*
  └── /v2/project/*
```

**NOT** (what we've been running):
```
Browser → Dashboard (standalone) → metabob-rpc-api (direct)
```

## What We've Been Doing Wrong

### Current Setup (INCORRECT)
1. Dashboard running standalone on port 3100 via `npm start`
2. Dashboard trying to call:
   - MCP endpoints directly (404 errors - no MCP server)
   - V2 API endpoints directly (401 errors - no session management)
3. No gateway layer - missing the MCP server!

### Correct Setup (SHOULD BE)
1. Start metabob-cli in **SSE mode** (HTTP server)
2. MCP server:
   - Serves dashboard static files
   - Provides MCP API endpoints
   - Acts as gateway to metabob-rpc-api
3. Dashboard calls MCP server, which proxies to backend

## MCP Server Capabilities

### HTTP Endpoints (When Running in SSE Mode)

From `repos/metabob-cli/src/metabob_cli/mcp/server.py`:

```python
@app.get("/problems")           # Code problems
@app.get("/annotations")        # Design decisions
@app.get("/components")         # Code components  
@app.get("/repository/state")   # Repo analysis state
@app.get("/resolutions")        # Problem resolutions
@app.get("/changes/recent")     # Recent file changes
@app.get("/files")              # File list
@app.get("/metrics")            # Code metrics
```

These are the endpoints the LocalRepositoryView component needs!

### Starting MCP Server in SSE Mode

```bash
cd repos/metabob-cli
metabob-cli mcp --transport sse --port 8001 --host 127.0.0.1

# Or with agent preset:
metabob-cli mcp --agent cursor  # Defaults to SSE mode
```

**Default Configuration**:
- Port: 8001
- Host: 127.0.0.1
- Transport: SSE (HTTP + Server-Sent Events)

## What Needs to Happen

### Step 1: Start MCP Server in SSE Mode

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli
metabob-cli mcp --transport sse --port 8001
```

This provides:
- MCP endpoints at http://localhost:8001/problems, etc.
- SSE transport for MCP protocol

### Step 2: Configure Dashboard for MCP Gateway

The dashboard needs to point to the MCP server, NOT directly to metabob-rpc-api.

**Current** `.env.local.development`:
```bash
REACT_APP_METABOB_BACKEND=http://localhost:8080  # ❌ Direct to backend
```

**Correct** `.env.local.development`:
```bash
REACT_APP_METABOB_BACKEND=http://localhost:8001  # ✅ Via MCP gateway
```

### Step 3: MCP Server as API Gateway

The MCP server needs to:
1. Serve its own endpoints (/problems, /repository/state, etc.)
2. **Proxy** V2 API calls to metabob-rpc-api backend

**Question**: Does the MCP server already proxy V2 calls to the backend?

Let me check...

### Step 4: Dashboard Build and Serve

The MCP server should either:
- **Option A**: Serve pre-built dashboard static files
- **Option B**: Run dashboard dev server and proxy requests

Current dashboard scripts:
```json
"start:local": "REACT_APP_DEPLOYMENT_MODE=local bun run react-scripts start"
"build:local": "REACT_APP_DEPLOYMENT_MODE=local bun run react-scripts build"
```

## Investigation Needed

### Question 1: Does MCP Server Proxy V2 API Calls?

Check if MCP server forwards calls like:
- `/v2/activities/executions` → `http://localhost:8080/v2/activities/executions`
- `/v2/session` → `http://localhost:8080/v2/session`

If not, we need to add proxy routes.

### Question 2: How Does MCP Serve Dashboard?

Does MCP server:
- Serve static files from `repos/metabob-dashboard/build`?
- Or expect dashboard to run separately?

The README says "Dashboard served by MCP" but I haven't found the code that does this yet.

### Question 3: Session Management

Who manages sessions in LOCAL mode?
- MCP server creates sessions with backend?
- Dashboard creates sessions directly?
- Sessions stored in MCP server memory?

## Next Steps

### Immediate Actions

1. **Start MCP Server in SSE Mode**:
   ```bash
   metabob-cli mcp --transport sse --port 8001
   ```

2. **Check MCP HTTP Endpoints**:
   ```bash
   curl http://localhost:8001/repository/state
   curl http://localhost:8001/problems
   ```

3. **Test V2 Proxy** (if it exists):
   ```bash
   curl http://localhost:8001/v2/activities/executions
   ```

4. **Configure Dashboard**:
   - Point to MCP server (port 8001)
   - Remove direct backend connection

5. **Build Dashboard**:
   ```bash
   cd repos/metabob-dashboard
   bun run build:local
   ```

6. **Check if MCP Serves Dashboard**:
   - Look for static file serving in MCP server code
   - Or configure MCP to serve from `build/` directory

### Code Investigation

1. Search for proxy/gateway logic in MCP server:
   ```bash
   grep -r "proxy\|forward\|backend" repos/metabob-cli/src/metabob_cli/mcp/
   ```

2. Search for static file serving:
   ```bash
   grep -r "static\|mount.*files\|StaticFiles" repos/metabob-cli/src/metabob_cli/mcp/
   ```

3. Search for backend URL configuration:
   ```bash
   grep -r "8080\|metabob-rpc-api\|BACKEND_URL" repos/metabob-cli/
   ```

## Expected Data Flow (Once Corrected)

```
1. Browser → http://localhost:8001/
   MCP serves dashboard HTML/JS/CSS

2. Dashboard loads → Calls MCP APIs
   - GET http://localhost:8001/repository/state
   - GET http://localhost:8001/problems
   - GET http://localhost:8001/annotations
   ✅ These work! MCP returns local analysis data

3. Dashboard → Learning view → Calls V2 APIs
   - GET http://localhost:8001/v2/activities/executions
   - MCP proxies to → http://localhost:8080/v2/activities/executions
   - Backend returns execution history
   - Dashboard displays Thompson Sampling metrics ✅

4. All data flows through MCP gateway
   - No direct backend calls
   - No authentication issues
   - Unified API surface
```

## Summary

**What We Learned**:
- ✅ V2 API backend works (tested directly)
- ✅ Database has real execution data
- ✅ Dashboard code is correct
- ❌ We've been running the wrong architecture!

**What We Need**:
- Start MCP server in SSE mode (HTTP server)
- Point dashboard to MCP server (not directly to backend)
- MCP server acts as API gateway for both MCP and V2 endpoints
- Dashboard gets served by MCP server

**Why This Matters**:
- Single entry point for all API calls
- MCP server can manage sessions/auth
- No CORS issues
- Proper LOCAL mode architecture

---

## Action Items

1. [ ] Start MCP server: `metabob-cli mcp --transport sse --port 8001`
2. [ ] Verify MCP endpoints work: `curl http://localhost:8001/problems`
3. [ ] Check if V2 proxy exists: `curl http://localhost:8001/v2/activities/executions`
4. [ ] If no proxy, add V2 forwarding to MCP server
5. [ ] Build dashboard: `bun run build:local`
6. [ ] Configure MCP to serve dashboard static files
7. [ ] Update dashboard env to point to MCP: `REACT_APP_METABOB_BACKEND=http://localhost:8001`
8. [ ] Test end-to-end: Browser → MCP → Backend → Dashboard displays data!
