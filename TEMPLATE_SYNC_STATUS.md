# Template Loading & Sync Status

## Problem Identified

The activity template loading system was broken because:

1. **Local storage has 88 templates** (`~/.local/share/opencode/storage/activity-template/`)
2. **Backend API has 0 templates** accessible via GET endpoint
3. **Code expects templates from backend** (via MCP) per architectural constraints
4. **Result**: `search_activities` returns 0 templates

## Root Cause

Recent architectural changes enforced "backend-only" template storage via MCP:
- Templates should NOT be loaded from local filesystem (except bootstrap templates)
- Templates MUST come from Metabob backend API (`api.metabob.local`)
- This ensures centralized learning and quality control

However, existing local templates were never migrated to the backend.

## Solution Implemented

Created `scripts/sync-templates.sh` to sync local templates to backend API.

### Execution Results

```
🔄 Template Sync: Local Storage → Backend API
   Storage: ~/.local/share/opencode/storage/activity-template
   Backend: http://api.metabob.local

✅ Backend connected: 0 templates exist initially

Step 2: Registering 88 templates...
  ✅ Registered: 85 templates successfully
  ❌ Failed: 3 templates (HTTP 500 errors)
  
Failed templates:
  - debug-activity-self-contained
  - enforce-architecture-separation-metabob-components  
  - evolve-activity-self-contained
```

### Backend Logs Confirm Success

Templates ARE being written to SurrealDB:
```
✅ Template written to SurrealDB (primary): trace_enforce_validate_loop_99b07520
✅ Template written to SurrealDB (primary): validate_dashboard_activity_data_with_playwright_2f6a9dd5
✅ Template written to SurrealDB (primary): verify_http_rpc_and_persistence_end_to_end_0e156620
```

## Current Issue

**Templates are in database but GET endpoint returns 0**

Possible causes:
1. GET `/v2/activities/templates` may be querying wrong table/namespace
2. Authentication/authorization issue with GET (POSTs work fine)
3. Template retrieval logic may have bug
4. MCP layer may not be passing through GET responses correctly

## Files Created

1. **scripts/sync-templates.sh** - Template sync script (bash/curl)
2. **TEMPLATE_SYNC_STATUS.md** - This document
3. **ACTIVITY_MAPPING_REPORT.md** (82KB) - Comprehensive activity mapping
4. **ACTIVITY_DATA_FLOW_TRACEABILITY.md** (23KB) - Data flow documentation
5. **scripts/generate-activity-mapping.ts** - Report generator
6. **NEW_TEMPLATE_CREATED.md** - Dashboard validation template docs
7. **validate-dashboard-activity-data-with-playwright.json** - New template (synced to backend ✅)

## Next Steps to Fix

### Option 1: Debug Backend GET Endpoint

Check `repos/metabob-rpc-api/server/routes/activity.py`:
- GET `/v2/activities/templates` implementation
- Verify it's querying `activity_template` table correctly
- Check namespace/database selection
- Verify no auth/filtering removing all templates

```bash
# Check logs when GET is called
kubectl logs -n metabob -l app=metabob-rpc-api -f | grep "GET /v2/activities/templates"
```

### Option 2: Verify Template Table Structure

```bash
# Port-forward SurrealDB
kubectl port-forward -n metabob svc/surrealdb 8000:8000

# Query templates (fix Content-Type header issue first)
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -u "root:changeme" \
  -d "USE NS metabob DB metabob_dev; SELECT * FROM activity_template LIMIT 5;"
```

### Option 3: Test MCP Tool Directly

```bash
# From metabob-cli installation
metabob-cli mcp --transport stdio

# Then send MCP request:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "metabob_search_activities",
    "arguments": {}
  }
}
```

### Option 4: Check Template Variants

Templates are stored with variant suffix (e.g., `trace_enforce_validate_loop_99b07520`).

Check if GET endpoint is:
- Searching for exact ID match (won't find variants)
- Should search by base ID or use `LIKE` pattern
- Should return all variants for a template

## Configuration Verified

**metabob-opencode config** (`.opencode/opencode.json`):
```json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_KEY": "mb_devbob_test_simple_2026_v2",
        "METABOB_API_URL": "http://api.metabob.local"
      },
      "enabled": true
    }
  },
  "metabob": {
    "api_key": "mb_devbob_test_simple_2026_v2",
    "base_url": "http://api.metabob.local"
  }
}
```

**API connectivity**: ✅ Working (both POST and GET endpoints respond, just GET returns empty)

## Data Continuity

**metabob-cli instance**: Uses separate config at `repos/metabob-cli/.opencode/opencode.json`

Should verify:
- metabob-cli connects to same backend (`api.metabob.local`)
- Activity execution data is being synced to backend
- Dashboard shows data from backend API

## Summary

✅ **Identified problem**: Templates not syncing to backend  
✅ **Created sync script**: `scripts/sync-templates.sh`  
✅ **Synced 85 templates**: Including new dashboard validation template  
✅ **Verified backend writes**: Templates confirmed in SurrealDB logs  
⚠️  **GET endpoint broken**: Returns 0 templates despite 85 in database  
🔧 **Next**: Debug GET endpoint or template retrieval logic

## Commands to Run

### Re-sync templates (if needed)
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
METABOB_API_URL="http://api.metabob.local" \
METABOB_API_KEY="mb_devbob_test_simple_2026_v2" \
./scripts/sync-templates.sh
```

### Test template search
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode
bun run dev ../.. search_activities
```

### Check backend logs
```bash
kubectl logs -n metabob -l app=metabob-rpc-api --tail=50
```

### Query database directly (once SurrealDB client working)
```bash
kubectl port-forward -n metabob svc/surrealdb 8000:8000
# Query with proper headers/authentication
```

---

**Status**: Templates synced to backend, but retrieval needs debugging  
**Impact**: Template loading broken until GET endpoint fixed  
**Priority**: HIGH - blocks activity template usage  
**Date**: 2026-03-07
