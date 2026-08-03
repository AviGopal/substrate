# Goal Execution Paths Schema

## Overview

Goal execution paths represent sequences of activities that achieve a user-specified goal. They combine explicit goal definition with an ordered activity chain, capturing both the "what" (goal) and the "how" (activity composition).

The table serves **two** roles:
1. **Curated / recommendation paths** — keyed by goal + `endpoint_output_shapes` for shape-driven discovery (the original 2026-04 purpose, described below).
2. **Per-goal record & reuse** — keyed by `goal_hash`; each dispatched goal records the path it took and whether it *reached* its target, accumulating per-goal α/β so a later instance of the same goal can reuse the path that actually reached it (the 2026-06 goal-learning work). See **Per-goal record & reuse** below.


> **2026-06 update.** The per-goal record/reuse path and the goal-reaching gate are the current goal-learning mechanism (goal-host `5d0f741` + `07feff5`, activity-api `172ce84`). Before `172ce84`, the goal-paths insert endpoint **500'd on every insert** (it omitted required `execution_count` / `success_count` / `org_id`), so this table was effectively empty and the "health check / null endpoints" guidance below was moot during that window.

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

### Per-Goal Record & Reuse (2026-06)

Every goal dispatched through `goal-host-vessel` (`/run-goal` or `/resolve`) records the path it took, keyed by a hash of the goal text:

```typescript
goal_execution_paths {
  goal_hash: string           // Stable hash of the goal text — the per-goal reuse key
  // path_activities = attribution (which activities/templates ran for this goal)
  // success = whether the goal was REACHED (reach-gated, see below), not exit status
  // thompson_alpha / thompson_beta accumulate per goal_hash across attempts
}
```

- **`recordGoalPath`** (goal-host) writes/updates the row after execution: the path is the attribution, `success` is whether the goal was *reached*, and α/β accumulate per `goal_hash`.
- **`recommendReachingPath`** (goal-host) reuses the highest-α path previously recorded for the same `goal_hash` — so repeated goals converge onto the path that actually reached, not merely the path that "completed."

**The goal-reaching gate.** Both dispatch paths now judge *reach* via an LLM verifier (`verifyGoalReached`, goal-host `07feff5`) **after** execution. A run whose activity returned `status=completed` but did not produce the goal's completion shapes is marked `reached=false`, the selected template is β-penalised, and the row's `success` reflects the gate — not the raw exit status. This closes the "completed ≠ reached" hollow-completion hole that previously α-credited wrappers/gaming. Verified live: hollow `audit→draft` runs recorded the wrapper path with α=1/β=2 (β penalty); accumulating genuine reaches drove n=3, α=4/β=1, rate=1.0.

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
- `repos/activity-api/src/routes/goal-paths.ts` — Implementation (activity-api side)
- `repos/goal-host-vessel/` — `recordGoalPath` / `recommendReachingPath` / `verifyGoalReached` (goal-host side)
