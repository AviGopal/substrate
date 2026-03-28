# User Activity Tracking Implementation Progress

## Session Date: March 14, 2026

### Objective
Implement user activity tracking to answer: "Where do we see who is using the tool, what they are working on, and how their progress is proceeding?"

## Progress Summary

### ✅ Completed: Backend User Email Tracking (Task 1)

**Changes Made:**

1. **`repos/metabob-rpc-api/server/db/operations/activity_execution.py`**
   - Added `user_email: Optional[str] = None` parameter to `insert_execution()` function
   - Added `user_email` field to data dict for database storage
   - Added `user_email` to SELECT query in `get_organization_activity()`
   - Updated actor email to use `execution.get("user_email", "system@metabob.local")`
   - Fixed SurrealDB syntax: `duration::from::hours` → `duration::from_hours`

2. **`repos/metabob-rpc-api/server/routes/learning_loop.py`**
   - Added `user_email = None` variable initialization
   - Extract `user_email` from JWT token: `user_email = user.email`
   - Extract `user_email` from API key by fetching user record
   - Pass `user_email` to `_process_execution_background()` function
   - Added `user_email` parameter to background function signature

**Status:** Code changes complete in source files. Pod modifications attempted but Python module caching prevents immediate testing.

**Next Steps for Backend:**
- Rebuild Docker image with: `cd repos/metabob-rpc-api && docker build -f docker/Dockerfile.server -t metabob-rpc-api:user-tracking .`
- Update Kubernetes deployment to use new image tag
- OR commit changes and trigger CI/CD pipeline

---

### 🔄 In Progress: Dashboard UI Updates (Task 2)

**Goal:** Display actual user emails in Recent Activity section instead of "system@metabob.local"

**Current State:** Backend changes ready, dashboard code not yet modified

**Files to Modify:**
1. `repos/metabob-dashboard/src/pages/Dashboard/Dashboard.js` - Recent Activity component
2. `repos/metabob-dashboard/src/components/ActivityFeed/ActivityFeed.js` (if exists)

**Implementation Plan:**
- Dashboard already receives `actor.email` from `/api/v1/auth/orgs/{org_id}/activity` endpoint
- Once backend changes are deployed, dashboard should automatically show user emails
- May need to verify the data flow and add any missing UI updates

---

### ⏳ Pending: Quick Win Tasks

**Task 3: Link Activity History Page**
- File: `repos/metabob-dashboard/src/pages/Dashboard/Dashboard.js`
- Add button: `<Button href="/activity-history">View All Activities</Button>`
- Estimated time: 15 minutes

**Task 4: Analytics Dashboard Widgets**
- Create `AnalyticsSummary.js` component
- Fetch from `/api/v1/analytics/templates` endpoint
- Display: template usage, success rates, costs
- Estimated time: 1-2 hours

**Task 5: End-to-End Validation**
- Post activities with different API keys
- Verify user emails appear correctly
- Verify analytics data displays
- Verify Activity History link works

---

## Technical Details

### Database Schema Update
**Table:** `activity_executions`
**New Field:** `user_email` (string, optional)

**Sample Query:**
```sql
SELECT activity_id, template_id, user_email, success, cost_usd 
FROM activity_executions 
WHERE org_id = 'cccb762e-310d-4d9c-842b-19b02c0c4225'
ORDER BY started_at DESC 
LIMIT 10;
```

### API Changes

**POST /api/v1/learning-loop/executions**
- Now extracts `user_email` from authentication token (JWT or API key)
- Stores `user_email` in activity_executions table

**GET /api/v1/auth/orgs/{org_id}/activity**
- Returns activities with `actor.email` populated from `user_email` field
- Falls back to "system@metabob.local" if `user_email` is null

### User Email Extraction Logic

**For JWT Tokens (Dashboard):**
```python
user = await get_current_user(credentials)
org_id = user.org_id
user_email = user.email
```

**For API Keys (CLI):**
```python
api_key_record = await get_api_key_by_key(token)
if api_key_record:
    org_id = api_key_record["org_id"]
    user_id = api_key_record.get("user_id")
    if user_id:
        user_record = await get_user(user_id)
        if user_record:
            user_email = user_record.get("email")
```

---

## Known Issues

### Pod File Modifications Not Persistent
**Problem:** Direct file modifications in running pods don't survive restarts due to Python module caching

**Solution:** Need to rebuild Docker image and redeploy:
```bash
cd repos/metabob-rpc-api
docker build -f docker/Dockerfile.server -t metabob-rpc-api:latest .
kubectl set image deployment/metabob-rpc-api -n metabob metabob-rpc-api=metabob-rpc-api:latest
```

**Alternative:** Use local development with hot-reload enabled

---

## Testing Plan

### Test Scenario 1: CLI User Tracking
1. Post activity with API key: `mb_tJhNPb5ZycOp5SH42MyaJNlbBU6nN5nk4E_S-ZJI2DM`
2. Expected user_email: `demo_cli_1773464065@metabob.com`
3. Verify in dashboard Recent Activity section

### Test Scenario 2: Dashboard User Tracking
1. Login to dashboard with test account
2. Trigger analysis via UI
3. Verify user email appears in Recent Activity

### Test Scenario 3: Multiple Users
1. Create 2-3 test users with different emails
2. Post activities from each user
3. Verify each activity shows correct user email
4. Verify org-level filtering works correctly

---

## Files Modified

```
repos/metabob-rpc-api/
├── server/
│   ├── db/
│   │   └── operations/
│   │       └── activity_execution.py          ✅ Modified
│   └── routes/
│       └── learning_loop.py                    ✅ Modified
```

**Pending Modifications:**
```
repos/metabob-dashboard/
├── src/
│   ├── pages/
│   │   ├── Dashboard/
│   │   │   └── Dashboard.js                    ⏳ To modify
│   │   └── ActivityHistory/
│   │       └── ActivityHistory.js              ⏳ Link from Dashboard
│   └── components/
│       └── AnalyticsSummary/
│           └── AnalyticsSummary.js             ⏳ To create
```

---

## Next Steps

1. **Immediate (Backend Deployment):**
   - Rebuild metabob-rpc-api Docker image with user tracking changes
   - Redeploy to Kubernetes cluster
   - Verify backend changes with API tests

2. **Dashboard Updates (1-2 hours):**
   - Verify user email display in Recent Activity
   - Add "View All Activities" link
   - Create analytics widgets

3. **End-to-End Validation:**
   - Test complete flow: CLI → API → DB → Dashboard
   - Verify user attribution works correctly
   - Document any remaining issues

---

## Success Metrics

- ✅ Backend code modified to extract and store user_email
- ⏳ Docker image rebuilt and deployed
- ⏳ Dashboard displays actual user emails (not "system@metabob.local")
- ⏳ Activity History page accessible from dashboard
- ⏳ Analytics widgets show template statistics
- ⏳ End-to-end validation passes for all test scenarios

