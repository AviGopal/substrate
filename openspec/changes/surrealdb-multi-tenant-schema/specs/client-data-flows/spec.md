# Client Data Flows Validation Spec

This spec validates end-to-end data flows from client applications (metabob-mcp, minibob) through the backend APIs to SurrealDB, ensuring authentication works correctly and scoped information is available at each layer.

## Architecture Under Test

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW VALIDATION                               │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌───────────────┐                    ┌───────────────┐
    │  metabob-mcp  │                    │    minibob    │
    │  (AI Agent)   │                    │   (Vessel)    │
    └───────┬───────┘                    └───────┬───────┘
            │                                     │
            │ API Key Auth                        │ Instance Auth (RECORD)
            │ POST /v2/auth/apikey                │ POST /v2/auth/minibob/signin
            │                                     │
            ▼                                     ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                       metabob-activity-api                               │
    │                                                                          │
    │  Layer 1: Authentication Middleware                                      │
    │  ┌────────────────────────────────────────────────────────────────────┐ │
    │  │ jwtAuthMiddleware: Validates JWT, extracts claims from $auth       │ │
    │  │ authMiddleware: Redis session fallback (legacy)                    │ │
    │  └────────────────────────────────────────────────────────────────────┘ │
    │                                                                          │
    │  Layer 2: Route Handlers                                                 │
    │  ┌────────────────────────────────────────────────────────────────────┐ │
    │  │ activities.ts: Templates, executions, Thompson sampling            │ │
    │  │ impulses.ts: Impulse resolution                                    │ │
    │  └────────────────────────────────────────────────────────────────────┘ │
    │                                                                          │
    │  Layer 3: Database Access                                                │
    │  ┌────────────────────────────────────────────────────────────────────┐ │
    │  │ queryWithAuth(token): Passes JWT to SurrealDB                      │ │
    │  │ query(sql, params): Direct query (root credentials)                │ │
    │  └────────────────────────────────────────────────────────────────────┘ │
    └──────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                            SurrealDB                                     │
    │                                                                          │
    │  Layer 4: ACCESS Definitions                                             │
    │  ┌────────────────────────────────────────────────────────────────────┐ │
    │  │ apikey_record: Exchanges API key for JWT with org_id, project_ids  │ │
    │  │ minibob_record: Exchanges instance credentials for JWT             │ │
    │  └────────────────────────────────────────────────────────────────────┘ │
    │                                                                          │
    │  Layer 5: PERMISSIONS Enforcement                                        │
    │  ┌────────────────────────────────────────────────────────────────────┐ │
    │  │ FOR select WHERE org_id = $auth.org_id                             │ │
    │  │ FOR select WHERE project_id IN $auth.project_ids                   │ │
    │  └────────────────────────────────────────────────────────────────────┘ │
    └─────────────────────────────────────────────────────────────────────────┘
```

---

## ADDED Requirements

### Requirement: metabob-mcp API Key Authentication Flow

The metabob-mcp client SHALL authenticate using API keys and receive JWT tokens scoped to the user's organization and projects.

#### Scenario: API key exchange returns scoped JWT
- **GIVEN** an API key `mk_test_abc123` exists for user in `organization:acme` with projects `[project:backend, project:frontend]`
- **WHEN** metabob-mcp calls `POST /v2/auth/apikey` with `{"api_key": "mk_test_abc123"}`
- **THEN** the response contains a JWT token
- **AND** the JWT payload contains `org_id: "organization:acme"`
- **AND** the JWT payload contains `project_ids: ["project:backend", "project:frontend"]`
- **AND** the JWT payload contains `user_id` and `role`

#### Scenario: API key JWT enables scoped template queries
- **GIVEN** metabob-mcp has obtained a JWT token for `organization:acme`
- **WHEN** metabob-mcp calls `GET /v2/activities/templates` with `Authorization: Bearer <jwt>`
- **THEN** the API uses `queryWithAuth(jwt)` to query SurrealDB
- **AND** SurrealDB PERMISSIONS filter results to `org_id = organization:acme`
- **AND** only templates with matching org_id or `scope = 'global'` are returned

#### Scenario: API key without project_ids sees only org-level templates
- **GIVEN** an API key exists for a user with NO project memberships
- **WHEN** the user queries templates
- **THEN** project-scoped templates are NOT visible
- **AND** global and org-scoped templates are visible

#### Scenario: Invalid API key returns 401
- **GIVEN** no API key `mk_invalid_key` exists in the database
- **WHEN** metabob-mcp calls `POST /v2/auth/apikey` with `{"api_key": "mk_invalid_key"}`
- **THEN** the response status is 401
- **AND** the response body contains error message indicating invalid credentials

---

### Requirement: MiniBob Instance Authentication Flow

MiniBob vessels SHALL authenticate using RECORD access with instance_id and api_key, receiving JWT tokens scoped to their assigned organization and project.

#### Scenario: MiniBob signin returns scoped JWT
- **GIVEN** a MiniBob instance `mb-vessel-001` is registered to `organization:acme` and `project:backend`
- **WHEN** MiniBob calls `POST /v2/auth/minibob/signin` with `{"instance_id": "mb-vessel-001", "api_key": "secret"}`
- **THEN** the response contains a JWT token
- **AND** the JWT payload contains `org_id: "organization:acme"`
- **AND** the JWT payload contains `project_id: "project:backend"` (singular, instance-scoped)
- **AND** the JWT payload contains `vessel_id` and `instance_id`

#### Scenario: MiniBob JWT enables scoped template fetching
- **GIVEN** MiniBob has obtained a JWT token for `organization:acme`, `project:backend`
- **WHEN** MiniBob fetches templates via MCP
- **THEN** the API uses the JWT to authenticate with SurrealDB
- **AND** only templates visible to the project are returned
- **AND** other orgs' templates are NOT visible

#### Scenario: MiniBob cannot access other projects
- **GIVEN** MiniBob is authenticated to `project:backend`
- **WHEN** MiniBob queries data with an explicit `project_id = "project:frontend"` parameter
- **THEN** the database returns zero results (filtered by PERMISSIONS)
- **AND** no error is raised (silent filtering)

#### Scenario: Inactive MiniBob instance cannot authenticate
- **GIVEN** a MiniBob instance `mb-vessel-001` has `is_active = false`
- **WHEN** MiniBob attempts to sign in with valid credentials
- **THEN** the authentication fails
- **AND** no token is issued

---

### Requirement: JWT Claims Propagation to SurrealDB

JWT tokens issued by the auth endpoints SHALL contain all claims required for SurrealDB PERMISSIONS enforcement.

#### Scenario: $auth context populated from apikey_record SIGNIN
- **GIVEN** an API key belongs to user in org with project memberships
- **WHEN** the user authenticates and the JWT is used with SurrealDB
- **THEN** `SELECT * FROM $auth` returns object with:
  - `id`: The api_key record ID
  - `org_id`: The organization record ID
  - `user_id`: The user record ID
  - `role`: The user's role (admin, member, etc.)
  - `project_ids`: Array of project record IDs the user has access to
  - `scopes`: Array of API scopes (read, write, etc.)

#### Scenario: $auth context populated from minibob_record SIGNIN
- **GIVEN** a MiniBob instance is registered to an org/project
- **WHEN** the instance authenticates and the JWT is used with SurrealDB
- **THEN** `SELECT * FROM $auth` returns object with:
  - `id`: The minibob_instance record ID
  - `org_id`: The organization record ID
  - `project_id`: The project record ID (singular)
  - `vessel_id`: The vessel type identifier
  - `instance_id`: The instance identifier

#### Scenario: Missing project_ids in $auth blocks project-scoped queries
- **GIVEN** $auth.project_ids is NONE (not populated)
- **WHEN** a query includes PERMISSIONS with `project_id IN $auth.project_ids`
- **THEN** the PERMISSIONS clause evaluates to false
- **AND** no project-scoped records are returned
- **CRITICAL**: This is a known gap that must be fixed

---

### Requirement: Template Visibility Scoping

Templates SHALL be visible based on their scope field combined with the user's authentication context.

#### Scenario: Global templates visible to all authenticated users
- **GIVEN** a template has `scope = 'global'` and `public = true`
- **WHEN** any authenticated user queries templates
- **THEN** the global template is included in results

#### Scenario: Org-scoped templates visible only to org members
- **GIVEN** a template has `scope = 'org'` and `org_id = organization:acme`
- **WHEN** a user from `organization:acme` queries templates
- **THEN** the template is included in results
- **WHEN** a user from `organization:globex` queries templates
- **THEN** the template is NOT included in results

#### Scenario: Project-scoped templates visible only to project members
- **GIVEN** a template has `scope = 'project'` and `project_id = project:backend`
- **WHEN** a user with `project:backend` in their project_ids queries templates
- **THEN** the template is included in results
- **WHEN** a user WITHOUT `project:backend` in their project_ids queries templates
- **THEN** the template is NOT included in results

---

### Requirement: Execution Trace Isolation

Execution traces SHALL be stored and retrieved with proper org/project isolation.

#### Scenario: Execution trace created with session org_id
- **GIVEN** a user authenticated to `organization:acme`
- **WHEN** the user creates an execution trace via `POST /v2/activities/execution-traces`
- **THEN** the trace record has `org_id = organization:acme`
- **AND** if the user has a project context, `project_id` is also set

#### Scenario: Execution traces filtered by org_id
- **GIVEN** execution traces exist for multiple organizations
- **WHEN** a user from `organization:acme` queries traces
- **THEN** only traces with `org_id = organization:acme` are returned

#### Scenario: MiniBob execution traces scoped to instance project
- **GIVEN** MiniBob is authenticated to `project:backend`
- **WHEN** MiniBob creates an execution trace
- **THEN** the trace has `org_id` and `project_id` matching the instance's assignment
- **AND** other MiniBob instances in different projects cannot see this trace

---

### Requirement: Impulse Resolution Scoping

Impulse pointers SHALL be resolved with proper org/project context.

#### Scenario: activityTemplate impulse respects org scope
- **GIVEN** an impulse pointer of type `activityTemplate` references template `template:xyz`
- **WHEN** a user resolves this impulse
- **THEN** the resolution succeeds only if the user has access to that template's org/project
- **AND** if the template is in a different org, resolution returns null or error

#### Scenario: activityExecutionTrace impulse respects project scope
- **GIVEN** an impulse pointer references an execution trace in `project:backend`
- **WHEN** a user in `project:frontend` attempts to resolve this impulse
- **THEN** the resolution fails (no access)

---

### Requirement: Error Handling for Auth Failures

Authentication failures SHALL return appropriate error responses without leaking information.

#### Scenario: Expired JWT returns 401
- **GIVEN** a JWT token has expired (exp < now)
- **WHEN** any API endpoint is called with this token
- **THEN** the response status is 401
- **AND** the error message is generic ("Token expired" or "Unauthorized")

#### Scenario: Malformed JWT returns 401
- **GIVEN** the Authorization header contains invalid JWT structure
- **WHEN** any API endpoint is called
- **THEN** the response status is 401
- **AND** no stack trace or internal details are leaked

#### Scenario: Missing auth on protected endpoint returns 401
- **GIVEN** an endpoint requires authentication
- **WHEN** the request has no Authorization header
- **THEN** the response status is 401
- **AND** the error indicates authentication required

---

## Validation Test Matrix

| Flow | Auth Method | Org Scope | Project Scope | Status |
|------|-------------|-----------|---------------|--------|
| mcp → apikey → JWT → templates | API Key | ✅ Works | ⚠️ Gap: project_ids not in $auth | Needs fix |
| mcp → apikey → JWT → traces | API Key | ✅ Works | ⚠️ Gap: project_ids not in $auth | Needs fix |
| minibob → instance → JWT → templates | RECORD | ✅ Works | ✅ Works (singular project_id) | Verified |
| minibob → instance → JWT → traces | RECORD | ✅ Works | ⚠️ Hardcoded project_id in mcp.ts | Needs fix |
| dashboard → session → templates | Redis | ✅ Works | ✅ Works (app-level filter) | Verified |

---

## Known Gaps (From Integration Analysis)

### Gap 1: apikey_record SIGNIN Missing project_ids

**Location:** `repos/metabob-proto/surrealdb/core/001-auth-access.surql`

**Impact:** Users authenticating via API keys cannot access project-scoped templates because `$auth.project_ids` is NONE.

**Fix Required:**
```surql
-- Add to SIGNIN query:
(SELECT project_id FROM project_members
 WHERE user_id = $parent.user_id AND is_active = true
).project_id AS project_ids
```

### Gap 2: MiniBob Hardcoded project_id

**Location:** `repos/minibob/src/mcp.ts:480`

**Impact:** All MiniBob impulses use "minibob-default" instead of the instance's assigned project.

**Fix Required:**
```typescript
// Change from:
project_id: "minibob-default"
// To:
project_id: this.instance.projectId
```

### Gap 3: minibob_record SIGNIN Missing project_id

**Location:** `repos/metabob-proto/surrealdb/core/001-auth-access.surql`

**Impact:** MiniBob instances may not have project_id in $auth if schema doesn't populate it.

**Verify:** Check if minibob_record SIGNIN includes project_id in returned claims.
