# Implementation Trace: Activity Execution Comprehensive Mapping Display

**Specification**: `activity-execution-comprehensive-mapping-display`  
**Traced Date**: 2026-03-06  
**Impulse ID**: `trace-activity-execution-comprehensive-mapping-display`

## Executive Summary

Comprehensive dashboard visualization of activity execution data with all metadata (invocations, impulses, tasks, outcomes, variants, costs, compositions). This trace analyzes the current implementation across backend (metabob-rpc-api) and frontend (metabob-dashboard) to identify gaps and required components for a full-featured Activity History dashboard.

## Current vs Desired State

### Current State
- **Partial Implementation**: Basic activity timeline in `RecentActivity` component
- **Data Flow**: OpenCode CLI → POST `/v2/activities/executions` → SurrealDB `activity_executions` → GET `/auth/orgs/{org_id}/activity` (Redis cache 60s TTL) → RecentActivity → Basic timeline display
- **Limitations**:
  - No dedicated activity history page
  - No detailed execution breakdown (tasks, impulses, variants)
  - No cost/duration visualization or filtering
  - No composition tree display
  - Analytics endpoints only provide template-level aggregation

### Desired State
- **Full-Featured Dashboard**: Dedicated Activity History page with comprehensive execution mapping
- **Enhanced Data Flow**: Multi-endpoint architecture with filtered list view + detailed execution drill-down
- **Components Required**:
  - Activity History page (`/cloud/activity`)
  - Expandable execution rows with task breakdown
  - Impulse usage tracking and visualization
  - Cost badges and duration timelines
  - Filtering by template, status, cost, time period
  - Variant selection reasoning display
  - Composition tree for activity chains

## Components Analysis (18 Total)

### ✅ Complete (No Gaps) - 8 Components

1. **POST `/v2/activities/executions`** (`repos/metabob-rpc-api/server/routes/activity.py:318-459`)
   - Already captures all required execution metadata
   - Stores to SurrealDB `activity_executions` table
   - Includes impulses_used, tokens, cost, duration, error details

2. **`insert_execution()`** (`repos/metabob-rpc-api/server/db/operations/activity_execution.py:20-121`)
   - Complete SurrealDB insertion with full schema support
   - Supports both legacy and MCP impulse formats

3. **POST `/v2/activities/content`** (`repos/metabob-rpc-api/server/routes/activity.py:854-930`)
   - Stores activity content for replay/learning
   - Captures template definition, variables, reason

4. **POST `/v2/activities/tasks`** (`repos/metabob-rpc-api/server/routes/activity.py:933-1004`)
   - Records task execution start with state snapshots

5. **PATCH `/v2/activities/tasks/{task_execution_id}`** (`repos/metabob-rpc-api/server/routes/activity.py:1007-1076`)
   - Updates tasks with completion data and metrics

6. **GET `/analytics/templates`** (`repos/metabob-rpc-api/server/routes/analytics.py:32-145`)
   - Template-level aggregation (sufficient for high-level metrics)

7. **GET `/analytics/trends`** (`repos/metabob-rpc-api/server/routes/analytics.py:148-311`)
   - Time-series analysis with period/granularity options

8. **Activity execution recording** - All backend infrastructure for capturing execution data is complete

### 🔨 Needs Extension - 3 Components

9. **`get_organization_activity()`** (`repos/metabob-rpc-api/server/db/operations/activity_execution.py:293-485`)
   - **Current**: Returns basic timeline events with metadata
   - **Missing**: Task-level breakdown, impulse usage extraction, variant reasoning, composition tree data
   - **Effort**: Medium (1-2 days)

10. **`RecentActivity`** (`repos/metabob-dashboard/src/cloud/pages/CloudDashboard/components/RecentActivity.js:1-252`)
    - **Current**: Simple timeline with icons and descriptions
    - **Missing**: Expandable rows, task breakdown UI, impulse display, cost visualization
    - **Effort**: Medium (2 days)

11. **`getOrganizationActivity`** API (`repos/metabob-dashboard/src/cloud/api/OrganizationApi.js:284-292`)
    - **Current**: Basic fetch with limit parameter
    - **Missing**: Query params for filtering/sorting, pagination offset, detailed data flag
    - **Effort**: Small (1 day)

### ❌ Missing (New Components) - 7 Components

12. **ActivityHistory Page** (`NEW: repos/metabob-dashboard/src/pages/ActivityHistory/ActivityHistory.js`)
    - Dedicated page with table/list view
    - Filters panel (template, status, date, cost)
    - Sort controls and pagination
    - **Effort**: Medium (2-3 days)

13. **ExecutionRow Component** (`NEW: repos/metabob-dashboard/src/pages/ActivityHistory/components/ExecutionRow.js`)
    - Expandable row with summary + detail tabs
    - Tabs: Tasks, Impulses, Outcomes, Variant Info, Composition
    - **Effort**: Medium (2 days)

14. **TaskBreakdown Component** (`NEW: repos/metabob-dashboard/src/pages/ActivityHistory/components/TaskBreakdown.js`)
    - Task list with status/duration/cost per task
    - Color-coded indicators, progress bars
    - **Effort**: Small (1 day)

15. **ImpulseUsage Component** (`NEW: repos/metabob-dashboard/src/pages/ActivityHistory/components/ImpulseUsage.js`)
    - Table of impulses with types, budgets, pointers
    - Token usage visualization
    - **Effort**: Small (1 day)

16. **CompositionTree Component** (`NEW: repos/metabob-dashboard/src/pages/ActivityHistory/components/CompositionTree.js`)
    - Tree diagram for activity chains
    - Interactive drill-down
    - **Effort**: Large (3-4 days)

17. **GET `/analytics/executions`** (`NEW: repos/metabob-rpc-api/server/routes/analytics.py`)
    - Filtered/sorted execution list endpoint
    - Query params: template_id, success, time_range, cost, duration, limit, offset
    - **Effort**: Medium (1-2 days)

18. **GET `/analytics/executions/{execution_id}`** (`NEW: repos/metabob-rpc-api/server/routes/analytics.py`)
    - Single execution detail with joined data
    - Joins: activity_executions + activity_tasks + activity_content
    - **Effort**: Medium (1-2 days)

## Data Flow Architecture

### Current Flow
```
OpenCode CLI 
  → POST /v2/activities/executions 
  → insert_execution() 
  → SurrealDB activity_executions 
  → GET /auth/orgs/{org_id}/activity (Redis cache 60s TTL) 
  → RecentActivity component 
  → Basic timeline display
```

### Desired Flow
```
OpenCode CLI 
  → [POST /v2/activities/executions + 
     POST /v2/activities/content + 
     POST /v2/activities/tasks] 
  → SurrealDB [activity_executions + activity_content + activity_tasks] 
  → [GET /analytics/executions (filtered/sorted) + 
     GET /analytics/executions/{execution_id} (detailed)] 
  → Redux/RTK Query 
  → ActivityHistory page 
  → [ExecutionRow → TaskBreakdown + ImpulseUsage + CompositionTree] 
  → Comprehensive display with expandable details
```

## Technical Requirements

### Backend
**New Endpoints**:
- `GET /analytics/executions` - Filtered execution list with pagination
- `GET /analytics/executions/{execution_id}` - Single execution detail with joined data

**Database Queries**:
- Query `activity_tasks` table by execution_id for task breakdown
- Query `activity_content` table for template and variable bindings
- Join `activity_executions` with `learning_loop_turns` for variant selection reasoning
- Query composition relationships (parent_id, child_ids)

**Caching Strategy**:
- Redis cache for execution list (60s TTL)
- No cache for detailed single execution view (always fresh)

### Frontend
**New Pages**:
- `/cloud/activity` - Activity History page with table/list view

**New Components**:
- `ActivityHistory` - Main page with filters and table
- `ExecutionRow` - Expandable row with summary and detail tabs
- `TaskBreakdown` - Task-level visualization
- `ImpulseUsage` - Impulse correlation display
- `CompositionTree` - Activity chain visualization (optional MVP)
- `ExecutionFilters` - Filter panel for template, status, date, cost
- `CostBadge` - Visual indicator for cost ranges
- `DurationTimeline` - Progress bar for execution duration

**API Integration**:
- Add `getExecutions`, `getExecutionDetails` to OrganizationApi or create new ActivityApi
- RTK Query hooks for data fetching and caching
- Redux state for filter selections and pagination

## Validation Strategy

### Dataset Source
Use live dataset from **devbob container** (`http://devbob.metabob.local`) to validate accuracy against real-world execution patterns.

### Validation Steps
1. Execute multiple activities on devbob with varying outcomes (success, failure, partial)
2. Verify execution records written to SurrealDB `activity_executions` table
3. Query analytics endpoints to confirm aggregation accuracy
4. Load dashboard Activity History page and verify execution list matches SurrealDB data
5. Expand execution rows and verify task breakdown, impulse usage, costs match actual execution
6. Test filtering by template, status, date range - verify results are accurate
7. Test sorting by cost, duration - verify ordering is correct
8. Compare displayed token counts and costs with actual LLM API usage
9. Verify variant selection reasoning matches Thompson Sampling data in Redis
10. For composed activities, verify composition tree displays correct parent-child relationships

### Playwright E2E Tests
- Navigate to Activity History page and verify page loads
- Execute 5 activities on devbob and verify they appear in dashboard within 60s (cache TTL)
- Click on execution row to expand and verify detail tabs are present
- Apply filters and verify filtered results match expected criteria
- Sort by cost DESC and verify highest-cost executions appear first
- Search by execution_id and verify single result is returned
- Verify status color coding (green=success, red=failure)
- Verify cost badges display correct ranges
- Verify duration timeline bars reflect actual execution times

## Implementation Roadmap

### Phase 1: MVP (5-7 days)
- Create ActivityHistory page component with basic table
- Implement `GET /analytics/executions` endpoint with filtering
- Add ExecutionRow component with expand/collapse
- Display task breakdown (query activity_tasks table)
- Show impulse usage from impulses_used field
- Color-coded status indicators and cost badges

### Phase 2: Enhanced (3-4 days)
- Implement `GET /analytics/executions/{execution_id}` detailed endpoint
- Add tabbed detail view in ExecutionRow
- Implement advanced filtering UI (date range picker, cost slider)
- Add sorting controls in table header
- Implement search by execution ID
- Add DurationTimeline visualization

### Phase 3: Advanced (5-6 days)
- Implement CompositionTree visualization for activity chains
- Add variant selection reasoning display (Thompson Sampling metrics)
- Implement drill-down to task execution logs
- Add export functionality (CSV, JSON)
- Implement real-time updates (WebSocket or polling)
- Add cost/duration trend charts per template

## Gaps Summary

| Gap | Solution | Effort |
|-----|----------|--------|
| No dedicated Activity History page | Create `/cloud/activity` route with ActivityHistory component | Medium (2-3 days) |
| No execution detail endpoint with joined data | Implement `GET /analytics/executions/{execution_id}` with joins | Medium (1-2 days) |
| No task breakdown display | Query activity_tasks table and create TaskBreakdown component | Small (1 day) |
| No impulse usage visualization | Parse impulses_used field and create ImpulseUsage component | Small (1 day) |
| No filtering/sorting in execution list | Add query parameters and create ExecutionFilters component | Medium (2 days) |
| No composition tree visualization | Implement CompositionTree with react-d3-tree library | Large (3-4 days) |
| No variant selection reasoning | Join with learning_loop_turns or template_metrics table | Medium (1-2 days) |

## Estimated Effort

- **Phase 1 MVP**: 5-7 days (1 full-stack engineer)
- **Phase 2 Enhanced**: 3-4 days
- **Phase 3 Advanced**: 5-6 days
- **Total**: 13-17 days (2.5-3.5 weeks)

## Related Files

- **Backend**: 
  - `repos/metabob-rpc-api/server/routes/activity.py` (activity endpoints)
  - `repos/metabob-rpc-api/server/routes/analytics.py` (analytics endpoints)
  - `repos/metabob-rpc-api/server/db/operations/activity_execution.py` (DB operations)
  - `repos/metabob-rpc-api/server/db/operations/task_execution.py` (task operations)

- **Frontend**:
  - `repos/metabob-dashboard/src/cloud/pages/CloudDashboard/components/RecentActivity.js` (existing timeline)
  - `repos/metabob-dashboard/src/cloud/api/OrganizationApi.js` (API client)
  - `repos/metabob-dashboard/src/pages/ActivityHistory/` (NEW - to be created)

## Impulse Reference

This trace analysis has been stored as impulse:
- **ID**: `trace-activity-execution-comprehensive-mapping-display`
- **Type**: `templateDefinition`
- **Budget**: 5000 tokens
- **Location**: `impulses/trace-activity-execution-comprehensive-mapping-display.json`

Full trace data available in: `TRACE_ACTIVITY_EXECUTION_COMPREHENSIVE_MAPPING_DISPLAY.json`

---

**Next Steps**:
1. Review trace with team and prioritize phases
2. Begin Phase 1 MVP implementation (Activity History page + basic filtering)
3. Execute validation tests on devbob container
4. Iterate based on real-world usage patterns
