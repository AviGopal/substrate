## ADDED Requirements

### Requirement: Organizations table stores org-level metadata
The system SHALL provide an `organizations` table with fields: `org_id`, `name`, `stripe_customer_id`, `seat_limit`, `seat_usage`, `created_at`, `updated_at`.

#### Scenario: Create new organization
- **WHEN** a new organization is created with name "Acme Corp" and seat_limit 10
- **THEN** the organization record is stored with generated `org_id` and timestamps

#### Scenario: Query organization by org_id
- **WHEN** a query requests organization by `org_id = organization:acme`
- **THEN** the system returns the organization record with all fields

#### Scenario: Update organization seat_usage
- **WHEN** organization seat_usage is incremented (new user added)
- **THEN** the seat_usage field is updated and does not exceed seat_limit

### Requirement: Users table stores org members
The system SHALL provide a `users` table with fields: `user_id`, `org_id`, `email`, `name`, `password_hash`, `role`, `created_at`, `last_login_at`.

#### Scenario: Create user within organization
- **WHEN** a new user is created with email "alice@acme.com" and role "member"
- **THEN** the user record is stored with `org_id = organization:acme` and hashed password

#### Scenario: User login updates last_login_at
- **WHEN** a user successfully authenticates
- **THEN** the `last_login_at` timestamp is updated to current time

#### Scenario: User role determines permissions
- **WHEN** a user with role "admin" attempts privileged operations
- **THEN** the PERMISSIONS clause allows the operation based on `$auth.role`

### Requirement: API keys table stores authentication credentials
The system SHALL provide an `api_keys` table with fields: `key_id`, `org_id`, `key_hash`, `user_id`, `scopes`, `created_at`, `last_used_at`, `expires_at`, `is_active`.

#### Scenario: Generate API key for user
- **WHEN** a user requests a new API key
- **THEN** the system generates a key_id, hashes the key, and stores with user_id and org_id

#### Scenario: API key usage updates last_used_at
- **WHEN** an API request authenticates with an API key
- **THEN** the `last_used_at` timestamp is updated

#### Scenario: Expired API keys are rejected
- **WHEN** an API key with `expires_at` in the past is used
- **THEN** authentication fails

#### Scenario: Inactive API keys are rejected
- **WHEN** an API key with `is_active = false` is used
- **THEN** authentication fails

### Requirement: Projects table stores code projects within orgs
The system SHALL provide a `projects` table with fields: `project_id`, `org_id`, `name`, `repo_url`, `created_at`, `metadata`.

#### Scenario: Create project within organization
- **WHEN** a project is created with name "backend-api" within organization "acme"
- **THEN** the project record is stored with `org_id = organization:acme`

#### Scenario: List projects for organization
- **WHEN** an admin queries projects for their organization
- **THEN** all projects with matching `org_id` are returned

#### Scenario: Project metadata stores custom fields
- **WHEN** a project is created with metadata `{ "language": "typescript", "framework": "bun" }`
- **THEN** the metadata field stores the JSON object

### Requirement: Subscriptions table tracks billing
The system SHALL provide a `subscriptions` table with fields: `sub_id`, `org_id`, `stripe_subscription_id`, `stripe_customer_id`, `plan`, `status`, `seat_limit`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `metadata`.

#### Scenario: Create subscription for organization
- **WHEN** an organization subscribes to "pro" plan
- **THEN** the subscription record is stored with `org_id`, `plan = 'pro'`, and Stripe IDs

#### Scenario: Active subscription allows access
- **WHEN** a user from organization with `status = 'active'` subscription attempts access
- **THEN** access is granted

#### Scenario: Past due subscription restricts access
- **WHEN** a user from organization with `status = 'past_due'` attempts access
- **THEN** access is restricted (read-only mode or blocked)

#### Scenario: Subscription period end triggers renewal
- **WHEN** `current_period_end` timestamp passes
- **THEN** the system triggers Stripe webhook to update subscription status

### Requirement: Audit logs track security events
The system SHALL provide an `audit_logs` table with fields: `log_id`, `org_id`, `user_id`, `action`, `resource_type`, `resource_id`, `timestamp`, `ip_address`, `user_agent`, `details`.

#### Scenario: Log user login event
- **WHEN** a user successfully logs in
- **THEN** an audit log entry is created with `action = 'login'`, user_id, and IP address

#### Scenario: Log API key creation
- **WHEN** an API key is created
- **THEN** an audit log entry is created with `action = 'create'`, `resource_type = 'api_key'`, and resource_id

#### Scenario: Log data deletion
- **WHEN** an admin deletes a project
- **THEN** an audit log entry is created with `action = 'delete'`, `resource_type = 'project'`, and details

#### Scenario: Query audit logs for organization
- **WHEN** an admin queries audit logs for their organization
- **THEN** all logs with matching `org_id` are returned, ordered by timestamp DESC

### Requirement: Core schemas enforce RBAC permissions
The system SHALL define PERMISSIONS clauses on all core tables to enforce organization-level isolation.

#### Scenario: User can only view their organization
- **WHEN** a user queries the `organizations` table
- **THEN** only their organization record (WHERE `id = $auth.org_id`) is visible

#### Scenario: User can only view users in their organization
- **WHEN** a user queries the `users` table
- **THEN** only users with matching `org_id` are visible

#### Scenario: Admin can create users in their organization
- **WHEN** an admin with `role = 'admin'` creates a user
- **THEN** the user is created with `org_id = $auth.org_id` (automatic injection)

#### Scenario: Member cannot create users
- **WHEN** a member with `role = 'member'` attempts to create a user
- **THEN** the operation fails due to PERMISSIONS clause
