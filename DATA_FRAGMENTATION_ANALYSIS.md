# Data Fragmentation Issue - Activity Executions vs Events

**Date:** February 8, 2026  
**Priority:** CRITICAL  
**Issue:** Activity execution data not appearing in dashboard due to data fragmentation

---

## Problem Statement

The dashboard's "Recent Activity" widget is showing **operational events** (from the `events` table), not **activity execution records** (from the `activity_executions` table).

**Result:** 
- We have 7 activity_executions in the database ✓
- Dashboard shows "6 events" but they're generic placeholders ✗
- Activity executions are NOT being displayed ✗

---

## Data Fragmentation Discovered

### Two Separate Data Sources

**1. Events Table** (Operational events)
- Source: `/api/events` endpoint
- Table: `events` in SurrealDB
- Data: file_created, file_modified, problem_detected, sync_started, etc.
- Dashboard widget: Uses this for "Recent Activity"

**2. Activity Executions Table** (Activity tracking)
- Source: `activity_executions` table
- API: `/v2/activities/record/*` endpoints
- Data: Activity execution records with duration, cost, outcome
- Dashboard widget: **NOT CONNECTED** ✗

### The Fragmentation

```
┌─────────────────────────────────────────────────────┐
│              DATA FRAGMENTATION                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  events table                 activity_executions   │
│  ├─ file_created             ├─ execution_id       │
│  ├─ problem_detected         ├─ activity_id        │
│  ├─ sync_started             ├─ duration           │
│  ├─ member_joined            ├─ success            │
│  └─ ...                      ├─ outcome            │
│      ↓                       └─ ...                │
│  /api/events                     ↓                  │
│      ↓                       /auth/orgs/.../activity│
│  Dashboard "Recent Activity"     ↓                  │
│  Shows generic events ✓        NOT CONNECTED ✗     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## User Expectation (Correct)

**Activity executions SHOULD be tracked as events:**

When an activity executes:
1. Record in `activity_executions` table ✓ (we do this)
2. Create corresponding event in `events` table ✗ (missing)
3. Dashboard displays both operational events AND activity executions ✗

**OR**

Make the `/auth/orgs/{org_id}/activity` endpoint work properly and have dashboard use it for activity executions specifically.

---

## Dashboard Component Analysis

**File:** `src/cloud/pages/CloudDashboard/components/RecentActivity.js`

**Current Behavior:**
```javascript
const formattedActivities = formatActivityEvents(activities).slice(0, limit);
```

**formatActivityEvents expects:**
```javascript
{
  id: event.id,
  type: event.type,  // "analysis.completed", "problem.resolved", etc.
  actor: {name, email},
  resource: {},
  timestamp: ...,
  description: ...
}
```

**But activity_executions have:**
```javascript
{
  execution_id: "...",
  activity_id: "feature-impl-v1",
  duration: 21500,
  success: true,
  total_cost: 0.058,
  outcome: "...",
  timestamp: 1770579882.044447
}
```

**Mismatch:** Structure is completely different!

---

## Root Cause

### The Activity Endpoint I Created Returns Wrong Format

**My Implementation:**
```python
return {
    "activities": [activity_execution_records],  # Wrong structure
    "total": 7
}
```

**Dashboard Expects (Based on formatActivityEvents):**
```python
return {
    "activities": [
        {
            "id": execution_id,
            "type": "activity.execution",  # Event type
            "actor": {"name": "...", "email": "..."},
            "resource": {"type": "activity", "id": activity_id},
            "timestamp": timestamp,
            "description": "Executed {activity_id}: {outcome}",
            # Original activity data for details
            "metadata": {
                "execution_id": "...",
                "duration": 21500,
                "success": true,
                "total_cost": 0.058
            }
        }
    ]
}
```

---

## Solution: Unified Event System

### Option A: Transform Activity Executions to Event Format

```python
@router.get("/orgs/{org_id}/activity")
async def get_organization_activity(...):
    # Query activity_executions
    executions = await db.query("SELECT * FROM activity_executions WHERE org_id = $org_id")
    
    # Transform to event format
    activities = []
    for exec in executions:
        activity_event = {
            "id": exec["execution_id"],
            "type": "activity.execution",
            "actor": {
                "name": "Agent",  # Or lookup user
                "email": ""
            },
            "resource": {
                "type": "activity",
                "id": exec["activity_id"],
                "name": exec.get("outcome", "Activity executed")
            },
            "timestamp": exec["timestamp"],
            "description": f"Executed {exec['activity_id']}: {exec.get('outcome', 'Completed')}",
            "metadata": {
                "execution_id": exec["execution_id"],
                "duration": exec["duration"],
                "success": exec["success"],
                "total_cost": exec["total_cost"]
            }
        }
        activities.append(activity_event)
    
    return {"activities": activities, "total": len(activities)}
```

### Option B: Create Events When Activity Executes

When recording activity completion, also create an event:

```python
@router.post("/record/complete")
async def record_execution_complete(...):
    # Update activity_executions
    await db.query("UPDATE activity_executions ...")
    
    # ALSO create event for unified tracking
    event = {
        "event_type": "activity_execution",
        "org_id": session.org_id,
        "project_id": session.project_id,
        "resource_type": "activity",
        "resource_id": execution.execution_id,
        "metadata": {
            "activity_id": execution.template_id,
            "duration": execution.duration_ms,
            "cost": execution.cost,
            "success": execution.success,
            "outcome": execution.outcome
        },
        "timestamp": datetime.utcnow()
    }
    await db.create("events", event)
```

---

## Recommendation

**Use Option A (Transform)** for immediate fix, then implement Option B for unified tracking.

### Why?

1. **Immediate:** Works with existing data (7 executions already recorded)
2. **Unified:** Single API endpoint returns properly formatted data
3. **No Loss:** All activity execution data gets displayed
4. **Descriptive:** Can generate meaningful descriptions from execution data

---

## Next Steps

1. ✅ Fix `/auth/orgs/{org_id}/activity` to transform activity_executions to event format
2. ✅ Ensure descriptions include what was accomplished (outcome field)
3. ✅ Add proper timestamps (not 1/21/1970)
4. ✅ Test dashboard display with real activity data

---

**Priority:** HIGH - This is blocking proper dashboard data display  
**Effort:** 15-20 minutes to implement transformation  
**Impact:** Unifies data display, eliminates fragmentation
