# Tasks: Substrate Forge Vessel

## Phase 1 — Forge vessel scaffold

- [ ] 1.1 New repo `repos/substrate-forge-vessel/`. Instantiates
  `VesselDaemon` on port 8260, wrapping the existing
  `vessel-forge-host` examples machinery.
- [ ] 1.2 Substrate plumbing per substrate-explicit-vessels Phase 1
  pattern (unit file at `scripts/substrate/units/substrate-forge-vessel.service`,
  Makefile target `restart-substrate-forge`, Dockerfile.substrate
  `COPY` + `bun install` lines, identity-vessel seeded API key).
- [ ] 1.3 Advertise shapes: `forkRequest` (write), `forkOutcome` (read),
  `forkPromotion` (write, admin-gated initially), `forkRollback`
  (write, admin-gated initially).
- [ ] 1.4 Smoke test: `curl localhost:8260/health` returns 200; vessel
  appears in `GET discovery-vessel:8100/registry/stats`.

## Phase 2 — Container resolver

- [ ] 2.1 Implement `containerOrchestration` shape resolver. Wraps
  `docker` / `nerdctl` / `podman` via configurable backend. Operator
  shell is NOT used; the wrapper invokes container CLI via
  local-tools-vessel `commandResult` resolver with elevated
  permissions scoped to container management.
- [ ] 2.2 Lifecycle: spawn, query status, capture logs, tear down. Each
  step emits a lifecycle trace.
- [ ] 2.3 Volume management: each fork gets a fresh `/var/lib/substrate-fork/<fork_id>/`
  directory; SurrealDB volume mounted into the fork container. After
  fork teardown, volume archived to `/var/lib/substrate-fork-archive/`
  (24h retention) or discarded per configuration.
- [ ] 2.4 Port allocation: each fork gets a contiguous port range
  `8300 + (fork_index × 100)` for its vessel ports. Allocation tracked
  in `init_fork_ports` table.

## Phase 3 — Fork lifecycle resolver

- [ ] 3.1 `forkRequest` resolver: validates candidate_change_ref,
  evaluation_budget, depth; allocates ports + volume; spawns container;
  applies candidate change; starts substrate inside fork; returns
  `fork_id` synchronously, emits `forkOutcome` asynchronously when
  evaluation completes.
- [ ] 3.2 Evaluation completion detected by: fork emitting a
  `forkEvaluationComplete` impulse; or budget timer expiring; or
  failure detector firing. Each path produces a `forkOutcome` impulse
  with the appropriate outcome field.
- [ ] 3.3 `signal_confidence_weight` computed by runtime:
  `min(1.0, fork_runtime_seconds / 86400 × 0.95 + 0.05)`. 10-min fork
  ≈ 0.32, 1-hour ≈ 0.7, 24-hour ≈ 0.95.
- [ ] 3.4 Container teardown: graceful stop with 30s timeout, then
  SIGKILL. Volume archive per config. Port range freed.

## Phase 4 — Promotion / rollback

- [ ] 4.1 `forkPromotion` resolver: verifies `forkOutcome` is success
  and weight ≥ promotion_threshold (default 0.7); applies the
  candidate change to canonical substrate via `restart-vessel`
  activity chain (§27.3.j.5); emits a `recoveryReport`.
- [ ] 4.2 Pre-promotion safety: snapshot canonical SurrealDB volume to
  `/var/lib/substrate-pre-promotion/<timestamp>/` via
  `restore-from-backup` machinery in reverse.
- [ ] 4.3 `forkRollback` resolver: restores the pre-promotion snapshot;
  emits a `recoveryReport` confirming rollback.
- [ ] 4.4 Promotion is admin-gated in Phase 1 deployment; downgraded to
  `write` scope after closure-audit `--without=operator-shell` reports
  green for promotion path across 7 consecutive nightly runs.

## Phase 5 — Resource governor

- [ ] 5.1 Per-substrate ceilings: `max_concurrent_forks` (default 4),
  `max_cost_per_fork_usd` (default 1.00), `max_total_cost_per_hour_usd`
  (default 10.00). Configured in `validation/state/forge-config.json`.
- [ ] 5.2 Governor enforcement: `forkRequest` exceeding any ceiling
  returns 429 with `verifier_negative` self-trace specifying which
  ceiling was hit.
- [ ] 5.3 Governor reports: `forgeResourceReport` impulse emitted every
  60s with current usage (concurrent forks, cost-spent-this-hour, etc.).
- [ ] 5.4 Governor learning (post sibling spec
  `2026-05-23-cost-weighted-posteriors`): ceilings become Thompson-managed
  rather than fixed — the substrate learns which ceiling values yield
  best long-run α-per-dollar.

## Phase 6 — Forge strategy selector

- [ ] 6.1 Draft three strategy templates: `n_parallel`,
  `sequential_narrowing`, `exponential_branching`. Each is an activity
  template input_shapes: [`candidateChangeSet`], output_shapes: [`forkOutcomeSet`,
  `selectedCandidate`].
- [ ] 6.2 `forge-strategy-selector` resolver Thompson-samples among the
  three strategies per problem class (derived from
  candidate_change_ref's tags). α/β tracked in standard
  variant_performance_metrics with `(strategy, problem_class)` keying.
- [ ] 6.3 Cold start: equal Beta(1,1) priors across strategies. After
  ≥50 dispatches, CI widths narrow; substrate's selection becomes
  data-driven.

## Phase 7 — Recursive forge

- [ ] 7.1 `forkRequest` accepts `parent_fork_id`. If set, depth is
  parent's depth + 1.
- [ ] 7.2 Depth-cap (default 3) enforced at request time. Exceeding →
  400 with `safety_breach.breach_type: depth`.
- [ ] 7.3 Cycle detection: composition-chain cycle-detection idiom
  applied to fork lineage. A fork attempting to fork an ancestor →
  rejection.
- [ ] 7.4 Sub-fork resource consumption rolls up to parent's budget
  pool. Aggregate cost across a fork tree counts against parent's
  ceiling.

## Phase 8 — IAL integration

- [ ] 8.1 Amend IAL `tasks.md` Phase 27.3.g with §27.3.g.7 — forge
  vessel runs as a substrate unit and meets explicit-vessel coverage.
- [ ] 8.2 Amend `substrate-explicit-vessels` proposal to list forge as
  the seventh vessel slot (this is a forward-edit; the explicit-vessels
  change is already committed, so the amendment is a follow-up).
- [ ] 8.3 Update CLAUDE.md vessel inventory.
