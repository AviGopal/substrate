## ADDED Requirements

### Requirement: impulse_pool_selection resolver registered in MiniBob
MiniBob SHALL register a template-dispatchable resolver under the key `impulse_pool_selection` in `ActivityExecutor.initializeResolvers()`. The resolver SHALL accept `config: { shape: string, taskId: string, candidates: ImpulseRef[], selectionMethod: "deterministic" | "thompson" }` and SHALL be callable from activity JSON via `"resolver": "impulse_pool_selection"`.

#### Scenario: Resolver is registered at startup
- **WHEN** `ActivityExecutor` initialises and `initializeResolvers()` runs
- **THEN** the registry returned contains an entry under the key `impulse_pool_selection`

#### Scenario: Resolver is dispatchable from a template task
- **WHEN** a task config sets `"resolver": "impulse_pool_selection"` with a valid `config` object
- **THEN** the executor invokes the resolver and does NOT fall back to LLM execution

### Requirement: impulse_pool_selection deterministic mode picks highest mean relevance
In `deterministic` mode, the resolver SHALL fetch `impulseRelevance` for each candidate keyed by `(impulse_id, taskId, shape)` via `MCPClient`, compute the mean `α / (α + β)`, and return the candidate with the highest mean. Ties SHALL be broken by most recent `last_used_at`.

#### Scenario: Three candidates, distinct relevance scores
- **WHEN** candidates A, B, C have means 0.5, 0.7, 0.3
- **THEN** the resolver returns `chosen_impulse_id: B`

#### Scenario: Tie on mean, distinct last_used_at
- **WHEN** A and B both have mean 0.5 but A.last_used_at is newer than B.last_used_at
- **THEN** the resolver returns `chosen_impulse_id: A`

### Requirement: impulse_pool_selection thompson mode samples Beta and picks highest
In `thompson` mode, the resolver SHALL sample `Beta(α, β)` for each candidate using the same Kumaraswamy approximation as `sampleBeta` in `repos/minibob/src/resolvers/variant-selection-resolver.ts`. The candidate with the highest sample SHALL be chosen.

#### Scenario: Reproducible selection given seeded random
- **WHEN** Math.random is seeded such that samples are A=0.4, B=0.9, C=0.6
- **THEN** the resolver returns `chosen_impulse_id: B`

### Requirement: impulse_pool_selection returns runner-ups for workbench surfacing
The resolver response SHALL include `runner_ups: Array<{ impulse_id: string, score: number }>` ordered by score descending, excluding the chosen candidate. The score reported SHALL match the selection method (mean for deterministic, sample for thompson).

#### Scenario: Three candidates, two runner-ups
- **WHEN** the resolver chooses A and B and C had scores 0.6 and 0.3 respectively
- **THEN** the response runner_ups equals `[{ impulse_id: B, score: 0.6 }, { impulse_id: C, score: 0.3 }]`

### Requirement: impulse_pool_selection degrades gracefully on backend fetch failure
When the `impulseRelevance` fetch fails or returns no records for any candidate, the resolver SHALL return the first candidate as `chosen_impulse_id` and SHALL include `degraded: true` in the response. It SHALL NOT throw.

#### Scenario: Backend timeout
- **WHEN** the MCP fetch for impulseRelevance throws a timeout error
- **THEN** the resolver returns `{ chosen_impulse_id: <candidates[0].id>, degraded: true, score: 0, runner_ups: [] }`

### Requirement: producer_selection resolver registered in MiniBob
MiniBob SHALL register a template-dispatchable resolver under the key `producer_selection` in `ActivityExecutor.initializeResolvers()`. The resolver SHALL accept `config: { missingShape: string, taskId: string, predecessorActivityId?: string, goalContext?: object, selectionMethod: "deterministic" | "thompson" }`.

#### Scenario: Resolver is registered at startup
- **WHEN** `ActivityExecutor` initialises
- **THEN** the registry contains an entry under the key `producer_selection`

### Requirement: producer_selection queries discover-by-shapes with candidates_with_scores mode
The resolver SHALL call `POST /v2/activities/discover-by-shapes` with `{ mode: "candidates_with_scores", required_shapes: [missingShape], predecessor_activity_id }`. It SHALL NOT call any other endpoint to fetch composition scores.

#### Scenario: Backend call shape
- **WHEN** the resolver runs with `missingShape: "errorLog"` and `predecessorActivityId: "act_xyz"`
- **THEN** the outbound POST body includes `mode: "candidates_with_scores"`, `required_shapes: ["errorLog"]`, and `predecessor_activity_id: "act_xyz"`

### Requirement: producer_selection applies selection method to composition scores
In `deterministic` mode, the resolver SHALL pick the producer with the highest mean composition score (`α / (α + β)`). In `thompson` mode, it SHALL Beta-sample each producer's `(α, β)` and pick the highest sample. Producers with `composition_score: null` SHALL use a uniform prior of `α=1, β=1`.

#### Scenario: Three producers, deterministic mode
- **WHEN** producers P1, P2, P3 have means 0.7, 0.4, 0.6
- **THEN** the resolver returns `chosen_producer.activity_id: P1`

#### Scenario: Producer with null composition_score uses uniform prior
- **WHEN** P1 has α=8, β=2 and P2 has `composition_score: null`
- **THEN** in deterministic mode the resolver compares P1.mean=0.8 against P2.mean=0.5 and chooses P1

### Requirement: producer_selection sets unbindable when no producers exist
When `discover-by-shapes` returns an empty producer list, the resolver SHALL return `{ chosen_producer: null, unbindable: true, runner_ups: [] }`.

#### Scenario: No producer registered for shape
- **WHEN** the route returns an empty `activities` array
- **THEN** the resolver response sets `unbindable: true` and `chosen_producer: null`

### Requirement: Both resolvers expose runner-ups in the response
Both `impulse_pool_selection` and `producer_selection` SHALL include a `runner_ups` array in their response payload, ordered by score descending. When fewer than two candidates were considered, `runner_ups` SHALL be an empty array.

#### Scenario: Single candidate, no runner-ups
- **WHEN** only one candidate is supplied to either resolver
- **THEN** the response includes `runner_ups: []`

### Requirement: producer_selection is reusable for validator-candidate selection
The `producer_selection` resolver's contract (config schema, score-based selection, runner-ups, `unbindable` flag) SHALL be reusable without modification by the sibling `validators-and-failure-modes` spec, which dispatches it against producer candidates filtered to validators (i.e. those whose `output_shapes` contain `validation_result`). No interface change is required to support this reuse.

#### Scenario: Validator selection uses the same resolver
- **WHEN** the validator-dispatch meta-activity from the sibling spec invokes `producer_selection` with a validator-only candidate set
- **THEN** the resolver returns the highest-scoring validator using its existing selection logic without resolver-side awareness of "validator" semantics
