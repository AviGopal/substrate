## ADDED Requirements

### Requirement: Each node declares an update channel
A node SHALL declare which revision it runs with one install input, `SUBSTRATE_UPDATE_CHANNEL`, whose value is `canary` (the default), `fleet` or `hold`. An unknown value SHALL be refused at boot, naming the three values, before anything is written.

#### Scenario: A typo in the channel
- **WHEN** a node boots with `SUBSTRATE_UPDATE_CHANNEL=fleeet`
- **THEN** gen-env exits non-zero and names `canary`, `fleet` and `hold`

#### Scenario: No channel given
- **WHEN** a node boots without the input
- **THEN** its channel is `canary`, today's behaviour

### Requirement: A node that authors or judges landings is a canary
A node whose landing switch (`MITOSIS_DIRECT_PUSH`) is anything but `0`, and the node that holds its gap store (it runs development-vessel and has no `GAP_STORE_ENDPOINT`), SHALL run `dev`. A node that consumes SHALL NOT draft: gap admission SHALL exclude a node whose landings are stopped. On `fleet` or `hold`, an unset landing switch SHALL be set to `0`. An explicit non-zero landing switch, or being the gap-store holder, SHALL be refused at boot, naming the way out.

#### Scenario: fleet with landing on
- **WHEN** a node boots with `SUBSTRATE_UPDATE_CHANNEL=fleet` and `MITOSIS_DIRECT_PUSH=2`
- **THEN** gen-env exits non-zero and says to use `canary` or set `MITOSIS_DIRECT_PUSH=0`

#### Scenario: fleet on the gap-store holder
- **WHEN** a node with no `GAP_STORE_ENDPOINT` boots with `SUBSTRATE_UPDATE_CHANNEL=fleet`
- **THEN** gen-env exits non-zero and says to use `canary` or point `GAP_STORE_ENDPOINT` at an authoring node

#### Scenario: A surface node
- **WHEN** a `surface` profile node, which runs no development-vessel, boots with `SUBSTRATE_UPDATE_CHANNEL=fleet`
- **THEN** its channel is `fleet` and its landing switch is `0`

#### Scenario: A consumer node
- **WHEN** a node with a remote `GAP_STORE_ENDPOINT` boots with `SUBSTRATE_UPDATE_CHANNEL=fleet` and no landing switch
- **THEN** its channel is `fleet` and its landing switch is `0`

### Requirement: A non-canary node runs the fleet manifest
On a node whose channel is `fleet`, pull-sync SHALL converge the super-repo clone to the super-repo `fleet` commit, and each vessel clone to the revision that commit's gitlink names, and every runtime comparison (skip, last-good, unhealthy revert) SHALL use that tree.

#### Scenario: A landing on dev, seen from a fleet node
- **WHEN** a commit lands on `dev` and has not been advanced
- **THEN** a `fleet` node's vessels do not run it

#### Scenario: A manifest revision no longer exists
- **WHEN** the `fleet` commit names a vessel revision that a force-push removed from `dev`
- **THEN** pull-sync converges nothing, keeps every vessel at last-good, and files one gap

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
