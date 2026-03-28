# Query Topology Spec

**Purpose:** Document the complete data flow from dashboard components to backend APIs and database.

---

## Overview

The dashboard fetches data from two primary backends:
- **metabob-analysis-api** - Auth, projects, problems, analytics
- **metabob-activity-api** - Activities, executions (real-time)

All data is ultimately stored in SurrealDB with org_id/project_id isolation.

---

## Component → Query Mapping

### Overview Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ Overview Page                                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Projects    │  │ Issues      │  │ Activity    │          │
│  │ Card        │  │ Card        │  │ Card        │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         ▼                ▼                ▼                  │
│  GET /projects    GET /problems    GET /execution-traces    │
│  (analysis-api)   (analysis-api)   (activity-api)           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Activity Timeline                                    │    │
│  │ - Recent execution traces                           │    │
│  │ - WebSocket subscription for new events             │    │
│  └───────────────────────────┬─────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│                    WebSocket /ws (activity-api)              │
│                    Events: activity.completed                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Queries:**

| Component | Query | Params | Returns |
|-----------|-------|--------|---------|
| Projects Card | `GET /projects` | - | `{ count, items[] }` |
| Issues Card | `GET /projects/:id/problems?severity=critical` | severity, limit | `{ count }` |
| Activity Card | `GET /v2/activities/execution-traces?limit=1&today=true` | date filter | `{ count }` |
| Timeline | `GET /v2/activities/execution-traces?limit=10` | limit | `{ items[] }` |
| Real-time | `WebSocket /ws` | subscribe | `{ event, data }` |

---

### Issues Page

```
┌─────────────────────────────────────────────────────────────┐
│ Issues Page                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────┐      │
│  │ Filters: [Project ▼] [Severity ▼] [Status ▼]      │      │
│  │          [Search...]                               │      │
│  └───────────────────────────┬───────────────────────┘      │
│                              │                               │
│                              ▼                               │
│  ┌───────────────────────────────────────────────────┐      │
│  │ GET /projects/:project_id/problems                │      │
│  │   ?severity=critical,high                         │      │
│  │   &status=open                                    │      │
│  │   &search=sql                                     │      │
│  │   &limit=50                                       │      │
│  │   &offset=0                                       │      │
│  └───────────────────────────┬───────────────────────┘      │
│                              │                               │
│                              ▼                               │
│  ┌───────────────────────────────────────────────────┐      │
│  │ Issues Table                                       │      │
│  │ ┌───────┬─────────────┬──────────┬────────┬─────┐ │      │
│  │ │Severity│ Title       │ File     │ Status │  ⋮  │ │      │
│  │ ├───────┼─────────────┼──────────┼────────┼─────┤ │      │
│  │ │ 🔴    │ SQL inject..│ auth.ts  │ Open   │ ... │ │      │
│  │ └───────┴─────────────┴──────────┴────────┴─────┘ │      │
│  └───────────────────────────────────────────────────┘      │
│                                                              │
│  [< Prev] Page 1 of 12 [Next >]                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Queries:**

| Interaction | Query | Purpose |
|-------------|-------|---------|
| Page load | `GET /projects/:id/problems` | Initial list |
| Severity filter | Add `?severity=high,critical` | Filter by severity |
| Status filter | Add `?status=open` | Filter by status |
| Search input | Add `?search=term` (debounced) | Text search |
| Pagination | Add `?offset=50` | Next page |
| Row click | `GET /problems/:id` | Full details |

---

### Issue Detail Modal

```
┌─────────────────────────────────────────────────────────────┐
│ Issue Detail Modal                                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GET /problems/:problem_id                                   │
│                                                              │
│  Returns:                                                    │
│  {                                                           │
│    id: "problem:abc123",                                     │
│    title: "SQL Injection vulnerability",                     │
│    severity: "critical",                                     │
│    category: "security",                                     │
│    status: "open",                                           │
│    file_path: "src/auth/login.ts",                          │
│    line_start: 42,                                           │
│    line_end: 45,                                             │
│    code_snippet: "...",                                      │
│    description: "...",                                       │
│    suggestion: "Use parameterized queries",                  │
│    created_at: "2026-03-20T...",                            │
│    updated_at: "2026-03-24T..."                             │
│  }                                                           │
│                                                              │
│  ┌───────────────────────────────────────────────────┐      │
│  │ [Resolve]  [Ignore]  [Create Task]                │      │
│  └───────────────────────────────────────────────────┘      │
│                                                              │
│  Actions:                                                    │
│  - Resolve: PUT /problems/:id { status: "resolved" }        │
│  - Ignore:  PUT /problems/:id { status: "ignored" }         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### Projects Page

```
┌─────────────────────────────────────────────────────────────┐
│ Projects Page                                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [+ New Project]                      [Grid ▼] [Search...]   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ GET /projects                                        │    │
│  │                                                      │    │
│  │ Returns:                                             │    │
│  │ {                                                    │    │
│  │   items: [                                           │    │
│  │     {                                                │    │
│  │       id: "project:default",                         │    │
│  │       name: "Default Project",                       │    │
│  │       is_default: true,                              │    │
│  │       issue_counts: { critical: 5, high: 12, ... }  │    │
│  │     },                                               │    │
│  │     ...                                              │    │
│  │   ]                                                  │    │
│  │ }                                                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │ Default       │  │ Backend API   │  │ Frontend      │   │
│  │ [Default]     │  │               │  │               │   │
│  │ Issues: 17    │  │ Issues: 8     │  │ Issues: 3     │   │
│  │ [View Issues] │  │ [Edit] [Del]  │  │ [Edit] [Del]  │   │
│  └───────────────┘  └───────────────┘  └───────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Queries:**

| Action | Query | Body |
|--------|-------|------|
| List | `GET /projects` | - |
| Create | `POST /projects` | `{ name, description }` |
| Update | `PUT /projects/:id` | `{ name, description }` |
| Delete | `DELETE /projects/:id` | - |
| View Issues | Navigate to `/issues?project={id}` | - |

---

### API Keys Page

```
┌─────────────────────────────────────────────────────────────┐
│ API Keys Page                                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [+ Create API Key]                                          │
│                                                              │
│  GET /api-keys                                               │
│                                                              │
│  ┌───────────────────────────────────────────────────┐      │
│  │ User          │ Key Prefix   │ Created   │ Status │      │
│  ├───────────────┼──────────────┼───────────┼────────┤      │
│  │ alice@...     │ mb_live_abc  │ 2026-03-20│ Active │      │
│  │ bob@...       │ mb_live_def  │ 2026-03-15│ Active │      │
│  └───────────────────────────────────────────────────┘      │
│                                                              │
│  Create Flow:                                                │
│  1. POST /api-keys { user_email }                           │
│  2. Returns: { key: "mb_live_xyz123..." }                   │
│  3. Display key with copy button (one-time view)            │
│                                                              │
│  Revoke Flow:                                                │
│  1. DELETE /api-keys/:key_prefix                            │
│  2. Key marked as revoked (not deleted)                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### Value & Impact Page

```
┌─────────────────────────────────────────────────────────────┐
│ Value & Impact Page                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Time Range: [Last 7 Days ▼]                                │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Quality Trend Chart                                 │     │
│  │                                                     │     │
│  │ GET /analytics/metrics?range=7d                     │     │
│  │                                                     │     │
│  │ Returns:                                            │     │
│  │ {                                                   │     │
│  │   issue_counts_by_day: [...],                       │     │
│  │   resolution_rate: 0.75,                            │     │
│  │   trend: "improving"                                │     │
│  │ }                                                   │     │
│  │                                                     │     │
│  │   Issues ▲                                          │     │
│  │     │    ╭───╮                                     │     │
│  │     │   ╱     ╲                                    │     │
│  │     │  ╱       ╲___                               │     │
│  │     └────────────────► Time                       │     │
│  │                                                     │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ Resolution Rate  │  │ Issues Prevented │                 │
│  │     75%          │  │      142         │                 │
│  │   ↑ 5% vs last  │  │  (this quarter)  │                 │
│  └──────────────────┘  └──────────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Query Path

### SurrealDB Tables Used

| Table | Service Owner | Dashboard Access |
|-------|---------------|------------------|
| `organizations` | analysis-api | Read (context) |
| `users` | analysis-api | Read (auth) |
| `projects` | analysis-api | Read/Write |
| `problems` | analysis-api | Read/Write |
| `api_keys` | analysis-api | Read/Write |
| `activity_templates` | activity-api | Read only |
| `activity_executions` | activity-api | Read only |
| `sessions` | activity-api | Read only |

### Permission Model

All queries are filtered by `org_id` from the JWT claims:

```sql
-- Example: Fetch projects for org
SELECT * FROM projects
WHERE org_id = $auth.org_id
ORDER BY created_at DESC;

-- Example: Fetch problems for project
SELECT * FROM problems
WHERE project_id = $project_id
  AND project_id IN (
    SELECT id FROM projects WHERE org_id = $auth.org_id
  )
ORDER BY severity DESC, created_at DESC
LIMIT $limit OFFSET $offset;
```

---

## Real-time Data Flow

### WebSocket Events

```
┌────────────┐          ┌──────────────┐          ┌───────────┐
│ Dashboard  │◄────────►│ activity-api │◄────────►│ SurrealDB │
│ (Browser)  │   WS     │   WebSocket  │   LIVE   │   LIVE    │
└────────────┘          └──────────────┘          └───────────┘
      │                        │                        │
      │ connect(/ws)           │                        │
      │──────────────────────►│                        │
      │                        │ LIVE SELECT *         │
      │                        │ FROM activity_executions
      │                        │──────────────────────►│
      │                        │                        │
      │                        │◄──────────────────────│
      │                        │  (change notification) │
      │◄──────────────────────│                        │
      │  { event: "activity.completed", data: {...} }  │
      │                        │                        │
```

### Event Types

| Event | Trigger | Dashboard Action |
|-------|---------|------------------|
| `activity.started` | New execution begins | Add to timeline |
| `activity.completed` | Execution finishes | Update timeline, refresh metrics |
| `activity.failed` | Execution errors | Show in timeline with error state |
| `issue.created` | New problem detected | Increment issue count, toast |
| `issue.resolved` | Problem marked resolved | Update issue row if visible |

---

## Caching Strategy

| Data Type | Cache Duration | Invalidation |
|-----------|----------------|--------------|
| Projects list | 5 minutes | On CRUD action |
| Problem counts | 2 minutes | On WebSocket event |
| Problem details | 10 minutes | On status change |
| Analytics metrics | 10 minutes | Manual refresh |
| Activity traces | 1 minute | WebSocket updates |

---

## Error Handling

### API Error Responses

```typescript
// 401 Unauthorized
{
  error: "unauthorized",
  message: "Invalid or expired token"
}
// → Redirect to login

// 403 Forbidden
{
  error: "forbidden",
  message: "Access denied to this resource"
}
// → Show error, log incident

// 404 Not Found
{
  error: "not_found",
  message: "Project not found"
}
// → Show "not found" state

// 500 Server Error
{
  error: "internal_error",
  message: "Something went wrong"
}
// → Show retry button, log error
```

---

## Summary

The dashboard maintains a clear data flow:
1. **Authentication** via analysis-api JWT
2. **CRUD operations** via analysis-api REST endpoints
3. **Real-time updates** via activity-api WebSocket
4. **All data isolated** by org_id from JWT claims
