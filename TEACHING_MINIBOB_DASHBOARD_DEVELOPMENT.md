# Teaching MiniBob Dashboard Development

## Overview

This guide shows how to use MiniBob to develop and maintain the cloud dashboard at `https://app.metabob.com`.

MiniBob can now handle dashboard tasks using specialized activity templates in `repos/metabob-proto/activities/dashboard/`.

---

## Activity Templates Created

### 1. Fix Dashboard API Proxy
**File**: `repos/metabob-proto/activities/dashboard/fix-dashboard-api-proxy.json`

**Use when**: The dashboard is calling the wrong backend service

**Example**:
```bash
minibob --single "Fix the cloud dashboard - auth requests are going to identity-vessel but should go to user-vessel"
```

**What MiniBob will do**:
1. Read the proxy configuration in `repos/metabob-cloud-dashboard/src/index.ts`
2. Verify the correct backend service exists and has the endpoints
3. Check deployment status of the backend
4. Update the proxy configuration
5. Test locally if possible
6. Document the fix

**Input variables** (auto-detected from goal):
- `incorrect_target`: Current backend service name
- `correct_target`: Correct backend service name
- `endpoint_pattern`: API path pattern (e.g., `/api/auth/*`)
- `test_endpoint`: Specific endpoint to test

---

### 2. Test Dashboard with Playwright
**File**: `repos/metabob-proto/activities/dashboard/test-dashboard-with-playwright.json`

**Use when**: You want to test dashboard features end-to-end

**Examples**:
```bash
# Test everything
minibob --single "Test the cloud dashboard at https://app.metabob.com - signup, login, and all features"

# Test specific features
minibob --single "Test the API Keys page on the dashboard"

# Test authentication only
minibob --single "Test dashboard signup and login flow"
```

**What MiniBob will do**:
1. Navigate to the dashboard URL using Playwright
2. Test signup flow (creates test account)
3. Test login flow
4. Navigate to and test each requested feature page:
   - API Keys
   - Members
   - Usage Analytics
   - Execution Traces
5. Check network requests for errors
6. Take screenshots of everything
7. Generate a comprehensive test report

**Input variables**:
- `dashboard_url`: URL to test (default: from goal)
- `test_signup`: Whether to test signup (default: true)
- `test_login`: Whether to test login (default: true)
- `test_features`: Which pages to test (default: all)
- `test_email`: Test account email (auto-generated if not provided)
- `test_password`: Test account password (default: TestPassword123!)

**Output**:
- `DASHBOARD_TEST_REPORT.md` with full test results
- Screenshots in `.playwright-mcp/` directory
- List of any broken features or failed API calls

---

### 3. Add New Dashboard Page
**File**: `repos/metabob-proto/activities/dashboard/add-dashboard-page.json`

**Use when**: You want to add a new page to the dashboard

**Example**:
```bash
minibob --single "Add an 'Activity Insights' page to the dashboard that shows success rate trends and most common failures"
```

**What MiniBob will do**:
1. Study existing dashboard pages to understand patterns
2. Create the new page component
3. Add routing in `App.tsx`
4. Add navigation link in `Layout.tsx`
5. Add API client functions if needed
6. Test locally if dashboard is running
7. Document the new page

**Input variables** (extracted from goal):
- `page_name`: Component name (PascalCase, e.g., `ActivityInsights`)
- `page_description`: What the page does
- `route_path`: URL path (kebab-case, e.g., `activity-insights`)
- `nav_label`: Navigation menu label
- `requires_api`: Whether it needs backend integration
- `api_endpoint`: Backend API endpoint if needed
- `design_notes`: Layout and component details

**Output**:
- New page component in `src/pages/`
- Updated routing and navigation
- API client functions if needed
- Documentation in `CLOUD_DASHBOARD_AUDIT.md`

---

## Common Dashboard Tasks

### Fix a Broken Feature

If a dashboard feature isn't working (e.g., signup returns 404):

```bash
minibob --single "Debug why dashboard signup is failing with 404 error"
```

MiniBob will:
1. Test the feature with Playwright
2. Check network requests to see which API calls are failing
3. Identify the proxy configuration issue
4. Fix the proxy routing
5. Re-test to verify the fix

### Add a New Feature

To add a complete new feature:

```bash
minibob --single "Add a 'Cost Breakdown' page showing LLM costs by model and API key"
```

MiniBob will:
1. Create the page component with charts and tables
2. Add routing and navigation
3. Create API client functions
4. Integrate with backend endpoints
5. Test with Playwright
6. Document the feature

### Test After Deployment

After deploying to canary:

```bash
minibob --single "Test all dashboard features at https://app.metabob.com"
```

MiniBob will run through every feature and generate a report showing what works and what's broken.

---

## Dashboard Architecture Quick Reference

### Frontend (repos/metabob-cloud-dashboard)

```
src/
├── App.tsx                    # Main app component with routing
├── index.ts                   # Bun server with proxy configuration
├── pages/                     # Page components
│   ├── APIKeys.tsx
│   ├── Members.tsx
│   ├── UsageAnalytics.tsx
│   └── ExecutionTraces.tsx
├── components/
│   ├── Layout.tsx            # Navigation and page layout
│   └── ui/                   # shadcn/ui components
├── lib/
│   └── api/                  # API client functions
│       ├── client.ts         # Base fetch wrapper
│       └── analysis-api.ts   # Endpoint definitions
└── types/
    └── api.ts                # TypeScript types

```

### Backend Services

| Service | Purpose | Endpoints | Proxy Path |
|---------|---------|-----------|------------|
| **user-vessel** | Auth, users, orgs, API keys | `/v2/auth/*`, `/v2/users/*`, `/v2/organizations/*`, `/v2/api-keys/*` | `/api/v2/users/*`, `/api/v2/organizations/*`, `/api/v2/api-keys/*`, `/api/auth/*` |
| **activity-api** | Execution traces, learning | `/v2/activities/*` | `/api/v2/activities/*` |

### Proxy Configuration

**File**: `repos/metabob-cloud-dashboard/src/index.ts`

```typescript
// Auth endpoints → user-vessel
if (pathname.startsWith("/api/auth/")) {
  const targetUrl = `${USER_VESSEL_URL}${path}`;
}

// User management → user-vessel
if (pathname.startsWith("/api/v2/users") ||
    pathname.startsWith("/api/v2/organizations") ||
    pathname.startsWith("/api/v2/api-keys")) {
  const targetUrl = `${USER_VESSEL_URL}${path}`;
}

// Activity traces → activity-api
if (pathname.startsWith("/api/v2/activities")) {
  const targetUrl = `${ACTIVITY_API_URL}${path}`;
}
```

---

## Deployment Workflow

### 1. Develop Locally

```bash
cd repos/metabob-cloud-dashboard
bun dev
```

Open http://localhost:3000

### 2. Test with MiniBob

```bash
minibob --single "Test the dashboard feature I just added"
```

### 3. Deploy to Canary

```bash
# In main workspace
git add repos/metabob-cloud-dashboard
git commit -m "feat(dashboard): add new feature"
git push

# Sync to deployment repo
cd repos/deployment
git checkout dev
rsync -av ../metabob-cloud-dashboard/ vessels/metabob-cloud-dashboard/
git add vessels/metabob-cloud-dashboard
git commit -m "feat(dashboard): add new feature"
git push origin dev

# CI/CD automatically builds and deploys to canary
```

### 4. Test Canary with MiniBob

```bash
minibob --single "Test the dashboard at https://app.metabob.com with focus on the new feature"
```

### 5. Promote to Production

After canary validation succeeds:
- Manual: GitHub Actions → Promote to Production → Type "PROMOTE"
- Automatic: Daily at 10 AM UTC

---

## Advanced: Creating Custom Activity Templates

To teach MiniBob a new dashboard skill:

1. Create a new JSON file in `repos/metabob-proto/activities/dashboard/`
2. Follow the structure of existing templates
3. Define tasks with clear prompts and tool usage
4. Specify input schema and output impulses
5. Test by running MiniBob with a matching goal

**Example** - Template for removing unused pages:

```json
{
  "id": "dashboard:remove-page",
  "name": "Remove Unused Dashboard Page",
  "description": "Remove a page that's no longer needed",
  "tasks": [
    {
      "id": "remove-component",
      "description": "Delete the page component file",
      "prompt": {
        "template": "Delete the page component:\n\nFile: repos/metabob-cloud-dashboard/src/pages/{{page_name}}.tsx\n\nUse bash rm command to delete it.",
        "variables": ["page_name"]
      },
      "tools": ["bash"]
    },
    {
      "id": "remove-routing",
      "description": "Remove the route from App.tsx",
      "prompt": {
        "template": "Remove routing:\n\n1. Remove the import\n2. Remove from Page type\n3. Remove the case in renderPage()",
        "variables": ["page_name", "route_path"]
      },
      "tools": ["edit"]
    },
    {
      "id": "remove-navigation",
      "description": "Remove from navigation menu",
      "prompt": {
        "template": "Remove navigation link from Layout.tsx",
        "variables": ["route_path"]
      },
      "tools": ["edit"]
    }
  ]
}
```

---

## Tips for Working with MiniBob

### Be Specific in Goals

**Good**:
```bash
minibob --single "Fix the Members page API integration - it's calling /api/users but should call /api/v2/users"
```

**Too Vague**:
```bash
minibob --single "Fix the dashboard"
```

### Provide Context

If MiniBob needs specific information:
```bash
minibob --single "Add a Cost Analytics page that fetches data from /v2/costs/breakdown and displays a pie chart and table"
```

### Test Before and After

Always test with Playwright:
```bash
# Before making changes
minibob --single "Test the current dashboard state"

# Make changes
minibob --single "Add the new feature"

# After changes
minibob --single "Test the new feature works"
```

### Let MiniBob Learn

Every MiniBob execution creates a trace that feeds the learning loop:
- Successful patterns become templates
- Failed attempts help avoid mistakes
- Thompson Sampling improves selection over time

---

## Troubleshooting

### MiniBob can't find the template

Make sure the goal matches the template description:
- Use keywords like "fix proxy", "test dashboard", "add page"
- MiniBob uses semantic matching to find the right template

### Template execution fails

Check the execution trace:
```bash
# Find the trace ID from MiniBob output
curl https://activity.metabob.com/v2/activities/execution-traces/{trace_id}
```

Review the failed task and adjust your goal to provide missing information.

### Dashboard deploys but feature doesn't work

Use Playwright testing:
```bash
minibob --single "Test the dashboard and check network requests for errors"
```

MiniBob will identify failed API calls and suggest fixes.

---

## Next Steps

1. **Test the fix**: Run `minibob --single "Test dashboard signup at https://app.metabob.com"`
2. **Deploy if needed**: If testing locally, deploy the auth proxy fix to canary
3. **Create more templates**: Add templates for specific dashboard tasks as needs arise
4. **Automate testing**: Set up MiniBob to test dashboard on every canary deployment

---

## Summary

MiniBob can now:
- ✅ Fix dashboard API proxy routing
- ✅ Test dashboard features end-to-end with Playwright
- ✅ Add new pages to the dashboard
- ✅ Debug and diagnose dashboard issues
- ✅ Generate detailed test reports

Every dashboard task MiniBob completes feeds the learning loop, making future dashboard development faster and more reliable.

**The dashboard develops itself.**
