## ADDED Requirements

### Requirement: Edit tasks inline
The system SHALL allow editing task prompts, validation rules, and retry config directly in the activity card.

#### Scenario: Prompt edited inline
- **WHEN** user expands activity card and edits task 2 prompt
- **AND** changes are saved
- **THEN** modified flag shown on activity card

### Requirement: Save modifications as variant
The system SHALL create new variant preserving genealogy when user saves edited activity.

#### Scenario: Variant created from edits
- **WHEN** user modifies task and clicks "Save as Variant"
- **THEN** new variant created with `variant_of` pointing to original
- **AND** Thompson parameters initialized to α=1, β=1

### Requirement: Show Thompson competition
The system SHALL display competition between original and new variant after creation.

#### Scenario: Variant competition displayed
- **WHEN** variant created from modification
- **THEN** variant comparison panel shows original (α=45, β=3, 93%) vs new (α=1, β=1, uniform prior)
- **AND** explains selection probability for each
