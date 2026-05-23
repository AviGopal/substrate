# Capability: substrate-forge-vessel

## Definition

`substrate-forge-vessel` is a substrate-resident systemd unit on port
8260 that spawns ephemeral substrate clones (forks) in parallel to
explore candidate changes. Each fork runs the candidate change against
the same substrate codebase + a fresh SurrealDB volume; emits a
`forkOutcome` impulse with `signal_confidence_weight` proportional to
fork runtime; is torn down after evaluation. The canonical substrate
ranks fork outcomes and promotes winners through the substrate-resident
`restart-vessel` + `restore-from-backup` machinery.

## Advertised shapes

- `forkRequest` (write) — body
  `{ candidate_change_ref, evaluation_budget_ms, depth?, parent_fork_id? }`.
  Returns `{ fork_id }` synchronously.
- `forkOutcome` (read, also write — emitted by the fork at completion)
  — body
  `{ fork_id, outcome: "success" | "failure" | "budget_exhausted" | "safety_breach", evidence_trace_ids[], cost_usd, duration_ms, signal_confidence_weight }`.
- `forkPromotion` (write, admin-gated initially) — body
  `{ fork_id }`. Triggers candidate-change application via
  `restart-vessel` chain.
- `forkRollback` (write, admin-gated initially) — body
  `{ reason }`. Restores pre-promotion snapshot.
- `forgeResourceReport` (read) — emitted every 60s. Body
  `{ concurrent_forks, cost_spent_this_hour, ceiling_violations[] }`.
- `containerOrchestration` (write, scoped to container management) —
  internal shape used by the forge's container resolver.

## Self-application invariants

1. **Explicit vessel** — substrate-forge-vessel is itself an explicit
   substrate-hosted vessel under IAL §27.3.g. Its presence, discovery
   registration, and health are part of the §27.3.g.7 acceptance gate.
2. **Closure-bound** — forge operations are substrate-resident. Operator
   shell access is not consulted during routine forge dispatch,
   promotion, or rollback. §27.3.j.5 (self-healing closure) and
   `closure-audit --without=operator-shell` apply.
3. **Confidence-weighted** — every `forkOutcome` carries
   `signal_confidence_weight` ∈ [0.05, 0.95] per the runtime formula.
   Posterior updates derived from fork outcomes weight by this field.
4. **Thompson-managed strategy selection** — the choice among
   `n_parallel`, `sequential_narrowing`, `exponential_branching` is
   Thompson-sampled per problem class. The strategy selector itself
   accrues α/β.
5. **Recursive forge bounded** — a fork may spawn sub-forks. Depth-cap
   (default 3) and cycle detection apply per the composition-chain
   idiom. Resource consumption rolls up to root fork's budget.
6. **Forge is forgeable** — the forge vessel's own implementation can be
   a candidate change forged through a prior forge. Bootstrap: first
   forge ships from operator-authored code; subsequent versions may be
   substrate-authored and self-promoted.

## Fork lifecycle

```
forkRequest emitted
  ↓
forge allocates port range + volume + fork_id
  ↓
container spawned with candidate change applied
  ↓
fork substrate boots; runs evaluation activities
  ↓
fork emits forkEvaluationComplete impulse OR budget timer fires
  ↓
forge emits forkOutcome with weight = f(runtime)
  ↓
container torn down; volume archived (24h) or discarded
```

## Promotion lifecycle

```
forkPromotion { fork_id } dispatched
  ↓
forge verifies forkOutcome.outcome == "success"
      AND signal_confidence_weight ≥ promotion_threshold (default 0.7)
  ↓
canonical substrate volume snapshotted to pre-promotion-archive
  ↓
candidate change applied to canonical via restart-vessel chain
  ↓
recoveryReport emitted with new canonical state hash
  ↓
optional: rollback via forkRollback if subsequent verification fails
```

## Resource governance

| Ceiling | Default | Configurable | Learned |
|---|---|---|---|
| `max_concurrent_forks` | 4 | Yes | Yes (via cost-weighted-posteriors) |
| `max_cost_per_fork_usd` | 1.00 | Yes | Yes |
| `max_total_cost_per_hour_usd` | 10.00 | Yes | Yes |
| `max_fork_depth` | 3 | Yes (safety; lowering only after observation) | No (safety guard) |
| `volume_archive_retention_hours` | 24 | Yes | Yes |

Ceiling violations emit `verifier_negative` self-traces. Aggregate
violation rate is itself a signal for the cost-weighted learning loop:
chronic ceiling pressure → substrate proposes raising the ceiling (with
operator review per §27.3.c.2 admin scope).

## Acceptance

1. **Spawn/teardown**: `forkRequest` returns `fork_id` within 5s;
   `forkOutcome` emitted within `evaluation_budget`; container removed
   within 30s of teardown signal.
2. **Parallel exploration**: 4 concurrent forks each finishing in
   ~10 min individually complete in ≤15 min wall-clock combined.
3. **Promotion / rollback**: `forkPromotion` followed by
   `forkRollback` returns the canonical substrate to its prior state
   bit-for-bit (SurrealDB volume + image hash).
4. **Governor**: 5th concurrent fork returns 429 with
   `ceiling_violations[]` populated.
5. **Recursive depth**: depth-4 sub-fork rejected with
   `safety_breach.breach_type: depth`.
6. **Strategy learning**: after 50 dispatches, at least one
   `(strategy, problem_class)` pair has CI width ≤0.4 and is
   measurably preferred by sampling.
7. **Closure**: `closure-audit --without=operator-shell` reports zero
   failures for forge operations after 7 consecutive nightly runs.

## Status

Post-explicit-vessels. Lands after the six substrate-explicit-vessels
are stable. Pre-self-deployment (sibling spec): forge is the
prerequisite mechanism for substrate-self-deployment's variant
verification.
