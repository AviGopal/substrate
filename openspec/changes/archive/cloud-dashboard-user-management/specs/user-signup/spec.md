## ADDED Requirements

### Requirement: User can sign up with new organization
The system SHALL allow new users to create an account and organization in a single signup flow.

#### Scenario: Successful signup with new organization
- **WHEN** user provides valid email, password (8+ characters), name, and org name
- **THEN** system creates organization, creates user as admin, and returns JWT token

#### Scenario: Signup with existing email
- **WHEN** user provides email that already exists in database
- **THEN** system returns 409 Conflict with error message "User with this email already exists" and suggestion to login

#### Scenario: Signup with invalid email
- **WHEN** user provides malformed email address
- **THEN** system returns 400 Bad Request with error message "Invalid email address"

#### Scenario: Signup with weak password
- **WHEN** user provides password shorter than 8 characters
- **THEN** system returns 400 Bad Request with error message "Password must be at least 8 characters"

### Requirement: Signup UI
The dashboard SHALL provide a signup page accessible from login page.

#### Scenario: User accesses signup page
- **WHEN** unauthenticated user clicks "Sign up" link on login page
- **THEN** system displays signup form with fields: email, password, confirm password, name, organization name

#### Scenario: Successful signup in UI
- **WHEN** user submits valid signup form
- **THEN** system logs user in automatically and redirects to dashboard

#### Scenario: Signup form validation
- **WHEN** user submits incomplete form (missing required fields)
- **THEN** system displays validation errors for each missing field

#### Scenario: Link back to login
- **WHEN** user on signup page clicks "Already have an account?" link
- **THEN** system navigates to login page
