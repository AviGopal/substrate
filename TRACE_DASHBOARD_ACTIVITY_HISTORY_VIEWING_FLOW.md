# Dashboard Activity History Viewing Flow - Trace Analysis

## Specification
End-to-end demonstration of viewing activity history in the Metabob dashboard UI at http://app.metabob.local using local Kubernetes (docker-desktop context).

## Current State

### ✅ Working Components
1. **Infrastructure**: Kubernetes cluster running, services deployed in `metabob` namespace
   - metabob-dashboard service (ClusterIP 10.107.102.176:80)
   - metabob-rpc-api service (ClusterIP 10.102.45.87:8080)
   - surrealdb service (ClusterIP 10.106.164.246:8000)
   - Ingress routing app.metabob.local → dashboard

2. **Frontend**: React dashboard with complete UI
   - DevelopmentProgressDashboard component (repos/metabob-dashboard/src/pages/Dashboard/components/DevelopmentProgressDashboard.js)
   - LearningView component (repos/metabob-dashboard/src/pages/Dashboard/components/LearningView.js)
   - RTK Query API client with endpoints defined (MetabobRestApi.js)

3. **Backend - Write Path**: Activity execution recording works
   - POST /v2/activities/executions endpoint (repos/metabob-rpc-api/server/routes/activity.py:318-400)
   - insert_execution() database operation (repos/metabob-rpc-api/server/db/operations/activity_execution.py)
   - Data stored in SurrealDB activity_executions table

4. **Database**: SurrealDB deployed and accessible
   - Namespace: metabob, Database: devbob
   - Table: activity_executions (stores all execution records)

5. **Browser Automation**: Playwright MCP tools available for demonstration

## ❌ Critical Gaps

### 1. Missing Analytics Router (HIGH SEVERITY)
**File**: repos/metabob-rpc-api/server/routes/analytics.py (NOT FOUND)

**Problem**: Frontend calls these endpoints but they don't exist:
- GET /analytics/templates
- GET /analytics/trends?period=7d&granularity=day
- GET /analytics/improvement-roadmap
- GET /analytics/api-keys
- GET /analytics/projects

**Impact**: Dashboard cannot display activity data. API calls return 404.

**Fix Required**:
```python
# repos/metabob-rpc-api/server/routes/analytics.py
@router.get("/analytics/templates")
async def get_activity_templates():
    # Query activity_executions table
    # Group by template_id
    # Calculate: execution_count, success_rate, avg_cost, avg_duration
    # Return aggregated template stats

@router.get("/analytics/trends")
async def get_activity_trends(period: str, granularity: str):
    # Query activity_executions with date filtering
    # Group by date (day/week/month)
    # Calculate daily success_rate, execution volume, avg_cost
    # Return time-series data

@router.get("/analytics/improvement-roadmap")
async def get_improvement_roadmap():
    # Query templates with low success rates or high costs
    # Identify improvement areas
    # Return prioritized list
```

### 2. Missing Aggregation Logic (HIGH SEVERITY)
**Problem**: No functions to compute template statistics from raw execution records

**Required Functions**:
- Aggregate executions by template_id
- Calculate success rate (successful / total)
- Calculate average cost, duration, token usage
- Group by time period for trend analysis
- Filter by category, status, date range

### 3. Missing Router Registration (HIGH SEVERITY)
**File**: repos/metabob-rpc-api/server/app.py

**Current**: Analytics router not included in application
```python
# Line 79: activity_metrics_router included
# Line 63: activity_router included
# MISSING: analytics_router
```

**Fix**: Add to app.py:
```python
from server.routes import analytics_router
app.include_router(analytics_router)
```

## Data Flow Diagram

### Write Flow (✅ WORKING)
```
OpenCode CLI Activity Execution
  ↓
metabob.recordDetailedActivityOutcome()
  ↓
POST /v2/activities/executions
  ↓
repos/metabob-rpc-api/server/routes/activity.py:record_activity_execution()
  ↓
repos/metabob-rpc-api/server/db/operations/activity_execution.py:insert_execution()
  ↓
SurrealDB activity_executions table
```

### Read Flow (❌ BROKEN)
```
Dashboard UI (DevelopmentProgressDashboard)
  ↓
useGetActivityTemplatesQuery() - RTK Query
  ↓
GET /analytics/templates ← 404 NOT FOUND ❌
  ↓
(SHOULD BE) Analytics Router
  ↓
(SHOULD BE) Query SurrealDB activity_executions
  ↓
(SHOULD BE) Aggregate by template_id
  ↓
(SHOULD BE) Return JSON response
  ↓
(SHOULD BE) Update Dashboard UI
```

## Implementation Requirements

### New Files
1. `repos/metabob-rpc-api/server/routes/analytics.py` - Analytics router with aggregation endpoints

### Modifications
1. `repos/metabob-rpc-api/server/app.py` - Include analytics_router (line ~87)
2. `repos/metabob-rpc-api/server/routes/__init__.py` - Export analytics_router

### Dependencies (Already Available)
- SurrealDB activity_executions table ✓
- FastAPI framework ✓
- Pydantic for models ✓
- SurrealDB client functions ✓

## Demonstration Steps (Once Analytics Router Implemented)

1. **Navigate to Dashboard**
   - URL: http://app.metabob.local
   - Tool: `playwright_playwright_navigate`
   - Expected: Dashboard loads

2. **Handle Authentication** (if required)
   - Tool: `playwright_playwright_fill`, `playwright_playwright_click`
   - Expected: Session created

3. **View Development Progress**
   - Click on Development Progress / Activity History section
   - Tool: `playwright_playwright_click`
   - Expected: See templates table, metrics, charts

4. **Capture Screenshots**
   - Tool: `playwright_playwright_screenshot`
   - Expected: Visual proof of data flow

5. **Verify Data Accuracy**
   - Compare UI display with SurrealDB query results
   - Expected: Data matches

## Next Steps

1. **PRIORITY 1**: Implement analytics router
   - Create repos/metabob-rpc-api/server/routes/analytics.py
   - Add endpoints for templates, trends, improvement roadmap
   - Implement aggregation logic

2. **PRIORITY 2**: Register router in FastAPI app
   - Modify repos/metabob-rpc-api/server/app.py
   - Add analytics_router to application

3. **PRIORITY 3**: Test data flow
   - Verify endpoints return correct data
   - Check frontend receives and displays data

4. **PRIORITY 4**: Browser automation demonstration
   - Use Playwright to navigate dashboard
   - Capture screenshots showing activity history
   - Document complete flow with visual proof

## Trace Impulse Created
- ID: `trace-dashboard-activity-history-viewing-flow`
- Type: `templateDefinition`
- Budget: 5000 tokens
- Contains: Complete component analysis, gap identification, data flow documentation
