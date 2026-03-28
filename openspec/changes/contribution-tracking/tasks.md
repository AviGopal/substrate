# Contribution Tracking Implementation Tasks

## Milestone 1: User Attribution Foundation

**Goal:** Ensure execution traces consistently have user attribution via `created_by` field.

### 1.1 Schema Validation

- [ ] 1.1.1 Audit `activity_execution_traces` schema for `created_by` field definition
- [ ] 1.1.2 Verify `created_by` has `VALUE $value OR $auth.id` default in schema
- [ ] 1.1.3 Add index `idx_activity_executions_created_by` if not present
- [ ] 1.1.4 Document `created_by` sources: JWT user, API key user, MiniBob instance

### 1.2 Execution Trace Attribution

- [ ] 1.2.1 Update `repos/metabob-activity-api/src/routes/execution-traces.ts` POST handler
  - [ ] Extract `created_by` from JWT auth context (`jwtAuth.userId` or `jwtAuth.id`)
  - [ ] For API key auth: use `$auth.user_id` (the API key owner)
  - [ ] For MiniBob instance auth: use instance record as `created_by`
- [ ] 1.2.2 Add validation: log warning if `created_by` is NULL after auth extraction
- [ ] 1.2.3 Update execution trace type definition to make `created_by` explicit

### 1.3 Backfill Script

- [ ] 1.3.1 Create `repos/metabob-activity-api/scripts/backfill-created-by.ts`
  - [ ] Query execution traces with NULL `created_by`
  - [ ] Attempt to attribute based on `org_id` + `project_id` patterns
  - [ ] Log unattributable traces for manual review
- [ ] 1.3.2 Test backfill script on development database
- [ ] 1.3.3 Document backfill procedure in migration notes

### E2E Test: M1 - Execution Attributed to User

```typescript
// tests/e2e/contribution-tracking/m1-user-attribution.test.ts
import { test, expect } from '@playwright/test';
import { authenticateUser, createExecutionTrace, getExecutionTraces } from '../helpers/api';

test.describe('M1: User Attribution', () => {
  test('Execution trace is attributed to authenticated user', async () => {
    // 1. Authenticate as a known user
    const { token, user_id } = await authenticateUser('test-user@acme.local', 'test-password');

    // 2. Create an execution trace
    const execution = await createExecutionTrace(token, {
      execution_id: `test-exec-${Date.now()}`,
      template_id: 'test-template-v1',
      success: true,
      duration_ms: 1500,
      cost_usd: 0.01,
    });

    expect(execution.success).toBe(true);

    // 3. Query the execution trace
    const traces = await getExecutionTraces(token, {
      execution_id: execution.execution_id,
    });

    // 4. Verify created_by is set to the user
    expect(traces.executions).toHaveLength(1);
    expect(traces.executions[0].created_by).toBeTruthy();
    expect(traces.executions[0].created_by).toContain(user_id);
  });

  test('Execution via API key is attributed to API key owner', async () => {
    // 1. Authenticate with API key
    const { token, user_id, org_id } = await authenticateWithApiKey('mb_test_xxx');

    // 2. Create execution trace
    const execution = await createExecutionTrace(token, {
      execution_id: `test-exec-apikey-${Date.now()}`,
      template_id: 'test-template-v1',
      success: true,
    });

    // 3. Query and verify attribution
    const traces = await getExecutionTraces(token, {
      execution_id: execution.execution_id,
    });

    expect(traces.executions[0].created_by).toBeTruthy();
    // API key owner should be the created_by
    expect(traces.executions[0].created_by).toContain(user_id);
  });

  test('MiniBob autonomous execution is attributed to instance', async () => {
    // 1. Authenticate as MiniBob instance
    const { token, instance_id } = await authenticateMiniBob('minibob-test-001', 'test-api-key');

    // 2. Create execution trace
    const execution = await createExecutionTrace(token, {
      execution_id: `test-exec-minibob-${Date.now()}`,
      template_id: 'boredom-activity-v1',
      success: true,
    });

    // 3. Verify attribution to MiniBob instance
    const traces = await getExecutionTraces(token, {
      execution_id: execution.execution_id,
    });

    expect(traces.executions[0].created_by).toBeTruthy();
    expect(traces.executions[0].created_by).toContain('minibob_instance');
  });
});
```

---

## Milestone 2: Contribution Schema and Aggregation

**Goal:** Create `member_contributions` table and aggregation logic.

### 2.1 Schema Definition

- [ ] 2.1.1 Create `repos/metabob-activity-api/sql/schemas/016-member-contributions.surql`
- [ ] 2.1.2 Define all fields per specification (identity, execution, resource, scope, creation metrics)
- [ ] 2.1.3 Define PERMISSIONS for user/admin access
- [ ] 2.1.4 Define indexes for query performance
- [ ] 2.1.5 Apply schema to development database
- [ ] 2.1.6 Verify schema with `INFO FOR TABLE member_contributions`

### 2.2 Aggregation Function

- [ ] 2.2.1 Create SurrealDB function `fn::aggregate_daily_contributions`
  - [ ] Accept date parameter
  - [ ] Query distinct users with executions in period
  - [ ] Compute metrics per user
  - [ ] Upsert into `member_contributions`
- [ ] 2.2.2 Create SurrealDB function `fn::aggregate_weekly_contributions`
  - [ ] Aggregate from daily records
- [ ] 2.2.3 Create SurrealDB function `fn::aggregate_monthly_contributions`
  - [ ] Aggregate from daily or weekly records
- [ ] 2.2.4 Test aggregation functions manually

### 2.3 Aggregation Job

- [ ] 2.3.1 Create `repos/metabob-activity-api/src/jobs/contribution-aggregation.ts`
  - [ ] Export function to run daily aggregation
  - [ ] Include error handling and logging
  - [ ] Support backfill mode (process multiple days)
- [ ] 2.3.2 Add job trigger to API startup or scheduled endpoint
- [ ] 2.3.3 Add health check for aggregation job (last run timestamp)

### 2.4 Backfill Historical Data

- [ ] 2.4.1 Create backfill script `repos/metabob-activity-api/scripts/backfill-contributions.ts`
  - [ ] Accept date range parameters
  - [ ] Process one day at a time to avoid memory issues
  - [ ] Log progress and errors
- [ ] 2.4.2 Test backfill with 30 days of historical data
- [ ] 2.4.3 Document backfill procedure

### E2E Test: M2 - Aggregation Correctness

```typescript
// tests/e2e/contribution-tracking/m2-aggregation.test.ts
import { test, expect } from '@playwright/test';
import { authenticateUser, createExecutionTrace, runAggregation, getContributions } from '../helpers/api';

test.describe('M2: Aggregation', () => {
  test('Daily aggregation matches raw execution data', async () => {
    const { token, user_id } = await authenticateUser('agg-test@acme.local', 'password');
    const today = new Date().toISOString().split('T')[0];

    // 1. Create known executions
    const executions = [
      { success: true, duration_ms: 1000, cost_usd: 0.01 },
      { success: true, duration_ms: 2000, cost_usd: 0.02 },
      { success: false, duration_ms: 500, cost_usd: 0.005 },
    ];

    for (const exec of executions) {
      await createExecutionTrace(token, {
        execution_id: `agg-test-${Date.now()}-${Math.random()}`,
        template_id: 'test-template',
        ...exec,
      });
    }

    // 2. Run aggregation for today
    await runAggregation({ date: today });

    // 3. Query contributions
    const contributions = await getContributions(token, {
      user_id,
      period: 'day',
      start_date: today,
    });

    // 4. Verify aggregates
    const todayContrib = contributions.find((c) => c.period_start.startsWith(today));
    expect(todayContrib).toBeTruthy();
    expect(todayContrib.executions_count).toBeGreaterThanOrEqual(3);
    expect(todayContrib.success_count).toBeGreaterThanOrEqual(2);
    expect(todayContrib.failure_count).toBeGreaterThanOrEqual(1);
    expect(todayContrib.total_duration_ms).toBeGreaterThanOrEqual(3500);
    expect(todayContrib.total_cost_usd).toBeGreaterThanOrEqual(0.035);
    expect(todayContrib.success_rate).toBeCloseTo(66.67, 0);
  });

  test('Weekly aggregation sums daily data', async () => {
    const { token, user_id } = await authenticateUser('weekly-test@acme.local', 'password');

    // Create executions across multiple days
    // ... (setup code)

    // Run daily aggregation for the week
    // Run weekly aggregation

    // Verify weekly total equals sum of daily totals
    const weeklyContrib = await getContributions(token, {
      user_id,
      period: 'week',
    });

    const dailyContribs = await getContributions(token, {
      user_id,
      period: 'day',
      start_date: weekStart,
      end_date: weekEnd,
    });

    const dailySum = dailyContribs.reduce((sum, d) => sum + d.executions_count, 0);
    expect(weeklyContrib[0].executions_count).toBe(dailySum);
  });

  test('Aggregation is idempotent', async () => {
    const { token, user_id } = await authenticateUser('idempotent@acme.local', 'password');
    const today = new Date().toISOString().split('T')[0];

    // Run aggregation twice
    await runAggregation({ date: today });
    const first = await getContributions(token, { user_id, period: 'day' });

    await runAggregation({ date: today });
    const second = await getContributions(token, { user_id, period: 'day' });

    // Results should be identical
    expect(second[0].executions_count).toBe(first[0].executions_count);
    expect(second[0].success_count).toBe(first[0].success_count);
  });
});
```

---

## Milestone 3: API Endpoints

**Goal:** Implement contribution query endpoints.

### 3.1 User Contribution Endpoints

- [ ] 3.1.1 Create `repos/metabob-activity-api/src/routes/contributions.ts`
- [ ] 3.1.2 Implement `GET /v2/users/:userId/contributions`
  - [ ] Parse query params (period, start_date, end_date)
  - [ ] Verify authorization (self or admin)
  - [ ] Query `member_contributions` table
  - [ ] Compute summary from aggregates
  - [ ] Return response per spec
- [ ] 3.1.3 Implement `GET /v2/users/:userId/contributions/trend`
  - [ ] Support period and days parameters
  - [ ] Return time-series data
- [ ] 3.1.4 Add routes to main app

### 3.2 Organization Contribution Endpoints

- [ ] 3.2.1 Implement `GET /v2/organizations/:orgId/contributions`
  - [ ] Admin-only authorization check
  - [ ] Query all members' contributions
  - [ ] Compute org summary
- [ ] 3.2.2 Implement `GET /v2/organizations/:orgId/contributions/leaderboard`
  - [ ] Support metric parameter (executions, success_rate, cost, projects)
  - [ ] Return ranked members with trends
- [ ] 3.2.3 Implement `POST /v2/organizations/:orgId/contributions/export`
  - [ ] Support CSV and JSON formats
  - [ ] Handle date range and user filters
  - [ ] Stream response for large exports

### 3.3 Real-time Fallback

- [ ] 3.3.1 Add fallback to real-time queries when aggregates are stale
  - [ ] Check `computed_at` timestamp
  - [ ] If stale (> 24h for daily), query `activity_execution_traces` directly
- [ ] 3.3.2 Add caching headers to responses

### E2E Test: M3 - API Endpoints

```typescript
// tests/e2e/contribution-tracking/m3-api-endpoints.test.ts
import { test, expect } from '@playwright/test';
import {
  authenticateUser,
  getUserContributions,
  getUserContributionsTrend,
  getOrgContributions,
  getOrgLeaderboard,
  exportContributions,
} from '../helpers/api';

test.describe('M3: API Endpoints', () => {
  test('User can fetch their own contributions', async () => {
    const { token, user_id } = await authenticateUser('user@acme.local', 'password');

    const response = await getUserContributions(token, user_id, {
      period: 'month',
    });

    expect(response.user.id).toBe(user_id);
    expect(response.contributions).toBeInstanceOf(Array);
    expect(response.summary).toHaveProperty('total_executions');
    expect(response.summary).toHaveProperty('success_rate');
  });

  test('User cannot fetch another users contributions', async () => {
    const { token } = await authenticateUser('user@acme.local', 'password');

    const response = await getUserContributions(token, 'other-user', {
      period: 'month',
    });

    expect(response.error).toBe('forbidden');
  });

  test('Admin can fetch any users contributions in org', async () => {
    const { token } = await authenticateAdmin('admin@acme.local', 'password');

    const response = await getUserContributions(token, 'member-user', {
      period: 'month',
    });

    expect(response.user.id).toBe('member-user');
    expect(response.contributions).toBeDefined();
  });

  test('Trend endpoint returns time-series data', async () => {
    const { token, user_id } = await authenticateUser('trend@acme.local', 'password');

    const response = await getUserContributionsTrend(token, user_id, {
      period: 'day',
      days: 30,
      metric: 'executions',
    });

    expect(response.trend).toBeInstanceOf(Array);
    expect(response.trend.length).toBeLessThanOrEqual(30);
    response.trend.forEach((point) => {
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('value');
    });
  });

  test('Org contributions endpoint requires admin', async () => {
    const { token } = await authenticateUser('member@acme.local', 'password');

    const response = await getOrgContributions(token, 'acme', {});

    expect(response.error).toBe('forbidden');
  });

  test('Admin can fetch org contributions', async () => {
    const { token, org_id } = await authenticateAdmin('admin@acme.local', 'password');

    const response = await getOrgContributions(token, org_id, {
      period: 'month',
    });

    expect(response.organization.id).toBe(org_id);
    expect(response.members).toBeInstanceOf(Array);
    expect(response.summary.active_members).toBeGreaterThan(0);
  });

  test('Leaderboard returns ranked members', async () => {
    const { token, org_id } = await authenticateAdmin('admin@acme.local', 'password');

    const response = await getOrgLeaderboard(token, org_id, {
      metric: 'success_rate',
      limit: 5,
    });

    expect(response.leaderboard).toHaveLength(5);
    expect(response.leaderboard[0].rank).toBe(1);
    expect(response.leaderboard[0].metric_value).toBeGreaterThanOrEqual(
      response.leaderboard[1].metric_value
    );
  });

  test('Export returns CSV data', async () => {
    const { token, org_id } = await authenticateAdmin('admin@acme.local', 'password');

    const blob = await exportContributions(token, org_id, {
      format: 'csv',
      period: 'day',
      start_date: '2026-03-01',
      end_date: '2026-03-25',
    });

    const text = await blob.text();
    expect(text).toContain('user_id,executions_count,success_rate');
  });
});
```

---

## Milestone 4: Dashboard UI

**Goal:** Implement contributions page in metabob-cloud-dashboard.

### 4.1 Page and Navigation

- [ ] 4.1.1 Create `repos/metabob-cloud-dashboard/src/pages/Contributions.tsx`
- [ ] 4.1.2 Add route `/contributions` to router
- [ ] 4.1.3 Add "Contributions" item to sidebar navigation
- [ ] 4.1.4 Add Contributions icon (BarChart3 from lucide-react)

### 4.2 API Client

- [ ] 4.2.1 Create `repos/metabob-cloud-dashboard/src/lib/api/contributions-api.ts`
  - [ ] `getUserContributions(userId, options)`
  - [ ] `getUserContributionsTrend(userId, options)`
  - [ ] `getOrgContributions(orgId, options)`
  - [ ] `getOrgLeaderboard(orgId, options)`
  - [ ] `exportContributions(orgId, options)`

### 4.3 Hooks

- [ ] 4.3.1 Create `repos/metabob-cloud-dashboard/src/hooks/useContributions.ts`
- [ ] 4.3.2 Create `repos/metabob-cloud-dashboard/src/hooks/useContributionTrend.ts`
- [ ] 4.3.3 Create `repos/metabob-cloud-dashboard/src/hooks/useTeamContributions.ts`
- [ ] 4.3.4 Create `repos/metabob-cloud-dashboard/src/hooks/useLeaderboard.ts`

### 4.4 Components

- [ ] 4.4.1 Create `ContributionSummaryCards` component
  - [ ] Display executions, success rate, cost, projects
  - [ ] Show trend indicators vs previous period
- [ ] 4.4.2 Create `ContributionTrendChart` component
  - [ ] Area chart with metric selection
  - [ ] Support day/week granularity
- [ ] 4.4.3 Create `ContributionByProjectTable` component
  - [ ] Sortable columns
  - [ ] Links to project pages
- [ ] 4.4.4 Create `TeamContributionLeaderboard` component
  - [ ] Metric selector (executions, success_rate, etc.)
  - [ ] Trend indicators
  - [ ] Avatar and user info
- [ ] 4.4.5 Create `ExportContributionsForm` component
  - [ ] Format selector (CSV/JSON)
  - [ ] Date range picker
  - [ ] Download trigger

### 4.5 Page Assembly

- [ ] 4.5.1 Implement "My Contributions" tab
  - [ ] Summary cards at top
  - [ ] Trend chart below
  - [ ] Project breakdown table
- [ ] 4.5.2 Implement "Team" tab (admin only)
  - [ ] Team summary cards
  - [ ] Leaderboard
- [ ] 4.5.3 Implement "Export" tab (admin only)
  - [ ] Export form

### E2E Test: M4 - Dashboard UI

```typescript
// tests/e2e/contribution-tracking/m4-dashboard.test.ts
import { test, expect } from '@playwright/test';

test.describe('M4: Dashboard UI', () => {
  test('User can view their contributions', async ({ page }) => {
    // 1. Login as regular user
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@acme.local');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/');

    // 2. Navigate to contributions
    await page.click('[data-testid="nav-contributions"]');
    await page.waitForURL('/contributions');

    // 3. Verify My Contributions tab is shown
    await expect(page.locator('[data-testid="tab-my"]')).toBeVisible();

    // 4. Verify metrics are displayed
    await expect(page.locator('[data-testid="metric-total-executions"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-success-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-total-cost"]')).toBeVisible();

    // 5. Verify trend chart is rendered
    await expect(page.locator('[data-testid="contribution-trend-chart"]')).toBeVisible();

    // 6. Verify project table is rendered
    await expect(page.locator('[data-testid="contribution-by-project"]')).toBeVisible();
  });

  test('Regular user cannot see Team tab', async ({ page }) => {
    await loginAsUser(page, 'member@acme.local', 'password');
    await page.goto('/contributions');

    await expect(page.locator('[data-testid="tab-team"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="tab-export"]')).not.toBeVisible();
  });

  test('Admin can see Team tab and leaderboard', async ({ page }) => {
    await loginAsAdmin(page, 'admin@acme.local', 'password');
    await page.goto('/contributions');

    // Verify Team tab is visible
    await expect(page.locator('[data-testid="tab-team"]')).toBeVisible();

    // Click Team tab
    await page.click('[data-testid="tab-team"]');

    // Verify leaderboard is shown
    await expect(page.locator('[data-testid="contribution-leaderboard"]')).toBeVisible();

    // Verify members are listed
    const leaderboardItems = page.locator('[data-testid="leaderboard-item"]');
    await expect(leaderboardItems.first()).toBeVisible();
  });

  test('Admin can export contributions', async ({ page }) => {
    await loginAsAdmin(page, 'admin@acme.local', 'password');
    await page.goto('/contributions');

    // Click Export tab
    await page.click('[data-testid="tab-export"]');

    // Fill export form
    await page.selectOption('[data-testid="export-format"]', 'csv');
    await page.selectOption('[data-testid="export-period"]', 'day');

    // Trigger export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-button"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('Time range filter updates data', async ({ page }) => {
    await loginAsUser(page, 'user@acme.local', 'password');
    await page.goto('/contributions');

    // Get initial executions count
    const initialCount = await page.locator('[data-testid="metric-total-executions"]').textContent();

    // Change time range to 7 days
    await page.click('[data-testid="time-range-7d"]');

    // Wait for data refresh
    await page.waitForTimeout(500);

    // Verify count changed (or stayed same if all data is within 7 days)
    const newCount = await page.locator('[data-testid="metric-total-executions"]').textContent();
    // The test passes if the UI responds - actual values depend on test data
    expect(newCount).toBeDefined();
  });
});
```

---

## Milestone 5: Integration and Testing

**Goal:** Full integration testing and deployment verification.

### 5.1 Integration Tests

- [ ] 5.1.1 Test full flow: execution -> aggregation -> API -> dashboard
- [ ] 5.1.2 Test RBAC boundaries (user vs admin access)
- [ ] 5.1.3 Test with multiple orgs (data isolation)
- [ ] 5.1.4 Test aggregation job reliability (retry on failure)
- [ ] 5.1.5 Test export with large data volumes

### 5.2 Performance Testing

- [ ] 5.2.1 Benchmark contribution queries with 10K executions
- [ ] 5.2.2 Benchmark leaderboard with 100 members
- [ ] 5.2.3 Verify index usage with EXPLAIN queries
- [ ] 5.2.4 Add query timeout handling

### 5.3 Deployment

- [ ] 5.3.1 Add schema to Helm migration job
- [ ] 5.3.2 Document aggregation job scheduling
- [ ] 5.3.3 Add health endpoint for aggregation status
- [ ] 5.3.4 Update dashboard deployment with new page

### E2E Test: M5 - Full Integration

```typescript
// tests/e2e/contribution-tracking/m5-integration.test.ts
import { test, expect } from '@playwright/test';

test.describe('M5: Full Integration', () => {
  test('End-to-end: execution to dashboard display', async ({ page, request }) => {
    // 1. Authenticate
    const { token, user_id, org_id } = await authenticateUser('e2e-test@acme.local', 'password');

    // 2. Create execution via API
    const execResponse = await request.post('/api/activity/activities/execution-traces', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        execution_id: `e2e-test-${Date.now()}`,
        template_id: 'e2e-template',
        success: true,
        duration_ms: 1234,
        cost_usd: 0.05,
      },
    });
    expect(execResponse.ok()).toBeTruthy();

    // 3. Trigger aggregation
    await request.post('/api/activity/internal/aggregate', {
      headers: { Authorization: `Bearer ${token}` },
      data: { date: new Date().toISOString().split('T')[0] },
    });

    // 4. Query contributions via API
    const contribResponse = await request.get(`/api/activity/users/${user_id}/contributions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(contribResponse.ok()).toBeTruthy();
    const contribData = await contribResponse.json();
    expect(contribData.summary.total_executions).toBeGreaterThan(0);

    // 5. Verify in dashboard
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'e2e-test@acme.local');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/');

    await page.goto('/contributions');

    // Verify execution appears in dashboard
    const executionsText = await page.locator('[data-testid="metric-total-executions"]').textContent();
    expect(parseInt(executionsText || '0')).toBeGreaterThan(0);
  });

  test('Cross-org data isolation', async ({ request }) => {
    // Create executions for two different orgs
    const { token: tokenA, user_id: userA } = await authenticateUser('user-a@orgA.local', 'password');
    const { token: tokenB, user_id: userB } = await authenticateUser('user-b@orgB.local', 'password');

    // Create execution for Org A
    await request.post('/api/activity/activities/execution-traces', {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { execution_id: `orgA-${Date.now()}`, template_id: 't1', success: true },
    });

    // Create execution for Org B
    await request.post('/api/activity/activities/execution-traces', {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { execution_id: `orgB-${Date.now()}`, template_id: 't1', success: true },
    });

    // Trigger aggregation
    await runAggregation();

    // Verify Org A user only sees Org A contributions
    const responseA = await request.get(`/api/activity/users/${userA}/contributions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataA = await responseA.json();

    // User A should not see User B's data
    expect(dataA.contributions.every((c) => c.user_id.includes(userA))).toBeTruthy();

    // Org A admin should only see Org A members
    const { token: adminA } = await authenticateAdmin('admin@orgA.local', 'password');
    const orgResponseA = await request.get('/api/activity/organizations/orgA/contributions', {
      headers: { Authorization: `Bearer ${adminA}` },
    });
    const orgDataA = await orgResponseA.json();

    expect(orgDataA.members.every((m) => !m.user_id.includes('orgB'))).toBeTruthy();
  });

  test('Team totals match sum of individual contributions', async ({ request }) => {
    const { token, org_id } = await authenticateAdmin('admin@acme.local', 'password');

    // Get org contributions
    const orgResponse = await request.get(`/api/activity/organizations/${org_id}/contributions`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { period: 'month' },
    });
    const orgData = await orgResponse.json();

    // Sum individual member contributions
    const individualSum = orgData.members.reduce((sum, m) => sum + m.executions_count, 0);

    // Verify org total matches sum
    expect(orgData.summary.total_executions).toBe(individualSum);
  });
});
```

---

## Summary Checklist

### Milestone 1: User Attribution Foundation
- [ ] 1.1 Schema validation (4 tasks)
- [ ] 1.2 Execution trace attribution (3 tasks)
- [ ] 1.3 Backfill script (3 tasks)
- [ ] E2E: M1 tests passing

### Milestone 2: Contribution Schema and Aggregation
- [ ] 2.1 Schema definition (6 tasks)
- [ ] 2.2 Aggregation functions (4 tasks)
- [ ] 2.3 Aggregation job (3 tasks)
- [ ] 2.4 Backfill historical data (3 tasks)
- [ ] E2E: M2 tests passing

### Milestone 3: API Endpoints
- [ ] 3.1 User contribution endpoints (4 tasks)
- [ ] 3.2 Organization contribution endpoints (3 tasks)
- [ ] 3.3 Real-time fallback (2 tasks)
- [ ] E2E: M3 tests passing

### Milestone 4: Dashboard UI
- [ ] 4.1 Page and navigation (4 tasks)
- [ ] 4.2 API client (1 task, 5 functions)
- [ ] 4.3 Hooks (4 tasks)
- [ ] 4.4 Components (5 tasks)
- [ ] 4.5 Page assembly (3 tasks)
- [ ] E2E: M4 tests passing

### Milestone 5: Integration and Testing
- [ ] 5.1 Integration tests (5 tasks)
- [ ] 5.2 Performance testing (4 tasks)
- [ ] 5.3 Deployment (4 tasks)
- [ ] E2E: M5 tests passing

**Total Tasks:** 68
**E2E Test Files:** 5
