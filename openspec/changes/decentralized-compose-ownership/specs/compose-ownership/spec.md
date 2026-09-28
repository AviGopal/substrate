## ADDED Requirements

### Requirement: A node composes only for repos it holds a push clone for
The gap picker SHALL admit a gap for autonomous compose only when the gap's target
vessel has a push clone under the mitosis clone directory on this node. The
discriminator SHALL be the clone directory (`CLONE_DIR/<vessel>/.git`), not the runtime
source tree, which the image ships on every node.

#### Scenario: Owned repo is admitted
- **WHEN** a gap targets a vessel whose push clone exists on this node
- **THEN** admission proceeds unchanged and the journal pick line carries `owner=<node>`

#### Scenario: Foreign repo is skipped, once, with a reason
- **WHEN** a gap targets a vessel with no push clone on this node
- **THEN** the picker skips it, logs `skipped: not owned here (<vessel>)`, and does not
  count the skip as a backoff failure for the gap

#### Scenario: Single node owns everything (negative control)
- **WHEN** every vessel in the inventory has a push clone on this node
- **THEN** the set of admitted gaps is identical to the set admitted before this
  requirement existed

### Requirement: The owned set is read at use time
The picker SHALL read the clone directory on each admission pass, not at process start,
so a clone added or removed while the vessel runs changes ownership without a restart.

#### Scenario: Clone removed while running
- **WHEN** an owned repo's push clone is removed
- **THEN** the next admission pass skips gaps for that repo
