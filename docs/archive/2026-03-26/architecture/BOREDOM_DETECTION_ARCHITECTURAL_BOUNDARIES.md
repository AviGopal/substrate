# Boredom Activity Detection - Architectural Boundaries Analysis

## Overview

This document analyzes all architectural boundaries in the boredom activity detection flow, documenting contracts, coupling levels, and resilience patterns.

---

## 1. Repository Boundary: metabob-opencode ↔ metabob-cli

**Type**: Repository Boundary (Cross-repo integration)

**Location**: 
- Frontend: `repos/metabob-opencode/packages/opencode`
- Backend: `repos/metabob-cli/src/metabob_cli/mcp`

### Contract

**Integration Protocol**: Model Context Protocol (MCP)

**Tool Definitions** (Backend → Frontend):
```python
# Backend: activity_template_tools.py
@mcp.tool(name="metabob_fetch_boredom_activities")
async def metabob_fetch_boredom_activities(
    max_activities: int = 5,
    priority_threshold: float = 0.5,
    types: str = "",
    exclude_recent_hours: int = 24,
) -> dict
```

**Response Schema**:
```python
{
  "status": "success" | "error",
  "timestamp": str,  # ISO format
  "activities": [
    {
      "activity_type": "improve-template" | "debug-failures" | "optimize-performance",
      "priority": float,  # 0.0-1.0
      "template_id": str,
      "improvement_gradient": float,
      "reason": str,
      "metrics": {
        "success_rate": float,
        "avg_cost": float,
        "avg_duration": int,
        "execution_count": int,
      }
    }
  ],
  "total_count": int
}
```

**Frontend Usage**:
```typescript
// Frontend: boredom-manager.ts:210-245
const clients = await MCP.clients()
const metabobClient = clients["metabob"]

const result = await metabobClient.callTool({
  name: "metabob_fetch_boredom_activities",
  arguments: {
    max_activities: 5,
    priority_threshold: 0.6,
    exclude_recent_hours: 24,
  },
})

const data = JSON.parse(firstContent.text)
const activities: BoredomActivity[] = data.activities
```

### Coupling: **Loose (via MCP protocol)**

**Decoupling Mechanisms**:
1. **MCP Protocol**: Standardized tool invocation interface
2. **JSON Schema**: Self-documenting tool definitions
3. **Dynamic Discovery**: Frontend discovers tools at runtime
4. **No Direct Imports**: No TypeScript imports from Python code

**Coupling Points**:
- Tool name: `"metabob_fetch_boredom_activities"` (string-based, fragile)
- Response structure: Frontend assumes `data.activities` exists
- Type safety: JSON parsing loses type information

### Resilience Patterns

**Error Handling**:
```typescript
// Frontend: boredom-manager.ts:212-245
try {
  const clients = await MCP.clients()
  const metabobClient = clients["metabob"]
  
  if (!metabobClient) {
    log.warn("Metabob MCP client not configured")
    return []  // ← Graceful degradation
  }
  
  const result = await metabobClient.callTool({ ... })
  
  if (!result.content?.[0]?.text) {
    return []  // ← Handle empty response
  }
  
  const data = JSON.parse(firstContent.text)
  
  if (data.status !== "success" || !Array.isArray(data.activities)) {
    return []  // ← Validate response structure
  }
  
  return data.activities
} catch (error) {
  log.error("Failed to fetch boredom activities", { error })
  return []  // ← Catch-all fallback
}
```

**Resilience Characteristics**:
- ✅ **Graceful Degradation**: Returns empty array on failure (no crash)
- ✅ **Validation**: Checks `status`, `activities` existence
- ✅ **Logging**: Errors logged for debugging
- ❌ **Retry Logic**: None (single attempt)
- ❌ **Timeout**: Uses default MCP timeout (30s)
- ❌ **Circuit Breaker**: None (will retry every 30s if failing)

### Versioning & Compatibility

**Current State**: No explicit versioning

**Risks**:
1. Backend schema changes break frontend (no contract tests)
2. Tool name changes require frontend update
3. No deprecation mechanism

**Recommendations**:
1. Add API version to tool name: `metabob_fetch_boredom_activities_v1`
2. Use Zod schemas for response validation
3. Add contract tests (JSON Schema validation)

---

## 2. Service Boundary: MCP Backend ↔ Learning Loop API

**Type**: Service Boundary (HTTP API)

**Location**:
- Client: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`
- Server: Learning Loop API (external service)

### Contract

**API Endpoint**: `GET /api/v1/learning-loop/boredom-activities`

**Request Schema**:
```python
params = {
  "threshold": float,        # improvement_gradient threshold (0.0-1.0)
  "exclude_hours": int,      # Exclude templates executed within N hours
  "limit": int               # Max activities to return
}
```

**Response Schema** (inferred from code):
```python
[
  {
    "template_id": str,
    "improvement_gradient": float,
    "success_rate": float,
    "total_executions": int,
    "avg_cost_usd": float,
    "avg_duration_ms": int,
    # ... other metrics
  }
]
```

**Implementation**:
```python
# Backend: activity_template_tools.py:423-427
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.get(
        f"{api_base}/api/v1/learning-loop/boredom-activities",
        params=params,
    )
```

### Coupling: **Medium (HTTP API with implicit contract)**

**Coupling Points**:
1. **URL Structure**: Hardcoded `/api/v1/learning-loop/boredom-activities`
2. **Response Schema**: Assumed structure (no schema validation)
3. **Field Names**: Direct access via `.get("template_id")`, etc.
4. **Config Dependency**: `api_base_url` must be configured

**Decoupling Mechanisms**:
- Config-based URL: `api_base` from config (not hardcoded)
- Default fallback: `"http://localhost:8080"` for local dev

### Resilience Patterns

**Error Handling**:
```python
# Backend: activity_template_tools.py:429-477
try:
    response = await client.get(...)
    
    if response.status_code == 200:
        activities_data = response.json()
        # Transform and return
        return {
            "status": "success",
            "activities": activities,
            "total_count": len(activities),
        }
    else:
        logger.warning(f"API error {response.status_code}: {response.text}")
        return {
            "status": "error",
            "message": f"Failed to fetch activities: HTTP {response.status_code}",
            "activities": [],
            "total_count": 0,
        }

except httpx.TimeoutException:
    return {
        "status": "error",
        "message": "Learning Loop API timed out (30s)",
        "activities": [],
        "total_count": 0,
    }

except Exception as e:
    return {
        "status": "error",
        "message": f"Unexpected error: {str(e)}",
        "activities": [],
        "total_count": 0,
    }
```

**Resilience Characteristics**:
- ✅ **Timeout**: 30-second timeout prevents hanging
- ✅ **Status Code Handling**: 200 vs non-200 responses
- ✅ **Exception Handling**: Catches timeout, generic exceptions
- ✅ **Structured Errors**: Returns error status with message
- ❌ **Retry Logic**: None (single attempt)
- ❌ **Circuit Breaker**: None
- ❌ **Fallback Data**: Returns empty array (no cached data)

**Missing Resilience Patterns**:
1. **Retry with Backoff**: Should retry 2-3 times on transient errors
2. **Circuit Breaker**: Stop calling API if failing consistently
3. **Cached Responses**: Cache last successful response for offline mode

---

## 3. Service Boundary: MCP Backend ↔ Learning Loop API (POST Results)

**Type**: Service Boundary (HTTP API)

**Location**:
- Client: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:256`
- Server: Learning Loop API (external service)

### Contract

**API Endpoint**: `POST /api/v1/learning-loop/executions`

**Request Schema**:
```python
{
  "activity_id": str,
  "template_id": str,
  "started_at": str,        # ISO 8601 + "Z"
  "duration_ms": int,
  "success": bool,
  "tokens_input": int,
  "tokens_output": int,
  "tokens_cache": int,
  "cost_usd": float,
  "completed_at": str,      # ISO 8601 + "Z"
  "error_message": str | None,
  "error_type": str | None
}
```

**Response Schema**:
```python
{
  "execution_id": str,
  "variant_id": str,
  "success": bool,
  "timestamp": str
}
```

**Implementation**:
```python
# Backend: activity_template_tools.py:303-308
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.post(
        f"{api_base}/api/v1/learning-loop/executions",
        json=request_data,
        headers={"Content-Type": "application/json"},
    )
```

### Coupling: **Medium (HTTP API with typed contract)**

**Coupling Points**:
1. **URL Structure**: Hardcoded `/api/v1/learning-loop/executions`
2. **Request Schema**: Must match backend expectations
3. **Timestamp Format**: ISO 8601 + "Z" suffix required
4. **Activity ID Format**: Assumes `{template_id}-{timestamp}` format

**Decoupling Mechanisms**:
- Pydantic models for validation: `ActivityExecutionResponse`
- Config-based URL

### Resilience Patterns

**Error Handling**:
```python
# Backend: activity_template_tools.py:310-346
try:
    response = await client.post(...)
    
    if response.status_code == 201:
        result_data = response.json()
        return {
            "status": "success",
            "execution_id": result_data.get("execution_id"),
            "metrics_updated": True,
        }
    else:
        logger.warning(f"API error {response.status_code}: {response.text}")
        return {
            "status": "error",
            "message": f"Failed to post result: HTTP {response.status_code}",
            "metrics_updated": False,
        }

except httpx.TimeoutException:
    return {
        "status": "error",
        "message": "Learning Loop API timed out (30s)",
        "metrics_updated": False,
    }

except Exception as e:
    return {
        "status": "error",
        "message": f"Unexpected error: {str(e)}",
        "metrics_updated": False,
    }
```

**Resilience Characteristics**:
- ✅ **Timeout**: 30-second timeout
- ✅ **Status Code Handling**: 201 expected for success
- ✅ **Exception Handling**: Catches timeout, generic exceptions
- ✅ **Non-Blocking**: Failure doesn't crash activity execution
- ❌ **Retry Logic**: None (results lost if API down)
- ❌ **Queuing**: No retry queue for failed posts
- ❌ **Idempotency**: No deduplication (could double-post on retry)

**Critical Gap**: Results are **lost forever** if API is down during post. Should use persistent queue.

---

## 4. Layer Boundary: Session Management → Storage Layer

**Type**: Layer Boundary (Data Access Layer)

**Location**:
- Consumer: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
- Provider: `repos/metabob-opencode/packages/opencode/src/storage/storage.ts`

### Contract

**Storage Interface**:
```typescript
// storage.ts:11
export namespace Storage {
  export function write<T>(key: string[], value: T): Promise<void>
  export function read<T>(key: string[]): Promise<T>
  export function list(prefix: string[]): Promise<string[][]>
  export function remove(key: string[]): Promise<void>
}
```

**Usage**:
```typescript
// activity.ts:567
await Storage.write(["activity", activity.id], cleanedActivity)

// activity.ts:459
const activity = await Storage.read<Info>(["activity", id])

// activity.ts:572
const keys = await Storage.list(["activity"])
```

### Coupling: **Tight (direct namespace dependency)**

**Coupling Points**:
1. **Direct Import**: `import { Storage } from "@/storage/storage"`
2. **Key Structure**: Convention-based keys `["activity", id]`
3. **Type Assumption**: Generic `<T>` assumes JSON serialization
4. **Synchronous API**: Assumes fast file I/O (no streaming)

**Decoupling Mechanisms**:
- Generic type parameter `<T>` for flexibility
- Key-based addressing (not SQL)
- Namespace isolation

### Resilience Patterns

**Error Handling**:
```typescript
// activity.ts:459-463
const activity = await Storage.read<Info>(["activity", id])
if (!activity) {
  throw new Error(`Activity ${id} not found`)
}

// activity.ts:576
const activity = await Storage.read<Info>(key).catch(() => undefined)
// ↑ Catch and return undefined (non-throwing)
```

**Resilience Characteristics**:
- ✅ **Error Propagation**: Storage errors bubble up
- ✅ **Validation**: Checks if activity exists
- ✅ **Logging**: Storage layer logs errors
- ❌ **Retry Logic**: None (single attempt)
- ❌ **Caching**: No in-memory cache (reads file every time)
- ❌ **Optimistic Locking**: No conflict detection on concurrent writes

**Critical Gap**: No optimistic locking. Concurrent writes can corrupt data.

### Storage Implementation Details

**File System Layout**:
```
~/.local/share/opencode/storage/
  activity/
    {activity_id}.json
  session/
    {project_id}/
      {session_id}.json
  message/
    {session_id}/
      {message_id}.json
```

**Persistence**:
```typescript
// storage.ts implementation (inferred)
export async function write(key: string[], value: unknown): Promise<void> {
  const filePath = path.join(storageDir, ...key) + ".json"
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value, null, 2))
}
```

**Versioning**: Migration system (`MIGRATIONS` array) handles schema changes

---

## 5. Layer Boundary: BoredomManager → Activity Service

**Type**: Layer Boundary (Service → Domain)

**Location**:
- Consumer: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`
- Provider: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

### Contract

**Activity Service API**:
```typescript
// activity.ts:388-456
export async function create(options: CreateOptions): Promise<Info>

interface CreateOptions {
  directory: string
  branch: string
  baseCommit: string
  title: string
  todos?: Todo[]
}

// activity.ts:555-569
export async function save(activity: Info): Promise<void>
```

**Usage in BoredomManager**:
```typescript
// boredom-manager.ts:286-297
const activity = await Activity.create({
  directory: process.cwd(),
  branch: "boredom-activity",
  baseCommit: "HEAD",
  title: `[BOREDOM] ${template.name}`,
})

activity.templateId = template.id
activity.variables = variables
activity.reason = boredomActivity.reason
await Activity.save(activity)
```

### Coupling: **Medium (typed interface with mutable state)**

**Coupling Points**:
1. **Direct Import**: `import { Activity } from "./activity"`
2. **Mutable State**: Activity returned is mutated (not immutable)
3. **Side Effects**: `create()` persists to storage immediately
4. **Event Bus**: Activity publishes events (implicit coupling)

**Decoupling Mechanisms**:
- Typed interface (`CreateOptions`, `Info`)
- Zod schemas for validation
- Factory pattern (`create()` not `new Activity()`)

### Resilience Patterns

**Error Handling**:
```typescript
// boredom-manager.ts:250-373
try {
  const activity = await Activity.create({ ... })
  
  activity.templateId = template.id
  activity.variables = variables
  activity.reason = boredomActivity.reason
  await Activity.save(activity)
  
  // Execute activity
  const result = await executeActivityInline(...)
  
  // Report results
  await metabobClient.callTool("metabob_post_activity_result", ...)
  
} catch (error) {
  log.error("Boredom activity execution failed", { error })
  // Activity remains in storage with "setup" status (orphaned)
} finally {
  manager.isExecutingBoredomActivity = false
}
```

**Resilience Characteristics**:
- ✅ **Try-Catch**: Errors logged and caught
- ✅ **Finally Block**: `isExecutingBoredomActivity` reset even on error
- ❌ **Cleanup**: Failed activity left in storage (orphaned)
- ❌ **Compensation**: No rollback of `Activity.create()`
- ❌ **Status Update**: Activity status not updated to "failed"

**Critical Gap**: Failed boredom activities remain in "setup" status forever (orphaned).

---

## 6. Event Boundary: Activity Lifecycle → Event Bus

**Type**: Event Boundary (Pub/Sub)

**Location**:
- Publisher: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
- Subscriber: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`

### Contract

**Event Definitions**:
```typescript
// activity.ts:371-385
export const Event = {
  Created: Bus.event(
    "activity.created",
    z.object({
      activity: Info,
    }),
  ),
  Updated: Bus.event(
    "activity.updated",
    z.object({
      activity: Info,
    }),
  ),
  Completed: Bus.event(
    "activity.completed",
    z.object({
      activity: Info,
    }),
  ),
}
```

**Publishing**:
```typescript
// activity.ts:453
await Bus.publish(Event.Created, { activity }).catch(() => {})

// activity.ts:568
await Bus.publish(Event.Updated, { activity }).catch(() => {})

// activity.ts:874
await Bus.publish(Event.Completed, { activity }).catch(() => {})
```

**Subscription** (example):
```typescript
// session/index.ts:259 (similar pattern)
Bus.subscribe(Session.Event.Created, (event) => {
  BoredomManager.startMonitoring(event.properties.session.id)
})
```

### Coupling: **Loose (event-driven)**

**Coupling Points**:
1. **Event Type**: String-based event name `"activity.created"`
2. **Payload Schema**: Zod schema defines structure
3. **Synchronous Delivery**: `await Bus.publish()` (not async queue)

**Decoupling Mechanisms**:
- Pub/Sub pattern (publishers don't know subscribers)
- Zod schema validation
- Wildcard subscription: `Bus.subscribe("*", ...)`

### Resilience Patterns

**Error Handling**:
```typescript
// activity.ts:453, 568, 874
await Bus.publish(Event.Created, { activity }).catch(() => {})
// ↑ Swallow errors (non-blocking)

// bus/index.ts:50-68
export async function publish(def, properties) {
  const pending = []
  for (const sub of subscribers) {
    pending.push(sub(payload))  // ← No error handling
  }
  return Promise.all(pending)  // ← Fails if any subscriber throws
}
```

**Resilience Characteristics**:
- ✅ **Non-Blocking Publisher**: `.catch(() => {})` prevents publisher from crashing
- ❌ **Subscriber Isolation**: One subscriber failure fails all subscribers
- ❌ **Error Logging**: Errors silently swallowed
- ❌ **Retry Logic**: None
- ❌ **Dead Letter Queue**: Failed events lost

**Critical Gap**: Subscriber errors crash other subscribers (no isolation).

**Recommendation**: Wrap each subscriber in try-catch:
```typescript
for (const sub of subscribers) {
  pending.push(
    sub(payload).catch((error) => {
      log.error("Subscriber error", { error, event: def.type })
    })
  )
}
```

---

## 7. Data Store Boundary: Storage Layer → File System

**Type**: Data Store Boundary (File I/O)

**Location**:
- Consumer: `repos/metabob-opencode/packages/opencode/src/storage/storage.ts`
- Provider: Node.js `fs/promises` API

### Contract

**File System API**:
```typescript
import fs from "fs/promises"

// Write
await fs.mkdir(path.dirname(filePath), { recursive: true })
await fs.writeFile(filePath, JSON.stringify(value, null, 2))

// Read
const content = await fs.readFile(filePath, "utf-8")
const value = JSON.parse(content)

// List
const files = await fs.readdir(dir)

// Remove
await fs.unlink(filePath)
```

### Coupling: **Tight (direct file system dependency)**

**Coupling Points**:
1. **File System**: Requires writable file system (no cloud storage)
2. **JSON Format**: Hardcoded JSON serialization
3. **Path Structure**: Assumes Unix-style paths
4. **Synchronous Locking**: No distributed locking

**Decoupling Mechanisms**:
- Lock abstraction: `Lock` utility for concurrency
- Migration system: Schema versioning

### Resilience Patterns

**Error Handling**:
```typescript
// storage.ts (inferred from usage)
try {
  await fs.writeFile(filePath, JSON.stringify(value))
} catch (error) {
  log.error("Storage write failed", { filePath, error })
  throw error  // Propagate error
}
```

**Resilience Characteristics**:
- ✅ **Error Propagation**: File system errors bubble up
- ✅ **Atomic Writes**: Single `writeFile()` call (atomic on most file systems)
- ❌ **Retry Logic**: None (fails immediately on I/O error)
- ❌ **Backup**: No backup/recovery mechanism
- ❌ **Corruption Detection**: No checksums or validation
- ❌ **Cloud Storage**: Not supported (local file system only)

**Critical Gaps**:
1. **No Distributed Support**: Can't run multiple OpenCode instances (file locking only works locally)
2. **No Durability**: File corruption = data loss (no WAL, no backups)
3. **No Replication**: Single point of failure

---

## 8. Integration Boundary: MCP Client ↔ MCP Server

**Type**: Service Boundary (MCP Protocol)

**Location**:
- Client: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts`
- Server: `repos/metabob-cli/src/metabob_cli/mcp/` (MCP server implementation)

### Contract

**MCP Protocol**:
```typescript
// MCP SDK types
interface CallToolRequest {
  name: string
  arguments: Record<string, unknown>
}

interface CallToolResult {
  content: Array<{
    type: "text" | "image" | "resource"
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}
```

**Client Configuration**:
```typescript
// opencode.json (user config)
{
  "mcp": {
    "metabob": {
      "command": "metabob-server",
      "args": ["--mode", "mcp"],
      "env": {
        "METABOB_API_KEY": "..."
      }
    }
  }
}
```

**Client Implementation**:
```typescript
// mcp/index.ts:88-100
const clients: Record<string, MCPClient> = {}

for (const [key, mcp] of Object.entries(config)) {
  const transport = createTransport(mcp)  // stdio, sse, http
  const client = new Client({ name: "opencode", version: "1.0.0" }, {})
  await client.connect(transport)
  clients[key] = client
}
```

### Coupling: **Medium (protocol-based with config dependency)**

**Coupling Points**:
1. **Tool Discovery**: Client must query server for available tools
2. **Transport**: Supports stdio, SSE, HTTP (configured per server)
3. **Process Lifecycle**: stdio transport spawns subprocess
4. **Configuration**: Requires user to configure MCP servers

**Decoupling Mechanisms**:
- MCP protocol standard (not OpenCode-specific)
- Dynamic tool discovery
- Multiple transport options

### Resilience Patterns

**Error Handling**:
```typescript
// mcp/index.ts:95-98
const result = await create(key, mcp).catch(() => undefined)
if (!result) return  // Skip failed MCP server

status[key] = result.status  // "connected" | "disabled" | "failed"
```

**Connection Resilience**:
```typescript
// mcp/index.ts:58-86
return dynamicTool({
  execute: async (args) => {
    return client.callTool(
      { name: tool.name, arguments: args },
      CallToolResultSchema,
      {
        resetTimeoutOnProgress: true,  // ← Keep-alive
        timeout: timeout ?? DEFAULT_TIMEOUT,  // 30s default
      }
    )
  }
})
```

**Resilience Characteristics**:
- ✅ **Timeout**: 30-second default timeout
- ✅ **Keep-Alive**: Reset timeout on progress
- ✅ **Graceful Degradation**: Failed MCP servers don't crash OpenCode
- ✅ **Status Tracking**: Connection status available via `MCP.status()`
- ❌ **Reconnection**: No automatic reconnect on disconnect
- ❌ **Circuit Breaker**: No protection against failing tools
- ❌ **Retry Logic**: Single attempt per tool call

**Critical Gap**: MCP server crash requires OpenCode restart (no auto-reconnect).

---

## Boundary Summary Table

| # | Boundary Type | Components | Coupling | Resilience | Critical Gaps |
|---|--------------|------------|----------|-----------|---------------|
| 1 | Repository | opencode ↔ cli (MCP) | Loose | Graceful degradation | No versioning, no retry |
| 2 | Service | MCP ↔ Learning Loop (GET) | Medium | Timeout, error handling | No retry, no circuit breaker |
| 3 | Service | MCP ↔ Learning Loop (POST) | Medium | Timeout, error handling | Results lost on failure |
| 4 | Layer | Activity ↔ Storage | Tight | Error propagation | No optimistic locking |
| 5 | Layer | BoredomManager ↔ Activity | Medium | Try-catch, finally | Orphaned activities on failure |
| 6 | Event | Activity ↔ Event Bus | Loose | Non-blocking publish | Subscriber errors crash others |
| 7 | Data Store | Storage ↔ File System | Tight | Error propagation | No distributed support |
| 8 | Integration | MCP Client ↔ Server | Medium | Timeout, keep-alive | No auto-reconnect |

---

## Architecture Patterns Observed

### 1. **MCP Gateway Architecture**

**Pattern**: Frontend communicates with backend exclusively through MCP protocol

**Benefits**:
- Clean separation of concerns
- Language-agnostic integration
- Dynamic tool discovery

**Trade-offs**:
- String-based tool names (fragile)
- JSON serialization overhead
- No compile-time type checking

---

### 2. **Event-Driven Lifecycle Management**

**Pattern**: Activity lifecycle events trigger side effects (monitoring, logging, etc.)

**Benefits**:
- Loose coupling between components
- Easy to add new subscribers

**Trade-offs**:
- Subscriber errors affect all subscribers
- No event replay or persistence
- Synchronous delivery (not truly async)

---

### 3. **File-Based Storage (No Database)**

**Pattern**: Activities, sessions, messages stored as JSON files

**Benefits**:
- Simple, no database setup
- Easy to inspect and debug
- Version control friendly

**Trade-offs**:
- No ACID guarantees
- No distributed support
- No query capabilities (must scan files)

---

### 4. **Convention-Based Detection (No Schema Enforcement)**

**Pattern**: Boredom activities detected via title prefix and branch name

**Benefits**:
- Simple, human-readable
- No schema changes needed

**Trade-offs**:
- Fragile (string matching)
- No validation enforcement
- Can be inconsistent

---

## Critical Resilience Gaps

### High Priority

1. **Orphaned Activities on Failure** (Boundary 5)
   - **Issue**: Failed boredom activities left in "setup" status
   - **Impact**: Storage fills with incomplete activities
   - **Fix**: Add cleanup logic or status update to "failed"

2. **Lost Execution Results** (Boundary 3)
   - **Issue**: Results discarded if Learning Loop API down
   - **Impact**: Metrics not updated, learning loop broken
   - **Fix**: Add persistent queue for retry

3. **Subscriber Isolation** (Boundary 6)
   - **Issue**: One subscriber error crashes all subscribers
   - **Impact**: Event bus stops working for all components
   - **Fix**: Wrap each subscriber in try-catch

### Medium Priority

4. **No MCP Reconnection** (Boundary 8)
   - **Issue**: MCP server crash requires OpenCode restart
   - **Impact**: Loss of boredom activity capability until restart
   - **Fix**: Add reconnection logic with exponential backoff

5. **No API Retry Logic** (Boundaries 2, 3)
   - **Issue**: Transient errors not retried
   - **Impact**: Boredom activities fail unnecessarily
   - **Fix**: Add retry with exponential backoff (2-3 attempts)

6. **No Optimistic Locking** (Boundary 4)
   - **Issue**: Concurrent writes can corrupt activity data
   - **Impact**: Data loss, inconsistent state
   - **Fix**: Add version field and compare-and-swap logic

### Low Priority

7. **No Circuit Breaker** (Boundaries 2, 3)
   - **Issue**: Repeatedly calls failing API
   - **Impact**: Wasted resources, slow degradation
   - **Fix**: Track failure rate, stop calling if >80% fail

8. **No Distributed Support** (Boundary 7)
   - **Issue**: Can't run multiple OpenCode instances
   - **Impact**: Single user limitation
   - **Fix**: Add distributed storage backend (PostgreSQL, Redis)

---

## Recommendations

### Immediate Actions

1. **Add Zod validation** for MCP response schemas (Boundary 1)
   ```typescript
   const BoredomActivitySchema = z.object({
     activity_type: z.enum(["improve-template", "debug-failures", "optimize-performance"]),
     priority: z.number().min(0).max(1),
     template_id: z.string(),
     ...
   })
   
   const activities = BoredomActivitySchema.array().parse(data.activities)
   ```

2. **Wrap event subscribers** in error handlers (Boundary 6)
   ```typescript
   for (const sub of subscribers) {
     pending.push(
       sub(payload).catch((error) => {
         log.error("Subscriber error", { error, event: def.type })
       })
     )
   }
   ```

3. **Update activity status** on boredom execution failure (Boundary 5)
   ```typescript
   catch (error) {
     log.error("Boredom activity execution failed", { error })
     activity.status = "failed"
     activity.error = error.message
     await Activity.save(activity)
   }
   ```

### Short-Term Improvements

4. **Add retry logic** for Learning Loop API calls (Boundaries 2, 3)
   ```python
   from tenacity import retry, stop_after_attempt, wait_exponential
   
   @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
   async def fetch_boredom_activities(...):
       response = await client.get(...)
       ...
   ```

5. **Add persistent queue** for failed result posts (Boundary 3)
   - Use SQLite or file-based queue
   - Retry failed posts on next execution

6. **Add MCP reconnection** logic (Boundary 8)
   - Detect disconnection
   - Reconnect with exponential backoff
   - Notify user if reconnection fails

### Long-Term Enhancements

7. **Add contract tests** for MCP tools (Boundary 1)
   - JSON Schema validation
   - Version compatibility checks

8. **Add circuit breaker** for Learning Loop API (Boundaries 2, 3)
   - Track failure rate (sliding window)
   - Stop calling if >80% fail in 10 attempts
   - Reset after 1 minute

9. **Add distributed storage** backend (Boundary 7)
   - PostgreSQL or SurrealDB backend
   - Optimistic locking via version field
   - Support multiple OpenCode instances
