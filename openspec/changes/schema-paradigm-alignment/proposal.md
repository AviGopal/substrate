## Why

The current activity system database schema has 20+ tables with naming inconsistencies, broken references, denormalization, and conceptual drift from the foundational impulse/activity/vessel paradigm. This complexity causes bugs, makes the codebase harder to understand, and blocks the implementation of key features like impulse-driven learning and composable activities.

**Current Problems:**

1. **Naming Inconsistencies**: `activity_template` vs `activity_registry`, `activity_executions` vs `activity_execution_traces`, `impulse_data` vs `impulse_relevance_metrics`
2. **Denormalization**: Thompson Sampling parameters stored both in `activity_registry` AND `variant_performance_metrics`
3. **Missing Core Abstractions**: Goals are stored separately from impulses, tool usage tracked separately from executions
4. **Broken References**: `goal_execution_paths` doesn't reference `execution` records cleanly
5. **Unused Tables**: `activity_dataflows`, `code_variants`, `activity_prerequisites` have no active consumers
6. **Conceptual Drift**: Current schema treats "templates", "vessel functions", and "compositions" as different things instead of all being activities

**The Foundation Says:**

Per `IMPULSE_ACTIVITY_FOUNDATION.md`:
- **Impulses** are data with metadata (pointers + shape info)
- **Activities** constrain the search space (input shapes -> output shapes)
- **Executions** are traces that record what happened (for learning)
- **Vessels** bundle capabilities and record traces

The current schema doesn't reflect this model.

## What Changes

Replace 20+ tables with 4 core tables + views:

### Core Tables (Source of Truth)

1. **`impulse`** - All data is an impulse. Goals, errors, traces, recommendations are all impulses with different shapes.

2. **`activity`** - All transformations are activities. Templates, tool calls, compositions are all activities with different execution types.

3. **`execution`** - All traces are executions. Links input impulses to output impulses with metrics.

4. **`vessel`** - Replaces `minibob_instance`. Vessels have resolvers and report traces.

### Views (Computed from execution)

- `v_activity_score` - Thompson Sampling computed from execution success rates
- `v_impulse_relevance` - Impulse-activity correlation computed from execution traces
- `v_goal_paths` - Composed activities that take goal impulses

## Capabilities

### New Capabilities

- `unified-impulse-model`: All context data (goals, traces, errors, files) stored as impulses with pointer + metadata
- `shape-based-matching`: Activities declare input/output shapes, matching happens via shape compatibility
- `execution-derived-metrics`: Thompson Sampling, relevance scores computed from execution traces (no separate metric tables)
- `composition-as-activity`: Multi-step workflows are activities with `execution_type = 'composition'`

### Removed Capabilities

- `variant_performance_metrics` table (moved to computed view)
- `impulse_relevance_metrics` table (moved to computed view)
- `goal_execution_paths` table (goals become impulses, paths become composition activities)
- `tool_usage` / `tool_usage_patterns` tables (tool calls become executions)
- `activity_dataflows` table (unused)
- `code_variants` table (unused)
- `activity_prerequisites` table (replaced by activity.input_shapes)
- `prerequisite_patterns` table (derived from execution data)
- `execution_sequences` table (replaced by execution.parent_execution_id)

## Impact

**Code Changes:**

- `repos/metabob-activity-api/`: Complete route refactor to use new 4-table model
- `repos/minibob/`: Update to create impulses instead of raw data structures
- `repos/metabob-proto/`: Update core schemas to support new model

**API Changes:**

- `POST /v2/impulses` - Create impulse (replaces multiple endpoints)
- `POST /v2/impulses/query` - Resolve impulse pointers by type
- `POST /v2/activities/recommend` - Thompson Sampling from `v_activity_score` view
- `POST /v2/executions` - Record execution trace (single endpoint for all execution types)

**Deployment:**

- Migration from old tables to new tables (data transformation required)
- Blue-green deployment: new tables alongside old during migration
- Backward compatibility views for API consumers during transition

**Breaking Changes:**

- **BREAKING**: All existing execution trace data requires migration
- **BREAKING**: Activity template format changes (adds `input_shapes`/`output_shapes`)
- **BREAKING**: Impulse storage format changes (pointer + metadata structure)

## Dependencies

- SurrealDB 3.0+ (for computed views, PERMISSIONS clauses)
- Existing multi-tenant RBAC from `surrealdb-multi-tenant-schema` change
- Core schemas from `metabob-proto` (organizations, users, projects)
