# Dashboard Observability - Root Cause Identified
**Date**: 2026-03-22  
**Status**: 🔍 **ROOT CAUSE IDENTIFIED - SCHEMA MISMATCH**

---

## The Problem

MiniBob executes activities successfully, but they don't appear in the dashboard because the backend cannot store them in SurrealDB due to **schema validation failures**.

---

## Root Cause

**SurrealDB SCHEMAFULL mode is rejecting MiniBob's template registration** because the schema definition is incomplete.

### Error from Backend Logs:

```
Found field 'task_steps[1].dependencies', but no such field exists for table 'activity_template'
```

### What's Happening:

1. ✅ MiniBob executes activity successfully
2. ✅ MiniBob tries to register template with backend
3. ❌ Backend tries to INSERT into `activity_template` table
4. ❌ SurrealDB rejects INSERT - schema doesn't define nested fields in `task_steps` array
5. ❌ Template not stored = dashboard shows 0 templates
6. ❌ Execution trace also not stored (depends on template existing)

### Schema Definition (Current):

```sql
DEFINE FIELD task_steps ON activity_template TYPE option<array>
  COMMENT "Array of task definitions (flexible structure)";
```

**Problem**: This allows an array, but SCHEMAFULL mode still validates nested fields. MiniBob sends:

```json
{
  "task_steps": [
    {
      "id": "echo-message",
      "subagent": "general-purpose",
      "description": "Echo a message",
      "dependencies": [],  // ❌ This field is not defined!
      "prompt": { ... }
    }
  ]
}
```

---

## The Fix

### Option 1: Change Schema to SCHEMALESS (Quick Fix - 5 min)

Make `activity_template` table SCHEMALESS so it accepts any JSON structure:

```sql
-- Replace SCHEMAFULL with SCHEMALESS
DEFINE TABLE activity_template SCHEMALESS;
```

**Pros**:
- Immediate fix
- No code changes needed
- Maximum flexibility

**Cons**:
- Loses validation benefits
- Could allow bad data

### Option 2: Define Complete Nested Schema (Proper Fix - 30 min)

Define every field in the task_steps array structure:

```sql
DEFINE TABLE activity_template SCHEMAFULL;

-- ... other fields ...

-- Define task_steps with complete structure
DEFINE FIELD task_steps ON activity_template TYPE option<array>;
DEFINE FIELD task_steps[*].id ON activity_template TYPE string;
DEFINE FIELD task_steps[*].subagent ON activity_template TYPE string;
DEFINE FIELD task_steps[*].description ON activity_template TYPE string;
DEFINE FIELD task_steps[*].dependencies ON activity_template TYPE array;
DEFINE FIELD task_steps[*].prompt ON activity_template TYPE object;
DEFINE FIELD task_steps[*].prompt.template ON activity_template TYPE string;
DEFINE FIELD task_steps[*].prompt.maxTokens ON activity_template TYPE option<int>;
DEFINE FIELD task_steps[*].prompt.variables ON activity_template TYPE option<array>;
-- ... etc for all nested fields
```

**Pros**:
- Proper data validation
- Type safety
- Catches errors early

**Cons**:
- More work to define
- Less flexible for schema evolution

### Option 3: Hybrid - SCHEMAFULL with FLEXIBLE Object (Recommended - 10 min)

Keep SCHEMAFULL for top-level fields but make `task_steps` flexible:

```sql
DEFINE TABLE activity_template SCHEMAFULL;

-- ... other fields with validation ...

-- Make task_steps flexible (any JSON structure)
DEFINE FIELD task_steps ON activity_template TYPE option<object> FLEXIBLE;
```

Or change to:
```sql
DEFINE FIELD task_steps ON activity_template TYPE option<any>;
```

**Pros**:
- Top-level validation maintained
- Nested structure flexible
- Easy to implement

**Cons**:
- Partial validation only

---

## Immediate Action Plan

### Step 1: Apply Quick Fix (5 minutes)

```bash
# Port-forward to SurrealDB
kubectl port-forward -n activity-system svc/surrealdb 8001:8000 &

# Apply fix via SQL
curl -X POST "http://localhost:8001/sql" \
  -H "Accept: application/json" \
  -H "surreal-ns: activity-system" \
  -H "surreal-db: learning_loop" \
  -H "Authorization: Basic $(echo -n 'root:surrealdb-local-dev-123' | base64)" \
  -d "
    -- Remove old table
    REMOVE TABLE activity_template;
    
    -- Recreate as SCHEMALESS
    DEFINE TABLE activity_template SCHEMALESS;
    
    -- Add index (still works with SCHEMALESS)
    DEFINE INDEX idx_activity_template_variant_id 
      ON activity_template FIELDS variant_id UNIQUE;
    DEFINE INDEX idx_activity_template_activity_id 
      ON activity_template FIELDS activity_id;
  "
```

### Step 2: Execute Activity (2 minutes)

```bash
curl -X POST http://devbob.minibob.local/run \
  -H "Content-Type: application/json" \
  -d '{
    "template": "templates/hello-world.json",
    "variables": {"message": "🎉 Schema fixed - testing storage!"},
    "reason": "First test after schema fix"
  }'
```

### Step 3: Verify Storage (1 minute)

```bash
# Check backend API
curl -s "http://api.minibob.local/v2/activities/templates" | jq '{total: .total}'

# Should return: {"total": 1}
```

### Step 4: Observe in Dashboard (1 minute)

1. Open http://dashboard.minibob.local
2. Click "Library" tab
3. **Should see hello-world template!**
4. Overview tab should show 1 execution

---

## Expected Result After Fix

### Backend API Response:
```json
{
  "templates": [
    {
      "variant_id": "hello-world",
      "activity_id": "hello-world",
      "variant_name": "Hello World Test",
      "category": "tool",
      "metrics": {
        "total_executions": 1,
        "successful_executions": 1,
        "success_rate": 1.0,
        "thompson_alpha": 2,
        "thompson_beta": 1
      }
    }
  ],
  "total": 1
}
```

### Dashboard Overview Tab:
- ✅ Total Executions: **1**
- ✅ Success Rate: **100%**
- ✅ Avg Duration: **~38s**
- ✅ Total Cost: **$0.17**

### Dashboard Library Tab:
- ✅ **1 template** visible
- ✅ hello-world row showing:
  - Category: tool
  - Executions: 1
  - Success Rate: 100%
  - Thompson α/β: 2/1

---

## Why This Wasn't Caught Earlier

1. **Migration script succeeded** - It created the tables successfully with the schema defined
2. **No validation errors** - SurrealDB accepted the schema definition
3. **Runtime failure only** - Error only occurs when MiniBob tries to INSERT data
4. **Mismatch between schema definition and data structure** - Schema said "flexible array" but SCHEMAFULL mode still enforced validation

The migration script saying "already exists (skipped)" was misleading - it meant the table structure existed, but that structure was **incompatible with the data** being inserted.

---

## Long-Term Solution

### Update Migration File: `001-init-schema.surql`

Replace SCHEMAFULL with SCHEMALESS for tables with complex nested structures:

```sql
-- activity_template: SCHEMALESS for flexibility
DEFINE TABLE activity_template SCHEMALESS;

-- Still define important indexes
DEFINE INDEX idx_activity_template_variant_id 
  ON activity_template FIELDS variant_id UNIQUE;
```

### Keep SCHEMAFULL for Simple Tables

Tables with predictable structure should remain SCHEMAFULL:

```sql
-- variant_performance_metrics: SCHEMAFULL (simple flat structure)
DEFINE TABLE variant_performance_metrics SCHEMAFULL;

DEFINE FIELD variant_id ON variant_performance_metrics TYPE string ASSERT $value != NONE;
DEFINE FIELD total_executions ON variant_performance_metrics TYPE int VALUE $value OR 0;
-- ... etc
```

---

## Evidence Collection

### Successful Execution (MiniBob):
```json
{
  "id": "act_1774178606658_9cktvw",
  "status": "completed",
  "duration": 38488,
  "cost": 0.166344,
  "taskResults": [
    {"taskId": "echo-message", "status": "completed"},
    {"taskId": "read-file", "status": "completed"}
  ]
}
```

### Failed Storage (Backend):
```
ERROR: Found field 'task_steps[1].dependencies', 
       but no such field exists for table 'activity_template'
```

### Empty Database Query:
```sql
SELECT * FROM activity_template; -- Returns: []
SELECT * FROM execution_traces;  -- Returns: []
```

---

## Testing the Fix

### Test 1: Template Registration
```bash
# Should succeed and return template data
curl -s "http://api.minibob.local/v2/activities/templates" | jq .
```

### Test 2: Execution Trace Storage
```bash
# Should show execution record
curl -s "http://api.minibob.local/v2/activities/execution-traces" | jq .
```

### Test 3: Dashboard Visibility
- Open dashboard
- Library tab should show templates
- Overview tab should show metrics
- Real-time updates should work (after WebSocket fix)

---

## Summary

**Root Cause**: SurrealDB SCHEMAFULL table rejecting MiniBob's data due to incomplete nested field definitions

**Fix**: Change `activity_template` table to SCHEMALESS mode

**Time to Fix**: 5 minutes

**Time to Verify**: 3 minutes

**Total Time to Observability**: **10 minutes**

---

## Next Steps After Fix

1. ✅ Fix schema (SCHEMALESS)
2. ✅ Execute test activity
3. ✅ Verify dashboard shows data
4. 🔧 Fix WebSocket proxy (for real-time updates)
5. 🎯 Trigger boredom loop (observe autonomous improvement)
6. 📸 Screenshot working dashboard
7. 📊 Monitor Thompson Sampling evolution

**ETA to Full Dashboard Observability**: 20 minutes from now

---

**Status**: Ready to apply fix
