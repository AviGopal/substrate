## ADDED Requirements

### Requirement: fleet advances only to what canaries ran and verified
The `fleet` ref of a repository SHALL only fast-forward, and only to a revision that a canary ran throughout a settle window and that passed every advance check. The substrate SHALL advance it, not an operator or CI.

#### Scenario: A change passes on the canaries
- **WHEN** a canary has run a `dev` revision set for the settle window and all checks pass
- **THEN** `fleet` fast-forwards to exactly that revision set, and `fleet` nodes converge to it

#### Scenario: A change fails on a canary
- **WHEN** a canary's checks fail for a revision set
- **THEN** `fleet` does not move, and one fleet-wide gap names the revision range, the failing check and its evidence

### Requirement: Advancing judges with checks that can fail
Each advance check (status levels, a cross-node known-answer goal, no new recurring failure class) SHALL be registered as an expectation row with a must-fail control. The verdict SHALL be written as a `goal_verification_label`.

#### Scenario: A must-fail control
- **WHEN** a canary-only change deliberately breaks a status level
- **THEN** the levels check fails and the advance is refused

### Requirement: Advancing does not touch what the learning loop grades
The known-answer goal SHALL run as a sandboxed battery run. It SHALL write no trace, memory or gap to the stores the learning loop grades, feed no `goal_paths`, and mint no templates. Advancing SHALL NOT run without the sandbox.

#### Scenario: No sandbox available
- **WHEN** the sandboxed run is unavailable on a canary
- **THEN** advancing does not run check 2 and does not advance

### Requirement: One atomic advance, from observation
An advance SHALL be one commit on the super-repo's `fleet` branch whose tree and gitlinks are the super-repo and vessel revisions observed running on the canary, never the `dev` head at advance time. It SHALL be pushed as a fast-forward of `fleet`'s own history. A canary SHALL advance only if every observed revision is at or after the revision the current `fleet` commit names, and SHALL abstain otherwise.

#### Scenario: Two canaries judge at once
- **WHEN** two canaries finish their settle windows at the same time
- **THEN** the first push wins; the other is rejected, re-fetches, and advances only if its whole observed set is at or after the new `fleet` commit

#### Scenario: A mixed set
- **WHEN** a canary's observed set is newer than `fleet` in one repository and older in another
- **THEN** it abstains

### Requirement: A fleet that stops advancing is reported
A `fleet` node that is not under a hold SHALL file one gap when it has been behind `dev` by more than a threshold for longer than a window. `hold` nodes and nodes under an active `updateHold` SHALL NOT.

#### Scenario: No canary online
- **WHEN** no canary has advanced `fleet` for longer than the window while `dev` gained commits
- **THEN** a `fleet` node files a gap naming how far behind it is
