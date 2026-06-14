# Stability while growing

## ADDED Requirements

### Requirement: Cyclic flow is measured, not only ablated

The substrate SHALL run a deterministic `cyclic-flow-scan` over a window of the composition graph that computes each edge's zero-work (divergence-free / Hodge-curl) fraction and emits a `wastedCycle` substrateGap for edges with high cyclic fraction and no net posterior movement. This makes validator-dispatch-style livelock detectable rather than only suppressible by ablation.

#### Scenario: Induced loop is detected

- **WHEN** a bounded loop circulates (output shapes re-enter an ancestor's input pool) with no posterior delta across the loop
- **THEN** `cyclic-flow-scan` emits a `wastedCycle` substrateGap naming the edge, its cyclic fraction, and its posterior delta

### Requirement: Stability is reported as a per-window trend alongside growth

The substrate SHALL emit a `stability-trend` observable per window carrying a convergence scalar (fraction of reachable `(s,a)` cells with `Var[Beta]` below threshold) and an inter-arm curl scalar (mean absolute disagreement between forward-arm `P(success|activity,shape)` and reverse-arm `P(activity|signature)` on shared edges), and a `detection-coverage` observable (fraction of detected horizons closed autonomously vs operator-escalated, trace-verified).

#### Scenario: Growing and stabilising

- **WHEN** coverage breadth increases across ≥3 consecutive windows
- **AND** the convergence scalar is non-decreasing and the inter-arm curl scalar is non-increasing across the same windows
- **THEN** the `stability-trend` reports growth-with-stabilisation and the extended lift criterion's stability conjunct holds

#### Scenario: Growth without stability is caught

- **WHEN** coverage breadth increases but inter-arm curl rises across windows
- **THEN** the `stability-trend` reports a non-decreasing-stability violation and the extended lift criterion does not hold

### Requirement: Autonomous-authoring claims require trace evidence

A detector SHALL count as autonomously authored in `detection-coverage` only when trace inspection confirms drafter provenance (not an operator commit), at least one firing trace, and emission of its declared `substrateGap` class with non-stub substance.

#### Scenario: Label without evidence does not count

- **WHEN** a detector activity carries a "substrate-authored" label but no firing trace emitting its declared class exists
- **THEN** it is not counted toward `detection-coverage`
