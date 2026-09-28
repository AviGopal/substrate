## ADDED Requirements

### Requirement: A restart caused by a foreign cutover is detected
A sweep SHALL read development-vessel's `[restart-attribution]` journal lines for a
window (default one hour) and the node's push clone set, and SHALL count a
`foreign_cutover` for each restart whose cutover vessel this node does not own, alongside
the total restarts and the lossy ones (restarts that observed work in flight). When
`foreign_cutovers` is non-zero it SHALL file or update one gap per node per day, keyed
`composer-interruption-<node>-<day>`.

#### Scenario: Foreign cutover
- **WHEN** a restart line names a cutover on a vessel absent from the node's clone set
- **THEN** the report counts it as a foreign cutover and the day's gap is open

#### Scenario: Self-update (control)
- **WHEN** restart lines name cutovers only on vessels the node owns
- **THEN** `foreign_cutovers` is 0, lossy restarts are still counted, and no gap is filed

#### Scenario: Unreadable journal
- **WHEN** the journal read returns no lines
- **THEN** the report says `journal unreadable`, carries no verdict and files nothing, so
  a failed read never looks like a quiet hour

### Requirement: The report is a shape, scheduled by a rhythm
The sweep SHALL be served and advertised as `composerInterruptionReport` (`node`,
`hours`, `lines_read`, `restarts`, `lossy`, `foreign_cutovers`, `entries`). Its cadence
SHALL come from a `timeShapedRhythm` and a `rhythmFamilyGoal` pool impulse read by the
rhythm conductor, not from a timer in code.

#### Scenario: Report resolves
- **WHEN** `composerInterruptionReport` is resolved
- **THEN** it returns the counts, and the gap (when filed) carries the same
  `foreign_cutovers`

#### Scenario: Rhythm drives it
- **WHEN** the composer-interruption rhythm is due
- **THEN** the conductor enqueues its family goal and a dispatch resolves the report
