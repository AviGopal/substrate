# Activity History Dashboard Data Accuracy - Implementation Trace

**Specification**: activity-history-dashboard-data-accuracy  
**Traced**: 2026-03-06  
**Status**: CRITICAL SCHEMA MISMATCHES IDENTIFIED

## Executive Summary

The activity history dashboard at `/cloud/activity` is **partially functional** but has **3 critical schema mismatches** that may cause data retrieval failures:

1. ⚠️ **HIGH SEVERITY**: Analytics queries use `timestamp` field but schema defines `started_at`
2. ⚠️ **HIGH SEVERITY**: `execution_id` field used in queries but NOT defined in activity_executions schema
3. ⚠️ **MEDIUM SEVERITY**: Schema divergence between `activity_execution` (old) and `activity_executions` (new)

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND: metabob-dashboard                                         │
├─────────────────────────────────────────────────────────────────────┤
│ ActivityHistory.js:252-398                                          │
│ └─> useGetExecutionsQuery(filters)                                  │
│     └─> RTK Query: GET /analytics/executions                        │
│                                                                      │
│ ExecutionRow.js:56-247                                              │
│ └─> fetch(`/analytics/executions/${execution_id}`)                  │
│     └─> Expandable row detail view                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ API LAYER: OrganizationApi.js                                       │
├─────────────────────────────────────────────────────────────────────┤
│ getExecutions (RTK Query endpoint)                                  │
│ └─> baseQuery: fetchBaseQuery with JWT auth                         │
│     └─> GET /analytics/executions?limit=25&offset=0&...             │
│                                                                      │
│ getExecutionDetails (RTK Query endpoint)                            │
│ └─> GET /analytics/executions/{executionId}                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ BACKEND: metabob-rpc-api                                            │
├─────────────────────────────────────────────────────────────────────┤
│ server/routes/analytics.py:511-718                                  │
│ └─> get_executions_filtered()                                       │
│     └─> Query: SELECT execution_id, template_id, timestamp, ...     │
│         FROM activity_executions WHERE {filters}                    │
│         ORDER BY {sort_field} LIMIT $limit START $offset            │
│     └─> For each execution: Query task_execution for task_count     │
│     └─> Return: {executions: [...], total: N, hasMore: bool}        │
│                                                                      │
│ server/routes/analytics.py:721-869                                  │
│ └─> get_execution_details(execution_id)                             │
│     └─> Query activity_executions WHERE execution_id = $id          │
│     └─> get_task_executions(execution_id)                           │
│     └─> Query activity_content for template/variables               │
│     └─> Return: {execution: {...}, tasks: [...], content: {...}}    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ DATABASE: SurrealDB (metabob/devbob)                                │
├─────────────────────────────────────────────────────────────────────┤
│ activity_executions (SCHEMAFULL)                                    │
│ ├─> activity_id: string (NOT NULL)                                  │
│ ├─> template_id: string (NOT NULL)                                  │
│ ├─> started_at: datetime (NOT NULL) ❌ NOT "timestamp"              │
│ ├─> completed_at: datetime (optional)                               │
│ ├─> duration_ms: int (NOT NULL)                                     │
│ ├─> success: bool (NOT NULL)                                        │
│ ├─> tokens_input/output/cache/total: int                            │
│ ├─> cost_usd: float                                                 │
│ ├─> error_message/type: string (optional)                           │
│ ├─> impulses_used: array (optional)                                 │
│ └─> component_changes: array (optional)                             │
│ ❌ MISSING: execution_id field (used in queries!)                   │
│                                                                      │
│ task_execution (SCHEMAFULL)                                         │
│ ├─> execution_id: string (foreign key)                              │
│ ├─> task_id: string                                                 │
│ ├─> task_index: int                                                 │
│ ├─> subagent: string                                                │
│ ├─> status: string                                                  │
│ ├─> success: bool                                                   │
│ ├─> started_at/completed_at: datetime                               │
│ ├─> duration_ms: int                                                │
│ ├─> tokens_input/output/cache: int                                  │
│ ├─> cost_usd: float                                                 │
│ └─> error_message: string (optional)                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Critical Issues

### Issue 1: Field Name Mismatch (timestamp vs started_at)

**Severity**: HIGH  
**Impact**: Queries will fail or return null values if SCHEMAFULL enforcement is strict

**Schema Definition** (repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql:116):
```sql
DEFINE FIELD started_at ON activity_executions TYPE datetime ASSERT $value != NONE;
```

**Query Usage** (repos/metabob-rpc-api/server/routes/analytics.py:624):
```python
query = f"""
    SELECT 
        execution_id,
        template_id,
        timestamp,  # ❌ WRONG - should be started_at
        ...
    FROM activity_executions
"""
```

**Occurrences in analytics.py**:
- Line 579: `filters.append("timestamp >= $start_date")`
- Line 583: `filters.append("timestamp <= $end_date")`
- Line 613: `sort_field = "timestamp"`
- Line 624: `SELECT ... timestamp ... FROM activity_executions`
- Line 677: `"timestamp": clean_record["timestamp"]`

**Fix Options**:
1. **Recommended**: Update analytics.py to use `started_at` field (5 line changes)
2. **Alternative**: Add `timestamp` as alias in schema migration

---

### Issue 2: Missing execution_id Field

**Severity**: HIGH  
**Impact**: Queries assume execution_id exists but schema doesn't define it

**Schema Gap** (repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql:109-146):
```sql
DEFINE TABLE activity_executions SCHEMAFULL;
DEFINE FIELD activity_id ON activity_executions TYPE string ASSERT $value != NONE;
DEFINE FIELD template_id ON activity_executions TYPE string ASSERT $value != NONE;
# ❌ MISSING: execution_id field definition
```

**Query Usage** (repos/metabob-rpc-api/server/routes/analytics.py:620):
```python
query = f"""
    SELECT 
        execution_id,  # ❌ Field not defined in schema!
        activity_id,
        template_id,
        ...
    FROM activity_executions
"""
```

**Data Insertion** (repos/metabob-rpc-api/server/db/operations/activity_execution.py:79-98):
```python
data = {
    "activity_id": activity_id,
    "template_id": template_id,
    # execution_id is NOT set - using activity_id as primary identifier
    "started_at": started_at,
    ...
}
result = await db.create("activity_executions", data)
```

**Fix Required**:
```sql
-- Add to 006-dashboard-tables.surql after line 113
DEFINE FIELD execution_id ON activity_executions TYPE string ASSERT $value != NONE;
DEFINE INDEX execution_id_idx ON activity_executions FIELDS execution_id UNIQUE;
```

---

### Issue 3: Schema Divergence (activity_execution vs activity_executions)

**Severity**: MEDIUM  
**Impact**: Two schemas exist for same data - old code may write to wrong table

**Old Schema** (initialize-surrealdb-schema.sql:15-65):
```sql
DEFINE TABLE activity_execution SCHEMAFULL;  -- Singular
DEFINE FIELD execution_id ON activity_execution TYPE string;  -- Has execution_id!
DEFINE FIELD variant_id ON activity_execution TYPE string;
...
```

**New Schema** (repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql:109):
```sql
DEFINE TABLE activity_executions SCHEMAFULL;  -- Plural
-- No execution_id field ❌
-- No variant_id field ❌
```

**Fix Required**: Migrate execution_id and variant_id from old schema to new schema

---

## Current State vs Desired State

### Current State

| Feature | Status | Notes |
|---------|--------|-------|
| UI Rendering | ✅ Working | Table, filters, pagination work |
| RTK Query Integration | ✅ Working | API calls properly authenticated |
| Analytics Endpoint | ⚠️ Schema Issues | Queries use wrong field names |
| Task Breakdown | ✅ Working | task_execution join works correctly |
| Impulse Correlation | ✅ Working | impulses_used field displays correctly |
| Cost Metrics | ✅ Working | tokens_*, cost_usd fields accurate |
| Error Details | ✅ Working | error_message, error_type fields display |
| Variant Tracking | ❌ Missing | No variant_id in new schema |
| Composition Tracking | ❌ Missing | No parent/child activity linking |
| Summary Cards | ❌ Missing | No aggregated stats display |

### Desired State

1. **Schema Alignment**: All queries use correct field names (started_at, not timestamp)
2. **Complete Schema**: execution_id field defined with UNIQUE index
3. **Variant Support**: variant_id field for A/B testing visualization
4. **Composition Support**: parent_activity_id field for nested activities
5. **Summary Metrics**: Dashboard displays total executions, success rate, total cost, avg duration
6. **Advanced Filters**: Date range, cost range, duration range filters in UI

---

## Validation Steps

### 1. Check SurrealDB Schema
```bash
# Connect to SurrealDB
surreal sql --endpoint http://localhost:8000 --namespace metabob --database devbob

# Verify schema
INFO FOR TABLE activity_executions;

# Expected fields: activity_id, template_id, started_at, execution_id (after fix)
# Check for execution_id field
SELECT execution_id, started_at FROM activity_executions LIMIT 1;
```

### 2. Test Analytics Endpoint
```bash
# Test executions list
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/analytics/executions?limit=10&offset=0"

# Expected: {executions: [...], total: N, hasMore: bool}
# Check for errors about "timestamp" or "execution_id" fields
```

### 3. Test Detail Endpoint
```bash
# Test execution detail
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/analytics/executions/exec_abc123"

# Expected: {execution: {...}, tasks: [...], content: {...}}
```

### 4. Test Dashboard UI
```bash
# Navigate to dashboard
open http://localhost:3000/cloud/activity

# Verify:
# - Table loads without errors
# - Filters work (template_id, success status)
# - Sorting works (timestamp, cost, duration)
# - Pagination works
# - Expandable rows load task details
```

### 5. End-to-End Test
```bash
# Run an activity
opencode activity add-feature-complete --variables '{"feature": "test"}'

# Check execution appears in dashboard
# Verify all fields display correctly
# Verify task breakdown shows accurate data
```

---

## Recommended Fixes (Priority Order)

### Priority 1: Fix Field Name Mismatch (analytics.py)

**File**: repos/metabob-rpc-api/server/routes/analytics.py

**Lines to change**:
```python
# Line 579
- filters.append("timestamp >= $start_date")
+ filters.append("started_at >= $start_date")

# Line 583
- filters.append("timestamp <= $end_date")
+ filters.append("started_at <= $end_date")

# Line 613
- sort_field = "timestamp"
+ sort_field = "started_at"

# Line 624
- SELECT ... timestamp ...
+ SELECT ... started_at AS timestamp ...  # Keep alias for backward compat

# Line 677
# No change needed - response already maps correctly
```

### Priority 2: Add execution_id to Schema

**File**: repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql

**After line 113** (after template_id):
```sql
DEFINE FIELD execution_id ON activity_executions TYPE string ASSERT $value != NONE;
```

**After line 145** (after indexes):
```sql
DEFINE INDEX execution_id_idx ON activity_executions FIELDS execution_id UNIQUE;
```

**Update insert operation** (repos/metabob-rpc-api/server/db/operations/activity_execution.py:79):
```python
data = {
    "execution_id": f"exec_{activity_id}_{int(started_at.timestamp())}",  # Generate unique ID
    "activity_id": activity_id,
    "template_id": template_id,
    ...
}
```

### Priority 3: Reconcile Schema Divergence

**Option A**: Migrate old activity_execution table data to activity_executions
```sql
-- Copy data from old table to new table
INSERT INTO activity_executions 
  SELECT 
    execution_id,
    activity_id,
    template_id,
    created_at AS started_at,
    ...
  FROM activity_execution;

-- Drop old table after migration
DROP TABLE activity_execution;
```

**Option B**: Update all code to use activity_executions (plural) consistently

---

## Files Modified

1. ✏️ repos/metabob-rpc-api/server/routes/analytics.py (5 lines)
2. ✏️ repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql (2 lines)
3. ✏️ repos/metabob-rpc-api/server/db/operations/activity_execution.py (1 line)

---

## Testing Checklist

- [ ] Schema migration applied to devbob database
- [ ] Analytics endpoint returns data without errors
- [ ] Dashboard table loads and displays executions
- [ ] Filters work (template_id, success status)
- [ ] Sorting works (timestamp → started_at, cost, duration)
- [ ] Pagination works correctly
- [ ] Expandable rows load task details
- [ ] Impulses display correctly in detail view
- [ ] Error messages display for failed executions
- [ ] Cost and token metrics display accurately
- [ ] End-to-end: Run activity → Verify in dashboard

---

## Conclusion

The activity history dashboard implementation is **80% complete** but has **critical schema mismatches** that must be fixed before production deployment. The UI and API layers are well-designed, but the analytics queries use field names that don't match the SurrealDB schema.

**Estimated Fix Time**: 1-2 hours  
**Risk**: Medium (schema changes + query updates)  
**Impact**: HIGH - Dashboard will not function correctly without these fixes
