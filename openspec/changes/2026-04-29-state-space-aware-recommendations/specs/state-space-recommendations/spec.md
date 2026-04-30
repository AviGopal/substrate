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

### R2: `pointer_state_space` MUST be derived server-side from `ExecutionScope`

`POST /v2/activities/recommend` MUST derive `pointer_state_space` server-side from the executor's `ExecutionScope` (parsed from the inbound key's validated scopes via identity-vessel). `pointer_state_space` MUST NOT be accepted from the request body. Any `pointer_state_space` field present in the request body SHALL be ignored (treated as an unknown field).

The server builds `pointer_state_space` by querying discovery-vessel with the executor's `accessible_account_ids` from `ExecutionScope`. If discovery-vessel is unreachable, the server SHALL proceed with an empty `pointer_state_space` (graceful degradation: `pointer_recommendations` will be empty).

#### Scenario: pointer_state_space is derived from validated key scopes

- **GIVEN** the executor's API key carries scopes `["account_X:templates:execute", "account_Y:templates:read"]`
- **WHEN** `POST /v2/activities/recommend` is called (with no `pointer_state_space` in the request body)
- **THEN** the server queries discovery-vessel with `accessible_account_ids: ["X", "Y"]` and uses the result as `pointer_state_space`; the response includes `pointer_recommendations` derived from this server-built state

#### Scenario: pointer_state_space in request body is ignored

- **WHEN** the request body contains a `pointer_state_space` field
- **THEN** the server ignores it; `pointer_state_space` is still derived server-side from `ExecutionScope`

#### Scenario: discovery-vessel unreachable yields empty pointer_recommendations

- **WHEN** `POST /v2/activities/recommend` is called and discovery-vessel is unreachable
- **THEN** the server proceeds with empty `pointer_state_space`; `pointer_recommendations` is an empty array; no error is returned to the caller

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

### R6.1: `blocking_shapes` entries MUST include a `gap_type` field

Each entry in `blocking_shapes` MUST include a `gap_type` field with one of the following values:

- `resolvable` — a template producing this shape exists and is accessible within the executor's current key scopes; the shape simply has not been loaded yet
- `escalatable` — no template in the executor's current key scopes produces this shape, but `create-shape-provider-goal` goal-seeking can create one within the current budget envelope
- `scope_upgradeable` — a template producing this shape exists in a reachable account but requires a federation link upgrade to access; this is a human-actionable resolution (surface to workbench), NOT a system-actionable one
- `budget_blocked` — goal-seeking to produce this shape is possible but the estimated cost exceeds the executor's current budget envelope
- `capability_blocked` — no combination of scope grants, federation links, or goal-seeking can produce this shape because the required tools or data do not exist anywhere in the system

`blocking_shapes` is informational, not terminal. Except for `capability_blocked`, every gap_type has a resolution path. The executor SHOULD proceed with escalation (for `escalatable`) or surface to human (for `scope_upgradeable`) rather than treating the gap as a hard failure.

#### Scenario: scope_upgradeable gap type surfaces to workbench

- **GIVEN** shape `"private_config"` is required by the top-1 template
- **AND** a template producing `"private_config"` exists in Account X but the executor's key does not include Account X's scope
- **WHEN** `POST /v2/activities/recommend` is called with `impulse_state_space` not containing `"private_config"`
- **THEN** `blocking_shapes` contains an entry for `"private_config"` with `gap_type: "scope_upgradeable"`
- **AND** the workbench SHOULD display a "federation link upgrade needed" prompt rather than triggering automatic escalation

#### Scenario: escalatable gap type allows goal-seeking

- **GIVEN** shape `"custom_report"` is required by the top-2 template
- **AND** no registered vessel produces `"custom_report"` (gap_type would be escalatable, not resolvable)
- **WHEN** `POST /v2/activities/recommend` is called with `impulse_state_space` not containing `"custom_report"`
- **THEN** `blocking_shapes` contains an entry for `"custom_report"` with `gap_type: "escalatable"`
- **AND** the executor MAY trigger `create-shape-provider-goal` for `"custom_report"` without surfacing to human first

#### Scenario: capability_blocked is the only truly terminal gap type

- **GIVEN** shape `"quantum_state"` is required by the top-1 template
- **AND** no registered vessel produces `"quantum_state"` AND goal-seeking cannot produce it (no tools exist in the system)
- **WHEN** `POST /v2/activities/recommend` is called with `impulse_state_space` not containing `"quantum_state"`
- **THEN** `blocking_shapes` contains an entry for `"quantum_state"` with `gap_type: "capability_blocked"`
- **AND** the executor MUST NOT trigger `create-shape-provider-goal` for this shape (goal-seeking would also fail)

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

When MiniBob calls `POST /v2/activities/recommend`, it SHOULD include `impulse_state_space` populated from `ImpulseStore.getLoadedImpulseSummaries()` — the set of impulses currently in `loaded: true` state. The method SHALL be pure (no I/O) and complete in under 1ms for a pool of up to 50 impulses. MiniBob MUST NOT pass `pointer_state_space` in the request body — that is derived server-side by activity-api from `ExecutionScope`.

#### Scenario: ImpulseStore.getLoadedImpulseSummaries returns loaded impulses only

- **WHEN** the impulse store contains two loaded impulses and one unloaded impulse
- **THEN** `getLoadedImpulseSummaries()` returns exactly two entries

#### Scenario: ImpulseStore.getLoadedImpulseSummaries returns empty array when nothing loaded

- **WHEN** no impulses are in loaded state
- **THEN** `getLoadedImpulseSummaries()` returns `[]` (not null or undefined)

#### Scenario: MiniBob recommend call includes impulse_state_space only

- **WHEN** MiniBob's goal processor calls `callRecommend()`
- **THEN** the request body contains `impulse_state_space` (loaded impulses) but NOT `pointer_state_space`; the server derives pointer_state_space from the validated key's `ExecutionScope`

---

### R10: Auth middleware MUST extract ExecutionScope from every validated key

The activity-api auth middleware MUST extract an `ExecutionScope` from every validated key's scope claims. `ExecutionScope` MUST include: `primary_account_id` (the issuing account), `accessible_account_ids` (all account_ids present in any scope claim, deduplicated), and `scopes` (full raw scope array). `ExecutionScope` MUST be available on the request context for all handlers without a second identity-vessel roundtrip.

#### Scenario: ExecutionScope available on context after key validation

- **WHEN** a request presents a valid API key and identity-vessel validation succeeds
- **THEN** `getExecutionScopeFromContext(c)` returns a populated `ExecutionScope` with at minimum `primary_account_id` matching the key's `account_id`

#### Scenario: Cross-account scopes populate accessible_account_ids

- **GIVEN** a key with scopes `["account_A:templates:execute", "account_B:templates:read"]`
- **WHEN** the key is validated and `ExecutionScope` is parsed
- **THEN** `accessible_account_ids` contains both `"A"` and `"B"`

---

### R11: Identity-vessel MUST return scopes in key validation response

Identity-vessel `POST /v1/keys/validate` MUST return `scopes: string[]` alongside existing fields (`valid`, `account_id`, `key_id`). The `scopes` array MUST include all scope strings embedded in the key at issuance, including cross-account grants from active federation links. Scope strings MUST follow the format `account_<id>:<resource>:<role>` or `account_<id>:*`.

#### Scenario: Key validation response includes scopes array

- **WHEN** `POST /v1/keys/validate` is called with a valid API key
- **THEN** the response body includes a `scopes` array; if the key has no cross-account grants, `scopes` contains at least the issuing account's own scope strings

#### Scenario: Federation link grants appear in scopes

- **GIVEN** a key issued for Account Y that includes a federation grant from Account X (`account_X:templates:execute`)
- **WHEN** `POST /v1/keys/validate` is called with that key
- **THEN** `scopes` includes `"account_X:templates:execute"` alongside Account Y's own scopes

---

## Scenarios (End-to-End)

### S1: No impulse_state_space — existing ranking unchanged

- **GIVEN** a recommend request with no `impulse_state_space`
- **WHEN** `POST /v2/activities/recommend` is called with `goal: "fix auth bug"`
- **THEN** the response contains `templates` ordered by Thompson α/(α+β), with no `pointer_recommendations` or `blocking_shapes` fields

### S2: All required shapes present — templates ranked purely by Thompson

- **GIVEN** the executor's key carries scopes for account A only
- **AND** `impulse_state_space: [{ shape: "jwt_claims" }, { shape: "source_code" }]`
- **AND** all top-5 templates declare `input_shapes` that are subsets of `["jwt_claims", "source_code"]`
- **WHEN** `POST /v2/activities/recommend` is called
- **THEN** `blocking_shapes` is an empty array; template order is identical to pure Thompson ranking; no compatibility discounts applied; the server-derived `pointer_state_space` (from discovery-vessel, scoped to account A) is used internally but does not affect ranking since all required shapes are covered

### S3: One key shape missing from impulse_state_space but in server-derived pointer_state_space

- **GIVEN** the executor's key carries scopes for account A; discovery-vessel has concept-db registered (account A scope) advertising the `concept` shape
- **AND** `impulse_state_space: []` (nothing loaded)
- **AND** the top-3 templates by Thompson score all declare `input_shapes: ["concept"]`
- **WHEN** `POST /v2/activities/recommend` is called
- **THEN** the server derives `pointer_state_space` containing `{ shape: "concept", vessel_id: "concept-db", resolve_tier: "deterministic" }`; `pointer_recommendations` contains an entry for `"concept"` with `expected_utility > 0`; the three templates appear in `unlocks_template_ids`; `blocking_shapes` contains an entry for `"concept"` with `in_pointer_state_space: true` and `resolve_via.vessel_id: "concept-db"`

### S4: Key shape missing from both impulse_state_space and server-derived pointer_state_space

- **GIVEN** the executor's key carries scopes for account A; no vessel registered with discovery-vessel (account A scope) advertises the `activityExecutionTrace` shape
- **AND** `impulse_state_space: []`
- **AND** the top-1 template declares `input_shapes: ["activityExecutionTrace"]`
- **WHEN** `POST /v2/activities/recommend` is called with `impulse_state_space` present
- **THEN** `blocking_shapes` contains an entry for `"activityExecutionTrace"` with `in_pointer_state_space: false`; `pointer_recommendations` is empty (no shape available to recommend in the server-derived pointer state space)

### S5: concept-db shape available (server-derived) — concept templates compatibility-discounted

- **GIVEN** the executor's key carries scopes for account A; concept-db is registered with discovery-vessel (account A scope) advertising the `concept` shape
- **AND** `impulse_state_space: [{ shape: "source_code" }]`
- **AND** template A has `input_shapes: ["source_code"]` and Thompson score 0.75
- **AND** template B has `input_shapes: ["concept"]` and Thompson score 0.80
- **WHEN** `POST /v2/activities/recommend` is called
- **THEN** the server derives `pointer_state_space` containing `{ shape: "concept", vessel_id: "concept-db", resolve_tier: "deterministic" }`; template A appears before template B in `templates` (0.75 fully covered > 0.80 × 0.7 = 0.56 discounted); `pointer_recommendations` includes `"concept"` with `resolve_via.vessel_id: "concept-db"` because it would unlock template B; `blocking_shapes` includes `"concept"` with `in_pointer_state_space: true`

### S6: blocking_shapes is informational — executor continues with escalation

- **GIVEN** `impulse_state_space: []` and the top-3 templates all require shape `"activityExecutionTrace"`
- **AND** no registered vessel (within the executor's key scopes) produces `"activityExecutionTrace"`
- **WHEN** `POST /v2/activities/recommend` is called
- **THEN** the response includes `blocking_shapes: [{ shape: "activityExecutionTrace", gap_type: "escalatable", required_by_template_ids: [...] }]`
- **AND** the response ALSO includes `templates: [...]` with the blocked templates listed at lower rank (compatibility discount applied)
- **AND** the executor is expected to trigger `create-shape-provider-goal` for `"activityExecutionTrace"` and retry the recommend call after the shape is produced
- **AND** no error code is returned; the blocking is informational only
