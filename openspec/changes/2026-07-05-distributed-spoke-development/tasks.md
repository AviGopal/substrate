# Tasks

## Immediate unblock (DONE 2026-07-05)
- [x] Restore `local-tools-vessel` on the hub — unit was loaded-but-disabled+dead; started via the substrate's own `systemd_restart` resolver. `shellResult` now resolves (registry 7 vessels); edit-intent dispatches pass endpoint discovery.
- [ ] Re-run the 2026-07-05 four-capability tutoring set now that the loop is unblocked (re-scope-on-repeated-failure, bind-lessons path gate, blast-radius blocked_count, audit-the-gates read case) and evaluate whether the substrate decomposes over-bundled edit goals unaided.

## PROPAGATION + OPERATING MODEL (hub = pull-only, don't develop on the hub)
- [x] Force-propagated the stranded substrate change to origin/dev (`development-vessel` `e836774`) — replayed onto the REAL tip, not the hub's stale base (the hub committed `5381b04` on stale `0114038` because its in-container fetch failed). Content byte-identical + typecheck-clean; substrate-attributed.
- [x] **Credential is VALID (operator-confirmed); the failure was git wiring.** Plain `git fetch` in the container has no credential helper, but the substrate's own `git-push-setup.service` injects the valid token. Re-ran it → the dev-vessel clone pulled origin/dev (stale `0114038`/`5381b04` → HEAD+origin/dev = `e836774`). Hub CAN pull from dev via its own mechanism. Clone drift reconciled.
- [x] **Policy set: the hub does not develop; it converges by pulling `origin/dev`.** Runtime already carries the change (IIFE present).
- [x] **`pull_cutover` capability authored BY THE SUBSTRATE** (coaxed via feature_compose): new resolver `src/resolvers/pull-cutover.ts` + shape registered in config.ts + dispatch case in impulses.ts (three-place, one shot, FAVORABLE). Pointer `{ type:"pull_cutover", vessel_name, dry_run? }`: restart git-push-setup (pull origin/dev into clone) → copy clone `src` → `/vessels/<v>/src` → restart unit. Verified: advertised in discovery, dry-run returns `{pulled:true, deployed:false, restarted:false}`. Propagated to origin/dev (`d245022`). NOTE: three-place NEW-resolver authoring works first-try; internal multi-site EDITS to big files do not (drafter ceiling).
- [x] **`pull_cutover` made idempotent** (substrate-authored via 3 insertion/single-token coaxes, origin/dev `0ed07cd`): (a) early rev-parse-vs-marker no-op guard, (b) marker persisted BEFORE the self-restart (else the self-restart of development-vessel truncated the write), (c) `cp -a`→`cp -aT` so the deploy overwrites instead of nesting into `dest/src`. Proven: real deploy converges (`diff` empty), re-run no-ops (PID unchanged).
- [x] **Scheduled** — `pull_cutover` goal added to boredom `AUTONOMOUS_GOALS` (origin/dev `de87042`, boredom commit `6561c67`): "run the pull_cutover activity for vessel development-vessel to converge it to the latest origin/dev". Routing VERIFIED: dispatching the goal reaches `pull_cutover` (walk: inferred_target_shapes:["pull_cutover"] → satisfier → reached, no error). The ongoing hub-pulls-from-dev loop is wired.
- [x] Dogfooded end-to-end: invoked `pull_cutover` for boredom-vessel → `{pulled,deployed,restarted}` all true, healing the drift below (runtime == origin/dev, `diff` empty).
- [ ] **Follow-up — drafter stale-base collateral (recurring reliability gap):** feature_compose sometimes stages off a STALE base (in-container fetch lag), so a "single insertion" patch can also carry collateral DELETIONS that still typecheck (FAVORABLE misses them). Observed twice: the pull_cutover scheduling patch would have deleted `sf-coverage-replay-tick`; earlier the placement change committed on stale `0114038`. The supervising agent stripped the collateral during propagation, and boredom drift was healed via pull_cutover. Fix direction: ensure `git fetch`/reset-to-origin-dev BEFORE compose staging, and/or a detector that flags a compose diff whose deletions exceed the stated scope.
- [ ] **Follow-up — vessel_name via NL inference:** the boredom goal binds `vessel_name` through goal-host NL inference (worked, resolver ran no-error). If it ever errors on missing vessel_name, have boredom pass structured `variables` instead of relying on inference.
- [ ] **Follow-up — extend the pull schedule to all runtime vessels** (not just development-vessel) so any vessel's drift self-heals on cadence; today only development-vessel is scheduled.

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
