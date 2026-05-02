## ADDED Requirements

### Requirement: Bootstrap metabob.com organization
The system SHALL create the metabob.com organization with avi@metabob.com as admin user during initial deployment.

#### Scenario: Fresh database bootstrap
- **WHEN** database migration runs on empty database
- **THEN** system creates organization "metabob.com" with id "metabob_com"

#### Scenario: Admin user creation
- **WHEN** metabob.com organization is created
- **THEN** system creates user avi@metabob.com with role "admin" and secure password hash

#### Scenario: Idempotent bootstrap
- **WHEN** bootstrap script runs and organization already exists
- **THEN** system skips creation and logs "Organization metabob.com already exists"

#### Scenario: Password can be changed after bootstrap
- **WHEN** avi@metabob.com user is created with initial password
- **THEN** user can login and change password using password management UI

### Requirement: Bootstrap script
The system SHALL provide a database migration script to create initial organization and user.

#### Scenario: Script execution
- **WHEN** migration script is executed via kubectl or surql CLI
- **THEN** system creates organization and user records in SurrealDB

#### Scenario: Verification query
- **WHEN** bootstrap is complete
- **THEN** query "SELECT * FROM users WHERE email = 'avi@metabob.com'" returns user record with org_id "metabob_com"
