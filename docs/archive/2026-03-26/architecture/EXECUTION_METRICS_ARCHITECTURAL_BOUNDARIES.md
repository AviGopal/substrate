# Activity Execution Metrics - Architectural Boundaries Analysis

## Overview

This document analyzes all architectural boundaries in the execution metrics flow, documenting contracts, coupling, resilience patterns, and integration points.

---

## Boundary 1: Repository Boundary (Frontend Monorepo)

**Type**: Repository Boundary  
**Location**: Internal to `metabob-opencode` monorepo  
**Packages Involved**:
- `packages/opencode/` - Core OpenCode functionality
- No cross-package imports for metrics flow (self-contained)

**Contract**:
```typescript
// Internal module imports only
import { TemplateMetricsClient } from "./template-metrics-client"
import { ActivityTemplate } from "./activity-template"
import { Storage } from "../storage/storage"
```

**Coupling**: **Tight** (internal modules)
- Direct imports between modules
- Shared types and interfaces
- Same TypeScript compilation context
- No versioning between modules

**Resilience**:
- ✅ Type safety enforced at compile time
- ✅ No network boundary (same process)
- ✅ Shared error handling patterns
- ❌ No isolation (failure affects entire process)

**Versioning Concerns**: None (monolithic compilation)

---

## Boundary 2: Service Boundary (Frontend → Backend via MCP)

**Type**: Service Boundary (RPC over HTTP/SSE/stdio)  
**Location**: `TemplateMetricsClient` → MCP Client → Backend MCP Server

### 2a. Frontend MCP Client

**Contract**:
```typescript
// Frontend: template-metrics-client.ts
const clients = await MCP.clients()
const metabobClient = clients["metabob"]

const result = await metabobClient.callTool({
  name: "metabob_report_execution",  // Tool name contract
  arguments: {
    activity_id: string,
    template_id: string,
    success: boolean,
    duration: number,
    cost: number,
    tokens: { input: number, output: number, cache: number }
  }
})
```

**Response Contract**:
```typescript
{
  content: Array<{ type: "text", text: string }>,
  metadata?: Record<string, unknown>
}
```

**Coupling**: **Loose** (MCP protocol)
- Tool name string coupling (brittle!)
- JSON serialization boundary
- Protocol version dependency (`@modelcontextprotocol/sdk`)
- No shared types between frontend/backend

**Resilience Patterns**:

1. **Graceful Degradation**:
   ```typescript
   TemplateMetricsClient.reportExecution(...)
     .catch(() => {
       // Silent failure - metrics reporting is not critical path
     })
   ```
   - Non-blocking: Failures don't crash activity execution
   - Logged but not thrown

2. **Client Availability Check**:
   ```typescript
   const metabobClient = clients["metabob"]
   if (!metabobClient) {
     log.debug("metabob mcp client not available")
     return undefined
   }
   ```

3. **Response Parsing Safety**:
   ```typescript
   try {
     const parsed = JSON.parse(textContent)
     return parsed
   } catch (parseError) {
     log.debug("MCP content is not JSON, returning as-is")
     return textContent as unknown as T
   }
   ```

4. **Timeout Protection**:
   ```typescript
   // In MCP client
   const DEFAULT_TIMEOUT = 30_000  // 30 seconds
   ```

**Error Handling**:
- ✅ Try-catch at multiple layers
- ✅ Undefined return on failure (Optional pattern)
- ✅ Debug logging for troubleshooting
- ❌ No retry logic
- ❌ No circuit breaker
- ❌ No metrics on failure rate

**Versioning Concerns**:
- ⚠️ **Tool name hardcoded** (`"metabob_report_execution"`)
  - Backend tool name change breaks frontend
  - No version negotiation
- ⚠️ **Schema not versioned**
  - Adding required fields breaks compatibility
  - No schema validation at runtime
- ✅ Protocol version managed by SDK dependency

---

### 2b. Backend MCP Server

**Contract**:
```python
# Backend: activity_template_tools.py
@mcp.tool(
    name="metabob_post_activity_result",  # ⚠️ NAME MISMATCH
    description="Post execution results for activity template",
)
async def metabob_post_activity_result(
    activity_id: str,
    result: dict,  # ⚠️ SCHEMA MISMATCH
    ctx: Context = None,
):
    # ...
```

**Expected Schema** (mismatch with frontend):
```python
{
  "activity_id": str,
  "result": {
    "success": bool,
    "duration": int,
    "cost": float,
    "tokens": dict
  }
}
```

**Actual Frontend Sends**:
```typescript
{
  activity_id: string,
  template_id: string,  // ❌ Not used
  success: boolean,      // ❌ Wrong nesting level
  duration: number,
  cost: number,
  tokens: object
}
```

**Coupling**: **Broken** (schema mismatch)
- Tool name doesn't match: `metabob_report_execution` vs `metabob_post_activity_result`
- Schema structure doesn't match: flat vs nested
- No shared schema definition

**Resilience**:
- ✅ Try-catch in tool handler
- ✅ Non-fatal errors (logged but not raised)
- ❌ No input validation
- ❌ Silent failure on schema mismatch
- ❌ No alerting on errors

**Error Handling**:
```python
try:
    # Update metrics
    activity_templates.update_metrics(template_id, result)
    return {"status": "success", ...}
except Exception as e:
    logger.error(f"Failed: {e}")
    return {"status": "error", "error": str(e)}
```

---

## Boundary 3: Layer Boundary (Service → Repository)

**Type**: Layer Boundary (Service calls Repository)  
**Location**: Frontend `TemplateLoader` → `ActivityTemplate` repository

**Contract**:
```typescript
// Service Layer
await TemplateLoader.updateMetrics(id, metrics)

// Repository Layer
await ActivityTemplate.update(id, metrics)
```

**Coupling**: **Medium** (internal abstractions)
- Direct function calls (same process)
- Shared TypeScript types
- No protocol boundary
- Clear separation of concerns

**Layers**:
1. **Service Layer** (`TemplateLoader`): Orchestration, dual write, cache invalidation
2. **Repository Layer** (`ActivityTemplate`): Data persistence, validation
3. **Storage Layer** (`Storage`): File I/O abstraction

**Resilience**:
- ✅ Try-catch per backend in service layer
- ✅ Independent failure handling
- ❌ No transaction coordination
- ❌ Can have inconsistent state

**Pattern**: Dual Write (potential consistency issue)
```typescript
// Update Metabob (can fail)
try {
  await TemplateServiceClient.updateTemplateMetrics(...)
  log.info("metrics updated in metabob")
} catch (error) {
  log.warn("metabob metrics update failed")
}

// Update local (can fail independently)
try {
  await ActivityTemplate.update(id, metrics)
  log.info("metrics updated in local")
} catch (error) {
  log.warn("local metrics update failed")
}
```

**Failure Modes**:
- Backend succeeds, local fails → Inconsistent
- Local succeeds, backend fails → Diverged metrics
- Both fail → Data loss (silent)

---

## Boundary 4: Data Store Boundary (Frontend Local Storage)

**Type**: Data Store Boundary (File System)  
**Location**: `Storage.write()` → JSON files on disk

**Contract**:
```typescript
// Frontend: storage.ts
export async function write<T>(key: string[], content: T) {
  const dir = await state().then((x) => x.dir)
  const target = path.join(dir, ...key) + ".json"
  
  using _ = await Lock.write("storage")
  await Bun.write(target, JSON.stringify(content, null, 2))
}
```

**Storage Location**:
- Path: `~/.local/share/opencode/storage/`
- Format: JSON files
- Naming: `{key[0]}/{key[1]}/.../{key[n]}.json`
- Example: `activity/{activity_id}.json`

**Coupling**: **Loose** (file-based)
- No schema enforcement (JSON)
- Manual serialization/deserialization
- File system lock for concurrency

**Resilience Patterns**:

1. **File Locking**:
   ```typescript
   using _ = await Lock.write("storage")
   ```
   - Prevents concurrent write corruption
   - Automatic unlock on scope exit (using RAII)

2. **Error Handling**:
   ```typescript
   async function withErrorHandling<T>(body: () => Promise<T>) {
     return body().catch((e) => {
       if (errnoException.code === "ENOENT") {
         throw new NotFoundError({ message: `Resource not found` })
       }
       throw e
     })
   }
   ```

3. **Pretty Print**:
   ```typescript
   JSON.stringify(content, null, 2)  // Indented for debugging
   ```

**Concurrency Control**: **Good**
- ✅ Write lock prevents corruption
- ✅ RAII pattern ensures cleanup
- ⚠️ No read locks (read-write race possible)

**Durability**: **Filesystem dependent**
- ✅ Synchronous write (Bun.write waits for flush)
- ❌ No backup before overwrite
- ❌ No transaction log
- ❌ No corruption detection

**Versioning Concerns**:
- ⚠️ No schema version in JSON
- ⚠️ Adding required fields breaks old readers
- ✅ Migrations exist in `MIGRATIONS[]` array

---

## Boundary 5: Data Store Boundary (Backend Local Storage)

**Type**: Data Store Boundary (File System)  
**Location**: `activity_templates.update_metrics()` → JSON files on disk

**Contract**:
```python
# Backend: activity_templates.py
def update_metrics(template_id: str, result: dict) -> None:
    storage_path = get_activity_storage_path()  # ~/.metabob/activities/
    template_file = storage_path / f"{template_id}.json"
    
    # Load
    with open(template_file, encoding="utf-8") as f:
        template_data = json.load(f)
    
    # Update metrics
    template_data["estimated_metrics"] = {...}
    
    # Save
    with open(template_file, "w", encoding="utf-8") as f:
        json.dump(template_data, f, indent=2)
```

**Storage Location**:
- Path: `~/.metabob/activities/`
- Format: JSON files
- Naming: `{template_id}.json`
- Example: `add-rest-endpoint.json`

**Coupling**: **Loose** (file-based)
- No schema enforcement
- Manual serialization
- No locking mechanism

**Resilience Patterns**:

1. **File Existence Check**:
   ```python
   if not template_file.exists():
       logger.warning(f"Template not found: {template_id}")
       return
   ```

2. **Error Handling**:
   ```python
   try:
       # Update logic
   except Exception as e:
       logger.error(f"Failed to update metrics: {e}")
       # Non-fatal - don't raise
   ```

3. **Graceful Degradation**:
   - Returns silently on file not found
   - Logs errors but doesn't crash

**Concurrency Control**: **MISSING**
- ❌ No file locking
- ❌ Concurrent updates can corrupt file
- ❌ Last write wins (data loss)
- ⚠️ Low probability (templates don't update frequently)

**Durability**: **Filesystem dependent**
- ✅ Synchronous write (blocks until done)
- ❌ No backup before overwrite
- ❌ No atomic write (temp file + rename)
- ❌ No corruption detection

**Versioning Concerns**:
- ⚠️ No schema version in JSON
- ⚠️ No migration support
- ⚠️ Format changes break old files

---

## Boundary 6: Cross-Repository Boundary

**Type**: Repository Boundary (Frontend ↔ Backend)  
**Location**: `metabob-opencode` ↔ `metabob-cli`

**Contract**: **MCP Protocol**
- Protocol: Model Context Protocol
- Transport: HTTP/SSE/stdio (configurable)
- Serialization: JSON
- Schema: Implicit (no shared types)

**Repositories**:
1. **Frontend**: `metabob-opencode`
   - Language: TypeScript
   - Runtime: Bun/Node.js
   - Storage: `~/.local/share/opencode/storage/`

2. **Backend**: `metabob-cli`
   - Language: Python
   - Runtime: Python 3.x
   - Storage: `~/.metabob/activities/`

**Coupling**: **Very Loose** (protocol boundary)
- No shared code
- No shared types
- Tool names as strings
- JSON schema compatibility

**Integration Points**:

1. **Tool Discovery**:
   ```typescript
   // Frontend discovers backend tools
   const tools = await metabobClient.listTools()
   ```

2. **Tool Invocation**:
   ```typescript
   // Frontend calls backend tool
   await metabobClient.callTool({
     name: "tool_name",
     arguments: {...}
   })
   ```

3. **Response Parsing**:
   ```typescript
   // Frontend parses backend response
   const parsed = JSON.parse(result.content[0].text)
   ```

**Resilience**:
- ✅ Language independence (polyglot)
- ✅ Process isolation (crash independence)
- ✅ Graceful degradation (frontend works without backend)
- ❌ No shared schema validation
- ❌ No contract testing
- ❌ Breaking changes detected at runtime only

**Versioning Strategy**: **None**
- ⚠️ No API versioning
- ⚠️ No compatibility matrix
- ⚠️ Backend changes break frontend silently

**Deployment Independence**:
- ✅ Frontend and backend can be deployed separately
- ✅ Different release cycles
- ❌ No version compatibility checking
- ❌ No deprecation strategy

---

## Boundary 7: Event Bus Boundary

**Type**: Layer Boundary (Pub-Sub)  
**Location**: Activity lifecycle events

**Contract**:
```typescript
// Publisher
Bus.publish(Event.Completed, { activity }).catch(() => {})
Bus.publish(Event.Updated, { activity }).catch(() => {})
Bus.publish(Event.Created, { activity }).catch(() => {})
```

**Coupling**: **Loose** (event-driven)
- Fire-and-forget
- No return value
- Catch-all error handler
- Asynchronous

**Resilience**:
- ✅ Non-blocking (doesn't affect publisher)
- ✅ Error swallowed (`.catch(() => {})`)
- ❌ No retry on failure
- ❌ No delivery guarantee
- ❌ No event persistence

**Use Case**: Notifications, UI updates, side effects

---

## Critical Boundary Issues

### Issue 1: Broken Service Boundary (Tool Name Mismatch)

**Boundary**: Frontend → Backend MCP  
**Problem**: Tool name doesn't match
- Frontend calls: `metabob_report_execution`
- Backend provides: `metabob_post_activity_result`

**Impact**: **HIGH** - Complete data loss
- All metric reporting fails
- Silent failure (graceful degradation)
- No alerting or monitoring

**Fix**: Rename backend tool to match frontend

---

### Issue 2: Schema Mismatch at Service Boundary

**Boundary**: Frontend → Backend MCP  
**Problem**: Schema structure doesn't match
- Frontend sends flat: `{success, duration, cost}`
- Backend expects nested: `{result: {success, duration, cost}}`

**Impact**: **HIGH** - Data not found
- Backend can't parse frontend data
- `result.get("success")` returns `None`
- Metrics update silently fails

**Fix**: Align schemas (prefer flat structure)

---

### Issue 3: Missing Concurrency Control (Backend Storage)

**Boundary**: Backend → File System  
**Problem**: No file locking
- Concurrent writes can corrupt JSON
- Last write wins (data loss)

**Impact**: **MEDIUM** - Rare but possible corruption
- Low probability (templates don't update often)
- Corruption hard to detect
- No recovery mechanism

**Fix**: Implement file locking or atomic writes

---

### Issue 4: Dual Write Consistency Issue

**Boundary**: Service Layer (Dual Write)  
**Problem**: No transaction coordination
- Backend succeeds, local fails → Inconsistent
- Local succeeds, backend fails → Diverged

**Impact**: **MEDIUM** - Inconsistent state
- Metrics drift over time
- No reconciliation mechanism
- Hard to detect inconsistency

**Fix**: Event sourcing or compensating transactions

---

### Issue 5: No Schema Versioning

**Boundary**: All data store boundaries  
**Problem**: No version field in JSON
- Adding required fields breaks old readers
- No migration strategy
- Breaking changes undetected

**Impact**: **LOW** - Future maintainability issue
- Currently works (stable schema)
- Breaking changes require manual migration
- Hard to evolve schema

**Fix**: Add `schema_version` field to JSON

---

## Architectural Patterns Observed

### Pattern 1: Graceful Degradation ✅

**Where**: Frontend MCP calls, Event bus  
**Pattern**:
```typescript
someOperation().catch(() => {
  // Silent failure - operation is not critical
})
```

**Benefits**:
- Resilience to backend failures
- Activity execution continues
- User experience not interrupted

**Drawbacks**:
- Silent data loss
- Hard to detect failures
- No alerting

---

### Pattern 2: Dual Write ⚠️

**Where**: TemplateLoader  
**Pattern**:
```typescript
// Write to both backends
await backendWrite()
await localWrite()
```

**Benefits**:
- Availability (local works if backend down)
- Performance (local reads are fast)

**Drawbacks**:
- No atomicity (can partially fail)
- Consistency drift
- Complex failure modes

**Alternative**: Event sourcing, CQRS

---

### Pattern 3: Repository Pattern ✅

**Where**: ActivityTemplate, Storage  
**Pattern**:
```typescript
// Repository interface
interface Repository {
  save(entity): Promise<void>
  load(id): Promise<Entity>
  update(id, changes): Promise<Entity>
}
```

**Benefits**:
- Clear separation of concerns
- Testable (can mock storage)
- Swappable backends

---

### Pattern 4: Fire-and-Forget Events ✅

**Where**: Bus.publish  
**Pattern**:
```typescript
Bus.publish(event, data).catch(() => {})
```

**Benefits**:
- Decoupling
- Non-blocking
- Extensibility

**Drawbacks**:
- No delivery guarantee
- Hard to debug
- No ordering guarantee

---

## Recommendations by Priority

### High Priority (Data Loss Risk)

1. **Fix tool name mismatch**: Rename `metabob_post_activity_result` → `metabob_report_execution`
2. **Fix schema mismatch**: Align frontend/backend schemas (prefer flat)
3. **Add monitoring**: Track MCP call failures, alert on high rate

### Medium Priority (Consistency Risk)

4. **Add concurrency control**: File locking in backend storage
5. **Add schema validation**: Runtime validation at MCP boundary
6. **Add contract tests**: Ensure frontend/backend compatibility

### Low Priority (Future Maintainability)

7. **Add schema versioning**: Include `schema_version` in JSON
8. **Add migration support**: Backend schema evolution
9. **Implement event sourcing**: Replace dual write with event log
10. **Add API versioning**: Version MCP tool names

---

## Testing Strategy

### Boundary Testing Checklist

- [ ] **Service Boundary**: MCP call succeeds end-to-end
- [ ] **Service Boundary**: MCP failure doesn't crash frontend
- [ ] **Service Boundary**: Schema validation passes
- [ ] **Storage Boundary**: Concurrent writes don't corrupt data
- [ ] **Storage Boundary**: File not found handled gracefully
- [ ] **Dual Write**: Partial failure detected and logged
- [ ] **Dual Write**: Inconsistent state can be reconciled
- [ ] **Cross-Repo**: Frontend works without backend running
- [ ] **Cross-Repo**: Backend version changes don't break frontend

### Contract Testing

```typescript
// Example: Contract test for MCP tool
test("metabob_report_execution contract", async () => {
  const input = {
    activity_id: "test-123",
    template_id: "test-template",
    success: true,
    duration: 5000,
    cost: 0.05,
    tokens: { input: 100, output: 50, cache: 20 }
  }
  
  const result = await callTool("metabob_report_execution", input)
  
  expect(result).toMatchObject({
    status: "success",
    timestamp: expect.any(String),
    activity_id: input.activity_id
  })
})
```

---

## Summary Table

| Boundary | Type | Coupling | Resilience | Critical Issues |
|----------|------|----------|------------|-----------------|
| 1. Monorepo | Repository | Tight | Good | None |
| 2. MCP Service | Service (RPC) | Loose | Good | Tool name mismatch, schema mismatch |
| 3. Service→Repo | Layer | Medium | Fair | Dual write consistency |
| 4. Frontend Storage | Data Store | Loose | Good | None (has locking) |
| 5. Backend Storage | Data Store | Loose | Poor | No concurrency control |
| 6. Cross-Repo | Repository | Very Loose | Good | No versioning strategy |
| 7. Event Bus | Layer | Loose | Good | No delivery guarantee |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  metabob-opencode (Frontend)                                    │
│                                                                 │
│  ┌──────────────┐                                              │
│  │  Activity    │ (1) Local metrics update                     │
│  │  Execution   │────────────────────────┐                     │
│  └──────┬───────┘                        │                     │
│         │                                 ▼                     │
│         │ (2) Report metrics    ┌─────────────────┐           │
│         │                       │  TemplateLoader │           │
│         ▼                       │   (Dual Write)  │           │
│  ┌─────────────────┐           └────┬─────┬──────┘           │
│  │ MetricsClient   │                │     │                   │
│  │  (MCP Gateway)  │                │     │                   │
│  └────────┬────────┘                │     │                   │
│           │                         │     │                   │
│           │ (3) MCP call            │     │                   │
│           │                         │     │                   │
│           ▼                         ▼     ▼                   │
│  ┌─────────────────┐      ┌─────────┐  ┌──────────┐         │
│  │   MCP Client    │      │ Backend │  │  Local   │         │
│  │  (SDK wrapper)  │      │   MCP   │  │ Storage  │         │
│  └────────┬────────┘      └────┬────┘  └────┬─────┘         │
│           │                    │            │               │
└───────────┼────────────────────┼────────────┼───────────────┘
            │                    │            │
            │ HTTP/SSE/stdio     │            │ File I/O
            ▼                    ▼            ▼
┌───────────────────┐   ┌────────────┐   ┌─────────────┐
│ metabob-cli       │   │ MCP Server │   │ ~/.local/   │
│ (Backend)         │   │  (FastMCP) │   │ share/      │
│                   │   └─────┬──────┘   │ opencode/   │
│ ┌───────────────┐ │         │          │ storage/    │
│ │ MCP Tool      │ │         │          └─────────────┘
│ │ Handler       │◄┼─────────┘
│ └───────┬───────┘ │
│         │         │
│         ▼         │
│ ┌───────────────┐ │
│ │ update_metrics│ │
│ └───────┬───────┘ │
│         │         │
│         ▼         │
│ ┌───────────────┐ │
│ │ File I/O      │ │
│ └───────┬───────┘ │
│         │         │
└─────────┼─────────┘
          ▼
    ┌──────────┐
    │~/.metabob│
    │/activities│
    └──────────┘
```

---

## Next Steps

Use `propagate-change-through-flow` activity to:

1. Fix tool name: `metabob_post_activity_result` → `metabob_report_execution`
2. Fix schema: Align flat structure
3. Add file locking: Backend storage
4. Add monitoring: Track MCP failures
5. Add contract tests: Ensure compatibility
