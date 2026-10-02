## ADDED Requirements

### Requirement: Unfavorable outcomes reach the drafter at prompt-build
The system SHALL deliver unfavorable outcomes to the drafter's existing prompt-build
channels. When an `attemptOutcome` has `surprise: true` or an `attemptSettlement` is
`regressed`, the system SHALL write a lesson naming the attempt, the flipped checks and the landed sha
into (a) the targeted gap's `failure_lessons`, which the drafter's
`priorAttemptFeedbackBlock` reads, and (b) the file-keyed compose lessons for each touched
file. No new reader SHALL be introduced for this delivery.

#### Scenario: The next draft on the same file sees the consequence
- **WHEN** an attempt touching a file settles `regressed`
- **AND** a later `feature_compose` drafts a change to the same file
- **THEN** the drafter's prompt contains the lesson naming the earlier attempt and the
  check it broke

### Requirement: Extraction is deferred until settlement holds
An execution whose outcome includes a registered landing SHALL NOT be extracted into a
template by `mintReachedTrace` or the ribosome until its `attemptSettlement` is `held`.
A `regressed` settlement SHALL cancel the deferred extraction; an `unresolved` settlement
SHALL keep it deferred. An execution linked to an unaccounted landing never settles and
SHALL NOT be extracted.

#### Scenario: A regressing landing is not crystallized
- **WHEN** an execution reaches by landing a change that later settles `regressed`
- **THEN** no template is extracted from that execution

#### Scenario: An unaccounted shell landing is not crystallized
- **WHEN** a walk reaches by committing through a shell resolver with no registered attempt
- **THEN** no template is extracted from that execution

#### Scenario: A held landing is crystallized
- **WHEN** the same kind of execution settles `held`
- **THEN** extraction proceeds as it would have without deferral

### Requirement: Settlement is visible to credit without being banked twice
Each `attemptSettlement` SHALL carry the `authoring_execution_id` so a credit consumer can
attach to the real execution chain. This change SHALL NOT write posteriors; binding
settlement into credit is deferred to a change that first provides an idempotency key on
the credit write.

#### Scenario: Settlement resolves to a chain
- **WHEN** a settlement event is read
- **THEN** its `authoring_execution_id` resolves to an `execution` row with a
  `composition_chain`
