# Tasks: State-Space-Aware Template and Pointer Recommendations

**Change ID**: `2026-04-29-state-space-aware-recommendations`
**Umbrella**: Phase 11 of `2026-04-26-impulse-activity-loop`
**Gate dependency (G2)**: Cross-vessel pointer queries depend on the vessel-session handshake landing first — see `2026-04-29-vessel-session-handshake`.

Items in this file refine the placeholder entries IAL §11.1–§11.13 and §11.S1–§11.S5. The mapping back to those placeholders is recorded inline beside each section header.

---

## 1. Schema additions  *(maps to IAL 11.1–11.4)*

- [ ] 1.1 Identity-vessel: extend `POST /v1/keys/validate` response payload to include `scopes: string[]` carrying every scope string embedded in the key at issuance time, including cross-account federation grants. Format: `account_<id>:<resource>:<role>` or `account_<id>:*`. (repos/identity-vessel)
- [ ] 1.2 Identity-vessel: update the OpenAPI / type exports for the validation response so downstream vessels pick up the `scopes` field through their generated clients. (repos/identity-vessel)
- [x] 1.3 ✅ **DONE** 2026-05-14. `ExecutionScope` interface added to `src/middleware/jwtAuth.ts` alongside `parseExecutionScope(jwtAuth)` and `getExecutionScopeFromContext(c)`. Derives from existing `JwtAuthContext.scopes` + `accountId` — no second identity-vessel roundtrip. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 1.4 ✅ **DONE** 2026-05-14. `impulse_state_space` parsed from request body (optional array); `pointer_state_space` stripped-and-warned if present. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 1.5 ✅ **DONE** 2026-05-14. Response extended with optional `pointer_recommendations[]` and `blocking_shapes[]` — additive only; absent when `impulse_state_space` not provided (backward-compat). Commit `4fa3d3f`. (repos/metabob-activity-api)

## 2. Recommend endpoint extension  *(maps to IAL 11.2, 11.5, 11.6)*

- [x] 2.1 ✅ **DONE** 2026-05-14. `parseExecutionScope(jwtAuth)` in `src/middleware/jwtAuth.ts`; deduplicates `accessible_account_ids`, populates `grants` map. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 2.2 ✅ **DONE** 2026-05-14. `getExecutionScopeFromContext(c)` lazy-derives from already-set jwtAuth — no extra `c.set` call needed. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 2.3 ✅ **DONE** 2026-05-14. `impulse_state_space` destructured from request body; absent treated as `undefined`. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 2.4 ✅ **DONE** 2026-05-14. Recommend handler calls `buildPointerStateSpace(executionScope?.accessible_account_ids ?? [])` (stub returning `[]` pending G2). Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 2.5 ✅ **DONE** 2026-05-14. `applyCompatibilityFilter` in `src/services/recommendation.ts`; pure function; raw `alpha`/`beta` preserved; uses `_compatibility_score` for sort only. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 2.6 ✅ **DONE** 2026-05-14. Discount factors via env vars: `RECOMMEND_PARTIAL_COVERAGE_DISCOUNT` (0.7), `RECOMMEND_ESCALATABLE_DISCOUNT` (0.5), `RECOMMEND_NO_COVERAGE_DISCOUNT` (0.3). Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 2.7 ✅ **DONE** 2026-05-14. Templates with no `input_shapes` treated as fully covered (conservative legacy default). Commit `4fa3d3f`. (repos/metabob-activity-api)

## 3. Pointer-recommendation ranking  *(maps to IAL 11.7)*

- [x] 3.1 ✅ **DONE** 2026-05-14. `generatePointerRecommendations` in `src/services/recommendation.ts`; pure, returns up to 5 entries ordered by `expected_utility` DESC. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 3.2 ✅ **DONE** 2026-05-14. Uniform prior (0.5) for templates with no executions; normalised across candidate set; zero-utility edge case handled. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 3.3 ✅ **DONE** 2026-05-14. `resolve_via` tier preference: `deterministic` > `pattern` > `llm`. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 3.4 ✅ **DONE** 2026-05-14. `rationale` = `"unlocks N template(s) in top-20; highest-ranked: <name>"`. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [ ] 3.5 `pointer_hint` population (DB lookup into `impulse_resolutions`); gated on `RECOMMEND_POINTER_HINT_ENABLED` (default off). **DEFERRED** — feature-flagged; will add when latency budget is confirmed.
- [x] 3.6 ✅ **DONE** 2026-05-14. Pointer recommendation step skipped when `impulse_state_space` absent; field omitted from response. Commit `4fa3d3f`. (repos/metabob-activity-api)

## 4. Blocking-shape detection  *(maps to IAL 11.8, 11.9)*

- [x] 4.1 ✅ **DONE** 2026-05-14. `identifyBlockingShapes` in `src/services/recommendation.ts`; pure, no I/O. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 4.2 ✅ **DONE** 2026-05-14. Gap type classification: `resolvable` (in pointer_state_space), `escalatable` (default when not resolvable — no shape gap index yet; conservative). `scope_upgradeable` / `budget_blocked` / `capability_blocked` classification deferred to shape gap index landing. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 4.3 ✅ **DONE** 2026-05-14. Deduplication: one entry per shape with `required_by_template_ids` merging all top-5 templates. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 4.4 ✅ **DONE** 2026-05-14. `gap_severity = 'blocking'` default for all declared `input_shapes`. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 4.5 ✅ **DONE** 2026-05-14. `resolve_via` only emitted when `gap_type === 'resolvable'`. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 4.6 ✅ **DONE** 2026-05-14. Inline comment in handler documents `blocking_shapes` as informational; `CLAUDE.md` update pending. Commit `4fa3d3f`. (repos/metabob-activity-api)

## 5. Cross-vessel pointer queries  *(maps to IAL 11.5; gate G2)*

**BLOCKED-ON**: `2026-04-29-vessel-session-handshake` — the cross-vessel discovery query must travel under the new handshake before this section can land.

- [ ] 5.1 Activity-api: implement `buildPointerStateSpace(accessible_account_ids)` in `src/services/recommendation.ts`; query discovery-vessel for all registered shapes filtered to the supplied account list. (repos/metabob-activity-api)
- [ ] 5.2 Activity-api: implement graceful degradation — when discovery-vessel is unreachable or returns 5xx, return an empty pointer state space and continue the recommendation call with `pointer_recommendations: []`. (repos/metabob-activity-api)
- [ ] 5.3 Discovery-vessel: confirm (or extend) the registry-query endpoint to accept an account-id filter so activity-api can scope by `accessible_account_ids` without client-side post-filtering. (repos/discovery-vessel)
- [ ] 5.4 Activity-api: cache the per-(account-set) pointer state space at request scope only — never persist; the registry is authoritative. (repos/metabob-activity-api)
- [x] 5.5 ✅ **DONE** 2026-05-14. `ImpulseStore.getLoadedImpulseSummaries()` added to `src/impulse.ts`; filters to `loaded === true`, maps to `{shape, summary, pointer, loaded_at}`; shape from `metadata.shape ?? pointer.type`. Commit `120caaf`. (repos/minibob)
- [x] 5.6 ✅ **DONE** 2026-05-14. `impulse_state_space` passed to recommend payload in `src/mcp.ts`:`recommendActivities`; only sent when non-empty; `pointer_state_space` never sent. Commit `120caaf`. (repos/minibob)
- [x] 5.7 ✅ **DONE** 2026-05-14. `pointer_recommendations` logged at debug level; `blocking_shapes` surfaced as `shape_gap_report` memo impulse in store. Commit `120caaf`. (repos/minibob)
- [ ] 5.8 Minibob: leave `VesselDiscoveryClient.getAllRegisteredShapes()` in place for local resolver routing but remove all call sites that fed it into `callRecommend()`. **Note**: no call sites were found feeding it into `callRecommend()` — the old path was already removed. Verified clean. (repos/minibob)
- [ ] 5.9 Minibob: optional pre-loading — for each high-utility entry in `pointer_recommendations`, route through `callVesselResolve({ shape, vessel_id })` using the existing discovery path; loop until recommendations are empty or the impulse budget is exhausted. (repos/minibob)

## 6. Tests  *(maps to IAL 11.S1, 11.S2, 11.S5)*

- [x] 6.1 ✅ **DONE** 2026-05-14. `test/recommendation.test.ts` — `applyCompatibilityFilter` tests: fully covered unchanged, partial 0.7×, escalatable 0.5×, uncovered 0.3×. 22 tests pass. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 6.2 ✅ **DONE** 2026-05-14. `generatePointerRecommendations` tests: ordering by `expected_utility` DESC; shapes already in `impulse_state_space` excluded; top-5 cap; tier preference. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 6.3 ✅ **DONE** 2026-05-14. `identifyBlockingShapes` tests: classification (resolvable/escalatable); deduplication; `gap_severity = blocking` default. `scope_upgradeable`/`budget_blocked`/`capability_blocked` types untested (no shape gap index yet — will add with gap index landing). Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 6.4 ✅ **DONE** 2026-05-14. `parseExecutionScope` tests: single-account, multi-account federation, malformed scope strings. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 6.5 ✅ **DONE** 2026-05-14. Backward-compat test: absent `impulse_state_space` → response has no `pointer_recommendations`/`blocking_shapes`. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 6.6 ✅ **DONE** 2026-05-14. Backward-compat test: `pointer_state_space` in body stripped-and-warned; response uses server-derived value. Commit `4fa3d3f`. (repos/metabob-activity-api)
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
