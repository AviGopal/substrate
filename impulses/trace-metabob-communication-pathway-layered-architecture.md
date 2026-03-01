# Trace: metabob-communication-pathway-layered-architecture

## Specification
The communication pathway from metabob-opencode to surrealdb must follow a strict layered architecture: metabob-opencode → metabob-cli → metabob-rpc-api → surrealdb. Each layer should only communicate with its adjacent layer. No layer should bypass the intermediary layers.

## Current State vs Desired State

### Layer 1: metabob-opencode
**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

**Status**: ✅ FULLY COMPLIANT

Components:
- `MetabobCLI.callMCPTool` (line 262): Calls MCP tools via `MCP.clients()` to communicate with metabob-cli
- `MetabobCLI.getPriorityIssues` (line 463): Calls `metabob_get_priority_issues` via MCP
- `MetabobCLI.searchCodebaseIssues` (line 488): Calls `metabob_search_codebase_issues` via MCP
- `MetabobCLI.getActivity` (line 746): Calls `metabob_activity` MCP tool
- `MetabobCLI.registerActivityTemplate` (line 793): Calls `metabob_register_activity_template` MCP tool

**Verification**: metabob-opencode NEVER imports surrealdb. All communication goes through MCP tools.

---

### Layer 2: MCP Protocol
**File**: `repos/metabob-opencode/packages/opencode/src/mcp/index.ts`

**Status**: ✅ FULLY COMPLIANT

Components:
- `MCP.clients` (line 296): Returns connected MCP clients
- `MCP.tools` (line 300): Converts MCP tool definitions to AI SDK tools

**Notes**: MCP protocol acts as clean boundary. No database knowledge at this layer.

---

### Layer 3: metabob-cli (MCP Tools)
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

**Status**: ⚠️ PARTIAL COMPLIANCE - Architectural violations detected

**Violations**:
1. `metabob_search_activities` (line 39)
   - **Current**: Uses `activity_templates.list_templates()` (local storage)
   - **Expected**: Should call `call_api('GET', '/api/activity-templates')`
   - **Impact**: Bypasses RPC API layer

2. `metabob_get_activity_template` (line 102)
   - **Current**: Uses `activity_templates.get_template()` (local storage)
   - **Expected**: Should call `call_api('GET', '/api/activity-templates/{id}')`
   - **Impact**: Bypasses RPC API layer

3. `metabob_register_activity_template` (line 159)
   - **Current**: Uses `activity_templates.save_template()` (local storage)
   - **Expected**: Should call `call_api('POST', '/api/activity-templates')`
   - **Impact**: Bypasses RPC API layer

---

### Layer 3: metabob-cli (API Client)
**File**: `repos/metabob-cli/src/metabob_cli/mcp/api_client.py`

**Status**: ✅ FULLY COMPLIANT

Components:
- `call_api` (line 53): Makes HTTP requests to metabob-rpc-api at `localhost:8080`
- `API_BASE_URL` (line 43): Hardcoded (configuration issue, not architectural)

**Notes**: Correct HTTP client implementation for calling RPC API endpoints.

---

### Layer 3: metabob-cli (Analysis Client)
**File**: `repos/metabob-cli/src/metabob_cli/core/analysis_api_client.py`

**Status**: ✅ FULLY COMPLIANT

Components:
- `AnalysisApiClient` (line 55): Makes HTTP requests to metabob-rpc-api
- `submit_files` (line 103): POSTs files to RPC API `/v2/submit` endpoint

**Verification**: metabob-cli NEVER imports surrealdb. All database access proxied through RPC API.

---

### Layer 4: metabob-rpc-api
**Files**: 
- `repos/metabob-rpc-api/server/routes/activity.py`
- `repos/metabob-rpc-api/server/routes/learning_loop.py`
- `repos/metabob-rpc-api/server/routes/impulse.py`

**Status**: ✅ FULLY COMPLIANT

**Architecture**: Comments in source indicate proper vessel flow:
```
Vessel Flow: CLI metabob_activity_save tool -> this endpoint -> SurrealDB
Vessel Flow: CLI impulse_store tool -> this endpoint -> SurrealDB
```

**Notes**: RPC API is the only layer that accesses database directly.

---

### Layer 5: SurrealDB Client
**File**: `repos/metabob-rpc-api/server/db/surrealdb_client.py`

**Status**: ✅ FULLY COMPLIANT

Components:
- `SurrealDBClient` (line 26): Wrapper for SurrealDB connection
- `get_surreal_client` (line 342): Returns global SurrealDB client instance

**Verification**: SurrealDB client is ONLY imported by metabob-rpc-api. Never imported by metabob-cli or metabob-opencode.

---

## Data Flow

### Compliant Path
```
metabob-opencode [MCP tools] → metabob-cli [HTTP API client] → metabob-rpc-api [SurrealDB client] → surrealdb
```

### Layer Boundaries

1. **opencode → CLI** (MCP Protocol)
   - **Status**: ✅ COMPLIANT
   - **Verification**: metabob-opencode only calls MCP tools, never imports surrealdb or makes direct HTTP requests

2. **CLI → RPC API** (HTTP REST API)
   - **Status**: ⚠️ PARTIAL COMPLIANCE
   - **Issue**: `activity_template_tools.py` uses local storage instead of HTTP API
   - **Violations**:
     - Uses `activity_templates` module instead of `api_client.call_api()`
     - Should call `/api/activity-templates` endpoints

3. **RPC API → SurrealDB** (Native Protocol)
   - **Status**: ✅ COMPLIANT
   - **Verification**: Only metabob-rpc-api imports `surrealdb_client.py`

---

## Compliance Checks

| Check | Status | Verification |
|-------|--------|--------------|
| metabob-opencode never imports surrealdb | ✅ PASS | `grep -r 'surrealdb' repos/metabob-opencode` returns no results |
| metabob-cli never imports surrealdb | ✅ PASS | `grep -r 'surrealdb' repos/metabob-cli` returns no results |
| Only metabob-rpc-api imports surrealdb | ✅ PASS | `surrealdb_client.py` only exists in `repos/metabob-rpc-api` |
| metabob-cli MCP tools use HTTP API client | ⚠️ PARTIAL | `api_client.py` exists but `activity_template_tools` bypass it |
| metabob-opencode only calls MCP tools | ✅ PASS | `MetabobCLI.callMCPTool()` is only communication method |

---

## Recommendations

### HIGH PRIORITY: Fix activity_template_tools.py

**Problem**: MCP tools in `activity_template_tools.py` access local storage instead of calling RPC API endpoints.

**Impact**: Violates layered architecture by bypassing RPC API layer.

**Solution**: Refactor to use `api_client.call_api()`:

```python
# BEFORE (VIOLATION):
templates = activity_templates.list_templates(category=category)

# AFTER (COMPLIANT):
from .api_client import call_api
result = await call_api('GET', '/api/activity-templates', params={'category': category})
templates = result['data']['templates']
```

**Affected Tools**:
- `metabob_search_activities` (line 52)
- `metabob_get_activity_template` (line 111)
- `metabob_register_activity_template` (line 170)

---

### MEDIUM PRIORITY: Make API_BASE_URL configurable

**File**: `repos/metabob-cli/src/metabob_cli/mcp/api_client.py`

**Current**: Hardcoded to `http://localhost:8080`

**Recommendation**: 
```python
API_BASE_URL = os.environ.get("METABOB_RPC_API_URL", "http://localhost:8080")
```

**Rationale**: Support different deployment environments (dev, staging, production).

---

## Summary

The metabob communication pathway is **mostly compliant** with the layered architecture specification:

- ✅ **metabob-opencode** correctly uses MCP tools only
- ✅ **MCP protocol** provides clean layer boundary
- ⚠️ **metabob-cli** has architectural violations in `activity_template_tools.py`
- ✅ **metabob-rpc-api** is the only layer accessing SurrealDB
- ✅ **SurrealDB** is properly isolated to RPC API layer

**Critical Issue**: The `activity_template_tools.py` file in metabob-cli bypasses the RPC API layer by accessing local storage directly. This must be refactored to use HTTP API calls to enforce proper layering.
