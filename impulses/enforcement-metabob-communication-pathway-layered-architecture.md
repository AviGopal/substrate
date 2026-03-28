# Enforcement: metabob-communication-pathway-layered-architecture

## Specification Enforced
The communication pathway from metabob-opencode to surrealdb must follow strict layered architecture: metabob-opencode → metabob-cli → metabob-rpc-api → surrealdb. Each layer must only communicate with its adjacent layer.

## Changes Applied

### Change 1: Remove Direct Storage Access from MCP Tools
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Component**: Import Statement (Line 14)

**Change Made**: 
```python
# BEFORE:
from . import activity_templates

# AFTER:
from .api_client import call_api
```

**Reason**: Removes the import of local storage module (`activity_templates`) and replaces it with the HTTP API client (`call_api`). This enforces that MCP tools must communicate with the RPC API layer instead of bypassing it to access local storage directly.

**Impact Analysis**: 
- Affects 4 MCP tools: `metabob_search_activities`, `metabob_get_activity_template`, `metabob_register_activity_template`, `metabob_list_activity_templates`
- No blast radius to other modules - change is isolated to activity_template_tools.py
- Enforces layered architecture by requiring all database operations to flow through RPC API

---

### Change 2: Refactor metabob_search_activities to Use RPC API
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Component**: `metabob_search_activities` (Lines 50-76)

**Change Made**:
```python
# BEFORE (VIOLATION):
templates = activity_templates.list_templates(category=category)

# AFTER (COMPLIANT):
params = {}
if category:
    params["category"] = category

result = await call_api("GET", "/v2/activities/templates", params=params)

if result["status"] != "success":
    logger.error(f"[ACTIVITY_SEARCH] API error: {result.get('error')}")
    return {
        "status": "error",
        "error": result.get("error", "Failed to list templates"),
        "timestamp": datetime.now().isoformat(),
    }

templates = result["data"].get("templates", [])
```

**Reason**: Replaces direct local storage access with HTTP GET request to RPC API endpoint `/v2/activities/templates`. This ensures the CLI layer communicates only with the RPC API layer, enforcing proper layering.

**Impact Analysis**:
- **Upstream**: metabob-opencode calls this via MCP protocol - no changes needed
- **Downstream**: Now calls RPC API which accesses SurrealDB - proper layering enforced
- **Data Flow**: opencode → MCP → CLI → HTTP → RPC API → SurrealDB ✅
- **Error Handling**: Added API error detection and graceful degradation
- **Field Mapping**: Template response uses `variant_name` instead of `name` (RPC API schema)

---

### Change 3: Refactor metabob_get_activity_template to Use RPC API
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Component**: `metabob_get_activity_template` (Lines 125-156)

**Change Made**:
```python
# BEFORE (VIOLATION):
template = activity_templates.get_template(template_id)

# AFTER (COMPLIANT):
result = await call_api("GET", f"/v2/activities/templates/{template_id}")

if result["status"] != "success":
    elapsed = (datetime.now() - start_time).total_seconds()
    
    # Check if it's a 404 Not Found
    if result.get("http_status") == 404:
        logger.warning(
            f"[ACTIVITY_GET] Template not found: {template_id} ({elapsed:.2f}s)"
        )
        return {
            "status": "not_found",
            "error": f"Template not found: {template_id}",
            "timestamp": datetime.now().isoformat(),
        }
    
    # Other error
    logger.error(f"[ACTIVITY_GET] API error: {result.get('error')}")
    return {
        "status": "error",
        "error": result.get("error", "Failed to get template"),
        "timestamp": datetime.now().isoformat(),
    }

template = result["data"]
```

**Reason**: Replaces direct local storage access with HTTP GET request to RPC API endpoint `/v2/activities/templates/{template_id}`. Enforces proper layering by routing all template retrieval through the RPC API.

**Impact Analysis**:
- **Upstream**: metabob-opencode's `MetabobCLI.getActivity()` calls this - no changes needed
- **Downstream**: Now calls RPC API which accesses SurrealDB - proper layering enforced
- **Data Flow**: opencode → MCP → CLI → HTTP → RPC API → SurrealDB ✅
- **Error Handling**: Distinguishes 404 Not Found from other errors for better UX
- **HTTP Status Codes**: Leverages http_status field from api_client for accurate error classification

---

### Change 4: Refactor metabob_register_activity_template to Use RPC API
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Component**: `metabob_register_activity_template` (Lines 198-220)

**Change Made**:
```python
# BEFORE (VIOLATION):
template_id = activity_templates.save_template(template)

# AFTER (COMPLIANT):
result = await call_api("POST", "/v2/activities/templates", json=template)

if result["status"] != "success":
    logger.error(f"[ACTIVITY_REGISTER] API error: {result.get('error')}")
    return {
        "status": "error",
        "error": result.get("error", "Failed to register template"),
        "timestamp": datetime.now().isoformat(),
    }

# Extract template_id from response
template_data = result["data"]
template_id = template_data.get("variant_id") or template_data.get("activity_id")
```

**Reason**: Replaces direct local storage write with HTTP POST request to RPC API endpoint `/v2/activities/templates`. Enforces proper layering by ensuring all template registration flows through the RPC API to SurrealDB.

**Impact Analysis**:
- **Upstream**: metabob-opencode's `MetabobCLI.registerActivityTemplate()` calls this - no changes needed
- **Downstream**: Now calls RPC API which writes to SurrealDB - proper layering enforced
- **Data Flow**: opencode → MCP → CLI → HTTP → RPC API → SurrealDB ✅
- **ID Extraction**: RPC API returns `variant_id` (for variants) or `activity_id` (for new templates)
- **Idempotency**: RPC API handles duplicate template names by creating variants automatically

---

### Change 5: Refactor metabob_list_activity_templates to Use RPC API
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Component**: `metabob_list_activity_templates` (Lines 260-283)

**Change Made**:
```python
# BEFORE (VIOLATION):
templates = activity_templates.list_templates(category=category)

# AFTER (COMPLIANT):
params = {}
if category:
    params["category"] = category

result = await call_api("GET", "/v2/activities/templates", params=params)

if result["status"] != "success":
    logger.error(f"[ACTIVITY_LIST] API error: {result.get('error')}")
    return {
        "status": "error",
        "error": result.get("error", "Failed to list templates"),
        "timestamp": datetime.now().isoformat(),
    }

templates = result["data"].get("templates", [])
```

**Reason**: Replaces direct local storage access with HTTP GET request to RPC API endpoint `/v2/activities/templates`. This is a non-agentic access tool used for programmatic template listing - must also enforce layered architecture.

**Impact Analysis**:
- **Upstream**: Called programmatically by external systems via MCP - no changes needed
- **Downstream**: Now calls RPC API which accesses SurrealDB - proper layering enforced
- **Data Flow**: external → MCP → CLI → HTTP → RPC API → SurrealDB ✅
- **Consistency**: Same implementation as `metabob_search_activities` (without query filtering)

---

### Change 6: Make RPC API URL Configurable
**File**: `repos/metabob-cli/src/metabob_cli/mcp/api_client.py`

**Component**: `API_BASE_URL` Configuration (Line 43)

**Change Made**:
```python
# BEFORE:
API_BASE_URL = "http://localhost:8080"

# AFTER:
API_BASE_URL = os.environ.get("METABOB_RPC_API_URL", "http://localhost:8080")
```

**Reason**: Makes the RPC API endpoint configurable via environment variable. This is not an architectural enforcement but a configuration improvement that supports different deployment environments (dev, staging, production, k8s).

**Impact Analysis**:
- **Development**: Defaults to `http://localhost:8080` (no change for local dev)
- **Deployment**: Can override with `METABOB_RPC_API_URL=http://metabob-rpc-api:8080` in k8s
- **Testing**: Can point to mock RPC API servers for integration tests
- **No Breaking Changes**: Fallback to localhost preserves existing behavior

---

## Ripple Effects and Propagation

### Data Flow Changes
The enforcement changes propagate through the entire data flow:

**Before (VIOLATION)**:
```
metabob-opencode → MCP → metabob-cli → LOCAL STORAGE (activity_templates)
                                      ↓ (bypass)
                         metabob-rpc-api → surrealdb
```

**After (COMPLIANT)**:
```
metabob-opencode → MCP → metabob-cli → HTTP API → metabob-rpc-api → surrealdb
```

### Schema Alignment
RPC API uses different field names than local storage:
- `variant_name` instead of `name`
- `variant_id` instead of `template_id` (for variants)
- `activity_id` for base templates

**Changes handle this by**:
- Checking both `variant_name` and name in query filtering
- Extracting `variant_id` or `activity_id` from registration response
- Using RPC API's schema throughout

### Error Propagation
All MCP tools now return consistent error responses:
```json
{
  "status": "error",
  "error": "error message",
  "timestamp": "ISO timestamp"
}
```

HTTP status codes from RPC API are used for error classification:
- 404 → `"status": "not_found"`
- 4xx → client error (no retry)
- 5xx → server error (retry with backoff)

### Entry Points Updated
All entry points that use activity templates now flow through RPC API:
1. **metabob-opencode** → Calls MCP tools (unchanged, already compliant)
2. **MCP tools** → Now call HTTP API client (FIXED - was bypassing)
3. **HTTP API client** → Calls RPC API endpoints (already compliant)
4. **RPC API** → Accesses SurrealDB (already compliant)

---

## Verification

### Compliance After Enforcement

| Check | Status | Verification |
|-------|--------|--------------|
| metabob-opencode never imports surrealdb | ✅ PASS | No changes needed - already compliant |
| metabob-cli never imports surrealdb | ✅ PASS | No changes needed - already compliant |
| Only metabob-rpc-api imports surrealdb | ✅ PASS | No changes needed - already compliant |
| metabob-cli MCP tools use HTTP API client | ✅ **NOW COMPLIANT** | `activity_templates` import removed, `call_api` used instead |
| metabob-opencode only calls MCP tools | ✅ PASS | No changes needed - already compliant |

### Architectural Violations Resolved

**BEFORE**: 
- ⚠️ 4 MCP tools bypassed RPC API layer by accessing local storage

**AFTER**: 
- ✅ All MCP tools now call RPC API endpoints
- ✅ No layer bypassing detected
- ✅ Full layered architecture compliance achieved

---

## Summary

Successfully enforced the metabob-communication-pathway-layered-architecture specification by:

1. ✅ **Removed local storage imports** from MCP tools
2. ✅ **Refactored 4 MCP tools** to use HTTP API client:
   - `metabob_search_activities`
   - `metabob_get_activity_template`
   - `metabob_register_activity_template`
   - `metabob_list_activity_templates`
3. ✅ **Made RPC API URL configurable** via environment variable
4. ✅ **Ensured proper error propagation** through all layers
5. ✅ **Aligned schema mappings** between CLI and RPC API

**Architecture Status**: 🟢 **FULLY COMPLIANT**

All layers now follow the strict communication pathway:
```
metabob-opencode → metabob-cli → metabob-rpc-api → surrealdb
```

No layer bypassing detected. Each layer communicates only with its adjacent layer as specified.

---

## Files Modified

1. `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`
   - Removed `activity_templates` import
   - Added `call_api` import
   - Refactored 4 functions to use RPC API
   
2. `repos/metabob-cli/src/metabob_cli/mcp/api_client.py`
   - Made `API_BASE_URL` configurable via environment variable

---

## Next Steps

### Recommended Actions:
1. **Test RPC API endpoints** to ensure they return expected schemas
2. **Update deployment configs** to set `METABOB_RPC_API_URL` for k8s/docker
3. **Verify end-to-end flow** from metabob-opencode through to SurrealDB
4. **Add integration tests** to prevent future architectural violations

### Monitoring:
- Watch for MCP tool errors indicating RPC API unavailability
- Monitor HTTP API client retry attempts and timeouts
- Validate SurrealDB writes through RPC API endpoints
