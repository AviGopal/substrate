# Project Data Consistency - Critical Issue & Fix

**Date:** February 8, 2026  
**Priority:** CRITICAL  
**Issue:** Events and activity executions exist without corresponding project records

---

## The Problem You Identified ✅

**User Observation (Correct):**
> "How can we have events? projects are required, if no project is configured, default is used instead"

**Current State (Invalid):**
- Dashboard shows: "No Projects Yet"
- Database has: 17 events with `project_id: "default"`
- Database has: 9+ activity_executions with `project_id: "default"`
- But no project record exists for Demo Organization!

**This is a data integrity violation.**

---

## Root Cause

### Session Creation Without Project Validation

**V2 Session API** (`/v2/session`):
- Accepts `project_id: "default"`
- Creates session with this project_id
- **Does NOT call** `ensure_project_exists()` ✗

**Result:**
- Sessions reference non-existent projects
- Activity executions reference non-existent projects
- Events reference non-existent projects
- Dashboard shows inconsistent state

---

## Solution Implemented

### 1. Added ensure_project_exists to V2 Session Creation

**File:** `server/routes/v2_session.py`

**Change:**
```python
# Before creating session, ensure project exists
from server.actions.auth import ensure_project_exists
await ensure_project_exists(redis, surreal, org_id, project_id_value)

# Then create session
(token, session_data) = await create_session_model(...)
```

**Effect:** Projects auto-created when sessions are created

### 2. Manually Created Default Project

**Command:**
```python
await db.create("projects", {
    "project_id": "default",
    "org_id": "cdbdd13a-6c36-41fb-adf8-fec57aa445e7",
    "name": "Default Project",
    "description": "Auto-created default project",
    "status": "active"
})
```

**Result:** ✓ Project created successfully

---

## Data Consistency Rules

### Enforced Relationships

**1. Organization → Projects** (1:N)
- Every org must have at least one project
- "default" project auto-created if none specified

**2. Projects → Events** (1:N)
- Events MUST reference valid project
- Foreign key constraint (logical)

**3. Projects → Activity Executions** (1:N)
- Activity executions MUST reference valid project
- Tracked per project for analytics

**4. Users → Sessions → Projects**
- Session must specify project
- Project must exist or be created
- No orphan sessions

---

## Implementation Pattern

### When Creating Data with project_id

**Before any operation referencing a project:**

```python
# 1. Validate project exists
from server.actions.auth import ensure_project_exists
await ensure_project_exists(redis, db, org_id, project_id)

# 2. Now safe to reference project
await db.create("activity_executions", {
    "project_id": project_id,  # Guaranteed to exist
    ...
})
```

---

## Testing Data Consistency

### Validation Queries

**1. Check for orphan activity_executions:**
```sql
SELECT ae.execution_id, ae.project_id 
FROM activity_executions ae
WHERE ae.project_id NOT IN (
  SELECT project_id FROM projects WHERE org_id = ae.org_id
);
```

**2. Check for orphan events:**
```sql
SELECT e.event_id, e.project_id 
FROM event e
WHERE e.project_id NOT IN (
  SELECT project_id FROM projects WHERE org_id = e.org_id
);
```

**3. Check for projects without org:**
```sql
SELECT p.project_id 
FROM projects p
WHERE p.org_id NOT IN (SELECT org_id FROM organizations);
```

---

## Next Steps

### Immediate
1. ✅ Verify default project created
2. ✅ Restart API with ensure_project_exists
3. Test new session creation
4. Verify project appears in dashboard

### Validation
```bash
# Create new session (should auto-create project if needed)
curl -X POST http://localhost:8080/v2/session \
  -H "X-API-Key: mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "test-project"}'

# Verify project was created
curl -s "http://localhost:8000/sql" \
  -u "local:testing" \
  -d "USE NS metabob DB development; 
      SELECT * FROM projects 
      WHERE project_id = 'test-project';"
```

---

## Expected Dashboard State After Fix

**Before:**
- Projects: "No Projects Yet" ✗
- Events: "17 events" ✓
- Data inconsistent ✗

**After:**
- Projects: "1 active, 0 archived" ✓
- Events: "17 events" ✓
- All events linked to valid project ✓
- Data consistent ✓

---

## Broader Implications

### This Pattern Should Apply Everywhere

**Any endpoint that accepts project_id should:**
1. Validate org access
2. Ensure project exists (create if auto-creation enabled)
3. Then proceed with operation

**Applies to:**
- Session creation ✓ (fixed)
- Activity recording ✓ (uses session's project)
- Event creation ✓ (uses session's project)
- Analysis requests
- Problem tracking
- File operations

---

## Success Criteria

✅ No orphan records (all references valid)  
✅ Dashboard shows consistent data  
✅ Projects auto-created when needed  
✅ Foreign key integrity maintained (logically)  

---

**Status:** Fix implemented, validation pending  
**Impact:** HIGH - ensures data integrity across system  
**Priority:** CRITICAL - blocks consistent dashboard display
