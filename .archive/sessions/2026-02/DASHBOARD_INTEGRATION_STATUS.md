# Dashboard Integration Status - Activity Data Display

**Date:** February 8, 2026  
**Status:** 🔧 **IN PROGRESS**

---

## Current Situation

### ✅ What's Working

1. **Database:** 7 activity execution records persisted
2. **V2 API:** Recording endpoints functional
3. **Proto Compliance:** All records match schema
4. **Dashboard UI:** Rendering correctly
5. **Authentication:** User logged in successfully

### 🔧 What's Missing

**Dashboard Activity Endpoint:** `/api/auth/orgs/{org_id}/activity`

**Issue:** Dashboard calls this endpoint but it was missing/returning 404

**Solution Attempted:** Added endpoint to `server/routes/auth.py`

**Current Status:** Endpoint added but returning 500 Internal Server Error

---

## Dashboard Data Requirements

### Network Requests Observed

The dashboard makes these calls on load:
```
GET /auth/session ✓
GET /api/auth/orgs ✓
GET /api/auth/orgs/{org_id}/stats?timeRange=30d ✓
GET /api/auth/orgs/{org_id}/projects ✓
GET /api/auth/orgs/{org_id}/activity?limit=50 ✗ (500 error)
GET /api/events?org_id={org_id}&limit=50 ✓
GET /api/auth/orgs/{org_id}/users ✓
```

**Blocking Issue:** The `/activity` endpoint error prevents "Recent Activity" widget from populating

---

## Expected Data Format

Based on `OrganizationApi.js`:

```javascript
getOrganizationActivity: builder.query({
  query: ({ organizationId, limit = 50 }) => ({
    url: `/auth/orgs/${organizationId}/activity`,
    params: { limit },
  }),
})
```

**Expected Response:**
```json
{
  "activities": [
    {
      "execution_id": "...",
      "activity_id": "...",
      "duration": 21500,
      "success": true,
      "total_cost": 0.058,
      "timestamp": 1770579882.0,
      "outcome": "...",
      ...
    }
  ],
  "total": 7,
  "has_more": false
}
```

---

## Implementation Added

**File:** `server/routes/auth.py`

**Endpoint:**
```python
@router.get("/orgs/{org_id}/activity")
async def get_organization_activity(
    org_id: str,
    limit: int = Query(50),
    offset: int = Query(0),
    org_id_session: tuple = Depends(require_org_access),
    db: SurrealDBClient = Depends(get_surreal_connection),
):
    """Fetch activity executions for organization"""
    
    query = """
    SELECT * FROM activity_executions 
    WHERE org_id = $org_id 
    ORDER BY timestamp DESC
    LIMIT $limit
    START $offset
    """
    
    results = await db.query(query, {"org_id": org_id, ...})
    
    return {
        "activities": results,
        "total": count,
        "has_more": (offset + len(results)) < total
    }
```

**Current Issue:** Endpoint returns 500 error (need to debug)

---

##DevBob CLI Dashboard vs Cloud Dashboard

### DevBob CLI Dashboard (Port 3100)

**Type:** MCP Server with SSE transport  
**Purpose:** MCP client connections (not browser UI)  
**Interface:** JSON-RPC over SSE  
**Endpoints:**
- `/` - Returns `{"detail": "Not Found"}`
- `/sse` - SSE endpoint for MCP clients
- `/metrics` - Returns `{"metrics": {}}`

**Conclusion:** Not a web dashboard, it's an MCP server for programmatic access

### Cloud Dashboard (Port 8888)

**Type:** React web application  
**Purpose:** Visual dashboard for users  
**Interface:** Browser UI with charts and widgets  
**Data Source:** REST API calls to metabob-rpc-api

**Complementary Views:**
- CLI Dashboard: MCP tools expose data programmatically
- Cloud Dashboard: Web UI displays same data visually

---

## Next Steps to Complete Dashboard Integration

### 1. Fix Activity Endpoint (5 min)
- Debug 500 error in `/auth/orgs/{org_id}/activity`
- Verify query syntax and field mapping
- Test response format matches dashboard expectations

### 2. Verify Data Display (2 min)
- Refresh dashboard after fix
- Confirm "Recent Activity" widget populates
- Verify activity details are correct

### 3. Screenshot with Data (1 min)
- Capture dashboard showing real activity data
- Document the complementary views

---

## Data Already Available

**In Database:**
- 7 activity_executions records
- Org ID: `cdbdd13a-6c36-41fb-adf8-fec57aa445e7`
- All proto-compliant

**Ready to Display:**
- Execution IDs
- Activity types
- Durations (18-27 seconds)
- Costs ($0.03-$0.067)
- Success status (mostly true)

**Just Need:** Working endpoint to serve this data to dashboard

---

## Validation Plan

Once endpoint is fixed:

```bash
# 1. Test endpoint
curl http://localhost:8888/api/auth/orgs/{org_id}/activity?limit=5

# 2. Refresh dashboard
# Click "Refresh" button

# 3. Verify data appears
# Check "Recent Activity" widget

# 4. Screenshot
# Capture dashboard with populated data

# 5. Document
# Note complementary views:
#   - MCP: Programmatic access (port 3100)
#   - Cloud: Visual display (port 8888)
```

---

**Status:** Almost there - one endpoint fix away from complete validation  
**Priority:** HIGH - unblocks dashboard data display  
**ETA:** 5-10 minutes to debug and fix
