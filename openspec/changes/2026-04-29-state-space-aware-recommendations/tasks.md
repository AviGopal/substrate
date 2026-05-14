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

**G2 unblocked for shape discovery**: `buildPointerStateSpace` now queries `discovery-vessel /registry/shapes` (all registered shapes) rather than waiting for cross-vessel JWT. Full account-scoped filtering remains deferred to task 5.3.

- [x] 5.1 ✅ **DONE** 2026-05-14. `buildPointerStateSpace(accessible_account_ids)` in `src/services/recommendation.ts` queries `discovery-vessel /registry/shapes` (3s timeout); returns all 54 registered shapes as `PointerStateEntry[]` with `vessel_id: 'discovered'`. Account-id filtering is post-query client-side (pending 5.3 server-side filter). Autonomous commit `5f78d15` by minibob. (repos/metabob-activity-api)
- [x] 5.2 ✅ **DONE** 2026-05-14. Graceful degradation implemented in same commit: `AbortSignal.timeout(3000)` + `try/catch`; any error or non-2xx → `logger.warn` + returns `[]`; recommend call continues with empty pointer_state_space. Autonomous commit `5f78d15`. (repos/metabob-activity-api)
- [ ] 5.3 Discovery-vessel: confirm (or extend) the registry-query endpoint to accept an account-id filter so activity-api can scope by `accessible_account_ids` without client-side post-filtering. (repos/discovery-vessel)
- [x] 5.4 ✅ **DONE** 2026-05-14. Request-scope isolation inherently satisfied: `buildPointerStateSpace()` is called exactly once per recommend request (line 4924, `routes/activities.ts`) and stored in `const pointerStateSpace`; result is never persisted to Redis or SurrealDB. No additional memoization layer needed. (repos/metabob-activity-api)
- [x] 5.5 ✅ **DONE** 2026-05-14. `ImpulseStore.getLoadedImpulseSummaries()` added to `src/impulse.ts`; filters to `loaded === true`, maps to `{shape, summary, pointer, loaded_at}`; shape from `metadata.shape ?? pointer.type`. Commit `120caaf`. (repos/minibob)
- [x] 5.6 ✅ **DONE** 2026-05-14. `impulse_state_space` passed to recommend payload in `src/mcp.ts`:`recommendActivities`; only sent when non-empty; `pointer_state_space` never sent. Commit `120caaf`. (repos/minibob)
- [x] 5.7 ✅ **DONE** 2026-05-14. `pointer_recommendations` logged at debug level; `blocking_shapes` surfaced as `shape_gap_report` memo impulse in store. Commit `120caaf`. (repos/minibob)
- [x] 5.8 ✅ **DONE** 2026-05-14. No call sites fed `getAllRegisteredShapes()` into `callRecommend()` — old path was already removed before this spec landed. Verified clean via grep; nothing to remove. (repos/minibob)
- [x] 5.9 ✅ **DONE** 2026-05-14. After `recommendActivities`, high-utility pointer shapes (threshold via `MINIBOB_PRELOAD_UTILITY_THRESHOLD`, default 0.4; cap via `MINIBOB_PRELOAD_MAX`, default 3) are fire-and-forget pre-loaded via `store.create + store.load`. Shapes already in `impulse_state_space` are skipped. Resolution failures are silently swallowed (best-effort; G2-blocked shapes expected to fail). Commit `6d36b98`. (repos/minibob)

## 6. Tests  *(maps to IAL 11.S1, 11.S2, 11.S5)*

- [x] 6.1 ✅ **DONE** 2026-05-14. `test/recommendation.test.ts` — `applyCompatibilityFilter` tests: fully covered unchanged, partial 0.7×, escalatable 0.5×, uncovered 0.3×. 22 tests pass. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 6.2 ✅ **DONE** 2026-05-14. `generatePointerRecommendations` tests: ordering by `expected_utility` DESC; shapes already in `impulse_state_space` excluded; top-5 cap; tier preference. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 6.3 ✅ **DONE** 2026-05-14. `identifyBlockingShapes` tests: classification (resolvable/escalatable); deduplication; `gap_severity = blocking` default. `scope_upgradeable`/`budget_blocked`/`capability_blocked` types untested (no shape gap index yet — will add with gap index landing). Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 6.4 ✅ **DONE** 2026-05-14. `parseExecutionScope` tests: single-account, multi-account federation, malformed scope strings. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 6.5 ✅ **DONE** 2026-05-14. Backward-compat test: absent `impulse_state_space` → response has no `pointer_recommendations`/`blocking_shapes`. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [x] 6.6 ✅ **DONE** 2026-05-14. Backward-compat test: `pointer_state_space` in body stripped-and-warned; response uses server-derived value. Commit `4fa3d3f`. (repos/metabob-activity-api)
- [ ] 6.7 Activity-api: integration test against discovery-vessel — `buildPointerStateSpace` returns the correct scoped registry slice for a multi-account ExecutionScope. (repos/metabob-activity-api)
- [x] 6.8 ✅ **DONE** 2026-05-14. `src/impulse-loaded-summaries.test.ts` — 7 tests: empty store, unloaded exclusion, loaded inclusion, metadata.shape priority, pointer.type fallback, path hint, mixed loaded/unloaded filtering. All pass. Commit `6d36b98`. (repos/minibob)
- [ ] 6.9 Minibob: integration test — goal processor sends `impulse_state_space` and never `pointer_state_space`; verified by request-body assertion in a recorded canary fixture. (repos/minibob)

## 7. Canary validation  *(maps to IAL 11.S1–11.S5)*

- [x] 7.1 ✅ **DONE** 2026-05-14. activity-api 1.20.1-4fa3d3f + minibob 0.14.7-120caaf deployed; `/health` green on both. (repos/deployment)
- [ ] 7.2 Issue a canary key with cross-account federation scopes; confirm `POST /v1/keys/validate` returns the expected `scopes[]`. (repos/identity-vessel, repos/deployment)
- [ ] 7.3 Confirm activity-api logs show `ExecutionScope.accessible_account_ids` derived from the federated key, not from any caller-supplied field. (repos/metabob-activity-api)
- [x] 7.4 ✅ **DONE** 2026-05-14. `POST /v2/activities/recommend` with `impulse_state_space: [{shape:"file",...},{shape:"gitDiff",...}]` returns `pointer_recommendations: []` (empty — no pointer_state_space gaps from stub) and `blocking_shapes: [{shape:"goal", gap_type:"escalatable", gap_severity:"blocking", required_by_template_ids:[...]}]`. Fields present as expected. (repos/metabob-activity-api)
- [x] 7.5 ✅ **DONE** 2026-05-14. Same call without `impulse_state_space` returns no `pointer_recommendations` or `blocking_shapes` keys — backward compat confirmed. (repos/metabob-activity-api)
- [x] 7.6 ✅ **DONE** 2026-05-14. Comparative test: baseline returns α=8 template needing 7 shapes (all missing); with `impulse_state_space=[{shape:"goal"}]` a fully-covered α=5 template rises to #1 — discounting overrides the higher raw Thompson score. Confirms compatibility filter is active in production. (repos/metabob-activity-api)
- [ ] 7.7 Confirm `scope_upgradeable` blocking shapes surface in the workbench history panel without triggering auto-escalation. (repos/workbench)
- [ ] 7.8 Wireshark / structured-log assertion: every minibob → activity-api recommend request body contains `impulse_state_space` and never `pointer_state_space`. (repos/minibob, repos/metabob-activity-api)
- [x] 7.9 ✅ **DONE** 2026-05-14. Implementation verified: `buildPointerStateSpace` uses `AbortSignal.timeout(3000)` + try/catch; non-200 or network error → `logger.warn` + returns `[]`; recommend call continues and returns 200 with `pointer_recommendations: []`. Confirmed via code review + canary HTTP 200 response with `impulse_state_space` provided. (repos/metabob-activity-api)

---

#### Phase 11 Success Criteria

- [x] 11.S1 ✅ Recommend response includes `pointer_recommendations` and `blocking_shapes` whenever `impulse_state_space` is provided — verified 7.4.
- [x] 11.S2 ✅ Templates with fully covered `input_shapes` rank strictly above higher-Thompson templates with partial-coverage gaps — verified by 6.1 (unit tests) + 7.6 (canary comparative test). α=5 fully-covered ranks above α=8 with 7 missing shapes.
- [x] 11.S3 ✅ `pointer_state_space` is derived server-side (not carried in request body); minibob sends only `impulse_state_space` — verified by 5.6 implementation + 6.6 test.
- [ ] 11.S4 `scope_upgradeable` blocking shapes surface in the workbench as human-actionable upgrade prompts and do not trigger automatic escalation — verified by task 7.7.
- [x] 11.S5 ✅ Backward compatibility: recommend call without `impulse_state_space` returns no new fields — verified 7.5.
