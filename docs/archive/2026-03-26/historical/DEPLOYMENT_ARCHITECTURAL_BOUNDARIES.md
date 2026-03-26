# DevBob Deployment - Architectural Boundaries Analysis

## Overview

This document analyzes all architectural boundaries in the deployment workflow, documenting contracts, coupling levels, resilience patterns, and versioning concerns.

---

## 1. Repository Boundaries (Package Dependencies)

### Boundary 1.1: OpenCode → metabob-cli (MCP Client)
**Type:** Cross-Repo Dependency  
**Location:** `repos/metabob-opencode/packages/opencode/src/mcp/` | `repos/metabob-cli/src/metabob_cli/mcp/`

**Contract:**
```typescript
// OpenCode MCP Client (TypeScript)
interface MCPToolCall {
  name: string                    // Tool name (e.g., "metabob_fetch_boredom_activities")
  arguments: Record<string, unknown>  // Tool-specific arguments
}

interface MCPToolResult {
  content: Array<{
    type: "text" | "image" | "resource"
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

// Transport Protocols
type Transport = 
  | StdioClientTransport      // stdin/stdout JSON-RPC
  | SSEClientTransport        // Server-Sent Events over HTTP
  | StreamableHTTPClientTransport  // HTTP streaming
```

**metabob-cli MCP Server Contract (Python):**
```python
# repos/metabob-cli/src/metabob_cli/mcp/server.py

from mcp.server import Server
from mcp.types import Tool, TextContent

# Tool registration pattern
@server.call_tool()
async def metabob_fetch_boredom_activities(
    max_activities: int = 5,
    priority_threshold: float = 0.6,
    exclude_recent_hours: int = 24
) -> list[TextContent]:
    """Fetch boredom activities from backend API."""
    # Query backend
    activities = await backend_api.get_boredom_activities(...)
    
    # Return JSON-RPC response
    return [TextContent(
        type="text",
        text=json.dumps({
            "status": "success",
            "activities": activities
        })
    )]
```

**Coupling:** **Loose**
- Protocol: JSON-RPC over stdio/HTTP (language-agnostic)
- No shared types or interfaces (schema validation on both sides)
- OpenCode doesn't import metabob-cli code
- Communication via MCP SDK (standardized protocol)

**Versioning:**
- MCP Protocol Version: 1.0 (stable)
- Tool signatures versioned independently
- Breaking changes: Add new tool name (e.g., `metabob_fetch_boredom_activities_v2`)
- Backward compatibility: Old tool names continue to work

**Resilience:**
```typescript
// OpenCode: Graceful degradation on MCP failure
async function callTool(name: string, args: unknown): Promise<MCPToolResult> {
  try {
    const result = await client.callTool({ name, arguments: args }, CallToolResultSchema, {
      resetTimeoutOnProgress: true,
      timeout: 30_000  // 30 second timeout
    })
    return result
  } catch (error) {
    log.error(`MCP tool call failed: ${name}`, { error })
    // Return empty result, don't throw
    return { content: [{ type: "text", text: JSON.stringify({ status: "error", error: String(error) }) }] }
  }
}
```

**Error Handling:**
- Timeout: 30 seconds per tool call
- Network errors: Log and return error result
- Tool not found: MCP SDK throws, OpenCode catches
- Malformed response: JSON parse error → empty result

**Health Check:**
- MCP client checks server availability at startup
- Auto-reconnect on disconnect (stdio restarts child process)
- No explicit health endpoint (stdio process alive = healthy)

---

### Boundary 1.2: OpenCode → Storage Layer (Local Files)
**Type:** Data Store Boundary  
**Location:** `repos/metabob-opencode/packages/opencode/src/storage/` | Filesystem

**Contract:**
```typescript
// Storage namespace (storage.ts)
export namespace Storage {
  /**
   * Write data to storage with hierarchical key.
   * 
   * Key format: ["category", "subcategory", "id"]
   * Example: ["impulse-session", "sess_abc123", "my-impulse"]
   * 
   * Storage path: ~/.local/share/opencode/storage/impulse-session/sess_abc123/my-impulse.json
   */
  export async function write<T>(key: string[], data: T): Promise<void>
  
  /**
   * Read data from storage.
   * Throws NotFoundError if key doesn't exist.
   */
  export async function read<T>(key: string[]): Promise<T>
  
  /**
   * Delete data from storage.
   */
  export async function remove(key: string[]): Promise<void>
  
  /**
   * List keys matching prefix.
   */
  export async function list(prefix: string[]): Promise<string[][]>
}

// Data Schemas (Zod validation)
const VesselVersionSchema = z.object({
  name: z.string(),
  version: z.string(),
  checksum: z.string(),
  downloadUrl: z.string()
})

const ActivityTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(["feature", "bugfix", "refactor", "tool", "infrastructure"]),
  tasks: z.array(TaskSchema)
  // ... (full schema)
})
```

**Storage Locations:**
```bash
~/.local/share/opencode/storage/
├── impulse-session/          # Session-scoped impulses
│   ├── sess_abc123/
│   │   ├── my-impulse.json
│   │   └── ...
├── impulse-activity/         # Activity-scoped impulses
│   ├── imp_def456.json
│   └── ...
├── activity-template/        # Activity templates (deprecated, moved to TemplateRepository)
│   ├── update-vessel-opencode-binary.json
│   └── ...
├── session/                  # Session metadata
│   ├── proj_id/
│   │   ├── sess_abc123.json
│   │   └── ...
├── message/                  # Session messages
│   ├── sess_abc123/
│   │   ├── msg_001.json
│   │   └── ...
└── vessel-versions.json      # Vessel version tracking (workspace-specific)
```

**Coupling:** **Tight** (within OpenCode)
- Direct filesystem access (no abstraction layer)
- Hierarchical key structure couples storage to data model
- Zod schemas tightly coupled to data structures

**Versioning:**
- Schema versions tracked per data type
- Migration system for storage layout changes (see `MIGRATIONS` in storage.ts)
- Backward compatibility: Read old format, write new format

**Resilience:**
```typescript
// Graceful handling of missing files
export async function read<T>(key: string[]): Promise<T> {
  const filePath = keyToPath(key)
  
  try {
    const content = await fs.readFile(filePath, "utf-8")
    return JSON.parse(content)
  } catch (error) {
    if (error.code === "ENOENT") {
      throw NotFoundError.create({ message: `Key not found: ${key.join("/")}` })
    }
    // Other errors (permissions, disk full, etc.)
    throw error
  }
}

// Atomic writes with temp file + rename
export async function write<T>(key: string[], data: T): Promise<void> {
  const filePath = keyToPath(key)
  const tempPath = `${filePath}.tmp`
  
  // Write to temp file
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2))
  
  // Atomic rename
  await fs.rename(tempPath, filePath)
}
```

**Error Handling:**
- File not found: Throws NotFoundError (expected, caller handles)
- Permission denied: Throws (fatal, can't recover)
- Disk full: Throws (fatal, user intervention needed)
- Corrupted JSON: Throws (caller decides recovery strategy)

**Lock Mechanism:**
```typescript
// Lock for concurrent writes (in-memory)
const lock = Lock.create()

export async function write<T>(key: string[], data: T): Promise<void> {
  const filePath = keyToPath(key)
  
  // Acquire lock for this file path
  await lock.acquire(filePath, async () => {
    // ... write logic
  })
}
```

---

## 2. Service Boundaries (Network/RPC)

### Boundary 2.1: OpenCode MCP Client → metabob-cli MCP Server
**Type:** Service Boundary (JSON-RPC over stdio)  
**Location:** OpenCode process | metabob-cli child process

**Contract:**
```typescript
// JSON-RPC 2.0 Request
{
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "metabob_fetch_boredom_activities",
    arguments: {
      max_activities: 5,
      priority_threshold: 0.6,
      exclude_recent_hours: 24
    }
  }
}

// JSON-RPC 2.0 Response
{
  jsonrpc: "2.0",
  id: 1,
  result: {
    content: [{
      type: "text",
      text: "{\"status\":\"success\",\"activities\":[...]}"
    }],
    isError: false
  }
}

// JSON-RPC 2.0 Error Response
{
  jsonrpc: "2.0",
  id: 1,
  error: {
    code: -32603,  // Internal error
    message: "Tool execution failed",
    data: { details: "..." }
  }
}
```

**Transport:** stdio (stdin/stdout)
- OpenCode spawns metabob-cli as child process
- Communication: stdin writes, stdout reads
- stderr: Separate channel for logs (not JSONRPC)

**Coupling:** **Loose**
- Protocol: JSON-RPC 2.0 (standard, language-agnostic)
- No shared code between OpenCode and metabob-cli
- Schema validation on both sides (independent)

**Versioning:**
- MCP Protocol: 1.0 (stable, no breaking changes)
- Tool signatures: Independent versioning (add v2 tools for breaking changes)

**Resilience:**
```typescript
// OpenCode: Auto-restart on child process crash
let mcpProcess: ChildProcess | null = null

async function startMCPServer() {
  if (mcpProcess) {
    mcpProcess.kill()
  }
  
  mcpProcess = spawn("metabob-cli", ["mcp"], {
    stdio: ["pipe", "pipe", "inherit"]  // stdin, stdout, stderr
  })
  
  mcpProcess.on("exit", (code) => {
    log.error(`MCP server exited with code ${code}`)
    // Auto-restart after 1 second
    setTimeout(startMCPServer, 1000)
  })
}
```

**Error Handling:**
- Process crash: Auto-restart, log error
- Timeout: 30 seconds per tool call, return error result
- Invalid JSON: Log and return error result
- Tool not found: MCP SDK returns error code -32601

**Health Check:**
- Process alive check: `mcpProcess.killed === false`
- Ping tool call: `tools/list` (lightweight, returns tool list)

---

### Boundary 2.2: metabob-cli MCP Server → Metabob Backend API
**Type:** Service Boundary (HTTP REST API)  
**Location:** metabob-cli process | Backend API server

**Contract:**
```python
# Backend API Endpoints

# 1. Fetch Boredom Activities
GET /api/v1/activities/boredom
Query Params:
  - max_activities: int (default: 5)
  - priority_threshold: float (default: 0.6)
  - exclude_recent_hours: int (default: 24)

Response:
{
  "status": "success",
  "activities": [
    {
      "activity_type": "improve-template",
      "priority": 0.85,
      "template_id": "update-vessel-opencode-binary",
      "improvement_gradient": 0.3,
      "reason": "Success rate dropped",
      "estimated_effort": "15-20 minutes",
      "metrics": {
        "success_rate": 0.8,
        "avg_cost": 0.15,
        "avg_duration_ms": 45000,
        "execution_count": 20,
        "failure_patterns": [...]
      }
    }
  ]
}

# 2. Post Activity Result
POST /api/v1/activities/results
Headers:
  - Authorization: Bearer <session_token>
  - Content-Type: application/json

Body:
{
  "activity_id": "act_abc123",
  "template_id": "update-vessel-opencode-binary",
  "success": true,
  "duration": 45123,
  "cost": 0.18,
  "tokens": {
    "input": 8500,
    "output": 1200,
    "cache": 15000
  },
  "cancelled": false
}

Response:
{
  "status": "success",
  "message": "Activity result recorded"
}

# 3. Register Activity Template
POST /api/v1/templates
Headers:
  - Authorization: Bearer <session_token>
  - Content-Type: application/json

Body: ActivityTemplate (full schema)

Response:
{
  "status": "success",
  "template_id": "update-vessel-opencode-binary",
  "message": "Template registered"
}
```

**Coupling:** **Loose**
- Protocol: HTTP REST (standard, language-agnostic)
- Authentication: Bearer token (session-based)
- Schema: JSON (validated on both sides)

**Versioning:**
- API Version: /api/v1/ (explicit in URL)
- Breaking changes: New version (/api/v2/), maintain v1
- Deprecation policy: 6 months notice, redirect to new version

**Resilience:**
```python
# metabob-cli: Retry with exponential backoff
async def fetch_boredom_activities(
    max_activities: int = 5,
    priority_threshold: float = 0.6,
    exclude_recent_hours: int = 24
) -> list[BoredomActivity]:
    url = f"{config.base_url}/api/v1/activities/boredom"
    params = {
        "max_activities": max_activities,
        "priority_threshold": priority_threshold,
        "exclude_recent_hours": exclude_recent_hours
    }
    
    retries = 3
    backoff = 1  # seconds
    
    for attempt in range(retries):
        try:
            response = await http_client.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()["activities"]
        except httpx.HTTPStatusError as e:
            if e.response.status_code >= 500:
                # Server error, retry
                if attempt < retries - 1:
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue
            # Client error (4xx), don't retry
            logger.error(f"Backend API error: {e.response.status_code}")
            return []
        except httpx.TimeoutException:
            logger.error("Backend API timeout")
            if attempt < retries - 1:
                await asyncio.sleep(backoff)
                backoff *= 2
                continue
            return []
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return []
    
    return []  # All retries failed
```

**Error Handling:**
- 5xx errors: Retry with exponential backoff (3 attempts, 1s → 2s → 4s)
- 4xx errors: No retry (client error, log and return empty)
- Timeout: 10 seconds per request, retry
- Network errors: Retry
- All retries failed: Return empty result, log error

**Health Check:**
- Endpoint: `GET /health`
- Response: `{"status": "healthy", "services": {...}}`
- Used by entrypoint.sh during container startup

---

### Boundary 2.3: BoredomManager → ActivityTool (Internal Service)
**Type:** Layer Boundary (Service Layer)  
**Location:** BoredomManager | ActivityTool

**Contract:**
```typescript
// BoredomManager calls ActivityTool
interface ActivityToolExecuteParams {
  templateId: string
  variables: Record<string, unknown>
  reason: string
  subagent?: string
  abortSignal?: AbortSignal
}

interface ActivityToolExecuteResult {
  activityId: string
  success: boolean
  cancelled: boolean
  error?: string
  metadata?: {
    status: "done" | "failed"
    cost: { total: number }
    tokens: { input: number, output: number, cache: number }
  }
}

// ActivityTool.execute() function signature
async function execute(
  params: ActivityToolExecuteParams,
  ctx: ToolContext
): Promise<ActivityToolExecuteResult>
```

**Coupling:** **Medium**
- Shared types (TypeScript interfaces)
- Direct function call (in-process)
- BoredomManager depends on ActivityTool

**Versioning:**
- No versioning (internal API)
- Breaking changes: Update both BoredomManager and ActivityTool

**Resilience:**
```typescript
// BoredomManager: Handle activity execution failures
async function executeBoredomActivity(
  manager: ManagerInstance,
  boredomActivity: BoredomActivity
) {
  const abortController = new AbortController()
  
  // Store abort controller for cancellation
  manager.currentActivity = {
    activityId: "",
    abortController
  }
  
  try {
    const result = await ActivityTool.execute({
      templateId: boredomActivity.template_id,
      variables: extractVariables(boredomActivity.metrics),
      reason: boredomActivity.reason,
      subagent: "general"
    }, {
      sessionID: manager.sessionID,
      abortSignal: abortController.signal
    })
    
    // Report results to backend
    await reportResults(result)
    
  } catch (error) {
    log.error(`Boredom activity execution failed`, { error })
    // Don't throw, continue monitoring
  } finally {
    manager.currentActivity = undefined
    manager.isExecutingBoredomActivity = false
  }
}
```

**Error Handling:**
- Execution failure: Log error, continue monitoring
- Cancellation: AbortSignal propagates to sub-tasks
- Timeout: Activity execution has per-task timeouts

---

## 3. Layer Boundaries (Clean Architecture)

### Boundary 3.1: TemplateRepository (Repository Layer)
**Type:** Repository Pattern  
**Location:** `activity-template-repository.ts` | Storage/MCP backends

**Contract:**
```typescript
export namespace TemplateRepository {
  export type Backend = "local" | "metabob" | "all"
  
  /**
   * List templates from backend(s).
   * Strategy: Metabob → Local fallback
   */
  export async function list(options?: {
    category?: Category
    backend?: Backend
  }): Promise<ActivityTemplate.Schema[]>
  
  /**
   * Get template by ID.
   * Strategy: Cache → Metabob → Local fallback
   */
  export async function get(
    id: string,
    backend?: Backend
  ): Promise<ActivityTemplate.Schema | undefined>
  
  /**
   * Save template to backend(s).
   * Strategy: Save to all specified backends
   */
  export async function save(
    template: ActivityTemplate.Schema,
    backends?: Backend[]
  ): Promise<void>
  
  /**
   * Remove template from backend(s).
   */
  export async function remove(
    id: string,
    backends?: Backend[]
  ): Promise<void>
  
  /**
   * Check if template exists.
   */
  export async function exists(
    id: string,
    backend?: Backend
  ): Promise<boolean>
}
```

**Coupling:** **Loose**
- Abstraction over storage backends (local files, Metabob API)
- Callers don't know about storage implementation
- Repository pattern isolates data access

**Backend Fallback Chain:**
```
1. Cache (in-memory, TemplateCache)
   ↓ (cache miss)
2. Metabob Backend (via MCP)
   ↓ (backend unavailable)
3. Local Storage (bootstrap templates only)
   ↓ (not found)
4. Return undefined
```

**Versioning:**
- Template schema versioned (Zod schema with migrations)
- Repository interface stable (no breaking changes)

**Resilience:**
```typescript
// Graceful fallback on backend failures
export async function get(
  id: string,
  backend?: Backend
): Promise<ActivityTemplate.Schema | undefined> {
  try {
    // Step 1: Check cache
    const cached = TemplateCache.get(id)
    if (cached) return cached
    
    // Step 2: Try Metabob backend
    if (backend !== "local") {
      const result = await MCP.callTool("metabob_get_template", { id })
      if (result.content[0]?.text) {
        const template = JSON.parse(result.content[0].text)
        TemplateCache.set(id, template)
        return template
      }
    }
    
    // Step 3: Try local storage
    if (backend !== "metabob") {
      const local = await Storage.read<ActivityTemplate.Schema>(["activity-template", id])
      TemplateCache.set(id, local)
      return local
    }
    
    return undefined
  } catch (error) {
    log.error(`Failed to get template ${id}`, { error })
    return undefined  // Graceful degradation
  }
}
```

**Error Handling:**
- Backend unavailable: Fall back to local
- Template not found: Return undefined (not an error)
- Corrupted data: Log error, return undefined

---

### Boundary 3.2: VesselUpdateManager (Domain Logic)
**Type:** Domain Service  
**Location:** `vessel/update.ts`

**Contract:**
```typescript
export namespace VesselUpdateManager {
  /**
   * Get current vessel versions from tracking file.
   * Returns empty tracking if file doesn't exist (fresh install).
   */
  export async function getCurrentVersions(
    filePath?: string
  ): Promise<VersionTracking>
  
  /**
   * Compute SHA-256 checksum of a file.
   * Used for binary integrity verification.
   */
  export async function computeChecksum(
    filePath: string
  ): Promise<string>
  
  /**
   * Update version tracking file after successful update.
   */
  export async function recordUpdate(
    vessel: string,
    version: string,
    checksum: string,
    downloadUrl: string,
    source: string,
    reason: string
  ): Promise<void>
}

// Data Types
interface VersionTracking {
  current: Record<string, VesselVersion>
  history: VesselUpdateRecord[]
}

interface VesselVersion {
  name: string        // "opencode" | "metabob-cli"
  version: string     // "1.0.64"
  checksum: string    // "sha256:..."
  downloadUrl: string
}

interface VesselUpdateRecord {
  vessel: string
  version: string
  timestamp: string  // ISO 8601
  source: string     // "github" | "registry" | "local"
  reason: string
}
```

**Coupling:** **Loose**
- No dependencies on other services
- Pure domain logic (version tracking, checksums)
- File I/O is the only external dependency

**Versioning:**
- Tracking file schema versioned (migrations on read)
- API stable (no breaking changes)

**Resilience:**
```typescript
// Graceful handling of missing tracking file
export async function getCurrentVersions(
  filePath: string = "/workspace/.vessel-versions.json"
): Promise<VersionTracking> {
  try {
    const content = await readFile(filePath, "utf-8")
    const data = JSON.parse(content)
    
    // Validate and normalize
    return {
      current: data.current || {},
      history: Array.isArray(data.history) ? data.history : []
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      // File doesn't exist (fresh install)
      log.info("Version tracking file not found, returning empty tracking")
      return { current: {}, history: [] }
    }
    
    // Corrupted file
    log.error("Failed to read version tracking", { error })
    return { current: {}, history: [] }
  }
}
```

**Error Handling:**
- File not found: Return empty tracking (expected for fresh installs)
- Corrupted JSON: Return empty tracking (graceful degradation)
- Checksum mismatch: Throw error (abort update)

---

## 4. Data Store Boundaries

### Boundary 4.1: Activity → Storage (File I/O)
**Type:** Data Store Boundary  
**Location:** Activity execution | Filesystem

**Contract:**
```typescript
// Activity metadata storage
const activityPath = ["activity", projectID, activityID]

interface ActivityMetadata {
  id: string
  title: string
  directory: string
  branch: string
  baseCommit: string
  templateId?: string
  variables?: Record<string, unknown>
  reason?: string
  status: "pending" | "running" | "done" | "failed"
  tasks: TaskExecution[]
  stats?: {
    cost: { total: number }
    tokens: { input: number, output: number, cache: { read: number } }
  }
  createdAt: number  // Unix timestamp
  completedAt?: number
}

// Write activity metadata
await Storage.write(activityPath, activityMetadata)

// Read activity metadata
const activity = await Storage.read<ActivityMetadata>(activityPath)
```

**Coupling:** **Tight** (within OpenCode)
- Direct filesystem access
- JSON serialization (tightly coupled to data structures)

**Versioning:**
- Schema versioned (migrations on read)
- Backward compatibility: Read old format, write new format

**Resilience:**
```typescript
// Atomic writes with temp file + rename
export async function write<T>(key: string[], data: T): Promise<void> {
  const filePath = keyToPath(key)
  const tempPath = `${filePath}.tmp`
  
  try {
    // Write to temp file
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2))
    
    // Atomic rename
    await fs.rename(tempPath, filePath)
  } catch (error) {
    // Clean up temp file on error
    await fs.unlink(tempPath).catch(() => {})
    throw error
  }
}
```

**Error Handling:**
- Disk full: Throw error (fatal, user intervention needed)
- Permission denied: Throw error (fatal)
- Concurrent writes: Lock mechanism prevents corruption

---

### Boundary 4.2: metabob-cli MCP Server → Backend Database (via API)
**Type:** Service Boundary (HTTP → Database)  
**Location:** metabob-cli | Backend API | SurrealDB/Redis

**Contract:**
```python
# metabob-cli → Backend API → Database

# 1. Boredom Activity Query
# metabob-cli calls:
GET /api/v1/activities/boredom?max_activities=5&priority_threshold=0.6

# Backend API queries SurrealDB:
SELECT * FROM activity_templates
WHERE learning.success_rate < 0.95
  AND learning.execution_count > 5
  AND last_execution.timestamp < $exclude_recent
ORDER BY learning.improvement_potential DESC
LIMIT $max_activities

# 2. Activity Result Recording
# metabob-cli calls:
POST /api/v1/activities/results
Body: { activity_id, template_id, success, duration, cost, tokens }

# Backend API updates SurrealDB:
UPDATE activity_templates:{template_id}
SET
  learning.execution_count += 1,
  learning.success_rate = (learning.success_rate * learning.execution_count + (success ? 1 : 0)) / (learning.execution_count + 1),
  learning.avg_cost = (learning.avg_cost * learning.execution_count + cost) / (learning.execution_count + 1),
  learning.avg_duration_ms = (learning.avg_duration_ms * learning.execution_count + duration) / (learning.execution_count + 1),
  last_execution = { timestamp: NOW(), success, duration, cost }

# Backend API caches in Redis:
ZADD activity_priority_queue {priority} {template_id}
EXPIRE activity_priority_queue 300  # 5 minute TTL
```

**Coupling:** **Loose**
- metabob-cli doesn't know about database structure
- Backend API abstracts database access
- HTTP REST API is the contract

**Versioning:**
- Database schema: Migration system (SurrealDB migrations)
- API: Versioned (/api/v1/), maintains backward compatibility

**Resilience:**
```python
# Backend API: Transaction rollback on failure
async def record_activity_result(result: ActivityResult):
    async with db.transaction() as tx:
        try:
            # Update template metrics
            await tx.execute("""
                UPDATE activity_templates:{template_id}
                SET ...
            """, result)
            
            # Add to history
            await tx.execute("""
                INSERT INTO activity_executions
                {...}
            """, result)
            
            # Update cache
            await redis.zadd("activity_priority_queue", result.template_id, calculate_priority(result))
            
            await tx.commit()
        except Exception as e:
            await tx.rollback()
            logger.error(f"Failed to record activity result: {e}")
            raise
```

**Error Handling:**
- Database unavailable: Retry with backoff, eventually fail request
- Transaction failure: Rollback, return 500 error
- Cache unavailable (Redis down): Log warning, continue (cache is optional)

---

## 5. Container Orchestration Boundaries

### Boundary 5.1: docker-compose → Docker Engine
**Type:** Orchestration Boundary  
**Location:** docker-compose.yaml | Docker Engine API

**Contract:**
```yaml
# docker-compose.yaml defines container specifications

version: "3.8"

services:
  metabob-rpc-api-server:
    image: metabobapp/metabob-rpc-api:0.16.12
    container_name: api-server-dev
    ports:
      - "8080:8080"
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - SURREAL_URL=ws://surreal:8000
    healthcheck:
      test: curl -f http://localhost:8080/health || exit 1
      interval: 10s
      timeout: 5s
      retries: 5
    depends_on:
      - redis
      - surreal
    networks:
      - metabob-network
  
  devbob-clean:
    image: devbob:latest
    container_name: devbob-clean
    ports:
      - "3000:3000"  # ACP
      - "8082:8082"  # MCP
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - METABOB_API_URL=http://metabob-rpc-api-server:8080
      - METABOB_PROJECT_ID=${METABOB_PROJECT_ID}
    depends_on:
      metabob-rpc-api-server:
        condition: service_healthy
    volumes:
      - devbob_clean_workspace:/workspace
    networks:
      - metabob-network
      - devbob-network
```

**Docker API Contract:**
```
POST /containers/create
Body:
{
  "Image": "devbob:latest",
  "Env": ["ANTHROPIC_API_KEY=...", "METABOB_API_URL=..."],
  "ExposedPorts": { "3000/tcp": {}, "8082/tcp": {} },
  "HostConfig": {
    "PortBindings": {
      "3000/tcp": [{ "HostPort": "3000" }],
      "8082/tcp": [{ "HostPort": "8082" }]
    },
    "Binds": ["devbob_clean_workspace:/workspace"]
  },
  "NetworkingConfig": {
    "EndpointsConfig": {
      "metabob-network": {},
      "devbob-network": {}
    }
  }
}

Response:
{
  "Id": "abc123...",
  "Warnings": []
}

POST /containers/{id}/start
Response: 204 No Content
```

**Coupling:** **Loose**
- docker-compose is declarative (what, not how)
- Docker Engine handles container lifecycle
- Networks isolate services

**Versioning:**
- Docker Compose file format: Version 3.8
- Docker Engine API: Versioned (v1.41+)

**Resilience:**
```yaml
# Health check with retries
healthcheck:
  test: curl -f http://localhost:8080/health || exit 1
  interval: 10s   # Check every 10 seconds
  timeout: 5s     # Each check has 5 second timeout
  retries: 5      # 5 failures → unhealthy
  start_period: 30s  # Grace period (30s no checks)

# Dependency with condition
depends_on:
  metabob-rpc-api-server:
    condition: service_healthy  # Wait for healthy before starting

# Restart policy
restart: unless-stopped  # Auto-restart on failure
```

**Error Handling:**
- Container crash: Restart policy (unless-stopped)
- Health check failure: Mark unhealthy, dependent containers don't start
- Network failure: Docker Engine retries network setup

---

### Boundary 5.2: entrypoint.sh → Container Services
**Type:** Process Orchestration  
**Location:** entrypoint.sh | Container processes

**Contract:**
```bash
# entrypoint.sh starts multiple services

# Service 1: metabob-cli dashboard (SSE mode)
metabob-cli mcp \
    --transport sse \
    --port "${DASHBOARD_PORT}" \
    --host "${DASHBOARD_HOST}" \
    &
DASHBOARD_PID=$!

# Service 2: opencode ACP server
opencode acp \
    --port "$ACP_PORT" \
    --hostname "$ACP_HOSTNAME" \
    &
ACP_PID=$!

# Service 3: metabob-cli MCP (stdio) - auto-started by opencode
# (No explicit start, opencode spawns it as child process)

# Wait for services to exit
wait -n "$ACP_PID" "$DASHBOARD_PID" 2>/dev/null
EXIT_CODE=$?
```

**Process Contract:**
```bash
# Service start contract
# Input: Environment variables
# Output: Background process PID
# Side effects: Bind to ports, write logs

# Service stop contract (via cleanup trap)
cleanup() {
    [ -n "$ACP_PID" ]       && kill "$ACP_PID"       2>/dev/null
    [ -n "$DASHBOARD_PID" ] && kill "$DASHBOARD_PID" 2>/dev/null
    wait 2>/dev/null
}
trap cleanup SIGTERM SIGINT EXIT
```

**Coupling:** **Tight** (within container)
- Direct process spawning (bash `&` operator)
- Shared environment variables
- Shared filesystem (/workspace, /tmp, logs)

**Versioning:**
- entrypoint.sh versioned with Docker image
- Breaking changes: New image version

**Resilience:**
```bash
# Brief pause for server to bind ports
sleep 2

# Check if process is still running
if kill -0 "$DASHBOARD_PID" 2>/dev/null; then
    log_ok "Dashboard running (PID $DASHBOARD_PID)"
else
    log_warn "Dashboard process exited early, continuing without dashboard"
    DASHBOARD_PID=""
fi

# Wait for either service to exit (fail-fast)
wait -n "$ACP_PID" "$DASHBOARD_PID" 2>/dev/null
EXIT_CODE=$?

log_warn "A service exited with code $EXIT_CODE"
exit $EXIT_CODE  # Exit container on service failure
```

**Error Handling:**
- Service crashes immediately: Log warning, continue with remaining services
- Service exits during runtime: Container exits (fail-fast)
- SIGTERM/SIGINT: Graceful shutdown via cleanup trap

---

## 6. Summary: Coupling and Resilience Matrix

| Boundary | Type | Coupling | Resilience Pattern | Failure Mode |
|----------|------|----------|-------------------|--------------|
| OpenCode → metabob-cli MCP | Cross-Repo | Loose | Retry + graceful degradation | Continue without MCP tools |
| OpenCode → Storage | Data Store | Tight | Atomic writes + locks | Throw (fatal) |
| MCP Client → MCP Server | Service | Loose | Auto-reconnect + timeout | Restart child process |
| metabob-cli → Backend API | Service | Loose | Retry + exponential backoff | Return empty result |
| BoredomManager → ActivityTool | Layer | Medium | Error catch + continue | Log error, resume monitoring |
| TemplateRepository → Backends | Layer | Loose | Fallback chain (Cache → Metabob → Local) | Return undefined |
| Activity → Storage | Data Store | Tight | Temp file + atomic rename | Throw (fatal) |
| metabob-cli → Backend DB | Service | Loose | Transaction rollback | Return 500 error |
| docker-compose → Docker Engine | Orchestration | Loose | Health checks + restart policy | Auto-restart containers |
| entrypoint.sh → Services | Process | Tight | Process monitoring + cleanup | Exit container on failure |

---

## 7. Key Observations

### Resilience Patterns

1. **Graceful Degradation:**
   - OpenCode continues without MCP tools if backend unavailable
   - Empty results returned instead of crashes
   - Boredom monitoring continues even if activities unavailable

2. **Retry Logic:**
   - Backend API calls: 3 retries with exponential backoff
   - MCP tool calls: 30 second timeout
   - Health checks: 5 retries before marking unhealthy

3. **Fallback Chains:**
   - Template loading: Cache → Metabob → Local
   - Version tracking: File → Empty tracking (fresh install)

4. **Atomic Operations:**
   - Storage writes: Temp file + rename
   - Database transactions: Rollback on failure

5. **Process Management:**
   - Auto-restart on crash (child processes)
   - Graceful shutdown (cleanup trap)
   - Fail-fast (exit on critical service failure)

### Coupling Analysis

**Loose Coupling (Preferred):**
- Cross-repo: JSON-RPC, HTTP REST (language-agnostic)
- Service boundaries: Standard protocols (JSON-RPC, HTTP)
- Repository pattern: Abstraction over backends

**Tight Coupling (Acceptable):**
- Storage layer: Direct filesystem access (performance)
- Container services: Shared environment (orchestration)

**Medium Coupling:**
- Internal services: Shared TypeScript types (type safety)

### Versioning Strategy

1. **API Versioning:**
   - URL-based: `/api/v1/`, `/api/v2/`
   - Maintain old versions for 6 months (deprecation policy)

2. **Protocol Versioning:**
   - MCP: 1.0 (stable, backward compatible)
   - JSON-RPC: 2.0 (standard, stable)

3. **Schema Versioning:**
   - Zod schemas with migrations
   - Read old format, write new format (forward compatibility)

4. **Tool Versioning:**
   - Breaking changes: Add new tool name (e.g., `_v2`)
   - Maintain old tools for backward compatibility

---

## Conclusion

The deployment workflow demonstrates strong architectural boundaries with appropriate coupling levels and comprehensive resilience patterns. Key strengths:

1. **Service boundaries** use standard protocols (JSON-RPC, HTTP REST) for loose coupling
2. **Repository pattern** abstracts storage backends with fallback chains
3. **Retry logic** with exponential backoff handles transient failures
4. **Graceful degradation** ensures system continues with reduced functionality
5. **Health checks** and **restart policies** provide self-healing capabilities
6. **Atomic operations** prevent data corruption

The architecture balances **reliability** (retry, fallback, health checks) with **performance** (caching, atomic writes) and **maintainability** (loose coupling, standard protocols).
