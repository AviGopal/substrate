# Trace Analysis: Dashboard Login Flow E2E Validation

**Specification**: dashboard-login-flow-e2e-validation  
**Date**: 2026-03-03  
**Status**: BLOCKED - Critical backend components missing  

## Executive Summary

The metabob-dashboard is successfully deployed (pod 1/1 Running at app.metabob.local) with complete frontend implementation, Istio routing configured, but **all backend authentication and organization endpoints are missing**. Playwright E2E validation is **completely blocked** until backend authentication infrastructure is implemented.

### Critical Finding

**5 CRITICAL GAPS identified** - all block Playwright validation:

1. ❌ No auth router in metabob-rpc-api (POST /auth/login, POST /auth/register)
2. ❌ No SurrealDB user/organization schema
3. ❌ No JWT authentication middleware
4. ❌ No organization endpoints (/auth/orgs/*)
5. ❌ No project endpoints with org-scoping

## Current State vs Desired State

### Current State ✅
- ✅ Dashboard pod deployed and running
- ✅ Istio VirtualService routing /api/* to metabob-rpc-api:8080
- ✅ Frontend login UI complete (CustomLogin.js:1-244)
- ✅ Frontend API clients implemented (CloudAuthApi, OrganizationApi, ProjectApi)
- ✅ Frontend dashboard components ready (CloudDashboard with stats, projects, activity)

### Current State ❌
- ❌ No backend auth router (server/routes/auth.py does not exist)
- ❌ No SurrealDB schema for users/organizations
- ❌ No JWT token generation/validation
- ❌ No password hashing (bcrypt)
- ❌ No organization data endpoints
- ❌ No authentication middleware

### Desired State 🎯
Complete authentication flow working end-to-end:
1. User enters credentials in CustomLogin
2. POST /api/auth/login → backend validates via SurrealDB
3. JWT token + user data + orgs returned
4. Token stored in localStorage
5. Redirect to /cloud/dashboard
6. Dashboard fetches org stats, projects, activity via authenticated API calls
7. UI renders productivity metrics, project status, API key management

## Component Analysis

### ✅ IMPLEMENTED - Frontend Components

#### 1. CustomLogin Component
**File**: repos/metabob-dashboard/src/cloud/pages/CloudLogin/CustomLogin.js:1-244

**Current Behavior**:
- React component with email/password form
- Calls `loginUser({ email, password, org_id: null })`
- Stores response in localStorage: `metabob_cloud_token`, `metabob_cloud_user`, `metabob_cloud_orgs`
- Redirects to `/cloud/dashboard` on success

**Status**: ✅ Fully implemented, ready for backend

#### 2. CloudAuthApi.loginUser
**File**: repos/metabob-dashboard/src/cloud/api/CloudAuthApi.js:222-237

**Current Behavior**:
- Axios POST to `/auth/login`
- Expects response: `{ token: JWT, user: User, organizations: Org[] }`

**Status**: ✅ Implemented, waiting for backend endpoint

#### 3. CloudDashboard
**File**: repos/metabob-dashboard/src/cloud/pages/CloudDashboard/index.js:39-331

**Current Behavior**:
- Fetches data via:
  - `OrganizationApi.useGetOrganizationStatsQuery()`
  - `ProjectApi.useGetProjectsQuery()`
  - `OrganizationApi.useGetOrganizationActivityQuery()`
  - `OrganizationApi.useGetOrganizationMembersQuery()`
- Renders: stats cards, projects summary, top issues, problems trend, recent activity

**Status**: ✅ Implemented, ready to display data when available

### ✅ IMPLEMENTED - Infrastructure

#### 4. Istio VirtualService
**File**: repos/platform/deployments/metabob/charts/istio-application/charts/templates/virtualservice-backend.yaml:113-148

**Current Behavior**:
- Routes `/api/*` requests to `metabob-rpc-api:8080`
- Blue/green traffic split: 90% prod, 10% integration
- Header-based canary routing with `x-canary-env`

**Status**: ✅ Routing configured correctly

### ❌ MISSING - Backend Components

#### 5. Auth Router (CRITICAL GAP)
**Expected**: repos/metabob-rpc-api/server/routes/auth.py  
**Status**: ❌ **DOES NOT EXIST**

**Required Endpoints**:
```python
POST /auth/login          # Validate credentials, return JWT
POST /auth/register       # Create user + organization
GET /auth/session         # Validate JWT session
POST /auth/logout         # Invalidate session
GET /auth/orgs            # List user's organizations
GET /auth/orgs/:id        # Get organization details
GET /auth/orgs/:id/users  # List org members
POST /auth/orgs/:id/users # Invite user
GET /auth/orgs/:id/stats  # Organization statistics
GET /auth/orgs/:id/activity # Organization activity
GET /auth/orgs/:id/projects # Organization projects
```

**Dependencies**:
- SurrealDB connection
- PyJWT for token generation
- bcrypt for password hashing
- User/Organization models
- JWT auth middleware

**Impact**: **Login flow completely broken**

#### 6. SurrealDB Schema (CRITICAL GAP)
**Expected**: sql/surrealdb-schema-auth.sql  
**Status**: ❌ **UNDEFINED**

**Required Tables**:
```sql
-- users table
DEFINE TABLE users SCHEMAFULL;
DEFINE FIELD user_id ON users TYPE string;
DEFINE FIELD email ON users TYPE string;
DEFINE FIELD password_hash ON users TYPE string;
DEFINE FIELD name ON users TYPE string;
DEFINE FIELD org_id ON users TYPE string;
DEFINE FIELD created_at ON users TYPE datetime;
DEFINE INDEX email_unique ON users COLUMNS email UNIQUE;

-- organizations table
DEFINE TABLE organizations SCHEMAFULL;
DEFINE FIELD org_id ON organizations TYPE string;
DEFINE FIELD name ON organizations TYPE string;
DEFINE FIELD created_at ON organizations TYPE datetime;
```

**Impact**: **Cannot store or query users/organizations**

#### 7. JWT Authentication Middleware (CRITICAL GAP)
**Expected**: repos/metabob-rpc-api/server/utils/jwt_auth.py  
**Status**: ❌ **DOES NOT EXIST**

**Required Functionality**:
- Extract JWT from `Authorization: Bearer <token>` header
- Validate token signature and expiration
- Extract `user_id`, `org_id`, `email` from payload
- Inject into FastAPI request context
- Return 401 on invalid/expired tokens

**Impact**: **Cannot protect dashboard endpoints**

#### 8. Architecture Mismatch (DESIGN GAP)
**File**: repos/metabob-rpc-api/server/actions/auth.py:18-146

**Current Behavior**:
- Redis-based opaque session tokens (for CLI sessions)
- Base64-encoded session keys
- No JWT support

**Required Behavior**:
- Separate JWT-based authentication for dashboard users
- SurrealDB storage for user accounts
- bcrypt password hashing

**Impact**: **Need parallel auth systems (CLI opaque tokens + dashboard JWT)**

## Data Flow Breakdown

### Step-by-Step Trace (13 Steps)

| Step | Layer | Component | Status |
|------|-------|-----------|--------|
| 1 | Frontend - Login UI | CustomLogin.js | ✅ IMPLEMENTED |
| 2 | Frontend - API Client | CloudAuthApi.loginUser | ✅ IMPLEMENTED |
| 3 | Istio Gateway | VirtualService | ✅ IMPLEMENTED |
| 4 | **Backend - Auth Endpoint** | **auth_router** | ❌ **NOT IMPLEMENTED** |
| 5 | Database | SurrealDB users query | ❌ **SCHEMA UNDEFINED** |
| 6 | Backend - Password Validation | bcrypt.checkpw | ❌ **NOT IMPLEMENTED** |
| 7 | Backend - JWT Generation | jwt.encode | ❌ **NOT IMPLEMENTED** |
| 8 | Backend - Response | auth_router | ❌ **NOT IMPLEMENTED** |
| 9 | Frontend - Token Storage | localStorage | ✅ IMPLEMENTED |
| 10 | Frontend - Navigation | navigate('/cloud/dashboard') | ✅ IMPLEMENTED |
| 11 | Frontend - Dashboard Load | CloudDashboard.js | ✅ IMPLEMENTED |
| 12 | **Backend - Protected Endpoints** | **OrganizationApi** | ❌ **NOT IMPLEMENTED** |
| 13 | Frontend - UI Render | Dashboard components | ✅ IMPLEMENTED |

**Result**: Steps 1-3 work. Steps 4-8 fail (login). Steps 9-13 cannot execute (no auth data).

## Playwright Validation - BLOCKED

### Test Cases Status

All 6 test cases are **BLOCKED** due to missing backend:

1. ❌ **Load login page** - Pod running but can't test without auth
2. ❌ **Submit login form** - Endpoint does not exist
3. ❌ **Token storage** - Cannot test without working login
4. ❌ **Redirect to dashboard** - Cannot test without working login
5. ❌ **Load dashboard data** - Endpoints do not exist
6. ❌ **Render dashboard UI** - No data to render

**Expected Playwright Test**: `e2e-tests/dashboard-login-flow.spec.js`

```javascript
test('Complete login flow', async ({ page }) => {
  // Navigate to login
  await page.goto('http://app.metabob.local/');
  
  // Fill credentials
  await page.fill('[name="email"]', 'test@metabob.com');
  await page.fill('[name="password"]', 'testpass');
  
  // Intercept POST /api/auth/login
  const loginRequest = page.waitForResponse('/api/auth/login');
  await page.click('button[type="submit"]');
  
  // Verify response
  const response = await loginRequest;
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data).toHaveProperty('token');
  expect(data).toHaveProperty('user');
  expect(data).toHaveProperty('organizations');
  
  // Verify localStorage
  const token = await page.evaluate(() => localStorage.getItem('metabob_cloud_token'));
  expect(token).toBeTruthy();
  
  // Verify redirect
  await page.waitForURL('**/cloud/dashboard');
  
  // Verify dashboard data loads
  const statsRequest = page.waitForResponse('/auth/orgs/*/stats');
  const projectsRequest = page.waitForResponse('/auth/orgs/*/projects');
  
  // Verify UI renders
  await expect(page.locator('text=Organization Stats')).toBeVisible();
  await expect(page.locator('text=Projects Summary')).toBeVisible();
});
```

**Current Result**: All assertions fail - endpoints return 404.

## Implementation Order

### Phase 1: SurrealDB Schema (1 day)
**Deliverables**:
- [ ] `sql/surrealdb-schema-auth.sql` - users, organizations, user_organizations tables
- [ ] Password hashing with bcrypt
- [ ] Unique constraints on email, org_id

### Phase 2: Auth Router (2 days)
**Deliverables**:
- [ ] `server/routes/auth.py` - POST /auth/login, POST /auth/register
- [ ] `server/models/auth.py` - LoginRequest, LoginResponse, RegisterRequest, User, Organization
- [ ] JWT token generation with PyJWT
- [ ] Password validation with bcrypt
- [ ] Add `auth_router` to `server/app.py`

### Phase 3: JWT Auth Middleware (1 day)
**Deliverables**:
- [ ] `server/utils/jwt_auth.py` - JWT validation dependency for FastAPI
- [ ] Extract user_id, org_id from token
- [ ] Inject into request context
- [ ] 401 handling for invalid tokens

### Phase 4: Organization Endpoints (2 days)
**Deliverables**:
- [ ] GET /auth/orgs - List user's organizations
- [ ] GET /auth/orgs/:id/stats - Organization statistics
- [ ] GET /auth/orgs/:id/projects - Organization projects
- [ ] GET /auth/orgs/:id/users - Organization members
- [ ] GET /auth/orgs/:id/activity - Organization activity

### Phase 5: Playwright E2E Test (1 day)
**Deliverables**:
- [ ] `e2e-tests/dashboard-login-flow.spec.js`
- [ ] Test data seeding script
- [ ] Network assertion utilities
- [ ] localStorage verification helpers

### Phase 6: Execute Validation (1 day)
**Deliverables**:
- [ ] Run Playwright tests against deployed dashboard
- [ ] Capture screenshots at each step
- [ ] Verify network requests and responses
- [ ] Validate UI rendering
- [ ] Document validation results

**Total Estimated Time**: 8 days (3-5 days backend + 2-3 days testing)

## Next Steps

1. **Immediate**: Implement Phase 1 (SurrealDB schema) - foundation for all auth
2. **High Priority**: Implement Phase 2 (auth router) - unblock login flow
3. **Critical Path**: Complete Phases 1-4 before Playwright validation can begin
4. **Final**: Execute Playwright E2E validation once backend is complete

## Files Referenced

### Frontend (All Implemented ✅)
- `repos/metabob-dashboard/src/cloud/pages/CloudLogin/CustomLogin.js:1-244`
- `repos/metabob-dashboard/src/cloud/api/CloudAuthApi.js:222-237`
- `repos/metabob-dashboard/src/cloud/pages/CloudDashboard/index.js:39-331`
- `repos/metabob-dashboard/src/cloud/api/OrganizationApi.js:60-309`
- `repos/metabob-dashboard/src/cloud/api/ProjectApi.js:60-595`

### Infrastructure (Configured ✅)
- `repos/platform/deployments/metabob/charts/istio-application/charts/templates/virtualservice-backend.yaml:113-148`

### Backend (Missing ❌)
- ❌ `repos/metabob-rpc-api/server/routes/auth.py` - DOES NOT EXIST
- ❌ `sql/surrealdb-schema-auth.sql` - DOES NOT EXIST
- ❌ `repos/metabob-rpc-api/server/utils/jwt_auth.py` - DOES NOT EXIST
- ⚠️ `repos/metabob-rpc-api/server/app.py:55-84` - No auth router included
- ⚠️ `repos/metabob-rpc-api/server/actions/auth.py:18-146` - Redis opaque tokens only

## Impulse Created

**Impulse ID**: `trace-dashboard-login-flow-e2e-validation`  
**Type**: templateDefinition  
**Budget**: 5000 tokens  
**Content**: Full trace analysis (8 components, 13 data flow steps, 5 critical gaps)  

This impulse can be used by downstream validation and enforcement tasks to understand the complete implementation gap and guide backend development.
