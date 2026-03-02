# Session Data Flow to SurrealDB - Dependency Chain

## Traced Flow: IMPULSE STORAGE

This trace follows the complete dependency chain from user action to database write.

---

## Flow Chain

### 1. **User Action** → impulse_create tool call
**Component**: User invokes `impulse_create()` tool in OpenCode session
**Input Type**: 
```typescript
{
  id: string,
  pointer: ImpulsePointer,
  budget: number,
  type?: string
}
```
**Output**: Tool execution confirmation
**Trigger**: User explicitly calls tool or activity template triggers it

---

### 2. **ImpulseCreateTool.execute()** - Creates impulse and syncs
**File**: `repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts:27`
**Component**: Tool handler function
**What it does**: 
- Validates impulse doesn't already exist
- Creates impulse object with metadata (sessionID, scope, timestamps)
- Writes to SessionMemory (read layer for TUI)
- Syncs to Activity.impulses (persistence layer)
- **Triggers backend sync via MCP**

**Input Type**:
```typescript
{
  id: string,
  pointer: ActivityTemplate.Impulse.Pointer,
  budget: number,
  priority: "high" | "medium" | "low",
  type?: string,
  metadata?: Record<string, unknown>
}
```

**Output Type**:
```typescript
{
  title: string,
  output: string,
  metadata: {
    success: boolean,
    impulse: ActivityTemplate.Impulse.Schema
  }
}
```

**Data Transformation**:
- Adds `sessionID`, `createdAt`, `createdBy` metadata
- Sets `loaded: false`, `scope: "session"`
- Calls `MCP.clients()["metabob"].callTool()` (line 86)

**Dependencies**:
- `SessionMemory.addImpulse()` - Session-scoped storage
- `syncImpulseToActivity()` - Activity persistence
- `MCP.clients()` - MCP client registry
- `Instance.project.id` - Project scoping

---

### 3. **MCP Client** → metabob_impulse_store
**File**: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts` (client wrapper)
**Component**: MCP protocol bridge
**What it does**: Serializes tool call and sends to CLI MCP server via stdio/SSE transport

**Input Type** (MCP protocol):
```json
{
  "name": "metabob_impulse_store",
  "arguments": {
    "impulse_id": "trace-storage-flow",
    "project_id": "proj_abc456",
    "impulse_data": { /* full impulse object */ }
  }
}
```

**Output Type**: MCP tool response (JSON string)
**Data Transformation**: None (passthrough)

---

### 4. **CLI MCP Tool** - metabob_impulse_store()
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py:5360`
**Component**: MCP tool handler (Python async function)
**What it does**:
- Reads configuration (api_key, base_url)
- Constructs HTTP request payload
- **Makes POST request to RPC API**
- Returns result or error

**Input Type**:
```python
{
  "impulse_id": str,
  "project_id": str,
  "impulse_data": dict  # Full impulse object
}
```

**Output Type**:
```python
{
  "status": "success" | "error",
  "impulse_id": str,
  "created_at": str (ISO timestamp),
  "message": str
}
```

**Data Transformation**:
- Adds `X-API-Key` header from config
- Wraps in HTTP payload structure
- HTTP POST to `{base_url}/v2/impulses` (line 5384)

**Dependencies**:
- `ConfigManager.get("metabob_api_key")` - Authentication
- `ConfigManager.get("metabob_url")` - RPC API endpoint
- `httpx.AsyncClient` - HTTP transport

---

### 5. **RPC API Endpoint** - POST /v2/impulses
**File**: `repos/metabob-rpc-api/server/routes/impulse.py:64`
**Component**: FastAPI route handler
**What it does**:
- Validates request schema (Pydantic)
- Extracts `X-API-Key` header for multi-tenant isolation
- Checks if impulse already exists (duplicate prevention)
- **Calls database operation layer**

**Input Type**:
```python
class ImpulseCreateRequest(BaseModel):
    impulse_id: str
    project_id: str
    impulse_data: dict
```

**HTTP Headers**: `X-API-Key: {user_api_key}`

**Output Type**:
```python
class ImpulseResponse(BaseModel):
    impulse_id: str
    api_key: str
    project_id: str
    impulse_data: dict
    created_at: str (ISO timestamp)
    updated_at: str (ISO timestamp)
```

**Data Transformation**:
- Validates input with Pydantic schema
- Passes `x_api_key` from header to DB layer
- Returns 201 Created on success, 400 if duplicate, 500 on error

**Dependencies**:
- `server.db.operations.impulse_data.create_impulse()` - Database write
- `server.db.operations.impulse_data.get_impulse()` - Duplicate check

---

### 6. **Database Operation** - create_impulse()
**File**: `repos/metabob-rpc-api/server/db/operations/impulse_data.py:23`
**Component**: SurrealDB write operation
**What it does**:
- Constructs database record with composite key
- Adds `created_at`, `updated_at` timestamps
- **Writes to SurrealDB table**
- Returns created record

**Input Type**:
```python
{
  "impulse_id": str,
  "api_key": str,
  "project_id": str,
  "impulse_data": dict
}
```

**Output Type**:
```python
{
  "impulse_id": str,
  "api_key": str,
  "project_id": str,
  "impulse_data": dict,
  "created_at": str (ISO),
  "updated_at": str (ISO)
}
```

**Data Transformation**:
- Adds `created_at: datetime.utcnow().isoformat()`
- Adds `updated_at: datetime.utcnow().isoformat()`
- Composite key: `(api_key, project_id, impulse_id)` for multi-tenant isolation

**Dependencies**:
- `get_surreal_client()` - SurrealDB connection pool
- SurrealDB async driver

---

### 7. **SurrealDB Client** - Database write
**File**: `repos/metabob-rpc-api/server/db/surrealdb_client.py`
**Component**: SurrealDB connection and query execution
**What it does**:
- Maintains connection pool to SurrealDB instance
- Executes `db.create("impulse_data", data)` operation
- Returns persisted record with SurrealDB-generated ID

**Input Type**:
```python
{
  "table": "impulse_data",
  "data": {
    "impulse_id": str,
    "api_key": str,
    "project_id": str,
    "impulse_data": dict,
    "created_at": str,
    "updated_at": str
  }
}
```

**Output Type**: SurrealDB record object
**Storage**: SurrealDB instance (multi-tenant, persistent, cross-instance)

**Data Transformation**: None (direct write to database)

**Dependencies**:
- SurrealDB server running (typically on port 8000 or via Docker)
- Database namespace/schema configured

---

## Complete Dependency Chain Summary

```
User Action
  ↓
[1] ImpulseCreateTool.execute()
    ├─ SessionMemory.addImpulse() (local read layer)
    ├─ syncImpulseToActivity() (local persistence)
    └─ MCP.clients()["metabob"].callTool()
       ↓
[2] MCP Protocol Bridge
    ↓ (stdio/SSE transport)
[3] metabob_impulse_store() (CLI Python)
    ├─ ConfigManager.get("metabob_api_key")
    ├─ ConfigManager.get("metabob_url")
    └─ httpx.AsyncClient.post()
       ↓ HTTP POST /v2/impulses
[4] create_impulse_endpoint() (FastAPI)
    ├─ Pydantic validation
    ├─ Header extraction (X-API-Key)
    ├─ get_impulse() (duplicate check)
    └─ create_impulse() (DB operation)
       ↓
[5] create_impulse() (DB operations layer)
    ├─ get_surreal_client()
    └─ db.create("impulse_data", data)
       ↓
[6] SurrealDB Client
    ↓ (async database write)
[7] SurrealDB Instance (persistent storage)
```

---

## Key Data Transformations

### Stage 1: User Input → Impulse Object
- **Adds**: `sessionID`, `createdBy`, `createdAt`, `loaded: false`, `scope: "session"`
- **Preserves**: `id`, `pointer`, `budget`, `type`, `priority`, `metadata`

### Stage 2: Impulse Object → MCP Call
- **Adds**: `project_id` from `Instance.project.id`
- **Wraps**: Full impulse object in `impulse_data` field

### Stage 3: MCP Call → HTTP Request
- **Adds**: `X-API-Key` header from config
- **Adds**: `Content-Type: application/json`
- **URL**: `{base_url}/v2/impulses`

### Stage 4: HTTP Request → Database Record
- **Adds**: `api_key` from header
- **Adds**: `created_at`, `updated_at` timestamps
- **Schema**: Composite key `(api_key, project_id, impulse_id)`

---

## Parallel Flows

The **ACTIVITY STORAGE FLOW** follows the identical pattern:

```
Activity.save()
  → metabob_activity_save (CLI MCP)
    → POST /v2/activities/storage
      → create_activity() (DB operation)
        → db.create("activity_data", data)
          → SurrealDB
```

The **TEMPLATE REGISTRATION FLOW** follows similar pattern:

```
ActivityTemplate.save()
  → autoRegisterWithMetabob()
    → metabob_register_activity_template (CLI MCP)
      → POST /v2/activities/templates
        → create_template_record() (DB operation)
          → db.create("activity_template", data)
            → SurrealDB (PRIMARY)
            → Redis (CACHE only, optional)
```

---

## Critical Dependencies

1. **MCP Client Availability**: `MCP.clients()["metabob"]` must exist
   - Configured in `opencode.json` under `mcp.metabob`
   - CLI must be running and accessible

2. **Authentication**: `X-API-Key` header required for all backend calls
   - Stored in CLI config via `metabob config set metabob_api_key`

3. **Project Context**: `Instance.project.id` must be available
   - Derived from git root hash
   - Used for multi-project isolation

4. **SurrealDB Connectivity**: RPC API must reach SurrealDB
   - Connection string in `.env` or environment
   - Database namespace/schema initialized

5. **Best-Effort Sync**: Backend sync failures are logged but non-fatal
   - Local storage succeeds first
   - Backend sync happens asynchronously
   - Errors logged but don't fail tool execution

---

## Query Path (Reverse Flow)

The retrieval flow is the reverse:

```
User calls metabob_impulse_load()
  → CLI: GET /v2/impulses/{impulse_id}?project_id={project_id}
    → RPC API: get_impulse_endpoint()
      → DB: get_impulse() with WHERE clause
        → SurrealDB: SELECT * FROM impulse_data 
            WHERE impulse_id = $id 
            AND api_key = $key 
            AND project_id = $project
  ← Returns impulse_data dict
```

**Critical**: All queries enforce composite key matching to prevent cross-tenant data leaks.

