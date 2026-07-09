# Substrate self-managed DB reconciliation

## Why

The trace store (`activity_execution_traces`, "AET") has grown to ~219k rows / 13 GB with 23 indexes (including exact duplicates) and 3 materialized views. A full-table count takes ~86 s; unbounded reads wedge the learning loop and every observer that touches traces. A previous manual shrink attempt failed twice: (a) per-row bulk DELETE measured >190 s for 500 rows, (b) `self-recovery.service` restarted and git-reverted vessels mid-window.

Beyond the one-time repair, the substrate must own this maintenance itself: detect trace-store bloat, dispatch a reconcile activity, take a maintenance lease so citizen observers pause, swap the table, release, and have the reach-gate verify it — a full autonomous cadence.

## What Changes

1. **One-time repaired baseline (operator-run, quiesced window):** full DB export backup, then copy-forward table-swap shrink of AET (keep-set = recent hot window + stratified reservoir), reduced load-bearing index set, views redefined.
2. **`trace_store_counters`** table (migration 155) + increments on both AET insert paths — O(1) size accounting, no global scans ever again.
3. **Retention/evolution config** in activity-api (cap, hot-window days, reservoir size per activity) — no global GROUP BY anywhere.
4. **`maintenanceLease` resolver** (development-vessel, file-backed at `/workspace/leases/`) — acquire/renew/release with TTL and token.
5. **Pausable-citizen guard** in the shared observer fetch helper (`fetchWithRetry`): when a maintenance lease is held, observers skip their fetch cycle (fail-open on any error).
6. **`trace_store_health_observer`** resolver + seeded tick template: reads counters vs cap, emits `substrateGap_write` with category `trace_store_reconciliation` (hour-bucketed dedup).
7. **Lease-gated `db_admin` op `reconcile_trace_store`** (activity-api): dry-run default, fixed table names, audit rows to `db_admin_audit`, performs the copy-forward swap bounded by counters/indexed ranges.
8. **Seeded `trace-store-reconcile` activity** + `gap-to-feature` route for the new gap category → the drain/compose loop dispatches the reconcile through goal-host.

## Impact

- Affected: `repos/activity-api` (migration, config, insert paths, db-admin op), `repos/development-vessel` (lease resolver, observer, guard, seed templates, gap routing), `scripts/substrate` (window runbook artifacts).
- Risk: destructive table swap — mitigated by mandatory verified export backup, quiesced+masked fleet, dry-run-default op, fixed table whitelist.
- Deliverable: one verified autonomous cadence (gap → dispatch → lease → swap → release → `reached: true`), recorded in a VERIFY doc with operator feedback into the oracle corpus.
