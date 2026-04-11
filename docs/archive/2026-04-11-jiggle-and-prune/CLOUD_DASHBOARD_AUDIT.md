# Cloud Dashboard Audit Report

## Executive Summary

**Status**: ⚠️ Authentication is broken due to incorrect proxy configuration

**Root Cause**: Dashboard server proxies `/api/auth/*` to `identity-vessel`, but auth endpoints are actually in `user-vessel`.

**Fix Applied**: Updated `repos/metabob-cloud-dashboard/src/index.ts` line 60 to proxy auth requests to `USER_VESSEL_URL` instead of `IDENTITY_VESSEL_URL`.

**Next Steps**:
1. Build and deploy updated dashboard image
2. Test full authentication flow
3. Verify all dashboard features work
4. Create MiniBob activity templates for dashboard development

---

## Current Architecture

### Frontend: metabob-cloud-dashboard
**Production URL**: https://app.metabob.com
**Deployed Tag**: 0.2.2-35dacd7 (2 replicas)
**Tech Stack**: React 19 + Bun + Tailwind + shadcn/ui

### Backend Services

| Service | URL | Tag | Purpose |
|---------|-----|-----|---------|
| user-vessel | `user-vessel.activity-system.svc.cluster.local:8080` | 0.1.0-7a72492 | Auth, users, orgs, API keys |
| activity-api | `metabob-activity-api.activity-system.svc.cluster.local:8080` | (check canary) | Execution traces, learning |
| identity-vessel | N/A | N/A | **Does not exist** |

---

## Issue Details

### The Problem

When users try to sign up at https://app.metabob.com:
1. Frontend sends `POST /api/auth/signup` with user data
2. Dashboard server proxies to `IDENTITY_VESSEL_URL/v2/auth/signup`
3. `identity-vessel` does not exist → **404 Not Found**
4. Response body is not valid JSON → JSON parse error in frontend

### The Root Cause

**File**: `repos/metabob-cloud-dashboard/src/index.ts:58-75`

```typescript
// WRONG - proxies to non-existent identity-vessel
if (pathname.startsWith("/api/auth/")) {
  const path = pathname.replace("/api/auth", "/v2/auth");
  const targetUrl = `${IDENTITY_VESSEL_URL}${path}`;  // ❌ WRONG
  // ...
}
```

**Should be**:
```typescript
// CORRECT - proxies to user-vessel where auth endpoints exist
if (pathname.startsWith("/api/auth/")) {
  const path = pathname.replace("/api/auth", "/v2/auth");
  const targetUrl = `${USER_VESSEL_URL}${path}`;  // ✅ CORRECT
  // ...
}
```

### Auth Endpoints (in user-vessel)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v2/auth/signup` | POST | Create user + org atomically |
| `/v2/auth/login` | POST | Email/password → JWT token |
| `/v2/auth/me` | GET | Get authenticated user profile |
| `/v2/auth/logout` | POST | Logout (client-side token deletion) |

---

## Dashboard Features Implemented

### 1. Authentication (Status: BROKEN, Fix Applied)
- **Signup**: Email, password, name, org name → Creates org + user atomically
- **Login**: Email + password → Returns JWT token
- **Session**: JWT stored in sessionStorage, auto-restored on reload
- **Token Expiry**: 15 minutes

### 2. API Keys Management (Status: NEEDS TESTING)
**Page**: `repos/metabob-cloud-dashboard/src/pages/APIKeys.tsx`

**Features**:
- List all API keys for organization
- Create new API key with name and permissions
- Revoke API keys
- Copy key to clipboard
- Display last used timestamp

**Backend Endpoints** (proxied to user-vessel):
- `GET /api/v2/api-keys` - List keys
- `POST /api/v2/api-keys` - Create key
- `DELETE /api/v2/api-keys/:id` - Revoke key

### 3. Members Management (Status: NEEDS TESTING)
**Page**: `repos/metabob-cloud-dashboard/src/pages/Members.tsx`

**Features**:
- List all members in organization
- Display role badges (Admin, Developer, Viewer)
- Invite new members (admin only)
- Remove members (admin only)
- Show member activity (execution count, last active)
- Joined date formatting

**Backend Endpoints** (proxied to user-vessel):
- `GET /api/v2/users` - List users in org
- `POST /api/v2/users/invite` - Invite new member
- `DELETE /api/v2/users/:id` - Remove member

### 4. Usage Analytics (Status: NEEDS TESTING)
**Page**: `repos/metabob-cloud-dashboard/src/pages/UsageAnalytics.tsx`

**Features**:
- Summary metrics: Total Executions, Success Rate, Total Cost, Avg Duration
- Token consumption chart (line/bar chart, last 30 days)
- Time range filter (7 days, 30 days, 90 days, custom)
- Cost breakdown by LLM model
- Usage by member table (executions, tokens, cost)
- Usage by API key table
- Most used activities (top 10 templates)
- Trend indicators (up/down arrows with percentages)

**Backend Endpoints** (proxied to activity-api):
- `GET /api/v2/activities/execution-traces` - Get traces with filters

### 5. Execution Traces Viewer (Status: NEEDS TESTING)
**Page**: `repos/metabob-cloud-dashboard/src/pages/ExecutionTraces.tsx`

**Features**:
- List execution traces with pagination (50 per page)
- Status-based styling (green/red/spinner icons)
- Status filter dropdown (All, Running, Completed, Failed)
- Search box for filtering by goal description
- Trace detail view with expand/collapse
- Full goal description and input impulses display
- Task progression with status indicators
- Tool calls with expand/collapse for parameters and output
- State changes (files created/modified/deleted)
- Execution metrics (duration, cost, tokens, model used)

**Backend Endpoints** (proxied to activity-api):
- `GET /api/v2/activities/execution-traces` - List traces
- `GET /api/v2/activities/execution-traces/:id` - Get trace details

### 6. Settings Page (Status: REMOVED)
**Action**: The Settings page was removed as it had no functionality.

---

## Screens to Remove

Based on the implementation summary, the following unused screens should be removed:

1. ✅ **Settings Page** - Already removed
2. ❓ **Any other placeholder/skeleton pages** - Need to verify by testing the deployed dashboard

---

## Deployment Status

### Current Deployment (Canary)

```yaml
# From: repos/deployment/environments/production.canary.values.yaml

user-vessel:
  replicaCount: 2
  image:
    tag: "0.1.0-7a72492"

metabob-cloud-dashboard:
  replicaCount: 2
  image:
    tag: "0.2.2-35dacd7"  # ⚠️ Needs rebuild with auth fix
```

### Deployment Process

```bash
# 1. Commit the auth proxy fix
cd /home/avi/documents/work/exp-repo/metabob-devbob
git add repos/metabob-cloud-dashboard/src/index.ts
git commit -m "fix(cloud-dashboard): proxy auth requests to user-vessel instead of identity-vessel"

# 2. Sync to deployment repo and trigger CI/CD
cd repos/deployment
git checkout dev
rsync -av ../metabob-cloud-dashboard/ vessels/metabob-cloud-dashboard/
git add vessels/metabob-cloud-dashboard
git commit -m "fix(cloud-dashboard): proxy auth requests to user-vessel"
git push origin dev

# 3. CI/CD automatically:
#    - Runs secret scanning (Gitleaks)
#    - Runs tests (bun test)
#    - Builds Docker image
#    - Tags with version + git SHA
#    - Pushes to registry
#    - Deploys to canary
#    - Updates environments/production.canary.values.yaml

# 4. After canary validation, promote to production:
#    - Manual trigger in GitHub Actions
#    - Or automatic daily promotion at 10 AM UTC
```

---

## Testing Checklist

After deploying the auth fix, verify these flows:

### Authentication Flow
- [ ] Signup creates new user and organization
- [ ] Signup returns JWT token
- [ ] Login with email/password works
- [ ] Login returns JWT token
- [ ] Session persists across page reloads
- [ ] `/auth/me` endpoint returns user profile
- [ ] Logout clears session

### API Keys Page
- [ ] List API keys for organization
- [ ] Create new API key
- [ ] Copy API key to clipboard
- [ ] Revoke API key
- [ ] Display last used timestamp
- [ ] Proper error handling for failed requests

### Members Page
- [ ] List all members in organization
- [ ] Display role badges correctly
- [ ] Invite new member (admin only)
- [ ] Remove member (admin only)
- [ ] Show execution count and last active
- [ ] Display joined date

### Usage Analytics Page
- [ ] Display summary metrics (executions, success rate, cost, duration)
- [ ] Render token consumption chart
- [ ] Time range filter works (7d, 30d, 90d, custom)
- [ ] Cost breakdown by model displayed
- [ ] Usage by member table populated
- [ ] Usage by API key table populated
- [ ] Most used activities list shown
- [ ] Trend indicators appear

### Execution Traces Page
- [ ] List traces with pagination
- [ ] Status icons and styling work
- [ ] Status filter dropdown works
- [ ] Search by goal description
- [ ] Expand/collapse trace details
- [ ] Display input impulses
- [ ] Show task progression
- [ ] Display tool calls with parameters
- [ ] Show state changes (files)
- [ ] Metrics displayed (duration, cost, tokens)

---

## How to Teach MiniBob

### Approach

Create **activity templates** that MiniBob can use to:
1. Add new dashboard pages
2. Fix API proxy routing
3. Integrate new backend endpoints
4. Test dashboard features with Playwright
5. Remove unused UI components

### Activity Templates to Create

#### 1. `add-react-dashboard-page.json`
**Purpose**: Add a new page to the React dashboard

**Tasks**:
1. Create page component in `src/pages/<PageName>.tsx`
2. Add route to `App.tsx`
3. Add navigation item to `Layout.tsx`
4. Create API client functions if needed
5. Test with Playwright

**Impulses**:
- `file:repos/metabob-cloud-dashboard/src/App.tsx` - Routing
- `file:repos/metabob-cloud-dashboard/src/components/Layout.tsx` - Navigation
- `memo:design` - Page design specification

#### 2. `fix-dashboard-api-proxy.json`
**Purpose**: Fix or update API proxy configuration

**Tasks**:
1. Identify the endpoint that needs proxying
2. Update `src/index.ts` proxy rules
3. Verify backend service exists and is deployed
4. Test the proxy with curl
5. Test from frontend with Playwright

**Impulses**:
- `file:repos/metabob-cloud-dashboard/src/index.ts` - Proxy config
- `memo:backend_endpoint` - Backend URL and route
- `memo:test_data` - Test request payload

#### 3. `add-dashboard-api-integration.json`
**Purpose**: Integrate a new backend API endpoint

**Tasks**:
1. Add API client function in `src/lib/api/`
2. Add TypeScript types in `src/types/`
3. Create React hook if needed
4. Update the page component to use the API
5. Handle loading and error states
6. Test with sample data

**Impulses**:
- `file:repos/metabob-cloud-dashboard/src/lib/api/client.ts` - API client base
- `memo:api_spec` - OpenAPI or endpoint specification
- `memo:ui_design` - How to display the data

#### 4. `test-dashboard-with-playwright.json`
**Purpose**: Test dashboard features using Playwright MCP

**Tasks**:
1. Navigate to dashboard URL
2. Fill signup/login form
3. Verify authentication works
4. Navigate to target page
5. Interact with UI elements
6. Take screenshots of success/failure
7. Check network requests

**Impulses**:
- `memo:test_url` - Dashboard URL (canary or production)
- `memo:test_credentials` - Test account credentials
- `memo:test_steps` - Step-by-step test plan

#### 5. `remove-unused-dashboard-screen.json`
**Purpose**: Remove an unused page or component

**Tasks**:
1. Identify the page component file
2. Remove from routing in `App.tsx`
3. Remove navigation item from `Layout.tsx`
4. Delete the component file
5. Remove associated API client functions
6. Remove TypeScript types if unused
7. Run tests to verify nothing breaks

**Impulses**:
- `memo:page_name` - Name of the page to remove
- `file:repos/metabob-cloud-dashboard/src/App.tsx` - Routing config

---

## MiniBob Execution Examples

### Example 1: Fix Auth Proxy (What We Just Did)

```bash
minibob --single "Fix the cloud dashboard auth proxy - it's sending requests to identity-vessel but the auth endpoints are in user-vessel"
```

**MiniBob would**:
1. Read `repos/metabob-cloud-dashboard/src/index.ts`
2. Find the auth proxy section (lines 58-75)
3. Change `IDENTITY_VESSEL_URL` to `USER_VESSEL_URL`
4. Save the file
5. Create execution trace showing the fix

### Example 2: Test Dashboard Authentication

```bash
minibob --single "Test the cloud dashboard signup and login flow at https://app.metabob.com using Playwright"
```

**MiniBob would**:
1. Use Playwright MCP to navigate to app.metabob.com
2. Click "Sign up" button
3. Fill in the signup form
4. Submit and verify JWT token returned
5. Test login with those credentials
6. Verify authenticated state
7. Take screenshots
8. Report success or failure

### Example 3: Add New Dashboard Page

```bash
minibob --single "Add a new 'Insights' page to the cloud dashboard that shows activity success rate trends over time"
```

**MiniBob would**:
1. Create `src/pages/Insights.tsx` with chart component
2. Add route in `App.tsx`
3. Add navigation item in `Layout.tsx`
4. Create API client function to fetch metrics
5. Add TypeScript types
6. Test with Playwright
7. Commit the changes

---

## Recommended Next Steps

1. **Immediate**: Commit and deploy the auth proxy fix
2. **Validation**: Test all dashboard features with Playwright
3. **Documentation**: Create MiniBob activity templates
4. **Automation**: Set up MiniBob to run dashboard tests on every canary deployment
5. **Monitoring**: Add dashboard usage metrics to activity traces

---

## Questions for User

1. Do you want MiniBob to handle the deployment (commit → sync → push)?
2. Should we create a comprehensive Playwright test suite for all features?
3. Are there other dashboard pages you want to add/remove?
4. Do you want MiniBob to automatically test the dashboard after each canary deployment?
