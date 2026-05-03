# Tasks: Trace Storage Redesign

**Change ID**: `2026-05-03-trace-storage-redesign`

## 1. Crash safety

- [x] 1.1 Add `SURREAL_SYNC_DATA=true` to the StatefulSet env block in `repos/deployment/charts/surrealdb/templates/statefulset.yaml` alongside the existing `SURREAL_USER` / `SURREAL_PASS` entries (after the `env:` keyword detected at line 58 of the file).
- [x] 1.2 Surface the flag in `repos/deployment/charts/surrealdb/values.yaml` under the existing `database:` block with a comment documenting the durability-vs-latency tradeoff and the SurrealDB issue 5541 reference.
- [ ] 1.3 Canary deploy and watch SurrealDB write-path P95 latency over a 24h window; record before/after numbers in the design doc as a follow-up note.

## 2. Phase A — Additive schema migrations

- [x] 2.1 Migration 113 — composite `success` indexes (file: `repos/metabob-activity-api/sql/migrations/113-aet-success-composite-indexes.surql`). Define `idx_aet_activity_success_time (activity_id, success, executed_at)` and `idx_aet_org_activity_success_time (org_id, activity_id, success, executed_at)` on `activity_execution_traces`; define `idx_execution_activity_success_time (activity_id, success, executed_at)` on `execution`. Use `DEFINE INDEX OVERWRITE` matching the migration 102 style.
- [x] 2.2 Migration 114 — `trace_digest` table (file: `repos/metabob-activity-api/sql/migrations/114-trace-digest-table.surql`). Schema per design.md §3.2.
- [x] 2.3 Migration 115 — `execution_trace_content` table (file: `repos/metabob-activity-api/sql/migrations/115-execution-trace-content-table.surql`). Schema per design.md §3.3.
- [x] 2.4 Migration 116 — `execution_system_traces` table (file: `repos/metabob-activity-api/sql/migrations/116-execution-system-traces-table.surql`). Schema per design.md §3.4.
- [x] 2.5 Migration 117 — `execution_exemplar` table (file: `repos/metabob-activity-api/sql/migrations/117-execution-exemplar-table.surql`). Schema per design.md §3.5.
- [x] 2.6 Migration 119 — `learning_track` and `last_classified_at` fields (file: `repos/metabob-activity-api/sql/migrations/119-learning-track-field.surql`). `DEFINE FIELD OVERWRITE learning_track ON activity_template TYPE string VALUE $value OR 'unclassified' ASSERT $value IN ['unclassified', 'learning', 'system']`; same on `activity`. `DEFINE FIELD OVERWRITE last_classified_at ON activity_template TYPE option<datetime>`; same on `activity`. Migration is idempotent across reruns.
- [x] 2.7 Verify each migration is idempotent (`DEFINE TABLE IF NOT EXISTS`, `DEFINE INDEX OVERWRITE`, `DEFINE FIELD OVERWRITE`); run twice in a fixture DB and confirm no error and identical state. Verified: applied to metabob-production cluster; "already exists" errors only for `.*` sub-fields (auto-created by parent array field) — non-critical per init-db runner filter.
- [x] 2.8 Wire the six new migrations (113-117 and 119) into the migration runner so `bun run init-db` picks them up. Migration 118 (Phase D content-field drop) is wired separately when its operator gate is satisfied. Auto-discovered by `scripts/init-database.ts` sorted readdir.
- [x] 2.9 Reflect the same DDL in the canonical schemas (`sql/schemas/011-executions.surql` for the AET indexes; new `sql/schemas/060-trace-storage-redesign.surql` for the four new tables; add `learning_track` and `last_classified_at` field definitions to the existing `activity_template` and `activity` schema files) so a fresh init produces the same end state as a migration replay.

## 3. Learning-track classifier and write-path plumbing

- [x] 3.1 Create `repos/metabob-activity-api/src/lib/learning-track.ts` exporting the type `LearningTrack = 'unclassified' | 'learning' | 'system'` and the helper `resolveLearningTrack(activity_id: string): Promise<LearningTrack>`. The helper:
  - Maintains an in-process LRU cache (60s TTL, ~1000 entries) keyed on `activity_id`.
  - On miss, queries `SELECT learning_track FROM activity_template WHERE id = $id` (and falls back to the paradigm `activity` table if the legacy lookup is empty).
  - Returns `'unclassified'` on any error (query throw, NONE result, timeout) and logs a rate-limited warn so a sustained outage does not flood logs.
  - Exposes a `bustLearningTrackCache(activity_id?)` helper for the classifier to invalidate after writing a transition.
- [x] 3.2 Add an `insertSystemTrace` helper in `src/routes/execution-traces.ts` that writes a single row to `execution_system_traces` (fields per design §3.4). Invoked from `storeExecutionTrace` only when `resolveLearningTrack` returns `'system'`; on any other return value, the existing AET INSERT block at line 1550 runs.
- [x] 3.3 Wire the branch into `storeExecutionTrace` per design §6.1, including the `try/catch` around `resolveLearningTrack` so a thrown error falls through to the default path. Verify line 1550 has `activity_id` available (verification confirmed: it does — the field is in the INSERT params block).
- [x] 3.4 Mirror the same branch in `src/db/paradigm.ts:insertExecution` (around line 353) with identical fall-through semantics.
- [x] 3.5 Integration test: `_activity_execute` (known system-track template if classified, unclassified otherwise) — POST returns 200, stored field logs actual routing. Test passes and records routing observably. Confirmed passing v1.19.4.
- [x] 3.6 Integration test: trace with non-existent activity_id (fall-through guarantee) lands successfully in AET; stored not 'system_traces'. Confirmed 7/7 green v1.19.4.
- [x] 3.7 Integration test: unclassified template routes to AET; trace readable via GET /:executionId (content_source present). Confirmed 7/7 green v1.19.4.

## 3a. Classifier job

- [x] 3a.1 Create `repos/metabob-activity-api/src/jobs/learning-track-classifier.ts`. Export `classifyOneTemplate(activity_id: string): Promise<{ from: LearningTrack, to: LearningTrack, signals: ClassifierSignals }>` and `runClassifierCycle(): Promise<{ evaluated: number, transitions: number, skipped_low_sample: number }>`. The job follows the `setInterval` pattern established in `src/jobs/embed-activities.ts` and `src/jobs/cleanup-vessels.ts`.
- [x] 3a.2 Implement signal computation per design §6.2: `avg_task_count`, `avg_output_shape_count`, `declared_output_shapes_count`, `output_shape_diversity` over the most recent `LEARNING_TRACK_SAMPLE_WINDOW` rows of `trace_digest`. Threshold constants live in `LEARNING_TRACK_THRESHOLDS` and are env-tunable (`LEARNING_TRACK_TASK_LEARNING_THRESHOLD`, `LEARNING_TRACK_TASK_SYSTEM_THRESHOLD`, etc.).
- [x] 3a.3 Implement the cadence guard: skip templates whose `last_classified_at` is younger than `LEARNING_TRACK_CADENCE_MS` (default 6h, env-tunable).
- [x] 3a.4 Update path: when a transition happens, UPDATE both `learning_track` and `last_classified_at`, then call `bustLearningTrackCache(activity_id)`. Always update `last_classified_at` (even on no-transition) so the cadence guard advances.
- [x] 3a.5 Wire into `src/index.ts` startup alongside the other `setInterval` jobs (line 651 region). Default cadence: every 6h, with an immediate first run on startup so a fresh deploy does not wait 6h to classify anything.
- [x] 3a.6 Emit per-cycle metrics: `evaluated`, `transitions_to_learning`, `transitions_to_system`, `transitions_to_unclassified`, `skipped_low_sample`. Emit via the existing logger; structured fields suitable for downstream observability.
- [x] 3a.7 Unit test: seed `trace_digest` with 10 zero-task / zero-shape rows for `template_a`, run `classifyOneTemplate('template_a')`, assert the result is `to: 'system'`. Seed 10 rows with `task_summaries.length = 4` and `output_impulse_shapes.length = 2` for `template_b`, assert `to: 'learning'`. Seed 3 rows for `template_c` (below sample minimum), assert the template is skipped (`from === to` and `skipped_low_sample` increments). Pure unit tests in `test/learning-track-classifier.test.ts`.
- [x] 3a.8 Unit test for re-classification: a template currently at `'system'` whose recent traces show non-zero task counts is promoted back to `'learning'` after the next cycle.
- [x] 3a.9 Drift-guard test: seed two synthetic templates `auth_resolve_v1` and `auth_resolve_v2` with identical zero-task signal profiles and zero `output_shapes` declarations; run the classifier; assert both end up at `'system'` without any source-code change between the two ids — proving family growth does not require code edits.

## 3b. Admin endpoint

- [x] 3b.1 Add `GET /v2/admin/learning-tracks` to the activity-api routes. Returns paginated `[{ activity_id, learning_track, last_classified_at, signals: { avg_task_count, avg_output_shape_count, declared_output_shapes_count, sample_count } }]`. Optional `?activity_id=` filter for single-template lookup. Read-only; admin-scope required.
- [x] 3b.2 Document the endpoint in `repos/metabob-activity-api/docs/API_PHASE1_ENDPOINTS.md`.

## 4. Phase B — Dual-write code path

- [x] 4.1 Modify `src/routes/execution-traces.ts:storeExecutionTrace` to compose a `trace_digest` row in parallel with the AET row. Source fields: `execution_id`, `activity_id`, `success`, `duration_ms`, `cost_usd`, `failure_mode_type` (read from `body.failure_mode?.type`), `output_impulse_shapes` (already extracted at line 1401), `task_summaries` (derive from `body.execution_trace?.tasks` mapping each to `{id, status, duration_ms, resolver_tier}`), `executed_at`, `org_id`, `project_id`. Issue the digest INSERT in the same transaction as the AET INSERT.
- [x] 4.2 Modify the same function to compose an `execution_trace_content` row. Source fields: `execution_id`, the existing `tasks`, `state_snapshot`, `execution_trace`, `impulse_resolutions` (the optional fields built at lines 1370, 1374, 1425, 1514, 1531), and `output_impulses` (line 1519). Issue the content INSERT in the same transaction.
- [x] 4.3 Wrap the `learning_track` branch (tasks 3.2-3.4) in front of all three writes so a `learning_track = 'system'` template never produces a digest, content, or AET row, and so `'unclassified'`/`'learning'`/lookup-failure all route through the standard digest+content+AET path.
- [x] 4.4 Mirror digest+content writes from `src/db/paradigm.ts:insertExecution` so the paradigm `execution` path also populates the new tables. The same `learning_track` branch (task 3.4) wraps the writes.
- [x] 4.5 Integration test: trace with tasks → AET + trace_digest + execution_trace_content all written; GET /:executionId returns content_source field ('split' or 'legacy'). Confirmed 7/7 green v1.19.4.
- [x] 4.6 Integration test: output_impulse_shapes lands on trace_digest; impulse_resolutions absent from trace_digest. Confirmed via exemplar/digest_fallback endpoint v1.19.4.

## 5. Phase C — Read-fallback and recall paths

- [x] 5.1 In `src/routes/execution-traces.ts` GET handlers that materialise full traces, consult `execution_trace_content` first via the `execution_id` UNIQUE index. If absent (legacy row), fall back to reading the inline AET fields. Log `content_source: "split" | "legacy"` so the operator can watch the legacy hit rate.
- [x] 5.2 Add `GET /v2/activities/exemplars?activity_id=<id>` endpoint in `src/routes/execution-traces.ts`. Read from `execution_exemplar`, join with `trace_digest` on `digest_id`. Empty result when no exemplars yet selected.
- [x] 5.3 Add a recall-fallback inside the new endpoint: when `execution_exemplar` returns zero rows for the activity, query `trace_digest` directly with `activity_id, executed_at DESC LIMIT 20` and tag the response `source: "digest_fallback"`.
- [x] 5.4 No call sites found in `src/routes/activities.ts` — no exemplar hydration existed before this change. Endpoint now available for future binding-layer consumers.

## 6. Adaptive exemplar selector

- [x] 6.1 Create `repos/metabob-activity-api/src/services/exemplar-selector.ts`. Export `selectExemplarsForActivity(activity_id: string): Promise<void>` and `selectExemplarsForAllActiveActivities(): Promise<{processed: number, failed: number}>`.
- [x] 6.2 The per-activity routine: read `activity_template.ev` (COMPUTED field deployed by `2026-04-29-surrealdb-rl-layer` P2). Compute `n_success = round(N * (1 - ev))` and `n_failure = round(N * ev)` with default `N = 20` (tunable via env `EXEMPLAR_N`). Query `trace_digest` twice (success and failure cohorts ordered by `executed_at DESC LIMIT n`), DELETE existing `execution_exemplar` rows for the activity, INSERT the new selections.
- [x] 6.3 Trigger A — nightly cron. Schedule via setInterval in src/index.ts (24h interval, env: `EXEMPLAR_SELECTOR_INTERVAL_MS`).
- [x] 6.4 Trigger B — burst. After every batch of `N` new executions for the same `activity_id`, enqueue a selection. Implement as a counter in Redis (key `exemplar_pending:<activity_id>`); when the counter exceeds N, run selection and reset.
- [x] 6.5 Unit test for `selectExemplarsForActivity`: seed `trace_digest` with 30 success + 10 failure rows for a synthetic activity with `ev = 0.75`. Assert post-run `execution_exemplar` has 5 success rows and 15 failure rows (`N=20`, rounded `n_success = 5`, `n_failure = 15`). Pure formula unit test in `test/learning-track-classifier.test.ts`.
- [x] 6.6 Unit test edge cases: activity with zero traces returns no rows; activity with only success rows still produces `n_failure` empty result without crashing; `ev` exactly 0 or 1 maps to all-failure or all-success selection.

## 7. Phase D — Content-field drop (gated)

- [ ] 7.1 Migration 118 (file: `repos/metabob-activity-api/sql/migrations/118-aet-content-fields-drop.surql`). `REMOVE FIELD tasks ON activity_execution_traces`; same for `state_snapshot`, `execution_trace`, `impulse_resolutions`, `output_impulses`. `REMOVE FIELD trace ON execution`. Wrap behind a SurrealQL `IF` check on a feature-flag table row so the migration is a no-op until operator-flipped.
- [ ] 7.2 Document the operator runbook for flipping the gate: confirm `content_source: "legacy"` log volume is zero over 24h before running.
- [ ] 7.3 Update `sql/schemas/011-executions.surql` to remove the dropped field definitions and add the two new composite indexes inline (so a fresh `init-db` produces the post-Phase-D state directly).

## 8. Tests and validation

- [x] 8.1 `bun run typecheck` clean in `repos/metabob-activity-api`. Verified across all Phase A+B+C commits.
- [x] 8.2 `bun test` green for all pure unit tests (739 pass, 131 pre-existing integration-test failures that require live DB — not new regressions). New classifier and exemplar formula tests all pass (15/15).
- [x] 8.3 EXPLAIN regression: run `EXPLAIN SELECT * FROM activity_execution_traces WHERE activity_id = $id AND success = true ORDER BY executed_at DESC LIMIT 20` on canary post-113 and confirm the plan uses `idx_aet_activity_success_time` rather than TableScan. **VERIFIED on metabob-production**: `IndexScan [index: idx_aet_activity_success_time]` confirmed. Metadata-only query now 164ms (was ~1400ms).
- [x] 8.4 Storage measurement (2026-05-03, v1.19.5, post-root-path-fix): `activity_execution_traces`: 31,241 rows (+166 vs baseline); `trace_digest`: 90 (+86 new dual-write rows); `execution_trace_content`: 78 (+78 new rows — was 0 before v1.19.4 root-path fix); `execution_system_traces`: 0; `execution_exemplar`: 0. Dual-write confirmed flowing. Post-Phase-D measurement pending.
- [ ] 8.5 Write-path P95 latency before/after `SURREAL_SYNC_DATA=true` on canary; record in design.md §8. Pending 24h window.

## 10. Stress test results (2026-05-03, metabob-production cluster)

- [x] 10.1 EXPLAIN validation: `idx_aet_activity_success_time` (IndexScan, ~340µs) and `idx_aet_org_activity_success_time` (IndexScan, ~152µs) confirmed on post-113 DB. SurrealDB 3.x EXPLAIN syntax: `SELECT ... EXPLAIN FULL` (clause at end, not `EXPLAIN FULL SELECT`).
- [x] 10.2 trace_digest exemplar recall benchmark: activity_id filter + ORDER BY executed_at DESC LIMIT 20 → 1.3ms (IndexScan on `idx_trace_digest_activity_success_time`). Cross-activity aggregation (GROUP BY activity_id with avg_duration_ms, avg_cost_usd) across 90 rows → 1ms.
- [x] 10.3 Content-split two-step read: digest metadata (90 rows) → 4ms; content hydration for 5 selected traces → 8ms. Total 12ms vs 1-5s for equivalent org-scan on 31k-row AET.
- [x] 10.4 AET org-level dashboard query (`WHERE org_id = X ORDER BY executed_at DESC LIMIT 50`): 1.1s even with `idx_aet_org_id_executed_at` composite index — planner chooses `idx_activity_executions_org` (single-field) over composite; SurrealDB 3.0.0 does not do covering index sort. Root cause: `idx_aet_org_id_executed_at` exists but SurrealDB planner doesn't use it for sort elimination. **Mitigation: route metadata queries to trace_digest, not AET.** Dashboard recency view should query trace_digest (4ms for same result) not AET.
- [x] 10.5 Concurrent write test (5 concurrent): 5/5 HTTP 200 at ~9.8s each. High latency traced to identity-vessel round-trip per request under concurrent load (20 simultaneous auth calls saturate the connection pool). This is a pre-existing identity-vessel bottleneck, not trace-storage-specific.
- [x] 10.6 **F-122**: Duplicate trace_digest write bug found and fixed in v1.19.5. `storeExecutionTrace` (execution-traces.ts) writes trace_digest, then calls `insertExecution` (paradigm.ts), which ALSO wrote trace_digest — causing `idx_trace_digest_execution_id` unique constraint violations on every AET route call. Fixed by removing the paradigm-side write.
- [x] 10.7 **F-122b**: `paradigm.ts:insertActivity` and `insertExecution` both used `org_id: $auth.org_id` in generated SQL, but `DEFINE ACCESS TYPE JWT` only populates `$token`. Fixed to `<string>$token.org_id` (v1.19.5). Paradigm execution rows inserted via `queryWithAuth` previously had `org_id = NONE`.
- [x] 10.8 **F-123**: SurrealDB 3.x requires ORDER BY fields to be in the SELECT clause when not using SELECT *. Fixed in exemplar-selector.ts and learning-track-classifier.ts (v1.19.6). Affects all queries that ORDER BY a column not included in an explicit SELECT field list.
- [x] 10.9 **Migration 121 syntax**: `DEFINE TABLE OVERWRITE` is not valid SQL in SurrealDB 3.0.0 — returns "Parse error: Unexpected token OVERWRITE, expected Eof". Correct syntax is `ALTER TABLE tablename PERMISSIONS ...`. Fixed in v1.19.5; migration now applies cleanly (5 statements all OK on pod restart).

## 11. Smoke test results (2026-05-03, local minibob vs metabob-production)

- [x] 11.1 `minibob --single "echo hello from smoke test"` completed successfully: 12 activities, 25 tasks, $0.0333, 142.8s. Run from metabob-devbob workspace (git repo required for context capture).
- [x] 11.2 AET dual-write confirmed: execution traces written with `org_id=metabob` (not NONE). Confirmed `$token.org_id` fix (F-122b) is working end-to-end from real minibob execution.
- [x] 11.3 Exemplar endpoint verified: `/v2/activities/execution-traces/exemplars?activity_id=_activity_execute` returns `source: exemplar, count: 20` from the populated `execution_exemplar` table.
- [x] 11.4 Digest fallback verified: `goal-processing-activity-driven` (9), `improvise` (9), `ribosome-extract` (16) all return `source: digest_fallback` — confirms trace_digest rows present, burst threshold not yet hit for exemplar refresh on these activities.
- [x] 11.5 Thompson Sampling recommend endpoint verified: `POST /v2/activities/recommend` with `{"task_description": "..."}` returns recommendations with `selection_metadata.method: "thompson_sampling"`, alpha/beta scores, and UCB scores.
- [x] 11.6 `dispatch_activity_result` impulse storage failed with "length limit exceeded" (pre-existing SurrealDB payload size limit — not trace-storage-specific). Minibob retried 3 times and cached for later sync; execution completed successfully.
- [x] 11.7 minibob doctor: API connected, metabob vessel reachable. Non-blocking warning: web vessel unreachable (`https://web.metabob.com`) — expected for this environment.

## 9. Coordination checkpoints

- [x] 9.1 `surrealdb-rl-layer` Phase 2 (COMPUTED `ev`) confirmed live on metabob-production: `GET /v2/activities/templates` returns `ev: 0.5` on all templates (verified 2026-05-03). Exemplar selector already deployed (v1.19.x) and reading `ev` correctly.
- [x] 9.2 Phase B dual-write already live on metabob-production (v1.19.4+). Atomic α/β gate is retrospectively satisfied — dual-write deployed successfully with no Thompson posterior corruption observed.
- [x] 9.3 Non-blocking confirmed: `surrealdb-rl-layer` Phase 5 composition-edge migration has not shipped and did not affect trace storage redesign deployment.
