## Why

The lane pays for a landing three times and keeps it once. A compose drafts (LLM),
verifies (typecheck, shape-dispatch, two suite runs) and passes the semantic gate, then
the cheap last step — the cutover — fails to run at that moment and the whole result is
discarded: the isolated workspace is deleted and the live tree is restored. Measured on
development-vessel between 04:14Z and 09:23Z on 2026-09-24: 25 cutover verdicts FAVORABLE,
0 UNFAVORABLE; 7 verified landings refused because the `change_window` lease was held,
each followed by `live-sync rollback`; 4 more composes killed at the 240 s SIGTERM drain
deadline; 24 vessel restarts (9 from the vessel's own landings, 5 from pull-sync, the rest
drains and deferrals). Roughly a third of verified work was thrown away after it had
already passed every gate.

Two structural facts produce this, and neither is a drafter fault:

1. **Every budget that decides whether a restart waits is shorter than a compose.** The
   vessel drain is 240 s; pull-sync defers an owed restart for at most three of its
   ten-minute runs and then restarts "despite N in flight"; only the mitosis quiesce
   (16 min) is sized to the 15-minute compose ceiling. A count of busy polls breaks
   starvation against a lane that is never idle, not against a stuck compose.
2. **The `change_window` lease has no name dimension.** `vessel-mitosis-cutover` and the
   `trace-store-reconcile` activity take the same global mutex although they touch
   different resources. The reconcile runs every ten minutes from a timer, fails at a
   15 s fetch against a 376 s pruning valve, never reaches its release step, and holds the
   window for its full 5-minute TTL — half of wall-clock — while cutovers are refused
   against it.

Constant availability is the wrong invariant for a vessel that must load its own new
code: there is always a process boundary. The durable answer is to make a landing
**resumable** — park the verified artefact and finish it after the interruption — and to
size the remaining budgets to the stage they protect. This change specifies that, as
requirements the substrate can land one file at a time, each with a falsifier an
operator or a sweep can exercise.

## What Changes

- **Parked landings.** After verify and the semantic gate pass, a compose SHALL persist a
  `parkedLanding` (gap, base sha, applied diff, verify summary, judge verdict) before the
  cutover. A refused, deferred or interrupted cutover leaves the park in place; the
  live-tree undo still runs (an uncommitted edit would poison the next baseline). The next
  pick for that gap re-applies the parked diff onto the current base, re-runs typecheck
  only, and cuts over — no redraft, no second suite run. A park that no longer applies
  cleanly, or is older than a shaped `parked_landing_ttl`, is dropped with a lesson.
- **Restart budgets keyed on age, not counts.** The vessel's SIGTERM drain SHALL outlive
  the longest stage it can be asked to protect; with parking in place that is the cutover
  stage, not the compose. pull-sync's owed restart SHALL defer while `in_flight > 0` until
  the oldest in-flight request is older than the compose ceiling, instead of after a
  fixed number of busy observations. The mitosis quiesce is unchanged.
- **Named maintenance windows.** `maintenanceLease_write` SHALL accept a `name`; a holder
  of `change_window:trace_store` does not exclude a holder of `change_window:cutover`.
  Cutovers and the reconcile take their own names; readers that want "any maintenance in
  progress" ask for the unnamed union. The reconcile template additionally SHALL release
  its lease on its failure path and set its fetch timeout to the valve's measured duration.
- **A detector for the class.** A scheduled sweep SHALL count verified-then-discarded
  landings (FAVORABLE gate, no `push_status: pushed`, live-sync rollback logged) per hour
  and file a gap when the count is non-zero, so the class cannot recur silently.

## Capabilities

### New Capabilities
- `parked-landing`: persistence and resumption of a verified, un-landed patch.
- `restart-budgets`: drain and deferral rules sized to the work they interrupt.
- `change-window-names`: a name dimension on the maintenance lease.

### Modified Capabilities
- `vessel_mitosis_cutover`: reads a park on entry; writes `deferred` with `retry_after_ms`
  only when a park exists.
- `feature_compose`: writes the park after the gate; honours a park on re-entry.
- `gap_to_feature`: prefers a fresh park over a redraft when picking a gap.

## Impact

- Files: `repos/development-vessel/src/resolvers/feature-compose.ts`,
  `repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts`,
  `repos/development-vessel/src/resolvers/gap-to-feature.ts`,
  `repos/development-vessel/src/resolvers/maintenance-lease.ts`,
  `repos/development-vessel/src/seed/trace-store-reconcile.ts` (see the seed caveat in
  design.md), `repos/development-vessel/src/index.ts` (drain deadline),
  `scripts/substrate/substrate-pull-sync.sh` and the unit's `TimeoutStopSec` (operator
  tier — not authorable by the substrate; listed so the split is explicit).
- Shapes: `parkedLanding` (new), `maintenanceLease_write` (gains `name`),
  `discardedLandingReport` (new, from the detector).
- Not in scope: blue-green per vessel. It removes the interruption for goal-host walks
  but is a port and unit-rendering change and does not address the lease case. Revisit
  after parking has been measured for a day.
