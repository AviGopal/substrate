## Context

**Current State:**

The activity system has evolved organically with 20+ tables:

```
Tables to REMOVE/MIGRATE:
-------------------------
activity_template          -> activity
activity_registry          -> activity
activity_executions        -> execution
activity_execution_traces  -> execution
variant_performance_metrics -> v_activity_score (view)
impulse_data               -> impulse
impulse_usage_history      -> derived from execution.input_impulses
impulse_relevance_metrics  -> v_impulse_relevance (view)
goal_execution_paths       -> activity (type='composition') + impulse (shape='goal')
tool_usage                 -> execution (activity.execution_type='tool')
tool_usage_patterns        -> derived from execution data
activity_composition_graph -> derived from execution.parent_execution_id
activity_dataflows         -> REMOVE (unused)
activity_prerequisites     -> activity.input_shapes
prerequisite_patterns      -> derived from execution data
execution_sequences        -> activity (type='composition')
code_variants              -> REMOVE (unused)
ci_runs                    -> KEEP (separate concern)
```

**Target State:**

4 core tables + 3 computed views that directly implement the IMPULSE_ACTIVITY_FOUNDATION.md model.

**Constraints:**

- Must maintain RBAC multi-tenancy (org_id, project_id on all tables)
- Must support existing authentication (JWT, RECORD auth)
- Zero data loss during migration
- Backward compatibility during transition period

## Goals / Non-Goals

**Goals:**

- Single source of truth for each concept (no duplication)
- Schema directly reflects foundational paradigm
- All metrics computed from execution traces (no separate storage)
- Shape-based activity matching (input_shapes -> output_shapes)
- Composable activities (activities can call other activities)
- Clean migration path from current schema

**Non-Goals:**

- Changing authentication model (keep JWT + RECORD auth as-is)
- Changing multi-tenant isolation model (keep org_id/project_id as-is)
- Breaking existing MiniBob integration during migration
- Optimizing query performance (functional correctness first)

## Decisions

### Decision 1: 4 Core Tables + Views

**Choice:** `impulse`, `activity`, `execution`, `vessel` as core tables. Metrics as computed views.

**Alternatives Considered:**
- Keep separate metrics tables: More complexity, data duplication, drift risk
- Store everything in 2 tables (impulse + execution): Loses activity structure
- Keep current schema but fix names: Doesn't address conceptual drift

**Rationale:**
- Matches foundational model exactly
- Single source of truth eliminates sync bugs
- Views can be optimized independently
- Easier to reason about data flow

### Decision 2: Goals Are Impulses

**Choice:** Goals stored in `impulse` table with `shape = 'goal'`

**Alternatives Considered:**
- Separate `goals` table: Violates "everything is an impulse"
- Goals as activity metadata: Loses goal-as-input semantics

**Rationale:**
- Goals ARE data that activities consume
- Enables Thompson Sampling on goal patterns
- Allows goal impulses to reference previous goals (chaining)
- Consistent with "impulses are universal data"

### Decision 3: Tool Calls Are Executions

**Choice:** Tool invocations stored in `execution` with `activity.execution_type = 'tool'`

**Alternatives Considered:**
- Separate `tool_usage` table: Current approach, causes drift
- Inline in execution trace JSON: Loses queryability

**Rationale:**
- Tools ARE activities (constrained state transitions)
- Enables Thompson Sampling on tool effectiveness
- Unified learning across templates and tools
- Consistent with "activities constrain search"

### Decision 4: Composition via parent_execution_id

**Choice:** `execution.parent_execution_id` links composed executions

**Alternatives Considered:**
- Separate composition graph table: Current approach, duplicate data
- JSON array of child executions: Loses referential integrity

**Rationale:**
- Natural tree structure for nested activities
- Enables recursive queries for full trace
- No separate table to keep in sync
- Matches how activities actually compose

### Decision 5: Thompson Sampling as Computed View

**Choice:** `v_activity_score` view computes alpha/beta from `execution` table

**Alternatives Considered:**
- Store in `activity` table: Requires sync triggers
- Separate metrics table: Current approach, causes drift

**Rationale:**
- Always reflects actual execution data
- No sync bugs possible
- Can optimize view with indexes
- Simpler mental model

## Schema Definitions

### Table: `impulse`

```sql
-- =============================================================================
-- IMPULSE: All data is an impulse with pointer + metadata
-- =============================================================================

DEFINE TABLE IF NOT EXISTS impulse SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      org_id = $auth.org_id
      AND (project_id IS NONE OR project_id IN $auth.project_ids)
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE
      org_id = $auth.org_id
      AND ($auth.role = 'admin' OR created_by = $auth.id)
    FOR delete WHERE
      org_id = $auth.org_id
      AND ($auth.role = 'admin' OR created_by = $auth.id);

-- Identity
DEFINE FIELD IF NOT EXISTS id ON impulse TYPE string
  ASSERT $value != NONE;

-- Pointer: WHERE the data is
DEFINE FIELD IF NOT EXISTS pointer ON impulse TYPE object
  ASSERT $value != NONE
  COMMENT "Pointer to data: { type: 'file'|'memo'|'trace'|..., path?, content?, ... }";

-- Shape: WHAT the data looks like (for activity matching)
DEFINE FIELD IF NOT EXISTS shape ON impulse TYPE string
  ASSERT $value != NONE
  COMMENT "Semantic type: goal, error, source_code, trace, recommendation, etc.";

-- Summary: Human/LLM readable description
DEFINE FIELD IF NOT EXISTS summary ON impulse TYPE option<string>
  COMMENT "Brief description for context window optimization";

-- Token estimate: For budget management
DEFINE FIELD IF NOT EXISTS token_estimate ON impulse TYPE option<int>
  COMMENT "Estimated tokens when loaded";

-- Content: Actual data (nullable, materialized when loaded)
DEFINE FIELD IF NOT EXISTS content ON impulse TYPE option<string>
  COMMENT "Loaded content (null when pointer-only)";

-- Multi-tenancy
DEFINE FIELD IF NOT EXISTS org_id ON impulse TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS project_id ON impulse TYPE option<record<projects>>
  VALUE $value OR $auth.project_id;

DEFINE FIELD IF NOT EXISTS vessel_id ON impulse TYPE option<string>
  COMMENT "Vessel that created this impulse";

DEFINE FIELD IF NOT EXISTS created_by ON impulse TYPE option<record<users> | record<minibob_instance>>
  VALUE $value OR $auth.id;

-- Lifecycle
DEFINE FIELD IF NOT EXISTS created_at ON impulse TYPE datetime
  VALUE $value OR time::now();

DEFINE FIELD IF NOT EXISTS expires_at ON impulse TYPE option<datetime>
  COMMENT "TTL for temporary impulses";

-- Indexes
DEFINE INDEX IF NOT EXISTS idx_impulse_id ON impulse FIELDS id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_impulse_shape ON impulse FIELDS shape;
DEFINE INDEX IF NOT EXISTS idx_impulse_org ON impulse FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_impulse_org_shape ON impulse FIELDS org_id, shape;
DEFINE INDEX IF NOT EXISTS idx_impulse_org_project ON impulse FIELDS org_id, project_id;
DEFINE INDEX IF NOT EXISTS idx_impulse_vessel ON impulse FIELDS vessel_id;
DEFINE INDEX IF NOT EXISTS idx_impulse_expires ON impulse FIELDS expires_at;
```

### Table: `activity`

```sql
-- =============================================================================
-- ACTIVITY: Constrained state transitions (templates, tools, compositions)
-- =============================================================================

DEFINE TABLE IF NOT EXISTS activity SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      (scope = 'global' AND public = true)
      OR (org_id = $auth.org_id)
      OR (scope = 'project' AND project_id IN $auth.project_ids)
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE
      org_id = $auth.org_id
      AND ($auth.role = 'admin' OR created_by = $auth.id)
    FOR delete WHERE
      org_id = $auth.org_id
      AND $auth.role = 'admin';

-- Identity
DEFINE FIELD IF NOT EXISTS id ON activity TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS name ON activity TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS description ON activity TYPE option<string>;

-- Input/Output Shapes (for matching)
DEFINE FIELD IF NOT EXISTS input_shapes ON activity TYPE array<string>
  VALUE $value OR []
  COMMENT "Required impulse shapes: ['goal', 'source_code']";

DEFINE FIELD IF NOT EXISTS output_shapes ON activity TYPE array<string>
  VALUE $value OR []
  COMMENT "Produced impulse shapes: ['source_code', 'trace']";

-- Execution definition
DEFINE FIELD IF NOT EXISTS execution_type ON activity TYPE string
  ASSERT $value IN ['template', 'tool', 'composition', 'vessel_function']
  COMMENT "How to execute this activity";

-- Template-specific (execution_type = 'template')
DEFINE FIELD IF NOT EXISTS tasks ON activity TYPE option<array>
  COMMENT "Task steps for template execution";

-- Tool-specific (execution_type = 'tool')
DEFINE FIELD IF NOT EXISTS tool_name ON activity TYPE option<string>
  COMMENT "Tool identifier (bash, read, write, etc.)";

-- Composition-specific (execution_type = 'composition')
DEFINE FIELD IF NOT EXISTS child_activities ON activity TYPE option<array<string>>
  COMMENT "Ordered activity IDs for composition";

-- Vessel function-specific (execution_type = 'vessel_function')
DEFINE FIELD IF NOT EXISTS source_location ON activity TYPE option<object>
  COMMENT "{ vessel_id, file, function_name }";

-- Lineage
DEFINE FIELD IF NOT EXISTS extracted_from ON activity TYPE option<string>
  COMMENT "Execution ID this was extracted from (ribosome)";

DEFINE FIELD IF NOT EXISTS variant_of ON activity TYPE option<string>
  COMMENT "Parent activity ID if this is a variant";

-- Scope and visibility
DEFINE FIELD IF NOT EXISTS scope ON activity TYPE string
  ASSERT $value IN ['global', 'org', 'project', 'vessel']
  VALUE $value OR 'org';

DEFINE FIELD IF NOT EXISTS public ON activity TYPE bool
  VALUE $value OR false
  COMMENT "Visible in global marketplace";

-- Multi-tenancy
DEFINE FIELD IF NOT EXISTS org_id ON activity TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS project_id ON activity TYPE option<record<projects>>;

DEFINE FIELD IF NOT EXISTS created_by ON activity TYPE option<record<users> | record<minibob_instance>>
  VALUE $value OR $auth.id;

-- Timestamps
DEFINE FIELD IF NOT EXISTS created_at ON activity TYPE datetime
  VALUE $value OR time::now();

DEFINE FIELD IF NOT EXISTS updated_at ON activity TYPE datetime
  VALUE time::now();

-- Indexes
DEFINE INDEX IF NOT EXISTS idx_activity_id ON activity FIELDS id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_activity_name ON activity FIELDS name;
DEFINE INDEX IF NOT EXISTS idx_activity_type ON activity FIELDS execution_type;
DEFINE INDEX IF NOT EXISTS idx_activity_scope ON activity FIELDS scope;
DEFINE INDEX IF NOT EXISTS idx_activity_public ON activity FIELDS public, scope;
DEFINE INDEX IF NOT EXISTS idx_activity_org ON activity FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_activity_org_type ON activity FIELDS org_id, execution_type;
DEFINE INDEX IF NOT EXISTS idx_activity_variant_of ON activity FIELDS variant_of;
DEFINE INDEX IF NOT EXISTS idx_activity_extracted_from ON activity FIELDS extracted_from;
```

### Table: `execution`

```sql
-- =============================================================================
-- EXECUTION: Trace of what happened (input -> output + metrics)
-- =============================================================================

DEFINE TABLE IF NOT EXISTS execution SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      org_id = $auth.org_id
      AND (project_id IS NONE OR project_id IN $auth.project_ids)
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE
      org_id = $auth.org_id
      AND ($auth.role = 'admin' OR created_by = $auth.id)
    FOR delete WHERE
      org_id = $auth.org_id
      AND $auth.role = 'admin';

-- Identity
DEFINE FIELD IF NOT EXISTS id ON execution TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS activity_id ON execution TYPE string
  ASSERT $value != NONE
  COMMENT "Activity that was executed";

-- Input/Output impulses (the core trace data)
DEFINE FIELD IF NOT EXISTS input_impulses ON execution TYPE array<string>
  VALUE $value OR []
  COMMENT "Impulse IDs consumed";

DEFINE FIELD IF NOT EXISTS output_impulses ON execution TYPE array<string>
  VALUE $value OR []
  COMMENT "Impulse IDs produced";

-- Outcome
DEFINE FIELD IF NOT EXISTS success ON execution TYPE bool
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS error ON execution TYPE option<object>
  COMMENT "{ message, type, task_id }";

-- Metrics
DEFINE FIELD IF NOT EXISTS duration_ms ON execution TYPE int
  ASSERT $value >= 0;

DEFINE FIELD IF NOT EXISTS cost_usd ON execution TYPE float
  ASSERT $value >= 0;

DEFINE FIELD IF NOT EXISTS tokens_in ON execution TYPE int
  VALUE $value OR 0;

DEFINE FIELD IF NOT EXISTS tokens_out ON execution TYPE int
  VALUE $value OR 0;

-- Composition (for nested executions)
DEFINE FIELD IF NOT EXISTS parent_execution_id ON execution TYPE option<string>
  COMMENT "Parent execution if this is a child";

-- Detailed trace (optional, for debugging/replay)
DEFINE FIELD IF NOT EXISTS trace ON execution TYPE option<object> FLEXIBLE
  COMMENT "Full trace data: { tasks, state_transitions, ... }";

-- Multi-tenancy
DEFINE FIELD IF NOT EXISTS org_id ON execution TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

DEFINE FIELD IF NOT EXISTS project_id ON execution TYPE option<record<projects>>
  VALUE $value OR $auth.project_id;

DEFINE FIELD IF NOT EXISTS vessel_id ON execution TYPE option<string>
  COMMENT "Vessel that executed this";

DEFINE FIELD IF NOT EXISTS created_by ON execution TYPE option<record<users> | record<minibob_instance>>
  VALUE $value OR $auth.id;

-- Timestamps
DEFINE FIELD IF NOT EXISTS executed_at ON execution TYPE datetime
  VALUE $value OR time::now();

DEFINE FIELD IF NOT EXISTS created_at ON execution TYPE datetime
  VALUE $value OR time::now();

-- Indexes
DEFINE INDEX IF NOT EXISTS idx_execution_id ON execution FIELDS id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_execution_activity ON execution FIELDS activity_id;
DEFINE INDEX IF NOT EXISTS idx_execution_success ON execution FIELDS success;
DEFINE INDEX IF NOT EXISTS idx_execution_parent ON execution FIELDS parent_execution_id;
DEFINE INDEX IF NOT EXISTS idx_execution_org ON execution FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_execution_org_activity ON execution FIELDS org_id, activity_id;
DEFINE INDEX IF NOT EXISTS idx_execution_org_success ON execution FIELDS org_id, success;
DEFINE INDEX IF NOT EXISTS idx_execution_vessel ON execution FIELDS vessel_id;
DEFINE INDEX IF NOT EXISTS idx_execution_executed_at ON execution FIELDS executed_at;
```

### Table: `vessel`

```sql
-- =============================================================================
-- VESSEL: Execution environment (replaces minibob_instance)
-- =============================================================================

DEFINE TABLE IF NOT EXISTS vessel SCHEMAFULL
  PERMISSIONS
    FOR select WHERE
      id = $auth.id
      OR (org_id = $auth.org_id AND $auth.role = 'admin')
    FOR create, update WHERE
      $auth.role = 'admin'
      AND org_id = $auth.org_id
    FOR delete WHERE
      $auth.role = 'admin'
      AND org_id = $auth.org_id;

-- Identity
DEFINE FIELD IF NOT EXISTS id ON vessel TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS name ON vessel TYPE string
  ASSERT $value != NONE;

-- Capabilities: What impulse types this vessel can resolve
DEFINE FIELD IF NOT EXISTS resolves ON vessel TYPE array<string>
  VALUE $value OR ['file', 'memo']
  COMMENT "Impulse pointer types this vessel can resolve";

-- Authentication
DEFINE FIELD IF NOT EXISTS api_key_hash ON vessel TYPE string
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS is_active ON vessel TYPE bool
  VALUE $value OR true;

-- Multi-tenancy
DEFINE FIELD IF NOT EXISTS org_id ON vessel TYPE record<organizations>
  ASSERT $value != NONE;

DEFINE FIELD IF NOT EXISTS project_id ON vessel TYPE option<record<projects>>;

-- Timestamps
DEFINE FIELD IF NOT EXISTS created_at ON vessel TYPE datetime
  VALUE $value OR time::now();

DEFINE FIELD IF NOT EXISTS last_active_at ON vessel TYPE option<datetime>;

DEFINE FIELD IF NOT EXISTS expires_at ON vessel TYPE option<datetime>;

-- Indexes
DEFINE INDEX IF NOT EXISTS idx_vessel_id ON vessel FIELDS id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_vessel_org ON vessel FIELDS org_id;
DEFINE INDEX IF NOT EXISTS idx_vessel_org_project ON vessel FIELDS org_id, project_id;
DEFINE INDEX IF NOT EXISTS idx_vessel_active ON vessel FIELDS is_active;
```

### Computed Views

```sql
-- =============================================================================
-- v_activity_score: Thompson Sampling parameters computed from execution
-- =============================================================================

DEFINE TABLE IF NOT EXISTS v_activity_score AS
  SELECT
    activity_id,
    count() AS total_executions,
    count(WHERE success = true) AS successes,
    count(WHERE success = false) AS failures,
    (count(WHERE success = true) + 1) AS alpha,
    (count(WHERE success = false) + 1) AS beta,
    math::mean(duration_ms) AS avg_duration_ms,
    math::mean(cost_usd) AS avg_cost_usd,
    max(executed_at) AS last_executed_at
  FROM execution
  GROUP BY activity_id;

-- =============================================================================
-- v_impulse_relevance: Impulse-activity correlation from execution
-- =============================================================================
-- Note: This is a simplified view. Full relevance scoring may need
-- custom queries due to array containment checks.

DEFINE TABLE IF NOT EXISTS v_impulse_relevance AS
  SELECT
    activity_id,
    input_impulses,
    count() AS times_used,
    count(WHERE success = true) AS times_success,
    count(WHERE success = false) AS times_failure
  FROM execution
  WHERE array::len(input_impulses) > 0
  GROUP BY activity_id, input_impulses;

-- =============================================================================
-- v_goal_paths: Composition activities that accept goal impulses
-- =============================================================================

DEFINE TABLE IF NOT EXISTS v_goal_paths AS
  SELECT
    id AS path_id,
    name AS path_name,
    child_activities,
    org_id
  FROM activity
  WHERE execution_type = 'composition'
    AND 'goal' IN input_shapes;
```

## Migration Plan

### Phase 1: Create New Tables (Non-Breaking)

1. Create `impulse`, `activity`, `execution`, `vessel` tables alongside existing
2. Create migration functions to transform data
3. No API changes yet

### Phase 2: Dual-Write Period

1. Update API to write to both old and new tables
2. Run backfill migration for historical data
3. Validate data consistency

### Phase 3: Read Migration

1. Switch API reads to new tables
2. Maintain backward-compatible endpoints
3. Monitor for issues

### Phase 4: Cleanup

1. Deprecate old endpoints
2. Drop old tables after validation period
3. Update documentation

## Risks / Trade-offs

### Risk 1: Data Migration Complexity

**Risk:** Complex transformations needed (goals -> impulses, tool_usage -> executions)

**Mitigation:**
- Write comprehensive migration scripts with rollback
- Test on staging with production data snapshot
- Maintain old tables during transition

### Risk 2: View Performance

**Risk:** Computed views may be slow for large datasets

**Mitigation:**
- Add materialized view option if needed
- Optimize with proper indexes
- Consider caching layer

### Risk 3: Breaking Existing Consumers

**Risk:** API changes break MiniBob, dashboard, MCP

**Mitigation:**
- Backward-compatible endpoint aliases
- Staged rollout
- Feature flags for new endpoints

## Open Questions

### Q1: Materialized Views

**Question:** Should v_activity_score be a materialized view or live computed?

**Options:**
- A) Live computed: Always accurate, may be slow
- B) Materialized with trigger: Fast reads, slight staleness
- C) Cached in Redis: Very fast, requires cache invalidation

**Recommendation:** Start with A, optimize to B/C if needed

### Q2: Impulse Content Storage

**Question:** Should impulse.content store large content inline or use object storage?

**Options:**
- A) Inline: Simple, limited by row size
- B) Object storage reference: Scalable, more complex
- C) Hybrid: Small inline, large in object storage

**Recommendation:** A for now (most impulses are small), migrate to C later
