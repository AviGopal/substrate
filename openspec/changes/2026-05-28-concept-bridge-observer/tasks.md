## 1. Part A — concept-bridge-observer (S1 baseline) [LANDED 2026-05-28]

- [x] 1.1 Add `CONCEPT_DB_ENDPOINT` to `repos/development-vessel/src/config.ts` (defaults to `http://127.0.0.1:8260`, env-overridable).
- [x] 1.2 Create `repos/development-vessel/src/observers/concept-bridge-observer.ts` with the same WS subscribe / reconnect pattern as `registry-change-observer.ts`. Filter: `event.type === "task.completed"` AND `event.data?.source === "vessel_daemon_resolve"`. For each `impulse_resolutions[]` entry whose `shape` is in the literal `BRIDGEABLE_SHAPES` set (problem_detection, code_annotation, cpg_query_result, source_code, code_quality, error_log), fire-and-forget call to `POST {CONCEPT_DB_ENDPOINT}/concepts/upsert-by-signature` with `{pointer_type: shape, shape}`, then `POST /concepts/:id/usage` with `{trace_id, outcome, latency_ms, resolver_id, vessel_id, source}`.
- [x] 1.3 Wire `startConceptBridgeObserver()` in `repos/development-vessel/src/index.ts` after `startRegistryChangeObserver()`.
- [x] 1.4 `bun run typecheck` clean.
- [x] 1.5 Sync into substrate-live via `docker cp` and `systemctl restart development-vessel.service`. Verify `[concept-bridge] connected to ws://127.0.0.1:8080/ws` logs.
- [x] 1.6 Trigger MCP → analysis-vessel `get_problems`; confirm bridge fires (`[concept-bridge] usage record failed for problem_detection: …`). The "fires" criterion is the WS event observed AND the HTTP dispatch attempted. The dispatch returning a concept-db side error proves the wiring is correct on the bridge side.

## 2. Part A — concept-db SurrealDB auth blocker

This is **not introduced by this change** but blocks end-to-end verification. Tracked here only as the gating dependency.

- [ ] 2.1 Investigate `repos/concept-db/src/db/surreal.ts:43-51` — `db.signin({username, password})` against SurrealDB 2.x. Confirm whether the call resolves to root scope or namespace scope.
- [ ] 2.2 If signin shape needs to change to `{namespace, database, username, password}` or to a `DEFINE ACCESS root TYPE JWT` issuance: pick one and apply.
- [ ] 2.3 Verify by repeating step 1.6 — bridge dispatches now return `{id, created}` and concept-db's SurrealDB table shows the new concept and usage row.
- [ ] 2.4 With the fix in place, confirm a single MCP `get_problems` call produces exactly one bridgeable shape per resolution and one usage row per resolution.
- [ ] 2.5 Verify concept-db `journalctl` shows no other write paths regressing (apply-schema runs at boot; other resolvers like `concept-link` writes from upkeep activities should also succeed).

## 3. Part B — substrate-authored sibling adapter (S2 deferral)

All gated on `2026-05-27-neutral-emitter-lifecycle-bus` shipping. None of these are done.

- [ ] 3.1 Land `2026-05-27-neutral-emitter-lifecycle-bus` per its tasks 1.1–4.6. This is the prerequisite that puts `lifecycle.gap.classified` (and substrateGap-derived events) on activity-api `/ws`.
- [ ] 3.2 Add a `substrateGap_write` consumer in dev-vessel: extend `registry-change-observer.ts` (or split into `substrate-gap-observer.ts`) to subscribe to `lifecycle.substrate_gap.recorded` events, look up the gap via `substrateGap` resolver, and dispatch `harness-run-matrix` against a synthetic scenario assembled from the gap. This requires a new `lifecycle.substrate_gap.recorded` event emitted by `resolveSubstrateGapWrite` at the time the gap is durably stored.
- [ ] 3.3 Expand `draft-gap-closing-activity`'s LLM palette in `repos/development-vessel/src/seed/draft-gap-closing-activity.ts:14-15` to include `concept_create_write`, `conceptLink_write`, `conceptUsage_write`, `conceptSequence_write`. Update the prompt to document them.
- [ ] 3.4 Synthetic-scenario probe: file the concept-bridge gap (the same one filed today as `gap-concept-adapter-1779962626`) and verify that the boredom-vessel goal[7] dispatch picks it up, drafts a template referencing the newly-permitted concept-db resolvers, writes the proposal JSON, and registers the variant via `activity_create_variant`. Acceptance: the autonomously-authored template's `tasks[]` contains at least one `concept_create_write` resolver call AND the variant is registered in activity-api's template list.
- [ ] 3.5 Run side-by-side comparison: with both the hand-authored Part A observer and the substrate-authored Part B activity active, confirm the substrate-authored variant gets selected by Thompson sampling within 7 days of executions. Acceptance: at least one execution trace shows the Part B variant as `selected_template_id`.

## 4. Cleanup & documentation

- [ ] 4.1 Once Part B is verified end-to-end, mark Part A's observer as deprecated in code (`@deprecated` JSDoc) and stop starting it in `src/index.ts`. Keep the file for one release as a reference.
- [ ] 4.2 Update `repos/development-vessel/CLAUDE.md` "Activities live in activity-api, not source" section to cite the Part B activity id as the canonical concept-bridge.
- [ ] 4.3 Close `finding_2026_05_28_substrate_gap_consumer_unwired` and `finding_2026_05_28_concept_db_root_signin_blocked` memory notes if they are no longer load-bearing.
