# change-window-names Specification

## Purpose
The maintenance change_window lease carries an optional name, so a hold on one resource (the trace-store reconcile, name `trace_store`) does not exclude work on another (cutovers, name `cutover`); an unnamed hold still means everything.

## Requirements
### Requirement: The maintenance lease has a name dimension
`maintenanceLease_write` SHALL accept an optional `name`. A named hold is stored
separately from the unnamed global hold. Acquire semantics: a named acquire is refused
if the same name is held or the unnamed global is held; an unnamed acquire is refused if
any hold exists. `resolveMaintenanceLease` SHALL answer for a name when asked and for
the union when not. A named read SHALL report `held: true` when that name is held OR
the unnamed global is held (an unnamed hold means everything, for readers as for
acquirers); existing readers that pass a lease *kind* as `name` (the drain observer
asks for `trace_store` and `change_window`) therefore still see the global hold.

#### Scenario: Two names do not exclude each other
- **WHEN** `change_window` is held with name `trace_store`
- **AND** a cutover acquires with name `cutover`
- **THEN** the cutover's acquire succeeds and both holds are listed

#### Scenario: Unnamed hold still excludes everything
- **WHEN** an unnamed `change_window` hold exists
- **THEN** a named acquire is refused with `held_by` naming the unnamed holder
- **AND** a read for any name reports `held: true`

### Requirement: Cutovers and the reconcile use their own names
`vessel_mitosis_cutover` SHALL acquire `change_window` with name `cutover`; the
trace-store reconcile activity SHALL acquire with name `trace_store`. A reconcile hold
SHALL NOT cause a cutover to be deferred or refused.

#### Scenario: Reconcile running during a landing
- **WHEN** the reconcile holds its named lease and a FAVORABLE compose reaches cutover
- **THEN** the cutover is not refused for the lease and pushes

### Requirement: The reconcile releases before it verifies and fits its work
The reconcile activity SHALL release its lease before its post-swap verify, and its
fetch to the pruning valve SHALL have a timeout no shorter than the valve's measured
duration. Verify is a dry-run read that needs no lease and is the task that fails most,
so a failing verify SHALL NOT leave the lease held. A failure of the reconcile task
itself leaves only the `trace_store` hold until its TTL, which does not exclude cutovers.
The template body reaches a running catalogue by raising `metadata.seed_version`.

#### Scenario: Valve slower than the fetch
- **WHEN** the valve takes 6 minutes
- **THEN** the run completes (no `fetch failed: The operation was aborted`) and the lease
  is released within one minute of completion

#### Scenario: Verify fails after the swap
- **WHEN** the verify task fails
- **THEN** `release_lease` has already run and no `trace_store` lease file remains
