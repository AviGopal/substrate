# surrealdb-rl-layer Specification

## Purpose

Move the Thompson Sampling loop, composition graph traversal, and activity search from O(N) application-layer aggregation into SurrealDB 3.0's native primitives: atomic increment operators, COMPUTED fields, embedded JS sampling functions, RELATE graph edges with payload filtering, and HNSW vector indexes with hybrid RRF search. Five phases, independently deployable.

---

## Requirements

### R1: All α/β updates MUST be atomic

Every write to a Thompson posterior field (`alpha`, `beta`, `thompson_alpha`, `thompson_beta`) MUST use SurrealDB atomic increment operators (`SET alpha += $da, beta += $db`) with no intermediate read between the intent to increment and the committed write.

#### Scenario: Concurrent α increments preserve total

- **GIVEN** an `activity_template` row with `thompson_alpha = 1.0, thompson_beta = 1.0`
- **WHEN** 10 concurrent requests each issue `UPDATE activity_template:$id SET thompson_alpha += 1.0`
- **THEN** after all 10 complete, `thompson_alpha = 11.0` (no lost increments)

#### Scenario: Fetch-modify-write pattern is absent from all update sites

- **GIVEN** the four sites identified in the design (execution-traces.ts:1938, activities.ts:3599, activities.ts:3639, goal-paths.ts:402)
- **WHEN** any of these sites issues an α/β update
- **THEN** no SELECT query is issued against the same row immediately before the UPDATE in the same request context

---

### R2: `ev` field MUST be COMPUTED at read-time from live α/β values

All eight tables carrying α/β posteriors MUST define a COMPUTED `ev` field equal to `alpha / (alpha + beta)` (or `thompson_alpha / (thompson_alpha + thompson_beta)` for tables using the `thompson_` prefix). The field MUST be derived at read-time with no separate write path.

#### Scenario: ev reflects current alpha and beta without a stale intermediate

- **GIVEN** a row with `alpha = 3.0, beta = 1.0`
- **WHEN** the row is selected, the response includes an `ev` field
- **THEN** `ev == 0.75` (within float rounding tolerance 1e-9)

#### Scenario: ev updates when alpha is incremented atomically

- **GIVEN** a row with `alpha = 2.0, beta = 2.0` (ev = 0.5)
- **WHEN** `SET alpha += 2.0` is applied
- **THEN** the next SELECT of the same row returns `ev == 0.8` (4 / (4 + 2))

#### Scenario: ev is absent on rows where alpha and beta are both zero

- **GIVEN** a row where `alpha = 0.0, beta = 0.0` (division by zero)
- **WHEN** the row is selected
- **THEN** `ev` is `null` or omitted (no divide-by-zero exception surfaces to the caller)

---

### R3: Thompson Sampling MUST use true Beta distribution sampling

The Thompson Sampling step that selects an activity variant MUST draw a Beta-distributed sample from each candidate's posterior (`Beta(alpha, beta)`) rather than using the expected value (`alpha / (alpha + beta)`) as a deterministic score. The sampling MUST be equivalent in distribution to `@stdlib/random-base-beta`.

#### Scenario: fn::beta_sample produces Beta-distributed samples

- **GIVEN** `fn::beta_sample(2.0, 5.0)` called 1000 times
- **THEN** the sample mean is within 0.05 of `2/(2+5) = 0.286`
- **AND** the Kolmogorov-Smirnov test against the theoretical `Beta(2, 5)` CDF yields p-value > 0.05

#### Scenario: fn::beta_sample produces values in [0, 1]

- **GIVEN** any non-negative `$a` and `$b` arguments
- **WHEN** `fn::beta_sample($a, $b)` is called
- **THEN** the return value is in the closed interval `[0.0, 1.0]`

#### Scenario: App-side fallback is used when DB function is unavailable

- **GIVEN** `fn::beta_sample` is not defined in the connected SurrealDB instance (e.g. during a version-skew window)
- **WHEN** the Thompson sampling step is reached
- **THEN** the app calls `betaSample()` from `@stdlib/random-base-beta` as fallback
- **AND** `sample_source: "app_fallback"` is logged

---

### R4: Composition graph traversal MUST use RELATE edge queries with shape-filtered predicates

Forward-chaining composition discovery (`discover-by-shapes`, forward mode) MUST be implementable as a single graph traversal query: `activity_template:$start ->(composes WHERE input_shapes CONTAINSANY $shapes)-> activity_template`. Backward-chaining MUST be implementable as a single reverse traversal. Neither traversal MUST require fetching individual `variant_performance_metrics` rows separately.

#### Scenario: Forward traversal returns activity templates reachable from start node

- **GIVEN** a `composes` edge from `activity_template:A` to `activity_template:B` with `input_shapes = ["code"]`
- **WHEN** a forward traversal query is issued with `$required_input_shapes = ["code"]`
- **THEN** `activity_template:B` appears in the result set

#### Scenario: Shape filter excludes edges that do not match

- **GIVEN** edges A→B with `input_shapes = ["code"]` and A→C with `input_shapes = ["concept"]`
- **WHEN** forward traversal is issued with `$required_input_shapes = ["code"]`
- **THEN** only `activity_template:B` appears; `activity_template:C` is excluded

#### Scenario: RELATE edge α/β updates are atomic

- **GIVEN** a `composes` edge with `alpha = 1.0, beta = 1.0`
- **WHEN** `UPDATE type::thing("composes", $edge_id) SET alpha += 1.0`
- **THEN** `alpha == 2.0` (no lost update)

---

### R5: `discover-by-shapes` query count MUST NOT exceed O(1) DB round-trips

After the RELATE migration, the `discover-by-shapes` endpoint MUST issue at most 2 DB queries per call (regardless of the number of candidates returned): one for the graph traversal and at most one for supplemental metadata. The current O(N-candidates) fan-out (21 queries for 10 candidates) MUST be eliminated.

#### Scenario: discover-by-shapes issues at most 2 DB queries

- **GIVEN** a `discover-by-shapes` call with `mode: "candidates_with_scores"` and up to 10 candidates
- **WHEN** the request is processed
- **THEN** at most 2 DB queries are issued (logged via `edge_query_count`)

#### Scenario: Result set is consistent with legacy join-table results

- **GIVEN** the RELATE edges contain the same data as `activity_composition_graph`
- **WHEN** the same `discover-by-shapes` request is issued against both the old (join-table) and new (RELATE) code paths
- **THEN** the top-10 results are identical (same activity IDs, same rank order)

---

### R6: BM25 search MUST return non-zero scores for matching documents

The Tier 3 BM25 full-text search in `paradigm.ts` MUST return non-zero scores for activity templates whose `name` or `description` fields contain the query terms.

#### Scenario: BM25 returns non-zero results for a matching query

- **GIVEN** an activity template with `name = "execute bash command"` in the database
- **WHEN** a Tier 3 BM25 search is issued with query `"bash"`
- **THEN** the result set is non-empty and the template's BM25 score is > 0

#### Scenario: BM25 search does not error on queries with special characters

- **GIVEN** a query string containing `'` or `"` or `\`
- **WHEN** the BM25 query is constructed
- **THEN** the query executes without a SurrealDB syntax error
- **AND** the result set may be empty (no match) but no exception is thrown

---

### R7: Dense activity search MUST use HNSW index when available

When `DENSE_EMBEDDING_HNSW_ENABLED=true`, the dense similarity search in `paradigm.ts` MUST use the HNSW KNN operator (`<|k,ef|>`) rather than loading all rows and scoring in-process. When `false`, the O(n) scan path is used (backward compatible).

#### Scenario: HNSW path used when flag is enabled

- **GIVEN** `DENSE_EMBEDDING_HNSW_ENABLED=true` and an HNSW index defined on `name_embedding`
- **WHEN** a dense search is issued
- **THEN** `dense_search_method: "hnsw"` is logged

#### Scenario: Scan path used when flag is disabled (backward compatible)

- **GIVEN** `DENSE_EMBEDDING_HNSW_ENABLED=false`
- **WHEN** a dense search is issued
- **THEN** `dense_search_method: "scan"` is logged
- **AND** the result set is equivalent to the HNSW result (rank correlation ≥ 0.95 on same query)

#### Scenario: HNSW rank correlation with scan baseline

- **GIVEN** HNSW index built on the current corpus
- **WHEN** 100 distinct dense search queries are issued against both HNSW and scan paths
- **THEN** Spearman rank correlation between the two result orderings is ≥ 0.95 for all 100 queries

---

### R8: `fn::beta_sample` MUST have an app-side fallback

The Thompson Sampling path MUST NOT hard-fail if `fn::beta_sample` is unavailable (e.g. during SurrealDB version upgrades or function re-definitions).

#### Scenario: Fallback is invoked on DB function error

- **GIVEN** `fn::beta_sample` is undefined in SurrealDB
- **WHEN** the Thompson sampling step calls `fn::beta_sample`
- **THEN** the call catches the SurrealDB error
- **AND** `betaSample()` from `@stdlib/random-base-beta` is called instead
- **AND** `sample_source: "app_fallback"` is present in the log line for this sampling call
- **AND** the recommendation response is returned to the caller without error

---

### R9: All changes MUST be independently deployable per phase with no breaking API changes

Each of P1 through P5 (6 phases) MUST be deployable to canary independently. No phase MUST require a prior phase to be in production before it can ship. API response shapes MUST NOT change (existing fields remain, new fields may be added if optional).

#### Scenario: P1 atomic updates ship without P2 COMPUTED field

- **GIVEN** atomic α/β updates are deployed but `ev` COMPUTED field is not yet defined
- **WHEN** the recommend endpoint is called
- **THEN** the response is identical to pre-P1 behaviour (app-side EV computation as fallback is active)

#### Scenario: P4 RELATE edges ship without removing activity_composition_graph

- **GIVEN** RELATE edges are defined and populated via backfill
- **WHEN** discover-by-shapes is called
- **THEN** the old join-table path remains active until explicitly switched
- **AND** dual-write keeps both data sources in sync

#### Scenario: No existing API response fields are removed or renamed

- **GIVEN** any of P1–P6 deployed to canary
- **WHEN** any existing API endpoint is called with the same request body as before
- **THEN** the response contains all previously-present fields with the same types
- **AND** new fields (if any) are additive and optional

---

### R10: Backfill script for RELATE edges MUST be idempotent

The migration backfill that converts `activity_composition_graph` rows to RELATE edges MUST be runnable multiple times without creating duplicate edges or corrupting existing edge α/β values.

#### Scenario: Backfill is idempotent on second run

- **GIVEN** the backfill script has been run once (all edges created)
- **WHEN** the backfill script is run again
- **THEN** no duplicate edges are created (unique index on `(in, out)` prevents duplicates)
- **AND** existing edge α/β values are unchanged

#### Scenario: Backfill handles missing composition_impulse_flow rows

- **GIVEN** an `activity_composition_graph` row with no corresponding `composition_impulse_flow` rows
- **WHEN** the backfill processes this row
- **THEN** the RELATE edge is created with `input_shapes = [], output_shapes = []`
- **AND** no error is thrown
