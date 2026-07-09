# Design — substrate self-managed DB reconciliation

## Measured baseline (2026-07-09, pre-window)

- `activity_execution_traces` (AET): **218,953 rows**; `SELECT count() ... GROUP ALL` = **86.5 s**.
- Data file `/var/lib/surrealdb/data.db`: **13 GB**.
- **23 indexes** on AET, including duplicates (`idx_activity_execution_traces_executed_at` and `idx_activity_executions_executed_at` are both `FIELDS executed_at`).
- **3 materialized views** over AET: `v_activity_execution_traces_by_account`, `view_activity_executions`, `view_execution_traces` — every AET write recomputes them; they must be REMOVE'd before the swap and redefined after.
- Prior failure data: per-row bulk DELETE of 500 rows > 190 s. Never bulk-delete row-by-row.
- `self-recovery` is **timer-driven** (`self-recovery.timer`); a plain `systemctl stop self-recovery.service` does nothing durable — the timer refires. Both timer and service must be stopped **and masked**.

## SurrealDB-specific constraints (non-negotiable)

1. **`type::datetime()` never `<datetime>` cast.** The cast form errors on some stored values and inside VALUE clauses on this SurrealDB build; `type::datetime($v)` / `time::now()` are the only accepted datetime constructors in queries and migrations.
2. **ROOT path for DDL and deletes.** `REMOVE TABLE`, `DEFINE TABLE/FIELD/INDEX`, and swap copies run via the root HTTP `/sql` endpoint (or `surrealDB.query()` root client), never `queryWithAuth` — table PERMISSIONS use `$token`/`$auth` guards that are false on the JWT path and silently no-op writes (cf. F-V56).
3. **Omit optional fields rather than sending `null`.** SCHEMAFULL `option<...>` fields reject explicit `null`; build insert objects by omission.
4. **No unbounded global `ORDER BY` anywhere** — not in the keep-set selection, not in the observer, not in the reconcile op. Every read is bounded by an indexed range (`executed_at > time::now() - <window>`), an indexed equality (`activity_id = ...`), or a `LIMIT` over an indexed ORDER. Global aggregates come from `trace_store_counters`, never from scanning AET.

## The swap (SurrealDB has no table rename)

Copy-forward two-hop, keep-set small (~10–25k rows):

1. Snapshot DDL: `INFO FOR TABLE activity_execution_traces` → save full field/index/view definitions to `/workspace/db-backups/aet-ddl-<ts>.json`.
2. Keep-set → `activity_execution_traces_next` (SCHEMALESS, **zero indexes** → cheap copy):
   - **Hot window:** `INSERT INTO activity_execution_traces_next SELECT * FROM activity_execution_traces WHERE executed_at > time::now() - 14d` (uses `idx_*_executed_at`), chunked by day-ranges if needed.
   - **Stratified reservoir:** for each distinct `activity_id` present in recent `goal_execution_paths`/template list (bounded list, not a global AET GROUP BY): `SELECT * FROM activity_execution_traces WHERE activity_id = $id AND executed_at <= time::now() - 14d ORDER BY executed_at DESC LIMIT 25` (bounded ORDER over `idx_aet_activity_id_executed_at`).
3. Verify `_next` count is plausible (> 0, and hot-window count matches a directly-measured hot count).
4. `REMOVE TABLE` the 3 views, then `REMOVE TABLE activity_execution_traces` (instant; drops rows + 23 indexes + fields).
5. Redefine AET: replay field definitions from the DDL snapshot; define the **load-bearing index set once** (deduped): `executed_at`, `execution_id UNIQUE`, `activity_id+executed_at`, `activity_id+success+executed_at`, `vessel_id`, `parent_execution_id`, `correlation_id`, `status`, `org_id+executed_at`, `composition_chain`. Drop the duplicate/unused remainder.
6. `INSERT INTO activity_execution_traces SELECT * FROM activity_execution_traces_next` (small; indexes exist but table is small).
7. `REMOVE TABLE activity_execution_traces_next`; redefine the 3 views.
8. Initialize `trace_store_counters` from the final count (one bounded count over the now-small table).

The same sequence, parameterized and bounded by counters, is what `db_admin reconcile_trace_store` executes autonomously later.

## Primitives

### trace_store_counters (migration `155-trace-store-counters.surql`)
Single-row-per-table SCHEMAFULL table: `{ id: trace_store_counters:activity_execution_traces, row_count: int, last_reconciled_at: option<datetime>, cap: option<int> }`. Incremented (`UPDATE ... SET row_count += 1`) at both AET insert sites (`src/routes/execution-traces.ts` ~2118, `src/routes/activities.ts` ~2497) on the root path, fire-and-forget (failure logged, never blocks trace storage). Reset by the reconcile op post-swap.

### Retention/evolution config (activity-api `src/config.ts`)
`traceStore: { cap (TRACE_STORE_CAP, default 50_000), hotWindowDays (default 14), reservoirPerActivity (default 25) }`. The observer reads cap via a small activity-api surface (`GET /metrics/trace-store` or resolve of counters row); no global GROUP BY.

### maintenanceLease resolver (development-vessel)
File-backed `/workspace/leases/maintenance.json` (atomic tmp→rename, model: `memory-note.ts`). Pointer ops: `acquire` (fails if unexpired lease held by another holder; returns `{token, holder, expires_at}`), `renew`, `release`, `status`. TTL default 15 min. Shapes `maintenanceLease` / `maintenanceLease_write` advertised via dev-vessel config.

### Pausable-citizen guard (`src/resolvers/http-retry.ts`)
`fetchWithRetry` stat-reads `/workspace/leases/maintenance.json` (cached ~5 s); if an unexpired lease exists and the target URL is a trace-store read (activity-api), return `null` immediately (observers already handle `null` as "skip this cycle"). Fail-open: any error reading the lease file → proceed normally.

### trace_store_health_observer (development-vessel resolver + seed tick)
Model: `db-contention-observer.ts`. Reads counters row (never counts AET); if `row_count > cap`, emits `substrateGap_write` `{ category: "trace_store_reconciliation", id: "trace-store-reconcile-<hour-bucket>" }`. Seed template `development-vessel:trace-store-health-observer` added to `SEED_TEMPLATES`.

### db_admin `reconcile_trace_store` (activity-api `src/routes/db-admin.ts`)
New operation on the **existing** `db_admin` resolver. Contract: `{ operation: "reconcile_trace_store", dry_run?: boolean (default TRUE), lease_token: string }`. Validates the lease token against `/workspace/leases/maintenance.json` (holder + unexpired) — refuses without it. Table names are **fixed constants** (`activity_execution_traces` / `_next`); no caller-supplied table names. Dry-run reports counts and the plan; live run executes the swap (§above), writes an audit row to `db_admin_audit` (migration 150) for every invocation with before/after counts, and resets the counters row.

### Seeded `trace-store-reconcile` activity + gap routing
Template `development-vessel:trace-store-reconcile`: tasks = acquire lease → `db_admin reconcile_trace_store dry_run:false lease_token:{{lease.token}}` → verify counters ≤ cap → release lease (release also in failure path). `gap-to-feature.ts` routes `category === "trace_store_reconciliation"` to dispatching this template through goal-host `/run-goal` (`target_template_id`), so the reach-gate produces an honest `reached` verdict and the loop learns.

## Maintenance-window quiesce set (order matters)

Stop **and mask**: `self-recovery.timer`, `self-recovery.service`. Stop (no mask needed, re-enabled after): `boredom-vessel.timer`, `light-dispatch-healthcheck.timer`, `gap-compose.timer`, `funnel-drain.timer`, `db-maintenance.timer`, `db-contention-check.timer`, `substrate-pull-sync.timer`, `self-repair-operational.timer`, `surgical-gap-scan.timer`, `operator-goal-generator.timer`, `autonomy-metrics.timer`, `auto-describe-resolvers.timer`, `observe-orthogonal-refresh.timer`, `model-reality-audit.timer`, `spectral-gap.timer`, `m1-trainer.timer`, `self-operational-health.timer`, `composition-edge-reconcile.timer`; then services: `boredom-vessel`, `light-dispatch-vessel`, `development-vessel`, `goal-host-vessel`, `ribosome-vessel`, `metric-collector-vessel`, `relevance-sink-vessel`, `federation-transport-vessel`, `analysis-vessel`, `concept-db`, `activity-api`. **Verify quiet** (no AET writers) before mutating. SurrealDB itself stays up.

Restart order: surrealdb (never stopped) → identity-vessel → discovery-vessel → activity-api (migrations run via ExecStartPre) → remaining vessels → timers → **unmask + re-enable self-recovery last**.

## Deployment note

activity-api source is baked into the image (no `sync-activity-api` Makefile target): window edits land in `repos/activity-api` locally (with `SUBSTRATE_ALLOW_DIRECT_EDIT=1`), then `docker cp` of `src/` + `sql/` into `/vessels/activity-api/` before the restart. development-vessel uses the existing `make sync-development-vessel` / `restart-development-vessel` path. New seed templates will NOT auto-seed (cold-start-only guard) — POST them to `/v2/activities/templates` explicitly during re-seed.

## Verification gates

- Backup export exists in `/workspace/db-backups/` and is non-trivial (> 100 MB expected for a 13 GB store; hard floor 10 MB) **before any mutation**.
- Post-swap: cold `SELECT ... ORDER BY executed_at DESC LIMIT 100` < 500 ms; fleet `/health` green; observer's query plan shows no `Iterate Table` over AET (`EXPLAIN`).
- Autonomous cadence judged by `reached: true` from the reach-gate (via `goal_status`/`goal_reasoning`), not `status`; trace inspected; `provide_feedback` recorded.
