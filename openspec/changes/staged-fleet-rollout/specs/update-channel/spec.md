## ADDED Requirements

### Requirement: Each node declares an update channel
A node SHALL declare which revision it runs with one install input, `SUBSTRATE_UPDATE_CHANNEL`, whose value is `canary`, `fleet` (the default) or `hold`. An unknown value SHALL be refused at boot, naming the three values, before anything is written.

#### Scenario: A typo in the channel
- **WHEN** a node boots with `SUBSTRATE_UPDATE_CHANNEL=fleeet`
- **THEN** gen-env exits non-zero and names `canary`, `fleet` and `hold`

#### Scenario: No channel given
- **WHEN** a node boots without the input
- **THEN** its channel is `fleet`

### Requirement: A node that lands code is a canary
A node that can land code (a git token, and the landing kill switch unset or 1) SHALL run `dev`. With no channel given it SHALL be a canary, and an explicit `fleet` or `hold` SHALL be refused at boot, naming both ways out.

#### Scenario: An authoring node set to fleet
- **WHEN** a node with `SUBSTRATE_GIT_PAT` boots with `SUBSTRATE_UPDATE_CHANNEL=fleet`
- **THEN** gen-env exits non-zero and says to use `canary` or stop landing (remove the token, or set `MITOSIS_DIRECT_PUSH=0`)

### Requirement: A non-canary node runs its channel's ref
On a node whose channel is `fleet`, pull-sync SHALL converge every vessel clone and the super-repo clone to the channel's ref, and every runtime comparison (skip, last-good, unhealthy revert) SHALL use that tree.

#### Scenario: A landing on dev, seen from a fleet node
- **WHEN** a commit lands on `dev` and has not been advanced
- **THEN** a `fleet` node's vessels do not run it

#### Scenario: An unhealthy vessel on a fleet node
- **WHEN** a vessel converged to `fleet` comes up unhealthy
- **THEN** pull-sync restores the previous `fleet` revision, never a `dev` revision

### Requirement: A missing channel ref fails closed
When a node's channel ref does not exist, pull-sync SHALL converge nothing, record `ref_missing`, and file a gap. It SHALL NOT fall back to `dev`.

#### Scenario: fleet before its ref exists
- **WHEN** a `fleet` node runs pull-sync and the remote has no `fleet` ref
- **THEN** `/vessels` is unchanged and `substrate-status` reports `channel_ref_missing`

### Requirement: The channel in effect is observable
pull-sync SHALL write a convergence record each run (channel, ref, runtime SHAs, time, ref_missing). `substrate-status` SHALL report the declared channel, and SHALL report it as enforced only when that record names the declared channel, its ref exists, and the record is fresh.

#### Scenario: Declared but not yet enforced
- **WHEN** a node declares `fleet` and pull-sync has written no convergence record
- **THEN** `substrate-status` reports the channel as not in effect, and says every vessel still follows `dev`

### Requirement: A hold can be set without a recreate
pull-sync SHALL honour a time-limited `updateHold` impulse for the node, overriding its channel until the hold expires.

#### Scenario: Freezing the hub for a drain
- **WHEN** an `updateHold` impulse for the hub is written with an expiry two hours away
- **THEN** the hub's running revision does not change for two hours, and then resumes following its channel without any operator step
