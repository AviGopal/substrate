## ADDED Requirements

### Requirement: System displays impulse shapes flowing between activities

The system SHALL show visual indicators of impulse shapes being produced and consumed across the activity sequence.

#### Scenario: Display output shapes
- **WHEN** activity declares output_shapes ["source_code", "error_log"]
- **THEN** system shows labeled badges below the activity card for each output shape

#### Scenario: Display input shapes
- **WHEN** activity declares input_shapes ["error_log"]
- **THEN** system shows labeled badges above the activity card for each required input shape

#### Scenario: Connect flowing shapes
- **WHEN** activity A produces "error_log" and activity B consumes "error_log"
- **THEN** system draws visual connector from A's output to B's input

### Requirement: System validates shape compatibility visually

The system SHALL use color coding and visual indicators to show shape validation status.

#### Scenario: Compatible shape connection
- **WHEN** output shape from activity A matches input shape for activity B
- **THEN** system colors the connector green and shows checkmark icon

#### Scenario: Incompatible shape connection
- **WHEN** output shape from activity A does not match required input shape for activity B
- **THEN** system colors the connector red and shows warning icon with tooltip

#### Scenario: Missing shape source
- **WHEN** activity requires input shape not produced by any previous activity
- **THEN** system highlights the missing shape badge in red with "Source needed" tooltip

### Requirement: User can add impulse sources to trajectory

The system SHALL allow users to explicitly add impulse references to provide missing shapes.

#### Scenario: Add file impulse
- **WHEN** user clicks "Add Impulse" and selects "File"
- **THEN** system inserts impulse reference card with file path configuration

#### Scenario: Add goal impulse
- **WHEN** user clicks "Add Impulse" and selects "Goal"
- **THEN** system inserts goal impulse card with goal text input and vessel resolver selection

#### Scenario: Pin resolver for impulse
- **WHEN** user edits impulse card and selects specific resolver
- **THEN** system pins that resolver and shows availability indicator

### Requirement: Shape flow shows resolver availability

The system SHALL indicate whether resolvers are available for each impulse type.

#### Scenario: Resolver available
- **WHEN** impulse type has registered resolver in discovery-vessel
- **THEN** system shows green "✓ Resolver available" indicator with resolver name

#### Scenario: No resolver found
- **WHEN** impulse type has no registered resolver
- **THEN** system shows orange "⚠ No resolver found" warning

#### Scenario: Multiple resolvers available
- **WHEN** impulse type can be resolved by multiple vessels
- **THEN** system shows dropdown allowing user to select preferred resolver

### Requirement: System distinguishes optional vs required shapes

The system SHALL visually differentiate between required and optional input shapes.

#### Scenario: Required shape indicator
- **WHEN** activity declares required input shape
- **THEN** system shows shape badge with solid border and asterisk (*)

#### Scenario: Optional shape indicator
- **WHEN** activity declares optional input shape
- **THEN** system shows shape badge with dashed border and no asterisk

#### Scenario: Partial shape satisfaction
- **WHEN** activity has 2 required shapes and 3 optional shapes with only required shapes satisfied
- **THEN** system shows green checkmark for validation but info icon indicating unused optional shapes
