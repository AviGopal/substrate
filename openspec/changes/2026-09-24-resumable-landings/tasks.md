## 1. Parked landings (development-vessel)

- [ ] 1.1 `feature-compose.ts`: write `/workspace/parked-landings/<gap>.json` after the semantic
  gate passes and before `resolveVesselMitosisCutover`; delete it on `push_status: pushed`;
  set `parked: true` in the report otherwise. Falsifier: hold the lease by hand for 3 min
  during a byte-exact compose; the park file exists with the diff; release; the next pick
  resumes and pushes an identical diff. Control: a normal landing leaves no park.
- [ ] 1.2 `gap-to-feature.ts`: in the pick, if a park younger than `parked_landing_ttl` exists
  for the gap, dispatch `feature_compose` with `resume_from`. Falsifier: journal shows
  `RESUMING parked landing` and no drafter call for that compose.
- [ ] 1.3 `feature-compose.ts`: `resume_from` path — re-apply, typecheck only, cutover; `park_stale`
  lesson when the diff does not apply. Falsifier: move the base under a park (land an
  unrelated change to the same file); the park is dropped with the lesson.
- [ ] 1.4 `index.ts` SIGTERM handler: park post-gate composes; do not wait for pre-gate ones.
  Falsifier: restart during `bun test` → prompt drain, no park; restart after gate → park.
- [ ] 1.5 Detector: `discardedLandingReport` sweep and the day-keyed gap. Falsifier: one
  refused landing → count 1 and the gap open; a clean hour → no gap.

## 2. Restart budgets

- [x] 2.1a `index.ts`: `/health` gains `in_flight_oldest_ms`. Landed by the substrate as
  development-vessel `883640f`; runtime equals the commit, the process restarted after it, and
  `/health` reads `null` idle and a growing age (16688 → 40346 ms over 30 s) with two in flight.
- [ ] 2.1b `index.ts`: drain deadline = cutover stage + 60 s — dispatched together with 1.4 (same
  file, same loop; see `goals/1.4-drain-waits-for-cutovers.txt`).
- [ ] 2.2 (operator tier) `scripts/substrate/substrate-pull-sync.sh`: defer by
  `in_flight_oldest_ms` vs `COMPOSE_CEILING_MS`; unit `TimeoutStopSec` ≥ drain. Falsifier:
  three busy runs with young work → no restart; oldest > ceiling → restart with age in the
  breadcrumb. Status: both pull-sync restart sites now decide through one `restart_age_defer`
  helper (installed in the container); stubbed scenarios pass; `TimeoutStopSec` is 5 min ≥ the
  240 s drain. The live falsifier waits on 2.1 — until `/health` publishes `in_flight_oldest_ms`
  the helper falls back to the old count bound.

## 3. Named change windows

- [x] 3.1 `maintenance-lease.ts`: `name` on acquire/renew/release/resolve; per-name files;
  union semantics. Falsifier: unit — two names coexist; unnamed excludes all.
  - [x] 3.1a-i acquire + read. Landed by the substrate as development-vessel `ace49c0` (earlier
    drafts anchored on `const existing = await readLease();`, which occurs three times; the
    landing goal quoted unique multi-line anchors). Runtime equals the commit; falsifier passed
    against the landed file: two names coexist in separate files, same name refused to another
    holder, named acquire refused during an unnamed hold, named read sees the global hold.
  - [x] 3.1a-ii renew + release honour `name`. Landed as development-vessel `e17ea38`; runtime
    equals the commit; falsifier passed: named renew moves only the named file's expiry, named
    release deletes only its own file, unnamed release unchanged.
  - [x] 3.1b unnamed acquire refused while any named hold exists; union read with `holds[]`;
    unnamed release finds a named hold by token. Landed as development-vessel `4e40707`; the
    landed file equals the version whose falsifier was run before dispatch (unnamed acquire
    refused by a named hold, unnamed read lists it, unnamed release deletes it, empty-store
    behaviour unchanged). Two earlier drafts were refused by gate defects, not by the patch:
    the stub detector read `? {}` after a call as an empty function body, and the test gate
    charged three failures that also fail on the unmodified base.
- [x] 3.2 `vessel-mitosis-cutover.ts`: acquire with name `cutover` (both the soft-refuse check
  and the 90 s wait). Falsifier: cutover pushes while `trace_store` is held.
  Landed as development-vessel `0b06246`: all eight lease calls in the file (acquire, bounded
  retry, git-aware acquire, proposal acquire and all four releases) carry `name: "cutover"`;
  runtime equals the commit and the process restarted after it. The live half of the
  falsifier (a push while `trace_store` is held) waits on 3.3a — until the reconcile takes its
  own name it still holds the unnamed global, which excludes every name.
- [ ] 3.3 Reconcile: name `trace_store`, failure-path release, fetch timeout ≥ valve. Measured
  facts that shape the path: the registered base template has no `timeoutMs` on its reconcile
  task (15 s `http_fetch` default) although the seed source carries 900 s — the seeder is
  SEED-IF-EMPTY (`cli.ts`) and never upserts a changed body; paging `/templates` is unstably
  ordered (2771 rows, 2719 unique ids) so the family sampler never draws the
  `…-swap-timeout-15min` variant; and the executor has no failure-path task semantics
  (`ias-executor-ts/src/engine.ts` throws out of the task loop), so no template ordering can
  release on a reconcile failure.
  - [ ] 3.3a `src/seed/trace-store-reconcile.ts` (split: 3.3a-i names acquire and release
    `trace_store`; 3.3a-ii moves `verify` after `release_lease`): acquire and release with `name: "trace_store"`,
    reconcile `timeoutMs` ≥ the valve, `release_lease` marked to run on failure (3.3c).
  - [ ] 3.3b The seeder upserts a seed template whose body differs from the registered row
    (`POST /v2/activities/templates` upserts by id and keeps the posterior). Without it 3.3a is
    inert on every running substrate.
  - [ ] 3.3c `repos/ias-executor-ts/src/engine.ts`: a task flagged `always: true` runs after an
    earlier task throws, before the error propagates.
  Falsifier: a reconcile run without `fetch failed: The operation was aborted`; no lease file
  within a minute of completion; cutovers no longer log
  `REFUSE: maintenance change_window lease held`.
- [x] 3.4 `repos/activity-api/src/routes/db-admin-reconcile.ts`: `validateMaintenanceLease` accepts a
  token carried by ANY unexpired lease file in the lease directory (`maintenance.json` or
  `maintenance-<name>.json`), not only the unnamed file. Without it a reconcile holding
  `change_window:trace_store` is refused at the db_admin route (`maintenance lease not found`)
  because activity-api reads the unnamed file directly. Must land before 3.3 names the
  reconcile's lease. Falsifier: unit — a token held under `maintenance-trace_store.json`
  validates; a token held nowhere is refused.
  Landed by the substrate as activity-api `1055cba`; runtime file equals the commit, the unit
  restarted after it, and the falsifier passed in-container (named token valid with the primary
  missing, mismatched or expired; unknown token returns the primary's original error).

## Dispatch notes

One file per goal. Quote the exact old and new lines in the goal and state the fact a
refuter is likely to dispute (the semantic gate short-circuits its refuters on a
spec-exact patch, `7ab6155`/`1746f5a`). Dispatch so the cutover lands outside the
reconcile's hold (currently :x3:49–:x8:49 every ten minutes) until 3.2 lands. After each
landing: runtime file equals the commit, the process started after it, then the
falsifier — a seed-file landing is inert until 3.3(a) or (b), so check the consumer.
Open gaps carrying the measurements: `every-restart-budget-is-shorter-than-a-compose…`,
`a-verified-patch-is-rolled-back-when-the-change-window-lease-is-held…`,
`a-failing-trace-store-reconcile-re-takes-the-single-global-change-window…`.
