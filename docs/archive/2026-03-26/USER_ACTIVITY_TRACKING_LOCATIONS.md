# Where To See: User Activity, Projects, and Progress

## Current State: Activity Tracking Locations

### 1. Dashboard Main Page (http://app.metabob.local)

**Recent Activity Section** ✅
- **Location:** Main dashboard after login
- **Shows:** Last 5 activity events
- **Data Displayed:**
  - Activity template name (add-feature-complete, fix-bug-complete, etc.)
  - Success/failure status
  - Timestamp (relative: "Just now", "1 minute ago")
  - Actor (system@metabob.local for CLI-originated activities)
  
**Currently Visible:** ✅ Working - Shows CLI-posted activities

### 2. Activity History Page (http://app.metabob.local/activity-history)

**Full Activity Timeline** 
- **Component:** `src/pages/ActivityHistory/ActivityHistory.js`
- **Expected Features:**
  - Complete list of all activities
  - Filtering by template, status, date range
  - Pagination for large datasets
  - Detailed view for each activity

**Status:** Needs verification via navigation

### 3. Analytics API Endpoints

**Available Analytics:**

#### `/analytics/templates`
```bash
GET http://api.metabob.local/analytics/templates
Authorization: Bearer {api_key}

Response:
{
  "templates": [
    {
      "template_id": "add-feature-complete",
      "execution_count": 45,
      "success_rate": 0.88,
      "avg_cost_usd": 0.023,
      "avg_duration_ms": 42000,
      "avg_tokens": {
        "input": 8500,
        "output": 2100,
        "cache": 4200
      },
      "last_execution": "2026-03-14T10:30:00Z"
    }
  ],
  "total_templates": 12,
  "total_executions": 450
}
```

**Purpose:** Track which activity templates are being used most, success rates, costs

#### `/analytics/trends`
```bash
GET http://api.metabob.local/analytics/trends?window=7d
```

**Purpose:** Time-series data showing activity execution trends over time

#### `/analytics/api-keys`
```bash
GET http://api.metabob.local/analytics/api-keys
```

**Purpose:** Track API key usage, last used timestamps, activity counts per key

#### `/analytics/projects`
```bash
GET http://api.metabob.local/analytics/projects
```

**Purpose:** Project-level analytics (if projects are configured)

#### `/analytics/executions`
```bash
GET http://api.metabob.local/analytics/executions?limit=100
```

**Purpose:** Detailed execution logs with filtering

#### `/auth/orgs/{org_id}/activity`
```bash
GET http://api.metabob.local/auth/orgs/{org_id}/activity
Authorization: Bearer {jwt_token}
```

**Purpose:** Organization-wide activity feed (used by dashboard)

---

## What's Missing for Complete User/Project Tracking

### Missing: Individual User Activity Tracking

**Current Limitation:**
- Activities are attributed to "system@metabob.local"
- No distinction between different CLI users
- No user-specific activity filtering

**Solution Needed:**
1. CLI should include user context in activity posts:
```json
{
  "activity_id": "act_001",
  "user_id": "actual-user-id",  ← ADD THIS
  "metadata": {
    "cli_user": "john@company.com",  ← ADD THIS
    "machine": "john-laptop"  ← ADD THIS
  }
}
```

2. Dashboard should filter/group by user:
   - "John's Activities (15 today)"
   - "Sarah's Activities (8 today)"

### Missing: Project Association

**Current Limitation:**
- Activities are not associated with specific projects
- No project-level progress tracking
- No way to see "what team is working on"

**Solution Needed:**
1. Add project_id to activity executions:
```json
{
  "activity_id": "act_001",
  "project_id": "proj_mobile_app",  ← ADD THIS
  "metadata": {
    "project_name": "Mobile App Rewrite"  ← ADD THIS
  }
}
```

2. Create project dashboard:
   - Project: "Mobile App Rewrite"
   - Active users: 3
   - Activities this week: 24
   - Progress: Bug fixes (8), Features (12), Refactoring (4)

### Missing: Real-Time Progress Indicators

**Current Limitation:**
- No indication of "currently in progress" activities
- No estimated time remaining
- No active session indicators

**Solution Needed:**
1. Track activity lifecycle:
   - `started` - Activity is currently executing
   - `completed` - Activity finished successfully
   - `failed` - Activity encountered error
   - `cancelled` - User cancelled the activity

2. Show live status:
   - "John is currently: Fixing authentication bug (3 min elapsed)"
   - "Sarah is currently: Adding user profile endpoint (5 min elapsed)"

---

## Recommended Dashboard Enhancements

### 1. Team Overview Page

**URL:** `http://app.metabob.local/team`

**Shows:**
```
Active Team Members (3)
├─ John Doe (john@company.com)
│  └─ Last Active: 2 minutes ago
│  └─ Current: Refactoring database connection pool
│  └─ Today: 5 activities (4 success, 1 failed)
│  └─ This Week: 24 activities | $2.45 cost
│
├─ Sarah Smith (sarah@company.com)
│  └─ Last Active: 15 minutes ago
│  └─ Current: Idle
│  └─ Today: 3 activities (3 success)
│  └─ This Week: 18 activities | $1.89 cost
│
└─ Mike Johnson (mike@company.com)
   └─ Last Active: 1 hour ago
   └─ Current: Idle
   └─ Today: 2 activities (2 success)
   └─ This Week: 12 activities | $1.23 cost
```

### 2. Project Dashboard

**URL:** `http://app.metabob.local/projects/{project_id}`

**Shows:**
```
Project: Mobile App Rewrite

Progress This Week:
├─ Features Added: 8
├─ Bugs Fixed: 12
├─ Code Refactored: 5
├─ Tests Added: 15
└─ Total Activities: 40

Active Contributors (3):
├─ John Doe: 18 activities
├─ Sarah Smith: 15 activities
└─ Mike Johnson: 7 activities

Activity Breakdown:
├─ add-feature-complete: 8 (100% success)
├─ fix-bug-complete: 12 (92% success)
├─ refactor-with-tests: 5 (100% success)
├─ add-comprehensive-logging: 10 (100% success)
└─ add-comprehensive-tests: 5 (80% success)

Cost Analysis:
├─ Total Cost This Week: $5.57
├─ Average Cost Per Activity: $0.139
└─ Most Expensive: refactor-with-tests ($0.428 avg)
```

### 3. Live Activity Feed

**URL:** `http://app.metabob.local/live`

**Shows:**
```
🟢 LIVE ACTIVITY FEED

[IN PROGRESS]
John Doe - Refactoring database connection pool
Started: 3m 24s ago | Template: refactor-with-tests
Files: src/database/pool.ts, tests/database/pool.test.ts

[COMPLETED - 2m ago]
Sarah Smith - Added user profile endpoint ✅
Duration: 2m 30s | Cost: $0.245 | Tokens: 24,100

[COMPLETED - 5m ago]
Mike Johnson - Fixed authentication token expiry ✅
Duration: 4m 15s | Cost: $0.312 | Tokens: 27,600

[FAILED - 8m ago]
John Doe - Added real-time notifications ❌
Duration: 1m 20s | Cost: $0.145 | Error: Port 3000 in use
```

---

## Implementation Checklist

### Backend (RPC API)

- [ ] **Add user tracking to activity executions**
  - Update `activity_executions` table schema to include `user_id`, `user_email`
  - CLI should pass user context in API requests
  - API should extract user from JWT or API key

- [ ] **Add project tracking**
  - Update `activity_executions` table schema to include `project_id`, `project_name`
  - Create `/projects` endpoint for project management
  - Support filtering activities by project

- [ ] **Add lifecycle status tracking**
  - Support `in_progress` status for active activities
  - CLI should POST when starting (status=in_progress)
  - CLI should PATCH when completing (status=completed/failed)
  - Add `/analytics/active` endpoint for live activities

- [ ] **Enhance analytics endpoints**
  - `/analytics/users` - per-user activity stats
  - `/analytics/projects/{project_id}` - project-specific analytics
  - `/analytics/live` - currently in-progress activities
  - `/analytics/costs` - cost breakdown by user/project/template

### Frontend (Dashboard)

- [ ] **Create Team Overview page**
  - Show all team members
  - Show their current activity status
  - Show their activity history and stats

- [ ] **Create Project Dashboard**
  - List all projects
  - Show project-level progress
  - Show contributors per project
  - Show activity breakdown

- [ ] **Create Live Activity Feed**
  - Real-time updates (WebSocket or polling)
  - Show in-progress activities
  - Show recent completions/failures
  - Auto-refresh every 5-10 seconds

- [ ] **Enhance Main Dashboard**
  - Add "Active Users" widget
  - Add "Active Projects" widget
  - Add "Team Progress This Week" chart
  - Add user filtering to activity feed

### CLI (metabob-cli)

- [ ] **Include user context in activity posts**
  - Extract user email from git config
  - Include machine hostname
  - Include project context from git remote

- [ ] **Post lifecycle events**
  - POST at activity start (status=in_progress)
  - PATCH at activity completion (status=completed/failed)
  - Include progress updates for long-running activities

- [ ] **Associate activities with projects**
  - Detect project from git remote URL
  - Allow manual project configuration
  - Include project metadata in activity posts

---

## Current vs. Desired State

### Current State ✅

**What Works:**
- ✅ Activities are stored in database
- ✅ Dashboard shows recent 5 activities
- ✅ API key usage tracking (last_used_at)
- ✅ Activity metadata preserved (template, cost, duration, tokens)
- ✅ Success/failure status tracked

**What's Visible:**
- ✅ Recent Activity section on main dashboard
- ✅ Activity template names
- ✅ Success/failure indicators
- ✅ Timestamps

### Desired State 🎯

**What's Needed:**
- 🎯 Individual user activity tracking
- 🎯 Project-level progress visibility
- 🎯 Live "who's working on what" view
- 🎯 Team productivity metrics
- 🎯 Per-user cost attribution
- 🎯 Project progress indicators
- 🎯 Real-time activity status updates

**Proposed Views:**
1. **Team Dashboard** - See all users and their current work
2. **Project Dashboard** - See project progress and contributors
3. **Live Feed** - Real-time activity updates
4. **Analytics Dashboard** - Cost, productivity, and success rate metrics

---

## Quick Wins (Immediate Implementation)

### 1. Add User Email to Activities (1 hour)

**Backend:**
```python
# In learning_loop.py
execution_data = {
    "activity_id": data.activity_id,
    "user_email": get_user_email_from_token(request),  # NEW
    # ... rest
}
```

**Dashboard:**
```javascript
// In ActivityFeed component
<Typography>
  {activity.metadata.user_email || "system@metabob.local"}
</Typography>
```

### 2. Activity History Page Navigation (30 minutes)

**Add link in dashboard:**
```javascript
<Button href="/activity-history">
  View All Activities ({total})
</Button>
```

### 3. Analytics Endpoints Testing (1 hour)

**Create admin dashboard showing:**
- Total activities this week
- Success rate trend
- Cost breakdown by template
- Most active users (if user tracking added)

---

## Summary

**Currently Visible:**
- ✅ Recent 5 activities on main dashboard
- ✅ Activity template names and status
- ✅ Timestamps (relative)

**To See Full Picture, Navigate To:**
1. **Activity History** - `http://app.metabob.local/activity-history`
2. **Analytics Dashboard** - Build custom view using `/analytics/*` endpoints
3. **Settings → Members** - See team members (if implemented)

**Priority Enhancements:**
1. Add user email/name to activity attribution
2. Create "Team Overview" page showing who's active
3. Add project association to activities
4. Create "Live Feed" for real-time progress visibility

