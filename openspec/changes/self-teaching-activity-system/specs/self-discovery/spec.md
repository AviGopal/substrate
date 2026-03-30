## ADDED Requirements

### Requirement: Discover runtime environment
MiniBob SHALL inspect the runtime environment to identify Node.js version, available globals, installed modules, and system capabilities.

#### Scenario: Detect Node.js version and features
- **WHEN** self-discovery activity runs
- **THEN** system captures Node.js version, enabled experimental features, and available APIs

#### Scenario: Identify installed dependencies
- **WHEN** self-discovery inspects package.json and node_modules
- **THEN** system creates inventory of direct and transitive dependencies with versions

#### Scenario: Detect available CLI tools
- **WHEN** self-discovery checks PATH and local node_modules/.bin
- **THEN** system catalogs available executables and their versions

### Requirement: Generate domain-specific activities
MiniBob SHALL create new activity templates based on discovered environment patterns.

#### Scenario: Generate test framework activities
- **WHEN** self-discovery detects Jest in dependencies
- **THEN** system generates activities for run-jest-tests, run-jest-watch, run-jest-coverage

#### Scenario: Generate API route activities
- **WHEN** self-discovery detects Express/Hono routes in codebase
- **THEN** system generates activities to test each route with example requests

#### Scenario: Generate build activities
- **WHEN** self-discovery finds build scripts in package.json
- **THEN** system generates activities to execute each script with appropriate error handling

### Requirement: Bootstrap activities on first run
MiniBob SHALL execute bootstrap discovery activities automatically on first session in a new project.

#### Scenario: First session triggers discovery
- **WHEN** MiniBob starts in project without prior activity history
- **THEN** system runs bootstrap discovery activities and stores generated templates

#### Scenario: Discovery results cached
- **WHEN** bootstrap discovery completes successfully
- **THEN** system caches discovered capabilities and skips rediscovery on subsequent sessions

#### Scenario: Force rediscovery
- **WHEN** user explicitly requests rediscovery or package.json changes
- **THEN** system reruns bootstrap activities and updates cached capabilities

### Requirement: Self-discovery is itself an activity
Bootstrap discovery SHALL be implemented as activities that can evolve through the same learning mechanisms.

#### Scenario: Discovery activities improve through learning
- **WHEN** discovery activity fails to detect capability or generates poor templates
- **THEN** system creates improved variant through trailblazing and Thompson Sampling

#### Scenario: Discovery activities are versioned
- **WHEN** multiple discovery activity variants exist
- **THEN** system selects best-performing variant based on success rate of generated activities
