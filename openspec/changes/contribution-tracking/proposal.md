## Why

Organizations using Metabob need visibility into how individual team members contribute to the system. Currently, execution traces and activity data exist but are not aggregated at the user level. This makes it impossible to:

- Understand which team members are most active
- Measure individual impact on code quality improvements
- Track contribution trends over time
- Generate contribution reports for performance reviews or billing

**Key Insight:** All the raw data already exists in `activity_execution_traces`, `tool_usage`, and analysis results - it just needs to be attributed to users and aggregated appropriately.

## What Changes

- **New SurrealDB schema**: `member_contributions` aggregate table for periodic contribution summaries
- **New API endpoints**: User contribution queries in `metabob-activity-api`
- **New Dashboard page**: `Contributions.tsx` in `metabob-cloud-dashboard`
- **Modified execution traces**: Ensure `created_by` field is consistently populated from `$auth.id`

## Capabilities

### New Capabilities

- `contribution-tracking`: Aggregate and display per-user metrics including executions run, success rate, projects touched, issues found/resolved
- `contribution-reports`: Export contribution data as CSV/JSON for external reporting
- `team-analytics`: Org-wide contribution summary with optional leaderboard view
- `contribution-trends`: Time-series visualization of contribution metrics per user

### Modified Capabilities

- `execution-traces`: Ensure `created_by` field is populated for all execution traces (currently optional)
- `activity-api-metrics`: Add user-scoped aggregation endpoints

## Impact

**Code Changes:**
- `repos/metabob-activity-api/sql/schemas/`: New `016-member-contributions.surql` schema
- `repos/metabob-activity-api/src/routes/`: New `contributions.ts` route file
- `repos/metabob-cloud-dashboard/src/pages/`: New `Contributions.tsx` page
- `repos/metabob-cloud-dashboard/src/hooks/`: New `useContributions.ts` hook
- `repos/metabob-cloud-dashboard/src/lib/api/`: New `contributions-api.ts` client

**API Changes:**
- `GET /v2/users/:userId/contributions` - Individual user contributions
- `GET /v2/users/:userId/contributions/trend` - Time-series contribution data
- `GET /v2/organizations/:orgId/contributions` - Org-wide contribution summary
- `GET /v2/organizations/:orgId/contributions/leaderboard` - Ranked member contributions
- `POST /v2/organizations/:orgId/contributions/export` - Export contribution report

**Schema Changes:**
- New `member_contributions` table for aggregated metrics
- Ensure `created_by` field populated on `activity_execution_traces`

**Dependencies:**
- Requires existing RBAC authentication (users, organizations tables)
- Requires existing `activity_execution_traces` with user attribution
- Optional: Analysis API integration for issue tracking metrics

## Data Sources

Contributions are derived from multiple existing data sources:

1. **Execution Traces** (`activity_execution_traces`)
   - `created_by` - User who ran the execution
   - `success` - Whether execution succeeded
   - `duration_ms`, `cost_usd` - Resource consumption
   - `project_id` - Project context

2. **Tool Usage** (`tool_usage`)
   - Aggregated by user for tool call patterns
   - Derived from execution traces

3. **Analysis Results** (from `analysis-api` - future integration)
   - Issues found by user's executions
   - Issues resolved/acknowledged

4. **Activity Registry** (`activity_registry`)
   - Activities created by user
   - Template contributions

## Aggregation Strategy

**Real-time (on read):**
- Simple counts directly from `activity_execution_traces` with `GROUP BY created_by`
- Used for immediate queries with small date ranges

**Periodic (scheduled):**
- `member_contributions` table updated via scheduled job or SurrealDB event
- Pre-computed daily/weekly/monthly summaries
- Used for dashboards and trend visualization

**On-demand (export):**
- Complex queries joining multiple tables
- Run at export time, not cached
