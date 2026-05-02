## 1. Backend - Password Change Endpoint

- [x] 1.1 Add PUT /v2/auth/password endpoint in repos/metabob-analysis-api/src/routes/auth.ts
- [x] 1.2 Implement request validation (current_password, new_password required, min 8 chars)
- [x] 1.3 Verify current password using crypto::argon2::compare
- [x] 1.4 Update password hash using crypto::argon2::generate
- [x] 1.5 Add error handling for invalid current password (401) and weak new password (400)
- [ ] 1.6 Test endpoint with curl: valid password change, wrong current password, weak password

## 2. Backend - Organization Bootstrap

- [x] 2.1 Create migration script repos/metabob-analysis-api/sql/migrations/050-bootstrap-metabob-org.surql
- [x] 2.2 Implement idempotent check: SELECT FROM organizations WHERE id = 'metabob_com'
- [x] 2.3 Create metabob.com organization with subscription_tier = 'enterprise'
- [x] 2.4 Create avi@metabob.com user with role = 'admin' and secure password hash
- [x] 2.5 Add environment variable support for INITIAL_ADMIN_PASSWORD (fallback to logged random)
- [ ] 2.6 Test migration locally via kubectl exec into surrealdb pod
- [ ] 2.7 Verify with query: SELECT * FROM users WHERE email = 'avi@metabob.com'

## 3. Backend - Deploy and Verify

- [ ] 3.1 Build metabob-analysis-api Docker image with new endpoint
- [ ] 3.2 Deploy to local cluster via helmfile sync
- [ ] 3.3 Run bootstrap migration script
- [ ] 3.4 Test password change endpoint with avi@metabob.com credentials
- [ ] 3.5 Verify JWT token still works after password change

## 4. Frontend - Signup Page

- [x] 4.1 Create repos/metabob-cloud-dashboard/src/pages/Signup.tsx component
- [x] 4.2 Add form fields: email, password, confirm password, name, organization name
- [x] 4.3 Implement client-side validation: email format, password length, password match
- [x] 4.4 Call POST /api/auth/signup on submit
- [x] 4.5 Handle success: auto-login with returned token, redirect to dashboard
- [x] 4.6 Handle errors: display backend error messages (409 for duplicate email, 400 for validation)
- [x] 4.7 Add "Already have an account? Sign in" link to navigate to login

## 5. Frontend - Password Change UI

- [x] 5.1 Create repos/metabob-cloud-dashboard/src/pages/Settings.tsx component
- [x] 5.2 Add password change form: current password, new password, confirm new password
- [x] 5.3 Implement client-side validation: all fields required, passwords match, min 8 chars
- [x] 5.4 Call PUT /api/auth/password on submit
- [x] 5.5 Handle success: clear form, display success message
- [x] 5.6 Handle errors: display backend error (401 for wrong current password)
- [x] 5.7 Add settings page to routing in App.tsx

## 6. Frontend - Routing Updates

- [x] 6.1 Add "signup" and "settings" to Page type union in App.tsx
- [x] 6.2 Add renderPage cases for signup and settings pages
- [x] 6.3 Update LoginForm to show "Don't have an account? Sign up" link
- [x] 6.4 Add Settings navigation item to sidebar (user profile section)
- [x] 6.5 Ensure unauthenticated users can access signup page (bypass ProtectedRoute)

## 7. Frontend - Deploy and Verify

- [ ] 7.1 Build metabob-cloud-dashboard Docker image
- [ ] 7.2 Deploy to local cluster via helmfile sync
- [ ] 7.3 Test signup flow: create new test org (test.com) and user (test@test.com)
- [ ] 7.4 Test login with new test user
- [ ] 7.5 Test password change for test user
- [ ] 7.6 Login as avi@metabob.com and navigate to API Keys page
- [ ] 7.7 Provision test API key to verify full workflow

## 8. Integration Testing

- [ ] 8.1 Verify all password-management spec scenarios (8 scenarios)
- [ ] 8.2 Verify all user-signup spec scenarios (8 scenarios)
- [ ] 8.3 Verify all organization-bootstrap spec scenarios (6 scenarios)
- [ ] 8.4 Verify all authentication spec scenarios (6 scenarios)
- [ ] 8.5 Test error paths: weak passwords, duplicate emails, wrong current password
- [ ] 8.6 Verify UI components are interactive and accessible (tab navigation, enter key submit)

## 9. Documentation and Cleanup

- [ ] 9.1 Update CLAUDE.md with password change and signup workflow instructions
- [ ] 9.2 Document bootstrap script usage in deployment guide
- [ ] 9.3 Add API documentation for PUT /v2/auth/password endpoint
- [ ] 9.4 Commit changes with message: "feat(auth): add password management and signup"
