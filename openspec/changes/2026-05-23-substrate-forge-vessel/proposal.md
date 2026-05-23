# Proposal: Substrate Forge Vessel

## Why

Development on local single-container substrates compresses the
iteration cycle from minutes (canary helm rollout) to seconds (`make
substrate-restart-X`). This applies both before the IAL §27.S.4 S1 →
S2 lift (where the operator dispatches forge runs to verify candidate
changes) and after (where the substrate dispatches forge runs as part
of its own self-deployment + self-replacement loop). What this enables
is not merely faster serial iteration — it is **parallel variant
exploration**. The substrate can
spawn N ephemeral clones of itself, each pursuing a different candidate
change, observe N outcomes in parallel, and promote the winner. Variant
exploration moves from `O(N × deploy_time)` to
`O(1 × deploy_time + N × measurement_time)`. Combined with the substrate's
existing Thompson-managed candidate selection, this turns post-lift
development into autonomous A/B testing at the substrate level.

`repos/ias-executor-ts/src/examples/vessel-forge-host.ts` already exists
as a probe. The work is promoting it to a substrate-resident vessel with
discovery registration, lifecycle integration, fork management, and
outcome-feedback wiring.

## Self-application

The forge vessel is itself a vessel, an activity catalog, and a resolver
set; it MUST be subject to the same conditions as every other vessel:

- **Foundation alignment** — forge spawns vessels using the same
  four-primitive model. A fork is not a privileged "substrate twin" — it
  is a substrate-resident vessel set whose discovery advertisements are
  scoped to a fork namespace.
- **Closure** — the forge vessel is substrate-resident and operates
  without operator shell access. Forks are spawned via the substrate's
  own container-orchestration resolver, not via `docker run` from
  operator command line. §27.3.j.5 self-healing closure applies.
- **Confidence weighting** — `forkOutcome` impulses carry
  `signal_confidence_weight` proportional to fork runtime: a 10-min
  fork weights ~0.3 (small sample, narrow window), a 1-hour fork ~0.7,
  a 24-hour soak ~0.95. Promotion decisions weight outcomes by this
  field.
- **Explicit vessel** — forge advertises shapes
  (`forkRequest`, `forkOutcome`, `forkPromotion`, `forkRollback`)
  through discovery and exposes `POST /resolve` per the VesselDaemon
  contract.
- **Thompson posteriors** — the forge itself is Thompson-tracked:
  `(forge_strategy, problem_class) → α/β`. The substrate learns which
  forge strategies (N-fork parallel, sequential narrowing, exponential
  branching) yield best outcomes for which problem kinds. The strategy
  selector is just another resolver.
- **Recursive forge** — a fork may itself spawn sub-forks, bounded by a
  depth-cap safety guard (default 3) per the existing composition-chain
  cycle-detection idiom. This is unusual but principled: a fork
  exploring a multi-step change may need its own forks to evaluate
  sub-variants. The depth-cap prevents fork-bombs.
- **Forge is forgeable** — the forge vessel's own implementation can
  be a candidate change forged by a prior forge. The first forge
  vessel ships from operator-authored code; subsequent versions may be
  substrate-authored and self-promoted through the same forge
  mechanism. The transition from operator-promoted forge changes
  (pre-§27.S.4, and S2-supervised after) to substrate-promoted
  without operator review is part of the S2 → S3 arc per IAL §27.S.5;
  the substrate's refusal to promote a forge change that would
  compromise self-stability is the kind of cited-evidence push-away
  §27.S.6 measures.

## What Changes

1. **`substrate-forge-vessel`** — new substrate unit on port 8260.
   Wraps `vessel-forge-host` machinery in `VesselDaemon`. Advertises
   `forkRequest` (write), `forkOutcome` (read), `forkPromotion` (write,
   admin-gated initially), `forkRollback` (write, admin-gated initially).
2. **Fork lifecycle**:
   - `POST forkRequest { candidate_change_ref, evaluation_budget, depth }`
     spawns an ephemeral substrate clone in a fresh container with its
     own port range (`8300+N×100`) and SurrealDB volume.
   - Clone runs the candidate change; emits standard lifecycle traces.
   - On completion (success / failure / budget exhaustion), forge emits
     `forkOutcome { fork_id, outcome, evidence_trace_ids[], cost_usd,
     duration_ms, signal_confidence_weight }`.
   - Clone container is torn down; SurrealDB volume optionally archived
     for later inspection (default: discarded after 24h).
3. **Promotion path**:
   - Substrate dispatches `forkPromotion { fork_id }`; forge verifies
     the fork's `forkOutcome` is `success` and `signal_confidence_weight
     ≥ promotion_threshold` (default 0.7); applies the candidate change
     to the canonical substrate via a `restart-vessel` activity chain
     (§27.3.j.5).
   - Rollback via `forkRollback` returns to the prior canonical state
     using `restore-from-backup` (§27.3.j.5).
4. **Container resolver**: `containerOrchestration` shape resolved by a
   thin wrapper around `docker` / `nerdctl` / `podman` (configurable per
   substrate). Resolver is substrate-resident; operator shell access is
   not consulted during forge operations.
5. **Resource governor**: forge enforces per-substrate fork-count and
   total-cost ceilings. Default: max 4 concurrent forks, $1.00 budget
   per fork. Configurable per substrate via
   `validation/state/forge-config.json` — operator-authored at
   bootstrap; substrate-authored thereafter via cost-weighted
   posteriors learning (sibling spec
   `2026-05-23-cost-weighted-posteriors`).
6. **Thompson strategy selection**: a `forge-strategy-selector` resolver
   Thompson-samples among forge strategies per problem class:
   - `n_parallel` — fork N variants in parallel, promote best.
   - `sequential_narrowing` — fork 2, promote one, fork 2 sub-variants
     from winner.
   - `exponential_branching` — fork at each decision point in a
     candidate change; promote the path with best aggregate score.
   The substrate learns which strategy works for which problem kind.
7. **Cycle/depth guards**: composition-chain cycle detection applies to
   fork hierarchy. Default depth cap 3. Sub-forks must declare
   parent fork id in `forkRequest`.

## Success criteria

1. **Forge spawns and tears down clones**: `forkRequest` with a simple
   candidate change yields a `forkOutcome` impulse within the
   `evaluation_budget`, with clean container teardown.
2. **N-parallel exploration**: 4 concurrent forks pursuing different
   candidate changes run to completion in parallel; combined wall-clock
   is ≤1.5× single-fork wall-clock (modulo single-machine contention).
3. **Promotion path closed**: a `forkPromotion` dispatch applies the
   forked candidate's change to the canonical substrate and emits a
   `recoveryReport` confirming new state. `forkRollback` restores prior
   state.
4. **Resource governor enforced**: attempting a 5th concurrent fork
   when ceiling is 4 returns 429 with `verifier_negative` self-trace;
   no system instability.
5. **Recursive forge bounded**: a fork attempting depth-4 sub-fork
   is rejected with `safety_breach.breach_type: depth`.
6. **Thompson strategy learning**: after ≥50 forge dispatches, the
   substrate's `forge-strategy-selector` posteriors are informative
   (Beta CI width ≤0.4) for at least one problem class.
7. **Closure**: `closure-audit --without=operator-shell` reports zero
   failures for forge operations.

## Capabilities

### New Capabilities

- `substrate-forge-vessel` — substrate unit + activity templates +
  resolver set for ephemeral substrate clone spawning, parallel variant
  exploration, promotion / rollback, and Thompson-managed strategy
  selection. Spec: `specs/substrate-forge-vessel/spec.md`.

### Modified Capabilities

- IAL Phase 27.3.g (explicit-vessel coverage) gains §27.3.g.7: the
  substrate-forge-vessel is a substrate-hosted explicit vessel like the
  other six.
- `substrate-explicit-vessels` modified to add the seventh vessel slot
  (port 8260, unit file, Makefile target, Dockerfile entry).

## Dependencies

- `2026-05-23-substrate-explicit-vessels` (committed) — VesselDaemon /
  ResolverServer / DiscoveryRegistrationLoop must be available.
- `2026-05-23-signal-confidence-weighting` (committed) —
  `signal_confidence_weight` field on traces is required for
  `forkOutcome` weighting.
- `2026-05-23-substrate-closure-properties` (committed) — restart /
  restore / backup activities must be substrate-resident for promotion
  / rollback.
- Sibling `2026-05-23-cost-weighted-posteriors` — forge's resource
  governor is the natural caller for cost-weighted selection.

## Out of scope

- **Cross-machine forks**. Forge spawns containers on the same host as
  the canonical substrate. Multi-host distributed forging is a
  federation problem (see `2026-05-23-vessel-federation/`).
- **Fork-state replication into canonical substrate**. Promoted forks
  apply their code changes via the substrate's restart machinery, not
  by copying SurrealDB state. State migrates through normal traces
  after promotion.
- **Long-lived fork retention**. Forks are ephemeral; persistent
  variant tracking happens at the activity-template / Thompson layer,
  not at the substrate-instance layer.
