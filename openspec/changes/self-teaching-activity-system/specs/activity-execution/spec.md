## ADDED Requirements

### Requirement: Execute activity-created activities
The system SHALL support execution of activities that were created by other activities during composition.

#### Scenario: Load dynamically created activity template
- **WHEN** activity execution references activity ID created during prior composition
- **THEN** system loads template from backend and executes normally

#### Scenario: Execute activity without prior storage
- **WHEN** activity provides inline template during composition
- **THEN** system executes template without storing permanently (unless marked for persistence)

#### Scenario: Composed activity inherits session context
- **WHEN** activity A invokes activity B via runActivity
- **THEN** B inherits session ID, organization context, and available tools from A

### Requirement: Support nested execution contexts
The system SHALL maintain separate execution contexts for each level of activity composition.

#### Scenario: Isolated impulse contexts
- **WHEN** activity A runs activity B with specific impulses
- **THEN** B only accesses provided impulses, not A's full context

#### Scenario: Parent can access child results
- **WHEN** activity B completes within activity A
- **THEN** A receives B's output impulses as new impulses available to subsequent tasks

#### Scenario: Execution depth tracked
- **WHEN** activities compose nested executions
- **THEN** system tracks depth in execution metadata and enforces limits

### Requirement: Composition-aware tracing
Activity execution traces SHALL record composition relationships and propagate context.

#### Scenario: Link parent and child traces
- **WHEN** activity A runs activity B
- **THEN** B's trace includes parent_execution_id referencing A's trace

#### Scenario: Composition chain in trace metadata
- **WHEN** querying execution trace
- **THEN** trace includes full composition chain (root → parent → current)

#### Scenario: Aggregated metrics for composed executions
- **WHEN** analyzing activity performance
- **THEN** system tracks metrics both for standalone execution and as composed component

### Requirement: Tool availability in composed activities
Activities SHALL declare which tools are available during composed execution.

#### Scenario: Restrict tools in nested activities
- **WHEN** activity A runs activity B with tool restrictions
- **THEN** B only accesses explicitly allowed tools

#### Scenario: Default tool inheritance
- **WHEN** activity runs nested activity without tool restrictions
- **THEN** nested activity inherits parent's available tools

#### Scenario: Composition tools always available
- **WHEN** activity executes at any nesting level
- **THEN** createActivity and runActivity tools are always available (unless at max depth)
