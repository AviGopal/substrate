## ADDED Requirements

### Requirement: Password change endpoint
The API SHALL provide PUT /v2/auth/password endpoint for authenticated password changes.

#### Scenario: Successful password change via API
- **WHEN** authenticated user sends PUT /v2/auth/password with current_password and new_password
- **THEN** system verifies current password, updates password hash, returns 200 OK with success message

#### Scenario: Missing current password
- **WHEN** request body is missing current_password field
- **THEN** system returns 400 Bad Request with error "current_password is required"

#### Scenario: Missing new password
- **WHEN** request body is missing new_password field
- **THEN** system returns 400 Bad Request with error "new_password is required"

#### Scenario: Token refresh after password change
- **WHEN** user changes password successfully
- **THEN** current JWT token remains valid until expiration (no forced logout)

### Requirement: Enhanced signup validation
The signup endpoint SHALL validate all required fields and provide clear error messages.

#### Scenario: Missing organization name on signup
- **WHEN** signup request is missing org_name and org_id fields
- **THEN** system returns 400 Bad Request with error "Either org_id or org_name must be provided"

#### Scenario: Duplicate email prevention
- **WHEN** signup request uses email that exists in any organization
- **THEN** system returns 409 Conflict with suggestion to use login endpoint
