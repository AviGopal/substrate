# Tasks

## Immediate unblock (operator — ops action, not authorable by the down loop)
- [ ] Restore `local-tools-vessel` on the hub (`138.197.116.56`) so `shellResult` has a live producer co-located with `feature_compose`. Verify `vesselCapability shellResult` → 1 producer and an edit-intent dispatch passes endpoint discovery.
- [ ] Re-run the 2026-07-05 four-capability tutoring set once unblocked (re-scope-on-repeated-failure, bind-lessons path gate, blast-radius blocked_count, audit-the-gates read case) and evaluate whether the substrate decomposes over-bundled edit goals unaided.

## Spoke self-sufficiency invariant (substrate-authorable once unblocked)
- [ ] Extend `advertised_shape_coverage_scan` consumer set: a spoke advertising `feature_compose` is checked for the self-edit bundle shapes (`shellResult`, `fs_read`, `fs_write`, `fs_edit`, `patch_with_tools`, `llm_completion`); a missing producer files a `substrateGap` naming the shape + spoke.
- [ ] Document the self-edit spoke bundle (`goal-host + dev-vessel + local-tools + reachable llm-resolver`) as the composition a developing spoke enables.

## Cross-location cutover
- [ ] Add a pull-from-upstream convergence mode: a running location pulls `origin/dev` + restarts its own unit on a deploy signal, independent of a co-located editor (generalizes the existing best-effort `fetch origin/dev` in vessel-mitosis-cutover.ts).
- [ ] Both cutover modes terminate at `interface_deploy_reach_check` (healthy | unscored_absent | regressed); regression rolls back with a β-penalty.
- [ ] Deploy-signal path for a vessel whose runtime is on a different machine than the editor spoke (alternate-deploy precedent: obsidian-vessel host mount).

## Cross-spoke ownership
- [ ] Ownership convention: each spoke scoped to the vessels it owns (or branch/worktree isolation) so inter-spoke `origin/dev` pushes don't race the same compose lock/branch.

## Depends on
- [ ] `2026-07-04-single-transport-story`: reachability described by discovery registration; cross-machine resolves ride the federation egress, not loopback.
