# Goal Execution Paths Schema

## Overview

The `goal_execution_paths` table records the sequences of activities that achieve a goal. Each row combines an explicit goal (its text and a stable hash of it) with an ordered activity chain, capturing both the "what" and the "how", and carries the learning state earned by running that chain.

The table serves **two** roles:

1. **Curated / recommendation paths** — keyed by goal plus `endpoint_output_shapes`, for shape-driven discovery: "which recorded path terminates in the shape I need?"
2. **Per-goal record & reuse** — keyed by `goal_hash`. Every dispatched goal records the path it took and whether it *reached* its target, accumulating per-goal α/β so a later instance of the same goal can reuse the path that actually reached it. See **Per-Goal Record & Reuse** below.

Both roles read and write the same row. The write surface is `POST /v2/goal-paths` on activity-api (`repos/activity-api/src/routes/goal-paths.ts`, mounted at `/v2/goal-paths`); the read surfaces are `GET /v2/goal-paths`, `POST /v2/goal-paths/recommend`, `GET /v2/goal-paths/stats`, and the `goalExecutionPath` impulse shape.

## Core Fields

The table is declared `SCHEMAFULL` (`repos/activity-api/sql/003-goal-execution-paths.surql`), which has a consequence worth stating up front: **a field the writer sends but the schema does not define is silently dropped on write.** Several columns below were added by later migrations precisely because a value the producer already held was being discarded at the storage boundary. When a new field appears null on every row, check that a `DEFINE FIELD` for it exists before suspecting the producer.

### Identity & Metadata

```typescript
goal_execution_paths {
  goal_hash: string           // md5 of normalized goal text, first 16 hex chars — the reuse key
  goal_text: string           // original goal text as provided by the caller
  goal_category: string       // "feature" | "bugfix" | "refactor" | "tool" | "infrastructure" | "meta"

  path_activities: string[]   // ordered activity ids in the composition
  path_signature: string      // md5 of path_activities joined by "->", first 16 hex chars

  org_id: string              // multi-tenant scoping; PERMISSIONS filter on it
  last_executed_at: datetime  // timestamp of the most recent execution
  created_at: datetime        // first execution
  updated_at: datetime        // last update
}
```

Normalization before hashing lowercases, trims, strips punctuation and collapses whitespace to underscores, so cosmetically different phrasings of the same goal converge on one `goal_hash`. `(goal_hash, path_signature)` is a UNIQUE index — one row per goal-and-path pair, updated in place on every repeat.

### Thompson Sampling (Template Selection)

```typescript
goal_execution_paths {
  thompson_alpha: number      // Beta alpha (successes + 1); seeded 2.0 on a reached first run, 1.0 otherwise
  thompson_beta: number       // Beta beta (failures + 1); seeded 1.0 on a reached first run, 2.0 otherwise
  ev: number                  // computed: 1.0 * alpha / (alpha + beta) — the Beta posterior mean
  total_executions: number    // total executions of this goal+path
  successful_executions: number
  failed_executions: number
  success_rate: number        // successful_executions / total_executions
  execution_count: number     // back-compat alias of total_executions; incremented with it
  success_count: number       // back-compat field written only at row creation — see Backward Compatibility
  avg_duration_ms: number     // rolling mean
  avg_cost_usd: number        // rolling mean
  avg_token_usage: number     // rolling mean, floored to int
  last_inference_confidence: number | null
  walk_tier: string | null    // learned_pathway | satisfier | universal_tool_fallback | feature_compose | fresh_derivation
  reused_from_goal_hash: string | null       // WHICH pathway this walk borrowed
  reused_from_path_signature: string | null  // ...and which of that goal's paths
}
```

`ev` is a computed field (`VALUE 1.0 * (thompson_alpha ?? 1) / ((thompson_alpha ?? 1) + (thompson_beta ?? 1))`) — the `1.0 *` is what keeps it out of integer division. Every counter, posterior and rolling mean is incremented **inside a single SQL `UPDATE`** against the row's pre-update state, not read-modify-written in application code: two executions of the same goal landing concurrently would otherwise lose one increment.

`walk_tier` makes a goal's fresh-derivation → learned-reuse transition legible. It is worth its own note because it demonstrates the SCHEMAFULL hazard above: the producer sent it long before a `DEFINE FIELD` existed for it, so it read as null on every row until the field was defined.

`reused_from_goal_hash` / `reused_from_path_signature` record **which** pathway a walk borrowed. `walk_tier` already said a walk reused *something*; without these, reuse **attribution** was unrecoverable, so the architecture's ceiling claim — that a repeated task runs over its learned pathway — could not be evaluated in either direction.

They are deliberately **not** `parent_goal_hash` / `parent_path_signature`. That pair means SUB-GOAL lineage and carries the CC1 scope-narrowing assertion (`sql/migrations/100-cc1-scope-narrowing-assert.surql`): a child must produce a **subset** of the parent's `endpoint_output_shapes`. Borrowed-pathway reuse is the opposite relation — a donor is accepted at cover ≥ 0.5, so by construction up to half the reusing walk's shapes lie *outside* the donor's. Measured once on a REACHED 2-step reuse: sending `parent_*` did not add lineage, it **destroyed the record** with a 400. The reuse fields carry no scope assertion; CC1 is untouched and still applies to `parent_*`.

The `UPDATE` writes them as `$x ?? x`, so a later non-reusing run of the same path cannot erase the evidence that the pathway was once borrowed.

### Per-Goal Record & Reuse (2026-06)

Every goal dispatched through `goal-host-vessel` (`/run-goal` or `/resolve`) records the path it took, keyed by the hash of the goal text. Two functions in `repos/goal-host-vessel/src/index.ts` own the loop:

- **`recordGoalPath`** posts to `POST /v2/goal-paths` after execution. `path_activities` is the attribution (which activities and satisfier picks ran), `success` is whether the goal was *reached*, and α/β accumulate per `goal_hash`. It also forwards the produced and expected shape sets, the walk tier, duration, cost and inference confidence. The call is best-effort and time-bounded — a recording failure never fails the goal.
- **`recommendReachingPath`** consults `POST /v2/goal-paths/recommend` before selection and returns the first activity of the best previously-recorded path for the same `goal_hash`, preferring paths with a non-zero `success_rate`. Repeated goals therefore converge onto the path that actually reached, not merely the path that "completed."

**The goal-reaching gate.** `success` on this row is a *reach* verdict, not an exit status. `verifyGoalReached` runs after execution and is layered: deterministic pre-checks fire first and never consult a model — no content and no meaningful produced shape is `deterministic:no-output`; a `mitosisStaged` shape with no evidence of a landed cutover is `deterministic:staged-not-landed`, because an edit staged in a clone but never pushed to origin is not a reach; a digest whose every non-empty line is an error envelope is rejected structurally. Only what survives those checks reaches the LLM judge. A run whose activity returned `status=completed` without producing the goal's completion shapes is recorded `reached=false`, the selected template is β-penalised, and the row's `success` reflects the gate. This is what keeps hollow completion from α-crediting a wrapper.

### Terminal Output Shapes (Migration 092, 2026-04-26)

Two sibling array columns carry shapes, and they mean different things:

```typescript
goal_execution_paths {
  endpoint_output_shapes: string[] | null  // OBSERVED — shapes the path actually produced
  expected_output_shapes: string[] | null  // PLANNED — the goal's target shape set from the walk
}
```

`endpoint_output_shapes` is the denormalized accumulation of the terminal shapes for the path, indexed by `idx_goal_paths_endpoint_shapes` so a shape-keyed lookup needs no join. When the caller supplies it, the supplied value wins; otherwise the handler accumulates it by joining `path_activities` against the `activity` table (`accumulateEndpointShapes`). Ordering follows `path_activities` and the accumulation de-duplicates through a Set.

`expected_output_shapes` is its planned counterpart, supplied by the goal-host walk at record time and indexed by `idx_goal_paths_expected_shapes`. It exists as a separate producer-sent field rather than as a repair to the join because **the join cannot see satisfier picks by construction**: a large share of `path_activities` entries are `satisfier:*` and resolver tokens that have no row in `activity`, so the join matches nothing for them. The walk already holds both shape sets for every pick type, so it sends them forward. There is deliberately **no backfill** for `expected_output_shapes` — the planned shapes of historical paths lived only in a journal that prunes, and cannot be reconstructed. Together the two columns make plan-versus-observed reconciliation a durable query instead of a re-derivation.

## Purpose of `endpoint_output_shapes`

This column exists to make one question cheap: *given a shape I need, which recorded goal path terminates in it?* That question is asked on the hot path of shape-driven discovery and composition planning, so answering it by walking `path_activities` into the `activity` table per candidate row is the difference between a lookup that gets used and one that gets avoided. The three subsections below give the cost being avoided, the shape of the fix, and what the fix unlocks.

### Problem

Finding goal paths by terminal output shape without the denormalized column requires, per candidate row: load the full `goal_execution_paths` row, look up each id in `path_activities`, collect `output_shapes` from each, then deduplicate and match. That is a multi-table join executed per row of a scan, on the hot path of every shape-driven lookup — expensive enough to discourage the lookups that make shape-keyed discovery useful in the first place.

### Solution

The accumulated output shapes are denormalized directly onto `goal_execution_paths.endpoint_output_shapes` and indexed, so the lookup collapses to a single indexed predicate.

**Properties:**

- **Fast shape-keyed lookup** — one index query, `WHERE $shape IN endpoint_output_shapes`.
- **No activity-table join at read time** — goal-path queries are self-contained.
- **Degrades rather than breaks** — the column is nullable, and readers fall back to on-the-fly accumulation for rows that never got a value.

### Use Cases

#### 1. Shape-Provider Goal Creation

The `create-shape-provider-goal` template resolves the `goalExecutionPath` shape with a target shape, which queries:

```sql
SELECT * FROM goal_execution_paths
WHERE $shape IN endpoint_output_shapes AND org_id = $org
```

This finds every recorded goal path that can produce a desired output shape, enabling:

- "I need a `markdown_document`. Which goal paths produce one?"
- Capability discovery without scanning all activities
- Shape-aware goal recommendation

The resolver accepts the target shape under `shape_reference`, `target_shape`, or `endpoint_output_shape`; a request carrying none of the three is a 400. The alias set is load-bearing — a caller keying on a name the handler did not read gets an empty result on every call, which reads as "no evidence" rather than as an error and can livelock a family into re-composing goals forever.

#### 2. Composition Planning

When building a multi-activity composition:

```sql
-- Find next-step activities whose inputs match our accumulated shapes,
-- then filter goal paths whose outputs can feed those activities.
SELECT * FROM goal_execution_paths
WHERE $accumulated_shape IN endpoint_output_shapes
```

#### 3. Goal Recommendation

When a caller specifies a desired output shape, resolve `goalExecutionPath` for it, then rank the returned paths by their Thompson posterior (`ev`, or `success_rate` with the Wilson interval for small samples) and recommend the strongest.

## Implementation Details

The column is created, indexed and backfilled by `repos/activity-api/sql/migrations/092-goal-paths-endpoint-shapes.surql`; its planned sibling is defined by the `*-goal-paths-expected-shapes*` migrations in the same directory. `DEFINE FIELD` and `DEFINE INDEX` are no-ops when the definition is unchanged, so re-applying is safe. The two subsections below cover the parts that are *not* trivially re-runnable.

### Backfill (Migration 092)

```sql
UPDATE goal_execution_paths
SET endpoint_output_shapes = array::distinct(array::flatten(
  (SELECT VALUE output_shapes FROM activity 
   WHERE id INSIDE $parent.path_activities)
))
WHERE endpoint_output_shapes IS NONE;
```

**Characteristics and the limit that follows from them:**

- **Guarded on `IS NONE`** — it only touches rows that have no value at all.
- **Deduplicates and flattens** — collapses duplicate shapes and nested arrays.
- **No downtime** — updates in place; rows it does not match are left alone.
- **It cannot repair a row it already wrote.** The join matches nothing for `satisfier:*` and resolver tokens, which have no `activity` row. Such a row is written as `[]` — a value, not `NONE` — so the `IS NONE` guard excludes it from every subsequent run and the empty array is frozen in. Re-running the backfill is therefore not a repair strategy for empty arrays; only a producer that sends the shapes at write time fixes those rows, which is why `expected_output_shapes` is producer-sent.

### Index (Migration 092)

```sql
DEFINE INDEX idx_goal_paths_endpoint_shapes
  ON goal_execution_paths FIELDS endpoint_output_shapes;
```

Write the predicate as membership so the index is usable:

```sql
-- Fast (uses the index)
SELECT * FROM goal_execution_paths 
WHERE $shape IN endpoint_output_shapes

-- Slower (full scan): positional access defeats the index and is wrong besides,
-- since the array is unordered with respect to "which shape is terminal".
SELECT * FROM goal_execution_paths 
WHERE endpoint_output_shapes[0] = $shape
```

The planned-shape sibling is indexed identically as `idx_goal_paths_expected_shapes`, so the same predicate form applies to it.

## Queries

Callers reach this table two ways: through the impulse resolver, which is the route agents and templates should use because it is traced and org-scoped, or through direct SurrealQL for maintenance and debugging. The examples below use the resolver first and drop to SQL only where no shape covers the question.

### Find Goal Paths by Terminal Output Shape

```typescript
// Request
POST /v2/impulses/resolve
{
  "pointer": {
    "type": "goalExecutionPath",
    "target_shape": "markdown_document"   // or shape_reference / endpoint_output_shape
  }
}

// Response
{
  "shape": "goalExecutionPath",
  "body": {
    "paths": [
      { "goal_text": "...", "path_activities": ["..."], "endpoint_output_shapes": ["markdown_document", "..."] }
    ]
  }
}
```

Results are scoped to the caller's org by the resolver, so an empty `paths` array means "no path recorded for your org produces that shape", never "the shape does not exist".

### Find All Shapes Producible from This Path

```sql
SELECT endpoint_output_shapes, expected_output_shapes
FROM goal_execution_paths
WHERE goal_hash = $goal_hash AND path_signature = $path_signature
```

Direct access, no joins. When `endpoint_output_shapes` is absent or empty, the recommendation route does not leave the answer blank: `predictEndpointState` falls back to accumulating from `path_activities` live, and — given the goal text — additionally reports `missing_shapes` and a `goal_completion` fraction against the shapes inferred from that text.

### Backfill Check (Debugging)

```sql
-- Rows that never received a value at all
SELECT goal_hash, path_signature, path_activities FROM goal_execution_paths 
WHERE endpoint_output_shapes IS NONE
LIMIT 10

-- Rows the join could not resolve — the larger and more interesting population
SELECT goal_hash, path_signature, path_activities FROM goal_execution_paths 
WHERE array::len(endpoint_output_shapes) = 0
LIMIT 10
```

Treat the two results differently. The first population is repairable by re-running the backfill. The second is not, for the reason given under **Backfill** — those rows need a producer that sends shapes at write time.

## Backward Compatibility

- **Null on rows that predate the column** — readers must tolerate it.
- **Queries must handle null** — `WHERE endpoint_output_shapes IS NOT NONE AND $shape IN endpoint_output_shapes`.
- **No application changes required** — the read-time fallback keeps results correct, only slower.
- **Forward-only population** — new records carry the shapes their producer sent; historical rows are not reconstructed, and `expected_output_shapes` in particular has no backfill by design.
- **Aliased counters — only one of them is maintained.** In the record handler (`repos/activity-api/src/routes/goal-paths.ts`), the row-creating branch writes both `execution_count` and `success_count`, but the atomic `UPDATE` that every repeat execution takes increments `execution_count` and does not set `success_count` at all. So `execution_count` tracks `total_executions`, while `success_count` stays frozen at whatever the first execution wrote. Read `total_executions` and `successful_executions`; treat `success_count` on a row with more than one execution as stale.

## Monitoring & Maintenance

The health of this table is not "does it have rows" but "do its rows carry the evidence the learning loop reads from them". A row with an empty shape array still participates in Thompson selection and still looks healthy by row count, while contributing nothing to shape-keyed discovery. The checks below are ordered from cheapest to most disruptive; run them in that order and stop as soon as one explains what you are seeing.

### Health Check

```sql
-- Rows with no value at all: should trend to 0 as the backfill runs
SELECT count() AS null_endpoints FROM goal_execution_paths 
WHERE endpoint_output_shapes IS NONE GROUP ALL

-- Rows whose shapes are recorded but empty: the population the backfill cannot repair
SELECT count() AS empty_endpoints FROM goal_execution_paths 
WHERE array::len(endpoint_output_shapes) = 0 GROUP ALL

-- Are producers sending the planned set at all?
SELECT count() AS with_expected FROM goal_execution_paths 
WHERE expected_output_shapes IS NOT NONE GROUP ALL
```

A high `empty_endpoints` count next to a low `with_expected` count points at the producer, not at the migration.

### Re-index (if needed)

Re-asserting an index is safe and idempotent, and is the right first move if lookups have gone slow but the data looks correct:

```sql
DEFINE INDEX IF NOT EXISTS idx_goal_paths_endpoint_shapes
  ON goal_execution_paths FIELDS endpoint_output_shapes;
DEFINE INDEX IF NOT EXISTS idx_goal_paths_expected_shapes
  ON goal_execution_paths FIELDS expected_output_shapes;
```

Prefer `IF NOT EXISTS` over a `REMOVE`-then-`DEFINE` cycle. `REMOVE FIELD` on a `SCHEMAFULL` table is destructive — it drops the stored values along with the definition, and on this table those values are unreconstructable learning state. `REMOVE INDEX` is survivable but leaves every shape-keyed lookup on a full scan until the rebuild completes.

## See Also

- [`IMPULSE_ACTIVITY_FOUNDATION.md`](IMPULSE_ACTIVITY_FOUNDATION.md) — shapes and impulse metadata
- [`../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`](../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md) — write resolvers for the learning loop
- `repos/activity-api/src/routes/goal-paths.ts` — the record / query / recommend / stats handlers
- `repos/activity-api/sql/003-goal-execution-paths.surql` — the table definition
- `repos/goal-host-vessel/src/index.ts` — `recordGoalPath`, `recommendReachingPath`, `verifyGoalReached`
