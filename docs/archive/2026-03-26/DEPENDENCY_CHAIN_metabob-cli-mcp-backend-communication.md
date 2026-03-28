# Dependency Chain Analysis: metabob-cli-mcp-backend-communication

## Executive Summary

Complete data flow trace from OpenCode LLM tool call to backend HTTP API, identifying where communication breaks.

**Critical Finding**: The chain has 10 components across 3 process boundaries (OpenCode → MCP Server → RPC API). Most likely failure point is **MCP Client initialization** (Component 3).

---

## Flow Chain

### Component 1: SearchActivitiesTool (OpenCode Tool)
**File**: `repos/metabob-opencode/packages/opencode/src/tool/search-activities.ts:27`
**Function**: `SearchActivitiesTool.execute()`
**Role**: Entry point for LLM agent to search activity templates

**Input**: 
```typescript
{
  category?: "feature" | "bugfix" | "refactor" | "tool" | "infrastructure",
  verbose?: boolean
}
```

**Output**:
```typescript
{
  title: string,
  metadata: {
    count: number,
    templates: Array<{id, name, category, successRate, ...}>
  },
  output: string  // Formatted text for LLM
}
```

**What it does**: 
- Receives tool call from LLM agent
- Calls TemplateRepository.list() to fetch templates
- Formats results as compact or verbose text for LLM consumption

**Dependencies**: TemplateRepository

---

### Component 2: TemplateRepository (Facade Layer)
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity-template-repository.ts:64`
**Function**: `TemplateRepository.list()`
**Role**: Unified interface for template storage with multi-backend support

**Input**:
```typescript
{
  category?: ActivityTemplate.Schema["category"],
  backend?: "local" | "metabob" | "all"
}
```

**Output**:
```typescript
ActivityTemplate.Schema[]  // Array of canonical OpenCode templates
```

**What it does**:
- Maps backend selection ("all" → "auto")
- Delegates to TemplateLoader for actual loading
- Returns templates in canonical OpenCode format

**Data Transformation**: Maps backend parameter (all → auto)

**Dependencies**: TemplateLoader

---

### Component 3: TemplateLoader (Backend Selection)
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-loader.ts:160`
**Function**: `TemplateLoader.list()`
**Role**: Implements Cache → Metabob → Local fallback chain

**Input**:
```typescript
{
  category?: string,
  backend?: "metabob" | "local" | "auto"
}
```

**Output**:
```typescript
{
  templates: ActivityTemplate.Schema[],
  source: "metabob" | "local" | "cache",
  cached: boolean
}
```

**What it does**:
- Line 164: Checks if backend !== "local", tries Metabob first
- Line 167: Calls TemplateServiceClient.listTemplates()
- Line 175-177: Caches successful results
- Line 188-227: Falls back to embedded bootstrap templates if Metabob fails
- Line 230: Returns empty array if all sources fail

**Data Transformation**: Wraps templates in result object with metadata

**Dependencies**: TemplateServiceClient, TemplateCache

---

### Component 4: TemplateServiceClient (Metabob Proxy)
**File**: `repos/metabob-opencode/packages/opencode/src/server/template-service-client.ts:185`
**Function**: `TemplateServiceClient.listTemplates()`  
**Role**: Proxy to Metabob MCP backend with connection management

**Input**:
```typescript
{
  category?: string,
  limit?: number,
  query?: string
}
```

**Output**:
```typescript
{
  templates: ActivityTemplate.Schema[],
  totalCount: number
}
```

**What it does**:
- Line 145: Checks MetabobCLI.isAvailable()
- Line 185: Calls MetabobCLI.searchActivities() for template summaries
- Line 191-200: Fetches full templates via MetabobCLI.getActivity()
- Line 207-220: Applies filters (minSuccessRate, minExecutionCount) and sorting

**Data Transformation**: 
- Converts summaries to full templates
- Applies client-side filtering and sorting

**Dependencies**: MetabobCLI utility functions

---

### Component 5: MetabobCLI.searchActivities (MCP Wrapper)
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:679`
**Function**: `MetabobCLI.searchActivities()`
**Role**: Wrapper around MCP tool call with logging and error handling

**Input**:
```typescript
query: string,
options?: {
  limit?: number,
  category?: string
}
```

**Output**:
```typescript
Array<{
  id: string,
  name: string,
  description: string,
  // ... summary fields
}>
```

**What it does**:
- Line 679-688: Prepares search_activities MCP tool call
- Line 684: Calls callMCPTool("search_activities", {...})
- Line 690-734: Validates response, handles activities vs templates field
- Line 716: Returns raw summaries array

**Data Transformation**: 
- Extracts activities or templates array from MCP response
- Validates response structure

**Dependencies**: callMCPTool function

---

### Component 6: callMCPTool (MCP Client Interface)
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:262`
**Function**: `callMCPTool<T>()`
**Role**: Generic MCP tool invocation with JSON parsing

**Input**:
```typescript
toolName: string,
args: Record<string, any>
```

**Output**:
```typescript
T | undefined  // Parsed JSON response or undefined on failure
```

**What it does**:
- Line 265-270: Gets MCP client from MCP.clients()["metabob"]
- **Line 268: CRITICAL - Returns undefined if metabobClient not found**
- Line 274-293: Lists available tools, finds requested tool
- Line 296-298: Calls metabobClient.callTool() via MCP SDK
- Line 308-330: Parses JSON from result.content[].text

**Data Transformation**:
- Extracts text from MCP response content array
- Parses JSON string to typed object

**Dependencies**: MCP.clients(), MCP SDK Client

**⚠️ FAILURE POINT**: If MCP client "metabob" not initialized, returns undefined silently

---

### Component 7: MCP.clients() (Client Registry)
**File**: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts:296`
**Function**: `MCP.clients()`
**Role**: Provides access to initialized MCP clients

**Input**: None

**Output**:
```typescript
Record<string, MCPClient>  // Map of client name → MCP Client instance
```

**What it does**:
- Line 88-123: state() initializes clients from Config.get().mcp
- Line 95-106: Creates MCP client for each configured server
- Line 296-298: Returns clients map from cached state

**Data Transformation**: Config → initialized Client instances

**Dependencies**: Config.get(), create() function for client initialization

**⚠️ FAILURE POINT**: If "metabob" not in Config.get().mcp, client won't exist in map

---

### Component 8: MCP Client.callTool() (SDK Transport)
**File**: `@modelcontextprotocol/sdk` (external library)
**Function**: `client.callTool()`
**Role**: Sends JSON-RPC request over stdio/HTTP transport to MCP server

**Input**:
```typescript
{
  name: string,
  arguments: Record<string, unknown>
}
```

**Output**:
```typescript
{
  content: Array<{type: "text", text: string}>,
  metadata?: Record<string, unknown>
}
```

**What it does**:
- Serializes request as JSON-RPC 2.0
- Sends via transport (stdio, SSE, or HTTP)
- Receives JSON-RPC response
- Returns tool result with content array

**Data Transformation**: 
- TypeScript objects → JSON-RPC → MCP protocol
- Response: JSON-RPC → parsed response object

**Dependencies**: StdioClientTransport, SSEClientTransport, or StreamableHTTPClientTransport

---

### Component 9: MCP Server search_activities_tool (Python Handler)
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py:3512`
**Function**: `search_activities_tool()`
**Role**: MCP tool handler that proxies to ActivityManager

**Input**:
```python
query: str = "",
limit: int = 10,
category: Optional[str] = None
```

**Output**:
```json
{
  "status": "success",
  "activities": [
    {
      "id": "...",
      "name": "...",
      "description": "...",
      "task_count": 3,
      "success_rate": 0.85,
      "avg_cost": 0.05,
      "avg_duration": 45000
    }
  ],
  "count": 1
}
```

**What it does**:
- Line 3538-3545: Gets config with base_url and session_token
- Line 3547: Creates ActivityManager(base_url, session_token)
- Line 3553: Calls manager.search_activities()
- Line 3565-3589: Formats response as JSON string

**Data Transformation**:
- Python dict → JSON string for MCP response
- Wraps results in {"status": "success", "activities": [...]}

**Dependencies**: get_activity_manager, server.get_config_manager()

---

### Component 10: ActivityManager.search_activities (HTTP Client)
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:164`
**Function**: `ActivityManager.search_activities()`
**Role**: Makes HTTP GET request to rpc-api backend

**Input**:
```python
query: str = "",
limit: int = 100,
category: Optional[str] = None,
min_success_rate: float = 0.0
```

**Output**:
```python
List[Dict[str, Any]]  # Array of template summary dicts
```

**What it does**:
- Line 131-150: _get_client() creates httpx.AsyncClient with Bearer token
- Line 202: GET /v2/activities/templates with query params
- Line 207-241: Parses JSON response, converts proto format to internal format
- Line 213-240: Transforms ActivityVariant proto fields (variant_id, variant_name, etc.)

**HTTP Request**:
```
GET {base_url}/v2/activities/templates?query=...&limit=100&category=feature
Headers:
  Content-Type: application/json
  Authorization: Bearer {session_token}
  X-Trace-ID: {trace_id}  (optional)
```

**Data Transformation**:
- Proto snake_case → internal format
- variant_id → id
- variant_name → name
- expected_quality_score → success_rate
- task_steps → tasks (length only)

**Dependencies**: httpx.AsyncClient, backend rpc-api server

**⚠️ FAILURE POINT**: If base_url or session_token missing/invalid, HTTP call fails

---

## Process Boundaries

### Boundary 1: OpenCode Process
**Components**: 1-7
**Language**: TypeScript
**Runtime**: Bun/Node.js
**Data Format**: TypeScript objects, JSON

### Boundary 2: MCP Server Process  
**Components**: 9-10
**Language**: Python
**Runtime**: Python asyncio
**Data Format**: Python dicts, JSON
**Transport**: stdio (JSON-RPC over stdin/stdout) or SSE (HTTP)

### Boundary 3: Backend RPC API Process
**Components**: Backend HTTP endpoints (not traced)
**Language**: Python (FastAPI)
**Runtime**: Python asyncio
**Data Format**: JSON, Protocol Buffers
**Transport**: HTTP REST

---

## Data Type Transformations

### Transform 1: Tool Parameters → Repository Options
```typescript
// Input (Component 1)
{ category?: enum, verbose?: boolean }

// Output (Component 2)
{ category?: string, backend?: "local" | "metabob" | "all" }
```

### Transform 2: Backend Selection Mapping
```typescript
// Input (Component 2)
backend: "all"

// Output (Component 3)
backend: "auto"
```

### Transform 3: Template Wrapping
```typescript
// Input (Component 3)
ActivityTemplate.Schema[]

// Output (Component 3)
{
  templates: ActivityTemplate.Schema[],
  source: "metabob" | "local",
  cached: boolean
}
```

### Transform 4: Summaries → Full Templates
```typescript
// Input (Component 5)
[{ id: "template-1", name: "Template 1", ... }]  // Summaries

// Output (Component 4)
[{ id: "template-1", name: "Template 1", tasks: [...], ... }]  // Full templates
```

### Transform 5: MCP Response Extraction
```typescript
// Input (Component 6)
{
  content: [
    { type: "text", text: '{"status":"success","activities":[...]}' }
  ]
}

// Output (Component 6)
{
  status: "success",
  activities: [...]
}
```

### Transform 6: TypeScript → JSON-RPC
```typescript
// Input (Component 6)
callMCPTool("search_activities", { query: "", limit: 100 })

// JSON-RPC (Component 8)
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_activities",
    "arguments": { "query": "", "limit": 100 }
  },
  "id": 1
}
```

### Transform 7: Python Response Formatting
```python
# Input (Component 9)
results: List[Dict] = [...]

# Output (Component 9)
json.dumps({
  "status": "success",
  "activities": results,
  "count": len(results)
})
```

### Transform 8: Proto → Internal Format
```python
# Input (Component 10 from backend)
{
  "variant_id": "template-1",
  "variant_name": "Add REST Endpoint",
  "expected_quality_score": 0.85,
  "expected_cost": 0.05,
  "task_steps": [...]
}

# Output (Component 10)
{
  "id": "template-1",
  "name": "Add REST Endpoint", 
  "success_rate": 0.85,
  "avg_cost": 0.05,
  "task_count": 3
}
```

---

## Critical Failure Points

### 1. MCP Client Not Initialized (Component 6, Line 268)
**Location**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:268`
**Condition**: `metabobClient = clients["metabob"]` returns undefined
**Reason**: "metabob" not configured in opencode.json mcp section
**Impact**: callMCPTool returns undefined, TemplateLoader falls back to bootstrap templates
**Detection**: Check logs for "metabob mcp client not available"

### 2. Session Token Missing (Component 10, Line 138)
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:138`
**Condition**: `self._session_token` is empty string
**Reason**: SessionManager hasn't created session or token not passed to ActivityManager
**Impact**: HTTP request missing Authorization header, backend returns 401
**Detection**: Check backend logs for 401 responses

### 3. Base URL Not Configured (Component 9, Line 3543)
**Location**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py:3543`
**Condition**: `METABOB_API_URL` env var not set
**Reason**: Environment variable not configured
**Impact**: HTTP client connects to wrong URL (default: http://localhost:8080)
**Detection**: Check if ActivityManager.base_url is correct

### 4. MCP Transport Failure (Component 8)
**Location**: MCP SDK transport layer
**Condition**: stdio broken pipe, SSE connection closed, HTTP timeout
**Reason**: MCP server process crashed, not started, or network issue
**Impact**: callTool() throws exception, caught by callMCPTool
**Detection**: Check for MCP connection errors in logs

---

## Diagnostic Checklist

To identify where communication breaks, check in order:

1. **Is MCP client configured?**
   - Check `opencode.json` has `mcp.metabob` section
   - Check Component 7 logs: "available metabob tools"

2. **Is MCP server running?**
   - Check for Python process running `metabob_cli.mcp.server`
   - Check Component 8 transport connection

3. **Is session token available?**
   - Check Component 9 logs: session_token value
   - Check FileStateManager has token in state file

4. **Is base URL correct?**
   - Check METABOB_API_URL environment variable
   - Check Component 10 logs: base_url value

5. **Is backend reachable?**
   - Check Component 10 HTTP response status
   - Check backend logs for incoming requests

---

## Recommended Investigation Steps

1. **Enable debug logging** in both OpenCode and metabob-cli
2. **Check MCP client status**: Add logging to Component 6 line 268
3. **Verify config**: Print Config.get().mcp to see if "metabob" exists
4. **Test MCP connection**: Call test_metabob_mcp tool
5. **Trace HTTP traffic**: Use tcpdump or mitmproxy to see if HTTP calls are made
6. **Check session token**: Print session_token in Component 9
7. **Verify backend**: curl http://localhost:8080/v2/activities/templates directly

---

## Expected vs Actual Behavior

### Expected (User Report Claims)
- Documentation says MCP tools call backend APIs ✓
- Templates stored in SurrealDB via rpc-api ✓
- Learning loop posts execution results ✓

### Actual (User Observation)
- NO HTTP traffic from metabob-cli to rpc-api ✗
- Templates not reaching backend ✗
- Learning loop data not persisted ✗

### Hypothesis
Most likely cause: **MCP client "metabob" not initialized** (Component 6, line 268)

- SearchActivitiesTool calls MetabobCLI.searchActivities()
- callMCPTool("search_activities") returns undefined
- TemplateLoader falls back to bootstrap templates
- No HTTP call ever reaches Component 10
- User sees templates (from bootstrap) but backend never receives traffic

**Next Step**: Verify MCP client initialization by checking Config.get().mcp contents and state() initialization logs.
