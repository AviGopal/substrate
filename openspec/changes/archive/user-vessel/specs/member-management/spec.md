## ADDED Requirements

### Requirement: List organization members
The system SHALL return all members of the authenticated user's organization with RBAC filtering.

#### Scenario: Admin lists organization members
- **WHEN** admin user calls GET /v1/organizations/:id/members
- **THEN** system returns all members where org_id = $auth.org_id with user details and roles

#### Scenario: Member views member list
- **WHEN** member (non-admin) calls GET /v1/organizations/:id/members
- **THEN** system returns member list (read-only access via PERMISSIONS)

### Requirement: Invite new member to organization
The system SHALL allow admin users to invite new members by email with role assignment.

#### Scenario: Admin invites new member
- **WHEN** admin calls POST /v1/organizations/:id/members/invite with email and role
- **THEN** system creates organization_invitation record with token and 7-day expiration

#### Scenario: Non-admin attempts to invite
- **WHEN** member (non-admin) calls POST /v1/organizations/:id/members/invite
- **THEN** system returns 403 Forbidden due to PERMISSIONS clause

#### Scenario: Invitation at seat limit
- **WHEN** admin invites member but seat_usage >= seat_limit
- **THEN** system returns 409 Conflict with message "Seat limit reached"

### Requirement: Accept member invitation
The system SHALL allow invited users to accept invitations via unique token.

#### Scenario: User accepts valid invitation
- **WHEN** user calls POST /v1/invitations/:token/accept with valid unexpired token
- **THEN** system creates organization_member record, increments seat_usage, marks invitation as accepted

#### Scenario: User accepts expired invitation
- **WHEN** user calls POST /v1/invitations/:token/accept with expired token (>7 days)
- **THEN** system returns 410 Gone with message "Invitation expired"

#### Scenario: User accepts already-used invitation
- **WHEN** user calls POST /v1/invitations/:token/accept with token already accepted
- **THEN** system returns 409 Conflict with message "Invitation already used"

### Requirement: Remove member from organization
The system SHALL allow admin users to remove members with soft delete for audit trail.

#### Scenario: Admin removes member
- **WHEN** admin calls DELETE /v1/organizations/:id/members/:userId
- **THEN** system sets removed_at timestamp, decrements seat_usage, records removed_by = $auth.user_id

#### Scenario: Non-admin attempts removal
- **WHEN** member (non-admin) calls DELETE /v1/organizations/:id/members/:userId
- **THEN** system returns 403 Forbidden due to PERMISSIONS clause

#### Scenario: Remove organization owner
- **WHEN** admin attempts to remove member with role = 'owner'
- **THEN** system returns 422 Unprocessable Entity with message "Cannot remove organization owner"

### Requirement: Update member role
The system SHALL allow admin users to change member roles with owner-specific protections.

#### Scenario: Admin promotes member to admin
- **WHEN** admin calls PATCH /v1/organizations/:id/members/:userId with role = 'admin'
- **THEN** system updates member role to admin

#### Scenario: Admin demotes owner
- **WHEN** admin calls PATCH /v1/organizations/:id/members/:userId on owner with new role
- **THEN** system returns 422 Unprocessable Entity with message "Cannot change owner role"

#### Scenario: Non-admin attempts role change
- **WHEN** member (non-admin) calls PATCH /v1/organizations/:id/members/:userId
- **THEN** system returns 403 Forbidden due to PERMISSIONS clause

### Requirement: Role hierarchy enforcement
The system SHALL enforce role hierarchy: owner > admin > member > viewer.

#### Scenario: Role-based permissions apply
- **WHEN** user performs action requiring specific role
- **THEN** system checks $auth.role against required role in PERMISSIONS clause

#### Scenario: Viewer cannot modify resources
- **WHEN** viewer attempts POST/PATCH/DELETE on any resource
- **THEN** system returns 403 Forbidden (viewers have read-only access)
