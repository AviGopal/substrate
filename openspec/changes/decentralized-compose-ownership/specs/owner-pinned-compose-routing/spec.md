## ADDED Requirements

### Requirement: A composer answers which repos it owns
development-vessel SHALL serve the shape `composeOwnership`, returning `node` (this
node's substrate name) and `owned_repos` (the sorted list of vessels with a push clone
on this node, read at request time), and SHALL advertise the shape through discovery so
it resolves across the federation transport.

#### Scenario: Answer reflects the clone set
- **WHEN** `{ type: "composeOwnership" }` is resolved at a development-vessel
- **THEN** the body carries that node's name and exactly the vessels with a push clone
  under its clone root

#### Scenario: Discovery is not changed
- **WHEN** this requirement is implemented
- **THEN** no file under discovery-vessel changes, since discovery-vessel is a protected
  vessel that autonomous cutovers refuse

### Requirement: An edit-intent compose goes to the owner
goal-host's early edit-intent path SHALL derive the target vessel from the file the goal
names. When discovery returns more than one `feature_compose` row and none carries
`owned_repos`, it SHALL resolve `composeOwnership` on each row with a short timeout; a
row that does not answer claims nothing. It SHALL select the single row whose
`owned_repos` contains the target vessel. Otherwise the existing `pickSatisfierProducer`
order applies. The routing log line SHALL name the chosen `vesselId` and whether it was
chosen by ownership.

#### Scenario: Remote owner wins over local non-owner
- **WHEN** the local composer does not own the target vessel and a peer composer does
- **THEN** the compose is POSTed to the peer row's endpoint and the log reads
  `routed by ownership → <vesselId>`

#### Scenario: No row claims the vessel
- **WHEN** no composer owns the target vessel
- **THEN** the producer is chosen as before and the log reads `routed by pick`

#### Scenario: One node (negative control)
- **WHEN** discovery returns a single `feature_compose` row
- **THEN** no `composeOwnership` request is made and routing is unchanged

### Requirement: Two claimants are a gap, not a race
When two rows claim the same vessel, goal-host SHALL still route (to the row
`pickSatisfierProducer` prefers) and SHALL file a gap naming both `vesselId`s.

#### Scenario: Duplicate ownership
- **WHEN** two rows list the same vessel in `owned_repos`
- **THEN** one gap `compose-ownership-duplicate-<vessel>` is open with both ids in its
  metadata, and no second gap is filed while it stays open
