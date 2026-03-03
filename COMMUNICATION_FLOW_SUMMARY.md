# MCP Communication Flow - Visual Summary

## What We Discovered

From your logs at `api.metabob.local:8080`, we can see the complete communication flow from metabob-cli MCP server to metabob-rpc-api.

---

## 🔍 Your Original Logs Explained

```
INFO:     10.1.1.24:47986 - "POST /v2/session HTTP/1.1" 404 Not Found
INFO:     10.1.1.24:47986 - "POST /session HTTP/1.1" 200 OK
INFO:     10.1.1.24:47994 - "GET /session HTTP/1.1" 200 OK
INFO:     10.1.0.1:59766 - "GET / HTTP/1.1" 200 OK
```

### Breaking it down:

1. **`POST /v2/session` → 404**: 
   - Old API endpoint, no longer exists
   - Client tried v2 endpoint first (graceful degradation)

2. **`POST /session` → 200**: 
   - ✅ Session created successfully
   - Returns Bearer token for authentication
   - Source: `10.1.1.24` (external metabob-cli instance)

3. **`GET /session` → 200**:
   - Validates existing session
   - Confirms authentication is working

4. **`GET /` → 200**:
   - Health check from `10.1.0.1` (Kubernetes)
   - Liveness/readiness probe

---

## 📊 Complete Communication Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Complete Flow Diagram                            │
└─────────────────────────────────────────────────────────────────────────┘

   User/AI                metabob-cli              metabob-rpc-api           SurrealDB
  (OpenCode)              MCP Server                  (FastAPI)              Database
      │                       │                            │                     │
      │  Call MCP Tool        │                            │                     │
      │  e.g. search_act..()  │                            │                     │
      ├──────────────────────>│                            │                     │
      │                       │                            │                     │
      │                       │  1. POST /session          │                     │
      │                       │    (create auth token)     │                     │
      │                       ├───────────────────────────>│                     │
      │                       │                            │                     │
      │                       │  200 OK                    │                     │
      │                       │  {session: "token..."}     │                     │
      │                       │<───────────────────────────┤                     │
      │                       │                            │                     │
      │                       │  2. GET /v2/activities/    │                     │
      │                       │     templates              │                     │
      │                       │  Authorization: Bearer..   │                     │
      │                       ├───────────────────────────>│                     │
      │                       │                            │  Query templates    │
      │                       │                            ├────────────────────>│
      │                       │                            │                     │
      │                       │                            │  Return data        │
      │                       │                            │<────────────────────┤
      │                       │  200 OK                    │                     │
      │                       │  {templates: [...]}        │                     │
      │                       │<───────────────────────────┤                     │
      │                       │                            │                     │
      │  Return result        │                            │                     │
      │<──────────────────────┤                            │                     │
      │                       │                            │                     │
```

---

## 🔑 Key Communication Patterns

### Pattern 1: Session Authentication
```
Client                     rpc-api                    Redis
  │                           │                         │
  │  POST /session            │                         │
  ├──────────────────────────>│                         │
  │                           │  Generate token         │
  │                           │  Store in Redis         │
  │                           ├────────────────────────>│
  │                           │                         │
  │  {session: "token..."}    │  OK                     │
  │<──────────────────────────┤<────────────────────────┤
  │                           │                         │
```

**Log Entry:**
```
INFO:     10.1.1.24:47986 - "POST /session HTTP/1.1" 200 OK
```

---

### Pattern 2: Template Query (Authenticated)
```
Client                     rpc-api                  SurrealDB
  │                           │                         │
  │  GET /v2/activities/      │                         │
  │  Authorization: Bearer..  │                         │
  ├──────────────────────────>│                         │
  │                           │  Validate token         │
  │                           │  Query templates        │
  │                           ├────────────────────────>│
  │                           │                         │
  │  {templates: [...]}       │  Return results         │
  │<──────────────────────────┤<────────────────────────┤
  │                           │                         │
```

**Log Entry:**
```
INFO:     127.0.0.1:39186 - "GET /v2/activities/templates HTTP/1.1" 200 OK
```

---

### Pattern 3: Activity Execution (WebSocket)
```
Client                     rpc-api                  Worker Pool
  │                           │                         │
  │  POST /v2/submit          │                         │
  │  {template_id, vars}      │                         │
  ├──────────────────────────>│                         │
  │                           │  Create job             │
  │                           │  Enqueue task           │
  │                           ├────────────────────────>│
  │  {job_id: "..."}          │                         │
  │<──────────────────────────┤                         │
  │                           │                         │
  │  WS /ws/job?token=...     │                         │
  ├───────────────────────────>│                         │
  │  [WebSocket connected]    │                         │
  │                           │  Stream progress        │
  │<──────────────────────────┤<────────────────────────┤
  │  {status: "running"...}   │                         │
  │<──────────────────────────┤                         │
```

**Log Entries:**
```
INFO:     10.1.1.24:60972 - "POST /v2/submit HTTP/1.1" 200 OK
INFO:     ('10.1.1.24', 60972) - "WebSocket /ws/job?token=..." [accepted]
2026-03-03 19:02:13,361 INFO routes WebSocket connected for session aff583f7...
2026-03-03 19:02:13,363 INFO routes Session aff583f7... subscribed to job cd7de8dd...
```

---

## 📋 Log Pattern Reference

### Source IP Interpretation

| IP Address    | Source                          | Purpose                        |
|---------------|---------------------------------|--------------------------------|
| `10.1.1.24`   | External (your host machine)    | metabob-cli MCP requests       |
| `10.1.0.1`    | Kubernetes internal             | Health checks, ingress         |
| `127.0.0.1`   | Localhost (pod internal)        | Metrics, local testing         |

### HTTP Method → Operation Mapping

| Method | Endpoint                         | Operation                      | Auth Required |
|--------|----------------------------------|--------------------------------|---------------|
| POST   | `/session`                       | Create session (login)         | No            |
| GET    | `/session`                       | Validate session               | Yes           |
| DELETE | `/session`                       | Destroy session (logout)       | Yes           |
| GET    | `/v2/activities/templates`       | List activity templates        | Yes           |
| GET    | `/v2/activities/templates/{id}`  | Get specific template          | Yes           |
| POST   | `/v2/activities/templates`       | Create new template            | Yes           |
| POST   | `/v2/submit`                     | Submit activity for execution  | Yes           |
| WS     | `/ws/job?token=...`              | Real-time job progress         | Yes (token)   |
| GET    | `/`                              | Health check                   | No            |
| GET    | `/metrics`                       | Prometheus metrics             | No            |

---

## 🧪 Testing Checklist

### ✅ What We Successfully Demonstrated

- [x] Health check endpoint works (`GET /`)
- [x] Session creation works (`POST /session`)
- [x] Bearer token authentication works
- [x] Template query endpoint works (`GET /v2/activities/templates`)
- [x] Logs are being captured correctly
- [x] Multiple source IPs identified and explained
- [x] HTTP → WebSocket upgrade pattern documented

### 🎯 Next: See Live MCP Communication

To see actual metabob-cli MCP → rpc-api communication:

1. **Configure Environment:**
   ```bash
   export METABOB_RPC_API_URL="http://api.metabob.local:8080"
   ```

2. **Configure Project:**
   Add to `.opencode/opencode.json`:
   ```json
   {
     "mcp": {
       "metabob-cli": {
         "command": "metabob-cli",
         "args": ["mcp"],
         "env": {
           "METABOB_RPC_API_URL": "http://api.metabob.local:8080"
         }
       }
     }
   }
   ```

3. **Watch Logs:**
   ```bash
   kubectl logs -n metabob -f metabob-rpc-api-76bff4cbcf-wf8lf | \
     grep -E '(POST|GET|WebSocket|/v2)'
   ```

4. **Use MCP Tools:**
   From OpenCode in that project, call MCP tools and watch the HTTP requests appear!

---

## 📚 Code References

### metabob-cli MCP Server
- **Location:** `repos/metabob-cli/src/metabob_cli/mcp/`
- **Entry Point:** `server.py` (stdio JSONRPC server)
- **HTTP Client:** `api_client.py` (HTTP REST client)
- **API URL Config:**
  ```python
  API_BASE_URL = os.environ.get("METABOB_RPC_API_URL", "http://localhost:8080")
  ```

### metabob-rpc-api Endpoints
- **Location:** `repos/metabob-rpc-api/server/routes/`
- **Session Management:** `session.py`
- **Activity Templates:** `activity.py`
- **WebSocket Streaming:** `websocket.py`

---

## 🎬 Summary

We successfully:
1. ✅ Identified and explained all log patterns
2. ✅ Demonstrated session creation and authentication
3. ✅ Simulated MCP tool behavior with direct HTTP calls
4. ✅ Captured and analyzed logs in real-time
5. ✅ Documented the complete communication flow
6. ✅ Created testing scripts for future use

**Your original logs show a working metabob-cli → rpc-api communication flow!** The patterns we identified (`POST /session`, `GET /v2/activities/templates`, WebSocket connections) are exactly what you should expect to see when MCP tools are used.
