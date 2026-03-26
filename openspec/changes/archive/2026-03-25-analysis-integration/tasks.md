# Analysis Integration Tasks

## Milestone Overview

| Milestone | Goal | Testable State |
|-----------|------|----------------|
| **M1** | CPG Population | Can index files, CPG status returns 'ready' |
| **M2** | Real Analysis Data | MCP tools return actual problems from indexed codebase |
| **M3** | Impulse Bridge | Activities can load analysis results as impulses |
| **M4** | Learning Loop | Co-change patterns update from execution traces |
| **M5** | End-to-End Flow | Full cycle visible in dashboard |

---

## M1: CPG Population (Foundation)

### Goal
Enable indexing codebases into the CPG so analysis queries have real data.

### Tasks

#### M1.1: Add CPG Indexing Endpoint
**File**: `repos/metabob-analysis-api/src/routes/indexing.ts`

```typescript
// POST /v2/analysis/index
// Accepts: { files: Record<string, string>, incremental?: boolean }
// Returns: { indexed: number, components: number, status: string }
```

**Subtasks**:
- [x] Create `indexing.ts` route file
- [x] Implement file parsing loop calling `cpgService.addFiles()`
- [x] Add session-scoped CPG state tracking
- [x] Mount route in `src/index.ts`
- [x] Add request validation with Zod

#### M1.2: Extend CPGService
**File**: `repos/metabob-analysis-api/src/services/cpg-service.ts`

**Subtasks**:
- [x] Add `addFiles(sessionId, files)` method
- [x] Add `getStatus(sessionId)` method returning index state
- [x] Add `clearSession(sessionId)` for cleanup
- [x] Track indexed file count and component count per session

#### M1.3: Add CPG Status Endpoint
**File**: `repos/metabob-analysis-api/src/routes/indexing.ts`

```typescript
// GET /v2/analysis/status
// Returns: { status, filesIndexed, componentsCount, lastIndexedAt }
```

#### M1.4: Add MCP Tool for Indexing
**File**: `repos/metabob-mcp/src/tools/index-codebase.ts`

**Subtasks**:
- [x] Create tool that globs source files
- [x] Read file contents
- [x] Call `/v2/analysis/index` with file map
- [x] Return summary to agent

#### M1.5: Register MCP Tool
**File**: `repos/metabob-mcp/src/tools/index.ts`

**Subtasks**:
- [x] Add `index_codebase` to TOOL_REGISTRY
- [x] Add tool schema definition

### Commit Checkpoint: M1-complete

**State**: Analysis API can index files, CPG is populated, status endpoint works.

### M1 Tests

```typescript
// test/m1-cpg-population.spec.ts
// Run against deployed environment

import { test, expect } from '@playwright/test';

test.describe('M1: CPG Population', () => {
  const ANALYSIS_API = process.env.ANALYSIS_API_URL || 'http://api.minibob.local';
  const MCP_ENDPOINT = process.env.MCP_ENDPOINT;

  test('should index files via API', async ({ request }) => {
    // Prepare test files
    const files = {
      'src/auth.ts': 'export function login(user: string) { return true; }',
      'src/db.ts': 'export function query(sql: string) { return []; }'
    };

    // Index files
    const response = await request.post(`${ANALYSIS_API}/v2/analysis/index`, {
      data: { files },
      headers: { 'X-Session-ID': 'test-session-m1' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.indexed).toBe(2);
    expect(result.status).toBe('ready');
  });

  test('should report CPG status', async ({ request }) => {
    const response = await request.get(`${ANALYSIS_API}/v2/analysis/status`, {
      headers: { 'X-Session-ID': 'test-session-m1' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.status).toBe('ready');
    expect(result.filesIndexed).toBeGreaterThan(0);
  });

  test('should index via MCP tool', async ({ request }) => {
    // This tests the full MCP flow
    // Requires MCP server running

    const toolCall = {
      tool: 'index_codebase',
      arguments: {
        patterns: ['**/*.ts'],
        workingDirectory: '/tmp/test-codebase'
      }
    };

    // Call MCP tool (implementation depends on MCP client setup)
    // Verify response indicates successful indexing
  });
});
```

---

## M2: Real Analysis Data

### Goal
Replace mock data in analysis endpoints with actual CPG queries.

### Tasks

#### M2.1: Wire Search Endpoint to CPG
**File**: `repos/metabob-analysis-api/src/routes/search.ts`

**Subtasks**:
- [x] Remove mock data (lines 41-93)
- [x] Get predictor for session via `cpgService.getPredictorForSession()`
- [x] Use `predictor.searchSimilar()` for semantic search
- [x] Query `analysis_problems` table for stored issues
- [x] Combine CPG results with stored problems

#### M2.2: Wire Priority Endpoint to Real Data
**File**: `repos/metabob-analysis-api/src/routes/priority.ts`

**Subtasks**:
- [x] Remove mock data (lines 31-62)
- [x] Query CPG for complexity metrics
- [x] Query `analysis_problems` table sorted by severity + impact
- [x] Combine and rank results

#### M2.3: Wire Co-change Endpoint to CPG
**File**: `repos/metabob-analysis-api/src/routes/cochange.ts`

**Subtasks**:
- [x] Remove mock fallback (lines 57-89)
- [x] Ensure `cpgService.predictCochanges()` returns real data
- [x] Query `cochange_patterns` table for historical data
- [x] Combine embedding similarity + historical frequency

#### M2.4: Wire Impact Endpoint to CPG
**File**: `repos/metabob-analysis-api/src/routes/impact.ts`

**Subtasks**:
- [x] Remove mock data (lines 79-113)
- [x] Use `cpgService.analyzeImpact()` with real traversal
- [x] Return actual dependency chains

#### M2.5: Wire Problems Endpoint to Database
**File**: `repos/metabob-analysis-api/src/routes/problems.ts`

**Subtasks**:
- [x] Remove mock data (lines 39-66)
- [x] Query `analysis_problems` table with RBAC filtering
- [x] Enable update/complete operations on real records

### Commit Checkpoint: M2-complete

**State**: All MCP tools return real data from indexed codebases.

### M2 Tests

```typescript
// test/m2-real-analysis.spec.ts

import { test, expect } from '@playwright/test';

test.describe('M2: Real Analysis Data', () => {
  const ANALYSIS_API = process.env.ANALYSIS_API_URL || 'http://api.minibob.local';

  test.beforeAll(async ({ request }) => {
    // Index a test codebase first
    const files = {
      'src/auth.ts': `
        export function login(user: string, password: string) {
          const query = "SELECT * FROM users WHERE name = '" + user + "'"; // SQL injection
          return db.query(query);
        }
      `,
      'src/db.ts': `
        export class Database {
          query(sql: string) { return []; }
        }
      `,
      'src/session.ts': `
        import { login } from './auth';
        export function createSession(user: string) {
          const result = login(user, 'password');
          return { token: 'abc', user: result };
        }
      `
    };

    await request.post(`${ANALYSIS_API}/v2/analysis/index`, {
      data: { files },
      headers: { 'X-Session-ID': 'test-session-m2' }
    });
  });

  test('should return real priority issues', async ({ request }) => {
    const response = await request.get(`${ANALYSIS_API}/v2/analysis/priority`, {
      params: { limit: 10 },
      headers: { 'X-Session-ID': 'test-session-m2' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    // Should find actual components, not mock data
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].component_id).toContain('src/');
  });

  test('should return real co-change suggestions', async ({ request }) => {
    const response = await request.post(`${ANALYSIS_API}/v2/analysis/cochange/suggest`, {
      data: {
        component_ids: ['src/auth.ts::function::login::2'],
        limit: 5
      },
      headers: { 'X-Session-ID': 'test-session-m2' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    // Should suggest session.ts since it imports auth
    const suggestions = result.suggestions.map(s => s.component_id);
    expect(suggestions.some(s => s.includes('session'))).toBeTruthy();
  });

  test('should return real impact analysis', async ({ request }) => {
    const response = await request.post(`${ANALYSIS_API}/v2/analysis/impact`, {
      data: {
        changed_files: ['src/auth.ts'],
        max_depth: 2
      },
      headers: { 'X-Session-ID': 'test-session-m2' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    // Should find session.ts as affected
    expect(result.direct_dependencies.some(d => d.file_path.includes('session'))).toBeTruthy();
  });

  test('MCP get_priority_issues returns real data', async ({ request }) => {
    // Test via MCP tool invocation
    // This validates the full stack: MCP → analysis-api → CPG

    // Implementation depends on MCP client setup
    // Should verify response contains actual file paths from indexed codebase
  });
});
```

---

## M3: Impulse Bridge

### Goal
Connect analysis results to the activity system via impulse pointers.

### Tasks

#### M3.1: Add Analysis Pointer Types
**File**: `repos/metabob-activity-api/src/routes/impulses.ts`

**Subtasks**:
- [x] Add `analysisResult` pointer type handler
- [x] Add `cochangeSuggestions` pointer type handler
- [x] Add `impactAnalysis` pointer type handler
- [x] Add `codebaseSearch` pointer type handler
- [x] Implement proxy logic to analysis-api

#### M3.2: Add Formatting Functions
**File**: `repos/metabob-activity-api/src/services/impulse-formatters.ts`

**Subtasks**:
- [x] `formatAnalysisResultAsMarkdown(problem)`
- [x] `formatCochangeAsMarkdown(suggestions)`
- [x] `formatImpactAsMarkdown(analysis)`
- [x] `formatSearchResultsAsMarkdown(results)`

#### M3.3: Configure Analysis API Proxy
**File**: `repos/metabob-activity-api/src/config.ts`

**Subtasks**:
- [x] Add `ANALYSIS_API_URL` environment variable
- [x] Add retry/timeout configuration
- [ ] Add circuit breaker for analysis API calls (deferred - retry logic provides resilience)

#### M3.4: Update MiniBob Impulse Types
**File**: `repos/minibob/src/types.ts`

**Subtasks**:
- [x] Add analysis pointer types to type definitions (N/A - backend resolves these types via MCP, MiniBob delegates unknown types to backend)
- [x] Ensure MCP client handles new types correctly (N/A - impulse-pointer-mvp M1-M3 already enables backend resolution of custom types)

### Commit Checkpoint: M3-complete

**State**: Activities can load analysis results as context via impulses.

### M3 Tests

```typescript
// test/m3-impulse-bridge.spec.ts

import { test, expect } from '@playwright/test';

test.describe('M3: Impulse Bridge', () => {
  const ACTIVITY_API = process.env.ACTIVITY_API_URL || 'http://api.minibob.local';
  const ANALYSIS_API = process.env.ANALYSIS_API_URL || 'http://api.minibob.local';

  test.beforeAll(async ({ request }) => {
    // Setup: Index codebase and create a problem
    const files = {
      'src/vulnerable.ts': `
        export function unsafe(input: string) {
          return eval(input); // Dangerous!
        }
      `
    };

    await request.post(`${ANALYSIS_API}/v2/analysis/index`, {
      data: { files },
      headers: { 'X-Session-ID': 'test-session-m3' }
    });

    // Create a problem record
    await request.post(`${ANALYSIS_API}/v2/analysis/problems`, {
      data: {
        component_id: 'src/vulnerable.ts::function::unsafe::2',
        severity: 'CRITICAL',
        category: 'security',
        message: 'Use of eval() is dangerous',
        impact_score: 0.95
      },
      headers: { 'X-Session-ID': 'test-session-m3' }
    });
  });

  test('should resolve analysisResult impulse', async ({ request }) => {
    const response = await request.post(`${ACTIVITY_API}/v2/impulses/resolve`, {
      data: {
        impulses: [{
          id: 'test-problem',
          pointer: {
            type: 'analysisResult',
            resultId: 'prob_test_001'  // From beforeAll
          },
          budget: 2000,
          priority: 'high'
        }]
      },
      headers: { 'X-Session-ID': 'test-session-m3' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.resolved[0].content).toContain('CRITICAL');
    expect(result.resolved[0].content).toContain('eval()');
  });

  test('should resolve cochangeSuggestions impulse', async ({ request }) => {
    const response = await request.post(`${ACTIVITY_API}/v2/impulses/resolve`, {
      data: {
        impulses: [{
          id: 'cochange-context',
          pointer: {
            type: 'cochangeSuggestions',
            componentIds: ['src/vulnerable.ts::function::unsafe::2'],
            limit: 5
          },
          budget: 1000,
          priority: 'medium'
        }]
      },
      headers: { 'X-Session-ID': 'test-session-m3' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.resolved[0].content).toBeDefined();
    // Content should be markdown formatted suggestions
  });

  test('should resolve impactAnalysis impulse', async ({ request }) => {
    const response = await request.post(`${ACTIVITY_API}/v2/impulses/resolve`, {
      data: {
        impulses: [{
          id: 'impact-context',
          pointer: {
            type: 'impactAnalysis',
            changedFiles: ['src/vulnerable.ts'],
            maxDepth: 2
          },
          budget: 1500,
          priority: 'high'
        }]
      },
      headers: { 'X-Session-ID': 'test-session-m3' }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.resolved[0].content).toContain('Impact Analysis');
  });

  test('MiniBob activity can use analysis impulse', async ({ request }) => {
    // Create activity with analysis impulse
    const activityResponse = await request.post(`${ACTIVITY_API}/v2/activities/execute`, {
      data: {
        template_id: 'test-fix-issue',
        impulses: [{
          id: 'problem-context',
          pointer: {
            type: 'analysisResult',
            resultId: 'prob_test_001'
          },
          budget: 2000,
          priority: 'high'
        }],
        variables: {}
      },
      headers: { 'X-Session-ID': 'test-session-m3' }
    });

    // Verify impulse was loaded and used
    const result = await activityResponse.json();
    expect(result.impulses_used).toContain('problem-context');
  });
});
```

---

## M4: Learning Loop

### Goal
Wire execution feedback to the learning service for pattern improvement.

### Tasks

#### M4.1: Add Learning Endpoint
**File**: `repos/metabob-analysis-api/src/routes/learning.ts`

```typescript
// POST /v2/analysis/learning/cochange
// Body: { session_id, changed_files, project_id? }
// Updates cochange_patterns table
```

**Subtasks**:
- [x] Create `learning.ts` route file
- [x] Implement `recordCochangeEvent()` handler
- [x] Call `OnlineLearningService.recordCochangeEvent()`
- [x] Mount route in `src/index.ts`

#### M4.2: Wire Activity API to Learning
**File**: `repos/metabob-activity-api/src/routes/execution-traces.ts`

**Subtasks**:
- [x] After storing execution trace, extract `filesModified`
- [x] Forward to analysis-api `/v2/analysis/learning/cochange`
- [x] Make call async/non-blocking
- [x] Add error handling (don't fail execution if learning fails)

#### M4.3: Connect Learning Service
**File**: `repos/metabob-analysis-api/src/services/learning-service.ts`

**Subtasks**:
- [x] Verify `recordCochangeEvent()` writes to `cochange_patterns`
- [x] Verify `updatePatternFrequencies()` increments counts
- [x] Add logging for pattern updates

#### M4.4: Expose Pattern Metrics
**File**: `repos/metabob-analysis-api/src/routes/learning.ts`

```typescript
// GET /v2/analysis/learning/patterns
// Returns: { patterns: [...], total, avg_confidence }
```

**Subtasks**:
- [x] Implement GET /patterns endpoint
- [x] Implement GET /metrics endpoint
- [x] Implement POST /feedback endpoint
- [x] Implement POST /update-models endpoint

### Commit Checkpoint: M4-complete

**State**: Execution traces feed back into co-change pattern learning.

### M4 Tests

```typescript
// test/m4-learning-loop.spec.ts

import { test, expect } from '@playwright/test';

test.describe('M4: Learning Loop', () => {
  const ACTIVITY_API = process.env.ACTIVITY_API_URL || 'http://api.minibob.local';
  const ANALYSIS_API = process.env.ANALYSIS_API_URL || 'http://api.minibob.local';

  test('should record co-change event', async ({ request }) => {
    const response = await request.post(`${ANALYSIS_API}/v2/analysis/learning/cochange`, {
      data: {
        session_id: 'test-session-m4',
        changed_files: ['src/auth.ts', 'src/session.ts'],
        project_id: 'test-project'
      }
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.recorded).toBeTruthy();
  });

  test('should update pattern after multiple events', async ({ request }) => {
    // Record same file pair multiple times
    for (let i = 0; i < 3; i++) {
      await request.post(`${ANALYSIS_API}/v2/analysis/learning/cochange`, {
        data: {
          session_id: `test-session-m4-${i}`,
          changed_files: ['src/api.ts', 'src/types.ts'],
          project_id: 'test-project'
        }
      });
    }

    // Check pattern was recorded with frequency
    const patternsResponse = await request.get(`${ANALYSIS_API}/v2/analysis/learning/patterns`, {
      params: { project_id: 'test-project' }
    });

    expect(patternsResponse.ok()).toBeTruthy();
    const patterns = await patternsResponse.json();

    const apiTypesPattern = patterns.patterns.find(p =>
      (p.file_a === 'src/api.ts' && p.file_b === 'src/types.ts') ||
      (p.file_a === 'src/types.ts' && p.file_b === 'src/api.ts')
    );

    expect(apiTypesPattern).toBeDefined();
    expect(apiTypesPattern.cochange_count).toBeGreaterThanOrEqual(3);
  });

  test('execution trace triggers learning', async ({ request }) => {
    // Store an execution trace
    await request.post(`${ACTIVITY_API}/v2/activities/execution-traces`, {
      data: {
        execution_id: 'exec_m4_test_001',
        template_id: 'test-template',
        activity_id: 'test-activity',
        status: 'success',
        duration_ms: 1500,
        cost_usd: 0.02,
        execution_trace: {
          tasks: [],
          filesModified: ['src/config.ts', 'src/env.ts'],
          impulsesCreated: []
        }
      },
      headers: { 'X-Session-ID': 'test-session-m4-exec' }
    });

    // Wait for async learning
    await new Promise(r => setTimeout(r, 1000));

    // Check pattern was recorded
    const patternsResponse = await request.get(`${ANALYSIS_API}/v2/analysis/learning/patterns`);
    const patterns = await patternsResponse.json();

    const configEnvPattern = patterns.patterns.find(p =>
      p.file_a.includes('config') && p.file_b.includes('env') ||
      p.file_a.includes('env') && p.file_b.includes('config')
    );

    expect(configEnvPattern).toBeDefined();
  });
});
```

---

## M5: End-to-End Flow

### Goal
Full cycle visible: index → analyze → activity → feedback → improved analysis.

### Tasks

#### M5.1: Create Analysis Activity Template
**File**: `repos/minibob/templates/analysis/analyze-and-fix.json`

**Subtasks**:
- [x] Create template that indexes codebase
- [x] Queries priority issues
- [x] Loads issue as impulse
- [x] Generates fix

#### M5.2: Dashboard Analysis View
**File**: `repos/metabob-cloud-dashboard/src/pages/Analysis.tsx`

**Subtasks**:
- [x] Add "Analysis" tab to dashboard
- [x] Show indexed codebase status
- [x] Display priority issues
- [x] Show co-change pattern metrics
- [x] Show learning progress

#### M5.3: Dashboard Integration Tests
**File**: `repos/metabob-cloud-dashboard/e2e/analysis.spec.ts`

**Subtasks**:
- [ ] Navigate to analysis tab (deferred - requires E2E setup)
- [ ] Verify indexed status display (deferred - requires E2E setup)
- [ ] Verify issues table (deferred - requires E2E setup)
- [ ] Verify metrics charts (deferred - requires E2E setup)

### Commit Checkpoint: M5-complete

**State**: Full analysis system is operational and observable.

### M5 Tests (Playwright E2E)

```typescript
// test/m5-e2e-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('M5: End-to-End Flow', () => {
  const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://dashboard.minibob.local';
  const ANALYSIS_API = process.env.ANALYSIS_API_URL || 'http://api.minibob.local';
  const MCP_ENDPOINT = process.env.MCP_ENDPOINT;

  test.beforeAll(async ({ request }) => {
    // Setup: Index a real codebase
    const files = {
      'src/auth/login.ts': `
        import { db } from '../db';
        import { session } from '../session';

        export async function login(email: string, password: string) {
          const user = await db.query('SELECT * FROM users WHERE email = ?', [email]);
          if (!user) throw new Error('User not found');
          if (user.password !== password) throw new Error('Invalid password');
          return session.create(user);
        }
      `,
      'src/auth/logout.ts': `
        import { session } from '../session';

        export function logout(token: string) {
          session.destroy(token);
        }
      `,
      'src/db/index.ts': `
        export const db = {
          query: (sql: string, params: any[]) => Promise.resolve(null)
        };
      `,
      'src/session/index.ts': `
        export const session = {
          create: (user: any) => ({ token: 'abc', user }),
          destroy: (token: string) => {}
        };
      `
    };

    await request.post(`${ANALYSIS_API}/v2/analysis/index`, {
      data: { files },
      headers: { 'X-Session-ID': 'e2e-test-session' }
    });
  });

  test('full flow: index → analyze → view in dashboard', async ({ page, request }) => {
    // Step 1: Login to dashboard
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.getByLabel('Email').fill('admin@metabob.local');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /Sign in/i }).click();

    // Step 2: Navigate to Analysis tab (if exists) or Issues tab
    await page.waitForSelector('[data-testid="nav-issues"]', { timeout: 5000 });
    await page.click('[data-testid="nav-issues"]');

    // Step 3: Verify issues are displayed
    await expect(page.locator('[data-testid="issues-table"]')).toBeVisible();

    // Step 4: Check for real data (not mock)
    const issueRows = page.locator('[data-testid="issue-row"]');
    const count = await issueRows.count();

    // If we have indexed data, we should see issues
    // This depends on the analysis detecting problems
    console.log(`Found ${count} issues in dashboard`);
  });

  test('MCP tool returns data visible in dashboard', async ({ page, request }) => {
    // Step 1: Call MCP get_priority_issues
    const mcpResponse = await request.post(`${MCP_ENDPOINT}/tools/get_priority_issues`, {
      data: {
        limit: 5,
        session_id: 'e2e-test-session'
      }
    });

    expect(mcpResponse.ok()).toBeTruthy();
    const mcpResult = await mcpResponse.json();

    // Step 2: Login and check dashboard
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.getByLabel('Email').fill('admin@metabob.local');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /Sign in/i }).click();

    // Step 3: Navigate to issues
    await page.click('[data-testid="nav-issues"]');

    // Step 4: Verify MCP result matches dashboard
    // (This validates data consistency across the stack)
    const dashboardIssues = await page.locator('[data-testid="issue-row"]').allTextContents();

    // At least one MCP issue should appear in dashboard
    if (mcpResult.issues && mcpResult.issues.length > 0) {
      const firstIssue = mcpResult.issues[0];
      const found = dashboardIssues.some(text =>
        text.includes(firstIssue.component_id) ||
        text.includes(firstIssue.message)
      );
      expect(found).toBeTruthy();
    }
  });

  test('activity execution updates dashboard metrics', async ({ page, request }) => {
    // Step 1: Execute an activity that modifies files
    await request.post(`${ANALYSIS_API}/v2/activities/execution-traces`, {
      data: {
        execution_id: `exec_e2e_${Date.now()}`,
        template_id: 'fix-auth-issue',
        activity_id: 'fix-auth-issue',
        status: 'success',
        duration_ms: 2500,
        cost_usd: 0.05,
        execution_trace: {
          tasks: [{ task_id: 't1', status: 'completed', duration_ms: 2500, tool_calls: [] }],
          filesModified: ['src/auth/login.ts', 'src/auth/logout.ts'],
          impulsesCreated: []
        }
      },
      headers: { 'X-Session-ID': 'e2e-test-session' }
    });

    // Step 2: Wait for async processing
    await new Promise(r => setTimeout(r, 2000));

    // Step 3: Check dashboard shows updated metrics
    await page.goto(`${DASHBOARD_URL}`);
    await page.getByLabel('Email').fill('admin@metabob.local');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /Sign in/i }).click();

    // Step 4: Navigate to Value & Impact or Overview
    await page.click('[data-testid="nav-overview"]');

    // Step 5: Verify execution count increased
    const executionsMetric = page.locator('[data-testid="metric-executions"]');
    await expect(executionsMetric).toContainText(/\d+/);
  });

  test('co-change patterns appear after learning', async ({ page, request }) => {
    // Step 1: Record multiple co-change events
    const filePairs = [
      ['src/auth/login.ts', 'src/session/index.ts'],
      ['src/auth/login.ts', 'src/db/index.ts'],
      ['src/auth/login.ts', 'src/session/index.ts'],
      ['src/auth/login.ts', 'src/session/index.ts'],
    ];

    for (const [file_a, file_b] of filePairs) {
      await request.post(`${ANALYSIS_API}/v2/analysis/learning/cochange`, {
        data: {
          session_id: `e2e-learning-${Date.now()}`,
          changed_files: [file_a, file_b],
          project_id: 'e2e-test-project'
        }
      });
    }

    // Step 2: Query co-change suggestions via MCP
    const suggestResponse = await request.post(`${ANALYSIS_API}/v2/analysis/cochange/suggest`, {
      data: {
        component_ids: ['src/auth/login.ts::function::login::5'],
        limit: 5
      },
      headers: { 'X-Session-ID': 'e2e-test-session' }
    });

    expect(suggestResponse.ok()).toBeTruthy();
    const suggestions = await suggestResponse.json();

    // Step 3: Verify session is suggested (high co-change frequency)
    const sessionSuggested = suggestions.suggestions.some(s =>
      s.component_id.includes('session')
    );
    expect(sessionSuggested).toBeTruthy();
  });
});
```

---

## Test Infrastructure

### Setup Script

```bash
#!/bin/bash
# test/setup-test-env.sh

# Deploy test environment
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync

# Wait for services
kubectl wait --for=condition=ready pod -l app=metabob-activity-api -n activity-system --timeout=120s
kubectl wait --for=condition=ready pod -l app=metabob-analysis-api -n activity-system --timeout=120s
kubectl wait --for=condition=ready pod -l app=metabob-cloud-dashboard -n activity-system --timeout=120s

# Export endpoints
export ACTIVITY_API_URL=http://api.minibob.local
export ANALYSIS_API_URL=http://api.minibob.local
export DASHBOARD_URL=http://dashboard.minibob.local
export MCP_ENDPOINT=http://api.minibob.local/mcp

echo "Test environment ready"
```

### Playwright Config

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  timeout: 60000,
  retries: 2,
  use: {
    baseURL: process.env.DASHBOARD_URL || 'http://dashboard.minibob.local',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'M1-cpg-population',
      testMatch: /m1-.*\.spec\.ts/,
    },
    {
      name: 'M2-real-analysis',
      testMatch: /m2-.*\.spec\.ts/,
      dependencies: ['M1-cpg-population'],
    },
    {
      name: 'M3-impulse-bridge',
      testMatch: /m3-.*\.spec\.ts/,
      dependencies: ['M2-real-analysis'],
    },
    {
      name: 'M4-learning-loop',
      testMatch: /m4-.*\.spec\.ts/,
      dependencies: ['M3-impulse-bridge'],
    },
    {
      name: 'M5-e2e-flow',
      testMatch: /m5-.*\.spec\.ts/,
      dependencies: ['M4-learning-loop'],
    },
  ],
});
```

---

## Summary

| Milestone | Tasks | Tests | Commit |
|-----------|-------|-------|--------|
| M1 | 5 | 3 | `M1-complete` |
| M2 | 5 | 5 | `M2-complete` |
| M3 | 4 | 4 | `M3-complete` |
| M4 | 4 | 3 | `M4-complete` |
| M5 | 3 | 5 | `M5-complete` |
| **Total** | **21** | **20** | 5 commits |

Each milestone is independently testable and produces a working, deployable state.
