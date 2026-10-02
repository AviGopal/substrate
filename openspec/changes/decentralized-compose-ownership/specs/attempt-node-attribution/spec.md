## ADDED Requirements

### Requirement: An attempt names the node that made it
`registerAttempt` SHALL stamp every `attemptIntent` record with `node`, the composing
node's substrate name, so a settlement can be read against the node whose checks
produced it.

#### Scenario: Intent carries the node
- **WHEN** any route registers an attempt
- **THEN** the `attemptIntent` record has a non-empty `node` equal to this node's
  substrate name, and the settlement for that attempt carries the same value

### Requirement: An unobservable check settles unknown, never pass
`evaluateChecks` SHALL record `systemd_units` as `unknown`, with detail `target not resident
on <node>`, when an attempt's target vessel does not run on the composing node, and the
settlement SHALL list that check as unresolved rather than held or regressed.

#### Scenario: Non-resident target
- **WHEN** the landed repo's vessel has no systemd unit on this node
- **THEN** the post-landing snapshot's `systemd_units` verdict is `unknown` with that
  detail, and `ledger_canary` and `gate_self_probe` are evaluated as usual

#### Scenario: Resident target (control)
- **WHEN** the landed repo's vessel runs on this node
- **THEN** `systemd_units` is evaluated as before and the settlement is `held` or
  `regressed` on its evidence
