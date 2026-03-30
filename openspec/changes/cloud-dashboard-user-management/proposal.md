## Why

The cloud dashboard currently lacks essential user management capabilities. Users cannot change their passwords, new users cannot self-register, and there's no initial setup for the metabob.com organization with avi@metabob.com as the admin user. These gaps prevent proper user lifecycle management and API key provisioning workflows.

## What Changes

- Add password change endpoint to metabob-analysis-api backend
- Add password change UI to cloud dashboard settings
- Add signup page for new organization creation
- Create metabob.com organization with avi@metabob.com as initial admin user
- Ensure all UI components are interactive and accessible
- Add proper validation and error handling for password operations

## Capabilities

### New Capabilities

- `password-management`: User password change functionality with current password verification
- `user-signup`: New user registration with organization creation
- `organization-bootstrap`: Initial organization and admin user setup for metabob.com

### Modified Capabilities

- `authentication`: Enhanced to support password change requiring current password verification

## Impact

**Backend (metabob-analysis-api):**
- New endpoint: `PUT /v2/auth/password` for password changes
- Enhanced: `/v2/auth/signup` for organization bootstrapping
- Database: No schema changes, uses existing `users` and `organizations` tables

**Frontend (metabob-cloud-dashboard):**
- New page: Signup page with org creation
- New component: Password change form in user settings
- Modified: Login page with link to signup

**Configuration:**
- Database migration script to create metabob.com org and avi@metabob.com user
