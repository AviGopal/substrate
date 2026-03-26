# MCP Communication Flow Guide

## Architecture Overview

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐         ┌───────────┐
│  OpenCode   │ stdio   │  metabob-cli MCP │  HTTP   │ metabob-rpc-api │ Query   │ SurrealDB │
│  (Claude)   │────────▶│     Server       │────────▶│   (FastAPI)     │────────▶│           │
└─────────────┘ JSONRPC └──────────────────┘ REST    └─────────────────┘         └───────────┘
                                    ▲                           │
                                    │                           │
                                    └───────────────────────────┘
                                         Response flows back
```

## Complete Communication Flow

### 1. Session Initialization (Authentication)

**Request:**
```bash
POST http://api.metabob.local:8080/session
Content-Type: application/json
```

**Response:**
```json
{
  "session": "c2Vzc2lvbnMuY2YwNjQ5ZWEtMjgzMy00ZmY0LTk4ZTYtMzkxMjRhNGNmZjk3"
}
```

**Log Entry:**
```
INFO:     127.0.0.1:39166 - "POST /session HTTP/1.1" 200 OK
```

**What happens:**
- metabob-cli creates a session with rpc-api
- Session token is stored and used for all subsequent requests
- Token is base64-encoded Redis key pointing to session data

---

### 2. Activity Template Search (MCP Tool Call)

**MCP Tool:** `search_activities({})`

**Internal HTTP Request:**
```bash
GET http://api.metabob.local:8080/v2/activities/templates
Authorization: Bearer c2Vzc2lvbnMuY2YwNjQ5ZWEtMjgzMy00ZmY0LTk4ZTYtMzkxMjRhNGNmZjk3
```

**Response:**
```json
{
  "templates": [
    {
      "id": "add-feature-complete",
      "name": "Add Feature (Complete)",
      "category": "feature",
      "success_rate": 0.95,
      "avg_duration_ms": 45000
    }
  ]
}
```

**Log Entry:**
```
INFO:     127.0.0.1:39186 - "GET /v2/activities/templates HTTP/1.1" 200 OK
```

**Code Flow:**
1. OpenCode calls `search_activities({})`
2. MCP server receives JSONRPC request via stdio
3. `activity_template_tools.py` executes
4. Calls `api_client.call_api("GET", "/v2/activities/templates")`
5. HTTP request sent to rpc-api with Bearer token
6. rpc-api queries SurrealDB for templates
7. Response flows back through the chain

---

### 3. Activity Execution (Job Submission)

**MCP Tool:** `activity({ templateId: "add-feature", variables: {...} })`

**Internal HTTP Requests:**
```bash
# 1. Submit job
POST http://api.metabob.local:8080/v2/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "template_id": "add-feature-complete",
  "variables": { "featureName": "user-auth" }
}

# 2. WebSocket connection for real-time updates
WS ws://api.metabob.local:8080/ws/job?token=<job_token>
```

**Log Entries:**
```
INFO:     10.1.1.24:60972 - "POST /v2/submit HTTP/1.1" 200 OK
INFO:     ('10.1.1.24', 60972) - "WebSocket /ws/job?token=..." [accepted]
2026-03-03 19:02:13,361 INFO routes WebSocket connected for session aff583f7-aa78-47b1-b996-76473d3e7282
2026-03-03 19:02:13,363 INFO routes Session aff583f7-aa78-47b1-b996-76473d3e7282 subscribed to job cd7de8dd-bdbe-4809-b700-fdaacebbcbb6
```

---

### 4. Health Checks (Background)

**Request:**
```bash
GET http://api.metabob.local:8080/
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-03T19:05:39.626077",
  "version": "0.16.4"
}
```

**Log Entry:**
```
INFO:     127.0.0.1:39216 - "GET / HTTP/1.1" 200 OK
```

**Note:** Health checks don't require authentication

---

## Expected Log Patterns

When using metabob-cli MCP tools with your k8s deployment, you should see these patterns:

### Initial Connection
```
INFO:     10.1.1.24:xxxxx - "POST /session HTTP/1.1" 200 OK
```

### Template Operations
```
INFO:     10.1.1.24:xxxxx - "GET /v2/activities/templates HTTP/1.1" 200 OK
INFO:     10.1.1.24:xxxxx - "GET /v2/activities/templates/add-feature-complete HTTP/1.1" 200 OK
INFO:     10.1.1.24:xxxxx - "POST /v2/activities/templates HTTP/1.1" 200 OK
```

### Activity Execution
```
INFO:     10.1.1.24:xxxxx - "POST /v2/submit HTTP/1.1" 200 OK
INFO:     ('10.1.1.24', xxxxx) - "WebSocket /ws/job?token=..." [accepted]
2026-03-03 XX:XX:XX,XXX INFO routes WebSocket connected for session <session_id>
2026-03-03 XX:XX:XX,XXX INFO routes Session <session_id> subscribed to job <job_id>
```

### Session Management
```
INFO:     10.1.1.24:xxxxx - "GET /session HTTP/1.1" 200 OK
INFO:     10.1.1.24:xxxxx - "DELETE /session HTTP/1.1" 200 OK
```

### Background Health Checks
```
INFO:     10.1.0.1:xxxxx - "GET / HTTP/1.1" 200 OK  # Kubernetes liveness probe
INFO:     127.0.0.1:xxxxx - "GET /metrics HTTP/1.1" 200 OK  # Prometheus metrics
```

---

## IP Address Interpretation

From the logs, you'll see different source IPs:

- **10.1.1.24**: External requests (from metabob-cli on your host machine)
- **10.1.0.1**: Kubernetes internal (health checks, ingress controller)
- **127.0.0.1**: Localhost (internal metrics, local testing)

---

## metabob-cli MCP Server Details

### Location
```
repos/metabob-cli/src/metabob_cli/mcp/
```

### Key Files
- **server.py**: Main MCP server (stdio JSONRPC handler)
- **api_client.py**: HTTP client for rpc-api communication
- **activity_template_tools.py**: MCP tools for activity templates
- **activity_tools.py**: MCP tools for activity execution
- **tools.py**: Main MCP tool definitions

### Configuration

The MCP server uses environment variables:

```bash
export METABOB_RPC_API_URL="http://api.metabob.local:8080"
```

**Default:** `http://localhost:8080`

### How metabob-cli MCP is Used

1. **OpenCode Configuration**: Projects using metabob-cli configure it as an MCP server in `.opencode/opencode.json` (or via system-wide config)

2. **Auto-start**: When OpenCode detects the configuration, it spawns the MCP server as a subprocess

3. **Communication**: OpenCode sends JSONRPC messages over stdio, MCP server translates to HTTP REST calls to rpc-api

---

## Testing the Flow

### 1. Direct HTTP Test (No MCP)
```bash
# Create session
SESSION=$(curl -s -X POST http://api.metabob.local:8080/session | jq -r '.session')

# Query templates
curl -X GET http://api.metabob.local:8080/v2/activities/templates \
  -H "Authorization: Bearer $SESSION" | jq
```

### 2. Watch Logs in Real-Time
```bash
kubectl logs -n metabob -f metabob-rpc-api-76bff4cbcf-wf8lf | \
  grep -E '(POST|GET|WebSocket|/v2)'
```

### 3. Test MCP Tools (from OpenCode)

**Note:** MCP tools are available when metabob-cli is configured as an MCP server in your OpenCode project.

Currently, this OpenCode session is **not** configured with metabob-cli MCP. The available MCP-integrated activity tools (like `search_activities`) in this session connect to a different backend (Metabob platform MCP, not metabob-cli).

---

## Summary: What We Demonstrated

✅ **Architecture**: Understood the full flow from metabob-cli → rpc-api → SurrealDB

✅ **Authentication**: Session creation via `POST /session` returns Bearer token

✅ **API Calls**: Template queries use Bearer token authentication

✅ **Log Patterns**: Identified what to look for in rpc-api logs

✅ **Live Testing**: Successfully simulated MCP tool behavior with direct HTTP calls

✅ **IP Addresses**: 10.1.1.24 (external), 10.1.0.1 (k8s internal), 127.0.0.1 (localhost)

---

## Next Steps

To see actual metabob-cli MCP communication in the logs:

1. **Configure a project** to use metabob-cli as MCP server
2. **Set environment variable**: `export METABOB_RPC_API_URL="http://api.metabob.local:8080"`
3. **Use MCP tools** from that project (they'll connect to your k8s rpc-api)
4. **Watch logs** to see the HTTP requests appear in real-time

The demonstration above shows exactly what those HTTP requests will look like!
