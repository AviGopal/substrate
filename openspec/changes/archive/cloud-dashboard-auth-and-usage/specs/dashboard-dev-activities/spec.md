## ADDED Requirements

### Requirement: Activity template for adding React dashboard pages
The system SHALL provide a MiniBob activity template for creating new dashboard pages.

#### Scenario: MiniBob adds new page using template
- **WHEN** user runs `minibob --single "add Members page to dashboard"`
- **THEN** MiniBob recommends "add-react-dashboard-page" activity
- **THEN** activity guides creating new page component in src/pages/
- **THEN** activity adds route to App.tsx
- **THEN** activity adds navigation item to Sidebar.tsx
- **THEN** activity follows existing code patterns (shadcn UI, TypeScript)

#### Scenario: Activity validates page creation
- **WHEN** activity completes
- **THEN** activity verifies new .tsx file exists
- **THEN** activity verifies App.tsx includes new route
- **THEN** activity verifies Sidebar.tsx includes nav item
- **THEN** activity creates execution trace with success status

### Requirement: Activity template for API integration
The system SHALL provide a MiniBob activity template for integrating new backend endpoints.

#### Scenario: MiniBob adds API client function using template
- **WHEN** user runs `minibob --single "add members list API call"`
- **THEN** MiniBob recommends "add-dashboard-api-integration" activity
- **THEN** activity guides adding function to appropriate src/lib/api/*.ts file
- **THEN** activity adds TypeScript types to src/types/api.ts
- **THEN** activity tests endpoint connectivity with curl or fetch
- **THEN** activity handles error responses

#### Scenario: Activity validates API integration
- **WHEN** activity completes
- **THEN** activity verifies API client function exists
- **THEN** activity verifies TypeScript types are defined
- **THEN** activity verifies function compiles without type errors

### Requirement: Activity template for complete dashboard features
The system SHALL provide a MiniBob activity template for implementing full features end-to-end.

#### Scenario: MiniBob implements full feature using template
- **WHEN** user runs `minibob --single "implement member management feature"`
- **THEN** MiniBob recommends "dashboard-feature-complete" activity
- **THEN** activity creates page component
- **THEN** activity adds API client integration
- **THEN** activity updates navigation
- **THEN** activity tests feature works end-to-end

#### Scenario: Activity validates complete feature
- **WHEN** activity completes
- **THEN** activity verifies page exists and compiles
- **THEN** activity verifies API calls work
- **THEN** activity verifies navigation links to new page
- **THEN** activity creates comprehensive execution trace

### Requirement: Activity templates stored in metabob-proto
The system SHALL store dashboard development activities in the standard location.

#### Scenario: Activities discoverable by MiniBob
- **WHEN** MiniBob processes goal related to dashboard development
- **THEN** MiniBob finds activities in repos/metabob-proto/activities/development/
- **THEN** Thompson Sampling ranks dashboard activities for dashboard goals
- **THEN** MiniBob can load and execute activity templates

#### Scenario: Activity templates follow standard format
- **WHEN** viewing activity template JSON files
- **THEN** each template has id, name, category, tasks array
- **THEN** each task has description, prompt with variables
- **THEN** each task has validation rules (requiredFiles, patterns)

### Requirement: Activities capture dashboard-specific patterns
The system SHALL encode dashboard development patterns into activity templates.

#### Scenario: Activity uses Bun patterns
- **WHEN** activity creates new API client code
- **THEN** activity template guides using fetch (not axios or other HTTP libs)
- **THEN** activity avoids Node.js-specific APIs
- **THEN** activity uses Bun's built-in features where applicable

#### Scenario: Activity uses React 19 patterns
- **WHEN** activity creates new components
- **THEN** activity uses functional components with hooks
- **THEN** activity imports from "@/components/ui" for shadcn components
- **THEN** activity uses TypeScript with proper types

#### Scenario: Activity follows existing code style
- **WHEN** activity generates code
- **THEN** activity matches indentation (2 spaces)
- **THEN** activity uses existing utility functions (cn from lib/utils)
- **THEN** activity follows file naming conventions (PascalCase for components)

### Requirement: Activities improve through Thompson Sampling
The system SHALL track activity execution success for learning.

#### Scenario: Successful activity execution tracked
- **WHEN** dashboard activity completes successfully
- **THEN** activity-api records execution trace with success=true
- **THEN** Thompson Sampling increases selection probability for that template
- **THEN** Future dashboard goals prefer successful templates

#### Scenario: Failed activity creates variant
- **WHEN** dashboard activity fails
- **THEN** activity-api records execution trace with failure details
- **THEN** Ribosome pattern can extract failed steps for debugging
- **THEN** Template variants can be created for different scenarios
