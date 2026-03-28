# Architectural Boundaries: metabob-cli-mcp-backend-communication

Complete analysis of architectural boundaries, contracts, coupling levels, and resilience patterns in the communication flow.

---

## Boundary 1: Repository Boundary (OpenCode ↔ MCP SDK)

**Type**: Package Dependency  
**Location**: `repos/metabob-opencode` | `@modelcontextprotocol/sdk@1.15.1` (npm)  
**Components**: MCP.clients(), callMCPTool() | MCP SDK Client

### Contract:
```typescript
// OpenCode → MCP SDK
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

interface Client {
  listTools(): Promise<{ tools: Tool[] }>
  callTool(
    request: { name: string; arguments: Record<string, unknown> },
    schema: ZodSchema,
    options?: { timeout?: number; resetTimeoutOnProgress?: boolean }
  ): Promise<{ content: Array<{ type: string; text: string }> }>
  close(): Promise<void>
}

interface Tool {
  name: string
  description?: string
  inputSchema: JSONSchema7
}
```

### Coupling: **Medium**
- **Tight**: Hard dependency on MCP SDK package version 1.15.1
- **Loose**: SDK provides well-defined TypeScript interfaces
- **Risk**: SDK version upgrades may break compatibility

### Versioning/Compatibility:
- **SDK version**: 1.15.1 (external, maintained by Anthropic)
- **Breaking changes**: SDK is pre-1.0, may have breaking changes
- **Lock strategy**: Exact version in package.json (good)

### Resilience Patterns:
```typescript
// repos/metabob-opencode/packages/opencode/src/util/metabob.ts:334
try {
  const result = await metabobClient.callTool(...)
} catch (error) {
  log.error("mcp tool call failed", { toolName, error })
  return undefined  // Silent failure
}
```

**Issues**:
- ❌ Silent failure returns undefined (no exception thrown)
- ❌ Caller can't distinguish between "tool not found" vs "network error"
- ✅ Logging provides observability

---

## Boundary 2: Configuration Boundary (Config File ↔ MCP Client Registry)

**Type**: Configuration-Driven Initialization  
**Location**: `opencode.json` | `MCP.state()` | `MCP.clients()`  
**Components**: Config.get() → MCP initialization → Client registry

### Contract:
```typescript
// opencode.json schema
{
  "mcp": {
    "metabob": {  // ⚠️ Key name must match client lookup
      "type": "local" | "remote",
      
      // Local (stdio child process)
      "command": ["python", "-m", "metabob_cli.mcp.server"],
      "environment": {
        "METABOB_API_URL": "http://localhost:8080",
        "LOG_LEVEL": "DEBUG"
      },
      
      // Remote (HTTP/SSE)
      "url": "https://mcp-server.example.com",
      "headers": {
        "Authorization": "Bearer token"
      },
      
      // Common
      "enabled": true,  // Default: true
      "timeout": 5000   // Default: 5000ms
    }
  }
}
```

### Coupling: **Tight** ⚠️
- **Critical**: Client name "metabob" is hardcoded in callMCPTool (line 266)
- **Brittle**: Typo in config key breaks entire chain silently
- **No validation**: Config schema doesn't enforce "metabob" key exists

### Versioning/Compatibility:
- **Schema**: Zod schema in `config/schemas/mcp.ts`
- **Validation**: Schema validates structure, NOT required keys
- **Evolution**: Can add new MCP servers, but "metabob" is magic string

### Resilience Patterns:
```typescript
// repos/metabob-opencode/packages/opencode/src/util/metabob.ts:265-271
const clients = await MCP.clients()
const metabobClient = clients["metabob"]

if (!metabobClient) {
  log.debug("metabob mcp client not available")
  return undefined  // ⚠️ SILENT FAILURE
}
```

**Issues**:
- ❌ No startup validation of "metabob" key
- ❌ Silent failure if key missing (returns undefined)
- ❌ No error message to user explaining missing config
- ❌ Falls back to bootstrap templates silently

**Recommended Fix**:
```typescript
if (!metabobClient) {
  throw new Error(
    'MCP client "metabob" not configured. Add mcp.metabob to opencode.json'
  )
}
```

---

## Boundary 3: Process Boundary (OpenCode ↔ MCP Server)

**Type**: IPC (Inter-Process Communication)  
**Location**: OpenCode TypeScript process | metabob-cli Python process  
**Transport**: stdio (stdin/stdout pipes) or SSE (Server-Sent Events over HTTP)

### Contract:
```
JSON-RPC 2.0 Protocol over stdio/SSE

Request (OpenCode → MCP Server):
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_activities",
    "arguments": {
      "query": "",
      "limit": 100,
      "category": "feature"
    }
  },
  "id": 1
}

Response (MCP Server → OpenCode):
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"status\":\"success\",\"activities\":[...],\"count\":10}"
      }
    ],
    "metadata": {}
  },
  "id": 1
}
```

### Coupling: **Loose**
- **Standard protocol**: JSON-RPC 2.0 (language-agnostic)
- **Typed messages**: MCP SDK handles serialization
- **Extensible**: Can add new tools without changing protocol

### Versioning/Compatibility:
- **Protocol version**: JSON-RPC 2.0 (stable standard)
- **MCP version**: SDK 1.15.1 (client) ↔ mcp[cli] (server)
- **Compatibility**: Both use mcp package, should be compatible
- **Risk**: Different mcp package versions may diverge

### Resilience Patterns:

**Timeout**:
```typescript
// repos/metabob-opencode/packages/opencode/src/util/metabob.ts:296
await metabobClient.callTool({...}, CallToolResultSchema, {
  resetTimeoutOnProgress: true,
  timeout: 30_000  // 30 seconds default
})
```

**Error Handling**:
```typescript
// MCP SDK throws on:
// - Transport error (pipe broken, connection closed)
// - Timeout
// - Invalid JSON-RPC response
try {
  const result = await metabobClient.callTool(...)
} catch (error) {
  log.error("mcp tool call failed", { toolName, error })
  return undefined  // Converts exception to undefined
}
```

**Issues**:
- ✅ Timeout protection (30s)
- ✅ Error logging
- ❌ No retry logic for transient failures
- ❌ No circuit breaker to stop repeated failed calls

---

## Boundary 4: Layer Boundary (Tool → Service → Client)

**Type**: Layered Architecture  
**Location**: SearchActivitiesTool → TemplateRepository → TemplateLoader → TemplateServiceClient

### Contract:
```typescript
// Tool Layer (Presentation)
interface ToolResult {
  title: string
  metadata: { count: number, templates: Array<Summary> }
  output: string  // Formatted for LLM
}

// Repository Layer (Facade)
interface ListOptions {
  category?: string
  backend?: "local" | "metabob" | "all"
}
→ ActivityTemplate.Schema[]

// Loader Layer (Backend Selection)
interface ListResult {
  templates: ActivityTemplate.Schema[]
  source: "metabob" | "local" | "cache"
  cached: boolean
}

// Service Client Layer (Remote Proxy)
interface ListTemplatesResult {
  templates: ActivityTemplate.Schema[]
  totalCount: number
  nextPageToken?: string
}
```

### Coupling: **Medium**
- **Loose**: Each layer has clear interface
- **Tight**: TemplateLoader knows about TemplateServiceClient (direct import)
- **Medium**: Layers can be tested in isolation

### Versioning/Compatibility:
- **Schema stability**: ActivityTemplate.Schema is canonical format
- **Breaking changes**: Adding fields OK (optional), removing breaks consumers
- **Evolution**: Layers can evolve independently if interfaces stable

### Resilience Patterns:

**Fallback Chain**:
```typescript
// repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:164-236
// 1. Try Metabob (if backend !== "local")
try {
  const result = await TemplateServiceClient.listTemplates(...)
  if (result.templates.length > 0) {
    return { templates: result.templates, source: "metabob" }
  }
} catch (error) {
  log.warn("metabob list failed, will fallback to local", { error })
}

// 2. Fallback to bootstrap templates
if (options.backend !== "metabob") {
  const bootstrapTemplates = await ActivityTemplate.list()
  return { templates: bootstrapTemplates, source: "local" }
}

// 3. Return empty
return { templates: [], source: "metabob" }
```

**Issues**:
- ✅ Graceful degradation (Metabob → bootstrap → empty)
- ✅ Error logging at each fallback step
- ❌ No distinction between "connection failed" vs "no templates"
- ❌ Empty result triggers bootstrap fallback even for valid empty response

---

## Boundary 5: Service Boundary (MCP Server ↔ HTTP Backend)

**Type**: HTTP REST API  
**Location**: metabob-cli ActivityManager | metabob-rpc-api FastAPI server  
**Transport**: HTTP/1.1 over TCP

### Contract:
```
HTTP GET /v2/activities/templates

Request:
GET /v2/activities/templates?limit=20&offset=0&category=feature HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Authorization: Bearer eyJhbGc...
X-Trace-ID: abc123  (optional)

Response (200 OK):
{
  "templates": [
    {
      "variant_id": "add-rest-endpoint-v1",
      "variant_name": "Add REST Endpoint",
      "activity_id": "add-rest-endpoint",
      "description": "...",
      "task_steps": [...],
      "expected_quality_score": 0.85,
      "expected_cost": 0.05,
      "expected_duration_ms": 45000,
      "success_rate": 0.90,
      "expected_value": 0.85,
      "scope": "global",
      "org_id": null,
      "context_requirements": [],
      "variables": {}
    }
  ]
}

Response (401 Unauthorized):
{
  "detail": "Invalid or missing Bearer token"
}

Response (500 Internal Server Error):
{
  "detail": "Redis connection failed"
}
```

### Coupling: **Medium**
- **Loose**: Standard HTTP REST (language-agnostic)
- **Medium**: Proto format (ActivityVariant) couples client and server
- **Tight**: Field names must match (variant_id, expected_quality_score, etc.)

### Versioning/Compatibility:
- **API version**: `/v2/activities` (explicit versioning)
- **Proto format**: ActivityVariant message (snake_case fields)
- **Breaking changes**: /v1 → /v2 migration required explicit endpoint change
- **Evolution**: Can add optional fields without breaking clients

### Resilience Patterns:

**HTTP Client Retry**:
```python
# repos/metabob-cli/src/metabob_cli/mcp/api_client.py:92-143
API_RETRY_ATTEMPTS = 3
API_RETRY_DELAY = 1  # seconds (exponential backoff)

for attempt in range(1, API_RETRY_ATTEMPTS + 1):
    try:
        response = await client.get(url, ...)
        
        # Don't retry on 4xx errors
        if 400 <= response.status < 500:
            return {"status": "error", "error": f"HTTP {response.status}"}
        
        # Retry on 5xx errors
        if response.status >= 500:
            if attempt < API_RETRY_ATTEMPTS:
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
                continue
            return {"status": "error", "error": f"HTTP {response.status}"}
        
        # Success
        return {"status": "success", "data": data}
    except (asyncio.TimeoutError, aiohttp.ClientConnectionError) as e:
        if attempt < API_RETRY_ATTEMPTS:
            await asyncio.sleep(retry_delay)
            retry_delay *= 2
            continue
        return {"status": "error", "error": str(e)}
```

**Authentication**:
```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:131-150
async def _get_client(self):
    headers = {"Content-Type": "application/json"}
    
    # Add Bearer token if available
    if self._session_token:
        headers["Authorization"] = f"Bearer {self._session_token}"
    
    # Add trace ID for distributed tracing
    if self._trace_id:
        headers["X-Trace-ID"] = self._trace_id
    
    return httpx.AsyncClient(
        base_url=self.base_url,
        headers=headers,
        timeout=30.0
    )
```

**Issues**:
- ✅ Retry logic with exponential backoff
- ✅ Timeout protection (30s)
- ✅ HTTP status code handling
- ❌ No circuit breaker (will retry forever if backend flapping)
- ❌ 401 returns empty array (silent auth failure)
- ❌ No health check endpoint to verify backend availability

---

## Boundary 6: Data Store Boundary (Backend ↔ Redis)

**Type**: Key-Value Store Access  
**Location**: metabob-rpc-api FastAPI | Redis  
**Transport**: Redis protocol (TCP)

### Contract:
```python
# Redis keys for activity templates
# Format: activity_template:{variant_id}
# Value: JSON-serialized ActivityVariant proto

# Example:
Key: "activity_template:add-rest-endpoint-v1"
Value: {
  "variant_id": "add-rest-endpoint-v1",
  "activity_id": "add-rest-endpoint",
  "variant_name": "Add REST Endpoint",
  "task_steps": [...],
  "expected_quality_score": 0.85,
  ...
}

# List operation: SCAN for keys matching pattern
SCAN 0 MATCH activity_template:* COUNT 100
→ Returns cursor and key list
→ GET each key to fetch template data
```

### Coupling: **Tight**
- **Tight**: Direct Redis commands (SCAN, GET, SET, HGET, HSET)
- **Brittle**: Schema changes require manual migration
- **No abstraction**: No repository pattern, direct Redis calls

### Versioning/Compatibility:
- **Redis version**: Not specified (assuming 6.x or 7.x)
- **Data format**: JSON strings (no versioning metadata)
- **Migration**: Manual (no schema migration system)
- **Evolution**: Adding fields OK, removing requires manual cleanup

### Resilience Patterns:

**Connection Pool**:
```python
# repos/metabob-rpc-api/server/utils/dependencies.py
from redis import StrictRedis
from server.config import settings

def get_redis_connection() -> StrictRedis:
    config = settings()
    return StrictRedis(
        host=config.REDIS_HOST,
        port=config.REDIS_PORT,
        db=config.REDIS_DB,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5
    )
```

**Error Handling**:
```python
# repos/metabob-rpc-api/server/routes/activity.py:112-131
try:
    templates = await list_templates(redis, category=category, ...)
    return {"templates": templates}
except Exception as e:
    logger.error(f"list_templates failed: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail=str(e))
```

**Issues**:
- ❌ No connection retry logic
- ❌ No circuit breaker for Redis failures
- ❌ Connection created per request (no persistent pool)
- ❌ Timeout (5s) may be too short for large SCAN operations
- ✅ Error logging
- ✅ HTTP 500 returned on failure (correct status code)

---

## Boundary 7: Configuration Boundary (Environment Variables ↔ Application)

**Type**: Environment-Based Configuration  
**Location**: OS environment | Python config | MCP tools

### Contract:
```bash
# Required for HTTP communication
METABOB_API_URL=http://localhost:8080  # Backend base URL
METABOB_RPC_API_URL=http://localhost:8080  # Alternative name

# Required for authentication
METABOB_API_TOKEN=eyJhbGc...  # Bearer token (from api_client.py)

# Optional for logging
LOG_LEVEL=DEBUG  # Python logging level
METABOB_LOG_LEVEL=DEBUG  # Alternative name

# Redis configuration (backend only)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Backend configuration
DEBUG=True  # Disables auth requirement in FastAPI
```

### Coupling: **Loose**
- **Loose**: Standard environment variables (12-factor app)
- **Portable**: Works across deployment environments
- **Decoupled**: App doesn't need to know config source

### Versioning/Compatibility:
- **Naming**: Inconsistent (METABOB_API_URL vs METABOB_RPC_API_URL)
- **Defaults**: api_client.py defaults to "http://localhost:8080"
- **Evolution**: Can add new vars without breaking existing

### Resilience Patterns:

**Fallback to Defaults**:
```python
# repos/metabob-cli/src/metabob_cli/mcp/api_client.py:43
API_BASE_URL = os.environ.get("METABOB_RPC_API_URL", "http://localhost:8080")

# repos/metabob-cli/src/metabob_cli/mcp/tools.py:3538-3545
config = _get_server().get_config_manager()
base_url = config.get("base_url", "http://localhost:8080")
```

**Issues**:
- ❌ No validation of URL format (could be invalid)
- ❌ No startup check to verify backend reachable
- ❌ localhost:8080 may not be correct in all environments
- ✅ Defaults allow development without config
- ❌ Inconsistent naming (METABOB_API_URL vs METABOB_RPC_API_URL)

---

## Boundary 8: Session State Boundary (FileStateManager ↔ Disk)

**Type**: File I/O for Session Persistence  
**Location**: metabob-cli FileStateManager | ~/.metabob/state/*.json

### Contract:
```python
# State file location
Path: ~/.metabob/state/{session_id}.json

# Content:
{
  "session_id": "sess_abc123",
  "session_token": "eyJhbGc...",
  "org_id": "org_xyz",
  "project_id": "proj_123",
  "created_at": "2026-03-03T00:00:00Z",
  "updated_at": "2026-03-03T12:34:56Z"
}
```

### Coupling: **Tight**
- **Tight**: Hardcoded file paths
- **Brittle**: No versioning in state file format
- **Local only**: Can't share state across machines

### Versioning/Compatibility:
- **Format**: JSON (unversioned)
- **Migration**: Manual (no schema migration)
- **Evolution**: Adding fields OK, removing breaks readers

### Resilience Patterns:

**File Read/Write**:
```python
# Assumed pattern (not in provided code):
import json
from pathlib import Path

def load_state(session_id: str):
    state_file = Path.home() / ".metabob" / "state" / f"{session_id}.json"
    if not state_file.exists():
        return None
    with open(state_file) as f:
        return json.load(f)

def save_state(session_id: str, data: dict):
    state_dir = Path.home() / ".metabob" / "state"
    state_dir.mkdir(parents=True, exist_ok=True)
    state_file = state_dir / f"{session_id}.json"
    with open(state_file, 'w') as f:
        json.dump(data, f, indent=2)
```

**Issues**:
- ❌ No file locking (concurrent access risk)
- ❌ No atomic write (corruption risk on crash)
- ❌ No backup or recovery mechanism
- ❌ No encryption (session tokens stored in plaintext)
- ✅ Creates directory if missing

---

## Critical Boundary Failure Analysis

### 1. Configuration Boundary Failure (Boundary 2) ⚠️⚠️⚠️

**Why communication breaks**:
```typescript
// repos/metabob-opencode/packages/opencode/src/util/metabob.ts:265-271
const clients = await MCP.clients()
const metabobClient = clients["metabob"]  // ← Returns undefined if not configured

if (!metabobClient) {
  log.debug("metabob mcp client not available")
  return undefined  // ← SILENT FAILURE
}
```

**Root cause**: `opencode.json` missing `mcp.metabob` configuration

**Impact**:
1. MCP client lookup returns undefined
2. callMCPTool returns undefined
3. MetabobCLI.searchActivities returns []
4. TemplateLoader falls back to bootstrap templates
5. **NO HTTP traffic ever reaches backend**

**Evidence**: User reports "NO HTTP traffic from metabob-cli MCP to rpc-api"

**Fix**:
```json
// opencode.json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["python", "-m", "metabob_cli.mcp.server"],
      "environment": {
        "METABOB_API_URL": "http://localhost:8080"
      },
      "enabled": true
    }
  }
}
```

### 2. Process Boundary Failure (Boundary 3)

**Possible causes**:
- MCP server process not started
- Stdio pipes broken
- Python environment missing dependencies

**Detection**:
```bash
# Check if MCP server process running
ps aux | grep "metabob_cli.mcp.server"

# Test MCP server manually
python -m metabob_cli.mcp.server
```

### 3. Service Boundary Failure (Boundary 5)

**Possible causes**:
- Backend not running (localhost:8080)
- Wrong URL in METABOB_API_URL
- Network firewall blocking connection
- Session token missing/invalid (401 response)

**Detection**:
```bash
# Test backend directly
curl http://localhost:8080/v2/activities/templates

# Check with auth
curl -H "Authorization: Bearer <token>" \
     http://localhost:8080/v2/activities/templates
```

---

## Boundary Coupling Summary

| Boundary | Type | Coupling | Failure Mode | User Impact |
|----------|------|----------|--------------|-------------|
| 1. OpenCode ↔ MCP SDK | Dependency | Medium | SDK API change | Compile error |
| 2. Config ↔ MCP Client | **Config** | **Tight** | **Missing mcp.metabob** | **Silent fallback** ⚠️ |
| 3. OpenCode ↔ MCP Server | IPC | Loose | Process not started | Silent fallback |
| 4. Tool → Service → Client | Layered | Medium | Service error | Empty result |
| 5. MCP Server ↔ Backend | HTTP | Medium | Backend down | Empty result (401/500) |
| 6. Backend ↔ Redis | Data store | Tight | Redis down | HTTP 500 |
| 7. Env vars ↔ App | Config | Loose | Missing METABOB_API_URL | Wrong URL |
| 8. State ↔ Disk | File I/O | Tight | File corrupt | Missing token |

---

## Resilience Pattern Summary

| Boundary | Timeout | Retry | Fallback | Circuit Breaker | Error Logging |
|----------|---------|-------|----------|-----------------|---------------|
| 1. MCP SDK | ✅ 30s | ❌ | ❌ | ❌ | ✅ |
| 2. Config | N/A | N/A | ❌ Silent | ❌ | ✅ |
| 3. IPC (JSON-RPC) | ✅ 30s | ❌ | ❌ | ❌ | ✅ |
| 4. Layers | ✅ Inherited | ❌ | ✅ Bootstrap | ❌ | ✅ |
| 5. HTTP | ✅ 30s | ✅ 3x | ✅ Empty [] | ❌ | ✅ |
| 6. Redis | ✅ 5s | ❌ | ❌ | ❌ | ✅ |
| 7. Env vars | N/A | N/A | ✅ Defaults | N/A | ❌ |
| 8. File I/O | ❌ | ❌ | ✅ None | N/A | ❌ |

---

## Recommended Improvements

### Immediate (Fix communication breakage):
1. **Add startup validation**: Check mcp.metabob exists in config
2. **Throw on missing config**: Don't return undefined silently
3. **Health check endpoint**: Verify backend connectivity on startup
4. **Explicit error messages**: Tell user what's misconfigured

### Short-term (Improve resilience):
1. **Add circuit breaker**: Stop calling failed backend repeatedly
2. **Retry transient failures**: Network errors, timeouts
3. **Connection pooling**: Reuse HTTP connections
4. **Atomic file writes**: Prevent state corruption

### Long-term (Architecture improvements):
1. **Proto code generation**: Auto-generate types from schema
2. **Schema versioning**: Track data format versions
3. **Migration system**: Handle schema upgrades gracefully
4. **Distributed tracing**: Trace requests across boundaries
5. **Health monitoring**: Expose metrics for all boundaries

---

## Verification Checklist

To verify communication is working:

- [ ] Check `opencode.json` has `mcp.metabob` section
- [ ] Verify MCP server process is running
- [ ] Test `python -m metabob_cli.mcp.server` starts successfully
- [ ] Check `METABOB_API_URL` environment variable is set
- [ ] Verify backend is running at configured URL
- [ ] Test `curl http://localhost:8080/v2/activities/templates`
- [ ] Check session token is available in state file
- [ ] Verify Redis is running and accessible
- [ ] Enable debug logging to trace request flow
- [ ] Use tcpdump/wireshark to capture HTTP traffic

If NO HTTP traffic visible:
1. **Most likely**: mcp.metabob not configured (Boundary 2 failure)
2. Check: MCP server process not started (Boundary 3 failure)
3. Check: METABOB_API_URL wrong/missing (Boundary 7 failure)
