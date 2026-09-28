## ADDED Requirements

### Requirement: Compose readers resolve the target file to the tree the plan is applied to
Every reader of a target file inside `feature_compose` (anchor supply, vacuous
reference check, non-termination and dead-store simulation, co-located test discovery)
SHALL obtain the file's path from one helper that returns the push-clone path
(`<MITOSIS_PUSH_CLONE_DIR>/<vessel>/<rest>`) when that file exists and the super-repo
path (`<REPO_ROOT>/repos/<vessel>/<rest>`) otherwise.

#### Scenario: Declaration-only op on a file changed since the gitlink
- **WHEN** an op rewrites a declaration whose binding is used on the next line of the clone
- **AND** the super-repo copy predates that line
- **THEN** the vacuous gate logs `plan looked vacuous but a bound name is referenced in the target file — admitting`

#### Scenario: Anchor supply on a diverged file
- **WHEN** a compose targets a file whose clone copy differs from the super-repo copy
- **THEN** the journal shows `[fc-anchors] supplied verified-unique anchors for <file>`
- **AND** the offered anchors are lines present in the clone HEAD

#### Scenario: In-tree vessel without a clone
- **WHEN** the target belongs to a vessel with no push clone
- **THEN** the helper returns the super-repo path and every reader behaves as before
