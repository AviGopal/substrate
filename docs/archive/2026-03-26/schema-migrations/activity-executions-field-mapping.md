# Activity Executions Schema Field Mapping

## Overview

The `activity_executions` table schema was updated in migration `006-dashboard-tables.surql` as part of the **Dashboard Activity History Live Demo** specification.

## Field Name Changes

The following field names were changed to align with Python code usage in `repos/metabob-rpc-api/server/db/operations/activity_execution.py`:

| Old Field Name | New Field Name | Type | Description |
|----------------|----------------|------|-------------|
| `execution_id` | `activity_id` | string | Unique identifier for the activity instance |
| `variant_id` | `template_id` | string | Template identifier used for the activity |

## Why the Change?

**Problem**: Schema field names did not match the field names used in Python code, causing insert failures.

**Root Cause**: Original schema was designed with `execution_id` and `variant_id`, but `insert_execution()` function uses `activity_id` and `template_id`.

**Solution**: Updated schema to match actual code usage.

## Impact

### ✅ No Breaking Changes
- Old field names were **never deployed** to production
- No backward compatibility needed
- No data migration required (new table)

### ✅ Future Specifications
All future specifications using the `activity_executions` table should use:
- `activity_id` (not `execution_id`)
- `template_id` (not `variant_id`)

## Current Schema

```sql
-- Activity Executions table
-- Records individual activity execution within sessions
-- SCHEMA ALIGNED WITH activity_execution.py insert_execution() function
DEFINE TABLE activity_executions SCHEMAFULL;

-- Core identifiers (match insert_execution params)
DEFINE FIELD activity_id ON activity_executions TYPE string ASSERT $value != NONE;
DEFINE FIELD template_id ON activity_executions TYPE string ASSERT $value != NONE;

-- Timestamps (match insert_execution params: started_at, completed_at)
DEFINE FIELD started_at ON activity_executions TYPE datetime ASSERT $value != NONE;
DEFINE FIELD completed_at ON activity_executions TYPE option<datetime>;
DEFINE FIELD created_at ON activity_executions TYPE datetime DEFAULT time::now();

-- Execution metrics
DEFINE FIELD duration_ms ON activity_executions TYPE int ASSERT $value != NONE;
DEFINE FIELD success ON activity_executions TYPE bool ASSERT $value != NONE;
DEFINE FIELD cost_usd ON activity_executions TYPE float DEFAULT 0.0;

-- Token usage breakdown
DEFINE FIELD tokens_input ON activity_executions TYPE int DEFAULT 0;
DEFINE FIELD tokens_output ON activity_executions TYPE int DEFAULT 0;
DEFINE FIELD tokens_cache ON activity_executions TYPE int DEFAULT 0;
DEFINE FIELD tokens_total ON activity_executions TYPE int DEFAULT 0;

-- Error tracking (optional fields)
DEFINE FIELD error_message ON activity_executions TYPE option<string>;
DEFINE FIELD error_type ON activity_executions TYPE option<string>;
DEFINE FIELD failed_task_id ON activity_executions TYPE option<string>;

-- Learning and correlation data (optional)
DEFINE FIELD impulses ON activity_executions TYPE option<array>;
DEFINE FIELD impulses_used ON activity_executions TYPE option<array>;
DEFINE FIELD component_changes ON activity_executions TYPE option<array>;

-- Indexes for query performance
DEFINE INDEX execution_activity_idx ON activity_executions FIELDS activity_id;
DEFINE INDEX execution_template_idx ON activity_executions FIELDS template_id;
DEFINE INDEX execution_started_at_idx ON activity_executions FIELDS started_at;
DEFINE INDEX execution_success_idx ON activity_executions FIELDS success;
```

## Python Code Reference

**File**: `repos/metabob-rpc-api/server/db/operations/activity_execution.py`

**Function**: `insert_execution()`

**Parameters**:
```python
async def insert_execution(
    activity_id: str,        # Maps to schema field: activity_id
    template_id: str,        # Maps to schema field: template_id
    started_at: datetime,    # Maps to schema field: started_at
    duration_ms: int,        # Maps to schema field: duration_ms
    success: bool,           # Maps to schema field: success
    tokens_input: int,       # Maps to schema field: tokens_input
    tokens_output: int,      # Maps to schema field: tokens_output
    tokens_cache: int,       # Maps to schema field: tokens_cache
    cost_usd: float,         # Maps to schema field: cost_usd
    completed_at: Optional[datetime] = None,
    error_message: Optional[str] = None,
    error_type: Optional[str] = None,
    failed_task_id: Optional[str] = None,
    impulses: Optional[List[Dict[str, Any]]] = None,
    impulses_used: Optional[List[Dict[str, Any]]] = None,
    component_changes: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    ...
```

## Related Specifications

- **Dashboard Activity History Live Demo**: Primary specification that drove this change
- **surrealdb-primary-redis-cache**: Uses `get_organization_activity()` to read from this table
- **thompson-sampling-in-rpc-api-only**: Updates metrics that reference activity_executions

## Migration Script

**File**: `repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql`

**Apply with**:
```bash
cat repos/metabob-rpc-api/sql/migrations/006-dashboard-tables.surql | \
surreal sql --conn http://localhost:8000 --ns metabob --db devbob \
--auth-level root --user root --pass root
```

## Verification

After migration, verify schema:
```sql
INFO FOR TABLE activity_executions;
```

Expected output should show `activity_id` and `template_id` fields (not `execution_id` and `variant_id`).

## Questions?

Contact the Dashboard Activity History Live Demo specification owner or refer to:
- Enforcement Summary: `ENFORCEMENT_SUMMARY_dashboard-activity-history-live-demo.md`
- Conflict Analysis: `CONFLICT_ANALYSIS_dashboard-activity-history-live-demo.md`
- Trace Analysis: `TRACE_ANALYSIS_dashboard-activity-history-live-demo.json`
