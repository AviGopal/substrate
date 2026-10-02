## ADDED Requirements

### Requirement: Outcome comparison is deterministic
After a registered landing, a post-state `stateSnapshot` SHALL be taken with the same
`invariantSet`, and `outcome_compare` SHALL emit an `attemptOutcome` computed without an
LLM from the intent's prediction and the two snapshots. The outcome SHALL carry:
`intended` (`met | unmet | unknown`), `unexpected_flips` (checks that went from `pass` to
any non-`pass` verdict and were not predicted to change), `unknown_checks`, and
`surprise` (true when the result contradicts the prediction).

#### Scenario: A landing breaks an unrelated check
- **WHEN** a landing meets its intended effect and a baseline unit check goes from `pass`
  to `fail`
- **THEN** `attemptOutcome.intended` is `met`
- **AND** `unexpected_flips` names the unit check
- **AND** `surprise` is true

#### Scenario: Post-state cannot be measured
- **WHEN** the post-state snapshot reports `unknown` for the checks named in the
  prediction
- **THEN** `intended` is `unknown`, not `met`

### Requirement: Settlement is observed after a settle window
A settle sweep SHALL re-evaluate each registered attempt's `invariantSet` after its settle
window and emit `attemptSettlement` with verdict `held` (intended met and no unexpected
flips at settlement), `regressed` (an unexpected flip present at settlement, or the
intended effect lost), or `unresolved` (required checks `unknown` or `timeout`). The settle
window SHALL be read from a shaped impulse at sweep time. The sweep SHALL run as part of
an existing scheduled activity and SHALL NOT depend on a new timer.

#### Scenario: A regression appears after landing
- **WHEN** a check passes at post-snapshot and fails before the settle window ends
- **THEN** the settlement verdict is `regressed` and names the check

#### Scenario: A clean change settles
- **WHEN** a landing's intended checks pass and no check flips through the settle window
- **THEN** the settlement verdict is `held`

### Requirement: Settlement events are append-only and idempotent
Settlement events SHALL be appended and never rewritten. Each event SHALL be keyed by
`(attempt_id, settlement_seq)`; re-running the sweep for an attempt whose settlement for
that sequence exists SHALL produce no new event. A later observation that contradicts a
settlement SHALL be recorded as a new, linked correction event.

#### Scenario: The sweep runs twice
- **WHEN** the settle sweep processes the same attempt twice
- **THEN** exactly one settlement event exists for it

### Requirement: The ledger survives a cold boot
Attempt intents, snapshots, outcomes and settlement events SHALL be stored in the
container volume and SHALL be readable after the container is recreated from its image.

#### Scenario: Recreated container
- **WHEN** the substrate container is removed and recreated on the same volume
- **THEN** every attempt and settlement recorded before is returned by the ledger
