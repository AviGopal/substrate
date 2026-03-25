# SurrealDB Multi-Tenant Schema - Milestone-Based Tasks v2

**Version:** 2.0
**Date:** 2026-03-25
**Status:** Reorganized with 6 testable milestones

---

## Overview

This task list is organized into 6 commit milestones. Each milestone leaves the application in a working, testable state with black-box E2E tests that:
- Call real APIs in the deployed environment
- Use Playwright MCP to validate dashboard outputs
- Are independent and can run against any environment

---

## Milestone 1: Foundation Validation

**Commit:** `feat(rbac): validate existing RBAC infrastructure`
**Goal:** Verify all existing RBAC components work correctly with automated tests
**Tests:** 15 E2E tests

### Tasks

- [x] M1.1.1 Create `tests/e2e/` directory structure with helpers
- [x] M1.1.2 Set up Playwright MCP connection for dashboard tests
- [x] M1.1.3 Create test fixture loader for organizations, users, projects, api_keys, minibob_instances
- [x] M1.1.4 Create test helpers: APIClient, authenticateUser, authenticateMiniBob, getTemplates

- [x] M1.2.1 Test: MiniBob signin returns JWT with org_id
- [x] M1.2.2 Test: MiniBob signin returns JWT with project_id
- [x] M1.2.3 Test: MiniBob signin fails for inactive instance
- [x] M1.2.4 Test: MiniBob JWT enables template queries
- [x] M1.2.5 Test: MiniBob cannot access other org's templates

- [x] M1.3.1 Test: API key exchange returns JWT with org_id
- [x] M1.3.2 Test: API key exchange returns JWT with project_ids array
- [x] M1.3.3 Test: Expired API key returns 401
- [x] M1.3.4 Test: Revoked API key returns 401
- [x] M1.3.5 Test: API key JWT enables scoped queries

- [x] M1.4.1 Test: User A cannot see Org B's templates (PERMISSIONS)
- [x] M1.4.2 Test: User A cannot see Org B's execution traces (PERMISSIONS)
- [x] M1.4.3 Test: Global templates visible to all orgs
- [x] M1.4.4 Test: Project-scoped templates filtered by project_ids
- [x] M1.4.5 Test: org_id auto-populated on INSERT via VALUE clause

- [x] M1.5.1 Dashboard test: Shows current org after login
- [x] M1.5.2 Dashboard test: Templates list shows only org templates

**Completion Criteria:**
- All 15 foundation tests passing
- Test infrastructure reusable for subsequent milestones
- No changes to production code (validation only)

---

## Milestone 2: Data Flow Validation

**Commit:** `feat(rbac): validate end-to-end data flows`
**Goal:** Verify data flows correctly through all service boundaries with proper auth
**Tests:** 15 E2E tests
**Depends:** M1 complete

### ⚠️ Pre-Requisite Fix (CRITICAL)

The following tasks fix a discovered configuration mismatch:

- [x] **M2.0.1** Add `/v2/auth/apikey` endpoint to metabob-analysis-api
  - Copy auth logic from activity-api (same SurrealDB, same RECORD access)
  - Uses `apikey_record` RECORD access for SurrealDB authentication
  - Returns: `{token, expires_at, expires_in, org_id, user_id, scopes, project_ids}`
- [x] **M2.0.2** Update metabob-analysis-api auth routes registration (index.ts)
- [x] **M2.0.3** Test: metabob-mcp can authenticate via analysis-api `/v2/auth/apikey`
- [x] **M2.0.4** Verify metabob-mcp analysis tools work with obtained JWT

**Context:** metabob-mcp is configured with `ANALYSIS_API_URL` pointing to metabob-analysis-api,
but needs `/v2/auth/apikey` which currently only exists in metabob-activity-api.
This breaks MCP authentication. Fix by adding the endpoint to analysis-api.

### Tasks

- [x] M2.1.1 Test: MCP authenticates with API key on startup
- [x] M2.1.2 Test: MCP queries templates with JWT Authorization header
- [x] M2.1.3 Test: MCP token auto-refreshes at 80% lifetime (12 min)
- [x] M2.1.4 Test: MCP handles auth failure gracefully (helpful error message)
- [x] M2.1.5 Test: MCP scoped to user's projects only

- [x] M2.2.1 Test: MiniBob fetches boredom task from queue
- [x] M2.2.2 Test: MiniBob resolves impulse via POST /v2/impulses/resolve
- [x] M2.2.3 Test: MiniBob stores execution trace with org_id from $auth
- [x] M2.2.4 Test: MiniBob trace has correct project_id (from instance, not hardcoded)
- [x] M2.2.5 Test: MiniBob composition edge recorded in composition_graph

- [x] M2.3.1 Test: Dashboard login creates valid session (JWT in cookie)
- [x] M2.3.2 Test: Dashboard fetches templates via activity-api with auth
- [x] M2.3.3 Test: Dashboard fetches projects via analysis-api with auth
- [x] M2.3.4 Test: WebSocket receives execution_completed event after MiniBob run
- [x] M2.3.5 Test: Dashboard logout invalidates session (protected routes redirect)

**Completion Criteria:**
- All 15 data flow tests passing
- MiniBob execution traces have correct project_id (task 12.1.3 fix verified)
- MCP token refresh working (auto-refresh at 80% lifetime)

---

## Milestone 3: Cross-Tenant Isolation

**Commit:** `feat(rbac): validate multi-tenant isolation`
**Goal:** Comprehensive validation that tenants cannot access each other's data
**Tests:** 20 E2E tests
**Depends:** M2 complete

### Tasks

- [ ] M3.1.1 Create organization fixture: org_alpha with admin user, project, templates
- [ ] M3.1.2 Create organization fixture: org_beta with admin user, project, templates
- [ ] M3.1.3 Create organization fixture: org_gamma with admin user, project, templates
- [ ] M3.1.4 Create MiniBob instances for each org (mb-alpha-001, mb-beta-001, mb-gamma-001)
- [ ] M3.1.5 Create API keys for users in each org

- [ ] M3.2.1 Test: org_alpha user cannot query org_beta templates (returns empty)
- [ ] M3.2.2 Test: org_alpha user cannot query org_beta execution traces (returns 404)
- [ ] M3.2.3 Test: org_alpha user cannot query org_beta impulses (returns 404)
- [ ] M3.2.4 Test: org_alpha MiniBob cannot access org_beta data
- [ ] M3.2.5 Test: org_alpha user cannot create data in org_beta (PERMISSIONS block)

- [ ] M3.3.1 Test: User without project access cannot see project templates
- [ ] M3.3.2 Test: User with project access sees project templates
- [ ] M3.3.3 Test: Adding user to project_members grants template access
- [ ] M3.3.4 Test: Removing user from project_members revokes access (re-auth required)
- [ ] M3.3.5 Test: MiniBob scoped to single project cannot access other projects

- [ ] M3.4.1 Test: Global public templates (scope=global, public=true) visible to all orgs
- [ ] M3.4.2 Test: Global non-public templates (scope=global, public=false) not visible
- [ ] M3.4.3 Test: Org-scoped templates (scope=org) not visible to other orgs
- [ ] M3.4.4 Test: Creating global template requires admin role

- [ ] M3.5.1 Dashboard test: Shows only current org data in all views
- [ ] M3.5.2 Dashboard test: Org switcher not available for single-org users

**Completion Criteria:**
- All 20 isolation tests passing
- Zero cross-tenant data leakage verified
- Project-level isolation within org verified

---

## Milestone 4: Pattern Consolidation

**Commit:** `refactor(shared): consolidate common patterns`
**Goal:** Extract duplicated code into shared library for maintainability
**Tests:** All 50 previous tests (regression suite)
**Depends:** M3 complete

### Tasks

- [ ] M4.1.1 Create `repos/metabob-proto/src/shared/` directory structure
- [ ] M4.1.2 Set up TypeScript config for shared exports (tsconfig.json)
- [ ] M4.1.3 Add shared package exports to package.json
- [ ] M4.1.4 Create barrel exports (index.ts) for each subdirectory

- [ ] M4.2.1 Create `shared/errors/error-types.ts` (AppError class, ErrorCode enum)
- [ ] M4.2.2 Create `shared/errors/error-factory.ts` (createError, formatError functions)
- [ ] M4.2.3 Create `shared/errors/error-middleware.ts` (Hono error handler middleware)
- [ ] M4.2.4 Migrate activity-api routes to use shared error factory
- [ ] M4.2.5 Migrate analysis-api routes to use shared error factory

- [ ] M4.3.1 Create `shared/auth/jwt-utils.ts` (extractToken, verifyToken, parseClaimss)
- [ ] M4.3.2 Create `shared/auth/types.ts` (JWTClaims, AuthContext, SessionData)
- [ ] M4.3.3 Create `shared/auth/middleware.ts` (Hono JWT middleware with SurrealDB)
- [ ] M4.3.4 Migrate activity-api jwtAuth.ts to use shared middleware
- [ ] M4.3.5 Migrate analysis-api auth.ts to use shared middleware

- [ ] M4.4.1 Create `shared/logging/logger.ts` (unified Logger class, JSON/text formats)
- [ ] M4.4.2 Create `shared/logging/middleware.ts` (request logging Hono middleware)
- [ ] M4.4.3 Migrate activity-api utils/logger.ts to use shared logger
- [ ] M4.4.4 Migrate analysis-api middleware/logger.ts to use shared logger

- [ ] M4.5.1 Create `shared/query/pagination.ts` (parsePaginationParams, validateLimits)
- [ ] M4.5.2 Create `shared/query/types.ts` (PaginationParams, PaginationResult)
- [ ] M4.5.3 Migrate activity-api impulses.ts to use shared pagination
- [ ] M4.5.4 Migrate analysis-api routes to use shared pagination

- [ ] M4.6.1 Run M1 test suite - verify all 15 tests pass
- [ ] M4.6.2 Run M2 test suite - verify all 15 tests pass
- [ ] M4.6.3 Run M3 test suite - verify all 20 tests pass
- [ ] M4.6.4 Verify error responses have consistent format across services
- [ ] M4.6.5 Remove duplicate code from original locations

**Completion Criteria:**
- All 50 previous tests passing (no regression)
- Shared library created with error, auth, logging, pagination modules
- Duplicate code removed from activity-api and analysis-api
- Error response format consistent across all endpoints

---

## Milestone 5: Dashboard Integration

**Commit:** `feat(dashboard): complete OAuth2 auth flow`
**Goal:** Complete dashboard authentication with full login/logout flow
**Tests:** 10 new E2E tests
**Depends:** M4 complete

### Tasks

- [ ] M5.1.1 Create login page component with email/password form
- [ ] M5.1.2 Implement POST /v2/auth/login in analysis-api (password verification)
- [ ] M5.1.3 Store JWT in secure httpOnly cookie (not localStorage)
- [ ] M5.1.4 Implement AuthContext provider with useAuth hook
- [ ] M5.1.5 Add ProtectedRoute wrapper that redirects to login

- [ ] M5.2.1 Create logout button in header UserMenu component
- [ ] M5.2.2 Implement POST /v2/auth/logout (invalidate session, clear cookie)
- [ ] M5.2.3 Clear local state on logout (AuthContext, cached data)
- [ ] M5.2.4 Redirect to login page after logout

- [ ] M5.3.1 Detect token expiry by checking exp claim in JWT
- [ ] M5.3.2 Implement POST /v2/auth/refresh endpoint (issue new token)
- [ ] M5.3.3 Auto-refresh 2 minutes before expiry (background interval)
- [ ] M5.3.4 Handle refresh failure (clear session, redirect to login)
- [ ] M5.3.5 Queue API requests during refresh (prevent race conditions)

- [ ] M5.4.1 Create profile page showing user info (name, email, role)
- [ ] M5.4.2 Display current org and list of projects
- [ ] M5.4.3 Show API key management (list, create, revoke)
- [ ] M5.4.4 Add password change form (optional, behind feature flag)

- [ ] M5.5.1 Test: Successful login redirects to overview
- [ ] M5.5.2 Test: Invalid credentials shows error message
- [ ] M5.5.3 Test: Protected routes redirect to login when unauthenticated
- [ ] M5.5.4 Test: Logout clears session and redirects to login
- [ ] M5.5.5 Test: Session persists across page reload
- [ ] M5.5.6 Test: Profile shows org and projects

**Completion Criteria:**
- All 10 dashboard auth tests passing
- Login/logout flow complete with secure cookie storage
- Token auto-refresh working before expiry
- User profile page showing org/project membership

---

## Milestone 6: Production Readiness

**Commit:** `feat(deploy): production deployment validation`
**Goal:** Validate system is ready for production deployment
**Tests:** 25 new E2E tests
**Depends:** M5 complete

### Tasks

#### Security Validation
- [ ] M6.1.1 Test: Expired JWT returns 401 with TOKEN_EXPIRED code
- [ ] M6.1.2 Test: Malformed JWT returns 401 (no stack trace in response)
- [ ] M6.1.3 Test: Rate limiting triggers after 5 signin attempts/min
- [ ] M6.1.4 Test: SQL injection attempts return 400 (sanitized input)
- [ ] M6.1.5 Test: XSS attempts sanitized in response (no script execution)

#### Performance Validation
- [ ] M6.2.1 Test: Template query < 100ms with 1000 templates in DB
- [ ] M6.2.2 Test: Execution trace insert < 50ms
- [ ] M6.2.3 Test: 100 concurrent requests handled without 5xx errors
- [ ] M6.2.4 Test: WebSocket handles 50 concurrent connections
- [ ] M6.2.5 Test: Redis cache improves template query latency by 10x

#### Reliability Validation
- [ ] M6.3.1 Test: Service recovers from Redis failure (reconnects automatically)
- [ ] M6.3.2 Test: Service recovers from SurrealDB restart (queries resume)
- [ ] M6.3.3 Test: Circuit breaker triggers on analysis-api 5 consecutive failures
- [ ] M6.3.4 Test: Graceful degradation when analysis-api unavailable
- [ ] M6.3.5 Test: Health endpoint reflects dependency status accurately

#### Deployment Validation
- [ ] M6.4.1 Test: Helm upgrade preserves existing data (no data loss)
- [ ] M6.4.2 Test: Schema migration idempotent (can run multiple times)
- [ ] M6.4.3 Test: Zero-downtime rolling update (requests succeed during deploy)
- [ ] M6.4.4 Test: Rollback restores previous version correctly
- [ ] M6.4.5 Create production deployment runbook in docs/PRODUCTION_DEPLOYMENT.md

#### Dashboard Production Validation
- [ ] M6.5.1 Test: Dashboard loads within 2 seconds
- [ ] M6.5.2 Test: Dashboard handles API errors gracefully (shows error message)
- [ ] M6.5.3 Test: Dashboard works with slow network (loading states)
- [ ] M6.5.4 Test: Dashboard reconnects WebSocket after disconnect
- [ ] M6.5.5 Test: Dashboard handles token expiry gracefully (auto-refresh or redirect)

**Completion Criteria:**
- All 25 production tests passing
- Security: No stack traces leaked, rate limiting working
- Performance: < 100ms queries, 100 concurrent requests handled
- Reliability: Auto-recovery from dependency failures
- Deployment: Zero-downtime upgrade verified

---

## Summary

| Milestone | Tasks | Tests | Commit Message |
|-----------|-------|-------|----------------|
| M1 | 19 | 15 | `feat(rbac): validate existing RBAC infrastructure` |
| M2 | 15 | 15 | `feat(rbac): validate end-to-end data flows` |
| M3 | 22 | 20 | `feat(rbac): validate multi-tenant isolation` |
| M4 | 25 | 50 (regression) | `refactor(shared): consolidate common patterns` |
| M5 | 20 | 10 | `feat(dashboard): complete OAuth2 auth flow` |
| M6 | 25 | 25 | `feat(deploy): production deployment validation` |

**Total: 126 tasks, 135 tests**

---

## Test Execution

### Run All Tests
```bash
cd tests && bun run playwright test
```

### Run Milestone Tests
```bash
# Run specific milestone
bun run playwright test m1-
bun run playwright test m2-
bun run playwright test m3-
bun run playwright test m4-
bun run playwright test m5-
bun run playwright test m6-
```

### Run Dashboard Tests Only
```bash
bun run playwright test dashboard
```

### Run with Playwright UI
```bash
bun run playwright test --ui
```

---

## Dependencies Between Milestones

```
M1 (Foundation)
  │
  ▼
M2 (Data Flows) ─────────────────────┐
  │                                  │
  ▼                                  │
M3 (Isolation)                       │
  │                                  │
  ▼                                  │
M4 (Patterns) ◄──────────────────────┘
  │           (runs M1+M2+M3 as regression)
  ▼
M5 (Dashboard)
  │
  ▼
M6 (Production)
```

Each milestone depends on the previous milestone's tests passing. M4 specifically runs all previous tests as a regression suite to ensure refactoring doesn't break functionality.
