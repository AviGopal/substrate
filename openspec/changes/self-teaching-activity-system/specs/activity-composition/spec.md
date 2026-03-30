## ADDED Requirements

### Requirement: Activities can create new activities
An executing activity SHALL be able to define and store new activity templates through LLM tool calls.

#### Scenario: Create activity from executing activity
- **WHEN** activity execution invokes createActivity tool with template definition
- **THEN** system validates template, stores in backend, and returns new activity ID

#### Scenario: Created activity inherits metadata
- **WHEN** activity A creates activity B
- **THEN** system records composition relationship and tracks B's performance separately

#### Scenario: Reject invalid activity templates
- **WHEN** createActivity called with malformed template (missing required fields)
- **THEN** system returns error with validation details and activity is not stored

### Requirement: Activities can invoke other activities
An executing activity SHALL be able to run other activities and access their results.

#### Scenario: Run existing activity by ID
- **WHEN** activity execution invokes runActivity tool with activity ID and impulses
- **THEN** system executes target activity and returns its output state and created impulses

#### Scenario: Run nested activities with context
- **WHEN** activity A runs activity B, passing impulses from A's context
- **THEN** B executes with provided impulses and A receives B's results as new impulses

#### Scenario: Handle nested activity failure
- **WHEN** activity A runs activity B and B fails
- **THEN** system records failure in both traces, A can access error information

### Requirement: Composition depth is limited
The system SHALL prevent infinite recursion and resource exhaustion from deeply nested activity composition.

#### Scenario: Enforce maximum nesting depth
- **WHEN** activity composition exceeds configured depth limit (default 5)
- **THEN** system rejects runActivity call with error and records in trace

#### Scenario: Track composition chain
- **WHEN** activities invoke other activities
- **THEN** system maintains composition chain in execution trace (A → B → C)

#### Scenario: Limit composed activity execution time
- **WHEN** total execution time of composition chain exceeds timeout
- **THEN** system terminates nested execution and marks parent as failed

### Requirement: Composed executions are traced
All composed activity executions SHALL produce complete traces stored independently.

#### Scenario: Each composed execution has trace
- **WHEN** activity A runs activities B and C
- **THEN** system stores three separate traces (A, B, C) with composition relationships

#### Scenario: Composition relationship is queryable
- **WHEN** querying execution traces
- **THEN** system can filter by composition patterns (activities that created others, activities called by others)

#### Scenario: Thompson Sampling considers composition context
- **WHEN** selecting activity variant
- **THEN** system considers success rate both as standalone and as composed component
