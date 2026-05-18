## ADDED Requirements

### Requirement: Task-level pattern recording
Execution traces SHALL include aggregated task-level patterns containing the ordered tool sequence, tool call count, retry count, and token usage for each task.

#### Scenario: Task pattern captured on activity execution
- **WHEN** an activity with 3 tasks completes execution
- **THEN** the execution trace SHALL contain a `taskPatterns` array with 3 entries, each recording `taskId`, `toolSequence` (ordered list of tool names called), `toolCallCount`, `retryCount`, `inputTokens`, and `outputTokens`

#### Scenario: Task pattern records retry attempts
- **WHEN** a task retries 2 times before succeeding
- **THEN** the task pattern entry SHALL have `retryCount: 2` and `toolSequence` SHALL reflect the final successful sequence

### Requirement: Activity-level pattern extension
Execution traces SHALL extend the existing activity-level data with impulse pointer tracking, dominant tool sequence, and state transition hashing.

#### Scenario: Activity pattern includes impulse flow
- **WHEN** an activity execution consumes 2 impulse pointers and produces 3 new ones
- **THEN** the execution trace `activityPattern` SHALL include `impulsePointersConsumed` with 2 IDs and `impulsePointersProduced` with 3 IDs

#### Scenario: State transition hash computed
- **WHEN** an activity execution modifies files in the working directory
- **THEN** the execution trace SHALL include a `stateTransitionHash` computed from the before and after file hashes of all modified files

#### Scenario: Dominant tool sequence identified
- **WHEN** an activity with 5 tasks completes, where 3 tasks use the sequence [read, edit, bash] and 2 tasks use [bash, read]
- **THEN** the `dominantToolSequence` SHALL be `["read", "edit", "bash"]`

### Requirement: Composition context recording
Execution traces SHALL include composition context when the execution is part of a goal-seeking chain.

#### Scenario: Composition context recorded for goal chain
- **WHEN** a goal processor executes activity B as the 2nd activity in a chain of 3
- **THEN** the execution trace SHALL include `compositionContext` with `goalId`, `positionInChain: 2`, `predecessorExecutionId` pointing to activity A's execution, and `goalCompletedAfterThis: false`

#### Scenario: Goal completion recorded
- **WHEN** the goal processor determines the goal is complete after activity C executes
- **THEN** activity C's execution trace SHALL have `compositionContext.goalCompletedAfterThis: true`

#### Scenario: Standalone execution has no composition context
- **WHEN** an activity executes outside the goal processor (direct execution or boredom task)
- **THEN** the execution trace `compositionContext` SHALL be `undefined`

### Requirement: Backend aggregation endpoints
The backend SHALL provide aggregation endpoints that compute metrics across configurable time windows for higher-layer observation.

#### Scenario: Query system health over 24-hour window
- **WHEN** `GET /v2/metrics/system-health?window=24h` is called
- **THEN** the backend SHALL return aggregate metrics including `overallSuccessRate`, `templateCreationRate`, `averageCost`, `uniqueTemplatesUsed`, and `failureCorrelation` computed over the past 24 hours

#### Scenario: Query tool sequence patterns
- **WHEN** `GET /v2/metrics/tool-patterns?window=7d&min_frequency=5` is called
- **THEN** the backend SHALL return the most frequent tool call sequences observed in the past 7 days with their frequency counts and success rates

#### Scenario: Query composition patterns
- **WHEN** `GET /v2/metrics/composition-patterns?window=7d` is called
- **THEN** the backend SHALL return activity composition chains (A→B→C patterns) with their frequency, success rate, and average cost
