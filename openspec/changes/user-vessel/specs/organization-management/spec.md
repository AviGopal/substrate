## ADDED Requirements

### Requirement: List organizations for authenticated user
The system SHALL return all organizations where the authenticated user is a member, filtered by RBAC PERMISSIONS.

#### Scenario: User lists their organizations
- **WHEN** authenticated user calls GET /v1/organizations
- **THEN** system returns only organizations where org_id matches $auth.org_id

#### Scenario: Admin views organization details
- **WHEN** admin user calls GET /v1/organizations/current
- **THEN** system returns full org details including seat_limit, seat_usage, subscription_tier

### Requirement: Retrieve organization by ID
The system SHALL allow users to retrieve organization details by ID with RBAC enforcement.

#### Scenario: User retrieves their organization
- **WHEN** user calls GET /v1/organizations/:id with valid org_id matching $auth.org_id
- **THEN** system returns organization details

#### Scenario: User attempts to access another organization
- **WHEN** user calls GET /v1/organizations/:id with org_id NOT matching $auth.org_id
- **THEN** system returns 403 Forbidden

### Requirement: Update organization settings
The system SHALL allow admin users to update organization settings with RBAC enforcement.

#### Scenario: Admin updates organization name
- **WHEN** admin user calls PATCH /v1/organizations/:id with new name
- **THEN** system updates organization name and returns updated organization

#### Scenario: Non-admin attempts to update organization
- **WHEN** member (non-admin) calls PATCH /v1/organizations/:id
- **THEN** system returns 403 Forbidden due to PERMISSIONS clause

### Requirement: Seat limit enforcement
The system SHALL enforce seat limits based on subscription tier and prevent exceeding allocated seats.

#### Scenario: Organization at seat limit
- **WHEN** organization has seat_usage >= seat_limit
- **THEN** member invitation requests fail with 409 Conflict and message "Seat limit reached"

#### Scenario: Organization below seat limit
- **WHEN** organization has seat_usage < seat_limit
- **THEN** member invitation requests succeed and increment seat_usage

### Requirement: Subscription tier awareness
The system SHALL track subscription tier and derive seat limits accordingly.

#### Scenario: Free tier organization
- **WHEN** organization has subscription_tier = 'free'
- **THEN** seat_limit = 1

#### Scenario: Enterprise tier organization
- **WHEN** organization has subscription_tier = 'enterprise'
- **THEN** seat_limit = -1 (unlimited)
