## ADDED Requirements

### Requirement: The install input surface is closed
The install page SHALL require no inputs beyond `SUBSTRATE_NAME`, `SUBSTRATE_PORT_PREFIX`,
the join pair `DISCOVERY_ENDPOINT` + `METABOB_API_KEY`, one LLM provider key, `PROFILE`,
`PUBLIC_IP`, and the push capability pair `SUBSTRATE_GIT_PAT` + `SUBSTRATE_REPO_OWNER`, and
SHALL mark each as optional or conditionally required. No more than one input SHALL be
required for `standalone`, two for `spoke`, `surface` and `compute`, and three for `hub`. Every other variable SHALL be
documented only in the configuration reference as advanced configuration.

#### Scenario: A root install with defaults
- **WHEN** a person sets only a provider key and runs the install page's commands
- **THEN** a container named `substrate-live` with volumes `substrate-workspace` and
  `substrate-surreal` and host ports `18xxx` is running

#### Scenario: An existing non-default fleet is adopted
- **WHEN** a fleet created today as `make up LIVE_NAME=lab` (container `lab`, volumes
  `lab-workspace`, `lab-surreal`) is relaunched with the deprecated `LIVE_NAME=lab`
- **THEN** the same container and volumes are used, no second container attaches to them,
  and the output names `SUBSTRATE_NAME` as the replacement

#### Scenario: A second fleet on the same host
- **WHEN** a person additionally sets `SUBSTRATE_NAME=lab` and `SUBSTRATE_PORT_PREFIX=24`
- **THEN** the container is `lab-live`, the volumes are `lab-workspace` and `lab-surreal`,
  the ports are `24xxx`, and no resource of the default fleet is attached

### Requirement: Launchers derive nothing
A launcher (compose, make, deploy script, CI) SHALL pass install inputs to the container
unchanged and SHALL NOT compute a value the image also computes — role, endpoints, key
requirement, container or volume names beyond manifest interpolation, or port numbers.
The role derivation SHALL exist in exactly one implementation, in the image.

#### Scenario: The spoke derivation has one home
- **WHEN** the source tree is searched for the spoke-role derivation from `DISCOVERY_ENDPOINT`
- **THEN** it is found only in the image's configuration funnel

#### Scenario: The key requirement is the same on every lane
- **WHEN** a root is launched without a provider key through the install page and through
  every supported wrapper
- **THEN** every launch boots, and every verdict reports `usable: fail` naming the missing
  provider key; no lane refuses where another boots

### Requirement: No ambient inputs
A launcher SHALL read inputs only from its explicit environment and the `.env` file the
container engine loads. It SHALL NOT read client configuration files, CLI credential
caches (such as `gh auth token`), another container's environment, or any file under the
operator's home directory to fill an unset input.

#### Scenario: A host with operator credentials behaves like a fresh host
- **WHEN** a root is launched without a provider key on a host whose
  `~/.metabob/config.json` holds one and whose `gh` is authenticated
- **THEN** the container's environment contains no provider key and no `GITHUB_TOKEN`

### Requirement: Ambiguous join inputs are refused, not guessed
When `HUB_DISCOVERY_URL` or `PEER_MULTIADDR` is set without `DISCOVERY_ENDPOINT`, boot
SHALL fail with a message naming `DISCOVERY_ENDPOINT` as the required join input, rather
than start a fleet whose role differs from the one the inputs imply.

#### Scenario: Only the hub URL is given
- **WHEN** a container starts with `HUB_DISCOVERY_URL` set and `DISCOVERY_ENDPOINT` unset
- **THEN** it does not reach `live` and its log names `DISCOVERY_ENDPOINT`

### Requirement: Deprecated inputs are honoured once, loudly
During migration, the retired names (`SUBSTRATE_CONTAINER`, `WORKSPACE_VOLUME`,
`SURREAL_VOLUME`, the nine `*_PORT` variables, `LIVE_NAME`, `PORT_OFFSET`) SHALL still take
effect and SHALL each emit a warning naming the replacing input. A retired name that
conflicts with its replacement SHALL fail the launch.

#### Scenario: A partial alias would attach another fleet's volumes
- **WHEN** a launch sets `SUBSTRATE_CONTAINER=lab` and neither volume alias nor `SUBSTRATE_NAME`
- **THEN** boot fails before any write, naming `SUBSTRATE_NAME` as the input to set, and the
  default fleet's volumes are untouched

#### Scenario: An old compose .env
- **WHEN** an `.env` sets `ACTIVITY_API_PORT=24080` and nothing else port-related
- **THEN** activity-api is published on 24080 and the launch output names
  `SUBSTRATE_PORT_PREFIX`

### Requirement: Profiles name deployable compositions
`PROFILE` SHALL select one of `standalone`, `hub`, `hub-minimal`, `spoke`, `surface`,
`compute`, and SHALL default to `standalone` for a root and `spoke` for a remote anchor. The
`hub` profile SHALL include goal-host and the compute vessels a hub needs to dispatch and
self-develop; `hub-minimal` SHALL omit them. No profile SHALL depend on units being
unmasked by hand after boot.

#### Scenario: A hub dispatches after a recreate
- **WHEN** a hub launched with `PROFILE=hub` is recreated on the same volumes
- **THEN** goal-host is enabled and active, and the verdict reaches `usable`

#### Scenario: A control-plane-only node
- **WHEN** a node is launched with `PROFILE=hub-minimal`
- **THEN** no goal-host runs and its verdict defines `usable` as routing the known-answer goal
  to a federated goal-host
