# Data Transformations: metabob-cli-mcp-backend-communication

Complete documentation of all data transformations in the activity template communication flow, including what changes, why, validations, and side effects.

---

## Transformation 1: LLM Tool Parameters → Repository Options

**Location**: `SearchActivitiesTool.execute()` → `TemplateRepository.list()`  
**File**: `repos/metabob-opencode/packages/opencode/src/tool/search-activities.ts:27-33`

### What Changes:
```typescript
// Input (from LLM agent)
{
  category?: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure",
  verbose?: boolean  // Default: false
}

// Output (to TemplateRepository)
{
  category?: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  // verbose flag NOT passed down - used only for formatting
}
```

### Why:
- **Separation of concerns**: `verbose` controls presentation (compact vs verbose text), not data retrieval
- **LLM optimization**: Compact mode reduces token usage from ~2KB to ~300 bytes for 14 templates
- **Business requirement**: LLM needs quick template overview without overwhelming context window

### Validations:
- Category validated by Zod schema enum (line 18)
- Verbose boolean with default false (line 24)
- No runtime validation of category values (TypeScript compile-time only)

### Side Effects:
- **Logging**: Debug log "search_activities calling TemplateRepository.list()" (line 30)
- **None to data**: Read-only operation, no state changes

### Alternatives Considered:
- Could pass verbose flag down the chain, but formatting is presentation concern
- Keeps data layer clean from UI/presentation logic

---

## Transformation 2: Backend Parameter Mapping

**Location**: `TemplateRepository.list()` → `TemplateLoader.list()`  
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts:64-75`

### What Changes:
```typescript
// Input
{
  category?: string,
  backend?: "local" | "metabob" | "all"  // Default: "all"
}

// Transformation (line 69)
const backend = mapBackend(options?.backend ?? "all")
// mapBackend: "all" → "auto", "local" → "local", "metabob" → "metabob"

// Output
{
  category?: string,
  backend: "metabob" | "local" | "auto"
}
```

### Why:
- **API compatibility**: External API uses "all" (inclusive), internal uses "auto" (automatic selection)
- **Semantic clarity**: "auto" better describes fallback behavior (Cache → Metabob → Local)
- **Business requirement**: Single unified API for multiple backends

### Validations:
- Backend defaults to "all" if not provided (line 69)
- mapBackend function enforces valid transformations (line 34-37)

### Side Effects:
- **Logging**: Debug logs before/after backend mapping (lines 68, 70)
- **None to data**: Pure transformation, no state changes

### Alternatives Considered:
- Could use "all" throughout, but "auto" better describes fallback chain behavior
- Matches TemplateLoader's internal logic (auto-fallback on errors)

---

## Transformation 3: Result Unwrapping

**Location**: `TemplateLoader.list()` → `TemplateRepository.list()`  
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:180 → activity-template-repository.ts:88`

### What Changes:
```typescript
// Input (from TemplateLoader)
{
  templates: ActivityTemplate.Schema[],
  source: "metabob" | "local" | "cache",
  cached: boolean
}

// Output (from TemplateRepository)
ActivityTemplate.Schema[]  // Just the array
```

### Why:
- **Simplify API**: Callers (SearchActivitiesTool) don't care about source or cache status
- **Encapsulation**: Hide implementation details (caching, fallback) from consumers
- **Business requirement**: Tool execution should be simple, transparent

### Validations:
- None (trusts TemplateLoader result)
- TemplateLoader guarantees valid ActivityTemplate.Schema[] array

### Side Effects:
- **Logging**: Logs source and count (line 82-86) before unwrapping
- **Metadata loss**: Source and cached flags discarded (acceptable for tool layer)

### Alternatives Considered:
- Could expose metadata for debugging, but adds complexity
- Logging provides sufficient observability

---

## Transformation 4: List → Search Delegation

**Location**: `TemplateServiceClient.listTemplates()` → `searchTemplates()`  
**File**: `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts:398-418`

### What Changes:
```typescript
// Input (listTemplates)
{
  category?: string,
  minSuccessRate?: number,
  minExecutionCount?: number,
  pageSize?: number,
  sortBy?: "success_rate" | "execution_count"
}

// Transformation (line 402-410)
// ListTemplates = SearchTemplates with empty query

// Output (to searchTemplates)
{
  query: "",  // ALWAYS empty for list operation
  category?: string,
  minSuccessRate?: number,
  minExecutionCount?: number,
  limit: pageSize || 100,
  sortBy?: "success_rate" | "execution_count"
}
```

### Why:
- **Code reuse**: List is just search with empty query (DRY principle)
- **Backend optimization**: Single endpoint handles both list and search
- **Business requirement**: Unified template discovery (list all = search with "")

### Validations:
- Query forced to empty string (line 403)
- PageSize defaults to 100 (line 407)

### Side Effects:
- **Logging**: Debug log "listTemplates" with options (line 399)
- **HTTP call**: Triggers search_activities MCP call via searchTemplates

### Alternatives Considered:
- Separate list() implementation, but would duplicate filtering/sorting logic
- Backend could have separate endpoint, but search with "" is efficient

---

## Transformation 5: Connection Check & Empty Fallback

**Location**: `TemplateServiceClient.searchTemplates()` → `MetabobCLI.searchActivities()`  
**File**: `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts:174-188`

### What Changes:
```typescript
// Before calling MetabobCLI (line 174-182)
const status = await checkConnection()
if (!status.connected) {
  return {
    templates: [],
    totalCount: 0,
    query: options
  }
}

// If connected, call MetabobCLI.searchActivities()
const summaries = await MetabobCLI.searchActivities(options.query || "", {
  limit: options.limit || 100,
  category: options.category
})
```

### Why:
- **Graceful degradation**: Return empty instead of throwing error
- **Business requirement**: OpenCode should work offline with bootstrap templates
- **Fail-safe pattern**: TemplateLoader will fallback to local templates

### Validations:
- Connection checked before every search (line 174)
- Connection status cached for CONNECTION_CHECK_INTERVAL (5 seconds)

### Side Effects:
- **Logging**: Warns "metabob not available for searchTemplates" (line 176)
- **Empty result**: Returns [] templates when offline
- **Fallback trigger**: TemplateLoader sees empty result, uses bootstrap templates

### Alternatives Considered:
- Throw exception and force caller to handle, but graceful degradation is better UX
- Cache connection status to avoid repeated checks (implemented)

---

## Transformation 6: Summaries → Full Templates

**Location**: `TemplateServiceClient.searchTemplates()`  
**File**: `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts:190-202`

### What Changes:
```typescript
// Input: Summaries from MetabobCLI.searchActivities()
[
  {
    id: "template-1",
    name: "Add REST Endpoint",
    description: "...",
    task_count: 3,
    success_rate: 0.85
  }
]

// Transformation: Fetch full templates (line 191-200)
const templates = await Promise.all(
  summaries.map(async (summary) => {
    const id = summary.id || summary.activity_id
    if (!id) return undefined
    
    // Fetch full template with tasks array
    return await MetabobCLI.getActivity(id)
  })
)

// Output: Full templates with tasks
[
  {
    id: "template-1",
    name: "Add REST Endpoint",
    description: "...",
    tasks: [...],  // Full task definitions
    successRate: 0.85,
    executions: 10
  }
]
```

### Why:
- **API design**: search_activities returns lightweight summaries, activity returns full spec
- **Performance**: Don't transfer full templates (with tasks arrays) for search results
- **Business requirement**: Tool needs full templates for validation and execution

### Validations:
- ID extraction handles both `id` and `activity_id` fields (line 194)
- Filter out undefined results (summaries without ID) (line 202)

### Side Effects:
- **Multiple HTTP calls**: N+1 query problem - search + getActivity per result
- **Logging**: None at this level (MetabobCLI.getActivity logs internally)

### Alternatives Considered:
- Backend could return full templates in search, but wasteful for large result sets
- Client-side summary view then fetch-on-demand (implemented approach)
- Could batch getActivity calls, but MCP doesn't support batch operations

---

## Transformation 7: Client-Side Filtering & Sorting

**Location**: `TemplateServiceClient.searchTemplates()`  
**File**: `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts:204-220`

### What Changes:
```typescript
// Input: Full templates from parallel getActivity calls
validTemplates: ActivityTemplate.Schema[]

// Transformations:
// 1. Success rate filter (line 207-209)
if (options.minSuccessRate !== undefined) {
  filtered = filtered.filter(t => t.successRate >= options.minSuccessRate)
}

// 2. Execution count filter (line 211-213)
if (options.minExecutionCount !== undefined) {
  filtered = filtered.filter(t => t.executions >= options.minExecutionCount)
}

// 3. Sorting (line 216-220)
if (options.sortBy === "success_rate") {
  filtered.sort((a, b) => b.successRate - a.successRate)  // Descending
} else if (options.sortBy === "execution_count") {
  filtered.sort((a, b) => b.executions - a.executions)  // Descending
}
```

### Why:
- **Backend limitation**: MCP backend doesn't support filtering/sorting params yet
- **Client-side workaround**: Apply filters after fetching full templates
- **Business requirement**: Need to filter by quality metrics (success rate, executions)

### Validations:
- minSuccessRate checked for undefined (explicit opt-in) (line 207)
- minExecutionCount checked for undefined (line 211)
- sortBy string comparison (line 216, 218)

### Side Effects:
- **Performance**: Filters AFTER fetching full templates (wasteful if many filtered out)
- **Logging**: Logs totalCount vs filteredCount (line 222-225)

### Alternatives Considered:
- Backend should handle filtering/sorting (proper solution, not implemented)
- Client-side is acceptable for small result sets (< 100 templates)

---

## Transformation 8: MCP Tool Invocation

**Location**: `MetabobCLI.searchActivities()` → `callMCPTool()`  
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:679-688`

### What Changes:
```typescript
// Input
query: string,
options?: {
  limit?: number,
  category?: string
}

// Transformation: Package for MCP call (line 679-688)
const result = await callMCPTool<{
  status: string
  activities?: unknown[]
  templates?: unknown[]
  count?: number
}>("search_activities", {
  query,
  limit: options?.limit || 100,  // Default 100
  category: options?.category
})
```

### Why:
- **MCP protocol**: Tool name + arguments object
- **Backward compatibility**: Accept both "activities" and "templates" response fields
- **Business requirement**: Default to 100 to get all templates (pagination not implemented)

### Validations:
- Limit defaults to 100 (line 686)
- Category optional (undefined if not provided)

### Side Effects:
- **Logging**: Extensive debug logging (line 677, 690-697)
- **MCP call**: JSON-RPC request over stdio/SSE transport

### Alternatives Considered:
- Could use lower default limit (20), but fetching all is current requirement

---

## Transformation 9: MCP Response Extraction & Parsing

**Location**: `callMCPTool()` → Parsed result  
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:308-330`

### What Changes:
```typescript
// Input: MCP protocol response
{
  content: [
    {
      type: "text",
      text: '{"status":"success","activities":[...],"count":10}'
    }
  ],
  metadata: {}
}

// Transformation (line 308-330):
// 1. Extract text from content array (line 310-313)
const textContent = result.content
  .filter(item => item.type === "text")
  .map(item => item.text)
  .join("\n\n")

// 2. Parse JSON (line 321)
const parsed = JSON.parse(textContent) as T

// Output: Typed object
{
  status: "success",
  activities: [...],
  count: 10
}
```

### Why:
- **MCP protocol**: Tools return content array (may have multiple parts)
- **Type safety**: Parse JSON and cast to expected type T
- **Error handling**: Gracefully handle non-JSON responses

### Validations:
- Content must be array (line 309)
- Filter for type="text" items (line 311)
- JSON parse with try-catch (line 320-329)

### Side Effects:
- **Logging**: Debug logs for parsing steps (line 315-317, 322-324, 327)
- **Fallback**: Returns text as-is if not valid JSON (line 328)
- **Error handling**: Returns undefined on parse errors (line 327)

### Alternatives Considered:
- Could throw exception on parse failure, but undefined enables graceful degradation
- Could validate JSON schema, but type casting is sufficient

---

## Transformation 10: Response Field Normalization

**Location**: `MetabobCLI.searchActivities()` after callMCPTool  
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:699-734`

### What Changes:
```typescript
// Input: Parsed MCP response
{
  status: "success",
  activities?: [...],   // Metabob MCP returns "activities"
  templates?: [...],    // Backward compat field
  count?: 10
}

// Transformation (line 716)
const summaries = result.activities || result.templates || []

// Output: Normalized array
[
  {
    id: "template-1",
    name: "...",
    ...
  }
]
```

### Why:
- **API evolution**: Metabob MCP changed from "templates" to "activities"
- **Backward compatibility**: Support both field names
- **Business requirement**: Don't break if backend changes field name

### Validations:
- Status must be "success" (line 704-710)
- result must be truthy (line 699-702)
- summaries array must have length > 0 (line 718-724)

### Side Effects:
- **Logging**: Extensive debug logging of response structure (line 690-697)
- **Logging**: Warns if status != "success" or empty results (line 705, 719)
- **Empty fallback**: Returns [] on any error condition

### Alternatives Considered:
- Could enforce single field name, but flexibility prevents breakage
- Could throw on unrecognized format, but graceful degradation is safer

---

## Transformation 11: MCP Client Lookup ⚠️ CRITICAL

**Location**: `callMCPTool()` → MCP.clients()  
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:265-271`

### What Changes:
```typescript
// Input: Tool name and args
toolName: "search_activities"
args: { query: "", limit: 100 }

// Transformation: Lookup MCP client (line 265-271)
const clients = await MCP.clients()
const metabobClient = clients["metabob"]

if (!metabobClient) {
  log.debug("metabob mcp client not available")
  return undefined  // ⚠️ CRITICAL FAILURE POINT
}
```

### Why:
- **MCP architecture**: Clients initialized from opencode.json config
- **Multi-server support**: May have multiple MCP servers (metabob, others)
- **Business requirement**: Graceful degradation if MCP not configured

### Validations:
- Client name hardcoded as "metabob" (line 266)
- Returns undefined if client not found (line 270)

### Side Effects:
- **Silent failure**: Returns undefined, triggers fallback chain
- **Logging**: Debug log "metabob mcp client not available" (line 269)
- **Cascading effect**: TemplateLoader falls back to bootstrap templates
- **NO HTTP TRAFFIC**: This is where communication breaks if MCP not configured

### Alternatives Considered:
- Could throw exception, but undefined enables graceful degradation
- Could check config before attempting, but lazy check is simpler
- **THIS IS THE MOST LIKELY FAILURE POINT** - if "metabob" not in config

---

## Transformation 12: TypeScript → JSON-RPC

**Location**: `callMCPTool()` → `metabobClient.callTool()`  
**File**: MCP SDK (external) invoked from `metabob.ts:296-299`

### What Changes:
```typescript
// Input: TypeScript method call
await metabobClient.callTool({
  name: "search_activities",
  arguments: {
    query: "",
    limit: 100,
    category: "feature"
  }
})

// JSON-RPC 2.0 wire format (MCP SDK serialization)
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_activities",
    "arguments": {
      "query": "",
      "limit": 100,
      "category": "feature"
    }
  },
  "id": 1
}
```

### Why:
- **MCP protocol**: Standard JSON-RPC 2.0 over stdio/SSE/HTTP
- **Language interop**: TypeScript client → Python server
- **Business requirement**: Cross-process communication

### Validations:
- MCP SDK handles serialization
- Arguments must be JSON-serializable (primitives, objects, arrays)

### Side Effects:
- **IPC call**: Process boundary crossing (stdio pipe or HTTP request)
- **Timeout**: Configurable timeout (default 30s)
- **Error handling**: MCP SDK throws on transport errors

### Alternatives Considered:
- Direct HTTP REST API, but MCP provides unified tool interface
- gRPC or other RPC, but JSON-RPC is simpler

---

## Transformation 13: Python MCP Tool Handler

**Location**: `@mcp.tool("search_activities")` → `search_activities_tool()`  
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py:3512-3560`

### What Changes:
```python
# Input: MCP tool arguments (from JSON-RPC)
query: str = "",
category: str = "",
limit: int = 20,
min_success_rate: float = 0.0

# Transformation: Extract config and session (line 3523-3547)
config = _get_server().get_config_manager()
base_url = config.get("base_url", "http://localhost:8080")
session_token = await _get_session_token(config)

# Create manager
manager = get_activity_manager(base_url, session_token)

# Call HTTP API
results = await manager.search_activities(
    query=query,
    category=category if category else None,
    limit=limit,
    min_success_rate=min_success_rate
)

# Format response (line 3565-3575)
response = {
    "status": "success",
    "count": len(results),
    "activities": results
}
return json.dumps(response, indent=2)
```

### Why:
- **Configuration retrieval**: Get backend URL and auth token from config/state
- **HTTP proxy**: MCP tool proxies to REST API
- **Business requirement**: MCP is communication layer, not data layer

### Validations:
- Empty string defaults for query and category (line 3513-3514)
- Limit defaults to 20 (line 3515)
- min_success_rate defaults to 0.0 (line 3516)

### Side Effects:
- **Config read**: Reads opencode.json or environment variables
- **State read**: Reads session token from FileStateManager
- **Logging**: Extensive timing logs (line 3521-3555)
- **HTTP call**: Initiates HTTP request to rpc-api

### Alternatives Considered:
- Could embed logic in MCP tool, but separation of concerns is cleaner
- Could cache manager instance, but stateless is safer

---

## Transformation 14: ActivityManager HTTP Client

**Location**: `ActivityManager.search_activities()` → HTTP GET  
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:164-244`

### What Changes:
```python
# Input: Python method args
query: str = "",
category: str | None = None,
limit: int = 20,
min_success_rate: float = 0.0

# Transformation: Build HTTP request (line 192-205)
client = await self._get_client()  # httpx.AsyncClient with auth

params = {
    "limit": limit,
    "offset": 0
}
if query:
    params["query"] = query
if category:
    params["category"] = category

# HTTP request
response = await client.get(
    "/v2/activities/templates",
    params=params
)

# HTTP wire format
GET /v2/activities/templates?limit=20&offset=0&query=&category=feature
Host: localhost:8080
Content-Type: application/json
Authorization: Bearer eyJ...
```

### Why:
- **REST API**: Standard HTTP GET with query parameters
- **Authentication**: Bearer token from session
- **Business requirement**: Access backend activity templates

### Validations:
- Query and category optional (only added if provided) (line 197-200)
- Limit and offset always included (line 193-195)

### Side Effects:
- **HTTP request**: External network/IPC call
- **Logging**: Debug logs for request/response (via httpx)
- **Error handling**: Returns [] on 401 (line 242-244)

### Alternatives Considered:
- POST with body, but GET is RESTful for search queries
- GraphQL, but REST is simpler

---

## Transformation 15: Proto Format → Internal Format

**Location**: `ActivityManager.search_activities()` response parsing  
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:207-241`

### What Changes:
```python
# Input: Backend proto format (ActivityVariant)
{
  "variant_id": "add-rest-endpoint-v1",
  "variant_name": "Add REST Endpoint",
  "activity_id": "add-rest-endpoint",  # Category/base activity
  "description": "...",
  "task_steps": [...],
  "expected_quality_score": 0.85,
  "expected_cost": 0.05,
  "expected_duration_ms": 45000,
  "context_requirements": [...],
  "variables": {...}
}

# Transformation (line 213-240)
{
  "id": "add-rest-endpoint-v1",               # variant_id
  "name": "Add REST Endpoint",                # variant_name
  "description": "...",
  "category": "add-rest-endpoint",            # activity_id (base)
  "task_count": 3,                            # len(task_steps)
  "success_rate": 0.85,                       # expected_quality_score
  "avg_cost": 0.05,                           # expected_cost
  "avg_duration": 45000,                      # expected_duration_ms
  "expected_value": 0.8075,                   # quality * (1 - cost)
  "confidence": 0.5,                          # Fixed (not in proto)
  "context_requirements": [...],
  "variables": {...}
}
```

### Why:
- **API compatibility**: Backend uses proto (snake_case), clients use internal format
- **Naming clarity**: "variant_id" → "id", "variant_name" → "name"
- **Derived metrics**: Calculate expected_value from quality and cost
- **Business requirement**: Hide backend implementation details (proto) from clients

### Validations:
- Fallback for missing fields: `t.get("field", default)` (line 215-239)
- Handles both "tasks" and "task_steps" (v2 vs legacy) (line 222-224)
- Status code check: 200 → parse, 401 → empty (line 207, 242)

### Side Effects:
- **Data enrichment**: Adds expected_value calculation (line 232-233)
- **Fixed confidence**: Always 0.5 (not exposed in v2 API) (line 234)
- **Logging**: Debug log on 401 (line 243)

### Alternatives Considered:
- Backend could return internal format, but proto is gRPC standard
- Client could use proto directly, but abstraction is cleaner
- Could use Pydantic models for validation, but dict is simpler

---

## Summary: Critical Transformation Points

### 1. **Silent Failure Point** (Transformation 11) ⚠️
**Location**: `callMCPTool()` line 268  
**Issue**: Returns `undefined` if MCP client "metabob" not found  
**Impact**: Entire chain falls back to bootstrap templates, NO HTTP traffic  
**Fix**: Ensure `opencode.json` has `mcp.metabob` configuration

### 2. **N+1 Query Problem** (Transformation 6)
**Location**: `searchTemplates()` line 191-200  
**Issue**: Fetches full template for each search result (1 search + N getActivity calls)  
**Impact**: Performance degradation with many results  
**Fix**: Backend should support includeFullTemplates parameter

### 3. **Client-Side Filtering** (Transformation 7)
**Location**: `searchTemplates()` line 207-220  
**Issue**: Filters AFTER fetching full templates (wasteful)  
**Impact**: Network bandwidth and latency  
**Fix**: Backend should support minSuccessRate, minExecutionCount params

### 4. **Proto Format Conversion** (Transformation 15)
**Location**: `ActivityManager.search_activities()` line 213-240  
**Issue**: Manual field mapping (error-prone)  
**Impact**: Breaks if backend changes proto schema  
**Fix**: Use proto code generation or shared schema validation

---

## Validation Rules Summary

| Component | Field | Rule | Default |
|-----------|-------|------|---------|
| SearchActivitiesTool | category | enum (5 values) | undefined |
| SearchActivitiesTool | verbose | boolean | false |
| TemplateRepository | backend | enum (3 values) | "all" |
| TemplateServiceClient | minSuccessRate | number >= 0 | undefined |
| TemplateServiceClient | minExecutionCount | number >= 0 | undefined |
| TemplateServiceClient | pageSize | number > 0 | 100 |
| MetabobCLI.searchActivities | limit | number > 0 | 100 |
| search_activities_tool | limit | int > 0 | 20 |
| search_activities_tool | min_success_rate | float >= 0 | 0.0 |
| ActivityManager | limit | int > 0 | 20 |
| ActivityManager | offset | int >= 0 | 0 |

---

## Side Effects Summary

| Transformation | Side Effects |
|----------------|--------------|
| 1. Tool params | Logging only |
| 2. Backend mapping | Logging only |
| 3. Result unwrapping | Metadata discarded |
| 4. List→Search | HTTP call via searchTemplates |
| 5. Connection check | Empty result on offline |
| 6. Summaries→Templates | N+1 HTTP calls |
| 7. Client filtering | Performance overhead |
| 8. MCP invocation | JSON-RPC call |
| 9. Response parsing | Fallback to text if not JSON |
| 10. Field normalization | Empty array on errors |
| 11. Client lookup | **Silent failure if not found** ⚠️ |
| 12. TypeScript→JSON-RPC | Process boundary crossing |
| 13. MCP handler | Config read, state read, timing logs |
| 14. HTTP client | External HTTP request |
| 15. Proto→Internal | Data enrichment (expected_value) |
