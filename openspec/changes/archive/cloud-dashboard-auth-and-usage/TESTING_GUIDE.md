# Testing Guide: Cloud Dashboard Auth and Usage Features

This guide provides comprehensive testing instructions for the authentication, members management, usage analytics, and execution trace viewer features added to the cloud dashboard.

## Test Environment Setup

### Prerequisites

- Bun 1.0+ installed
- Access to local Kubernetes cluster (docker-desktop) OR
- Access to canary deployment at `https://app.metabob.com`

### Backend Services Required

- **user-vessel**: Authentication and user management (`identity.metabob.com`)
- **metabob-activity-api**: Activity traces and metrics (`activity.metabob.com`)

## Backend Testing (Tasks 7.1)

### Option 1: Automated Test Script

Run the comprehensive auth endpoint test script:

```bash
cd repos/user-vessel

# Test against local deployment
USER_VESSEL_URL=http://localhost:8080 ./test-auth-endpoints.sh

# Test against canary deployment
USER_VESSEL_URL=https://identity.metabob.com ./test-auth-endpoints.sh
```

**Expected Output:**
- ✓ Health check passed
- ✓ Signup endpoint working (creates org + user)
- ✓ Login endpoint working (returns JWT token)
- ✓ /auth/me endpoint working (returns user profile)
- ✓ Invalid password rejected (401 error)
- ✓ Duplicate email rejected (409 error)
- ✓ Weak password rejected (400 error)

### Option 2: Manual cURL Testing

If the test script is unavailable:

```bash
BASE_URL=http://localhost:8080  # Or https://identity.metabob.com

# 1. Test signup
curl -X POST "$BASE_URL/v2/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "name": "Test User",
    "org_name": "Test Organization"
  }'
# Expected: 201 Created with token and user object

# 2. Test login
curl -X POST "$BASE_URL/v2/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
# Expected: 200 OK with token and user object

# 3. Test /auth/me (replace TOKEN with actual token from login)
curl "$BASE_URL/v2/auth/me" \
  -H "Authorization: Bearer TOKEN"
# Expected: 200 OK with user profile
```

### Option 3: Unit Tests

Run bun test (currently no test files exist, but command is safe to run):

```bash
cd repos/user-vessel
bun test
```

**Expected Output:** `error: 0 test files matching` (this is expected - no test files exist yet)

## Frontend Testing (Task 7.2)

### Build Verification

Run the build process to check for TypeScript compilation errors:

```bash
cd repos/metabob-cloud-dashboard
bun run build
```

**Expected Output:**
```
✅ Build completed in ~200ms
```

**What it verifies:**
- All TypeScript files compile without errors
- All imports resolve correctly
- All new pages (Members, UsageAnalytics, ExecutionTraces) are valid
- React component syntax is correct
- No type mismatches

### Type Checking (Alternative)

If build is slow, use type checking directly:

```bash
cd repos/metabob-cloud-dashboard
bun run typecheck  # If script exists
# Or use tsc directly:
bunx tsc --noEmit
```

## Manual End-to-End Testing (Tasks 7.3-7.8)

### Test 7.3: Signup Flow

**Objective:** Verify new users can create accounts and are automatically logged in.

**Steps:**
1. Navigate to signup page (click "Sign up" link on login page)
2. Fill in signup form:
   - Email: `newuser@example.com`
   - Password: `SecurePassword123`
   - Name: `New User`
   - Organization Name: `New Org`
3. Click "Sign up" button

**Expected Results:**
- ✅ Form validation passes
- ✅ No error messages appear
- ✅ User is automatically redirected to dashboard
- ✅ User sees their name in the top right corner
- ✅ Organization name appears in sidebar or header

**Failure Scenarios to Test:**
- Weak password (< 8 chars): Should show error
- Duplicate email: Should show "Email already exists" error
- Missing fields: Should show validation errors

### Test 7.4: Login Flow

**Objective:** Verify existing users can log in with their credentials.

**Steps:**
1. Navigate to login page
2. Enter credentials:
   - Email: `newuser@example.com`
   - Password: `SecurePassword123`
3. Click "Sign in" button

**Expected Results:**
- ✅ Login succeeds
- ✅ User redirected to dashboard (API Keys page by default)
- ✅ User session persists on page refresh
- ✅ JWT token stored in sessionStorage

**Failure Scenarios:**
- Wrong password: Should show "Invalid credentials" error
- Non-existent email: Should show "User not found" error
- Empty fields: Should show validation errors

### Test 7.5: Members Page

**Objective:** Verify members list displays correctly with proper role badges.

**Steps:**
1. Log in as admin user
2. Click "Members" in sidebar navigation
3. Observe members list table

**Expected Results:**
- ✅ Page loads without errors
- ✅ Table displays with columns: Email, Name, Role, Joined Date
- ✅ Current user appears in the list
- ✅ Role badges display correctly (Admin = blue, Developer = green, Viewer = gray)
- ✅ Joined dates formatted correctly (e.g., "Mar 15, 2026")
- ✅ "Invite Member" button visible (admin only)
- ✅ Remove action buttons visible for other members (admin only)

**Admin Actions to Test:**
- Click "Invite Member" → Form modal appears
- Fill form → New member invited (API call succeeds)
- Click remove icon → Confirmation dialog appears
- Confirm removal → Member removed from list

**Non-Admin View:**
- Login as non-admin user (Developer or Viewer role)
- "Invite Member" button should be hidden or disabled
- Remove actions should be hidden or disabled

### Test 7.6: Usage Analytics Page

**Objective:** Verify usage metrics, charts, and cost breakdown display correctly.

**Steps:**
1. Log in to dashboard
2. Click "Usage Analytics" in sidebar
3. Observe page sections

**Expected Results:**

**Summary Cards:**
- ✅ Total Executions card with count
- ✅ Success Rate card with percentage
- ✅ Total Cost card with USD formatting ($X.XX)
- ✅ Avg Duration card with time formatting

**Token Consumption Chart:**
- ✅ Line or bar chart displays
- ✅ X-axis shows dates (last 30 days by default)
- ✅ Y-axis shows token counts
- ✅ Time range filter works (7 days, 30 days, 90 days)

**Cost Breakdown Table:**
- ✅ Table shows costs by LLM model
- ✅ Models listed (e.g., claude-sonnet-4, gpt-4)
- ✅ Token counts displayed
- ✅ Costs formatted as USD

**Usage by Member Table:**
- ✅ Lists members with execution counts
- ✅ Token usage per member
- ✅ Cost per member
- ✅ Sortable columns (optional)

**Most Used Activities:**
- ✅ Top 10 activity templates listed
- ✅ Execution counts shown
- ✅ Success rates displayed

**Trend Indicators:**
- ✅ Up/down arrows with percentages
- ✅ Green for positive trends, red for negative

### Test 7.7: Activity Traces Page

**Objective:** Verify execution traces list with filtering and pagination.

**Steps:**
1. Log in to dashboard
2. Click "Activity Traces" in sidebar
3. Observe traces list

**Expected Results:**

**Traces List:**
- ✅ List displays execution traces (most recent first)
- ✅ Each trace shows: Goal description, Activity name, Duration, Cost, Timestamp
- ✅ Status icons display correctly:
  - Green checkmark for completed
  - Red X for failed
  - Spinner for running
- ✅ Pagination works (50 traces per page)
- ✅ Scroll or "Load More" functionality

**Filters:**
- ✅ Status filter dropdown (All, Running, Completed, Failed)
  - Select "Failed" → Only failed traces shown
  - Select "Completed" → Only successful traces shown
- ✅ Search box filters by goal description
  - Type "fix bug" → Only traces with "fix bug" in goal shown
- ✅ Filters can be combined (e.g., Status=Failed + Search="auth")

**Interaction:**
- ✅ Click on a trace → Opens detail view (expand or navigate to detail page)

### Test 7.8: Trace Detail View

**Objective:** Verify full execution trace details display correctly.

**Steps:**
1. From Activity Traces page, click on a specific trace
2. Observe detail view (expanded section or separate page)

**Expected Results:**

**Header Section:**
- ✅ Goal description displayed prominently
- ✅ Activity template name shown
- ✅ Status badge (success/failed/running)
- ✅ Timestamp and duration

**Input Context:**
- ✅ Input impulses listed (if any)
- ✅ Variables/parameters displayed
- ✅ Initial state shown

**Task Progression:**
- ✅ Tasks listed in execution order
- ✅ Each task shows:
  - Task description
  - Status (pending, running, completed, failed)
  - Duration
- ✅ Current task highlighted (if running)
- ✅ Failed task highlighted in red

**Tool Calls Section:**
- ✅ Tool calls listed chronologically
- ✅ Each tool call shows:
  - Tool name (e.g., bash, read_file, write_file)
  - Parameters (expandable/collapsible)
  - Output/result (expandable/collapsible)
  - Success/failure status
- ✅ Long outputs truncated with "Show more" option

**State Changes:**
- ✅ Files created listed
- ✅ Files modified listed
- ✅ Files deleted listed
- ✅ File paths displayed correctly

**Execution Metrics:**
- ✅ Total duration (ms or seconds)
- ✅ Total cost (USD)
- ✅ Total tokens used
- ✅ LLM model used
- ✅ Success/failure indicator

**Error Details (if failed):**
- ✅ Error message displayed
- ✅ Stack trace shown (if available)
- ✅ Failed task identified

## Browser Testing Matrix

Test in multiple browsers to ensure compatibility:

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | ✅ Primary target |
| Firefox | Latest | ✅ Recommended |
| Safari | Latest | ✅ Recommended |
| Edge | Latest | ✅ Supported |

## Responsive Design Testing

Test dashboard at different screen sizes:

| Screen Size | Width | Expected Behavior |
|-------------|-------|-------------------|
| Desktop | 1920px | Full layout, sidebar visible |
| Laptop | 1366px | Full layout, sidebar visible |
| Tablet | 768px | Sidebar collapses to hamburger menu |
| Mobile | 375px | Mobile-optimized layout |

## Performance Testing

### Page Load Times

Expected load times (on fast connection):

- Login page: < 500ms
- Dashboard (after auth): < 1s
- Members page: < 1s
- Usage Analytics page: < 2s (includes chart rendering)
- Activity Traces page: < 1.5s (50 traces)
- Trace Detail view: < 800ms

### API Response Times

Expected response times for key endpoints:

- `POST /v2/auth/signup`: < 200ms
- `POST /v2/auth/login`: < 100ms
- `GET /v2/users`: < 150ms
- `GET /v2/costs`: < 300ms
- `GET /v2/activities/execution-traces`: < 500ms

## Security Testing

### Authentication Security

Test these security scenarios:

1. **Token expiry**: Wait 15 minutes, try to access protected page
   - Expected: Redirected to login
2. **Invalid token**: Manually edit token in sessionStorage to invalid value
   - Expected: Redirected to login with error
3. **No token**: Clear sessionStorage, try to access protected page
   - Expected: Redirected to login
4. **XSS prevention**: Try to inject `<script>alert('xss')</script>` in form fields
   - Expected: Escaped/sanitized, not executed

### RBAC Testing

Test role-based access control:

1. **Admin user**: Should see all features, all actions enabled
2. **Developer user**: Limited access (no user management)
3. **Viewer user**: Read-only access (no create/update/delete actions)

## Accessibility Testing

Basic accessibility checks:

- ✅ All buttons have accessible labels
- ✅ Form inputs have associated labels
- ✅ Color contrast meets WCAG AA standards
- ✅ Keyboard navigation works (Tab, Enter, Escape)
- ✅ Screen reader friendly (use NVDA or VoiceOver to test)

## Common Issues and Solutions

### Issue: "Network Error" on signup/login

**Possible Causes:**
- Backend service not running
- CORS misconfiguration
- Wrong API endpoint in dashboard config

**Solution:**
- Verify backend health: `curl http://localhost:8080/health`
- Check browser console for CORS errors
- Verify `USER_VESSEL_URL` environment variable

### Issue: Empty members list

**Possible Causes:**
- No members in organization
- API endpoint not connected
- Wrong org_id in JWT

**Solution:**
- Verify users exist in database
- Check API request in Network tab
- Verify JWT claims include correct org_id

### Issue: Charts not rendering

**Possible Causes:**
- No data available
- Recharts library not loaded
- JavaScript error in chart component

**Solution:**
- Check browser console for errors
- Verify API returns data: `curl http://activity.metabob.com/v2/costs`
- Ensure date range has data

### Issue: Traces list empty

**Possible Causes:**
- No executions recorded
- Filters too restrictive
- API endpoint misconfigured

**Solution:**
- Run a MiniBob activity to generate traces
- Clear all filters
- Verify endpoint: `curl http://activity.metabob.com/v2/activities/execution-traces`

## Test Data Setup

### Create Test Organization and Users

```bash
# Signup creates org + first user (admin)
curl -X POST http://localhost:8080/v2/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@testorg.com",
    "password": "AdminPassword123",
    "name": "Admin User",
    "org_name": "Test Organization"
  }'

# Extract token from response, then create additional users
# (requires admin privileges)
curl -X POST http://localhost:8080/v2/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@testorg.com",
    "password": "DevPassword123",
    "name": "Developer User",
    "role": "developer"
  }'
```

### Generate Test Execution Traces

Use MiniBob to generate test traces:

```bash
# Run a simple activity
minibob --single "list files in current directory"

# Run multiple activities to populate traces
minibob --single "create a test file"
minibob --single "read the test file"
minibob --single "delete the test file"
```

## Automated Testing (Future)

### Playwright E2E Tests

The dashboard includes Playwright for automated browser testing:

```bash
cd repos/metabob-cloud-dashboard

# Run all E2E tests
bun run test:e2e

# Run with UI (interactive mode)
bun run test:e2e:ui

# Run in headed mode (see browser)
bun run test:e2e:headed
```

**Test coverage to add** (future work):
- Signup flow test
- Login flow test
- Members CRUD operations
- Usage analytics data loading
- Traces filtering and detail view

## Testing Sign-off Checklist

Before marking testing complete, verify all these items:

**Backend:**
- [ ] All auth endpoints respond correctly
- [ ] Password validation working (8+ chars, uppercase, lowercase, number)
- [ ] JWT tokens generated with correct claims
- [ ] Duplicate email detection working
- [ ] User/org creation atomic (both created or neither)

**Frontend Build:**
- [ ] `bun run build` succeeds with no errors
- [ ] All TypeScript compilation passes
- [ ] No missing imports or type errors

**Signup/Login:**
- [ ] New users can sign up
- [ ] Auto-login after signup works
- [ ] Existing users can log in
- [ ] Invalid credentials rejected
- [ ] Session persists on refresh

**Members Page:**
- [ ] Members list loads
- [ ] Role badges display correctly
- [ ] Invite member works (admin)
- [ ] Remove member works (admin)
- [ ] Non-admins see read-only view

**Usage Analytics:**
- [ ] Summary cards display metrics
- [ ] Token consumption chart renders
- [ ] Cost breakdown table shows data
- [ ] Usage by member table populated
- [ ] Most used activities listed
- [ ] Time range filter works

**Activity Traces:**
- [ ] Traces list loads and displays
- [ ] Status filter works
- [ ] Search filter works
- [ ] Pagination works
- [ ] Trace detail view opens

**Trace Detail:**
- [ ] Goal and activity name shown
- [ ] Task progression displayed
- [ ] Tool calls listed with expand/collapse
- [ ] State changes (files) shown
- [ ] Execution metrics displayed
- [ ] Error details shown (if failed)

**Cross-Browser:**
- [ ] Chrome tested
- [ ] Firefox tested
- [ ] Safari tested (if available)

**Security:**
- [ ] Token expiry enforced
- [ ] Invalid tokens rejected
- [ ] RBAC enforced (admin vs member)

---

## Next Steps After Testing

Once all tests pass:
1. Document any issues found → Create GitHub issues
2. Fix critical bugs before deployment
3. Proceed to deployment preparation (see DEPLOYMENT_CHECKLIST.md)
4. Push to `dev` branch to trigger canary deployment
