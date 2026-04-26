## ADDED Requirements

### Requirement: Validator activities are identified by output_shapes containing validation_result
An activity SHALL be treated as a validator if and only if its declared `output_shapes` contains the literal string `"validation_result"`. No other marker (no boolean field, no separate registry, no source-side type) SHALL be required to identify a validator.

#### Scenario: Activity with validation_result in output_shapes is a validator
- **WHEN** an activity's template declares `output_shapes: ["validation_result"]`
- **THEN** the validator-dispatch meta-activity treats it as a candidate validator

#### Scenario: Activity with validation_result among multiple output shapes is still a validator
- **WHEN** an activity's template declares `output_shapes: ["validation_result", "memo"]`
- **THEN** the activity is treated as a validator; the additional `memo` output does not disqualify it

#### Scenario: Activity without validation_result in output_shapes is not a validator
- **WHEN** an activity's template declares `output_shapes: ["bash_output"]`
- **THEN** the validator-dispatch meta-activity does NOT treat it as a candidate validator regardless of any other field

### Requirement: Specialized validators declare input_shapes for the shapes they validate
A specialized validator SHALL declare in its `input_shapes` the shapes it is designed to validate (e.g. `["json", "structured_data"]` for a schema validator, `["bash_output"]` for a behavioural validator). The validator-dispatch meta-activity SHALL match validators to produced shapes by intersecting the produced shape with the validator's `input_shapes`.

#### Scenario: Specialized validator matches a produced shape literally
- **WHEN** a task produces an impulse with shape `bash_output` and a validator declares `input_shapes: ["bash_output"]`
- **THEN** the validator is selected for dispatch

#### Scenario: Specialized validator does not match an unrelated shape
- **WHEN** a task produces an impulse with shape `markdown_document` and a validator declares `input_shapes: ["bash_output"]`
- **THEN** the validator is not selected

### Requirement: Wildcard validators declare input_shapes equal to the singleton ["*"]
A wildcard validator SHALL declare `input_shapes: ["*"]` exactly. The wildcard SHALL match any produced shape. No other notation (`null`, `[]`, `["any"]`, regex) SHALL be recognized as a wildcard.

#### Scenario: Wildcard validator matches any shape
- **WHEN** a task produces an impulse with shape `markdown_document` and a validator declares `input_shapes: ["*"]`
- **THEN** the validator is selected for dispatch alongside any specialized validators

#### Scenario: Empty input_shapes array is not a wildcard
- **WHEN** a validator declares `input_shapes: []`
- **THEN** the meta-activity does NOT treat it as a wildcard and does NOT dispatch it for any shape

### Requirement: Specialized validators are preferred over wildcards
When at least one specialized validator (`input_shapes` contains the produced shape literally) matches a produced shape, the validator-dispatch meta-activity SHALL select only specialized validators for that shape. Wildcard validators SHALL be dispatched only when no specialized validator matches.

#### Scenario: Specialized exists, wildcard skipped
- **WHEN** for shape `bash_output`, both a specialized validator (`input_shapes: ["bash_output"]`) and a wildcard validator (`input_shapes: ["*"]`) are registered
- **THEN** only the specialized validator is dispatched

#### Scenario: No specialized exists, wildcard dispatched
- **WHEN** for shape `unusual_new_shape`, no specialized validator is registered but a wildcard validator (`input_shapes: ["*"]`) is registered
- **THEN** the wildcard validator is dispatched

#### Scenario: Multiple specialized validators all dispatched (or selected via producer_selection)
- **WHEN** for shape `bash_output`, two specialized validators are registered
- **THEN** the meta-activity invokes the `producer_selection` resolver (sibling spec `impulse-binding-selection-layer`) over the specialized list to choose one; the wildcard remains skipped
