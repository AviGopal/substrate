# Tasks

## Immediate unblock (DONE 2026-07-05)
- [x] Restore `local-tools-vessel` on the hub — unit was loaded-but-disabled+dead; started via the substrate's own `systemd_restart` resolver. `shellResult` now resolves (registry 7 vessels); edit-intent dispatches pass endpoint discovery.
- [ ] Re-run the 2026-07-05 four-capability tutoring set now that the loop is unblocked (re-scope-on-repeated-failure, bind-lessons path gate, blast-radius blocked_count, audit-the-gates read case) and evaluate whether the substrate decomposes over-bundled edit goals unaided.

## PROPAGATION + OPERATING MODEL (hub = pull-only, don't develop on the hub)
- [x] Force-propagated the stranded substrate change to origin/dev (`development-vessel` `e836774`) — replayed onto the REAL tip, not the hub's stale base (the hub committed `5381b04` on stale `0114038` because its in-container fetch failed). Content byte-identical + typecheck-clean; substrate-attributed.
- [x] **Credential is VALID (operator-confirmed); the failure was git wiring.** Plain `git fetch` in the container has no credential helper, but the substrate's own `git-push-setup.service` injects the valid token. Re-ran it → the dev-vessel clone pulled origin/dev (stale `0114038`/`5381b04` → HEAD+origin/dev = `e836774`). Hub CAN pull from dev via its own mechanism. Clone drift reconciled.
- [x] **Policy set: the hub does not develop; it converges by pulling `origin/dev`.** Runtime already carries the change (IIFE present).
- [ ] **Build the ongoing pull-cutover loop.** `git-push-setup` is boot-only (no timer). Add a periodic pull-cutover: run the setup fetch → reset clone to origin/dev → copy to `/vessels/<v>` → restart unit → `interface_deploy_reach_check`. This is the pull-from-upstream mode; it also converges the runtime's remaining base drift (`0114038..ad8d843`).
- [ ] Minor: give ad-hoc container `git` a credential helper so plain `git fetch` works too (optional; setup-git-push path already works).

## Placement-by-data-locality invariant (substrate-authorable once unblocked)
- [x] Extend `advertised_shape_coverage_scan` for locations advertising `feature_compose` (substrate-authored via feature_compose, commit `5381b04`, live in runtime): emits `feature_compose_locations_missing_local_toolbelt` with location-stateful (`shellResult`, `fs_*`, `patch_with_tools`) vs location-independent (`llm_completion`) classes.
- [ ] **Refine "local" from same-vessel to same-LOCATION.** The landed v1 checks whether the SAME `vesselId` advertises the location-stateful shape, so it false-positives dev-vessel as missing `shellResult` (which local-tools serves in the same container). Distinguishing "co-located" needs a location/machine identity — loopback registrations can't provide it. Blocked on routable endpoints (`2026-07-04-single-transport-story`); until then, treat loopback-host co-residency as same-location.
- [ ] File the finding as a `substrateGap` (currently the detector only reports; wire the gap write) so the gap→feature loop can act on it.
- [ ] Document the self-edit bundle as data-locality, not self-sufficiency: co-locate `local-tools` with `feature_compose` (both on one checkout); `llm_completion` reachable; the trace store / Thompson / oracle stay the hub singleton (never duplicated onto a location).

## Cross-location cutover
- [ ] Add a pull-from-upstream convergence mode: a running location pulls `origin/dev` + restarts its own unit on a deploy signal, independent of a co-located editor (generalizes the existing best-effort `fetch origin/dev` in vessel-mitosis-cutover.ts).
- [ ] Both cutover modes terminate at `interface_deploy_reach_check` (healthy | unscored_absent | regressed); regression rolls back with a β-penalty.
- [ ] Deploy-signal path for a vessel whose runtime is on a different machine than the editor spoke (alternate-deploy precedent: obsidian-vessel host mount).

## Cross-spoke ownership
- [ ] Ownership convention: each spoke scoped to the vessels it owns (or branch/worktree isolation) so inter-spoke `origin/dev` pushes don't race the same compose lock/branch.

## Depends on
- [ ] `2026-07-04-single-transport-story`: reachability described by discovery registration; cross-machine resolves ride the federation egress, not loopback.
