# Session Data Flow to SurrealDB - Component Annotations

**Status**: Manual annotations (Metabob analysis service unavailable)
**Date**: 2026-03-02
**Purpose**: Document WHY critical components exist in the data persistence pipeline

---

## Annotated Components (5 Critical)

### 1. Entry Point: ImpulseCreateTool.execute()
**File**: `repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts`
**Component**: `ImpulseCreateTool` class, `execute()` method
**Location**: Lines 27-115

**Annotation**:

`ImpulseCreateTool.execute()` handles the **entry point** in Session Data Flow to SurrealDB pipeline.

**Data transformation**: 
- Input: User-provided `{id, pointer, budget, priority?, type?, metadata?}`
- Output: Enriched impulse object with `{sessionID, createdBy, createdAt, loaded: false, scope: "session", ...}`

**Business logic**: 
- Enforces uniqueness constraint (no duplicate impulse IDs per session)
- Implements lazy loading pattern (loaded: false until content resolved)
- Provides multi-storage strategy: SessionMemory (read layer) + Activity.impulses (persistence layer) + Backend (cross-instance sharing)

**Design decision**: 
- **Local-first architecture**: Local storage succeeds BEFORE backend sync attempted
- **Best-effort sync**: Backend failures logged but don't fail user operation
- **Why**: User productivity prioritized over cross-instance consistency. User can continue working offline, backend sync happens opportunistically.

**Constraints**:
- Impulse IDs must be unique within session (not globally unique)
- Backend sync requires MCP client configured (graceful degradation if missing)
- No retry logic - single sync attempt (IDENTIFIED ISSUE: H1)
- No API key validation before sync (IDENTIFIED ISSUE: H2)

**Why this component exists**:
- Primary user entry point for creating reusable context references (impulses)
- Bridges user intent (create impulse) with distributed persistence (local + backend)
- Enables activity templates to share context across sessions/instances

**Related architectural decision**:
- Impulse content stored separately from pointer (lazy loading)
- This saves memory (only load when needed) but complicates resolution

---

### 2. Boundary Crossing: metabob_impulse_store()
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`
**Component**: `metabob_impulse_store()` function
**Location**: Lines 5360-5420

**Annotation**:

`metabob_impulse_store()` handles the **repository boundary crossing** (OpenCode TypeScript → CLI Python) and **service boundary crossing** (CLI → RPC API) in Session Data Flow to SurrealDB pipeline.

**Data transformation**:
- Input: MCP tool arguments `{impulse_id, project_id, impulse_data}`
- Output: HTTP POST request to `{base_url}/v2/impulses` with `X-API-Key` header
- Result: JSON string `{status, impulse_id, created_at, message}`

**Business logic**:
- Validates API key presence (fail fast if misconfigured)
- Injects authentication header for multi-tenant isolation
- Translates MCP protocol (JSON-RPC style) to REST API (HTTP POST)
- Enforces 30-second timeout (prevents indefinite hangs)

**Design decision**:
- **Why MCP protocol**: Decouples OpenCode from CLI implementation details. CLI can be Python, Go, Rust - OpenCode doesn't care.
- **Why HTTP client per request**: Simplicity over performance. Each tool invocation is independent. (IDENTIFIED ISSUE: M2 - should use connection pool)
- **Why 30s timeout**: Balance between "wait for slow network" and "fail fast for unreachable backend". Empirically chosen based on typical network latency.
- **Why header-based auth**: Stateless, simple, standard. No session management needed.

**Constraints**:
- API key stored in CLI config (user must configure manually)
- No retry on transient failures (IDENTIFIED ISSUE: related to H1)
- Single backend URL (no fallback/redundancy)
- HTTP only (no WebSocket or gRPC alternative)

**Why this component exists**:
- **Protocol Bridge**: Translates OpenCode's MCP calls to backend's HTTP API
- **Authentication Gateway**: Injects API key from config (OpenCode doesn't store API keys)
- **Deployment Boundary**: Enables OpenCode (local) to talk to RPC API (remote SaaS or on-prem)

**Related architectural decision**:
- MCP over stdio (local) or SSE (remote). Chosen for simplicity - no custom protocol needed.
- Alternative considered: Direct HTTP calls from OpenCode (rejected: would couple OpenCode to backend URL format)

---

### 3. Business Logic: create_impulse_endpoint()
**File**: `repos/metabob-rpc-api/server/routes/impulse.py`
**Component**: `create_impulse_endpoint()` function (FastAPI route handler)
**Location**: Lines 64-126

**Annotation**:

`create_impulse_endpoint()` handles the **API layer business logic** and **validation gateway** in Session Data Flow to SurrealDB pipeline.

**Data transformation**:
- Input: HTTP POST with Pydantic `ImpulseCreateRequest {impulse_id, project_id, impulse_data}` and `X-API-Key` header
- Output: HTTP 201 Created with `ImpulseResponse {impulse_id, api_key, project_id, impulse_data, created_at, updated_at}`
- Error cases: 400 (duplicate), 500 (server error)

**Business logic**:
- **Multi-tenant isolation**: Extracts `X-API-Key` from header, enforces tenant scoping
- **Idempotency check**: Queries database for existing `(api_key, project_id, impulse_id)` tuple
- **Fail-fast validation**: Pydantic auto-validates types, required fields
- **Separation of concerns**: Route layer handles HTTP concerns, delegates storage to operations layer

**Design decision**:
- **Why Pydantic models**: Type safety, auto-validation, auto-generated OpenAPI docs. Developer productivity over manual validation.
- **Why check-then-create pattern**: Provide clear error message for duplicates (400 Bad Request) instead of relying on database constraint (500 Internal Server Error).
  - **KNOWN ISSUE (H3)**: Race condition between check and create. Alternative: catch database UNIQUE constraint violation.
- **Why separate operations layer**: Repository pattern. Allows swapping databases (SurrealDB → PostgreSQL) without changing route logic.
- **Why 201 Created**: REST convention. Signals resource creation, distinguishes from 200 OK (resource updated).

**Constraints**:
- Duplicate check not atomic (race condition possible under concurrent load)
- Generic exception handling (masks specific errors like ConnectionError)
- No request validation for `impulse_data` internal structure (accepts any dict)
- No rate limiting (single user can DoS backend)

**Why this component exists**:
- **API Contract Enforcement**: Validates requests conform to schema before hitting database
- **Business Rule Gateway**: Enforces "no duplicate impulses per (api_key, project_id)" constraint
- **Multi-tenant Security**: Prevents cross-tenant data access via API key scoping
- **Error Translation**: Converts database errors to HTTP status codes (user-friendly)

**Related architectural decision**:
- FastAPI chosen for async support, Pydantic integration, auto-docs
- Alternative considered: Flask (rejected: sync-only, no native async), Django (rejected: too heavy)

---

### 4. Data Transformation: create_impulse()
**File**: `repos/metabob-rpc-api/server/db/operations/impulse_data.py`
**Component**: `create_impulse()` function
**Location**: Lines 23-79

**Annotation**:

`create_impulse()` handles the **data persistence layer** and **timestamp enrichment** in Session Data Flow to SurrealDB pipeline.

**Data transformation**:
- Input: Function arguments `{impulse_id, api_key, project_id, impulse_data}`
- Enrichment: Adds `created_at: datetime.utcnow().isoformat()`, `updated_at: datetime.utcnow().isoformat()`
- Output: SurrealDB record with all fields persisted

**Business logic**:
- **Audit trail**: Injects server-side timestamps (can't be faked by client)
- **Composite key construction**: Combines (api_key, project_id, impulse_id) for multi-tenant isolation
- **Repository abstraction**: Hides SurrealDB specifics from route layer
- **Data integrity**: Database UNIQUE index enforces composite key uniqueness

**Design decision**:
- **Why server-side timestamps**: Client timestamps are untrusted (timezone issues, clock skew, malicious clients). Server UTC time is source of truth.
- **Why ISO 8601 format**: Standard, sortable, timezone-aware. Compatible with most parsing libraries.
- **Why composite key**: Multi-tenant isolation at database level (defense in depth). Even if API layer fails, database prevents cross-tenant leaks.
- **Why SurrealDB `create()` not `insert()`**: `create()` returns auto-generated ID if needed. `insert()` requires explicit ID.
- **Why no ORM**: Direct driver usage for simplicity. SurrealDB query language is SQL-like, easy to read. ORM would add abstraction overhead for little benefit.

**Constraints**:
- No timeout on database operation (IDENTIFIED ISSUE: H4 - can hang indefinitely)
- No transaction support (single operation is atomic, but multi-operation sequences aren't)
- No schema validation (impulse_data accepted as generic dict)
- No compression (large impulse_data payloads waste storage)

**Why this component exists**:
- **Persistence Abstraction**: Isolates database specifics from business logic
- **Data Enrichment**: Adds server-controlled metadata (timestamps) that clients can't forge
- **Multi-tenant Scoping**: Enforces composite key pattern for isolation
- **Query Optimization**: Uses parameterized queries to prevent SQL injection

**Related architectural decision**:
- SurrealDB chosen for:
  - Multi-model (document + graph + relational)
  - Built-in multi-tenancy (namespace/database scoping)
  - WebSocket protocol (real-time potential)
  - Schemaless (flexible for evolving impulse_data structure)
- Alternative considered: PostgreSQL with JSONB (rejected: more complex multi-tenancy, no graph features)

---

### 5. Exit Point: SurrealDB Client (get_surreal_client)
**File**: `repos/metabob-rpc-api/server/db/surrealdb_client.py`
**Component**: `get_surreal_client()` function
**Location**: Entire file (~30-50 lines)

**Annotation**:

`get_surreal_client()` handles the **database connection management** and **final persistence** in Session Data Flow to SurrealDB pipeline.

**Data transformation**:
- Input: Database operation call (e.g., `db.create("impulse_data", {...})`)
- Output: Persistent write to SurrealDB instance, returns created record

**Business logic**:
- **Connection pooling**: Singleton pattern reuses connection across requests (avoids connection overhead)
- **Namespace/database scoping**: Isolates production/staging/dev data
- **Async I/O**: Non-blocking database operations (doesn't block FastAPI workers)
- **WebSocket protocol**: Maintains persistent connection (no TCP handshake per request)

**Design decision**:
- **Why singleton pattern**: SurrealDB driver manages internal connection pool. Creating multiple clients wastes resources. Single global client shared across all requests.
- **Why WebSocket (ws://)**: Persistent bidirectional connection. Faster than HTTP (no request/response overhead). Enables real-time subscriptions (future use).
- **Why global namespace/database config**: All impulses stored in same database. Multi-tenancy via API key scoping (not database-level). Simplifies deployment.
- **Why async driver**: FastAPI is async. Blocking I/O would waste worker threads. Async driver allows thousands of concurrent requests with few workers.

**Constraints**:
- No connection retry logic (if connection drops, requests fail until restart)
- No circuit breaker (unhealthy database hammered with requests)
- No query timeout (IDENTIFIED ISSUE: H4 - related to operations layer)
- No connection health checks (can't detect "zombie" connections)
- Single database URL (no failover/redundancy)

**Why this component exists**:
- **Resource Management**: Connection pooling prevents connection exhaustion
- **Configuration Abstraction**: Centralizes database URL, credentials
- **Async Bridge**: Provides async interface for database operations
- **Final Persistence**: Actual durable write happens here (data survives server restart)

**Related architectural decision**:
- Environment variables for config (SURREALDB_URL, etc.):
  - **Why**: 12-factor app pattern. Different config per environment (dev/staging/prod) without code changes.
  - **Alternative considered**: Config files (rejected: harder to manage in containers/k8s)
- SurrealDB deployment:
  - Local: Docker container on port 8000
  - Production: K8s StatefulSet with persistent volumes
  - **Why StatefulSet**: Persistent identity needed for clustering, persistent volumes

---

## Annotation Summary

### Components Annotated: 5

1. **ImpulseCreateTool.execute()** - Entry point (user action → impulse creation)
2. **metabob_impulse_store()** - Boundary crossing (MCP → HTTP)
3. **create_impulse_endpoint()** - Business logic gateway (validation, multi-tenancy)
4. **create_impulse()** - Data transformation (timestamp enrichment)
5. **get_surreal_client()** - Exit point (database persistence)

### Key Design Decisions Documented

**1. Local-First Architecture**:
- **Why**: User productivity prioritized. Offline work enabled.
- **Trade-off**: Cross-instance consistency delayed until backend sync succeeds.
- **Risk**: Sync failures leave data local-only (IDENTIFIED ISSUE: H1).

**2. Best-Effort Backend Sync**:
- **Why**: Don't block user on network failures.
- **Trade-off**: Silent sync failures possible (users unaware).
- **Risk**: Query tools return empty results (data never synced).

**3. Multi-Tenant Isolation (Defense in Depth)**:
- **Layer 1**: API key validation in CLI (config check)
- **Layer 2**: API key header extraction in RPC API (route layer)
- **Layer 3**: API key WHERE clause in queries (operations layer)
- **Layer 4**: Composite key UNIQUE index (database layer)
- **Why**: Prevent cross-tenant data leaks at multiple layers. Even if one layer fails, others protect.

**4. Repository Pattern (Operations Layer)**:
- **Why**: Decouple business logic from database specifics. Allows swapping SurrealDB for PostgreSQL without changing routes.
- **Trade-off**: Extra layer of abstraction (more files to maintain).
- **Benefit**: Testability (can mock operations layer in route tests).

**5. Async/Await Throughout**:
- **OpenCode**: Async tool execution
- **CLI**: `async def` MCP tools, `httpx.AsyncClient`
- **RPC API**: FastAPI async route handlers
- **Database**: `await db.create()`
- **Why**: Non-blocking I/O for scalability. Single worker can handle 1000s of concurrent requests.

### Business Constraints Documented

**1. Impulse Uniqueness**:
- **Constraint**: `(session, impulse_id)` unique locally, `(api_key, project_id, impulse_id)` unique globally
- **Enforced by**: SessionMemory check (local), RPC API duplicate check (global)
- **Why**: Prevent accidental overwrites, ensure referential integrity

**2. API Key Scoping**:
- **Constraint**: All data scoped to `(api_key, project_id)`
- **Enforced by**: WHERE clauses in all queries
- **Why**: Multi-tenant SaaS isolation, prevent data leaks

**3. Lazy Loading**:
- **Constraint**: Impulse content not loaded until resolution
- **Enforced by**: `loaded: false` flag
- **Why**: Memory efficiency (don't load MB+ code snapshots eagerly)

**4. Server-Side Timestamps**:
- **Constraint**: `created_at`, `updated_at` set by backend (client can't override)
- **Enforced by**: Operations layer adds timestamps
- **Why**: Audit trail integrity, prevent timestamp spoofing

### Technical Debt / Issues Cross-Referenced

All annotations cross-reference identified issues:

- **H1**: No retry logic (affects ImpulseCreateTool, metabob_impulse_store)
- **H2**: No API key validation (affects ImpulseCreateTool)
- **H3**: Race condition (affects create_impulse_endpoint)
- **H4**: No timeout (affects create_impulse, get_surreal_client)
- **M2**: No connection pooling (affects metabob_impulse_store)

### Why These Components Are Critical

**1. ImpulseCreateTool** (Entry Point):
- Primary user interaction point
- Determines local-first behavior
- Triggers entire pipeline

**2. metabob_impulse_store** (Boundary Crossing):
- Protocol translation layer (MCP → HTTP)
- Authentication injection point
- Failure here = no backend sync

**3. create_impulse_endpoint** (Business Logic):
- Validation gateway (fail-fast)
- Multi-tenant security enforcement
- Error translation to user-friendly messages

**4. create_impulse** (Transformation):
- Data enrichment (timestamps)
- Composite key construction
- Repository abstraction

**5. get_surreal_client** (Exit Point):
- Final persistence (durability)
- Connection management
- Actual database write

**Coverage**: These 5 components represent the complete critical path from user action to persistent storage. Understanding their design decisions explains WHY the pipeline works (and fails) the way it does.

---

## Recommendations Based on Annotations

### Immediate Actions:

1. **Add retry logic to ImpulseCreateTool** (H1):
   - Why: Directly addresses "empty query results" issue
   - Design: 3 retries with exponential backoff (2s, 4s, 8s)
   - Trade-off: Longer wait time but higher sync success rate

2. **Add API key validation to ImpulseCreateTool** (H2):
   - Why: Fail fast with clear error message
   - Design: Check MCP client config before callTool()
   - Trade-off: Extra check but better UX

3. **Add timeout to create_impulse** (H4):
   - Why: Prevent indefinite hangs
   - Design: `asyncio.wait_for(db.create(...), timeout=5.0)`
   - Trade-off: Slower queries fail but workers don't hang

### Documentation Updates:

1. **ARCHITECTURE.md**:
   - Document local-first design decision
   - Explain best-effort sync trade-offs
   - Justify multi-layer isolation strategy

2. **DEPLOYMENT.md**:
   - Document API key configuration requirement
   - Explain backend sync failure modes
   - Provide troubleshooting guide

3. **SECURITY.md**:
   - Document multi-tenant isolation layers
   - Explain API key scoping mechanism
   - Provide security audit checklist

