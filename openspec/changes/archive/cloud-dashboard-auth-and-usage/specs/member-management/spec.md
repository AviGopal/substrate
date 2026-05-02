## ADDED Requirements

### Requirement: Members page displays organization members
The dashboard SHALL provide a Members page that lists all users in the authenticated user's organization.

#### Scenario: View members list
- **WHEN** authenticated user navigates to Members page
- **THEN** system displays list of all members in user's organization
- **THEN** system shows member email, name, role, and join date for each member
- **THEN** system does NOT show members from other organizations (RBAC isolation)

#### Scenario: Empty members list
- **WHEN** organization has only one member (the current user)
- **THEN** system displays current user in list
- **THEN** system shows "No other members" message

### Requirement: Member role display
The system SHALL display member roles with visual indicators.

#### Scenario: Admin member display
- **WHEN** member has role="admin"
- **THEN** system displays "Admin" badge with distinct color
- **THEN** system shows admin capabilities hint (can manage members, create API keys)

#### Scenario: Developer member display
- **WHEN** member has role="developer"
- **THEN** system displays "Developer" badge
- **THEN** system shows developer capabilities hint (can use API keys, view traces)

#### Scenario: Viewer member display
- **WHEN** member has role="viewer"
- **THEN** system displays "Viewer" badge
- **THEN** system shows viewer capabilities hint (read-only access)

### Requirement: Member activity summary
The system SHALL show recent activity for each member.

#### Scenario: Display member execution count
- **WHEN** viewing member list
- **THEN** system shows count of executions triggered by each member
- **THEN** system shows count of API keys owned by each member

#### Scenario: Display last active timestamp
- **WHEN** member has recent activity
- **THEN** system shows "Last active: X hours/days ago"
- **THEN** system uses member's most recent execution trace timestamp

#### Scenario: Never active member
- **WHEN** member has never triggered an execution
- **THEN** system shows "Never active" status
- **THEN** system does NOT show last active timestamp

### Requirement: Invite new members (admin only)
The system SHALL allow admin users to invite new members to the organization.

#### Scenario: Admin invites new member
- **WHEN** admin clicks "Invite Member" button
- **THEN** system shows invite form (email, role selection)
- **THEN** system sends POST /v2/users with {email, role, org_id}
- **THEN** system adds new user to members list

#### Scenario: Non-admin cannot invite
- **WHEN** developer or viewer clicks Members page
- **THEN** system does NOT show "Invite Member" button
- **THEN** system shows members list in read-only mode

### Requirement: Remove members (admin only)
The system SHALL allow admin users to deactivate members from the organization.

#### Scenario: Admin removes member
- **WHEN** admin clicks "Remove" button on member row
- **THEN** system shows confirmation dialog
- **THEN** system calls DELETE /v2/users/:id after confirmation
- **THEN** system removes member from list

#### Scenario: Cannot remove self
- **WHEN** admin tries to remove their own account
- **THEN** system shows error "Cannot remove yourself"
- **THEN** system does NOT allow removal

### Requirement: Assign API keys to members
The system SHALL allow viewing which API keys belong to which members.

#### Scenario: View member's API keys
- **WHEN** clicking "View Keys" on member row
- **THEN** system shows list of API keys owned by that member
- **THEN** system shows key status (active/revoked) and usage count
