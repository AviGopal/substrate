## ADDED Requirements

### Requirement: A pushed cutover advances the super-repo gitlink
After a cutover reports `push_status: pushed` for a vessel that is a submodule of the
super-repo, the cutover SHALL set the super-repo gitlink for that vessel to the pushed
sha, commit under the substrate identity with the vessel and sha in the subject, push
`origin dev`, and record `gitlink advanced repos/<vessel> -> <sha>` in its operations.
A dirty super-repo working tree SHALL make the step refuse with
`gitlink not advanced: super-repo tree dirty` and SHALL NOT fail the cutover.

#### Scenario: Landing on a submodule vessel
- **WHEN** development-vessel lands `<sha>` and pushes
- **THEN** `git -C super-repo submodule status repos/development-vessel` reports `<sha>` within the same cutover

#### Scenario: Super-repo tree dirty
- **WHEN** the super-repo has uncommitted changes
- **THEN** the cutover completes, the gitlink is unchanged, and the refusal is in its operations

### Requirement: Gitlink lag is detected without an operator
A sweep SHALL compare every submodule's gitlink to its clone HEAD and file one gap per
vessel whose lag exceeds `gitlink_lag_max` (a shaped impulse, default 5 commits), keyed
by vessel so repeats update rather than duplicate.

#### Scenario: Lag above threshold
- **WHEN** a vessel's gitlink is 22 commits behind its clone and the threshold is 5
- **THEN** a gap `gitlink-lag-<vessel>` is open with the lag in its summary

#### Scenario: Lag zero
- **WHEN** every gitlink equals its clone HEAD
- **THEN** no `gitlink-lag-*` gap is open
