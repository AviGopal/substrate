# context-bucketed-thompson-sampling Specification

## Purpose

Thompson Sampling in `metabob-activity-api` currently keys α/β parameters by
`(template_id, org_id)` (global scores via `v_activity_score`) or by
`(activity_id, org_id, shape_signature)` (exact-set scores via
`v_shape_conditioned_score`).  The exact-set approach requires prior executions
with *exactly* the same set of loaded shapes before it produces any signal;
sparse contexts never accumulate enough data to break out of the uniform prior.

This spec adds a **context bucket** layer between global and exact-set scoring.
A context bucket is an 8-hex-character fingerprint that captures the coarse
structure of the recommendation request — which shapes are loaded *and* what
semantic cluster the goal belongs to.  The system learns "template T succeeds
when roughly these shapes are present and the goal is roughly about topic C"
without requiring history for every exact permutation.


## Definitions

| Term | Meaning |
|------|---------|
| `loaded_shapes` | The `impulse_shapes` array supplied in `POST /v2/activities/recommend` (before semantic augmentation) |
| `goal_cluster_id` | A stable integer 0–19 derived by hashing the first three dominant `tagPrefixes` returned by `analyzeTaskSemantics` |
| `context_bucket` | `hex(sha256(sorted(loaded_shapes).join(",") + "|" + org_id + "|" + goal_cluster_id))[:8]` |
| `context_thompson_scores` | New SurrealDB table keyed by `(template_id, org_id, context_bucket)` holding α/β |
| `n_context` | `alpha + beta - 2` for a given `(template_id, context_bucket)` row (observation count) |
| `blend_weight` | 0.7 when `n_context >= 5`, 0.3 when `2 <= n_context < 5`, 0.0 when `n_context < 2` |


## Requirements

### Requirement: Context bucket derivation at recommendation time

At `POST /v2/activities/recommend`, the server SHALL derive a `context_bucket`
from the raw `impulse_shapes` (before semantic augmentation) + `org_id` +
`goal_cluster_id`.

`goal_cluster_id` SHALL be computed as:
1. Call `analyzeTaskSemantics(task_description)` to obtain `tagPrefixes`.
2. Take the first three entries of `tagPrefixes` (or fewer if fewer exist); sort
   them alphabetically to canonicalise order.
3. Hash the joined string with SHA-256; take the integer value of the first byte
   modulo 20.  The result is an integer in [0, 19].

`context_bucket` SHALL be computed as:
1. Sort `loaded_shapes` alphabetically and join with `","`.
2. Concatenate with `"|"`, then `org_id`, then `"|"`, then
   `String(goal_cluster_id)`.
3. Hash the resulting string with SHA-256; take the first 4 bytes as a
   lowercase hex string (8 characters).

The `context_bucket` value SHALL be logged at `debug` level alongside the
recommendation request.

#### Scenario: Bucket is stable across identical requests

- **WHEN** two `POST /recommend` calls supply the same `impulse_shapes`,
  `task_description`, and `org_id`
- **THEN** both calls derive the same `context_bucket` string

#### Scenario: Bucket differs when loaded shapes differ

- **WHEN** two calls supply the same `task_description` and `org_id` but
  different `impulse_shapes` arrays
- **THEN** the derived `context_bucket` values are different (with overwhelming
  probability)

#### Scenario: Bucket differs when goal cluster differs

- **WHEN** two calls supply the same `impulse_shapes` and `org_id` but
  `task_description` values that resolve to different `goal_cluster_id` values
- **THEN** the derived `context_bucket` values are different

#### Scenario: Empty shapes yields a valid bucket

- **WHEN** `impulse_shapes` is absent or empty
- **THEN** the sorted shape component is the empty string; a valid 8-char bucket
  is still computed and used normally

#### Scenario: Bucket does not use semantically augmented shapes

- **WHEN** `analyzeTaskSemantics` returns `impliedShapes` that expand
  `effectiveShapes` beyond what the caller passed as `impulse_shapes`
- **THEN** the context bucket is computed from the caller-supplied
  `impulse_shapes` only, not from `effectiveShapes`


### Requirement: context_thompson_scores table

A table `context_thompson_scores` SHALL be defined in a new SurrealDB migration
with the following fields:

| Field | Type | Notes |
|-------|------|-------|
| `id` | record | Composite key `[org_id, template_id, context_bucket]` |
| `template_id` | string | Activity template identifier |
| `org_id` | string | Organisation identifier |
| `context_bucket` | string | 8-char hex fingerprint |
| `alpha` | float | Thompson α (successes + 1); default 1.0 |
| `beta` | float | Thompson β (failures + 1); default 1.0 |
| `n_observations` | int | `alpha + beta - 2`; maintained by UPSERT |
| `last_updated_at` | datetime | Timestamp of most recent UPSERT |
| `created_at` | datetime | Row creation timestamp |

PERMISSIONS for `SELECT` SHALL enforce `org_id = $token.org_id` consistent with
the existing multi-tenant pattern (`$token` not `$auth`, to support both JWT and
API-key auth).

PERMISSIONS for `CREATE` and `UPDATE` SHALL be service-level only (root
connection).

An index SHALL be defined on `(org_id, context_bucket)` for efficient bucket
lookups, and a separate index on `(org_id, template_id)` for template-scoped
queries.

#### Scenario: Table rejects cross-tenant reads

- **WHEN** a JWT authenticated as org A queries `context_thompson_scores`
- **THEN** only rows with `org_id` matching org A are returned


### Requirement: Context-specific score lookup at recommendation time

After the existing `getShapeConditionedScores` call (or `getActivityScores`
fallback), the server SHALL additionally query `context_thompson_scores` for the
derived `context_bucket` and the same `activityIds`.

The query SHALL return one row per `template_id` matching the bucket for the
caller's `org_id`.

#### Scenario: Context scores fetched for active bucket

- **WHEN** `context_thompson_scores` has rows for templates A and B under the
  current `context_bucket`
- **THEN** those rows are returned alongside (not instead of) global scores


### Requirement: Blended α/β at sampling time

For each template in the recommendation loop the server SHALL compute blended
parameters before calling `betaSample`:

```
n_context  = context_row.alpha + context_row.beta - 2   (0 if no row)
w          = 0.7  if n_context >= 5
           = 0.3  if 2 <= n_context < 5
           = 0.0  otherwise   (pure global/shape-conditioned path)

alpha_blended = w * context_row.alpha  + (1 - w) * global_alpha
beta_blended  = w * context_row.beta   + (1 - w) * global_beta
```

`global_alpha` and `global_beta` are the values already resolved via the
existing shape-conditioned or global score path (unchanged).

The blended values SHALL replace the raw `alpha`/`beta` before heuristic boosts
are applied.  Boosts (tag match, shape compatibility, etc.) are added to
`alpha_blended`, not to the context-specific α in isolation.

The `selection_metadata` object in the response SHALL include:

```json
{
  "context_bucket": "<8-char hex>",
  "context_blend_weight": 0.7,
  "context_n_observations": 12,
  "alpha_before_blend": 3.0,
  "alpha_after_blend": 5.4
}
```

Fields SHALL be omitted (or null) when `blend_weight` is 0.0 (no context data
applied).

> **Note (interim):** Exposing blended α/β via REST `selection_metadata` is an interim approach. Phase 9 of `2026-04-26-impulse-activity-loop` will route `thompson_posterior` (including context-bucketed scores) through the standard impulse→resolver dispatch path as a resolvable shape; currently REST-only.

#### Scenario: High-observation bucket dominates global prior

- **WHEN** a template has `context_thompson_scores` row with α=20, β=2
  (`n_context=20`, `w=0.7`) and global scores α=3, β=3
- **THEN** `alpha_blended = 0.7*20 + 0.3*3 = 14.9`, `beta_blended = 0.7*2 + 0.3*3 = 2.3`
- **THEN** `selection_metadata.context_blend_weight = 0.7`

#### Scenario: Low-observation bucket uses reduced weight

- **WHEN** a template has `context_thompson_scores` row with α=2, β=2
  (`n_context=2`, `w=0.3`) and global scores α=5, β=5
- **THEN** `alpha_blended = 0.3*2 + 0.7*5 = 4.1`, `beta_blended = 0.3*2 + 0.7*5 = 4.1`

#### Scenario: No context data falls back cleanly

- **WHEN** `context_thompson_scores` has no row for the current template and
  bucket
- **THEN** `blend_weight = 0.0`; sampling uses the unmodified global/shape-conditioned
  values; `selection_metadata` omits context fields


### Requirement: context_bucket threaded through execution trace metadata

When minibob submits an execution trace via `POST /v2/activities/execution-traces`,
the trace body MAY include a `context_bucket` field in its `metadata` object.

The activity-api SHALL persist `metadata.context_bucket` into the
`activity_execution_traces` record without validation (pass-through).  No
schema enforcement is required; the field is optional.

#### Scenario: Trace with context_bucket stored correctly

- **WHEN** a trace arrives with `metadata: { context_bucket: "a3f2c019" }`
- **THEN** the stored record contains `metadata.context_bucket = "a3f2c019"`

#### Scenario: Trace without context_bucket accepted

- **WHEN** a trace arrives without `metadata.context_bucket`
- **THEN** the record is stored normally; no error is returned


### Requirement: Context score update on execution completion

After `POST /v2/activities/execution-traces` successfully stores a trace, if
the trace includes `metadata.context_bucket` and the bucket string is a valid
8-character lowercase hex value, the server SHALL UPSERT
`context_thompson_scores` for `(template_id, org_id, context_bucket)`:

- On success (`success = true`): increment α by 1.
- On failure (`success = false`): increment β by 1.
- Update `n_observations = alpha + beta - 2` and `last_updated_at = now()`.

The UPSERT SHALL use the same composite record-ID pattern as
`impulse_shape_activity_score` (i.e.
`context_thompson_scores:[$org_id, $template_id, $context_bucket]`).

The UPSERT is non-critical: failures SHALL be caught, logged at `warn` level,
and NOT propagate an error to the trace-store response.

#### Scenario: Successful execution updates α

- **WHEN** a trace arrives with `success=true`, `activity_id="fix-bug"`,
  `org_id="acme"`, `metadata.context_bucket="a3f2c019"`
- **THEN** `context_thompson_scores:["acme","fix-bug","a3f2c019"].alpha` is incremented by 1

#### Scenario: Failed execution updates β

- **WHEN** a trace arrives with `success=false` for the same template and bucket
- **THEN** `context_thompson_scores:["acme","fix-bug","a3f2c019"].beta` is incremented by 1

#### Scenario: Missing or malformed bucket silently skipped

- **WHEN** `metadata.context_bucket` is absent, null, or not an 8-char hex string
- **THEN** no UPSERT is attempted; the trace is stored without error

#### Scenario: UPSERT failure does not affect trace store response

- **WHEN** the `context_thompson_scores` UPSERT fails (e.g. SurrealDB
  connectivity blip)
- **THEN** the `POST /execution-traces` endpoint still returns 200 with the
  stored trace ID


### Requirement: Fallback when context bucket has fewer than 2 observations

The blending formula already handles this via `blend_weight = 0.0` when
`n_context < 2`.  No additional code path is required; the fallback is implicit
in the weight formula.

#### Scenario: Fresh bucket (n=0) behaves identically to no context data

- **WHEN** a bucket exists in `context_thompson_scores` with α=1, β=1
  (`n_context=0`)
- **THEN** `blend_weight = 0.0`; the sampling result is identical to the
  no-context path

#### Scenario: Single observation (n=1) still below threshold

- **WHEN** a bucket has α=2, β=1 (`n_context=1`)
- **THEN** `blend_weight = 0.0`; context score is not applied


### Requirement: score_source updated in selection_metadata

The existing `scoreMethod` field (`score_source` in the response) SHALL be
extended with a new value `context_bucketed` when `blend_weight > 0.0`.  The
existing values `shape_conditioned`, `global`, and `legacy` remain valid when
the context layer contributes no weight.

#### Scenario: score_source reflects context when blend applied

- **WHEN** `blend_weight = 0.7` for at least one template in the response
- **THEN** `selection_metadata.score_source = "context_bucketed"` for that
  template

#### Scenario: score_source unchanged when no context data

- **WHEN** every template in the response has `blend_weight = 0.0`
- **THEN** `selection_metadata.score_source` retains its existing value


### Requirement: No minibob source changes required for bucket computation

The `context_bucket` computation is the responsibility of activity-api at
recommendation time.  MiniBob SHOULD pass back the `context_bucket` value it
receives in the recommendation response through `selection_metadata` when
submitting the execution trace, but this is an opt-in convenience — activity-api
SHALL NOT require it.

If MiniBob omits `metadata.context_bucket`, activity-api SHALL re-derive the
bucket from the execution trace's `input_impulse_shapes` and any available
`metadata.task_description` using the same hash formula.  If `task_description`
is absent, `goal_cluster_id` SHALL default to 0 for the re-derivation.

#### Scenario: activity-api re-derives bucket when trace omits it

- **WHEN** a trace arrives without `metadata.context_bucket` but with
  `input_impulse_shapes=["error","source_code"]` and no `task_description`
- **THEN** activity-api computes `goal_cluster_id=0`, derives a bucket from
  shapes + org_id + "0", and uses it for the UPSERT


### Requirement: Migration naming and ordering

The new table SHALL be introduced in a SurrealDB migration file named
`NNN-context-thompson-scores.surql` where `NNN` is the next available migration
number after the current highest.  The migration SHALL be idempotent (`DEFINE
TABLE IF NOT EXISTS`, `DEFINE INDEX IF NOT EXISTS`).

The migration SHALL not modify any existing table or view.

#### Scenario: Migration is safe to apply twice

- **WHEN** the migration is applied to a database that already has the table
- **THEN** no error is raised; existing data is unchanged


## Out of scope

- Automatic decay or expiry of old `context_thompson_scores` rows (can be
  addressed in a separate maintenance activity).
- Exposing `context_thompson_scores` as a queryable impulse shape (Phase 9 of `2026-04-26-impulse-activity-loop` will expose `thompson_posterior` as a resolvable shape, at which point context-bucketed scores can be surfaced through that path).
- UI surfaces for inspecting per-bucket scores (workbench trajectory editor
  shows `selection_metadata` fields, which is sufficient for now).
- Cross-org bucket sharing (each org's data is isolated).
