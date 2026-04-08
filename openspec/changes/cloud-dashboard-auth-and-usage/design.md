## Context

The cloud dashboard (`repos/metabob-cloud-dashboard`) is a React 19 + Bun + Tailwind SPA that serves as the primary UI for managing API keys, viewing execution traces, and tracking usage. It currently has authentication UI components (login/signup forms) but cannot complete authentication because the backend endpoints don't exist.

**Current State:**
- Frontend: Login/signup forms ready, JWT token handling in place, API client configured
- Backend: User-vessel has `/v2/auth/me` and `/v2/auth/logout`, but missing `/v2/auth/signup` and `/v2/auth/login`
- Identity-vessel: Has all validation infrastructure (JWT, API key validation, password hashing utils)
- Activity-api: Has execution trace endpoints ready (`/v2/activities/execution-traces`)

**Constraints:**
- Must use existing RBAC model (SurrealDB PERMISSIONS enforce org_id isolation)
- Must follow impulse-driven architecture (no single-use endpoints)
- Password hashing via Bun.password (Argon2id)
- JWT tokens: 15-minute expiry, signed with config secret
- Frontend must work with Bun's HTML imports (no Vite)

**Stakeholders:**
- Dashboard users (organization admins, developers)
- MiniBob instances (will be tracked in execution traces)
- System administrators (need usage/cost visibility)

## Goals / Non-Goals

**Goals:**
- Enable user signup and login flow end-to-end
- Provide visibility into member activity and execution traces
- Show usage metrics and costs (token consumption, LLM costs)
- Create reusable MiniBob activities for future dashboard development
- Remove unused/stub pages to reduce confusion

**Non-Goals:**
- OAuth/SSO integration (future work)
- Email verification flow (start with simple password auth)
- Advanced RBAC UI (role assignment, permissions editor)
- Real-time streaming of execution traces (polling/refresh is sufficient)
- Multi-factor authentication (future work)

## Decisions

### Decision 1: Implement auth endpoints in user-vessel, not identity-vessel

**Rationale:** Identity-vessel is intentionally stateless for validation only. User management (signup, login, password storage) belongs in user-vessel which owns the user database.

**Alternatives Considered:**
- ❌ Put signup/login in identity-vessel: Violates separation of concerns (identity-vessel should remain stateless)
- ❌ Create separate auth-vessel: Over-engineering, user-vessel already manages users
- ✅ Add to user-vessel: Natural fit, already has user CRUD and password utilities

### Decision 2: Atomic org + user creation in signup

**Rationale:** Signup must create both organization and user in a single transaction. If either fails, both should roll back to avoid orphaned records.

**Implementation:**
```typescript
// In user-vessel /v2/auth/signup
1. Generate org_id slug from org_name
2. Create organization record
3. Create user record with role="admin"
4. Link user to org
5. Generate JWT token
6. Return {token, user, org}
// If any step fails, SurrealDB transaction rolls back
```

**Alternatives Considered:**
- ❌ Create org first, then user: User could be orphaned if org fails
- ❌ Create user first, then org: Org could be orphaned if user fails
- ✅ Atomic transaction: Ensures consistency

### Decision 3: Use existing activity-api trace endpoints for execution viewer

**Rationale:** The activity-api already has `/v2/activities/execution-traces` with filtering, pagination, and all trace data. No new backend work needed.

**Alternatives Considered:**
- ❌ Create new aggregated trace API: Unnecessary, existing endpoint has everything
- ❌ Add GraphQL for complex queries: Over-engineering for current needs
- ✅ Use existing REST endpoints: Simple, already multi-tenant aware

### Decision 4: Create dashboard pages as standalone components, not nested routes

**Rationale:** Dashboard uses simple client-side routing with a `currentPage` state variable. Adding React Router would be over-engineering.

**Alternatives Considered:**
- ❌ Add React Router: Too heavy for simple navigation
- ❌ Use Bun's server-side routing: Would require full page reloads
- ✅ Keep existing pattern: Consistent with current architecture

### Decision 5: Store MiniBob dashboard activities in repos/metabob-proto/activities/development/

**Rationale:** This follows the existing pattern for development activities. These templates will be loaded by MiniBob when working on dashboard features.

**Structure:**
```
repos/metabob-proto/activities/development/
├── add-react-dashboard-page.json
├── add-dashboard-api-integration.json
└── dashboard-feature-complete.json
```

**Alternatives Considered:**
- ❌ Store in dashboard repo: Activity templates belong with other activities
- ❌ Create separate dashboard-activities repo: Over-engineering
- ✅ Use metabob-proto/activities/development: Existing location for dev activities

## Risks / Trade-offs

### Risk: Password reset flow not implemented
**Mitigation:** Document this as known limitation. Users can be manually reset via admin endpoint if needed. Add to future roadmap.

### Risk: JWT tokens expire in 15 minutes
**Mitigation:** Acceptable for initial implementation. Token refresh can be added later if users report frequent re-auth. Session storage preserves tokens across page refreshes.

### Risk: Execution traces could grow large and slow down queries
**Mitigation:** Backend already has pagination and filtering. Frontend should implement virtual scrolling if trace lists exceed 100 items.

### Risk: MiniBob activities might not cover all dashboard development patterns
**Mitigation:** Start with 3 core activities (add page, add API, full feature). Iterate based on usage. Activities can be improved through Thompson Sampling as they're used.

### Trade-off: Client-side routing vs server-side routing
**Decision:** Stay with client-side for simplicity.
**Trade-off:** URL doesn't change with page navigation, can't deep-link to pages. Acceptable trade-off for internal dashboard. Can migrate to Bun's server-side routes later if needed.

### Trade-off: Real-time updates vs polling
**Decision:** Start with manual refresh, add polling/WebSocket later.
**Trade-off:** Users must refresh to see new traces. Acceptable for v1, usage analytics are not time-critical.

## Migration Plan

**Deployment Order:**
1. Deploy user-vessel with new auth endpoints (backward compatible, adds new routes)
2. Deploy updated dashboard with new pages (frontend-only, works with or without auth)
3. Test signup/login flow end-to-end against canary
4. Promote to production after validation
5. Register MiniBob activities in activity-api backend

**Rollback Strategy:**
- If auth endpoints fail: Revert user-vessel, frontend degrades to "login unavailable" state
- If dashboard fails: Revert to previous image, auth endpoints remain available for API clients
- Database migrations: User and org schemas already exist, no migration needed

**Testing:**
1. Unit tests for auth endpoints (password hashing, JWT generation)
2. Integration tests for signup → login → authenticated API call flow
3. Manual browser testing of dashboard pages
4. Playwright tests for critical paths (signup, create API key, view traces)

## Open Questions

None - all architectural decisions resolved. Implementation can proceed.
