## Context

A compose is a pipeline: draft → apply → verify → semantic gate → cutover (commit, push,
schedule self-restart). Cost is front-loaded (draft and two suite runs, 5–14 minutes);
the cutover is seconds. Today the pipeline is one HTTP request and one isolated
workspace, both of which die with the process or with a refused cutover. Everything up
to the gate already produces durable artefacts (a report under `/workspace/proposals`,
the applied diff in the workspace), so the change is to make the *patch* the unit of
work rather than the request.

Evidence for every number in the proposal is in the validation report
`validation/reports/acceleration-baseline/MEMORY-SPLIT-AND-RETIRE-SELF-REPAIR-2026-09-22.md`
(sections 07:11Z through 09:10Z on 2026-09-24) and on the gap records named in tasks.md.

## Goals / Non-Goals

Goals: a verified patch is never discarded because of *when* its cutover ran; a
restart never kills work it could have waited a minute for; a maintenance hold on one
resource does not block landings on another; the class is detected without an operator.

Non-goals: zero-downtime process replacement; changing how the reconcile prunes the
trace store; changing compose capacity or the drafter.

## Decisions

**Park after the gate, not after verify.** The judge is the last expensive, fallible
step; parking before it would resume patches the judge would have refused. Parking after
it means a resumed landing re-runs only typecheck (cheap, deterministic, catches base
drift) and the cutover's own freshness gate.

**The park is a file impulse, not a DB row.** `/workspace/parked-landings/<gap-id>.json`
with `{ gap_id, compose_id, base_sha, files: [{path, diff}], verify: {tc, sd, tests},
judge: {addresses, reason}, parked_at, reason }`. Same pattern as the gap store and the
maintenance lease (atomic tmp→rename). One park per gap; a newer park replaces an older.
`parked_landing_ttl` is read from a shaped impulse at resume time (default 24 h).

**Resume is a pick, not a timer.** `gap_to_feature` already picks gaps; when the picked
gap has a fresh park it dispatches `feature_compose` with `resume_from: <park>` and the
compose skips draft and verify. This keeps pace in the selector (law 5) and gives the
resumed landing a trace.

**The live-tree undo stays.** A deferred cutover still restores `/vessels`; the park is
what survives, not the workspace. The eleven-concurrent-cutovers gap shows that keeping
staged roots alive across attempts creates its own races.

**Drain sized to the stage.** With parking, the only thing a drain must protect is a
cutover in progress (commit + push, under a minute). The drain default becomes
`CUTOVER_STAGE_MS + 60 s`; composes in draft or verify are parked at their last completed
stage on SIGTERM instead of waited for. pull-sync's deferral keys on the age of the oldest
in-flight request reported by `/health` (`in_flight_oldest_ms`, new field) exceeding
`COMPOSE_CEILING_MS`.

**Lease names are additive.** `maintenanceLease_write` keeps its unnamed behaviour for
existing callers; a `name` writes `maintenance-<name>.json` beside the global file. A
named acquire is refused if the *same* name is held or if the *unnamed* global is held
(an unnamed hold still means "everything"); an unnamed acquire is refused if any named
hold exists. Readers that skip trace-store cycles on "a lease is held" keep working. One reader
bypasses the resolver: activity-api's `db_admin reconcile_trace_store` validates the
caller's `lease_token` by reading `maintenance.json` directly, so it must learn the
named files before the reconcile takes a name (task 3.4).

**Seed caveat.** `development-vessel-seed` skips a populated catalogue, so an edit to
`src/seed/trace-store-reconcile.ts` is inert on a running substrate (gap
`a-landing-in-a-seed-template-file-is-inert…`). The reconcile's timeout and failure-path
release must reach activity-api either through the seeder upserting changed bodies or
through selection of the registered variant that already carries the timeout
(`…-swap-timeout-15min`), which needs the family sampler to page the templates listing
(limit is clamped to 100). Both are tasks below; the spec requirement is on the
behaviour, not the path.

## Risks / Trade-offs

- A park re-applied onto a moved base can apply cleanly and be wrong. Mitigation: the
  cutover's freshness gate and typecheck still run; parks older than the TTL are
  dropped; a resumed landing is registered as an attempt with `resumed_from`.
- Named leases split a mutex that some reader may have relied on for total exclusion.
  Mitigation: unnamed holds still exclude everything; only holders that opt into a name
  narrow their exclusion.
- Shorter drains kill more draft/verify stages. That is intended: those stages are now
  resumable from the park, or cheap to redo if nothing was parked yet.

## Migration

Nothing to migrate. Parks are created only by the new code; absent parks mean today's
behaviour. The lease file format is unchanged for unnamed holders.
