# Dashboard Login and API Key Isolation Validation

**Date:** 2026-03-15  
**Objective:** Validate dashboard login and API key isolation  
**Focus:** Ensure UI displays only data for authenticated user's API key, preventing data leakage

---

## Validation Objectives

### Primary Goals

1. ✅ **Login to Existing Account**
   - Successfully authenticate to dashboard
   - Verify session management works
   - Confirm user context is established

2. ✅ **Validate API Key Isolation**
   - Confirm only data for user's API key is displayed
   - Verify no cross-organization data leakage
   - Test that API key filtering is enforced

3. ✅ **Verify Data Display**
   - Activity History shows only user's activities
   - Templates panel shows available templates
   - Usage statistics reflect only user's usage
   - All panels display real-time data from database

4. ✅ **Test CLI → Dashboard Data Flow**
   - Create activity via CLI
   - Verify activity appears in dashboard
   - Confirm data matches database state
   - Validate API key association

---

## Current System State

### Infrastructure Status ✅

- **RPC API:** http://api.metabob.local (Running, v0.24.0+phase1.gap9)
- **Dashboard:** http://app.metabob.local (Running, Login page accessible)
- **SurrealDB:** Running (Accessible via RPC API only)
- **Architecture:** Properly enforced (CLI → RPC API → DB → RPC API → Dashboard)

### API Key Configuration

**Primary Test API Key:** `mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ`

This API key should be associated with your user account and used for all test operations.

### Backend Data Available

According to our validation:
- Activity executions: Available in database
- Activity templates: Empty (none registered yet)
- API key filtering: Enforced at database query level

---

## Manual Validation Procedure

Since automated Playwright login requires browser version compatibility, follow this manual procedure:

### Step 1: Login to Dashboard

1. **Open Dashboard**
   ```
   URL: http://app.metabob.local
   ```

2. **Login with Existing Account**
   - Use your email/password credentials
   - OR use GitHub OAuth if configured
   - Click "Sign In"

3. **Verify Successful Login**
   - Should redirect to main dashboard
   - User menu/profile should display in top-right
   - No error messages visible

### Step 2: Identify Your API Key

1. **Navigate to Settings/API Keys Section**
   - Look for "Settings", "Profile", or "API Keys" menu item
   - Find your API key(s)

2. **Verify Test API Key**
   - Confirm you have access to: `mb_TfdRc58VlhLz...`
   - This should be the key associated with your account
   - If not visible, you may need to create one

### Step 3: Verify Activity History Panel

**Expected Behavior:** Only activities created with YOUR API key should be visible

1. **Locate Activity History Panel**
   - Usually on main dashboard or "Activities" page
   - Should show list of activity executions

2. **Check Data Display**
   - [ ] Panel loads without errors
   - [ ] Shows activities (if any exist)
   - [ ] Each activity displays:
     - Activity name/ID
     - Timestamp
     - Status (success/failed/in-progress)
     - Duration
     - Template used

3. **Verify API Key Filtering**
   - [ ] All activities shown belong to your API key
   - [ ] No activities from other users/organizations visible
   - [ ] If you see an API key field, it matches yours: `mb_TfdRc58VlhLz...`

4. **Test Empty State** (if no activities)
   - [ ] Shows "No activities yet" or similar message
   - [ ] Provides guidance on creating first activity

### Step 4: Verify Templates Panel

1. **Locate Templates Panel**
   - Should be on dashboard or "Templates" page
   - Lists available activity templates

2. **Check Template Display**
   - [ ] Panel loads without errors
   - [ ] Shows template list (may be empty)
   - [ ] Each template displays:
     - Template name
     - Category
     - Success rate
     - Execution count

3. **Expected State**
   - Currently: Empty (no templates registered)
   - This is normal for a fresh deployment

### Step 5: Verify Usage Statistics Panel

1. **Locate Usage/Metrics Panel**
   - Usually on main dashboard
   - Shows aggregated statistics

2. **Check Statistics Display**
   - [ ] Panel loads without errors
   - [ ] Shows total executions for your API key
   - [ ] Displays cost metrics (if tracked)
   - [ ] Shows token usage (if tracked)
   - [ ] Displays success rate

3. **Verify Data Accuracy**
   - [ ] Numbers match what you expect
   - [ ] Only reflects YOUR usage, not other users
   - [ ] Updates when you create new activities

### Step 6: Test CLI → Dashboard Data Flow

**This is the critical test to validate the complete architecture**

#### 6a. Create Test Activity via CLI

```bash
# Execute from your local machine or inside the RPC API pod

# Option 1: If you have metabob-cli installed locally
metabob-cli activity create \
  --name "Dashboard Isolation Test" \
  --description "Testing API key isolation and data display" \
  --category "test" \
  --api-key mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ

# Option 2: Execute via kubectl
kubectl exec -n metabob deployment/metabob-rpc-api -- \
  metabob-cli activity create \
    --name "Dashboard Isolation Test" \
    --description "Testing API key isolation" \
    --category "test"
```

#### 6b. Verify Activity Appears in Dashboard

1. **Refresh Dashboard** (or wait for auto-refresh if implemented)

2. **Check Activity History Panel**
   - [ ] New activity "Dashboard Isolation Test" appears
   - [ ] Timestamp is current (within last few minutes)
   - [ ] Status shows correctly (likely "completed" or "success")
   - [ ] Activity count increments by 1

3. **Click on Activity Details**
   - [ ] Can view detailed information
   - [ ] Shows task breakdown
   - [ ] Displays execution logs
   - [ ] Shows associated API key (should be yours)

#### 6c. Verify Data Consistency

1. **Compare Dashboard to Backend**
   
   Query backend directly:
   ```bash
   # Get activity count from API
   curl -s -X GET "http://api.metabob.local/analytics/templates" \
     -H "X-API-Key: mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ" | jq
   ```

2. **Verify Numbers Match**
   - [ ] Dashboard execution count = API execution count
   - [ ] Dashboard latest timestamp = API latest timestamp
   - [ ] All data is consistent across UI and API

### Step 7: Test API Key Isolation (Critical Security Test)

**Objective:** Prove that API keys properly isolate data between organizations/users

#### 7a. Create Activity with Your API Key

```bash
# Create activity with your API key
curl -X POST "http://api.metabob.local/api/activity-execution" \
  -H "X-API-Key: mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_name": "Isolation Test - Key 1",
    "status": "completed",
    "duration": 1000
  }'
```

#### 7b. Verify in Dashboard
- [ ] Activity "Isolation Test - Key 1" appears in YOUR dashboard
- [ ] API key shown matches yours

#### 7c. Create Activity with Different API Key (If Available)

If you have access to multiple API keys or can create a test key:

```bash
# Create with different API key
curl -X POST "http://api.metabob.local/api/activity-execution" \
  -H "X-API-Key: mb_TEST_DIFFERENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "activity_name": "Isolation Test - Key 2",
    "status": "completed",
    "duration": 1000
  }'
```

#### 7d. Verify Isolation
- [ ] Activity "Isolation Test - Key 2" does NOT appear in your dashboard
- [ ] Only activities with YOUR API key are visible
- [ ] No data leakage between API keys

**Expected Result:** ✅ Only activities created with your API key are visible. Other API keys' data is completely hidden.

**If you see other users' data:** ❌ CRITICAL BUG - API key filtering is not working!

### Step 8: Test Edge Cases

#### 8a. Test with No Data
- [ ] Empty states display correctly
- [ ] Helpful messages guide user to create first activity
- [ ] No errors or broken UI elements

#### 8b. Test with Multiple Activities
- [ ] Pagination works (if >10 activities)
- [ ] Sorting works (by date, status, etc.)
- [ ] Filtering works
- [ ] Search functionality works

#### 8c. Test Real-Time Updates
- [ ] Create activity via CLI
- [ ] Dashboard updates automatically OR
- [ ] Manual refresh shows new data
- [ ] No stale data displayed

---

## Validation Checklist

### Authentication ✅

- [ ] Successfully logged into dashboard
- [ ] Session persists across page refreshes
- [ ] User profile/menu displays correctly
- [ ] API key visible in settings/profile

### API Key Isolation (CRITICAL) ✅

- [ ] Only MY activities are visible in Activity History
- [ ] Activities from other API keys are NOT visible
- [ ] Usage statistics reflect only MY usage
- [ ] No cross-organization data leakage
- [ ] Filtering enforced at database query level

### Data Display ✅

- [ ] Activity History panel loads and displays data
- [ ] Templates panel loads (may be empty)
- [ ] Usage Statistics panel displays metrics
- [ ] Recent Activity details accessible
- [ ] All panels show real-time database state

### CLI → Dashboard Flow ✅

- [ ] Created activity via CLI appears in dashboard
- [ ] Timestamp is accurate and recent
- [ ] Status reflects actual execution state
- [ ] Data consistency between CLI, API, and UI
- [ ] No data loss or corruption

### UI/UX ✅

- [ ] Dashboard loads in <3 seconds
- [ ] No console errors (check browser DevTools F12)
- [ ] All API calls succeed (check Network tab)
- [ ] Responsive design works
- [ ] Navigation works correctly

---

## Expected Results

### ✅ Success Criteria

1. **Authentication Works**
   - Login successful
   - Session maintained
   - User context correct

2. **API Key Isolation Enforced**
   - Only user's data visible
   - No cross-user data leakage
   - Filtering works at all layers

3. **Data Display Accurate**
   - UI reflects database state
   - Real-time or near-real-time updates
   - Consistent across panels

4. **Architecture Compliance**
   - CLI → RPC API → DB → RPC API → Dashboard flow verified
   - No direct database access
   - All boundaries enforced

### ❌ Failure Scenarios

If any of these occur, there is a critical bug:

1. **Data Leakage**
   - Seeing other users' activities
   - Statistics include other API keys' data
   - Cross-organization visibility

2. **Data Inconsistency**
   - Dashboard doesn't match backend
   - Stale data displayed
   - Missing activities

3. **Architecture Violation**
   - Direct database access detected
   - Bypassing RPC API
   - API key not enforced

---

## Troubleshooting

### Issue: Can't Login

**Symptoms:** Login fails, redirects to login page, or shows error

**Check:**
1. Correct credentials being used
2. Account exists and is active
3. Network connectivity to dashboard
4. Browser cookies enabled
5. Check browser console for errors

**Fix:**
- Reset password if needed
- Clear browser cache/cookies
- Try different browser
- Contact admin for account issues

### Issue: No Data Displayed

**Symptoms:** Panels show "No data" or loading forever

**Check:**
1. API key is correctly associated with your account
2. Backend API is accessible
3. SurrealDB contains data for your API key
4. Network requests succeed (check DevTools)

**Fix:**
- Create test activity via CLI
- Verify API key in backend
- Check backend logs for errors
- Refresh dashboard

### Issue: Seeing Other Users' Data

**Symptoms:** Activities or metrics don't match what you created

**CRITICAL:** This indicates API key filtering is broken!

**Check:**
1. Verify displayed API key matches yours
2. Check if org-level vs user-level filtering
3. Review backend query filtering logic

**Fix:**
- Report as critical security bug immediately
- Do NOT use in production
- Review database query WHERE clauses
- Audit API key validation logic

### Issue: Data Not Updating

**Symptoms:** Created activity via CLI but doesn't appear in dashboard

**Check:**
1. Activity was created successfully (check CLI output)
2. Correct API key was used
3. Dashboard refresh attempted
4. Browser cache not serving stale content

**Fix:**
- Hard refresh (Ctrl+F5 or Cmd+Shift+R)
- Check API response includes new activity
- Verify timestamp filtering (not excluding recent activities)
- Clear browser cache

---

## Security Validation Report Template

After completing validation, document your findings:

```markdown
## API Key Isolation Test Results

**Tester:** [Your Name]
**Date:** 2026-03-15
**API Key:** mb_TfdRc58VlhLz...

### Test 1: Own Data Visibility
- [x] Can see my activities
- [x] Can see my usage statistics
- [x] API key displayed correctly

### Test 2: Data Isolation
- [x] Cannot see other users' activities
- [x] Statistics don't include other users
- [x] Cross-org isolation confirmed

### Test 3: Data Flow
- [x] CLI → Dashboard flow works
- [x] Data appears in real-time
- [x] Consistency maintained

### Test 4: Edge Cases
- [x] Empty states work
- [x] Multiple activities handled
- [x] Filtering/sorting works

### Issues Found
- [ ] None - All tests passed ✅
- [ ] [List any issues discovered]

### Conclusion
- [ ] System is secure and ready for production
- [ ] Issues need to be fixed before production use
```

---

## Next Steps

### If All Tests Pass ✅

1. **Document Results**
   - Complete security validation report
   - Capture screenshots of successful tests
   - Update validation summary

2. **Production Readiness**
   - System is ready for production use
   - API key isolation is properly enforced
   - Data flow architecture is sound

3. **Continuous Monitoring**
   - Set up periodic validation
   - Monitor for data leakage
   - Alert on isolation failures

### If Tests Fail ❌

1. **Identify Root Cause**
   - Review backend query filtering
   - Check API key validation logic
   - Audit database access patterns

2. **Fix Critical Issues**
   - Priority 1: Data leakage (security)
   - Priority 2: Data consistency (reliability)
   - Priority 3: UI/UX issues (usability)

3. **Re-validate**
   - Fix issues
   - Run full validation again
   - Verify fixes work correctly

---

## Automated Validation Script

Once you complete manual validation and confirm login works, you can enhance the automated script to include your credentials:

```javascript
// In validate-dashboard-ui.js, update the login section:

const TEST_EMAIL = process.env.DASHBOARD_EMAIL || 'your-email@example.com';
const TEST_PASSWORD = process.env.DASHBOARD_PASSWORD || 'your-password';

// Then run:
// DASHBOARD_EMAIL=your-email DASHBOARD_PASSWORD=your-pass node validate-dashboard-ui.js
```

This will enable fully automated validation in the future.

---

## Quick Reference

**Dashboard URL:** http://app.metabob.local  
**RPC API URL:** http://api.metabob.local  
**Test API Key:** mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ

**Create Test Activity:**
```bash
kubectl exec -n metabob deployment/metabob-rpc-api -- \
  metabob-cli activity create \
    --name "Dashboard Test" \
    --category "test"
```

**Query Backend:**
```bash
curl -X GET "http://api.metabob.local/analytics/templates" \
  -H "X-API-Key: mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-15  
**Status:** Ready for Manual Validation
