# Tasks — substrate self-managed DB reconciliation

## A. Preparation

- [ ] 1. Baseline survey: AET row count, cold-query latency, index/view inventory, DB file size; record in design.md and VERIFY doc.
- [ ] 2. Quiesce the fleet: `systemctl stop` **and mask** `self-recovery.timer` + `self-recovery.service`; stop all interfering timers (boredom, gap-compose, funnel-drain, db-maintenance, db-contention-check, substrate-pull-sync, self-repair-operational, surgical-gap-scan, operator-goal-generator, light-dispatch-healthcheck, autonomy-metrics, auto-describe-resolvers, observe-orthogonal-refresh, model-reality-audit, spectral-gap, m1-trainer, self-operational-health, composition-edge-reconcile) and services (boredom, light-dispatch, development-vessel, goal-host, ribosome, metric-collector, relevance-sink, federation-transport, analysis, concept-db, activity-api). Verify nothing is probing (journal quiet, no AET writes).
- [ ] 3. Full `surrealdb export` backup to `/workspace/db-backups/`, verify file is non-trivial in size. **No backup → stop and report.**

## B. One-time table swap (quiesced window)

- [ ] 4. Snapshot AET DDL (`INFO FOR TABLE`) to `/workspace/db-backups/`; finalize load-bearing index list and view definitions.
- [ ] 5. Copy keep-set to unindexed `activity_execution_traces_next`: hot window (`executed_at > now - 14d`, indexed range) + stratified reservoir (bounded per-activity `ORDER BY executed_at DESC LIMIT 25` over `idx_aet_activity_id_executed_at`).
- [ ] 6. Verify `_next` counts; REMOVE 3 views; `REMOVE TABLE activity_execution_traces`; redefine fields + load-bearing indexes once; copy back from `_next`; `REMOVE TABLE _next`; redefine views.
- [ ] 7. Post-swap verification: row count, cold `ORDER BY executed_at DESC LIMIT 100` < 500 ms, `EXPLAIN` uses index.

## C. Primitives (land in the same window, `SUBSTRATE_ALLOW_DIRECT_EDIT=1`)

- [ ] 8. Migration `155-trace-store-counters.surql`: `trace_store_counters` table (idempotent DEFINE IF NOT EXISTS) + seed row from post-swap count.
- [ ] 9. Insert-path increment at both AET INSERT sites (`execution-traces.ts`, `activities.ts`) — root path, fire-and-forget.
- [ ] 10. Retention/evolution config in activity-api (`traceStore: cap/hotWindowDays/reservoirPerActivity`, env-overridable); expose counters+cap read surface. No global GROUP BY.
- [ ] 11. `maintenanceLease` resolver in development-vessel (file-backed, acquire/renew/release/status, TTL, atomic writes) + wire into `routes/impulses.ts` + advertise shapes.
- [ ] 12. Pausable-citizen guard in `fetchWithRetry` (`http-retry.ts`): skip trace-store reads while an unexpired lease is held; fail-open.
- [ ] 13. `trace_store_health_observer` resolver: read counters vs cap → `substrateGap_write` category `trace_store_reconciliation`, hour-bucketed dedup id.
- [ ] 14. Seed tick template `development-vessel:trace-store-health-observer` in `src/seed/` + `SEED_TEMPLATES`.
- [ ] 15. `db_admin` op `reconcile_trace_store` in activity-api: lease-token-gated, `dry_run` default true, fixed table names, audit rows to `db_admin_audit`, executes the bounded copy-forward swap, resets counters.
- [ ] 16. Seeded `trace-store-reconcile` activity template (lease acquire → reconcile live → verify → release, release-on-failure) in dev-vessel seed.
- [ ] 17. `gap-to-feature` route: `trace_store_reconciliation` → dispatch `trace-store-reconcile` via goal-host `/run-goal` with `target_template_id`.
- [ ] 18. Tests (`bun test`): lease resolver lifecycle, guard skip/fail-open, counters increment, reconcile op dry-run + lease refusal, observer gap emission.

## D. Restart, re-seed, verify

- [ ] 19. Sync sources into container (`docker cp` activity-api `src/`+`sql/`; `make sync-development-vessel`); restart in dependency order (surrealdb → identity → discovery → activity-api → vessels → timers); **unmask + re-enable self-recovery last**; re-seed: POST new templates to `/v2/activities/templates` (cold-start guard skips them otherwise) + bootstrap-seeder.
- [ ] 20. Fleet verification: `/health` green fleet-wide; cold `ORDER BY ... LIMIT 100` < 500 ms; counters incrementing on fresh traces; observer plan shows no `Iterate Table` over AET.
- [ ] 21. Commit: vessel repos on `dev` + super-repo pointer bump + this change dir.

## E. Autonomous cadence (hands off — observe via MCP only)

- [ ] 22. Lower cap (or let store regrow) and observe: `trace_store_health_observer` emits the `trace_store_reconciliation` gap → gap-compose/drain loop dispatches `trace-store-reconcile` → it acquires its own lease → swaps → releases → reach-gate reports `reached: true`. Judge by `reached`, not `status`. No parallel operator dispatch of the same work.
- [ ] 23. Record the cadence in a VERIFY doc (`VERIFY.md` in this change dir) and `provide_feedback` on the dispatch (verdict → oracle corpus).
