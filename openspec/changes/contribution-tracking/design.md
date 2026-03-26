## Context

**Current State:**
- `activity_execution_traces` has `created_by` field but it's often NULL (not consistently populated)
- Execution traces are stored per-execution without user-level aggregation
- Dashboard shows org/project metrics but not per-user breakdown
- No contribution reporting or export functionality

**Constraints:**
- Must integrate with existing RBAC system (users can only see their own contributions, admins can see org-wide)
- Must not impact execution trace storage performance
- Must work with existing JWT authentication flow
- Should leverage SurrealDB PERMISSIONS for data isolation

**Stakeholders:**
- Team managers: View team contributions and generate reports
- Individual users: Track personal activity and impact
- Org admins: Billing and resource allocation based on usage

## Goals / Non-Goals

**Goals:**
- Track per-user execution metrics (count, success rate, cost, duration)
- Support time-series contribution visualization (daily/weekly trends)
- Enable org-wide contribution summaries and rankings
- Provide exportable contribution reports
- Respect RBAC boundaries (users see their own, admins see org)

**Non-Goals:**
- Not gamifying contributions (no badges, achievements, rewards)
- Not tracking code quality metrics beyond execution success rate (that's analysis-api's domain)
- Not replacing existing project/template metrics (complementing them)
- Not real-time leaderboards (periodic aggregation is sufficient)

## Decisions

### Decision 1: Aggregation Table Design

**Choice:** Create `member_contributions` table with pre-computed periodic summaries, not materialized views.

**Alternatives Considered:**
- Materialized views: SurrealDB 3.x doesn't support automatic refresh, would require manual triggers
- Real-time aggregation only: Too expensive for large orgs with many executions
- Event sourcing: Overly complex for read-heavy reporting use case

**Rationale:**
- Pre-computed summaries enable fast dashboard rendering
- Scheduled aggregation job runs during low-traffic periods
- Raw data remains in `activity_execution_traces` for detailed queries
- Can be backfilled from existing execution traces

**Schema:**
```surql
DEFINE TABLE IF NOT EXISTS member_contributions SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      (user_id = $auth.id) OR  -- Users see their own
      (org_id = $auth.org_id AND $auth.role = 'admin')  -- Admins see org
    FOR create WHERE $auth.role = 'admin' OR $auth.scope = 'system'
    FOR update WHERE $auth.role = 'admin' OR $auth.scope = 'system'
    FOR delete WHERE $auth.role = 'admin';

-- Identity
DEFINE FIELD IF NOT EXISTS user_id ON member_contributions TYPE record<users>;
DEFINE FIELD IF NOT EXISTS org_id ON member_contributions TYPE record<organizations>;
DEFINE FIELD IF NOT EXISTS period ON member_contributions TYPE string
  ASSERT $value IN ['day', 'week', 'month', 'all_time'];
DEFINE FIELD IF NOT EXISTS period_start ON member_contributions TYPE datetime;
DEFINE FIELD IF NOT EXISTS period_end ON member_contributions TYPE datetime;

-- Execution metrics
DEFINE FIELD IF NOT EXISTS executions_count ON member_contributions TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS success_count ON member_contributions TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS failure_count ON member_contributions TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS success_rate ON member_contributions TYPE float DEFAULT 0.0;

-- Resource metrics
DEFINE FIELD IF NOT EXISTS total_duration_ms ON member_contributions TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS total_cost_usd ON member_contributions TYPE float DEFAULT 0.0;
DEFINE FIELD IF NOT EXISTS total_tokens ON member_contributions TYPE int DEFAULT 0;

-- Scope metrics
DEFINE FIELD IF NOT EXISTS projects_touched ON member_contributions TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS unique_project_ids ON member_contributions TYPE array<record<projects>> DEFAULT [];
DEFINE FIELD IF NOT EXISTS activities_used ON member_contributions TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS unique_activity_ids ON member_contributions TYPE array<string> DEFAULT [];

-- Templates created (from activity_registry)
DEFINE FIELD IF NOT EXISTS templates_created ON member_contributions TYPE int DEFAULT 0;

-- Analysis integration (future)
DEFINE FIELD IF NOT EXISTS issues_found ON member_contributions TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS issues_resolved ON member_contributions TYPE int DEFAULT 0;

-- Timestamps
DEFINE FIELD IF NOT EXISTS computed_at ON member_contributions TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS created_at ON member_contributions TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON member_contributions TYPE datetime VALUE time::now();

-- Indexes
DEFINE INDEX IF NOT EXISTS idx_contributions_user_period
  ON member_contributions FIELDS user_id, period, period_start UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_contributions_org ON member_contributions FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_contributions_period_start ON member_contributions FIELDS period_start;
```

### Decision 2: Ensure User Attribution on Execution Traces

**Choice:** Modify execution trace creation to require `created_by` from `$auth.id`, with fallback to MiniBob instance attribution.

**Alternatives Considered:**
- Make `created_by` required: Would break existing MiniBob autonomous executions
- Keep as optional: Loses user attribution for valuable executions
- Separate user_id field: Redundant with created_by

**Rationale:**
- `created_by` already exists with `VALUE $value OR $auth.id` default
- Problem is that many executions come from MiniBob instances without user context
- For user-driven executions (dashboard, IDE), `$auth.id` is a user record
- For MiniBob autonomous executions, attribute to the MiniBob instance or org

**Implementation:**
```typescript
// In execution-traces.ts POST handler
const trace = {
  // ... existing fields
  // Ensure created_by is set from auth context
  // For JWT users: $auth.id is users:xxx
  // For MiniBob instances: $auth.id is minibob_instance:xxx
  // For API keys: $auth.user_id is the owning user
  created_by: jwtAuth?.userId || jwtAuth?.id || null,
}
```

### Decision 3: API Endpoint Structure

**Choice:** User-centric endpoints under `/v2/users/:userId/contributions` with org-level aggregates under `/v2/organizations/:orgId/contributions`.

**Alternatives Considered:**
- All under `/v2/contributions`: Less RESTful, harder to scope
- Nested under projects: Contributions span projects
- New `/v2/metrics/contributions`: Mixing metrics and entity-level queries

**Rationale:**
- RESTful: Contributions belong to users
- RBAC natural: `/v2/users/:userId/contributions` checks `userId == $auth.id || $auth.role == 'admin'`
- Org-level is separate: `/v2/organizations/:orgId/contributions` for team views
- Export is action-based: POST to generate report

**Endpoints:**
```typescript
// User contributions
GET /v2/users/:userId/contributions
  Query: period=day|week|month|all_time, start_date, end_date
  Response: { contributions: MemberContribution[], user: UserSummary }

GET /v2/users/:userId/contributions/trend
  Query: period=day|week, days=30
  Response: { trend: TimeSeriesPoint[], user: UserSummary }

// Org contributions
GET /v2/organizations/:orgId/contributions
  Query: period=month, start_date, end_date
  Response: { contributions: MemberContribution[], summary: OrgSummary }

GET /v2/organizations/:orgId/contributions/leaderboard
  Query: period=month, metric=executions|success_rate|cost, limit=10
  Response: { leaderboard: RankedContribution[] }

POST /v2/organizations/:orgId/contributions/export
  Body: { format: 'csv' | 'json', period, start_date, end_date, include_users?: string[] }
  Response: { download_url: string } or stream directly
```

### Decision 4: Dashboard Page Design

**Choice:** Single `Contributions.tsx` page with tabs for "My Contributions", "Team", and "Export".

**Alternatives Considered:**
- Separate pages: More navigation, less cohesive
- Embedded in existing pages: Clutters existing UX
- Admin-only page: Users want to see their own contributions

**Rationale:**
- Single page reduces navigation friction
- Tabs handle different views cleanly
- Role-based visibility: non-admins only see "My Contributions" tab
- Export is admin-only by default

**Component Structure:**
```typescript
// Contributions.tsx
<Tabs defaultValue="my">
  <TabsList>
    <TabsTrigger value="my">My Contributions</TabsTrigger>
    {isAdmin && <TabsTrigger value="team">Team</TabsTrigger>}
    {isAdmin && <TabsTrigger value="export">Export</TabsTrigger>}
  </TabsList>

  <TabsContent value="my">
    <ContributionSummaryCards metrics={myMetrics} />
    <ContributionTrendChart data={trendData} />
    <ContributionByProjectTable projects={projectBreakdown} />
  </TabsContent>

  <TabsContent value="team">
    <TeamSummaryCards metrics={teamMetrics} />
    <ContributionLeaderboard members={leaderboard} />
  </TabsContent>

  <TabsContent value="export">
    <ExportContributionsForm onExport={handleExport} />
  </TabsContent>
</Tabs>
```

### Decision 5: Aggregation Job Scheduling

**Choice:** SurrealDB scheduled function that runs daily at midnight UTC, computing previous day's contributions.

**Alternatives Considered:**
- Application-level cron job: External dependency, harder to coordinate
- Kubernetes CronJob: Another resource to maintain
- Trigger on each execution: Too expensive, impacts write performance
- Manual aggregation: Not automated, error-prone

**Rationale:**
- SurrealDB 3.x supports scheduled functions
- Daily aggregation is sufficient for reporting needs
- Weekly/monthly computed from daily aggregates
- Backfill script for historical data

**Implementation:**
```surql
-- Scheduled function to aggregate daily contributions
DEFINE FUNCTION IF NOT EXISTS fn::aggregate_daily_contributions($date: datetime) {
  LET $start = time::floor($date, 1d);
  LET $end = $start + 1d;

  -- Get all users who had executions in this period
  LET $active_users = (
    SELECT DISTINCT created_by FROM activity_execution_traces
    WHERE executed_at >= $start AND executed_at < $end
    AND created_by IS NOT NONE
  );

  -- For each user, compute and upsert their daily contribution
  FOR $user_record IN $active_users {
    LET $user_id = $user_record.created_by;
    LET $user = (SELECT org_id FROM users WHERE id = $user_id)[0];

    LET $metrics = (
      SELECT
        count() AS executions_count,
        math::sum(IF success THEN 1 ELSE 0 END) AS success_count,
        math::sum(IF !success THEN 1 ELSE 0 END) AS failure_count,
        math::sum(duration_ms) AS total_duration_ms,
        math::sum(cost_usd) AS total_cost_usd,
        math::sum(tokens_input + tokens_output) AS total_tokens,
        array::distinct(project_id) AS unique_project_ids,
        array::distinct(activity_id) AS unique_activity_ids
      FROM activity_execution_traces
      WHERE created_by = $user_id
        AND executed_at >= $start
        AND executed_at < $end
      GROUP ALL
    )[0];

    -- Upsert the contribution record
    UPSERT member_contributions CONTENT {
      user_id: $user_id,
      org_id: $user.org_id,
      period: 'day',
      period_start: $start,
      period_end: $end,
      executions_count: $metrics.executions_count OR 0,
      success_count: $metrics.success_count OR 0,
      failure_count: $metrics.failure_count OR 0,
      success_rate: IF $metrics.executions_count > 0 THEN
        ($metrics.success_count / $metrics.executions_count) * 100 ELSE 0 END,
      total_duration_ms: $metrics.total_duration_ms OR 0,
      total_cost_usd: $metrics.total_cost_usd OR 0.0,
      total_tokens: $metrics.total_tokens OR 0,
      projects_touched: array::len($metrics.unique_project_ids OR []),
      unique_project_ids: $metrics.unique_project_ids OR [],
      activities_used: array::len($metrics.unique_activity_ids OR []),
      unique_activity_ids: $metrics.unique_activity_ids OR [],
      computed_at: time::now()
    } WHERE user_id = $user_id AND period = 'day' AND period_start = $start;
  };

  RETURN { aggregated: array::len($active_users), date: $start };
};
```

## Risks / Trade-offs

**Risk: created_by not consistently populated**
- Mitigation: Add validation in execution trace POST handler
- Mitigation: Backfill script to attribute existing traces where possible
- Acceptance: Some historical data may lack user attribution

**Risk: Aggregation job failure impacts dashboard**
- Mitigation: Dashboard falls back to real-time queries if aggregates stale
- Mitigation: Monitor aggregation job with alerts
- Mitigation: Idempotent aggregation allows safe re-runs

**Risk: Performance impact of contribution queries**
- Mitigation: Pre-computed aggregates in `member_contributions`
- Mitigation: Appropriate indexes on time ranges
- Mitigation: Pagination on all list endpoints

**Trade-off: Aggregation granularity**
- Daily is sufficient for reporting, not real-time
- More granular (hourly) would increase storage and compute
- Less granular (weekly-only) loses daily trend visibility

**Trade-off: MiniBob instance attribution**
- MiniBob autonomous executions attributed to instance, not specific user
- This is correct behavior - autonomous work is system-level
- For user-initiated executions via IDE/dashboard, user attribution works
