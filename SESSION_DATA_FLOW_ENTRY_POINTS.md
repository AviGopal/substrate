# Session Data Flow to SurrealDB - Entry Points

## Overview
This trace documents the complete data flow from metabob-opencode session data (activities, templates, impulses) through metabob-cli MCP tools to metabob-rpc-api and finally to SurrealDB.

---

## 1. IMPULSE STORAGE FLOW

### Entry Point 1A: OpenCode Impulse Creation
**File**: `repos/metabob-opencode/packages/opencode/src/tool/impulse-create.ts:86`
**Function**: `ImpulseCreateTool` (tool handler)
**Input Type**: 
```typescript
{
  id: string,
  pointer: ImpulsePointer,
  budget: number,
  type?: string,
  scope?: "session" | "activity" | "project"
}
```
**Trigger**: User calls `impulse_create()` tool in OpenCode session
**Data Flow**:
1. Creates impulse in local SessionMemory
2. Syncs to Activity.impulses if in activity context
3. **Calls MCP**: `metabob_impulse_store` via CLI MCP client (line 86-93)

### Entry Point 1B: CLI MCP Impulse Store Tool
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py:5380`
**Function**: `metabob_impulse_store()`
**Input Type**:
```python
{
  impulse_id: str,
  project_id: str,  # git root hash
  impulse_data: dict  # Full impulse object
}
```
**Trigger**: Called by OpenCode via MCP protocol
**HTTP Request**: `POST {base_url}/v2/impulses` (line 5384)
**Headers**: `X-API-Key: {api_key}`
**Payload**:
```json
{
  "impulse_id": "trace-storage-flow",
  "project_id": "proj_abc456",
  "impulse_data": {
    "id": "trace-storage-flow",
    "type": "templateDefinition",
    "pointer": {"type": "memo", "content": "..."},
    "budget": 5000
  }
}
```

### Entry Point 1C: RPC API Impulse Endpoint
**File**: `repos/metabob-rpc-api/server/routes/impulse.py:64`
**Function**: `create_impulse_endpoint()`
**HTTP Method**: `POST /v2/impulses`
**Input Schema**:
```python
class ImpulseCreateRequest:
    impulse_id: str
    project_id: str
    impulse_data: dict
```
**Headers**: `X-API-Key` (for multi-tenant isolation)
**Trigger**: HTTP POST from CLI MCP tool
**Data Flow**:
1. Validates request (line 99-100)
2. Calls `server.db.operations.impulse_data.create_impulse()`

### Entry Point 1D: SurrealDB Write Operation
**File**: `repos/metabob-rpc-api/server/db/operations/impulse_data.py:23`
**Function**: `create_impulse()`
**Database**: SurrealDB
**Table**: `impulse_data`
**Composite Key**: `(api_key, project_id, impulse_id)`
**Schema**:
```python
{
  "impulse_id": str,
  "api_key": str,  # Multi-tenant isolation
  "project_id": str,  # Project scoping
  "impulse_data": dict,  # Full impulse object
  "created_at": ISO timestamp,
  "updated_at": ISO timestamp
}
```
**Write Operation**: `db.create("impulse_data", data)` (line 76)

---

## 2. ACTIVITY STORAGE FLOW

### Entry Point 2A: OpenCode Activity Save
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts:679`
**Function**: `Activity.save()`
**Input Type**: `Activity.Schema` (full activity object)
**Trigger**: Activity state changes (task completion, status updates)
**Data Flow**:
1. Cleans impulse content to prevent memory leak (line 652)
2. Writes to local storage via `Storage.write(["activity", id], data)`
3. **Calls MCP**: `metabob_activity_save` via CLI MCP client (line 686-692)

### Entry Point 2B: CLI MCP Activity Save Tool
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py:5640`
**Function**: `metabob_activity_save()`
**Input Type**:
```python
{
  activity_id: str,
  project_id: str,
  activity_data: dict  # Full activity object
}
```
**Trigger**: Called by OpenCode Activity.save() via MCP
**HTTP Request**: `POST {base_url}/v2/activities/storage` (line 5640)
**Headers**: `X-API-Key: {api_key}`
**Payload**:
```json
{
  "activity_id": "act_test_123",
  "project_id": "proj_abc456",
  "activity_data": {
    "id": "act_test_123",
    "template": "add-rest-endpoint",
    "status": "running",
    "tasks": []
  }
}
```

### Entry Point 2C: RPC API Activity Storage Endpoint
**File**: `repos/metabob-rpc-api/server/routes/activity.py:817`
**Function**: `create_activity_endpoint()`
**HTTP Method**: `POST /v2/activities/storage`
**Input Schema**:
```python
class ActivityCreateRequest:
    activity_id: str
    project_id: str
    activity_data: dict
```
**Headers**: `X-API-Key` (for multi-tenant isolation)
**Trigger**: HTTP POST from CLI MCP tool
**Data Flow**:
1. Checks for existing activity (line 860)
2. Calls `server.db.operations.activity_data.create_activity()` (line 869)

### Entry Point 2D: SurrealDB Activity Write
**File**: `repos/metabob-rpc-api/server/db/operations/activity_data.py:23`
**Function**: `create_activity()`
**Database**: SurrealDB
**Table**: `activity_data`
**Composite Key**: `(api_key, project_id, activity_id)`
**Schema**:
```python
{
  "activity_id": str,
  "api_key": str,
  "project_id": str,
  "activity_data": dict,  # Full activity object
  "created_at": ISO timestamp,
  "updated_at": ISO timestamp
}
```
**Write Operation**: `db.create("activity_data", data)` (line 75)

---

## 3. ACTIVITY TEMPLATE REGISTRATION FLOW

### Entry Point 3A: OpenCode Template Save
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template.ts:690`
**Function**: `ActivityTemplate.save()`
**Input Type**: `ActivityTemplate.Schema`
**Trigger**: Template creation, updates, or auto-registration
**Data Flow**:
1. Writes to local storage via `Storage.write(["activity-template", id], template)`
2. Triggers auto-registration if configured (line 696-698)
3. Calls `autoRegisterWithMetabob()` → `TemplateRepository.save(template, ["metabob"])`

### Entry Point 3B: Template Repository Backend Save
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts`
**Function**: `TemplateRepository.save()` (calls CLI MCP)
**Note**: This uses the CLI MCP `metabob_register_activity_template` tool

### Entry Point 3C: CLI MCP Template Registration
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:199`
**Function**: `register_activity_template()` (inferred from API call pattern)
**HTTP Request**: `POST /v2/activities/templates`
**Payload**: Full template object with variant_id, task_steps, genealogy

### Entry Point 3D: RPC API Template Creation
**File**: `repos/metabob-rpc-api/server/routes/activity.py:164`
**Function**: `create_template()` endpoint handler
**HTTP Method**: `POST /v2/activities/templates`
**Trigger**: HTTP POST from CLI MCP tool
**Data Flow**:
1. Calls `server.actions.activity.create_template()`
2. Writes to SurrealDB via `template_data.create_template_record()`

### Entry Point 3E: SurrealDB Template Write
**File**: `repos/metabob-rpc-api/server/db/operations/template_data.py:26`
**Function**: `create_template_record()`
**Database**: SurrealDB (PRIMARY storage)
**Table**: `activity_template`
**Record ID**: `activity_template:{variant_id}`
**Schema**:
```python
{
  "variant_id": str,
  "activity_id": str,
  "variant_name": str,
  "description": str,
  "task_steps": list,
  "genealogy": dict,
  "created_at": ISO timestamp,
  "updated_at": ISO timestamp
}
```
**Write Operation**: `db.create(record_id, template_data)` (line 62)
**Note**: Redis is used as CACHE ONLY (spec: surrealdb-primary-redis-cache)

---

## 4. SESSION LIFECYCLE (LOCAL ONLY - NO BACKEND SYNC)

### Entry Point 4A: Session Creation
**File**: `repos/metabob-opencode/packages/opencode/src/session/index.ts:186`
**Function**: `Session.create()` or `Session.createNext()`
**Input Type**:
```typescript
{
  title?: string,
  directory?: string,
  parentID?: string,
  activityId?: string
}
```
**Trigger**: 
- User starts new chat session
- Activity execution creates dedicated session
- CLI commands create sessions
**Storage**: LOCAL ONLY (no backend sync currently)
**Data Flow**:
1. Creates session info with ID, timestamps, project context
2. Writes to `Storage.write(["session", "info", id], sessionInfo)`
3. Initializes SessionMemory for impulse management
4. Publishes `session.created` event via Bus

### Entry Point 4B: Activity Session Creation
**File**: `repos/metabob-opencode/packages/opencode/src/session/index.ts:211`
**Function**: `Session.createForActivity()`
**Input Type**:
```typescript
{
  activityId: string,
  callingSessionID: string,
  title?: string
}
```
**Trigger**: Activity execution needs isolated session context
**Special Behavior**:
- Creates child session with `parentID = callingSessionID`
- Links to activity via `activityId` field
- Isolated impulse scope (activity impulses don't leak to parent)
**Storage**: LOCAL ONLY

---

## DATA FLOW SUMMARY

### Current Behavior (as of trace)
```
┌─────────────────┐
│ metabob-opencode│
│  (TypeScript)   │
└────────┬────────┘
         │ impulse_create(), Activity.save()
         │ ActivityTemplate.save()
         ▼
┌─────────────────┐
│  Local Storage  │ ← File-based (.opencode/storage/)
│  (instance-local)│
└────────┬────────┘
         │
         │ MCP Protocol
         ▼
┌─────────────────┐
│  metabob-cli    │
│  (Python MCP)   │
└────────┬────────┘
         │ metabob_impulse_store()
         │ metabob_activity_save()
         │ metabob_register_activity_template()
         ▼
┌─────────────────┐
│ metabob-rpc-api │
│  (FastAPI)      │
└────────┬────────┘
         │ POST /v2/impulses
         │ POST /v2/activities/storage
         │ POST /v2/activities/templates
         ▼
┌─────────────────┐
│   SurrealDB     │ ← Multi-tenant, cross-instance
│  (Primary DB)   │    Keys: (api_key, project_id, id)
└─────────────────┘
```

### Identified Gaps
1. **Session data**: NO backend sync (local only)
2. **Best-effort sync**: Backend sync failures are logged but don't fail operations
3. **Query path**: No documented retrieval flow (metabob_impulse_load, metabob_activity_load exist in CLI)

---

## KEY ARCHITECTURAL PATTERNS

1. **Vessel Flow**: OpenCode → CLI MCP → RPC API → SurrealDB
2. **Multi-tenant Isolation**: All backend storage uses `(api_key, project_id, resource_id)` composite keys
3. **Local-first with Sync**: Local storage succeeds first, backend sync is best-effort
4. **MCP as Bridge**: CLI MCP tools handle authentication, project context, HTTP transport
5. **SurrealDB as Primary**: Templates, activities, impulses stored in SurrealDB (Redis is cache for templates only)

