## ADDED Requirements

### Requirement: The maintenance lease has a name dimension
`maintenanceLease_write` SHALL accept an optional `name`. A named hold is stored
separately from the unnamed global hold. Acquire semantics: a named acquire is refused
if the same name is held or the unnamed global is held; an unnamed acquire is refused if
any hold exists. `resolveMaintenanceLease` SHALL answer for a name when asked and for
the union when not.

#### Scenario: Two names do not exclude each other
- **WHEN** `change_window` is held with name `trace-store`
- **AND** a cutover acquires with name `cutover`
- **THEN** the cutover's acquire succeeds and both holds are listed

#### Scenario: Unnamed hold still excludes everything
- **WHEN** an unnamed `change_window` hold exists
- **THEN** a named acquire is refused with `held_by` naming the unnamed holder

### Requirement: Cutovers and the reconcile use their own names
`vessel_mitosis_cutover` SHALL acquire `change_window` with name `cutover`; the
trace-store reconcile activity SHALL acquire with name `trace-store`. A reconcile hold
SHALL NOT cause a cutover to be deferred or refused.

#### Scenario: Reconcile running during a landing
- **WHEN** the reconcile holds its named lease and a FAVORABLE compose reaches cutover
- **THEN** the cutover is not refused for the lease and pushes

### Requirement: The reconcile releases on failure and fits its work
The reconcile activity SHALL release its lease when any task after `acquire_lease`
fails, and its fetch to the pruning valve SHALL have a timeout no shorter than the
valve's measured duration. A run that fails SHALL NOT leave the lease held to its TTL.

#### Scenario: Valve slower than the fetch
- **WHEN** the valve takes 6 minutes
- **THEN** the run completes (no `fetch failed: The operation was aborted`) and the lease
  is released within one minute of completion

#### Scenario: A task fails mid-run
- **WHEN** the verify task fails
- **THEN** the release task still runs and `maintenance.json` is absent within 30 s
