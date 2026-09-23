## ADDED Requirements

### Requirement: Five ordered levels, three values
The image SHALL provide one command that reports readiness as five ordered levels —
`live`, `seeded`, `served`, `usable`, `connected` — each with a value of `pass`, `fail` or
`unknown`, plus the evidence for each. A level SHALL NOT be `pass` unless every lower level
is `pass`. A check that cannot run, times out, or receives an error from its data source
SHALL report `unknown`, never `pass`.

#### Scenario: A check's upstream is unreachable
- **WHEN** identity-vessel does not answer during evaluation
- **THEN** `seeded` is `unknown`, every higher level is `unknown`, and the command exits
  non-zero for any requested level at or above `seeded`

### Requirement: Each level proves a specific thing
- `live` SHALL pass only when every selected core unit is active with a restart count that
  did not increase during evaluation.
- `seeded` SHALL pass only when the key the client connection will carry validates.
- `served` SHALL pass only when every vessel the inventory selects is active and every
  published port is bound on a non-loopback address.
- `usable` SHALL pass only when an LLM completion succeeds on at least one arm, local or
  federated, and a known-answer goal baked into the image returns `reached:true` within a
  stated bound.
- `connected` SHALL pass only when the container has observed an authenticated request
  using the emitted key arrive through a published port from outside the container; until
  one arrives it SHALL be `unknown`.

#### Scenario: A keyless root
- **WHEN** a root boots with no provider key and no federated arm
- **THEN** `live`, `seeded` and `served` pass and `usable` is `fail`, naming the missing
  provider key

#### Scenario: A crash loop
- **WHEN** a selected unit restarts during evaluation
- **THEN** `live` is `fail` and names the unit and its restart count

#### Scenario: A hub that cannot dispatch
- **WHEN** a fleet has no active goal-host
- **THEN** `usable` is `fail` because the known-answer goal could not be dispatched

### Requirement: Every done signal reads the verdict
The image healthcheck SHALL be the verdict at level `seeded`. The launch manifest SHALL NOT
override it. Every wrapper that waits for readiness SHALL wait on the verdict and SHALL
exit non-zero when the requested level is not `pass`. The smoke check SHALL require
`reached:true`, not merely an execution id. No readiness step SHALL succeed
unconditionally.

#### Scenario: A wrapper reports a failed boot
- **WHEN** `make up` completes against a fleet whose `usable` is `fail`
- **THEN** `make up` exits non-zero and prints the verdict

### Requirement: The verdict reports what is running
The verdict SHALL report the image revision and, per vessel, the revision of the code
actually running, and SHALL flag every vessel whose running revision differs from the
image's.

#### Scenario: Pull-sync moved a vessel ahead of the image
- **WHEN** a vessel's runtime tree has converged to a newer commit than the image baked
- **THEN** the verdict lists that vessel with both revisions
