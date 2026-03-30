## ADDED Requirements

### Requirement: Intent markers guide learning direction
Activities SHALL declare whether code should conform to expectations or expectations should evolve with code.

#### Scenario: Declare code-must-conform intent
- **WHEN** activity expectation has intent "code-must-conform"
- **THEN** validation failures trigger code fix activities

#### Scenario: Declare expectations-may-evolve intent
- **WHEN** activity expectation has intent "expectations-may-evolve"
- **THEN** validation failures trigger expectation update activities

#### Scenario: Intent defaults to expectations-may-evolve
- **WHEN** activity expectation does not specify intent
- **THEN** system assumes expectations-may-evolve for backward compatibility

### Requirement: Generate expectations from successful traces
The system SHALL create expectations automatically from validated execution patterns.

#### Scenario: Extract expectation from consistent behavior
- **WHEN** trace point exhibits consistent state across 5+ successful executions
- **THEN** system generates execution-expectation impulse with observed pattern

#### Scenario: Calculate tolerance from variance
- **WHEN** numeric values vary slightly across successful executions
- **THEN** system sets expectation value to mean and tolerance to 2x standard deviation

#### Scenario: User approves generated expectations
- **WHEN** system generates expectations from traces
- **THEN** expectations are marked as auto-generated until user reviews and approves

### Requirement: Update expectations from evolved code
The system SHALL refine expectations when code behavior intentionally changes.

#### Scenario: Detect intentional behavior change
- **WHEN** multiple recent executions produce consistent new behavior different from expectation
- **THEN** system suggests expectation update with new observed pattern

#### Scenario: Update expectation with confidence threshold
- **WHEN** expectation update is suggested
- **THEN** system requires 3+ consistent traces showing new behavior before applying update

#### Scenario: Preserve expectation history
- **WHEN** expectation is updated
- **THEN** system versions expectations and maintains history with timestamps and reasons

### Requirement: Distinguish bugs from evolution
The system SHALL differentiate between regression bugs and intentional behavior changes.

#### Scenario: Regression detection via inconsistency
- **WHEN** single execution fails expectation but previous executions succeeded
- **THEN** system marks as likely regression and triggers code-must-conform response

#### Scenario: Evolution detection via consistency
- **WHEN** multiple consecutive executions show new consistent behavior
- **THEN** system marks as likely evolution and triggers expectations-may-evolve response

#### Scenario: User override of classification
- **WHEN** system mis-classifies regression vs evolution
- **THEN** user can manually mark validation failure as bug or evolution

### Requirement: Bidirectional learning improves over time
The system SHALL track accuracy of intent classification and improve decision-making.

#### Scenario: Record classification outcomes
- **WHEN** system classifies validation failure as bug or evolution
- **THEN** system records classification and eventual resolution (code fixed vs expectation updated)

#### Scenario: Learn classification patterns
- **WHEN** sufficient classification outcomes recorded
- **THEN** system uses patterns to improve future classification confidence

#### Scenario: Suggest intent markers
- **WHEN** creating new expectations
- **THEN** system suggests intent markers based on learned patterns from similar activities

### Requirement: Expectation evolution is auditable
All expectation changes SHALL be traceable to specific executions and decisions.

#### Scenario: Link expectation versions to traces
- **WHEN** expectation is generated or updated
- **THEN** system records which execution traces triggered the change

#### Scenario: Record decision rationale
- **WHEN** expectation is updated
- **THEN** system stores reason (user action, auto-generated, learned pattern) and confidence

#### Scenario: Query expectation evolution history
- **WHEN** reviewing expectation changes
- **THEN** system can show timeline of versions with triggering executions and decisions
