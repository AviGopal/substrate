# Root Cause Analysis: search_activities Returns Empty

**Date**: February 11, 2026  
**Status**: 🎯 Root Cause Found | ✅ Fix Committed | 🟡 Deployment Pending

---

## Problem Statement

`search_activities` MCP tool returns empty results despite:
- ✅ Backend running and healthy
- ✅ 17 templates registered in backend  
- ✅ Templates have correct V2 format with `tasks` field
- ✅ Direct API calls work

---

## Root Cause Identified

**metabob-cli activity_manager.py uses wrong field name**

### The Issue

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`  
**Line**: 196

**Current code**:
```python
"task_count": len(
    t.get("task_steps", [])
),  # Proto: task_steps array
```

**Problem**: Backend templates use `tasks` (V2 format), not `task_steps` (V1 format)

**Result**: `task_count` is always 0, causing templates to be filtered out or not displayed properly

---

## Evidence

### Backend Response (Actual)
```json
{
  "variant_id": "REFACTOR-9c629da6",
  "activity_id": "REFACTOR",
  "tasks": [
    {"id": "analyze", ...},
    {"id": "refactor", ...},
    {"id": "test", ...},
    {"id": "commit", ...}
  ]
}
```

### What activity_manager.py Looks For
```python
t.get("task_steps", [])  # Returns [], because field doesn't exist!
```

### What It Should Look For
```python
t.get("tasks", t.get("task_steps", []))  # Check 'tasks' first, fallback to 'task_steps'
```

---

## Fix Applied

### Commit Details
**Repo**: repos/metabob-cli  
**Commit**: bb0dea2bc  
**Message**: "fix: Support 'tasks' field in activity templates (V2 format)"

###Changed Lines
```diff
- "task_count": len(t.get("task_steps", [])),  # Proto: task_steps array
+ "task_count": len(t.get("tasks", t.get("task_steps", []))),  # V2: tasks array (fallback to task_steps for compatibility)
```

**Benefits**:
- ✅ Supports V2 format (`tasks`)
- ✅ Backward compatible with V1 format (`task_steps`)
- ✅ Graceful fallback

---

## Why This Happened

### Timeline of Events

1. **Initial State**: Backend and metabob-cli both used `task_steps` (V1 format)
2. **Migration**: We migrated all templates to use `tasks` (V2 format)
   - Changed backend templates: `task_steps` → `tasks`
   - Updated OpenCode template-loader: removed `task_steps` fallback
3. **Missed Update**: metabob-cli activity_manager still looked for `task_steps`
4. **Result**: search_activities returned templates with `task_count: 0`

### Why Templates Appeared Empty
```python
# In activity_manager.py line 196
"task_count": len(t.get("task_steps", []))  # Always returns 0!

# This made templates look like:
{
  "id": "REFACTOR-9c629da6",
  "name": "Refactor",
  "task_count": 0  # ← Shows as empty!
}
```

---

## Deployment Required

### The Challenge

The fix is committed to `repos/metabob-cli`, but the running devbob-opencode container uses an installed version of metabob-cli, not the local repo.

### Options for Deployment

#### Option 1: Rebuild Container (Recommended)
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
./devbob build devbob-opencode
docker restart devbob-opencode
```

**Pros**: Clean, permanent fix  
**Cons**: Takes time to rebuild

#### Option 2: Install Updated metabob-cli in Container
```bash
docker exec -it devbob-opencode bash
cd /workspace/repos/metabob-cli
pip install -e .
exit
docker restart devbob-opencode
```

**Pros**: Fast, no rebuild needed  
**Cons**: Requires repos to be mounted in container

#### Option 3: Patch in Place
```bash
docker exec devbob-opencode sh -c '
  sed -i "s/task_steps/tasks/g" \
    /usr/local/lib/python3.12/site-packages/metabob_cli/mcp/activity_manager.py
'
docker restart devbob-opencode
```

**Pros**: Immediate fix  
**Cons**: Not persistent, lost on container recreate

---

## Verification Steps

After deployment:

### 1. Test search_activities
```javascript
search_activities({ verbose: true })
```

**Expected**:
```json
{
  "activities": [
    {
      "id": "FEATURE-d3f6c989",
      "name": "Feature Impl",
      "task_count": 5,  // ← Should NOT be 0!
      "description": "..."
    },
    // ... more templates
  ],
  "count": 8
}
```

### 2. Test with Category Filter
```javascript
search_activities({ category: "feature", verbose: true })
```

**Expected**: Returns feature-impl template

### 3. Test Activity Execution
```javascript
activity({
  activityId: "feature-impl-v1",
  variables: {
    feature_name: "test",
    feature_description: "Test",
    target_location: "src/test"
  },
  reason: "Verify activity system works"
})
```

**Expected**: Activity starts and executes tasks

---

## Additional Fixes Needed

While fixing this, we should also check for other instances of `task_steps`:

### In metabob-cli
```bash
cd repos/metabob-cli
grep -r "task_steps" src/ | wc -l
```

**Found**: Multiple occurrences

**Action**: Review each and update to support both `tasks` and `task_steps`

### In metabob-rpc-api
Backend already uses `tasks` (V2 format) ✅

### In metabob-opencode
template-loader.ts already updated to use `tasks` only ✅

---

## Lessons Learned

### 1. Schema Changes Require Coordinated Updates
When changing field names across multiple services:
- ✅ Backend (metabob-rpc-api) ✅
- ✅ Client (metabob-cli) ← We missed this initially
- ✅ Frontend (metabob-opencode) ✅

### 2. Backward Compatibility is Critical
The fix uses:
```python
t.get("tasks", t.get("task_steps", []))
```

This ensures compatibility with both V1 and V2 formats during transition.

### 3. Testing Needs to be End-to-End
We tested:
- ✅ Backend API directly (worked)
- ✅ Template migration (worked)
- ❌ MCP tools (didn't test until later)

**Should have tested**: Full workflow from MCP tool → activity_manager → backend

---

## Success Criteria

- [ ] metabob-cli deployed with fix (container rebuilt or updated)
- [ ] search_activities returns templates with task_count > 0
- [ ] Can filter by category
- [ ] Can execute activities
- [ ] Can create templates via activity-create

---

## Timeline

| Time | Event |
|------|-------|
| 14:00 | Completed V1 → V2 migration |
| 15:00 | Completed V1 cleanup |
| 16:00 | Noticed search_activities returns empty |
| 17:00 | Investigated MCP connection |
| 18:00 | Found root cause: task_steps vs tasks |
| 18:30 | Committed fix to metabob-cli |
| **19:00** | **Awaiting deployment** |

---

## Next Actions

1. **Deploy Fix** ← **DO THIS NOW**
   - Rebuild devbob-opencode container, OR
   - Install updated metabob-cli in container, OR
   - Patch in place

2. **Verify Fix**
   - Test search_activities
   - Verify task_count is populated
   - Test activity execution

3. **Test Full Workflow**
   - Search for templates
   - Execute feature-impl activity
   - Create new template with activity-create

4. **Document**
   - Add to troubleshooting guide
   - Update cold-start runbook
   - Create testing checklist

---

**Status**: 🎯 Root Cause Found | ✅ Fix Committed | 🟡 Awaiting Deployment  
**Blocking**: Container needs metabob-cli update  
**ETA**: ~5 minutes after deployment

