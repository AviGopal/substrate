# Value-of-information goal selection

## ADDED Requirements

### Requirement: Boredom goal selection is a value-of-information bandit

The boredom-vessel SHALL select each tick's goal by Thompson sampling over per-goal Beta posteriors keyed on recent information yield, gated by the existing load-triage. Round-robin MUST remain the cold-start behaviour (uniform under Beta(1,1) priors), so the change is never worse than current behaviour.

#### Scenario: High-payoff detector is selected sooner than round-robin

- **WHEN** a detector goal has recently produced information yield (a `Var[Beta]` reduction beyond ε, a fresh gap-class, or a posterior-moving verdict)
- **THEN** its selection probability rises and its expected ticks-to-dispatch falls well below the round-robin worst case of one full rotation

#### Scenario: Load triage still binds

- **WHEN** the substrate is under `load_anomaly_severe`
- **THEN** only cheap goals are selectable regardless of their information-yield posterior

### Requirement: Never-closing loops are penalised in selection

A goal's information-yield reward SHALL be multiplied by `(1 − cyclic_fraction)` from the cyclic-flow scan, so goals that spin without closing learning loops decay in selection probability.

#### Scenario: Zero-work loop decays

- **WHEN** a goal's dispatches participate in high cyclic-fraction edges with no posterior movement
- **THEN** its effective reward approaches zero and its selection probability decays across subsequent windows
