## ADDED Requirements

### Requirement: Infer expected shapes from goal text
The system SHALL extract keywords from goal text and infer expected output shapes.

#### Scenario: Shapes inferred from keywords
- **WHEN** goal text is "Fix authentication bug and add tests"
- **THEN** expected shapes inferred as ["bugFixed", "testResults", "sourceCode", "gitCommit"]

### Requirement: Display goal completion percentage
The system SHALL calculate and display percentage of expected shapes present in current state.

#### Scenario: Progress bar shows completion
- **WHEN** goal expects 5 shapes and 3 are present
- **THEN** progress bar shows "60% (3/5 shapes)"

### Requirement: Highlight missing shapes
The system SHALL visually distinguish present vs missing expected shapes.

#### Scenario: Missing shapes indicated
- **WHEN** 2 of 5 expected shapes are missing
- **THEN** missing shapes shown with ⊗ icon and muted color
- **AND** present shapes shown with ✓ icon
