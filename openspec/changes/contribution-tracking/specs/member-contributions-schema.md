# Member Contributions Schema Specification

## Overview

The `member_contributions` table stores pre-computed aggregated contribution metrics per user per time period. This enables fast dashboard rendering and efficient trend visualization.

## Table Definition

```surql
-- =============================================================================
-- Member Contributions Aggregate Table
-- =============================================================================
-- Pre-computed contribution metrics per user per period
-- RBAC: Users see their own, admins see org-wide
-- =============================================================================

DEFINE TABLE IF NOT EXISTS member_contributions SCHEMAFULL
  PERMISSIONS
    -- Users can see their own contributions
    FOR select WHERE
      user_id = $auth.id
      OR (org_id = $auth.org_id AND $auth.role = 'admin')
    -- Only system/admin can create/update (aggregation job)
    FOR create WHERE $auth.role = 'admin' OR $auth.scope = 'system'
    FOR update WHERE $auth.role = 'admin' OR $auth.scope = 'system'
    -- Only admin can delete
    FOR delete WHERE $auth.role = 'admin' AND org_id = $auth.org_id;

-- =============================================================================
-- Identity Fields
-- =============================================================================

DEFINE FIELD IF NOT EXISTS user_id ON member_contributions TYPE record<users>
  ASSERT $value != NONE
  COMMENT "User this contribution record belongs to";

DEFINE FIELD IF NOT EXISTS org_id ON member_contributions TYPE record<organizations>
  ASSERT $value != NONE
  COMMENT "Organization for RBAC scoping";

DEFINE FIELD IF NOT EXISTS period ON member_contributions TYPE string
  ASSERT $value IN ['day', 'week', 'month', 'all_time']
  COMMENT "Aggregation period type";

DEFINE FIELD IF NOT EXISTS period_start ON member_contributions TYPE datetime
  ASSERT $value != NONE
  COMMENT "Start of the aggregation period (inclusive)";

DEFINE FIELD IF NOT EXISTS period_end ON member_contributions TYPE datetime
  ASSERT $value != NONE
  COMMENT "End of the aggregation period (exclusive)";

-- =============================================================================
-- Execution Metrics
-- =============================================================================

DEFINE FIELD IF NOT EXISTS executions_count ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Total executions in this period";

DEFINE FIELD IF NOT EXISTS success_count ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Successful executions in this period";

DEFINE FIELD IF NOT EXISTS failure_count ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Failed executions in this period";

DEFINE FIELD IF NOT EXISTS success_rate ON member_contributions TYPE float
  ASSERT $value >= 0.0 AND $value <= 100.0
  VALUE $value OR 0.0
  COMMENT "Success rate as percentage (0-100)";

-- =============================================================================
-- Resource Consumption Metrics
-- =============================================================================

DEFINE FIELD IF NOT EXISTS total_duration_ms ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Total execution time in milliseconds";

DEFINE FIELD IF NOT EXISTS total_cost_usd ON member_contributions TYPE float
  ASSERT $value >= 0.0
  VALUE $value OR 0.0
  COMMENT "Total cost in USD";

DEFINE FIELD IF NOT EXISTS total_tokens ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Total tokens consumed (input + output)";

DEFINE FIELD IF NOT EXISTS avg_execution_duration_ms ON member_contributions TYPE float
  ASSERT $value >= 0.0
  VALUE $value OR 0.0
  COMMENT "Average execution duration in milliseconds";

DEFINE FIELD IF NOT EXISTS avg_execution_cost_usd ON member_contributions TYPE float
  ASSERT $value >= 0.0
  VALUE $value OR 0.0
  COMMENT "Average execution cost in USD";

-- =============================================================================
-- Scope Metrics
-- =============================================================================

DEFINE FIELD IF NOT EXISTS projects_touched ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Number of unique projects with executions";

DEFINE FIELD IF NOT EXISTS unique_project_ids ON member_contributions TYPE array<record<projects>>
  VALUE $value OR []
  COMMENT "List of project IDs touched in this period";

DEFINE FIELD IF NOT EXISTS activities_used ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Number of unique activities executed";

DEFINE FIELD IF NOT EXISTS unique_activity_ids ON member_contributions TYPE array<string>
  VALUE $value OR []
  COMMENT "List of activity IDs used in this period";

-- =============================================================================
-- Creation Metrics
-- =============================================================================

DEFINE FIELD IF NOT EXISTS templates_created ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Number of activity templates created in this period";

DEFINE FIELD IF NOT EXISTS impulses_created ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Number of impulses created in this period";

-- =============================================================================
-- Analysis Integration (Future)
-- =============================================================================

DEFINE FIELD IF NOT EXISTS issues_found ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Issues discovered by this user's executions";

DEFINE FIELD IF NOT EXISTS issues_resolved ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Issues marked as resolved by this user";

DEFINE FIELD IF NOT EXISTS issues_acknowledged ON member_contributions TYPE int
  ASSERT $value >= 0
  VALUE $value OR 0
  COMMENT "Issues acknowledged (false positive) by this user";

-- =============================================================================
-- Timestamps
-- =============================================================================

DEFINE FIELD IF NOT EXISTS computed_at ON member_contributions TYPE datetime
  VALUE $value OR time::now()
  COMMENT "When this aggregation was last computed";

DEFINE FIELD IF NOT EXISTS created_at ON member_contributions TYPE datetime
  VALUE $value OR time::now()
  COMMENT "Record creation timestamp";

DEFINE FIELD IF NOT EXISTS updated_at ON member_contributions TYPE datetime
  VALUE time::now()
  COMMENT "Last update timestamp";

-- =============================================================================
-- Indexes
-- =============================================================================

-- Unique constraint: one record per user per period per period_start
DEFINE INDEX IF NOT EXISTS idx_contributions_unique
  ON member_contributions FIELDS user_id, period, period_start UNIQUE;

-- Fast lookups by user
DEFINE INDEX IF NOT EXISTS idx_contributions_user
  ON member_contributions FIELDS user_id;

-- Fast lookups by org (for admin views)
DEFINE INDEX IF NOT EXISTS idx_contributions_org
  ON member_contributions FIELDS org_id;

-- Time range queries
DEFINE INDEX IF NOT EXISTS idx_contributions_period_start
  ON member_contributions FIELDS period_start;

DEFINE INDEX IF NOT EXISTS idx_contributions_period_end
  ON member_contributions FIELDS period_end;

-- Composite: org + period for team views
DEFINE INDEX IF NOT EXISTS idx_contributions_org_period
  ON member_contributions FIELDS org_id, period, period_start;

-- Leaderboard queries (org + metric)
DEFINE INDEX IF NOT EXISTS idx_contributions_org_executions
  ON member_contributions FIELDS org_id, period, executions_count;

DEFINE INDEX IF NOT EXISTS idx_contributions_org_success_rate
  ON member_contributions FIELDS org_id, period, success_rate;
```

## Field Sourcing

| Field | Source | Computation |
|-------|--------|-------------|
| `user_id` | `activity_execution_traces.created_by` | Direct reference |
| `org_id` | `users.org_id` | Lookup from user |
| `period` | Aggregation job parameter | 'day', 'week', 'month' |
| `period_start` | Aggregation job | `time::floor(date, period)` |
| `period_end` | Aggregation job | `period_start + period_duration` |
| `executions_count` | `activity_execution_traces` | `count()` |
| `success_count` | `activity_execution_traces` | `sum(IF success THEN 1 ELSE 0)` |
| `failure_count` | `activity_execution_traces` | `sum(IF !success THEN 1 ELSE 0)` |
| `success_rate` | Computed | `(success_count / executions_count) * 100` |
| `total_duration_ms` | `activity_execution_traces` | `sum(duration_ms)` |
| `total_cost_usd` | `activity_execution_traces` | `sum(cost_usd)` |
| `total_tokens` | `activity_execution_traces` | `sum(tokens_input + tokens_output)` |
| `projects_touched` | `activity_execution_traces` | `count(distinct project_id)` |
| `unique_project_ids` | `activity_execution_traces` | `array::distinct(project_id)` |
| `activities_used` | `activity_execution_traces` | `count(distinct activity_id)` |
| `unique_activity_ids` | `activity_execution_traces` | `array::distinct(activity_id)` |
| `templates_created` | `activity_registry` | `count() WHERE created_by = user_id AND created_at IN period` |
| `issues_found` | Future: analysis_api | `count() WHERE found_by_execution IN user_executions` |
| `issues_resolved` | Future: analysis_api | `count() WHERE resolved_by = user_id` |

## Example Records

### Daily Contribution
```json
{
  "id": "member_contributions:abc123",
  "user_id": "users:alice",
  "org_id": "organizations:acme",
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
  "avg_execution_duration_ms": 3000.0,
  "avg_execution_cost_usd": 0.0153,
  "projects_touched": 2,
  "unique_project_ids": ["projects:backend", "projects:frontend"],
  "activities_used": 5,
  "unique_activity_ids": ["refactor-component-v1", "fix-bug-v2", "..."],
  "templates_created": 1,
  "issues_found": 3,
  "issues_resolved": 2,
  "computed_at": "2026-03-25T01:00:00Z",
  "created_at": "2026-03-25T01:00:00Z",
  "updated_at": "2026-03-25T01:00:00Z"
}
```

### Monthly Summary
```json
{
  "id": "member_contributions:def456",
  "user_id": "users:alice",
  "org_id": "organizations:acme",
  "period": "month",
  "period_start": "2026-03-01T00:00:00Z",
  "period_end": "2026-04-01T00:00:00Z",
  "executions_count": 312,
  "success_count": 287,
  "failure_count": 25,
  "success_rate": 92.0,
  "total_duration_ms": 1250000,
  "total_cost_usd": 4.87,
  "total_tokens": 2500000,
  "projects_touched": 5,
  "activities_used": 28,
  "templates_created": 8,
  "issues_found": 45,
  "issues_resolved": 38
}
```

## Aggregation Queries

### Compute Daily Aggregation
```surql
LET $date = time::floor(time::now() - 1d, 1d);
LET $start = $date;
LET $end = $date + 1d;

SELECT
  created_by AS user_id,
  count() AS executions_count,
  math::sum(IF success THEN 1 ELSE 0 END) AS success_count,
  math::sum(IF !success THEN 1 ELSE 0 END) AS failure_count,
  math::sum(duration_ms) AS total_duration_ms,
  math::sum(cost_usd) AS total_cost_usd,
  math::sum(tokens_input + tokens_output) AS total_tokens,
  array::distinct(project_id) AS unique_project_ids,
  array::distinct(activity_id) AS unique_activity_ids
FROM activity_execution_traces
WHERE created_by IS NOT NONE
  AND executed_at >= $start
  AND executed_at < $end
GROUP BY created_by;
```

### Query User Contributions (with RBAC)
```surql
-- User sees their own contributions
SELECT * FROM member_contributions
WHERE user_id = $auth.id
  AND period = 'day'
  AND period_start >= $start_date
  AND period_start < $end_date
ORDER BY period_start DESC;

-- Admin sees org contributions
SELECT * FROM member_contributions
WHERE org_id = $auth.org_id
  AND period = 'month'
  AND period_start = $target_month
ORDER BY executions_count DESC;
```

## Migration Notes

1. **Backfill existing data**: Run aggregation for all historical dates with execution traces
2. **created_by coverage**: Audit existing traces for NULL created_by values
3. **Index performance**: Monitor query performance with production data volumes
4. **Storage estimation**: ~1KB per record, estimate total based on users x periods
