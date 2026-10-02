## ADDED Requirements

### Requirement: Deterministic refusals persist as facts with invalidation conditions
The system SHALL record every deterministic refusal (push scope refused, pinned posterior
refusal, no producer, protected target) as a negative fact keyed by goal hash or target, with
the condition that invalidates it: the target clone's head sha, the discovery producer set,
the posterior count, or a TTL. The fact SHALL survive restarts.

#### Scenario: Fact recorded
- **WHEN** a dispatch is refused for a deterministic reason
- **THEN** a negative fact with that reason and an invalidation condition is persisted

### Requirement: Negative facts are consulted before spending
goal-host SHALL check negative facts at dispatch admission (before symbol proposal or any
LLM call) and at the start of recovery; a matching, still-valid fact SHALL return its
recorded refusal without spending. A fact whose invalidation condition has changed SHALL be
dropped and the dispatch proceeds.

#### Scenario: Known refusal is not re-bought
- **WHEN** the same goal is dispatched again and its negative fact is still valid
- **THEN** the dispatch returns the recorded refusal with zero LLM calls

#### Scenario: Condition changed
- **WHEN** the target's push remote or head sha changed since the fact was recorded
- **THEN** the fact is dropped and the dispatch proceeds normally
