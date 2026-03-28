# CRITICAL FINDING: Activity Data Persistence is Broken

## Summary

**Activity execution data is NOT being persisted to SurrealDB.** This is a critical data loss issue. Redis metrics are not being updated, and execution records are not being saved.

## Evidence

### Test Performed
- ✅ Executed `hello-world-minimal` activity successfully
- ✅ Activity completed with status "done"
- ✅ Cost: $0.2122, Duration: 506.9s
- ✅ Code calls `TemplateMetricsClient.reportExecution()` 
- ❌ **Metrics not updated in Redis**
- ❌ **No execution record in SurrealDB**

### Redis Metrics - Before and After Execution

**Expected**: Metrics should update after execution
**Actual**: Metrics show zeros even after successful execution

```json
{
  "total_selections": 0,      // Should be 1+
  "total_successes": 0,       // Should be 1+
  "total_failures": 0,
  "thompson_alpha": 1.0,      // Should increment
  "thompson_beta": 1.0,
  "avg_cost": 0.0,            // Should be $0.2122
  "avg_duration_ms": 0.0,     // Should be 506900
  "last_updated": "2026-02-20T18:45:28.682363"  // Old timestamp
}
```

### SurrealDB Query Results

```bash
$ curl -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "NS: metabob" \
  -H "DB: metabob" \
  --data "SELECT * FROM activity_execution ORDER BY created_at DESC LIMIT 5;"

[{"result": "Specify a namespace to use", "status": "ERR"}]
```

**Issue**: Namespace/database not properly configured OR no data exists

## Root Cause Analysis

### 1. Code Flow (Expected)

```
Activity Execution Completes
  ↓
TemplateMetricsClient.reportExecution() called
  ↓
Calls MCP tool: metabob_post_activity_result
  ↓
MCP tool POSTs to: /api/v1/learning-loop/executions
  ↓
Backend API stores in SurrealDB
  ↓
Backend updates Redis metrics
```

### 2. API Endpoint Mismatch (ACTUAL ISSUE)

**MCP Tool expects**: `POST /api/v1/learning-loop/executions`
**Backend provides**: `POST /api/activity-execution`

**Evidence from metabob-cli**:
```python
# File: repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py
async def metabob_post_activity_result(...):
    response = await client.post(
        f"{api_base}/api/v1/learning-loop/executions",  # WRONG PATH
        json=request_data,
        ...
    )
```

**Evidence from backend API**:
```bash
$ curl -s http://localhost:8080/openapi.json | jq -r '.paths | keys[]'
/api/activity-execution     # ← Actual endpoint
/api/template/{template_id}/metrics
...
```

### 3. Silent Failure

The code has graceful degradation:

```typescript
// File: repos/metabob-opencode/packages/opencode/src/session/activity.ts:674
TemplateMetricsClient.reportExecution({...}).catch(() => {
  // Silent failure - metrics reporting is not critical path
})
```

**This masks the error!** The activity completes "successfully" even though data is lost.

## Impact Assessment

### Data Loss

1. **Execution History**: Lost
   - No record of what activities ran
   - No ability to analyze patterns
   - No historical metrics for learning

2. **Template Metrics**: Not Updated
   - Thompson Sampling uses stale data
   - Success rates always 0%
   - Templates can't be compared accurately

3. **Learning Loop**: Broken
   - Boredom system has no data to query
   - Template evolution has no metrics to learn from
   - A/B testing can't compare performance

### System Behavior

- ✅ Activities execute successfully
- ✅ Local artifacts created
- ❌ **NO persistence layer**
- ❌ **Redis is NOT being updated** (even though it's supposed to be cache)
- ❌ **SurrealDB has no data** (primary storage empty)

## Critical Questions

### Q1: Is Redis Being Used As Primary Storage?

**Finding**: Redis contains templates with Thompson Sampling parameters, but these are **never updated**.

- Templates exist in Redis (probably from initial template registration)
- Metrics initialized to zeros
- After execution, metrics remain zeros
- **If Redis is flushed, ALL data is lost** (no SurrealDB backup)

### Q2: Is SurrealDB Configured Correctly?

**Finding**: SurrealDB queries fail with "Specify a namespace to use"

Possible issues:
1. Namespace/database not created
2. Tables not initialized
3. Wrong connection parameters

**Root namespace check**:
```bash
$ curl -s -X POST http://localhost:8000/sql -u "root:root" \
  --data "INFO FOR ROOT;" | jq '.[] | .result.namespaces'

{"test": "DEFINE NAMESPACE test"}
```

**The `metabob` namespace doesn't exist!**

### Q3: Is Data Being Lost?

**YES**. Confirmed data loss:
- No execution records in SurrealDB
- No metrics updates in Redis
- No historical data anywhere

## Immediate Actions Required

### Priority 1: Fix API Endpoint Mismatch

**Update metabob-cli MCP tool**:
```python
# Change from:
f"{api_base}/api/v1/learning-loop/executions"

# To:
f"{api_base}/api/activity-execution"
```

**Files to update**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py`

### Priority 2: Initialize SurrealDB Schema

**Create namespace and tables**:
```sql
-- Create namespace
DEFINE NAMESPACE metabob;
USE NS metabob;

-- Create database
DEFINE DATABASE metabob;
USE DB metabob;

-- Create tables (see design-surrealdb-schema-learning-loop activity)
DEFINE TABLE activity_execution SCHEMAFULL;
DEFINE TABLE template_metrics SCHEMAFULL;
DEFINE TABLE failure_patterns SCHEMAFULL;

-- Add fields, indexes, etc.
```

### Priority 3: Add Logging for Failed Metrics Reporting

**Current code silences errors**:
```typescript
.catch(() => {
  // Silent failure - metrics reporting is not critical path
})
```

**Should log warnings**:
```typescript
.catch((error) => {
  log.warn("metrics reporting failed", {
    activityId: activity.id,
    templateId: activity.templateId,
    error: error.message
  })
})
```

### Priority 4: Validate Data Persistence

**After fixes, test**:
1. Execute activity
2. Verify Redis metrics update
3. Verify SurrealDB has execution record
4. Query metrics via API: `GET /api/template/{template_id}/metrics`
5. Confirm Thompson Sampling uses real data

## Architecture Review

### Current (Broken) Flow

```
Activity Executes ✅
  ↓
reportExecution() called ✅
  ↓
MCP tool called ✅
  ↓
POST to wrong endpoint ❌ (404 Not Found)
  ↓
Error silenced ❌
  ↓
Activity completes "successfully" ✅
  ↓
Data lost ❌
```

### Fixed Flow (Expected)

```
Activity Executes
  ↓
reportExecution() called
  ↓
MCP tool: metabob_post_activity_result
  ↓
POST /api/activity-execution ✅
  ↓
Backend validates and stores in SurrealDB ✅
  ↓
Backend updates Redis cache ✅
  ↓
Success response
  ↓
Activity completes with persisted data ✅
```

## Data Storage Principles

### Redis (Cache Only)
- **Purpose**: Fast lookup for template selection
- **Data**: Templates, Thompson Sampling parameters
- **Lifetime**: Ephemeral (can be flushed and rebuilt from SurrealDB)
- **NOT primary storage**

### SurrealDB (Primary Storage)
- **Purpose**: Persistent storage for all execution data
- **Data**: 
  - activity_execution: Full execution records
  - template_metrics: Aggregated metrics
  - failure_patterns: Error analysis
- **Lifetime**: Permanent
- **Source of truth**

### Current Reality
- Redis has stale template data (never updated)
- SurrealDB is empty (no namespace/tables)
- **Both are effectively useless**

## Testing Checklist

After implementing fixes:

- [ ] Execute test activity
- [ ] Verify `/api/activity-execution` receives POST request
- [ ] Check SurrealDB for execution record
- [ ] Verify Redis metrics updated
- [ ] Query `/api/template/{id}/metrics` returns real data
- [ ] Confirm Thompson Sampling uses updated metrics
- [ ] Test boredom system queries execution data
- [ ] Verify data survives Redis flush (rebuilt from SurrealDB)

## Conclusion

**The learning loop is completely non-functional** due to:
1. ❌ API endpoint mismatch (404 errors)
2. ❌ SurrealDB not initialized (no namespace/tables)
3. ❌ Silent error handling (failures hidden)
4. ❌ No data persistence (execution history lost)
5. ❌ No metrics updates (Thompson Sampling uses defaults)

**This is a critical bug blocking**:
- Template learning and evolution
- Boredom activity system
- A/B testing and metrics
- Historical analysis

**Priority**: CRITICAL - Fix immediately to enable learning loop.
