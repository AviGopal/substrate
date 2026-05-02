## ADDED Requirements

### Requirement: User can change password
The system SHALL allow authenticated users to change their password by providing their current password and a new password.

#### Scenario: Successful password change
- **WHEN** user provides valid current password and new password (8+ characters)
- **THEN** system updates password hash in database and returns success

#### Scenario: Invalid current password
- **WHEN** user provides incorrect current password
- **THEN** system returns 401 Unauthorized with error message "Current password is incorrect"

#### Scenario: Weak new password
- **WHEN** user provides new password shorter than 8 characters
- **THEN** system returns 400 Bad Request with error message "Password must be at least 8 characters"

#### Scenario: Unauthenticated request
- **WHEN** request is made without valid JWT token
- **THEN** system returns 401 Unauthorized with error message "Authentication required"

### Requirement: Password change UI
The dashboard SHALL provide a password change form accessible from user settings.

#### Scenario: User accesses password change form
- **WHEN** authenticated user navigates to settings/password
- **THEN** system displays form with fields: current password, new password, confirm new password

#### Scenario: Password confirmation mismatch
- **WHEN** new password and confirm password fields do not match
- **THEN** system displays validation error "Passwords do not match" before submission

#### Scenario: Successful password change in UI
- **WHEN** user submits valid password change form
- **THEN** system displays success message and clears the form

#### Scenario: Failed password change in UI
- **WHEN** backend returns error (e.g., wrong current password)
- **THEN** system displays error message from backend and keeps form populated (except passwords cleared)
