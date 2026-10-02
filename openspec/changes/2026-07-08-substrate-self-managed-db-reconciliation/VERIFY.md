# VERIFY — substrate self-managed DB reconciliation

Executed 2026-07-09 (UTC) on the local single-container substrate (`substrate-live`).

## Maintenance window (operator-run, tasks 1–21)

**Baseline (measured):** AET = 218,953 rows; full-table `count()` = 86.5 s; 7-day indexed-range count = 327 s; 13 GB RocksDB store; 23 indexes (with duplicates); 3 materialized views over AET.

**Quiesce:** `self-recovery.timer` + `.service` stopped and **runtime-masked** (`/run/systemd` symlinks — unit files live in `/etc` so plain `mask` fails; `--runtime` is also self-cleaning on reboot). All 20+ substrate timers stopped, then all AET-writing vessels including activity-api. Verified write-quiet by construction (activity-api is the only AET writer). This closed the failure mode that killed the previous attempt (self-recovery git-reverting vessels mid-window).

**Backup:** logical `surreal export` stalled twice (CLI 2.3.3 never established a connection; raw HTTP `/export` streamed 4 KB in 90 s), so pivoted to a **file-level backup**: stopped `surrealdb.service`, `cp -a` of the RocksDB dir → `/workspace/db-backups/data.db.bak-20260709` (**13 GB, 144 files, verified**), plus full DDL snapshot `aet-ddl-20260709.json` (51 fields / 23 indexes / 3 views / PERMISSIONS). Mutation only proceeded after verification.

**Swap (copy-forward, no per-row deletes):**
- Keep-set → unindexed `activity_execution_traces_next`: 7-day hot window (38,086 rows; 1-day chunk 164 ms, 6-day chunk 3.5 s — the executed_at index is used on a quiet server) + stratified reservoir (233 strata = distinct hot `activity_id`s, `ORDER BY executed_at DESC LIMIT 25` per stratum over the compound index; 2,765 rows; 516 s total, 0 errors). Total keep-set **40,851**.
- `REMOVE TABLE` 3 views + AET (36.5 s) → replay DDL (51 fields + **10 load-bearing indexes**, deduped from 23; 8 "already exists" ERRs from `field[*]` auto-defs, state-diff verified complete) → copy-back 40,851 rows (18.3 s) → drop `_next` → redefine 3 views.

**Post-swap verification (criteria met):**
- Cold `SELECT … ORDER BY executed_at DESC LIMIT 100` = **4.4 ms** (criterion < 500 ms; was ~86 s+).
- `EXPLAIN` on an executed_at range shows **`Iterate Index`** (`idx_activity_execution_traces_executed_at`) — no `Iterate Table`.
- Fleet `/health` green on all 7 host-mapped ports; zero failed units.

**Primitives landed (same window):**
- activity-api `3f378ae` — migration `156-trace-store-counters.surql` (155 was taken); fire-and-forget insert-path increments at both AET INSERT sites; `traceStore` retention config (`TRACE_STORE_CAP`/`TRACE_STORE_HOT_WINDOW_DAYS`/`TRACE_STORE_RESERVOIR_PER_ACTIVITY`); `GET /metrics/db` (did not previously exist despite being referenced by the db-contention observer) with O(1) `traceStore` block; lease-gated `db_admin` op `reconcile_trace_store` (dry-run default, fixed table names, `db_admin_audit` rows, step-tagged failure audit). 12/12 new tests, typecheck clean, zero regressions vs baseline.
- development-vessel `9674cb8` — `maintenanceLease`/`maintenanceLease_write` resolver (file-backed `/workspace/leases/maintenance.json`, atomic, TTL backstop 15 min); pausable-citizen guard in `fetchWithRetry` (trace-store reads return null-skip while an unexpired lease is held; fail-open); `trace_store_health_observer` (reads counters via `/metrics/db`, never counts AET; hour-bucketed gap dedup); seed templates; `gap-to-feature` route for category `trace_store_reconciliation` → goal-host `/run-goal` with `target_template_id: development-vessel:trace-store-reconcile`. 24 new tests pass; lint/shape-dispatch check 215 shapes / 218 cases agree.
- Tick driver: `trace-store-health-check.{service,timer}` (10-min cadence, model: db-contention-check) + `scripts/substrate/trace-store-health-check.ts`.
- Counters row initialized `row_count = 40851`; demo config `cap = 25000`, `hotWindowDays = 3` (store is intentionally over cap so the first observer tick triggers the cadence; ground rule "lower the cap for the demo").
- Seeding: `trace-store-reconcile` minted into the catalogue. The observer *tick template* was refused by the REUSE_BEFORE_MINT gate (existing `substrateGap` producers) — non-blocking: the tick unit fires the resolver directly, same as db-contention-check. Recorded as a correct gate behavior, not a defect.

**Restart order honored:** surrealdb → identity/discovery (never stopped) → activity-api (migrations via ExecStartPre) → vessels → timers → **self-recovery unmasked + re-enabled last**, after pushing both vessel commits to origin/dev (so self-recovery/pull-sync revert-to-origin now includes the primitives).

**Commits:** activity-api `3f378ae`, development-vessel `9674cb8`, super-repo `fec3a157` (all pushed to origin dev).

## Autonomous cadence (hands-off, tasks 22–23)

**First full cadence (2026-07-09, hands-off):** the observer emitted gap `trace-store-reconcile-2026-07-09T02` (category `trace_store_reconciliation`, source `substrate_detected`, created 02:46Z). The gap route dispatched `development-vessel:trace-store-reconcile`, which completed as `exec_2ulr7ddi` — 5/5 tasks, lease acquired and released cleanly, `over_cap:false` at the verify step. Gap closed 07:15Z after operator trace inspection; operator verdict recorded to the oracle corpus as `goal_verification_labels:oqw59komnsn22auj38sw`.

**Cadence resilience observed (2026-07-12):** with `trace-store-health-check.timer` dead (disabled, no journal entries this boot) and `db-contention-check.timer` absent from the schedule, the store was nonetheless reconciled again at 12:05Z (`last_reconciled_at` in `/metrics/db`; counters 21,970 vs cap 25,000 after regrowth from the 40,851 seed). Journal evidence in the same window shows the REUSE_BEFORE_MINT gate deflecting a proposed duplicate (`…trace-store-reconcile⟩-1783857041042`) onto the existing template — i.e. the reconcile was selected condition-driven through the walk, not by the tick unit. The cadence survives the loss of its timer, which is the law-5-correct behavior; the timer is a redundant pulse, not the mechanism.

**Residual gaps found during the 2026-07-12 inspection (filed, not hand-fixed):**
- Counter drift: counters reported 21,970 rows while `db_admin diagnose` counted 17,309 actual (~21% overcount; fire-and-forget increments miss delete/expiry paths). Filed as gap `trace-store-counter-drift-2026-07-12`.
- Whole-store pressure blindness: with AET under cap, `/metrics/db` showed p95 1875 ms / 2095 slow queries / 3.1% error rate all day and no gap was filed — the observer senses one table's row count, not the store's vitals. Dispatched as goals `9d4d00f4` (diagnose + classify the pressure) and `6c699b51` (standing condition-driven store-pressure sensing). **Both fell short of the contract:** `9d4d00f4` scored `reached: yes` off a meandering walk that produced nothing (hollow reach; operator label `not_reached` recorded, `goal_verification_labels:nkktd0xv0w7xa1fbjo8u`); `6c699b51` inferred the right targets (confidence 0.87) but terminated "no producer" for `substrateGap_write` — a shape development-vessel demonstrably serves — and its auto-draft fallback gaps closed as "completed" with nothing authored. Pre-selection terminations also cannot receive oracle labels (`provide_feedback` requires a selectedTemplateId). Filed as gaps `walk-blind-to-vessel-resolver-producers-2026-07-13`, `auto-draft-gaps-close-hollow-2026-07-13`, and `store-pressure-invisible-to-sensing-2026-07-13` for the underlying condition.
