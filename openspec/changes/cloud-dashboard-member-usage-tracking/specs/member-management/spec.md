## ADDED Requirements

### Requirement: View organization members
The system SHALL display a list of all members in the user's organization, including their email, role, and join date.

#### Scenario: Admin views member list
- **WHEN** user with admin role navigates to Members page
- **THEN** system displays all organization members with email, role, and join date

#### Scenario: Non-admin views member list
- **WHEN** user with non-admin role navigates to Members page
- **THEN** system displays all organization members but hides action buttons

### Requirement: Invite new members
The system SHALL allow admin users to invite new members by email address with a specified role.

#### Scenario: Admin invites new member
- **WHEN** admin enters valid email and selects role (admin, member, viewer)
- **THEN** system sends invitation email and adds pending invitation to list

#### Scenario: Non-admin attempts invitation
- **WHEN** non-admin user attempts to invite member
- **THEN** system displays error message "Only administrators can invite members"

#### Scenario: Invite duplicate email
- **WHEN** admin invites email that is already a member or has pending invitation
- **THEN** system displays error "User already exists or has pending invitation"

### Requirement: Remove members
The system SHALL allow admin users to remove members from the organization.

#### Scenario: Admin removes member
- **WHEN** admin clicks remove button and confirms action
- **THEN** system removes member and revokes their access

#### Scenario: Admin cannot remove self
- **WHEN** admin attempts to remove their own account
- **THEN** system displays error "Cannot remove yourself. Transfer admin role first."

#### Scenario: Last admin protection
- **WHEN** admin attempts to remove the only other admin
- **THEN** system displays warning "This will leave only one admin. Proceed with caution?"

### Requirement: Change member roles
The system SHALL allow admin users to change member roles between admin, member, and viewer.

#### Scenario: Admin changes member role
- **WHEN** admin selects new role from dropdown and confirms
- **THEN** system updates member role and refreshes permissions

#### Scenario: Role change affects permissions immediately
- **WHEN** user's role is changed from admin to member
- **THEN** user's session is updated and admin-only features become unavailable

### Requirement: Authentication integration
The system SHALL authenticate member management actions via JWT tokens from identity-vessel.

#### Scenario: Valid admin JWT token
- **WHEN** user with admin role makes member management API call
- **THEN** identity-vessel validates JWT and allows action

#### Scenario: Expired JWT token
- **WHEN** user makes member management API call with expired token
- **THEN** system returns 401 Unauthorized and redirects to login

#### Scenario: Insufficient permissions
- **WHEN** user with member or viewer role attempts admin action
- **THEN** system returns 403 Forbidden with message "Admin role required"
