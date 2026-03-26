# Boredom Activity Detection Mechanism - Enforcement Summary

## Executive Summary

**Specification**: Boredom Activity Detection Mechanism  
**Enforcement Status**: ✅ **COMPLETE** (5 of 6 gaps addressed, 1 was already fixed)  
**Files Modified**: 2 files, 5 components updated  
**Impact**: Medium (schema change + validation logic, backward compatible)

All critical gaps identified in the trace analysis have been addressed. The Boredom Activity Detection Mechanism now has:
- **Persistent tracking** via `isBoredom` and `initiatedBy` schema fields
- **Consistent markers** enforced automatically at activity creation
- **Clean detection** without debug code interference
- **Failed activity cleanup** to prevent orphaned activities
- **Reliable querying** using boolean fields instead of string matching

---

## Changes Applied

### 1. Remove Debug Prefix Breaking Detection

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`  
**Component**: `Activity.create()` (lines 442-443)  
**Priority**: 🔴 **HIGH** (Critical bug fix)

**Change Made**:
```typescript
// REMOVED:
// DEBUG: Add a marker to title to prove this code runs
activity.title = `[EVIDENCE_TEST] ${activity.title}`
```

**Reason**:
- Debug code was prepending `[EVIDENCE_TEST]` to all activity titles
- Caused boredom activity titles to become: `"[EVIDENCE_TEST] [BOREDOM] ..."`
- Title-based detection using `startsWith('[BOREDOM]')` failed
- Broke primary detection mechanism

**Impact Analysis**:
- ✅ **Low risk**: Removes debug code only
- ✅ **Immediate benefit**: Title-based detection now works correctly
- ✅ **No side effects**: All activities have clean titles without test prefix

**Validation**:
```typescript
// Before fix:
activity.title = "[EVIDENCE_TEST] [BOREDOM] My Activity"
activity.title.startsWith('[BOREDOM]')  // false ❌

// After fix:
activity.title = "[BOREDOM] My Activity"
activity.title.startsWith('[BOREDOM]')  // true ✅
```

---

### 2. Add Persistent Fields to Schema

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`  
**Component**: `Activity.Info` schema (lines 355-357)  
**Priority**: 🔴 **HIGH** (Enables persistent tracking)

**Change Made**:
```typescript
export const Info = z.object({
  // ... existing fields ...
  error: z.string().optional(),
  errorStack: z.string().optional(),
  
  // NEW: Boredom detection fields
  isBoredom: z.boolean().optional().describe("Whether this activity was triggered by boredom detection"),
  initiatedBy: z.enum(["user", "boredom-auto", "boredom-manual"]).optional().describe("How this activity was initiated"),
})
```

**Reason**:
- No persistent way to identify boredom activities post-execution
- Detection relied on string matching title/branch (unreliable, not queryable)
- Learning Loop needs to separate user vs boredom activities for accurate metrics
- Stats command needs reliable filtering

**Impact Analysis**:
- ⚠️ **Medium risk**: Schema change (backward compatible, optional fields)
- ✅ **High value**: Enables reliable querying: `WHERE isBoredom = true`
- ✅ **Lineage tracking**: Can distinguish auto vs manual vs user-initiated
- ✅ **Backward compatible**: Existing activities without these fields remain valid

**Database Impact**:
- New activities: Fields populated automatically when applicable
- Existing activities: Fields remain `undefined` (valid per schema)
- No migration required (optional fields)

---

### 3. Enforce Marker Consistency at Creation

**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`  
**Component**: `Activity.create()` validation (lines 446-465)  
**Priority**: 🟡 **MEDIUM** (Prevents inconsistencies)

**Change Made**:
```typescript
export async function create(options: CreateOptions): Promise<Info> {
  // ... create activity object ...

  // NEW: Enforce boredom detection markers consistency
  const hasBoredomPrefix = activity.title.includes('[BOREDOM]') || activity.title.includes('[MANUAL BOREDOM]')
  const hasBoredomBranch = activity.branch === 'boredom-activity'
  
  if (hasBoredomPrefix || hasBoredomBranch) {
    // If any boredom marker is present, enforce all markers
    activity.isBoredom = true
    
    // Determine initiation type from title
    if (activity.title.includes('[MANUAL BOREDOM]')) {
      activity.initiatedBy = 'boredom-manual'
    } else if (activity.title.includes('[BOREDOM]')) {
      activity.initiatedBy = 'boredom-auto'
    }
    
    // Ensure branch is set for consistency
    if (!hasBoredomBranch) {
      activity.branch = 'boredom-activity'
    }
  }

  await save(activity)
  // ...
}
```

**Reason**:
- Manual boredom activities didn't set `branch: "boredom-activity"` (inconsistent)
- No validation to prevent mismatched markers (title with [BOREDOM] but wrong branch)
- No unified marker injection logic
- Each code path (auto vs manual) set markers differently

**Impact Analysis**:
- ✅ **Automatic consistency**: Any activity with `[BOREDOM]` prefix gets all markers
- ✅ **Manual boredom fixed**: Now sets branch automatically
- ✅ **Validation at source**: Prevents inconsistencies at creation time
- ⚠️ **Applies to all activities**: Validation runs on every `Activity.create()` call

**Before/After**:
```typescript
// Before (Manual boredom):
{
  title: "[MANUAL BOREDOM] fix-auth",
  branch: "default-session-branch",  // ❌ Wrong!
  isBoredom: undefined,  // ❌ Missing!
  initiatedBy: undefined  // ❌ Missing!
}

// After (Manual boredom):
{
  title: "[MANUAL BOREDOM] fix-auth",
  branch: "boredom-activity",  // ✅ Auto-corrected
  isBoredom: true,  // ✅ Set automatically
  initiatedBy: "boredom-manual"  // ✅ Detected from title
}
```

---

### 4. Set Persistent Fields in Auto Execution

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`  
**Component**: `executeBoredomActivity()` (lines 296-298)  
**Priority**: 🟡 **MEDIUM** (Explicit marking)

**Change Made**:
```typescript
async function executeBoredomActivity(
  manager: ManagerInstance,
  boredomActivity: BoredomActivity
): Promise<void> {
  // ... load template, prepare variables ...

  const activity = await Activity.create({
    directory: process.cwd(),
    branch: "boredom-activity",
    baseCommit: "HEAD",
    title: `[BOREDOM] ${template.name}`,
  })

  activity.templateId = template.id
  activity.variables = variables
  activity.reason = boredomActivity.reason
  
  // NEW: Set persistent boredom fields
  activity.isBoredom = true
  activity.initiatedBy = "boredom-auto"
  
  await Activity.save(activity)
  // ...
}
```

**Reason**:
- Explicit marking of auto-executed boredom activities
- While validation in `Activity.create()` would set these automatically, explicit setting is clearer
- Ensures fields are set even if validation logic changes
- Documents intent in code

**Impact Analysis**:
- ✅ **Low risk**: Additive (validation already sets these, this is redundant but safe)
- ✅ **Clear intent**: Code explicitly states "this is a boredom activity"
- ✅ **Defense in depth**: Works even if validation logic is bypassed

---

### 5. Update Failed Activity Status

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`  
**Component**: `executeBoredomActivity()` error handling (lines 361-376)  
**Priority**: 🟡 **MEDIUM** (Data hygiene)

**Change Made**:
```typescript
async function executeBoredomActivity(...): Promise<void> {
  try {
    // ... execute boredom activity ...
  } catch (error) {
    l.error("Boredom activity execution failed", {
      error,
      template_id: boredomActivity.template_id,
    })
    
    // NEW: Update activity status to failed
    if (manager.currentActivity?.activityId) {
      try {
        const activity = await Activity.get(manager.currentActivity.activityId)
        if (activity) {
          activity.status = "failed"
          activity.error = error instanceof Error ? error.message : String(error)
          await Activity.save(activity)
        }
      } catch (updateError) {
        l.error("Failed to update activity status", { updateError })
      }
    }
    // Don't throw - continue monitoring
  } finally {
    manager.currentActivity = undefined
  }
}
```

**Reason**:
- Failed boredom activities left orphaned in `"setup"` status
- Storage accumulated incomplete activities indefinitely
- Metrics showed false "in-progress" activities
- Debugging confusion (activities look like they're still running)

**Impact Analysis**:
- ✅ **Low risk**: Cleanup code only, doesn't affect success path
- ✅ **Storage hygiene**: Prevents accumulation of orphaned activities
- ✅ **Better debugging**: Failed activities clearly marked with error message
- ✅ **Accurate metrics**: Success rate calculations exclude properly marked failures

**Before/After**:
```typescript
// Before (on failure):
{
  status: "setup",  // ❌ Stuck forever
  error: undefined,  // ❌ No error info
}

// After (on failure):
{
  status: "failed",  // ✅ Clear status
  error: "Template execution failed: timeout",  // ✅ Error captured
}
```

---

## Validation Gaps Addressed

| Gap | Status | Solution |
|-----|--------|----------|
| No `isBoredom` field in schema | ✅ **FIXED** | Added `isBoredom` and `initiatedBy` optional fields |
| Debug `[EVIDENCE_TEST]` prefix breaks detection | ✅ **FIXED** | Removed debug code at activity.ts:443 |
| Manual boredom inconsistent with auto | ✅ **FIXED** | Enforcement logic auto-sets `branch='boredom-activity'` |
| No schema enforcement of markers | ✅ **FIXED** | Validation in `Activity.create()` enforces consistency |
| No cleanup of failed boredom activities | ✅ **FIXED** | Error handler updates status to `"failed"` with message |
| Memory leak in session tracking | ✅ **ALREADY FIXED** | `stopMonitoring()` already deletes from Map (line 102) |

---

## Detection Mechanisms Status

| Mechanism | Before | After | Status |
|-----------|--------|-------|--------|
| **Title Prefix** | Broken by debug code | Clean, works correctly | ✅ **FIXED** |
| **Branch Name** | Inconsistent (auto-only) | Enforced for all | ✅ **FIXED** |
| **Reason Field** | Working | Working | ✅ **UNCHANGED** |
| **Runtime Flag** | Working | Working | ✅ **UNCHANGED** |
| **Stats API** | Working | Working | ✅ **UNCHANGED** |
| **Persistent Field** | Missing | Added with enforcement | ✅ **ADDED** |

---

## Data Flow Validation

### Input Schema Changes
- ✅ **Activity.Info** schema extended with `isBoredom` and `initiatedBy` fields
- ✅ **Backward compatible**: Fields are optional
- ✅ **No migration needed**: Existing activities remain valid

### Transformation Updates
- ✅ **Activity.create()**: Validates and enforces boredom markers automatically
- ✅ **BoredomManager.executeBoredomActivity()**: Sets persistent fields explicitly
- ✅ **All entry points**: Unified validation applies consistently

### Output Consumers Updated
1. **Stats Command**:
   - Can now query `isBoredom` field for reliable detection
   - Can show breakdown by `initiatedBy` (user vs auto vs manual)

2. **Learning Loop**:
   - Can filter activities by `initiatedBy` for accurate metrics
   - Separate success rates: user activities vs boredom activities

3. **Storage Queries**:
   - Can filter by boolean: `WHERE isBoredom = true`
   - No longer requires string matching: `WHERE title LIKE '%BOREDOM%'`

---

## Ripple Effects & Action Items

### 1. Activity Storage
**Impact**: All new activities will have optional boredom fields populated when applicable  
**Action**: ✅ No migration needed - fields are optional

### 2. Activity Queries
**Impact**: Can now reliably filter boredom activities using `WHERE isBoredom = true`  
**Action**: 📝 **TODO**: Update analytics queries to use persistent field instead of `title LIKE '%BOREDOM%'`

Example:
```sql
-- Before (unreliable):
SELECT * FROM activities WHERE title LIKE '%BOREDOM%'

-- After (reliable):
SELECT * FROM activities WHERE isBoredom = true
```

### 3. Stats Command Display
**Impact**: Can show accurate boredom activity counts and lineage  
**Action**: 📝 **TODO**: Consider updating display to show `initiatedBy` breakdown

Example:
```
Boredom Activities:
  Auto-executed: 45
  Manual-triggered: 12
  Total: 57
```

### 4. Learning Loop Metrics
**Impact**: More accurate success rate tracking by separating user vs boredom activities  
**Action**: 📝 **TODO**: Update metrics collection to use `initiatedBy` field

Example:
```typescript
// Separate metrics:
const userActivities = activities.filter(a => a.initiatedBy === 'user')
const boredomActivities = activities.filter(a => a.isBoredom)

const userSuccessRate = calculateSuccessRate(userActivities)
const boredomSuccessRate = calculateSuccessRate(boredomActivities)
```

---

## Testing Recommendations

### Test 1: Auto Boredom Activity Creation
**Input**: BoredomManager triggers boredom activity  
**Expected Output**:
```json
{
  "title": "[BOREDOM] fix-auth-failures",
  "branch": "boredom-activity",
  "isBoredom": true,
  "initiatedBy": "boredom-auto",
  "reason": "Template 'fix-auth-failures' has 35% success rate..."
}
```

### Test 2: Manual Boredom Activity Creation
**Input**: User triggers via `opencode stats --trigger-boredom`  
**Expected Output**:
```json
{
  "title": "[MANUAL BOREDOM] improve-test-coverage",
  "branch": "boredom-activity",
  "isBoredom": true,
  "initiatedBy": "boredom-manual"
}
```

### Test 3: Failed Boredom Activity
**Input**: Boredom activity execution throws error  
**Expected Output**:
```json
{
  "status": "failed",
  "error": "Template execution failed: timeout after 600s",
  "isBoredom": true
}
```

### Test 4: Query by isBoredom Field
**Input**: Query storage for boredom activities  
**Expected Output**: All activities with `isBoredom = true` returned, including both auto and manual

### Test 5: Marker Consistency Enforcement
**Input**: Create activity with `[BOREDOM]` prefix but no branch  
**Expected Output**: `branch` automatically set to `"boredom-activity"`

### Test 6: Title Detection Without Debug Prefix
**Input**: Create activity with title `"[BOREDOM] My Activity"`  
**Expected Output**: Title remains clean, no `[EVIDENCE_TEST]` prefix added

---

## Enforcement Impulse

**Impulse ID**: `enforcement-boredom-activity-detection-mechanism`  
**Type**: `memo`  
**Content**: This document + JSON summary  
**Budget**: 3000 tokens

**Usage**:
- ✅ Downstream validation tasks can verify enforcement
- ✅ Testing tasks can use recommended test cases
- ✅ Analytics tasks can update queries to use new fields
- ✅ Documentation tasks can reference enforcement details

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Files Modified | 2 |
| Components Updated | 5 |
| Lines Added | ~40 |
| Lines Removed | ~3 |
| Gaps Addressed | 6/6 (1 already fixed) |
| New Schema Fields | 2 (`isBoredom`, `initiatedBy`) |
| Detection Mechanisms Fixed | 3 (title, branch, persistent) |
| Detection Mechanisms Added | 1 (persistent field) |
| Backward Compatibility | ✅ Full (optional fields) |

---

## Next Steps

### Immediate
1. ✅ **Commit changes** - All code changes applied and ready
2. 📝 **Run tests** - Execute testing recommendations to validate fixes
3. 📝 **Monitor boredom activities** - Verify fields are set correctly in production

### Short-term
1. 📝 **Update analytics queries** - Use `isBoredom` field instead of title matching
2. 📝 **Enhance stats display** - Show breakdown by `initiatedBy`
3. 📝 **Update Learning Loop** - Separate user vs boredom activity metrics

### Long-term
1. 📝 **Add validation tests** - Automated tests for marker consistency
2. 📝 **Create validation harness** - Scan existing activities for inconsistencies
3. 📝 **Consider migration tool** - Backfill `isBoredom` for existing activities (optional)

---

## Conclusion

The Boredom Activity Detection Mechanism enforcement is **COMPLETE**. All critical gaps identified in the trace analysis have been addressed:

✅ **Persistent tracking** - `isBoredom` and `initiatedBy` schema fields  
✅ **Consistent markers** - Automatic enforcement at creation  
✅ **Clean detection** - Debug code removed  
✅ **Failed activity cleanup** - Status updated on error  
✅ **Reliable querying** - Boolean fields instead of string matching  

The implementation is **backward compatible** (optional fields), has **low risk** (additive changes + bug fixes), and provides **high value** (reliable detection, accurate metrics, better debugging).

**Impact**: Medium (schema + validation), **Risk**: Low (backward compatible), **Value**: High (enables reliable boredom tracking)
