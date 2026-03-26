# Trace Analysis: Analytics Endpoint Fix and Dashboard Local Mode

**Specification Name:** analytics-endpoint-fix-and-dashboard-local-mode  
**Date:** March 5, 2026  
**Status:** Traced - Ready for Implementation  
**Impulse ID:** trace-analytics-endpoint-fix-and-dashboard-local-mode

---

## Executive Summary

This trace documents the remaining issues blocking the complete learning loop demonstration. Two critical bugs prevent end-to-end data flow from OpenCode execution through dashboard visualization:

1. **Analytics Endpoint Bug (HTTP 500):** SurrealDB GROUP BY queries return strings instead of dictionaries, causing AttributeError
2. **Dashboard Authentication Block:** Dashboard runs in cloud mode requiring authentication, blocking access to Activity History view

**Current State:** Data flow stages 1-4 (execution → logging → API → database) are working. Stages 5 (analytics aggregation) and 8 (browser access) are blocked. Stages 6-7 (dashboard fetch/render) are waiting.

**Desired State:** All 8 stages working end-to-end with visible activity data in browser without authentication.

---

## Data Flow Architecture

```
✅ Stage 1: Activity Execution → OpenCode CLI executes activity template
✅ Stage 2: Session Logging → Activity tracker captures execution data
✅ Stage 3: API Recording → POST /v2/activities/executions
✅ Stage 4: SurrealDB Storage → activity_executions table INSERT
🔴 Stage 5: Analytics Aggregation → GET /analytics/templates (BROKEN)
⏳ Stage 6: Dashboard Fetch → useGetActivityTemplatesQuery() (Waiting)
⏳ Stage 7: UI Rendering → DevelopmentProgressDashboard.js (Waiting)
🔴 Stage 8: Browser Access → http://app.metabob.local (BLOCKED)
```

---

## Component Analysis

### 1. Analytics Endpoint Bug (Critical)

**File:** `repos/metabob-rpc-api/server/routes/analytics.py`  
**Component:** `get_activity_templates()` endpoint (lines 32-136)  
**Component:** `get_improvement_roadmap()` endpoint (lines 304-447)

#### Current Behavior
```python
# Line 75-89 in analytics.py
query = """
    SELECT 
        template_id,
        count() as execution_count,
        math::sum(success == true) as success_count,
        math::mean(cost_usd) as avg_cost_usd,
        math::mean(duration_ms) as avg_duration_ms,
        math::mean(tokens_input) as avg_tokens_input,
        math::mean(tokens_output) as avg_tokens_output,
        math::mean(tokens_cache) as avg_tokens_cache,
        math::max(started_at) as last_execution
    FROM activity_executions
    GROUP BY template_id
    ORDER BY execution_count DESC
    LIMIT $limit
"""

results = await db.query(query, {"limit": limit})

# Line 100 - CRASH HERE
execution_count = record.get("execution_count", 0)  # AttributeError: 'str' object has no attribute 'get'
```

**Issue:** SurrealDB returns strings instead of dictionaries when using GROUP BY without SELECT VALUE syntax.

**Expected:** `[{"execution_count": 5, "template_id": "..."}, ...]`  
**Actual:** `["string_value", "string_value", ...]`

#### Desired Behavior
```python
# Fixed query with SELECT VALUE
query = """
    SELECT VALUE {
        template_id: template_id,
        execution_count: count(),
        success_count: math::sum(IF success THEN 1 ELSE 0 END),
        avg_cost_usd: math::mean(cost_usd),
        avg_duration_ms: math::mean(duration_ms),
        avg_tokens_input: math::mean(tokens_input),
        avg_tokens_output: math::mean(tokens_output),
        avg_tokens_cache: math::mean(tokens_cache),
        last_execution: math::max(started_at)
    }
    FROM activity_executions
    GROUP BY template_id
    ORDER BY execution_count DESC
    LIMIT $limit
"""
```

**Result:** Returns valid JSON with template statistics (execution counts, success rates, avg cost/duration)

#### Gap Analysis
- Query needs `SELECT VALUE` wrapper with explicit field mapping
- Same fix needed in `get_improvement_roadmap()` endpoint (line 350-359)
- No changes needed to result processing logic (lines 98-121) - already handles dictionaries correctly

---

### 2. Dashboard Authentication Block (Critical)

**File:** `repos/metabob-dashboard/src/config/features.js`  
**Component:** `CONFIG.SKIP_AUTH` flag (line 137)

#### Current Behavior
```javascript
// Line 137 in features.js
SKIP_AUTH: process.env.REACT_APP_SKIP_AUTH === 'true' || IS_LOCAL_MODE,
```

**Logic is correct** - when `REACT_APP_SKIP_AUTH=true` OR `REACT_APP_DEPLOYMENT_MODE=local`, authentication is bypassed.

**File:** `repos/metabob-dashboard/src/App.js`  
**Component:** Root application routing (lines 160-168)

```javascript
// Lines 160-168 in App.js
function AppContent() {
  // Cloud mode uses its own routing structure
  if (CONFIG.IS_CLOUD_MODE) {
    return <CloudApp />;  // Requires authentication
  }

  // Local mode uses simplified AppShell layout
  return <LocalAppContent />;  // No authentication
}
```

**Issue:** Dashboard deployment doesn't have environment variables set, so it defaults to cloud mode.

#### Desired Behavior
**File:** `repos/platform/deployments/metabob/charts/metabob-dashboard/values/local.metabob-dashboard.values.yaml`

```yaml
# Current (broken)
image:
  tag: 0.2.0

# Desired (working)
image:
  tag: 0.2.0
env:
  REACT_APP_DEPLOYMENT_MODE: local
  REACT_APP_SKIP_AUTH: 'true'
  REACT_APP_API_BASE_URL: 'http://localhost:8080'
```

#### Gap Analysis
- Helm values file missing `env` section
- Need to add deployment mode environment variables
- No code changes needed - configuration logic is correct

---

### 3. Dashboard Components (Ready)

**File:** `repos/metabob-dashboard/src/pages/Dashboard/components/DevelopmentProgressDashboard.js`  
**Component:** Activity History UI component

**Status:** ✅ Already implemented and ready

```javascript
// Already calling analytics endpoint
const { data, isLoading, error } = useGetActivityTemplatesQuery();

// Renders:
// - Template statistics tables
// - Execution count charts
// - Success rate metrics
// - Cost/duration averages
```

**File:** `repos/metabob-dashboard/src/common/MetabobRestApi.js`  
**Component:** RTK Query API definition (lines 436-439)

```javascript
// Lines 436-439
getActivityTemplates: builder.query({
  query: () => '/analytics/templates',
  providesTags: ['Learning'],
}),
```

**Status:** ✅ Already implemented and ready

**Gap:** None - components are ready once backend is fixed and auth is bypassed

---

## Implementation Plan

### Step 1: Fix Analytics Endpoint (15 minutes)

**Files to Modify:**
- `repos/metabob-rpc-api/server/routes/analytics.py`

**Changes:**
1. Update `get_activity_templates()` query (line 75-89)
   - Add `SELECT VALUE` wrapper
   - Change `math::sum(success == true)` to `math::sum(IF success THEN 1 ELSE 0 END)`

2. Update `get_improvement_roadmap()` query (line 350-359)
   - Add `SELECT VALUE` wrapper
   - Same syntax fixes

**Validation:**
```bash
curl http://localhost:8080/analytics/templates
# Expected: {"templates": [{"template_id": "...", "execution_count": 5, ...}], ...}
# Current: HTTP 500 - AttributeError
```

---

### Step 2: Update Dashboard Configuration (5 minutes)

**Files to Modify:**
- `repos/platform/deployments/metabob/charts/metabob-dashboard/values/local.metabob-dashboard.values.yaml`

**Changes:**
```yaml
image:
  tag: 0.2.0
env:
  REACT_APP_DEPLOYMENT_MODE: local
  REACT_APP_SKIP_AUTH: 'true'
  REACT_APP_API_BASE_URL: 'http://localhost:8080'
```

**Validation:**
```bash
kubectl get deployment metabob-dashboard -n metabob -o yaml | grep -A 10 "env:"
# Expected: Should see REACT_APP_DEPLOYMENT_MODE=local
```

---

### Step 3: Redeploy Services (10 minutes)

**Backend Deployment:**
```bash
# Build and push updated RPC API
cd repos/metabob-rpc-api
docker build -t metabob-rpc-api:latest .
docker push metabob-rpc-api:latest

# Deploy to K8s
kubectl rollout restart deployment/metabob-rpc-api -n metabob
kubectl rollout status deployment/metabob-rpc-api -n metabob
```

**Frontend Deployment:**
```bash
# Update dashboard with new env vars
helm upgrade metabob-dashboard ./charts/metabob-dashboard -n metabob \
  -f values/local.metabob-dashboard.values.yaml

# Or use kubectl
kubectl set env deployment/metabob-dashboard -n metabob \
  REACT_APP_DEPLOYMENT_MODE=local \
  REACT_APP_SKIP_AUTH=true

kubectl rollout restart deployment/metabob-dashboard -n metabob
kubectl rollout status deployment/metabob-dashboard -n metabob
```

---

### Step 4: Browser Validation (10 minutes)

**Test Sequence:**
```javascript
// Navigate to dashboard
playwright_playwright_navigate({ url: "http://app.metabob.local" })

// Should bypass login and show dashboard home
playwright_playwright_screenshot({ name: "dashboard-home-no-auth", savePng: true })

// Navigate to Activity History view
playwright_playwright_click({ selector: "nav a:has-text('Dashboard')" })

// Verify data is loaded
playwright_playwright_get_visible_html({ selector: "main" })
playwright_playwright_screenshot({ name: "activity-history-with-data", savePng: true })

// Check for activity data
playwright_playwright_console_logs({ type: "all" })
```

**Expected Results:**
- Dashboard loads without login form
- Activity History view shows execution data
- No HTTP 500 errors in console
- Screenshots show live activity statistics

---

## Validation Criteria

### ✅ Success Criteria

1. **Analytics Endpoint Returns Valid JSON**
   - Test: `curl http://localhost:8080/analytics/templates`
   - Expected: `{"templates": [...], "total_templates": 12, "total_executions": 543}`
   - Current: HTTP 500 - AttributeError

2. **SurrealDB Query Returns Dictionaries**
   - Test: Execute SELECT VALUE query in SurrealDB
   - Expected: `[{"template_id": "add-feature", "execution_count": 10, ...}, ...]`
   - Current: Returns strings

3. **Dashboard Loads Without Authentication**
   - Test: `playwright_playwright_navigate({ url: 'http://app.metabob.local' })`
   - Expected: Dashboard home page (LocalDashboard component)
   - Current: Login form (CloudApp component)

4. **Activity History Visible in Browser**
   - Test: Navigate to Activity History and check for data
   - Expected: Table/chart with template names, counts, success rates
   - Current: Cannot access - blocked by authentication

5. **Complete Data Flow Validated**
   - Test: Execute activity, wait for storage, verify in dashboard
   - Expected: New execution appears in dashboard within seconds
   - Current: Not testable - stages 5 and 8 blocked

---

## Related Files and Documentation

- `BACKEND_UPDATE_STATUS.md` - Current status and blockers (source document)
- `DASHBOARD_VIEWING_FLOW_DEMONSTRATION.md` - Complete architecture details
- `CONFLICT_ANALYSIS_Dashboard_Activity_History.md` - Conflict analysis with other specs
- `repos/metabob-rpc-api/server/db/surrealdb_client.py` - Database client implementation
- `repos/metabob-dashboard/src/cloud/CloudApp.js` - Cloud mode authentication flow
- `repos/metabob-dashboard/src/App.js` - Root routing logic

---

## Conclusion

The learning loop demonstration is **80% complete** with only 2 blockers remaining:

1. **Analytics endpoint bug** - Quick fix with SELECT VALUE syntax (15 minutes)
2. **Dashboard authentication** - Configuration update only (5 minutes)

**Total implementation time:** ~40 minutes including deployment and validation.

Both fixes are isolated, low-risk changes that don't affect the working stages (1-4). Once completed, the full end-to-end flow will be demonstrated with browser screenshots showing live activity execution data.
