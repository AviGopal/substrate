## ADDED Requirements

### Requirement: Core Node.js activity library
The system SHALL provide a library of reusable activities for common Node.js operations including file operations, dependency management, test execution, and build processes.

#### Scenario: File operation activities available
- **WHEN** MiniBob initializes in a Node.js project
- **THEN** activities for read, write, edit, glob, and grep operations are available

#### Scenario: Dependency management activities available
- **WHEN** MiniBob detects package.json
- **THEN** activities for install, update, audit, and list dependencies are available

#### Scenario: Test execution activities available
- **WHEN** MiniBob detects test framework (Jest, Vitest, Mocha)
- **THEN** activities for run tests, run specific test, watch tests are available

#### Scenario: Build process activities available
- **WHEN** MiniBob detects build scripts in package.json
- **THEN** activities for build, clean, typecheck are available

### Requirement: Activity library is discoverable
Activities SHALL expose metadata describing their purpose, inputs, outputs, and prerequisites.

#### Scenario: List available activities
- **WHEN** user requests available activities
- **THEN** system returns list with name, description, required impulses, and output impulses

#### Scenario: Search activities by capability
- **WHEN** user searches for activities matching criteria
- **THEN** system returns filtered list ranked by relevance and success rate

### Requirement: Activity library is extensible
Users SHALL be able to add project-specific activities to the library that persist across sessions.

#### Scenario: Save discovered activity to library
- **WHEN** MiniBob creates activity through discovery and it executes successfully 3+ times
- **THEN** system offers to save it as reusable library activity

#### Scenario: Load custom activities on session start
- **WHEN** MiniBob starts new session in project with custom activities
- **THEN** custom activities are loaded and available alongside core library
