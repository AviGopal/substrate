# Tasks: State-Space-Aware Template and Pointer Recommendations

**Change ID**: `2026-04-29-state-space-aware-recommendations`
**Umbrella**: Phase 11 of `2026-04-26-impulse-activity-loop`
**Gate dependency (G2)**: Cross-vessel pointer queries depend on the vessel-session handshake landing first — see `2026-04-29-vessel-session-handshake`.

Items in this file refine the placeholder entries IAL §11.1–§11.13 and §11.S1–§11.S5. The mapping back to those placeholders is recorded inline beside each section header.

---

## 1. Schema additions  *(maps to IAL 11.1–11.4)*

- [ ] 1.1 Identity-vessel: extend `POST /v1/keys/validate` response payload to include `scopes: string[]` carrying every scope string embedded in the key at issuance time, including cross-account federation grants. Format: `account_<id>:<resource>:<role>` or `account_<id>:*`. (repos/identity-vessel)
- [ ] 1.2 Identity-vessel: update the OpenAPI / type exports for the validation response so downstream vessels pick up the `scopes` field through their generated clients. (repos/identity-vessel)
- [ ] 1.3 Activity-api: add `ExecutionScope` interface (`primary_account_id`, `accessible_account_ids`, `scopes`, `grants: Map<string,string[]>`) in a shared types module. (repos/metabob-activity-api)
- [ ] 1.4 Activity-api: extend the Zod (or equivalent) request schema for `POST /v2/activities/recommend` with an optional `impulse_state_space` array; explicitly reject `pointer_state_space` if present in the body (or strip-and-warn) so the field cannot regress to caller-provided. (repos/metabob-activity-api)
- [ ] 1.5 Activity-api: extend the response schema with optional `pointer_recommendations[]` and `blocking_shapes[]` — additive only, never removing or renaming existing fields. (repos/metabob-activity-api)

## 2. Recommend endpoint extension  *(maps to IAL 11.2, 11.5, 11.6)*

- [ ] 2.1 Activity-api: implement `parseExecutionScope(validationResponse)` in `src/middleware/jwtAuth.ts` per design §5; deduplicate `accessible_account_ids` and populate the `grants` map keyed by parsed `account_<id>:` prefix. (repos/metabob-activity-api)
- [ ] 2.2 Activity-api: attach the parsed scope to the Hono context with `c.set('executionScope', ...)` after every successful key validation; add a `getExecutionScopeFromContext(c)` helper alongside the existing `getJwtAuthFromContext(c)`. (repos/metabob-activity-api)
- [ ] 2.3 Activity-api: in the `POST /v2/activities/recommend` handler, parse the optional `impulse_state_space` from the request body (treat absent as `undefined`, not an error). (repos/metabob-activity-api)
- [ ] 2.4 Activity-api: in the recommend handler, read `ExecutionScope` from context and call `buildPointerStateSpace(scope.accessible_account_ids)` to derive the pointer state space server-side. (repos/metabob-activity-api)
- [ ] 2.5 Activity-api: implement `applyCompatibilityFilter(templates, impulse_state_space, pointer_state_space)` as a pure function in `src/services/recommendation.ts`; preserve raw `alpha`/`beta` on returned templates and only adjust ranking order. (repos/metabob-activity-api)
- [ ] 2.6 Activity-api: surface the discount factors as env vars (`RECOMMEND_PARTIAL_COVERAGE_DISCOUNT` default `0.7`, `RECOMMEND_ESCALATABLE_DISCOUNT` default `0.5`, `RECOMMEND_NO_COVERAGE_DISCOUNT` default `0.3`) so they are tunable without a code change. (repos/metabob-activity-api)
- [ ] 2.7 Activity-api: treat templates with no declared `input_shapes` as fully covered (no discount); document this as the conservative legacy default in the handler. (repos/metabob-activity-api)

## 3. Pointer-recommendation ranking  *(maps to IAL 11.7)*

- [ ] 3.1 Activity-api: implement `generatePointerRecommendations(pointer_state_space, impulse_state_space, top20Templates)` per design §4 step 2; pure, no I/O, returns up to 5 entries ordered by `expected_utility` DESC. (repos/metabob-activity-api)
- [ ] 3.2 Activity-api: when computing utility, apply uniform prior `alpha=1, beta=1` (utility 0.5) for templates with no recorded executions, then normalise across the full candidate set by max raw utility; if all utilities are zero return zero across the board. (repos/metabob-activity-api)
- [ ] 3.3 Activity-api: when multiple vessels advertise the same shape, prefer `resolve_tier: 'deterministic'` over `pattern` over `llm` for the `resolve_via` field. (repos/metabob-activity-api)
- [ ] 3.4 Activity-api: populate `rationale` as `"unlocks N template(s) in top-20; highest-ranked: <template name>"`; ensure deterministic ordering when ties occur. (repos/metabob-activity-api)
- [ ] 3.5 Activity-api: implement best-effort `pointer_hint` population by looking up `impulse_resolutions` for the top-unlocked template's most recent successful trace; gate behind a feature flag (`RECOMMEND_POINTER_HINT_ENABLED`, default off) until latency is measured. (repos/metabob-activity-api)
- [ ] 3.6 Activity-api: skip the entire pointer-recommendation step (and omit the field from the response) when `impulse_state_space` is absent — backward compatibility per design §7. (repos/metabob-activity-api)

## 4. Blocking-shape detection  *(maps to IAL 11.8, 11.9)*

- [ ] 4.1 Activity-api: implement `identifyBlockingShapes(top5Templates, impulse_state_space, pointer_state_space)` per design §4 step 3; pure, no I/O. (repos/metabob-activity-api)
- [ ] 4.2 Activity-api: classify each missing shape into `gap_type`: `resolvable | escalatable | scope_upgradeable | budget_blocked | capability_blocked` using the shape gap index for `scope_upgrade_needed` and prior `goal_created` cost entries. (repos/metabob-activity-api)
- [ ] 4.3 Activity-api: deduplicate blocking-shape entries — one entry per shape with `required_by_template_ids` listing every top-5 template that needs it. (repos/metabob-activity-api)
- [ ] 4.4 Activity-api: default `gap_severity` to `blocking` for every declared `input_shape` until the template schema gains `optional_input_shapes`; emit `optional` only when the per-task fallback path can be inferred. (repos/metabob-activity-api)
- [ ] 4.5 Activity-api: emit `resolve_via` only when `gap_type === 'resolvable'`; never on escalatable/scope_upgradeable/blocked entries. (repos/metabob-activity-api)
- [ ] 4.6 Activity-api: extend the public API docs to flag that `blocking_shapes` is informational, not terminal — escalatable advances via `create-shape-provider-goal`, scope_upgradeable surfaces to the workbench, only `budget_blocked` and `capability_blocked` are genuinely terminal. (repos/metabob-activity-api)

## 5. Cross-vessel pointer queries  *(maps to IAL 11.5; gate G2)*

**BLOCKED-ON**: `2026-04-29-vessel-session-handshake` — the cross-vessel discovery query must travel under the new handshake before this section can land.

- [ ] 5.1 Activity-api: implement `buildPointerStateSpace(accessible_account_ids)` in `src/services/recommendation.ts`; query discovery-vessel for all registered shapes filtered to the supplied account list. (repos/metabob-activity-api)
- [ ] 5.2 Activity-api: implement graceful degradation — when discovery-vessel is unreachable or returns 5xx, return an empty pointer state space and continue the recommendation call with `pointer_recommendations: []`. (repos/metabob-activity-api)
- [ ] 5.3 Discovery-vessel: confirm (or extend) the registry-query endpoint to accept an account-id filter so activity-api can scope by `accessible_account_ids` without client-side post-filtering. (repos/discovery-vessel)
- [ ] 5.4 Activity-api: cache the per-(account-set) pointer state space at request scope only — never persist; the registry is authoritative. (repos/metabob-activity-api)
- [ ] 5.5 Minibob: add `ImpulseStore.getLoadedImpulseSummaries()` returning `Array<{shape, summary?, pointer?, loaded_at?}>` filtered to `loaded: true` impulses; pure, no I/O. (repos/minibob)
- [ ] 5.6 Minibob: in `src/goal-processor.ts`, pass `impulse_state_space` (only) to `callRecommend()`; explicitly do NOT pass `pointer_state_space` — server derives it from `ExecutionScope`. (repos/minibob)
- [ ] 5.7 Minibob: log `pointer_recommendations` at debug level; surface `blocking_shapes` as a `shape_gap_report` memo impulse in the goal-processing pool. (repos/minibob)
- [ ] 5.8 Minibob: leave `VesselDiscoveryClient.getAllRegisteredShapes()` in place for local resolver routing but remove all call sites that fed it into `callRecommend()`. (repos/minibob)
- [ ] 5.9 Minibob: optional pre-loading — for each high-utility entry in `pointer_recommendations`, route through `callVesselResolve({ shape, vessel_id })` using the existing discovery path; loop until recommendations are empty or the impulse budget is exhausted. (repos/minibob)

## 6. Tests  *(maps to IAL 11.S1, 11.S2, 11.S5)*

- [ ] 6.1 Activity-api: unit test `applyCompatibilityFilter` — fully covered template scores unchanged, partial = 0.7×, escalatable = 0.5×, uncovered = 0.3×. (repos/metabob-activity-api)
- [ ] 6.2 Activity-api: unit test `generatePointerRecommendations` — ordering by `expected_utility` DESC; shapes already in `impulse_state_space` excluded; top-5 cap respected; deterministic `resolve_via` tier preference. (repos/metabob-activity-api)
- [ ] 6.3 Activity-api: unit test `identifyBlockingShapes` — classification into all five `gap_type` values; deduplication across templates; default `gap_severity = blocking`. (repos/metabob-activity-api)
- [ ] 6.4 Activity-api: unit test `parseExecutionScope` — single-account, multi-account federation, malformed scope strings handled gracefully. (repos/metabob-activity-api)
- [ ] 6.5 Activity-api: backward-compatibility test — recommend call without `impulse_state_space` produces a byte-identical response to the pre-Phase-11 fixture. (repos/metabob-activity-api)
- [ ] 6.6 Activity-api: backward-compatibility test — recommend call where the request body smuggles `pointer_state_space` ignores the field; response still uses the server-derived value. (repos/metabob-activity-api)
- [ ] 6.7 Activity-api: integration test against discovery-vessel — `buildPointerStateSpace` returns the correct scoped registry slice for a multi-account ExecutionScope. (repos/metabob-activity-api)
- [ ] 6.8 Minibob: unit test `ImpulseStore.getLoadedImpulseSummaries()` — only `loaded: true` impulses returned; summary/pointer/loaded_at populated when present. (repos/minibob)
- [ ] 6.9 Minibob: integration test — goal processor sends `impulse_state_space` and never `pointer_state_space`; verified by request-body assertion in a recorded canary fixture. (repos/minibob)

## 7. Canary validation  *(maps to IAL 11.S1–11.S5)*

- [ ] 7.1 Deploy activity-api + identity-vessel + minibob to canary; verify `/health` green across all three. (repos/deployment)
- [ ] 7.2 Issue a canary key with cross-account federation scopes; confirm `POST /v1/keys/validate` returns the expected `scopes[]`. (repos/identity-vessel, repos/deployment)
- [ ] 7.3 Confirm activity-api logs show `ExecutionScope.accessible_account_ids` derived from the federated key, not from any caller-supplied field. (repos/metabob-activity-api)
- [ ] 7.4 Run a recommend call with `impulse_state_space` populated; confirm response includes `pointer_recommendations` and `blocking_shapes`. (repos/metabob-activity-api)
- [ ] 7.5 Run a recommend call with `impulse_state_space` absent; confirm response is byte-identical to the pre-Phase-11 baseline (no new fields). (repos/metabob-activity-api)
- [ ] 7.6 Confirm a fully covered template ranks above an equal-Thompson template with a partial-coverage gap. (repos/metabob-activity-api)
- [ ] 7.7 Confirm `scope_upgradeable` blocking shapes surface in the workbench history panel without triggering auto-escalation. (repos/workbench)
- [ ] 7.8 Wireshark / structured-log assertion: every minibob → activity-api recommend request body contains `impulse_state_space` and never `pointer_state_space`. (repos/minibob, repos/metabob-activity-api)
- [ ] 7.9 Confirm graceful degradation when discovery-vessel is unavailable: recommend call returns templates with empty `pointer_recommendations` rather than 5xx. (repos/metabob-activity-api)

---

#### Phase 11 Success Criteria

- [ ] 11.S1 Recommend response includes `pointer_recommendations` and `blocking_shapes` whenever `impulse_state_space` is provided in the request — verified by tasks 6.5, 7.4.
- [ ] 11.S2 Templates with fully covered `input_shapes` rank strictly above templates with equal Thompson posterior but a partial-coverage gap — verified by tasks 6.1, 7.6.
- [ ] 11.S3 `pointer_state_space` is derived server-side from `ExecutionScope.accessible_account_ids` (not carried in the request body); verified by request-body inspection (tasks 6.6, 6.9, 7.3, 7.8).
- [ ] 11.S4 `scope_upgradeable` blocking shapes surface in the workbench as human-actionable upgrade prompts and do not trigger automatic escalation — verified by task 7.7.
- [ ] 11.S5 Backward compatibility: a recommend call with no `impulse_state_space` produces a byte-identical response to the pre-Phase-11 implementation — verified by tasks 6.5, 7.5.
