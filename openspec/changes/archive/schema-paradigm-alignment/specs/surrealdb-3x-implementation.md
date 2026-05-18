# SurrealDB 3.x Implementation Guide

## Overview

This specification captures SurrealDB 3.x-specific patterns and constraints for implementing the schema-paradigm-alignment. Based on web research conducted 2026-03-26.

## Key Findings

### 1. Computed Views (Materialized)

SurrealDB uses `DEFINE TABLE ... AS SELECT` to create event-based materialized views that update incrementally:

```surql
-- Thompson Sampling view - auto-updates when execution table changes
DEFINE TABLE IF NOT EXISTS v_activity_score AS
  SELECT
    activity_id,
    org_id,
    count() AS total_executions,
    count(IF success = true THEN 1 ELSE NONE END) + 1 AS alpha,
    count(IF success = false THEN 1 ELSE NONE END) + 1 AS beta,
    math::mean(<float> duration_ms) AS avg_duration_ms,
    math::sum(<float> cost_usd) AS total_cost_usd
  FROM execution
  GROUP BY activity_id, org_id;
```

**Characteristics:**
- Updates incrementally on INSERT/UPDATE/DELETE to source table
- Reads are fast (pre-computed data)
- No manual refresh needed
- SurrealDB 3.0: GROUP BY queries up to 55% faster

### 2. PERMISSIONS on Views - Critical Limitation

**Views do NOT inherit PERMISSIONS from source tables.**

```surql
-- This view exposes ALL data regardless of source table permissions!
DEFINE TABLE v_activity_template AS
  SELECT * FROM activity WHERE execution_type = 'template';

-- WORKAROUND 1: Add explicit PERMISSIONS to view (if supported)
DEFINE TABLE v_activity_template AS
  SELECT * FROM activity WHERE execution_type = 'template'
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id;

-- WORKAROUND 2: Include org_id filter in view definition
DEFINE TABLE v_activity_template AS
  SELECT * FROM activity
  WHERE execution_type = 'template' AND org_id = $auth.org_id;

-- WORKAROUND 3: Use parameterized queries instead of views for sensitive data
SELECT * FROM activity
WHERE execution_type = 'template' AND org_id = $auth.org_id;
```

**Recommendation:** For multi-tenant data, use parameterized queries or include org_id filtering directly in view definitions.

### 3. Array Operations for Shape Matching

Use `ALLINSIDE` operator for shape matching algorithm:

```surql
-- Check: input_shapes ⊆ available_shapes
LET $available = ["goal", "error", "source_code"];

SELECT * FROM activity
WHERE execution_type = 'template'
  AND input_shapes ALLINSIDE $available;
```

**Operators:**

| Operator | Symbol | Use Case |
|----------|--------|----------|
| `ALLINSIDE` | `⊆` | All elements of left in right |
| `ANYINSIDE` | `⊂` | Any element of left in right |
| `CONTAINSALL` | `⊇` | Right contains all of left |
| `CONTAINSANY` | `⊃` | Right contains any of left |

**Index for performance:**

```surql
-- Index on array field enables index-accelerated set operations
DEFINE INDEX idx_activity_input_shapes ON activity FIELDS input_shapes;
```

**Alternative function-based validation:**

```surql
-- Explicit subset check using array functions
SELECT * FROM activity
WHERE array::is_empty(array::complement(input_shapes, $available));
```

### 4. Breaking Changes from 2.x to 3.x

**COMPUTED fields replace futures:**

```surql
-- 2.x (deprecated)
DEFINE FIELD success_rate ON activity VALUE <future> {
  success_count * 1.0 / (success_count + failure_count + 0.001)
};

-- 3.x (correct)
DEFINE FIELD success_rate ON activity
  COMPUTED success_count * 1.0 / (success_count + failure_count + 0.001);
```

**Array idiom behavior changed:**

```surql
-- 3.x: Evaluated on EACH element, not whole array
[{ a: ["a","b"]}, {a: [1,2]}].a[0]  -- Returns ["a", 1]
```

**Migration command:**

```bash
# Export with v3 compatibility from 2.6.0+
surreal export --v3-compatible backup.surql
```

### 5. RBAC Pattern for 4 Core Tables

Universal PERMISSIONS pattern:

```surql
DEFINE TABLE impulse SCHEMAFULL
  PERMISSIONS
    FOR select WHERE org_id = $auth.org_id
      OR (public = true AND scope = 'global')
    FOR create WHERE $auth.org_id != NONE
    FOR update WHERE org_id = $auth.org_id
      AND ($auth.role = 'admin' OR created_by = $auth.id)
    FOR delete WHERE org_id = $auth.org_id AND $auth.role = 'admin';

-- org_id field must be required and auto-populated
DEFINE FIELD org_id ON impulse TYPE record<organizations>
  ASSERT $value != NONE
  VALUE $value OR $auth.org_id;

-- Indexes for RBAC performance
DEFINE INDEX idx_impulse_org ON impulse FIELDS org_id;
DEFINE INDEX idx_impulse_org_project ON impulse FIELDS org_id, project_id;
```

### 6. Migration Strategy

**Parallel table deployment:**

```surql
-- Create new tables alongside existing (non-breaking)
DEFINE TABLE IF NOT EXISTS impulse SCHEMAFULL;
DEFINE TABLE IF NOT EXISTS activity SCHEMAFULL;
DEFINE TABLE IF NOT EXISTS execution SCHEMAFULL;
DEFINE TABLE IF NOT EXISTS vessel SCHEMAFULL;
```

**Event-based dual-write:**

```surql
-- Sync writes from old table to new table
DEFINE EVENT sync_impulse ON TABLE impulse_data
  WHEN $event = "CREATE" OR $event = "UPDATE" THEN {
    UPSERT impulse SET
      id = $after.id,
      shape = $after.pointer,
      resolution = { loaded: $after.loaded, content: $after.content },
      evolution = $after.evolution ?? [],
      org_id = $after.org_id ?? 'metabob_internal',
      created_at = $after.created_at,
      updated_at = time::now();
  };
```

**Batch backfill:**

```surql
-- Idempotent backfill (safe to run multiple times)
INSERT INTO impulse (
  SELECT
    id,
    pointer AS shape,
    { loaded: loaded, content: content } AS resolution,
    [] AS evolution,
    org_id ?? 'metabob_internal' AS org_id,
    created_at,
    time::now() AS migrated_at
  FROM impulse_data
  WHERE id NOT IN (SELECT id FROM impulse)
);
```

### 7. Thompson Sampling Implementation

**Database side (view computes alpha/beta):**

```surql
DEFINE TABLE IF NOT EXISTS v_activity_score AS
  SELECT
    activity_id,
    org_id,
    count(IF success = true THEN 1 ELSE NONE END) + 1 AS alpha,
    count(IF success = false THEN 1 ELSE NONE END) + 1 AS beta
  FROM execution
  GROUP BY activity_id, org_id;
```

**Application side (Beta distribution sampling):**

```typescript
// SurrealDB lacks native Beta distribution - sample in application
function thompsonSample(alpha: number, beta: number): number {
  // Use jstat or similar library
  return jstat.beta.sample(alpha, beta);
}

// Select activity with highest sampled value
async function selectActivity(
  availableShapes: string[],
  orgId: string
): Promise<Activity> {
  const activities = await db.query(`
    SELECT
      a.*,
      s.alpha,
      s.beta
    FROM activity a
    JOIN v_activity_score s ON s.activity_id = a.id
    WHERE a.org_id = $org_id
      AND a.input_shapes ALLINSIDE $shapes
  `, { org_id: orgId, shapes: availableShapes });

  return activities.reduce((best, current) => {
    const sample = thompsonSample(current.alpha, current.beta);
    return sample > best.sample ? { ...current, sample } : best;
  }, { sample: -1 });
}
```

### 8. Record References (3.x Feature)

Bidirectional relationships with `REFERENCE` keyword:

```surql
-- Define bidirectional reference
DEFINE FIELD activity ON execution TYPE record<activity> REFERENCE;

-- Forward traversal
SELECT activity.name FROM execution WHERE id = $exec_id;

-- Reverse traversal (tilde notation)
SELECT * FROM activity<-execution WHERE activity.id = $activity_id;
```

### 9. Change Feeds for Migration Monitoring

```surql
-- Enable change feed during migration
DEFINE TABLE impulse CHANGEFEED 7d;

-- Monitor changes
LIVE SELECT * FROM impulse;
```

### 10. Performance Targets

| Operation | Target | Implementation |
|-----------|--------|----------------|
| v_activity_score query | < 50ms | Materialized view |
| Shape matching | < 100ms | Index on input_shapes |
| Impulse resolution | < 100ms | Pointer-type dispatch |
| Thompson sample | < 10ms | Application-side Beta sampling |

## Schema Definitions

### Core Tables

```surql
-- impulse: All data with pointer + shape + metadata
DEFINE TABLE impulse SCHEMAFULL;
DEFINE FIELD id ON impulse TYPE string;
DEFINE FIELD pointer ON impulse TYPE object;
DEFINE FIELD shape ON impulse TYPE string;
DEFINE FIELD resolution ON impulse TYPE object DEFAULT { loaded: false };
DEFINE FIELD evolution ON impulse TYPE array DEFAULT [];
DEFINE FIELD org_id ON impulse TYPE record<organizations> ASSERT $value != NONE;
DEFINE FIELD project_id ON impulse TYPE option<record<projects>>;
DEFINE FIELD created_at ON impulse TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON impulse TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_impulse_org ON impulse FIELDS org_id;
DEFINE INDEX idx_impulse_shape ON impulse FIELDS shape;

-- activity: All state transitions with input/output shapes
DEFINE TABLE activity SCHEMAFULL;
DEFINE FIELD id ON activity TYPE string;
DEFINE FIELD name ON activity TYPE string;
DEFINE FIELD execution_type ON activity TYPE string; -- template, composition, tool
DEFINE FIELD input_shapes ON activity TYPE array<string> DEFAULT [];
DEFINE FIELD output_shapes ON activity TYPE array<string> DEFAULT [];
DEFINE FIELD tasks ON activity TYPE array DEFAULT [];
DEFINE FIELD child_activities ON activity TYPE array<string> DEFAULT []; -- for compositions
DEFINE FIELD org_id ON activity TYPE record<organizations> ASSERT $value != NONE;
DEFINE FIELD public ON activity TYPE bool DEFAULT false;
DEFINE FIELD created_at ON activity TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_activity_org ON activity FIELDS org_id;
DEFINE INDEX idx_activity_type ON activity FIELDS execution_type;
DEFINE INDEX idx_activity_input_shapes ON activity FIELDS input_shapes;

-- execution: All traces linking inputs to outputs
DEFINE TABLE execution SCHEMAFULL;
DEFINE FIELD id ON execution TYPE string;
DEFINE FIELD activity_id ON execution TYPE record<activity> REFERENCE;
DEFINE FIELD input_impulses ON execution TYPE array<string> DEFAULT [];
DEFINE FIELD output_impulses ON execution TYPE array<string> DEFAULT [];
DEFINE FIELD parent_execution_id ON execution TYPE option<string>;
DEFINE FIELD success ON execution TYPE bool;
DEFINE FIELD duration_ms ON execution TYPE int;
DEFINE FIELD cost_usd ON execution TYPE float DEFAULT 0.0;
DEFINE FIELD tokens_in ON execution TYPE int DEFAULT 0;
DEFINE FIELD tokens_out ON execution TYPE int DEFAULT 0;
DEFINE FIELD trace ON execution TYPE object; -- full task/tool trace
DEFINE FIELD org_id ON execution TYPE record<organizations> ASSERT $value != NONE;
DEFINE FIELD created_at ON execution TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_execution_org ON execution FIELDS org_id;
DEFINE INDEX idx_execution_activity ON execution FIELDS activity_id;
DEFINE INDEX idx_execution_success ON execution FIELDS success;

-- vessel: Execution environments with resolver capabilities
DEFINE TABLE vessel SCHEMAFULL;
DEFINE FIELD id ON vessel TYPE string;
DEFINE FIELD name ON vessel TYPE string;
DEFINE FIELD resolves ON vessel TYPE array<string> DEFAULT []; -- ["file", "memo"]
DEFINE FIELD api_key_hash ON vessel TYPE string;
DEFINE FIELD is_active ON vessel TYPE bool DEFAULT true;
DEFINE FIELD org_id ON vessel TYPE record<organizations> ASSERT $value != NONE;
DEFINE FIELD last_active_at ON vessel TYPE datetime;
DEFINE FIELD created_at ON vessel TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_vessel_org ON vessel FIELDS org_id;
DEFINE INDEX idx_vessel_active ON vessel FIELDS is_active;
```

### Computed Views

```surql
-- v_activity_score: Thompson Sampling from execution counts
DEFINE TABLE v_activity_score AS
  SELECT
    activity_id,
    org_id,
    count() AS total_executions,
    count(IF success = true THEN 1 ELSE NONE END) + 1 AS alpha,
    count(IF success = false THEN 1 ELSE NONE END) + 1 AS beta,
    math::mean(<float> duration_ms) AS avg_duration_ms,
    math::sum(<float> cost_usd) AS total_cost_usd,
    time::max(created_at) AS last_executed_at
  FROM execution
  GROUP BY activity_id, org_id;

-- v_impulse_relevance: Impulse-success correlation
DEFINE TABLE v_impulse_relevance AS
  SELECT
    impulse_shape,
    activity_id,
    org_id,
    count() AS co_occurrences,
    count(IF success = true THEN 1 ELSE NONE END) AS successes,
    count(IF success = false THEN 1 ELSE NONE END) AS failures
  FROM (
    SELECT
      e.activity_id,
      e.org_id,
      e.success,
      i.shape AS impulse_shape
    FROM execution e
    JOIN impulse i ON i.id IN e.input_impulses
  )
  GROUP BY impulse_shape, activity_id, org_id;

-- v_goal_paths: Compositions accepting goal impulses
DEFINE TABLE v_goal_paths AS
  SELECT
    id,
    name,
    child_activities,
    org_id
  FROM activity
  WHERE execution_type = 'composition'
    AND 'goal' IN input_shapes;
```

### Backward Compatibility Views

```surql
-- Map new schema to old API expectations
DEFINE TABLE v_activity_template AS
  SELECT
    id AS variant_id,
    name,
    execution_type AS execution_format,
    input_shapes AS impulses,
    tasks,
    org_id,
    public,
    created_at
  FROM activity
  WHERE execution_type = 'template';

DEFINE TABLE v_activity_execution_traces AS
  SELECT * FROM execution;

DEFINE TABLE v_impulse_data AS
  SELECT * FROM impulse;

DEFINE TABLE v_minibob_instance AS
  SELECT * FROM vessel;
```

## Verification Queries

```surql
-- Test computed view updates
INSERT INTO execution {
  id: 'test-1',
  activity_id: activity:test,
  success: true,
  duration_ms: 100,
  org_id: organizations:metabob_internal
};
SELECT * FROM v_activity_score WHERE activity_id = activity:test;

-- Test shape matching
LET $available = ["goal", "error"];
SELECT * FROM activity
WHERE input_shapes ALLINSIDE $available;

-- Test RBAC enforcement
-- As authenticated user with org_id claim
SELECT * FROM impulse; -- Should only return org's impulses

-- Verify index usage
EXPLAIN SELECT * FROM activity
WHERE input_shapes ALLINSIDE ["goal", "error"];
```

## Sources

- [SurrealDB DEFINE TABLE](https://surrealdb.com/docs/surrealql/statements/define/table)
- [SurrealDB Operators](https://surrealdb.com/docs/surrealql/operators)
- [SurrealDB Array Functions](https://surrealdb.com/docs/surrealql/functions/database/array)
- [SurrealDB DEFINE INDEX](https://surrealdb.com/docs/surrealql/statements/define/indexes)
- [SurrealDB Authentication](https://surrealdb.com/learn/fundamentals/security/authentication)
- [Upgrading 2.x to 3.x](https://surrealdb.com/docs/surrealdb/installation/upgrading/migrating-data-to-3x)
- [SurrealDB 3.0 Release Notes](https://surrealdb.com/blog/introducing-surrealdb-3-0--the-future-of-ai-agent-memory)
- [surrealdb-migrations](https://github.com/Odonno/surrealdb-migrations)
- [GitHub PR #6264: Index Planning for Set Operators](https://github.com/surrealdb/surrealdb/pull/6264)
- [GitHub Issue #5483: View PERMISSIONS](https://github.com/surrealdb/surrealdb/issues/5483)
