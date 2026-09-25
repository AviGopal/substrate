## ADDED Requirements

### Requirement: The drain outlives the stage it protects
The vessel's SIGTERM drain deadline SHALL be derived from the longest stage that cannot
be parked (the cutover stage) plus a margin, and `/health` SHALL report
`drain_ms` as that value. It SHALL NOT be a fixed constant shorter than the stage.

#### Scenario: Cutover in progress at SIGTERM
- **WHEN** a cutover is committing and pushing when SIGTERM arrives
- **THEN** the drain waits until the push completes and logs `drained (0 requests in flight)`
- **AND** no `will be lost` line is logged

### Requirement: Health reports the age of the oldest in-flight request
`/health` SHALL include `in_flight_oldest_ms`, the age of the oldest long-running
request still counted, so a restart requester can decide by age rather than by count.

#### Scenario: One compose in flight for three minutes
- **WHEN** a compose has been in flight for 180 s
- **THEN** `/health` reports `in_flight: 1` and `in_flight_oldest_ms` ≥ 180000

### Requirement: An owed restart defers by age, not by count
A requester that owes a restart (pull-sync) SHALL defer while `in_flight > 0` and
`in_flight_oldest_ms` is below the compose ceiling, and SHALL restart only when the
oldest request has exceeded the ceiling or the vessel is idle. A fixed number of busy
observations SHALL NOT be a reason to restart. (Operator tier: `scripts/substrate`.)

#### Scenario: Busy lane, young work
- **WHEN** pull-sync observes `in_flight: 1` on three consecutive runs, each time a
  different compose younger than the ceiling
- **THEN** it keeps deferring and logs the oldest age, and no restart is taken

#### Scenario: Stuck request
- **WHEN** `in_flight_oldest_ms` exceeds the compose ceiling
- **THEN** the owed restart proceeds and the breadcrumb records the age
