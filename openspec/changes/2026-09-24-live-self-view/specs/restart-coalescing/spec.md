## ADDED Requirements

### Requirement: A vessel owes at most one self-restart
Before scheduling a `mitosis-self-restart-<id>` transient unit, the cutover SHALL check
systemd for an existing `mitosis-self-restart-*` unit for the same vessel that is
`active` or `activating`. If one exists it SHALL NOT schedule another; it SHALL record
`self-restart already owed by <unit>` with status `ok` in its operations and report the
restart as scheduled. Any error in the check SHALL be treated as "not owed".

#### Scenario: Two landings inside one quiesce window
- **WHEN** a second cutover completes while the first's restart unit is still waiting on `in_flight`
- **THEN** exactly one `mitosis-self-restart-*` unit exists for the vessel
- **AND** the second cutover's operations contain `self-restart already owed by`
- **AND** the eventual restart runs the clone HEAD, which includes both landings

#### Scenario: No unit owed
- **WHEN** no `mitosis-self-restart-*` unit is active for the vessel
- **THEN** the cutover schedules one exactly as before
