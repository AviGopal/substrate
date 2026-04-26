# Goal Execution Paths Schema

## Overview

Goal execution paths represent curated sequences of activities that achieve a user-specified goal. They combine explicit goal definition with an ordered activity chain, capturing both the "what" (goal) and the "how" (activity composition).

**Related OpenSpec**: [2026-04-26-shape-provider-goal-creation](../../openspec/changes/2026-04-26-shape-provider-goal-creation)

## Core Fields

### Identity & Metadata

```typescript
goal_execution_paths {
  id: string                  // Unique ID
  org_id: string              // Multi-tenant scoping
  created_by: string          // Creator user_id
  created_at: datetime        // Creation timestamp
  modified_at: datetime       // Last modification
  
  // Goal definition
  goal: string                // User-provided goal description
  goal_category: string       // "feature" | "bugfix" | "refactor" | "tool" | "infrastructure"
  
  // Path definition
  path_activities: string[]   // Ordered activity IDs in the composition
  path_signature: string      // Hash of activities for deduplication
}
```

### Thompson Sampling (Template Selection)

```typescript
goal_execution_paths {
  // Thompson Sampling state for path selection
  thompson_alpha: number      // Success count
  thompson_beta: number       // Failure count
  last_execution_at: datetime // Last time this path was used
  execution_count: number     // Total executions
  success_rate: number        // Cached success_rate (alpha / (alpha + beta))
}
```

### Terminal Output Shapes (Migration 092, 2026-04-26)

```typescript
goal_execution_paths {
  // NEW: Denormalized terminal output shapes
  endpoint_output_shapes: string[] | null
  // Accumulated from path_activities[*].output_shapes
  // Ordered by path_activities; may contain duplicates (intentional for shape availability tracking)
  // Enables shape-keyed lookup: "find a goal path whose terminal output is markdown_document"
}
```

## Purpose of `endpoint_output_shapes`

### Problem

Previously, finding goal paths by terminal output shape required:
1. Loading the full `goal_execution_paths` row
2. Looking up each activity in `path_activities` 
3. Collecting `output_shapes` from each activity
4. Deduplicating and returning matches

This was expensive and required multi-table joins.

### Solution

Migration 092 denormalizes the accumulated output shapes directly onto `goal_execution_paths.endpoint_output_shapes`:

**Advantages:**
- **Fast shape-keyed lookup**: Single index query `WHERE endpoint_output_shapes CONTAINS 'shape_name'`
- **No activity table joins needed**: Goal path queries are self-contained
- **Backward compatible**: Null for legacy rows; backfill is idempotent

### Use Cases

#### 1. Shape-Provider Goal Creation

The `create-shape-provider-goal` activity queries:
```sql
SELECT * FROM goal_execution_paths 
WHERE endpoint_output_shapes CONTAINS 'desired_shape'
```

This finds all goal paths that can produce a desired output shape, enabling:
- "I need markdown_document output. What goal paths can produce it?"
- Dynamic capability discovery without scanning all activities
- Shape-aware goal recommendation

#### 2. Composition Planning

When building a multi-activity composition:
```sql
-- Find next-step activities whose inputs match our accumulated shapes
-- Then filter goal paths whose outputs can feed those activities
SELECT * FROM goal_execution_paths 
WHERE endpoint_output_shapes CONTAINS some_accumulated_shape
```

#### 3. Goal Recommendation

When user specifies desired output shape:
```
User: "I want JSON output"
↓
Find goal_execution_paths WHERE endpoint_output_shapes CONTAINS 'json_document'
↓
Recommend those paths with highest Thompson success_rate
```

## Implementation Details

### Backfill (Migration 092)

```sql
UPDATE goal_execution_paths
SET endpoint_output_shapes = array::distinct(array::flatten(
  (SELECT VALUE output_shapes FROM activity 
   WHERE id INSIDE $parent.path_activities)
))
WHERE endpoint_output_shapes IS NONE;
```

**Characteristics:**
- **Idempotent**: Re-running does nothing (WHERE filters on IS NONE)
- **Deduplicates**: Removes duplicate shapes within a path's outputs
- **Flattens**: Handles nested shape arrays from complex activities
- **No backfill downtime**: Updates existing rows; legacy paths stay null

### Index (Migration 092)

```sql
DEFINE INDEX idx_goal_paths_endpoint_shapes
  ON goal_execution_paths FIELDS endpoint_output_shapes;
```

Enables efficient queries:
```sql
-- Fast (uses index)
SELECT * FROM goal_execution_paths 
WHERE endpoint_output_shapes CONTAINS 'desired_shape'

-- Slower (full scan)
SELECT * FROM goal_execution_paths 
WHERE endpoint_output_shapes[0] = 'desired_shape'
```

## Queries

### Find Goal Paths by Terminal Output Shape

```typescript
// Query
POST /v2/impulses/resolve
{
  "pointer": {
    "type": "goalExecutionPath_by_endpoint_shape",
    "shape": "markdown_document",
    "limit": 10
  }
}

// Response
{
  "goal_execution_paths": [
    { id: "gp_123", goal: "...", endpoint_output_shapes: ["markdown_document", "..."] },
    // ...
  ]
}
```

### Find All Shapes Producible from This Path

```typescript
const path = await db.query(`SELECT endpoint_output_shapes FROM goal_execution_paths WHERE id = $id`)
const shapes = path.endpoint_output_shapes // Direct access, no joins
```

### Backfill Check (Debugging)

```typescript
// Paths with null endpoint_output_shapes (pre-migration or corrupted)
SELECT id, path_activities FROM goal_execution_paths 
WHERE endpoint_output_shapes IS NONE
LIMIT 10
```

If any rows exist, re-run the backfill manually or check migration logs.

## Backward Compatibility

- **Null for legacy paths**: Old goal_execution_paths rows will have endpoint_output_shapes = null
- **Queries must handle null**: `WHERE endpoint_output_shapes IS NOT NONE AND endpoint_output_shapes CONTAINS 'shape'`
- **No application changes required**: Queries gracefully degrade (slower, but correct)
- **Gradual migration**: New paths populate endpoint_output_shapes on creation; old paths remain null

## Monitoring & Maintenance

### Health Check

```sql
-- Should be 0 for fully-migrated systems
SELECT count(*) as null_endpoints FROM goal_execution_paths 
WHERE endpoint_output_shapes IS NONE
```

### Re-index (if needed)

```sql
-- Drop and recreate index
DROP INDEX idx_goal_paths_endpoint_shapes;
DEFINE INDEX idx_goal_paths_endpoint_shapes
  ON goal_execution_paths FIELDS endpoint_output_shapes;
```

## See Also

- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` — Shapes and impulse metadata
- `docs/impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md` — Write resolvers for goal paths
- OpenSpec: `2026-04-26-shape-provider-goal-creation` — Shape provider activity proposal
- `repos/metabob-activity-api/src/routes/goal-paths.ts` — Implementation
