# SurrealDB Multi-Tenant Schema - Complete Implementation Spec

**Version:** 2.0
**Date:** 2026-03-25
**Status:** Reorganized with testable milestones

---

## 1. Executive Summary

This spec defines the complete implementation of multi-tenant RBAC for the metabob system with:
- **6 commit milestones** where the application is in a working, testable state
- **Black-box tests** at each milestone using real API calls and Playwright validation
- **Clear interface boundaries** between services
- **Field-level sourcing documentation** for all database tables

---

## 2. Interface Boundaries

### 2.1 External Boundaries (User-Facing)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL BOUNDARIES                                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  metabob-cloud-dashboard    metabob-mcp              minibob             │
│  (Browser - React 19)       (IDE - MCP Protocol)     (Vessel - Bun)      │
│         │                        │                        │               │
│         │ REST + WS              │ REST                   │ REST          │
│         │                        │                        │               │
│         │                        ▼                        ▼               │
│         │              ┌─────────────────────┐  ┌───────────────────┐    │
│         │              │ metabob-analysis-api│  │metabob-activity-api│   │
│         │              │ Port: 8080          │  │Port: 8080          │   │
│         │              │ /v2/analysis/*      │  │/v2/auth/minibob/*  │   │
│         │              │ /v2/auth/login      │  │/v2/auth/apikey     │   │
│         │              │ /v2/orgs, /v2/users │  │/v2/activities/*    │   │
│         │              └─────────────────────┘  │/v2/impulses/*      │   │
│         │                                       └───────────────────┘    │
│         │                                              │                  │
│         └──────────────────────────────────────────────┘                  │
│                              │                                            │
│                              ▼                                            │
│                     ┌─────────────────┐    ┌─────────────────┐           │
│                     │   SurrealDB 3.x │    │   Redis/Valkey  │           │
│                     │   (Shared DB)   │    │   (Cache)       │           │
│                     └─────────────────┘    └─────────────────┘           │
└──────────────────────────────────────────────────────────────────────────┘
```

### ⚠️ CRITICAL ISSUE: metabob-mcp Configuration Mismatch

**Problem Identified:** metabob-mcp is configured to use a single `ANALYSIS_API_URL` pointing
to `metabob-analysis-api`, but requires endpoints from BOTH APIs:

| Endpoint Needed | Currently In | Required By metabob-mcp |
|-----------------|--------------|-------------------------|
| `/v2/auth/apikey` | metabob-activity-api | ✅ For API key auth |
| `/v2/analysis/search` | metabob-analysis-api | ✅ For search tool |
| `/v2/analysis/impact` | metabob-analysis-api | ✅ For impact tool |
| `/v2/analysis/cochange/suggest` | metabob-analysis-api | ✅ For cochange tool |
| `/v2/analysis/priority` | metabob-analysis-api | ✅ For priority tool |
| `/v2/analysis/annotations` | metabob-analysis-api | ✅ For annotations |
| `/v2/analysis/specs/generate` | metabob-analysis-api | ✅ For spec gen |
| `/v2/analysis/problems/{id}/complete` | metabob-analysis-api | ✅ For problem resolve |
| `/v2/analysis/index` | metabob-analysis-api | ✅ For indexing |

**Recommended Fix:** Add `/v2/auth/apikey` endpoint to metabob-analysis-api because:
1. Both APIs share the same SurrealDB instance
2. The `apikey_record` RECORD access is defined in shared schema
3. metabob-mcp is an analysis tool, so analysis-api is the correct home
4. Avoids needing two API URLs or an API gateway

**Task Added:** M2.0 - Fix metabob-mcp → analysis-api authentication

### 2.2 Data Flow Contracts

| Flow | Source | Target | Auth | Request | Response |
|------|--------|--------|------|---------|----------|
| API Key Exchange | metabob-mcp | **analysis-api** (needs fix) | None | `{api_key}` | `{token, org_id, user_id, scopes}` |
| MiniBob Signin | minibob | activity-api | None | `{instance_id, api_key}` | `{token, org_id, project_id}` |
| User Login | dashboard | analysis-api | None | `{email, password}` | `{token, user, expires_in}` |
| Template Query | any client | activity-api | JWT | `?scope&limit` | `{templates[], total}` |
| Execution Trace | minibob | activity-api | JWT | Full trace object | `{execution_id, metrics}` |
| Impulse Resolve | minibob | activity-api | JWT | `{pointer, budget}` | `{content, tokens_used}` |
| Code Analysis | metabob-mcp | analysis-api | JWT | Various | Analysis results |

### 2.3 Authentication Matrix

| Client | Method | Token Lifetime | Refresh | $auth Claims |
|--------|--------|----------------|---------|--------------|
| Dashboard | JWT External | 15 min | Manual refresh | org_id, user_id, role, project_ids |
| metabob-mcp | API Key → JWT | 15 min | Auto at 80% | org_id, user_id, scopes, project_ids |
| MiniBob | RECORD Access | 24 hours | No refresh | org_id, project_id, instance_id |

---

## 3. Database Field Sourcing Summary

### 3.1 Multi-Tenancy Fields

| Field | Tables | SET BY | SOURCED FROM | Lifecycle |
|-------|--------|--------|--------------|-----------|
| `org_id` | ALL (20+) | Schema VALUE clause | `$auth.org_id` | Immutable |
| `project_id` | 15+ (optional) | Request or $auth | `$auth.project_id` or request | Immutable |
| `created_by` | 10+ | Schema VALUE clause | `$auth.id` | Immutable |

### 3.2 System-Generated Fields

| Field | Origin | Lifecycle |
|-------|--------|-----------|
| `id` | Auto-increment or UUID | Immutable |
| `created_at` | `time::now()` | Immutable |
| `updated_at` | `time::now()` on UPDATE | Mutable |
| `execution_id` | UUID generation | Immutable |

### 3.3 Computed Fields (Thompson Sampling)

| Field | Computation | Updates |
|-------|-------------|---------|
| `alpha` | `successes + 1` | On execution |
| `beta` | `failures + 1` | On execution |
| `success_rate` | `successes / total_executions` | On execution |
| `avg_duration_ms` | Rolling average | On execution |
| `avg_cost_usd` | Rolling average | On execution |

---

## 4. Component Status

### 4.1 Working Components (No Changes Needed)

| Component | Status | Evidence |
|-----------|--------|----------|
| MiniBob Instance Auth | ✅ Complete | POST /v2/auth/minibob/signin |
| API Key Auth | ✅ Complete | POST /v2/auth/apikey |
| Template CRUD | ✅ Complete | All routes with RBAC |
| Execution Traces | ✅ Complete | Full state capture |
| Impulse Resolution | ✅ Complete | All pointer types |
| Thompson Sampling | ✅ Complete | Beta-Bernoulli |
| RBAC PERMISSIONS | ✅ Complete | All 20+ tables |
| Schema Migrations | ✅ Complete | Helm hooks |

### 4.2 Partial Components (Need Completion)

| Component | Status | Gap |
|-----------|--------|-----|
| Dashboard Auth | ⚠️ Partial | OAuth2 flow not integrated |
| API Key project_ids | ⚠️ Fixed | Task 12.1.1 applied |
| MiniBob project_id | ⚠️ Fixed | Task 12.1.3 applied |
| K8s Vessel Status | ⚠️ Stub | Falls back to DB heartbeat |

### 4.3 Missing Components (Need Implementation)

| Component | Priority | Milestone |
|-----------|----------|-----------|
| Integration Tests | HIGH | M1 |
| E2E Auth Flow Tests | HIGH | M2 |
| Cross-Org Isolation Tests | HIGH | M3 |
| Dashboard Login Flow | MEDIUM | M4 |
| Production Deployment | LOW | M6 |

---

## 5. Pattern Consolidation Opportunities

### 5.1 High Priority (Do First)

| Pattern | Current State | Target |
|---------|---------------|--------|
| JWT Auth Middleware | 2 implementations | `@metabob/proto/shared/middleware/jwt-auth.ts` |
| Error Responses | Inconsistent formats | `@metabob/proto/shared/errors/error-factory.ts` |
| Logger | 2 implementations | `@metabob/proto/shared/logging/logger.ts` |

### 5.2 Medium Priority (Do in M4)

| Pattern | Current State | Target |
|---------|---------------|--------|
| Pagination | Inline parsing | `@metabob/proto/shared/query/pagination.ts` |
| org_id Extraction | Scattered | `@metabob/proto/shared/multi-tenancy/org-context.ts` |
| Rate Limiting | 2 implementations | `@metabob/proto/shared/middleware/rate-limiter.ts` |

---

## 6. Milestone-Based Task List

### Milestone 1: Foundation Validation (Commit: `feat(rbac): validate existing RBAC infrastructure`)

**Goal:** Verify all existing RBAC components work correctly with automated tests.

**Pre-conditions:**
- Local Kubernetes cluster running
- SurrealDB deployed with schemas
- metabob-activity-api deployed
- Default org and MiniBob instance created

#### Tasks

```
M1.1 Create test infrastructure
├── M1.1.1 Create tests/e2e/ directory structure
├── M1.1.2 Set up Playwright MCP connection for dashboard tests
├── M1.1.3 Create test fixture: organizations, users, projects, api_keys, minibob_instance
└── M1.1.4 Create test helpers: API client, auth helpers, assertion utilities

M1.2 Validate MiniBob authentication
├── M1.2.1 Test: MiniBob signin returns JWT with org_id
├── M1.2.2 Test: MiniBob signin returns JWT with project_id
├── M1.2.3 Test: MiniBob signin fails for inactive instance
├── M1.2.4 Test: MiniBob JWT enables template queries
└── M1.2.5 Test: MiniBob cannot access other org's templates

M1.3 Validate API key authentication
├── M1.3.1 Test: API key exchange returns JWT with org_id
├── M1.3.2 Test: API key exchange returns JWT with project_ids array
├── M1.3.3 Test: Expired API key returns 401
├── M1.3.4 Test: Revoked API key returns 401
└── M1.3.5 Test: API key JWT enables scoped queries

M1.4 Validate database PERMISSIONS
├── M1.4.1 Test: User A cannot see Org B's templates
├── M1.4.2 Test: User A cannot see Org B's execution traces
├── M1.4.3 Test: Global templates visible to all orgs
├── M1.4.4 Test: Project-scoped templates filtered by project_ids
└── M1.4.5 Test: org_id auto-populated on INSERT
```

#### Test Script: `tests/e2e/m1-foundation.test.ts`

```typescript
// Black-box tests - call real APIs, validate via dashboard
import { test, expect } from '@playwright/test';
import { APIClient } from './helpers/api-client';

test.describe('M1: Foundation Validation', () => {

  test.describe('MiniBob Authentication', () => {
    test('signin returns JWT with org_id and project_id', async () => {
      const response = await fetch('http://api.minibob.local/v2/auth/minibob/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: 'minibob-local-001',
          api_key: 'test-api-key-123'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.token).toBeTruthy();
      expect(data.org_id).toBe('metabob_internal');
      expect(data.project_id).toBeDefined();
    });

    test('inactive instance cannot authenticate', async () => {
      // First deactivate instance via direct SurrealDB
      // Then attempt signin
      const response = await fetch('http://api.minibob.local/v2/auth/minibob/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: 'minibob-inactive-001',
          api_key: 'test-api-key'
        })
      });

      expect(response.status).toBe(401);
    });
  });

  test.describe('API Key Authentication', () => {
    test('exchange returns JWT with project_ids', async () => {
      const response = await fetch('http://api.minibob.local/v2/auth/apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: 'mk_test_user_key_123' })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.token).toBeTruthy();
      expect(data.org_id).toBeTruthy();
      expect(data.project_ids).toBeInstanceOf(Array);
    });
  });

  test.describe('Cross-Org Isolation', () => {
    test('org A cannot see org B templates', async () => {
      // Auth as org A
      const orgAToken = await authenticateAsOrg('org_a');

      // Create template in org B
      const orgBToken = await authenticateAsOrg('org_b');
      await createTemplate(orgBToken, { name: 'org-b-template', scope: 'org' });

      // Query templates as org A
      const templates = await getTemplates(orgAToken);

      // Verify org B template not visible
      expect(templates.find(t => t.name === 'org-b-template')).toBeUndefined();
    });
  });
});
```

#### Dashboard Validation: `tests/e2e/m1-dashboard.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('M1: Dashboard Auth Display', () => {
  test('dashboard shows current org after login', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('http://dashboard.minibob.local');

    // Login
    await page.fill('[data-testid="email"]', 'admin@metabob.local');
    await page.fill('[data-testid="password"]', 'test-password');
    await page.click('[data-testid="login-button"]');

    // Verify org displayed
    await expect(page.locator('[data-testid="current-org"]')).toContainText('Metabob Internal');
  });

  test('templates list shows only org templates', async ({ page }) => {
    await loginAsDashboard(page, 'admin@metabob.local');
    await page.goto('http://dashboard.minibob.local/templates');

    // Verify no cross-org templates visible
    const templates = await page.locator('[data-testid="template-row"]').all();
    for (const template of templates) {
      const orgId = await template.getAttribute('data-org-id');
      expect(orgId).toBe('metabob_internal');
    }
  });
});
```

**Commit Message:**
```
feat(rbac): validate existing RBAC infrastructure

- Add E2E test infrastructure with Playwright
- Validate MiniBob instance authentication flow
- Validate API key → JWT exchange with project_ids
- Validate cross-org isolation via PERMISSIONS
- All 15 foundation tests passing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

### Milestone 2: Data Flow Validation (Commit: `feat(rbac): validate end-to-end data flows`)

**Goal:** Verify data flows correctly through all service boundaries with proper auth.

**Pre-conditions:** M1 complete and passing

#### Tasks

```
M2.1 Validate metabob-mcp → activity-api flow
├── M2.1.1 Test: MCP authenticates with API key on startup
├── M2.1.2 Test: MCP queries templates with JWT
├── M2.1.3 Test: MCP token auto-refreshes at 80% lifetime
├── M2.1.4 Test: MCP handles auth failure gracefully
└── M2.1.5 Test: MCP scoped to user's projects only

M2.2 Validate MiniBob → activity-api flow
├── M2.2.1 Test: MiniBob fetches boredom task
├── M2.2.2 Test: MiniBob resolves impulse via API
├── M2.2.3 Test: MiniBob stores execution trace with org_id
├── M2.2.4 Test: MiniBob trace has correct project_id (not hardcoded)
└── M2.2.5 Test: MiniBob composition recorded correctly

M2.3 Validate dashboard → APIs flow
├── M2.3.1 Test: Dashboard login creates valid session
├── M2.3.2 Test: Dashboard fetches templates via activity-api
├── M2.3.3 Test: Dashboard fetches projects via analysis-api
├── M2.3.4 Test: WebSocket receives real-time updates
└── M2.3.5 Test: Dashboard logout invalidates session
```

#### Test Script: `tests/e2e/m2-data-flows.test.ts`

```typescript
import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';

test.describe('M2: Data Flow Validation', () => {

  test.describe('metabob-mcp Flow', () => {
    test('MCP authenticates and queries templates', async () => {
      // Start MCP with API key
      const mcp = spawn('bun', ['run', 'start'], {
        cwd: 'repos/metabob-mcp',
        env: {
          ...process.env,
          METABOB_API_KEY: 'mk_test_user_key_123',
          ANALYSIS_API_URL: 'http://api.minibob.local'
        }
      });

      // Wait for auth
      await waitForLog(mcp, 'Authenticated successfully');

      // Call MCP tool to get templates
      const result = await callMCPTool(mcp, 'get_templates', { limit: 10 });

      expect(result.templates).toBeDefined();
      expect(result.templates.length).toBeGreaterThan(0);

      mcp.kill();
    });

    test('MCP token auto-refreshes', async () => {
      const mcp = spawn('bun', ['run', 'start'], {
        env: {
          METABOB_API_KEY: 'mk_test_user_key_123',
          ANALYSIS_API_URL: 'http://api.minibob.local'
        }
      });

      // Wait for initial auth
      await waitForLog(mcp, 'Authenticated successfully');

      // Wait for refresh (12 minutes simulated)
      // In test, we can mock time or use short-lived tokens
      await waitForLog(mcp, 'Token refreshed', { timeout: 15000 });

      mcp.kill();
    });
  });

  test.describe('MiniBob Flow', () => {
    test('MiniBob execution trace has correct project_id', async () => {
      // Authenticate MiniBob
      const authResponse = await fetch('http://api.minibob.local/v2/auth/minibob/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: 'minibob-local-001',
          api_key: 'test-api-key-123'
        })
      });
      const { token, project_id: expectedProjectId } = await authResponse.json();

      // Create execution trace
      const traceResponse = await fetch('http://api.minibob.local/v2/activities/execution-traces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          variant_id: 'test-variant-001',
          success: true,
          duration_ms: 1500,
          cost: 0.05,
          tokens: { input: 100, output: 50, cache: 0 }
        })
      });

      expect(traceResponse.status).toBe(200);
      const { execution_id } = await traceResponse.json();

      // Fetch trace and verify project_id
      const getResponse = await fetch(
        `http://api.minibob.local/v2/activities/execution-traces/${execution_id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const trace = await getResponse.json();

      expect(trace.project_id).toBe(expectedProjectId);
      expect(trace.project_id).not.toBe('minibob-default'); // No hardcoded value
    });
  });
});
```

#### Dashboard Validation: `tests/e2e/m2-dashboard-flows.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('M2: Dashboard Data Flows', () => {
  test('execution trace appears in dashboard after MiniBob execution', async ({ page }) => {
    // Login to dashboard
    await loginAsDashboard(page, 'admin@metabob.local');

    // Navigate to executions
    await page.goto('http://dashboard.minibob.local/executions');

    // Get initial count
    const initialCount = await page.locator('[data-testid="execution-row"]').count();

    // Trigger MiniBob execution (via API)
    await triggerMiniBobExecution();

    // Wait for WebSocket update
    await page.waitForSelector('[data-testid="execution-row"]:nth-child(' + (initialCount + 1) + ')');

    // Verify new execution visible
    const newCount = await page.locator('[data-testid="execution-row"]').count();
    expect(newCount).toBe(initialCount + 1);
  });

  test('template metrics update after execution', async ({ page }) => {
    await loginAsDashboard(page, 'admin@metabob.local');
    await page.goto('http://dashboard.minibob.local/templates');

    // Get initial metrics for a template
    const templateRow = page.locator('[data-testid="template-row"]').first();
    const initialExecutions = await templateRow.locator('[data-testid="executions"]').textContent();

    // Execute template
    await executeTemplateViaAPI('test-template-001');

    // Wait for metrics update
    await page.waitForTimeout(2000); // WebSocket propagation
    await page.reload();

    // Verify metrics increased
    const newExecutions = await templateRow.locator('[data-testid="executions"]').textContent();
    expect(parseInt(newExecutions)).toBe(parseInt(initialExecutions) + 1);
  });
});
```

**Commit Message:**
```
feat(rbac): validate end-to-end data flows

- Validate metabob-mcp → activity-api authentication flow
- Validate MiniBob execution trace with correct project_id
- Validate dashboard real-time updates via WebSocket
- Validate token auto-refresh mechanism
- All 15 data flow tests passing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

### Milestone 3: Cross-Tenant Isolation (Commit: `feat(rbac): validate multi-tenant isolation`)

**Goal:** Comprehensive validation that tenants cannot access each other's data.

**Pre-conditions:** M2 complete and passing

#### Tasks

```
M3.1 Create multi-org test fixtures
├── M3.1.1 Create organization: org_alpha with users, projects, templates
├── M3.1.2 Create organization: org_beta with users, projects, templates
├── M3.1.3 Create organization: org_gamma with users, projects, templates
├── M3.1.4 Create MiniBob instances for each org
└── M3.1.5 Create API keys for users in each org

M3.2 Test data isolation
├── M3.2.1 Test: org_alpha user cannot query org_beta templates
├── M3.2.2 Test: org_alpha user cannot query org_beta execution traces
├── M3.2.3 Test: org_alpha user cannot query org_beta impulses
├── M3.2.4 Test: org_alpha MiniBob cannot access org_beta data
├── M3.2.5 Test: org_alpha user cannot create data in org_beta

M3.3 Test project isolation within org
├── M3.3.1 Test: User without project access cannot see project templates
├── M3.3.2 Test: User with project access sees project templates
├── M3.3.3 Test: Adding user to project grants access
├── M3.3.4 Test: Removing user from project revokes access
└── M3.3.5 Test: MiniBob scoped to single project cannot access others

M3.4 Test global/public visibility
├── M3.4.1 Test: Global public templates visible to all orgs
├── M3.4.2 Test: Global non-public templates not visible
├── M3.4.3 Test: Org-scoped templates not visible to other orgs
└── M3.4.4 Test: Creating global template requires admin role
```

#### Test Script: `tests/e2e/m3-isolation.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('M3: Multi-Tenant Isolation', () => {

  // Test fixtures created before suite
  let orgAlphaToken: string;
  let orgBetaToken: string;
  let orgAlphaMiniBobToken: string;

  test.beforeAll(async () => {
    orgAlphaToken = await authenticateUser('admin@alpha.com');
    orgBetaToken = await authenticateUser('admin@beta.com');
    orgAlphaMiniBobToken = await authenticateMiniBob('mb-alpha-001');
  });

  test.describe('Cross-Org Data Isolation', () => {
    test('org_alpha cannot query org_beta templates', async () => {
      // Create template in org_beta
      await createTemplate(orgBetaToken, {
        name: 'beta-secret-template',
        scope: 'org'
      });

      // Query as org_alpha
      const templates = await getTemplates(orgAlphaToken);

      // Verify beta template not visible
      const found = templates.find(t => t.name === 'beta-secret-template');
      expect(found).toBeUndefined();
    });

    test('org_alpha cannot query org_beta execution traces', async () => {
      // Create trace in org_beta
      const { execution_id } = await createExecutionTrace(orgBetaToken, {
        variant_id: 'beta-variant',
        success: true,
        duration_ms: 1000,
        cost: 0.01,
        tokens: { input: 50, output: 25, cache: 0 }
      });

      // Try to fetch as org_alpha
      const response = await fetch(
        `http://api.minibob.local/v2/activities/execution-traces/${execution_id}`,
        { headers: { 'Authorization': `Bearer ${orgAlphaToken}` } }
      );

      // Should get 404 or empty (PERMISSIONS filter)
      expect(response.status).toBe(404);
    });

    test('org_alpha MiniBob cannot access org_beta data', async () => {
      // Create impulse in org_beta
      await createImpulse(orgBetaToken, {
        impulse_id: 'beta-impulse-001',
        impulse_data: { content: 'secret beta data' }
      });

      // Try to resolve as org_alpha MiniBob
      const response = await fetch('http://api.minibob.local/v2/impulses/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orgAlphaMiniBobToken}`
        },
        body: JSON.stringify({
          impulse_id: 'beta-impulse-001',
          pointer: { type: 'memo' },
          budget: 1000
        })
      });

      // Should fail or return empty
      expect(response.status).toBe(404);
    });
  });

  test.describe('Project Isolation Within Org', () => {
    test('user without project access cannot see project templates', async () => {
      // Create user in org_alpha without project access
      const limitedUserToken = await authenticateUser('limited@alpha.com');

      // Create project-scoped template
      await createTemplate(orgAlphaToken, {
        name: 'project-secret-template',
        scope: 'project',
        project_id: 'project:alpha-backend'
      });

      // Query as limited user
      const templates = await getTemplates(limitedUserToken);

      // Verify project template not visible
      const found = templates.find(t => t.name === 'project-secret-template');
      expect(found).toBeUndefined();
    });

    test('adding user to project grants access', async () => {
      const limitedUserToken = await authenticateUser('limited@alpha.com');

      // Initially no access
      let templates = await getTemplates(limitedUserToken);
      expect(templates.find(t => t.name === 'project-secret-template')).toBeUndefined();

      // Add user to project
      await addUserToProject(orgAlphaToken, 'limited@alpha.com', 'project:alpha-backend');

      // Re-authenticate to get new project_ids
      const newToken = await authenticateUser('limited@alpha.com');

      // Now has access
      templates = await getTemplates(newToken);
      expect(templates.find(t => t.name === 'project-secret-template')).toBeDefined();
    });
  });

  test.describe('Global/Public Visibility', () => {
    test('global public templates visible to all orgs', async () => {
      // Create global template (requires metabob_internal admin)
      const metabobAdminToken = await authenticateUser('admin@metabob.local');
      await createTemplate(metabobAdminToken, {
        name: 'global-public-template',
        scope: 'global',
        public: true
      });

      // Query from org_alpha
      const alphaTemplates = await getTemplates(orgAlphaToken, { scope: 'global' });
      expect(alphaTemplates.find(t => t.name === 'global-public-template')).toBeDefined();

      // Query from org_beta
      const betaTemplates = await getTemplates(orgBetaToken, { scope: 'global' });
      expect(betaTemplates.find(t => t.name === 'global-public-template')).toBeDefined();
    });
  });
});
```

#### Dashboard Validation: `tests/e2e/m3-dashboard-isolation.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('M3: Dashboard Isolation', () => {
  test('dashboard shows only current org data', async ({ page }) => {
    // Login as org_alpha admin
    await page.goto('http://dashboard.minibob.local');
    await page.fill('[data-testid="email"]', 'admin@alpha.com');
    await page.fill('[data-testid="password"]', 'test-password');
    await page.click('[data-testid="login-button"]');

    // Navigate to templates
    await page.click('[data-testid="nav-templates"]');

    // Verify only alpha templates visible
    const templates = await page.locator('[data-testid="template-row"]').all();
    for (const template of templates) {
      const orgId = await template.getAttribute('data-org-id');
      // Either alpha org or global public
      expect(['org_alpha', 'metabob_internal']).toContain(orgId);
    }

    // Verify beta templates NOT visible
    const betaTemplate = page.locator('[data-testid="template-row"][data-org-id="org_beta"]');
    await expect(betaTemplate).toHaveCount(0);
  });

  test('org switcher not available (single-org users)', async ({ page }) => {
    await loginAsDashboard(page, 'admin@alpha.com');

    // Org switcher should not be visible for single-org users
    const orgSwitcher = page.locator('[data-testid="org-switcher"]');
    await expect(orgSwitcher).toHaveCount(0);
  });
});
```

**Commit Message:**
```
feat(rbac): validate multi-tenant isolation

- Create multi-org test fixtures (alpha, beta, gamma)
- Validate cross-org data isolation (templates, traces, impulses)
- Validate project isolation within organization
- Validate global/public template visibility
- All 20 isolation tests passing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

### Milestone 4: Pattern Consolidation (Commit: `refactor(shared): consolidate common patterns`)

**Goal:** Extract duplicated code into shared library for maintainability.

**Pre-conditions:** M3 complete and passing

#### Tasks

```
M4.1 Create shared library structure
├── M4.1.1 Create repos/metabob-proto/src/shared/ directory
├── M4.1.2 Set up TypeScript config for shared exports
├── M4.1.3 Add shared package exports to package.json
└── M4.1.4 Create barrel exports (index.ts files)

M4.2 Extract error handling
├── M4.2.1 Create shared/errors/error-types.ts (AppError, ErrorCode)
├── M4.2.2 Create shared/errors/error-factory.ts (createError, formatError)
├── M4.2.3 Create shared/errors/error-middleware.ts (Hono middleware)
├── M4.2.4 Migrate activity-api to use shared errors
└── M4.2.5 Migrate analysis-api to use shared errors

M4.3 Extract JWT auth
├── M4.3.1 Create shared/auth/jwt-utils.ts (extract, verify, parse)
├── M4.3.2 Create shared/auth/types.ts (JWTClaims, AuthContext)
├── M4.3.3 Create shared/auth/middleware.ts (Hono JWT middleware)
├── M4.3.4 Migrate activity-api jwtAuth.ts to use shared
└── M4.3.5 Migrate analysis-api auth.ts to use shared

M4.4 Extract logging
├── M4.4.1 Create shared/logging/logger.ts (unified Logger class)
├── M4.4.2 Create shared/logging/middleware.ts (request logging)
├── M4.4.3 Migrate activity-api logger to use shared
└── M4.4.4 Migrate analysis-api logger to use shared

M4.5 Extract pagination
├── M4.5.1 Create shared/query/pagination.ts (parse, validate)
├── M4.5.2 Create shared/query/types.ts (PaginationParams)
├── M4.5.3 Migrate activity-api impulses.ts to use shared
└── M4.5.4 Migrate analysis-api routes to use shared
```

#### Tests: Verify no behavioral changes

```typescript
// tests/e2e/m4-no-regression.test.ts
import { test, expect } from '@playwright/test';

test.describe('M4: Pattern Consolidation - No Regression', () => {
  // Re-run all M1-M3 tests to verify no behavioral changes

  test('M1 tests still pass', async () => {
    // Import and run M1 test suite
    const m1Results = await runTestSuite('m1-foundation.test.ts');
    expect(m1Results.failed).toBe(0);
  });

  test('M2 tests still pass', async () => {
    const m2Results = await runTestSuite('m2-data-flows.test.ts');
    expect(m2Results.failed).toBe(0);
  });

  test('M3 tests still pass', async () => {
    const m3Results = await runTestSuite('m3-isolation.test.ts');
    expect(m3Results.failed).toBe(0);
  });

  test('error responses have consistent format', async () => {
    // Test invalid auth
    const authResponse = await fetch('http://api.minibob.local/v2/auth/apikey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: 'invalid' })
    });

    const authError = await authResponse.json();
    expect(authError).toHaveProperty('error');
    expect(authError.error).toHaveProperty('code');
    expect(authError.error).toHaveProperty('message');

    // Test missing auth
    const protectedResponse = await fetch('http://api.minibob.local/v2/activities/templates');
    const protectedError = await protectedResponse.json();
    expect(protectedError).toHaveProperty('error');
    expect(protectedError.error).toHaveProperty('code');
  });
});
```

**Commit Message:**
```
refactor(shared): consolidate common patterns

- Create @metabob/proto/shared library structure
- Extract unified error handling with consistent format
- Extract JWT auth middleware with shared types
- Extract unified logger with middleware
- Extract pagination helpers
- No behavioral changes (all M1-M3 tests pass)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

### Milestone 5: Dashboard Integration (Commit: `feat(dashboard): complete OAuth2 auth flow`)

**Goal:** Complete dashboard authentication with full login/logout flow.

**Pre-conditions:** M4 complete and passing

#### Tasks

```
M5.1 Implement login flow
├── M5.1.1 Create login page with email/password form
├── M5.1.2 Implement POST /v2/auth/login in analysis-api
├── M5.1.3 Store JWT in secure httpOnly cookie
├── M5.1.4 Implement auth context provider
└── M5.1.5 Add protected route wrapper

M5.2 Implement logout flow
├── M5.2.1 Create logout button in header
├── M5.2.2 Implement POST /v2/auth/logout (invalidate session)
├── M5.2.3 Clear cookies and local state
└── M5.2.4 Redirect to login page

M5.3 Implement token refresh
├── M5.3.1 Detect token expiry (check exp claim)
├── M5.3.2 Implement POST /v2/auth/refresh endpoint
├── M5.3.3 Auto-refresh before expiry (2 min before)
├── M5.3.4 Handle refresh failure (redirect to login)
└── M5.3.5 Queue requests during refresh

M5.4 Add user profile
├── M5.4.1 Create profile page showing user info
├── M5.4.2 Display current org and projects
├── M5.4.3 Show API key management
└── M5.4.4 Add password change form
```

#### Dashboard Tests: `tests/e2e/m5-dashboard-auth.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('M5: Dashboard Auth Flow', () => {

  test.describe('Login Flow', () => {
    test('successful login redirects to overview', async ({ page }) => {
      await page.goto('http://dashboard.minibob.local/login');

      await page.fill('[data-testid="email"]', 'admin@metabob.local');
      await page.fill('[data-testid="password"]', 'test-password');
      await page.click('[data-testid="login-button"]');

      // Should redirect to overview
      await expect(page).toHaveURL(/.*\/overview/);

      // Should show user info
      await expect(page.locator('[data-testid="user-menu"]')).toContainText('admin@metabob.local');
    });

    test('invalid credentials shows error', async ({ page }) => {
      await page.goto('http://dashboard.minibob.local/login');

      await page.fill('[data-testid="email"]', 'admin@metabob.local');
      await page.fill('[data-testid="password"]', 'wrong-password');
      await page.click('[data-testid="login-button"]');

      // Should show error
      await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-error"]')).toContainText('Invalid credentials');

      // Should stay on login page
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('protected routes redirect to login', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies();

      // Try to access protected route
      await page.goto('http://dashboard.minibob.local/templates');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
    });
  });

  test.describe('Logout Flow', () => {
    test('logout clears session and redirects', async ({ page }) => {
      // Login first
      await loginAsDashboard(page, 'admin@metabob.local');

      // Click logout
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);

      // Try to access protected route
      await page.goto('http://dashboard.minibob.local/templates');

      // Should redirect to login (session cleared)
      await expect(page).toHaveURL(/.*\/login/);
    });
  });

  test.describe('Token Refresh', () => {
    test('session persists across page reload', async ({ page }) => {
      await loginAsDashboard(page, 'admin@metabob.local');

      // Navigate to templates
      await page.goto('http://dashboard.minibob.local/templates');
      await expect(page.locator('[data-testid="template-list"]')).toBeVisible();

      // Reload page
      await page.reload();

      // Should still be authenticated
      await expect(page.locator('[data-testid="template-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-menu"]')).toContainText('admin@metabob.local');
    });
  });

  test.describe('User Profile', () => {
    test('profile shows org and projects', async ({ page }) => {
      await loginAsDashboard(page, 'admin@metabob.local');

      // Navigate to profile
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="profile-link"]');

      // Should show org
      await expect(page.locator('[data-testid="current-org"]')).toContainText('Metabob Internal');

      // Should show projects
      await expect(page.locator('[data-testid="project-list"]')).toBeVisible();
    });
  });
});
```

**Commit Message:**
```
feat(dashboard): complete OAuth2 auth flow

- Implement login page with email/password
- Implement secure session storage (httpOnly cookies)
- Implement logout with session invalidation
- Implement token auto-refresh before expiry
- Add user profile with org/project display
- All 10 dashboard auth tests passing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

### Milestone 6: Production Readiness (Commit: `feat(deploy): production deployment validation`)

**Goal:** Validate system is ready for production deployment.

**Pre-conditions:** M5 complete and passing

#### Tasks

```
M6.1 Security validation
├── M6.1.1 Test: Expired JWT returns 401
├── M6.1.2 Test: Malformed JWT returns 401 (no stack trace)
├── M6.1.3 Test: Rate limiting prevents brute force
├── M6.1.4 Test: SQL injection attempts blocked
├── M6.1.5 Test: XSS attempts sanitized

M6.2 Performance validation
├── M6.2.1 Test: Template query < 100ms with 1000 templates
├── M6.2.2 Test: Execution trace insert < 50ms
├── M6.2.3 Test: 100 concurrent requests handled
├── M6.2.4 Test: WebSocket handles 50 concurrent connections
└── M6.2.5 Test: Redis cache improves template query by 10x

M6.3 Reliability validation
├── M6.3.1 Test: Service recovers from Redis failure
├── M6.3.2 Test: Service recovers from SurrealDB restart
├── M6.3.3 Test: Circuit breaker triggers on analysis-api failure
├── M6.3.4 Test: Graceful degradation when analysis-api unavailable
└── M6.3.5 Test: Health endpoint reflects dependency status

M6.4 Deployment validation
├── M6.4.1 Test: Helm upgrade preserves data
├── M6.4.2 Test: Schema migration idempotent
├── M6.4.3 Test: Zero-downtime rolling update
├── M6.4.4 Test: Rollback restores previous version
└── M6.4.5 Document production deployment runbook
```

#### Production Tests: `tests/e2e/m6-production.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('M6: Production Readiness', () => {

  test.describe('Security', () => {
    test('expired JWT returns 401', async () => {
      // Create expired token
      const expiredToken = createExpiredJWT({ org_id: 'test' });

      const response = await fetch('http://api.minibob.local/v2/activities/templates', {
        headers: { 'Authorization': `Bearer ${expiredToken}` }
      });

      expect(response.status).toBe(401);
      const error = await response.json();
      expect(error.error.code).toBe('TOKEN_EXPIRED');
    });

    test('malformed JWT returns 401 without stack trace', async () => {
      const response = await fetch('http://api.minibob.local/v2/activities/templates', {
        headers: { 'Authorization': 'Bearer not-a-valid-jwt' }
      });

      expect(response.status).toBe(401);
      const body = await response.text();
      expect(body).not.toContain('Error:');
      expect(body).not.toContain('at ');
      expect(body).not.toContain('.ts:');
    });

    test('rate limiting prevents brute force', async () => {
      const requests = Array(15).fill(null).map(() =>
        fetch('http://api.minibob.local/v2/auth/minibob/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instance_id: 'test', api_key: 'wrong' })
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.status === 429);

      // Should hit rate limit (5 req/min for signin)
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  test.describe('Performance', () => {
    test('template query under 100ms', async () => {
      const token = await authenticateUser('admin@metabob.local');

      const start = Date.now();
      const response = await fetch('http://api.minibob.local/v2/activities/templates?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100);
    });

    test('handles 100 concurrent requests', async () => {
      const token = await authenticateUser('admin@metabob.local');

      const requests = Array(100).fill(null).map(() =>
        fetch('http://api.minibob.local/v2/activities/templates?limit=10', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );

      const responses = await Promise.all(requests);
      const successful = responses.filter(r => r.status === 200);

      expect(successful.length).toBe(100);
    });
  });

  test.describe('Reliability', () => {
    test('health endpoint reflects dependency status', async () => {
      const response = await fetch('http://api.minibob.local/health');
      const health = await response.json();

      expect(health.status).toBe('healthy');
      expect(health.checks.redis.status).toBe('healthy');
      expect(health.checks.surrealdb.status).toBe('healthy');
    });
  });
});
```

#### Dashboard Production Tests: `tests/e2e/m6-dashboard-production.test.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('M6: Dashboard Production', () => {
  test('dashboard loads within 2 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('http://dashboard.minibob.local');
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(2000);
  });

  test('dashboard handles API errors gracefully', async ({ page }) => {
    await loginAsDashboard(page, 'admin@metabob.local');

    // Simulate API error (intercept)
    await page.route('**/v2/activities/templates', route => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto('http://dashboard.minibob.local/templates');

    // Should show error message, not crash
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Unable to load templates');
  });
});
```

**Commit Message:**
```
feat(deploy): production deployment validation

- Add security tests (JWT expiry, rate limiting, injection)
- Add performance tests (< 100ms queries, 100 concurrent requests)
- Add reliability tests (dependency health, graceful degradation)
- Add deployment tests (idempotent migration, zero-downtime)
- Document production deployment runbook
- All 25 production readiness tests passing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## 7. Test Infrastructure

### 7.1 Directory Structure

```
tests/
├── e2e/
│   ├── helpers/
│   │   ├── api-client.ts        # HTTP client wrapper
│   │   ├── auth-helpers.ts      # Authentication utilities
│   │   ├── fixtures.ts          # Test data setup
│   │   └── assertions.ts        # Custom assertions
│   ├── m1-foundation.test.ts
│   ├── m1-dashboard.test.ts
│   ├── m2-data-flows.test.ts
│   ├── m2-dashboard-flows.test.ts
│   ├── m3-isolation.test.ts
│   ├── m3-dashboard-isolation.test.ts
│   ├── m4-no-regression.test.ts
│   ├── m5-dashboard-auth.test.ts
│   └── m6-production.test.ts
├── fixtures/
│   ├── organizations.json
│   ├── users.json
│   ├── projects.json
│   ├── api-keys.json
│   ├── minibob-instances.json
│   └── templates.json
└── playwright.config.ts
```

### 7.2 Playwright Configuration

```typescript
// tests/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false, // Run sequentially for data consistency
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: 'http://dashboard.minibob.local',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'echo "Using deployed services"',
    url: 'http://api.minibob.local/health',
    reuseExistingServer: true,
  },
});
```

### 7.3 Test Fixture Setup

```typescript
// tests/e2e/helpers/fixtures.ts
import { Surreal } from 'surrealdb.js';

export async function setupTestFixtures() {
  const db = new Surreal();
  await db.connect('http://surrealdb.activity-system.svc.cluster.local:8000/rpc');
  await db.signin({ user: 'root', pass: process.env.SURREALDB_PASSWORD });
  await db.use({ ns: 'activity-system', db: 'learning_loop' });

  // Create organizations
  await db.query(`
    CREATE organizations:org_alpha SET
      name = 'Alpha Corp',
      seat_limit = 10,
      created_at = time::now()
  `);

  await db.query(`
    CREATE organizations:org_beta SET
      name = 'Beta Inc',
      seat_limit = 10,
      created_at = time::now()
  `);

  // Create users
  await db.query(`
    CREATE users:admin_alpha SET
      org_id = organizations:org_alpha,
      email = 'admin@alpha.com',
      name = 'Alpha Admin',
      password_hash = crypto::argon2::generate('test-password'),
      role = 'admin',
      created_at = time::now()
  `);

  // Create MiniBob instances
  await db.query(`
    CREATE minibob_instance:mb_alpha SET
      instance_id = 'mb-alpha-001',
      org_id = organizations:org_alpha,
      api_key_hash = crypto::argon2::generate('alpha-api-key'),
      is_active = true,
      created_at = time::now()
  `);

  // Create API keys
  await db.query(`
    CREATE api_keys:key_alpha SET
      org_id = organizations:org_alpha,
      user_id = users:admin_alpha,
      key_hash = crypto::argon2::generate('mk_test_alpha_key'),
      scopes = ['read', 'write'],
      is_active = true,
      created_at = time::now()
  `);

  await db.close();
}

export async function teardownTestFixtures() {
  const db = new Surreal();
  await db.connect('http://surrealdb.activity-system.svc.cluster.local:8000/rpc');
  await db.signin({ user: 'root', pass: process.env.SURREALDB_PASSWORD });
  await db.use({ ns: 'activity-system', db: 'learning_loop' });

  // Clean up test data
  await db.query(`DELETE organizations WHERE id IN [organizations:org_alpha, organizations:org_beta, organizations:org_gamma]`);

  await db.close();
}
```

---

## 8. Success Criteria

### Per-Milestone Criteria

| Milestone | Tests | Success Criteria |
|-----------|-------|------------------|
| M1 | 15 | All auth flows verified, RBAC PERMISSIONS working |
| M2 | 15 | All data flows verified, correct project_id propagation |
| M3 | 20 | Complete tenant isolation verified |
| M4 | 50 (all previous) | No regression after refactoring |
| M5 | 10 | Dashboard fully functional with auth |
| M6 | 25 | Production-ready security, performance, reliability |

### Overall Success Criteria

- **135 total E2E tests passing**
- **< 100ms query latency** for template and trace queries
- **100% tenant isolation** verified across 3 test organizations
- **Zero security vulnerabilities** (JWT, rate limiting, injection)
- **Dashboard fully functional** with login, logout, token refresh

---

## 9. Risk Mitigation

| Risk | Mitigation | Milestone |
|------|------------|-----------|
| Breaking existing functionality | Run all previous tests in M4 | M4 |
| Performance regression | Performance tests in M6 | M6 |
| Security vulnerabilities | Security tests in M6 | M6 |
| Data loss during migration | Test Helm upgrade preserves data | M6 |
| Token refresh failures | Test auto-refresh mechanism | M2, M5 |

---

## 10. Timeline

| Milestone | Estimated Effort | Dependencies |
|-----------|-----------------|--------------|
| M1: Foundation | 1 day | Deployed cluster |
| M2: Data Flows | 1 day | M1 complete |
| M3: Isolation | 1 day | M2 complete |
| M4: Patterns | 2 days | M3 complete |
| M5: Dashboard | 2 days | M4 complete |
| M6: Production | 1 day | M5 complete |

**Total: 8 days**
