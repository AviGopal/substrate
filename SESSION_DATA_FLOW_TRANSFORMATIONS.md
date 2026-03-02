# Session Data Flow to SurrealDB - Data Transformations

This document traces ALL data transformations in the Session Data Flow, documenting WHAT changes, WHY it changes, and the business/technical constraints at each step.

---

## Transformation 1: User Input → Impulse Object
**Component**: `ImpulseCreateTool.execute()` (impulse-create.ts:48-63)
**Layer**: OpenCode Application Layer

### What Changes:

**Input Type** (User-provided):
```typescript
{
  id: string,
  pointer: ImpulsePointer,
  budget: number,
  priority?: "high" | "medium" | "low",
  type?: string,
  metadata?: Record<string, unknown>
}
```

**Output Type** (Internal Impulse Object):
```typescript
{
  id: string,
  type: string,
  pointer: ImpulsePointer,
  budget: number,
  priority: "high" | "medium" | "low",
  loaded: false,                              // ← ADDED
  metadata: {
    ...params.metadata,
    createdBy: string | undefined,           // ← ADDED
    createdAt: number,                       // ← ADDED
  },
  scope: "session",                           // ← ADDED
  sessionID: string,                          // ← ADDED
}
```

### Transformations Applied:

1. **Type Inference** (line 50):
   - `type = params.type || params.pointer.type`
   - Falls back to pointer type if not explicitly provided
   - **Why**: Allows users to omit redundant type specification

2. **Priority Default** (Zod schema):
   - `priority: z.enum(["high", "medium", "low"]).default("medium")`
   - **Why**: Ensures all impulses have priority for load scheduling

3. **Metadata Enrichment** (lines 55-60):
   - **Adds `createdBy`**: `Activity.getActivityForSession(sessionID)`
     - **Why**: Track which activity created impulse (provenance, metrics, debugging)
   - **Adds `createdAt`**: `Date.now()`
     - **Why**: Timestamp for lifecycle tracking, TTL, age-based cleanup

4. **Scope Assignment** (line 61):
   - **Sets `scope: "session"`**
   - **Why**: Determines storage location (SessionMemory vs Activity.impulses)
   - **Business Constraint**: Session-scoped impulses are isolated from activity-scoped ones

5. **Session Linking** (line 62):
   - **Sets `sessionID: context.sessionID`**
   - **Why**: Enables SessionMemory lookup, lifecycle management, cleanup on session end

6. **Load State** (line 54):
   - **Sets `loaded: false`**
   - **Why**: Impulses use lazy loading - content resolved on-demand to save memory

### Validations:

1. **Duplicate Check** (lines 34-45):
   - `SessionMemory.getImpulse(sessionID, params.id)`
   - **Constraint**: Impulse IDs must be unique per session
   - **Why**: Prevents overwriting existing impulses, ensures referential integrity

2. **Schema Validation** (Zod):
   - `pointer` must match one of 14 discriminated union types
   - `budget` must be positive number
   - **Why**: Type safety, prevents malformed pointers from reaching resolution

### Side Effects:

1. **SessionMemory Write** (line 66):
   - `SessionMemory.addImpulse(sessionID, impulse)`
   - **Why**: TUI needs immediate access for sidebar display
   - **Storage**: In-memory map, ephemeral

2. **Activity Sync** (line 69):
   - `syncImpulseToActivity(sessionID, impulse)`
   - **Why**: Activity templates need impulses persisted with activity state
   - **Storage**: Activity.impulses array, written to local storage

3. **Event Bus** (line 113):
   - `Bus.publish(Session.Event.ImpulseUpdated, {...})`
   - **Why**: Notify subscribers (TUI, metrics, etc.) of impulse creation

### Why This Transformation Exists:

**Business Requirements**:
- **Provenance Tracking**: Know which activity created which impulses
- **Lifecycle Management**: Impulses tied to session/activity lifecycle
- **Lazy Loading**: Defer expensive content resolution until needed

**Technical Constraints**:
- **Memory Efficiency**: Don't load all impulse content eagerly
- **Session Isolation**: Session-scoped impulses shouldn't leak to other sessions
- **Type Safety**: Zod schema enforces compile-time and runtime validation

---

## Transformation 2: Impulse Object → MCP Call Arguments
**Component**: `ImpulseCreateTool.execute()` → `MCP.clients()["metabob"].callTool()` (impulse-create.ts:86-93)
**Layer**: OpenCode → CLI MCP Bridge

### What Changes:

**Input** (Full Impulse Object):
```typescript
{
  id: string,
  type: string,
  pointer: ImpulsePointer,
  budget: number,
  priority: "high" | "medium" | "low",
  loaded: false,
  metadata: {...},
  scope: "session",
  sessionID: string,
}
```

**Output** (MCP Tool Arguments):
```typescript
{
  name: "metabob_impulse_store",
  arguments: {
    impulse_id: string,              // ← Field name change (id → impulse_id)
    project_id: string,              // ← ADDED (from Instance.project.id)
    impulse_data: { /* full object */ }  // ← WRAPPED
  }
}
```

### Transformations Applied:

1. **Field Rename** (line 89):
   - `id` → `impulse_id`
   - **Why**: Python snake_case naming convention, API consistency

2. **Project Context Injection** (line 78):
   - **Adds `project_id: Instance.project.id`**
   - **Why**: Multi-project isolation, SurrealDB composite key scoping
   - **Source**: Git root hash (deterministic, instance-invariant)

3. **Data Wrapping** (line 91):
   - Full impulse object wrapped in `impulse_data` field
   - **Why**: Separate metadata (`impulse_id`, `project_id`) from payload
   - **Alternative Considered**: Flatten all fields (rejected: pollutes namespace, harder to version)

### Validations:

1. **MCP Client Availability** (line 75):
   - `const metabobClient = clients["metabob"]`
   - **Constraint**: MCP client must be configured in `opencode.json`
   - **Why**: Backend sync is optional (best-effort), local storage succeeds first

2. **Project ID Presence**:
   - `Instance.project.id` must exist (derived from git root)
   - **Why**: Backend requires project scoping for multi-tenant isolation

### Side Effects:

1. **Best-Effort Sync** (try-catch wrapper, lines 73-110):
   - Failure logged but doesn't fail tool execution
   - **Why**: Local storage is source of truth, backend sync is cross-instance convenience
   - **Business Decision**: Don't block user on network failures

2. **Logging** (lines 79-82, 95-98):
   - Debug logs for sync start, info logs for success
   - **Why**: Debugging distributed systems, observability

### Why This Transformation Exists:

**Business Requirements**:
- **Multi-Project Isolation**: Different git repos must have isolated data
- **Cross-Instance Access**: Other devbob instances need access to impulses

**Technical Constraints**:
- **MCP Protocol**: Tool arguments must be JSON-serializable
- **API Versioning**: Wrapping allows schema evolution without breaking changes
- **Naming Conventions**: Python backend uses snake_case

---

## Transformation 3: MCP Arguments → HTTP Request
**Component**: `metabob_impulse_store()` (tools.py:5372-5395)
**Layer**: CLI MCP Tool → RPC API

### What Changes:

**Input** (MCP Arguments):
```python
{
  "impulse_id": str,
  "project_id": str,
  "impulse_data": dict
}
```

**Output** (HTTP Request):
```http
POST {base_url}/v2/impulses
Headers:
  X-API-Key: {api_key}
  Content-Type: application/json
Body:
{
  "impulse_id": str,
  "project_id": str,
  "impulse_data": dict
}
```

### Transformations Applied:

1. **Authentication Header Injection** (line 5385):
   - **Adds `X-API-Key: {config.get("metabob_api_key")}`**
   - **Why**: Multi-tenant isolation, user authentication
   - **Source**: CLI config storage (`~/.config/metabob/config.json`)

2. **URL Construction** (line 5384):
   - `url = f"{base_url}/v2/impulses"`
   - **Why**: REST API versioning, endpoint routing
   - **Default**: `https://api.metabob.com` (production SaaS)

3. **Content-Type Header** (line 5385):
   - **Adds `Content-Type: application/json`**
   - **Why**: FastAPI Pydantic deserialization requires content type

4. **Timeout Configuration** (line 5394):
   - `httpx.AsyncClient(timeout=30.0)`
   - **Why**: Prevent indefinite hangs on network issues
   - **Value**: 30 seconds (backend writes are fast, allows for retries)

### Validations:

1. **API Key Check** (lines 5377-5380):
   - `if not api_key: return {"status": "error", ...}`
   - **Constraint**: API key is REQUIRED for all backend calls
   - **Why**: Multi-tenant isolation, prevents unauthorized access

2. **HTTP Status Code** (line 5397):
   - `if response.status_code == 201: ...`
   - **Expected**: 201 Created (success)
   - **Alternatives**: 400 (duplicate), 500 (server error)

### Side Effects:

1. **Network I/O** (line 5395):
   - HTTP POST to remote RPC API server
   - **Latency**: Depends on network (local: ~1ms, remote: ~50-200ms)

2. **Logging** (lines 5392, 5399, 5413):
   - Info logs for request/success, error logs for failure
   - **Why**: Debugging network issues, audit trail

### Why This Transformation Exists:

**Business Requirements**:
- **Multi-Tenant SaaS**: Each user has isolated data (API key scoping)
- **Cross-Instance Sharing**: Store data in centralized backend

**Technical Constraints**:
- **HTTP Protocol**: REST API standard for inter-service communication
- **Authentication**: Header-based API key (simple, stateless)
- **Timeouts**: Prevent resource leaks from hung connections

---

## Transformation 4: HTTP Request → Pydantic Model
**Component**: `create_impulse_endpoint()` (impulse.py:64-102)
**Layer**: RPC API Route Handler

### What Changes:

**Input** (HTTP Request):
```json
POST /v2/impulses
Headers: X-API-Key: sk_test_123
Body: {
  "impulse_id": "trace-flow",
  "project_id": "proj_abc",
  "impulse_data": {...}
}
```

**Output** (Pydantic Models):
```python
request: ImpulseCreateRequest {
  impulse_id: str,
  project_id: str,
  impulse_data: dict
}
x_api_key: str  # Extracted from header
```

### Transformations Applied:

1. **Pydantic Validation** (lines 30-35):
   - **Validates `impulse_id` is string**
   - **Validates `project_id` is string**
   - **Validates `impulse_data` is dict**
   - **Why**: Type safety, prevent malformed requests from reaching DB layer

2. **Header Extraction** (line 67):
   - `x_api_key: str = Header(..., alias="X-API-Key")`
   - **Why**: Multi-tenant isolation key, separate from request body
   - **Constraint**: Header is REQUIRED (`...` = required field)

3. **Field Descriptions** (Pydantic Field):
   - Each field has docstring description
   - **Why**: Auto-generated OpenAPI docs, developer UX

### Validations:

1. **Schema Validation** (Pydantic automatic):
   - Missing required fields → 422 Unprocessable Entity
   - Wrong types → 422 Unprocessable Entity
   - **Why**: Fail fast, clear error messages

2. **Duplicate Check** (lines 104-111):
   - `existing = get_impulse(request.impulse_id, x_api_key, request.project_id)`
   - **Constraint**: No duplicate `(api_key, project_id, impulse_id)` tuples
   - **Why**: Idempotency, prevent overwriting existing data

### Side Effects:

1. **Database Read** (line 105):
   - Duplicate check queries SurrealDB
   - **Cost**: ~1ms query latency

2. **Logging** (lines 99-101):
   - Log request with truncated API key (`[:8]...`)
   - **Why**: Audit trail, debugging, security (don't log full keys)

### Why This Transformation Exists:

**Business Requirements**:
- **API Versioning**: `/v2/` prefix allows backward compatibility
- **Data Integrity**: Prevent duplicate writes

**Technical Constraints**:
- **FastAPI Framework**: Pydantic models auto-validate and document APIs
- **Security**: Header-based auth separates credentials from payload
- **Type Safety**: Pydantic prevents type mismatches at API boundary

---

## Transformation 5: Pydantic Model → Database Record
**Component**: `create_impulse()` (impulse_data.py:23-79)
**Layer**: Database Operations Layer

### What Changes:

**Input** (Function Arguments):
```python
{
  "impulse_id": str,
  "api_key": str,
  "project_id": str,
  "impulse_data": dict
}
```

**Output** (SurrealDB Record):
```python
{
  "impulse_id": str,
  "api_key": str,
  "project_id": str,
  "impulse_data": dict,
  "created_at": "2026-03-02T09:30:00.123456Z",  # ← ADDED
  "updated_at": "2026-03-02T09:30:00.123456Z",  # ← ADDED
}
```

### Transformations Applied:

1. **Timestamp Injection** (lines 65-66):
   - **Adds `created_at: datetime.utcnow().isoformat()`**
   - **Adds `updated_at: datetime.utcnow().isoformat()`**
   - **Why**: Audit trail, data lifecycle, TTL policies
   - **Format**: ISO 8601 UTC (e.g., `2026-03-02T09:30:00.123456Z`)

2. **Composite Key Structure** (line 60-67):
   - All fields preserved for composite key matching
   - **Key**: `(api_key, project_id, impulse_id)`
   - **Why**: Multi-tenant isolation, efficient lookups

### Validations:

**None** - Validation already done at API layer

### Side Effects:

1. **SurrealDB Write** (line 76):
   - `await db.create("impulse_data", data)`
   - **Table**: `impulse_data`
   - **Persistence**: Durable write to disk
   - **Cost**: ~1-5ms write latency (local), ~10-50ms (remote)

2. **Logging** (lines 69-72, 78):
   - Info logs with truncated API key
   - **Why**: Debugging, observability

### Why This Transformation Exists:

**Business Requirements**:
- **Audit Trail**: Track when data was created/modified
- **Data Lifecycle**: Enable TTL policies, cleanup old data
- **Multi-Tenant Isolation**: Composite key prevents cross-tenant leaks

**Technical Constraints**:
- **SurrealDB Schema**: Table structure requires timestamps for queries
- **ISO 8601 Format**: Standard, sortable, timezone-aware

---

## Transformation 6: Database Record → HTTP Response
**Component**: `create_impulse_endpoint()` (impulse.py:113-126)
**Layer**: RPC API Route Handler → HTTP Response

### What Changes:

**Input** (Database Record):
```python
{
  "impulse_id": str,
  "api_key": str,
  "project_id": str,
  "impulse_data": dict,
  "created_at": str,
  "updated_at": str
}
```

**Output** (HTTP Response):
```http
HTTP/1.1 201 Created
Content-Type: application/json
Body: {
  "impulse_id": str,
  "api_key": str,
  "project_id": str,
  "impulse_data": dict,
  "created_at": str,
  "updated_at": str
}
```

### Transformations Applied:

1. **Status Code** (decorator `status_code=201`):
   - Returns `201 Created` on success
   - **Why**: REST standard - 201 indicates resource creation

2. **Pydantic Serialization** (response_model):
   - `response_model=ImpulseResponse`
   - **Why**: Ensures response matches schema, auto-generates OpenAPI docs

### Validations:

**None** - Data already validated

### Side Effects:

1. **Logging** (line 120):
   - `logger.info(f"Impulse created successfully: {request.impulse_id}")`
   - **Why**: Success audit trail

### Why This Transformation Exists:

**Business Requirements**:
- **API Contract**: Clients expect consistent response schema
- **OpenAPI Documentation**: Auto-generated docs from Pydantic models

**Technical Constraints**:
- **REST Standards**: 201 Created is standard for resource creation
- **JSON Serialization**: Pydantic handles type conversion to JSON

---

## Transformation 7: HTTP Response → MCP Tool Result
**Component**: `metabob_impulse_store()` (tools.py:5397-5409)
**Layer**: CLI MCP Tool → OpenCode

### What Changes:

**Input** (HTTP Response):
```json
{
  "impulse_id": str,
  "api_key": str,
  "project_id": str,
  "impulse_data": dict,
  "created_at": str,
  "updated_at": str
}
```

**Output** (MCP Tool Result):
```json
{
  "status": "success",
  "impulse_id": str,
  "created_at": str,
  "message": "Impulse stored in backend - accessible from any instance"
}
```

### Transformations Applied:

1. **Response Simplification** (lines 5402-5408):
   - **Drops**: `api_key`, `project_id`, `impulse_data`, `updated_at`
   - **Keeps**: `impulse_id`, `created_at`
   - **Adds**: `status: "success"`, `message: str`
   - **Why**: Reduce response size, user-friendly message

2. **JSON Serialization** (line 5402):
   - `return json.dumps({...})`
   - **Why**: MCP protocol requires string responses

### Validations:

1. **Status Code Check** (line 5397):
   - `if response.status_code == 201: ...`
   - **Why**: Only return success if HTTP 201 received

### Side Effects:

1. **Logging** (lines 5399-5400):
   - Info log for successful storage

### Why This Transformation Exists:

**Business Requirements**:
- **User Experience**: Simple success/error messages
- **Response Size**: Don't send redundant data back to client

**Technical Constraints**:
- **MCP Protocol**: Tool results must be JSON strings
- **Network Efficiency**: Minimize response payload

---

## Summary of All Transformations

### Data Additions Across Pipeline:

1. **OpenCode** → **MCP**:
   - Adds: `createdBy`, `createdAt`, `loaded: false`, `scope`, `sessionID`, `project_id`

2. **MCP** → **HTTP**:
   - Adds: `X-API-Key` header, `Content-Type` header

3. **HTTP** → **Database**:
   - Adds: `created_at`, `updated_at` (server timestamps)

4. **Database** → **Response**:
   - Removes: None (all fields returned)

5. **Response** → **MCP Result**:
   - Removes: `api_key`, `project_id`, `impulse_data`, `updated_at`
   - Adds: `status`, `message`

### Critical Business Constraints:

1. **Multi-Tenant Isolation**: `(api_key, project_id, impulse_id)` composite key enforced at ALL layers
2. **Idempotency**: Duplicate checks prevent overwriting existing data
3. **Best-Effort Sync**: Backend failures don't fail local operations
4. **Lazy Loading**: Impulse content not loaded until resolution time
5. **Audit Trail**: Timestamps added at DB layer for lifecycle tracking

### Validation Gates:

| Layer | Validation | Constraint |
|-------|------------|-----------|
| OpenCode | Duplicate check | No duplicate `(sessionID, id)` |
| OpenCode | Zod schema | Pointer type validation |
| CLI MCP | API key check | Required for backend sync |
| RPC API | Pydantic schema | Type validation |
| RPC API | Duplicate check | No duplicate `(api_key, project_id, impulse_id)` |
| Database | None | Trust upstream validation |

### Alternative Approaches Considered:

1. **Flatten MCP Arguments** (rejected):
   - Would pollute namespace, harder to version
   - Current wrapping (`impulse_data`) allows schema evolution

2. **Synchronous Backend Sync** (rejected):
   - Would block user on network failures
   - Current best-effort approach prioritizes local storage

3. **Eager Loading** (rejected):
   - Would consume too much memory for large impulses
   - Current lazy loading defers cost until needed

