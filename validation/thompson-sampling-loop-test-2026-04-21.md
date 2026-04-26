# Thompson Sampling Learning Loop Validation Report
**Test Date:** 2026-04-21  
**Backend Version:** 1.4.0  
**Migration:** 074 (comprehensive PERMISSIONS fix)

## Test Objective
Execute an activity via MiniBob and verify that template metrics update correctly, proving the comprehensive PERMISSIONS fix works end-to-end.

## Before State (17:39 UTC)
- **Total Templates:** 4
- **All templates frozen at:** α=1, β=1 (50% Thompson score)
- **Total Executions:** 0 across all templates

### Sample Templates (Before)
```json
[
  {
    "id": "activity:tpl_1776789483085_wyxyw",
    "name": "learned-dashboard-specification-validator-mo8ukzf1",
    "total_executions": 0,
    "thompson_alpha": 1,
    "thompson_beta": 1,
    "thompson_score": 0.5
  },
  {
    "id": "activity:⟨activity:⟨Dashboard Specification Validator\\⟩⟩",
    "name": "Dashboard Specification Validator",
    "total_executions": 0,
    "thompson_alpha": 1,
    "thompson_beta": 1,
    "thompson_score": 0.5
  }
]
```

## MiniBob Execution Summary

### Command
```bash
minibob --single "analyze the current state of the activity-monitor dashboard code"
```

### Activities Executed
1. **Startup Health Check** (act_1776793194299_5x3d8j)
   - Status: ✅ Success
   - Duration: 6.5s
   - Cost: $0.0614
   - Activity ID: `activity:⟨startup:health-check⟩`
   - Trace stored: 2026-04-21T17:40:01.024Z

2. **Startup: Sync Embedded Templates** (act_1776793201911_6ozk8x)
   - Status: ✅ Success  
   - Duration: 4.5s
   - Cost: $0.0000
   - Activity ID: `activity:⟨startup:template-sync⟩`
   - Trace stored: 2026-04-21T17:40:06.607Z

3. **Goal Processing (Standard)** (act_1776793207220_hhlrv1)
   - Status: ✅ Success
   - Duration: 5.1m (307.7s)
   - Cost: $2.8772
   - Tokens: 812,468 in / 29,322 out
   - Activity ID: `activity:goal_processing_standard`
   - Trace stored: 2026-04-21T17:45:15.336Z

### Ribosome Activity
MiniBob's ribosome attempted to extract a template from the successful execution:
- Template Name: `learned-startup-health-check-mo8wsojo`
- Template ID: `tpl_1776793201478_1y3q1`
- Quality Score: 0.60
- Status: "[OK] Template registered"
- Composition Edge: `activity:⟨startup:health-check⟩ → tpl_1776793201478_1y3q1`

## After State (17:47 UTC)
- **Total Templates:** 50 (increased from 4)
- **Templates with executions:** 0
- **All templates still frozen at:** α=1, β=1 (50% Thompson score)

### Execution Traces Verified
✅ All 3 execution traces exist in backend:
```json
[
  {
    "execution_id": "act_1776793201911_6ozk8x",
    "activity_id": "activity:⟨startup:template-sync⟩",
    "variant_id": "activity:⟨startup:template-sync⟩",
    "status": "success"
  },
  {
    "execution_id": "act_1776793194299_5x3d8j",
    "activity_id": "activity:⟨startup:health-check⟩",
    "variant_id": "activity:⟨startup:health-check⟩",
    "status": "success"
  }
]
```

## Critical Finding: Thompson Sampling Not Updating

### Issue Analysis
1. **Traces are stored:** ✅ All execution traces exist in the backend
2. **Templates don't exist:** ❌ The referenced activity IDs have no corresponding templates:
   - `activity:⟨startup:health-check⟩` - Template not found
   - `activity:⟨startup:template-sync⟩` - Template not found
   - `activity:goal_processing_standard` - Template not found

3. **Ribosome extraction failed:** ❌ Template `tpl_1776793201478_1y3q1` reported as "[OK] Template registered" but doesn't exist in database

### Root Cause
The Thompson Sampling learning loop has a **missing link**:
- Executions reference `activity_id` values
- These activity IDs should map to templates in the `activity_template` table
- **BUT:** The templates don't exist, so Thompson Sampling has no metrics to update

### Why Template Count Increased (4 → 50)
The increase from 4 to 50 templates suggests the "Startup: Sync Embedded Templates" activity did upload embedded templates to the backend. However:
- None of these templates match the executed activity IDs
- None show any execution counts

## Validation Result: ❌ FAILED

### Expected Behavior
At least one template should show:
- `total_executions > 0`
- `thompson_alpha > 1` OR `thompson_beta > 1`
- `updated_at` timestamp after execution time

### Actual Behavior
- All templates remain at default values (α=1, β=1, 0 executions)
- Thompson scores unchanged (50%)
- No learning occurring despite successful executions

## Next Steps for Investigation

1. **Check Template Registration Logic:**
   - Why did ribosome report "[OK] Template registered" but template doesn't exist?
   - Is there a PERMISSIONS issue preventing template creation?
   - Is the org_id/project_id scoping correct?

2. **Verify Thompson Sampling Hook:**
   - Is the hook actually being triggered after execution?
   - Check backend logs for Thompson Sampling update attempts
   - Verify the SQL UPDATE statement has correct PERMISSIONS

3. **Check Activity ID → Template Mapping:**
   - How should embedded activities link to templates?
   - Should `activity:⟨startup:health-check⟩` automatically create a template?
   - Or should it reference an existing template?

4. **Backend Logs:**
   - Check activity-api logs for template registration errors
   - Check for PERMISSIONS violations during UPDATE
   - Verify org_id isolation isn't blocking updates

## Conclusion
While the PERMISSIONS fix (migration 074) successfully allows:
- ✅ Template listing (no more 500 errors)
- ✅ Execution trace storage
- ✅ Template syncing (4 → 50 templates)

The learning loop remains **non-functional** because:
- ❌ Executed activities don't link to existing templates
- ❌ Ribosome-extracted templates don't persist
- ❌ Thompson Sampling metrics never update

**The comprehensive PERMISSIONS fix works for READ operations, but the learning loop's WRITE operations (template updates) are still broken.**

---

## ROOT CAUSE ANALYSIS

### Why Thompson Sampling Isn't Updating

The Thompson Sampling update logic (line 1673-1687 in `src/routes/activities.ts`) executes this query:

```sql
UPDATE variant_performance_metrics 
SET 
  total_executions += 1,
  thompson_alpha = successful_executions + 1,
  thompson_beta = failed_executions + 1,
  ...
WHERE variant_id = $variant_id
RETURN AFTER;
```

**The problem**: This UPDATE only works if a record with `variant_id = "activity:⟨startup:health-check⟩"` already exists in `variant_performance_metrics`.

### The Missing Link

1. **Execution stored** → ✅ `act_1776793194299_5x3d8j` exists with `variant_id = "activity:⟨startup:health-check⟩"`
2. **Template lookup** → ❌ No template with `id = "activity:⟨startup:health-check⟩"` exists
3. **Metrics table** → ❌ No record in `variant_performance_metrics` with this `variant_id`
4. **UPDATE query** → ❌ Fails silently (WHERE clause doesn't match any rows)

### Why Templates Are Missing

**Embedded Activities** (like `startup:health-check`) are defined in MiniBob's code but aren't automatically registered as templates in the backend.

The ribosome tried to extract a template from the execution:
- Template created: `learned-startup-health-check-mo8wsojo`
- Template ID: `tpl_1776793201478_1y3q1`
- Status logged: "[OK] Template registered"

**BUT**: The template doesn't exist in the database, suggesting:
1. The API call to register the template returned 200 OK but didn't persist
2. There's a PERMISSIONS issue preventing template creation
3. The org_id scoping caused it to be invisible

### What Should Happen

**Option A: Auto-create metrics record**
When storing an execution trace, if the variant_id doesn't exist in `variant_performance_metrics`, automatically create an initial record:

```sql
-- Before UPDATE, ensure record exists
IF (SELECT * FROM variant_performance_metrics WHERE variant_id = $variant_id) IS NULL THEN
  CREATE variant_performance_metrics CONTENT {
    variant_id: $variant_id,
    activity_id: $activity_id,
    total_executions: 0,
    successful_executions: 0,
    failed_executions: 0,
    thompson_alpha: 1.0,
    thompson_beta: 1.0,
    ...
  };
END;

-- Then UPDATE
UPDATE variant_performance_metrics SET ...
```

**Option B: Require template registration first**
Don't allow executions to be stored unless the template exists. Return an error if `variant_id` isn't found.

**Option C: Use UPSERT pattern**
Replace UPDATE with an UPSERT that handles both creation and updates:

```sql
UPSERT variant_performance_metrics 
SET 
  variant_id = $variant_id,
  activity_id = $activity_id,
  total_executions = (total_executions ?? 0) + 1,
  successful_executions = (successful_executions ?? 0) + $success_delta,
  thompson_alpha = (successful_executions ?? 0) + 1,
  ...
```

### Fix Migration 074 Didn't Address

Migration 074 fixed PERMISSIONS for **SELECT** operations (reading templates, composition data). However, it didn't address the **fundamental gap** that executions can reference non-existent templates.

The learning loop needs **either**:
1. **Automatic template creation** when first execution occurs
2. **Explicit template registration** before executions are allowed
3. **UPSERT logic** that handles missing records gracefully

Currently, it assumes templates exist but doesn't enforce or create them.

---

## RECOMMENDATIONS

### Immediate Fix (Backend)

Add auto-creation logic in `POST /v2/activities/execution-traces`:

```typescript
// Before updating Thompson Sampling metrics
const ensureMetricsRecordQuery = `
  LET $existing = (SELECT * FROM variant_performance_metrics WHERE variant_id = $variant_id LIMIT 1);
  
  IF count($existing) == 0 THEN
    CREATE variant_performance_metrics CONTENT {
      variant_id: $variant_id,
      activity_id: $activity_id,
      org_id: $org_id,
      total_executions: 0,
      successful_executions: 0,
      failed_executions: 0,
      success_rate: 0.0,
      avg_duration_ms: 0.0,
      avg_cost_usd: 0.0,
      thompson_alpha: 1.0,
      thompson_beta: 1.0,
      total_selections: 0,
      created_at: time::now(),
      updated_at: time::now()
    };
  END;
`;

await surrealDB.query(ensureMetricsRecordQuery, {
  variant_id: activityIdFromRequest,
  activity_id: activityIdFromRequest,
  org_id: validated.org_id
});

// Then proceed with UPDATE
```

### Testing the Fix

After implementing the fix:

1. Clear existing executions: `DELETE FROM activity_execution_traces WHERE org_id = 'metabob'`
2. Run MiniBob again: `minibob --single "test goal"`
3. Verify metrics updated: Check templates endpoint for `total_executions > 0`
4. Verify Thompson score changed: Check `thompson_alpha` or `thompson_beta` incremented

### Long-term Solution

**Standardize template lifecycle**:
1. Templates must be explicitly registered before use
2. Embedded activities auto-register on first MiniBob bootstrap
3. Ribosome-extracted templates are validated and persisted atomically
4. Template IDs are validated before accepting execution traces

This ensures the learning loop has a complete picture of all templates and can track metrics reliably.

