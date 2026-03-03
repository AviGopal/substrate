# Component Annotations: metabob-cli-mcp-backend-communication

Annotations for the 5 most critical components in the data flow, focusing on WHY they exist, design decisions, and business context.

---

## Component 1: SearchActivitiesTool (Entry Point)

**Location**: `repos/metabob-opencode/packages/opencode/src/tool/search-activities.ts:27`  
**Type**: LLM Tool Interface  
**Stage**: Entry point for activity template discovery

### Why It Exists

SearchActivitiesTool handles the initial request in the metabob-cli-mcp-backend-communication flow. It exists to provide LLMs (Claude, GPT-4) with access to activity templates from multiple backends (Metabob MCP, local bootstrap) through a unified search interface.

**Business Context**:
- LLM agents need to discover available activity templates to recommend to users
- Templates may come from central backend (org-level, learned from executions) or local bootstrap (built-in)
- Token efficiency is critical (LLM context window limits)

### Data Transformation

**Input**: Tool parameters from LLM
```typescript
{
  category?: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure",
  verbose?: boolean  // Default: false
}
```

**Output**: Formatted text for LLM consumption
```typescript
{
  title: "Activity Templates",
  metadata: { count: number, templates: Array<Summary> },
  output: string  // Compact: ~300 bytes, Verbose: ~2KB per 14 templates
}
```

**Transformation Logic**:
- Filters templates by category
- Formats as compact (ID, name, success rate) or verbose (full details)
- Optimizes for token usage (compact is default)

### Business Logic Enforced

1. **Multi-backend transparency**: User doesn't need to know if templates come from Metabob or bootstrap
2. **Token optimization**: Default compact format reduces context by ~7x
3. **Category filtering**: Helps LLM find relevant templates faster

### Design Decisions

**Decision 1: Verbose flag stays at tool layer**
- **Why**: Formatting is presentation concern, not data retrieval
- **Benefit**: Keeps TemplateRepository clean (no presentation logic)
- **Trade-off**: Can't pre-filter verbose results (always fetches all, then formats)

**Decision 2: Backend selection abstracted**
- **Why**: Tool layer shouldn't know about fallback chain (Metabob → Bootstrap)
- **Benefit**: Graceful degradation invisible to LLM
- **Trade-off**: Silent failures (if Metabob unreachable, falls back without telling LLM)

**Decision 3: Synchronous execution**
- **Why**: LLM tools must complete before returning control
- **Benefit**: Simple error handling, no async complexity for LLM
- **Trade-off**: Blocks LLM response until templates fetched (can be slow with N+1 queries)

### Constraints

1. **LLM timeout**: Must complete within ~30 seconds or LLM gives up
2. **Token budget**: Compact format mandatory for large template libraries (>50 templates)
3. **No pagination**: Returns all matching templates (limit handled by backend)
4. **Read-only**: Tool can't modify templates (by design, LLM shouldn't write)

### Critical Issue

**Silent fallback**: If Metabob unreachable, returns bootstrap templates without error message to LLM. LLM has no context that backend is unavailable.

**Impact**: LLM recommends bootstrap templates even when better org-specific templates exist in backend.

---

## Component 2: callMCPTool (Configuration Boundary) ⚠️ CRITICAL

**Location**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:262`  
**Type**: MCP Client Proxy  
**Stage**: Process boundary - TypeScript to Python via JSON-RPC

### Why It Exists

callMCPTool handles the configuration boundary crossing in the metabob-cli-mcp-backend-communication flow. It exists to abstract MCP client initialization, tool discovery, and JSON-RPC communication from higher-level code.

**Business Context**:
- MCP (Model Context Protocol) enables plugin architecture for LLM tools
- Multiple MCP servers possible (metabob, others), must route to correct one
- Configuration-driven (opencode.json) allows runtime customization without code changes

### Data Transformation

**Input**: Tool name and arguments
```typescript
toolName: string,  // e.g., "search_activities"
args: Record<string, unknown>  // JSON-serializable arguments
```

**Output**: Parsed JSON response or undefined
```typescript
T | undefined  // Generic type, undefined on any failure
```

**Transformation Logic**:
1. Lookup MCP client from registry by name ("metabob")
2. Validate client exists
3. Call client.callTool() via MCP SDK (JSON-RPC over stdio/SSE)
4. Extract text from response.content array
5. Parse JSON string to typed object
6. Return result or undefined

### Business Logic Enforced

1. **Client registry lookup**: Hardcoded "metabob" key must exist in config
2. **Silent failure on missing client**: Returns undefined (no exception)
3. **JSON-only responses**: Expects MCP server to return JSON in text field
4. **Timeout**: 30 seconds default (from MCP SDK)

### Design Decisions

**Decision 1: Return undefined instead of throwing ⚠️ CRITICAL**
- **Why**: Enables graceful degradation (caller can fallback)
- **Benefit**: OpenCode works offline with bootstrap templates
- **Trade-off**: **SILENT FAILURE** - User has no idea backend is unavailable
- **Problem**: This is THE root cause of "no HTTP traffic" issue

**Decision 2: Hardcoded "metabob" client name**
- **Why**: Configuration key must match lookup key
- **Benefit**: Simple, no indirection
- **Trade-off**: Brittle - typo in config breaks entire chain silently

**Decision 3: Generic return type T**
- **Why**: Caller specifies expected response shape
- **Benefit**: Type-safe at call site
- **Trade-off**: No runtime validation (type cast, not parse)

**Decision 4: JSON-only protocol**
- **Why**: MCP supports multiple content types, but JSON is universal
- **Benefit**: Works with any JSON-serializable data
- **Trade-off**: Large responses (templates with full task definitions) inflate JSON

### Constraints

1. **MCP client must be initialized**: Requires mcp.metabob in opencode.json
2. **Stdio transport**: Child process must be alive, pipes must be open
3. **JSON-serializable**: Arguments and responses limited to JSON types
4. **Timeout**: 30 seconds hard limit (MCP SDK default)
5. **No retry**: Single attempt, no exponential backoff

### Critical Issues

**Issue 1: Silent failure on missing client** ⚠️⚠️⚠️
```typescript
if (!metabobClient) {
  log.debug("metabob mcp client not available")
  return undefined  // ❌ BLOCKS HTTP TRAFFIC
}
```
**Impact**: If mcp.metabob not in config, returns undefined → falls back to bootstrap → NO HTTP traffic

**Issue 2: No startup validation**
- Config not checked until first tool call
- User may not notice missing config until trying advanced features

**Issue 3: No health check**
- Can't distinguish "client not configured" from "client died" from "backend unreachable"

### Recommended Fixes

1. **Throw exception on missing client**:
```typescript
if (!metabobClient) {
  throw new NamedError(
    "MetabobMCPNotConfigured",
    'MCP client "metabob" not configured. Add mcp.metabob to opencode.json'
  )
}
```

2. **Startup validation**:
```typescript
// In Config.state()
if (config.activity?.backend === "metabob" && !config.mcp?.metabob) {
  throw new Error("Activity backend set to metabob but mcp.metabob not configured")
}
```

3. **Connection check with caching**:
```typescript
async function checkMCPConnection(): Promise<boolean> {
  if (cachedStatus && Date.now() - cachedTime < 5000) {
    return cachedStatus.connected
  }
  
  try {
    const tools = await metabobClient.listTools()
    cachedStatus = { connected: true }
    cachedTime = Date.now()
    return true
  } catch (error) {
    cachedStatus = { connected: false, error }
    cachedTime = Date.now()
    return false
  }
}
```

---

## Component 3: search_activities_tool (Process Boundary)

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py:3512`  
**Type**: MCP Tool Handler (Python)  
**Stage**: Cross-language boundary - receives JSON-RPC, calls HTTP backend

### Why It Exists

search_activities_tool handles the cross-language boundary in the metabob-cli-mcp-backend-communication flow. It exists to translate MCP tool calls (from TypeScript OpenCode) into HTTP API calls (to Python rpc-api backend).

**Business Context**:
- MCP is language-agnostic protocol (JSON-RPC over stdio/SSE)
- Python has better HTTP client libraries (httpx, aiohttp)
- Backend is Python FastAPI (same language as MCP server = shared types)

### Data Transformation

**Input**: MCP tool arguments (from JSON-RPC)
```python
query: str = "",
category: str = "",
limit: int = 20,
min_success_rate: float = 0.0
```

**Output**: JSON string for MCP response
```python
{
  "status": "success",
  "count": 10,
  "activities": [
    {
      "id": "template-1",
      "name": "...",
      "task_count": 3,
      "success_rate": 0.85,
      ...
    }
  ]
}
```

**Transformation Logic**:
1. Extract config (base_url, session_token)
2. Create ActivityManager instance
3. Call manager.search_activities() (HTTP GET)
4. Format response as JSON string
5. Return via MCP protocol

### Business Logic Enforced

1. **Configuration retrieval**: Gets base_url from config or env var
2. **Session management**: Extracts session_token from FileStateManager
3. **Default values**: Empty query, limit=20, min_success_rate=0.0
4. **Error handling**: Wraps exceptions in {"status": "error", "error": "..."}

### Design Decisions

**Decision 1: Separate ActivityManager class**
- **Why**: Separation of concerns (MCP handler vs HTTP client)
- **Benefit**: Can unit test HTTP client without MCP server
- **Trade-off**: Extra layer of indirection

**Decision 2: JSON string return (not dict)**
- **Why**: MCP protocol expects string in content.text field
- **Benefit**: Consistent with MCP spec
- **Trade-off**: Double JSON parsing (dict → string → dict in OpenCode)

**Decision 3: Default limit=20**
- **Why**: Prevent accidental large responses (backend has 100 templates)
- **Benefit**: Faster responses, less network traffic
- **Trade-off**: OpenCode overrides to 100 anyway (inconsistent)

**Decision 4: Config vs environment variables**
- **Why**: Support both config file and env vars (12-factor app)
- **Benefit**: Works in development (config) and production (env vars)
- **Trade-off**: Two sources of truth (confusing which takes precedence)

### Constraints

1. **Config file location**: Assumes ~/.metabob/config.json or opencode.json
2. **Session token required**: Returns [] on 401 (can't proceed without auth)
3. **Base URL defaults**: localhost:8080 may not be correct in all environments
4. **Synchronous config read**: Blocks on file I/O (could be async)

### Critical Issues

**Issue 1: Missing METABOB_API_URL causes wrong URL**
- Defaults to localhost:8080
- In Kubernetes, should be http://metabob-rpc-api:8080
- No validation that URL is reachable

**Issue 2: Session token from file (security risk)**
- Stored in plaintext ~/.metabob/state/{session_id}.json
- No encryption
- Anyone with file access can impersonate user

**Issue 3: No connection timeout on config read**
- If network filesystem (NFS), could hang
- No async/await for file I/O

### Recommended Fixes

1. **Validate base_url format**:
```python
from urllib.parse import urlparse

base_url = config.get("base_url", os.environ.get("METABOB_API_URL", "http://localhost:8080"))
parsed = urlparse(base_url)
if not parsed.scheme or not parsed.netloc:
    raise ValueError(f"Invalid METABOB_API_URL: {base_url}")
```

2. **Health check on startup**:
```python
async def check_backend_health():
    try:
        response = await client.get(f"{base_url}/health", timeout=5)
        if response.status_code != 200:
            logger.warning(f"Backend unhealthy: {response.status_code}")
    except Exception as e:
        logger.error(f"Backend unreachable at {base_url}: {e}")
```

3. **Encrypt session tokens**:
```python
from cryptography.fernet import Fernet

# Generate key from machine ID or user password
key = Fernet.generate_key()
cipher = Fernet(key)

# Encrypt before writing
encrypted_token = cipher.encrypt(session_token.encode())
state_file.write(encrypted_token)

# Decrypt on read
session_token = cipher.decrypt(encrypted_token).decode()
```

---

## Component 4: ActivityManager.search_activities (Service Integration)

**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:164`  
**Type**: HTTP Client Wrapper  
**Stage**: Service boundary - makes HTTP GET to backend API

### Why It Exists

ActivityManager.search_activities handles the service integration in the metabob-cli-mcp-backend-communication flow. It exists to encapsulate HTTP communication with the rpc-api backend, including authentication, retries, and response parsing.

**Business Context**:
- Backend is separate service (different process, possibly different machine)
- HTTP REST API is standard integration pattern
- Bearer token authentication for multi-tenant isolation
- Proto format (ActivityVariant) from backend needs transformation

### Data Transformation

**Input**: Search parameters
```python
query: str = "",
category: str | None = None,
limit: int = 20,
min_success_rate: float = 0.0
```

**HTTP Request**:
```
GET /v2/activities/templates?limit=20&offset=0&query=...&category=feature
Authorization: Bearer eyJ...
Content-Type: application/json
```

**Backend Response** (Proto format):
```json
{
  "templates": [
    {
      "variant_id": "add-rest-endpoint-v1",
      "variant_name": "Add REST Endpoint",
      "activity_id": "add-rest-endpoint",
      "expected_quality_score": 0.85,
      "expected_cost": 0.05,
      "task_steps": [...]
    }
  ]
}
```

**Output** (Internal format):
```python
[
  {
    "id": "add-rest-endpoint-v1",           # variant_id
    "name": "Add REST Endpoint",            # variant_name
    "category": "add-rest-endpoint",        # activity_id
    "success_rate": 0.85,                   # expected_quality_score
    "avg_cost": 0.05,                       # expected_cost
    "task_count": 3,                        # len(task_steps)
    "expected_value": 0.8075                # quality * (1 - cost)
  }
]
```

**Transformation Logic**:
1. Build HTTP client with Bearer token
2. Construct query params (skip empty values)
3. GET /v2/activities/templates
4. Parse JSON response
5. Map proto fields to internal format
6. Calculate derived fields (expected_value, task_count)
7. Return array of transformed templates

### Business Logic Enforced

1. **Authentication**: Bearer token required (from session state)
2. **Query building**: Only include non-empty params
3. **Status code handling**: 200 = success, 401 = auth failure, else error
4. **Proto mapping**: Hide backend implementation details
5. **Derived metrics**: Calculate expected_value for recommendations

### Design Decisions

**Decision 1: Proto format on wire, internal format in memory**
- **Why**: Backend uses protobuf (efficient, versioned), clients use dicts (flexible)
- **Benefit**: Can change proto schema without breaking all clients (if backwards compatible)
- **Trade-off**: Manual mapping (error-prone, breaks on schema changes)

**Decision 2: Return [] on 401 instead of throwing ⚠️**
- **Why**: Allows "anonymous mode" (public templates only)
- **Benefit**: OpenCode works without authentication
- **Trade-off**: Silent auth failures (user doesn't know they're missing org templates)

**Decision 3: httpx.AsyncClient with timeout**
- **Why**: Non-blocking I/O, won't hang on slow backend
- **Benefit**: Better performance, cancellation support
- **Trade-off**: Async complexity (must use await everywhere)

**Decision 4: No connection pooling (creates client per request)**
- **Why**: Simple, no state management
- **Benefit**: No connection leaks, no max pool size issues
- **Trade-off**: TCP handshake overhead every request (~50-100ms)

### Constraints

1. **Bearer token required**: Can't access org-scoped templates without auth
2. **Timeout**: 30 seconds hard limit (from httpx.AsyncClient)
3. **No pagination**: Fetches all matching templates (backend limits to 100)
4. **No caching**: Every request hits backend (could cache for 5-60 seconds)
5. **Proto format coupling**: Field name changes break client

### Critical Issues

**Issue 1: Silent 401 failure**
```python
elif response.status_code == 401:
    logger.debug("Templates API requires auth, falling back to empty")
    return []  # ❌ USER HAS NO IDEA AUTH FAILED
```
**Impact**: User sees only global templates, thinks that's all there is

**Issue 2: No retry logic**
- Network errors cause immediate failure
- Transient 5xx errors not retried
- User must manually retry

**Issue 3: No connection pooling**
- New TCP connection per request
- Handshake overhead (~50-100ms)
- No connection reuse

**Issue 4: Manual proto mapping**
```python
{
  "id": t.get("variant_id"),  # ❌ Breaks if field renamed
  "name": t.get("variant_name"),
  "success_rate": t.get("expected_quality_score", 0.0),
  ...
}
```
**Impact**: Breaks on proto schema changes

### Recommended Fixes

1. **Throw on 401**:
```python
elif response.status_code == 401:
    raise AuthenticationError(
        "Session token missing or invalid. "
        "Run 'opencode login' or set METABOB_API_TOKEN."
    )
```

2. **Retry with exponential backoff**:
```python
import tenacity

@tenacity.retry(
    stop=tenacity.stop_after_attempt(3),
    wait=tenacity.wait_exponential(multiplier=1, min=1, max=10),
    retry=tenacity.retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    reraise=True
)
async def search_activities_with_retry(...):
    return await self.search_activities(...)
```

3. **Connection pooling**:
```python
# Singleton client
_http_client: Optional[httpx.AsyncClient] = None

async def get_http_client():
    global _http_client
    if _http_client is None:
        _http_client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {self._session_token}"},
            timeout=30.0,
            limits=httpx.Limits(
                max_connections=100,
                max_keepalive_connections=20
            )
        )
    return _http_client
```

4. **Proto code generation**:
```bash
# Generate Python types from .proto files
protoc --python_out=. activity_variant.proto

# Use generated types
from metabob_proto.activity_variant_pb2 import ActivityVariant
variant = ActivityVariant()
variant.ParseFromString(response.content)
```

---

## Component 5: list_activity_templates (Exit Point)

**Location**: `repos/metabob-rpc-api/server/routes/activity.py:72`  
**Type**: FastAPI HTTP Endpoint  
**Stage**: Exit point - queries Redis, returns templates to HTTP client

### Why It Exists

list_activity_templates handles the exit point in the metabob-cli-mcp-backend-communication flow. It exists to provide HTTP REST API access to activity templates stored in Redis, with multi-tenant isolation and Thompson Sampling recommendations.

**Business Context**:
- Templates stored in Redis (MVP, will migrate to SurrealDB)
- Multi-tenant: global templates visible to all, org templates only to org members
- Thompson Sampling: rank templates by expected value (quality * success_rate)
- Learning loop: templates improve over time as executions recorded

### Data Transformation

**HTTP Request**:
```
GET /v2/activities/templates?category=feature&limit=50
Authorization: Bearer eyJ...
```

**Redis Queries**:
```
SCAN 0 MATCH activity_template:* COUNT 100
→ ["activity_template:add-rest-endpoint-v1", ...]

GET activity_template:add-rest-endpoint-v1
→ {"variant_id": "...", "task_steps": [...], ...}
```

**Output** (Proto format):
```json
{
  "templates": [
    {
      "variant_id": "add-rest-endpoint-v1",
      "variant_name": "Add REST Endpoint",
      "activity_id": "add-rest-endpoint",
      "task_steps": [...],
      "expected_quality_score": 0.85,
      "expected_cost": 0.05,
      "expected_duration_ms": 45000,
      "success_rate": 0.90,
      "expected_value": 0.85,
      "scope": "global",
      "org_id": null
    }
  ]
}
```

**Transformation Logic**:
1. Extract org_id from Bearer token (JWT decode)
2. SCAN Redis for activity_template:* keys
3. GET each template JSON
4. Parse JSON to dict
5. Filter by scope (global OR org_id matches)
6. Filter by category (if provided)
7. Sort by expected_value (Thompson Sampling)
8. Limit to requested count
9. Return as {"templates": [...]}

### Business Logic Enforced

1. **Multi-tenant isolation**:
   - Global templates (scope=null or "global") visible to all
   - Org templates (scope="org", org_id="...") only visible to org members
   - Without Bearer token: only global templates returned

2. **Thompson Sampling ranking**:
   - expected_value = quality * success_rate
   - Higher expected_value = higher in list
   - Balances exploration (new templates) vs exploitation (proven templates)

3. **Category filtering**:
   - Optional filter (feature, bugfix, refactor, tool, infrastructure)
   - Case-sensitive string match

4. **Limit enforcement**:
   - Default: 50 templates
   - Maximum: 100 templates (prevent large responses)

### Design Decisions

**Decision 1: Redis for MVP storage**
- **Why**: Fast, simple key-value store for prototyping
- **Benefit**: No schema migrations, can iterate quickly
- **Trade-off**: No relational queries, manual filtering, will migrate to SurrealDB

**Decision 2: SCAN + GET pattern (no indexes)**
- **Why**: Redis key-value store, no secondary indexes
- **Benefit**: Simple, works for small datasets (<1000 templates)
- **Trade-off**: O(N) complexity, slow with many templates

**Decision 3: Proto format on wire**
- **Why**: ActivityVariant proto message is canonical format
- **Benefit**: Versioned schema, efficient serialization
- **Trade-off**: Snake_case field names (Python convention, not JSON convention)

**Decision 4: Bearer token optional in DEBUG mode**
- **Why**: Allow testing without authentication
- **Benefit**: Easier development, can curl endpoints
- **Trade-off**: Security risk if DEBUG=True in production

### Constraints

1. **Redis SCAN limits**: Can't efficiently query by category or success_rate
2. **No pagination**: Returns all matching templates (up to limit)
3. **Auth optional in DEBUG**: Security risk if misconfigured
4. **Snake_case fields**: Proto convention, not JSON convention (some clients expect camelCase)
5. **Synchronous Redis calls**: Blocks on I/O (Python FastAPI is async, but Redis client is sync)

### Critical Issues

**Issue 1: O(N) filtering (SCAN all keys)**
```python
# Inefficient: SCAN all templates, filter in Python
keys = redis.scan_iter(match="activity_template:*", count=100)
for key in keys:
    template = json.loads(redis.get(key))
    if matches_filters(template):
        results.append(template)
```
**Impact**: Slow with many templates (100ms for 1000 templates)

**Issue 2: No connection pool**
```python
def get_redis_connection() -> StrictRedis:
    return StrictRedis(host=..., port=..., db=...)
```
**Impact**: New TCP connection per request (overhead)

**Issue 3: Overly broad exception handling**
```python
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
```
**Impact**: Returns 500 for all errors (should be 400 for validation, 503 for Redis down)

**Issue 4: No request logging**
- Can't see what requests are hitting endpoint
- Difficult to debug "no templates returned" issues
- No visibility into query params

### Recommended Fixes

1. **Add Redis indexes** (or migrate to SurrealDB):
```python
# Redis: Use sorted sets for indexing
redis.zadd("templates:by_category:feature", {template_id: expected_value})
redis.zrevrange("templates:by_category:feature", 0, limit-1)  # O(log N)

# SurrealDB: Native indexes and queries
db.query("""
  SELECT * FROM activity_template
  WHERE scope IN ['global', $org_id]
    AND category = $category
  ORDER BY expected_value DESC
  LIMIT $limit
""", {"org_id": org_id, "category": category, "limit": limit})
```

2. **Connection pooling**:
```python
from redis import ConnectionPool, StrictRedis

_redis_pool = ConnectionPool(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    max_connections=50
)

def get_redis_connection() -> StrictRedis:
    return StrictRedis(connection_pool=_redis_pool, decode_responses=True)
```

3. **Specific exception types**:
```python
try:
    templates = await list_templates(...)
    return {"templates": templates}
except redis.ConnectionError as e:
    logger.error(f"Redis unavailable: {e}")
    raise HTTPException(status_code=503, detail="Database temporarily unavailable")
except ValueError as e:
    logger.warning(f"Invalid input: {e}")
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    logger.error(f"Unexpected error: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="Internal server error")
```

4. **Request logging middleware**:
```python
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    logger.info(f"{request.method} {request.url.path}?{request.url.query}")
    
    response = await call_next(request)
    
    duration = (time.time() - start) * 1000
    logger.info(f"Status: {response.status_code}, Duration: {duration:.2f}ms")
    return response
```

---

## Summary of Annotations

### Components Annotated: 5

1. **SearchActivitiesTool** (Entry Point)
   - LLM tool interface for template discovery
   - Optimizes for token usage (compact vs verbose)
   - Silent fallback to bootstrap templates

2. **callMCPTool** (Configuration Boundary) ⚠️ CRITICAL
   - MCP client proxy and JSON-RPC handler
   - **Silent failure on missing mcp.metabob config (ROOT CAUSE)**
   - Hardcoded client name ("metabob") creates brittle coupling

3. **search_activities_tool** (Process Boundary)
   - Cross-language bridge (TypeScript → Python)
   - Config and session token management
   - JSON string serialization for MCP protocol

4. **ActivityManager.search_activities** (Service Integration)
   - HTTP client wrapper with authentication
   - Proto format transformation (backend → internal)
   - Silent 401 failures (returns [] instead of throwing)

5. **list_activity_templates** (Exit Point)
   - REST API endpoint with multi-tenant isolation
   - Redis key-value queries (SCAN + GET pattern)
   - Thompson Sampling ranking for recommendations

### Key Insights Documented

#### Design Decisions Explained:
- Why verbose flag stays at tool layer (separation of concerns)
- Why undefined instead of throwing (graceful degradation)
- Why proto on wire, internal in memory (abstraction)
- Why Redis for MVP (fast iteration, will migrate)

#### Business Context:
- LLM token optimization is critical
- Multi-tenant isolation for org-scoped templates
- Thompson Sampling for learned recommendations
- Anonymous mode (no auth) for public templates

#### Critical Issues Identified:
1. **Silent configuration failure** (callMCPTool) - ROOT CAUSE
2. **Silent authentication failure** (ActivityManager) - Missing org templates
3. **N+1 query problem** (not annotated, but related)
4. **O(N) Redis filtering** (list_activity_templates) - Performance issue
5. **No connection pooling** (multiple components) - Resource waste

#### Constraints:
- 30 second timeout on MCP calls
- 100 template limit on backend
- Redis SCAN inefficiency (O(N))
- Proto coupling (field name changes break clients)

### Traceability

Each annotation includes:
- **File path and line number** for exact location
- **Why it exists** in the flow (business context)
- **Data transformation** (input → output with types)
- **Business logic enforced** (rules and constraints)
- **Design decisions** with trade-offs explained
- **Critical issues** with impact assessment
- **Recommended fixes** with code examples

### Value of Annotations

1. **Debugging**: Clear explanation why silent failures occur
2. **Onboarding**: New developers understand WHY, not just WHAT
3. **Evolution**: Design decisions documented for future refactoring
4. **Root cause analysis**: Chain of silent failures explained
5. **Prioritization**: Critical issues marked for immediate fix

### Next Steps

To complete the feature documentation:
1. Annotate TemplateLoader (fallback chain logic)
2. Annotate MCP.clients() (client initialization)
3. Annotate FileStateManager (session token storage)
4. Add sequence diagram showing full flow
5. Add troubleshooting guide based on annotations
