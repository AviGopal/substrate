## ADDED Requirements

### Requirement: Push is a capability scoped to an owner
A substrate SHALL be able to land its own commits exactly when it holds a git credential,
and every landing SHALL target the repositories of `SUBSTRATE_REPO_OWNER`. No role or
profile SHALL grant or withhold the capability by itself.

#### Scenario: A newcomer supplies a token and a fork owner
- **WHEN** a substrate is launched with `SUBSTRATE_GIT_PAT` and `SUBSTRATE_REPO_OWNER=<fork owner>`
- **THEN** its landed commits appear on the fork's working branch and on no other owner's

#### Scenario: A token without an owner
- **WHEN** a substrate is launched with `SUBSTRATE_GIT_PAT` and no `SUBSTRATE_REPO_OWNER`
- **THEN** the launch fails naming `SUBSTRATE_REPO_OWNER`; no default owner is assumed

#### Scenario: A spoke with a token
- **WHEN** a spoke is launched with a git credential
- **THEN** it may land commits; its role does not prevent it

### Requirement: Landing on a shared branch is earned by evidence
Landing on a branch that other substrates converge their running code to SHALL require a
promotion recorded in a `pushPolicy` impulse, read by the landing route at use time. The
promotion SHALL cite evidence — landings settled as held and verified by a high-confidence
activity — and SHALL NOT be granted by an environment variable.

#### Scenario: A cold substrate targets the shared branch
- **WHEN** a substrate with no settled landings attempts to land on a shared branch
- **THEN** the landing is refused with a reason naming the missing promotion, and the change
  lands on its own scoped target instead

#### Scenario: Promotion is revoked
- **WHEN** the `pushPolicy` promotion is withdrawn
- **THEN** the next landing reads the withdrawal and targets the scoped branch, without a restart

### Requirement: The environment switch is a kill switch only
`MITOSIS_DIRECT_PUSH=0` SHALL stop all landings, and SHALL be documented as an emergency
stop. No other push behavior SHALL be controlled by environment variables.

#### Scenario: Emergency stop
- **WHEN** a substrate is launched with `MITOSIS_DIRECT_PUSH=0`
- **THEN** no commit is pushed regardless of `pushPolicy`
