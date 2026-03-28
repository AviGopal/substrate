## ADDED Requirements

### Requirement: JWT-based authentication for external users
The system SHALL support JWT-based authentication using SurrealDB 3.0 `DEFINE ACCESS ... TYPE JWT` for dashboard users, API clients, and IDE extensions.

#### Scenario: Valid JWT token grants access
- **WHEN** a request includes a valid JWT token with claims `org_id`, `project_ids`, `role`, and `user_id`
- **THEN** the user can access resources within their organization and assigned projects

#### Scenario: Missing org_id claim rejects authentication
- **WHEN** a JWT token is presented without an `org_id` claim
- **THEN** the authentication fails with error "Missing org_id claim"

#### Scenario: Expired JWT token is rejected
- **WHEN** a JWT token with `exp` timestamp in the past is presented
- **THEN** the authentication fails with error "Token expired"

### Requirement: RECORD-based authentication for MiniBob instances
The system SHALL support RECORD-based authentication using `DEFINE ACCESS ... TYPE RECORD` for autonomous MiniBob vessel instances.

#### Scenario: MiniBob instance authenticates with instance_id and api_key
- **WHEN** a MiniBob instance signs in with valid `instance_id` and `api_key`
- **THEN** the instance receives a token scoped to its assigned `org_id` and `project_id`

#### Scenario: Invalid api_key rejects MiniBob authentication
- **WHEN** a MiniBob instance provides incorrect `api_key`
- **THEN** the authentication fails and no token is issued

#### Scenario: MiniBob instance cannot access other projects
- **WHEN** an authenticated MiniBob instance attempts to query data with `project_id` different from its assigned project
- **THEN** the database returns zero results (enforced by PERMISSIONS clause)

### Requirement: Table-level permissions enforce org isolation
The system SHALL use SurrealDB PERMISSIONS clauses on all tables to enforce organization-level data isolation at the database level.

#### Scenario: User can only query their organization's data
- **WHEN** a user with `org_id = organization:acme` queries `activity_registry`
- **THEN** the database automatically filters results to WHERE `org_id = organization:acme`

#### Scenario: User cannot query other organization's data
- **WHEN** a user with `org_id = organization:acme` attempts to query records with `org_id = organization:globex`
- **THEN** the database returns zero results (not an authorization error)

#### Scenario: Admin role can update organization data
- **WHEN** a user with `role = 'admin'` and `org_id = organization:acme` updates a record in their org
- **THEN** the update succeeds

#### Scenario: Member role cannot update organization data
- **WHEN** a user with `role = 'member'` attempts to update a record they did not create
- **THEN** the update fails due to PERMISSIONS clause

### Requirement: Project-level permissions filter by project_ids
The system SHALL filter data by `project_id` when a user's JWT contains `project_ids` claim with specific project access.

#### Scenario: User with project access can query project data
- **WHEN** a user with `project_ids = ['project:backend', 'project:frontend']` queries analysis_problems
- **THEN** the database returns problems WHERE `project_id IN ['project:backend', 'project:frontend']`

#### Scenario: User without project access cannot query project data
- **WHEN** a user with `project_ids = ['project:backend']` attempts to query data with `project_id = project:mobile`
- **THEN** the database returns zero results

### Requirement: Indexed org_id and project_id for performance
The system SHALL create database indexes on `org_id` and `project_id` fields for all tables with multi-tenant data.

#### Scenario: Query filtering by org_id uses index
- **WHEN** a query filters by `org_id`
- **THEN** the database uses the `idx_org_id` index and query completes in < 100ms

#### Scenario: Composite query filtering by org_id and project_id uses index
- **WHEN** a query filters by both `org_id` and `project_id`
- **THEN** the database uses the `idx_org_project` composite index

### Requirement: Token duration configured per access type
The system SHALL configure token and session durations separately for JWT and RECORD authentication types.

#### Scenario: JWT tokens expire after 15 minutes
- **WHEN** a JWT token is issued
- **THEN** the token has `DURATION FOR TOKEN 15m`

#### Scenario: JWT sessions expire after 12 hours
- **WHEN** a JWT session is created
- **THEN** the session has `DURATION FOR SESSION 12h`

#### Scenario: MiniBob tokens expire after 24 hours
- **WHEN** a MiniBob RECORD token is issued
- **THEN** the token has `DURATION FOR TOKEN 24h`

#### Scenario: MiniBob sessions expire after 7 days
- **WHEN** a MiniBob RECORD session is created
- **THEN** the session has `DURATION FOR SESSION 7d`
