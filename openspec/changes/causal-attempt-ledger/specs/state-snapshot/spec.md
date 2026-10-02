## ADDED Requirements

### Requirement: A snapshot identifies the state it measured
A `stateSnapshot` SHALL record, besides check verdicts: the repository sha per touched
repository, the deployed artifact identity of each affected vessel (the runtime
`/vessels/<vessel>` tree hash or image digest), the vessel inventory fingerprint, a
configuration fingerprint, the check-definition version of every check it ran, and the
execution context (`attempt_id` or `baseline_sweep`). Snapshots SHALL be stored as
impulses that point at these artifacts rather than copies of them.

#### Scenario: Runtime and repository differ
- **WHEN** a vessel's runtime tree differs from its push clone at the same sha
- **THEN** the snapshot records both identities and the difference is visible when two
  snapshots are compared

### Requirement: Verdicts are five-valued
Every check verdict in a snapshot SHALL be one of `pass`, `fail`, `unknown`, `timeout`,
`not_applicable`. A check that cannot run, errors, or swallows an upstream failure SHALL
report `unknown` or `timeout`, never `pass` and never an empty result counted as zero.

#### Scenario: A check's upstream is unreachable
- **WHEN** a check's data source returns an error or 401
- **THEN** its verdict is `unknown` with the error recorded
- **AND** the snapshot does not report the check as passing

### Requirement: The baseline check set cannot be opted out of
Every snapshot SHALL evaluate the baseline check set, whose membership SHALL be read from
a shaped impulse at evaluation time. An attempt's `invariant_select` MAY add checks
(checks bound to its touched files, including doc claims about those files, and the gap's
own predicate) and SHALL NOT remove baseline checks.

#### Scenario: Selection adds, never subtracts
- **WHEN** `invariant_select` runs for an attempt touching one file
- **THEN** the resulting `invariantSet` contains every baseline check plus the selected
  checks

### Requirement: Evaluation is read-only
`invariant_evaluate` SHALL invoke checks in a mode that does not write gaps, heartbeats
or other state. A check that cannot be invoked without side effects SHALL NOT be a member
of the baseline set.

#### Scenario: An observer with gap emission
- **WHEN** `invariant_evaluate` calls `systemd_unit_health_observer`
- **THEN** it passes the option that disables gap emission and no gap's `updated_at`
  changes as a result
