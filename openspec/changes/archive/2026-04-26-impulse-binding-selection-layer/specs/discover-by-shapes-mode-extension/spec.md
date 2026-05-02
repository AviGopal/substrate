## ADDED Requirements

### Requirement: discover-by-shapes accepts candidates_with_scores mode
The `POST /v2/activities/discover-by-shapes` endpoint SHALL accept `mode: "candidates_with_scores"` as a third valid value alongside the existing `"forward"` and `"backward"`. Requests with any other `mode` value SHALL continue to return HTTP 400 with the existing validation message.

#### Scenario: New mode passes validation
- **WHEN** the endpoint is called with `mode: "candidates_with_scores"`
- **THEN** the request is accepted and processed

#### Scenario: Unknown mode rejected
- **WHEN** the endpoint is called with `mode: "unknown_mode"`
- **THEN** the response is HTTP 400 with `message: 'mode must be either "forward" or "backward" or "candidates_with_scores"'` (or the equivalent updated validation message)

### Requirement: candidates_with_scores returns producers ranked by composition success
In `candidates_with_scores` mode, the endpoint SHALL run the same producer query as `forward` mode (find activities whose `output_shapes` contain any of `required_shapes`) and SHALL augment each result with composition-success edge weights. When the request body includes `predecessor_activity_id`, the join SHALL use the edge weight conditioned on that predecessor; otherwise it SHALL use the producer's unconditional success rate aggregated over all predecessors.

#### Scenario: Producers returned with composition_score per row
- **WHEN** a request specifies `mode: "candidates_with_scores"` and `required_shapes: ["errorLog"]`
- **THEN** the response includes a list of producer activities, each with a `composition_score: { alpha, beta, sample_count, predecessor_id?: string }` field

#### Scenario: Predecessor-conditioned join
- **WHEN** the request includes `predecessor_activity_id: "act_xyz"`
- **THEN** the `composition_score` on each row reflects the edge weight specifically for `(predecessor=act_xyz, producer=row.activity_id)` and `predecessor_id` equals `"act_xyz"`

#### Scenario: Unconditional fallback when predecessor absent
- **WHEN** the request omits `predecessor_activity_id`
- **THEN** the `composition_score` reflects the producer's aggregated success across all predecessors and `predecessor_id` is omitted

### Requirement: composition_score is null when no edge data exists
When a producer has no recorded composition-success edges (either at all, or for the supplied predecessor), the response row SHALL include `composition_score: null`. The endpoint SHALL NOT error out for missing edges.

#### Scenario: Producer with no edges
- **WHEN** a producer has never been part of a composition
- **THEN** its row in the response includes `composition_score: null` and the request still returns HTTP 200

### Requirement: Existing forward and backward modes are unchanged
`mode: "forward"` and `mode: "backward"` SHALL continue to behave exactly as before. The `composition_score` field SHALL NOT be added to their response rows. No fields SHALL be removed from existing response shapes.

#### Scenario: Forward mode response unchanged
- **WHEN** the endpoint is called with `mode: "forward"`
- **THEN** the response shape matches the pre-change contract (no `composition_score` field)

#### Scenario: Additive output_shapes filter on backward mode is layered by sibling spec
- **NOTE** Sibling spec `validators-and-failure-modes` adds an `output_shapes` filter parameter on backward mode for validator-discovery. That extension is additive and out of scope for this spec; the contracts defined here SHALL remain stable when that filter lands

### Requirement: Multi-tenant isolation preserved on the new mode
The `candidates_with_scores` mode SHALL respect the same org-scoping and PERMISSIONS clauses as the existing modes. Producers SHALL be returned only when accessible under the caller's authentication, and composition-success joins SHALL also be org-scoped.

#### Scenario: Caller cannot see another org's producers via the new mode
- **WHEN** caller's org_id is `org_a` and a producer exists only for `org_b`
- **THEN** that producer is not present in the response

#### Scenario: Composition scores from another org are not joined
- **WHEN** caller's org_id is `org_a` and composition-success edges exist for the producer under `org_b`
- **THEN** those edges are not used to compute `composition_score`; the score reflects only `org_a`'s data
