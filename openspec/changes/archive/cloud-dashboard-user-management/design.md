## Context

The cloud dashboard and analysis API are currently deployed with JWT-based authentication but lack critical user management features. Users authenticate via email/password, but cannot change passwords or self-register. The metabob.com organization needs to be bootstrapped with avi@metabob.com as the initial admin to enable API key provisioning.

**Current State:**
- Backend: `/v2/auth/login` and `/v2/auth/signup` exist, using SurrealDB crypto::argon2 for password hashing
- Frontend: Login page functional, but no signup UI or password management
- Database: `users` and `organizations` tables exist with proper RBAC via PERMISSIONS
- No initial data: Empty database requires manual user creation

**Constraints:**
- Must use existing SurrealDB crypto functions (crypto::argon2::generate, crypto::argon2::compare)
- Must maintain JWT token structure for backward compatibility
- Must follow existing auth patterns (15-minute tokens, session storage)
- No schema changes allowed (use existing tables)

## Goals / Non-Goals

**Goals:**
- Enable users to change their own passwords securely
- Allow new users to self-register and create organizations
- Bootstrap metabob.com organization with avi@metabob.com admin user
- Maintain security best practices (current password verification, password strength)
- Provide clear error messages and validation feedback

**Non-Goals:**
- Password reset via email (future work)
- OAuth/SSO integration (future work)
- Multi-factor authentication (future work)
- Password history or complexity rules beyond minimum length
- Account deletion or deactivation UI

## Decisions

### Decision 1: Password change requires current password verification
**Rationale:** Security best practice to prevent unauthorized password changes if session is compromised. Even with valid JWT, user must prove knowledge of current password.

**Alternatives Considered:**
- Allow password change with just JWT: Rejected due to security risk (stolen token could change password)
- Require email confirmation: Rejected as out of scope (no email service yet)

**Implementation:** New endpoint `PUT /v2/auth/password` with body `{current_password, new_password}`. Backend verifies current password with crypto::argon2::compare before updating.

### Decision 2: Signup creates organization automatically
**Rationale:** Simplifies onboarding - new users get their own organization workspace immediately. Aligns with SaaS multi-tenant model where each signup is a new customer.

**Alternatives Considered:**
- Invite-only model: Rejected as too restrictive for initial launch
- Separate org creation step: Rejected as adding friction to signup flow

**Implementation:** `/v2/auth/signup` already supports org_name parameter. Frontend provides org name field, backend creates org then user in single transaction.

### Decision 3: Bootstrap via database migration script
**Rationale:** Idempotent, version-controlled approach. Can be run as Helm hook or manually via kubectl exec.

**Alternatives Considered:**
- Manual creation via UI: Rejected because UI isn't accessible until user exists
- Hardcoded in application startup: Rejected as less flexible and harder to audit

**Implementation:** SurrealDB migration script in `repos/metabob-analysis-api/sql/migrations/` that checks if metabob.com org exists before creating. Password set to secure default that must be changed on first login.

### Decision 4: No forced logout after password change
**Rationale:** Better UX - user can continue working in current session. Current JWT remains valid until natural expiration (15 minutes).

**Alternatives Considered:**
- Invalidate all tokens immediately: Rejected as requiring token blacklist (adds complexity)
- Force re-login: Rejected as poor UX for legitimate password changes

**Implementation:** Password change updates database but doesn't touch session. Other sessions will fail on next token refresh.

### Decision 5: Frontend routing without react-router
**Rationale:** Current app uses simple state-based routing (`currentPage` useState). Adding react-router adds dependency and refactoring overhead.

**Alternatives Considered:**
- Add react-router: Rejected as over-engineering for simple use case
- URL-based routing with pushState: Considered but deferred (can add later)

**Implementation:** Add "signup" page to existing Page type union. Add conditional rendering in App.tsx. Link between login/signup via button onClick.

## Risks / Trade-offs

**[Risk]** Bootstrap password for avi@metabob.com is in version control
→ **Mitigation:** Use placeholder password, document that it must be changed immediately after deployment. Consider using Kubernetes secret for initial password.

**[Risk]** No rate limiting on password change endpoint
→ **Mitigation:** Rely on existing API rate limiting middleware (scope middleware applies to all routes). Accept risk for v1.

**[Risk]** Password strength only checks minimum length (8 chars)
→ **Mitigation:** Document as known limitation. Plan for enhanced validation (complexity rules) in future iteration.

**[Trade-off]** Simple page-based routing limits deep linking
→ **Accepted:** Simple approach is sufficient for current needs. Can migrate to react-router when URL routing becomes necessary.

**[Trade-off]** No email verification on signup
→ **Accepted:** Out of scope until email service is integrated. Document as future enhancement.

## Migration Plan

**Phase 1: Backend (metabob-analysis-api)**
1. Add PUT /v2/auth/password endpoint in routes/auth.ts
2. Create bootstrap migration script in sql/migrations/
3. Deploy to local cluster, verify endpoint with curl
4. Run bootstrap script via kubectl exec

**Phase 2: Frontend (metabob-cloud-dashboard)**
1. Create Signup.tsx page component
2. Create PasswordChange.tsx component
3. Update App.tsx routing to support signup page
4. Add navigation links (login→signup, signup→login)
5. Deploy to local cluster, verify UI flows

**Phase 3: Verification**
1. Test signup flow: create new org + user
2. Test login with new user
3. Test password change for new user
4. Test API key provisioning with avi@metabob.com
5. Verify all scenarios from specs

**Rollback Strategy:**
- Backend: Revert to previous image tag (endpoint is additive, no breaking changes)
- Frontend: Revert to previous image tag (UI changes are additive)
- Database: Bootstrap script is idempotent, no rollback needed

## Open Questions

**Q1:** Should initial password for avi@metabob.com be randomly generated or use a known default?
→ **Proposed:** Use environment variable `INITIAL_ADMIN_PASSWORD` in bootstrap script. If not set, use secure random generation and log to console once.

**Q2:** Should password change invalidate API keys created by the user?
→ **Proposed:** No. API keys have their own lifecycle and are hashed separately. Changing user password doesn't affect API key authentication.

**Q3:** Should signup page include terms of service checkbox?
→ **Proposed:** Defer to future iteration. Add TODO comment in Signup.tsx.
