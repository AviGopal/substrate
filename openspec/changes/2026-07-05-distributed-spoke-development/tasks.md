# Tasks

## Immediate unblock (DONE 2026-07-05)
- [x] Restore `local-tools-vessel` on the hub — unit was loaded-but-disabled+dead; started via the substrate's own `systemd_restart` resolver. `shellResult` now resolves (registry 7 vessels); edit-intent dispatches pass endpoint discovery.
- [ ] Re-run the 2026-07-05 four-capability tutoring set now that the loop is unblocked (re-scope-on-repeated-failure, bind-lessons path gate, blast-radius blocked_count, audit-the-gates read case) and evaluate whether the substrate decomposes over-bundled edit goals unaided.

## PROPAGATION BOUNDARY — blocks distributed dev (operator decision)
- [ ] The substrate can author+typecheck+commit+deploy-to-runtime fully autonomously (proven: `5381b04`), but `git push origin dev` 403s (in-container credential is read-only) and no host-sync poller exists → substrate-authored commits are stranded in the container, never reaching origin. Pick a fix: (a) provision an in-container WRITE credential (docker-run-contract compliant), (b) implement the host-sync poller as a sanctioned alternate deploy (obsidian host-mount precedent), or (c) accept manual push. Without one, no location can pull what another authored.

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
