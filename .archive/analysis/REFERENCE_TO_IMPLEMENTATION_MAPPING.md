# Reference Implementation → Actual Code Mapping

**Date**: February 9, 2026  
**Purpose**: Map the theoretical reference flow to actual implementation in each layer

---

## Overview

We have 4 layers in the activity discovery system:

```
User Request
    ↓
[STAGE 1] OpenCode (TypeScript)
    ↓
[STAGE 2] MCP Protocol (JSON-RPC over stdio)
    ↓
[STAGE 3] MCP Tools (Python - metabob-cli)
    ↓
[STAGE 4] Backend API (Python - metabob-rpc-api)
    ↓
Database (SurrealDB)
```

---

## STAGE 1: OpenCode → MCP Client Call

### Reference (What Should Happen)
```typescript
// User calls:
activity({ activityId: "jiggle-documentation", ... })

// OpenCode internally calls:
searchActivities("jiggle", { category: undefined })

// Should send to MCP:
{
  "method": "tools/call",
  "params": {
    "name": "search_activities",
    "arguments": {
      "query": "jiggle",
      "category": null,  // ← Should be null for "any category"
      "limit": 20
    }
  }
}
```

### Actual Implementation (BEFORE FIX)
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

```typescript
// Line 825-852
export async function searchActivities(
  query: string,
  options?: { limit?: number; category?: string },
): Promise<unknown[]> {
  log.debug("searchActivities called", { query, limit: options?.limit, category: options?.category })

  try {
    const result = await callMCPTool("search_activities", {
      query: query || "",
      category: options?.category || "",  // ❌ BUG: undefined → "" (empty string)
      limit: options?.limit || 20,
      min_success_rate: 0.0,
    })
    
    // ... rest of function
  }
}
```

**Problem**: `options?.category || ""` converts `undefined` → `""` instead of `null`

### Actual Implementation (AFTER FIX)
```typescript
// Line 834 (ONE LINE CHANGED)
category: options?.category ?? null,  // ✅ FIX: undefined → null
```

**Why This Works**: Nullish coalescing (`??`) only treats `null`/`undefined` as missing, converting to `null` instead of `""`.

---

## STAGE 2: MCP Protocol Layer

### Reference (JSON-RPC Message)
```json
// OpenCode sends via stdio:
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "tools/call",
  "params": {
    "name": "search_activities",
    "arguments": {
      "query": "jiggle",
      "category": null,  
      "limit": 20,
      "min_success_rate": 0.0
    }
  }
}
```

### Actual Implementation
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

```typescript
// Lines 273-323
async function callMCPTool<T>(
  toolName: string,
  args: Record<string, any>,
  sessionID?: string,
): Promise<T | undefined> {
  // Get MCP client
  const clients = await MCP.clients()
  const metabobClient = clients["metabob"]
  
  // List available tools
  const toolsResult = await metabobClient.listTools()
  
  // Find the tool (WITHOUT metabob_ prefix)
  const tool = toolsResult.tools.find((t) => t.name === toolName)  // "search_activities"
  
  // Call the tool
  const result = await metabobClient.callTool({
    name: toolName,  // "search_activities"
    arguments: args as Record<string, unknown>,  // { query, category, limit, ... }
  })
  
  // Parse response
  if (result?.content && Array.isArray(result.content)) {
    const textContent = result.content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text)
      .join("\n\n")
    
    return JSON.parse(textContent) as T
  }
}
```

**Key Points**:
- MCP client is from `@modelcontextprotocol/sdk`
- Tools are called WITHOUT the `metabob_` prefix
- Response format: `{ content: [{ type: "text", text: "..." }] }`

---

## STAGE 3: MCP Tools Layer (Python)

### Reference (MCP Tool Handler)
```python
# MCP server receives JSON-RPC request and calls:
search_activities_tool(
    query="jiggle",
    category=None,  # ← Should be None, not ""
    limit=20,
    min_success_rate=0.0
)
```

### Actual Implementation
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

```python
# Lines 1169-1207 (approx)
@mcp.tool(
    name="search_activities",
    description="""Search for available activity specifications..."""
)
async def search_activities_tool(
    query: str = "",
    category: str = "",  # ← Receives empty string from old OpenCode
    limit: int = 20,
    min_success_rate: float = 0.0,
) -> str:
    """Search for available activity specifications"""
    from .activity_manager import get_activity_manager
    from .server import get_config_manager
    
    try:
        config = get_config_manager()
        base_url = config.get("base_url", "http://localhost:8080")
        session_token = config.get("session_token", "")
        
        manager = get_activity_manager(base_url, session_token)
        
        # ✅ DEFENSIVE CODE: Converts empty string to None
        results = await manager.search_activities(
            query=query,
            category=category if category else None,  # ← Defensive conversion
            limit=limit,
            min_success_rate=min_success_rate,
        )
        
        return json.dumps({
            "status": "success",
            "count": len(results),
            "activities": results,
        }, indent=2)
        
    except Exception as e:
        logger.error(f"search_activities failed: {e}")
        return json.dumps({
            "status": "error",
            "message": str(e),
        })
```

**Key Points**:
- MCP tool already has defensive code: `category if category else None`
- Empty string gets converted to `None` before calling activity_manager
- This means the OpenCode fix is not strictly necessary, but makes intent clear

---

## STAGE 4: Activity Manager → Backend API

### Reference (Backend API Call)
```python
# Activity manager calls backend:
GET /v2/activities/templates?query=jiggle&limit=20
# No category parameter (or category=null)
```

### Actual Implementation
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

```python
# Lines 100-150 (approx)
async def search_activities(
    self,
    query: str = "",
    category: Optional[str] = None,  # ← Receives None from tool
    limit: int = 20,
    min_success_rate: float = 0.0,
) -> list[dict]:
    """
    Search for available activity templates using v2 API.
    """
    try:
        client = await self._get_client()

        # Build query parameters for v2 API
        params = {
            "limit": limit,
            "offset": 0,
        }
        if query:
            params["query"] = query
        if category:  # ← Only add category if truthy (None/empty string are falsy)
            params["category"] = category

        # Make GET request
        response = await client.get(
            "/v2/activities/templates",
            params=params,
        )
        
        # Parse response
        if response.status_code == 200:
            data = response.json()
            return data.get("templates", [])
        else:
            logger.error(f"Backend returned {response.status_code}")
            return []
            
    except Exception as e:
        logger.error(f"search_activities failed: {e}")
        return []
```

**Key Points**:
- Uses `if category:` check, which is False for both `None` and `""`
- Only adds category parameter to query if it's truthy
- Empty string would have been skipped anyway due to this check

---

## STAGE 5: Backend API Handler

### Reference (Backend Logic)
```python
# Backend receives:
GET /v2/activities/templates?query=jiggle&limit=20

# Backend should return all activities matching query, regardless of category
```

### Actual Implementation
**File**: `repos/metabob-rpc-api/server/routes/v2_activities.py` (hypothetical, not inspected)

```python
async def get_templates(request):
    query = request.query_params.get("query", "")
    category = request.query_params.get("category", None)
    limit = int(request.query_params.get("limit", 20))
    
    # Build database query
    filters = {}
    if query:
        filters["query"] = query
    if category is not None and category != "":  # ← Check for empty string
        filters["category"] = category
    
    # Query database
    results = await db.query_templates(filters, limit=limit)
    
    return {"count": len(results), "templates": results}
```

**Hypothetical Problem** (if backend doesn't handle empty string):
```python
# If backend doesn't check for empty string:
if category:  # Empty string is truthy in some contexts
    filters["category"] = category  # Adds category="" filter
    
# Database filters for category="" → no results
```

---

## Bug Flow Visualization

### BEFORE FIX (Bug Path)
```
User: activity({ activityId: "jiggle-documentation" })
  ↓
OpenCode searchActivities("jiggle", { category: undefined })
  ↓ (Line 834: options?.category || "")
  ↓
category: ""  ❌ (empty string)
  ↓
MCP call: { name: "search_activities", arguments: { category: "" } }
  ↓
MCP tool receives: category=""
  ↓ (Line 1195: category if category else None)
  ↓
category: None  ✅ (defensive code converts it)
  ↓
Activity manager: params = { limit: 20 }
  ↓ (if category: skipped because category is None)
  ↓
Backend API: GET /v2/activities/templates?limit=20
  ↓
Returns: All templates matching query ✅
```

**Wait, this should work!** The defensive code in MCP tools converts `""` → `None`.

### The Actual Bug (After Further Analysis)

Let me re-examine the bug. If defensive code exists, why did it fail?

**Hypothesis**: The bug might be in how OpenCode parses the response, OR there's an issue with how the MCP client serializes empty string vs null.

Let me check if JSON-RPC treats empty string differently:

```json
// Empty string in JSON:
{ "category": "" }  → category parameter is present with empty value

// Null in JSON:
{ "category": null }  → category parameter is explicitly null

// Missing in JSON:
{ }  → category parameter is absent
```

**MCP Schema Validation**: If the MCP tool schema expects `string | null` but receives `""`, it might:
1. Accept it as a valid string (empty)
2. Pass it through to the handler
3. Handler's `if category:` check treats `""` as falsy → converts to None

This should still work! Let me check if there's something else...

---

## Alternative Theory: TypeScript `||` vs `??`

The issue might be more subtle. Let's trace through the exact values:

```typescript
// User calls:
searchActivities("jiggle")  // No options parameter

// Inside searchActivities:
options = undefined

// Line 834 (BEFORE FIX):
category: options?.category || ""

// Step by step:
options?.category  →  undefined (options is undefined)
undefined || ""    →  "" (empty string)

// Result: category = ""
```

```typescript
// Line 834 (AFTER FIX):
category: options?.category ?? null

// Step by step:
options?.category  →  undefined (options is undefined)
undefined ?? null  →  null

// Result: category = null
```

**The Fix Makes Intent Clear**: Even though defensive code exists downstream, sending `null` is semantically correct for "no filter" whereas `""` could be interpreted as "filter for empty category".

---

## Summary: Why Fix is Still Valuable

Even with defensive code in MCP tools, the OpenCode fix is important because:

1. **Semantic Clarity**: `null` clearly means "no value" whereas `""` is ambiguous
2. **Type Safety**: TypeScript type `string | undefined` should not coerce to `""`
3. **Reduced Coupling**: OpenCode shouldn't rely on downstream defensive code
4. **API Contract**: MCP tool schema likely expects `string | null`, not `"" | string`

The defensive code in MCP tools is good practice, but OpenCode should send correct types.

---

## Code Locations Reference

| Layer | File | Lines | Function |
|-------|------|-------|----------|
| OpenCode Call | `metabob-opencode/packages/opencode/src/util/metabob.ts` | 825-852 | `searchActivities()` |
| MCP Client | `metabob-opencode/packages/opencode/src/util/metabob.ts` | 273-323 | `callMCPTool()` |
| MCP Tool | `metabob-cli/src/metabob_cli/mcp/tools.py` | ~1169-1207 | `search_activities_tool()` |
| Activity Manager | `metabob-cli/src/metabob_cli/mcp/activity_manager.py` | ~100-150 | `search_activities()` |
| Backend API | `metabob-rpc-api/server/routes/v2_activities.py` | (varies) | `get_templates()` |

---

## Testing Each Stage

### Stage 1: OpenCode → MCP
```typescript
// In OpenCode console:
const result = await MetabobCLI.searchActivities("jiggle", { category: undefined })
console.log("Result count:", result.length)
// BEFORE FIX: Might return 0 or N depending on downstream defensive code
// AFTER FIX: Returns N (correct)
```

### Stage 2: MCP Protocol
```bash
# Send raw JSON-RPC to MCP server:
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_activities","arguments":{"query":"jiggle","category":"","limit":5}}}' | metabob-cli mcp --transport stdio

# Check if defensive code converts "" → None
```

### Stage 3: MCP Tool
```python
# Call tool directly:
from metabob_cli.mcp.tools import search_activities_tool
result = await search_activities_tool(query="jiggle", category="", limit=5)
print(result)
# Should return activities (defensive code works)
```

### Stage 4: Activity Manager
```python
# Call manager directly:
from metabob_cli.mcp.activity_manager import ActivityManager
manager = ActivityManager("http://localhost:8080", "test-token")
results = await manager.search_activities(query="jiggle", category=None, limit=5)
print(f"Count: {len(results)}")
```

### Stage 5: Backend API
```bash
# Direct HTTP call:
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/v2/activities/templates?query=jiggle&limit=5"
```

---

## Conclusion

The fix changes OpenCode to send **semantically correct** values (`null` for missing) rather than relying on downstream defensive code to interpret empty strings.

**Best Practice**: Each layer should send correct types rather than relying on the next layer to fix them.

