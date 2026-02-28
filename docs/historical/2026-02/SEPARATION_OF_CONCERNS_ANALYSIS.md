# Application Separation of Concerns Analysis

## Three Main Applications

### 1. metabob-opencode
**Purpose**: AI-powered code assistant / client application
**Technology**: TypeScript/Bun
**Location**: `repos/metabob-opencode`

**Core Responsibilities**:
- Interactive chat interface
- Subagent orchestration
- Activity template execution
- Session management
- File operations on local codebase
- MCP client (connects to MCP servers)
- ACP server (Agent Client Protocol)

**What it SHOULD do**:
- Manage user sessions and interactions
- Execute activities and coordinate agents
- Read/write code files locally
- Cache data temporarily (in-memory, short-lived)
- Connect to backend services via MCP/API

**What it SHOULD NOT do**:
- Own persistent storage (beyond local config)
- Run database servers
- Implement business logic for metrics
- Store permanent analytics data

---

### 2. metabob-cli  
**Purpose**: MCP server providing Metabob capabilities
**Technology**: Python
**Location**: `repos/metabob-cli`

**Core Responsibilities**:
- MCP server implementation
- Code analysis tools (async/sync)
- Activity template management (MCP tools)
- Boredom activities API
- CPG (Code Property Graph) operations

**What it SHOULD do**:
- Expose MCP tools for code analysis
- Provide activity template MCP tools
- Read/write activity template files
- Query backend API for metrics (if needed)
- Implement stateless business logic

**What it SHOULD NOT do**:
- Own permanent database storage directly
- Manage user sessions
- Execute activities (that's opencode's job)
- Duplicate data from backend

---

### 3. metabob-rpc-api
**Purpose**: Backend API server with database and analytics
**Technology**: Python/FastAPI
**Location**: `repos/metabob-rpc-api`

**Core Responsibilities**:
- HTTP API endpoints
- Database persistence (SurrealDB/Redis/PostgreSQL)
- Metrics aggregation and analytics
- Thompson sampling for A/B testing
- Background job processing (Celery)

**What it SHOULD do**:
- Own all persistent storage
- Provide REST/RPC API endpoints
- Aggregate and analyze metrics
- Implement business logic for analytics
- Manage database connections
- Handle background jobs

**What it SHOULD NOT do**:
- Manage user sessions (UI concern)
- Execute code locally (client concern)
- Implement MCP server (that's metabob-cli)

---

## Current Violations & Issues

### Issue 1: Data Storage Confusion
**Problem**: Unclear who owns template metrics storage
- metabob-cli: Writes to JSON files directly
- metabob-rpc-api: Writes to Redis
- metabob-opencode: Reports via MCP

**Violation**: metabob-cli should NOT own permanent storage

**Fix**: 
- metabob-rpc-api OWNS all permanent storage
- metabob-cli queries metabob-rpc-api via HTTP
- metabob-opencode reports to metabob-rpc-api

### Issue 2: Metrics Duplication
**Problem**: Same data in multiple places
- Redis (via API)
- JSON files (via MCP)
- No synchronization

**Violation**: No single source of truth

**Fix**:
- SurrealDB in metabob-rpc-api = single source
- Redis = ephemeral cache only
- JSON files = deprecated

### Issue 3: MCP Tool Overreach
**Problem**: MCP tools writing to databases
- `metabob_post_activity_result` writes to JSON files

**Violation**: MCP server should not own storage

**Fix**:
- MCP tool calls metabob-rpc-api HTTP endpoint
- API server writes to SurrealDB
- MCP tool is stateless proxy

---

## Correct Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      metabob-opencode                       │
│                  (Client Application)                        │
├─────────────────────────────────────────────────────────────┤
│ - User sessions (in-memory)                                 │
│ - Activity execution (in-memory state)                      │
│ - BoredomManager (in-memory session tracking)               │
│ - Template cache (TTL refresh)                              │
│                                                              │
│ READS:  MCP tools (via metabob-cli)                        │
│ WRITES: HTTP API (to metabob-rpc-api)                      │
└─────────────────────────────────────────────────────────────┘
                      │                    │
                      │ MCP                │ HTTP
                      ↓                    ↓
┌─────────────────────────────┐  ┌─────────────────────────────┐
│      metabob-cli            │  │   metabob-rpc-api           │
│   (MCP Server)              │  │   (Backend API)             │
├─────────────────────────────┤  ├─────────────────────────────┤
│ - Code analysis tools       │  │ - REST/RPC endpoints        │
│ - CPG operations            │  │ - SurrealDB (primary DB)    │
│ - Stateless business logic  │  │ - Redis (cache/sessions)    │
│ - MCP tool definitions      │  │ - PostgreSQL (if needed)    │
│                             │  │ - Celery (background jobs)  │
│ READS:  HTTP (from API)    │  │ - Metrics aggregation       │
│ WRITES: HTTP (to API)      │  │                             │
│ EXPOSES: MCP tools         │  │ OWNS: All permanent data    │
└─────────────────────────────┘  └─────────────────────────────┘
```

---

## Data Flow (Corrected)

### Activity Execution Metrics

```
User executes activity in metabob-opencode
        ↓
Activity.complete() in opencode
        ↓
TemplateMetricsClient.reportExecution()
        ↓
HTTP POST /api/activity-execution (to metabob-rpc-api)
        ↓
API inserts to SurrealDB (execution_history)
        ↓
API updates aggregates (template_metrics)
        ↓
[DONE - data persisted]
```

### Boredom Activity Fetch

```
BoredomManager detects idle (in opencode)
        ↓
Calls MCP tool: metabob_fetch_boredom_activities
        ↓
metabob-cli receives MCP call
        ↓
HTTP GET /api/boredom-activities (to metabob-rpc-api)
        ↓
API queries SurrealDB (template_metrics)
        ↓
API calculates priorities and returns
        ↓
metabob-cli returns to opencode
        ↓
BoredomManager executes top activity
```

---

## Corrected Component Ownership

### metabob-opencode OWNS:
- User session state (in-memory)
- Activity execution state (in-memory, while running)
- BoredomManager idle tracking (in-memory per session)
- Template cache (TTL-based, refreshed from API)

### metabob-cli OWNS:
- MCP tool definitions and implementations
- Stateless business logic (query transformations)
- Code analysis algorithms
- CPG operations

### metabob-rpc-api OWNS:
- SurrealDB (activity_execution, template_metrics, templates)
- Redis (session cache, rate limiting, hot data cache with TTL)
- PostgreSQL (if needed for other data)
- All metrics aggregation logic
- All persistence logic

---

## API Boundaries

### metabob-opencode → metabob-rpc-api (HTTP)
- POST /api/activity-execution (report completion)
- GET /api/templates/{id}/metrics (optional, if not via MCP)

### metabob-cli → metabob-rpc-api (HTTP)
- GET /api/boredom-activities (for MCP tool)
- GET /api/templates (for MCP tool)
- GET /api/template-metrics/{id} (for MCP tool)

### metabob-opencode → metabob-cli (MCP)
- metabob_fetch_boredom_activities
- metabob_search_codebase_issues
- metabob_annotate_component
- ... (all existing Metabob tools)

---

## Implementation Plan Corrections

### Phase 1: Add API Endpoints (metabob-rpc-api)

**New Endpoints**:
```python
# In metabob-rpc-api
POST   /api/activity-execution       # Report execution
GET    /api/boredom-activities       # Fetch low-quality templates
GET    /api/templates                # List templates
GET    /api/templates/{id}/metrics   # Get template metrics
POST   /api/templates                # Register template
```

**Database**:
- Implement SurrealDB schema
- Implement CRUD operations
- Add transaction support

### Phase 2: Update MCP Tools (metabob-cli)

**Change**:
```python
# OLD: Write to JSON files directly
def metabob_post_activity_result(activity_id, result):
    file_path = Path.home() / ".metabob" / "activities" / f"{activity_id}.json"
    with open(file_path, 'w') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        # ... write data

# NEW: Proxy to API
def metabob_post_activity_result(activity_id, result):
    response = requests.post(
        f"{API_BASE_URL}/api/activity-execution",
        json={"activity_id": activity_id, "result": result}
    )
    return response.json()
```

### Phase 3: Update Client (metabob-opencode)

**Change**:
```typescript
// OLD: Only MCP reporting
TemplateMetricsClient.reportExecution(data)  // MCP only

// NEW: Direct HTTP to API
export async function reportExecution(data: ActivityExecutionData) {
  try {
    // Direct HTTP to metabob-rpc-api
    const response = await fetch(`${API_BASE_URL}/api/activity-execution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      log.warn('metrics reporting failed', { status: response.status })
    }
  } catch (error) {
    // Graceful degradation
    log.warn('metrics reporting failed', { error })
  }
}
```

---

## Summary

**Key Principle**: Backend API owns all permanent storage

**Correct Flow**:
1. opencode → HTTP → rpc-api (write metrics)
2. opencode → MCP → cli → HTTP → rpc-api (read metrics)
3. cli = stateless proxy, no storage
4. rpc-api = single source of truth

**No More**:
- MCP tools writing to files
- Dual storage (Redis + JSON)
- Data duplication

