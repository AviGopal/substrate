## ADDED Requirements

### Requirement: Autonomous work cannot land on the lane core
The system SHALL read an `autonomyScope` pool shape `{excluded_paths, reason}` through
discovery at use time, newest record across all pool producers. Autonomous admission SHALL
refuse a gap whose edit site falls under an excluded path before any LLM call, and the compose
verdict SHALL withhold FAVORABLE from any compose that is not directed and applied an op to an
excluded path. Directed work SHALL be unaffected. With no record, behaviour SHALL be unchanged;
once a record has been seen, an unreadable scope SHALL refuse autonomous work.

#### Scenario: Autonomous gap on an excluded path
- **WHEN** an autonomous pick selects a gap whose edit site is `repos/development-vessel/src/resolvers/feature-compose.ts` and that path is excluded
- **THEN** admission logs `stage:autonomy_scope` and no plan call is made

#### Scenario: Directed goal on the same path
- **WHEN** an operator route-edit goal targets the same file
- **THEN** it drafts, verifies and lands as before

#### Scenario: Autonomous compose strays onto an excluded path
- **WHEN** an autonomous compose whose gap names an allowed file applies an op to an excluded file
- **THEN** the verdict is UNFAVORABLE, the edits are rolled back and nothing is pushed
