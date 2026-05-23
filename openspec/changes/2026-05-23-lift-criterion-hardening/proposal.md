# Proposal: Lift-Criterion Hardening

## Why

IAL Phase 27's lift criterion today rests on three substrate-measured
signals: `coverageReport.coverage_progress=true × 3` (topology-discovery
spec R4), `substrateHealthReport.health_verdict.overall_passing=true`
(topology-discovery spec R9), and an operator-written
`validation/state/lift-status.json` (IAL §27.2.1). The
substrate-closure-properties sibling adds §27.3.j (closure-audit green
× 3) as a hard gate. The topology-discovery loop binds these reports
into a self-firing 6-step causal chain
(`activityRegistryChange → snapshot → report → probe → registryChange`).

Three risks identified during integration review threaten the lift
criterion's load-bearing character:

1. **Measurement gaming.** Every existing §27.S gate is substrate-
   measured. A substrate that optimises whatever Phase 27 measures can
   satisfy `coverage_progress` by touching each advertised shape once
   with trivial goals, satisfy `confidence_passing` by firing the same
   template against the same signature 10 times, and (post
   closure-audit) satisfy closure by extracting trivial constant-return
   resolvers that drop cost. The closure-audit script is itself
   substrate-resident and could in principle be rewritten by the
   substrate it audits. The structural defense is **external anchors**
   the substrate cannot author or modify.
2. **Stall undetectability.** The 6-step topology-discovery chain
   produces flat or zero progress signals both when the substrate has
   converged AND when a link in the chain has silently failed. Phase 27
   cannot distinguish "converged" from "stalled" — both look like
   "non-progressing `coverageReport`s". A substrate that achieves
   coverage + health while one chain link is dead may still pass the
   §27.S gates; the operator hand-over decision in §27.S.3 has no
   positive liveness signal to consult.
3. **Narrow exploration.** Today's R1.4 priority heuristic
   (`(# advertising vessels) / advertised_shapes.length`) targets depth
   (heavily-advertised shapes get probed first), not breadth. A
   substrate that runs this heuristic probes the same pool repeatedly,
   inflating α+β on a small strip while leaving most (template_id,
   signature) pairs unsampled. `substrateHealthReport.confidence_passing`
   computed against `pairs_above_floor / total_pairs ≥ 0.5` advances
   slowly under this regime — the loop is hot but exploration is narrow.

This change closes the three risks in one bundled spec because they
share substrate (Phase 27.S acceptance gates) and ship together as
additions to the existing topology-discovery loop machinery. None
introduce new resolvers, vessels, or trust roots.

## Scope (three additions)

### Addition 1 — External-anchor gates

Three operator-curated artefacts whose contents the substrate cannot
author or modify, with a substrate-resident tick activity each that
runs the artefact against the substrate and emits a report impulse:

- **Held-out evaluation set** (`heldOutEvalSet` shape, operator-curated
  goal set under `validation/held-out-eval-set/v<N>.json`) →
  `held-out-eval-tick` activity → `heldOutEvalReport` impulse with
  per-goal verdicts and aggregate pass rate. Rotation reuses the
  Phase 25 §G8.1.1 held-out generator's ISO-week seeding policy.
- **Adversarial probe set** (`adversarialProbeSet` shape,
  operator-authored probes under `validation/adversarial-probes/v<N>/`)
  → `adversarial-probe-tick` activity → `adversarialProbeReport`
  impulse with per-probe classification verdicts.
- **CI agreement rate** (`ciAgreementReport` shape; computed by
  `ci-agreement-tick` activity reading recent `gitMergePR` outcomes +
  corresponding GitHub Actions verdicts via the github-actions-observer
  — see Dependencies). Cross-references substrate-closure-properties
  §4 (CI closure — substrate harness as merge authority): GitHub
  Actions stays an observer; the agreement rate is a drift signal,
  not a merge gate.

All three artefacts are operator-resident (curated, rotated, and
versioned by operator action). The substrate may run against them and
emit reports; it MAY NOT author, modify, or rotate them.

### Addition 2 — Lifecycle chain liveness

One substrate-resident tick activity that produces a positive liveness
signal over the topology-discovery chain:

- **Chain-stall detector** (`chainStallReport` shape) →
  `chain-stall-tick` activity → emitted every 30 minutes by default.
  Queries `activity_execution_traces` filtered by `output_shapes
  CONTAINS "activityRegistryChange"` (and `output_shapes CONTAINS
  "reachableButUnlearnedReport"` as a probe-dispatch proxy) in the
  lookback window; compares observed counts to expected minima; sets
  `stall_detected: true` when both fall below threshold.

This is NOT a Phase 27.S substrate-measured gate. It is a §27.3.d.4
constraint on the operator hand-over: the operator MUST NOT write
`status: "confirmed"` to `lift-status.json` while `stall_detected: true`
on the most-recent `chainStallReport`. A substrate that has reached
lift may legitimately have low activity; the human-in-the-loop check
prevents declaring lift on a halted loop.

### Addition 3 — Probe-breadth heuristic refinement

Amend `2026-05-23-topology-discovery-loop` spec R1.4 priority formula:

```
priority = α × depth_score + β × breadth_score
where
  depth_score = (# advertising vessels) / advertised_shapes.length    (existing formula)
  breadth_score = (1 - fraction_of_signature_pool_above_floor)
  α = 0.6, β = 0.4   (defaults, operator-tunable per substrate)
```

`breadth_score` is high when most of the active signature pool (as
known to activity-api's `variant_performance_metrics` table) is
unsampled below the posterior-confidence floor.

The change shifts probe targeting from heavily-advertised gaps toward
under-sampled corners, advancing
`substrateHealthReport.confidence_passing` instead of padding the same
strip. The mix optimises for confidence growth while still closing
high-value depth gaps. Operator-tunable via
`validation/state/probe-config.json`.

## Self-application

These additions are observation primitives, not selection primitives.
They still follow substrate-resident patterns:

- **External-anchor reports** carry operator-supplied
  `signal_confidence_weight = 1.0` per
  `2026-05-23-signal-confidence-weighting`. The operator IS the trust
  anchor for held-out sets, adversarial probes, and CI agreement.
- **Chain-stall reports** are Thompson-irrelevant (informational only
  — they feed the operator's hand-over decision, not posterior
  updates). The report's emission is not credited to its emitting
  activity's α/β.
- **Probe-breadth heuristic** is operator-tunable per substrate via
  config, not substrate-self-modifiable. The substrate may *propose* a
  weight change via the spec-authoring path (substrate-closure-properties
  §6), but cannot hot-reload its own config.

## What this is NOT

Explicitly out of scope:

- **Closure-property mirror activities.** Substrate-closure-properties
  is its own sibling change; this spec consumes its outputs (CI verdict
  via `ciAgreementReport`) but does not re-specify closure.
- **Validator-drift detection.** Tracking whether the substrate's own
  validators are loosening over time deserves its own sibling change;
  the held-out and adversarial gates here are samples-against-truth,
  not validator-introspection.
- **Forge-overfitter detection.** A forge-vessel that overfits to
  short-horizon metrics is partially caught by held-out eval pass-rate
  regression (a substrate that overfits the seen distribution should
  regress on unseen goals), but a dedicated detector is out of scope.
- **Operator workflow for curating held-out sets and adversarial
  probes.** This spec defines the contract (substrate-side); the
  workflow doc (operator-side) is a follow-up under `docs/`.
- **What to do when the operator has not curated any external anchors
  yet.** The gates degrade to "no anchor available, soft-pass with
  warning"; this softness is documented explicitly. The first lift
  attempt MAY hard-require non-degraded mode at the operator's
  discretion.

## Phase 27 binding

Amends IAL `2026-04-26-impulse-activity-loop/tasks.md` Phase 27:

- **New §27.S.4a** — `heldOutEvalReport.pass_rate ≥ heldout_floor` on
  the most recent emission. `heldout_floor` operator-tunable, default
  0.85. When no held-out set is curated, the gate soft-passes with a
  `liftBlocker` impulse emitted at operator-warning severity.
- **New §27.S.4b** — `adversarialProbeReport.pass_rate ≥
  adversarial_floor` on the most recent emission. Default 0.80. Same
  soft-pass behaviour when no probe set is authored.
- **New §27.S.4c** — `ciAgreementReport.agreement_rate ≥
  agreement_floor` on the most recent emission. Default 0.95.
  Soft-passes when github-actions-observer is absent or no
  `gitMergePR` traces are in the window
  (`agreement_rate: null` → soft-pass).
- **New §27.3.d.4** — the operator MUST NOT write `status:
  "confirmed"` to `validation/state/lift-status.json` while
  `chainStallReport.stall_detected = true` on the most-recent
  emission. (The operator MAY write `status: "reverted"` regardless
  — reverting is always permitted per §27.2.4.)
- **§27.3.f.4 (new doc subitem)** — `docs/LIFT_HANDOVER.md` enumerates
  the three external-anchor gates and the chain-stall constraint,
  including the soft-pass semantics.

## Capabilities

### New Capabilities

- `lift-criterion-hardening` (this change) — establishes the
  external-anchor gate principle, the chain-stall liveness signal, and
  the probe-breadth heuristic mix. Spec:
  `specs/lift-criterion-hardening/spec.md`. Four new shapes
  (`heldOutEvalReport`, `adversarialProbeReport`, `ciAgreementReport`,
  `chainStallReport`), four new resolver/activity pairs, one R1.4
  amendment in topology-discovery-loop.

### Modified Capabilities

- IAL Phase 27.S acceptance gates gain §27.S.4a/b/c; Phase 27.3.d gains
  §27.3.d.4; Phase 27.3.f gains §27.3.f.4.
- `2026-05-23-topology-discovery-loop` spec R1.4 priority formula
  amended (in-spec amendment via cross-reference; the topology-discovery
  spec retains R1.4 verbatim and adds a follow-up note pointing at
  this change's design §C).
- `development-vessel` capability set grows by four advertised shapes
  and four seed-template families.

## Dependencies

- `2026-05-23-topology-discovery-loop` — R1.4 reformulation, R9
  cross-reference to chainStallReport. R1.4 amendment is a hard
  dependency; R9 cross-reference is documentation-only.
- `2026-05-23-substrate-closure-properties` — §4 (CI closure)
  defines the merge-gate verdict that `ciAgreementReport` compares
  against. Without §4 deployed, `ciAgreementReport` runs in degraded
  mode (`disagreement_details: []`, `agreement_rate: null`).
- `2026-05-23-substrate-self-deployment` — defines `gitMergePR`
  trace shape and `verify-merge-candidate` activity, which
  `ci-agreement-tick` reads. Without self-deployment, no
  `gitMergePR` traces exist and the agreement gate soft-passes.
- `2026-05-23-signal-confidence-weighting` — external-anchor reports
  carry `signal_confidence_weight = 1.0`. Field landing is a soft
  dependency (reports work without it; explicit weight surfacing is
  cleaner with it).
- `2026-05-17-stratified-goal-generator-harness` §G8.1.1 — held-out
  rotation policy reuses the ISO-week seeding pattern; not re-specified.

## Near-term dependency: github-actions-observer

`ciAgreementReport` assumes a `github-actions-observer-vessel` (or
equivalent) advertising a `ciVerdict` shape with bodies of the form
`{ commit_sha, github_run_id, verdict: "pass" | "fail", timestamp }`.
This observer is NOT specced here; it is assumed near-term, and its
absence is the trigger for the agreement gate's soft-pass behaviour.
If the observer is not built before the first lift attempt,
`agreement_rate: null` propagates through and §27.S.4c soft-passes
with a `liftBlocker` warning.

## Out of scope

- Operator workflow for curating, versioning, and rotating held-out
  evaluation sets and adversarial probe sets. Left to a follow-up
  operations doc.
- Cryptographic attestation of held-out sets (could prevent substrate
  from authoring them post-rotation). Soft-mitigated by the
  operator-curated convention; full mitigation deferred to H6.
- Authoring of the github-actions-observer vessel. Near-term
  dependency, not part of this spec.
- Automated rotation triggers. Today's rotation is operator-driven on
  the ISO-week seed; auto-rotation is out of scope.
- Per-domain held-out sets (e.g. separate sets for codegen vs
  debugging). v1 treats the held-out set as a single pool.
