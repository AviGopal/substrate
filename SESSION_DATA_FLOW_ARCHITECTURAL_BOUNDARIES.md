# Session Data Flow to SurrealDB - Architectural Boundaries

This document analyzes all architectural boundaries in the Session Data Flow pipeline, documenting contracts, coupling levels, versioning concerns, and resilience patterns.

---

## Boundary 1: Repository Boundary - OpenCode ↔ CLI (MCP Protocol)
**Type**: Repository Boundary + Service Boundary
**Location**: `metabob-opencode` packages | `metabob-cli` Python package
**Communication**: MCP protocol over stdio/SSE transport

### Contract

**OpenCode Side** (TypeScript):
```typescript
// repos/metabob-opencode/packages/opencode/src/mcp/index.ts
const result = await MCP.clients()["metabob"].callTool({
  name: "metabob_impulse_store",
  arguments: {
    impulse_id: string,
    project_id: string,
    impulse_data: {
      id: string,
      type: string,
      pointer: ImpulsePointer,
      budget: number,
      priority: "high" | "medium" | "low",
      loaded: boolean,
      scope: "session" | "activity",
      sessionID?: string,
      activityId?: string,
      metadata?: Record<string, unknown>
    }
  }
})
```

**CLI Side** (Python):
```python
# repos/metabob-cli/src/metabob_cli/mcp/tools.py
@tool("metabob_impulse_store")
async def metabob_impulse_store(
    impulse_id: str,
    project_id: str,
    impulse_data: dict
) -> str:  # Returns JSON string
    ...
```

**Protocol**: MCP (Model Context Protocol)
- **Transport**: stdio (local) or SSE (remote)
- **Format**: JSON-RPC style messages
- **Tool Discovery**: CLI advertises available tools via MCP protocol

### Coupling

**Level**: **Loose**

**Reasons**:
1. **Protocol-based**: OpenCode doesn't import CLI code directly
2. **Dynamic Discovery**: Tools discovered at runtime via MCP
3. **Optional Dependency**: Backend sync is best-effort (failure doesn't fail operation)
4. **Version Independence**: Each repo can evolve independently

**Coupling Points**:
1. **Tool Name String**: `"metabob_impulse_store"` (if renamed, OpenCode breaks)
2. **Argument Schema**: `{impulse_id, project_id, impulse_data}` must match
3. **Return Format**: JSON string with `{status, ...}` structure

**Versioning Concerns**:
- **Schema Evolution**: Adding optional fields is safe, removing/renaming breaks compatibility
- **Tool Renaming**: Would break all OpenCode callsites
- **Mitigation**: MCP protocol supports version negotiation (not currently used)

### Resilience

**Error Handling**:
```typescript
// repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts:73-110
try {
  const metabobClient = clients["metabob"]
  if (!metabobClient) {
    Log.debug("[impulse-create] Metabob MCP client not configured, skipping sync")
    return  // Best-effort: no error thrown
  }
  
  const result = await metabobClient.callTool({...})
  
  if (result.includes('"status":"success"')) {
    Log.info("[impulse-create] Impulse synced to backend")
  } else {
    Log.warn("[impulse-create] Backend sync failed", result)
  }
} catch (error) {
  Log.warn("[impulse-create] Failed to sync impulse to backend", error)
  // No throw - best-effort sync
}
```

**Patterns**:
1. **Best-Effort Sync**: Backend failure doesn't fail local operation
2. **Graceful Degradation**: Missing MCP client → skip sync, continue
3. **Logging**: All failures logged for debugging
4. **No Retries**: Single attempt (CLI tool may have internal retries)

**Timeout**: MCP client has configurable timeout (default: 30s in CLI HTTP client)

---

## Boundary 2: Service Boundary - CLI ↔ RPC API (HTTP/REST)
**Type**: Service Boundary
**Location**: `metabob-cli` MCP tools | `metabob-rpc-api` FastAPI server
**Communication**: HTTP POST requests

### Contract

**CLI Side** (Python HTTP Client):
```python
# repos/metabob-cli/src/metabob_cli/mcp/tools.py:5384-5395
url = f"{base_url}/v2/impulses"
headers = {
    "X-API-Key": api_key,
    "Content-Type": "application/json"
}
payload = {
    "impulse_id": impulse_id,
    "project_id": project_id,
    "impulse_data": impulse_data
}

async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.post(url, headers=headers, json=payload)
```

**RPC API Side** (FastAPI Pydantic):
```python
# repos/metabob-rpc-api/server/routes/impulse.py:30-36
class ImpulseCreateRequest(BaseModel):
    impulse_id: str = Field(..., description="Unique impulse identifier")
    project_id: str = Field(..., description="Project identifier (git root hash)")
    impulse_data: dict = Field(..., description="Full impulse object")

@router.post("/v2/impulses", response_model=ImpulseResponse, status_code=201)
async def create_impulse_endpoint(
    request: ImpulseCreateRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    ...
```

**Response Contract**:
```python
class ImpulseResponse(BaseModel):
    impulse_id: str
    api_key: str
    project_id: str
    impulse_data: dict
    created_at: str  # ISO 8601
    updated_at: str  # ISO 8601
```

**HTTP Semantics**:
- **Method**: POST (create resource)
- **Success**: 201 Created
- **Duplicate**: 400 Bad Request
- **Server Error**: 500 Internal Server Error
- **Auth Failure**: 401 Unauthorized (if implemented)

### Coupling

**Level**: **Medium**

**Reasons**:
1. **REST Convention**: Follows standard HTTP/REST patterns
2. **Versioned API**: `/v2/` prefix allows backward compatibility
3. **Schema Validation**: Pydantic auto-validates, auto-documents (OpenAPI)
4. **Separate Deployment**: CLI and RPC API can be deployed independently

**Coupling Points**:
1. **URL Path**: `/v2/impulses` (if changed, CLI breaks)
2. **Header Name**: `X-API-Key` (if renamed, breaks auth)
3. **Request/Response Schema**: Pydantic models define contract
4. **HTTP Status Codes**: CLI expects 201 for success

**Versioning Concerns**:
- **API Version**: `/v2/` allows deploying v3 alongside v2
- **Schema Evolution**: Adding optional fields is safe, removing breaks compatibility
- **Breaking Changes**: New major version (e.g., `/v3/`) should be introduced
- **Current State**: No version negotiation in headers (relies on URL path)

### Resilience

**Error Handling** (CLI Side):
```python
# repos/metabob-cli/src/metabob_cli/mcp/tools.py:5397-5420
if response.status_code == 201:
    result = response.json()
    return json.dumps({
        "status": "success",
        "impulse_id": impulse_id,
        "created_at": result.get("created_at"),
        "message": "Impulse stored in backend - accessible from any instance"
    })
else:
    error_detail = response.text
    logger.error(f"[metabob_impulse_store] Failed: {response.status_code} - {error_detail}")
    return json.dumps({
        "status": "error",
        "error": f"Backend returned {response.status_code}: {error_detail}"
    })
```

**Error Handling** (RPC API Side):
```python
# repos/metabob-rpc-api/server/routes/impulse.py:104-125
# Check if impulse already exists
existing = get_impulse(request.impulse_id, x_api_key, request.project_id)
if existing:
    logger.warning(f"Impulse already exists: {request.impulse_id}")
    raise HTTPException(
        status_code=400,
        detail=f"Impulse {request.impulse_id} already exists for this project"
    )

try:
    result = create_impulse(
        impulse_id=request.impulse_id,
        api_key=x_api_key,
        project_id=request.project_id,
        impulse_data=request.impulse_data
    )
    return result
except Exception as e:
    logger.error(f"Failed to create impulse: {e}")
    raise HTTPException(status_code=500, detail="Internal server error")
```

**Patterns**:
1. **Timeout**: 30s timeout in CLI (prevents indefinite hangs)
2. **Status Code Handling**: CLI checks 201 specifically
3. **Error Propagation**: RPC API raises HTTPException with details
4. **Logging**: Both sides log errors for debugging
5. **Idempotency**: Duplicate check prevents overwriting existing data
6. **No Retries**: CLI doesn't retry failed requests (could be improved)

**Missing Resilience**:
- **Circuit Breaker**: No circuit breaker pattern (repeated failures don't disable backend sync)
- **Rate Limiting**: No rate limiting on client side
- **Exponential Backoff**: No retry logic with backoff

---

## Boundary 3: Layer Boundary - RPC API Route → DB Operations
**Type**: Layer Boundary (Controller → Repository pattern)
**Location**: `server/routes/impulse.py` | `server/db/operations/impulse_data.py`
**Communication**: Python async function calls

### Contract

**Route Handler (Controller)**:
```python
# repos/metabob-rpc-api/server/routes/impulse.py:113-126
from server.db.operations.impulse_data import create_impulse, get_impulse

@router.post("/v2/impulses", ...)
async def create_impulse_endpoint(
    request: ImpulseCreateRequest,
    x_api_key: str = Header(...),
):
    # Duplicate check
    existing = get_impulse(request.impulse_id, x_api_key, request.project_id)
    if existing:
        raise HTTPException(status_code=400, ...)
    
    # Create impulse
    result = create_impulse(
        impulse_id=request.impulse_id,
        api_key=x_api_key,
        project_id=request.project_id,
        impulse_data=request.impulse_data
    )
    return result
```

**Database Operations (Repository)**:
```python
# repos/metabob-rpc-api/server/db/operations/impulse_data.py:23-79
async def create_impulse(
    impulse_id: str,
    api_key: str,
    project_id: str,
    impulse_data: dict,
) -> dict:
    """
    Create impulse with (api_key, project_id) scoping.
    
    Returns:
        Created impulse record with timestamps
    """
    db = await get_surreal_client()
    
    data = {
        "impulse_id": impulse_id,
        "api_key": api_key,
        "project_id": project_id,
        "impulse_data": impulse_data,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    result = await db.create("impulse_data", data)
    return result
```

### Coupling

**Level**: **Medium (moving toward Loose)**

**Reasons**:
1. **Function Calls**: Direct Python imports (tighter than HTTP)
2. **Repository Pattern**: DB operations layer abstracts database details
3. **Type Hints**: Python type hints provide contract documentation
4. **Same Deployment Unit**: Both layers in same FastAPI app

**Coupling Points**:
1. **Function Signature**: `create_impulse(impulse_id, api_key, project_id, impulse_data)`
2. **Return Type**: Expects dict with database fields
3. **Exception Handling**: DB layer can raise exceptions caught by route layer

**Decoupling Benefits**:
- **Database Abstraction**: Route layer doesn't know about SurrealDB specifics
- **Testability**: DB operations can be mocked in route tests
- **Swappable**: Could switch from SurrealDB to PostgreSQL by changing operations layer

**Versioning Concerns**:
- **Internal API**: Not versioned (same codebase)
- **Breaking Changes**: Require coordinated updates to both layers
- **Mitigation**: Python type hints + tests catch signature mismatches

### Resilience

**Error Handling**:
```python
# Route layer wraps in try-catch
try:
    result = create_impulse(...)
    return result
except Exception as e:
    logger.error(f"Failed to create impulse: {e}")
    raise HTTPException(status_code=500, detail="Internal server error")
```

**Patterns**:
1. **Exception Propagation**: DB exceptions bubble up to route layer
2. **Generic Catch**: Route layer catches all exceptions (could be more specific)
3. **Logging**: Errors logged before re-raising as HTTPException
4. **No Retries**: Database failures not retried (SurrealDB connection pool handles reconnects)

**Missing Resilience**:
- **Specific Exception Types**: Could catch `ConnectionError`, `TimeoutError` separately
- **Transaction Support**: No explicit transactions (SurrealDB operations are atomic by default)

---

## Boundary 4: Data Store Boundary - DB Operations ↔ SurrealDB
**Type**: Data Store Boundary
**Location**: `server/db/operations/impulse_data.py` | SurrealDB instance
**Communication**: SurrealDB Python driver (async)

### Contract

**Python Driver Interface**:
```python
# repos/metabob-rpc-api/server/db/surrealdb_client.py
from surrealdb import Surreal

async def get_surreal_client() -> Surreal:
    """
    Returns SurrealDB client (connection pool singleton).
    
    Connection string from environment:
        SURREALDB_URL=ws://localhost:8000/rpc
        SURREALDB_NAMESPACE=metabob
        SURREALDB_DATABASE=devbob
    """
    if not _surreal_client:
        _surreal_client = Surreal(SURREALDB_URL)
        await _surreal_client.connect()
        await _surreal_client.use(SURREALDB_NAMESPACE, SURREALDB_DATABASE)
    
    return _surreal_client
```

**Database Operations**:
```python
# repos/metabob-rpc-api/server/db/operations/impulse_data.py:76
result = await db.create("impulse_data", data)

# Query operations
results = await db.query(
    """
    SELECT * FROM impulse_data 
    WHERE impulse_id = $impulse_id 
      AND api_key = $api_key 
      AND project_id = $project_id
    """,
    {"impulse_id": impulse_id, "api_key": api_key, "project_id": project_id}
)
```

**Table Schema** (SurrealDB):
```sql
-- Table: impulse_data
DEFINE TABLE impulse_data SCHEMAFULL;

-- Fields
DEFINE FIELD impulse_id ON impulse_data TYPE string;
DEFINE FIELD api_key ON impulse_data TYPE string;
DEFINE FIELD project_id ON impulse_data TYPE string;
DEFINE FIELD impulse_data ON impulse_data TYPE object;
DEFINE FIELD created_at ON impulse_data TYPE datetime;
DEFINE FIELD updated_at ON impulse_data TYPE datetime;

-- Indexes (composite key for multi-tenant isolation)
DEFINE INDEX idx_composite ON impulse_data 
    FIELDS api_key, project_id, impulse_id UNIQUE;
```

### Coupling

**Level**: **Medium (Database-specific)**

**Reasons**:
1. **SurrealDB Driver**: Uses SurrealDB-specific Python client
2. **SurrealQL**: Query language is SurrealDB-specific
3. **WebSocket Protocol**: Driver uses WebSocket (ws://) for real-time features
4. **Schema Definition**: SurrealDB schema language (DEFINE TABLE, DEFINE FIELD)

**Coupling Points**:
1. **Driver API**: `db.create()`, `db.query()` are SurrealDB-specific
2. **Query Language**: SurrealQL (similar to SQL but with differences)
3. **Connection String**: `ws://localhost:8000/rpc` (SurrealDB format)
4. **Type System**: SurrealDB types (object, datetime, string)

**Abstraction Level**:
- **No ORM**: Direct driver usage (no SQLAlchemy/Tortoise ORM abstraction)
- **Repository Pattern**: Operations layer provides some abstraction
- **Migration Path**: Switching databases would require rewriting operations layer

**Versioning Concerns**:
- **Driver Version**: `surrealdb` Python package version matters
- **Database Version**: SurrealDB server version compatibility
- **Schema Migrations**: No migration framework (manual schema updates)
- **Breaking Changes**: SurrealDB API changes require code updates

### Resilience

**Connection Pooling**:
```python
# Singleton pattern for connection pool
_surreal_client = None

async def get_surreal_client() -> Surreal:
    global _surreal_client
    if not _surreal_client:
        _surreal_client = Surreal(SURREALDB_URL)
        await _surreal_client.connect()
        await _surreal_client.use(SURREALDB_NAMESPACE, SURREALDB_DATABASE)
    
    return _surreal_client
```

**Error Handling**:
```python
# No explicit error handling in operations layer
# Relies on driver to raise exceptions on connection failures
result = await db.create("impulse_data", data)
# If fails, exception propagates to route layer
```

**Patterns**:
1. **Connection Pool**: Singleton client reused across requests
2. **Async I/O**: Non-blocking database operations
3. **Parameterized Queries**: Prevents SQL injection (e.g., `$impulse_id`)
4. **Composite Key Index**: Enforces uniqueness at database level

**Missing Resilience**:
- **Connection Retry**: No explicit reconnection logic (driver may handle internally)
- **Health Checks**: No periodic health checks on connection
- **Timeout Configuration**: No explicit query timeouts
- **Circuit Breaker**: No circuit breaker for database failures
- **Fallback**: No fallback to secondary database or cache

---

## Boundary 5: Repository Boundary - CLI ↔ RPC API Deployment
**Type**: Repository Boundary (Deployment)
**Location**: `metabob-cli` (user machine) | `metabob-rpc-api` (server/k8s)
**Communication**: Network (HTTP over internet)

### Contract

**Deployment Configuration** (CLI):
```python
# ~/.config/metabob/config.json
{
  "metabob_api_key": "sk_test_abc123...",
  "metabob_url": "https://api.metabob.com"  # or http://localhost:8001
}
```

**Deployment Configuration** (RPC API):
```bash
# Environment variables
SURREALDB_URL=ws://surrealdb:8000/rpc
SURREALDB_NAMESPACE=metabob
SURREALDB_DATABASE=devbob
API_PORT=8001
```

**Network Requirements**:
- **CLI → RPC API**: Outbound HTTPS (port 443) or HTTP (port 8001)
- **RPC API → SurrealDB**: Internal network (port 8000)
- **Authentication**: API key in `X-API-Key` header

### Coupling

**Level**: **Loose (Network-based)**

**Reasons**:
1. **Network Separation**: CLI runs on user machine, RPC API on server
2. **Protocol-based**: HTTP/REST (standard, interoperable)
3. **Independent Deployment**: CLI and RPC API can be deployed separately
4. **Version Skew**: CLI version X can talk to RPC API version Y (within same major version)

**Coupling Points**:
1. **Base URL**: CLI must know RPC API endpoint
2. **API Version**: `/v2/` in URL path
3. **API Key**: Shared secret for authentication

**Versioning Strategy**:
- **URL Versioning**: `/v2/` prefix allows multiple versions
- **Backward Compatibility**: v2 API should remain compatible
- **Deprecation**: Old versions can be marked deprecated, removed later

### Resilience

**Network Resilience** (CLI Side):
```python
# 30s timeout
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.post(url, headers=headers, json=payload)
```

**Patterns**:
1. **Timeout**: 30s timeout prevents indefinite hangs
2. **HTTPS**: Encrypted transport (production)
3. **No Retries**: CLI doesn't retry on network failure (user can retry manually)
4. **Graceful Degradation**: OpenCode continues if backend sync fails

**Missing Resilience**:
- **Connection Pooling**: New client created per request (inefficient)
- **Retry Logic**: No exponential backoff for transient failures
- **Circuit Breaker**: No circuit breaker for repeated failures
- **Health Check**: No health check endpoint for pre-flight validation

---

## Boundary 6: Data Store Boundary - Local Storage ↔ File System
**Type**: Data Store Boundary
**Location**: OpenCode `Storage.write()` | File system
**Communication**: Node.js `fs` module

### Contract

**Storage Interface**:
```typescript
// repos/metabob-opencode/packages/opencode/src/storage/index.ts
export namespace Storage {
  export function write(path: string[], data: unknown): void {
    const filePath = join(storageDir, ...path) + ".json"
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8")
  }
  
  export function read(path: string[]): unknown | undefined {
    const filePath = join(storageDir, ...path) + ".json"
    if (!fs.existsSync(filePath)) return undefined
    return JSON.parse(fs.readFileSync(filePath, "utf-8"))
  }
}
```

**File Structure**:
```
~/.opencode/storage/
  activity/
    {activityId}.json
  activity-template/
    {templateId}.json
  session/
    info/
      {sessionId}.json
```

### Coupling

**Level**: **Tight (File System)**

**Reasons**:
1. **Direct File I/O**: No abstraction layer (direct `fs` calls)
2. **Path Convention**: Hardcoded `~/.opencode/storage/` path
3. **JSON Format**: Data stored as JSON (tightly coupled to format)
4. **Synchronous I/O**: Blocking file writes (no async)

**Coupling Points**:
1. **File Path**: `~/.opencode/storage/` (changing breaks existing data)
2. **JSON Format**: Data must be JSON-serializable
3. **File Extension**: `.json` suffix required

**Versioning Concerns**:
- **No Schema Version**: JSON files don't include schema version
- **Breaking Changes**: Changing object structure breaks deserialization
- **Migration**: No migration framework for schema changes

### Resilience

**Error Handling**:
```typescript
// Minimal error handling
try {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8")
} catch (error) {
  // Error propagates to caller
  throw error
}
```

**Patterns**:
1. **Atomic Writes**: `writeFileSync` is atomic at OS level
2. **Directory Creation**: Ensures parent directories exist
3. **No Locking**: No file locking (could cause race conditions)
4. **No Backups**: No automatic backups of storage files

**Missing Resilience**:
- **Concurrent Access**: No locking mechanism for concurrent writes
- **Corruption Recovery**: No checksums or validation
- **Quota Handling**: No handling of disk full errors
- **Backup Strategy**: No automatic backups

---

## Summary: Architectural Boundaries Analysis

### Boundary Classification by Coupling

| Boundary | Type | Coupling | Resilience | Versioning |
|----------|------|----------|------------|------------|
| OpenCode ↔ CLI (MCP) | Repository | **Loose** | Best-effort, graceful degradation | Tool names fragile, schema evolvable |
| CLI ↔ RPC API (HTTP) | Service | **Medium** | Timeout, error handling | URL versioning (`/v2/`) |
| Route ↔ DB Operations | Layer | **Medium** | Exception propagation | Internal API, no versioning |
| DB Ops ↔ SurrealDB | Data Store | **Medium** | Connection pool, parameterized queries | Driver version, no migrations |
| CLI ↔ RPC (Network) | Deployment | **Loose** | Timeout, no retries | URL versioning, backward compat |
| Storage ↔ File System | Data Store | **Tight** | Minimal, no backups | No schema versioning |

### Critical Findings

**1. Best-Effort Sync Architecture**:
- OpenCode → CLI → RPC API → SurrealDB is **non-blocking**
- Local storage succeeds first, backend sync is optional
- **Implication**: Backend failures don't fail user operations

**2. Multi-Tenant Isolation**:
- Enforced at **every boundary** via `(api_key, project_id, resource_id)`
- **RPC API**: Header extraction (`X-API-Key`)
- **Database**: Composite key index
- **Implication**: Cross-tenant data leaks prevented at multiple layers

**3. Versioning Strategy**:
- **Service Boundary**: URL versioning (`/v2/`) allows backward compatibility
- **Repository Boundary**: No version negotiation (tool names are fragile)
- **Data Store Boundary**: No schema versioning (file system, database)
- **Implication**: Breaking changes require coordinated updates

**4. Resilience Gaps**:
- **No Retries**: CLI doesn't retry failed HTTP requests
- **No Circuit Breaker**: Repeated backend failures don't disable sync
- **No Health Checks**: No pre-flight validation of backend availability
- **No Backups**: Local storage has no automatic backups
- **Implication**: Transient failures may lose sync opportunities

**5. Error Handling Patterns**:
- **OpenCode**: Try-catch with logging, continue on failure
- **CLI**: Status code checking, error JSON responses
- **RPC API**: HTTPException with status codes
- **Database**: Exception propagation (no specific handling)
- **Implication**: Errors are logged but not always actionable

### Recommendations for Improving Resilience

1. **Add Retry Logic**: CLI should retry transient failures with exponential backoff
2. **Circuit Breaker**: Disable backend sync after N consecutive failures
3. **Health Checks**: Add `/health` endpoint to RPC API for pre-flight checks
4. **Schema Versioning**: Add `version` field to JSON files and database records
5. **Backup Strategy**: Periodic backups of local storage to prevent data loss
6. **Connection Pooling**: Reuse HTTP client in CLI instead of creating per-request
7. **Specific Exception Types**: Catch `ConnectionError`, `TimeoutError` separately for better handling

