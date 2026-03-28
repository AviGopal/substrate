# Contribution API Endpoints Specification

## Overview

API endpoints for querying and exporting member contribution data. All endpoints require JWT authentication and respect RBAC boundaries.

## Base URL

All endpoints are prefixed with `/v2` on the `metabob-activity-api` service.

## Authentication

- JWT token in `Authorization: Bearer <token>` header
- User identity from `$auth.id` (user record)
- Organization from `$auth.org_id`
- Role from `$auth.role` ('admin' | 'member')

## Endpoints

### GET /v2/users/:userId/contributions

Get contribution summary for a specific user.

**Authorization:**
- Users can access their own contributions (`userId == $auth.id`)
- Admins can access any user in their org (`$auth.role == 'admin' && user.org_id == $auth.org_id`)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | User ID (without `users:` prefix) |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `month` | Aggregation period: `day`, `week`, `month`, `all_time` |
| `start_date` | ISO8601 | 30 days ago | Start of date range (inclusive) |
| `end_date` | ISO8601 | now | End of date range (exclusive) |

**Response:**
```typescript
interface GetUserContributionsResponse {
  user: {
    id: string;
    name: string;
    email: string;
    org_id: string;
  };
  contributions: MemberContribution[];
  summary: {
    total_executions: number;
    total_success: number;
    total_failures: number;
    overall_success_rate: number;
    total_cost_usd: number;
    total_duration_ms: number;
    unique_projects: number;
    unique_activities: number;
  };
}

interface MemberContribution {
  period: 'day' | 'week' | 'month' | 'all_time';
  period_start: string; // ISO8601
  period_end: string;   // ISO8601
  executions_count: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  total_duration_ms: number;
  total_cost_usd: number;
  total_tokens: number;
  projects_touched: number;
  activities_used: number;
  templates_created: number;
  issues_found: number;
  issues_resolved: number;
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.metabob.local/v2/users/alice/contributions?period=day&start_date=2026-03-01"
```

**Example Response:**
```json
{
  "user": {
    "id": "alice",
    "name": "Alice Smith",
    "email": "alice@acme.com",
    "org_id": "acme"
  },
  "contributions": [
    {
      "period": "day",
      "period_start": "2026-03-24T00:00:00Z",
      "period_end": "2026-03-25T00:00:00Z",
      "executions_count": 15,
      "success_count": 12,
      "failure_count": 3,
      "success_rate": 80.0,
      "total_duration_ms": 45000,
      "total_cost_usd": 0.23,
      "total_tokens": 125000,
      "projects_touched": 2,
      "activities_used": 5,
      "templates_created": 1,
      "issues_found": 3,
      "issues_resolved": 2
    }
  ],
  "summary": {
    "total_executions": 312,
    "total_success": 287,
    "total_failures": 25,
    "overall_success_rate": 92.0,
    "total_cost_usd": 4.87,
    "total_duration_ms": 1250000,
    "unique_projects": 5,
    "unique_activities": 28
  }
}
```

---

### GET /v2/users/:userId/contributions/trend

Get time-series contribution data for trend visualization.

**Authorization:** Same as `/v2/users/:userId/contributions`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | User ID |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `day` | Data point granularity: `day`, `week` |
| `days` | number | `30` | Number of days to include (max 90) |
| `metric` | string | `executions` | Primary metric: `executions`, `success_rate`, `cost`, `duration` |

**Response:**
```typescript
interface GetUserContributionsTrendResponse {
  user: {
    id: string;
    name: string;
  };
  metric: string;
  period: string;
  trend: TimeSeriesPoint[];
}

interface TimeSeriesPoint {
  date: string;      // ISO8601 date
  value: number;     // Metric value
  executions?: number;
  success_rate?: number;
  cost_usd?: number;
  duration_ms?: number;
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.metabob.local/v2/users/alice/contributions/trend?days=30&metric=success_rate"
```

---

### GET /v2/organizations/:orgId/contributions

Get contribution summary for all members in an organization.

**Authorization:**
- Admins only (`$auth.role == 'admin' && orgId == $auth.org_id`)

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization ID |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `month` | Aggregation period |
| `start_date` | ISO8601 | Current month start | Start of date range |
| `end_date` | ISO8601 | now | End of date range |

**Response:**
```typescript
interface GetOrgContributionsResponse {
  organization: {
    id: string;
    name: string;
    member_count: number;
  };
  summary: {
    total_executions: number;
    total_success: number;
    overall_success_rate: number;
    total_cost_usd: number;
    active_members: number;
    unique_projects: number;
  };
  members: MemberContributionSummary[];
}

interface MemberContributionSummary {
  user_id: string;
  user_name: string;
  user_email: string;
  executions_count: number;
  success_count: number;
  success_rate: number;
  total_cost_usd: number;
  projects_touched: number;
  last_active: string; // ISO8601
}
```

---

### GET /v2/organizations/:orgId/contributions/leaderboard

Get ranked member contributions for gamification/reporting.

**Authorization:** Admins only

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization ID |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `month` | Time period to rank |
| `metric` | string | `executions` | Ranking metric: `executions`, `success_rate`, `cost_efficiency`, `projects` |
| `limit` | number | `10` | Max members to return |
| `order` | string | `desc` | Sort order: `asc`, `desc` |

**Response:**
```typescript
interface GetLeaderboardResponse {
  organization: {
    id: string;
    name: string;
  };
  period: string;
  period_start: string;
  period_end: string;
  metric: string;
  leaderboard: RankedContribution[];
}

interface RankedContribution {
  rank: number;
  user_id: string;
  user_name: string;
  metric_value: number;
  executions_count: number;
  success_rate: number;
  total_cost_usd: number;
  trend: 'up' | 'down' | 'stable'; // vs previous period
  trend_change: number; // percentage change
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.metabob.local/v2/organizations/acme/contributions/leaderboard?metric=success_rate&limit=5"
```

**Example Response:**
```json
{
  "organization": { "id": "acme", "name": "ACME Corp" },
  "period": "month",
  "period_start": "2026-03-01T00:00:00Z",
  "period_end": "2026-04-01T00:00:00Z",
  "metric": "success_rate",
  "leaderboard": [
    {
      "rank": 1,
      "user_id": "alice",
      "user_name": "Alice Smith",
      "metric_value": 95.5,
      "executions_count": 312,
      "success_rate": 95.5,
      "total_cost_usd": 4.87,
      "trend": "up",
      "trend_change": 3.2
    },
    {
      "rank": 2,
      "user_id": "bob",
      "user_name": "Bob Jones",
      "metric_value": 92.0,
      "executions_count": 245,
      "success_rate": 92.0,
      "total_cost_usd": 3.21,
      "trend": "stable",
      "trend_change": 0.5
    }
  ]
}
```

---

### POST /v2/organizations/:orgId/contributions/export

Generate and download contribution report.

**Authorization:** Admins only

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `orgId` | string | Organization ID |

**Request Body:**
```typescript
interface ExportContributionsRequest {
  format: 'csv' | 'json';
  period: 'day' | 'week' | 'month';
  start_date: string; // ISO8601
  end_date: string;   // ISO8601
  include_users?: string[]; // Optional: specific user IDs
  include_fields?: string[]; // Optional: subset of fields
  group_by?: 'user' | 'project' | 'activity';
}
```

**Response:**
For small exports, returns data directly:
```typescript
interface ExportContributionsResponse {
  format: string;
  period: string;
  generated_at: string;
  record_count: number;
  data: string; // CSV string or JSON array
}
```

For large exports, returns download URL:
```typescript
interface ExportContributionsAsyncResponse {
  status: 'processing';
  export_id: string;
  estimated_completion: string;
  download_url: string; // Available when complete
}
```

**Example Request:**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","period":"day","start_date":"2026-03-01","end_date":"2026-03-25"}' \
  "https://api.metabob.local/v2/organizations/acme/contributions/export"
```

---

## Error Responses

All endpoints use standard error format:

```typescript
interface ErrorResponse {
  error: string;      // Error code
  message: string;    // Human-readable message
  details?: object;   // Additional context
}
```

**Common Errors:**
| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `invalid_request` | Missing or invalid parameters |
| 401 | `unauthorized` | Missing or invalid token |
| 403 | `forbidden` | User lacks permission |
| 404 | `not_found` | User or org not found |
| 500 | `internal_error` | Server error |

---

## Rate Limiting

- Standard rate limits apply (100 req/min per user)
- Export endpoint has lower limit (10 req/min)
- Aggregation queries cached for 5 minutes

## Caching

- Contribution summaries cached based on period:
  - `day`: Cache for 1 hour
  - `week`: Cache for 6 hours
  - `month`: Cache for 24 hours
  - `all_time`: Cache for 24 hours
- Cache invalidated on new execution trace creation for affected user
