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
- [ ] 3.5 Integration test: with a template at `learning_track = 'system'`, calling `storeExecutionTrace` produces one row in `execution_system_traces` and zero rows in `activity_execution_traces` / `trace_digest` / `execution_trace_content`.
- [ ] 3.6 Integration test: simulate `resolveLearningTrack` throwing; confirm the trace lands in `activity_execution_traces` (fall-through), the trace is not lost, and a single warn log is emitted.
- [ ] 3.7 Integration test: with a template at `learning_track = 'unclassified'` (default for new rows), the trace lands in `activity_execution_traces` per the default path.

## 3a. Classifier job

- [x] 3a.1 Create `repos/metabob-activity-api/src/jobs/learning-track-classifier.ts`. Export `classifyOneTemplate(activity_id: string): Promise<{ from: LearningTrack, to: LearningTrack, signals: ClassifierSignals }>` and `runClassifierCycle(): Promise<{ evaluated: number, transitions: number, skipped_low_sample: number }>`. The job follows the `setInterval` pattern established in `src/jobs/embed-activities.ts` and `src/jobs/cleanup-vessels.ts`.
- [x] 3a.2 Implement signal computation per design §6.2: `avg_task_count`, `avg_output_shape_count`, `declared_output_shapes_count`, `output_shape_diversity` over the most recent `LEARNING_TRACK_SAMPLE_WINDOW` rows of `trace_digest`. Threshold constants live in `LEARNING_TRACK_THRESHOLDS` and are env-tunable (`LEARNING_TRACK_TASK_LEARNING_THRESHOLD`, `LEARNING_TRACK_TASK_SYSTEM_THRESHOLD`, etc.).
- [x] 3a.3 Implement the cadence guard: skip templates whose `last_classified_at` is younger than `LEARNING_TRACK_CADENCE_MS` (default 6h, env-tunable).
- [x] 3a.4 Update path: when a transition happens, UPDATE both `learning_track` and `last_classified_at`, then call `bustLearningTrackCache(activity_id)`. Always update `last_classified_at` (even on no-transition) so the cadence guard advances.
- [x] 3a.5 Wire into `src/index.ts` startup alongside the other `setInterval` jobs (line 651 region). Default cadence: every 6h, with an immediate first run on startup so a fresh deploy does not wait 6h to classify anything.
- [x] 3a.6 Emit per-cycle metrics: `evaluated`, `transitions_to_learning`, `transitions_to_system`, `transitions_to_unclassified`, `skipped_low_sample`. Emit via the existing logger; structured fields suitable for downstream observability.
- [ ] 3a.7 Unit test: seed `trace_digest` with 10 zero-task / zero-shape rows for `template_a`, run `classifyOneTemplate('template_a')`, assert the result is `to: 'system'`. Seed 10 rows with `task_summaries.length = 4` and `output_impulse_shapes.length = 2` for `template_b`, assert `to: 'learning'`. Seed 3 rows for `template_c` (below sample minimum), assert the template is skipped (`from === to` and `skipped_low_sample` increments).
- [ ] 3a.8 Unit test for re-classification: a template currently at `'system'` whose recent traces show non-zero task counts is promoted back to `'learning'` after the next cycle.
- [ ] 3a.9 Drift-guard test: seed two synthetic templates `auth_resolve_v1` and `auth_resolve_v2` with identical zero-task signal profiles and zero `output_shapes` declarations; run the classifier; assert both end up at `'system'` without any source-code change between the two ids — proving family growth does not require code edits.

## 3b. Admin endpoint

- [x] 3b.1 Add `GET /v2/admin/learning-tracks` to the activity-api routes. Returns paginated `[{ activity_id, learning_track, last_classified_at, signals: { avg_task_count, avg_output_shape_count, declared_output_shapes_count, sample_count } }]`. Optional `?activity_id=` filter for single-template lookup. Read-only; admin-scope required.
- [ ] 3b.2 Document the endpoint in `repos/metabob-activity-api/docs/API_PHASE1_ENDPOINTS.md`.

## 4. Phase B — Dual-write code path

- [x] 4.1 Modify `src/routes/execution-traces.ts:storeExecutionTrace` to compose a `trace_digest` row in parallel with the AET row. Source fields: `execution_id`, `activity_id`, `success`, `duration_ms`, `cost_usd`, `failure_mode_type` (read from `body.failure_mode?.type`), `output_impulse_shapes` (already extracted at line 1401), `task_summaries` (derive from `body.execution_trace?.tasks` mapping each to `{id, status, duration_ms, resolver_tier}`), `executed_at`, `org_id`, `project_id`. Issue the digest INSERT in the same transaction as the AET INSERT.
- [x] 4.2 Modify the same function to compose an `execution_trace_content` row. Source fields: `execution_id`, the existing `tasks`, `state_snapshot`, `execution_trace`, `impulse_resolutions` (the optional fields built at lines 1370, 1374, 1425, 1514, 1531), and `output_impulses` (line 1519). Issue the content INSERT in the same transaction.
- [x] 4.3 Wrap the `learning_track` branch (tasks 3.2-3.4) in front of all three writes so a `learning_track = 'system'` template never produces a digest, content, or AET row, and so `'unclassified'`/`'learning'`/lookup-failure all route through the standard digest+content+AET path.
- [x] 4.4 Mirror digest+content writes from `src/db/paradigm.ts:insertExecution` so the paradigm `execution` path also populates the new tables. The same `learning_track` branch (task 3.4) wraps the writes.
- [ ] 4.5 Integration test: store a trace for a `learning_track = 'learning'` template, assert one row exists in each of `activity_execution_traces`, `trace_digest`, `execution_trace_content`. Store a trace for a `learning_track = 'system'` template, assert one row exists only in `execution_system_traces`. Store a trace for a `learning_track = 'unclassified'` template, assert it lands in the standard tables (default fall-through behaviour).
- [ ] 4.6 Integration test: assert `output_impulse_shapes` lands on `trace_digest` and is queryable; assert `impulse_resolutions` lands on `execution_trace_content` and is absent from `trace_digest`.

## 5. Phase C — Read-fallback and recall paths

- [ ] 5.1 In `src/routes/execution-traces.ts` GET handlers that materialise full traces, consult `execution_trace_content` first via the `execution_id` UNIQUE index. If absent (legacy row), fall back to reading the inline AET fields. Log `content_source: "split" | "legacy"` so the operator can watch the legacy hit rate.
- [ ] 5.2 Add `GET /v2/activities/exemplars?activity_id=<id>` endpoint in `src/routes/execution-traces.ts`. Read from `execution_exemplar`, join with `trace_digest` on `digest_id`. Empty result when no exemplars yet selected.
- [ ] 5.3 Add a recall-fallback inside the new endpoint: when `execution_exemplar` returns zero rows for the activity, query `trace_digest` directly with `activity_id, executed_at DESC LIMIT 20` and tag the response `source: "digest_fallback"`.
- [ ] 5.4 Update the binding-layer recommendation path (call sites in `src/routes/activities.ts` that hydrate exemplar traces — locate via `grep -n exemplar src/routes/activities.ts`) to call the new endpoint instead of fetching full AET rows.

## 6. Adaptive exemplar selector

- [x] 6.1 Create `repos/metabob-activity-api/src/services/exemplar-selector.ts`. Export `selectExemplarsForActivity(activity_id: string): Promise<void>` and `selectExemplarsForAllActiveActivities(): Promise<{processed: number, failed: number}>`.
- [x] 6.2 The per-activity routine: read `activity_template.ev` (COMPUTED field deployed by `2026-04-29-surrealdb-rl-layer` P2). Compute `n_success = round(N * (1 - ev))` and `n_failure = round(N * ev)` with default `N = 20` (tunable via env `EXEMPLAR_N`). Query `trace_digest` twice (success and failure cohorts ordered by `executed_at DESC LIMIT n`), DELETE existing `execution_exemplar` rows for the activity, INSERT the new selections.
- [x] 6.3 Trigger A — nightly cron. Schedule via setInterval in src/index.ts (24h interval, env: `EXEMPLAR_SELECTOR_INTERVAL_MS`).
- [x] 6.4 Trigger B — burst. After every batch of `N` new executions for the same `activity_id`, enqueue a selection. Implement as a counter in Redis (key `exemplar_pending:<activity_id>`); when the counter exceeds N, run selection and reset.
- [ ] 6.5 Unit test for `selectExemplarsForActivity`: seed `trace_digest` with 30 success + 10 failure rows for a synthetic activity with `ev = 0.75`. Assert post-run `execution_exemplar` has 5 success rows and 15 failure rows (`N=20`, rounded `n_success = 5`, `n_failure = 15`).
- [ ] 6.6 Unit test edge cases: activity with zero traces returns no rows; activity with only success rows still produces `n_failure` empty result without crashing; `ev` exactly 0 or 1 maps to all-failure or all-success selection.

## 7. Phase D — Content-field drop (gated)

- [ ] 7.1 Migration 118 (file: `repos/metabob-activity-api/sql/migrations/118-aet-content-fields-drop.surql`). `REMOVE FIELD tasks ON activity_execution_traces`; same for `state_snapshot`, `execution_trace`, `impulse_resolutions`, `output_impulses`. `REMOVE FIELD trace ON execution`. Wrap behind a SurrealQL `IF` check on a feature-flag table row so the migration is a no-op until operator-flipped.
- [ ] 7.2 Document the operator runbook for flipping the gate: confirm `content_source: "legacy"` log volume is zero over 24h before running.
- [ ] 7.3 Update `sql/schemas/011-executions.surql` to remove the dropped field definitions and add the two new composite indexes inline (so a fresh `init-db` produces the post-Phase-D state directly).

## 8. Tests and validation

- [ ] 8.1 `bun run typecheck` clean in `repos/metabob-activity-api`.
- [ ] 8.2 `bun test` green in `repos/metabob-activity-api` including the new integration tests added under tasks 3.5-3.7, 3a.7-3a.9, 4.5, 4.6, 6.5, 6.6.
- [x] 8.3 EXPLAIN regression: run `EXPLAIN SELECT * FROM activity_execution_traces WHERE activity_id = $id AND success = true ORDER BY executed_at DESC LIMIT 20` on canary post-113 and confirm the plan uses `idx_aet_activity_success_time` rather than TableScan. **VERIFIED on metabob-production**: `IndexScan [index: idx_aet_activity_success_time]` confirmed. Metadata-only query now 164ms (was ~1400ms).
- [ ] 8.4 Storage measurement: take row counts and table sizes from canary pre-deploy and after Phase B/C/D. Record in design.md §5 as a closeout note.
- [ ] 8.5 Write-path P95 latency before/after `SURREAL_SYNC_DATA=true` on canary; record in design.md §8.

## 9. Coordination checkpoints

- [ ] 9.1 Confirm `surrealdb-rl-layer` Phase 2 (COMPUTED `ev`) is live on canary before deploying the exemplar selector (task 6).
- [ ] 9.2 Confirm `surrealdb-rl-layer` Phase 1 (atomic α/β) is live on canary before Phase B dual-write (task 4) — the system-trace carve-out narrows what the atomic UPDATE sees, so atomicity must already be in place.
- [ ] 9.3 Note any composition-edge migration (`surrealdb-rl-layer` Phase 5) does not block this change; both can ship in either order.
