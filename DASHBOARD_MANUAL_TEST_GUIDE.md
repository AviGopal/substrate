# Dashboard Manual Test Guide

**Date**: 2026-04-09
**Dashboard URL**: https://app.metabob.com
**Status**: ✅ Authentication working, ready for full testing

---

## Pre-Test Verification

Both signup and login are working via API:

```bash
# Test Signup
curl -X POST https://app.metabob.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","org_name":"Test Org","name":"Test User"}'

# Test Login
curl -X POST https://app.metabob.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"success@metabob.com","password":"Success123"}'
```

Both return: `{"token":"...","user":{...},"org":{...}}`

---

## Test Credentials

**Account 1** (Already created):
- Email: `success@metabob.com`
- Password: `Success123`
- Org: `Success Org`

**Create New Accounts** as needed during testing.

---

## Test Plan

### 1. Initial Load

**URL**: https://app.metabob.com

**Expected**:
- [  ] Page loads without errors
- [  ] Shows login form with:
  - Email input
  - Password input
  - "Sign in" button
  - "Sign up" link

**Check Browser Console**: Should have no errors

---

### 2. Signup Flow

**Steps**:
1. Click "Sign up" link
2. Fill form:
   - Email: `test-manual@metabob.com`
   - Full Name: `Manual Test User`
   - Organization Name: `Manual Test Org`
   - Password: `Manual123`
   - Confirm Password: `Manual123`
3. Click "Sign up" button

**Expected**:
- [  ] Form submits without error
- [  ] Receives JWT token
- [  ] Auto-logs in and redirects to dashboard
- [  ] Shows dashboard with navigation menu

**If Fails**:
- Check Network tab for `/api/auth/signup` request
- Check response body for error message
- Verify password meets requirements (8+ chars)

---

### 3. Logout (if available)

**Steps**:
1. Look for logout button in header/menu
2. Click logout

**Expected**:
- [  ] Redirects to login page
- [  ] JWT token cleared
- [  ] Cannot access protected pages

---

### 4. Login Flow

**Steps**:
1. Go to https://app.metabob.com
2. Enter credentials:
   - Email: `success@metabob.com`
   - Password: `Success123`
3. Click "Sign in"

**Expected**:
- [  ] Form submits successfully
- [  ] Receives JWT token
- [  ] Redirects to dashboard (default: API Keys page)
- [  ] Shows user info (name, org) in header

**If Fails**:
- Check Network tab for `/api/auth/login` request
- Check response: should be 200 with token, user, org
- Verify credentials are correct

---

### 5. Navigation

**Test all menu items**:

- [  ] API Keys - Accessible
- [  ] Members - Accessible
- [  ] Usage Analytics - Accessible
- [  ] Execution Traces - Accessible
- [  ] Settings - Accessible

**Keyboard Shortcuts** (if implemented):
- Ctrl+1 → API Keys
- Ctrl+2 → Members
- Ctrl+3 → Usage Analytics
- Ctrl+4 → Execution Traces
- Ctrl+5 → Settings

---

### 6. API Keys Management

**URL**: Should be default page after login

**Initial State**:
- [  ] Shows "API Keys" heading
- [  ] Shows table/list of API keys (may be empty)
- [  ] Has "Create API Key" button

**Create API Key**:
1. Click "Create API Key" button
2. Fill form:
   - Name: `Test Key`
   - Scope: (select appropriate scope if available)
3. Click "Create" or "Generate"

**Expected**:
- [  ] API key generated
- [  ] Shows key value (one-time display warning)
- [  ] Key appears in list with:
  - Name: `Test Key`
  - Created date
  - Last used (if tracked)
  - Actions: Rename, Revoke, Copy

**Copy Key**:
- [  ] Click copy button
- [  ] Verify key copied to clipboard

**Rename Key**:
1. Click "Rename" or edit icon
2. Change name to `Test Key Renamed`
3. Save

**Expected**:
- [  ] Name updates in list
- [  ] Shows success message

**Revoke Key**:
1. Click "Revoke" or delete icon
2. Confirm deletion (if prompted)

**Expected**:
- [  ] Key removed from list
- [  ] Shows success message
- [  ] Key no longer works for API calls

**Backend API Endpoint**:
```
GET    /v2/api-keys          - List keys
POST   /v2/api-keys          - Create key
PATCH  /v2/api-keys/:id      - Rename key
DELETE /v2/api-keys/:id      - Revoke key
```

---

### 7. Members Management

**Navigate**: Click "Members" in navigation

**Expected**:
- [  ] Shows "Members" heading
- [  ] Shows list/table of organization members
- [  ] Current user appears in list with "admin" role

**If Add Member Available**:
1. Click "Add Member" or "Invite"
2. Fill form:
   - Email: `newmember@example.com`
   - Name: `New Member`
   - Role: `member` (or select from dropdown)
3. Submit

**Expected**:
- [  ] Member added to list
- [  ] Shows success message
- [  ] Member can login (if email invitation sent)

**Role Management** (if available):
1. Find member in list
2. Click role dropdown or edit
3. Change role (admin ↔ member)
4. Save

**Expected**:
- [  ] Role updates
- [  ] Shows success message

**Remove Member** (if available):
1. Click remove/delete icon
2. Confirm

**Expected**:
- [  ] Member removed from list
- [  ] Member loses access

**Backend API Endpoint**:
```
GET    /v2/organizations/:org_id/members
POST   /v2/organizations/:org_id/members
PATCH  /v2/organizations/:org_id/members/:id
DELETE /v2/organizations/:org_id/members/:id
```

---

### 8. Usage Analytics

**Navigate**: Click "Usage Analytics" in navigation

**Expected Visual Elements**:
- [  ] Shows "Usage Analytics" heading
- [  ] Time-series chart/graph of usage over time
- [  ] Metrics displayed:
  - Total API calls
  - Total cost
  - Token usage
  - Executions count
- [  ] Filter controls:
  - Date range picker
  - Member filter (dropdown)
  - Activity type filter (if available)

**Test Filters**:

**Date Range**:
1. Select date range (e.g., "Last 7 days", "Last 30 days")
2. Apply

**Expected**:
- [  ] Chart updates to show selected date range
- [  ] Metrics recalculate for selected period

**Member Filter**:
1. Select specific member from dropdown
2. Apply

**Expected**:
- [  ] Shows usage only for that member
- [  ] Chart and metrics update

**Chart Interaction**:
- [  ] Hover over data points shows tooltips
- [  ] X-axis shows dates/times
- [  ] Y-axis shows usage metrics
- [  ] Legend identifies different metrics

**Backend API Endpoint**:
```
GET /v2/usage/analytics
  ?start_date=YYYY-MM-DD
  &end_date=YYYY-MM-DD
  &user_id=xxx
  &org_id=xxx
```

---

### 9. Execution Traces

**Navigate**: Click "Execution Traces" in navigation

**Expected Visual Elements**:
- [  ] Shows "Execution Traces" heading
- [  ] Table/list of recent activity executions
- [  ] Each trace shows:
  - Activity name
  - Goal/description
  - Status (success/failure)
  - Duration
  - Cost
  - Timestamp
  - View details button/link

**List View**:
- [  ] Shows most recent executions first
- [  ] Pagination controls (if > 10-20 items)
- [  ] Filter/search controls

**Filters** (if available):
1. Status filter (success/failure/all)
2. Activity type filter
3. Date range
4. User/member filter

**View Trace Details**:
1. Click on a trace or "View" button
2. Should show detail modal/page

**Expected in Detail View**:
- [  ] Full activity name
- [  ] Goal/description
- [  ] Input parameters
- [  ] Task-by-task execution log:
  - Task name
  - Status
  - Duration
  - Output
- [  ] Final outcome (success/failure)
- [  ] Cost breakdown
- [  ] Token usage
- [  ] Timestamp
- [  ] Close/back button

**Real-time Updates** (if implemented):
- [  ] New executions appear automatically
- [  ] Status updates in real-time

**Backend API Endpoint**:
```
GET /v2/activities/execution-traces
  ?limit=50
  &offset=0
  &status=success|failure
  &activity_id=xxx
  &org_id=xxx

GET /v2/activities/execution-traces/:id
```

---

### 10. Settings

**Navigate**: Click "Settings" in navigation

**Expected Sections**:

**Profile Settings**:
- [  ] User name (editable)
- [  ] Email (display only or editable)
- [  ] Password change form
  - Current password
  - New password
  - Confirm new password
  - Save button

**Organization Settings**:
- [  ] Organization name (editable)
- [  ] Subscription tier (display)
- [  ] Seat usage / seat limit
- [  ] Upgrade plan button (if available)

**Preferences** (if available):
- [  ] Theme (light/dark)
- [  ] Notifications settings
- [  ] Language

**Test Password Change**:
1. Enter current password
2. Enter new password (must meet requirements)
3. Confirm new password
4. Save

**Expected**:
- [  ] Shows success message
- [  ] Can login with new password
- [  ] Old password no longer works

**Test Org Name Change**:
1. Edit organization name
2. Save

**Expected**:
- [  ] Updates immediately
- [  ] Shows in header/navigation

---

## Error Handling Tests

### Invalid Login

**Test**: Login with wrong password

**Expected**:
- [  ] Shows error: "Invalid email or password"
- [  ] Does not reveal if email exists (security)
- [  ] Form stays on login page

### Session Expiration

**Test**:
1. Login
2. Wait for JWT to expire (15 minutes by default)
3. Try to access protected page

**Expected**:
- [  ] Redirects to login
- [  ] Shows message: "Session expired"
- [  ] Can login again

### Network Errors

**Test**: Disconnect network and try to login

**Expected**:
- [  ] Shows error: "Network error" or "Unable to connect"
- [  ] Doesn't crash the app
- [  ] Can retry when network restored

---

## Performance Tests

### Page Load Times

Measure with browser DevTools Network tab:

- [  ] Initial page load: < 2 seconds
- [  ] Login/signup: < 1 second
- [  ] API Keys page: < 1 second
- [  ] Usage Analytics (with charts): < 3 seconds
- [  ] Execution Traces: < 2 seconds

### Responsiveness

Test at different viewport sizes:

- [  ] Desktop (1920x1080): All features accessible
- [  ] Laptop (1366x768): All features accessible
- [  ] Tablet (768x1024): Layout adjusts, usable
- [  ] Mobile (375x667): Mobile-friendly or shows warning

---

## Browser Compatibility

Test in multiple browsers:

- [  ] Chrome/Chromium (latest)
- [  ] Firefox (latest)
- [  ] Safari (latest, if on macOS)
- [  ] Edge (latest)

All features should work identically.

---

## Security Tests

### JWT Token Handling

1. Login
2. Open DevTools → Application → Local Storage or Session Storage
3. Find JWT token

**Verify**:
- [  ] Token is stored securely
- [  ] Token includes required claims (user_id, org_id, role)
- [  ] Token has expiration time

### XSS Protection

**Test**: Try to inject script in form fields

Example: `<script>alert('xss')</script>`

**Expected**:
- [  ] Input is sanitized
- [  ] Script doesn't execute
- [  ] Shows escaped text or validation error

### Authorization

1. Login as regular member (not admin)
2. Try to access admin-only features

**Expected**:
- [  ] Admin features hidden or disabled
- [  ] API returns 403 Forbidden
- [  ] Shows appropriate error message

---

## Accessibility Tests

### Keyboard Navigation

- [  ] Can tab through all form fields
- [  ] Can submit forms with Enter
- [  ] Can close modals with Escape
- [  ] Focus indicators visible

### Screen Reader

If available, test with screen reader:

- [  ] Form labels announced correctly
- [  ] Error messages announced
- [  ] Page structure clear (headings, regions)
- [  ] Interactive elements have proper ARIA labels

---

## Known Issues to Watch For

From development/debugging:

1. **Password validation**: Passwords with special characters (!, @, #) may cause JSON parsing issues
   - Use alphanumeric passwords for now: `Test1234` instead of `Test123!`

2. **Cached connections**: If login fails with "Anonymous access", the root DB connection lost auth
   - This should be fixed now, but watch for it

3. **Transaction parsing**: Signup creates org and user in a transaction
   - Should now work, but verify both org and user are created

---

## Test Results Template

```markdown
## Test Results - [Date]

**Tester**: [Name]
**Browser**: [Browser + Version]
**Environment**: https://app.metabob.com

### Summary
- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X

### Details

| Test | Status | Notes |
|------|--------|-------|
| Initial Load | ✅ / ❌ | |
| Signup Flow | ✅ / ❌ | |
| Login Flow | ✅ / ❌ | |
| API Keys - List | ✅ / ❌ | |
| API Keys - Create | ✅ / ❌ | |
| API Keys - Rename | ✅ / ❌ | |
| API Keys - Revoke | ✅ / ❌ | |
| Members - List | ✅ / ❌ | |
| Members - Add | ✅ / ❌ | |
| Usage Analytics | ✅ / ❌ | |
| Execution Traces | ✅ / ❌ | |
| Settings | ✅ / ❌ | |

### Bugs Found
1. [Description]
   - Steps to reproduce
   - Expected vs actual
   - Severity: Critical / High / Medium / Low

### Suggestions
- [Improvement ideas]
```

---

## Automated Testing Script (Playwright)

When Playwright is available, use this script:

```typescript
// test-dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E Tests', () => {
  const baseURL = 'https://app.metabob.com';
  const testUser = {
    email: 'test-auto@metabob.com',
    password: 'AutoTest123',
    name: 'Automated Test User',
    orgName: 'Automated Test Org'
  };

  test('complete signup flow', async ({ page }) => {
    await page.goto(baseURL);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await page.getByPlaceholder('Email').fill(testUser.email);
    await page.getByPlaceholder('Full Name').fill(testUser.name);
    await page.getByPlaceholder('Organization Name').fill(testUser.orgName);
    await page.getByPlaceholder('Password', { exact: true }).fill(testUser.password);
    await page.getByPlaceholder('Confirm Password').fill(testUser.password);

    await page.getByRole('button', { name: 'Sign up' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*app.metabob.com/, { timeout: 5000 });
    await expect(page.getByText('API Keys')).toBeVisible();
  });

  test('complete login flow', async ({ page }) => {
    await page.goto(baseURL);

    await page.getByPlaceholder('Email').fill('success@metabob.com');
    await page.getByPlaceholder('Password').fill('Success123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*app.metabob.com/, { timeout: 5000 });
    await expect(page.getByText('API Keys')).toBeVisible();
  });

  test('create and revoke API key', async ({ page }) => {
    // Login first
    await page.goto(baseURL);
    await page.getByPlaceholder('Email').fill('success@metabob.com');
    await page.getByPlaceholder('Password').fill('Success123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/.*app.metabob.com/, { timeout: 5000 });

    // Create API key
    await page.getByRole('button', { name: 'Create API Key' }).click();
    await page.getByPlaceholder('Key name').fill('Test Key');
    await page.getByRole('button', { name: 'Create' }).click();

    // Key should appear in list
    await expect(page.getByText('Test Key')).toBeVisible();

    // Revoke key
    await page.getByRole('button', { name: 'Revoke' }).first().click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Key should be removed
    await expect(page.getByText('Test Key')).not.toBeVisible();
  });
});
```

---

## Success Criteria

Dashboard is considered **production-ready** when:

- ✅ All authentication flows work (signup, login, logout)
- ✅ All 5 pages load without errors
- ✅ API Keys management fully functional
- ✅ Members management fully functional
- ✅ Usage Analytics displays correctly
- ✅ Execution Traces shows data correctly
- ✅ Settings allow profile/org updates
- ✅ No console errors
- ✅ Responsive on common screen sizes
- ✅ Works in major browsers
- ✅ Proper error handling
- ✅ Session management works correctly

---

**Next Steps**:
1. Open https://app.metabob.com in browser
2. Follow test plan above
3. Document results
4. Report any issues found
