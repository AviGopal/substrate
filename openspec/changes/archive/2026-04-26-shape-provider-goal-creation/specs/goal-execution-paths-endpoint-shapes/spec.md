## ADDED Requirements

### Requirement: goal_execution_paths table SHALL declare an endpoint_output_shapes field
The `goal_execution_paths` SurrealDB table SHALL declare a new field `endpoint_output_shapes` of type `option<array<string>>`. The field SHALL hold a deduplicated, denormalized accumulation of `output_shapes` across all activities in `path_activities`. When a path has no resolvable activities or no declared output shapes, the field SHALL be `NONE` (not an empty array, to distinguish "not yet computed" from "computed and empty").

#### Scenario: Field declared with correct type
- **WHEN** the migration adding `endpoint_output_shapes` runs
- **THEN** `INFO FOR TABLE goal_execution_paths` reports a field `endpoint_output_shapes` with type `option<array<string>>`

#### Scenario: Field is none for unresolved paths
- **WHEN** a path is inserted before the activities it references exist (race during multi-vessel write)
- **THEN** `endpoint_output_shapes` is `NONE`

### Requirement: An index SHALL allow shape-keyed lookup of goal_execution_paths
The system SHALL define `idx_goal_paths_endpoint_shapes` on `goal_execution_paths FIELDS endpoint_output_shapes`. Queries using `WHERE endpoint_output_shapes CONTAINS $shape` or `CONTAINSANY $shapes` SHALL use this index.

#### Scenario: Index supports CONTAINS lookup
- **WHEN** `EXPLAIN SELECT id FROM goal_execution_paths WHERE endpoint_output_shapes CONTAINS 'markdown_document'` is executed
- **THEN** the plan references `idx_goal_paths_endpoint_shapes`

### Requirement: Path inserts SHALL persist endpoint_output_shapes
On `POST /v2/goal-paths`, after computing the path's accumulated output shapes, the handler SHALL persist the result to the row's `endpoint_output_shapes` field in the same transaction as the row insert. The accumulation SHALL use the same logic as `predictEndpointState` (deduplicated union over `path_activities[*].output_shapes`).

#### Scenario: Newly recorded path stores correct shapes
- **WHEN** a path with `path_activities: ['act_a', 'act_b']` is recorded, where `act_a.output_shapes = ['x', 'y']` and `act_b.output_shapes = ['y', 'z']`
- **THEN** the inserted row has `endpoint_output_shapes` equal to `['x', 'y', 'z']` (set semantics, order not guaranteed)

#### Scenario: Empty output shapes still write a value
- **WHEN** every activity in the path declares no `output_shapes`
- **THEN** the inserted row has `endpoint_output_shapes` equal to `[]` (empty array, distinct from `NONE`)

### Requirement: A backfill SHALL populate endpoint_output_shapes for pre-existing rows
The migration adding the field SHALL backfill `endpoint_output_shapes` for every existing `goal_execution_paths` row by accumulating `output_shapes` across activities referenced in `path_activities`. The backfill SHALL be idempotent — running the migration twice SHALL produce the same final state. The backfill SHALL skip rows where `path_activities` references missing activity ids and SHALL log the skip rather than failing the migration.

#### Scenario: Backfill produces same result as on-the-fly accumulation
- **WHEN** the migration runs over an existing row with `path_activities: ['act_a']` and `act_a.output_shapes = ['s1']`
- **THEN** that row's `endpoint_output_shapes` is `['s1']` after the migration completes

#### Scenario: Backfill is idempotent
- **WHEN** the migration runs twice in succession
- **THEN** the second run produces no row changes and no errors

#### Scenario: Backfill handles missing activity ids gracefully
- **WHEN** a row references an activity id that does not exist in the `activity` table
- **THEN** the migration logs a skip warning, leaves `endpoint_output_shapes` as `NONE` for that row, and continues with the remaining rows

### Requirement: GET /v2/goal-paths SHALL accept an endpoint_output_shape query parameter
`GET /v2/goal-paths` SHALL accept an optional `endpoint_output_shape: string` query parameter. When present, the response SHALL include only rows whose `endpoint_output_shapes` contains the requested shape. When absent, behavior is unchanged.

#### Scenario: Filter returns matching rows only
- **WHEN** `GET /v2/goal-paths?endpoint_output_shape=markdown_document` is called
- **THEN** the response includes only rows whose `endpoint_output_shapes` array contains `markdown_document`

#### Scenario: Absent parameter preserves existing behavior
- **WHEN** `GET /v2/goal-paths` is called without the new parameter
- **THEN** the response shape and contents match the pre-change behavior (no filtering by endpoint shape)

### Requirement: POST /v2/goal-paths/recommend SHALL accept an endpoint_output_shape filter
`POST /v2/goal-paths/recommend` SHALL accept an optional `endpoint_output_shape: string` field in the request body. When present, the recommender SHALL exclude paths whose `endpoint_output_shapes` does not contain the requested shape from the candidate set BEFORE Thompson Sampling. The filter SHALL be a hard constraint, not a re-rank.

#### Scenario: Recommendations filtered before sampling
- **WHEN** the request body includes `endpoint_output_shape: 'sourceCode'` and three candidate paths exist with terminal shapes `['sourceCode']`, `['markdown_document']`, and `['sourceCode', 'testResults']` respectively
- **THEN** Thompson Sampling considers only the first and third paths

#### Scenario: Filter returning empty candidate set produces empty recommendations
- **WHEN** the request body specifies a shape that no path produces
- **THEN** the response `recommended_paths` is `[]` and the response is HTTP 200

### Requirement: predictEndpointState SHALL prefer the denormalized field when populated
`predictEndpointState` (currently at `repos/metabob-activity-api/src/routes/goal-paths.ts:112-181`) SHALL read directly from the row's `endpoint_output_shapes` field when that field is non-`NONE`, returning it as `expected_shapes` without re-running the activity join. When the field is `NONE` (e.g. for a freshly inserted row before backfill propagation), the function SHALL fall back to the existing on-the-fly accumulation.

#### Scenario: Denormalized read avoids the join
- **WHEN** `predictEndpointState` is called for a path whose `endpoint_output_shapes` is populated
- **THEN** no `SELECT ... FROM activity` query is issued; the function returns the denormalized array directly

#### Scenario: Fallback path still works when denormalized field is none
- **WHEN** the field is `NONE`
- **THEN** the function reverts to the existing accumulation logic and returns the same result it would have returned before this change
