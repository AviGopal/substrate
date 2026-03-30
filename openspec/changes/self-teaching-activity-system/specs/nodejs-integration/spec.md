## ADDED Requirements

### Requirement: MiniBob available as npm package
MiniBob SHALL be installable via npm and usable as a programmatic library in Node.js projects.

#### Scenario: Install MiniBob via npm
- **WHEN** user runs `npm install minibob --save-dev`
- **THEN** MiniBob is installed with all dependencies and CLI is available in node_modules/.bin

#### Scenario: Import MiniBob programmatically
- **WHEN** Node.js code imports MiniBob (`import { MiniBob } from 'minibob'`)
- **THEN** MiniBob client is available with methods for activity execution

#### Scenario: Package includes TypeScript definitions
- **WHEN** TypeScript project imports MiniBob
- **THEN** full type definitions are available for API and type checking succeeds

### Requirement: Programmatic API for activity execution
MiniBob SHALL expose API for executing activities from Node.js code.

#### Scenario: Execute activity by ID
- **WHEN** code calls `minibob.executeActivity(activityId, impulses)`
- **THEN** system runs activity, returns results, and stores trace

#### Scenario: Execute activity by template
- **WHEN** code calls `minibob.executeActivityTemplate(template, impulses)`
- **THEN** system runs ad-hoc activity without storing template

#### Scenario: Stream activity execution events
- **WHEN** code calls `minibob.executeActivity()` with event handler
- **THEN** system emits events for task start, tool calls, completion

### Requirement: Configuration via package.json
MiniBob SHALL read configuration from package.json minibob section.

#### Scenario: Load MiniBob config from package.json
- **WHEN** MiniBob initializes in project with minibob configuration
- **THEN** system applies configured backend URL, API keys, preferences

#### Scenario: Override config programmatically
- **WHEN** code creates MiniBob instance with explicit config
- **THEN** programmatic config takes precedence over package.json

#### Scenario: Validate configuration on init
- **WHEN** MiniBob initializes with invalid configuration
- **THEN** system throws error with clear validation message

### Requirement: CLI integration
MiniBob SHALL provide CLI commands for common operations.

#### Scenario: Run activity via CLI
- **WHEN** user runs `npx minibob run <activity-id>`
- **THEN** system executes activity and displays results in terminal

#### Scenario: List available activities via CLI
- **WHEN** user runs `npx minibob list`
- **THEN** system displays all available activities with descriptions

#### Scenario: Discover capabilities via CLI
- **WHEN** user runs `npx minibob discover`
- **THEN** system runs self-discovery and reports generated activities
