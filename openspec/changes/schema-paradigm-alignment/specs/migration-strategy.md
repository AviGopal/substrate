# Migration Strategy Specification

## Overview

This spec defines how to migrate from the current 20+ table schema to the 4-table paradigm-aligned schema without data loss and with minimal downtime.

## Migration Phases

### Phase 1: Schema Creation (Non-Breaking)

**Duration:** 1 day
**Risk:** Low

Create new tables alongside existing tables:

```sql
-- Create new tables (won't affect existing operations)
SOURCE 'impulse.surql';
SOURCE 'activity.surql';
SOURCE 'execution.surql';
SOURCE 'vessel.surql';

-- Create computed views
SOURCE 'views.surql';
```

**Validation:**
- [ ] All new tables created successfully
- [ ] Views compile without errors
- [ ] No impact on existing API

---

### Phase 2: Data Backfill

**Duration:** 2-3 days
**Risk:** Medium

Transform and copy existing data to new tables.

#### Step 2.1: Migrate Vessels

```sql
-- minibob_instance -> vessel
INSERT INTO vessel
  SELECT
    instance_id AS id,
    instance_id AS name,
    ['file', 'memo'] AS resolves,
    api_key_hash,
    is_active,
    org_id,
    project_id,
    created_at,
    last_active_at,
    expires_at
  FROM minibob_instance;
```

**Validation:**
- [ ] Row count matches: `SELECT count() FROM vessel` = `SELECT count() FROM minibob_instance`
- [ ] All active vessels preserved

#### Step 2.2: Migrate Activities

```sql
-- activity_registry -> activity
INSERT INTO activity
  SELECT
    id,
    name,
    description,
    -- Map execution_format to execution_type
    IF execution_format = 'template' THEN 'template'
    ELSE IF execution_format = 'vessel-function' THEN 'vessel_function'
    ELSE IF execution_format = 'mcp-tool' THEN 'tool'
    ELSE 'template'
    END AS execution_type,
    -- Extract input/output shapes from typical_inputs/typical_outputs or input_schema/output_schema
    IF input_schema.required IS NOT NONE THEN input_schema.required ELSE [] END AS input_shapes,
    IF output_schema.produces IS NOT NONE THEN output_schema.produces ELSE [] END AS output_shapes,
    task_steps AS tasks,
    IF execution_format = 'mcp-tool' THEN name ELSE NONE END AS tool_name,
    NONE AS child_activities,
    source_location,
    genealogy.extracted_from AS extracted_from,
    genealogy.variant_of AS variant_of,
    scope,
    public,
    org_id,
    project_id,
    created_by,
    created_at,
    updated_at
  FROM activity_registry;

-- Migrate goal_execution_paths as composition activities
INSERT INTO activity
  SELECT
    'path-' + goal_hash + '-' + path_signature AS id,
    'Goal Path: ' + string::slice(goal_text, 0, 50) AS name,
    goal_text AS description,
    'composition' AS execution_type,
    ['goal'] AS input_shapes,
    [] AS output_shapes,
    NONE AS tasks,
    NONE AS tool_name,
    path_activities AS child_activities,
    NONE AS source_location,
    NONE AS extracted_from,
    NONE AS variant_of,
    'org' AS scope,
    false AS public,
    org_id,
    project_id,
    NONE AS created_by,
    created_at,
    updated_at
  FROM goal_execution_paths;
```

**Validation:**
- [ ] All activity_registry records migrated
- [ ] All goal_execution_paths converted to compositions
- [ ] Execution types mapped correctly

#### Step 2.3: Migrate Impulses

```sql
-- impulse_data -> impulse
INSERT INTO impulse
  SELECT
    impulse_id AS id,
    impulse_data AS pointer,
    IF impulse_type = 'file' THEN 'source_code'
    ELSE IF impulse_type = 'memo' THEN 'memo'
    ELSE IF impulse_type = 'activityExecutionTrace' THEN 'trace'
    ELSE impulse_type OR 'unknown'
    END AS shape,
    NONE AS summary,
    token_count AS token_estimate,
    content,
    org_id,
    project_id,
    NONE AS vessel_id,
    created_by,
    created_at,
    expires_at
  FROM impulse_data;
```

**Validation:**
- [ ] All impulse_data records migrated
- [ ] Pointer structures preserved
- [ ] Shapes assigned correctly

#### Step 2.4: Migrate Executions

```sql
-- activity_execution_traces -> execution
INSERT INTO execution
  SELECT
    execution_id AS id,
    activity_id,
    impulses_used AS input_impulses,
    [] AS output_impulses,
    success,
    IF !success THEN {
      message: error_message,
      type: error_type,
      task_id: failed_task_id
    } ELSE NONE END AS error,
    duration_ms,
    cost_usd,
    tokens_input AS tokens_in,
    tokens_output AS tokens_out,
    parent_execution_id,
    {
      tasks: tasks,
      state_snapshot: state_snapshot
    } AS trace,
    org_id,
    project_id,
    NONE AS vessel_id,
    created_by,
    executed_at,
    created_at
  FROM activity_execution_traces;

-- tool_usage -> execution (as tool activities)
-- First ensure tool activities exist
INSERT INTO activity
  SELECT
    'tool-' + tool_name AS id,
    tool_name AS name,
    'Tool: ' + tool_name AS description,
    'tool' AS execution_type,
    [] AS input_shapes,
    [] AS output_shapes,
    NONE AS tasks,
    tool_name,
    NONE AS child_activities,
    NONE AS source_location,
    NONE AS extracted_from,
    NONE AS variant_of,
    'global' AS scope,
    true AS public,
    org_id,
    NONE AS project_id,
    NONE AS created_by,
    time::now() AS created_at,
    time::now() AS updated_at
  FROM tool_usage
  GROUP BY tool_name, org_id;

-- Then migrate tool_usage as executions
INSERT INTO execution
  SELECT
    rand::uuid() AS id,
    'tool-' + tool_name AS activity_id,
    [] AS input_impulses,
    [] AS output_impulses,
    (success_count > failure_count) AS success,
    NONE AS error,
    <int>avg_duration_ms AS duration_ms,
    0.0 AS cost_usd,
    0 AS tokens_in,
    0 AS tokens_out,
    execution_id AS parent_execution_id,
    NONE AS trace,
    org_id,
    project_id,
    NONE AS vessel_id,
    NONE AS created_by,
    updated_at AS executed_at,
    created_at
  FROM tool_usage;
```

**Validation:**
- [ ] All execution traces migrated
- [ ] Parent-child relationships preserved
- [ ] Tool usage converted to executions
- [ ] Metrics match between old and new tables

---

### Phase 3: Dual-Write Period

**Duration:** 1 week
**Risk:** Medium

Update API to write to both old and new tables.

#### API Changes

```typescript
// Before: Write to old tables
async function recordExecution(data: ExecutionData) {
  await db.query(`
    CREATE activity_execution_traces SET ...
  `);
}

// During: Dual-write
async function recordExecution(data: ExecutionData) {
  // Write to old table (for rollback capability)
  await db.query(`
    CREATE activity_execution_traces SET ...
  `);

  // Write to new table
  await db.query(`
    CREATE execution SET ...
  `);
}
```

#### Sync Validation Job

Run every hour to verify consistency:

```typescript
async function validateSync() {
  // Check execution counts match
  const oldCount = await db.query(`SELECT count() FROM activity_execution_traces`);
  const newCount = await db.query(`SELECT count() FROM execution`);

  if (Math.abs(oldCount - newCount) > 10) {
    alert(`Execution sync drift: old=${oldCount}, new=${newCount}`);
  }

  // Check recent executions exist in both
  const recent = await db.query(`
    SELECT execution_id FROM activity_execution_traces
    WHERE created_at > time::now() - 1h
  `);

  for (const { execution_id } of recent) {
    const exists = await db.query(`
      SELECT id FROM execution WHERE id = $id
    `, { id: execution_id });

    if (!exists) {
      alert(`Missing execution in new table: ${execution_id}`);
    }
  }
}
```

**Validation:**
- [ ] Dual-write working for all operations
- [ ] Sync validation passing
- [ ] No performance degradation

---

### Phase 4: Read Migration

**Duration:** 1 week
**Risk:** Medium-High

Switch reads from old tables to new tables.

#### Feature Flag Approach

```typescript
const USE_NEW_SCHEMA = process.env.USE_NEW_SCHEMA === 'true';

async function getActivityScores(activityIds: string[]) {
  if (USE_NEW_SCHEMA) {
    // New: Read from computed view
    return await db.query(`
      SELECT * FROM v_activity_score
      WHERE activity_id IN $activityIds
    `, { activityIds });
  } else {
    // Old: Read from variant_performance_metrics
    return await db.query(`
      SELECT * FROM variant_performance_metrics
      WHERE variant_id IN $activityIds
    `, { activityIds });
  }
}
```

#### Gradual Rollout

1. Enable for internal org first
2. Enable for 10% of traffic
3. Monitor error rates and latency
4. Increase to 50%, then 100%

**Validation:**
- [ ] All read paths converted
- [ ] Feature flag tested
- [ ] Gradual rollout completed
- [ ] No errors in production

---

### Phase 5: Cleanup

**Duration:** 1-2 weeks
**Risk:** Low (after validation period)

Remove old tables and stop dual-writes.

#### Step 5.1: Stop Dual-Write

```typescript
// Remove dual-write code
async function recordExecution(data: ExecutionData) {
  // Only write to new table
  await db.query(`
    CREATE execution SET ...
  `);
}
```

#### Step 5.2: Archive Old Tables

```sql
-- Rename old tables (keep for 30 days)
DEFINE TABLE activity_execution_traces_archived AS
  SELECT * FROM activity_execution_traces;

DEFINE TABLE activity_registry_archived AS
  SELECT * FROM activity_registry;

-- ... archive all old tables
```

#### Step 5.3: Drop Old Tables

After 30-day validation period:

```sql
REMOVE TABLE activity_template;
REMOVE TABLE activity_registry;
REMOVE TABLE activity_executions;
REMOVE TABLE activity_execution_traces;
REMOVE TABLE variant_performance_metrics;
REMOVE TABLE impulse_data;
REMOVE TABLE impulse_usage_history;
REMOVE TABLE impulse_relevance_metrics;
REMOVE TABLE goal_execution_paths;
REMOVE TABLE tool_usage;
REMOVE TABLE activity_composition_graph;
REMOVE TABLE activity_dataflows;
REMOVE TABLE activity_prerequisites;
REMOVE TABLE prerequisite_patterns;
REMOVE TABLE execution_sequences;
REMOVE TABLE code_variants;

-- Also remove archived tables
REMOVE TABLE activity_execution_traces_archived;
REMOVE TABLE activity_registry_archived;
-- ...
```

**Validation:**
- [ ] System stable without old tables for 1 week
- [ ] No errors related to removed tables
- [ ] All documentation updated

---

## Rollback Plan

### During Phase 2 (Backfill)

Simply drop new tables and retry:

```sql
REMOVE TABLE impulse;
REMOVE TABLE activity;
REMOVE TABLE execution;
REMOVE TABLE vessel;
```

### During Phase 3 (Dual-Write)

1. Stop dual-writes (deploy old code)
2. Delete records in new tables created after dual-write started
3. Continue with old tables

### During Phase 4 (Read Migration)

1. Set `USE_NEW_SCHEMA=false`
2. Redeploy
3. System automatically uses old tables

### During Phase 5 (Cleanup)

If issues discovered after dropping old tables:

1. Restore from archived tables:
   ```sql
   DEFINE TABLE activity_execution_traces AS
     SELECT * FROM activity_execution_traces_archived;
   ```
2. Redeploy old code
3. Enable dual-write again

---

## Data Validation Queries

### Verify Activity Migration

```sql
-- Check all activities migrated
SELECT
  (SELECT count() FROM activity_registry) AS old_count,
  (SELECT count() FROM activity WHERE execution_type = 'template') AS new_templates,
  (SELECT count() FROM activity WHERE execution_type = 'composition') AS new_compositions;

-- Verify Thompson Sampling equivalence
SELECT
  vpm.variant_id,
  vpm.thompson_alpha AS old_alpha,
  vas.alpha AS new_alpha,
  vpm.thompson_beta AS old_beta,
  vas.beta AS new_beta
FROM variant_performance_metrics AS vpm
JOIN v_activity_score AS vas ON vpm.variant_id = vas.activity_id
WHERE math::abs(vpm.thompson_alpha - vas.alpha) > 0.01
   OR math::abs(vpm.thompson_beta - vas.beta) > 0.01;
```

### Verify Execution Migration

```sql
-- Check execution counts
SELECT
  (SELECT count() FROM activity_execution_traces) AS old_count,
  (SELECT count() FROM execution) AS new_count;

-- Verify success rates match
SELECT
  old.activity_id,
  old.success_rate AS old_rate,
  (new.successes * 1.0 / new.total_executions) AS new_rate
FROM (
  SELECT activity_id, count(WHERE success = true) * 1.0 / count() AS success_rate
  FROM activity_execution_traces
  GROUP BY activity_id
) AS old
JOIN v_activity_score AS new ON old.activity_id = new.activity_id
WHERE math::abs(old.success_rate - (new.successes * 1.0 / new.total_executions)) > 0.01;
```

### Verify Impulse Migration

```sql
-- Check impulse counts
SELECT
  (SELECT count() FROM impulse_data) AS old_count,
  (SELECT count() FROM impulse) AS new_count;

-- Verify pointer data preserved
SELECT
  id.impulse_id,
  id.impulse_data AS old_pointer,
  i.pointer AS new_pointer
FROM impulse_data AS id
JOIN impulse AS i ON id.impulse_id = i.id
WHERE id.impulse_data != i.pointer
LIMIT 10;
```

---

## Timeline

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| 1. Schema Creation | 1 day | Week 1 Mon | Week 1 Mon |
| 2. Data Backfill | 3 days | Week 1 Tue | Week 1 Thu |
| 3. Dual-Write | 1 week | Week 1 Fri | Week 2 Thu |
| 4. Read Migration | 1 week | Week 2 Fri | Week 3 Thu |
| 5. Cleanup | 2 weeks | Week 3 Fri | Week 5 Thu |

**Total Duration:** ~5 weeks

---

## Monitoring

### Metrics to Track

1. **Error rates** - Any increase indicates migration issues
2. **Query latency** - New schema should be same or faster
3. **Data sync drift** - Old vs new table row counts
4. **API response times** - Thompson Sampling recommendations

### Alerts

```typescript
// Alert if sync drift > 1%
if (Math.abs(oldCount - newCount) / oldCount > 0.01) {
  alert('Schema migration sync drift detected');
}

// Alert if Thompson Sampling latency increases
if (avgLatencyMs > baselineLatencyMs * 1.2) {
  alert('Thompson Sampling latency regression');
}
```
