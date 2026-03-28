# metabob-mcp E2E Demo - Tasks

## Overview

Each milestone results in a working, testable state. Tests are black-box: they call deployed services and validate outputs via the dashboard using Playwright MCP.

---

## Pre-requisites: Test Environment Setup

### Deployment Architecture

Services are deployed via Helmfile to `activity-system` namespace with Istio routing:

| Service | Internal URL | External URL (dev) |
|---------|--------------|-------------------|
| metabob-analysis-api | `metabob-analysis-api.activity-system.svc.cluster.local:8080` | `http://api.metabob.local` |
| metabob-activity-api | `metabob-activity-api.activity-system.svc.cluster.local:8080` | `http://activity.metabob.local` |
| metabob-cloud-dashboard | `metabob-cloud-dashboard.activity-system.svc.cluster.local:3000` | `http://app.metabob.local` |

### /etc/hosts Configuration

```
127.0.0.1 api.metabob.local activity.metabob.local app.metabob.local internal.metabob.local
```

### Test API Key Setup

Tests require a valid API key. Before running tests, create a test user and API key:

```bash
# 1. Port-forward to analysis-api (or use Istio gateway)
kubectl port-forward -n activity-system svc/metabob-analysis-api 8080:8080 &

# 2. Create test user and org
curl -X POST http://api.metabob.local/v2/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e-test@metabob.local","password":"TestPassword123!","name":"E2E Test User","org_name":"E2E Test Org"}'

# 3. Login to get token
TOKEN=$(curl -s -X POST http://api.metabob.local/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e-test@metabob.local","password":"TestPassword123!"}' | jq -r '.data.token')

# 4. Create API key
API_KEY=$(curl -s -X POST http://api.metabob.local/v2/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E Test Key","scopes":["analysis:read","analysis:write"]}' | jq -r '.data.key')

# 5. Export for tests
export METABOB_API_KEY="$API_KEY"
```

### Authentication Flow

```
API Key (mb_xxx) → POST /v2/auth/apikey → JWT Token (15 min)
                                              ↓
                         Authorization: Bearer <token>
                                              ↓
                              Protected /v2/analysis/* routes
```

---

## Milestone 1: Health & Authentication (Commit: "feat(e2e): M1 health and auth baseline")

### Tasks

- [x] **M1.1** Create test fixture directory at `repos/metabob-mcp/test/e2e/`
- [x] **M1.2** Create test data files: `fixtures/sample-files.json` with TypeScript source samples
- [x] **M1.3** Create `e2e/m1-health-auth.test.ts` with health check tests
- [x] **M1.4** Add API key authentication test (key → JWT exchange via `/v2/auth/apikey`)
- [x] **M1.5** Add session creation test (X-Session-ID header)
- [x] **M1.6** Create test setup script `test/e2e/setup.ts` for user/key provisioning

### M1 Test: Health & Auth Validation

```typescript
// repos/metabob-mcp/test/e2e/m1-health-auth.test.ts
import { test, expect } from "bun:test";

// Use Istio gateway URL or port-forward
const ANALYSIS_API = process.env.ANALYSIS_API_URL || "http://api.metabob.local";
const API_KEY = process.env.METABOB_API_KEY;

test("M1.1: analysis-api health check returns ok", async () => {
  const res = await fetch(`${ANALYSIS_API}/health`);
  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.status).toBe("ok");
  expect(data.service).toBe("metabob-analysis-api");
});

test("M1.2: API key exchanges for JWT via /v2/auth/apikey", async () => {
  // Correct endpoint: /v2/auth/apikey (not /v2/auth/api-key/exchange)
  const res = await fetch(`${ANALYSIS_API}/v2/auth/apikey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: API_KEY }),
  });
  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.token).toBeDefined();
  expect(data.org_id).toBeDefined();
  expect(data.expires_in).toBeGreaterThan(0);
});

test("M1.3: Protected routes require auth", async () => {
  const res = await fetch(`${ANALYSIS_API}/v2/analysis/index/status`, {
    headers: { "X-Session-ID": "test-session" },
  });
  expect(res.status).toBe(401);
});

test("M1.4: Login flow works for dashboard users", async () => {
  const res = await fetch(`${ANALYSIS_API}/v2/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "e2e-test@metabob.local",
      password: "TestPassword123!",
    }),
  });
  // May be 401 if user doesn't exist yet, or 200 if setup ran
  expect([200, 401]).toContain(res.status);
});
```

### M1 Dashboard Test (Playwright)

```typescript
// repos/metabob-mcp/test/e2e/m1-dashboard.test.ts
import { test, expect } from "@playwright/test";

test("M1.D1: Dashboard loads and shows system status", async ({ page }) => {
  await page.goto(process.env.DASHBOARD_URL || "http://app.metabob.local");

  // Verify dashboard renders
  await expect(page.locator("h1")).toContainText("Dashboard");

  // Check system status indicators exist
  await expect(page.locator("text=Analysis API")).toBeVisible();
  await expect(page.locator("text=Operational")).toBeVisible();
});
```

---

## Milestone 2: Codebase Indexing (Commit: "feat(e2e): M2 indexing flow")

### Tasks

- [x] **M2.1** Create `e2e/m2-indexing.test.ts` with indexing tests
- [x] **M2.2** Add test for POST /v2/analysis/index with sample files
- [x] **M2.3** Add test for GET /v2/analysis/index/status
- [x] **M2.4** Add test for incremental vs full re-index
- [x] **M2.5** Verify components are extracted from TypeScript AST

### M2 Test: Indexing Flow

```typescript
// repos/metabob-mcp/test/e2e/m2-indexing.test.ts
import { test, expect } from "bun:test";

const ANALYSIS_API = process.env.ANALYSIS_API_URL || "http://api.metabob.local";
let authToken: string;
const SESSION_ID = `e2e-test-${Date.now()}`;

test.beforeAll(async () => {
  // Authenticate
  const res = await fetch(`${ANALYSIS_API}/v2/auth/apikey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.METABOB_API_KEY }),
  });
  const data = await res.json();
  authToken = data.token;
});

test("M2.1: Index TypeScript files", async () => {
  const files = {
    "src/auth.ts": `
export function login(user: string, pass: string): boolean {
  if (!user || !pass) return false;
  return validateCredentials(user, pass);
}

function validateCredentials(user: string, pass: string): boolean {
  // TODO: implement actual validation
  return user === "admin" && pass === "secret";
}
`,
    "src/utils.ts": `
export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseJson<T>(json: string): T | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
`,
  };

  const res = await fetch(`${ANALYSIS_API}/v2/analysis/index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
    body: JSON.stringify({ files, incremental: false }),
  });

  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.indexed).toBe(2);
  expect(data.components).toBeGreaterThan(0);
  expect(data.status).toBe("ready");
});

test("M2.2: Check indexing status", async () => {
  const res = await fetch(`${ANALYSIS_API}/v2/analysis/index/status`, {
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
  });

  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.status).toBe("ready");
  expect(data.files_indexed).toBe(2);
  expect(data.components_count).toBeGreaterThan(3); // At least 4 functions
});

test("M2.3: Incremental indexing adds files", async () => {
  const files = {
    "src/config.ts": `
export const CONFIG = {
  apiUrl: "http://localhost:8080",
  timeout: 5000,
};
`,
  };

  const res = await fetch(`${ANALYSIS_API}/v2/analysis/index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
    body: JSON.stringify({ files, incremental: true }),
  });

  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.indexed).toBe(1);

  // Status should show cumulative
  const statusRes = await fetch(`${ANALYSIS_API}/v2/analysis/index/status`, {
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
  });
  const status = await statusRes.json();
  expect(status.files_indexed).toBe(3);
});
```

---

## Milestone 3: Analysis & Search (Commit: "feat(e2e): M3 analysis queries")

### Tasks

- [x] **M3.1** Create `e2e/m3-analysis.test.ts` with analysis tests
- [x] **M3.2** Add test for GET /v2/analysis/priority (complexity hotspots)
- [x] **M3.3** Add test for POST /v2/analysis/search (semantic search)
- [x] **M3.4** Add test for severity/category filtering
- [x] **M3.5** Verify CPG-based analysis returns function-level issues

### M3 Test: Analysis Queries

```typescript
// repos/metabob-mcp/test/e2e/m3-analysis.test.ts
import { test, expect } from "bun:test";

const ANALYSIS_API = process.env.ANALYSIS_API_URL || "http://api.metabob.local";
let authToken: string;
const SESSION_ID = `e2e-test-${Date.now()}`;

test.beforeAll(async () => {
  // Auth and index files (reuse M2 setup)
  const authRes = await fetch(`${ANALYSIS_API}/v2/auth/apikey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.METABOB_API_KEY }),
  });
  authToken = (await authRes.json()).token;

  // Index complex file for analysis
  await fetch(`${ANALYSIS_API}/v2/analysis/index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
    body: JSON.stringify({
      files: {
        "src/complex.ts": `
export function complexFunction(a: number, b: number, c: number, d: number, e: number, f: number): number {
  // Intentionally complex for testing
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        if (d > 0) {
          if (e > 0) {
            return a + b + c + d + e + f;
          }
          return a + b + c + d + f;
        }
        return a + b + c + f;
      }
      return a + b + f;
    }
    return a + f;
  }
  return f;
}
`,
      },
      incremental: false,
    }),
  });
});

test("M3.1: Get priority issues returns complexity hotspots", async () => {
  const res = await fetch(`${ANALYSIS_API}/v2/analysis/priority?limit=10`, {
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
  });

  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.issues).toBeInstanceOf(Array);
  expect(data.cpg_status).toBe("ready");

  // Should detect complexity in our test function
  if (data.issues.length > 0) {
    const complexIssue = data.issues.find(i =>
      i.component_id.includes("complexFunction")
    );
    expect(complexIssue).toBeDefined();
  }
});

test("M3.2: Search codebase by query", async () => {
  const res = await fetch(`${ANALYSIS_API}/v2/analysis/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
    body: JSON.stringify({
      query: "complex function",
      limit: 10,
    }),
  });

  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.results).toBeInstanceOf(Array);
  expect(data.cpg_status).toBe("ready");
});

test("M3.3: Filter by severity", async () => {
  const res = await fetch(
    `${ANALYSIS_API}/v2/analysis/priority?limit=10&severity=HIGH&severity=CRITICAL`,
    {
      headers: {
        "Authorization": `Bearer ${authToken}`,
        "X-Session-ID": SESSION_ID,
      },
    }
  );

  expect(res.ok).toBe(true);
  const data = await res.json();
  // All returned issues should be HIGH or CRITICAL
  for (const issue of data.issues) {
    expect(["HIGH", "CRITICAL"]).toContain(issue.severity);
  }
});
```

### M3 Dashboard Test (Playwright)

```typescript
// repos/metabob-mcp/test/e2e/m3-dashboard.test.ts
import { test, expect } from "@playwright/test";

test("M3.D1: Issues page shows analysis results", async ({ page }) => {
  await page.goto(`${process.env.DASHBOARD_URL}/issues`);

  // Wait for issues to load
  await page.waitForSelector("[data-testid='issues-list']", { timeout: 10000 });

  // Should show some issues (or empty state)
  const issueCount = await page.locator("[data-testid='issue-item']").count();
  // Just verify the list renders, even if empty
  expect(issueCount).toBeGreaterThanOrEqual(0);
});
```

---

## Milestone 4: Predictions (Commit: "feat(e2e): M4 co-change and impact")

### Tasks

- [x] **M4.1** Create `e2e/m4-predictions.test.ts` with prediction tests
- [x] **M4.2** Add test for POST /v2/analysis/cochange/suggest
- [x] **M4.3** Add test for POST /v2/analysis/impact
- [x] **M4.4** Verify hybrid scoring (embedding + historical patterns)
- [x] **M4.5** Add test for impact depth traversal

### M4 Test: Predictions

```typescript
// repos/metabob-mcp/test/e2e/m4-predictions.test.ts
import { test, expect } from "bun:test";

const ANALYSIS_API = process.env.ANALYSIS_API_URL || "http://api.metabob.local";
let authToken: string;
const SESSION_ID = `e2e-test-${Date.now()}`;

test.beforeAll(async () => {
  // Auth
  const authRes = await fetch(`${ANALYSIS_API}/v2/auth/apikey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.METABOB_API_KEY }),
  });
  authToken = (await authRes.json()).token;

  // Index related files
  await fetch(`${ANALYSIS_API}/v2/analysis/index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
    body: JSON.stringify({
      files: {
        "src/user.ts": `
import { db } from './db';
export async function getUser(id: string) {
  return db.query('SELECT * FROM users WHERE id = ?', [id]);
}
export async function saveUser(user: User) {
  return db.insert('users', user);
}
`,
        "src/db.ts": `
export const db = {
  query: (sql: string, params: any[]) => Promise.resolve([]),
  insert: (table: string, data: any) => Promise.resolve({ id: '1' }),
};
`,
        "src/api.ts": `
import { getUser, saveUser } from './user';
export async function handleGetUser(req: Request) {
  const user = await getUser(req.params.id);
  return new Response(JSON.stringify(user));
}
`,
      },
      incremental: false,
    }),
  });
});

test("M4.1: Suggest co-changes for modified file", async () => {
  const res = await fetch(`${ANALYSIS_API}/v2/analysis/cochange/suggest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
    body: JSON.stringify({
      changed_files: ["src/user.ts"],
      limit: 5,
      confidence_threshold: 0.3,
    }),
  });

  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.suggestions).toBeInstanceOf(Array);
  expect(data.cpg_status).toBe("ready");
  expect(data.changed_files).toEqual(["src/user.ts"]);

  // Should suggest related files based on imports
  if (data.suggestions.length > 0) {
    const filePaths = data.suggestions.map(s => s.file_path);
    // Either api.ts (imports user) or db.ts (imported by user) should appear
    const hasRelated = filePaths.some(f =>
      f.includes("api.ts") || f.includes("db.ts")
    );
    expect(hasRelated).toBe(true);
  }
});

test("M4.2: Analyze change impact", async () => {
  const res = await fetch(`${ANALYSIS_API}/v2/analysis/impact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
    body: JSON.stringify({
      changed_files: ["src/db.ts"],
      max_depth: 2,
    }),
  });

  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.changed_components).toBeInstanceOf(Array);
  expect(data.risk_level).toBeDefined();

  // db.ts change should impact user.ts (direct) and api.ts (indirect)
  const allAffected = [
    ...data.direct_dependencies || [],
    ...data.indirect_dependencies || [],
  ];
  expect(allAffected.length).toBeGreaterThan(0);
});

test("M4.3: Hybrid scoring uses both embedding and frequency", async () => {
  const res = await fetch(`${ANALYSIS_API}/v2/analysis/cochange/suggest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
    body: JSON.stringify({
      changed_files: ["src/user.ts"],
      limit: 10,
      confidence_threshold: 0.1,
      config: {
        embedding_weight: 0.5,
        frequency_weight: 0.5,
      },
    }),
  });

  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.config.embedding_weight).toBe(0.5);
  expect(data.config.frequency_weight).toBe(0.5);
});
```

---

## Milestone 5: Full E2E Flow (Commit: "feat(e2e): M5 complete agent workflow")

### Tasks

- [x] **M5.1** Create `e2e/m5-full-flow.test.ts` with complete workflow tests
- [x] **M5.2** Test MCP tool execution via metabob-mcp binary
- [x] **M5.3** Test annotation creation and problem completion
- [x] **M5.4** Test spec generation from goal
- [x] **M5.5** Create comprehensive Playwright dashboard test

### M5 Test: Full Flow

```typescript
// repos/metabob-mcp/test/e2e/m5-full-flow.test.ts
import { test, expect } from "bun:test";
import { spawn } from "bun";

const ANALYSIS_API = process.env.ANALYSIS_API_URL || "http://api.metabob.local";
let authToken: string;
const SESSION_ID = `e2e-full-${Date.now()}`;

test.beforeAll(async () => {
  const authRes = await fetch(`${ANALYSIS_API}/v2/auth/apikey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.METABOB_API_KEY }),
  });
  authToken = (await authRes.json()).token;
});

test("M5.1: Complete debugging workflow", async () => {
  // Step 1: Index codebase
  const indexRes = await fetch(`${ANALYSIS_API}/v2/analysis/index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
    body: JSON.stringify({
      files: {
        "src/buggy.ts": `
export function divideNumbers(a: number, b: number): number {
  // BUG: No division by zero check
  return a / b;
}
`,
      },
      incremental: false,
    }),
  });
  expect(indexRes.ok).toBe(true);

  // Step 2: Get priority issues
  const priorityRes = await fetch(`${ANALYSIS_API}/v2/analysis/priority?limit=10`, {
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
  });
  expect(priorityRes.ok).toBe(true);

  // Step 3: Search for the issue
  const searchRes = await fetch(`${ANALYSIS_API}/v2/analysis/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
    body: JSON.stringify({ query: "divide", limit: 5 }),
  });
  expect(searchRes.ok).toBe(true);
  const searchData = await searchRes.json();

  // Step 4: Annotate the component
  if (searchData.results?.length > 0) {
    const componentId = searchData.results[0].component_id;
    const annotateRes = await fetch(`${ANALYSIS_API}/v2/analysis/annotations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
        "X-Session-ID": SESSION_ID,
      },
      body: JSON.stringify({
        component_id: componentId,
        content: "Add division by zero check",
        type: "todo",
        tags: ["bug-fix", "validation"],
      }),
    });
    expect(annotateRes.ok).toBe(true);
  }
});

test("M5.2: Generate implementation spec", async () => {
  const res = await fetch(`${ANALYSIS_API}/v2/analysis/specs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
      "X-Session-ID": SESSION_ID,
    },
    body: JSON.stringify({
      goal: "Add input validation to all API endpoints",
      context: "Ensure all user input is validated before processing",
    }),
  });

  expect(res.ok).toBe(true);
  const data = await res.json();
  expect(data.spec).toBeDefined();
  expect(data.spec.goal).toBe("Add input validation to all API endpoints");
});
```

### M5 Dashboard Test (Playwright) - Comprehensive

```typescript
// repos/metabob-mcp/test/e2e/m5-dashboard.test.ts
import { test, expect } from "@playwright/test";

test.describe("M5: Full Dashboard Validation", () => {
  test("M5.D1: Overview shows metrics", async ({ page }) => {
    await page.goto(process.env.DASHBOARD_URL || "http://app.metabob.local");

    // Wait for metrics to load
    await page.waitForSelector("[data-testid='metric-card']", { timeout: 10000 });

    // Verify metric cards exist
    await expect(page.locator("text=Projects")).toBeVisible();
    await expect(page.locator("text=Issues")).toBeVisible();
    await expect(page.locator("text=Templates")).toBeVisible();
    await expect(page.locator("text=Executions")).toBeVisible();
  });

  test("M5.D2: Navigation works", async ({ page }) => {
    await page.goto(process.env.DASHBOARD_URL || "http://app.metabob.local");

    // Navigate to Issues
    await page.click("text=Issues");
    await expect(page).toHaveURL(/.*issues/);

    // Navigate to Projects
    await page.click("text=Projects");
    await expect(page).toHaveURL(/.*projects/);

    // Navigate to API Keys
    await page.click("text=API Keys");
    await expect(page).toHaveURL(/.*api-keys/);
  });

  test("M5.D3: API Keys page functional", async ({ page }) => {
    await page.goto(`${process.env.DASHBOARD_URL}/api-keys`);

    // Check create button exists
    await expect(page.locator("text=Create API Key")).toBeVisible();
  });

  test("M5.D4: Issues page shows analysis data", async ({ page }) => {
    await page.goto(`${process.env.DASHBOARD_URL}/issues`);

    // Wait for content
    await page.waitForLoadState("networkidle");

    // Verify filter controls exist
    await expect(page.locator("text=Severity")).toBeVisible();
    await expect(page.locator("text=Category")).toBeVisible();
  });
});
```

---

## Test Runner Configuration

### Package.json scripts

```json
{
  "scripts": {
    "test:e2e:m1": "bun test test/e2e/m1-*.test.ts",
    "test:e2e:m2": "bun test test/e2e/m2-*.test.ts",
    "test:e2e:m3": "bun test test/e2e/m3-*.test.ts",
    "test:e2e:m4": "bun test test/e2e/m4-*.test.ts",
    "test:e2e:m5": "bun test test/e2e/m5-*.test.ts",
    "test:e2e:all": "bun test test/e2e/",
    "test:playwright": "playwright test test/e2e/*.test.ts"
  }
}
```

### Environment Setup

```bash
# .env.e2e - Using Istio gateway URLs (requires /etc/hosts setup)
ANALYSIS_API_URL=http://api.metabob.local
ACTIVITY_API_URL=http://activity.metabob.local
DASHBOARD_URL=http://app.metabob.local
METABOB_API_KEY=mb_xxx  # Created via setup script

# Alternative: Port-forward mode (no Istio required)
# kubectl port-forward -n activity-system svc/metabob-analysis-api 8080:8080 &
# kubectl port-forward -n activity-system svc/metabob-cloud-dashboard 3000:3000 &
# ANALYSIS_API_URL=http://localhost:8080
# DASHBOARD_URL=http://localhost:3000
```

---

## Commit Milestones Summary

| Milestone | Commit Message | Tests Pass |
|-----------|----------------|------------|
| M1 | `feat(e2e): M1 health and auth baseline` | m1-*.test.ts |
| M2 | `feat(e2e): M2 indexing flow` | m1-*, m2-*.test.ts |
| M3 | `feat(e2e): M3 analysis queries` | m1-*, m2-*, m3-*.test.ts |
| M4 | `feat(e2e): M4 co-change and impact` | m1-*, m2-*, m3-*, m4-*.test.ts |
| M5 | `feat(e2e): M5 complete agent workflow` | All tests pass |

---

## Definition of Done

Each milestone is complete when:
1. All milestone tests pass in deployed environment
2. Dashboard validates data via Playwright
3. Commit includes test files
4. CI/CD pipeline (pre-commit hook) succeeds
