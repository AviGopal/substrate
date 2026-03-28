# Baseline Performance Metrics

## Overview

This document establishes performance baselines before the schema-paradigm-alignment migration. All measurements taken 2026-03-26 against the production activity-system cluster.

## Table Sizes

| Table | Record Count | Notes |
|-------|-------------|-------|
| `activity_registry` | 0 | Templates registered via API not direct DB |
| `activity_execution_traces` | 8 | Recent executions |
| `impulse_data` | 0 | Impulses not yet persisted |
| `variant_performance_metrics` | 12 | Thompson Sampling metrics |
| `goal_execution_paths` | 0 | Goal paths not yet used |
| `tool_usage` | 0 | Tool tracking not yet active |
| `minibob_instance` | 1 | Single MiniBob instance registered |

**Total tables in schema:** 27 tables + 4 views

## Query Latency Measurements

### Thompson Sampling Queries

| Query | Latency | Target |
|-------|---------|--------|
| `SELECT * FROM variant_performance_metrics LIMIT 10` | ~615µs | < 50ms ✓ |
| `SELECT id, alpha, beta FROM variant_performance_metrics LIMIT 5` | ~835µs | < 50ms ✓ |
| `SELECT * FROM variant_performance_metrics ORDER BY success_rate LIMIT 10` | ~650µs | < 50ms ✓ |

**Status:** Well under target. No immediate performance concerns.

### Activity Execution Traces

| Query | Latency | Target |
|-------|---------|--------|
| `SELECT * FROM activity_execution_traces ORDER BY created_at DESC LIMIT 10` | ~1.0-1.5ms | < 100ms ✓ |
| `SELECT count() FROM activity_execution_traces GROUP ALL` | ~411µs | < 50ms ✓ |

**Status:** Good performance with small dataset. Monitor at scale.

### View Queries

| View | Latency | Notes |
|------|---------|-------|
| `view_activity_template` | 265-500µs | Pre-computed from activity_registry |
| `view_execution_traces` | ~1ms | Pre-computed from activity_execution_traces |
| `view_goal_paths` | ~400µs | Pre-computed from goal_execution_paths |

**Status:** Views perform well. Consider similar pattern for new schema.

### Simple Table Scans

| Table | Scan Time |
|-------|-----------|
| `activity_registry` | ~444µs |
| `impulse_data` | ~457µs |
| `goal_execution_paths` | ~405µs |
| `tool_usage` | ~374µs |
| `minibob_instance` | ~370µs |

## Current Query Patterns

### Backend API Queries

Based on `repos/metabob-activity-api/src/routes/activities.ts`:

1. **Template Recommendations** (`POST /v2/activities/recommend`)
   - Query: `SELECT * FROM variant_performance_metrics WHERE org_id = $auth.org_id`
   - Frequency: High (every goal seeking request)
   - Current latency: < 1ms

2. **Template Listing** (`GET /v2/activities/templates`)
   - Query: `SELECT * FROM view_activity_template`
   - Frequency: Medium
   - Current latency: < 500µs

3. **Execution Trace Storage** (`POST /v2/activities/execution-traces`)
   - Query: INSERT into `activity_execution_traces` + UPDATE `variant_performance_metrics`
   - Frequency: High (every activity completion)
   - Current latency: < 2ms total

4. **Impulse Resolution** (`POST /v2/impulses/resolve`)
   - Query: `SELECT * FROM impulse_data WHERE id = $id`
   - Frequency: Low (most resolved locally)
   - Current latency: < 500µs

## Performance Targets for New Schema

Based on current baseline and SLA requirements:

| Operation | Current | Target | Headroom |
|-----------|---------|--------|----------|
| Thompson Sampling (v_activity_score) | < 1ms | < 50ms | 50x |
| Shape Matching | N/A | < 100ms | - |
| Impulse Resolution | < 500µs | < 100ms | 200x |
| Execution Trace Storage | < 2ms | < 100ms | 50x |
| Computed View Update | N/A | < 500ms | - |

## Index Usage

Current indexes defined in schema:

```surql
-- activity_registry indexes
DEFINE INDEX idx_activity_registry_org ON activity_registry FIELDS org_id;
DEFINE INDEX idx_activity_registry_category ON activity_registry FIELDS category;

-- activity_execution_traces indexes
DEFINE INDEX idx_execution_traces_org ON activity_execution_traces FIELDS org_id;
DEFINE INDEX idx_execution_traces_activity ON activity_execution_traces FIELDS activity_id;
DEFINE INDEX idx_execution_traces_variant ON activity_execution_traces FIELDS variant_id;

-- variant_performance_metrics indexes
DEFINE INDEX idx_vpm_org ON variant_performance_metrics FIELDS org_id;
DEFINE INDEX idx_vpm_variant ON variant_performance_metrics FIELDS variant_id;
```

## Recommendations for New Schema

1. **Maintain materialized views** - Current view performance is excellent
2. **Add array indexes** - For `input_shapes ALLINSIDE` queries
3. **Consider index on `execution.success`** - For Thompson aggregation
4. **Monitor at scale** - Re-measure after 1000+ executions

## Measurement Methodology

All queries run via:
```bash
curl -s -X POST 'http://localhost:8000/sql' \
  -H 'surreal-ns: activity-system' \
  -H 'surreal-db: learning_loop' \
  -u 'root:$SURREALDB_PASSWORD' \
  -d '<query>'
```

Latency extracted from SurrealDB response `time` field (server-side execution time).

## Environment

- **SurrealDB Version:** 3.0.0 (surrealdb:latest image)
- **Cluster:** Kubernetes (docker-desktop)
- **Resources:** Default pod limits
- **Network:** Port-forward from localhost

## SurrealDB 3.x Feature Compatibility Testing

### Tested Features

| Feature | Status | Notes |
|---------|--------|-------|
| Computed views with GROUP BY | ✓ Works | `DEFINE TABLE ... AS SELECT ... GROUP BY` |
| ALLINSIDE array operator | ✓ Works | Shape matching: `input_shapes ALLINSIDE $available` |
| Index on array fields | ✓ Works | `DEFINE INDEX ... FIELDS input_shapes` |
| COMPUTED fields | ✓ Works | `DEFINE FIELD success_rate COMPUTED alpha / (alpha + beta)` |
| Views with PERMISSIONS | ✗ Error | Bug in 3.0.0: "select results did not contain a record id" |

### Critical Finding: View PERMISSIONS Bug

SurrealDB 3.0.0 has a bug when defining views with explicit PERMISSIONS:

```surql
-- This fails with internal error
DEFINE TABLE test_view AS
  SELECT * FROM source_table
  PERMISSIONS FOR select WHERE org_id = $auth.org_id;

-- Error: "The database encountered unreachable logic:
--         select results did not contain a record id"
```

**Workarounds:**
1. Use query-time filtering instead of view-level PERMISSIONS
2. Include org_id filter directly in view definition (pre-filter)
3. Wait for SurrealDB patch

### Verification Queries

```surql
-- Test 1: Computed view with GROUP BY (Thompson Sampling)
DEFINE TABLE v_score AS
  SELECT
    activity_id,
    count(IF success = true THEN 1 ELSE NONE END) + 1 AS alpha,
    count(IF success = false THEN 1 ELSE NONE END) + 1 AS beta
  FROM execution
  GROUP BY activity_id;
-- Result: ✓ View created and populated correctly

-- Test 2: Array subset matching
LET $available = ["goal", "error", "source_code"];
SELECT * FROM activity WHERE input_shapes ALLINSIDE $available;
-- Result: ✓ Returns activities where all input_shapes are in available

-- Test 3: Index on array
DEFINE INDEX idx_shapes ON activity FIELDS input_shapes;
-- Result: ✓ Index created successfully

-- Test 4: COMPUTED field
DEFINE FIELD success_rate ON metrics COMPUTED alpha / (alpha + beta);
-- Result: ✓ Field auto-computed on insert/update
```

### Minimum Version

**Required:** SurrealDB >= 3.0.0

Note: View PERMISSIONS may require 3.1.0+ when bug is fixed.
