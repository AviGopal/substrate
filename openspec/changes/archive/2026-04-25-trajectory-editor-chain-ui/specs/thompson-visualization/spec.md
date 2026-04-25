## ADDED Requirements

### Requirement: Display Thompson parameters
The system SHALL display Thompson Sampling alpha and beta parameters for each activity variant.

#### Scenario: Parameters visible on activity card
- **WHEN** activity has Thompson parameters α=45, β=3
- **THEN** card displays "93% success (α=45, β=3)"

### Requirement: Show confidence intervals
The system SHALL calculate and display 90% confidence intervals for success rate predictions.

#### Scenario: Confidence interval displayed
- **WHEN** variant has α=10, β=2
- **THEN** confidence interval shown as horizontal bar with shaded region [75% - 92%]

### Requirement: Display shape-conditioned scores
The system SHALL show success rates conditioned on specific input shape combinations.

#### Scenario: Context-sensitive success rate
- **WHEN** activity with shapes ["errorLog", "sourceCode"] has 94% success
- **AND** same activity with only ["errorLog"] has 61% success
- **THEN** both rates shown with shape context
