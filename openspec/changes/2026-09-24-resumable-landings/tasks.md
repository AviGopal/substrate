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

- [ ] 2.1 `index.ts`: `/health` gains `in_flight_oldest_ms`; drain deadline = cutover stage + 60 s.
- [ ] 2.2 (operator tier) `scripts/substrate/substrate-pull-sync.sh`: defer by
  `in_flight_oldest_ms` vs `COMPOSE_CEILING_MS`; unit `TimeoutStopSec` ≥ drain. Falsifier:
  three busy runs with young work → no restart; oldest > ceiling → restart with age in the
  breadcrumb.

## 3. Named change windows

- [ ] 3.1 `maintenance-lease.ts`: `name` on acquire/renew/release/resolve; per-name files;
  union semantics. Falsifier: unit — two names coexist; unnamed excludes all.
- [ ] 3.2 `vessel-mitosis-cutover.ts`: acquire with name `cutover` (both the soft-refuse check
  and the 90 s wait). Falsifier: cutover pushes while `trace-store` is held.
- [ ] 3.3 Reconcile: name `trace-store`, failure-path release, fetch timeout ≥ valve. Path:
  either (a) seeder upserts changed template bodies (gap
  `a-landing-in-a-seed-template-file-is-inert…`) or (b) the family sampler pages the
  templates listing so the `…-swap-timeout-15min` variant can be selected (gap
  `the-trace-store-reconcile-remedy-pins-the-base-template-id…`). Falsifier: a reconcile
  run without `fetch failed: The operation was aborted`; `maintenance.json` absent within a
  minute of completion; cutovers no longer log `REFUSE: maintenance change_window lease held`.

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
