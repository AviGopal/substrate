## Why

Execution-trace storage in `metabob-activity-api` has six interlocking deficiencies that surface as slow recommendation paths, oversized rows, missing crash safety, and learning-loop pollution by zero-task system traces. The on-disk corpus today is roughly 31K rows in `activity_execution_traces` and 17K rows in `execution`, with average per-row payload around 16.6KB and 80% of rows attributable to fixed-cost system activities (auth resolution, lifecycle wrappers, validator dispatches) that emit no learnable signal. The metadata-only scan paths suffer because the heavy `tasks`, `state_snapshot`, `execution_trace`, `impulse_resolutions`, and `output_impulses` arrays ride in the same row as the metadata they shadow; even an `org_id, executed_at` lookup hauls the entire payload off RocksDB. `WHERE success = true ORDER BY executed_at DESC` on `activity_execution_traces` triggers a TableScan today because no index covers `success` on that table (the sibling `execution` table already has `(org_id, success, executed_at)` from migration earlier, but the legacy table does not). The default SurrealDB persistence settings ship with `SURREAL_SYNC_DATA=false`, so a node-level crash can lose buffered writes for trace storage that is otherwise the system's only RL training corpus.

This change lands the storage redesign in coordination with the already-deployed RL primitives from `2026-04-29-surrealdb-rl-layer` (atomic α/β updates, COMPUTED `ev`, `fn::beta_sample`). Those primitives are unchanged here; the redesign builds on top of them by feeding the binding layer faster exemplar recall and removing the system-trace pollution that today inflates posteriors with zero-information rows.

## What Changes

1. **Crash safety** — Set `SURREAL_SYNC_DATA=true` on the SurrealDB StatefulSet so trace writes are durable across pod restarts. Document the latency tradeoff in the chart values.

2. **Composite indexes on `activity_execution_traces`** — Add `(activity_id, success, executed_at)` and `(org_id, activity_id, success, executed_at)` so `WHERE success = true` and Thompson exemplar lookups stop running TableScans. The sibling `execution` table already has `(org_id, success, executed_at)` and a single-field `success` index, so it needs only the `(activity_id, success, executed_at)` complement to match. Use `DEFINE INDEX OVERWRITE` matching the established migration style (102 sets the precedent).

3. **`trace_digest` table** — Introduce a per-execution slim summary keyed on `execution_id`. Written alongside the full trace from `storeExecutionTrace`. Carries `activity_id`, `success`, `executed_at`, `failure_mode_type`, `output_impulse_shapes` (kept here for binding-layer recommendation), per-task `(id, status, duration_ms, resolver_tier)` micro-tuples, and `cost_usd`. Enables exemplar recall paths to read 100s of bytes per row instead of 16.6KB.

4. **Content/metadata split** — Move `tasks`, `state_snapshot`, `execution_trace`, `impulse_resolutions`, and `output_impulses` from `activity_execution_traces` into a new 1-to-1 `execution_trace_content` table keyed by `execution_id`. The metadata table retains `output_impulse_shapes` (queried by `discover-by-shapes`) and all index-bearing fields. Three-phase migration: dual-write -> read-fallback view -> field removal, every phase reversible.

5. **Observed learning-track classification** — Each `activity_template` (and the paradigm `activity` row) carries a `learning_track` field set by observation, not by hardcoded id list. A periodic classifier averages `task_count`, `output_impulse_shapes` length, and declared `output_shapes` over recent executions per template; templates whose traces have been observed not to contribute learning signal are tagged `system` and their subsequent traces route to a new `execution_system_traces` table, while templates with task/shape signal stay on the `learning` track and feed `activity_execution_traces` as before. The Thompson Sampling α/β path is structurally excluded from `execution_system_traces`, so system-track traces never pollute posteriors. The classifier is advisory: any lookup failure falls through to the default full-trace table, and templates can transition between tracks across cycles. Estimated to remove 80% of today's row count from the learning corpus once classification converges, attributable to templates whose traces have been observed not to contribute learning signal (auth resolution, lifecycle wrappers, validator dispatches, health probes) rather than to a static id list.

6. **Adaptive exemplar selection** — A new `execution_exemplar` table holds curated representative traces per activity. Selection runs nightly (or after a batch of N executions per template) and balances success/failure exemplars adaptively: `n_success = round(N x (1 - ev))`, `n_failure = round(N x ev)` where `ev = alpha / (alpha + beta)` reads the COMPUTED field already deployed under `2026-04-29-surrealdb-rl-layer`. Default `N = 20` per activity. Recall paths read from `execution_exemplar` first, falling back to digest-only scan when no exemplars yet exist for an activity.

## Impact

- `repos/metabob-activity-api/sql/migrations/113-aet-success-composite-indexes.surql` — new
- `repos/metabob-activity-api/sql/migrations/114-trace-digest-table.surql` — new
- `repos/metabob-activity-api/sql/migrations/115-execution-trace-content-table.surql` — new
- `repos/metabob-activity-api/sql/migrations/116-execution-system-traces-table.surql` — new
- `repos/metabob-activity-api/sql/migrations/117-execution-exemplar-table.surql` — new
- `repos/metabob-activity-api/sql/migrations/118-aet-content-fields-drop.surql` — new (Phase D, gated)
- `repos/metabob-activity-api/sql/migrations/119-learning-track-field.surql` — new (adds `learning_track` and `last_classified_at` to `activity_template` and `activity`, default `unclassified`; runs alongside Phase A but separately so it can ship without depending on the content-drop gate)
- `repos/metabob-activity-api/sql/schemas/011-executions.surql` — drop content fields after Phase 3 lands; add the two new composite indexes alongside existing `idx_activity_executions_*`
- `repos/metabob-activity-api/src/routes/execution-traces.ts` — split write path at the INSERT site (line 1550) into metadata + content + digest; consult the executing template's `learning_track` to route system-track traces to `execution_system_traces`; preserve fall-through to default on any classifier-lookup failure; add a read-fallback for content fields during Phase 2; line 1370 task extraction stays in place but writes to the new content table
- `repos/metabob-activity-api/src/db/paradigm.ts` — mirror the split at the `execution` INSERT site (line 353) and the same `learning_track` lookup with fall-through
- `repos/metabob-activity-api/src/routes/activities.ts` — Thompson update sites at lines 2262 and 2282 stay structurally excluded from system-track rows because routing diverts those rows at write time; expose a digest-backed exemplar recall query
- `repos/metabob-activity-api/src/services/exemplar-selector.ts` — new service running adaptive selection job
- `repos/metabob-activity-api/src/jobs/learning-track-classifier.ts` — new periodic job that observes per-template signals and updates `learning_track`
- `repos/metabob-activity-api/src/lib/learning-track.ts` — new helper exporting `resolveLearningTrack(activity_id): Promise<LearningTrack>` with internal cache and fall-through-on-error semantics
- `repos/metabob-activity-api/src/routes/admin.ts` (or equivalent) — new `GET /v2/admin/learning-tracks` endpoint exposing per-template classification and signal values for operator audit
- `repos/deployment/charts/surrealdb/templates/statefulset.yaml` — add `SURREAL_SYNC_DATA=true` to the env list under the existing `SURREAL_USER` / `SURREAL_PASS` block
- `repos/deployment/charts/surrealdb/values.yaml` — surface the sync flag with documentation noting the durability/latency tradeoff
- No Workbench or MiniBob source changes; recall API contract is additive

## Out of scope

- Migrating the legacy `activity_execution_traces` table to the paradigm `execution` table. The two-table situation is documented in `011-executions.surql` and treated here as the operating reality, not a problem this change fixes.
- Two-sided execution traces and pubkey-based vessel identity (those are owned by `2026-04-26-security-hardening-findings`).
- Backfilling exemplar selection across pre-existing rows; the selector starts producing exemplars after deploy and accumulates as new executions land.
