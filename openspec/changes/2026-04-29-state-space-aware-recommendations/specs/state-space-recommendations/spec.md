# state-space-recommendations Specification

## Purpose

Extend `POST /v2/activities/recommend` in metabob-activity-api to accept the executor's impulse state space (the set of impulses currently loaded in working memory) and the pointer state space (the set of shapes resolvable from the current vessel registry). The endpoint returns shape-compatibility-filtered template rankings alongside two new result sets: `pointer_recommendations` (which unresolved shapes to load next, ranked by expected utility gain) and `blocking_shapes` (which missing shapes are gating the best templates and whether they are resolvable). MiniBob populates both fields from its live impulse store and a discovery-vessel query.

---

## Requirements

### R1: `impulse_state_space` field on recommend request

`POST /v2/activities/recommend` SHALL accept an optional `impulse_state_space` array in the request body. Each entry SHALL have a required `shape: string` field and optional `summary: string`, `pointer: object`, and `loaded_at: string` (ISO timestamp) fields. If `impulse_state_space` is absent or `null`, the endpoint SHALL behave exactly as before (backward compatible). If `impulse_state_space` is present but empty (`[]`), the endpoint SHALL treat it as equivalent to absent for compatibility filtering purposes.

#### Scenario: Valid impulse_state_space is accepted

- **WHEN** a request body contains `impulse_state_space: [{ shape: "jwt_claims" }, { shape: "source_code", summary: "auth module" }]`
- **THEN** the server returns 200 with template recommendations and `blocking_shapes` in the response

#### Scenario: Missing impulse_state_space is a no-op

- **WHEN** the request body contains `goal: "fix auth bug"` but no `impulse_state_space`
- **THEN** behavior is identical to the current implementation; no `blocking_shapes` field is present in the response

#### Scenario: impulse_state_space entry with unknown fields is accepted

- **WHEN** an entry contains additional fields beyond the defined schema
- **THEN** the server ignores unknown fields and processes the request without error

---

### R2: `pointer_state_space` field on recommend request

`POST /v2/activities/recommend` SHALL accept an optional `pointer_state_space` array in the request body. Each entry SHALL have required `shape: string` and `vessel_id: string` fields and required `resolve_tier: 'deterministic' | 'pattern' | 'llm'` field, plus optional `resolve_timeout_ms: number`. If `pointer_state_space` is absent or empty, the endpoint SHALL omit `pointer_recommendations` from the response.

#### Scenario: Valid pointer_state_space is accepted

- **WHEN** a request body contains `pointer_state_space: [{ shape: "concept", vessel_id: "concept-db-v1", resolve_tier: "deterministic" }]`
- **THEN** the server returns 200 with `pointer_recommendations` in the response

#### Scenario: Missing pointer_state_space omits pointer_recommendations

- **WHEN** the request body contains `goal` but no `pointer_state_space`
- **THEN** the response does NOT include a `pointer_recommendations` field

---

### R3: Templates with fully covered inputs rank above templates with uncovered inputs

When `impulse_state_space` is provided and non-empty, templates whose all declared `input_shapes` are present as shapes in `impulse_state_space` SHALL rank above templates with one or more uncovered `input_shapes`, all else equal (same Thompson α/(α+β) value). The effective ranking score for templates with uncovered inputs SHALL be discounted.

#### Scenario: Fully-covered template outranks partially-covered template with equal Thompson scores

- **WHEN** template A has `input_shapes: ["jwt_claims"]`, template B has `input_shapes: ["concept"]`, both have Thompson score 0.8, and `impulse_state_space` contains `jwt_claims` but not `concept`
- **THEN** template A appears before template B in the `templates` response array

#### Scenario: Template with no declared input_shapes treated as fully covered

- **WHEN** a template has no `input_shapes` field (or an empty array) and `impulse_state_space` is provided
- **THEN** that template is treated as fully covered; no discount is applied to its ranking score

---

### R4: `pointer_recommendations` present when pointer_state_space is non-empty

When `pointer_state_space` is provided and contains at least one entry, the response SHALL include a `pointer_recommendations` array (possibly empty if all pointer_state_space shapes are already in impulse_state_space or no templates in top-20 require them).

#### Scenario: pointer_recommendations array present in response

- **WHEN** `pointer_state_space` contains one or more entries
- **THEN** the response includes `pointer_recommendations: [...]` (array, possibly empty)

#### Scenario: Shapes already in impulse_state_space excluded from pointer_recommendations

- **WHEN** `pointer_state_space` contains shape `"jwt_claims"` and `impulse_state_space` also contains `"jwt_claims"`
- **THEN** `jwt_claims` does NOT appear in `pointer_recommendations`

---

### R5: `pointer_recommendations` ordered by `expected_utility` DESC

The `pointer_recommendations` array SHALL be sorted by `expected_utility` in descending order (highest utility first). `expected_utility` SHALL be a value between 0.0 and 1.0 inclusive. The array SHALL contain at most 5 entries. Each entry SHALL include `shape`, `rationale`, `unlocks_template_ids`, `expected_utility`, and `resolve_via` fields.

#### Scenario: pointer_recommendations are sorted by utility

- **WHEN** shape A unlocks templates with total Thompson weight 0.9 and shape B unlocks templates with total Thompson weight 0.4
- **THEN** shape A appears before shape B in `pointer_recommendations`

#### Scenario: pointer_recommendations capped at 5 entries

- **WHEN** 10 shapes in pointer_state_space each unlock at least one template in top-20
- **THEN** `pointer_recommendations` contains at most 5 entries (the top 5 by expected_utility)

#### Scenario: expected_utility within 0–1 range

- **WHEN** any set of templates and shapes is provided
- **THEN** all `expected_utility` values in `pointer_recommendations` are between 0.0 and 1.0 inclusive

---

### R6: `blocking_shapes` present when impulse_state_space is provided

When `impulse_state_space` is provided in the request (including when it is an empty array), the response SHALL include a `blocking_shapes` array. The array MAY be empty if the top-5 templates have no uncovered required input shapes. Each entry SHALL include `shape`, `required_by_template_ids`, `in_pointer_state_space`, and `gap_severity` fields. The `resolve_via` field SHALL be present if and only if `in_pointer_state_space` is `true`.

#### Scenario: blocking_shapes present when impulse_state_space provided

- **WHEN** `impulse_state_space` is provided (even as an empty array)
- **THEN** the response includes `blocking_shapes: [...]` (array, possibly empty)

#### Scenario: blocking_shapes absent when impulse_state_space not provided

- **WHEN** the request body does not include `impulse_state_space`
- **THEN** the response does NOT include a `blocking_shapes` field

#### Scenario: blocking shape with vessel available sets in_pointer_state_space true

- **WHEN** template top-1 requires shape `"concept"`, `impulse_state_space` does not contain `"concept"`, and `pointer_state_space` contains a `"concept"` entry
- **THEN** the `blocking_shapes` entry for `"concept"` has `in_pointer_state_space: true` and a `resolve_via` field

#### Scenario: blocking shape with no vessel sets in_pointer_state_space false

- **WHEN** template top-1 requires shape `"concept"`, `impulse_state_space` does not contain `"concept"`, and `pointer_state_space` does NOT contain a `"concept"` entry
- **THEN** the `blocking_shapes` entry for `"concept"` has `in_pointer_state_space: false` and no `resolve_via` field

#### Scenario: blocking shape deduplicated across multiple templates

- **WHEN** two templates in top-5 both require shape `"activityExecutionTrace"` and it is absent from `impulse_state_space`
- **THEN** exactly ONE entry for `"activityExecutionTrace"` appears in `blocking_shapes`, with both template IDs listed in `required_by_template_ids`

---

### R7: Backward compatibility when both fields absent

When neither `impulse_state_space` nor `pointer_state_space` is present in the request body, `POST /v2/activities/recommend` SHALL behave exactly as the current implementation. No new fields SHALL be present in the response. Template ranking SHALL be identical to the current Thompson Sampling output.

#### Scenario: Existing request produces identical response

- **WHEN** a request body contains only the currently-supported fields (`goal`, `expected_output_shapes`, `filters`)
- **THEN** the response is byte-for-byte identical to the current implementation (no new fields added)

#### Scenario: Null fields treated as absent

- **WHEN** a request body contains `impulse_state_space: null` and `pointer_state_space: null`
- **THEN** behavior is identical to both fields being absent; no new response fields appear

---

### R8: MiniBob SHOULD populate impulse_state_space from loaded impulse pool

When MiniBob calls `POST /v2/activities/recommend`, it SHOULD include `impulse_state_space` populated from `ImpulseStore.getLoadedImpulseSummaries()` — the set of impulses currently in `loaded: true` state. The method SHALL be pure (no I/O) and complete in under 1ms for a pool of up to 50 impulses.

#### Scenario: ImpulseStore.getLoadedImpulseSummaries returns loaded impulses only

- **WHEN** the impulse store contains two loaded impulses and one unloaded impulse
- **THEN** `getLoadedImpulseSummaries()` returns exactly two entries

#### Scenario: ImpulseStore.getLoadedImpulseSummaries returns empty array when nothing loaded

- **WHEN** no impulses are in loaded state
- **THEN** `getLoadedImpulseSummaries()` returns `[]` (not null or undefined)

---

### R9: MiniBob SHOULD populate pointer_state_space from discovery-vessel query

When MiniBob calls `POST /v2/activities/recommend` and vessel discovery is configured, it SHOULD include `pointer_state_space` populated from `VesselDiscoveryClient.getAllRegisteredShapes()`. The result SHOULD be cached for the session (at most 4-minute TTL) to avoid redundant discovery queries on each recommend call. When discovery is not configured or unavailable, `pointer_state_space` SHALL be omitted from the recommend request (equivalent to empty).

#### Scenario: getAllRegisteredShapes returns shapes from registered vessels

- **WHEN** concept-db is registered with discovery-vessel advertising the `concept` shape
- **THEN** `getAllRegisteredShapes()` returns an entry with `shape: "concept"` and `vessel_id` matching the registered concept-db vessel

#### Scenario: getAllRegisteredShapes returns empty array when discovery unavailable

- **WHEN** discovery-vessel is unreachable or discovery is not configured
- **THEN** `getAllRegisteredShapes()` returns `[]` without throwing; the recommend call proceeds with no pointer_state_space

#### Scenario: getAllRegisteredShapes result is cached within session

- **WHEN** `getAllRegisteredShapes()` is called twice within 4 minutes
- **THEN** the second call returns the cached result without issuing a new HTTP request to discovery-vessel

---

## Scenarios (End-to-End)

### S1: Empty state spaces — existing ranking unchanged

- **GIVEN** a recommend request with no `impulse_state_space` and no `pointer_state_space`
- **WHEN** `POST /v2/activities/recommend` is called with `goal: "fix auth bug"`
- **THEN** the response contains `templates` ordered by Thompson α/(α+β), with no `pointer_recommendations` or `blocking_shapes` fields

### S2: All required shapes present — templates ranked purely by Thompson

- **GIVEN** `impulse_state_space: [{ shape: "jwt_claims" }, { shape: "source_code" }]`
- **AND** all top-5 templates declare `input_shapes` that are subsets of `["jwt_claims", "source_code"]`
- **WHEN** `POST /v2/activities/recommend` is called
- **THEN** `blocking_shapes` is an empty array; template order is identical to pure Thompson ranking; no compatibility discounts applied

### S3: One key shape missing from impulse_state_space but in pointer_state_space

- **GIVEN** `impulse_state_space: []` and `pointer_state_space: [{ shape: "concept", vessel_id: "concept-db", resolve_tier: "deterministic" }]`
- **AND** the top-3 templates by Thompson score all declare `input_shapes: ["concept"]`
- **WHEN** `POST /v2/activities/recommend` is called
- **THEN** `pointer_recommendations` contains an entry for `"concept"` with `expected_utility > 0`; the three templates appear in `unlocks_template_ids`; `blocking_shapes` contains an entry for `"concept"` with `in_pointer_state_space: true` and `resolve_via.vessel_id: "concept-db"`

### S4: Key shape missing from both spaces

- **GIVEN** `impulse_state_space: []` and `pointer_state_space: []` (or no vessels advertising the needed shape)
- **AND** the top-1 template declares `input_shapes: ["activityExecutionTrace"]`
- **WHEN** `POST /v2/activities/recommend` is called with `impulse_state_space` and `pointer_state_space` both present
- **THEN** `blocking_shapes` contains an entry for `"activityExecutionTrace"` with `in_pointer_state_space: false`; `pointer_recommendations` is empty (no shape available to recommend)

### S5: concept-db shape available — concept templates compatibility-discounted

- **GIVEN** `impulse_state_space: [{ shape: "source_code" }]`
- **AND** `pointer_state_space: [{ shape: "concept", vessel_id: "concept-db", resolve_tier: "deterministic" }]`
- **AND** template A has `input_shapes: ["source_code"]` and Thompson score 0.75
- **AND** template B has `input_shapes: ["concept"]` and Thompson score 0.80
- **WHEN** `POST /v2/activities/recommend` is called
- **THEN** template A appears before template B in `templates` (0.75 fully covered > 0.80 × 0.7 = 0.56 discounted); `pointer_recommendations` includes `"concept"` with `resolve_via.vessel_id: "concept-db"` because it would unlock template B; `blocking_shapes` includes `"concept"` with `in_pointer_state_space: true`
