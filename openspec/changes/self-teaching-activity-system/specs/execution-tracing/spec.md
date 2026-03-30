## ADDED Requirements

### Requirement: Capture complete state at trace points
The system SHALL record comprehensive state information at each instrumentation point.

#### Scenario: Record function invocation
- **WHEN** instrumented function is called
- **THEN** system captures arguments, caller context, timestamp, and trace point ID

#### Scenario: Record function completion
- **WHEN** instrumented function returns or throws
- **THEN** system captures return value or error, execution duration, and memory delta

#### Scenario: Record intermediate state
- **WHEN** trace point uses state-snapshot strategy
- **THEN** system captures accessible variables, closure state, and module-level state

### Requirement: Trace structure follows execution flow
Traces SHALL represent the actual sequence of operations through instrumented code.

#### Scenario: Linear execution trace
- **WHEN** code executes through multiple instrumented functions sequentially
- **THEN** trace contains ordered sequence of trace points matching call order

#### Scenario: Nested call trace
- **WHEN** instrumented function A calls instrumented function B
- **THEN** trace represents nesting with parent-child relationships

#### Scenario: Async execution trace
- **WHEN** code uses async/await or Promises
- **THEN** trace captures async boundaries with correlation IDs linking initiation to resolution

### Requirement: Traces are stored with activity execution
Execution traces SHALL be associated with the activity execution that triggered them.

#### Scenario: Link trace to activity execution
- **WHEN** activity completes with instrumented code execution
- **THEN** system stores trace as part of execution record with reference to activity ID

#### Scenario: Multiple traces per activity
- **WHEN** activity executes instrumented code multiple times (loops, retries)
- **THEN** system stores all traces with sequence numbers

#### Scenario: Query traces by activity
- **WHEN** querying activity execution history
- **THEN** system can retrieve associated execution traces

### Requirement: Trace size is bounded
The system SHALL prevent unbounded trace growth in long-running or recursive operations.

#### Scenario: Limit captured state size
- **WHEN** state snapshot would exceed configured size limit (default 10KB per trace point)
- **THEN** system truncates large values and marks as truncated with original size

#### Scenario: Limit trace point count
- **WHEN** execution would generate more than configured limit (default 1000 trace points)
- **THEN** system samples trace points strategically and marks as sampled trace

#### Scenario: Aggregate repeated patterns
- **WHEN** execution produces many identical trace points (tight loops)
- **THEN** system aggregates to count + representative samples

### Requirement: Traces are queryable
Stored traces SHALL support queries for learning and debugging.

#### Scenario: Query traces by outcome
- **WHEN** searching for traces
- **THEN** system can filter by success/failure, error type, execution time range

#### Scenario: Query traces by state patterns
- **WHEN** searching for specific behavior
- **THEN** system can filter by captured state values (e.g., "traces where error code = 404")

#### Scenario: Compare traces across executions
- **WHEN** analyzing behavior changes
- **THEN** system can diff traces from different executions of same activity
