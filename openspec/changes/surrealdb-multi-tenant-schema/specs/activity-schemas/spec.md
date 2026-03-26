## ADDED Requirements

### Requirement: Activity registry stores all activity types
The system SHALL provide an `activity_registry` table that stores both template-based activities and vessel function activities with fields: `id`, `name`, `description`, `category`, `execution_format`, `task_steps`, `source_location`, `scope`, `org_id`, `project_id`, `vessel_id`, `public`, `executions`, `successes`, `failures`, `alpha`, `beta`, `created_at`, `updated_at`.

#### Scenario: Register template-based activity
- **WHEN** a template activity is created with execution_format = 'template'
- **THEN** the activity is stored with task_steps array and no source_location

#### Scenario: Register vessel function activity
- **WHEN** a vessel function is discovered with execution_format = 'vessel-function'
- **THEN** the activity is stored with source_location object and no task_steps

#### Scenario: Query activities by scope
- **WHEN** a query filters by scope = 'global'
- **THEN** all global activities are returned

#### Scenario: Public global activities visible to all
- **WHEN** a user from any org queries activities with scope = 'global' AND public = true
- **THEN** all matching activities are visible regardless of org_id

### Requirement: Activity execution traces store detailed execution data
The system SHALL provide an `activity_execution_traces` table with fields: `execution_id`, `activity_id`, `org_id`, `project_id`, `success`, `duration_ms`, `cost_usd`, `tokens_input`, `tokens_output`, `tokens_cache`, `error_message`, `error_type`, `failed_task_id`, `impulses_used`, `component_changes`, `executed_at`, `created_at`.

#### Scenario: Record successful execution
- **WHEN** an activity executes successfully
- **THEN** an execution trace is stored with success = true, duration_ms, cost_usd, and token counts

#### Scenario: Record failed execution with error
- **WHEN** an activity execution fails
- **THEN** an execution trace is stored with success = false, error_message, error_type, and failed_task_id

#### Scenario: Query execution traces for organization
- **WHEN** a user queries execution traces for their organization
- **THEN** only traces with matching org_id are returned (enforced by PERMISSIONS)

#### Scenario: Query execution traces for specific activity
- **WHEN** a query filters by activity_id
- **THEN** all execution traces for that activity (within user's org) are returned

### Requirement: Activity composition graph tracks activity relationships
The system SHALL provide an `activity_composition_graph` table that records which activities compose or invoke other activities.

#### Scenario: Record composition relationship
- **WHEN** activity A invokes activity B during execution
- **THEN** a composition edge is created with caller_activity_id = A and callee_activity_id = B

#### Scenario: Query downstream dependencies
- **WHEN** a query requests activities that depend on activity X
- **THEN** all composition edges with callee_activity_id = X are returned

#### Scenario: Query upstream dependencies
- **WHEN** a query requests activities that activity X invokes
- **THEN** all composition edges with caller_activity_id = X are returned

### Requirement: Activity dataflows track data movement
The system SHALL provide an `activity_dataflows` table with fields: `caller_activity_id`, `callee_activity_id`, `execution_id`, `data_passed`, `data_returned`, `success`, `duration_ms`, `call_count`, `created_at`, `updated_at`.

#### Scenario: Record data flow between activities
- **WHEN** activity A passes impulses to activity B
- **THEN** a dataflow record is created with data_passed containing impulse refs

#### Scenario: Track multiple calls between same activities
- **WHEN** activity A calls activity B multiple times
- **THEN** the call_count is incremented on the dataflow record

#### Scenario: Query data flows for execution trace
- **WHEN** a query filters by execution_id
- **THEN** all dataflow records for that execution are returned

### Requirement: Execution sequences track goal achievement paths
The system SHALL provide an `execution_sequences` table that records sequences of activities executed to achieve specific goals.

#### Scenario: Record successful goal sequence
- **WHEN** a goal is achieved through activities A → B → C
- **THEN** an execution sequence is stored with ordered activity_ids and success = true

#### Scenario: Query sequences for similar goals
- **WHEN** a new goal is submitted
- **THEN** the system queries execution_sequences with similar goal descriptions

#### Scenario: Thompson sampling recommends next activity
- **WHEN** a goal is partially complete
- **THEN** the system uses execution_sequences to recommend next activity based on successful paths

### Requirement: Impulse data stores context pointers
The system SHALL provide an `impulse_data` table that stores impulse metadata and content pointers.

#### Scenario: Create impulse pointer
- **WHEN** an impulse is created with type = 'activityExecutionTrace'
- **THEN** the impulse record stores pointer metadata but not full content

#### Scenario: Load impulse content on demand
- **WHEN** an impulse is loaded for execution
- **THEN** the content is resolved from the pointer and budget enforced

#### Scenario: Track impulse usage
- **WHEN** an impulse is used in an execution
- **THEN** the usage is recorded in execution_traces.impulses_used array

### Requirement: Tool usage tracks tool invocation patterns
The system SHALL provide a `tool_usage` table that records which tools are called by activities.

#### Scenario: Record tool invocation
- **WHEN** an activity calls the 'bash' tool
- **THEN** a tool_usage record is created with tool_name = 'bash', activity_id, and execution_id

#### Scenario: Aggregate tool usage stats
- **WHEN** a query requests tool usage statistics
- **THEN** the system aggregates call counts by tool_name and activity_id

#### Scenario: Identify unused tools
- **WHEN** a query requests tools with zero usage
- **THEN** the system returns tools registered but never invoked

### Requirement: Activity schemas enforce org/project isolation
The system SHALL define PERMISSIONS clauses on all activity tables to enforce organization and project-level isolation.

#### Scenario: User can only query activities in their org
- **WHEN** a user queries activity_registry
- **THEN** only activities with org_id = $auth.org_id OR (scope = 'global' AND public = true) are visible

#### Scenario: User can only query execution traces in their projects
- **WHEN** a user queries activity_execution_traces
- **THEN** only traces with org_id = $auth.org_id AND project_id IN $auth.project_ids are visible

#### Scenario: User can create activities in their org
- **WHEN** a user creates a new activity
- **THEN** the activity is automatically assigned org_id = $auth.org_id

#### Scenario: MiniBob instance can only write to assigned project
- **WHEN** a MiniBob instance creates an execution trace
- **THEN** the trace is automatically assigned org_id = $auth.org_id AND project_id = $auth.project_id
