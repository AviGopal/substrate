# parked-landing Specification

## Purpose
A verified patch is parked before its cutover and resumed instead of redrafted when the cutover is refused, deferred or interrupted, and verified-then-discarded landings are counted without an operator.

## Requirements
### Requirement: A verified patch is parked before its cutover
A `feature_compose` run SHALL write a `parkedLanding` for its gap before invoking
`vessel_mitosis_cutover`, once it has applied its plan, passed verify (typecheck, shape
dispatch, test delta) and passed the semantic gate. The park SHALL carry `gap_id`,
`compose_id`, `base_sha`, the applied diff per file, the verify summary, the judge
verdict and `parked_at`. A cutover that reports `push_status: pushed` SHALL delete the
park; any other outcome SHALL leave it in place and log
`[feature-compose] cutover did not land — verified patch parked for <gap_id>`.

#### Scenario: Cutover refused by a held lease
- **WHEN** the cutover returns `refused` with `lease: change_window`
- **THEN** the live tree is restored as today
- **AND** `/workspace/parked-landings/<gap_id>.json` exists with the applied diff
- **AND** the compose report's `parked` field is `true`

#### Scenario: Cutover pushed
- **WHEN** the cutover returns `push_status: pushed`
- **THEN** no park file exists for the gap after the run

### Requirement: A fresh park is resumed instead of redrafted
`gap_to_feature` SHALL dispatch `feature_compose` with `resume_from` set to the park
whenever the picked gap has a park younger than `parked_landing_ttl` (a shaped impulse,
default 24 h). The compose SHALL skip drafting and the test suite,
re-apply the diff onto the current base, run typecheck, and proceed to the cutover.
The journal SHALL show `[feature-compose] RESUMING parked landing for <gap_id>
(parked <age>)`. A park whose diff no longer applies SHALL be deleted with a
`failure_lessons` entry of class `park_stale` and the gap SHALL fall back to drafting.

#### Scenario: Resume after a lease refusal
- **WHEN** a park exists from a refusal 6 minutes ago and the gap is picked
- **THEN** the compose logs the RESUMING line, runs no drafter call and no `bun test`
- **AND** the landing pushes with a commit whose diff equals the parked diff

#### Scenario: Base moved under the park
- **WHEN** the parked diff fails to apply to the current base
- **THEN** the park is removed, a `park_stale` lesson is written, and a normal draft runs

### Requirement: Interrupted composes park what they have
A compose SHALL write its park before it calls the cutover, so a verified patch is
already parked when a restart arrives, and the SIGTERM drain SHALL count only cutovers in
progress (a `cutover`-named lease hold) as work worth waiting for. A compose earlier than
the semantic gate has nothing parked and is re-picked later.

#### Scenario: Restart during verify
- **WHEN** a restart is requested while a compose is in `bun test`
- **THEN** the drain exits promptly, no park is written, and the gap is re-picked later

#### Scenario: Restart after the gate
- **WHEN** a restart is requested after the semantic gate passed and before push
- **THEN** the park written before the cutover survives, and the next compose for the gap
  resumes it

### Requirement: Discarded landings are detected without an operator
A scheduled sweep SHALL emit a `discardedLandingReport` counting, per hour, composes
whose report shows a FAVORABLE gate and no `push_status: pushed`, split by cause
(`lease_refused`, `drain_killed`, `deferred`, `other`). When the count is non-zero it
SHALL write an open gap keyed by day (`discarded-landings-<YYYY-MM-DD>`), carrying the
counts, so recurrence is a gap event and not a journal grep.

#### Scenario: One refused landing in the hour
- **WHEN** a FAVORABLE compose was refused at cutover in the last hour
- **THEN** the next sweep's report shows `lease_refused: 1` and the day's gap is open
