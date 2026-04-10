## ADDED Requirements

### Requirement: goal:test orchestration activity
The system SHALL provide a goal:test activity that orchestrates test creation and execution through composed child activities.

#### Scenario: Test orchestrator acquires error context first
- **WHEN** goal:test receives failing execution trace as input
- **THEN** orchestrator runs context:error-log as first child activity
- **AND** uses error_log impulse to guide test generation
- **AND** generated tests target identified error conditions
- **AND** trace records context acquisition → test generation → execution chain

#### Scenario: Successful test creation and execution
- **WHEN** user provides goal "write tests for the authentication module"
- **THEN** system creates goal:test impulse, recommends child activities for test generation and execution, executes composition chain, validates test files created and tests passing, records execution trace with composition metadata

#### Scenario: Test creation without execution
- **WHEN** user provides goal "write tests for the authentication module" with skipExecution=true
- **THEN** system creates goal:test impulse, executes test generation activity only, validates test files created, records trace indicating execution was skipped

#### Scenario: Existing tests execution only
- **WHEN** user provides goal "run tests for the authentication module" and test files already exist
- **THEN** system creates goal:test impulse, skips test generation child activity, executes test runner activity, validates test results, records trace with skip reason

#### Scenario: Test failure triggers fix activity
- **WHEN** goal:test executes tests and tests fail
- **THEN** system creates test:failing impulse, recommends fix activity as child, executes fix activity, re-runs tests, validates tests now pass, records full composition chain in trace

#### Scenario: Missing test framework detected
- **WHEN** goal:test attempts to generate tests but no test framework detected in project
- **THEN** system creates context:requirements impulse for test framework, recommends setup activity as prerequisite, executes framework setup, continues with test generation, records dependency chain

#### Scenario: Trace recording includes all child activities
- **WHEN** goal:test completes successfully with multiple child activities
- **THEN** execution trace includes goal:test parent activity, all child activity IDs in execution order, composition edges with success flags, input/output shapes for each child, total duration and cost aggregated

### Requirement: goal:refactor orchestration activity
The system SHALL provide a goal:refactor activity that orchestrates code refactoring through composed child activities.

#### Scenario: Refactor orchestrator acquires codebase context
- **WHEN** goal:refactor receives design pattern requirement
- **THEN** orchestrator runs context:codebase as first child activity
- **AND** uses codebase_structure impulse to identify refactoring targets
- **AND** applies pattern only to identified modules
- **AND** trace records context acquisition → target identification → refactoring chain

#### Scenario: Successful refactoring with tests
- **WHEN** user provides goal "refactor the user service to use dependency injection"
- **THEN** system creates goal:refactor impulse, recommends analysis activity to identify refactor scope, executes code modification activity, runs test validation activity, validates all tests still pass, records composition trace

#### Scenario: Refactoring without existing tests
- **WHEN** goal:refactor executes and no tests exist for target code
- **THEN** system creates context:codebase impulse with test gap metadata, recommends goal:test as prerequisite child, executes test creation first, proceeds with refactoring, validates tests pass, records prerequisite relationship

#### Scenario: Large refactoring decomposed into steps
- **WHEN** user provides goal "refactor authentication to use OAuth2" and system detects large scope
- **THEN** system creates multiple goal:refactor impulses for sub-goals, executes refactoring activities in dependency order, validates compilation after each step, records multi-step composition graph

#### Scenario: Refactoring breaks tests
- **WHEN** goal:refactor completes code changes but tests fail
- **THEN** system creates test:failing impulse with refactor context, recommends fix activity or rollback activity, executes chosen child activity, validates tests pass, records failure recovery in trace

#### Scenario: Type errors detected during refactoring
- **WHEN** goal:refactor modifies code and TypeScript compilation fails
- **THEN** system creates typescript:error impulse, recommends type fix activity as child, executes type fixes, re-compiles, validates compilation success, continues with remaining refactor steps, records error recovery

#### Scenario: Refactoring with codebase analysis
- **WHEN** user provides goal "refactor to improve performance" without specific target
- **THEN** system creates context:codebase impulse for performance analysis, recommends analysis activity to identify hotspots, uses analysis results to guide refactoring activities, validates performance improvement, records analysis-driven composition

### Requirement: Composition pattern with child activities
The system SHALL support activity composition where orchestrator activities invoke child activities and record relationships.

#### Scenario: Child activity inherits parent context
- **WHEN** orchestrator activity invokes child activity
- **THEN** child activity receives all impulses from parent activity, plus any new impulses created by orchestrator, child activity execution uses combined impulse set, parent trace references child impulses

#### Scenario: Child activity output feeds next child
- **WHEN** orchestrator executes child activity A that produces output impulses
- **THEN** output impulses from A are available as inputs to child activity B, orchestrator selects next child based on current impulse set, composition engine tracks impulse flow between children, trace records impulse lineage

#### Scenario: Parallel child activity execution
- **WHEN** orchestrator determines multiple children can run in parallel
- **THEN** system executes independent children concurrently, waits for all to complete before proceeding, merges output impulses from all children, records parallel execution in trace with timing

#### Scenario: Conditional child selection based on shapes
- **WHEN** orchestrator evaluates available impulse shapes after child completion
- **THEN** system queries composition graph for chains matching current shapes and target shapes, selects next child using Thompson Sampling over valid chains, executes chosen child, records selection reasoning

#### Scenario: Early exit when target shapes achieved
- **WHEN** orchestrator evaluates impulse shapes after child execution and target shapes present
- **THEN** system skips remaining planned children, marks orchestration as complete, records achieved shapes and skipped activities in trace, updates composition graph with successful early-exit path

#### Scenario: Child activity failure triggers variant selection
- **WHEN** orchestrator executes child activity and child fails
- **THEN** system queries for alternative child variants with same input/output shapes, selects alternative using Thompson Sampling, executes alternative child, records variant switch in composition trace

### Requirement: Success validation
The system SHALL validate orchestration success by checking output shapes match target shapes.

#### Scenario: All target shapes achieved
- **WHEN** orchestrator completes and evaluates final impulse set
- **THEN** system checks all required target shapes present in final impulses, marks orchestration as successful, records success in trace with achieved shapes list, updates Thompson Sampling alpha for all executed children

#### Scenario: Partial target shapes achieved
- **WHEN** orchestrator reaches max attempts and only subset of target shapes achieved
- **THEN** system marks orchestration as partial success, records which target shapes missing, updates Thompson Sampling with partial success signal, creates context:gap impulse for missing shapes

#### Scenario: No target shapes achieved
- **WHEN** orchestrator completes without achieving any target shapes
- **THEN** system marks orchestration as failure, records all attempted children and failure reasons, updates Thompson Sampling beta for failed path, recommends improvisation for next attempt

#### Scenario: Unexpected shapes produced
- **WHEN** orchestrator achieves target shapes but also produces unexpected shapes
- **THEN** system marks orchestration as successful with bonus shapes, records unexpected shapes in trace metadata, updates composition graph with new potential edges, uses unexpected shapes for future chain discovery

#### Scenario: Shape validation with custom validators
- **WHEN** target shape has custom validation logic beyond presence check
- **THEN** system invokes shape-specific validator function, validator checks impulse content meets quality criteria, orchestration only succeeds if all validators pass, records validation results in trace

#### Scenario: Success validation after rollback
- **WHEN** orchestrator executes rollback activity due to failure and re-attempts
- **THEN** system re-validates target shapes after rollback, marks original attempt as failed, marks retry attempt separately, records rollback reason and retry outcome in composition trace

### Requirement: Trace recording
The system SHALL record execution traces for orchestration activities with composition metadata.

#### Scenario: Trace includes composition graph snapshot
- **WHEN** orchestrator completes execution
- **THEN** execution trace includes parent activity ID, array of child activity IDs in execution order, composition edges with weights and success flags, input shapes for orchestrator, output shapes produced, full composition chain used

#### Scenario: Trace includes child activity traces
- **WHEN** orchestrator executes multiple child activities
- **THEN** each child activity has separate execution trace with parent reference, parent trace includes child trace IDs, trace query can reconstruct full execution tree, composition relationships preserved across trace records

#### Scenario: Trace includes Thompson Sampling decisions
- **WHEN** orchestrator selects children using Thompson Sampling
- **THEN** trace records Thompson Sampling scores for each candidate, chosen child and selection probability, Thompson Sampling parameters (alpha, beta) before and after, enables learning loop analysis

#### Scenario: Trace includes impulse lineage
- **WHEN** orchestrator creates and transforms impulses through children
- **THEN** trace records impulse creation source (parent, child, orchestrator), impulse transformations by each child, impulse dependencies (which impulses required which children), final impulse set with lineage metadata

#### Scenario: Trace includes timing breakdown
- **WHEN** orchestrator executes with multiple children
- **THEN** trace records total orchestration duration, duration for each child separately, wait time between children (if sequential), parallel execution overlap time (if concurrent), timing breakdown enables performance analysis

#### Scenario: Trace includes cost breakdown
- **WHEN** orchestrator executes activities with LLM costs
- **THEN** trace records total cost for orchestration, cost per child activity, token usage breakdown, cost attribution by activity type, enables budget analysis and optimization
