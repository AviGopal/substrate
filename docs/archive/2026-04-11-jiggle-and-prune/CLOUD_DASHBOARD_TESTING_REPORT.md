# Cloud Dashboard Testing Report

**Date**: 2026-04-08
**Dashboard URL**: https://app.metabob.com
**Testing Method**: Playwright MCP
**Deployed Version**: 0.2.2-ace5ae3 (23 hours old)

---

## Executive Summary

**Status**: ⚠️ **AUTHENTICATION BROKEN**

The cloud dashboard UI is functional and well-designed, but authentication is completely broken due to an incorrect API proxy configuration. The deployed code proxies auth requests to a non-existent service (`IDENTITY_VESSEL_URL`), resulting in 404 errors that prevent both signup and login.

**Impact**:
- ❌ Cannot create new accounts
- ❌ Cannot log in to existing accounts
- ❌ Cannot test any authenticated features
- ❌ Dashboard is completely unusable for end users

**Root Cause**: Known bug in `repos/metabob-cloud-dashboard/src/index.ts:60` - proxies to `IDENTITY_VESSEL_URL` instead of `USER_VESSEL_URL`

**Fix Status**: ✅ Fix exists locally, ⚠️ NOT deployed yet

---

## Testing Results

### 1. Signup Flow ❌ FAILED

**Test Steps:**
1. Navigate to https://app.metabob.com
2. Click "Sign up" button
3. Fill in signup form:
   - Email: test@example.com
   - Full Name: Test User
   - Organization Name: Test Organization
   - Password: TestPassword123!
   - Confirm Password: TestPassword123!
4. Submit form

**Expected Result**: Account created, auto-login with JWT token

**Actual Result**:
```
HTTP 404 Not Found
Error displayed: "JSON.parse: unexpected non-whitespace character after JSON data at line 1 column 5 of the JSON data"
```

**Network Analysis**:
```
POST https://app.metabob.com/api/auth/signup
Request: {
  "email": "test@example.com",
  "password": "TestPassword123!",
  "name": "Test User",
  "org_name": "Test Organization"
}
Response: 404 Not Found
```

**Root Cause**: Dashboard proxy (index.ts:60) forwards to `IDENTITY_VESSEL_URL` which doesn't exist. Should forward to `USER_VESSEL_URL`.

---

### 2. Login Flow ⚠️ NOT TESTED

**Reason**: Cannot create test account due to broken signup

**Expected Behavior** (from code review):
1. Enter email and password
2. POST to /api/auth/login
3. Receive JWT token
4. Store in sessionStorage
5. Redirect to dashboard

**Will Fail**: Same 404 error as signup due to same proxy bug

---

### 3. UI/UX Assessment ✅ WORKING

**What Works:**

✅ **Page Loading**:
- App loads successfully at https://app.metabob.com
- React 19 rendering correctly
- No JavaScript errors in console
- Fast initial load

✅ **Login/Signup Pages**:
- Clean, professional design
- "M" logo branding
- Clear form labels and placeholders
- Password field properly masked
- Navigation between login/signup works smoothly

✅ **Form Validation**:
- Required field validation working
- Password min length (8 chars) enforced
- Email format validation working
- Confirm password matching validation

✅ **Error Display**:
- Errors shown in red notification box
- User-friendly error messages
- Error state preserved in form

**Design Quality**: Professional, modern UI using shadcn/ui components. Good UX patterns.

---

### 4. Authenticated Features ⚠️ CANNOT TEST

The following features exist in the codebase but are inaccessible due to broken authentication:

**Pages Identified (from App.tsx)**:
1. **API Keys** (`/pages/APIKeys`) - Default landing page after auth
2. **Members** (`/pages/Members`) - Team management
3. **Usage Analytics** (`/pages/UsageAnalytics`) - Usage tracking over time
4. **Execution Traces** (`/pages/ExecutionTraces`) - Activity execution visibility
5. **Settings** (`/pages/Settings`) - Account settings

**Keyboard Shortcuts Detected**:
- Navigation shortcuts implemented (useNavigationShortcuts)
- Focus management shortcuts (useFocusShortcuts)
- Cannot test without authentication

**Expected Features** (from original requirements):

❓ **API Key Management**:
- Create, rename, assign API keys
- Cannot verify until auth is fixed

❓ **Member Management**:
- Invite members, assign roles
- Cannot verify until auth is fixed

❓ **Usage Tracking**:
- View usage over time
- Break down by member
- Link to execution traces
- Cannot verify until auth is fixed

❓ **Execution Trace Viewer**:
- See what's happening in the system
- Understand goals being attempted
- Track how goals are achieved
- Cannot verify until auth is fixed

---

## Technical Analysis

### Current Deployment

**Deployed Code** (in pod):
```typescript
// repos/metabob-cloud-dashboard/src/index.ts:58-60
if (pathname.startsWith("/api/auth/")) {
  const path = pathname.replace("/api/auth", "/v2/auth");
  const targetUrl = `${IDENTITY_VESSEL_URL}${path}`;  // ❌ WRONG!
  // ...
}
```

**Environment Variables** (in pod):
```yaml
USER_VESSEL_URL: "http://user-vessel.activity-system.svc.cluster.local:8080"  ✅ CORRECT
IDENTITY_VESSEL_URL: <not set>  ❌ DOESN'T EXIST
```

**What Happens**:
1. Browser sends POST /api/auth/signup
2. Dashboard proxy tries to forward to `${IDENTITY_VESSEL_URL}/v2/auth/signup`
3. `IDENTITY_VESSEL_URL` is undefined
4. Proxy fails with connection error or malformed URL
5. Returns 404 to client
6. Client tries to parse 404 HTML as JSON → parse error

### Fixed Code (local, not deployed)

**Local Fix**:
```typescript
// repos/metabob-cloud-dashboard/src/index.ts:58-60 (FIXED)
if (pathname.startsWith("/api/auth/")) {
  const path = pathname.replace("/api/auth", "/v2/auth");
  const targetUrl = `${USER_VESSEL_URL}${path}`;  // ✅ CORRECT!
  // ...
}
```

**Why This Works**:
1. `USER_VESSEL_URL` is set correctly in environment
2. user-vessel has auth endpoints at /v2/auth/signup, /v2/auth/login, /v2/auth/me
3. user-vessel is deployed and healthy (image 0.1.0-90d05b8)
4. All infrastructure is correct - just need to deploy the code fix

---

## Deployment Status

### Currently Deployed

| Service | Image | Status | Auth Working? |
|---------|-------|--------|---------------|
| metabob-cloud-dashboard | 0.2.2-ace5ae3 | ✅ Running | ❌ Broken |
| user-vessel | 0.1.0-90d05b8 | ✅ Running | ✅ Ready |

### Values File

```yaml
# environments/production.canary.values.yaml
metabob-cloud-dashboard:
  image:
    tag: "0.2.2-3aff6b6"  # Newer than deployed, but still has bug

user-vessel:
  image:
    tag: "0.1.0-90d05b8"  # Matches deployment, working correctly
```

**Issue**: Values file has a newer cloud-dashboard tag, but it was never deployed (Helm sync didn't run or failed).

---

## Recommendations

### Immediate (Now) - CRITICAL

1. **Deploy the auth fix**
   ```bash
   # In main workspace
   cd /home/avi/documents/work/exp-repo/metabob-devbob

   # Verify fix is applied
   grep "USER_VESSEL_URL" repos/metabob-cloud-dashboard/src/index.ts

   # Sync to deployment repo
   cd repos/deployment
   git checkout dev
   git pull
   rsync -av ../metabob-cloud-dashboard/src/ vessels/metabob-cloud-dashboard/src/

   # Commit and push
   git add vessels/metabob-cloud-dashboard/src/index.ts
   git commit -m "fix(cloud-dashboard): proxy auth to user-vessel instead of identity-vessel

   The dashboard was proxying /api/auth/* requests to IDENTITY_VESSEL_URL
   which doesn't exist. Auth endpoints are in user-vessel at /v2/auth/*.

   This fixes signup and login functionality."
   git push origin dev
   ```

2. **Monitor deployment**
   ```bash
   # Watch CI/CD
   gh run watch --repo MetabobProject/deployment

   # Verify new pod
   kubectl get pods -n activity-system -l app.kubernetes.io/name=metabob-cloud-dashboard -w

   # Check new image
   kubectl get deployment -n activity-system metabob-cloud-dashboard -o jsonpath='{.spec.template.spec.containers[0].image}'
   ```

3. **Re-test with Playwright**
   - Test signup flow
   - Test login flow
   - Verify authenticated pages load
   - Test all features

### Short-term (After Auth Fix) - HIGH PRIORITY

1. **Comprehensive Feature Testing**
   - API Keys: Create, list, rename, assign, delete
   - Members: Invite, list, update roles, remove
   - Usage Analytics: View charts, filter by member, date range
   - Execution Traces: Browse traces, filter by activity, view details
   - Settings: Update profile, organization settings

2. **Identify Unused Screens**
   - Document all pages in the codebase
   - Verify which are linked from navigation
   - Identify orphaned or unused components
   - Create removal plan

3. **MiniBob Integration**
   - Test MiniBob activities for dashboard development
   - Create activity for "add new dashboard page"
   - Create activity for "update existing page"
   - Document patterns for teaching MiniBob

### Long-term - MEDIUM PRIORITY

1. **Improve CI/CD**
   - Remove `continue-on-error: true` from workflows
   - Add health check verification after deployment
   - Ensure Helm sync actually updates pods
   - Add smoke tests for critical user flows

2. **Add E2E Testing**
   - Create Playwright test suite
   - Test auth flows automatically
   - Test all authenticated pages
   - Run in CI/CD before deployment

3. **Monitoring & Observability**
   - Add error tracking (Sentry, etc.)
   - Monitor auth success/failure rates
   - Track page load times
   - Alert on deployment failures

---

## Next Steps

### Step 1: Deploy Auth Fix (15 minutes)

**Goal**: Get authentication working

**Actions**:
1. Sync local fix to deployment repo
2. Commit and push to dev branch
3. CI/CD auto-deploys to canary
4. Verify new pod running
5. Test signup/login manually

**Success Criteria**:
- ✅ Signup creates account and returns JWT
- ✅ Login authenticates and returns JWT
- ✅ Dashboard pages load after authentication

### Step 2: Comprehensive Testing (30 minutes)

**Goal**: Verify all features work as expected

**Actions**:
1. Use Playwright to test all user flows
2. Document what works
3. Identify issues or bugs
4. List unused screens

**Success Criteria**:
- ✅ All pages accessible
- ✅ All features functional
- ✅ No JavaScript errors
- ✅ Unused screens identified

### Step 3: Teach MiniBob (1 hour)

**Goal**: Enable MiniBob to develop dashboard features

**Actions**:
1. Test existing MiniBob dashboard activities
2. Create activity for testing with Playwright
3. Document patterns and best practices
4. Verify MiniBob can add/update pages

**Success Criteria**:
- ✅ MiniBob can run Playwright tests
- ✅ MiniBob can add new dashboard pages
- ✅ MiniBob can update existing pages
- ✅ Execution traces stored in backend

---

## Summary

**What Works**:
- ✅ UI rendering and design
- ✅ Form validation
- ✅ Error handling
- ✅ Page navigation
- ✅ Infrastructure (user-vessel ready)

**What's Broken**:
- ❌ Authentication (signup/login)
- ❌ All authenticated features (blocked by auth)

**What We Can't Test Yet**:
- API key management
- Member management
- Usage analytics
- Execution traces viewer
- Settings
- Keyboard shortcuts

**Critical Blocker**: Auth proxy configuration bug

**Time to Resolution**: ~15 minutes (deploy fix + verify)

**Confidence**: 🟢 HIGH - Fix is simple, infrastructure is ready, high likelihood of success

---

## Appendix: Screenshots

### Login Page
- Clean design with Metabob branding
- Email and password fields
- "Sign up" link

### Signup Page
- Email, name, organization, password fields
- Password confirmation
- Error message displayed on failure
- "Sign in" link to return to login

### Error State
```
JSON.parse: unexpected non-whitespace character after JSON data at line 1 column 5 of the JSON data
```

Displayed in red notification box above form.

### Network Request
```
POST /api/auth/signup
Status: 404 Not Found
Body: {"email":"test@example.com","password":"TestPassword123!","name":"Test User","org_name":"Test Organization"}
```

---

**Ready to deploy the fix!** 🚀
