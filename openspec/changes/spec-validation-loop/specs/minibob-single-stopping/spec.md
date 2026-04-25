## ADDED Requirements

### Requirement: Budget flag for single mode
MiniBob `--single` mode SHALL accept a `--budget <usd>` CLI flag that sets a maximum spend in USD for the entire single-mode session.

#### Scenario: Budget flag accepted
- **WHEN** MiniBob is invoked with `--single "goal" --budget 2.00`
- **THEN** MiniBob SHALL parse the flag, set an internal budget limit of 2.00 USD, and begin execution

#### Scenario: Execution halts at budget
- **WHEN** the accumulated cost of all LLM calls and tool executions reaches or exceeds the budget
- **THEN** MiniBob SHALL stop dispatching new activities and exit with a message indicating the budget was reached

#### Scenario: Default budget is unlimited
- **WHEN** `--budget` is not specified
- **THEN** MiniBob SHALL behave as before (no budget limit)

### Requirement: Max-activities flag for single mode
MiniBob `--single` mode SHALL accept a `--max-activities <n>` CLI flag (the implementation flag; the design spec used `--max-sequences` as the logical name) that sets a maximum number of activity dispatch cycles. Default is 5.

#### Scenario: Max-activities flag accepted
- **WHEN** MiniBob is invoked with `--single "goal" --max-activities 15`
- **THEN** MiniBob SHALL parse the flag and track the count of completed activity sequences

#### Scenario: Execution halts at max-activities
- **WHEN** the number of completed activity sequences reaches the configured limit
- **THEN** MiniBob SHALL stop dispatching new activities and exit with a message indicating the sequence limit was reached

#### Scenario: Default max-activities is 5
- **WHEN** `--max-activities` is not specified
- **THEN** MiniBob SHALL default to a maximum of 5 activities per single-mode session

### Requirement: Goal-satisfaction stopping condition
MiniBob `--single` mode SHALL stop execution when `goal_satisfaction_checker` returns `satisfied: true`.

#### Scenario: Early exit on satisfaction
- **WHEN** any activity in the execution sequence produces a result where `goal_satisfaction_checker` evaluates the goal as satisfied
- **THEN** MiniBob SHALL exit the loop immediately without dispatching further activities

#### Scenario: Satisfaction check runs after each activity
- **WHEN** an activity completes in single mode
- **THEN** the goal satisfaction check SHALL be evaluated before dispatching the next activity

### Requirement: Stopping reason reported in output
When MiniBob `--single` mode exits due to any stopping condition, the exit message SHALL include the stopping reason.

#### Scenario: Budget stop message
- **WHEN** execution stops due to budget exhaustion
- **THEN** the output SHALL include the text "budget" and the total spend

#### Scenario: Max-activities stop message
- **WHEN** execution stops due to sequence limit
- **THEN** the output SHALL include the text "max-activities" and the count reached

#### Scenario: Satisfaction stop message
- **WHEN** execution stops due to goal satisfaction
- **THEN** the output SHALL include the text "goal satisfied" and the satisfaction evidence
