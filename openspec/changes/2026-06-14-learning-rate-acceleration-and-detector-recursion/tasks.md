# Tasks — sequenced, evidence-gated

Sequencing rationale: **A** makes every later workstream's samples land where they pay (foundational, smallest). **D** feeds A's penalty and is the stability floor. **C** is the keystone the directive names and depends only on the existing drafter. **B** adds throughput once targeting exists. **E** proves the whole thing. Each phase has a trace-inspectable acceptance gate — `status=success` alone is not acceptance (`feedback_milestone_requires_trace_inspection`).

## Phase 0 — Preconditions (verify, don't assume)

- [ ] 0.1 Confirm `compose_parallel` is registered as a drafter-targetable resolver (audit found it in `engine.ts`; confirm registration + that a hand-built `explore-or-edge` template dispatches k siblings and credit averages `/k` at the ancestor — `posterior-update.ts:498`).
- [ ] 0.2 Confirm the per-goal information-yield signal is computable from a tick's return (Var-delta query cost ≤ one cheap read; else widen the tick result).
- [ ] 0.3 Snapshot trace store + prune to working size if bloated (`finding_2026_06_12_manual_operation_runbook`: 235K traces hang endpoints; keep ≤ ~5K for fast selector queries — throughput precondition).

## Phase A — Value-of-information goal selection (targeting)

- [ ] A.1 Add per-goal Beta posterior + Thompson selection in `boredom-vessel/src/index.ts`, gated by existing `maxCostForLoad` (round-robin stays as Beta(1,1) cold-start).
- [ ] A.2 Define information-yield reward: `1` if tick caused {Var-reduction > ε on a touched cell, fresh gap-class, posterior-moving verdict}, else `0`.
- [ ] A.3 Conditional-independence guard: log goal-posterior correlation; surface drift (§4 orthogonality is measured).
- [ ] **A.GATE** (trace-inspectable): over a ≥2h window, mean ticks-to-first-dispatch for a freshly-high-`Var` detector drops vs round-robin baseline (expect ≪ 46-tick worst case); load-triage still skips expensive goals under `load_anomaly_severe`.

## Phase D — Stability-as-curl

- [ ] D.1 Bootstrap `cyclic-flow-scan` (deterministic dev-vessel seed): per-edge cyclic fraction over a composition-graph window; emit `wastedCycle` substrateGap above threshold.
- [ ] D.2 Wire `(1 − cyclic_fraction)` penalty into the Phase-A goal reward.
- [ ] D.3 Add one boredom goal for `cyclic-flow-scan`.
- [ ] **D.GATE** (trace-inspectable): scan emits a `wastedCycle` for a deliberately-induced loop (e.g. re-enable a bounded validator-dispatch echo); the offending goal's Phase-A selection probability visibly decays in the next windows.

## Phase C — Detector-authoring recursion (KEYSTONE)

- [ ] C.1 Bootstrap `detector-coverage-audit` (deterministic seed): cluster `failure_mode`/anomaly signatures; diff against existing-detector class-set; emit `detector-gap` scenario for uncovered clusters.
- [ ] C.2 Author `draft-detector-activity` archetype: drafts a deterministic-scan detector activity emitting a new `substrateGap` class; constrained to deterministic resolvers; gated through convergent-validity (`merge-gate-computes-convergent-validity`) to block auto-promote gaming.
- [ ] C.3 Add `detector-gap` drain goal (mirror goal[42] `drafter-trigger-tick`) routing to `draft-detector-activity`.
- [ ] C.4 Confirm authored detectors flow through the existing auto-promote loop (`system-authored-activity-promotion-loop`) into `applicable(s)`.
- [ ] **C.GATE** (trace-inspectable, the milestone): inject ONE operator-curated novel failure cluster with no existing detector. Verify the full chain by trace: `detector-coverage-audit` emits `detector-gap` → `draft-detector-activity` authors a detector (drafter provenance, not operator commit) → auto-promoted → the new detector **fires** on a later occurrence and **emits its declared `substrateGap` class** with non-stub substance. Record the chain's execution + commit/variant ids per `feedback_substrate_authored_label_vs_evidence`.

## Phase B — Exploration fan-out (throughput)

- [ ] B.1 Bootstrap `or-edge-scan` (deterministic): emit `orEdge` scenario where ≥2 high-`Var` templates share `output_shapes`.
- [ ] B.2 Drafter authors (or bootstrap) `explore-or-edge` dispatching candidates via `compose_parallel`.
- [ ] B.3 Add `orEdge` drain goal.
- [ ] **B.GATE** (trace-inspectable): one OR-edge cycle updates all k candidate posteriors in a single wall-clock window (k trace rows, shared `parent_execution_id`, `siblingGroupSize=k`, ancestor credit averaged `/k`), vs the sequential baseline updating 1.

## Phase E — Measurement (proof it is doing so + stabilising)

- [ ] E.1 Bootstrap **detection-coverage** observable: per-window `closed_autonomously / total`, with the C.GATE trace-verification definition of "autonomously authored."
- [ ] E.2 Bootstrap **stability-trend** observable: per-window convergence fraction (Var-converged reachable cells) + inter-arm curl (forward vs reverse arm disagreement, §4.6).
- [ ] E.3 Extend IAL lift criterion: add `stability-trend-non-decreasing` conjunct to the existing `coverage_progress ∧ health_passing` for ≥3 windows.
- [ ] **E.GATE** (trace-inspectable): a dashboard/impulse query shows, across ≥3 consecutive windows, coverage breadth ↑ **with** convergence ↑ and inter-arm curl ↓ — growth *and* stabilisation on the same trace, plus a non-zero autonomously-authored detector count.

## Definition of done (the directive, point by point)

| Directive clause | Satisfied by | Evidence |
|---|---|---|
| Increase rate of learning | A (targeting) + B (throughput) on top of shipped TD(λ)/tier-bandit | A.GATE ticks-to-dispatch ↓; B.GATE k-per-window |
| Use the system to build itself | C archetype → substrate authors detector instances; B → substrate authors fan-outs | §7 operator/substrate split; C.GATE drafter provenance |
| Capability to create new detectors for new problems on its own | C (detector-coverage-audit + draft-detector-activity) | C.GATE full autonomous chain |
| …and that it is doing so | E.1 detection-coverage | E.GATE non-zero autonomous count, trace-verified |
| Increasing stability in addition to growing | D (curl) + E.2 stability-trend + E.3 lift extension | E.GATE growth ∧ convergence↑ ∧ curl↓ over ≥3 windows |

## Notes

- Everything routes through existing machinery: drafter, auto-promote, `compose_parallel`, gap→scenario bridge, convergent-validity gate, boredom rotation. The only new *primitives* are the three deterministic scans + one drafter archetype + one selector mode (all operator-bootstrapped once; §7 of design).
- No new operator monitor — observables are substrate-emitted impulses the existing external monitor reads (`feedback_user_has_external_monitor`).
- Honest framing: D's curl and "graph momentum" are §11 frontier; ship as measured heuristics, label as such in reports.
